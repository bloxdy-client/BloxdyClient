'use strict';
// Only the saved native accessor definitions run in this CPU fixture. Their
// constructor, engine buffers, scene, browser and account code never run.
const vm=require('node:vm'),fixture=require('./fixtures/shader-instances-2026-11-08.json');
const Variation=vm.runInNewContext('('+fixture.variationClass+')',{bi:'matrix'});
const getMesh=vm.runInNewContext('('+fixture.groupGetMesh+')');
function nativeVariation(mesh,matrices,enabled=matrices.length/16){
  const variation=Object.create(Variation.prototype);
  Object.assign(variation,{mesh,batch:{matrices,enabled,count:matrices.length/16,attributes:new Float32Array(matrices.length/16*12),rowStride:12},
    strides:{matrix:16,aAtlasIdx1:4,aAtlasIdx2:4},baseOffsets:{matrix:0,aAtlasIdx1:2,aAtlasIdx2:7},idToIndex:{}});
  const group={meshVariations:{__DEFAULT__:variation},idToMetadata:{},getMesh,getEnabled:id=>variation.getEnabled(id)};
  for(let slot=0;slot<matrices.length/16;slot++){
    const id=100+slot;variation.idToIndex[id]=slot;group.idToMetadata[id]={objectId:10+slot,meshVariation:variation};
    variation.batch.attributes.set([11+slot*20,12+slot*20,13+slot*20,14+slot*20],slot*12+2);
    variation.batch.attributes.set([21+slot*20,22+slot*20,23+slot*20,24+slot*20],slot*12+7);
  }
  return {variation,group};
}
module.exports={nativeVariation};
