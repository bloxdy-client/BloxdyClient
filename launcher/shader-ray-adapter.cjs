'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createNativeRayCpu,installNativeRayCpu}=require('./shader-ray-native.cjs');
const {rayShaders}=require('./shader-ray-glsl.cjs');
function adaptRayShadows(name,source){
 const edit=(from,to)=>{if(!source.includes(from))throw Error('Voxel ray adapter mismatch: '+name+' / '+from.slice(0,65));source=source.replace(from,()=>to);};
 if(name==='bootstrap.js')source+='\n('+installNativeRayCpu.toString()+')(globalThis,'+createNativeRayCpu.toString()+');\n';
 if(name==='sun-shadows.js'){
  const runtime=fs.readFileSync(path.join(__dirname,'builtin-mods/shader-rays.js'),'utf8').replace('/* BVFX_RAY_SHADERS */null',()=>JSON.stringify(rayShaders()));
  edit('    const qualities =',`    const rays=settings.shadowEngine==='voxel-ray-v1'?root.__BVFX_CREATE_RAYS__(settings,report):null;
    const rayGeometry=new WeakMap();
    function raySnapshot(visit){
      const registry=casterRegistry(),body=localBodyParts(),items=[...(registry.movingItems||[]),...body.parts];
      for(const entry of items){
        const mesh=entry.mesh,source=mesh?.sourceMesh||mesh;if(!source||mesh.isDisposed?.()||casterRejection(mesh,true))continue;
        const buffer=source.getVertexBuffer?.('position'),revision=terrainRevisions.get(source)||0;
        const geometry=source._geometry||source.geometry||source.Wo;
        let known=rayGeometry.get(source);
        if(!known||known.buffer!==buffer||known.revision!==revision||known.indexSource!==geometry?._indices){
          const raw=source.getVerticesData?.('position'),indices=geometry?._indices||source.getIndices?.()||source.oF?.();
          if(!raw?.length||raw.length%3||(!indices?.length&&source.getTotalIndices?.()>0))continue;
          // Like Bloxd's native entity baker, cache the model grid and animate
          // its observed node/instance transforms instead of baking every pose.
          const positions=raw;if(!Array.from(positions).every(Number.isFinite))continue;
          known={buffer,revision,indexSource:geometry?._indices,geometry:{vertexAttributes:[{kind:'position',values:positions}],vertexCount:positions.length/3,indexData:indices}};rayGeometry.set(source,known);
        }
        const data=known.geometry,batch=registry.batches.get(mesh),thin=mesh._thinInstanceDataStorage,matrices=entry.transform?null:shadowBatchMatrices(batch,mesh),wm=entry.transform||world(mesh);
        if(!wm?.every(Number.isFinite))continue;
        const offer=matrix=>{if(matrix?.length!==16||!matrix.every(Number.isFinite)||Math.abs(matrix[15]-1)>.01)return;for(const column of [0,4,8]){const scale=Math.hypot(matrix[column],matrix[column+1],matrix[column+2]);if(scale<.001||scale>8)return;}visit({geometry:data,indexed:Boolean(data.indexData?.length),first:0,count:data.indexData?.length||data.vertexCount,skip:null,yD:matrix,worldAt:0,instances:null,instanceCount:1,thin:false});};
        if(matrices){const count=Math.min(batch?.numEnabled??thin?.instancesCount??0,Math.floor(matrices.length/16));for(let i=0;i<count;i++)if(!body.excluded.get(mesh)?.has(i))offer(multiply(wm,matrices,undefined,i*16));}
        else if(!batch||entry.transform)offer(wm);
      }
    }
    const qualities =`);
  edit('    function renderMeasured() {','    function renderMeasured() {\n      if(rays){shadowFrame++;rays.update(context,scene,game,raySnapshot);return;}');
  edit('    function patch(source) {','    function patch(source) {\n      if(rays)return rays.patch(source);');
  edit('    function locations(gl,program) {','    function locations(gl,program) {\n      if(rays)return rays.locations(gl,program);');
  edit('    function bind(gl,loc,frameStamp) {','    function bind(gl,loc,frameStamp) {\n      if(rays){const nativeContext=scene?.getEngine?.()?._gl||scene?._engine?._gl;if(!nativeContext||nativeContext===gl)context=gl;return rays.bind(gl,loc);}');
  edit('    function attach(nextScene, nextGame=game) {','    function attach(nextScene, nextGame=game) {\n      rays?.attach(nextScene,nextGame);');
  edit('    function refresh() {','    function refresh() {\n      rays?.refresh();');
  edit('      invalidateSettings(){settingsRevision++;},','      invalidateSettings(){settingsRevision++;rays?.refresh();},');
  edit('return enabled() && ready && context===gl && !gl.isContextLost();','return enabled() && (rays?rays.ready:ready) && context===gl && !gl.isContextLost();');
  edit('      get resolutionInfo(){','      get resolutionInfo(){\n        if(rays)return rays.resolutionInfo;');
  edit('get diagnostic(){return diagnostic;}, get drawing(){return drawing;}', 'get diagnostic(){return rays?rays.diagnostic:diagnostic;}, get drawing(){return rays?rays.drawing:drawing;}');
  edit('      get shadowDiagnostics(){return {','      get shadowDiagnostics(){if(rays)return rays.shadowDiagnostics;return {');
  edit('      get ready(){return ready;}', '      get ready(){return rays?rays.ready:ready;}');
  edit('dispose(){attach(null,null);release();restoreLights();', 'dispose(){rays?.dispose();attach(null,null);release();restoreLights();');
  source=runtime+'\n'+source;
 }
 if(name==='shader.js'){
  edit('  const storedState=loadSettings();', "  DEFAULTS.shadowEngine='voxel-ray-v1';\n  const storedState=loadSettings();");
  // Old values stay in saved presets for rollback; the new path never reads
  // resolution, map range, filtering, quality or shadow frame-rate settings.
  source=source.replace(/^    \['sun(?:Range|ResolutionExponent|FrameRate)',[^\n]+\r?\n/gm,'');
  edit("        if (key === 'sunShadowEnabled') group.append(makeNativeCheckbox('sunSmoothing', 'Shadow smoothing'));",'');
  source=source.replace('Real sun shadows (WebGL 2)','Voxel ray shadows');
  source=source.replace("['sunFloor', 'Block side brightness'", "['sunFloor', 'Shade brightness'");
  edit("sunShadowEnabled: 'Sun shadows add soft shadows from terrain, players, and mobs. Higher quality lowers FPS.'", "sunShadowEnabled: 'Traces sunlight through block shapes and moving entity grids. Detail follows the world geometry. Bloxd Lighting controls the underlying sky, ambient and block light.'");
  edit("entityShadows: 'Includes all players, mobs, and other dynamic entities in real sun shadows.'", "entityShadows: 'Includes players, mobs and items using cached geometry grids and their current transforms.'");
  edit("sunFloor: 'Higher values brighten block faces that point away from the sun. Cast shadows on the ground keep their own strength.'", "sunFloor: 'Brightness retained in shade. Higher values lighten cast shadows and faces turned away from the sun.'");
  edit('authoredShadows:{resolution:2**state.sunResolutionExponent,rate:state.sunFrameRate,', "authoredShadows:{engine:state.shadowEngine,resolution:state.shadowEngine==='voxel-ray-v1'?null:2**state.sunResolutionExponent,rate:state.shadowEngine==='voxel-ray-v1'?null:state.sunFrameRate,");
 }
 return source;
}
module.exports={adaptRayShadows};
