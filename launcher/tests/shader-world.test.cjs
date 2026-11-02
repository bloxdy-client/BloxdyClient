'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {shaderRuntime}=require('./shader-runtime-fixture.cjs');
const {nativeShaderModules}=require('./shader-runtime-fixture.cjs');
const {liquidUploadSchema}=require('../shader-world-adapter.cjs');
const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures',name),'utf8');

function liquidFixture(existing=false,meshKey='eK',materialName='terrain-alpha-19',performance='quality'){
  let now=0;
  const shader=shaderRuntime({enabled:true,waterEnabled:true,lavaEnabled:true,waterStyle:'wavey',lavaStyle:'wavey',waterPhysics:true,lavaPhysics:true},
    {performance:{now:()=>now}});
  shader.root.__BLOXD_MOD_HOST__.profile.performance=performance;
  const material={name:materialName,markAsDirty(){}};
  const chunk={pos:[0,0,0],eK:[],lK:'0_0_0',i:0,k:0,qK:true};
  if(meshKey!=='eK'){chunk[meshKey]=chunk.eK;delete chunk.eK;}
  class Mesh {
    constructor(){this.data={};this.metadata={noa_chunk_terrain_mesh:true};this.position={x:0,y:0,z:0};this.material=material;}
    setVerticesData(key,data){this.data[key]=data;}
    getVerticesData(key){return this.data[key];}
    getTotalVertices(){return this.data.position.length/3;}
    getVertexBuffer(key){return this.data[key]?{isUpdatable:()=>true}:null;}
    updateVerticesData(key,data){this.data[key]=data;}
    isDisposed(){return false;}
  }
  const builder={assignMeshData(mesh,data){
    const unpacked=shader.unpackLiquidGeometry(data);
    for(const [key,field] of [['position','positions'],['normal','normals'],['color','colors'],['uv','uvs'],['texAtlasIndices','indicesAcrossAtlasArr']])
      mesh.setVerticesData(key,unpacked[field]);
    mesh.setVerticesData('aPackedLightLevels',data.JK);
    if(data.quadEdgeData)mesh.setVerticesData('aQuadEdge',data.quadEdgeData);
    mesh._geometry={_indices:data.indices};
  }};
  const methods=fixture('native-chunk-upload-2026-10-12.txt').replaceAll('.eK','.'+meshKey);
  const manager=vm.runInNewContext('({'+methods.replace('\nassignLightOnlyData',',\nassignLightOnlyData')+'})',
    {performance:{now:()=>now},console,mn(){},QK:'i',dK:'k',DK:'noa_chunk_terrain_mesh'});
  const scene={meshes:chunk[meshKey],materials:[material],onBeforeRenderObservable:{add(){}}};
  Object.assign(manager,{meshBuilder:builder,terrainMatManager:{_terrainIDtoMatObject:{19:material}},
    YK:{Fn:{Fm:()=>false,Sw:null},emit(){}},babylon:{Mesh}});
  const reads=new Map();let blockOverride=null;
  const blocks=(x,y,z)=>{
    const key=[x,y,z].join(',');reads.set(key,(reads.get(key)||0)+1);
    return blockOverride ?? (Math.floor(y)===0?(Math.floor(x)===0?5:Math.floor(x)===1?6:7):0);
  };
  // Same coordinate conversion/chunk/ndarray shape as the saved game bundle.
  class World {
    constructor(){this.YY={wY:()=>chunk};chunk.kn={get:blocks};}
    JY(x,y,z){return [Math.floor(x/16),Math.floor(y/16),Math.floor(z/16)];}
    fY(x,y,z){return [x,y,z];}
    read(x,y,z){var [i,j,k]=this.JY(x,y,z),c=this.YY.wY(i,j,k);if(!c)return 0;var [a,b,d]=this.fY(x,y,z);return c.kn.get(a,b,d);}
  }
  const component={position:[.25,.9,.5],height:1.8,ON:42};
  const noa={container:{},inputs:{},entities:{names:{position:'position'},We:name=>name==='position'?[component]:[]},
    Dw:42,upload:manager,world:new World(),renderer:{scene},jS:[0,0,0]};
  shader.runtime.api={singletons:{noa},getBloxd:()=>({getItemId:name=>name==='Water'?5:name==='Lava'?6:undefined})};
  const native={usesAtlas:true,terrainID:19,lK:'0_0_0',vertices:new ArrayBuffer(12*32),
    indices:new Uint32Array([0,1,2,0,2,3,4,5,6,4,6,7,8,9,10,8,10,11]),JK:new Float32Array(12).fill(0x5000)};
  const view=new DataView(native.vertices);
  for(let face=0;face<3;face++)for(let corner=0;corner<4;corner++){
    const at=(face*4+corner)*32,u=[0,1,1,0][corner],v=[0,0,1,1][corner];
    view.setFloat32(at,face+u,true);view.setFloat32(at+4,1,true);view.setFloat32(at+8,v,true);
    view.setInt8(at+13,127);for(let i=0;i<4;i++)view.setUint8(at+16+i,255);
    view.setFloat32(at+20,u,true);view.setFloat32(at+24,v,true);view.setFloat32(at+28,0,true);
  }
  chunk[meshKey].push(new Mesh());
  if(existing)manager.assignMeshDataToChunk(chunk,[native]);
  shader.maintainWaterGeometry(noa);
  if(!existing)manager.assignMeshDataToChunk(chunk,[native]);
  const record=shader.waterMeshRecords.get(chunk);
  assert(record,'current chunk upload must remain registered for 3D preparation');
  shader.flushWaterGeometry(16);
  return {shader,chunk,manager,scene,noa,native,component,mesh:chunk[meshKey][0],clock:value=>{now=value;},
    reads,overrideBlocks:value=>blockOverride=value};
}

