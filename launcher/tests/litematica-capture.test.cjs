'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {deferredCapture,createForegroundIndex}=require('../litematica-capture.cjs');
const {recorder,original}=require('./litematica-runtime-fixture.cjs');
const {managedSource}=require('../adapters.cjs');
const {adaptLitematicaLoading}=require('../litematica-loading.cjs');
function fixture({failCapture=false}={}){
 const gl=recorder(),source={},target={},p={},q={},vao={},records=[],uniforms=new Map(),textures=new Map(),samplers=new Map();
 let current=source,program=p,unit=gl.TEXTURE0,vertex=vao,bound=null,version=0,scissor=[0,0,800,600],enabled=false,active=true,fault='',draws=0,queries=0;
 const get=gl.getParameter;
 gl.getParameter=function(key){if(key===gl.CURRENT_PROGRAM)return program;if(key===gl.ACTIVE_TEXTURE)return unit;if(key===gl.VERTEX_ARRAY_BINDING)return vertex;if(key===gl.TEXTURE_BINDING_2D)return textures.get(unit)||null;if(key===gl.SAMPLER_BINDING)return samplers.get(unit-gl.TEXTURE0)||null;return get.call(this,key);};
 gl.bindFramebuffer=function(type,value){gl.calls.push(['bindFramebuffer',type,value]);if(type===gl.DRAW_FRAMEBUFFER||type===gl.FRAMEBUFFER)current=value;};
 gl.useProgram=value=>{program=value;};gl.activeTexture=value=>{unit=value;};gl.bindVertexArray=value=>{vertex=value;};gl.bindBuffer=(_type,value)=>{bound=value;};
 gl.bindTexture=(_type,value)=>{textures.set(unit,value);};gl.bindSampler=(at,value)=>{samplers.set(at,value);};
 gl.scissor=(...args)=>{scissor=args;};gl.enable=cap=>{if(cap===gl.SCISSOR_TEST)enabled=true;};gl.disable=cap=>{if(cap===gl.SCISSOR_TEST)enabled=false;};gl.isEnabled=cap=>cap===gl.SCISSOR_TEST&&enabled;
 const values=()=>{let value=uniforms.get(program);if(!value)uniforms.set(program,value=new Map());return value;};
 gl.uniform1f=(loc,value)=>values().set(loc.name,value);
 gl.uniform1fv=(loc,value)=>values().set(loc.name,value[0]);
 gl.uniformMatrix4fv=(loc,_transpose,data,offset=0,length)=>values().set(loc.name,Array.from(data).slice(offset,length?offset+length:undefined));
 gl.getUniform=(p,loc)=>{queries++;return uniforms.get(p)?.get(loc.name)??0;};
 gl.bufferSubData=()=>{version++;};
 gl.drawElements=(...args)=>{if(current===target&&failCapture)throw Error('secondary fault');if(args[0]==='throw')throw Error('source fault');records.push({capture:current===target,program,vertex,bound,version,value:uniforms.get(program)?.get('value')??0,matrix:uniforms.get(program)?.get('matrix'),texture:textures.get(gl.TEXTURE0)||null,sampler:samplers.get(0)||null,unit,scissor:scissor.slice(),enabled,args});return 'source result';};
 const batch=deferredCapture(gl,{active:()=>active&&!fault,current:()=>current,source:()=>source,target:()=>target,region:()=>null,failed:()=>!!fault,fail:e=>{fault=e.message;},bind:a=>{if(a[0]===gl.DRAW_FRAMEBUFFER||a[0]===gl.FRAMEBUFFER)current=a[1];},count:draw=>{if(draw)draws++;}});
 batch.reset({SCISSOR_BOX:scissor,enabled:{SCISSOR_TEST:enabled}});
 return {gl,batch,p,q,source,target,vao,records,loc:{name:'value'},get fault(){return fault;},get draws(){return draws;},get queries(){return queries;},stop(){active=false;batch.detach();}};
}
function parity(h){const source=h.records.filter(r=>!r.capture).map(({capture,...r})=>r),capture=h.records.filter(r=>r.capture).map(({capture,...r})=>r);assert.deepEqual(capture,source);assert.equal(h.fault,'');}
test('A small visible schematic batches 1,000 world draws without 2,000 framebuffer switches',t=>{
 const counts=[];
 for(const adapt of [false,true]){
  const gl=recorder(),context=vm.createContext({});
  // The immediate baseline is the exact 0.6.28 native-frame adapter.
  vm.runInContext(adapt?managedSource('bloxd-litematica','native-frame.js',original('native-frame.js')):adaptLitematicaLoading('native-frame.js',original('native-frame.js').replaceAll('\r\n','\n')),context);
  const f=context.__BLM_CREATE_NATIVE_FRAME__(gl,()=>({})),source={},s={VIEWPORT:[0,0,800,600],DRAW_FRAMEBUFFER_BINDING:source,SCISSOR_BOX:[0,0,800,600],enabled:{SCISSOR_TEST:false},COLOR_CLEAR_VALUE:[0,0,0,1],STENCIL_CLEAR_VALUE:0};
  f.begin(s,{reverse:false},{rect:[0,0,50,50],color:false});gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,source);gl.calls.length=0;
  for(let i=0;i<1000;i++)gl.drawElements(gl.TRIANGLES,3,gl.UNSIGNED_SHORT,0);f.finish();
  counts.push(gl.calls.filter(c=>c[0]==='bindFramebuffer').length);assert.equal(f.diagnostics().totalCapturedDraws,1000);if(adapt)assert.equal(f.diagnostics().captureBatches,1);f.destroy();
 }
 assert.deepEqual(counts,[2000,2]);t.diagnostic('CPU call counts, same 1,000 captured draws: framebuffer binds '+counts.join(' -> ')+'. No FPS/GPU-time measurement.');
});
test('Deferred world draws retain their program, matrix, uniform, VAO, textures and sampler order',()=>{
 const h=fixture(),{gl}=h,a={},b={},matrixLoc={name:'matrix'},m=Float32Array.from({length:16},(_,i)=>i);
 gl.uniform1f(h.loc,1);gl.uniformMatrix4fv(matrixLoc,false,m);gl.bindTexture(gl.TEXTURE_2D,a);gl.bindSampler(0,a);gl.drawElements(1);
 m[0]=99;gl.uniform1f(h.loc,2);gl.uniformMatrix4fv(matrixLoc,false,m);gl.bindVertexArray(b);gl.bindTexture(gl.TEXTURE_2D,b);gl.bindSampler(0,b);gl.drawElements(2);
 gl.useProgram(h.q);gl.uniform1f(h.loc,3);gl.drawElements(3);gl.useProgram(h.p);gl.drawElements(4);h.batch.flush();parity(h);assert.equal(h.queries,0);assert.equal(h.batch.diagnostics().captureBatches,1);h.stop();
});
test('First changes after a draw restore original values, including aliases of one uniform',()=>{
 const h=fixture(),{gl}=h;gl.drawElements(1);gl.uniform1f(h.loc,1);gl.drawElements(2);gl.uniform1f({name:'value'},2);gl.drawElements(3);gl.useProgram(h.q);gl.drawElements(4);h.batch.flush();parity(h);assert.equal(h.queries,2);h.stop();
});
test('The source upload executes once and after all captures that still reference its previous bytes',()=>{
 const h=fixture(),{gl}=h;gl.drawElements(1);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array([1]));assert.equal(h.draws,1);gl.drawElements(2);h.batch.flush();parity(h);assert.deepEqual(h.records.filter(r=>r.capture).map(r=>r.version),[0,1]);assert.equal(h.batch.diagnostics().captureBatches,2);h.stop();
});
test('Offscreen source passes and framebuffer transitions do not leak into the capture',()=>{
 const h=fixture(),{gl}=h;gl.drawElements(1);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,{});gl.uniform1f(h.loc,9);gl.drawElements(2);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,h.source);gl.drawElements(3);h.batch.flush();assert.equal(h.draws,2);assert.deepEqual(h.records.filter(r=>r.capture).map(r=>r.args[0]),[1,3]);h.stop();
});
test('Command/byte limits flush in order and pending copies are released on detach',()=>{
 const h=fixture(),{gl}=h;for(let i=0;i<10000;i++){gl.uniform1f(h.loc,i);gl.drawElements(i);}h.batch.flush();parity(h);const d=h.batch.diagnostics();assert.ok(d.peakCaptureBytes<=1048576);assert.ok(d.peakCaptureCommands<=4096);assert.ok(d.captureBatches>1);gl.drawElements(0);h.stop();assert.equal(h.batch.diagnostics().pendingCaptureBytes,0);assert.equal(h.batch.diagnostics().pendingCaptureCommands,0);
});
test('Mutable uniform upload arrays are copied before JavaScript reuses them',()=>{
 const h=fixture(),{gl}=h,loc={name:'matrix'},values=new Float32Array(16);values.fill(3);gl.uniformMatrix4fv(loc,false,values);gl.drawElements(1);values.fill(9);gl.uniformMatrix4fv(loc,false,values);gl.drawElements(2);values.fill(0);h.batch.flush();parity(h);h.stop();
});
test('Stencil-face and bulk uniform changes flush preceding readers',()=>{
 const h=fixture(),{gl}=h;gl.drawElements(1);gl.stencilMaskSeparate(gl.BACK,123);assert.equal(h.draws,1);gl.drawElements(2);gl.uniformMatrix4fv({name:'matrix'},false,new Float32Array(32));assert.equal(h.draws,2);gl.drawElements(3);h.batch.flush();parity(h);h.stop();
});
test('Native queries and transform feedback never receive additional capture draws',()=>{
 for(const method of ['beginQuery','beginTransformFeedback']){const h=fixture();h.gl[method](1,{});h.gl.drawElements(1);h.batch.flush();assert.equal(h.records.length,1);assert.equal(h.draws,0);assert.match(h.fault,/query or transform feedback/);h.stop();}
});
test('Source results/errors remain synchronous and a secondary fault restores the latest native state',()=>{
 const h=fixture({failCapture:true}),{gl}=h;assert.equal(gl.drawElements(1),'source result');gl.uniform1f(h.loc,9);gl.useProgram(h.q);gl.bindTexture(gl.TEXTURE_2D,h.q);gl.drawElements(2);h.batch.flush();assert.equal(h.fault,'secondary fault');assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),h.q);assert.equal(gl.getParameter(gl.TEXTURE_BINDING_2D),h.q);assert.equal(gl.getUniform(h.p,h.loc),9);assert.equal(h.batch.diagnostics().pendingCaptureBytes,0);assert.throws(()=>gl.drawElements('throw'),/source fault/);h.stop();
});
test('Already wrapped draw methods keep the immediate compatibility path and wrappers restore by ownership',()=>{
 const gl=recorder(),ctx=vm.createContext({WebGL2RenderingContext:function(){}});vm.runInContext(managedSource('bloxd-litematica','native-frame.js',original('native-frame.js')),ctx);const native=gl.drawElements,f=ctx.__BLM_CREATE_NATIVE_FRAME__(gl,()=>({})),source={};
 f.begin({VIEWPORT:[0,0,800,600],DRAW_FRAMEBUFFER_BINDING:source,SCISSOR_BOX:[0,0,800,600],enabled:{SCISSOR_TEST:false},COLOR_CLEAR_VALUE:[0,0,0,1],STENCIL_CLEAR_VALUE:0},{reverse:false});gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,source);gl.drawElements(1);assert.equal(f.diagnostics().totalCapturedDraws,1);assert.equal(f.diagnostics().immediateDraws,1);f.finish();const later=()=>{};gl.drawElements=later;f.destroy();assert.equal(gl.drawElements,later);assert.notEqual(later,native);
});
test('Depth-only capture skips non-writing draws, keeps a cleared sky-only frame ready and preserves color/stencil capture',()=>{
 const gl=recorder(),ctx=vm.createContext({});vm.runInContext(managedSource('bloxd-litematica','native-frame.js',original('native-frame.js')),ctx);const f=ctx.__BLM_CREATE_NATIVE_FRAME__(gl,()=>({})),source={},s={VIEWPORT:[0,0,800,600],DRAW_FRAMEBUFFER_BINDING:source,SCISSOR_BOX:[0,0,800,600],enabled:{SCISSOR_TEST:false},COLOR_CLEAR_VALUE:[0,0,0,1],STENCIL_CLEAR_VALUE:0};
 f.begin(s,{reverse:false},{color:false});gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,source);gl.depthMask(false);gl.drawElements(1);gl.disable(gl.DEPTH_TEST);gl.drawElements(2);assert.equal(f.finish(),true,'cleared depth is valid even with only sky draws');assert.equal(f.diagnostics().capturedDraws,0);assert.equal(f.diagnostics().totalDepthOnlySkippedDraws,2);
 f.begin(s,{reverse:true},{color:false});gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,source);gl.enable(gl.STENCIL_TEST);gl.depthMask(false);gl.drawElements(3);assert.equal(f.finish(),true);assert.equal(f.diagnostics().capturedDraws,1,'stencil-writing draws are retained');
 f.begin(s,{reverse:false},{color:true});gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,source);gl.disable(gl.STENCIL_TEST);gl.depthMask(false);gl.drawElements(4);assert.equal(f.finish(),true);assert.equal(f.diagnostics().capturedDraws,1,'native color still captured');f.destroy();
});
function observable(){const observers=new Set();return {add(fn){observers.add(fn);return fn;},remove(fn){observers.delete(fn);},emit(mesh){for(const fn of observers)fn(mesh);},get size(){return observers.size;}};}
test('Foreground audit bounds a 20,000-mesh scene and event additions discover new actors immediately',()=>{
 let visits=0;const meshes=Array.from({length:20000},()=>({get name(){visits++;return 'chunk';}})),scene={meshes,onNewMeshAddedObservable:observable(),onMeshRemovedObservable:observable()};
 const index=createForegroundIndex(()=>[scene]);assert.equal(index.scan().length,0);assert.ok(visits<=128,'initial foreground scan stays bounded');
 const mesh={name:'held-item:sword'};meshes.push(mesh);scene.onNewMeshAddedObservable.emit(mesh);visits=0;const first=index.scan();assert.equal(first.length,1);assert.equal(first[0].mesh,mesh);assert.ok(visits<=128);assert.equal(index.scan(),first,'reuse actor entries when unchanged');
 scene.onMeshRemovedObservable.emit(mesh);meshes.pop();assert.equal(index.scan().length,0);index.dispose();assert.equal(scene.onNewMeshAddedObservable.size,0);assert.equal(scene.onMeshRemovedObservable.size,0);
});
test('Foreground audit detects parenting changes, rejects terrain descendants and removes replaced scenes',()=>{
 let now=0;const camera={},mesh={name:'item'},terrain={name:'chunk',parent:{name:'player:test'}},scene={meshes:[mesh,terrain]};let scenes=[scene];const context=vm.createContext({performance:{now:()=>now}}),create=vm.runInContext('('+createForegroundIndex.toString()+')',context),index=create(()=>scenes,()=>camera);assert.equal(index.scan().length,0);mesh.parent=camera;now+=500;assert.equal(index.scan()[0].mesh,mesh);mesh.parent=null;now+=500;assert.equal(index.scan().length,0);
 mesh.parent={name:'HeadMesh'};now+=500;assert.equal(index.scan().length,1);scenes=[];now+=500;assert.equal(index.scan().length,0);index.dispose();
});
