'use strict';
// Executes installed WebGL wrappers in a CPU VM, without a graphics context.
const test=require('node:test'),assert=require('node:assert/strict');
const {shaderRuntime}=require('./shader-runtime-fixture.cjs'),{fakeGl}=require('./shader-gl-fixture.cjs');
const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);

test('The actual document-start useProgram/draw wrappers upload a camera sky matrix and finish native draws',()=>{
 const native=fakeGl();class CpuGl{}Object.assign(CpuGl.prototype,native);
 const r=shaderRuntime({sunShadowEnabled:false,oreGlowEnabled:false},{WebGL2RenderingContext:CpuGl}),gl=new CpuGl();
 gl.drawingBufferWidth=800;gl.drawingBufferHeight=600;
 r.atmosphere.setViewProjection(identity(),identity());
 const program=gl.createProgram(),shader=gl.createShader(gl.FRAGMENT_SHADER);
 gl.shaderSource(shader,'#version 300 es\n#define BVFX_MASTER_ACTIVE\n#define BVFX_SKYBOX\nprecision highp float;in vec3 vPositionW;uniform vec3 cameraPosition;out vec4 colour;void main(){colour=vec4(1);}');
 gl.attachShader(program,shader);gl.linkProgram(program);
 assert.doesNotThrow(()=>gl.useProgram(program));
 assert.equal(gl.uniformValues.get('uBvfxAtmoRayReady'),1);
 assert.equal(gl.uniformValues.get('uBvfxAtmoRayMatrix').length,16);
 assert.deepEqual(Array.from(gl.uniformValues.get('uBvfxAtmoSkyTint')),[.48,.69,1]);
 for(let i=0;i<120;i++){
  gl.drawArrays(gl.TRIANGLES,0,3);
  if(i%20===0)r.root.__BVFX_GPU_TIMER__.draw(gl);
  assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),program,'bloom restores the patched sky through the real useProgram wrapper');
 }
 assert.equal(gl.calls.filter(call=>call[0]==='draw').length,129,'120 native sky draws, six bloom draws, two cloud passes and one retained ground shadow tile');
 assert.equal(r.atmosphere.cloudRenderer.diagnostics().integrations,1);
 assert.equal(r.runtime.error,'');
});

test('An incomplete original-method table leaves camera rays inactive and still uploads the complete sky palette',()=>{
 const r=shaderRuntime(),gl=fakeGl(),p=gl.createProgram();gl.useProgram(p);
 const methods={...gl};delete methods.uniformMatrix4fv;
 r.atmosphere.setViewProjection(identity(),identity());
 assert.doesNotThrow(()=>r.atmosphere.bind(gl,r.atmosphere.locations(gl,p),methods));
 assert.equal(gl.uniformValues.get('uBvfxAtmoRayReady'),0);
 assert.deepEqual(Array.from(gl.uniformValues.get('uBvfxAtmoSkyTint')),[.48,.69,1]);
});

test('A cached native draw method sees completed clouds after the real useProgram wrapper rebinds the sky',()=>{
 const native=fakeGl(),draw=native.drawArrays;class CpuGl{}Object.assign(CpuGl.prototype,native);
 const r=shaderRuntime({sunShadowEnabled:false,oreGlowEnabled:false},{WebGL2RenderingContext:CpuGl}),gl=new CpuGl();
 gl.drawingBufferWidth=800;gl.drawingBufferHeight=600;r.atmosphere.setViewProjection(identity(),identity());
 const p=gl.createProgram(),s=gl.createShader(gl.FRAGMENT_SHADER);
 gl.shaderSource(s,'#version 300 es\n#define BVFX_MASTER_ACTIVE\n#define BVFX_SKYBOX\nprecision highp float;in vec3 vPositionW;uniform vec3 cameraPosition;out vec4 colour;void main(){colour=vec4(1);}');gl.attachShader(p,s);gl.linkProgram(p);gl.useProgram(p);gl.drawArrays(gl.TRIANGLES,0,3);
 const before=gl.calls.filter(c=>c[0]==='draw').length;
 for(let i=0;i<100;i++){
  gl.useProgram(null);gl.useProgram(p);
  assert.equal(gl.uniformValues.get('uBvfxAtmoCloudCacheReady'),1,'rebinding must not flash the procedural fallback');
  draw.call(gl,gl.TRIANGLES,0,3);
 }
 assert.equal(r.atmosphere.cloudRenderer.diagnostics().integrations,1);
 assert.equal(gl.calls.filter(c=>c[0]==='draw').length,before+100,'no new offscreen passes for readiness repair');
 assert.equal(r.runtime.error,'');
});

