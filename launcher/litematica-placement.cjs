'use strict';
const {readBlockModel,modelCache}=require('./litematica-models.cjs');
const {workerSource,createCompressedDecoder}=require('./litematica-draco.cjs');
function orientName(name,options,registry){
 const steps=(options.rotation||0)/90;if(!steps&&!options.mirror)return name;
 const meta=registry?.[name],description=name.includes('|meta|')?name:meta?.rootMetaDesc;if(!description)return name;
 const match=description.match(/\|rot([1-4])(?=\||$)/);if(!match)return name;let rot=Number(match[1])-1;
 if(options.mirror){rot=(4-rot)%4;if(meta?.model==='door'&&meta.meta?.open)rot=(rot+2)%4;}rot=(rot-steps+4)%4;
 let next=description.replace(/\|rot[1-4](?=\||$)/,'|rot'+(rot+1));
 if(options.mirror)next=next.replace(/(inner|outer)(Left|Right)/,(_,a,b)=>a+(b==='Left'?'Right':'Left'));
 const root=next.split('|')[0];return registry?.[root]?.rootMetaDesc===next?root:registry?.[next]?next:name;
}
// Applied after the catalog SHA check. All runtime work belongs to the user's
// enabled mod; build/test tooling only evaluates this in inert CPU fixtures.
function blockShape(meta){
 if(!meta)return null;
 const state=meta.meta||{},model=String(meta.model||''),rot=state.rot||1,half=state.halfblockPlacement;
 // Native subvoxel boxes already contain the exact registered orientation.
 // Use these for all non-model shapes, including custom server definitions.
 const raw=meta.subvoxelShape||meta.hS;
 if(!meta.blockModel&&Array.isArray(raw)&&raw.length&&raw.length<=384&&raw.length%6===0&&raw.every(n=>Number.isFinite(n)&&n>=0&&n<=1)){
  if(raw.length===6&&raw.every((v,i)=>v===(i<3?0:1)))return null;
  return {boxes:Array.from({length:raw.length/6},(_,i)=>raw.slice(i*6,i*6+6))};
 }
 const turn=(boxes,n)=>boxes.map(box=>{let b=box.slice();for(let i=0;i<(n+4)%4;i++)b=[b[2],b[1],1-b[3],b[5],b[4],1-b[0]];return b;});
 if(model.includes('Stairs')||meta.type==='StairsBlock'){
  const bottom=[0,0,0,1,.5,1],back=[0,.5,0,1,1,.5],corner=state.stairsCorner;
  let boxes=corner?.startsWith('outer')?[bottom,corner==='outerLeft'?[.5,.5,0,1,1,.5]:[0,.5,0,.5,1,.5]]:[bottom,back];
  if(corner?.startsWith('inner'))boxes.push(corner==='innerLeft'?[.5,.5,.5,1,1,1]:[0,.5,.5,.5,1,1]);
  if(half==='top')boxes=boxes.map(b=>[b[0],1-b[4],b[2],b[3],1-b[1],b[5]]);
  return {boxes:turn(boxes,rot-1)};
 }
 if(model.includes('Slab')||meta.type==='SlabBlock')return {boxes:half==='side'?turn([[0,0,0,1,1,.5]],rot-1):[[0,half==='top'?.5:0,0,1,half==='top'?1:.5,1]]};
 if(model==='door')return {boxes:turn([[0,0,7/8,1,1,1]],rot-1+Number(!!state.open))};
 if(model==='trapdoor')return {boxes:state.open?turn([[0,0,7/8,1,1,1]],(rot+1)%4):[[0,7/8,0,1,1,1]]};
 if(meta.blockModel)return {model:meta.blockModel,scale:(meta.modelScale??1)/8,info:meta.customModelInfo||{},rot,modelKind:model,offset:meta.rotatableOffsetAmt};
 if(model.includes('CentreCross')||model.includes('CustomPlanes'))return {planes:meta.customPlanesInfo||[{yRot:Math.PI/4},{yRot:3*Math.PI/4}],rot};
 if(model&&!model.toLowerCase().includes('cube')&&!meta.textureInfo)return {unsupported:true};
 return null;
}
function* shapeFaces(blocks,material,geometry,resolve){
 const cubes=[],out=[];let work=0;
 for(const block of blocks){
  if(block.status==='correct'||block.status==='air'||block.expectedAir&&block.status!=='extra')continue;
  const name=block.status==='wrong'||block.status==='extra'?block.actualName:block.name,shape=resolve(name);
  if(!shape){cubes.push(block);continue;}
  if(shape.pending||shape.unsupported){if(++work%64===0)yield;continue;}
  const placement=block.status!=='wrong'&&block.status!=='extra',mirrored=placement&&block.shapeMirror,point=p=>{let[x,y,z]=p;if(mirrored)x=1-x;for(let n=0;n<(placement?block.shapeRotation||0:0)/90;n++)[x,z]=[1-z,x];return [x,y,z];};
  if(shape.triangles)for(const triangle of shape.triangles){const look=material(block,triangle.side??2,triangle.spec);if(!look)continue;const p=triangle.points.map(point),uv=triangle.uv.slice();if(mirrored){[p[1],p[2]]=[p[2],p[1]];[uv[1],uv[2]]=[uv[2],uv[1]];}out.push({block,side:triangle.side??2,material:look,face:{corners:[p[0],p[1],p[2],p[2]]},triangleUV:uv});if(++work%64===0)yield;}
  else if(shape.planes)for(const plane of shape.planes){const angle=(plane.yRot||0)+(shape.rot-1)*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),corners=[[-.5,0,0],[.5,0,0],[.5,1,0],[-.5,1,0]].map(([x,y,z])=>point([.5+x*c+z*s,y,.5-x*s+z*c])),look=material(block,plane.textureIdx??0);if(look)out.push({block,side:0,material:look,face:{corners}},{block,side:1,material:look,face:{corners:corners.slice().reverse()}});}
  else for(const box of shape.boxes||[])for(let side=0;side<6;side++){
   const axis=side<2?0:side<4?1:2,plane=box[axis+(side%2===0?3:0)],other=[0,1,2].filter(n=>n!==axis),a=other[0],b=other[1];
   // Split the union at box boundaries, omitting internal coplanar faces.
   const cuts=n=>[...new Set([box[n],box[n+3],...shape.boxes.flatMap(q=>[q[n],q[n+3]]).filter(v=>v>box[n]&&v<box[n+3])])].sort((x,y)=>x-y),u=cuts(a),v=cuts(b);
   for(let i=0;i<u.length-1;i++)for(let j=0;j<v.length-1;j++){
    const probe=[0,0,0];probe[axis]=plane+(side%2===0?1:-1)*1e-7;probe[a]=(u[i]+u[i+1])/2;probe[b]=(v[j]+v[j+1])/2;
    if(shape.boxes.some(q=>probe.every((n,k)=>n>q[k]&&n<q[k+3])))continue;
    const lo=box.slice(0,3),hi=box.slice(3);lo[a]=u[i];hi[a]=u[i+1];lo[b]=v[j];hi[b]=v[j+1];lo[axis]=hi[axis]=plane;
    const face=geometry.faces[side],corners=face.corners.map(p=>point(p.map((n,k)=>n?hi[k]:lo[k]))),look=material(block,side);if(mirrored)corners.reverse();if(look)out.push({block,side,material:look,face:{normal:face.normal,corners}});
   }
  }
  if(++work%32===0)yield;
 }
 const merged=yield*geometry.greedySteps(cubes,material);return merged.concat(out);
}
function adaptLitematicaPlacement(name,source){
 const edit=(from,to)=>{if(!source.includes(from))throw Error('Litematica placement adapter mismatch: '+name+' / '+from.slice(0,90));source=source.replace(from,()=>to);};
 if(name==='adapter.js'){
  edit('  function connect() {', '  const shapeOf='+blockShape.toString()+',readModel='+readBlockModel.toString()+',makeModelCache='+modelCache.toString()+',makeDecoder='+createCompressedDecoder.toString()+',decoderSource='+JSON.stringify(workerSource())+';\n  function connect() {');
  // Discovery may refresh an incomplete layout. Its wrapper identity is not a
  // world replacement and must never reset all mesh/status/texture caches.
  edit('if (cached?.noa === noa && cached.layout === layout) return cached;', 'if(cached?.noa===noa&&cached.scene===scene&&cached.layout?.world?.owner===layout.world?.owner&&cached.layout?.world?.method===layout.world?.method&&cached.layout?.registry===layout.registry)return cached;');
  edit('const expected = new Map(),textureSpecs=new Map(),actualNames=new Map();', 'const expected = new Map(),textureSpecs=new Map(),actualNames=new Map(),shapeSpecs=new Map();let models=null,decoder=null;');
  edit('      texture(name, side) {', `      shape(name){if(shapeSpecs.has(name))return shapeSpecs.get(name);const meta=layout.registry?.metadatas?.[name]||captured?.singletons?.blocksClient?.[name],shape=shapeOf(meta);if(shape?.model)return this.modelShape(name,shape);if(meta)shapeSpecs.set(name,shape);return shape;},
      modelShape(name,shape){models??=makeModelCache(()=>texturePack,readModel,(bytes,attributes)=>{decoder??=makeDecoder(decoderSource);return decoder.decode(bytes,attributes);});return models.get(name,shape);},
      texture(name, side) {`);
  edit("name=typeof raw==='string'?raw.split('|')[0]:null", "name=typeof raw==='string'?raw:null");
  // Native colour vectors use [0,1], while some custom packs use byte RGB.
  edit('const spec={color:info}', 'const spec={color:info.slice(0,3).map(n=>info.slice(0,3).every(v=>v<=1)?n*255:n),alpha:info[3]??1}');
  edit('color:info?.colour||[255,255,255]', 'color:info?.colour?info.colour.slice(0,3).map(n=>info.colour.slice(0,3).every(v=>v<=1)?n*255:n):[255,255,255]');
  edit('if(spec)textureSpecs.set(key,spec);', 'if(spec){spec.alpha=info?.colour?.[3]??1;textureSpecs.set(key,spec);}');
  edit('foregroundDispose(){', 'foregroundDispose(){models?.dispose();models=null;decoder?.dispose();decoder=null;');
  edit('= { inGame:', `= { orient:(name,options)=>(${orientName.toString()})(name,options,cached?.layout?.registry?.metadatas), fullCube:name=>{const meta=cached?.layout?.registry?.metadatas?.[name]||captured?.singletons?.blocksClient?.[name];return Boolean(meta&&!meta.transTex&&!meta.nS&&meta.solid!==false&&!shapeOf(meta));}, inGame:`);
 }
 if(name==='litematica.js'){
  edit("rawName.split('|')[0]", 'rawName');edit("raw.split('|')[0]", 'raw');
  source=source.replaceAll('known.has(', 'knownBlock(');
  edit("  const known = new Set(globalThis.BLOXD_BLOCK_NAMES),", "  const knownBlock=name=>typeof name==='string'&&(known.has(name)||Boolean(adapter.resolveItemName(adapter.connect()?.expected?.(name))===name));\n  const known = new Set(globalThis.BLOXD_BLOCK_NAMES),");
  // Preserve exact variant names from native files, including hidden parts.
  edit("knownBlock(name)?name:''", "(knownBlock(name)||name===model.nativeMapping?.[source])?name:''");
  edit("const name=savedMapping?.[source]||", "const legacyBase=liveName?.split('|')[0],migrated=liveName?.includes('|')&&savedMapping?.[source]===legacyBase&&model.nativeMapping?.[source]===legacyBase?liveName:null;const name=migrated||savedMapping?.[source]||");
  edit("status:'unknown' }));", "status:'unknown',shapeRotation:state.rotation,shapeMirror:state.mirror }));");
  edit('for(const block of blocks)if(!block.expectedAir', 'for(const block of blocks)block.expectedName=adapter.orient?.(block.name,options())||block.name;for(const block of blocks)if(!block.expectedAir');
  // Choosing a corner only needs the new ray target. Reading the whole area
  // is separate: a remote old endpoint must never masquerade as a failed pick.
  edit('function scheduleArea(delay=350){', 'function scheduleArea(delay=350,picked=null){');
  edit("areaStatus=state.aSet&&state.bSet?'Preparing selection…':'Set both corners with a Stick or enter their coordinates.';", `const confirmation=picked?'Corner '+(picked.corner==='a'?'1':'2')+' set to '+picked.position.join(', ')+'. ':'';
    areaStatus=confirmation+(state.aSet&&state.bSet?'Preparing selection…':picked?'Set the other corner with a Stick or enter its coordinates.':'Set both corners with a Stick or enter their coordinates.');
    if(state.aSet&&state.bSet){const connection=adapter.connect(),a=['ax','ay','az'].map(n=>state[n]),b=['bx','by','bz'].map(n=>state[n]);let loaded=false;try{loaded=Boolean(connection?.read(...a)?.loaded&&connection.read(...b)?.loaded);}catch{}
      if(!loaded){areaStatus=confirmation+'Corners remain editable. Load the selected area to list or export its blocks.';sync();return;}}`);
  edit("state[corner+'Set']=true;persist();scheduleArea();", "state[corner+'Set']=true;persist();scheduleArea(350,{corner,position});");
  edit("areaStatus=error.name==='AbortError'?'World changed. Refresh the block list.':'Selection: '+error.message;", "areaStatus=error.name==='AbortError'?'World changed. Refresh the block list.':!download&&error.message.startsWith('World is not loaded at ')?'Corners remain editable. Load the selected area to list or export its blocks.':'Selection: '+error.message;");
 }
 if(name==='placement.js'){
  // A slab/model never hides its neighbour's whole face. Also retain shaped
  // cells surrounded by solids; their exposed partial surfaces remain visible.
  edit('function idAt(x,y,z)', 'const opaqueIds=new Map();function opaque(id){if(!id)return false;if(opaqueIds.has(id))return opaqueIds.get(id);const name=model.nativeMapping?.[\'bloxd:\'+id]||globalThis.BLOXD_BLOCK_IDS?.[id],full=globalThis.__BLM_ADAPTER__?.fullCube?globalThis.__BLM_ADAPTER__.fullCube(name):true;opaqueIds.set(id,full);return full;}\n    function idAt(x,y,z)');
  for(const expr of ['ix<31?values[i+1024]:idAt(x+1,y,z)','ix>0?values[i-1024]:idAt(x-1,y,z)','iy<31?values[i+32]:idAt(x,y+1,z)','iy>0?values[i-32]:idAt(x,y-1,z)','iz<31?values[i+1]:idAt(x,y,z+1)','iz>0?values[i-1]:idAt(x,y,z-1)'])edit('!('+expr+')','!opaque('+expr+')');
  edit('let mask=entry.masks[j];', 'let mask=opaque(id)?entry.masks[j]:63;');
  edit('row.sourceKey=key;', 'row.expectedName=globalThis.__BLM_ADAPTER__?.orient?.(name,{rotation:optionsRotation,mirror:optionsMirror})||name;row.shapeRotation=optionsRotation;row.shapeMirror=optionsMirror;row.sourceKey=key;');
  edit('let requestedKey=', 'let optionsRotation=0,optionsMirror=false;let requestedKey=');
  edit('const location=coordinates(model,options),local=', 'optionsRotation=options.rotation||0;optionsMirror=!!options.mirror;const location=coordinates(model,options),local=');
  edit('const name=mapping[source];if(!name||name===', 'const originalName=mapping[source],name=globalThis.__BLM_ADAPTER__?.orient?.(originalName,options)||originalName;if(!name||name===');
 }
 if(name==='place.js'){
  edit('const id=resolveId(name);', 'const oriented=root.__BLM_ADAPTER__?.orient?.(name,options)||name,id=resolveId(oriented);');
  edit('model.nativeMapping?.[source]===name&&Number.isInteger(native)', 'oriented===name&&model.nativeMapping?.[source]===name&&Number.isInteger(native)');
 }
 if(name==='renderer.js'){
  edit('connection.expected(block.name)', 'connection.expected(block.expectedName||block.name)');
  edit("status==='wrong'&&actualName===block.name", "status==='wrong'&&actualName===(block.expectedName||block.name)");
  edit('const rects=geometry.greedySteps?', 'const rects=connection.shape?yield*('+shapeFaces.toString()+')(eligible,material,geometry,name=>{const shape=connection.shape(name);if(shape?.pending||shape?.unsupported)group.waiting=true;return shape;}):geometry.greedySteps?');
  edit('function material(block,side){', 'function material(block,side,override=null){');
  edit('const materials=new Map(),surface=', 'const overrides=new Map(),materials=new Map(),surface=');
  edit("const cacheKey=kind+'|'+look.name+'|'+side;", "if(override&&!overrides.has(override))overrides.set(override,overrides.size+1);const cacheKey=kind+'|'+look.name+'|'+side+'|'+(overrides.get(override)||0);");
  edit("kind==='placement'?connection.texture(look.name,side):null", "kind==='placement'?(override||connection.texture(look.name,side)):null");
  edit('solidColor:Boolean(spec?.color&&!spec?.url)', 'alpha:spec?.alpha??1,solidColor:Boolean(spec?.color&&!spec?.url)');
  edit('JSON.stringify([kind,tex?.id,tint,look.color])', 'JSON.stringify([kind,tex?.id,tint,look.color,spec?.alpha??1])');
  edit('actualName:b.actualName}', 'actualName:b.actualName,shapeRotation:b.shapeRotation,shapeMirror:b.shapeMirror}');
  edit('const vertices=entry.uvScale?', 'const vertices=entry.triangleUV?entry.face.corners.slice(0,3).flatMap((p,i)=>[entry.block.x+p[0]-group.anchor[0],entry.block.y+p[1]-group.anchor[1],entry.block.z+p[2]-group.anchor[2],...entry.triangleUV[i],0,0,0,0]):entry.uvScale?');
  edit('const look=entry.material;if(!look)continue;', 'const look=entry.material;if(!look)continue;for(const p of entry.face.corners)for(let axis=0;axis<3;axis++){const n=entry.block[[\'x\',\'y\',\'z\'][axis]]+p[axis];group.bounds[axis]=Math.min(group.bounds[axis],n);group.bounds[axis+3]=Math.max(group.bounds[axis+3],n);}');
  // Do not publish partial reindex counts as if the entire placement changed.
  edit('if(now-lastCheck>=250)', 'if(now-lastCheck>=250&&seenLength===blocks.length)');
 }
 return source;
}
module.exports={adaptLitematicaPlacement,blockShape,shapeFaces,orientName};
