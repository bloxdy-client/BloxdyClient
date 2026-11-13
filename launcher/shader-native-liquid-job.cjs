'use strict';
// Runs in one owned background worker, using the existing subdivision and
// underwater kernels. A snapshot contains only observed block categories.
function prepareNativeLiquidJob(job){
 if(job.type==='light')return {light:nativeLiquidLight(job.original,job.records,job.values)};
 if(job.type==='probe'){
  if(job.options.underwater||job.liquidHint)return {needsSnapshot:true};
  if(job.texture!=='atlas')return {needsSnapshot:true};
  if(!job.atlasIndices?.length)return {defer:true};
  const p=job.original.packedVertices;if(!p)return {skip:true};const view=ArrayBuffer.isView(p)?new DataView(p.buffer,p.byteOffset,p.byteLength):new DataView(p),ids=new Set(job.atlasIndices);
  for(let i=4;i<view.byteLength;i+=12)if(ids.has(view.getUint32(i,true)&65535))return {needsSnapshot:true};return {skip:true};
 }
 const original=job.original,data=decodeNativeTerrain(original,job.texture),origin=job.origin,snapshot=job.snapshot,options=job.options;
 const read=(x,y,z)=>{x=Math.floor(x)-snapshot.min[0];y=Math.floor(y)-snapshot.min[1];z=Math.floor(z)-snapshot.min[2];if(x<0||y<0||z<0||x>=snapshot.size[0]||y>=snapshot.size[1]||z>=snapshot.size[2])return null;const value=snapshot.cells[(x*snapshot.size[1]+y)*snapshot.size[2]+z];return value===255?null:value;};
 const world={read,loaded:(x,y,z)=>read(x,y,z)!==null,isWater:id=>id===1,isLava:id=>id===2,isLiquid:id=>id===1||id===2};
 const faces=data.positions.length/12,kinds=new Uint8Array(faces);let liquid=false;
 for(let f=0;f<faces;f++){let x=0,y=0,z=0,nx=0,ny=0,nz=0;for(let s=0;s<4;s++){const at=f*12+s*3;x+=data.positions[at];y+=data.positions[at+1];z+=data.positions[at+2];nx+=data.normals[at];ny+=data.normals[at+1];nz+=data.normals[at+2];}
  const length=Math.hypot(nx,ny,nz)||1,id=read(origin[0]+x*.25-nx/length*.06,origin[1]+y*.25-ny/length*.06,origin[2]+z*.25-nz/length*.06);kinds[f]=id===1?1:id===2?2:id===null?0:3;liquid||=kinds[f]===1||kinds[f]===2;
 }
 const active=f=>kinds[f]===1&&options.waterWave||kinds[f]===2&&options.lavaWave;
 const surface=(x,y,z)=>{const wx=x+origin[0],wy=y+origin[1],wz=z+origin[2];return world.loaded(wx,wy-.01,wz)&&world.isLiquid(read(wx,wy-.01,wz))&&read(wx,wy+.01,wz)===0;};
 let built=liquid?subdivideWaterData(data,active,surface,options.spacing):null;
 if(!built){const mapping=new Float32Array(data.positions.length/3*4);
  for(let f=0;f<faces;f++){const base=f*4,at=f*12,distance=s=>Math.hypot(...[0,1,2].map(c=>data.positions[at+s*3+c]-data.positions[at+c])),opp=[1,2,3].reduce((best,s)=>distance(s)>distance(best)?s:best,1),side=[1,2,3].find(s=>s!==opp),other=6-side-opp;
   for(let s=0;s<4;s++)mapping.set([base,s===side||s===opp?1:0,s===other||s===opp?1:0,side*4+opp],(base+s)*4);
  }built={data,mapping};
 }
 const wet=options.underwater?buildUnderwaterAttribute(built.data,origin,world):null;
 if(!liquid&&!wet?.some(v=>v!==0))return {skip:true};
 const result=compactNativeLiquids(original,built,kinds,wet,job.texture);
 return {...result,kinds};
}
module.exports={prepareNativeLiquidJob};
