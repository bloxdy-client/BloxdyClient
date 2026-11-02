'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {harness,original}=require('./litematica-runtime-fixture.cjs'),{menu,sample}=require('./litematica-menu-fixture.cjs'),{managedSource}=require('../adapters.cjs'),{blockShape,shapeFaces}=require('../litematica-placement.cjs'),{readBlockModel}=require('../litematica-models.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
test('Rotated native variants use the matching registered block ID instead of the original orientation',()=>{
 const {orientName}=require('../litematica-placement.cjs'),registry={};for(let rot=1;rot<=4;rot++){const name=rot===1?'Stone Stairs':`Stone Stairs|meta|rot${rot}|bot`;registry[name]={model:'Stairs',rootMetaDesc:rot===1?'Stone Stairs|meta|rot1|bot':undefined,meta:{rot}};}
 assert.equal(orientName('Stone Stairs',{rotation:90},registry),'Stone Stairs|meta|rot4|bot');assert.equal(orientName('Stone Stairs|meta|rot2|bot',{rotation:90},registry),'Stone Stairs');assert.equal(orientName('Stone Stairs|meta|rot2|bot',{mirror:true},registry),'Stone Stairs|meta|rot4|bot');assert.equal(orientName('Unknown',{rotation:90},registry),'Unknown');
});
test('Partial blocks enclosed by other partial blocks remain in the view and do not hide whole neighbouring faces',()=>{
 const ctx=vm.createContext({performance:{now:()=>0},__BLM_ADAPTER__:{fullCube:()=>false}});vm.runInContext(managedSource('bloxd-litematica','placement.js',original('placement.js')),ctx);const model={size:[3,3,3],selection:[0,0,0],nativeMapping:{'bloxd:1':'Stone Slab'},chunks:[{x:0,y:0,z:0,nonAir:27,data:Uint8Array.from([128,128,2,1])}]},view=ctx.BloxdSchem.createView(model),rows=view.sample(model.nativeMapping,{origin:[0,0,0]},[0,0,0],{distance:128,maxRender:262144,layerMode:'all',showExtra:false});assert.equal(rows.length,27);assert.ok(rows.some(b=>b.x===1&&b.y===1&&b.z===1));assert.ok(rows.every(b=>b.faceMask===63));
});
test('Bundled Draco decoder runs the exact browser worker protocol on a real compressed source asset with no graphics',async t=>{
 const {Worker}=require('node:worker_threads'),fs=require('node:fs'),{workerSource}=require('../litematica-draco.cjs'),bytes=fs.readFileSync(require('node:path').join(__dirname,'fixtures/litematica-compressed.glb'));
 const worker=new Worker("const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=(value,transfer)=>parentPort.postMessage(value,transfer);\n"+workerSource()+"\nparentPort.on('message',data=>self.onmessage({data}));",{eval:true});t.after(()=>worker.terminate());let sequence=0;
 const decode=(data,attributes)=>new Promise((resolve,reject)=>{const id=++sequence,onError=error=>{worker.off('message',listener);reject(error);},listener=message=>{if(message.id!==id)return;worker.off('message',listener);worker.off('error',onError);message.error?reject(Error(message.error)):resolve(message.result);};worker.on('message',listener);worker.once('error',onError);const copy=data.slice().buffer;worker.postMessage({id,bytes:copy,attributes},[copy]);});
 const shape=await readBlockModel(bytes,{scale:1,rot:1,info:{}},decode);assert.ok(shape.triangles.length>0);assert.ok(shape.triangles.every(t=>t.points.flat().every(Number.isFinite)));assert.ok(sequence>0);
});
test('Native subvoxel registrations retain arbitrary partial shapes without guessing from names',()=>{
 const boxes=[.25,0,.25,.75,1,.75,0,.25,0,1,.375,1],meta={name:'Server object',hS:boxes};assert.deepEqual(blockShape(meta).boxes,[boxes.slice(0,6),boxes.slice(6)]);assert.equal(blockShape({hS:[0,0,0,1,1,1]}),null);assert.deepEqual(meta.hS,boxes);
});
test('Native import mapping retains orientations and both banner components, and upgrades old base-only mappings',t=>{
 const h=menu(t),m=sample();h.w.__BLM_ADAPTER__.resolveItemName=id=>id===1?'Cyan Banner|meta|rot3|bot':'_Cyan Banner Flag|meta|rot3|top';m.nativeMapping={'bloxd:1':'Cyan Banner','bloxd:2':'_Cyan Banner Flag'};h.ui.setModel(m,{'bloxd:1':'Cyan Banner','bloxd:2':'_Cyan Banner Flag'});const rows=h.renders.rows();assert.ok(rows.some(b=>b.name==='Cyan Banner|meta|rot3|bot'));assert.ok(rows.some(b=>b.name==='_Cyan Banner Flag|meta|rot3|top'));assert.deepEqual(h.errors,[]);
});
test('Production preview draws 600 frames without replaying a world draw, capturing targets or patching any GL call',()=>{
 const h=harness({directDepth:true}),draw=h.gl.drawElements,uniform=h.gl.uniform1f,bind=h.gl.bindFramebuffer;h.frame();const warm=h.gl.calls.length;
 for(let i=1;i<600;i++)h.frame(i*16);
 assert.equal(h.renderer.diagnostics().directDepth,true);assert.equal(h.renderer.diagnostics().frames,600);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,0);assert.equal(h.samples,600);
 assert.equal(h.gl.calls.filter(c=>c[0]==='drawElements').length,600);assert.equal(h.gl.calls.filter(c=>c[0]==='createFramebuffer').length,0);assert.equal(h.gl.calls.filter(c=>c[0]==='createRenderbuffer').length,0);assert.equal(h.gl.calls.filter(c=>c[0]==='clear').length,0);
 assert.equal(h.gl.drawElements,draw);assert.equal(h.gl.uniform1f,uniform);assert.equal(h.gl.bindFramebuffer,bind);assert.equal(h.renderer.diagnostics().uploads,1);
 assert.ok(h.gl.calls.length>warm);h.renderer.destroy();
});
test('Direct preview never writes or clears native depth; reverse depth, viewport, VAO and failure paths restore state',()=>{
 for(const reverse of [false,true]){const h=harness({directDepth:true}),source={world:true},vao={native:true};h.connection.clip=()=>({half:true,reverse});h.gl.bindFramebuffer(h.gl.DRAW_FRAMEBUFFER,source);h.gl.bindVertexArray(vao);h.gl.depthRange(.2,.8);h.frame();
  assert.equal(h.gl.getParameter(h.gl.DRAW_FRAMEBUFFER_BINDING),source);assert.equal(h.gl.getParameter(h.gl.VERTEX_ARRAY_BINDING),vao);assert.deepEqual(h.gl.getParameter(h.gl.DEPTH_RANGE),[.2,.8]);
  assert.ok(h.gl.calls.some(c=>c[0]==='depthFunc'&&c[1]===(reverse?h.gl.GEQUAL:h.gl.LEQUAL)));assert.equal(h.gl.calls.filter(c=>c[0]==='clear').length,0);
  const sequence=h.gl.calls;let writable=true;for(const c of sequence){if(c[0]==='depthMask')writable=c[1];if(c[0]==='drawArrays')assert.equal(writable,false);}
  assert.ok(sequence.some(c=>c[0]==='uniform1i'&&c[1]==='sceneDepth'&&c[2]===0));
  const raw=h.gl.drawArrays;h.gl.drawArrays=()=>{throw Error('fixture overlay fault');};h.frame(32);assert.match(h.renderer.status(),/fixture overlay fault/);assert.equal(h.gl.getParameter(h.gl.DRAW_FRAMEBUFFER_BINDING),source);assert.equal(h.gl.getParameter(h.gl.VERTEX_ARRAY_BINDING),vao);h.gl.drawArrays=raw;h.frame(48);assert.equal(h.renderer.status(),'');h.renderer.destroy();
 }
});
test('Direct depth finishes exactly once before foreground even with missing world groups and interrupted frames',()=>{
 const h=harness({directDepth:true,earlyGroup:true});for(let i=0;i<20;i++){h.frame(i*16,i%2?[-1,0,1]:[-1,1]);assert.equal(h.renderer.diagnostics().frames,i+1);assert.equal(h.renderer.status(),'');}h.renderer.destroy();
});
test('HUD counts are not published from a partially indexed replacement',()=>{
 const totals=[],h=harness({directDepth:true,actual:1,clockStep:.8,onStats:s=>totals.push(s.totals.total),blocks:Array.from({length:512},(_,x)=>({x,y:0,z:0,name:'Stone',layer:0}))});h.frame();assert.equal(h.renderer.diagnostics().pendingRows,384);assert.deepEqual(totals,[]);for(let i=1;i<4;i++)h.frame(i*300);assert.equal(h.renderer.diagnostics().pendingRows,0);assert.deepEqual(totals,[512]);assert.equal(h.renderer.status(),'');h.renderer.destroy();
});
function adapterFixture(){
 let at=0,layout;const registry={metadatas:{}},scene={getTransformMatrix:()=>null},noa={container:{},inputs:{}},captured={singletons:{noa,blocksClient:registry.metadatas},getBloxd:()=>({getItemName:id=>registry.metadatas[id]?.name,getItemId:name=>registry.metadatas[name]?.id})},ctx=vm.createContext({Date:{now:()=>at},performance:{now:()=>at},document:{querySelector:()=>null},addEventListener(){},__BLOXD_MOD_HOST__:{observeDefinitions:()=>()=>{},onEngine:()=>()=>{}},__BLM_RUNTIME_LAYOUT__:()=>layout});
 layout={scene,registry,world:{owner:{},method:'read'}};ctx.fixtureCaptured=captured;let s=managedSource('bloxd-litematica','adapter.js',original('adapter.js')).replace('let captured = null','let captured = globalThis.fixtureCaptured');s=s.replace('  globalThis.__BLM_ADAPTER__ =', '  globalThis.setPack=value=>texturePack=value;globalThis.__BLM_ADAPTER__ =');vm.runInContext(s,ctx);
 return {ctx,api:ctx.__BLM_ADAPTER__,registry,noa,scene,setLayout(v){layout=v;},get layout(){return layout;},advance(){at+=2000;}};
}
test('Layout discovery wrappers cannot periodically replace the same world connection or its caches',()=>{
 const h=adapterFixture(),first=h.api.connect();for(let i=0;i<50;i++){h.advance();h.setLayout({...h.layout,world:{...h.layout.world}});assert.equal(h.api.connect(),first);}
 h.advance();h.setLayout({...h.layout,world:{owner:{},method:'read'}});assert.notEqual(h.api.connect(),first);
});
test('Water and animated lava retain native normalized RGB and exact variant/part identities',()=>{
 const h=adapterFixture();h.registry.metadatas.Water={textureInfo:[.5,.5,.8,.9]};h.registry.metadatas.Lava={textureInfo:{colour:[.95,.4,.05,.95],animTextures:['lava0']}};h.ctx.setPack({getTexture:()=>({url:'fixture:lava'})});
 const c=h.api.connect();assert.deepEqual(plain(c.texture('Water',2).color),[127.5,127.5,204]);assert.deepEqual(plain(c.texture('Lava',2).color),[242.25,102,12.75]);h.registry.metadatas[99]={name:'_Cyan Banner Flag|meta|rot3|top'};assert.equal(c.actualName(99),'_Cyan Banner Flag|meta|rot3|top');
});
test('Slab, stair, door and trapdoor variants use their actual partial volumes in every orientation',()=>{
 const volume=s=>s.boxes.reduce((n,b)=>n+(b[3]-b[0])*(b[4]-b[1])*(b[5]-b[2]),0);
 for(let rot=1;rot<=4;rot++)for(const half of ['bot','top','side']){const s=blockShape({model:'Slab',meta:{rot,halfblockPlacement:half}});assert.equal(volume(s),.5);for(const b of s.boxes)assert.ok(b.every(n=>n>=0&&n<=1));}
 for(let rot=1;rot<=4;rot++)for(const half of ['bot','top'])for(const corner of [null,'innerLeft','innerRight','outerLeft','outerRight']){const s=blockShape({model:'Stairs',meta:{rot,halfblockPlacement:half,stairsCorner:corner}});assert.equal(volume(s),corner?.startsWith('outer')?.625:corner?.startsWith('inner')?.875:.75);}
 for(let rot=1;rot<=4;rot++)for(const open of [false,true])for(const model of ['door','trapdoor'])assert.equal(volume(blockShape({model,meta:{rot,open}})),.125);
 assert.equal(blockShape({model:'rotatable',blockModel:'_Cyan Banner Flag',modelScale:8,meta:{rot:3}}).model,'_Cyan Banner Flag');
});
test('Shaped surface union omits internal stair faces, retains neighbour cube faces and applies placement transforms',()=>{
 const ctx=vm.createContext({});vm.runInContext(original('geometry.js'),ctx);const g=ctx.__BLM_GEOMETRY__,stone={x:0,y:0,z:0,name:'Stone',layer:0},stairs={x:1,y:0,z:0,name:'Stairs',layer:0,shapeRotation:90,shapeMirror:true},shape=blockShape({model:'Stairs',meta:{rot:1}}),task=shapeFaces([stone,stairs],()=>({key:'one'}),g,name=>name==='Stairs'?shape:null);let step;do{step=task.next();}while(!step.done);assert.ok(step.value.length>6);assert.ok(step.value.filter(e=>e.block===stone).some(e=>e.side===0));assert.ok(step.value.filter(e=>e.block===stairs).flatMap(e=>e.face.corners).some(p=>p.some(n=>n===.5)));
});
function glb(){const positions=new Float32Array([0,0,0,1,0,0,0,1,0]),json={asset:{version:'2.0'},buffers:[{byteLength:positions.byteLength}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.2,.4,.8,1]},doubleSided:false}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],nodes:[{translation:[0,2,0],children:[1]},{mesh:0}],scenes:[{nodes:[0]}],scene:0},raw=Buffer.from(JSON.stringify(json)),length=Math.ceil(raw.length/4)*4,buf=Buffer.alloc(12+8+length+8+positions.byteLength,32);buf.writeUInt32LE(0x46546c67,0);buf.writeUInt32LE(2,4);buf.writeUInt32LE(buf.length,8);buf.writeUInt32LE(length,12);buf.writeUInt32LE(0x4e4f534a,16);raw.copy(buf,20);buf.writeUInt32LE(positions.byteLength,20+length);buf.writeUInt32LE(0x004e4942,24+length);Buffer.from(positions.buffer).copy(buf,28+length);return buf;}
test('Static GLB blocks keep node transforms, real triangle geometry, materials, native scale and offset',async()=>{
 const input=glb(),shape={scale:1,rot:1,info:{yOffset:-.5}},result=await readBlockModel(input,shape);assert.equal(result.triangles.length,1);assert.deepEqual(result.triangles[0].points[0],[.5,2,.5]);assert.deepEqual(result.triangles[0].spec.color,[51,102,204]);assert.deepEqual(result.triangles[0].points[2],[1.5,2,.5]);assert.ok(input.equals(glb()),'asset bytes unchanged');await assert.rejects(readBlockModel(input.subarray(0,30),shape),/GLB/);
});
test('Material quantities sort descending with alphabetical ties in Build, Paste, Save area and Checked',t=>{
 const h=menu(t),m=sample();m.counts={'bloxd:1':2,'bloxd:2':3,'bloxd:3':2};m.nativeMapping={'bloxd:1':'Zinc','bloxd:2':'Stone','bloxd:3':'Amber'};h.ui.setModel(m,m.nativeMapping);h.group('Materials').querySelector('.ControlsSectionHeader').click();
 const names=()=>[...h.group('Materials').querySelectorAll('tbody tr')].map(n=>n.dataset.blmMaterial);assert.deepEqual(names(),['Stone','Amber','Zinc']);h.tab('place');assert.deepEqual(names(),['Stone','Amber','Zinc']);h.tab('select');h.ui.setArea({materials:[{name:'Zinc',count:2},{name:'Stone',count:3},{name:'Amber',count:2}]});assert.deepEqual(names(),['Stone','Amber','Zinc']);h.group('Materials').querySelector('[aria-label="Check Zinc"]').click();h.group('Materials').querySelector('[aria-label="Check Amber"]').click();assert.deepEqual(names(),['Stone','Amber','Zinc']);assert.deepEqual(h.errors,[]);
});
