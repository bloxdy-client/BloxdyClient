'use strict';
// Loads document-start shader definitions in a CPU-only VM. No canvas,
// browser, WebGL context, live Bloxd runtime or account is created.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {managedSource}=require('../adapters.cjs');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/bloxd-visual-shader-5.6.14.2.bnmod')));
function shaderRuntime(settings={},globals={}){
  // The historical shadow-map regressions explicitly exercise the retained
  // reference implementation. New ray tests select the shipped default.
  const stored=new Map([['bloxd-engine-voxel-shadows:settings:v2',JSON.stringify({visualDefaultsRevision:1,sliderModel:'normalized-v2',shadowEngine:'reference-maps',...settings})]]);
  const context=vm.createContext({location:{hostname:'bloxd.io',origin:'https://bloxd.io'},
    document:{readyState:'loading',querySelector:()=>null,addEventListener(){}},
    localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},
    performance:{now:()=>0},addEventListener(){},postMessage(){},setTimeout:()=>1,clearTimeout(){},
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},queueMicrotask(){},
    ArrayBuffer,DataView,Float32Array,Uint32Array,Uint16Array,Uint8Array,
    __BVFX_DOCUMENT_START__:true,__BLOXD_MOD_HOST__:{profile:{performance:'quality'},observeDefinitions:()=>()=>{},onEngine:()=>()=>{}},...globals});
  vm.runInContext('window=globalThis;top=globalThis;',context);
  for(const file of pack.files.filter(f=>f.path!=='settings-bridge.js')){
    let source=managedSource(pack.manifest.id,file.path,Buffer.from(file.data,'base64').toString());
    if(file.path==='shader.js'){
      if(globals.__BVFX_NATIVE_REQUESTED__===true)vm.runInContext('const __testConnect=__BVFX_NATIVE_SHADOWS__.connectEffects;__BVFX_NATIVE_SHADOWS__.connectEffects=function(value){globalThis.__testNativeEnvironment=value;return __testConnect.call(this,value);};',context);
      const index=source.lastIndexOf('})();');
      source=source.slice(0,index)+'PAGE.__shaderTest={surfaces,installShaderSettings,selectShaderCategory,syncUi,patchTerrainShader,patchLiquidVertexShader,bindOreLookup,state,oreShaderState,runtime,sun,atmosphere,maintainWaterGeometry,applyWaterGeometry,flushWaterGeometry,waterChunkMeshes,waterGeometrySignature,waterMeshRecords,getWaterWorld,updateWaterPhysics,waterRipples,waterRippleUniforms,workerLightingData,updateOreGlow,installMeshingHook,meshingWorkers,changeShaderSetting,unpackLiquidGeometry,subdivideWaterData,waterShaderState,lavaShaderState,bindWaterMaterials,bindWaterClock,recordShaderFrame,syncMasterShaderMaterials,refreezePatchedMaterial,maintainVoxelLighting,periodicMaintenance,root:PAGE};\n'+source.slice(index);
    }
    vm.runInContext(source,context,{filename:file.path});
  }
  return context.__shaderTest;
}
function liquidPrograms(runtime,kind){
  const marker=kind==='lava'?'BVFX_LIQUID_LAVA_MATERIAL':'BVFX_LIQUID_WATER_MATERIAL';
  const vertex=`#version 300 es
#define BVFX_WATER_GEOMETRY
precision highp float;
layout(location=0)in vec3 position;uniform mat4 world;uniform mat4 viewProjection;
out highp vec3 vPositionW;out vec3 vNormalW;out vec4 vLightLevels;out float texAtlasIndex;out float vTerrainLambert;
void main(){vec3 positionUpdated=position;vec4 worldPos=world*vec4(positionUpdated,1.0);
vPositionW=worldPos.xyz;vNormalW=vec3(0,1,0);vLightLevels=vec4(1);texAtlasIndex=1.0;vTerrainLambert=1.0;gl_Position=viewProjection*worldPos;}`;
  const fragment=`#version 300 es
#define BVFX_TERRAIN_UNDERWATER
#define BVFX_WATER_GEOMETRY
#define ${marker}
precision highp float;
in highp vec3 vPositionW;in vec3 vNormalW;in vec4 vLightLevels;in float texAtlasIndex;in float vTerrainLambert;
uniform vec4 vEyePosition;uniform vec3 uAmbientLightColour;uniform vec3 uSkyLightColour;out vec4 glFragColor;
void main(){vec4 lightLevels=vLightLevels;vec4 baseColor=vec4(0.5,0.6,0.7,1.0);vec3 diffuseColor=vec3(1);
vec3 diffuseBase=vec3(0);diffuseBase+=vec3(vTerrainLambert);
vec3 skyLightContrib=mix(uAmbientLightColour,uSkyLightColour,lightLevels.w);
vec3 blockLightContrib=vec3(0);vec3 lightResult=skyLightContrib+blockLightContrib+diffuseBase;
glFragColor=baseColor;glFragColor.rgb*=lightResult;}`;
  return {vertex:runtime.patchLiquidVertexShader(vertex),fragment:runtime.sun.patch(runtime.patchTerrainShader(fragment))};
}
module.exports={shaderRuntime,liquidPrograms};
// Execute only the saved native shader emitters/ECS constructor. These
// definitions have no browser, canvas, network, worker or account access.
function nativeShaderModules(){
  const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/shader-native-2026-10-29.json')));
  const cache=new Map();
  function read(id){
    if(cache.has(id))return cache.get(id).exports;
    const entry=fixture.modules[id];if(!entry)throw Error('Unexpected native module: '+id);
    const module={exports:{}};cache.set(id,module);
    vm.runInNewContext('('+entry.code+')',{setTimeout:()=>1})(module,module.exports,read);
    return module.exports;
  }
  read.d=(target,definitions)=>{for(const [name,get]of Object.entries(definitions))Object.defineProperty(target,name,{get});};
  return {read,fixture};
}
module.exports.nativeShaderModules=nativeShaderModules;
function nativeLiquidPrograms(runtime,kind){
  const pair=liquidPrograms({patchLiquidVertexShader:s=>s,patchTerrainShader:s=>s,sun:{patch:s=>s}},kind);
  const native=nativeShaderModules().read(29957).mb(0).replaceAll('color.rgb','glFragColor.rgb');
  const fragment=pair.fragment.replace('#define BVFX_TERRAIN_UNDERWATER',
    '#define BLOXD_LIGHTING\n#define BVFX_TERRAIN_UNDERWATER')
    .replace('uniform vec4 vEyePosition;', 'uniform vec4 uHeldLightColour;uniform vec4 uHeldLightPos;uniform vec4 vEyePosition;')
    .replace(/vec4 lightLevels=vLightLevels;[\s\S]*glFragColor\.rgb\*=lightResult;/,
      'vec4 baseColor=vec4(0.5,0.6,0.7,1.0);vec3 diffuseColor=vec3(1);vec3 diffuseBase=vec3(0);glFragColor=baseColor;'+native);
  return {vertex:runtime.patchLiquidVertexShader(pair.vertex),fragment:runtime.sun.patch(runtime.patchTerrainShader(fragment))};
}
module.exports.nativeLiquidPrograms=nativeLiquidPrograms;
function hookedNativePrograms(kind,settings={}){
  class SourceSink {
    constructor(){this.canvas={addEventListener(){}};}
    shaderSource(shader,source){shader.source=source;}
    getParameter(){return 0;}getUniformLocation(){return null;}
    attachShader(){}linkProgram(){}getProgramParameter(){return true;}
    useProgram(){}uniform1f(){}drawArrays(){}drawElements(){}
  }
  shaderRuntime(settings, {WebGL2RenderingContext:SourceSink});
  const native=nativeLiquidPrograms({patchLiquidVertexShader:s=>s,patchTerrainShader:s=>s,sun:{patch:s=>s}},kind);
  const gl=new SourceSink(),programs={};
  for(const [stage,source]of Object.entries(native)){
    const shader={};let input=source.replace('#version 300 es','#version 300 es\n#define BVFX_MASTER_ACTIVE');
    if(stage==='vertex')input=input.replace('#define BVFX_WATER_GEOMETRY','#define BVFX_TERRAIN_UNDERWATER\n#define BVFX_WATER_GEOMETRY').replace('in vec3 position;','in vec3 position;in highp float texAtlasIndices;');
    gl.shaderSource(shader,input);
    programs[stage]=shader.source;
  }
  return programs;
}
module.exports.hookedNativePrograms=hookedNativePrograms;
