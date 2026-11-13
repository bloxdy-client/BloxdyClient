'use strict';
const fs=require('node:fs'),path=require('node:path');
const shadows=require('./shader-native-shadows.cjs');
const world=require('./shader-native-world.cjs');
const {nativeFogFrame}=require('./shader-native-fog.cjs');
const geometry=require('./shader-native-geometry.cjs');
const {prepareNativeLiquidJob}=require('./shader-native-liquid-job.cjs');
const {patchNativeLiquidSource}=require('./shader-native-liquids.cjs');
function adaptNativeShader(name,source){
 const edit=(before,after)=>{if(!source.includes(before))throw Error('Native shader integration changed: '+name);source=source.replace(before,()=>after);};
 if(name==='bootstrap.js'){
  const effects=fs.readFileSync(path.join(__dirname,'builtin-mods/shader-native-effects.js'),'utf8');
  const bridge=fs.readFileSync(path.join(__dirname,'builtin-mods/shader-native.js'),'utf8');
  const grass=fs.readFileSync(path.join(__dirname,'builtin-mods/grassify-native.js'),'utf8');
  const post=fs.readFileSync(path.join(__dirname,'builtin-mods/shader-native-post.js'),'utf8');
  const litematica=fs.readFileSync(path.join(__dirname,'builtin-mods/litematica-native.js'),'utf8');
  const worldRuntime=fs.readFileSync(path.join(__dirname,'builtin-mods/shader-native-world.js'),'utf8');
  const liquidRuntime=fs.readFileSync(path.join(__dirname,'builtin-mods/shader-native-liquids.js'),'utf8');
  const liquidPayload=fs.readFileSync(path.join(__dirname,'assets/native-liquids.json'),'utf8');
  const payload=fs.readFileSync(path.join(__dirname,'assets/native-effects.json'),'utf8');
  const grassPayload=fs.readFileSync(path.join(__dirname,'assets/native-grass.json'),'utf8');
  const litematicaPayload=fs.readFileSync(path.join(__dirname,'assets/native-litematica.json'),'utf8');
  source+=`\n(()=>{if(globalThis.__BVFX_NATIVE_REQUESTED__!==true)return;
${effects}\n${bridge}\n${grass}\n${post}\n${litematica}\n${worldRuntime}\n${liquidRuntime}
installNativeEffects(globalThis,${payload});
installNativeGrass(globalThis,${grassPayload});
installNativePost(globalThis);
installNativeLitematica(globalThis,${litematicaPayload});
installNativeWorld(globalThis,{uniformBytes:${world.worldUniformBytes},fields:${JSON.stringify(world.worldParameterFields)},patch:${world.patchNativeWorldSource.toString()},fog:${nativeFogFrame.toString()}});
installNativeLiquids(globalThis,{kernel:${liquidPayload},patch:${patchNativeLiquidSource.toString()},job:${prepareNativeLiquidJob.toString()},geometry:{${['decodeNativeQuads','decodeNativeTerrain','compactNativeLiquids','nativeLiquidLight'].map(name=>name+':'+geometry[name].toString()).join(',')}}});
installNativeShaderBridge(globalThis,{
 source:()=>${JSON.stringify(world.nativeWorldSource(shadows.nativeShadowSource()))},
 options:${shadows.shadowOptions.toString()},patch:${shadows.patchShadowParameters.toString()},attach:${shadows.attachNativeShadowControls.toString()},
 effects:async(native,settings,atmosphere,environment)=>{
  const sky=await globalThis.__BVFX_CREATE_NATIVE_EFFECTS__(native,settings,atmosphere);
  const has=id=>(globalThis.__BLOXD_MOD_HOST__.profile.modules||[]).some(m=>m.id===id);
  let grass,post,litematica,world,liquids;
  try{
   liquids=globalThis.__BVFX_ATTACH_NATIVE_LIQUIDS__(native,settings,environment);
   world=globalThis.__BVFX_ATTACH_NATIVE_WORLD__(native,settings,environment,sky);
   if(has('bloxd-grassify'))grass=globalThis.__BVFX_ATTACH_NATIVE_GRASS__(native);
   post=await globalThis.__BVFX_ATTACH_NATIVE_POST__(native,settings);
   if(has('bloxd-litematica'))litematica=await globalThis.__BLM_ATTACH_NATIVE_GPU__(native);
  }catch(error){litematica?.dispose();post?.dispose();grass?.dispose();world?.dispose();liquids?.dispose();sky.dispose();throw error;}
  return {dispose(){litematica?.dispose();post.dispose();grass?.dispose();world.dispose();liquids.dispose();sky.dispose();},
   diagnostics:()=>({sky:sky.diagnostics(),world:world.diagnostics(),liquids:liquids.diagnostics(),grass:grass?.diagnostics()||null,post:post.diagnostics(),litematica:litematica?.diagnostics()||null})};
 }
});\n})();\n`;
 }
 if(name==='sun-shadows.js')edit('root.__BVFX_CREATE_SUN__ = function createSunShadows(settings, report) {',
  "root.__BVFX_CREATE_SUN__ = function createSunShadows(settings, report) {\n    if(settings.shadowEngine==='bloxd-native-v1'){if(!root.__BVFX_NATIVE_SHADOWS__)throw Error('Native shader startup unavailable');return root.__BVFX_NATIVE_SHADOWS__.configure(settings,report);}");
 if(name==='shader.js'){
  edit('  const atmosphere = PAGE.__BVFX_CREATE_ATMOSPHERE__?.(state);',
   `  const atmosphere = PAGE.__BVFX_CREATE_ATMOSPHERE__?.(state);
  PAGE.__BVFX_NATIVE_SHADOWS__?.connectEffects({state,atmosphere,advanceFrame(scene){
    bindWaterClock(scene);
    const callback=waterClockScenes.get(scene);if(typeof callback==='function')callback();
  },entityKind:mesh=>entityLightReceiverKind(mesh),
  geometryKernel:()=>({subdivideWaterData,interpolateWaterLight,remapLiquidFaceGroups,buildUnderwaterAttribute}),
  liquidWorld:()=>getWaterWorld(getNoaRuntime()),
  liquidMetadata:()=>({water:Array.from(waterShaderState.indices.slice(0,waterShaderState.count)),lava:Array.from(lavaShaderState.indices.slice(0,lavaShaderState.count)),names:[...waterMaterialNames,...lavaMaterialNames]}),
  reportNativeError(message){runtime.error=message;queueStatus();},
  liquidFrame(){
    if(state.enabled&&state.lavaEnabled&&!state.lavaNativeTexture)sampleWaterOrigin();updateLavaTextureOrigin();
    const water=state.enabled&&state.waterEnabled?(WATER_STYLES[state.waterStyle]?.mode||1):0,lava=state.enabled&&state.lavaEnabled?(WATER_STYLES[state.lavaStyle]?.mode||1):0;
    const waterPhysics=water>1.5&&state.waterPhysics,lavaPhysics=lava>1.5&&state.lavaPhysics;
    const hex=/^#[0-9a-f]{6}$/i.test(state.waterColor)?state.waterColor:DEFAULTS.waterColor;
    return {uBvfxWaterMode:water,uBvfxLavaMode:lava,uBvfxWaterTime:water>1.5?waterFrameTime:0,uBvfxLavaTime:lava>1.5?lavaFrameTime:0,uBvfxWaterOrigin:waterOrigin,
      uBvfxWaveSettings:[state.waterHeight,state.waterFrequency,state.waterDirection*Math.PI/180],uBvfxLavaWaveSettings:[state.lavaHeight,state.lavaFrequency,state.lavaDirection*Math.PI/180],
      uBvfxLavaWavePhase:lavaWavePhase,uBvfxLavaTextureOrigin:lavaTextureOrigin,uBvfxWaterPhysics:waterPhysics?1:0,uBvfxLavaPhysics:lavaPhysics?2:0,
      uBvfxWaterPhysicsTime:waterPhysics||lavaPhysics?waterPhysicsTime:0,uBvfxWaterRippleCount:waterPhysics||lavaPhysics?waterRipples.length:0,uBvfxWaterRipples:waterRippleUniforms,
      uBvfxWaterColor:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),uBvfxWaterGlow:state.waterGlow,uBvfxWaterOpacity:state.waterOpacity/100,
      uBvfxLavaNativeTexture:state.lavaNativeTexture?1:0,uBvfxLavaGlow:state.lavaGlow,uBvfxLavaOpacity:state.lavaOpacity/100,
      uBvfxUnderwaterLight:water?state.underwaterLight/100:0,uBvfxLavaUnderwaterLight:lava?state.lavaUnderwaterLight/100:0};
  },worldFrame(){
    const noa=getNoaRuntime();
    if(sampledDynamicFrame!==waterFrameId || sampledDynamicRevision!==uniformRevision){
      sampledDynamicFrame=waterFrameId;sampledDynamicRevision=uniformRevision;
      sampledDynamicLight=dynamicLighting?.sample(noa,getBloxdRuntime(),getScene(noa)) || null;
    }
    return {equipment:sampledDynamicLight,ores:oreShaderState,oreStrength:oreSurfaceStrength(),surfaces:surfaces.nativeFrame()};
  }});`);
  edit('    const observer=scene.onBeforeRenderObservable.add(() => {','    const callback=() => {');
  edit('    });\n    waterClockScenes.set(scene,observer);','    };\n    const observer=nativeShadowMode?callback:scene.onBeforeRenderObservable.add(callback);\n    waterClockScenes.set(scene,observer);');
  edit('  function maintainWaterGeometry(noa) {','  function maintainWaterGeometry(noa) {\n    if(nativeShadowMode)return;');
  edit('  function bindWaterMaterials(noa,scanExisting=true) {','  function bindWaterMaterials(noa,scanExisting=true) {\n    if(nativeShadowMode){bindWaterClock(getScene(noa));return;}');
  edit('  function bindUnderwaterAppearance(scene) {','  function bindUnderwaterAppearance(scene) {\n    if(nativeShadowMode)return;');
  edit('  const storedState=loadSettings();','  const storedState=loadSettings();\n  if(PAGE.__BVFX_NATIVE_REQUESTED__===true)storedState.shadowEngine="bloxd-native-v1";');
  edit('      return loaded;',`      if(PAGE.__BVFX_NATIVE_REQUESTED__===true){
        loaded.shadowEngine='bloxd-native-v1';
        const oldEnabled=loaded.sunShadowEnabled!==false;
        loaded.blockShadows=typeof stored.blockShadows==='boolean'?stored.blockShadows:oldEnabled;
        loaded.entityShadows=typeof stored.blockShadows==='boolean'?stored.entityShadows!==false:oldEnabled&&stored.entityShadows!==false;
        loaded.shadowDistance=Number.isFinite(Number(stored.shadowDistance))?Math.max(16,Math.min(320,Number(stored.shadowDistance))):128;
        loaded.sunShadowEnabled=loaded.blockShadows||loaded.entityShadows;
      }
      return loaded;`);
  edit('  const state=dayNight?.settings || storedState;',`  const state=dayNight?.settings || storedState;
  const nativeShadowMode=state.shadowEngine==='bloxd-native-v1';
  if(nativeShadowMode){
    if(typeof state.blockShadows!=='boolean'){const enabled=state.sunShadowEnabled!==false;state.blockShadows=enabled;state.entityShadows=enabled&&state.entityShadows!==false;}
    state.shadowDistance=Number.isFinite(Number(state.shadowDistance))?Math.max(16,Math.min(320,Number(state.shadowDistance))):128;
    state.sunShadowEnabled=state.blockShadows||state.entityShadows;
    Object.defineProperty(state,'nativeShadows',{get:()=>state.blockShadows||state.entityShadows,configurable:true});
  }`);
  edit("    ['sunStrength', 'Shadow strength', 0, 1, 'sunShadowEnabled'],\n    ['sunFloor', 'Shade brightness', 0, 1, 'sunShadowEnabled'],",
   "    ...(nativeShadowMode ? [['sunStrength','Shadow strength',0,1,'nativeShadows'],['shadowDistance','Shadow distance',16,320,'nativeShadows',1,' blocks']] : [['sunStrength','Shadow strength',0,1,'sunShadowEnabled'],['sunFloor','Shade brightness',0,1,'sunShadowEnabled']]),");
  edit("    ['shadowStrength', 'Voxel shadow strength', 0, 1],\n    ['shadowFloor', 'Voxel ambient floor', 0, 1],",
   "    ...(nativeShadowMode ? [] : [['shadowStrength','Voxel shadow strength',0,1],['shadowFloor','Voxel ambient floor',0,1]]),");
  edit('  const checkboxDescriptions = {',`  const checkboxDescriptions = {
    blockShadows:'Blocks cast shadows. Entity shadows remain independent.',
    shadowDistance:'Maximum distance from the camera at which cast shadows are visible. Shadows fade out near the limit.',`);
  edit("      for (const [key, label] of [['sunShadowEnabled', 'Voxel ray shadows'], ['bloomEnabled', 'Bloom']]) {",`      if(nativeShadowMode){const group=document.createElement('div');group.className='SettingBoxGroup';
        group.append(makeNativeCheckbox('blockShadows','Block shadows'),makeNativeCheckbox('entityShadows','Entity shadows'));
        for(const spec of sliderSpecs.filter(spec=>spec[4]==='nativeShadows'))group.append(makeNativeSlider(spec));categories.shadows.append(group);
      }
      for (const [key, label] of (nativeShadowMode ? [['bloomEnabled','Bloom']] : [['sunShadowEnabled','Voxel ray shadows'],['bloomEnabled','Bloom']])) {`);
  edit('      categories.shadows.append(voxelControls);','      if(!nativeShadowMode)categories.shadows.append(voxelControls);');
  edit("        || ((key==='entityShadows' || key==='sunSmoothing') && !state.sunShadowEnabled)","        || (!nativeShadowMode && (key==='entityShadows' || key==='sunSmoothing') && !state.sunShadowEnabled)");
  edit('  function changeShaderSetting(key, value) {',`  function changeShaderSetting(key, value) {
    if(nativeShadowMode&&['blockShadows','entityShadows','sunStrength','shadowDistance'].includes(key)){
      state[key]=key==='sunStrength'?Math.max(0,Math.min(1,Number(value))):key==='shadowDistance'?Math.max(16,Math.min(320,Number(value))):Boolean(value);
      state.sunShadowEnabled=state.blockShadows||state.entityShadows;state.preset='custom';sun?.invalidateSettings?.();syncUi();saveSettings();queueStatus();return;
    }`);
 }
 return source;
}
module.exports={adaptNativeShader};
