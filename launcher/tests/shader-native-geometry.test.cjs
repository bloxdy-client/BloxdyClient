'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {decodeNativeQuads,decodeNativeTerrain,encodeNativeLiquidQuads,compactNativeLiquids,nativeLiquidLight}=require('../shader-native-geometry.cjs');
function water(){return {packedVertices:new Uint32Array([(1<<24)|(1<<18)|(2<<6),0xff120123,2|(1<<5)|(2<<7)|(3<<9)]),vertexCount:4,FE:new Uint16Array([0x1234,0x5678,0x9abc,0xdef0]),faceGroups:[0,0,0,1,1,1,1,1,1,2,0,2,2,2,0]};}
test('Native quad decoding preserves native records, flags, slots and packed light values',()=>{
 const data=water(),before=data.packedVertices.slice(),decoded=decodeNativeQuads(data);assert.equal(decoded.positions.length,12);assert.deepEqual(Array.from(decoded.bvfxNativeAO),[0,1,2,3]);
 assert(decoded.normals.every((x,i)=>x===(i%3===1?1:0)));assert(decoded.indicesAcrossAtlasArr.every(x=>x===0x0123));assert.deepEqual(Array.from(decoded.Uo),Array.from(data.FE));assert.deepEqual(data.packedVertices,before);assert.equal(decoded.packedVertices,data.packedVertices);
});
test('Shared shore subdivision accepts native decoded quads and interpolates their native light slots',()=>{
 const {shaderRuntime}=require('./shader-runtime-fixture.cjs'),r=shaderRuntime(),data=water(),decoded=decodeNativeQuads(data),built=r.subdivideWaterData(decoded,()=>true,()=>true,.5);
 assert(built);assert.equal(built.data.positions.length/3,64);assert.equal(built.data.Uo.length,64);assert(built.data.positions.every(Number.isFinite));assert(built.data.bvfxWaterEdge.every((x,i)=>x===(i%3===0?1:0)));
 assert.equal(built.data.faceGroups[8],16);assert.equal(built.mapping.length,256);assert.deepEqual(data.FE,new Uint16Array([0x1234,0x5678,0x9abc,0xdef0]));
});
test('Unknown native record or lighting formats are rejected before any replacement geometry is made',()=>{
 assert.equal(decodeNativeQuads({vertices:new ArrayBuffer(28)}),null);assert.throws(()=>decodeNativeQuads({...water(),packedVertices:new Uint8Array(13)}),/record size/);
 assert.throws(()=>decodeNativeQuads({...water(),vertexCount:8}),/count changed/);assert.throws(()=>decodeNativeQuads({...water(),FE:new Float32Array(4)}),/light format/);
 const data=water();data.packedVertices[2]=7;assert.throws(()=>decodeNativeQuads(data),/direction changed/);
});
test('Native liquid preparation retains every source flag and face order while sharing shore geometry and light interpolation',()=>{
 const {shaderRuntime}=require('./shader-runtime-fixture.cjs'),r=shaderRuntime(),data=water(),decoded=decodeNativeQuads(data),built=r.subdivideWaterData(decoded,()=>true,()=>true,.5),result=encodeNativeLiquidQuads(data,built,[2]);
 assert.equal(result.attributeStride,48);assert.equal(result.data.vertexCount,64);assert.equal(result.attributes.length,64*12);assert.equal(result.data.FE.length,64);assert.equal(result.data.faceGroups[8],16);
 for(let face=0;face<16;face++)assert.deepEqual(result.data.packedVertices.subarray(face*3,face*3+3),data.packedVertices);
 for(let vertex=0;vertex<64;vertex++){const at=vertex*12;assert.equal(result.attributes[at+3],1);assert.equal(result.attributes[at+6],2);assert.equal(result.attributes[at+7],0);
  assert.deepEqual(Array.from(result.attributes.subarray(at,at+3)),Array.from(built.data.positions.subarray(vertex*3,vertex*3+3)));assert.equal(result.attributes.subarray(at+8,at+12).reduce((a,b)=>a+b,0),1);
  assert.equal(result.data.FE[vertex],built.data.Uo[vertex]);
 }
 assert.equal(data.vertexCount,4);assert.equal(data.FE.length,4);assert.equal(data.packedVertices.length,3);
});
test('Liquid preparation cannot cross source faces or silently consume unknown kind/attribute data',()=>{
 const {shaderRuntime}=require('./shader-runtime-fixture.cjs'),r=shaderRuntime(),data=water(),built=r.subdivideWaterData(decodeNativeQuads(data),()=>true,()=>true,.5);
 assert.throws(()=>encodeNativeLiquidQuads(data,built,[9]),/source mapping/);assert.throws(()=>encodeNativeLiquidQuads(data,built,[1],new Float32Array(3)),/underwater/);
 built.data.positions[0]=NaN;assert.throws(()=>encodeNativeLiquidQuads(data,built,[1]),/Non-finite/);
});
test('Native mode leaves the original Uint16 light uploads and native mesher ownership intact',()=>{
 const {shaderRuntime}=require('./shader-runtime-fixture.cjs'),r=shaderRuntime({},{__BVFX_NATIVE_REQUESTED__:true});let calls=0;
 const assign=function(){calls++;},light=function(){calls++;},manager={assignMeshDataToChunk:assign,assignLightOnlyData:light};r.maintainWaterGeometry({manager});
 assert.equal(manager.assignMeshDataToChunk,assign);assert.equal(manager.assignLightOnlyData,light);assert.equal(manager.__bvfxNativeAssign,undefined);assert.equal(calls,0);
});

