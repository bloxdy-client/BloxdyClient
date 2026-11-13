'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createChunkShadowCache,projectShadowBounds}=require('../shader-chunk-cache.cjs');

test('Retained maps refresh known animated foliage without invalidating non-leaf casters',()=>{
 const cache=createChunkShadowCache(),data={},projection=new Float32Array(16),mesh={};
 let revision='wind:0';const read=value=>value===data?revision:0;
 const caster={mesh,rect:[1,1,4,4],revision,animationData:data,animationValue:revision};
 cache.commit(cache.plan('far',projection,64,[caster]));
 assert.equal(cache.needsAnimation('far',read),false);revision='wind:1';assert.equal(cache.needsAnimation('far',read),true);
 const changed={...caster,revision,animationValue:revision};const plan=cache.plan('far',projection,64,[changed]);
 assert.equal(plan.full,false);assert.deepEqual(plan.region,[1,1,4,4]);cache.commit(plan);
 assert.equal(cache.needsAnimation('far',read),false);assert.equal(cache.needsAnimation('missing',read),false);
});
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const caster=(rect,depth=.5)=>({mesh:{},rect,depth,revision:1,geometry:{},indices:{},material:{},textures:[]});
function paint(image,size,plan){
  if(!plan.region)return;
  const [x,y,right,top]=plan.region;
  for(let py=y;py<top;py++)for(let px=x;px<right;px++)image[py*size+px]=1;
  for(const c of plan.items){if(!c.rect)continue;
    for(let py=Math.max(y,c.rect[1]);py<Math.min(top,c.rect[3]);py++)
      for(let px=Math.max(x,c.rect[0]);px<Math.min(right,c.rect[2]);px++)image[py*size+px]=Math.min(image[py*size+px],c.depth);
  }
}
test('Dirty chunk repairs match a complete depth rebuild, including overlapping casters and removals',()=>{
  const size=128,cache=createChunkShadowCache(),matrix=identity(),background=caster([0,0,size,size],.8);
  let casters=[background];for(let y=4;y<120;y+=8)for(let x=4;x<120;x+=8)casters.push(caster([x,y,x+3,y+3],.3));
  const incremental=new Float32Array(size*size),full=new Float32Array(size*size);
  let plan=cache.plan('far',matrix,size,casters);paint(incremental,size,plan);cache.commit(plan);
  const old=casters[100];casters=casters.map(c=>c===old?{...c,rect:[...c.rect.slice(0,2),c.rect[2]+2,c.rect[3]+1],revision:2,depth:.9}:c);
  plan=cache.plan('far',matrix,size,casters);assert.equal(plan.full,false);assert.equal(plan.items.length,2);
  paint(incremental,size,plan);cache.commit(plan);
  const rebuild=createChunkShadowCache().plan('far',matrix,size,casters);paint(full,size,rebuild);
  assert.deepEqual(incremental,full,'raising the edited surface must reveal the other occluder');
  casters=casters.filter(c=>c.mesh!==old.mesh);
  plan=cache.plan('far',matrix,size,casters);paint(incremental,size,plan);cache.commit(plan);
  paint(full,size,createChunkShadowCache().plan('far',matrix,size,casters));assert.deepEqual(incremental,full,'removed chunks leave no old silhouette');
  assert.equal(cache.diagnostics().partialPasses,2);assert.ok(cache.diagnostics().savedPixels>size*size);
});
test('Unchanged chunks retain every texel, and removing the last caster still clears its old footprint',()=>{
  const cache=createChunkShadowCache(),m=identity(),c=caster([9,12,20,25]);
  cache.commit(cache.plan('far',m,64,[c]));
  const retained=cache.plan('far',m,64,[{...c,textures:[]}]);assert.equal(retained.region,null);cache.commit(retained);
  const removed=cache.plan('far',m,64,[]);assert.deepEqual(removed.region,c.rect);assert.equal(removed.items.length,0);
  cache.commit(removed);assert.equal(cache.diagnostics().retainedPasses,1);
});
test('Projection, image-size, unsafe-source and context changes require complete rebuilds',()=>{
  const cache=createChunkShadowCache(),m=identity(),c=caster([1,1,8,8]);cache.commit(cache.plan('far',m,64,[c]));
  const shifted=m.slice();shifted[12]=.1;
  assert.equal(cache.plan('far',shifted,64,[c]).full,true);
  assert.equal(cache.plan('far',m,128,[c]).full,true);
  assert.equal(cache.plan('far',m,64,[{...c,unsafe:true}]).full,true);
  cache.clear();assert.equal(cache.has('far'),false);assert.equal(cache.plan('far',m,64,[c]).full,true);
});
test('Moving a caster along the light depth axis repairs its unchanged XY footprint',()=>{
  const size=64,cache=createChunkShadowCache(),m=identity(),world=identity();
  const c={...caster([12,12,20,20],.2),world:world.slice()},back=caster([0,0,size,size],.6);
  const incremental=new Float32Array(size*size),full=new Float32Array(size*size);
  const initial=cache.plan('far',m,size,[back,c]);paint(incremental,size,initial);cache.commit(initial);
  world[14]=.5;
  const moved={...c,world:world.slice(),depth:.8};
  const update=cache.plan('far',m,size,[back,moved]);assert.deepEqual(update.region,c.rect);
  paint(incremental,size,update);paint(full,size,createChunkShadowCache().plan('far',m,size,[back,moved]));
  assert.deepEqual(incremental,full,'the surface behind the moved occluder must become visible');
});
test('Light-space damage covers the old and new footprints and all eight transformed bounds corners',()=>{
  const cache=createChunkShadowCache(),m=identity(),c=caster([2,3,8,9]);cache.commit(cache.plan('far',m,64,[c]));
  const moved={...c,rect:[20,21,27,28],revision:2};assert.deepEqual(cache.plan('far',m,64,[moved]).region,[2,3,27,28]);
  const transform=identity();transform[12]=.5;
  assert.deepEqual(projectShadowBounds([-.25,-.25,-.25,.25,.25,.25],transform,m,64),[36,20,60,44]);
  transform[12]=5;assert.equal(projectShadowBounds([0,0,0,1,1,1],transform,m,64),null);
  assert.equal(projectShadowBounds([NaN,0,0,1,1,1],identity(),m,64),undefined);
});