function bloomContext({alpha=false,failCopy=false}={}){
 const gl=fakeGl();gl.drawingBufferWidth=800;gl.drawingBufferHeight=600;
 gl.RGB=7001;gl.RGB8=7002;gl.INVALID_OPERATION=7003;gl.getContextAttributes=()=>({alpha});
 let error=gl.NO_ERROR,storage=null;
 const texStorage=gl.texStorage2D;
 gl.texStorage2D=(...args)=>{storage=args[2];texStorage(...args);};
 const allocate=gl.texImage2D;
 gl.copyTexImage2D=(target,level,format,x,y,w,h,border)=>{
  gl.calls.push(['copyTexImage2D',format]);
  if(failCopy||(!alpha&&format===gl.RGBA)){error=gl.INVALID_OPERATION;return;}
  storage=format;allocate(target,level,format,w,h,border,format,gl.UNSIGNED_BYTE,null);
 };
 gl.copyTexSubImage2D=()=>{
  gl.calls.push(['copyTexSubImage2D']);
  if(failCopy||(!alpha&&(storage===gl.RGBA8||storage===gl.RGBA)))error=gl.INVALID_OPERATION;
 };
 gl.getError=()=>{const result=error;error=gl.NO_ERROR;return result;};
 return gl;
}

test('Bloom infers RGB storage from opaque and alpha backbuffers, then reuses it without GL copy errors',()=>{
 for(const alpha of [false,true]){
  const post=shaderRuntime({bloomEnabled:true,bloom:.4}).root.__BVFX_GPU_TIMER__,gl=bloomContext({alpha});
  const native=gl.createProgram();gl.useProgram(native);
  for(let i=0;i<3;i++)post.draw(gl);
  assert.equal(gl.getError(),gl.NO_ERROR,'RGB presentation buffers cannot copy into sized RGBA8 textures');
  assert.equal(gl.calls.filter(c=>c[0]==='copyTexImage2D').length,1);
  assert.equal(gl.calls.filter(c=>c[0]==='copyTexSubImage2D').length,2);
  assert.equal(gl.calls.filter(c=>c[0]==='draw').length,3);
  assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),native);
 }
});

test('A driver copy rejection stops bloom once, keeps native GL state and never repeats the failing copy',()=>{
 const r=shaderRuntime({bloomEnabled:true,bloom:.4}),post=r.root.__BVFX_GPU_TIMER__,gl=bloomContext({failCopy:true});
 const native=gl.createProgram(),fbo=gl.createFramebuffer();gl.useProgram(native);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,fbo);
 gl.enable(gl.DEPTH_TEST);gl.enable(gl.SCISSOR_TEST);
 for(let i=0;i<120;i++)post.draw(gl);
 assert.equal(gl.calls.filter(c=>/copyTex/.test(c[0])).length,1);
 assert.equal(gl.calls.filter(c=>c[0]==='draw').length,0,'failed scene captures are never sampled or presented');
 assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),native);assert.equal(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),fbo);
 assert(gl.isEnabled(gl.DEPTH_TEST));assert(gl.isEnabled(gl.SCISSOR_TEST));
 assert.match(post.diagnostics().bloom,/unavailable|copy/i);
});
