'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {shaderRuntime,liquidPrograms}=require('./shader-runtime-fixture.cjs');
const {fakeGl}=require('./shader-gl-fixture.cjs');
function scene(gl){
 const before=new Set(),after=new Set();return {meshes:[],materials:[],_engine:{_gl:gl},getEngine(){return this._engine;},
  getTransformMatrix:()=>({m:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}),
  onBeforeRenderObservable:{add(fn){before.add(fn);return fn;},remove:fn=>before.delete(fn)},onAfterRenderObservable:{add(fn){after.add(fn);return fn;},remove:fn=>after.delete(fn)},
  before,after};
}
function program(r,gl){const pair=liquidPrograms(r,'water'),p=gl.createProgram();
 for(const [stage,source]of [[gl.VERTEX_SHADER,pair.vertex],[gl.FRAGMENT_SHADER,pair.fragment]]){const shader=gl.createShader(stage);gl.shaderSource(shader,source);gl.attachShader(p,shader);}gl.linkProgram(p);gl.useProgram(p);return p;
}
test('Terrain/liquid kernels keep cloud integration in its separate pass and use raw shadow depths',()=>{
 const r=shaderRuntime();for(const kind of ['water','lava']){const pair=liquidPrograms(r,kind);assert.doesNotMatch(pair.fragment,/sampler2DShadow|bvfxLavaNoise3|for\(int i=0;i<24|sampler3D uBvfxAtmoVolume/);assert.match(pair.fragment,/uBvfxDisableNative/);assert.match(pair.fragment,/textureLod\(shadowMap/);assert.match(pair.fragment,/sampler2D uBvfxAtmoGroundImage/);}
 const vertex='#version 300 es\n#define BVFX_TERRAIN_UNDERWATER\nprecision highp float;in vec3 position;in float texAtlasIndices;uniform mat4 world;uniform mat4 viewProjection;out vec3 vPositionW;void main(){vec4 worldPos=world*vec4(position,1.0);vPositionW=worldPos.xyz;gl_Position=viewProjection*worldPos;}';
 const patched=r.surfaces.patch(vertex);assert.match(patched,/worldPos.xyz\+=bvfxLeafDisplacement/);assert.match(patched,/textureLod\(uBvfxSurfaceAtlas/);assert.doesNotMatch(patched,/for\s*\(/,'leaf identity is one lookup, not a per-vertex list walk');
 assert(patched.indexOf('worldPos.xyz+=')<patched.indexOf('vPositionW=worldPos.xyz'));assert.equal(r.surfaces.patch(patched),patched);
});
test('Material identity uses real metadata, rejects ambiguous shared atlas entries and persists explicit choices',()=>{
 const r=shaderRuntime({reflectionBlocks:'Stone',reflectionGlass:false,wavyLeaves:true,leafSpeed:99,leafStrength:4});
 assert.equal(r.state.leafSpeed,5);assert.equal(r.state.leafStrength,.12);
 r.surfaces.updateMetadata({1:{name:'Oak Leaves',atlasIdx:7},2:{name:'Stone',atlasIdx:9},3:{name:'Gold Block',atlasIdx:10},4:{name:'Unrelated',atlasIdx:7},5:{name:'Pine Leaves',atlasIdx:[11,12]}},new Map());
 assert.equal(r.surfaces.diagnostics().leafAtlasCount,2,'shared leaf/solid atlas is not waved');
 assert.equal('reflectionBlocks' in r.state,false);
 const gl=fakeGl();const p=gl.uniforms(gl.createProgram(),[['uBvfxSurfaceAtlas','SAMPLER_2D']]);gl.useProgram(p);const loc=r.surfaces.locations(gl,p);r.surfaces.bind(gl,loc,gl);
 assert.equal(gl.uniformValues.get('uBvfxDisableNative'),0);
 const reads=gl.calls.filter(c=>c[0]==='texImage2D').length;
 assert(reads>0,'a real surface atlas was uploaded');
 for(let i=0;i<20;i++)r.surfaces.bind(gl,loc,gl);
 assert.equal(gl.calls.filter(c=>c[0]==='texImage2D').length,reads,'unchanged material table never uploads twice');
 r.state.bloxdLighting=false;r.state.enabled=false;r.surfaces.bind(gl,loc,gl,undefined,1);
 assert.equal(gl.uniformValues.get('uBvfxDisableNative'),0);
 r.state.enabled=true;r.surfaces.bind(gl,loc,gl,undefined,2);assert.equal(gl.uniformValues.get('uBvfxDisableNative'),1);
});
test('Surface samplers stay complete across native rebindings, relink and context restoration',()=>{
 const r=shaderRuntime(),gl=fakeGl(),p=gl.uniforms(gl.createProgram(),[['uBvfxSurfaceAtlas','SAMPLER_2D']]);gl.useProgram(p);let loc=r.surfaces.locations(gl,p);
 r.surfaces.bind(gl,loc,gl);const units=r.root.__BVFX_SAMPLER_UNITS__(gl,p);
 for(const name of ['uBvfxSurfaceAtlas']){const unit=units.get(name),texture=gl.boundTextures.get((gl.TEXTURE0+unit)+':'+gl.TEXTURE_2D);assert(texture&&gl.allocations.has(texture),name);}
 const unit=units.get('uBvfxSurfaceAtlas');gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,null);r.surfaces.bind(gl,loc,gl);assert(gl.getParameter(gl.TEXTURE_BINDING_2D));
 r.surfaces.invalidateProgram(p);loc=r.surfaces.locations(gl,p);r.surfaces.bind(gl,loc,gl);assert.equal(loc.SceneColour,undefined);
 const uploads=gl.calls.filter(c=>c[0]==='texImage2D').length;gl.events.get('webglcontextlost')();const restored=gl.uniforms(gl.createProgram(),[['uBvfxSurfaceAtlas','SAMPLER_2D']]);gl.useProgram(restored);r.surfaces.bind(gl,r.surfaces.locations(gl,restored),gl);
 assert(gl.calls.filter(c=>c[0]==='texImage2D').length>uploads,'lost atlas handles are recreated, not reused');
});
test('Moving leaf shadows invalidate only leaf geometry, including in-place atlas edits',()=>{
 const r=shaderRuntime({wavyLeaves:true});r.surfaces.updateMetadata({1:{name:'Oak Leaves',atlasIdx:7}},new Map());
 const data={atlasSource:new Float32Array([8]),terrainRevision:1};assert.equal(r.surfaces.leafGeometryRevision(data),0);
 data.atlasSource[0]=7;data.terrainRevision++;assert.notEqual(r.surfaces.leafGeometryRevision(data),0);
 r.state.wavyLeaves=false;assert.equal(r.surfaces.leafGeometryRevision(data),0);
});
test('Retired reflections leave no GPU programs, samplers or capture work even with old settings',()=>{
 const r=shaderRuntime({blockReflections:true,reflectionWorld:true,bloomEnabled:false}),gl=fakeGl(),world=scene(gl);
 for(const kind of ['water','lava']){const f=liquidPrograms(r,kind).fragment;assert.doesNotMatch(f,/bvfxWorldReflection|uBvfxSceneColour|uBvfxSceneDepth|uBvfxReflection/);}
 r.surfaces.attach(world);for(const fn of world.after)fn();assert.equal(gl.calls.length,0);assert.equal('reflectionWorld' in r.state,false);
 r.surfaces.updateMetadata(new Proxy({}, {ownKeys(){assert.fail('disabled leaf motion cannot scan the block registry');}}),new Map());
 r.surfaces.attach(null);assert.equal(world.after.size,0);
});

test('Bloom is one owned nine-tap GPU pass with native pipeline state restored and Off releases it',()=>{
 const r=shaderRuntime({bloomEnabled:true,bloom:.4}),post=r.root.__BVFX_GPU_TIMER__,gl=fakeGl(),native=gl.createProgram();
 gl.drawingBufferWidth=800;gl.drawingBufferHeight=600;gl.useProgram(native);gl.enable(gl.DEPTH_TEST);gl.enable(gl.SCISSOR_TEST);
 post.draw(gl);assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),native);assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),null);assert(gl.isEnabled(gl.DEPTH_TEST));assert(gl.isEnabled(gl.SCISSOR_TEST));
 assert.equal(gl.calls.filter(c=>c[0]==='draw').length,1);assert.equal(gl.calls.filter(c=>c[0]==='copyTexImage2D').length,1);
 r.state.bloomEnabled=false;post.draw(gl);assert.equal(gl.calls.filter(c=>c[0]==='draw').length,1);assert(gl.calls.some(c=>c[0]==='deleteProgram'));
});
test('GPU timing never blocks for unavailable results and rejects disjoint clock samples',()=>{
 const r=shaderRuntime({bloomEnabled:false}),post=r.root.__BVFX_GPU_TIMER__,gl=fakeGl();
 let ready=false,active=null,deleted=0,disjoint=false;gl.QUERY_RESULT_AVAILABLE=900;gl.QUERY_RESULT=901;gl.CURRENT_QUERY=902;
 const ext={TIME_ELAPSED_EXT:903,GPU_DISJOINT_EXT:904},get=gl.getParameter;gl.getParameter=p=>p===904?disjoint:get(p);gl.getExtension=()=>ext;gl.createQuery=()=>({});gl.deleteQuery=()=>deleted++;gl.getQuery=()=>active;
 gl.beginQuery=(_t,q)=>active=q;gl.endQuery=()=>active=null;gl.getQueryParameter=(_q,p)=>{if(p===900)return ready;assert(ready,'never block for an unfinished query');return 4000000;};
 post.begin(gl);post.end();post.begin(gl);assert.equal(post.diagnostics().samples,0);
 ready=true;post.begin(gl);assert.equal(post.diagnostics().sceneAverageMs,4);assert.equal(deleted,1);
 disjoint=true;post.begin(gl);assert.equal(post.diagnostics().samples,0);
});
test('New native settings respond to keyboard, save values and disable dependent controls',t=>{
 const dom=new JSDOM('<html><body><div class="SettingsMenu"><div class="MenuSideBarBody"></div><div class="SettingsMenuRight"></div></div></body></html>',{url:'https://bloxd.io/'});t.after(()=>dom.window.close());
 const add=dom.window.document.addEventListener.bind(dom.window.document);dom.window.document.addEventListener=(type,...args)=>{if(type!=='DOMContentLoaded')add(type,...args);};
 const r=shaderRuntime({}, {document:dom.window.document,getComputedStyle:dom.window.getComputedStyle,innerWidth:1200,innerHeight:800});
 r.installShaderSettings();r.selectShaderCategory(true);r.syncUi();const d=dom.window.document;
 assert(d.querySelector('[data-shader-check="bloxdLighting"] input').checked);assert.equal(d.querySelector('[data-shader-check="blockReflections"]'),null);
 const leaf=d.querySelector('[data-shader-check="wavyLeaves"]');leaf.click();assert.equal(r.state.wavyLeaves,true);
 const handle=d.querySelector('[data-shader-slider="leafStrength"] [role=slider]');const old=r.state.leafStrength;
 handle.dispatchEvent(new dom.window.KeyboardEvent('keydown',{code:'ArrowRight',bubbles:true}));assert.equal(r.state.leafStrength,old+.005);
 const lighting=d.querySelector('[data-shader-check="bloxdLighting"]');lighting.click();assert.equal(r.state.bloxdLighting,false);
 const darkness=d.querySelector('[data-shader-slider="bloxdLightingDarkness"]');assert.equal(darkness.querySelector('[role=slider]').getAttribute('aria-disabled'),'true');assert(lighting.compareDocumentPosition(darkness)&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
 lighting.click();assert.equal(r.state.bloxdLighting,true);assert.equal(darkness.querySelector('[role=slider]').getAttribute('aria-disabled'),'false');
});