test('Compact native light updates match the shared interpolator for both diagonal orders and uneven grids',()=>{
 const {shaderRuntime}=require('./shader-runtime-fixture.cjs'),r=shaderRuntime();
 for(const diagonal of [0,1])for(const width of [2,5])for(const spacing of [.25,.5]){
  const data=water();data.packedVertices[0]=(data.packedVertices[0]&~(63<<18))|((width-1)<<18);data.packedVertices[2]|=diagonal<<11;
  const built=r.subdivideWaterData(decodeNativeQuads(data),()=>true,()=>true,spacing),wet=Float32Array.from({length:built.mapping.length/4},(_,i)=>[-1,-.5,0,.5,1][i%5]);
  const compact=compactNativeLiquids(data,built,[1],wet);assert.equal(compact.records.byteLength,compact.data.vertexCount/4*40);assert.deepEqual(nativeLiquidLight(data,compact.records,data.FE),compact.data.FE);
  for(let f=0;f<compact.data.vertexCount/4;f++)for(let s=0;s<4;s++){assert.equal(((compact.records[f*10+6]>>>(s*3))&7)*.5-1,wet[f*4+s]);assert.equal(compact.data.packedVertices[f*3+1],data.packedVertices[1]);}
 }
});

test('Native raw liquids retain flag bytes, colour, UV and Uint16 light through shared subdivision',()=>{
 const {shaderRuntime}=require('./shader-runtime-fixture.cjs'),r=shaderRuntime(),original=water(),decoded=decodeNativeQuads(original,'single'),bytes=new ArrayBuffer(4*28),view=new DataView(bytes);
 for(let v=0;v<4;v++){for(let c=0;c<3;c++){view.setFloat32(v*28+c*4,decoded.positions[v*3+c],true);view.setInt8(v*28+12+c,decoded.normals[v*3+c]*127);view.setUint8(v*28+16+c,[60,110,190][c]);}
  view.setUint8(v*28+15,0x83);view.setUint8(v*28+19,0xa7);view.setFloat32(v*28+20,decoded.uvs[v*2],true);view.setFloat32(v*28+24,decoded.uvs[v*2+1],true);}
 const raw={vertices:bytes,vertexCount:4,FE:original.FE},full=decodeNativeTerrain(raw,'single'),built=r.subdivideWaterData(full,()=>true,()=>true,.5),compact=compactNativeLiquids(raw,built,[2],null,'single'),output=new DataView(compact.data.vertices);
 assert.equal(compact.data.vertexCount,64);assert(compact.data.FE instanceof Uint16Array);assert.deepEqual(nativeLiquidLight(raw,compact.records,raw.FE),compact.data.FE);
 for(let v=0;v<64;v++){assert.equal(output.getUint8(v*28+15),0x83);assert.equal(output.getUint8(v*28+19),0xa7);assert.equal(output.getFloat32(v*28+20,true),built.data.uvs[v*2]);for(let c=0;c<3;c++)assert.equal(output.getFloat32(v*28+c*4,true),built.data.positions[v*3+c]);}
 assert.equal(raw.vertices,bytes);assert.equal(raw.vertexCount,4);assert.throws(()=>decodeNativeTerrain({...raw,usesAtlas:true}),/atlas terrain requires/);
});