test('Liquid preparation reads each cached voxel once and refreshes all values on the next upload',()=>{
  const {shader,chunk,mesh,reads,overrideBlocks}=liquidFixture();
  reads.clear();shader.applyWaterGeometry(shader.waterMeshRecords.get(chunk));
  assert.ok(reads.size>0);assert.ok([...reads.values()].every(count=>count===1));
  assert.ok(mesh.data.aBvfxLiquidKind.includes(1));assert.ok(mesh.data.aBvfxLiquidKind.includes(2));
  overrideBlocks(0);reads.clear();shader.applyWaterGeometry(shader.waterMeshRecords.get(chunk));
  assert.ok(reads.size>0);assert.ok([...reads.values()].every(count=>count===1));
  assert.ok(!mesh.data.aBvfxLiquidKind.includes(1));assert.ok(!mesh.data.aBvfxLiquidKind.includes(2));
  assert.equal(mesh.getTotalVertices(),12,'edited blocks cannot reuse the previous wave grid');
});

test('Native chunk edits remain synchronous while optional wave preparation is queued',()=>{
  const {shader,manager,chunk,native,mesh}=liquidFixture();
  const replacement={...native,vertices:native.vertices.slice(0)};
  new DataView(replacement.vertices).setFloat32(0,7,true);
  manager.assignMeshDataToChunk(chunk,[replacement]);
  assert.equal(mesh.data.position[0],7,'the native edit must be visible before the next animation frame');
  assert.equal(shader.waterMeshRecords.get(chunk).nativeAssigned,true);
  assert.equal(Boolean(shader.waterMeshRecords.get(chunk).pendingUpload),false);
});

test('Shader Off restores native geometry and bypasses future liquid preparation',()=>{
  const {shader,manager,chunk,noa,native,mesh,reads}=liquidFixture();
  assert.equal(mesh.getTotalVertices(),54);shader.state.enabled=false;
  shader.maintainWaterGeometry(noa);shader.flushWaterGeometry(32);
  assert.equal(mesh.getTotalVertices(),12);assert.equal(shader.waterMeshRecords.size,0);
  reads.clear();manager.assignMeshDataToChunk(chunk,[native]);shader.maintainWaterGeometry(noa);shader.flushWaterGeometry(48);
  assert.equal(shader.waterMeshRecords.size,0);assert.equal(reads.size,0);
  const larger={...native,vertices:new ArrayBuffer(native.vertices.byteLength*2),JK:new Float32Array(24)};
  manager.assignMeshDataToChunk(chunk,[larger]);
  assert.equal(mesh.getTotalVertices(),24);assert.equal(mesh.data.aBvfxLiquidKind.length,24);
  assert.equal(mesh.data.aBvfxWaterEdge.length,72,'inactive compiled attributes must still cover every native vertex');
  manager.assignMeshDataToChunk(chunk,[native]);
  shader.state.enabled=true;shader.maintainWaterGeometry(noa);shader.flushWaterGeometry(64);
  assert.equal(mesh.getTotalVertices(),54,'re-enabling safely adopts existing native chunks');
});

