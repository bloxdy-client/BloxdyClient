'use strict';
function adaptNativeLitematica(name,source){
 const edit=(from,to)=>{if(!source.includes(from))throw Error('Native schematic source contract changed: '+name);source=source.replace(from,()=>to);};
 if(name==='adapter.js'){
  edit('const layout = globalThis.__BLM_RUNTIME_LAYOUT__(noa), scene = layout?.scene;',
   'const layout = globalThis.__BLM_RUNTIME_LAYOUT__(noa), scene = layout?.scene;\n    const nativeGpu=globalThis.__BLM_NATIVE_CONNECTION__?.(scene);');
  edit("if (!scene || typeof scene.getTransformMatrix !== 'function')", "if (!scene || (!nativeGpu && typeof scene.getTransformMatrix !== 'function'))");
  edit('      noa, layout, scene, canvas, origin,','      noa, layout, scene, canvas, origin, nativeOverlay:nativeGpu,');
  edit('gpu() { return (scene.getEngine?.()||scene._engine)?._gl||null; }','gpu() { return nativeGpu?.gpu || (scene.getEngine?.()||scene._engine)?._gl||null; }');
  edit('clip() { const engine=','clip() { if(nativeGpu)return nativeGpu.clip();const engine=');
  edit('matrix() { return matrixValues(scene.getTransformMatrix()); }','matrix() { return nativeGpu?nativeGpu.matrix():matrixValues(scene.getTransformMatrix()); }');
  edit('camera() { const p =','camera() { if(nativeGpu)return nativeGpu.camera();const p =');
 }
 if(name==='renderer.js'){
  edit('frameAPI=globalThis.__BLM_NATIVE_FRAME__,',`frameAPI=((base)=>({...base,save:gl=>gl.__native===true?gl.__save():base.save(gl),restore:(gl,state)=>gl.__native===true?gl.__restore(state):base.restore(gl,state)}))(globalThis.__BLM_NATIVE_FRAME__),`);
  edit('const next=globalThis.__BLM_ADAPTER__.connect();','const raw=globalThis.__BLM_ADAPTER__.connect(),next=raw?.nativeOverlay?raw.nativeOverlay.wrap(raw):raw;');
 }
 return source;
}
module.exports={adaptNativeLitematica};
