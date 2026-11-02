'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture=require('./fixtures/source-emission-2026-10-18.json');
const source=k=>fixture.contracts.find(c=>c.kind===k).code;
test('instance producer evidence pins live slots, swap removal, deferred upload and registry overwrite',()=>{
  const storage=source('instanceLifetimeStorage'),manager=source('instanceOwnershipManager');
  assert.match(storage,/this\.Df\[this\.count\]=ys,this\.jr\[ys\]=my/);
  assert.match(storage,/delete this\.jr\[ys\]/);
  assert.match(storage,/this\.Nf\[Rs\]=this\.Nf\[Os\];var Ys=this\.Df\[Os\];this\.jr\[Ys\]=vs,this\.Df\[Rs\]=Ys/);
  assert.match(storage,/this\.count--,this\.FR=!0/);
  assert.match(storage,/this\.mesh\.FO=this\.count,this\.mesh\.UO\("matrix"\),this\.mesh\.UO\("aPackedLightLevels"\)/);
  assert.match(storage,/this\.mesh=null,this\.jr=null,this\.Df=null,this\.Nf=null,this\.fm=!0/);
  assert.match(manager,/if\(Os\[ys\]\)return Os\[ys\]/);
  assert.match(manager,/es===vs\|\|es\.jv===vs\.jv/);
  assert.match(manager,/ds=vs\.Pf\[hs\]\|\|0;if\(ds!==Os\)/);
  assert.match(manager,/Os>0&&\(vs\.Pf\[hs\]=Os\)/);
  assert.match(manager,/ss\.Pf=null,vs=!0/);
  assert.doesNotMatch(storage+manager,/\.Us|registerGeneration|blockGeneration/);
  assert.match(source('instanceRegistryOverwrite'),/Ns\[ss\]=Ds\.sO/);
  assert.doesNotMatch(source('instanceRegistryOverwrite'),/\.zs\.|\.emit\(/);
  assert.match(source('instanceChunkCreateAndReplace'),/Es\.Ms\(ss,zs,jy,hs,Is\)/);
  assert.match(source('instanceChunkCreateAndReplace'),/this\.my\.zs\.iy\(this\),this\.my\.Is\.iy\(this\),this\.bs=ss,this\.Zs\+\+/);
  assert.match(source('instanceChunkEditAndDispose'),/Ns&&hs\.Ms\(this,0,ss,ys,vs\),qs&&hs\.Ms\(this,Rs,ss,ys,vs\)/);
  for(const c of fixture.contracts.slice(-5))assert.ok(c.lengthUTF16<10000);
});
test('inert instance counterexamples distinguish identity from identical exported bytes and current registries',()=>{
  // Synthetic histories, not a replay/evaluation of the public producer.
  const visible=()=>({matrix:[1,0,0,0,0,1,0,0,0,0,1,0,4,5,6,1],atlas:7,light:65535,count:1});
  const first={draw:visible(),owner:{key:'4:5:6',block:1,registration:1,lifetime:1}};
  const alias={draw:visible(),owner:{key:'4:5:6',block:2,registration:1,lifetime:1}};
  const reused={draw:visible(),owner:{key:'4:5:6',block:1,registration:2,lifetime:2}};
  assert.deepEqual(first.draw,alias.draw);assert.deepEqual(first.draw,reused.draw);
  assert.notDeepEqual(first.owner,alias.owner);assert.notDeepEqual(first.owner,reused.owner);
  // Removing A swaps B to slot zero; unused tail is not a live owner.
  const keys=['A','B'],live={A:0,B:16};delete live.A;keys[0]=keys[1];live.B=0;
  const count=1;assert.deepEqual(keys,['B','B']);assert.equal(keys.slice(0,count).length,1);
  assert.equal(live.B,0);assert.equal(live.A,undefined);
  // A current register snapshot cannot certify which generation created a slot.
  first.currentRegistry=reused.currentRegistry=[null,[3,2,1]];
  assert.deepEqual(first.currentRegistry,reused.currentRegistry);
});
test('emission evidence pins registration, RGB packing and separate propagated maxima without executing sources',()=>{
  assert.equal(fixture.bundlesExecuted,false);
  for(const c of fixture.contracts)assert.equal(crypto.createHash('sha256').update(c.code).digest('hex'),c.sha256);
  assert.match(source('declaredRgbUnit'),/as \[R, G, B\], each 0-15/);
  assert.match(source('registryWriter'),/this\.Us=Ns/);
  assert.match(source('registryWriter'),/Ns\[ss\]=Ds\.sO/);
  assert.match(source('registryPacking'),/Rs\[0\]\|Rs\[1\]<<4\|Rs\[2\]<<8/);
  assert.match(source('workerRegistrySnapshot'),/lightEmissionLookup:Js\(ky\)/);
  assert.match(source('workerOwnVersusPropagated'),/Math\.max\(fs\[0\],ss\)/);
  assert.match(source('variantReregistration'),/ss\.As\.vz\(Rs\.id/);
});
test('emission provenance audit records exactly where meshing and instance identity is lost',()=>{
  assert.match(source('workerCompletion'),/Ys===qs\.Ps\?\(qs\.Ps=0/);
  assert.match(source('workerFaceExport'),/terrainID:Rs\.terrainID,numFaces:Os,is:Int16Array/);
  assert.match(source('vertexBuilder'),/Zs\.push\(\{vertices:rs,usesAtlas:qs,indices:ts,es:Js,quadEdgeData:Ps,Ss:ys\.Ss,terrainID:Ns\}\)/);
  assert.match(source('greedySelection'),/Ps\.matIDs\[ns\]=Cs/);
  assert.match(source('objectInstanceStorage'),/es===vs\|\|es\.jv===vs\.jv/);
  assert.match(source('objectInstanceStorage'),/this\.Df\[Rs\]=Ys/);
  const r=require('../../docs/bloxd-source-emission-reference.json');
  assert.equal(r.sources.length,11);assert.equal(r.coverage.length,6);
  assert.ok(r.coverage.every(c=>['unknown','implemented-bounded'].includes(c.status)&&c.missing&&c.evidence.length));
  assert.equal(r.implementedEmissionVariants.length,4);assert.deepEqual(r.referenceRequirementsClosed,[]);
  assert.deepEqual(r.newPacket,{type:33,version:5});assert.deepEqual(r.preservedEmissionPackets,[{type:33,version:1},{type:33,version:2},{type:33,version:3},{type:33,version:4}]);assert.equal(r.sourceBlockEmissionContract,3);assert.equal(r.sourceBlockIdentityContract,1);assert.equal(r.sourceBlockMaterialContract,1);assert.equal(r.irisContractComplete,false);
});
test('worker reply retains job block copies, but initialization registry and chunk edit revision are not returned',()=>{
  const reply=source('workerReplyWithBlockCopies'),boundary=source('workerInitAndCompleteBoundary');
  assert.match(reply,/meshJobId:Rs,lightOnlyUpdate:!1,vertexDataInfo:Os,faceLayout:es,reusableChunkArrs:Ss/);
  assert.match(source('centerBlockCopyAndNeighbours'),/ds\.set\(ss\.bs\.data\),Rs\|=8192/);
  assert.match(boundary,/vs\.postMessage\(\{type:"meshingInit",data:ys\}\),vs\.onmessage=/);
  assert.ok(boundary.indexOf('gs.release(ss)')<boundary.indexOf('Ys===qs.Ps'));
  assert.match(source('blockArrayPool'),/get\(\)\{return.*this\.ss\.pop\(\)\}release\(ss\)\{this\.ss\.push\(ss\)\}/);
  assert.match(source('chunkBlockRevision'),/this\.bs=ss,this\.Zs\+\+/);
  assert.match(source('chunkBlockRevision'),/this\.bs\.set\(ss,ys,vs,Rs\),this\.Zs\+\+/);
  assert.doesNotMatch(source('jobDispatch'),/tempChunk\.Zs/);
  // The main-thread builder receives eight arguments, excluding the optional
  // opacity/emission arguments used by the worker constructor.
  assert.match(source('workerRegistrySnapshot'),/this\.meshBuilder=new qs\(this\.terrainMatManager,ds,zs,fs,rs,Ks,this\.babylon,this\.Zy\)/);
  assert.match(source('workerDispatch'),/Ey=new ws\(null,Rs,Zs,Ss,bs,hs,null,ys,Ys,ds\)/);
  assert.match(source('bufferDataRetention'),/getData\(\)\{return this\._data\}/);
});
test('inert histories show why current registry and pooled reply references cannot certify an older job',()=>{
  // Hand-built counterexample only; no public function/module is executed.
  // Two initialization histories have identical observable current registers,
  // geometry and propagated vertex light, but distinct job own emission.
  const history=initial=>({workerInit:new Uint16Array([0,initial]),
    currentRegistry:[null,[3,2,1]],reply:{meshJobId:7,vertexDataInfo:[{vertices:[0,0,0],packedLight:0xffff}],
      reusableChunkArrs:[new Uint16Array([1])],faceLayout:[{numFaces:1}]}});
  const a=history(0x123),b=history(0x001);
  assert.deepEqual(a.currentRegistry,b.currentRegistry);assert.deepEqual(a.reply,b.reply);
  assert.notDeepEqual(a.workerInit,b.workerInit);
  const captured=a.reply.reusableChunkArrs[0].slice(),borrowed=a.reply.reusableChunkArrs[0];
  borrowed[0]=2;assert.equal(captured[0],1);assert.equal(borrowed[0],2);
  assert.equal(a.reply.meshJobId,7); // Job identity alone cannot protect reused storage.
});
