'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {managedSource}=require('../adapters.cjs'),{original,pack}=require('./litematica-runtime-fixture.cjs');
const payload=require('../assets/native-litematica.json');
async function nativeSchematic(){
 let now=0,actual=0,reads=0,box=null,blocks=[{x:0,y:0,z:0,name:'Stone',layer:0}],bindTick;const draws=[],buffers=[],textures=[],groups=[],writes=[];
 const device={limits:{minUniformBufferOffsetAlignment:256},createBindGroupLayout:d=>d,createPipelineLayout:d=>d,createSampler:d=>d,createShaderModule:d=>d,async createRenderPipelineAsync(d){return d;},
  createBuffer(d){const b={...d,data:new Uint8Array(d.size),destroy(){b.destroyed=true;}};buffers.push(b);return b;},
  createTexture(d){const t={...d,createView:()=>({texture:t}),destroy(){t.destroyed=true;}};textures.push(t);return t;},createBindGroup(d){groups.push(d);return d;},
  queue:{writeBuffer(b,offset,data,start=0,length=data.byteLength-start){const view=ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):new Uint8Array(data);b.data.set(view.subarray(start,start+length),offset);writes.push({buffer:b,offset,length});},writeTexture(){},copyExternalImageToTexture(){},onSubmittedWorkDone:()=>Promise.resolve()}};
 const scene={activeCamera:{},useRightHandedSystem:false},rootScene={_renderables:[]},sceneGroup={native:true},signature={_colorFormat:'bgra8unorm',_depthStencilFormat:'depth32float',_sampleCount:4,_depthCompare:'greater-equal'};
 const view={viewProjectionMatrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),eye:[0,0,0],renderWidth:800,renderHeight:600};let currentGroup=null,drawOffset=0,binding=null;
 const pass={setPipeline(p){this.pipeline=p;},setVertexBuffer(_i,b){this.buffer=b;},setBindGroup(_i,g,offsets){currentGroup=g;drawOffset=offsets?.[0]||0;},draw(length,_instances,start){draws.push({length,start,buffer:this.buffer,pipeline:this.pipeline,group:currentGroup,offset:drawOffset});}};
 const task={_targetSignature:signature,_config:{autoMirror:true},_sceneBG:sceneGroup,_renderables:[],record(){this._renderables=rootScene._renderables.slice();binding=this._renderables[0]?.bind({},signature);}};
 const native={gpuDevice:device,engine:{},Ln:rootScene,sceneTask:task,attach(){},terrain:{createBinding:()=>({pipeline:{placeholder:true}})},meshes:{view,prepare(_s,v){this.view=v;}},drawFrame(outer,realScene){this.meshes.prepare(realScene,view);binding?.draw(pass);}};
 const context=vm.createContext({console,ArrayBuffer,DataView,Uint8Array,Uint32Array,Float32Array,Float64Array,performance:{now:()=>now},document:{hidden:false},Image:class{},setInterval:fn=>(bindTick=fn,1),clearInterval(){},
  GPUBufferUsage:{UNIFORM:1,VERTEX:2,COPY_DST:4},GPUShaderStage:{VERTEX:1,FRAGMENT:2},GPUTextureUsage:{TEXTURE_BINDING:1,COPY_DST:2},payload,native});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../builtin-mods/litematica-native.js'),'utf8')+';installNativeLitematica(globalThis,payload);',context);
 const adapter=await context.__BLM_ATTACH_NATIVE_GPU__(native);native.attach({Ln:scene});const state={enabled:true,mode:'build',fill:true,showWrong:true,showExtra:true,renderMode:'all',layerMode:'all',layer:0,layerEnd:0,distance:128,placementTransparency:0,lineWidth:2.5,wrongTint:.35,extraTint:.08};
 const handle=context.__BLM_NATIVE_CONNECTION__(scene),raw={scene,canvas:{isConnected:true,addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({width:800})},nativeOverlay:handle,
  gpu:()=>handle.gpu,matrix:handle.matrix,camera:handle.camera,clip:handle.clip,origin:()=>[0,0,0],texture:()=>({color:[255,255,255]}),expected:name=>name==='Air'?0:1,actualName:()=> 'Dirt',read(){reads++;return {loaded:true,actual};}};
 context.__BLM_ADAPTER__={connect:()=>raw};
 for(const name of ['model.js','geometry.js','native-frame.js','renderer.js'])vm.runInContext(managedSource(pack.manifest.id,name,original(name)),context,{filename:name});
 const renderer=context.__BLM_CREATE_RENDERER__(()=>state,()=>blocks,()=>{},()=>box,()=>true);
 return {adapter,native,view,renderer,state,draws,buffers,textures,groups,writes,handle,raw,context,sceneGroup,get currentGroup(){return currentGroup;},get reads(){return reads;},
  frame(at=now){now=at;native.drawFrame({av:{Wt:[0,0,0]}},scene);},setActual(v){actual=v;},setBlocks(v){blocks=v;},setBox(v){box=v;},bind:()=>bindTick(),dispose(){renderer.destroy();adapter.dispose();}};
}
module.exports={nativeSchematic};
