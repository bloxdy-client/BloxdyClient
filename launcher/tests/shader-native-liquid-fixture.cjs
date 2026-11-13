'use strict';
// CPU worker VM and byte/command models only. No application or GPU context.
const fs=require('node:fs'),vm=require('node:vm');
const {shaderRuntime}=require('./shader-runtime-fixture.cjs');
const geometry=require('../shader-native-geometry.cjs'),{prepareNativeLiquidJob}=require('../shader-native-liquid-job.cjs'),{patchNativeLiquidSource}=require('../shader-native-liquids.cjs');
const world=require('../shader-native-world.cjs');
function fixture(){
 const r=shaderRuntime({},{__BVFX_NATIVE_REQUESTED__:true}),shared=r.root.__testNativeEnvironment.geometryKernel(),allocations=[],writes=[],draws=[],jobs=[],blobs=new Map(),messages=[],errors=[];let now=0,nextSlot=0;
 const device={createBuffer(d){const b={...d,bytes:new Uint8Array(d.size),destroy(){this.destroyed=true;}};allocations.push(b);return b;},
  createSampler:d=>d,createBindGroupLayout:d=>d,createBindGroup:d=>d,createPipelineLayout:d=>d,createShaderModule:d=>d,
  queue:{writeBuffer(b,offset,data,start=0,count){const scale=ArrayBuffer.isView(data)?data.BYTES_PER_ELEMENT||1:1,from=(data.byteOffset||0)+start*scale,size=count===undefined?data.byteLength-start*scale:count*scale;b.bytes.set(new Uint8Array(data.buffer||data,from,size),offset);writes.push({buffer:b,offset,size});},onSubmittedWorkDone:()=>Promise.resolve()}};
 const input=d=>{const layout=d.createBindGroupLayout({label:'shader-pack-inputs-shadow',entries:[{binding:0,buffer:{}},{binding:2,buffer:{}},{binding:3,buffer:{}}]});let group=d.createBindGroup({layout,entries:[{binding:0,resource:{buffer:device.createBuffer({size:80})}},{binding:2,resource:{buffer:{original:true}}},{binding:3,resource:{buffer:{shadow:true}}}]});return {device:d,layout,bindGroupFor:()=>group};};
 const terrain={device,chunks:new Map(),slots:{words:new Uint32Array(4096),markDirty(){}},geometry:{draw(pass,record){draws.push({record,group:pass.bound.get(3)});return 1;}},materialFor:m=>m,isBlended:m=>m.blended,
  setChunkMesh(mesh,value,origin){let old=this.chunks.get(mesh);const slot=old?.slot??nextSlot++;const packed=!!value.packedVertices,vertexCount=value.vertexCount??value.vertices.byteLength/28;
   const record={mesh,slot,origin,material:this.materialFor(mesh.material),packed,vertexCount,vertices:{start:8+slot*16},data:value};this.chunks.set(mesh,record);if(value.FE)this.setChunkMeshLight(mesh,value.FE);},
  setChunkMeshLight(mesh,light){const record=this.chunks.get(mesh);if(record&&light.length>=record.vertexCount)record.light=light.slice();},removeChunkMesh(mesh){this.chunks.delete(mesh);},shaderModule:s=>s,
  writeShaderPackInputs(){this.shaderPackInputs??=input(this.device);},bindShaderPackInputs(pass){this.writeShaderPackInputs();pass.setBindGroup(3,this.shaderPackInputs.bindGroupFor(null,true));}};
 const modelUniforms={writeModelUniforms(_outer,instance,model){instance.ubo.updateFloat4('vDiffuseColor',...model.diffuseColor,model.alpha);},refreshModelUniforms(outer,instance,model,view){if(instance.heldVersion===model.version)return true;this.writeModelUniforms(outer,instance,model,view);instance.heldVersion=model.version;return false;}};
 const meshes={device,modelUniforms,programs:new Map(),view:{eye:[0,2,0]},prepare(){this.packInputs??=input(this.device);},createProgram:(_key,code)=>({program:code})};
 const native={gpuDevice:device,terrain,meshes,drawFrame(){terrain.writeShaderPackInputs();meshes.prepare();}};
 const settings={enabled:true,waterEnabled:true,lavaEnabled:true,waterStyle:'wavey',lavaStyle:'wavey',waterPhysics:false,lavaPhysics:false,underwaterLight:0,lavaUnderwaterLight:0};
 const packet={packedVertices:new Uint32Array([(1<<24)|(1<<18)|(2<<6),123,2|(1<<5)|(2<<7)|(3<<9)]),vertexCount:4,FE:new Uint16Array([0x1234,0x5678,0x9abc,0xdef0]),faceGroups:[0,0,0,1,1,1,1,1,1,2,0,2,2,2,0]};
 const uniforms=()=>Object.fromEntries(require('../assets/native-liquids.json').fields.map(f=>[f.name,f.count*f.stride===4?0:Array(f.count*f.stride/4).fill(0)]));
 const environment={geometryKernel:()=>shared,liquidFrame(){const v=uniforms();v.uBvfxWaterMode=settings.enabled&&settings.waterEnabled?settings.waterStyle==='wavey'?2:1:0;v.uBvfxLavaMode=settings.enabled&&settings.lavaEnabled?settings.lavaStyle==='wavey'?2:1:0;v.uBvfxWaterOpacity=1;v.uBvfxLavaOpacity=1;v.uBvfxWaveSettings=[.06,1,0];v.uBvfxLavaWaveSettings=[.12,1,0];return v;},
  liquidMetadata:()=>({water:[123],lava:[],names:[]}),liquidWorld:()=>({loaded:()=>true,read:(_x,y)=>y===1?1:0,isWater:id=>id===1,isLava:id=>id===2}),reportNativeError:e=>errors.push(e),worldFrame:()=>({})};
 const globals={ArrayBuffer,DataView,Float32Array,Uint32Array,Uint16Array,Uint8Array,Map,Set,WeakMap,WeakSet,Proxy,console,performance:{now:()=>now+=.0001},GPUBufferUsage:{UNIFORM:1,STORAGE:2,COPY_DST:4},GPUShaderStage:{VERTEX:1,FRAGMENT:2}};
 class Blob {constructor(parts){this.source=parts.join('');}}
 class Worker {constructor(url){this.stopped=false;const self={postMessage:(data,transfer)=>messages.push([this,structuredClone(data,{transfer})])};this.context=vm.createContext({...globals,self});vm.runInContext(blobs.get(url).source,this.context);}
  postMessage(data,transfer){jobs.push([this,structuredClone(data,{transfer})]);}terminate(){this.stopped=true;}}
 const root={Worker,Blob,URL:{createObjectURL(b){const key='worker-'+blobs.size;blobs.set(key,b);return key;},revokeObjectURL:k=>blobs.delete(k)},__BLOXD_MOD_HOST__:{profile:{performance:'balanced'}}};
 const context=vm.createContext({...globals,root});for(const name of ['shader-native-liquids.js','shader-native-world.js'])vm.runInContext(fs.readFileSync(require.resolve('../builtin-mods/'+name),'utf8'),context);
 context.installNativeLiquids(root,{kernel:require('../assets/native-liquids.json'),geometry,job:prepareNativeLiquidJob,patch:patchNativeLiquidSource});
 const liquids=root.__BVFX_ATTACH_NATIVE_LIQUIDS__(native,settings,environment);
 context.installNativeWorld(root,{uniformBytes:world.worldUniformBytes,fields:world.worldParameterFields,patch:world.patchNativeWorldSource});
 const w=root.__BVFX_ATTACH_NATIVE_WORLD__(native,settings,environment,{groundState:()=>({view:{nativeGround:true},active:0})});
 const material={model:{name:'water'},liquid:true,texture:'atlas',blended:true,uniformData:new Float32Array(16),uniformBuffer:device.createBuffer({size:64})},mesh={material};terrain.setChunkMesh(mesh,packet,[0,0,0]);
 function finish(){const next=jobs.shift();if(next&&!next[0].stopped)next[0].context.self.onmessage({data:next[1]});while(messages.length){const [worker,data]=messages.shift();if(!worker.stopped)worker.onmessage({data});}}
 const tick=()=>native.drawFrame({av:{Wt:[0,0,0]}});
 return {r,native,settings,environment,packet,mesh,material,liquids,world:w,allocations,writes,draws,jobs,errors,root,finish,tick,
  pump(n=40){for(let i=0;i<n;i++){tick();finish();}},pass(){return {bound:new Map(),calls:[],setBindGroup(n,g){this.bound.set(n,g);this.calls.push([n,g]);}};},async dispose(){w.dispose();liquids.dispose();await Promise.resolve();await Promise.resolve();}};
}
module.exports={fixture};