test('Today\'s native mesh builder exposes exact packed-light and chunk-label fields',()=>{
  const {fixture}=nativeShaderModules(),meshBuilder=vm.runInNewContext('({'+fixture.meshBuilder+'})');
  assert.deepEqual(liquidUploadSchema({meshBuilder}),{light:'Yv',label:'Ev'});
  const writes=[];Object.assign(meshBuilder,{rewriteChunkBuffers:(_mesh,_vertices,_stride,_count,_indices,lights)=>{writes.push(lights);return true;},terrainMatManager:{hW:()=>({})}});
  // Execute the saved original method, using only CPU arrays and fake meshes.
  const body=fixture.meshBuilder;
  const globals={console,ic:atlas=>atlas?32:28,IW:null};
  const builder=vm.runInNewContext('({'+body+'})',globals);
  Object.assign(builder,{rewriteChunkBuffers:meshBuilder.rewriteChunkBuffers,terrainMatManager:meshBuilder.terrainMatManager});
  const lights=new Float32Array([0x7123]);
  builder.assignMeshData({VW:true,metadata:{}},{vertices:new ArrayBuffer(32),usesAtlas:true,Ev:'0_0_0',terrainID:19,indices:new Uint32Array(),Yv:lights});
  assert.equal(writes[0],lights);
});

test('Current packed chunk uploads gain 3D water/lava vertices and stable lava texture identity',()=>{
  for(const key of ['eK','renamedMeshes']){
    const {mesh}=liquidFixture(false,key);
    assert.equal(mesh.getTotalVertices(),54); // 25 water, 25 lava, 4 ordinary block.
    const kinds=mesh.data.aBvfxLiquidKind;
    assert(kinds.slice(0,25).every(x=>x===1));assert(kinds.slice(25,50).every(x=>x===2));
    assert(kinds.slice(50).every(x=>x===3),'shared animated atlas zero must not paint stone as lava');
    assert(mesh.data.aBvfxWaterEdge[12*3]>0,'water interior must move vertically');
    assert(mesh.data.aBvfxWaterEdge[37*3]>0,'lava interior must move vertically');
    assert.equal(mesh.data.aBvfxWaterEdge[0],0,'shore stays attached to the bank');
    assert.equal(mesh.data.aPackedLightLevels.length,54);
  }
});

test('Balanced liquid meshes retain waves and voxel identity using fewer vertices than Quality',()=>{
  const balanced=liquidFixture(false,'eK','terrain-alpha-19','balanced'),quality=liquidFixture();
  assert.equal(balanced.mesh.getTotalVertices(),22);assert.equal(quality.mesh.getTotalVertices(),54);
  assert(balanced.mesh.data.aBvfxLiquidKind.slice(0,9).every(x=>x===1));
  assert(balanced.mesh.data.aBvfxLiquidKind.slice(9,18).every(x=>x===2));
  assert(balanced.mesh.data.aBvfxWaterEdge.some(x=>x>0));
  assert.equal(balanced.mesh.data.aPackedLightLevels.length,22);
});

test('Already loaded liquid chunks are adopted with native packed lighting and safe style rebuilds',()=>{
  const {shader,chunk,noa,manager,mesh}=liquidFixture(true);
  assert.equal(mesh.getTotalVertices(),54);
  assert(manager.assignLightOnlyData(chunk,[new Float32Array(12).fill(0x7123)]));
  assert(mesh.data.aPackedLightLevels.every(value=>value===0x7123));
  shader.state.waterStyle='flat';shader.state.lavaStyle='flat';shader.maintainWaterGeometry(noa);
  shader.applyWaterGeometry(shader.waterMeshRecords.get(chunk));
  assert.equal(mesh.getTotalVertices(),12);assert(mesh.data.aPackedLightLevels.every(value=>value===0x7123));
  assert.equal(mesh.data.aBvfxLiquidKind[4],2,'custom lava texture remains available in flat mode');
  shader.state.waterStyle='wavey';shader.state.lavaStyle='wavey';shader.maintainWaterGeometry(noa);
  shader.applyWaterGeometry(shader.waterMeshRecords.get(chunk));assert.equal(mesh.getTotalVertices(),54);
  const signature=shader.waterGeometrySignature(noa);shader.state.lavaPhysics=false;
  assert.notEqual(shader.waterGeometrySignature(noa),signature);
});

