'use strict';
// Generated document-start tracker + allocator against a CPU GL state model.
// No browser, renderer, graphics context, client or account is created.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {managedSource}=require('../adapters.cjs');
function fixture(definitions=[['atlas',1],['uBvfxSunMap',1]]){
 class Gl {
  constructor(){this.activeProgram=null;this.reads=0;this.reflections=0;this.events=new Map();this.canvas={addEventListener:(name,fn)=>{if(!this.events.has(name))this.events.set(name,[]);this.events.get(name).push(fn);}};}
  getParameter(key){return key===this.MAX_TEXTURE_IMAGE_UNITS?16:key===this.MAX_COMBINED_TEXTURE_IMAGE_UNITS?64:key===this.CURRENT_PROGRAM?this.activeProgram:0;}
  getProgramParameter(p){return p.uniforms.length;}
  getActiveUniform(p,i){this.reflections++;return p.uniforms[i];}
  getUniformLocation(program,name){return {program,name,generation:program.generation};}
  useProgram(p){this.activeProgram=p;}
  linkProgram(p){p.generation++;p.values.clear();}
  getUniform(p,loc){this.reads++;const base=loc.name.replace(/\[\d+\]$/,''),value=p.values.get(base);return value.length===1?value[0]:new Int32Array(value);}
  uniform1i(loc,value){this.uniform1iv(loc,[value]);}
  uniform3fv(loc,data,offset=0,length=0){this.lastInput={loc,data,offset,length};}
  uniformMatrix4fv(loc,transpose,data,offset=0,length=0){this.lastInput={loc,transpose,data,offset,length};}
  uniform1iv(loc,data,offset=0,length=0){
   this.lastInput={loc,data,offset,length};if(!loc||this.activeProgram!==loc.program||loc.generation!==loc.program.generation)return;
   const base=loc.name.replace(/\[\d+\]$/,''),index=Number(/\[(\d+)\]$/.exec(loc.name)?.[1]||0),size=loc.program.uniforms.find(u=>u.name.replace(/\[\d+\]$/,'')===base)?.size||1;
   const n=length||data.length-offset;if(offset<0||n<1||index+n>size||offset+n>data.length)return;
   const values=Array.from(data).slice(offset,offset+n);if(values.some(v=>!Number.isInteger(v)||v<0||v>=64))return;
   const out=loc.program.values.get(base)||new Int32Array(size);out.set(values,index);loc.program.values.set(base,out);
  }
 }
 Object.assign(Gl.prototype,{MAX_TEXTURE_IMAGE_UNITS:1,MAX_COMBINED_TEXTURE_IMAGE_UNITS:2,CURRENT_PROGRAM:3,ACTIVE_UNIFORMS:4,SAMPLER_2D:5,SAMPLER_CUBE:6,SAMPLER_3D:7,SAMPLER_2D_ARRAY:8,SAMPLER_2D_SHADOW:9,TEXTURE0:100});
 const root=vm.createContext({WebGL2RenderingContext:Gl});const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/bloxd-visual-shader-5.6.14.2.bnmod'))),file=pack.files.find(f=>f.path==='bootstrap.js');
 vm.runInContext(managedSource(pack.manifest.id,file.path,Buffer.from(file.data,'base64').toString()),root);
 const gl=new Gl(),program={generation:0,uniforms:definitions.map(([name,size])=>({name:name+(size>1?'[0]':''),size,type:gl.SAMPLER_2D})),values:new Map()};
 for(const [name,size]of definitions)program.values.set(name,new Int32Array(size));gl.useProgram(program);
 return {gl,root,program,units:()=>root.__BVFX_SAMPLER_UNITS__(gl,program),state:()=>root.__BVFX_GL_STATE__(gl)};
}
test('Observed scalar sampler assignments avoid repeated driver reads and handle distinct location aliases',()=>{
 const f=fixture(),{gl,program}=f;f.units();assert.equal(gl.reads,1);const a=gl.getUniformLocation(program,'atlas'),b=gl.getUniformLocation(program,'atlas');
 for(let i=0;i<1000;i++){const value=i%2?4:3;gl.uniform1i(a,value);const units=f.units();assert.notEqual(units.get('uBvfxSunMap'),value);}
 gl.uniform1i(b,3);f.units();gl.uniform1i(a,4);f.units();assert.equal(f.state().samplerValues.read(program,'atlas'),4,'distinct location aliases share the actual uniform value');
 assert.equal(gl.reads,1);assert.equal(gl.reflections,2);
 const before=f.units(),revision=f.state().programRevisions.get(program);gl.uniform1i(a,4);assert.equal(f.state().programRevisions.get(program),revision);assert.equal(f.units(),before);
});
test('Sampler arrays track element writes, offset/length uploads and caller buffer mutation exactly',()=>{
 const f=fixture([['atlas',3],['uBvfxSunMap',1]]),{gl,program}=f;f.units();const base=gl.getUniformLocation(program,'atlas[0]'),second=gl.getUniformLocation(program,'atlas[1]');
 const bytes=new Int32Array([63,15,14,13]);gl.uniform1iv(base,bytes,1,3);assert.equal(gl.lastInput.data,bytes);assert.equal(gl.lastInput.offset,1);assert.equal(gl.lastInput.length,3);bytes.fill(0);
 assert.deepEqual(Array.from(f.state().samplerValues.read(program,'atlas[0]')),[15,14,13]);assert.equal(f.units().get('uBvfxSunMap'),12);
 gl.uniform1i(second,12);assert.deepEqual(Array.from(f.state().samplerValues.read(program,'atlas[0]')),[15,12,13]);assert.equal(f.units().get('uBvfxSunMap'),14);
 gl.uniform1iv(base,new Int32Array([63,2,3,4]),1,0);assert.deepEqual(Array.from(f.state().samplerValues.read(program,'atlas[0]')),[2,3,4]);assert.equal(gl.reads,1);
});
test('Invalid/unknown writes fall back to native values; relink and context restoration invalidate observations',()=>{
 const f=fixture(),{gl,program}=f;f.units();const old=gl.getUniformLocation(program,'atlas');
 gl.uniform1i(old,1000);f.units();assert.equal(gl.reads,2);assert.equal(f.state().samplerValues.read(program,'atlas'),0);
 gl.useProgram(null);gl.uniform1i(old,15);gl.useProgram(program);f.units();assert.equal(gl.reads,3);assert.equal(f.state().samplerValues.read(program,'atlas'),0);
 gl.linkProgram(program);program.values.set('atlas',new Int32Array([2]));f.units();assert.equal(gl.reads,4);assert.equal(gl.reflections,4);
 const before=f.state().programRevisions.get(program);gl.uniform1i(old,15);assert.equal(f.state().programRevisions.get(program),before);assert.equal(f.state().samplerValues.read(program,'atlas'),2);
 for(const fn of gl.events.get('webglcontextlost')||[])fn();for(const fn of gl.events.get('webglcontextrestored')||[])fn();
 program.values.set('atlas',new Int32Array([3]));f.units();assert.equal(gl.reads,5);assert.equal(f.state().samplerValues.read(program,'atlas'),3);
});

