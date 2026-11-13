'use strict';
// Source-only adaptations for the verified catalog release. The functions
// below run only in a game session started and operated by the user.
function cacheLiquidBlockReads(world){
  if(!world)return world;
  // One synchronous preparation only. Adjacent liquid vertices repeatedly
  // sample the same voxel for shores, depth and underwater attributes. Never
  // retain values across an edit/upload, and bound temporary storage.
  const blocks=new Map();
  return {...world,read(x,y,z){
    const key=Math.floor(x)+','+Math.floor(y)+','+Math.floor(z);
    if(blocks.has(key))return blocks.get(key);
    const value=world.read(x,y,z);
    if(blocks.size<8192)blocks.set(key,value);
    return value;
  }};
}
function liquidUploadSchema(manager){
  const source=String(manager.meshBuilder?.assignMeshData || '');
  const light=source.match(/setVerticesData\(["']aPackedLightLevels["'],\s*[\w$]+\.([\w$]+)/)?.[1];
  const parameter=source.match(/^[^(]*\([^,]+,\s*([\w$]+)\s*\)/)?.[1];
  const fields=source.match(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*[\w$]+\s*;/)?.[1];
  const label=fields?.split(',').map(field=>field.trim().split(':')[0])
    .filter(key=>!['vertices','usesAtlas','terrainID','indices'].includes(key));
  // Current native upload destructures the chunk label, and reads packed
  // light with a null-coalescing expression before create/rewriteChunkBuffers.
  // Recover those exact fields; never infer a light array from its length.
  const nativeLight=parameter && (source.match(new RegExp('null\\s*!==\\s*\\([\\w$]+\\s*=\\s*'+parameter+'\\.([\\w$]+)\\)'))?.[1]
    || source.match(new RegExp(parameter+'\\.([\\w$]+)\\s*\\?\\?'))?.[1]
    || source.match(new RegExp(parameter+'\\.([\\w$]+)\\s*\\?\\s*\\(0,[\\w$]+\\.[\\w$]+\\)\\('+parameter+'\\.\\1\\)'))?.[1]);
  return {light:light || nativeLight,label:label?.length===1?label[0]:null};
}
function remapLiquidFaceGroups(groups,plans){
  // Current native terrain stores nine quad boundaries (six face groups and
  // two repeated prefix groups), then six bounds. Its culler draws 6*range.
  // Tessellation changes those boundaries, even for untouched solid sides.
  if(groups?.length!==15 || groups[0]!==0 || groups[8]!==plans.length)return null;
  for(let i=0;i<9;i++)if(!Number.isInteger(groups[i]) || groups[i]<0
      || groups[i]>plans.length || i>0 && groups[i]<groups[i-1])return null;
  const offsets=new Uint32Array(plans.length+1);
  for(let i=0;i<plans.length;i++)offsets[i+1]=offsets[i]+plans[i][0]*plans[i][1];
  const result=groups.slice();
  for(let i=0;i<9;i++)result[i]=offsets[groups[i]];
  return result;
}
function resolveTerrainMaterial(manager,id){
  const materials=manager?.terrainMatManager;
  if(!materials)return null;
  const direct=materials._terrainIDtoMatObject?.[id];if(direct)return direct;
  const source=manager.meshBuilder?.assignMeshData;
  let known=terrainMaterialLookups.get(manager);
  if(!known || known.source!==source){
    const method=String(source||'').match(/this\.terrainMatManager\.([\w$]+)\(/)?.[1];
    known={source,method};terrainMaterialLookups.set(manager,known);
  }
  const get=materials[known.method] || materials.Iq || materials.Kz || materials.dM || materials.NG || materials.me || materials.dE || materials.xB;
  return typeof get==='function'?get.call(materials,id):null;
}
function seedExistingLiquidGeometry(manager,noa){
  if(!state.enabled)return;
  const schema=liquidUploadSchema(manager);
  const world=getWaterWorld(noa),scene=getScene(noa);
  if(!world?.chunkAt || !scene)return;
  const meshesInScene=scene.meshes || [];
  const previous=existingLiquidScan.get(manager);
  let cursor=previous?.scene===scene?previous.cursor:0,prepared=0;
  const atlasIDs=new Set([...waterShaderState.indices.slice(0,waterShaderState.count),
    ...lavaShaderState.indices.slice(0,lavaShaderState.count)]);
  // Adoption is incremental, including the CPU buffer inspection. Large
  // loaded worlds must not copy/inspect every terrain mesh in one frame.
  for(let inspected=0;inspected<Math.min(16,meshesInScene.length) && prepared<2;inspected++){
    const mesh=meshesInScene[cursor%meshesInScene.length];cursor++;
    if(!mesh.metadata?.noa_chunk_terrain_mesh || mesh.isDisposed?.())continue;
    const materialName=mesh.material?.name || '';
    if(!materialName.startsWith('terrain-alpha-') && !waterMaterialNames.has(materialName) && !lavaMaterialNames.has(materialName)){
      const atlas=mesh.getVerticesData?.('texAtlasIndices');
      if(!atlas || !atlas.some(value=>value===0 || atlasIDs.has(value)))continue;
    }
    const matrix=mesh.computeWorldMatrix?.(false) || mesh.getWorldMatrix?.();
    const m=matrix?.m || matrix?._m || matrix;
    const origin=getRenderOrigin(noa);
    const position=mesh.position;
    const xyz=[m?.[12] ?? position?.x,m?.[13] ?? position?.y,m?.[14] ?? position?.z];
    if(!xyz.every(Number.isFinite))continue;
    const chunk=world.chunkAt(...xyz.map((value,index)=>value+(origin[index]||0)+.01));
    if(!chunk?.pos || waterMeshRecords.has(chunk))continue;
    const assign=manager.__bvfxNativeAssign || manager.assignMeshDataToChunk;
    const meshes=waterChunkMeshes({chunk,assign});
    if(!meshes?.length)continue;
    const entries=[];let complete=true;
    for(const part of meshes){
      const positions=part.getVerticesData?.('position'),normals=part.getVerticesData?.('normal');
      const colors=part.getVerticesData?.('color'),uvs=part.getVerticesData?.('uv');
      const atlas=part.getVerticesData?.('texAtlasIndices');
      const indices=part._geometry?._indices || part.geometry?._indices || part.getIndices?.();
      const count=positions?.length/3;
      if(!count || !Number.isInteger(count) || normals?.length!==count*3 || colors?.length!==count*4
          || uvs?.length!==count*2 || !indices?.length){complete=false;break;}
      const materials=manager.terrainMatManager;
      let terrainID=Object.entries(materials?._terrainIDtoMatObject || {}).find(([,material])=>material===part.material)?.[0];
      if(terrainID===undefined && part.material===materials?._defaultMat)terrainID=1;
      if(terrainID===undefined)terrainID=part.material?.name?.match(/^terrain-(?:textured|alpha)-(\d+)$/)?.[1];
      if(terrainID===undefined){complete=false;break;}
      const usesAtlas=atlas?.length===count,stride=usesAtlas?32:28;
      const vertices=new ArrayBuffer(count*stride),view=new DataView(vertices);
      for(let vertex=0;vertex<count;vertex++){
        const at=vertex*stride;
        for(let axis=0;axis<3;axis++){view.setFloat32(at+axis*4,positions[vertex*3+axis],true);
          view.setInt8(at+12+axis,Math.round(clamp(normals[vertex*3+axis],-1,1)*127));}
        for(let channel=0;channel<4;channel++)view.setUint8(at+16+channel,Math.round(clamp(colors[vertex*4+channel],0,1)*255));
        view.setFloat32(at+20,uvs[vertex*2],true);view.setFloat32(at+24,uvs[vertex*2+1],true);
        if(usesAtlas)view.setFloat32(at+28,atlas[vertex],true);
      }
      const lights=part.getVerticesData?.('aPackedLightLevels');
      const lightField=schema.light;
      if(lights?.length!==count || !lightField){complete=false;break;}
      const data={vertices,usesAtlas,indices:new Uint32Array(indices),terrainID:Number(terrainID)};
      if(part._noaFaceGroups)data.faceGroups=part._noaFaceGroups.slice();
      const labelField=schema.label || String(manager.meshBuilder?.assignMeshData || '').match(/indices:[\w$]+,([\w$]+):[\w$]+,terrainID:/)?.[1] || 'lK';
      data[labelField]=chunk[labelField];
      if(lightField && lights?.length===count)data[lightField]=new Float32Array(lights);
      const edges=part.getVerticesData?.('aQuadEdge');if(edges?.length===count*4)data.quadEdgeData=new Float32Array(edges);
      entries.push(data);
    }
    if(!complete)continue;
    const record={chunk,manager,assign,native:entries,active:false,mappings:[],nativeAssigned:true,reassigned:false};
    waterMeshRecords.set(chunk,record);queueWaterGeometry(record);prepared++;
  }
  existingLiquidScan.set(manager,{scene,cursor:meshesInScene.length?cursor%meshesInScene.length:0});
}
function adaptWorldShader(name,source){
  const edit=(from,to)=>{if(!source.includes(from))throw Error('Shader world adapter does not match '+name);source=source.replace(from,()=>to);};
  if(name==='ore-lighting.js'){
    // The current worker performs border propagation between the local BFS
    // branch and its next const. Match the branch itself, not that separator.
    edit('"clientBfs"\\}const/', '"clientBfs"\\}/');
    edit("local[0].replace('}const',", "local[0].replace('}',");
    edit('${local[4]}=true;}const`)', '${local[4]}=true;}`)');
  }
  if(name==='runtime.js'){
    edit('const coords=value[lookup[1]](x,y,z);return Boolean(value[lookup[2]][lookup[3]](...coords));',
      'return Boolean(this.chunkAt(x,y,z));');
    edit('}};break;',`},chunkAt(x,y,z){const coords=value[lookup[1]](x,y,z);return value[lookup[2]][lookup[3]](...coords);}};break;`);
  }
  if(name==='shader.js'){
    edit('  function chunkMayContainLiquid(', '  const terrainMaterialLookups=new WeakMap();\n  '+resolveTerrainMaterial.toString()+'\n\n  function chunkMayContainLiquid(');
    edit(`const materials=manager.terrainMatManager;
      const material=materials?._terrainIDtoMatObject?.[data.terrainID]
        || (materials?.Iq || materials?.Kz || materials?.dM || materials?.NG
          || materials?.me || materials?.dE || materials?.xB)?.call(materials,data.terrainID);`,
      'const material=resolveTerrainMaterial(manager,data.terrainID);');
    edit('const materials=record.manager.terrainMatManager;\n      const material=materials?._terrainIDtoMatObject?.[data.terrainID] || (materials?.Iq || materials?.Kz || materials?.dM || materials?.NG || materials?.me || materials?.dE || materials?.xB)?.call(materials,data.terrainID);',
      'const material=resolveTerrainMaterial(record.manager,data.terrainID);');
    edit('  function subdivideWaterData(', '  '+remapLiquidFaceGroups.toString()+'\n\n  function subdivideWaterData(');
    edit('  function applyWaterGeometry(record) {','  '+cacheLiquidBlockReads.toString()+'\n\n  function applyWaterGeometry(record) {');
    const start=source.indexOf('  function applyWaterGeometry(record) {');
    const prefix=source.slice(0,start);let preparation=source.slice(start);
    const worldRead='const world=getWaterWorld(noa);';
    if(!preparation.includes(worldRead))throw Error('Liquid preparation world lookup missing.');
    preparation=preparation.replace(worldRead,'const world=cacheLiquidBlockReads(getWaterWorld(noa));');
    source=prefix+preparation;
    edit('  function maintainWaterGeometry(noa) {','  const existingLiquidScan=new WeakMap(),discoveredLiquidTerrainMaterials=new WeakSet();\n  '+liquidUploadSchema.toString()+'\n  '+seedExistingLiquidGeometry.toString()+'\n\n  function maintainWaterGeometry(noa) {');
    edit('const assign=manager.assignMeshDataToChunk, light=manager.assignLightOnlyData;',
      'const assign=manager.assignMeshDataToChunk, light=manager.assignLightOnlyData;\n      Object.defineProperty(manager,\'__bvfxNativeAssign\',{value:assign,configurable:true});');
    edit('      waterMeshManagers.add(manager);\n    }', '      waterMeshManagers.add(manager);\n    }\n    seedExistingLiquidGeometry(manager,noa);');
    // The current upload starts with `var temp; const meshes=chunk.eK, ...`.
    // Do not require a declaration to be the first statement of the method.
    const from="String(record.assign).match(/\\{\\s*(?:const|let|var)\\s+[\\w$]+\\s*=\\s*[\\w$]+\\.([\\w$]+)\\s*[,;]/)?.[1]";
    edit(from,"String(record.assign).match(/\\b(?:const|let|var)\\s+[\\w$]+\\s*=\\s*[\\w$]+\\.([\\w$]+)\\s*[,;]/)?.[1]");
    edit('return record.chunk.fo ||', 'return record.chunk.eK || record.chunk.fo ||');
    edit('return {\n      read(x,y,z)', 'return {\n      chunkAt(x,y,z){return detected?.chunkAt?.(Math.floor(x),Math.floor(y),Math.floor(z));},\n      read(x,y,z)');
    // The current game enumerates position components through entities.We
    // and identifies them with ON; Dw is the local player's entity ID.
    edit('(entities?.zo || entities?.Td', '(entities?.We || entities?.zo || entities?.Td');
    edit('(component.ti ?? component.jd', '(component.ON ?? component.ti ?? component.jd');
    edit('(noa.hf ?? noa.yL', '(noa.Dw ?? noa.hf ?? noa.yL');
    // Animated atlas zero remains a candidate even before positive frame IDs
    // arrive. The world voxel ID still decides which individual face is fluid.
    edit('if(!potentialLiquid && atlasValues?.length\n          && (waterShaderState.count || lavaShaderState.count))',
      'if(!potentialLiquid && atlasValues?.length)');
    // Opaque atlas terrain can contain lava as well as stone. Enable the
    // attribute-driven liquid program for that material without tagging all
    // of its faces as a dedicated lava material.
    edit('const isLiquidMaterial = () => materialName.startsWith(\'terrain-alpha-\')',
      'const isLiquidMaterial = () => discoveredLiquidTerrainMaterials.has(material) || materialName.startsWith(\'terrain-alpha-\')');
    edit('      const discoveredName=(entries[i]?.bvfxWaterEdge',
      `      if(mesh?.material && (detectedWater[i] || detectedLava[i]) && !discoveredLiquidTerrainMaterials.has(mesh.material)) {
        discoveredLiquidTerrainMaterials.add(mesh.material);ensureExistingWaterAttributes(noa);bindWaterMaterials(noa,false);
      }
      const discoveredName=(entries[i]?.bvfxWaterEdge`);
    edit('if (!mesh || !(entries[i].bvfxWaterEdge || waterMaterialNames.has(mesh.material?.name)',
      'if (!mesh || !(discoveredLiquidTerrainMaterials.has(mesh.material) || entries[i].bvfxWaterEdge || waterMaterialNames.has(mesh.material?.name)');
    edit("const water = terrain && (name.startsWith('terrain-alpha-')",
      "const water = terrain && (discoveredLiquidTerrainMaterials.has(mesh.material) || name.startsWith('terrain-alpha-')");
    // Include lava physics in the geometry signature so its fine surface grid
    // can be rebuilt when that control changes independently of the style.
    edit("+'|'+Boolean(state.lavaStyle==='wavey');", "+'|'+Boolean(state.lavaStyle==='wavey')+'|'+Boolean(state.lavaStyle==='wavey' && state.lavaPhysics);");
    edit("if (key === 'waterStyle' || key === 'waterEnabled' || key==='lavaStyle'", "if (key === 'waterStyle' || key === 'waterPhysics' || key === 'lavaPhysics' || key === 'waterEnabled' || key==='lavaStyle'");
    // Bloxd now keeps terrain light outside the inner native lighting block.
    // Keep that scope intact and use the source's actual local name.
    edit('*,\\s*lightLevels\\.w', '*,\\s*(lightLevels|terrainLightLevels)\\.w');
    edit('.replace(skyMix, replacement);', '.replace(skyMix,(_match,lightName)=>replacement.replace(/\\blightLevels\\b/g,lightName));');
    // Metadata alone must not add all liquid samplers/noise/ripples to every
    // opaque terrain program. Real liquid faces discover mixed materials.
    edit('|| ((waterShaderState.count > 0 || lavaShaderState.count > 0) && isTerrainMaterial);',';');
    // Optional visual preparation must never hold back a native world edit.
    const deferredStart=source.indexOf('        // Keep the visible chunk intact');
    const deferredEnd=source.indexOf('        // New streamed chunks',deferredStart);
    if(deferredStart<0 || deferredEnd<0)throw Error('Liquid upload ordering mismatch.');
    source=source.slice(0,deferredStart)+source.slice(deferredEnd);
    // The current worker sends Uint16 light levels. The geometry interpolator
    // uses Float32 arrays; retain the exact field read by the native builder.
    edit('        const record={chunk,manager,assign,native:entries,active:false,mappings:[],', `        const lightField=mayContainLiquid?liquidUploadSchema(manager).light:null;
        if(mayContainLiquid && lightField)entries=entries.map(data=>data[lightField] && !(data[lightField] instanceof Float32Array)
          ? {...data,[lightField]:new Float32Array(data[lightField])}:data);
        const record={chunk,manager,assign,native:entries,active:false,mappings:[],`);
    edit('        // New streamed chunks retain the bounded background preparation path.', '        // Commit native geometry before scheduling optional visual work.');
    edit('        const previousRecord=waterMeshRecords.get(chunk);',`        if(!state.enabled){waterMeshRecords.delete(chunk);pendingWaterGeometry.delete(chunk);
          return uploadNativeWaterGeometry({chunk,manager,assign,native:entries});}`);
    edit('    const meshes=waterChunkMeshes(record);\n    for(let i=0;', '    const meshes=waterChunkMeshes(record);\n    sun?.invalidateTerrain?.(meshes);\n    for(let i=0;');
    edit('    record.nativeAssigned=true;\n    record.reassigned=geometryChanged;', '    if(mustAssign)sun?.invalidateTerrain?.(waterChunkMeshes(record));\n    record.nativeAssigned=true;\n    record.reassigned=geometryChanged;');
    edit('  function applyWaterGeometry(record) {',`  function applyWaterGeometry(record) {
    if(!state.enabled){
      if(record.pendingUpload || record.reassigned)uploadNativeWaterGeometry(record);
      waterMeshRecords.delete(record.chunk);pendingWaterGeometry.delete(record.chunk);
      return;
    }`);
    edit("+'|'+Boolean(state.waterStyle==='wavey')", "+'|'+Boolean(state.enabled)+'|'+Boolean(state.waterStyle==='wavey')");
  }
  return source;
}
module.exports={adaptWorldShader,liquidUploadSchema,remapLiquidFaceGroups};
