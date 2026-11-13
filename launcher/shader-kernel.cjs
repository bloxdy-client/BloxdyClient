'use strict';
// Small shared contracts inside the existing renderer; no additional render
// loop, scene traversal, render target, resolution scaling or GPU readback.
function configureShadowDepth(gl){
  // ES 3.0.6 §3.8.13: raw sized depth + LINEAR is sampler-incomplete,
  // even when checkFramebufferStatus reports FRAMEBUFFER_COMPLETE.
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.NONE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
}
function shadowBatchMesh(variation){return variation?.mesh || variation?.getMesh?.();}
function shadowBatchMatrices(variation,mesh){
  return variation?.batch?.matrices || variation?.buffers?.matrix || mesh?._thinInstanceDataStorage?.matrixData;
}
function movingShadowSize(selectedSize,radius,detailRadius){
  // Match the close terrain's texel density across the moving map's existing
  // coverage. This changes neither the number of maps nor the update cadence.
  return Math.min(4096,2**Math.ceil(Math.log2(selectedSize*Math.min(radius,25)/detailRadius)));
}
function appendShadowAttachments(manager,ids,parent,result,compose,multiply,seen=new Set()){
  for(const id of ids||[]){
    if(seen.has(id)||seen.size>=128)continue;seen.add(id);
    const object=manager.objectData?.[id],types=manager.types?.[object?.type]?.typeNodes;
    if(!object||!Array.isArray(types))continue;
    const transforms=new Map(),visiting=new Set();
    const transformFor=index=>{
      if(transforms.has(index))return transforms.get(index);
      if(visiting.has(index))return null;visiting.add(index);
      const node=object.nodes?.[index],type=types[index];
      const local=node&&compose(node),base=type?.parent==null?parent:transformFor(type.parent);
      const transform=local&&base?multiply(base,local):null;
      visiting.delete(index);transforms.set(index,transform);return transform;
    };
    object.nodes?.forEach((node,index)=>{
      if(node.enabled===false)return;
      const transform=transformFor(index);if(!transform)return;
      const group=manager.thinMeshes?.[types[index]?.thinMeshIndex];
      const variation=group?.idToMetadata?.[node.thinInstanceId]?.meshVariation;
      const mesh=variation?.mesh||variation?.getMesh?.()||group?.getMesh?.(node.thinInstanceId);
      if(mesh){
        let atlasIndices=null;
        for(let channel=0;channel<2;channel++){
          const name='aAtlasIdx'+(channel+1);if(!variation?.strides?.[name])continue;
          const values=variation.get(node.thinInstanceId,name);
          if(values?.length!==4||!Array.from(values).every(Number.isFinite)){atlasIndices=null;break;}
          atlasIndices??=new Float32Array(8);atlasIndices.set(values,channel*4);
        }
        result.parts.push({mesh,transform,atlasIndices});
        const slot=variation?.idToIndex?.[node.thinInstanceId];
        if(Number.isInteger(slot)){if(!result.excluded.has(mesh))result.excluded.set(mesh,new Set());result.excluded.get(mesh).add(slot);}
      }
      appendShadowAttachments(manager,node.attachedThinObjectIds,transform,result,compose,multiply,seen);
    });
  }
}
function shadowReceiverFocus(game,player,scene,layout){
  const entities=game?.entities || game?.lL || game?.Hn || game?.iX || game?.Fs || game?.vq;
  let position;
  try{position=entities?.getState?.(player,'position') || entities?.xc?.(player) || entities?.bQ?.(player);}catch{/* Runtime transition. */}
  const local=position?.xQi || position?.PC || position?.Ho || position?.xf || position?.Qb || position?.Im || position?.rS || position?.WV;
  if(local?.length===3 && Array.from(local).every(Number.isFinite))return {x:local[0],y:local[1],z:local[2]};
  const absolute=position?.position,origin=layout?.originKey && game?.[layout.originKey];
  if(absolute?.length===3 && origin?.length===3 && Array.from(absolute).every(Number.isFinite) && Array.from(origin).every(Number.isFinite))
    return {x:absolute[0]-origin[0],y:absolute[1]-origin[1],z:absolute[2]-origin[2]};
  const camera=scene?.activeCamera;
  return camera?.getAbsolutePosition?.() || camera?.globalPosition || camera?.position || {x:0,y:0,z:0};
}
function createShaderVariantCache(maxEntries=48,maxBytes=4*1024*1024){
  const entries=new Map();let bytes=0;
  const stats={hits:0,misses:0,rejectedHits:0,compileFailures:0};
  function put(source,value){
    const previous=entries.get(source);if(previous){bytes-=previous.bytes;entries.delete(source);}
    const cost=2*(source.length+(value.patched?.length||0));
    if(cost>maxBytes)return;
    entries.set(source,{value,bytes:cost});bytes+=cost;
    while(entries.size>maxEntries || bytes>maxBytes){const key=entries.keys().next().value;bytes-=entries.get(key).bytes;entries.delete(key);}
  }
  return {
    get(source){const entry=entries.get(source);if(!entry){stats.misses++;return null;}
      entries.delete(source);entries.set(source,entry);stats.hits++;if(entry.value.failed)stats.rejectedHits++;return entry.value;},
    put,reject(source){stats.compileFailures++;put(source,{failed:true});},
    diagnostics:()=>({...stats,entries:entries.size,bytes,maxBytes,maxEntries})
  };
}
module.exports={configureShadowDepth,shadowBatchMesh,shadowBatchMatrices,movingShadowSize,shadowReceiverFocus,createShaderVariantCache,appendShadowAttachments};
