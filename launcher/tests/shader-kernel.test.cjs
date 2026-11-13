'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createShaderVariantCache,movingShadowSize,shadowReceiverFocus}=require('../shader-kernel.cjs');
const {shaderRuntime,liquidPrograms}=require('./shader-runtime-fixture.cjs');

test('Hidden first-person wearable objects retain nested transforms and exact native atlas layers without mutation',()=>{
 const {appendShadowAttachments}=require('../shader-kernel.cjs'),{nativeVariation}=require('./shader-instance-fixture.cjs');
 const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 const mesh={name:'WearableMesh'},f=nativeVariation(mesh,identity(),0);
 const node={position:{x:0,y:2,z:0},thinInstanceId:100,attachedThinObjectIds:[20]};
 const model={type:'Hat',visible:false,nodes:[node]},manager={objectData:{20:model},types:{Hat:{typeNodes:[{thinMeshIndex:0,parent:null}]}},thinMeshes:[f.group]};
 const compose=n=>{const m=identity();m[12]=n.position.x;m[13]=n.position.y;m[14]=n.position.z;return m;};
 const multiply=(a,b)=>{const m=identity();for(let col=0;col<4;col++)for(let row=0;row<4;row++)m[col*4+row]=[0,1,2,3].reduce((n,k)=>n+a[k*4+row]*b[col*4+k],0);return m;};
 const parent=identity();parent[12]=8;parent[13]=3;
 const result={parts:[],excluded:new Map()},before=JSON.stringify(model);
 appendShadowAttachments(manager,[20],parent,result,compose,multiply);
 assert.equal(result.parts.length,1,'attachment cycles are bounded');
 assert.deepEqual(Array.from(result.parts[0].transform.slice(12,15)),[8,5,0]);
 assert.deepEqual(Array.from(result.parts[0].atlasIndices),[11,12,13,14,21,22,23,24]);
 assert(result.excluded.get(mesh).has(0));assert.equal(JSON.stringify(model),before);
});

test('Entity allocation follows close-terrain density without shrinking its existing coverage or exceeding 4096',()=>{
  for(const size of [32,256,512,1024,2048,4096])for(const radius of [16,48,80,160]){
    const detailRadius=Math.min(16,radius),movingRadius=Math.min(25,radius),actual=movingShadowSize(size,radius,detailRadius);
    assert(actual<=4096);assert(actual>=size);
    if(size<=2048)assert(actual/(2*movingRadius)>=size/(2*detailRadius));
  }
});

test('Shadow coverage follows the observed player render position in orbit view and falls back without guessing an origin',()=>{
  const camera={x:100,y:70,z:0},scene={activeCamera:{position:camera}};
  let position={xQi:new Float64Array([4,8,12])};const game={entities:{getState:()=>position}};
  assert.deepEqual(shadowReceiverFocus(game,1,scene),{x:4,y:8,z:12});position.xQi[0]=20;
  assert.equal(shadowReceiverFocus(game,1,scene).x,20);
  position={position:[10004,20008,30012]};assert.equal(shadowReceiverFocus(game,1,scene),camera);
  game.origin=[10000,20000,30000];assert.deepEqual(shadowReceiverFocus(game,1,scene,{originKey:'origin'}),{x:4,y:8,z:12});
});

test('Shader source variants have bounded memory and preserve recent successful and rejected entries',()=>{
  const cache=createShaderVariantCache(3,256);
  cache.put('a',{patched:'A'});cache.reject('b');cache.put('c',{patched:'C'});
  assert.equal(cache.get('a').patched,'A');cache.put('d',{patched:'D'});
  assert.equal(cache.get('b'),null);assert.equal(cache.get('c').patched,'C');
  cache.reject('e');assert.equal(cache.get('e').failed,true);
  cache.put('oversized',{patched:'x'.repeat(300)});
  assert.equal(cache.get('oversized'),null);assert(cache.diagnostics().bytes<=256);
  for(let i=0;i<1000;i++)cache.put('variant-'+i,{patched:'x'.repeat(i%100)});
  assert(cache.diagnostics().entries<=3);assert(cache.diagnostics().bytes<=256);
});

function sourceSink(){
  return class SourceSink {
    constructor(){this.events=new Map();this.canvas={addEventListener:(name,fn)=>this.events.set(name,fn)};this.compiles=0;this.failPatch=false;this.COMPILE_STATUS=1;}
    getParameter(){return 16;}getUniformLocation(){return null;}
    shaderSource(shader,source){shader.source=source;}compileShader(){this.compiles++;}
    attachShader(){}linkProgram(){}getProgramParameter(){return true;}
    getShaderParameter(shader){return !this.failPatch || !shader.source.includes('uBvfxSunMap');}
    getShaderInfoLog(){return 'synthetic compiler rejection';}
    useProgram(){}uniform1f(){}drawArrays(){}drawElements(){}
  };
}
const input=()=>liquidPrograms({patchLiquidVertexShader:s=>s,patchTerrainShader:s=>s,sun:{patch:s=>s}},'water').fragment
  .replace('#version 300 es','#version 300 es\n#define BVFX_MASTER_ACTIVE');

test('Repeated native material variants reuse patch work and keep hard/smoothed programs separate',()=>{
  const GL=sourceSink(),runtime=shaderRuntime({}, {WebGL2RenderingContext:GL}),gl=new GL();
  let patches=0;const patch=runtime.sun.patch;runtime.sun.patch=s=>{patches++;return patch(s);};
  const hard=input(),smooth=hard.replace('#version 300 es','#version 300 es\n#define BVFX_SUN_SMOOTHING');
  let first;
  for(let i=0;i<600;i++){const shader={};gl.shaderSource(shader,i%2?smooth:hard);if(i===0)first=shader.source;
    assert.match(shader.source,/uBvfxSunMap/);if(i%2===0)assert.equal(shader.source,first);}
  assert.equal(patches,2);assert.equal(runtime.root.__BVFX_SHADER_CACHE_STATS__().hits,598);
  const other=new GL();other.shaderSource({},hard);assert.equal(patches,3,'contexts never share compiler outcomes');
});

test('A rejected optional shader compiles once, then new copies use the native source until context restoration',()=>{
  const GL=sourceSink(),runtime=shaderRuntime({}, {WebGL2RenderingContext:GL}),gl=new GL();gl.failPatch=true;
  let patches=0;const patch=runtime.sun.patch;runtime.sun.patch=s=>{patches++;return patch(s);};
  const source=input();
  for(let i=0;i<600;i++){const shader={};gl.shaderSource(shader,source);gl.compileShader(shader);
    assert.equal(gl.getShaderParameter(shader,gl.COMPILE_STATUS),true);assert.equal(shader.source,source);}
  assert.equal(patches,1);assert.equal(gl.compiles,601,'only the first copy needs a native fallback compile');
  let stats=runtime.root.__BVFX_SHADER_CACHE_STATS__();assert.equal(stats.compileFailures,1);assert.equal(stats.rejectedHits,599);
  gl.failPatch=false;gl.events.get('webglcontextrestored')();const restored={};gl.shaderSource(restored,source);
  assert.match(restored.source,/uBvfxSunMap/);assert.equal(patches,2);
});
