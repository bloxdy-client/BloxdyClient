'use strict';
// Saved native definitions only: no game, renderer, canvas or graphics context.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const fixture=require('./fixtures/shader-face-groups-2026-11-12.json');
const {shaderRuntime}=require('./shader-runtime-fixture.cjs');
const {liquidUploadSchema,remapLiquidFaceGroups}=require('../shader-world-adapter.cjs');
function native(){
 const cache=new Map();
 function read(id){if(cache.has(id))return cache.get(id);const exports={};cache.set(id,exports);vm.runInNewContext('('+fixture.modules[id]+')')({},exports,read);return exports;}
 read.d=(target,entries)=>{for(const [name,get]of Object.entries(entries))Object.defineProperty(target,name,{get});};
 return read(32136);
}
function faces(){
 const order=[0,2,4,1,3,5,0,2],positions=[],normals=[],colors=[],uvs=[],indices=[];
 for(const [face,side]of order.entries()){
  const axis=Math.floor(side/2),sign=side%2?1:-1,other=[0,1,2].filter(i=>i!==axis);
  for(const [u,v]of [[0,0],[1,0],[1,1],[0,1]]){
   const p=[0,0,0],n=[0,0,0];p[axis]=sign>0?1:0;p[other[0]]=u;p[other[1]]=v;n[axis]=sign;
   positions.push(...p);normals.push(...n);colors.push(.8,.7,.6,1);uvs.push(u,v);
  }
  indices.push(...[0,1,2,0,2,3].map(i=>i+face*4));
 }
 return {positions:new Float32Array(positions),normals:new Float32Array(normals),colors:new Float32Array(colors),uvs:new Float32Array(uvs),indices:new Uint32Array(indices),
  faceGroups:new Int32Array([0,1,2,3,4,5,6,7,8,0,1,0,1,0,1])};
}
test('Current native face culling retains solid block sides after lava tessellation, including repeated face groups',()=>{
 const api=shaderRuntime(),data=faces(),built=api.subdivideWaterData(data,face=>face===4,()=>true,.25);
 assert(built);assert.deepEqual(Array.from(data.faceGroups),[0,1,2,3,4,5,6,7,8,0,1,0,1,0,1]);
 assert.deepEqual(Array.from(built.data.faceGroups),[0,1,2,3,4,20,21,22,23,0,1,0,1,0,1]);
 const actual=native(),culler=new actual.e(1,{getRenderWidth:()=>1280,getRenderHeight:()=>720});
 const sub={setBoundingInfo(){}},mesh={nS:[sub],position:{x:0,y:0,z:0},material:{backFaceCulling:true,transparencyMode:0},
  getTotalIndices:()=>built.data.indices.length,TpF:()=>({})};
 const visibleNormals=(groups,eye)=>{
  actual.j(mesh,groups);const list={data:[mesh],length:1};
  culler.apply(list,{getProjectionMatrix:()=>({m:[1,0,0,0,0,1,0,0,0,0,1,1,0,0,0,0]}),globalPosition:{x:eye[0],y:eye[1],z:eye[2]}});
  return Array.from(built.data.indices.slice(sub.indexStart,sub.indexStart+sub.indexCount),i=>Array.from(built.data.normals.slice(i*3,i*3+3)).join(','));
 };
 assert(!visibleNormals(data.faceGroups,[.5,.5,100]).includes('0,0,1'),'old ranges reproduce missing Z sides in the native culler');
 for(const [eye,normal]of [[[.5,.5,100],'0,0,1'],[[.5,.5,-100],'0,0,-1'],[[100,.5,.5],'1,0,0'],[[-100,.5,.5],'-1,0,0']])
  assert(visibleNormals(built.data.faceGroups,eye).includes(normal),'visible solid side survives: '+normal);
 // Flat/Off restores the original native data and its original culling ranges.
 actual.j(mesh,data.faceGroups);assert.equal(mesh._noaFaceGroups,data.faceGroups);
 assert.equal(remapLiquidFaceGroups(new Int32Array(7),[]),null,'unknown formats disable optional face culling instead of drawing wrong ranges');
});
test('Current native Uint16 lighting and chunk-label fields are recognized without guessed field names',()=>{
 const builder=vm.runInNewContext('({'+fixture.meshBuilder+'})');
 assert.deepEqual(liquidUploadSchema({meshBuilder:builder}),{light:'Uf',label:'aI'});
 const exports={},requireFake=()=>{};requireFake.d=(target,entries)=>{for(const [key,get]of Object.entries(entries))Object.defineProperty(target,key,{get});};
 vm.runInNewContext('('+fixture.lightCodec+')',{Float32Array,Uint16Array})({},exports,requireFake);
 const context={console,Float32Array,IF:{k:atlas=>atlas?32:28},kp:exports,nF:null,fF:{h:0x5000},ip:'noa_terrain_material_override'};
 const nativeBuilder=vm.runInNewContext('({'+fixture.meshBuilder+'})',context),writes=[];
 Object.assign(nativeBuilder,{rewriteChunkBuffers:(_m,_v,_s,_c,_i,light)=>{writes.push(light);return true;},terrainMatManager:{Ef:()=>({})}});
 nativeBuilder.assignMeshData({tI:true,metadata:{}},{usesAtlas:true,vertices:new ArrayBuffer(128),indices:new Uint32Array(6),Uf:new Uint16Array([0x7123,0x8234,0x9345,0xa456]),aI:'0_0_0',terrainID:19});
 assert.deepEqual(Array.from(writes[0]),[0x7123,0x8234,0x9345,0xa456]);
});
