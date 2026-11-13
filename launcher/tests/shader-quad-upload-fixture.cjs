'use strict';
// CPU-only execution of the saved native index allocator and rewrite method.
const vm=require('node:vm'),fixture=require('./fixtures/shader-quad-upload-2026-11-08.json');
function nativeQuadUpload(){
  const tools=vm.runInNewContext('(()=>{'+fixture.indexHelpers+';return {bind:eQ,orient:Oh,fill:iV,'+fixture.rewriteMethod+'};})()');
  const engine={createIndexBuffer:(data,_dynamic,label)=>({data,label,is32Bits:true,references:1}),_releaseBuffer(){},onContextRestoredObservable:{addOnce(){}}};
  const geometry=()=>({_indices:new Uint32Array(),setIndexBuffer(buffer,vertices,indices){this._indexBuffer=buffer;this._totalVertices=vertices;this._totalIndices=indices;}});
  return {...tools,engine,geometry};
}
module.exports={nativeQuadUpload};
