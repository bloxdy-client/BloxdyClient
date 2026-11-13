'use strict';
// Runs only inside a game session opened and operated by the user.
function masterShaderDefines(defines){
  if(!defines || defines.__bvfxMasterVariant)return false;
  const stringify=defines.toString;
  Object.defineProperty(defines,'__bvfxMasterVariant',{value:true});
  defines.toString=function(){return stringify.call(this)+(state.enabled?'\n#define BVFX_MASTER_ACTIVE\n':'');};
  return true;
}
function bindSkyMasterVariant(material,record){
  // The native SkyMaterial has no customShaderNameResolve callback. Its
  // verified isReadyForSubMesh method creates materialDefines itself.
  const ready=material.isReadyForSubMesh;record.skySubMeshes=new Set();
  material.isReadyForSubMesh=function(mesh,sub,...args){
    record.skySubMeshes.add(sub);
    let first;
    if(!sub.materialDefines)first=ready.call(this,mesh,sub,...args);
    if(masterShaderDefines(sub.materialDefines)){
      sub.materialDefines.markAsUnprocessed?.();sub.materialDefines._renderId=-1;
      if(sub._drawWrapper)sub._drawWrapper._wasPreviouslyReady=false;
    }else if(first!==undefined)return first;
    return ready.call(this,mesh,sub,...args);
  };
}
function syncMasterShaderMaterials(scene){
  for(const material of scene?.materials || []){
    if(!material || typeof material.onBindObservable?.add!=='function')continue;
    // UI, protection overlays, particles and hit flashes must keep their native
    // effect keys. New temporary materials used to dirty/recompile the scene.
    const name=String(material.name || '');
    if(/camScreen|overlay|flash|highlight|selection|particle|gui|(?:^|[-_])ui(?:$|[-_])|damage|hurt|impact/i.test(name))continue;
    const owned=waterMaterialBindings.has(material)||entityLightMaterialBindings.has(material)
      || name==='base-terrain'||/^terrain-/.test(name)||/^skybox$/i.test(name)
      || material.getClassName?.()==='SkyMaterial'
      || (material.pluginManager?._plugins || []).some(p=>/EntityLight|Lifeform/.test(p?.getClassName?.()||''));
    if(!owned)continue;
    let record=shaderMasterBindings.get(material);
    if(!record){
      record={enabled:null,frozen:Boolean(material.isFrozen || material.checkReadyOnlyOnce)};
      shaderMasterBindings.set(material,record);
      if(material.getClassName?.()==='SkyMaterial' && typeof material.isReadyForSubMesh==='function')bindSkyMasterVariant(material,record);
      const resolve=material.customShaderNameResolve;
      material.customShaderNameResolve=function(...args){
        if(/camScreen|overlay|flash|highlight|selection|particle|gui|damage|hurt|impact/i.test(String(this.name||'')))return args[0];
        const name=resolve?resolve.apply(this,args):args[0],defines=args[4];
        masterShaderDefines(defines);
        return name;
      };
    }
    const receiver=waterMaterialBindings.has(material);
    const smoothing=receiver?Boolean(state.sunSmoothing ?? (Number(state.sunSoftness)>0)):null;
    if(record.enabled===state.enabled && record.smoothing===smoothing)continue;
    record.enabled=state.enabled;
    record.smoothing=smoothing;
    record.frozen=record.frozen || Boolean(material.isFrozen || material.checkReadyOnlyOnce);
    if(record.frozen)material.checkReadyOnlyOnce=false;
    for(const sub of record.skySubMeshes || []){
      sub.materialDefines?.markAsUnprocessed?.();if(sub.materialDefines)sub.materialDefines._renderId=-1;
      if(sub._drawWrapper)sub._drawWrapper._wasPreviouslyReady=false;
    }
    const blocked=material._blockDirtyMechanism;
    if(typeof blocked==='boolean')material._blockDirtyMechanism=false;
    try{
      const invalidate=material._markAllSubMeshesAsAllDirty || material.markAsDirty;
      if(typeof invalidate==='function')invalidate.call(material,1);
      else {
        const legacy=material.dI || material.oQ || material.gB || material.Gx || material.LC || material.wY || material.lT;
        if(typeof legacy==='function')legacy.call(material,true);
      }
    }finally{if(typeof blocked==='boolean')material._blockDirtyMechanism=blocked;}
    if(record.frozen)refreezePatchedMaterial(material,[],effect=>
      typeof effect?.defines==='string' && /^#define BVFX_MASTER_ACTIVE\b/m.test(effect.defines)===state.enabled
      && (!state.enabled || !receiver || /^#define BVFX_SUN_SMOOTHING\b/m.test(effect.defines)===smoothing));
  }
}
function recordShaderFrame(now){
  const gap=now-shaderFrameHistory.last;shaderFrameHistory.last=now;
  shaderFrameHistory.draws.native=runtime.nativeDraws||0;shaderFrameHistory.draws.patched=runtime.patchedDraws||0;
  runtime.nativeDraws=runtime.patchedDraws=0;
  if(!(gap>0 && gap<5000) || document.hidden)return;
  shaderBudget.sample(gap);
  shaderFrameHistory.values[shaderFrameHistory.next]=gap;
  shaderFrameHistory.next=(shaderFrameHistory.next+1)%120;
  shaderFrameHistory.count=Math.min(120,shaderFrameHistory.count+1);
  // Two small local log records remove the need for a manual F9 capture.
  // Whitelist performance data; never serialize a scene, profile or account.
  if(!state.enabled)return;
  if(!Number.isFinite(shaderFrameHistory.firstSampleAt))shaderFrameHistory.firstSampleAt=now;
  const reports=shaderFrameHistory.automaticReports||0;
  if(reports>=2 || shaderFrameHistory.count<60 || now-shaderFrameHistory.firstSampleAt<(reports?60000:15000))return;
  shaderFrameHistory.automaticReports=reports+1;
  try{
    const times=shaderFrameHistory.values.subarray(0,shaderFrameHistory.count);
    const gpu=PAGE.__BVFX_GPU_TIMER__?.diagnostics?.();
    console.info('[BVFX performance] '+JSON.stringify({schema:'shader-performance-v1',
      scope:'Callback cadence and CPU wall time, not presented FPS. GPU time covers the scene.',
      frames:times.length,callbackFps:1000*times.length/times.reduce((a,b)=>a+b,0),worstCallbackMs:Math.max(...times),
      draws:shaderFrameHistory.draws,cpuWallMs:shaderBudget.cpuWall(),
      pendingLiquidChunks:pendingWaterGeometry.size,liquidChunks:waterMeshRecords.size,
      pendingLiquidKinds:pendingLiquidKinds.size,pendingUnderwater:pendingUnderwaterMasks.size,
      shadowReady:Boolean(sun?.ready),shadowResolution:sun?.resolutionInfo||null,
      sky:atmosphere?.skyDiagnostics?.()||null,gpu:gpu?{samples:gpu.samples,averageMs:gpu.sceneAverageMs,maxMs:gpu.sceneMaxMs}:null}));
  }catch{/* Optional logging cannot interrupt a scene callback. */}
}
function shaderDiagnostics(){
  const noa=getNoaRuntime(),scene=getScene(noa),gl=shaderObservedContext || scene?._engine?._gl || scene?.getEngine?.()?._gl;
  const times=Array.from(shaderFrameHistory.values.subarray(0,shaderFrameHistory.count));
  let renderer=null,version=null;
  if(gl && !gl.isContextLost?.())try{
    const debug=gl.getExtension?.('WEBGL_debug_renderer_info');
    renderer=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)).slice(0,256);
    version=String(gl.getParameter(gl.VERSION)).slice(0,128);
  }catch{/* Diagnostic reads are optional and never create a context. */}
  return {enabled:state.enabled,preset:PAGE.__BLOXD_MOD_HOST__?.profile?.performance || 'balanced',
    backend:PAGE.__BVFX_RENDER_BACKEND__ || null,renderer,version,
    frames:times.length,fps:times.length?1000*times.length/times.reduce((a,b)=>a+b,0):null,
    worstFrameMs:times.length?Math.max(...times):null,observedDrawCalls:shaderFrameHistory.draws,
    meshes:scene?.meshes?.length || 0,materials:scene?.materials?.length || 0,
    pendingLiquidChunks:pendingWaterGeometry.size,liquidChunks:waterMeshRecords.size,
    pendingLiquidKinds:pendingLiquidKinds.size,pendingUnderwater:pendingUnderwaterMasks.size,
    lighting:runtime.lighting,error:runtime.error,compiledPrograms:runtime.programs,
    adaptiveQuality:shaderBudget.limits(),authoredShadows:{resolution:2**state.sunResolutionExponent,rate:state.sunFrameRate,
      smoothing:Boolean(state.sunSmoothing ?? (Number(state.sunSoftness)>0))},
    renderScale:null,renderStateCache:gl?PAGE.__BVFX_RENDER_STATE__?.(gl)?.diagnostics()||null:null,chunkShadowCache:sun?.chunkCacheDiagnostics || null,
    cpuWallMs:shaderBudget.cpuWall(),cpuWallScope:'Main-thread wall time, including driver waits; nested phases overlap. Not GPU timing.',
    shadows:{enabled:state.enabled && state.sunShadowEnabled,ready:Boolean(sun?.ready),resolution:sun?.resolutionInfo || null,
      passes:sun?.shadowDiagnostics || null},sky:gl?atmosphere?.skyDiagnostics?.(gl) || null:null};
}
function adaptShaderLifecycle(name,source){
  const edit=(from,to)=>{if(!source.includes(from))throw Error('Shader lifecycle adapter mismatch: '+name+' / '+from.slice(0,70));source=source.replace(from,()=>to);};
  if(name==='shader.js'){
    edit('face=>nativeKinds[face*4]===2 || state.waterPhysics && nativeKinds[face*4]===1\n          ? 0.25 : 0.5',
      "face=>PAGE.__BLOXD_MOD_HOST__?.profile?.performance==='quality' && (nativeKinds[face*4]===2 || state.waterPhysics && nativeKinds[face*4]===1) ? 0.25 : 0.5");
    edit('  const materialRefreezeBindings=new WeakMap();',
      '  const shaderMasterBindings=new WeakMap();\n  '+masterShaderDefines.toString()+'\n  '+bindSkyMasterVariant.toString()+'\n  '+syncMasterShaderMaterials.toString()+'\n  const materialRefreezeBindings=new WeakMap();');
    edit('  function bindWaterClock(scene) {',`  const shaderFrameHistory={values:new Float64Array(120),next:0,count:0,last:NaN,draws:{native:0,patched:0}};
  ${recordShaderFrame.toString()}
  ${shaderDiagnostics.toString()}
  PAGE.__BVFX_INSTANCE__.diagnostics=shaderDiagnostics;
  function bindWaterClock(scene) {`);
    edit('      const now = PAGE.performance.now();\n      waterPhysicsTime', '      const now = PAGE.performance.now();\n      recordShaderFrame(now);\n      waterPhysicsTime');
    edit('      if (!info) return draw.apply(gl, args);', '      if (!info){runtime.nativeDraws=(runtime.nativeDraws||0)+1;return draw.apply(gl,args);}\n      runtime.patchedDraws=(runtime.patchedDraws||0)+1;');
    edit('      let patched = source;\n      let entityPatched = false;',`      // Native variants must remain native in the engine's effect cache.
      // Disabled visuals select them, instead of executing the large patched
      // program with zero uniforms and seven inactive sampler bindings.
      if(!state.enabled || !source.includes('#define BVFX_MASTER_ACTIVE'))
        return original.shaderSource.call(this,shader,source);
      let patched = source;
      let entityPatched = false;`);
    edit('return stringify.call(this) + \'\\n#define BVFX_TERRAIN_UNDERWATER\'',
      'return stringify.call(this) + (!state.enabled?\'\':\'\\n#define BVFX_TERRAIN_UNDERWATER\'');
    // Close the conditional added around the terrain-only cache markers.
    edit("+ waterMarker + materialMarker + '\\n';", "+ waterMarker + materialMarker + ((state.sunSmoothing ?? (Number(state.sunSoftness)>0))?'\\n#define BVFX_SUN_SMOOTHING':'') + '\\n');");
    edit("    if(key==='skyColor')state.skyColorCustom=true;",
      "    if(key==='sunSmoothing')syncMasterShaderMaterials(getScene(getNoaRuntime()));\n    if(key==='skyColor')state.skyColorCustom=true;");
    edit("defines.toString=function(){return stringify.call(this)+'\\n#define BVFX_ENTITY_LIGHT_RECEIVER\\n';};",
      "defines.toString=function(){return stringify.call(this)+(state.enabled?'\\n#define BVFX_ENTITY_LIGHT_RECEIVER\\n':'');};");
    edit('&& (!pending.uniforms.length || pending.uniforms.some(name=>effect.getUniform?.(name)!=null))',
      '&& (!state.enabled || !pending.uniforms.length || pending.uniforms.some(name=>effect.getUniform?.(name)!=null))');
    edit("        effect?.setFloat?.('uBvfxEntityIgnoreDarkness',",`        if(!state.enabled && !effect?.defines?.includes('BVFX_MASTER_ACTIVE'))return;
        effect?.setFloat?.('uBvfxEntityIgnoreDarkness',`);
    edit('    const noa=getNoaRuntime();\n    // A water material/mesh failure',
      '    const noa=getNoaRuntime();\n    syncMasterShaderMaterials(getScene(noa));\n    // A water material/mesh failure');
    edit('      // Once enabled, keep the native packed-light backend',`      if(!wanted && lightingBinding.forced){
        setVoxelLighting(noa,lightingBinding.original);lightingBinding.forced=false;
      }
      // Once enabled, keep the native packed-light backend`);
    edit(`      // Once enabled, keep the native packed-light backend and its compiled
      // terrain effects resident. Disabling our visuals uses zero uniforms;
      // switching native defines here invalidates every visible chunk effect.`,
      '      // Master Off restores the original native lighting selection.');
    edit('    maintenanceSnapshot={noa,scene,materials:', '    maintenanceSnapshot={enabled:state.enabled,noa,scene,materials:');
    edit('    if(!snapshot || snapshot.noa!==noa || snapshot.scene!==scene',
      '    if(!snapshot || snapshot.enabled!==state.enabled || snapshot.noa!==noa || snapshot.scene!==scene');
    edit('    if(snapshot.materials!==scene?.materials?.length) {',
      '    if(!state.enabled)return;\n    if(snapshot.materials!==scene?.materials?.length) {\n      syncMasterShaderMaterials(scene);');
  }
  if(name==='atmosphere.js'){
    edit('const detailed=blocks || space,ratio=detailed?0.75:0.5;',
      "const detailed=blocks || space,quality=root.__BLOXD_MOD_HOST__?.profile?.performance==='quality',ratio=quality?(detailed?0.75:0.5):(detailed?0.5:0.3333333333);");
    edit('Math.min(detailed?1440:960,Math.ceil(viewport[2]*ratio))',
      'Math.min(quality?(detailed?1440:960):(detailed?960:640),Math.ceil(viewport[2]*ratio))');
    edit('Math.min(detailed?810:540,Math.ceil(viewport[3]*ratio))',
      'Math.min(quality?(detailed?810:540):(detailed?540:360),Math.ceil(viewport[3]*ratio))');
  }
  return source;
}
module.exports={adaptShaderLifecycle};
