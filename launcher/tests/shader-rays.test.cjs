'use strict';
// Frozen native CPU definitions + a GL state model. Never starts an engine,
// browser, real GPU context, application, account or network request.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fakeGl}=require('./shader-gl-fixture.cjs');
const {shaderRuntime,liquidPrograms}=require('./shader-runtime-fixture.cjs');
const {rayShaders}=require('../shader-ray-glsl.cjs');
const fixture=require('./fixtures/native-shadow-cpu-2026-11-12.json');
function nativeCpu(){const body=fixture.sections.map(s=>s.code).join('\n').replace('var Wi=DF(32340);','const Wi={e:65535};');return Function('performance','GPUBufferUsage','pn',body+'\nreturn {Casters:Ei,Window:Fn,Entities:Dn,project:hD,triangleBox:UD,worldWords:sp,specialWords:2392064,entityWords:147457,gridWords:4194304};')({now:()=>0},{STORAGE:0,COPY_DST:0},{m:a=>a.values});}
function registry(){return {WpF:1,LD:[false,false],BI:[false,true],JD:[false,false],nDF:[false,false],iyF:[null,null],JI:new Uint32Array(12),qDF:()=>null,ZI:()=>null};}
function chunk(){const data=new Uint16Array(32768);data[32*2]=1;return {i:0,j:0,k:0,enF:false,ky:1,Yf:false,oD:new Uint16Array(32).fill(65535),Qp:{data,stride:[1024,32,1],offset:0}};}
const identity=()=>new Float64Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
test('Frozen native block records retain exact cell bits across edits, removal and negative coordinates',()=>{
 const cpu=nativeCpu(),words=new Uint32Array(cpu.worldWords),special=new Uint32Array(cpu.specialWords),meta=registry(),caster=new cpu.Casters((a,b)=>special.set(b,a),()=>Promise.reject(Error('No texture in fixture')));caster.update(meta,2);
 assert.equal(caster.blockCaster[1],65535);const w=new cpu.Window(caster,(a,b)=>words.set(b,a),(a,b)=>special.set(b,a)),c=chunk();w.update([.5,.5,.5],(x,y,z)=>x===0&&y===0&&z===0?c:null,1);
 assert.equal(words[3]&255,3);const at=12348;assert.equal(words[at]>>>0,256,'cell y=2 is bit 8');
 c.Qp.data.fill(0);c.ky++;w.update([.5,.5,.5],()=>c,1);assert.equal(words[3]&255,1,'edited chunk becomes genuinely empty');
 c.i=-1;c.ky++;c.Qp.data[31*1024+32*2+1]=1;w.update([-.5,.5,.5],(x,y,z)=>x===-1&&y===0&&z===0?c:null,1);const record=20*4;assert.equal(words[record]>>>0,0xffffffff);assert.equal(words[record+3]&255,3);
 c.enF=true;w.update([-.5,.5,.5],()=>null,1);assert.equal(words[record+3],0,'disposed chunks never leave a shadow');
});
test('Native slab casters retain their 8-cell shape instead of becoming full cubes',()=>{
 const cpu=nativeCpu(),data=new Uint32Array(cpu.specialWords),meta=registry();meta.LD[1]=true;meta.qDF=()=>[0,0,0,1,.5,1];const c=new cpu.Casters((a,b)=>data.set(b,a),()=>Promise.reject());c.update(meta,2);const id=c.blockCaster[1];assert(id>0&&id<65535);assert.equal(data[id*4],1);const mask=data[id*4+1];assert.equal(data[mask],0xffffffff);assert.equal(data[mask+1],0);assert.equal(data[mask+14],0xffffffff);assert.equal(data[mask+15],0);
});
test('Native actor grids reuse geometry while moving transforms and light bins change',()=>{
 const cpu=nativeCpu(),writes=[],e=new cpu.Entities({createBuffer:x=>x,queue:{writeBuffer:(b,...args)=>writes.push([b.label,...args])}}),view=new Float32Array(16),m=identity();cpu.project(view,8,[0,0,0],[0,1,0]);
 const geometry={vertexAttributes:[{kind:'position',values:new Float32Array([0,0,0,1,0,0,0,1,0])}],vertexCount:3,indexData:new Uint32Array([0,1,2])};
 const model={geometry,indexed:true,first:0,count:3,skip:null,yD:m,worldAt:0,instances:null,instanceCount:1,thin:false},visit={forEachSunShadowCaster:fn=>fn(model)};
 e.update(view,8,visit);assert.equal(e.frame.parts,1);const gridTop=e.gridTop;assert(gridTop>0);assert.equal(writes.filter(x=>x[0]==='sun-shadow-entity-grids').length,1);
 m[12]=4;e.update(view,8,visit);assert.equal(e.frame.parts,1);assert.equal(e.gridTop,gridTop);assert.equal(writes.filter(x=>x[0]==='sun-shadow-entity-grids').length,1,'motion updates transforms, not voxel geometry');
 m[0]=0;m[5]=0;m[10]=0;e.update(view,8,visit);assert.equal(e.frame.parts,0,'singular transforms do not cast');
});
function rayGl(){
 const gl=fakeGl();Object.assign(gl,{RGBA32UI:5000,RGBA_INTEGER:5001,UNSIGNED_INT_SAMPLER_2D:5002});
 gl.uniform3i=(loc,...values)=>{assert.equal(loc.program,gl.getParameter(gl.CURRENT_PROGRAM));loc.program.values??=new Map();loc.program.values.set(loc.name,values);};
 gl.texSubImage2D=(...args)=>gl.calls.push(['texSubImage2D',...args.slice(0,-1),args.at(-1).byteLength]);
 const link=gl.linkProgram;gl.linkProgram=p=>{link(p);
  // The shared model reads single declarations. Ray GLSL also groups scalar
  // and vector declarations; reflect their additional names for integration.
  for(const s of p.shaders||[])for(const declaration of s.source.matchAll(/\buniform\s+(?:highp\s+)?(\w+)\s+([^;]+);/g))for(const item of declaration[2].split(',')){const name=item.trim();if(/^uBvfxRay\w+$/.test(name)&&!p.uniforms.some(u=>u.name===name))p.uniforms.push({name,type:gl.FLOAT,size:1});}
  p.uniforms=p.uniforms.filter(u=>u.name!=='uBvfxRayVolume'||!p.shaders?.some(s=>s.source.includes('#define BVFX_RAY_VOLUME_PASS'))).map(u=>u.name==='uBvfxRayData'?{...u,type:gl.UNSIGNED_INT_SAMPLER_2D}:u);
 };return gl;
}
function rayFixture(){
 const cpu=nativeCpu(),gl=rayGl(),meta=registry(),c=chunk(),world={on(){},off(){}};
 const settings={enabled:true,sunShadowEnabled:true,entityShadows:false,sunStrength:.75,sunFloor:.5,sunAzimuth:135,sunElevation:35},root={__BVFX_LOAD_RAY_CPU__:()=>Promise.resolve(cpu),__BVFX_RUNTIME_LAYOUT__:()=>({world:{owner:world,chunkAt:(x,y,z)=>Math.floor(x/32)===0&&Math.floor(y/32)===0&&Math.floor(z/32)===0?c:null},registry:meta,originKey:'origin'})};
 const code=fs.readFileSync(path.join(__dirname,'../builtin-mods/shader-rays.js'),'utf8').replace('/* BVFX_RAY_SHADERS */null',()=>JSON.stringify(rayShaders()));vm.runInNewContext(code,{window:root,performance:{now:()=>0},ArrayBuffer,Uint32Array,Uint8Array,Float32Array,Int32Array});const rays=root.__BVFX_CREATE_RAYS__(settings),scene={activeCamera:{position:{x:.5,y:.5,z:.5}}},game={origin:[0,0,0]};return {gl,rays,scene,game,settings,root,c};
}
test('Ray light-cache updates preserve native GL state and stop when an unchanged cache is complete',async()=>{
 const {gl,rays,scene,game,settings}=rayFixture(),native=gl.createProgram();gl.useProgram(native);gl.scissor(2,3,400,300);gl.enable(gl.SCISSOR_TEST);gl.enable(gl.DEPTH_TEST);const before=[gl.getParameter(gl.VIEWPORT),gl.getParameter(gl.SCISSOR_BOX),gl.getParameter(gl.ACTIVE_TEXTURE)];
 rays.update(gl,scene,game,()=>{});await new Promise(resolve=>setImmediate(resolve));for(let i=0;i<18;i++)rays.update(gl,scene,game,()=>{});
 assert.match(rays.diagnostic,/Voxel ray shadows/);assert.equal(rays.ready,true);assert.equal(rays.shadowDiagnostics.lightCacheReady,true);assert(rays.shadowDiagnostics.logicalGpuBytes<52*1024*1024);
 const count=gl.calls.filter(c=>c[0]==='draw').length,uploads=gl.calls.filter(c=>c[0]==='texSubImage2D').length;for(let i=0;i<20;i++)rays.update(gl,scene,game,()=>{});assert.equal(gl.calls.filter(c=>c[0]==='draw').length,count);assert.equal(gl.calls.filter(c=>c[0]==='texSubImage2D').length,uploads);
 assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),native);assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),null);assert.deepEqual([gl.getParameter(gl.VIEWPORT),gl.getParameter(gl.SCISSOR_BOX),gl.getParameter(gl.ACTIVE_TEXTURE)],before);assert(gl.isEnabled(gl.DEPTH_TEST)&&gl.isEnabled(gl.SCISSOR_TEST));
 assert.equal([...gl.allocations.values()].filter(a=>a[2]===gl.DEPTH_COMPONENT24).length,0,'ray engine never allocates shadow depth maps');
 settings.sunShadowEnabled=false;rays.refresh();assert.equal(rays.ready,false);assert(gl.calls.some(c=>c[0]==='deleteTexture'));
});
test('Ray programs use the new path by default and keep legacy resolution settings out of receivers',()=>{
 const r=shaderRuntime({shadowEngine:undefined,sunResolutionExponent:13,sunFrameRate:5,sunRange:160});assert.equal(r.state.shadowEngine,'voxel-ray-v1');for(const kind of ['water','lava']){const fragment=liquidPrograms(r,kind).fragment;assert.match(fragment,/bvfxRayVisibility/);assert.doesNotMatch(fragment,/uBvfxSunMap\b|uBvfxSunDetailMap|uBvfxSunTexel/);}
 const native='#version 300 es\nprecision highp float;out vec4 colour;void main(){colour=vec4(1);}';assert.equal(r.sun.patch(native),native);
});
test('Native source adapter rejects drift before executing any source',()=>{
 const {createNativeRayCpu}=require('../shader-ray-native.cjs');assert.throws(()=>createNativeRayCpu('throw Error("must not execute")',()=>0),/contract changed/);
});
test('Shipped sun adapter attaches the ray engine, assigns distinct sampler types and clears it on disable',async()=>{
 const r=shaderRuntime({shadowEngine:undefined,enabled:true,sunShadowEnabled:true,entityShadows:true}),gl=rayGl(),callbacks=new Set(),meta=registry(),c=chunk(),listeners=new Set(),cpu=nativeCpu();let observed,geometryReads=0;
 const NativeEntities=cpu.Entities;cpu.Entities=class extends NativeEntities {update(...args){super.update(...args);observed=this;}};
 const geometry={_indices:new Uint32Array([0,1,2])},buffer={},actor={name:'BodyMesh',metadata:{},noa_in_dynamic_list:true,material:{},isVisible:true,visibility:1,_geometry:geometry,getVerticesData(){geometryReads++;return new Float32Array([0,0,0,1,0,0,0,1,0]);},getVertexBuffer:()=>buffer,getWorldMatrix:identity,computeWorldMatrix:identity,isDisposed:()=>false};
 const matrices=new Float32Array(48);for(let i=0;i<3;i++){matrices.set(identity(),i*16);matrices[i*16+12]=i*2;}
 const {group}=require('./shader-instance-fixture.cjs').nativeVariation(actor,matrices,2),manager={thinMeshes:[group],objectData:{}};
 const world={on:(event,fn)=>listeners.add(fn),off:(event,fn)=>listeners.delete(fn)},scene={meshes:[actor],activeCamera:{position:{x:.5,y:.5,z:.5}},getEngine:()=>({_gl:gl}),onBeforeDrawPhaseObservable:{add(fn){callbacks.add(fn);return fn;},remove(fn){callbacks.delete(fn);}}},game={origin:[0,0,0],renderer:{scene:null,manager}};game.renderer.scene=scene;
 r.root.__BVFX_LOAD_RAY_CPU__=()=>Promise.resolve(cpu);r.root.__BVFX_RUNTIME_LAYOUT__=()=>({world:{owner:world,chunkAt:(x,y,z)=>Math.floor(x/32)===0&&Math.floor(y/32)===0&&Math.floor(z/32)===0?c:null},registry:meta,originKey:'origin'});
 const p=gl.createProgram(),s=gl.createShader(gl.FRAGMENT_SHADER);gl.shaderSource(s,liquidPrograms(r,'water').fragment);gl.attachShader(p,s);gl.linkProgram(p);p.uniforms=p.uniforms.filter(u=>u.name.startsWith('uBvfxRay'));gl.useProgram(p);const loc=r.sun.locations(gl,p);
 r.sun.attach(scene,game);r.sun.bind(gl,loc);assert.equal(callbacks.size,1);for(const fn of callbacks)fn();await new Promise(resolve=>setImmediate(resolve));for(let i=0;i<18;i++)for(const fn of callbacks)fn();
 r.sun.bind(gl,loc);assert.equal(r.sun.ready,true,r.sun.diagnostic);assert.equal(r.sun.resolutionInfo,null);assert.equal(p.values.get('uBvfxRayActive'),1);assert.notEqual(p.values.get('uBvfxRayData'),p.values.get('uBvfxRayVolume'));assert.equal(listeners.size,1);gl.validateDraw();
 assert.equal(r.sun.shadowDiagnostics.entityParts,2,'only enabled native instance slots cast');assert.equal(geometryReads,1,'immutable model geometry is decoded once');const row=observed.frame.floats[81924];matrices[12]=5;for(const fn of callbacks)fn();assert.notEqual(observed.frame.floats[81924],row,'current native transforms reach the ray frame');assert.equal(geometryReads,1);
 r.state.sunShadowEnabled=false;r.sun.refresh();r.sun.bind(gl,loc);assert.equal(p.values.get('uBvfxRayActive'),0);assert.equal(r.sun.ready,false);assert.equal(listeners.size,0);gl.validateDraw();r.sun.dispose();assert.equal(callbacks.size,0);
});
test('Verified CPU source loading shares one fetch and permits retry after a rejected source',async()=>{
 const {installNativeRayCpu}=require('../shader-ray-native.cjs'),root={},bytes=new Uint8Array(296647),expected=Uint8Array.from(Buffer.from(fixture.sha256||fixture.sourceSha256,'hex'));let requests=0,accept=false,builds=0;
 // Only loader behavior runs here; the build callback never evaluates source.
 const install=vm.runInNewContext('('+installNativeRayCpu.toString()+')',{fetch:async()=>{requests++;return {ok:true,arrayBuffer:async()=>bytes.buffer};},crypto:{subtle:{digest:async()=>accept?expected.buffer:new Uint8Array(32).buffer}},TextDecoder,Uint8Array,performance:{now:()=>0}});
 install(root,()=>{builds++;return {contract:true};});await assert.rejects(root.__BVFX_LOAD_RAY_CPU__(),/source verification/);assert.equal(builds,0);accept=true;const a=root.__BVFX_LOAD_RAY_CPU__(),b=root.__BVFX_LOAD_RAY_CPU__();assert.equal(a,b);assert.deepEqual(await a,{contract:true});assert.equal(requests,2);assert.equal(builds,1);
});