test('Generated tracker captures watched float and matrix uploads without driver reads or caller-array aliasing',()=>{
 const f=fixture(),{gl,program}=f,location=gl.getUniformLocation(program,'nativeSun');
 const watched=f.state().watchUniform(location);watched.capture={method:'uniform3fv',size:1};
 for(let i=0;i<1000;i++){
  const source=new Float32Array([99,i,.25,.75,88]);gl.uniform3fv(location,source,1,3);source.fill(0);
  assert.deepEqual(Array.from(watched.value),[i,.25,.75]);assert.equal(watched.valueRevision,watched.revision);
 }
 assert.equal(gl.reads,0);
 const matrixLocation=gl.getUniformLocation(program,'viewProjection'),matrix=f.state().watchUniform(matrixLocation);
 matrix.capture={method:'uniformMatrix4fv',size:1};const values=new Float32Array(16).fill(.25);
 gl.uniformMatrix4fv(matrixLocation,false,values);values.fill(9);assert.deepEqual(Array.from(matrix.value),new Array(16).fill(.25));
 gl.uniformMatrix4fv(matrixLocation,true,values);assert.equal(matrix.value,undefined,'invalid transpose must retain the driver-read fallback');
 gl.useProgram(null);gl.uniform3fv(location,[1,2,3]);assert.equal(watched.value,undefined);
 gl.useProgram(program);gl.linkProgram(program);gl.uniform3fv(location,[1,2,3]);assert.equal(watched.value,undefined,'stale locations cannot seed a relinked program');
});

test('Unsupported and partial uniform writes invalidate observations instead of inventing native values',()=>{
 const {captureWatchedUniform}=require('../shader-performance.cjs'),program={},meta={program,sourceName:'light',link:0};
 const state={currentProgram:program,programKnown:true,linkRevisions:new WeakMap()},entry={revision:1,capture:{method:'uniform3fv',size:1}};
 for(const args of [[{},[1,2]], [{},[1,2,3,4,5,6]], [{},[1,2,3],-1,3]]){
  captureWatchedUniform(entry,meta,'uniform3fv',args,state);assert.equal(entry.value,undefined);
 }
 entry.capture.size=2;captureWatchedUniform(entry,meta,'uniform3fv',[{},[1,2,3]],state);assert.equal(entry.value,undefined);
});
