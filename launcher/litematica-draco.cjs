'use strict';
const fs=require('node:fs'),path=require('node:path');
function decodeGeometry(d,bytes,ids){
 const decoder=new d.Decoder(),mesh=new d.Mesh();let status;
 try{
  status=decoder.DecodeArrayToMesh(new Int8Array(bytes),bytes.byteLength,mesh);if(!status.ok()||!mesh.ptr)throw Error('Invalid compressed block geometry');
  const points=mesh.num_points(),faces=mesh.num_faces();if(points>65536||faces>16384)throw Error('Compressed block geometry limit');const attributes={};
  for(const name of ['POSITION','TEXCOORD_0'])if(ids[name]!==undefined){const attribute=decoder.GetAttributeByUniqueId(mesh,ids[name]),n=attribute.num_components(),values=new d.DracoFloat32Array();try{if(n<1||n>4||!decoder.GetAttributeFloatForAllPoints(mesh,attribute,values))throw Error('Invalid compressed attribute');const array=new Float32Array(points*n);for(let i=0;i<array.length;i++)array[i]=values.GetValue(i);attributes[name]={n,array};}finally{d.destroy(values);}}
  const indices=new Uint32Array(faces*3),face=new d.DracoInt32Array();try{for(let i=0;i<faces;i++){decoder.GetFaceFromMesh(mesh,i,face);for(let j=0;j<3;j++)indices[i*3+j]=face.GetValue(j);}}finally{d.destroy(face);}return {attributes,indices};
 }finally{if(status)d.destroy(status);d.destroy(mesh);d.destroy(decoder);}
}
function workerMain(wasm,decode){
 const ready=new Promise((resolve,reject)=>{try{DracoDecoderModule({wasmBinary:Uint8Array.from(atob(wasm),c=>c.charCodeAt(0)),onModuleLoaded:d=>resolve({d}),onAbort:reject});}catch(error){reject(error);}});
 self.onmessage=async e=>{const {id,bytes,attributes}=e.data;try{const {d}=await ready,result=decode(d,bytes,attributes),transfer=[result.indices.buffer,...Object.values(result.attributes).map(a=>a.array.buffer)];self.postMessage({id,result},transfer);}catch(error){self.postMessage({id,error:String(error.message||error)});}};
}
let source;
function workerSource(){return source??=(fs.readFileSync(path.join(__dirname,'assets/draco/decoder.cjs'),'utf8')+'\n('+workerMain.toString()+')('+JSON.stringify(fs.readFileSync(path.join(__dirname,'assets/draco/decoder.wasm')).toString('base64'))+','+decodeGeometry.toString()+');');}
function createCompressedDecoder(source){
 let worker=null,url=null,sequence=0,dead=false;const pending=new Map();
 function stop(error){dead=true;worker?.terminate();if(url)URL.revokeObjectURL(url);url=null;for(const task of pending.values())task.reject(error);pending.clear();}
 return {decode(bytes,attributes){if(dead)return Promise.reject(Error('Block decoder closed'));if(pending.size>=2)return Promise.reject(Error('Block decoder queue limit'));if(!worker){try{url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);worker.onmessage=e=>{const {id,result,error}=e.data,task=pending.get(id);if(!task)return;pending.delete(id);if(error)task.reject(Error(error));else task.resolve(result);};worker.onerror=()=>stop(Error('Block decoder worker failed'));}catch(error){stop(error);return Promise.reject(error);}}
   return new Promise((resolve,reject)=>{const id=++sequence,copy=bytes.slice().buffer;pending.set(id,{resolve,reject});worker.postMessage({id,bytes:copy,attributes},[copy]);});},dispose(){stop(Error('Block decoder closed'));}};
}
module.exports={workerSource,createCompressedDecoder,decodeGeometry};
