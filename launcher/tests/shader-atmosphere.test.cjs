'use strict';
// Pure CPU regressions; no graphics context, application or account access.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {managedSource}=require('../adapters.cjs'),{shaderRuntime}=require('./shader-runtime-fixture.cjs'),{fakeGl}=require('./shader-gl-fixture.cjs');
const native=require('./fixtures/shader-sky-2026-11-08.json');
const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

test('Native distance fog cannot flatten the custom sky; master Off retains native fog',()=>{
 const api=shaderRuntime().atmosphere,source=native.shaders.find(s=>s.name==='skyPixelShader').code;
 const included=api.patchSky(source);
 assert.match(included,/if\(uBvfxAtmoActive<\.5\)\{\s*#include<fogFragment>\s*\}/);
 const expanded=api.patchSky(source.replace('#include<fogFragment>',native.includes.fogFragment));
 const block=expanded.match(/if\(uBvfxAtmoActive<\.5\)\{\s*float fog=CalcFogFactor\(\);[\s\S]*?color\.rgb=mix\(vFogColor,color\.rgb,fog\);\s*\}/)?.[0];
 assert(block,'already expanded native shaders have the same guard');
 const executable=block.replace(/^#.*$/gm,'').replace(/\bfloat\b/g,'let');
 for(const active of [0,1]){
  const sky=[.24,.48,.82],fog=[.38,.42,.30],context={uBvfxAtmoActive:active,color:{rgb:sky},vFogColor:fog,CalcFogFactor:()=>0,toLinearSpace:x=>x,mix:(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t)};
  vm.runInNewContext(executable,context);
  assert.deepEqual(context.color.rgb,active?sky:fog);
 }
 assert.match(expanded,/#include<logDepthFragment>/);
 assert.equal(api.patchSky(expanded),expanded);
});

test('Cloud coverage is continuous, monotonically adjustable and has exact clear/overcast endpoints',()=>{
 const api=shaderRuntime().atmosphere,code=api.common;
 const body=code.match(/float bvfxCloudOpacity\(float field\)\{([^}]+)\}/)[1].replace(/\bfloat\b/g,'let');
 const opacity=(field,cover)=>vm.runInNewContext('(function(field){'+body+'})',{
  uBvfxAtmoClouds:{x:cover},smoothstep,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),mix:(a,b,t)=>a*(1-t)+b*t})(field);
 for(const field of [.29,.4,.5,.6,.71]){
  assert.equal(opacity(field,0),0);assert.equal(opacity(field,1),1);
  let previous=0;
  for(let i=0;i<=100;i++){const value=opacity(field,i/100);assert(Number.isFinite(value)&&value>=previous-1e-8&&value<=1);previous=value;}
  for(let f=.28;f<.73;f+=.005)assert(Math.abs(opacity(f,.5)-opacity(f+.005,.5))<.05,'no hard silhouette threshold');
 }
 assert.match(api.groundLighting,/bvfxCloudGroundShadow\(worldPosition,uBvfxAtmoSunDir\)/,'ground shadows sample the same volume as the sky');
 assert.match(code,/flare\*=bvfxFlareTransmission\(1.0-BVFX_SKY_TEXTURE\(uBvfxAtmoRayImage,uBvfxAtmoSourceSample\).a,uBvfxAtmoSunDir.y\)/,'cached solar-disc transmission attenuates the flare');
});

test('Elevated spawns retain distant clouds and world rebases cannot move the authored layer',()=>{
 const r=shaderRuntime(),api=r.atmosphere,gl=fakeGl(),p=gl.createProgram();gl.useProgram(p);
 const loc=api.locations(gl,p);r.state.cloudHeight=120;
 api.setWorldFrame(0,0,0,100,210,300);api.bind(gl,loc,gl);
 const height=gl.uniformValues.get('uBvfxAtmoClouds')[2];assert.equal(height,274);
 api.setWorldFrame(96,192,288,100,210,300);api.bind(gl,loc,gl);
 assert.equal(gl.uniformValues.get('uBvfxAtmoClouds')[2],height);
 assert.deepEqual(Array.from(gl.uniformValues.get('uBvfxAtmoCameraWorld')),[100,210,300]);
 api.dispose();api.setWorldFrame(0,0,0,0,10,0);api.bind(gl,loc,gl);
 assert.equal(gl.uniformValues.get('uBvfxAtmoClouds')[2],120,'a new world releases the old elevation offset');
 assert.equal(gl.allocations.size,0);
});

function celestialFixture(){
 const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/bloxd-visual-shader-5.6.14.2.bnmod'))),file=pack.files.find(f=>f.path==='day-night.js'),root={};
 vm.runInNewContext(managedSource(pack.manifest.id,file.path,Buffer.from(file.data,'base64').toString()),{window:root});
 const raw={enabled:true,atmosphereEnabled:true,dayNightEnabled:false,dayNightDayPreset:'clear',dayNightNightPreset:'moonlit'};
 const scene={},body=y=>({position:{x:0,y,z:1},visibility:.8,getScene:()=>scene});
 const sky={earthSkyBox:{},sunOpacity:1,moonOpacity:1,sunMesh:body(1),moonMesh:body(-1),starsMesh:body(0)},noa={bloxd:{client:{environmentController:{dayAndNightSky:sky}}}};
 return {raw,scene,sky,noa,api:root.__BVFX_CREATE_DAY_NIGHT__(raw,{clear:{},moonlit:{}})};
}

test('Manual custom skies hide duplicate native celestial meshes and restore live native opacity writes',()=>{
 const {api,raw,noa,sky,scene}=celestialFixture();
 assert.equal(api.sample(noa,scene),null,'manual sky must not control the game clock');
 for(const mesh of [sky.sunMesh,sky.moonMesh,sky.starsMesh])assert.equal(mesh.visibility,0);
 sky.sunMesh.visibility=.27;raw.atmosphereEnabled=false;api.sample(noa,scene);
 assert.equal(sky.sunMesh.visibility,.27);assert.equal(sky.moonMesh.visibility,.8);
 raw.atmosphereEnabled=true;api.sample(noa,scene);raw.enabled=false;api.sample(noa,scene);
 assert.equal(sky.sunMesh.visibility,.27);
});

test('Day/night, mesh replacement and world departure release native celestial ownership',()=>{
 const {api,raw,noa,sky,scene}=celestialFixture();raw.dayNightEnabled=true;
 const frame=api.sample(noa,scene);assert.equal(frame.phase,'day');assert.equal(sky.sunMesh.visibility,0);
 const old=sky.sunMesh;sky.sunMesh={position:{x:1,y:1,z:0},visibility:.6,getScene:()=>scene};api.sample(noa,scene);
 assert.equal(old.visibility,.8);assert.equal(sky.sunMesh.visibility,0);
 api.sample(null,scene);assert.equal(sky.sunMesh.visibility,.6);
 assert.equal(Object.getOwnPropertyDescriptor(sky.sunMesh,'visibility').get,undefined);
});

test('Current native accessor-backed celestial mirrors hide their actual row data and restore later native writes',()=>{
 const native=require('./fixtures/sky-visibility-2026-11-11.json'),{api,raw,noa,sky,scene}=celestialFixture();
 const Mirror=vm.runInNewContext('(class {constructor(rm,row){this.rm=rm;this.row=row;this.instances=[];this.position={x:0,y:1,z:1};}'+native.getter+native.setter+'})');
 const visibility=[.8],model={meshes:{visibility,setVisibility(row,value){visibility[row]=value;}}};sky.sunMesh=new Mirror({model},0);
 api.sample(noa,scene);assert.equal(visibility[0],0,'the previous getter-only override left the actual rendered visibility at .8');
 sky.sunMesh.visibility=.37;assert.equal(visibility[0],0,'clock writes remain suppressed in the row data');
 raw.atmosphereEnabled=false;api.sample(noa,scene);assert.equal(visibility[0],.37);
 assert.equal(Object.getOwnPropertyDescriptor(sky.sunMesh,'visibility'),undefined,'original prototype accessors restored');
});

test('Sky rays project exactly through observed camera matrices at multiple FOVs, aspects, handedness and rebases',()=>{
 const api=shaderRuntime().atmosphere,gl=fakeGl(),p=gl.createProgram();gl.useProgram(p);const loc=api.locations(gl,p);
 const normalize=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
 for(const aspect of [1,16/9,2.4])for(const fov of [40,70,110])for(const sign of [-1,1]){
  const f=1/Math.tan(fov*Math.PI/360),near=.1,far=1000,c=Math.cos(.7),s=Math.sin(.7);
  const projection=[f/aspect,0,0,0,0,f,0,0,0,0,sign*(far+near)/(far-near),sign,0,0,-2*far*near/(far-near),0];
  const view=[c,s,0,0,-s,c,0,0,0,0,1,0,800,-1200,3200,1];
  api.setViewProjection(view,projection);api.bind(gl,loc,gl);assert.equal(gl.uniformValues.get('uBvfxAtmoRayReady'),1);
  const m=gl.uniformValues.get('uBvfxAtmoRayMatrix');
  for(const [x,y]of [[0,0],[.7,-.3],[-.6,.8]]){
   const actual=normalize([0,1,2].map(i=>m[i]*x+m[i+4]*y+m[i+8]+m[i+12]));
   const camera=[x/(f/aspect),y/f,sign],expected=normalize([c*camera[0]+s*camera[1],-s*camera[0]+c*camera[1],camera[2]]);
   actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<2e-6,'finite skybox vertices cannot skew the camera ray'));
  }
 }
 const last=Array.from(gl.uniformValues.get('uBvfxAtmoRayMatrix'));
 for(const invalid of [[],new Array(16).fill(0),new Array(16).fill(NaN)]){
  api.setViewProjection(invalid,invalid);api.bind(gl,loc,gl);
  assert.equal(gl.uniformValues.get('uBvfxAtmoRayReady'),1,'an invalid observation cannot discard the last real camera');
  assert.deepEqual(Array.from(gl.uniformValues.get('uBvfxAtmoRayMatrix')),last);
 }
 api.dispose();api.setViewProjection(new Array(16).fill(0),new Array(16).fill(0));api.bind(gl,loc,gl);
 assert.equal(gl.uniformValues.get('uBvfxAtmoRayReady'),0,'a new world with no valid camera retains the native geometry ray');
 assert.match(api.common,/vec3 bvfxSpaceHole/);assert.match(api.common,/vec3 bvfxSpacePlanet/);assert.match(api.common,/vec3 bvfxSpaceGalaxy/);
});