test('Opaque animated atlas zero gets a liquid shader before frame metadata arrives; stone keeps its native identity',()=>{
  const {shader,mesh,noa,chunk}=liquidFixture(true,'eK','terrain-textured-19');
  assert.equal(shader.waterShaderState.count,0);assert.equal(shader.lavaShaderState.count,0);
  assert.equal(mesh.getTotalVertices(),54);assert.equal(mesh.data.aBvfxLiquidKind[25],2);
  assert.equal(mesh.data.aBvfxLiquidKind[50],3);
  const attributes=[],defines={toString:()=>''};
  mesh.material.customShaderNameResolve('default',[],[],[],defines,attributes);
  assert(defines.toString().includes('#define BVFX_WATER_GEOMETRY'));
  assert(!defines.toString().includes('#define BVFX_LIQUID_LAVA_MATERIAL'),'mixed terrain must not become dedicated lava');
  assert(attributes.includes('aBvfxLiquidKind'));assert(attributes.includes('aBvfxWaterEdge'));
  shader.state.waterStyle='flat';shader.state.lavaStyle='flat';shader.maintainWaterGeometry(noa);
  shader.applyWaterGeometry(shader.waterMeshRecords.get(chunk));
  assert.equal(mesh.getTotalVertices(),12);assert.equal(mesh.data.aBvfxLiquidKind[4],2);
});

test('Liquid atlas metadata does not add costly liquid programs to unrelated opaque terrain',()=>{
  const {shader,noa,scene}=liquidFixture();
  shader.waterShaderState.count=1;shader.waterShaderState.indices[0]=10;
  const ordinary={name:'terrain-textured-99',markAsDirty(){}};scene.materials.push(ordinary);
  shader.bindWaterMaterials(noa,false);
  const attributes=[],defines={toString:()=>''};
  ordinary.customShaderNameResolve('default',[],[],[],defines,attributes);
  assert.match(defines.toString(),/BVFX_TERRAIN_UNDERWATER/,'voxel lighting remains enabled');
  assert.doesNotMatch(defines.toString(),/BVFX_WATER_GEOMETRY/);
  assert(!attributes.includes('aBvfxLiquidKind'));
});

test('Moving entities generate separate water and lava physics ripples on the rebuilt grid',()=>{
  const {shader,noa,scene,component,clock}=liquidFixture();
  clock(100);shader.updateWaterPhysics(scene);component.position[0]=.5;
  clock(300);shader.updateWaterPhysics(scene);
  assert.equal(shader.waterRipples.length,1);assert(shader.waterRipples[0].strength>0);
  component.position[0]=1.25;clock(500);shader.updateWaterPhysics(scene);
  assert.equal(shader.waterRipples.length,2);assert(shader.waterRipples[1].strength<0);
  assert.equal(shader.waterRippleUniforms[7],shader.waterRipples[1].strength);
  shader.state.waterPhysics=false;shader.state.lavaPhysics=false;clock(700);shader.updateWaterPhysics(scene);
  assert.equal(shader.waterRipples.length,0);
});

function nativeWorker(source){
  const messages=[];
  const context=vm.createContext({console,postMessage:message=>messages.push(message)});
  vm.runInContext('self=globalThis;',context);vm.runInContext(source,context,{timeout:5000});
  return {send(type,data){context.onmessage({data:{type,data}});return messages.at(-1);}};
}
function initData(){return {ln:16,solidLookupArr:new Uint8Array(4),opacityLookup:new Uint8Array([0,1,1,0]),
  blockFaceToMatId:new Uint16Array(24),matIdToTerrainId:new Uint16Array(4),atlasIndexLookup:new Uint16Array(4),
  matColorLookup:[],Un:[],fn:[],lightEmissionLookup:new Uint16Array(4),skyLightEmissionLookup:new Uint8Array(4),lightFilterLookup:new Uint8Array([1,1,1,1])};}
const at=(x,y,z)=>x*256+y*16+z;
function meshJob(){const blocks=new Uint16Array(16**3);blocks[at(7,7,7)]=2;return {
  chunk:{i:0,j:0,k:0,size:16,mn:false,rK:false},neighboursData:Array.from({length:8},()=>new Uint16Array(blocks)),neighboursBitmask:1<<13,
  lightOnly:true,cachedFaceLayout:[],computeLighting:true,reusableLightBuffers:[],highestChunkJ:null,chunkJ:0,
  providedLightData:new Uint16Array(16**3).fill(0x5000),providedLightIsUint16:true,serverLightCovered:true,meshJobId:1};}

