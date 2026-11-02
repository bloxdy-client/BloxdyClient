'use strict';
// Owned depth images retain their projection. Chunk edits repair only the
// affected light-space rectangle, including every overlapping occluder.
function createChunkShadowCache(){
  const maps=new Map(),stats={fullPasses:0,partialPasses:0,retainedPasses:0,clearedPixels:0,savedPixels:0};
  const same=(a,b)=>a===b || a?.length===b?.length && a!=null && b!=null && a.every((v,i)=>v===b[i]);
  const overlaps=(a,b)=>a && b && a[0]<b[2] && a[2]>b[0] && a[1]<b[3] && a[3]>b[1];
  const equivalent=(a,b)=>a.revision===b.revision && a.geometry===b.geometry && a.indices===b.indices
    && a.material===b.material && same(a.textures,b.textures) && same(a.world,b.world) && same(a.rect,b.rect);
  return {
    clear(){maps.clear();},has:key=>maps.has(key),
    plan(key,projection,size,casters,force=false){
      const previous=maps.get(key),snapshot=new Map(casters.map(c=>[c.mesh,c]));
      let full=force || !previous || previous.size!==size || !same(previous.projection,projection) || casters.some(c=>c.unsafe);
      let rect=null;
      const include=r=>{if(!r)return;rect=rect?[Math.min(rect[0],r[0]),Math.min(rect[1],r[1]),Math.max(rect[2],r[2]),Math.max(rect[3],r[3])]:r.slice();};
      if(!full){
        for(const [mesh,caster]of snapshot){const old=previous.snapshot.get(mesh);if(!old || !equivalent(old,caster)){include(old?.rect);include(caster.rect);}}
        for(const [mesh,old]of previous.snapshot)if(!snapshot.has(mesh))include(old.rect);
        if(rect && (rect[2]-rect[0])*(rect[3]-rect[1])>size*size*.65)full=true;
      }
      const region=full?[0,0,size,size]:rect;
      return {key,projection:Array.from(projection),size,snapshot,full,region,
        items:full?casters:region?casters.filter(c=>overlaps(c.rect,region)):[]};
    },
    commit(plan){
      maps.set(plan.key,plan);
      const pixels=plan.region?(plan.region[2]-plan.region[0])*(plan.region[3]-plan.region[1]):0;
      stats[plan.full?'fullPasses':plan.region?'partialPasses':'retainedPasses']++;
      stats.clearedPixels+=pixels;stats.savedPixels+=plan.size*plan.size-pixels;
    },diagnostics:()=>({...stats,residentMaps:maps.size})
  };
}
function projectShadowBounds(bounds,world,projection,size){
  if(bounds?.length!==6 || !bounds.every(Number.isFinite) || world?.length!==16 || !world.every(Number.isFinite))return undefined;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let corner=0;corner<8;corner++){
    const x=bounds[corner&1?3:0],y=bounds[corner&2?4:1],z=bounds[corner&4?5:2];
    const wx=world[0]*x+world[4]*y+world[8]*z+world[12],wy=world[1]*x+world[5]*y+world[9]*z+world[13],wz=world[2]*x+world[6]*y+world[10]*z+world[14];
    const px=(projection[0]*wx+projection[4]*wy+projection[8]*wz+projection[12])*.5+.5;
    const py=(projection[1]*wx+projection[5]*wy+projection[9]*wz+projection[13])*.5+.5;
    minX=Math.min(minX,px*size);minY=Math.min(minY,py*size);maxX=Math.max(maxX,px*size);maxY=Math.max(maxY,py*size);
  }
  if(maxX<0 || maxY<0 || minX>size || minY>size)return null;
  // Include the comparison-filter footprint and rasterization boundary.
  return [Math.max(0,Math.floor(minX)-4),Math.max(0,Math.floor(minY)-4),Math.min(size,Math.ceil(maxX)+4),Math.min(size,Math.ceil(maxY)+4)];
}
function scheduleShadowCascades(resources,now,interval,due,changed){
  if(changed || !resources)return due;
  // Coalesce uploads until the authored refresh interval. Serve the oldest
  // eligible map first, so a busy close cascade cannot starve outer maps.
  const eligible=['detail','local','far'].filter(kind=>due[kind]
    && (!resources[kind+'Ready'] || now-resources['last'+kind[0].toUpperCase()+kind.slice(1)+'Frame']>=interval));
  const age=kind=>resources['last'+kind[0].toUpperCase()+kind.slice(1)+'Frame'] ?? -Infinity;
  eligible.sort((a,b)=>age(a)<age(b)?-1:age(a)>age(b)?1:0);
  return {far:eligible[0]==='far',local:eligible[0]==='local',detail:eligible[0]==='detail'};
}
function renderChunkPass(passMatrix,fbo,size,coverageRadius,items,clearDepth=true){
  const kind=fbo===resources.fbo?'far':fbo===resources.localFbo?'local':fbo===resources.detailFbo?'detail':null;
  if(!kind || !clearDepth)return renderFullPass(passMatrix,fbo,size,coverageRadius,items,clearDepth);
  const shifted=kind==='far'?cameraShift:kind==='local'?localCameraShift:detailCameraShift;
  const rendered=kind==='far'?farRenderedMatrix:kind==='local'?localRenderedMatrix:detailRenderedMatrix;
  const valid=resources[kind==='far'?'farReady':kind+'Ready'];
  const retain=valid && chunkRegions.has(kind) && !changed && !shifted
    && !orbitDue(kind,kind==='far'?500:kind==='local'?250:125);
  if(retain)passMatrix.set(rendered);
  const casters=[];
  let pending=false;
  for(const entry of items){
    const mesh=entry.mesh;
    if(mesh.isDisposed?.())continue;
    if(casterRejection(mesh,false))continue;
    if(!mesh.metadata?.noa_chunk_terrain_mesh){
      casters.push({mesh,unsafe:true,entry});continue;
    }
    const frame=terrainFrame(mesh),sphere=frame.bounds;
    if(sphere?.centerWorld && Number.isFinite(sphere.radiusWorld)){
      const p=sphere.centerWorld,r=sphere.radiusWorld;
      const x=passMatrix[0]*p.x+passMatrix[4]*p.y+passMatrix[8]*p.z+passMatrix[12];
      const y=passMatrix[1]*p.x+passMatrix[5]*p.y+passMatrix[9]*p.z+passMatrix[13];
      if(Math.abs(x)>1+r/coverageRadius || Math.abs(y)>1+r/coverageRadius){casters.push({mesh,entry,rect:null});continue;}
    }
    const data=terrainGeometry(gl,mesh,frame);
    if(!data?.bounds?.every(Number.isFinite) || !frame.wm || frame.mask===false){pending=true;break;}
    const rect=projectShadowBounds(data.bounds,frame.wm,passMatrix,size);
    if(rect===undefined){pending=true;break;}
    casters.push({mesh,entry,rect,world:Array.from(frame.wm),revision:terrainRevisions.get(mesh.sourceMesh || mesh)||0,
      geometry:data.positions,indices:data.indexSource,material:mesh.material,
      textures:frame.mask?.layers?.map(layer=>layer.texture) || []});
  }
  if(pending){chunkRegions.clear();return renderFullPass(passMatrix,fbo,size,coverageRadius,items,clearDepth);}
  const plan=chunkRegions.plan(kind,passMatrix,size,casters,!retain);
  if(plan.full){
    const result=renderFullPass(passMatrix,fbo,size,coverageRadius,items,clearDepth);
    if(result.updated && !result.pending)chunkRegions.commit(plan);
    else if(!items.length)chunkRegions.clear();
    return result;
  }
  const result={count:resources[kind==='far'?'farCount':kind+'Count']||0,drawCalls:0,input:items.length,rejected:{},updated:true,pending:false,retainedProjection:true};
  if(plan.region){
    const [x,y,right,top]=plan.region;
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,size,size);
    gl.enable(gl.SCISSOR_TEST);gl.scissor(x,y,right-x,top-y);
    try{
      gl.clear(gl.DEPTH_BUFFER_BIT);
      Object.assign(result,renderFullPass(passMatrix,fbo,size,coverageRadius,plan.items.map(c=>c.entry),false),{updated:true,retainedProjection:true});
    }finally{gl.disable(gl.SCISSOR_TEST);}
  }
  if(!result.pending)chunkRegions.commit(plan);else chunkRegions.clear();
  return result;
}
function adaptChunkShadows(name,source){
  if(name!=='sun-shadows.js')return source;
  const edit=(from,to)=>{if(!source.includes(from))throw Error('Chunk shadow adapter mismatch: '+from.slice(0,70));source=source.replace(from,()=>to);};
  edit('    const cache = new Map(),',`    const chunkRegions=(${createChunkShadowCache.toString()})();\n    ${projectShadowBounds.toString()}\n    ${scheduleShadowCascades.toString()}\n    const cache = new Map(),`);
  edit('const mutable=Boolean(positionBuffer?.isUpdatable?.());',`const trackedChunk=source.metadata?.noa_chunk_terrain_mesh && terrainRevisions.has(source);
      const mutable=Boolean(positionBuffer?.isUpdatable?.()) && !trackedChunk;`);
  edit("const mutable=mesh.getVertexBuffer?.('position')?.isUpdatable?.();", "const mutable=!terrainRevisions.has(mesh.sourceMesh || mesh) && mesh.getVertexBuffer?.('position')?.isUpdatable?.();");
  edit('      ready = false;', '      chunkRegions.clear();\n      ready = false;');
  edit('          shadowFrame++;', '          chunkRegions.clear();shadowFrame++;');
  edit('const renderPass=(passMatrix,fbo,size,coverageRadius,items,clearDepth=true)=>{','const renderFullPass=(passMatrix,fbo,size,coverageRadius,items,clearDepth=true)=>{');
  edit('        if(farDue) {',`        const renderPass=${renderChunkPass.toString()};\n        if(farDue) {`);
  source=source.replaceAll('if(camera)resources.farCamera=', 'if(camera && !stats.retainedProjection)resources.farCamera=')
    .replaceAll('if(camera)resources.localCamera=', 'if(camera && !stats.retainedProjection)resources.localCamera=')
    .replaceAll('if(camera)resources.detailCamera=', 'if(camera && !stats.retainedProjection)resources.detailCamera=');
  const schedulingStart=source.indexOf('      if((staticChanged || cycle) && !changed) {');
  const schedulingEnd=source.indexOf('      // Keep the own first-person shadow',schedulingStart);
  if(schedulingStart<0 || schedulingEnd<0)throw Error('Shadow cascade scheduling mismatch.');
  source=source.slice(0,schedulingStart)+`      const scheduled=scheduleShadowCascades(resources,now,q.interval,
        {far:farDue,local:localDue,detail:detailDue},changed);
      farDue=scheduled.far;localDue=scheduled.local;detailDue=scheduled.detail;
`+source.slice(schedulingEnd);
  for(const kind of ['far','local','detail'])source=source.replaceAll(
    'resources.'+kind+'CycleDirection=cycleDirection?Array.from(cycleDirection):null;',
    'if(!stats.retainedProjection)resources.'+kind+'CycleDirection=cycleDirection?Array.from(cycleDirection):null;');
  // With one cadence for both sets this second image/blit does no reuse.
  edit("const staged=Boolean(localBody.parts.length && resources.nearSize<=2048\n              && typeof gl.blitFramebuffer==='function');",'const staged=false;');
  edit('mask: gl.getParameter(gl.COLOR_WRITEMASK),', 'scissorBox:gl.getParameter(gl.SCISSOR_BOX),mask: gl.getParameter(gl.COLOR_WRITEMASK),');
  edit('      gl.viewport(...saved.viewport);', '      if(saved.scissorBox)gl.scissor(...saved.scissorBox);\n      gl.viewport(...saved.viewport);');
  edit('      invalidateSettings(){', '      get chunkCacheDiagnostics(){return chunkRegions.diagnostics();},\n      invalidateSettings(){');
  edit('const nativeContext=scene?.getEngine?.()?._gl;', 'const nativeContext=scene?._engine?._gl || scene?.getEngine?.()?._gl;');
  return source;
}
module.exports={createChunkShadowCache,projectShadowBounds,adaptChunkShadows};
