'use strict';
// A CPU driver model exercises actual generated document-start state guards.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {managedSource}=require('../adapters.cjs'),{fakeGl}=require('./shader-gl-fixture.cjs');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/bloxd-visual-shader-5.6.14.2.bnmod')));
function fixture(){
 const native=fakeGl(),raw=native.getParameter,values=new Map();let reads=0;
 for(const [key,value]of [['COLOR_WRITEMASK',[true,true,true,true]],['DEPTH_WRITEMASK',true],['DEPTH_FUNC',native.LESS],['DEPTH_CLEAR_VALUE',1],['DEPTH_RANGE',new Float32Array([0,1])],['POLYGON_OFFSET_FACTOR',0],['POLYGON_OFFSET_UNITS',0]])values.set(native[key],value);
 native.getParameter=p=>{reads++;return values.has(p)?values.get(p):raw(p);};
 const enabled=native.isEnabled;native.isEnabled=c=>{reads++;return enabled(c);};
 native.colorMask=(...v)=>values.set(native.COLOR_WRITEMASK,v.map(Boolean));native.depthMask=v=>values.set(native.DEPTH_WRITEMASK,Boolean(v));
 native.depthFunc=v=>{if([native.LESS,native.LEQUAL].includes(v))values.set(native.DEPTH_FUNC,v);};native.clearDepth=v=>values.set(native.DEPTH_CLEAR_VALUE,Math.fround(Math.max(0,Math.min(1,v))));
 native.depthRange=(a,b)=>values.set(native.DEPTH_RANGE,new Float32Array([a,b]));native.polygonOffset=(a,b)=>{values.set(native.POLYGON_OFFSET_FACTOR,Math.fround(a));values.set(native.POLYGON_OFFSET_UNITS,Math.fround(b));};
 const viewport=native.viewport;native.viewport=(...v)=>{if(v[2]>=0&&v[3]>=0)viewport(...v);};
 const remove=native.deleteFramebuffer;native.deleteFramebuffer=f=>{if(raw(native.DRAW_FRAMEBUFFER_BINDING)===f)native.bindFramebuffer(native.DRAW_FRAMEBUFFER,null);if(raw(native.READ_FRAMEBUFFER_BINDING)===f)native.bindFramebuffer(native.READ_FRAMEBUFFER,null);remove(f);};
 class Gl{}Object.assign(Gl.prototype,native);const root=vm.createContext({WebGL2RenderingContext:Gl,performance:{now:()=>0},window:null});root.window=root;
 const source=name=>{const f=pack.files.find(f=>f.path===name);return managedSource(pack.manifest.id,name,Buffer.from(f.data,'base64').toString());};
 vm.runInContext(source('bootstrap.js'),root);vm.runInContext(source('sun-shadows.js').replace('return { invalidateTerrain, qualities,','return { capture, restore, invalidateTerrain, qualities,'),root);
 const gl=new Gl(),sun=root.__BVFX_CREATE_SUN__({},()=>{});
 return {gl,root,sun,raw,reads:()=>reads,reset:()=>{reads=0;}};
}

test('Actual shadow guards need no steady driver reads and restore all observed native writes',()=>{
 const {gl,sun,reads,reset}=fixture(),program=gl.createProgram(),vao=gl.createVertexArray(),buffer=gl.createBuffer(),draw=gl.createFramebuffer(),read=gl.createFramebuffer();
 gl.useProgram(program);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,draw);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,read);gl.viewport(4,8,1280,720);gl.scissor(7,9,600,450);gl.colorMask(true,false,true,false);gl.depthMask(false);gl.depthRange(.2,.8);gl.depthFunc(gl.LEQUAL);gl.clearDepth(.7);gl.polygonOffset(2,3);gl.enable(gl.DEPTH_TEST);
 sun.capture(gl);reset();
 for(let i=0;i<300;i++){
  const saved=sun.capture(gl);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,512,512);gl.colorMask(false,false,false,false);gl.depthMask(true);gl.depthFunc(gl.LESS);gl.clearDepth(1);gl.disable(gl.DEPTH_TEST);sun.restore(gl,saved);
  assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),program);assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),draw);assert.equal(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),read);
  assert.deepEqual(Array.from(gl.getParameter(gl.VIEWPORT)),[4,8,1280,720]);assert.deepEqual(Array.from(gl.getParameter(gl.COLOR_WRITEMASK)),[true,false,true,false]);assert.equal(gl.isEnabled(gl.DEPTH_TEST),true);
 }
 assert.equal(reads(),0,'300 full shadow guards no longer synchronously read the driver after warmup');
});

test('Snapshots cannot mutate the cache; invalid writes and unsupported parameters use native truth',()=>{
 const {gl,reads,reset}=fixture();gl.viewport(0,0,1280,720);const view=gl.getParameter(gl.VIEWPORT);view[2]=1;assert.equal(gl.getParameter(gl.VIEWPORT)[2],1280);
 gl.depthFunc(gl.LEQUAL);gl.depthFunc(-999);reset();assert.equal(gl.getParameter(gl.DEPTH_FUNC),gl.LEQUAL);assert.equal(reads(),1);gl.getParameter(gl.DEPTH_FUNC);assert.equal(reads(),1);
 gl.viewport(1,2,-1,720);assert.deepEqual(Array.from(gl.getParameter(gl.VIEWPORT)),[0,0,1280,720]);
 const before=reads();gl.getParameter(99999);gl.getParameter(99999);assert.equal(reads(),before+2,'unknown enums are never invented or memoized');
});

test('Deleting targets and context restoration cannot return stale handles or capabilities',()=>{
 const {gl,reads,reset}=fixture(),fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),fbo);gl.deleteFramebuffer(fbo);assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),null);
 gl.enable(gl.DEPTH_TEST);gl.events.get('webglcontextlost')?.();gl.disable(gl.DEPTH_TEST);gl.events.get('webglcontextrestored')?.();reset();assert.equal(gl.isEnabled(gl.DEPTH_TEST),false);assert.equal(reads(),1);gl.isEnabled(gl.DEPTH_TEST);assert.equal(reads(),1);
});