test('Actual current meshing worker emits ore block light while retaining native sky and Off state',()=>{
  const shader=shaderRuntime({oreGlowEnabled:true,oreBlockStrength:1});
  const source=fixture('native-meshing-worker-2026-10-12.js');
  const patched=shader.root.__BVFX_PATCH_ORE_WORKER_SOURCE__(source);
  assert.notEqual(patched,source,'current worker must be recognized');new vm.Script(patched);
  const worker=nativeWorker(patched),original=initData(),specs=[{blockId:2,type:'diamond'}];
  const sample=()=>{const result=worker.send('Jn',meshJob());assert.equal(result.type,'meshed');return result.computedLightData[at(7,7,8)];};
  worker.send('meshingInit',{...original,__bvfxOreIds:[]});assert.equal(sample(),0x5000);
  worker.send('meshingInit',{...shader.workerLightingData(original,specs),__bvfxOreIds:[2]});
  const full=sample();assert(full>0x5000);assert.equal(full&0xf000,0x5000);
  shader.state.oreBlockStrength=.25;
  worker.send('meshingInit',{...shader.workerLightingData(original,specs),__bvfxOreIds:[2]});
  const weaker=sample();assert(weaker>0x5000 && weaker<full);
  shader.state.oreGlowEnabled=false;
  worker.send('meshingInit',{...shader.workerLightingData(original,specs),__bvfxOreIds:[]});assert.equal(sample(),0x5000);
  assert(original.lightEmissionLookup.every(x=>x===0),'original game lookup is preserved');
});

test('Document-start Blob/URL/Worker hooks recover late ore IDs and relight once per emission change',()=>{
  // Entirely CPU fakes: no system Worker, browser, client or IPC is used.
  const urls=new Map();let serial=0;
  class Blob {constructor(parts){this.source=parts.join('');}}
  class Worker {
    constructor(url){this.worker=nativeWorker(urls.get(url).source);this.last=null;}
    postMessage(message){this.last=this.worker.send(message.type,message.data);}
    terminate(){}
  }
  const URL={createObjectURL:blob=>{const url='cpu:'+serial++;urls.set(url,blob);return url;},revokeObjectURL:url=>urls.delete(url)};
  const shader=shaderRuntime({oreGlowEnabled:true,oreBlockStrength:1},{Blob,Worker,URL});
  const url=shader.root.URL.createObjectURL(new shader.root.Blob([fixture('native-meshing-worker-2026-10-12.js')]));
  const worker=new shader.root.Worker(url);assert(shader.root.__BVFX_ORE_WORKER_READY__(worker));shader.root.URL.revokeObjectURL(url);
  worker.postMessage({type:'meshingInit',data:initData()});
  const sample=()=>{worker.postMessage({type:'Jn',data:meshJob()});return worker.last.computedLightData[at(7,7,8)];};
  assert.equal(sample(),0x5000);
  let requeues=0;
  const noa={container:{},inputs:{},entities:{},renderer:{scene:{meshes:[],materials:[],onBeforeRenderObservable:{add(){}}}},
    lighting:{requeueChunksForLighting(){requeues++;}}};
  shader.runtime.api={singletons:{noa,itemsClient:{}},getBloxd:()=>({getItemId:name=>name==='Diamond Ore'?2:undefined})};
  shader.updateOreGlow(noa);const lit=sample();assert(lit>0x5000);assert.equal(requeues,1);
  for(let i=0;i<100;i++)shader.updateOreGlow(noa);assert.equal(requeues,1,'no recurring chunk rebuilds');
  shader.state.oreSurfaceBrightness=.25;shader.updateOreGlow(noa);assert.equal(requeues,1);assert.equal(sample(),lit);
  shader.state.oreBlockStrength=.25;shader.updateOreGlow(noa);assert.equal(requeues,2);assert(sample()<lit);
  shader.state.oreGlowEnabled=false;shader.updateOreGlow(noa);assert.equal(sample(),0x5000);assert.equal(requeues,3);
  shader.state.oreGlowEnabled=true;shader.updateOreGlow(noa);assert(sample()>0x5000);assert.equal(requeues,4);
  worker.terminate();assert.equal(shader.meshingWorkers.size,0);
});
