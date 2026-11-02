'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {managedSource}=require('../adapters.cjs'),{harness,recorder,original}=require('./litematica-runtime-fixture.cjs');
function schematic({size=[32,32,32],selection=[0,0,0],chunks=[{p:[0,0,0],runs:[[32768,1]]}],version=4,metadata=[]}={}){
 const bytes=[version,0,0,0],uint=value=>{const out=[];do{let b=value%128;value=Math.floor(value/128);if(value)b|=128;out.push(b);}while(value);return out;},int=n=>uint(n<0?-2*n-1:2*n),push=n=>bytes.push(...int(n)),str=text=>{const data=Buffer.from(text);push(data.length);bytes.push(...data);};
 str('fixture');for(const n of [...selection,...size])push(n);push(chunks.length);
 for(const c of chunks){for(const n of c.p)push(n);const data=c.runs.flatMap(([count,id])=>[...uint(count),...uint(id)]);push(data.length);for(const byte of data)bytes.push(byte);}
 push(0);push(metadata.length);for(const row of metadata){for(const n of row.slice(0,3))push(n);str(row[3]);}if(metadata.length)push(0);for(const n of [0,0,0,0,0])push(n);return Uint8Array.from(bytes);
}
function parser(adapt=true,{cancelled=()=>false,clockStep=.2}={}){
 let now=0,yields=0,resolves=0;
 const context=vm.createContext({Uint8Array,TextDecoder,BLOXD_BLOCK_IDS:{1:'Stone',2:'Dirt',3:'Grass|variant'},BloxdSchem:{},performance:{now:()=>now+=clockStep},setTimeout(fn){yields++;setImmediate(fn);}});
 vm.runInContext(adapt?managedSource('bloxd-litematica','bloxdschem.js',original('bloxdschem.js')):original('bloxdschem.js'),context);
 return {parse:bytes=>context.BloxdSchem.parseBloxdSchem(bytes,'test',id=>{resolves++;return context.BLOXD_BLOCK_IDS[id];},{cancelled}),get yields(){return yields;},get resolves(){return resolves;}};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('Responsive import matches original clipped RLE counts, rows, variants, chunks and metadata',async()=>{
 const fixtures=[{}, {selection:[5,7,9],size:[41,35,33],chunks:[{p:[0,0,0],runs:[[7000,0],[23000,1],[2768,3]]},{p:[1,1,1],runs:[[3000,2],[29768,0]]}],metadata:[[1,2,3,'data']]}, {selection:[-11,-4,-7],size:[49,23,51],chunks:[{p:[-1,-1,-1],runs:[[32768,2]]},{p:[0,0,0],runs:[[32768,1]]}]}];
 for(const f of fixtures){const bytes=schematic(f),a=parser(false),b=parser(true),before=plain(await a.parse(bytes)),after=plain(await b.parse(bytes));if(before.nativeMapping['bloxd:3'])before.nativeMapping['bloxd:3']='Grass|variant';before.warnings=before.warnings.filter(w=>!w.startsWith('Block variant states'));assert.deepEqual(after,before);}
});
test('Dense 7.99-million-block import counts runs once and yields to the event loop',async t=>{
 const bytes=schematic({size:[244*32,32,32],chunks:Array.from({length:244},(_,x)=>({p:[x,0,0],runs:[[32768,1]]}))}),old=parser(false),next=parser();
 const before=await old.parse(bytes),after=await next.parse(bytes);assert.equal(after.blockCount,7995392);assert.equal(after.blocks.length,0);assert.deepEqual(plain(after),plain(before));assert.equal(next.resolves,1);assert.equal(old.yields,0);assert.ok(next.yields>10);
 t.diagnostic('Original per-cell count: 7,995,392; adapted compressed runs: 244; timer yields: '+next.yields+' (CPU-only fixture, no FPS measurement).');
});
test('Sparse run streams and metadata yield too, and cancellation prevents committing a later import',async()=>{
 let stop=false;const manyRuns=Array.from({length:32768},(_,i)=>[1,i%2]),bytes=schematic({chunks:[{p:[0,0,0],runs:manyRuns}]}),p=parser(true,{cancelled:()=>stop,clockStep:1});
 setImmediate(()=>{stop=true;});await assert.rejects(p.parse(bytes),{name:'AbortError'});assert.ok(p.yields>0);
 const metadata=Array.from({length:4096},()=>[0,0,0,'data']),m=parser(true,{clockStep:3});await m.parse(schematic({metadata}));assert.ok(m.yields>10);
});
test('Responsive import keeps corruption, duplicate, block-count, truncation and version validation',async()=>{
 const bad=[schematic({version:5}),schematic({chunks:[{p:[0,0,0],runs:[[32767,1]]}]}),schematic({chunks:[{p:[0,0,0],runs:[[32768,1]]},{p:[0,0,0],runs:[[32768,1]]}]}),schematic({chunks:[{p:[0,0,0],runs:[[32768,0]]}]}),schematic().subarray(0,20),schematic({size:[245*32,32,32],chunks:Array.from({length:245},(_,x)=>({p:[x,0,0],runs:[[32768,1]]}))})];
 for(const bytes of bad){let previous;try{await parser(false).parse(bytes);}catch(e){previous=e.message;}assert.ok(previous);await assert.rejects(parser().parse(bytes),e=>e.message===previous);}
});
test('Stable visible geometry reuses attribute bindings rather than configuring them each frame',()=>{
 const h=harness();h.frame();const count=()=>h.gl.calls.filter(c=>c[0]==='vertexAttribPointer').length,initial=count();assert.ok(initial>=6);for(let i=1;i<=30;i++)h.frame(i*16);assert.equal(count(),initial);assert.equal(h.renderer.diagnostics().frames,31);h.renderer.destroy();
});
test('Visible missing preview captures full-resolution depth only inside its conservative screen region',()=>{
 const h=harness();h.matrix[0]=h.matrix[5]=.1;h.frame();const d=h.renderer.diagnostics().capture;assert.equal(d.colorCapture,false);assert.ok(d.region[2]*d.region[3]<800*600/10);assert.equal(h.renderer.diagnostics().nativeDepth,true);
 h.setActual(2);h.frame(50);assert.equal(h.renderer.diagnostics().capture.colorCapture,true);h.renderer.destroy();
});
test('Capture intersects source scissor and restores it after the world batch',()=>{
 const gl=recorder(),source={source:true},ctx=vm.createContext({});vm.runInContext(managedSource('bloxd-litematica','native-frame.js',original('native-frame.js')),ctx);
 const f=ctx.__BLM_CREATE_NATIVE_FRAME__(gl,()=>({})),s={VIEWPORT:[10,20,800,600],DRAW_FRAMEBUFFER_BINDING:source,SCISSOR_BOX:[20,30,200,200],enabled:{SCISSOR_TEST:true},COLOR_CLEAR_VALUE:[0,0,0,1],STENCIL_CLEAR_VALUE:0};
 f.begin(s,{reverse:false},{rect:[100,100,400,300],color:false});gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,source);gl.calls.length=0;gl.drawElements(gl.TRIANGLES,3,gl.UNSIGNED_SHORT,0);f.finish();
 const scissors=gl.calls.filter(c=>c[0]==='scissor');assert.deepEqual(scissors.map(c=>c.slice(1)),[[100,100,120,130],[20,30,200,200]]);assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),source);
 f.begin({...s,SCISSOR_BOX:[110,120,10,15]},{reverse:false},{rect:[100,100,400,300]});gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,source);gl.scissor(110,120,10,15);gl.calls.length=0;gl.drawElements(gl.TRIANGLES,3,gl.UNSIGNED_SHORT,0);f.finish();assert.ok(gl.calls.filter(c=>c[0]==='scissor').every(c=>JSON.stringify(c.slice(1))==='[110,120,10,15]'));
 f.finish();f.destroy();
});
test('Near-plane crossing keeps a full capture and nonzero viewports retain source coordinates',()=>{
 const h=harness();h.matrix[3]=-2;h.frame();assert.deepEqual(Array.from(h.renderer.diagnostics().capture.region),[0,0,800,600]);h.renderer.destroy();
});
test('Mesh uploads use bounded slices and commit a new buffer only after all slices finish',()=>{
 const rows=Array.from({length:512},(_,i)=>({x:i%8,y:Math.floor(i/64),z:Math.floor(i/8)%8,name:'Stone',layer:0,faceMask:63})),h=harness({blocks:rows,actual:2});h.frame();
 for(let frame=1;frame<100&&!h.renderer.diagnostics().uploads;frame++)h.frame(frame*16);
 const uploads=h.gl.calls.filter(c=>c[0]==='bufferSubData');assert.ok(uploads.length>1);assert.ok(uploads.every(c=>c[3].byteLength<=262144));assert.equal(h.renderer.status(),'');assert.equal(h.renderer.diagnostics().uploads,1);h.renderer.destroy();
});
test('A cancelled partial upload retains the committed mesh and releases all private buffers',()=>{
 const h=harness({actual:2});h.frame();assert.equal(h.renderer.diagnostics().uploads,1);h.setClockStep(.15);
 const upload=h.gl.bufferSubData;h.gl.bufferSubData=function(...args){const result=upload.apply(this,args);h.setClockStep(5);return result;};
 h.setBlocks(Array.from({length:512},(_,i)=>({x:i%8,y:Math.floor(i/64),z:Math.floor(i/8)%8,name:'Stone',layer:0,faceMask:63,status:'wrong',actualName:'Dirt'})));
 h.gl.calls.length=0;for(let frame=1;frame<100&&!h.gl.calls.some(c=>c[0]==='bufferSubData');frame++)h.frame(frame*16);
 assert.ok(h.gl.calls.some(c=>c[0]==='bufferSubData'));assert.equal(h.renderer.diagnostics().uploads,1,'old buffer stays committed until the complete upload');
 const deletions=h.gl.calls.filter(c=>c[0]==='deleteBuffer').length;h.renderer.invalidate();h.setBlocks([]);h.frame(2000);h.renderer.destroy();assert.ok(h.gl.calls.filter(c=>c[0]==='deleteBuffer').length>deletions);
});
test('A failed secondary draw restores the original framebuffer/scissor and releases its wrappers',()=>{
 const gl=recorder(),source={},ctx=vm.createContext({});const draw=function(){if(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==source)throw Error('synthetic capture fault');};gl.drawElements=draw;
 vm.runInContext(managedSource('bloxd-litematica','native-frame.js',original('native-frame.js')),ctx);const f=ctx.__BLM_CREATE_NATIVE_FRAME__(gl,()=>({}));
 f.begin({VIEWPORT:[0,0,800,600],DRAW_FRAMEBUFFER_BINDING:source,SCISSOR_BOX:[1,2,300,400],enabled:{SCISSOR_TEST:false},COLOR_CLEAR_VALUE:[0,0,0,1],STENCIL_CLEAR_VALUE:0},{reverse:false},{rect:[10,20,100,100]});gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,source);gl.calls.length=0;gl.drawElements();f.finish();
 assert.equal(f.diagnostics().fault,'synthetic capture fault');assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),source);assert.deepEqual(gl.calls.filter(c=>c[0]==='scissor').at(-1).slice(1),[1,2,300,400]);assert.equal(f.active(),false);f.destroy();assert.equal(gl.drawElements,draw);
});
test('Filtered cached cells respect the view budget and an empty completed view drops the old rows',()=>{
 const ctx=vm.createContext({performance:{now:()=>++now}});let now=0;vm.runInContext(managedSource('bloxd-litematica','placement.js',original('placement.js')),ctx);
 const view=ctx.BloxdSchem.createView({size:[32,32,32],selection:[0,0,0],chunks:[{x:0,y:0,z:0,nonAir:32768,data:Uint8Array.from([128,128,2,1])}]}),state={layerMode:'all',layer:0,layerEnd:0,distance:128,maxRender:262144,showExtra:false},mapping={'bloxd:1':'Stone'},opts={origin:[0,0,0]};
 let rows;for(let i=0;i<500;i++){rows=view.sample(mapping,opts,[0,0,0],state);if(!view.pending())break;}assert.ok(rows.length>0);assert.equal(view.pending(),false);
 state.layerMode='range';state.layer=100;state.layerEnd=101;const first=view.sample(mapping,opts,[0,0,0],state);assert.equal(view.pending(),true,'skipped cells also yield');assert.equal(first,rows,'keep the same old row array while pending');
 let final;for(let i=0;i<200;i++){final=view.sample(mapping,opts,[0,0,0],state);if(!view.pending())break;}assert.equal(view.pending(),false);assert.equal(final.length,0);assert.equal(final.retainPrevious,false);
});
