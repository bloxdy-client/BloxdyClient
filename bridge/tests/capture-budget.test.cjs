'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const installCapture=require('../capture-factory.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);

async function harness({fixture=true,count=130,activeCount=0,blockMesh=false,asyncGPU=false,atlasLayer=0,atlasDepth=2,sourceBlockIdentity=false}={}){
  let now=1000,isTextureCalls=0,releaseMesh,sourceDraws=0;const faceReads=[];
  const intervals=[],packets=[],textureHandle={},fences=[];let bufferCopies=0,pboReads=0;
  const gl={canvas:{getBoundingClientRect:()=>({width:640,height:360})},drawingBufferWidth:640,drawingBufferHeight:360,
    FRAMEBUFFER_COMPLETE:1,READ_FRAMEBUFFER:2,DRAW_FRAMEBUFFER:3,COLOR_ATTACHMENT0:4,TEXTURE_2D:5,RGBA:6,UNSIGNED_BYTE:7,
    isTexture:()=>{++isTextureCalls;return true;},getParameter:()=>null,createFramebuffer:()=>({}),
    TEXTURE_CUBE_MAP_POSITIVE_X:34069,bindFramebuffer(){},bindBuffer(){},pixelStorei(){},framebufferTextureLayer(){},framebufferTexture2D(_target,_attachment,face){faceReads.push(face);},readBuffer(){},
    checkFramebufferStatus:()=>1,readPixels(_x,_y,_w,_h,_fmt,_type,pixels){pixels.fill(255);},deleteFramebuffer(){},
    drawArrays(){++sourceDraws;},drawElements(){++sourceDraws;},drawArraysInstanced(){++sourceDraws;},drawElementsInstanced(){++sourceDraws;}};
  Object.assign(gl,{texSubImage2D(){},texImage2D(){},activeTexture(unit){this._gpuActive?.(unit);},bindTexture(target,handle){this._gpuBind?.(target,handle);}});
  if(asyncGPU){
    Object.assign(gl,{PIXEL_PACK_BUFFER:35051,PIXEL_PACK_BUFFER_BINDING:35053,SYNC_GPU_COMMANDS_COMPLETE:37143,TIMEOUT_EXPIRED:37147,ALREADY_SIGNALED:37146,WAIT_FAILED:37149,STREAM_READ:35041,
      READ_FRAMEBUFFER_BINDING:36010,DRAW_FRAMEBUFFER_BINDING:36006,READ_BUFFER:3074,PACK_ALIGNMENT:3333,PACK_ROW_LENGTH:3330,PACK_SKIP_ROWS:3332,PACK_SKIP_PIXELS:3331,TEXTURE_2D_ARRAY:35866,TEXTURE0:33984,
      ARRAY_BUFFER:34962,ARRAY_BUFFER_BINDING:34964,ELEMENT_ARRAY_BUFFER:34963,ELEMENT_ARRAY_BUFFER_BINDING:34965});
    const values=new Map([[gl.PIXEL_PACK_BUFFER_BINDING,{source:true}],[gl.READ_FRAMEBUFFER_BINDING,{sourceRead:true}],[gl.DRAW_FRAMEBUFFER_BINDING,{sourceDraw:true}],[gl.READ_BUFFER,123],[gl.PACK_ALIGNMENT,8],[gl.PACK_ROW_LENGTH,3],[gl.PACK_SKIP_ROWS,2],[gl.PACK_SKIP_PIXELS,1]]);
    gl.getParameter=k=>values.get(k);gl.createBuffer=()=>({});gl.deleteBuffer=b=>b.deleted=true;
    gl.bindBuffer=(target,b)=>{if(target===gl.PIXEL_PACK_BUFFER)values.set(gl.PIXEL_PACK_BUFFER_BINDING,b);if(target===gl.ARRAY_BUFFER)values.set(gl.ARRAY_BUFFER_BINDING,b);if(target===gl.ELEMENT_ARRAY_BUFFER)values.set(gl.ELEMENT_ARRAY_BUFFER_BINDING,b);};
    gl.bufferData=(target,size)=>{if(target===gl.PIXEL_PACK_BUFFER)values.get(gl.PIXEL_PACK_BUFFER_BINDING).bytes=new Uint8Array(size);};
    gl.bufferSubData=()=>{};
    gl.bindFramebuffer=(target,f)=>values.set(target===gl.READ_FRAMEBUFFER?gl.READ_FRAMEBUFFER_BINDING:gl.DRAW_FRAMEBUFFER_BINDING,f);
    gl.readBuffer=b=>values.set(gl.READ_BUFFER,b);gl.pixelStorei=(key,value)=>values.set(key,value);
    gl.readPixels=(_x,_y,w,h,_fmt,_type,offset)=>{assert.equal(typeof offset,'number');++pboReads;values.get(gl.PIXEL_PACK_BUFFER_BINDING).bytes.fill(255,offset,offset+w*h*4);};
    gl.fenceSync=()=>{const fence={ready:false};fences.push(fence);return fence;};gl.flush=()=>{};
    gl.clientWaitSync=(fence,_flags,timeout)=>{assert.equal(timeout,0);return fence.ready?gl.ALREADY_SIGNALED:gl.TIMEOUT_EXPIRED;};gl.deleteSync=fence=>fence.deleted=true;
    gl.getBufferSubData=(_target,_offset,pixels)=>{++bufferCopies;new Uint8Array(pixels.buffer,pixels.byteOffset,pixels.byteLength).set(values.get(gl.PIXEL_PACK_BUFFER_BINDING).bytes);};
    gl.bindTexture=function(target,handle){this._gpuBind?.(target,handle);};gl.texSubImage3D=()=>{};
    const baseline=new Map(values);gl.validateState=()=>{for(const [key,value] of baseline)assert.equal(values.get(key),value);};
  }
  class FakeWebGL2 {}
  class FakeWorker {
    constructor(){this.calls=[];this.listeners=new Set();this.failure=null;this.result={sent:true};}
    postMessage(...args){this.calls.push({receiver:this,args});if(this.failure)throw this.failure;return this.result;}
    addEventListener(type,fn){if(type==='message')this.listeners.add(fn);}
    removeEventListener(type,fn){if(type==='message')this.listeners.delete(fn);}
    reply(data){for(const fn of this.listeners)fn({data});}
  }
  const originalWorkerPost=FakeWorker.prototype.postMessage;
  for(const [name,value] of Object.entries(gl))if(typeof value==='function')FakeWebGL2.prototype[name]=value;
  const sourceGL=new FakeWebGL2();for(const [name,value] of Object.entries(gl))if(typeof value!=='function')sourceGL[name]=value;
  function mesh(){
    // Each cloned plugin refers to the exact same GPU atlas.
    const texture={getInternalTexture:()=>({width:1,height:1,depth:atlasDepth,is2DArray:true,_hardwareTexture:{underlyingResource:textureHandle}})};
    const data={position:new Float32Array([0,0,0,1,0,0,0,1,0]),normal:new Float32Array([0,0,1,0,0,1,0,0,1]),uv:new Float32Array(6),
      color:new Float32Array([.25,.5,.75,.25,.5,.75,.25,.5,.75]),texAtlasIndices:new Float32Array(3).fill(atlasLayer)};
    const buffers={};for(const key of Object.keys(data))buffers[key]={getBuffer:()=>({getBuffer:()=>null}),getSize:()=>key==='color'?3:2};
    return {isVisible:true,material:{alpha:1,pluginManager:{_plugins:[{textureAtlases:[texture]}]}},
      _geometry:{_vertexBuffers:buffers,_indices:new Uint32Array([0,1,2])},world:identity(),data,getVerticesData:k=>data[k],getWorldMatrix(){return {m:this.world};},
      getTotalVertices:()=>3,getTotalIndices:()=>3};
  }
  const meshes=Array.from({length:count},mesh);
  const scene={meshes,materials:[],activeCamera:{position:{x:0,y:0,z:0},getViewMatrix:()=>({m:identity()}),getProjectionMatrix:()=>({m:identity()})},
    getEngine:()=>({_gl:sourceGL}),onAfterRenderObservable:{}};
  let active=activeCount?meshes.slice(-activeCount):null;scene.getActiveMeshes=()=>({data:active||scene.meshes,length:(active||scene.meshes).length});
  const observers=new Set();scene.onAfterActiveMeshesEvaluationObservable={add(fn){observers.add(fn);return fn;},remove(fn){observers.delete(fn);}};
  class Noa {constructor(){this.uR=[0,0,0];this.container={};this.inputs={};this.renderer={scene};}}
  const root=new Noa();
  const context=vm.createContext({performance:{now:()=>now},setInterval(fn,delay){const entry={fn,delay};intervals.push(entry);return entry;},clearInterval(){},setTimeout:()=>0,clearTimeout(){},queueMicrotask,
    addEventListener(){},location:{hostname:'bloxd.io'},document:{readyState:'complete',visibilityState:'visible',body:{innerText:''},querySelectorAll:()=>[]},
    bloxdNative:{async send(buffer){const copy=Buffer.from(new Uint8Array(buffer));packets.push(copy);if(blockMesh&&copy.readUInt32LE(4)===3){blockMesh=false;await new Promise(resolve=>releaseMesh=resolve);}},status(){}},
    testSingletons:{noa:root},config:{fixture,...(sourceBlockIdentity===null?{}:{sourceBlockIdentity})},WebGL2RenderingContext:FakeWebGL2,Worker:FakeWorker});
  vm.runInContext(`(${installCapture.toString()})(config); Object.defineProperty({getBloxd(){}},'singletons',{value:testSingletons});`,context);
  await settle();const api=context.__BLOXD_NATIVE_CAPTURE__;
  return {api,packets,scene,root,intervals,faceReads,sourceGL,context,originalWorkerPost,sourceDraws:()=>sourceDraws,setActive(meshes){active=meshes;for(const fn of observers)fn();},advance(ms){now+=ms;},isTextureCalls:()=>isTextureCalls,release(){releaseMesh?.();},async tick(){intervals[0].fn();await settle();},
    signalGPU(){for(const fence of fences)fence.ready=true;},copies:()=>bufferCopies,pboReads:()=>pboReads,validateState:()=>gl.validateState?.(),
    modifyLayer(layer){sourceGL.bindTexture(sourceGL.TEXTURE_2D_ARRAY,textureHandle);sourceGL.texSubImage3D(sourceGL.TEXTURE_2D_ARRAY,0,0,0,layer,1,1,1,sourceGL.RGBA,sourceGL.UNSIGNED_BYTE,new Uint8Array(4));},
    writeBuffer(handle,target=34962){sourceGL.bindBuffer(target,handle);sourceGL.bufferSubData(target,0,new Float32Array(1));}};
}

function sourceLighting(){return {yy:true,sm:[.8,.9,1],ym:[.1,.15,.2],XY:[0,0,0],WY:0,pY:[0,0,0],FY:0,rm:[]};}
function sourceParticles(h){
  const handle={},system={getClassName:()=> 'sY',particles:[{position:{x:2,y:3,z:4},color:{r:1,g:.5,b:.25,a:.75},size:2,scale:{x:1,y:.5},angle:0}],getActiveCount(){return this.particles.length;},
    isBillboardBased:true,billboardMode:7,isLocal:false,blendMode:2,textureMask:{r:1,g:1,b:1,a:1},translationPivot:{x:0,y:0},particleTexture:{getInternalTexture:()=>({width:1,height:1,_hardwareTexture:{underlyingResource:handle}})}};
  h.scene.particleSystems=[system];h.scene._activeParticleSystems={data:[system],length:1};return system;
}
function sourceRamp(system){const handle={},texture={wrapU:0,wrapV:2,getInternalTexture:()=>({width:4,height:1,samplingMode:1,_hardwareTexture:{underlyingResource:handle}})};
  system.useRampGradients=true;system._rampGradients=[{gradient:0},{gradient:1}];system._rampGradientsTexture=texture;system.particles[0].remapData={x:.1,y:.8,z:.2,w:.6};return {handle,texture};}
function particlePacket(packet){
  const type=packet.readUInt32LE(4),extended=type>=28,stride=type===29?32:extended?28:20,at=type===29?76:extended?60:32,count=packet.readUInt32LE(24),base=type===29?52:36;
  assert.equal(packet.length,at+count*stride*4);return {id:packet.readUInt32LE(20),count,order:packet.readUInt32LE(28),mode:extended?packet.readUInt32LE(32):0,
    ramp:type===29?packet.readUInt32LE(36):0,blend:type===29?packet.readUInt32LE(40)-1:null,wrap:type===29?[packet.readUInt32LE(44),packet.readUInt32LE(48)]:[1,1],
    pivot:extended?[packet.readFloatLE(base),packet.readFloatLE(base+4)]:[0,0],mask:extended?Array.from({length:4},(_,i)=>packet.readFloatLE(base+8+i*4)):[1,1,1,1],
    records:Array.from({length:count},(_,i)=>Array.from({length:stride},(_,c)=>packet.readFloatLE(at+(i*stride+c)*4)))};
}
function sourceDrawObservation(h,mesh){
  const hooks=new Set(),view=identity(),projection=identity(),engine=h.scene.getEngine();
  mesh.onBeforeDrawObservable={add(fn){hooks.add(fn);return fn;},remove(fn){hooks.delete(fn);}};
  h.scene.getEngine=()=>engine;h.scene.getViewMatrix=()=>({m:view});h.scene.getProjectionMatrix=()=>({m:projection});
  h.scene.getAutoClearDepthStencilSetup=()=>({cY:true,depth:true,stencil:true});
  return {hooks,view,projection,engine,fire(){for(const fn of hooks)fn(mesh);}};
}
function authoritativeSource(h){
  const root=h.root,scene=h.scene,camera=scene.activeCamera,engine=scene.getEngine();
  const feet={OI:[2,3,4]},eye={OI:[2,4.6,4]},components=new Map([[7,feet],[8,eye]]);let frame=1;
  // Inert profile mocks; the matching source excerpts are audited separately.
  root.constructor=function Noa(){this.Lj=[0,0,0];this.bY=Rs.add();};
  root.Lj=[1000000000.25,64,-100];root.bY=7;
  root.entities=root.hY={my:root,le:id=>components.get(id),kI:()=>({CD:root.bY}),
    WI(ss,ys){Ys().copy(ys.OI,ys.vD);var vs=ys.Lj??this.my.Lj;}};
  root.camera={cI:8,NI(){return this.my.hY.le(this.cI).OI;}};
  root.vy={my:root,tY:scene,camera};camera.position={x:2,y:4.6,z:4};
  const view=identity(),projection=identity();view[12]=-2;view[13]=-4.6;view[14]=-4;
  camera.getViewMatrix=()=>({m:view});camera.getProjectionMatrix=()=>({m:projection});
  scene.getEngine=()=>engine;scene.getFrameId=()=>frame;
  const after=new Set();scene.onAfterRenderObservable={add(fn){after.add(fn);return fn;},remove(fn){after.delete(fn);}};
  return {feet,eye,view,projection,components,camera,engine,after,complete(){for(const fn of after)fn();},next(){++frame;}};
}

test('render-sampled player and hand arrive in one validated transaction with distinct source semantics',async()=>{
  const {validatePacket}=require('../transport.cjs'),h=await harness({count:1}),s=authoritativeSource(h),mesh=h.scene.meshes[0];
  mesh.renderingGroupId=1;mesh.ignoreCameraMaxZ=true;const draw=sourceDrawObservation(h,mesh);
  draw.view.set(s.view);draw.projection.set(s.projection);
  try{
    await h.api.resync();draw.fire();s.complete();await h.api.flush();
    const p=h.packets.filter(p=>p.readUInt32LE(4)===30).at(-1);validatePacket(p);
    assert.equal(p.length,452);assert.equal(p.readUInt32LE(24),4|8|16|32);assert.equal(p.readUInt32LE(48),7);
    assert.equal(p.readDoubleLE(264),h.root.Lj[0]+2);assert.equal(p.readDoubleLE(288),h.root.Lj[0]+2);assert.equal(p.readDoubleLE(296),68.6);
    assert.equal(p.readFloatLE(312+13*4),Math.fround(-4.6));assert.equal(p.readFloatLE(376),1);
    // Actual capture bytes feed the transport validator; record a CPU wire fixture.
    const fs=require('node:fs'),path=require('node:path');const out=path.join(__dirname,'../../outputs/native-renderer-verification/source-frame.bin');
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,p);
    assert.deepEqual(s.feet.OI,[2,3,4]);assert.deepEqual(s.eye.OI,[2,4.6,4]);
    h.advance(251);draw.fire();await h.api.flush();const stale=h.packets.filter(p=>p.readUInt32LE(4)===30).at(-1);assert.equal(stale.readUInt32LE(24),0);assert.equal(stale.length,240);
  }finally{h.api.stop();assert.equal(s.after.size,0);}
});

test('source identity, frame, resize, origin and player changes cannot reuse observed hand data',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),mesh=h.scene.meshes[0];mesh.renderingGroupId=1;mesh.ignoreCameraMaxZ=true;const draw=sourceDrawObservation(h,mesh);draw.view.set(s.view);
  const last=()=>h.packets.filter(p=>p.readUInt32LE(4)===30).at(-1).readUInt32LE(24);
  try{await h.api.resync();draw.fire();s.complete();await h.api.flush();assert.equal(last(),60);
    s.next();await h.api.flush();assert.equal(last(),0);
    draw.fire();s.complete();await h.api.flush();assert.equal(last(),60);
    s.feet.OI[0]++;await h.api.flush();assert.equal(last(),0);s.feet.OI[0]--;
    h.sourceGL.drawingBufferWidth=800;await h.api.flush();assert.equal(last(),0);h.sourceGL.drawingBufferWidth=640;
    h.root.bY=9;await h.api.flush();assert.equal(last(),0);h.root.bY=7;
    const oldCamera=h.scene.activeCamera;h.scene.activeCamera={...oldCamera};await h.api.flush();assert.equal(last(),0);h.scene.activeCamera=oldCamera;
    h.root.Lj[0]+=32;await h.api.flush();assert.equal(last(),0);draw.fire();s.complete();await h.api.flush();assert.equal(last(),60);
    s.components.set(7,{OI:[2,3,4]});await h.api.flush();assert.equal(last(),0);
    draw.fire();s.complete();await h.api.flush();assert.equal(last(),60);
    s.components.get(7).Lj=[NaN,0,0];await h.api.flush();assert.equal(last(),0);
  }finally{h.api.stop();}
});

test('malformed atomic source frames fail before transport write; unavailable data has no neutral replacements',async()=>{
  const {validatePacket}=require('../transport.cjs'),h=await harness({count:1}),s=authoritativeSource(h);
  try{await h.api.resync();s.complete();await h.api.flush();const p=h.packets.filter(p=>p.readUInt32LE(4)===30).at(-1);assert.equal(p.length,312);validatePacket(p);
    for(const change of [b=>b.writeUInt32LE(2,20),b=>b.writeUInt32LE(64,24),b=>b.writeUInt32LE(0,28),b=>b.writeUInt32LE(0,40),b=>b.writeUInt32LE(0,52),b=>b.writeDoubleLE(NaN,264),b=>b.writeFloatLE(Infinity,68),b=>b.fill(0,68,132),b=>b.writeDoubleLE(-1,232)]){
      const bad=Buffer.from(p);change(bad);assert.throws(()=>validatePacket(bad),/source frame/);
    }
    const short=p.subarray(0,p.length-1);short.writeUInt32LE(short.length-16,8);assert.throws(()=>validatePacket(short),/source frame/);
    delete h.root.entities;await h.api.flush();const unknown=h.packets.filter(p=>p.readUInt32LE(4)===30).at(-1);assert.equal(unknown.length,240);assert.equal(unknown.readUInt32LE(24),0);validatePacket(unknown);
  }finally{h.api.stop();}
});
function drawPacket(packet){
  const flags=packet.readUInt32LE(28);let at=40;
  const result={group:packet.readUInt32LE(24)-1,flags,order:packet.readUInt32LE(32),part:packet.readUInt32LE(36)};
  if(flags&1){result.view=Array.from({length:16},(_,i)=>packet.readFloatLE(at+i*4));at+=64;result.projection=Array.from({length:16},(_,i)=>packet.readFloatLE(at+i*4));at+=64;result.camera=Array.from({length:3},(_,i)=>packet.readFloatLE(at+i*4));at+=12;}
  if(flags&16){result.center=Array.from({length:3},(_,i)=>packet.readFloatLE(at+i*4));at+=12;}
  result.alpha=packet.readDoubleLE(at);result.sort=packet.readDoubleLE(at+8);assert.equal(packet.length,at+16);return result;
}
function appearanceMesh(mesh,{layers=2,plugins=[]}={}){
  const handle={};mesh.material={alpha:1,getClassName:()=> 'nY',pluginManager:{_plugins:[{getClassName:()=> 'LifeformMaterialPlugin',numLayers:layers,atlasWidth:2,atlasHeight:2},...plugins]},
    diffuseTexture:{getInternalTexture:()=>({width:2,height:2,_hardwareTexture:{underlyingResource:handle}})},needAlphaTesting:()=>true};
  delete mesh._geometry._vertexBuffers.texAtlasIndices;delete mesh.data.texAtlasIndices;
  mesh.getVertexBuffer=k=>mesh._geometry._vertexBuffers[k];
  function attribute(kind,values,size=4){mesh.data[kind]=new Float32Array(values);mesh._geometry._vertexBuffers[kind]={getSize:()=>size,getIsInstanced:()=>false};}
  attribute('aAtlasIdx1',Array.from({length:3},()=>[0,3,0,0]).flat());return attribute;
}

test('Lifeform layers, overlay, dither and source entity light update without replacing geometry',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0],vy=sourceLighting();
  const attribute=appearanceMesh(mesh,{plugins:[{getClassName:()=> 'OverlayMaterialPlugin'},{getClassName:()=> 'DitherMaterialPlugin',ignoreTextureAlpha:false},{getClassName:()=> 'EntityLightMaterialPlugin',vy,uniformLevels:[.2,.4,.6,.8]}]});
  attribute('aOverlayColour',Array.from({length:3},()=>[1,0,0,.5]).flat());attribute('aOpacity',[.75,.75,.75],1);
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);assert.equal(h.api.status().skipped,0);
    const config=h.packets.find(p=>p.readUInt32LE(4)===18),data=h.packets.find(p=>p.readUInt32LE(4)===19);
    assert.equal(config.readUInt32LE(24),1|2|4|16|64);assert.equal(config.readUInt32LE(36),2);
    assert.equal(data.readUInt32LE(24),0);assert.equal(data.readUInt32LE(28),3);assert.equal(data.readUInt32LE(36),3);
    assert.equal(data.readFloatLE(40),0);assert.equal(data.readFloatLE(44),3);assert.equal(data.readFloatLE(40+11*4),.5);assert.equal(data.readFloatLE(40+16*4),.75);
    const before=h.api.status().meshUploads;mesh.data.aAtlasIdx1[0]=2;mesh.data.aOverlayColour[3]=.25;await h.api.flush();
    assert.equal(h.api.status().meshUploads,before);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===19).at(-1).readFloatLE(40),2);
    mesh.material.disableLighting=true;mesh.material.emissiveColor={r:1,g:1,b:1};await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===12).at(-1).readUInt32LE(24),1,'EntityLight must preserve intentionally unlit models');
  }finally{h.api.stop();}
});

test('thin Lifeform appearance uses each actual instance and preserves clearing the batch',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];appearanceMesh(mesh);
  const indices=new Float32Array([0,3,0,0,2,1,0,0]),matrices=new Float32Array(32);matrices.set(identity());matrices.set(identity(),16);matrices[28]=2;
  mesh._thinInstanceDataStorage={instancesCount:2,matrixData:matrices};mesh._geometry._vertexBuffers.aAtlasIdx1={getSize:()=>4,getIsInstanced:()=>true,getData:()=>indices,getFloatData:count=>indices.subarray(0,count*4)};
  const original=mesh.getVerticesData;mesh.getVerticesData=k=>{if(k==='aAtlasIdx1')throw Error('Instance attributes must not use vertex count.');return original(k);};
  try{await h.api.flush();assert.equal(h.api.status().skipped,0);const data=h.packets.find(p=>p.readUInt32LE(4)===19);assert.equal(data.readUInt32LE(24),1);assert.equal(data.readUInt32LE(28),2);assert.equal(data.readFloatLE(40+20*4),2);
    mesh._thinInstanceDataStorage.instancesCount=0;await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===19).at(-1).readUInt32LE(28),0);
  }finally{h.api.stop();}
});

test('source terrain lighting and TerrainFade are transferred as known material programs',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0],vy=sourceLighting();mesh.metadata={noa_chunk_terrain_mesh:true};mesh.visibility=.5;mesh.material.disableLighting=true;
  mesh.material.pluginManager._plugins.push({getClassName:()=> 'TerrainLightMaterialPlugin',vy,dirLightCount:0},{getClassName:()=> 'TerrainFadeMaterialPlugin'});
  mesh.data.aPackedLightLevels=new Float32Array([61440,61440,61440]);mesh._geometry._vertexBuffers.aPackedLightLevels={getIsInstanced:()=>false};
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);assert.equal(h.packets.find(p=>p.readUInt32LE(4)===3).readUInt32LE(28)&2,0,'terrain fading must use ordered dithering, not transparent sorting');
    assert.equal(h.packets.find(p=>p.readUInt32LE(4)===18).readUInt32LE(24),8|32|64);assert.equal(h.packets.find(p=>p.readUInt32LE(4)===12).readUInt32LE(24),0,'plugin lighting is not disabled by the StandardMaterial workaround');
    const uploads=h.api.status().meshUploads;mesh.visibility=.75;await h.api.flush();assert.equal(h.api.status().meshUploads,uploads,'fading must not rebuild chunk geometry');
    const updated=h.packets.filter(p=>p.readUInt32LE(4)===18).at(-1);assert.equal(updated.readFloatLE(44+14*4),.75);
    mesh.visibility=1;mesh.material.pluginManager._plugins=mesh.material.pluginManager._plugins.filter(p=>Array.isArray(p.textureAtlases));await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===18).at(-1).readUInt32LE(24),0,'removing plugins must clear native state');
  }finally{h.api.stop();}
});

test('unknown material programs remain named fallback; out-of-grid cosmetic indices cannot own output',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];appearanceMesh(mesh);mesh.data.aAtlasIdx1[0]=4;
  try{await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.status().error,/outside/);assert.equal(h.api.status().meshes,0);
    mesh.material.pluginManager._plugins.push({getClassName:()=> 'NewUnknownEffect'});await h.api.flush();assert.match(h.api.presentation().reason,/NewUnknownEffect/);
  }finally{h.api.stop();}
});

test('TerrainFade preserves genuinely translucent materials and disables fade-only dithering after arrival',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];mesh.material.alpha=.5;mesh.visibility=1;
  mesh.material.pluginManager._plugins.push({getClassName:()=> 'TerrainFadeMaterialPlugin',ditherOnlyWhileFading:true});
  try{await h.api.flush();assert.equal(h.packets.find(p=>p.readUInt32LE(4)===3).readUInt32LE(28)&2,2,'water-like materials must remain blended');
    let config=h.packets.filter(p=>p.readUInt32LE(4)===18).at(-1);assert.equal(config.readFloatLE(44+15*4),1);
    const before=h.api.status().meshUploads;mesh.visibility=.5;await h.api.flush();config=h.packets.filter(p=>p.readUInt32LE(4)===18).at(-1);
    assert.equal(config.readFloatLE(44+15*4),.25);assert.equal(h.api.status().meshUploads,before);
  }finally{h.api.stop();}
});

test('armour atlases and HueTint preserve independent instance constants with v2 records',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];appearanceMesh(mesh,{layers:1});
  mesh.material.pluginManager._plugins=[{getClassName:()=> 'ArmourMaterialPlugin',numTexturesInAtlas:2},{getClassName:()=> 'HueTintMaterialPlugin'},{getClassName:()=> 'OverlayMaterialPlugin'}];
  delete mesh._geometry._vertexBuffers.aAtlasIdx1;delete mesh.data.aAtlasIdx1;
  mesh.instancedBuffers={};mesh.Ge={aAtlasIdx1:1,aArmourTint:{r:.2,g:.4,b:.6},aHueColour:{r:1,g:0,b:0,a:1},aOverlayColour:{r:0,g:1,b:0,a:.5}};
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);
    const config=h.packets.find(p=>p.readUInt32LE(4)===18),data=h.packets.find(p=>p.readUInt32LE(4)===20);
    assert.equal(config.readUInt32LE(24),256|512|2);assert.equal(data.readFloatLE(40),1);assert.equal(data.readFloatLE(40+20*4),1);assert.ok(Math.abs(data.readFloatLE(40+17*4)-.2)<1e-6);
    const uploads=h.api.status().meshUploads;mesh.Ge.aArmourTint.r=.8;await h.api.flush();assert.equal(h.api.status().meshUploads,uploads);assert.ok(Math.abs(h.packets.filter(p=>p.readUInt32LE(4)===20).at(-1).readFloatLE(40+17*4)-.8)<1e-6);
    mesh.Ge.aHueColour.a=2;await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.status().error,/armour\/hue/);
  }finally{h.api.stop();}
});

test('per-face atlas records request the actual six texture layers and reject out-of-range indices',async()=>{
  const h=await harness({count:1,atlasDepth:16,asyncGPU:true,fixture:false}),mesh=h.scene.meshes[0];
  mesh._geometry._vertexBuffers.aAtlasIdxFaces012={getIsInstanced:()=>true};mesh._geometry._vertexBuffers.aAtlasIdxFaces345={getIsInstanced:()=>true};
  mesh.Ge={aAtlasIdxFaces012:[8,9,10],aAtlasIdxFaces345:[11,12,13]};
  try{await h.tick();assert.equal(h.api.status().skipped,0,h.api.status().error);assert.equal(h.api.status().pendingTextureLayers,7,'six mapped layers plus the base face are requested');
    const data=h.packets.find(p=>p.readUInt32LE(4)===20);assert.equal(data.readFloatLE(40),8);assert.equal(data.readFloatLE(40+5*4),13);
    h.signalGPU();h.advance(40);await h.tick();assert.equal(h.api.presentation().ready,true);
    mesh.data.texAtlasIndices[0]=6;await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.presentation().reason,/per-face atlas selector/);mesh.data.texAtlasIndices[0]=0;
    mesh.Ge.aAtlasIdxFaces345[2]=16;await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.status().error,/exceeds.*atlas/);
  }finally{h.api.stop();}
});

test('source sampling modes preserve min/mag, mipmap and sRGB contracts without geometry reimports',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];appearanceMesh(mesh);
  const handle={},internal={width:2,height:2,samplingMode:8,generateMipMaps:true,_useSRGBBuffer:true,_hardwareTexture:{underlyingResource:handle}};
  mesh.material.diffuseTexture.getInternalTexture=()=>internal;
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);
    let sampler=h.packets.find(p=>p.readUInt32LE(4)===21);assert.deepEqual([28,24,32].map(at=>sampler.readUInt32LE(at)),[9728,9986,1]);
    assert.equal(h.packets.find(p=>p.readUInt32LE(4)===4).readUInt32LE(44)&16,16);
    const uploads=h.api.status().meshUploads,reads=h.api.status().textureChunks;internal.samplingMode=2;await h.api.flush();sampler=h.packets.filter(p=>p.readUInt32LE(4)===21).at(-1);
    assert.equal(sampler.readUInt32LE(24),9729);assert.equal(sampler.readUInt32LE(32),0);assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.api.status().textureChunks,reads);
    internal.samplingMode=99;await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.presentation().reason,/sampling/);
  }finally{h.api.stop();}
});

test('source origins retain the low part beyond float32 precision and update once per rebase',async()=>{
  const h=await harness({count:1});h.root.uR=[16777217.25,0,-33554433.5];
  try{await h.api.flush();let origins=h.packets.filter(p=>p.readUInt32LE(4)===22);assert.equal(origins.length,1);const first=origins[0];assert.equal(first.readFloatLE(24)+first.readFloatLE(36),16777217.25);
    await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===22).length,1);
    h.root.uR[0]+=32;await h.api.flush();origins=h.packets.filter(p=>p.readUInt32LE(4)===22);assert.equal(origins.length,2);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===10).length,1);
  }finally{h.api.stop();}
});

test('source atlas animation preloads its exact frames and advances without mesh or pixel retransmission',async()=>{
  const h=await harness({count:1,atlasDepth:8,fixture:false}),mesh=h.scene.meshes[0],plugin=mesh.material.pluginManager._plugins[0];let tick=0;
  plugin.animDataPerTex=new Float32Array([2,4,100,0,0,0]);plugin.animTicker={getAnimTick:()=>tick};plugin.animData={y:50};
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);const uploaded=h.packets.filter(p=>p.readUInt32LE(4)===4);
    assert.deepEqual(uploaded.map(p=>[p.readUInt32LE(36),p.readUInt32LE(40)]),[[0,1],[4,2]]);assert.equal(h.api.status().pendingTextureLayers,0);
    let animation=h.packets.find(p=>p.readUInt32LE(4)===23);assert.equal(animation.readUInt32LE(24),2);assert.equal(animation.readFloatLE(32),50);
    const meshes=h.api.status().meshUploads,reads=h.api.status().textureChunks,revision=h.api.presentation().revision;tick=3;await h.api.flush();
    animation=h.packets.filter(p=>p.readUInt32LE(4)===23).at(-1);assert.equal(animation.readFloatLE(28),3);assert.equal(h.api.status().meshUploads,meshes);assert.equal(h.api.status().textureChunks,reads);assert.equal(h.api.presentation().revision,revision,'clock changes must not release source draw ownership');
    plugin.animDataPerTex[1]=7;await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.presentation().reason,/Animated atlas range/);
  }finally{h.api.stop();}
});

test('unknown custom shader resolvers and atlas-shaped unknown plugins remain source fallback',async()=>{
  for(const custom of [false,true]){const h=await harness({count:1}),mesh=h.scene.meshes[0];
    if(custom)mesh.material.customShaderNameResolve=()=> 'unmapped';else mesh.material.pluginManager._plugins[0].getClassName=()=> 'UnknownAtlasShader';
    try{await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.equal(h.api.status().meshes,0);assert.match(h.api.presentation().reason,custom?/shader resolution/:/UnknownAtlasShader/);}finally{h.api.stop();}
  }
});

test('cape joint poses update existing geometry and reject missing source defines',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0],plugin={getClassName:()=> 'CapeMaterialPlugin',skeleLen:2,_defines:{BLOXD_CAPE_MAX_Y:'1.0'},skele:new Float32Array([0,0,0,0,.25,.5])};
  mesh.material.pluginManager._plugins.push(plugin);mesh.data.position[2]=1;
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);const initial=h.packets.find(p=>p.readUInt32LE(4)===3);assert.equal(initial.readFloatLE(104+4),.25);assert.equal(initial.readFloatLE(104+8),1.5);
    const uploads=h.api.status().meshUploads;plugin.skele[3]=Math.PI/2;await h.api.flush();assert.equal(h.api.status().meshUploads,uploads);const pose=h.packets.filter(p=>p.readUInt32LE(4)===11).at(-1);assert.ok(Math.abs(pose.readFloatLE(28+4)+.75)<1e-6);assert.ok(Math.abs(pose.readFloatLE(28+8)-.5)<1e-6);
    delete plugin._defines.BLOXD_CAPE_MAX_Y;await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.presentation().reason,/cape pose/);
  }finally{h.api.stop();}
});

test('text sampling preserves LOD bias, premultiplied blend and forced depth without geometry reimports',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];appearanceMesh(mesh);delete mesh._geometry._vertexBuffers.aAtlasIdx1;delete mesh.data.aAtlasIdx1;
  const plugin={getClassName:()=> 'TextSamplerMaterialPlugin',lodBias:-.5};mesh.material.pluginManager._plugins=[plugin];Object.assign(mesh.material,{alphaMode:7,Ue:3,forceDepthWrite:true,useAlphaFromDiffuseTexture:true});mesh.material.diffuseTexture.hasAlpha=true;delete mesh.material.needAlphaTesting;
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);const draw=h.packets.find(p=>p.readUInt32LE(4)===17),state=h.packets.find(p=>p.readUInt32LE(4)===24);
    assert.equal(draw.readUInt32LE(32),7);assert.equal(draw.readUInt32LE(24)&8,8);assert.equal(h.packets.find(p=>p.readUInt32LE(4)===3).readUInt32LE(28)&2,2);assert.equal(state.readFloatLE(28),-.5);
    const uploads=h.api.status().meshUploads;plugin.lodBias=-.75;await h.api.flush();assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===24).at(-1).readFloatLE(28),-.75);
  }finally{h.api.stop();}
});

test('enchantment uses independent colour/speed/node records and clock-only changes keep ownership',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];mesh.material.pluginManager._plugins.push({getClassName:()=> 'EnchantmentMaterialPlugin'});
  mesh.material._uniformBuffer={_uniformLocations:{uAnimTick:0},_bufferData:new Float32Array([1234])};mesh.Ge={aEnchantmentColour:[.2,.4,.8],aEnchantmentSpeed:.5,aPosition:[1,2,3],aRotation:[.1,.2,.3],aOffset:[4,5,6]};
  for(const kind of ['aEnchantmentColour','aEnchantmentSpeed','aPosition','aRotation','aOffset'])mesh._geometry._vertexBuffers[kind]={getIsInstanced:()=>true};
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);const data=h.packets.find(p=>p.readUInt32LE(4)===25);assert.equal(data.readFloatLE(40+27*4),.5);assert.equal(data.readFloatLE(40+28*4),1);assert.ok(Math.abs(data.readFloatLE(40+31*4)-.2)<1e-6);assert.equal(data.readFloatLE(40+34*4),6);
    assert.equal(h.packets.find(p=>p.readUInt32LE(4)===24).readFloatLE(24),1234);const revision=h.api.presentation().revision,uploads=h.api.status().meshUploads,records=h.packets.filter(p=>p.readUInt32LE(4)===25).length;
    mesh.material._uniformBuffer._bufferData[0]=1500;await h.api.flush();assert.equal(h.api.presentation().revision,revision);assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===25).length,records);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===24).at(-1).readFloatLE(24),1500);
    mesh.Ge.aEnchantmentColour[0]=2;await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.status().error,/enchantment/);
  }finally{h.api.stop();}
});

test('CPU billboard particles use atomic instance/color batches without touching source meshes or simulation',async()=>{
  const h=await harness({count:1,fixture:false}),system=sourceParticles(h);system.update=()=>{throw Error('Capture must never advance particle simulation.');};
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);assert.equal(h.scene.meshes.length,1);assert.equal(h.api.status().meshes,2);
    const batch=h.packets.find(p=>p.readUInt32LE(4)===26),id=batch.readUInt32LE(20);assert.equal(batch.readUInt32LE(24),1);assert.equal(batch.readUInt32LE(28),0);assert.equal(batch.readFloatLE(32),2);assert.equal(batch.readFloatLE(32+12*4),2);assert.equal(batch.readFloatLE(32+17*4),.5);
    assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===9&&p.readUInt32LE(20)===id).length,0);
    const uploads=h.api.status().meshUploads,revision=h.api.presentation().revision;system.particles[0].position.x=5;system.particles[0].color.a=.25;await h.api.flush();
    assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.api.presentation().revision,revision);const update=h.packets.filter(p=>p.readUInt32LE(4)===26).at(-1);assert.equal(update.readFloatLE(32+12*4),5);assert.equal(update.readFloatLE(32+19*4),.25);
    const count=h.packets.filter(p=>p.readUInt32LE(4)===26).length;await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===26).length,count);
    system.particles.length=0;await h.api.flush();assert.equal(h.api.status().meshes,1);assert.ok(h.packets.some(p=>p.readUInt32LE(4)===8));assert.equal(h.scene.meshes.length,1);
  }finally{h.api.stop();}
});

test('inactive cached particles do not block rendering, but GPU/special/oversized systems keep fallback',async()=>{
  for(const mode of ['inactive','gpu','billboard','sheet','mask','oversized']){const h=await harness({count:1}),system=sourceParticles(h);
    if(mode==='inactive')h.scene._activeParticleSystems.length=0;if(mode==='gpu')system.getClassName=()=> 'GPUParticleSystem';if(mode==='billboard')system.billboardMode=5;if(mode==='sheet')system._isAnimationSheetEnabled=true;if(mode==='mask')system.textureMask.r=-1;if(mode==='oversized')system.getActiveCount=()=>8193;
    try{await h.api.flush();assert.equal(h.api.presentation().ready,mode==='inactive',mode+': '+h.api.presentation().reason);if(mode!=='inactive'){assert.equal(h.api.status().meshes,0);assert.match(h.api.presentation().reason,/particle/i);}}
    finally{h.api.stop();}
  }
});

test('particle system order and pivot updates preserve source selection and the static quad',async()=>{
  const h=await harness({count:1,fixture:false}),first=sourceParticles(h),second=sourceParticles(h);h.scene.particleSystems=[first,second];h.scene._activeParticleSystems={data:[first,second],length:2};
  first.translationPivot={x:.2,y:-.1};first.particles[0].angle=Math.PI/2;
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);
    const batches=h.packets.filter(p=>[26,28].includes(p.readUInt32LE(4))).map(particlePacket),ids=batches.map(p=>p.id);assert.deepEqual(batches.map(p=>p.order),[0,1]);
    const transform=batches[0].records[0];assert.ok(Math.abs(transform[0])<1e-6);assert.equal(transform[1],2);assert.equal(transform[4],-1);
    assert.ok(Math.abs(batches[0].pivot[0]-.2)<1e-6);assert.ok(Math.abs(batches[0].pivot[1]+.1)<1e-6);assert.equal(h.packets.some(p=>p.readUInt32LE(4)===24&&p.readUInt32LE(20)===ids[0]),false);
    const uploads=h.api.status().meshUploads;h.scene._activeParticleSystems.data=[second,first];await h.api.flush();assert.equal(h.api.status().meshUploads,uploads);
    const updates=h.packets.filter(p=>[26,28].includes(p.readUInt32LE(4))).slice(-2).map(particlePacket);assert.deepEqual(updates.map(p=>[p.id,p.order]),[[ids[1],0],[ids[0],1]]);
    h.scene._activeParticleSystems.length=3;await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.presentation().reason,/authoritative/);
  }finally{h.api.stop();}
});

test('unmapped render groups and hand-camera overrides retain source rendering',async()=>{
  for(const mode of ['group','hand']){const h=await harness({count:1});if(mode==='group')h.scene.meshes[0].renderingGroupId=1;else h.scene.meshes[0].ignoreCameraMaxZ=true;
    try{await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.presentation().reason,/depth policy|isolated positive render group/);assert.equal(h.api.status().meshes,0);}finally{h.api.stop();}}
});

test('source-observed group and hand projections preserve real matrices without changing camera state',async()=>{
  const h=await harness({count:1,fixture:false}),mesh=h.scene.meshes[0],observation=sourceDrawObservation(h,mesh);mesh.renderingGroupId=1;mesh.ignoreCameraMaxZ=true;mesh.material.uniqueId=77;
  observation.projection[0]=2;observation.view[12]=-4;observation.engine.isNDCHalfZRange=true;
  try{await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.equal(observation.hooks.size,1);assert.match(h.api.presentation().reason,/current source draw camera/);
    observation.fire();await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);
    const state=drawPacket(h.packets.find(p=>p.readUInt32LE(4)===27));assert.equal(state.group,1);assert.equal(state.flags,15);assert.equal(state.sort,77);assert.equal(state.view[12],-4);assert.equal(state.projection[0],2);assert.equal(state.alpha,Number.MAX_VALUE);
    assert.equal(mesh.ignoreCameraMaxZ,true);assert.equal(h.scene.activeCamera.getProjectionMatrix().m[0],1);
    const uploads=h.api.status().meshUploads,revision=h.api.presentation().revision;assert.equal(h.api.setPresentation(true,h.api.status().epoch,revision),true);
    observation.projection[0]=3;observation.fire();await h.api.flush();assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.api.presentation().revision,revision);assert.equal(drawPacket(h.packets.filter(p=>p.readUInt32LE(4)===27).at(-1)).projection[0],3);
    h.scene.getAutoClearDepthStencilSetup=()=>({autoClear:false,depth:true});assert.equal(h.api.presentation().ready,false);await h.api.flush();assert.equal(h.api.presentation().ready,true);assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===27).at(-1).readUInt32LE(28),13);
  }finally{h.api.stop();assert.equal(observation.hooks.size,0);}
});

test('draw-camera observation ignores offscreen passes and fails open on stale, invalid or rebased data',async()=>{
  const h=await harness({count:1,fixture:false}),mesh=h.scene.meshes[0],observation=sourceDrawObservation(h,mesh);mesh.ignoreCameraMaxZ=true;mesh.renderingGroupId=1;
  try{await h.api.flush();h.sourceGL.getParameter=()=>({offscreen:true});observation.fire();await h.api.flush();assert.equal(h.api.presentation().ready,false);
    h.sourceGL.getParameter=()=>null;h.scene._isInIntermediateRendering=()=>true;observation.fire();await h.api.flush();assert.equal(h.api.presentation().ready,false);
    h.scene._isInIntermediateRendering=()=>false;observation.fire();await h.api.flush();assert.equal(h.api.presentation().ready,true);
    observation.projection.fill(0);observation.fire();assert.equal(h.api.presentation().ready,false);assert.match(h.api.presentation().reason,/singular/);
    observation.projection.set(identity());observation.fire();await h.api.flush();assert.equal(h.api.presentation().ready,true);
    h.advance(251);assert.equal(h.api.presentation().ready,false);await h.api.flush();assert.match(h.api.presentation().reason,/current source draw camera/);
    observation.fire();await h.api.flush();assert.equal(h.api.presentation().ready,true);
    h.root.uR[0]=10;assert.equal(h.api.presentation().ready,false);await h.api.flush();assert.equal(h.api.presentation().ready,false);observation.fire();await h.api.flush();assert.equal(h.api.presentation().ready,true);
    observation.view[0]=NaN;observation.fire();assert.equal(h.api.presentation().ready,false);
  }finally{h.api.stop();assert.equal(observation.hooks.size,0);}
});

test('draw ordering retains double alpha indices, source centers and active-list order without reimporting geometry',async()=>{
  const h=await harness({count:2}),[first,second]=h.scene.meshes;first.alphaIndex=-Number.MAX_VALUE;first.material.uniqueId=123;first.getBoundingInfo=()=>({boundingSphere:{centerWorld:{x:2,y:3,z:4}}});
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true);const states=h.packets.filter(p=>p.readUInt32LE(4)===27),id=states[0].readUInt32LE(20),state=drawPacket(states[0]);assert.equal(state.flags,16);assert.equal(state.alpha,-Number.MAX_VALUE);assert.deepEqual(state.center,[2,3,4]);
    const uploads=h.api.status().meshUploads;h.setActive([second,first]);assert.equal(h.api.presentation().ready,false);await h.api.flush();assert.equal(h.api.presentation().ready,true);assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===27&&p.readUInt32LE(20)===id).at(-1).readUInt32LE(32),1);
    first.alphaIndex=NaN;await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.presentation().reason,/draw ordering/);
  }finally{h.api.stop();}
});

test('Bloxd negative sky group, material-ID transparency sorting and camera-attached overlays use source contracts',async()=>{
  const h=await harness({count:2}),[sky,hand]=h.scene.meshes,skyObservation=sourceDrawObservation(h,sky),handHooks=new Set();
  hand.onBeforeDrawObservable={add(fn){handHooks.add(fn);return fn;},remove(fn){handHooks.delete(fn);}};
  sky.renderingGroupId=-1;hand.parent={parent:h.scene.activeCamera};hand.renderingGroupId=1;hand.material.uniqueId=Number.MAX_SAFE_INTEGER;
  class SourceGroup {static oY(){}static defaultTransparentSortCompare(){}static backToFrontSortCompare(){}static frontToBackSortCompare(){}}
  const groups=[];groups[-1]={constructor:SourceGroup};groups[1]={constructor:SourceGroup};
  h.scene._renderingManager={_renderingGroups:groups,_customOpaqueSortCompareFn:{'-1':SourceGroup.oY,1:SourceGroup.oY},_customAlphaTestSortCompareFn:{'-1':SourceGroup.oY,1:SourceGroup.oY},_customTransparentSortCompareFn:{'-1':SourceGroup.oY,1:SourceGroup.oY}};
  try{await h.api.flush();assert.equal(skyObservation.hooks.size,1);assert.equal(handHooks.size,1);skyObservation.fire();for(const fn of handHooks)fn(hand);await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.presentation().reason);
    const states=h.packets.filter(p=>p.readUInt32LE(4)===27).map(drawPacket);assert.equal(states[0].group,-1);assert.equal(states[0].flags&32,32);assert.equal(states[1].flags&8,8);assert.equal(states[1].sort,Number.MAX_SAFE_INTEGER);
    const uploads=h.api.status().meshUploads;h.scene._renderingManager._customTransparentSortCompareFn[1]=SourceGroup.frontToBackSortCompare;await h.api.flush();assert.equal(h.api.status().meshUploads,uploads);assert.equal(drawPacket(h.packets.filter(p=>p.readUInt32LE(4)===27).at(-1)).flags&128,128);
  }finally{h.api.stop();assert.equal(skyObservation.hooks.size,0);assert.equal(handHooks.size,0);}
});

test('unsupported group policies and other fallback programs do not install camera observers',async()=>{
  for(const mode of ['customsort','group','policy','visualmod','mixedoverlay']){const h=await harness({count:1}),mesh=h.scene.meshes[0],observation=sourceDrawObservation(h,mesh);mesh.renderingGroupId=1;
    if(mode==='customsort')h.scene._renderingManager={_customTransparentSortCompareFn:{1:()=>0}};if(mode==='group')mesh.renderingGroupId=4;if(mode==='policy')h.scene.getAutoClearDepthStencilSetup=()=>null;if(mode==='visualmod')h.context.__BVFX_DOCUMENT_START__=true;
    if(mode==='mixedoverlay'){mesh.renderingGroupId=0;mesh.parent=h.scene.activeCamera;}
    try{await h.api.flush();assert.equal(h.api.presentation().ready,false,mode);assert.equal(observation.hooks.size,0,mode);assert.equal(h.api.status().meshes,0);}finally{h.api.stop();}}
});

test('draw-camera observers are removed when the source mesh is deselected or the scene resets',async()=>{
  const h=await harness({count:2}),mesh=h.scene.meshes[0],observation=sourceDrawObservation(h,mesh);mesh.renderingGroupId=1;
  try{await h.api.flush();assert.equal(observation.hooks.size,1);h.setActive([h.scene.meshes[1]]);await h.api.flush();assert.equal(observation.hooks.size,0);h.setActive([mesh]);await h.api.flush();assert.equal(observation.hooks.size,1);
    await h.api.resync();assert.equal(observation.hooks.size,1);assert.equal(h.api.presentation().ready,false);observation.fire();await h.api.flush();assert.equal(h.api.presentation().ready,true);
  }finally{h.api.stop();assert.equal(observation.hooks.size,0);}
});

test('invalid particle snapshots fail open and zero source-active lists never import cached systems',async()=>{
  const h=await harness({count:1}),system=sourceParticles(h);system.particles[0].position.x=NaN;
  try{await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.match(h.api.status().error,/particle state/);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===26).length,0);
    system.particles[0].position.x=2;h.scene._activeParticleSystems.length=0;await h.api.flush();assert.equal(h.api.presentation().ready,true);
  }finally{h.api.stop();}
});

test('animated CPU particle sheets retain source UV cells, flipped rows and non-instanced inset without rebuilding quads',async()=>{
  const h=await harness({count:1}),system=sourceParticles(h);
  const handle={};system.particleTexture.getInternalTexture=()=>({width:4,height:2,_hardwareTexture:{underlyingResource:handle}});system.particleTexture.getBaseSize=()=>({width:4,height:2});
  Object.assign(system,{isAnimationSheetEnabled:true,spriteCellWidth:2,spriteCellHeight:1,_useInstancing:false,_epsilon:.01});system.particles[0].cellIndex=3;
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);const first=particlePacket(h.packets.find(p=>p.readUInt32LE(4)===28));assert.equal(first.mode,0);const rect=first.records[0].slice(20,24);for(const [i,expected] of [.505,.995,.49,-.49].entries())assert.ok(Math.abs(rect[i]-expected)<1e-6);assert.ok(Math.abs(first.records[0][27]-.98)<1e-6);
    const uploads=h.api.status().meshUploads,revision=h.api.presentation().revision;system.particles[0].cellIndex=0;await h.api.flush();assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.api.presentation().revision,revision);const update=particlePacket(h.packets.filter(p=>p.readUInt32LE(4)===28).at(-1));assert.ok(Math.abs(update.records[0][20]-.005)<1e-6);assert.ok(Math.abs(update.records[0][21]-.495)<1e-6);
    const batches=h.packets.filter(p=>p.readUInt32LE(4)===28).length;await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===28).length,batches);
    system.isAnimationSheetEnabled=false;await h.api.flush();const cleared=particlePacket(h.packets.filter(p=>p.readUInt32LE(4)===28).at(-1));assert.deepEqual(cleared.records[0].slice(20,24),[0,0,1,1]);assert.equal(cleared.records[0][27],1);
  }finally{h.api.stop();}
});

test('Y, stretched and local-stretched particles carry actual directions while local positions remain source-world positions',async()=>{
  for(const [billboard,mode] of [[2,1],[8,2],[9,3]]){const h=await harness({count:1}),system=sourceParticles(h);system.billboardMode=billboard;system.isLocal=true;system.particles[0].direction={x:0,y:1,z:0};system.particles[0]._properties={localPosition:{x:900,y:800,z:700}};
    try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);const batch=particlePacket(h.packets.find(p=>p.readUInt32LE(4)===28));assert.equal(batch.mode,mode);assert.deepEqual(batch.records[0].slice(12,15),[2,3,4]);assert.deepEqual(batch.records[0].slice(24,27),mode===1?[0,0,0]:[0,1,0]);assert.deepEqual(system.particles[0].position,{x:2,y:3,z:4});}finally{h.api.stop();}}
});

test('direction-fixed local particles transform only initial direction and apply source world/floating offsets without mutation',async()=>{
  const h=await harness({count:1}),system=sourceParticles(h),emitter=identity();emitter[0]=0;emitter[1]=2;emitter[4]=-3;emitter[5]=0;emitter[12]=100;
  Object.assign(system,{isBillboardBased:false,isLocal:true,_emitterWorldMatrix:{m:emitter},iD:{x:8,y:9,z:10}});h.scene.floatingOriginOffset={x:1,y:2,z:3};system.particles[0].direction={x:7,y:8,z:9};const initial={x:0,y:1,z:0};system.particles[0]._properties={initialDirection:initial};
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);const batch=particlePacket(h.packets.find(p=>p.readUInt32LE(4)===28));assert.equal(batch.mode,4);assert.deepEqual(batch.records[0].slice(12,15),[9,10,11]);assert.deepEqual(batch.records[0].slice(24,27),[-3,0,0]);assert.deepEqual(initial,{x:0,y:1,z:0});assert.deepEqual(system.particles[0].position,{x:2,y:3,z:4});
    system.isLocal=false;system.particles[0]._properties.initialDirection={x:0,y:1,z:0};await h.api.flush();const vertical=particlePacket(h.packets.filter(p=>p.readUInt32LE(4)===28).at(-1));assert.ok(Math.abs(vertical.records[0][24]-.001)<1e-8);assert.deepEqual(system.particles[0]._properties.initialDirection,{x:0,y:1,z:0});
  }finally{h.api.stop();}
});

test('particle masks, HDR colors and pivot changes arrive atomically and neutral transitions clear extended state',async()=>{
  const h=await harness({count:1}),system=sourceParticles(h);system.textureMask={r:.5,g:0,b:1,a:.25};system.translationPivot={x:.2,y:-.1};system.particles[0].color.r=3;
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);const batch=particlePacket(h.packets.find(p=>p.readUInt32LE(4)===28));assert.deepEqual(batch.mask,[.5,0,1,.25]);assert.equal(batch.records[0][16],3);assert.ok(Math.abs(batch.pivot[0]-.2)<1e-6);assert.equal(h.packets.some(p=>p.readUInt32LE(4)===24),false);
    const uploads=h.api.status().meshUploads;system.textureMask={r:1,g:1,b:1,a:1};system.translationPivot={x:0,y:0};system.particles[0].color.r=1;await h.api.flush();const neutral=particlePacket(h.packets.filter(p=>p.readUInt32LE(4)===28).at(-1));assert.deepEqual(neutral.mask,[1,1,1,1]);assert.deepEqual(neutral.pivot,[0,0]);assert.equal(neutral.records[0][16],1);assert.equal(h.api.status().meshUploads,uploads);
  }finally{h.api.stop();}
});

test('invalid sheet, camera, clip, ramp and degenerate direction contracts never acquire native output',async()=>{
  for(const mode of ['cell','grid','inset','ramp','camera','clip','logdepth','direction','emitter','parallel','verticaleye','hdr','postprocess']){const h=await harness({count:1}),system=sourceParticles(h);
    if(['cell','grid','inset'].includes(mode)){Object.assign(system,{isAnimationSheetEnabled:true,spriteCellWidth:1,spriteCellHeight:1,_useInstancing:mode!=='inset',_epsilon:.5});system.particles[0].cellIndex=mode==='cell'?1:0;if(mode==='grid')system.spriteCellWidth=2;}
    if(mode==='ramp')system.useRampGradients=true;if(mode==='camera')system.defaultViewMatrix={m:identity()};if(mode==='clip')h.scene.clipPlane={normal:{x:1,y:0,z:0},d:0};if(mode==='logdepth')system.useLogarithmicDepth=true;
    if(mode==='direction'||mode==='parallel'){system.billboardMode=8;system.particles[0].direction=mode==='parallel'?{x:2,y:3,z:4}:{x:0,y:0,z:0};}
    if(mode==='emitter'){system.isBillboardBased=false;system.isLocal=true;system.particles[0].direction={x:1,y:0,z:0};}
    if(mode==='verticaleye'){system.billboardMode=2;system.particles[0].position={x:0,y:3,z:0};}if(mode==='hdr')system.particles[0].color.r=65;if(mode==='postprocess')system.imageProcessingConfiguration={applyByPostProcess:true};
    try{await h.api.flush();assert.equal(h.api.presentation().ready,false,mode);assert.equal(h.packets.filter(p=>[26,28].includes(p.readUInt32LE(4))).length,0,mode);assert.equal(h.api.setPresentation(true,h.api.status().epoch,h.api.presentation().revision),false,mode);}finally{h.api.stop();}}
});

test('particle ramps transfer the actual extra texture and remap ranges atomically without rebuilding transforms',async()=>{
  const h=await harness({count:1}),system=sourceParticles(h);sourceRamp(system);
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);const batch=particlePacket(h.packets.find(p=>p.readUInt32LE(4)===29));assert.ok(batch.ramp>0);assert.equal(batch.blend,2);assert.deepEqual(batch.wrap,[0,2]);
    batch.records[0].slice(28,32).forEach((v,i)=>assert.ok(Math.abs(v-[.1,.8,.2,.6][i])<1e-6));assert.equal(h.api.status().textures,3);
    const uploads=h.api.status().meshUploads,textureChunks=h.api.status().textureChunks,count=h.packets.filter(p=>p.readUInt32LE(4)===29).length;await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===29).length,count);
    system.particles[0].remapData.z=.3;await h.api.flush();assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.api.status().textureChunks,textureChunks);assert.ok(Math.abs(particlePacket(h.packets.filter(p=>p.readUInt32LE(4)===29).at(-1)).records[0][30]-.3)<1e-6);
    system.useRampGradients=false;await h.api.flush();let clear=particlePacket(h.packets.filter(p=>p.readUInt32LE(4)===29).at(-1));assert.equal(clear.ramp,0);assert.deepEqual(clear.records[0].slice(28,32),[0,1,0,1]);await h.api.flush();assert.equal(h.api.status().textures,2);
    assert.ok(h.packets.filter(p=>p.readUInt32LE(4)===16).some(p=>Array.from({length:p.readUInt32LE(20)},(_,i)=>p.readUInt32LE(24+4*i)).includes(batch.ramp)));
  }finally{h.api.stop();}
});

test('particle subtract, multiply and two-pass multiplyadd retain source blend identities and neutral transitions',async()=>{
  for(const blend of [-1,3,4]){const h=await harness({count:1}),system=sourceParticles(h);system.blendMode=blend;
    try{await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().error);const batch=particlePacket(h.packets.find(p=>p.readUInt32LE(4)===29));assert.equal(batch.blend,blend);assert.equal(batch.ramp,0);assert.deepEqual(batch.records[0].slice(28,32),[0,1,0,1]);
      const uploads=h.api.status().meshUploads;system.blendMode=1;await h.api.flush();assert.equal(particlePacket(h.packets.filter(p=>p.readUInt32LE(4)===29).at(-1)).blend,1);assert.equal(h.api.status().meshUploads,uploads);
    }finally{h.api.stop();}}
});

test('pending ramp GPU readback never acquires the game image or blocks on an unsignaled fence',async()=>{
  const h=await harness({fixture:false,count:1,asyncGPU:true}),system=sourceParticles(h);sourceRamp(system);
  try{await h.tick();assert.equal(h.api.presentation().ready,false);assert.equal(h.copies(),0);assert.ok(h.api.status().textureJobs>0);h.validateState();
    h.signalGPU();h.advance(40);await h.tick();h.signalGPU();h.advance(40);await h.tick();assert.equal(h.api.presentation().ready,true,h.api.status().error);h.validateState();
  }finally{h.api.stop();}
});

test('invalid ramp textures, remap ranges and unknown particle blends fail open before sending particle batches',async()=>{
  for(const kind of ['missing','gradients','array','height','alias','wrap','zero','negative','nan','huge','blend','customsecondpass','snapshot','wireframe']){const h=await harness({count:1}),system=sourceParticles(h);const {texture}=sourceRamp(system);
    if(kind==='missing')system._rampGradientsTexture=null;if(kind==='gradients')system._rampGradients=[];
    if(kind==='array'||kind==='height'){const get=texture.getInternalTexture;texture.getInternalTexture=()=>({...get(),is2DArray:kind==='array',height:kind==='height'?2:1});}
    if(kind==='alias')system._rampGradientsTexture=system.particleTexture;if(kind==='wrap')texture.wrapU=3;
    if(kind==='zero')system.particles[0].remapData.y=0;if(kind==='negative')system.particles[0].remapData.w=-1;if(kind==='nan')system.particles[0].remapData.x=NaN;if(kind==='huge')system.particles[0].remapData.z=65;if(kind==='blend')system.blendMode=5;
    if(kind==='customsecondpass'){system.blendMode=4;system.getCustomEffect=mode=>mode===2?{}:null;}if(kind==='snapshot')system._useFixedCapacityForSnapshot=true;if(kind==='wireframe')h.scene.forceWireframe=true;
    try{await h.api.flush();assert.equal(h.api.presentation().ready,false,kind);assert.equal(h.packets.some(p=>[26,28,29].includes(p.readUInt32LE(4))),false,kind);assert.equal(h.api.status().sourceDrawsSuppressed,false,kind);}finally{h.api.stop();}}
});

test('shared particle ramps remain alive until the last source-active reference is removed',async()=>{
  const h=await harness({count:1}),first=sourceParticles(h);sourceRamp(first);const second={...first,particles:first.particles.map(p=>({...p,position:{x:3,y:4,z:5}}))};h.scene.particleSystems=[first,second];h.scene._activeParticleSystems={data:[first,second],length:2};
  try{await h.api.flush();const batches=h.packets.filter(p=>p.readUInt32LE(4)===29).map(particlePacket);assert.equal(batches.length,2);assert.equal(batches[0].ramp,batches[1].ramp);assert.equal(h.api.status().textures,3);
    h.scene._activeParticleSystems={data:[second],length:1};await h.api.flush();assert.equal(h.api.presentation().ready,true);assert.equal(h.api.status().textures,3);
    h.scene._activeParticleSystems={data:[],length:0};await h.api.flush();assert.equal(h.api.status().textures,1);assert.equal(h.api.status().meshes,1);assert.equal(h.api.presentation().ready,true);
  }finally{h.api.stop();}
});

test('cloned materials share one exported texture, and RGB colors preserve opaque alpha',async()=>{
  const h=await harness({count:12});
  try{await h.api.flush();assert.equal(h.api.status().textures,1);assert.equal(h.isTextureCalls(),1);
    const mesh=h.packets.find(p=>p.readUInt32LE(4)===3);const vertex=16+24+64;
    for(let i=0;i<3;++i){assert.equal(mesh.readFloatLE(vertex+i*56+32),.25);assert.equal(mesh.readFloatLE(vertex+i*56+36),.5);assert.equal(mesh.readFloatLE(vertex+i*56+40),.75);assert.equal(mesh.readFloatLE(vertex+i*56+44),1);}
  }finally{h.api.stop();}
});

test('unchanged geometry scans remain bounded and eventually visit the whole scene',async()=>{
  const h=await harness();
  try{await h.api.flush();const uploads=h.api.status().meshUploads;
    for(let i=0;i<3;++i){h.advance(200);await h.tick();assert.ok(h.api.status().scanVisited<=64);}
    assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.isTextureCalls(),1);
    h.scene.meshes[100]._geometry._vertexBuffers.position={getBuffer:()=>null};
    for(let i=0;i<3;++i){h.advance(200);await h.tick();}
    assert.equal(h.api.status().meshUploads,uploads+1);
  }finally{h.api.stop();}
});

test('only source-active meshes are imported; cached offscreen templates never become extra terrain',async()=>{
  const h=await harness({activeCount:2});
  h.scene.meshes[128].world[12]=128;h.scene.meshes[129].world[12]=129;
  try{await h.tick();assert.ok(h.api.status().meshUploads<=16);assert.ok(h.api.status().scanVisited<=64);
    const meshes=h.packets.filter(p=>p.readUInt32LE(4)===3);assert.equal(meshes[0].readFloatLE(88),128);assert.equal(meshes[1].readFloatLE(88),129);
    for(let i=0;i<16;++i){h.advance(40);await h.tick();assert.ok(h.api.status().scanVisited<=64);}
    assert.equal(h.api.status().meshes,2);
  }
  finally{h.api.stop();}
});

test('a pending geometry write does not prevent a fresh camera packet',async()=>{
  const h=await harness({fixture:false,count:2,blockMesh:true});
  try{await h.tick();assert.equal(h.api.status().meshUploads,0);
    await h.intervals[1].fn();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===30).length,1);
    h.release();await settle();assert.equal(h.api.status().meshUploads,2);
  }finally{h.release();h.api.stop();}
});

test('cleared instances are sent as zero, and matrix buffers do not reupload geometry',async()=>{
  const h=await harness({count:1});const mesh=h.scene.meshes[0];
  mesh._thinInstanceDataStorage={instancesCount:1,matrixData:identity()};mesh.forcedInstanceCount=1;
  try{await h.api.flush();const initial=h.api.status().meshUploads;
    mesh._geometry._vertexBuffers.world0={getBuffer:()=>null};mesh._thinInstanceDataStorage.instancesCount=0;
    await h.api.flush();assert.equal(h.api.status().meshUploads,initial);
    const instances=h.packets.filter(p=>p.readUInt32LE(4)===9);assert.equal(instances.length,2);assert.equal(instances[1].readUInt32LE(24),0);
  }finally{h.api.stop();}
});

test('live textures request only referenced layers and never copy an unsignaled PBO',async()=>{
  const h=await harness({fixture:false,count:1,asyncGPU:true,atlasDepth:64,atlasLayer:17});
  try{await h.tick();h.validateState();assert.equal(h.api.status().readbackMode,'gpu-async');assert.equal(h.api.status().pendingTextureLayers,1);assert.equal(h.copies(),0);assert.equal(h.pboReads(),1);
    h.advance(40);await h.tick();assert.equal(h.copies(),0);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===4).length,0);
    h.signalGPU();h.advance(40);await h.tick();h.validateState();assert.equal(h.copies(),1);assert.equal(h.api.status().pendingTextureLayers,0);
    const texture=h.packets.find(p=>p.readUInt32LE(4)===4);assert.equal(texture.readUInt32LE(36),17);assert.equal(texture.readUInt32LE(40),1);assert.equal(texture.length,52);
  }finally{h.api.stop();}
});

test('an animated layer does not invalidate unrelated atlas layers',async()=>{
  const h=await harness({fixture:false,count:1,asyncGPU:true,atlasDepth:64,atlasLayer:17});
  try{await h.tick();h.signalGPU();h.advance(40);await h.tick();const initial=h.pboReads();
    h.modifyLayer(31);h.advance(40);await h.tick();assert.equal(h.pboReads(),initial);assert.equal(h.api.status().pendingTextureLayers,0);
    h.modifyLayer(17);h.advance(40);await h.tick();assert.equal(h.pboReads(),initial+1);assert.equal(h.api.status().pendingTextureLayers,1);
    h.signalGPU();h.advance(40);await h.tick();assert.equal(h.api.status().pendingTextureLayers,0);h.validateState();
  }finally{h.api.stop();}
});

test('origin rebase preserves textures and geometry while translating cached world transforms',async()=>{
  const h=await harness({count:1});
  try{await h.api.flush();const initial=h.api.status(),texturePackets=h.packets.filter(p=>p.readUInt32LE(4)===4).length;
    h.root.uR[0]=100;h.scene.meshes[0].world[12]=-100;h.advance(40);await h.tick();
    assert.equal(h.api.status().epoch,initial.epoch);assert.equal(h.api.status().meshUploads,initial.meshUploads);assert.equal(h.api.status().textures,1);assert.equal(h.api.status().rebases,1);
    assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===4).length,texturePackets);const rebase=h.packets.find(p=>p.readUInt32LE(4)===10);assert.equal(rebase.readFloatLE(20),-100);
  }finally{h.api.stop();}
});

test('instance attributes use the instance count instead of the model vertex count',async()=>{
  const h=await harness({count:1});const mesh=h.scene.meshes[0];mesh._thinInstanceDataStorage={instancesCount:1,matrixData:identity()};
  const light={getIsInstanced:()=>true,getSize:()=>1,getFloatData(count){assert.equal(count,1);return new Float32Array([61440]);},getData:()=>new Float32Array([61440]),getBuffer:()=>null};
  mesh._geometry._vertexBuffers.aPackedLightLevels=light;mesh.getVertexBuffer=k=>mesh._geometry._vertexBuffers[k];
  const original=mesh.getVerticesData;mesh.getVerticesData=kind=>{if(kind==='aPackedLightLevels')throw Error('Invalid typed array length: 24');return original(kind);};
  try{await h.api.flush();assert.equal(h.api.status().skipped,0);const instance=h.packets.find(p=>p.readUInt32LE(4)===9);assert.equal(instance.readFloatLE(28+17*4),61440);assert.equal(h.packets.find(p=>p.readUInt32LE(4)===3).readUInt32LE(28)&1,1);}
  finally{h.api.stop();}
});

test('three scattered visible layers can read back concurrently without exporting the whole atlas',async()=>{
  const h=await harness({fixture:false,count:3,asyncGPU:true,atlasDepth:64});
  h.scene.meshes[0].data.texAtlasIndices.fill(3);h.scene.meshes[1].data.texAtlasIndices.fill(17);h.scene.meshes[2].data.texAtlasIndices.fill(42);
  try{await h.tick();assert.equal(h.api.status().textureJobs,3);assert.equal(h.api.status().pendingTextureLayers,3);assert.equal(h.copies(),0);
    h.signalGPU();h.advance(40);await h.tick();assert.equal(h.api.status().pendingTextureLayers,0);assert.equal(h.copies(),3);h.validateState();
    assert.deepEqual(h.packets.filter(p=>p.readUInt32LE(4)===4).map(p=>p.readUInt32LE(36)),[3,17,42]);
  }finally{h.api.stop();}
});

test('Babylon underlyingResource handles detect in-place vertex and index writes',async()=>{
  const h=await harness({fixture:false,count:1,asyncGPU:true});const mesh=h.scene.meshes[0],vertexHandle={},indexHandle={};
  mesh._geometry._vertexBuffers.position={getBuffer:()=>({underlyingResource:vertexHandle})};mesh._geometry._indexBuffer={underlyingResource:indexHandle};
  try{h.writeBuffer(vertexHandle);h.writeBuffer(indexHandle,34963);await h.tick();assert.equal(h.api.status().meshUploads,1);
    mesh.data.position[0]=.25;h.writeBuffer(vertexHandle);h.advance(40);await h.tick();assert.equal(h.api.status().meshUploads,2);
    mesh._geometry._indices[0]=2;h.writeBuffer(indexHandle,34963);h.advance(40);await h.tick();assert.equal(h.api.status().meshUploads,3);
    const packet=h.packets.filter(p=>p.readUInt32LE(4)===3).at(-1);assert.equal(packet.readFloatLE(104),.25);assert.equal(packet.readUInt32LE(104+3*56),2);
  }finally{h.api.stop();}
});

test('a modified pending layer is retried without delivering stale readback pixels',async()=>{
  const h=await harness({fixture:false,count:1,asyncGPU:true,atlasDepth:64,atlasLayer:17});
  try{await h.tick();h.modifyLayer(17);h.signalGPU();h.advance(40);await h.tick();assert.equal(h.copies(),0);assert.equal(h.pboReads(),2);assert.equal(h.api.status().pendingTextureLayers,1);
    h.signalGPU();h.advance(40);await h.tick();assert.equal(h.copies(),1);assert.equal(h.api.status().pendingTextureLayers,0);h.validateState();
  }finally{h.api.stop();}
});

test('multi-material submeshes export compact geometry with independent materials and remove obsolete parts',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0],original=mesh.material;
  mesh.data.position=new Float32Array([0,0,0,1,0,0,0,1,0,2,1,0]);
  mesh.data.normal=new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]);mesh.data.uv=new Float32Array(8);
  mesh.data.color=new Float32Array(12).fill(1);mesh.data.texAtlasIndices=new Float32Array(4);
  mesh.getTotalVertices=()=>4;mesh.getTotalIndices=()=>6;mesh._geometry._indices=new Uint32Array([0,1,2,2,1,3]);
  mesh.material={subMaterials:[{...original,diffuseColor:{r:1,g:.25,b:.5}}, {...original,alpha:.5,disableLighting:true,emissiveColor:{r:.1,g:.2,b:.3}}]};
  mesh.subMeshes=[{indexStart:0,indexCount:3,materialIndex:0},{indexStart:3,indexCount:3,materialIndex:1}];
  try{await h.api.flush();assert.equal(h.api.status().skipped,0);assert.equal(h.api.status().meshes,2);assert.equal(h.api.status().textures,1);
    const parts=h.packets.filter(p=>p.readUInt32LE(4)===3);assert.equal(parts.length,2);
    for(const p of parts){assert.equal(p.readUInt32LE(32),3);assert.equal(p.readUInt32LE(36),3);assert.equal(p.length,104+3*56+3*4);}
    assert.equal(parts[0].readFloatLE(104+36),.25);assert.equal(parts[1].readUInt32LE(28)&2,2);
    assert.equal(parts[1].readFloatLE(104+2*56),2);assert.equal(parts[1].readFloatLE(104+44),.5);
    assert.deepEqual(Array.from({length:3},(_,i)=>parts[1].readUInt32LE(104+3*56+i*4)),[0,1,2]);
    const material=h.packets.filter(p=>p.readUInt32LE(4)===12).at(-1);assert.equal(material.readUInt32LE(24),1);assert.ok(Math.abs(material.readFloatLE(40)-.3)<1e-6);
    mesh.subMeshes.pop();await h.api.flush();assert.equal(h.api.status().meshes,1);
    const removed=h.packets.filter(p=>p.readUInt32LE(4)===8).at(-1);assert.equal(removed.readUInt32LE(24),parts[1].readUInt32LE(20));
    mesh.material=original;await h.api.flush();assert.equal(h.api.status().meshes,1);assert.equal(h.api.status().skipped,0);
  }finally{h.api.stop();}
});

test('invalid submesh ranges do not send native geometry',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];
  mesh.material={subMaterials:[mesh.material]};mesh.subMeshes=[{indexStart:2,indexCount:3,materialIndex:0}];
  try{await h.api.flush();assert.equal(h.api.status().skipped,1);assert.match(h.api.status().error,/submesh/);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===3).length,0);}
  finally{h.api.stop();}
});

test('bone animation updates only posed vertices and a stationary pose sends no updates',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0],bones=identity();
  mesh.data.matricesIndices=new Float32Array(12);mesh.data.matricesWeights=new Float32Array([1,0,0,0,1,0,0,0,0,0,0,0]);
  mesh.skeleton={getTransformMatrices:()=>bones};
  try{await h.api.flush();const initial=h.api.status().meshUploads;await h.api.flush();assert.equal(h.api.status().meshUploads,initial);assert.equal(h.api.status().poseUpdates,0);
    bones[12]=2;await h.api.flush();assert.equal(h.api.status().meshUploads,initial);assert.equal(h.api.status().poseUpdates,1);
    const pose=h.packets.find(p=>p.readUInt32LE(4)===11);assert.equal(pose.readUInt32LE(24),3);assert.equal(pose.readFloatLE(28),2);assert.equal(pose.readFloatLE(28+6*4),3);
    assert.equal(pose.readFloatLE(28+12*4),0);assert.equal(pose.readFloatLE(28+13*4),1);
    await h.api.flush();assert.equal(h.api.status().poseUpdates,1);
  }finally{h.api.stop();}
});

test('invalid bone indices and non-finite material values are rejected before geometry is sent',async()=>{
  for(const invalidKind of ['bone','material']){const h=await harness({count:1}),mesh=h.scene.meshes[0];
    if(invalidKind==='bone'){mesh.skeleton={getTransformMatrices:()=>identity()};mesh.data.matricesIndices=new Float32Array(12).fill(-1);mesh.data.matricesWeights=new Float32Array(12).fill(1);}
    else mesh.material.diffuseColor={r:NaN,g:1,b:1};
    try{await h.api.flush();assert.equal(h.api.status().skipped,1);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===3).length,0);}
    finally{h.api.stop();}
  }
});

test('position morphs apply before bone skinning and can return to the base pose',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0],bones=identity();bones[12]=2;
  mesh.skeleton={getTransformMatrices:()=>bones};mesh.data.matricesIndices=new Float32Array(12);mesh.data.matricesWeights=new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0]);
  const positions=new Float32Array(mesh.data.position);positions[0]=2;
  const target={influence:.5,getPositions:()=>positions};mesh.morphTargetManager={numTargets:1,getTarget:()=>target};
  try{await h.api.flush();assert.equal(h.api.status().skipped,0);assert.equal(h.packets.find(p=>p.readUInt32LE(4)===3).readFloatLE(104),3);
    target.influence=0;await h.api.flush();assert.equal(h.api.status().poseUpdates,1);assert.equal(h.packets.find(p=>p.readUInt32LE(4)===11).readFloatLE(28),2);
  }finally{h.api.stop();}
});

test('UV morph changes update static attributes immediately and switching them off restores original UVs',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0],uv=new Float32Array(6).fill(.5);
  const target={influence:1,getUVs:()=>uv};mesh.morphTargetManager={numTargets:1,getTarget:()=>target};
  try{await h.api.flush();assert.equal(h.api.status().skipped,0);assert.equal(h.packets.find(p=>p.readUInt32LE(4)===3).readFloatLE(104+24),.5);
    target.influence=0;await h.api.flush();assert.equal(h.api.status().meshUploads,2);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===3).at(-1).readFloatLE(104+24),0);
  }finally{h.api.stop();}
});

test('visibility and material tint are preserved; emission changes do not reupload geometry',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];mesh.visibility=.5;
  Object.assign(mesh.material,{alpha:.5,diffuseColor:{r:.5,g:1,b:.25},alphaCutOff:.4,needAlphaTesting:()=>true,emissiveColor:{r:0,g:0,b:0}});
  try{await h.api.flush();const geometry=h.packets.find(p=>p.readUInt32LE(4)===3);
    assert.equal(geometry.readFloatLE(104+32),.125);assert.equal(geometry.readFloatLE(104+40),.1875);assert.equal(geometry.readFloatLE(104+44),.25);
    mesh.material.emissiveColor.r=.75;await h.api.flush();assert.equal(h.api.status().meshUploads,1);assert.equal(h.api.status().materialUpdates,2);
    const material=h.packets.filter(p=>p.readUInt32LE(4)===12).at(-1);assert.ok(Math.abs(material.readFloatLE(28)-.4)<1e-6);assert.equal(material.readFloatLE(32),.75);
  }finally{h.api.stop();}
});

test('billboard shaders prevent native handover instead of drawing an arbitrary atlas quad',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];mesh.billboardMode=7;mesh.world[12]=3;
  try{await h.api.flush();assert.equal(h.api.status().meshUploads,0);assert.equal(h.api.presentation().ready,false);assert.match(h.api.presentation().reason,/Billboard/);}
  finally{h.api.stop();}
});

test('removing thin-instance storage returns to base geometry',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];mesh._thinInstanceDataStorage={instancesCount:1,matrixData:identity()};
  try{await h.api.flush();delete mesh._thinInstanceDataStorage;await h.api.flush();assert.equal(h.api.status().meshUploads,2);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===9).length,1);}
  finally{h.api.stop();}
});

test('environment packets preserve actual directional light, fog and camera clipping values',async()=>{
  const h=await harness({count:1});h.scene.lights=[{getTypeID:()=>1,direction:{x:0,y:-2,z:0},diffuse:{r:.5,g:.75,b:1},intensity:2}];
  Object.assign(h.scene,{fogMode:3,fogStart:12,fogEnd:96,fogDensity:.04,fogColor:{r:.1,g:.2,b:.3}});Object.assign(h.scene.activeCamera,{minZ:.25,maxZ:512});
  try{await h.api.flush();const env=h.packets.find(p=>p.readUInt32LE(4)===13);assert.equal(env.readUInt32LE(20),3);assert.equal(env.readUInt32LE(24),3);assert.equal(env.readFloatLE(32),1);assert.equal(env.readFloatLE(40),1);assert.equal(env.readFloatLE(44),1.5);assert.equal(env.readFloatLE(64),12);assert.equal(env.readFloatLE(68),96);assert.equal(env.readFloatLE(76),.25);assert.equal(env.readFloatLE(80),512);}
  finally{h.api.stop();}
});
test('missing sun data is marked unknown rather than assigning an invented sun',async()=>{
  const h=await harness({count:1});try{await h.api.flush();const env=h.packets.find(p=>p.readUInt32LE(4)===13);assert.equal(env.readUInt32LE(20)&1,0);}
  finally{h.api.stop();}
});
test('sky cubes export six actual faces and are retained as sky geometry',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];mesh.infiniteDistance=true;
  const handle={};mesh.material={reflectionTexture:{getInternalTexture:()=>({width:1,height:1,isCube:true,_hardwareTexture:{underlyingResource:handle}})}};
  try{await h.api.flush();assert.equal(h.api.status().skipped,0);assert.equal(h.packets.find(p=>p.readUInt32LE(4)===3).readUInt32LE(28)&4,4);
    const texture=h.packets.find(p=>p.readUInt32LE(4)===4);assert.equal(texture.readUInt32LE(32),6);assert.equal(texture.readUInt32LE(44)&8,8);assert.deepEqual(h.faceReads,[34069,34070,34071,34072,34073,34074]);}
  finally{h.api.stop();}
});
test('surface metadata uses actual world block IDs and keeps animated atlas zero separate',async()=>{
  const h=await harness({count:2}),reads=[];h.root.registry={metadatas:{Water:{id:31,name:'Water'},Lava:{id:42,name:'Lava'}}};h.root.getBlock=(x,y,z)=>{reads.push([x,y,z]);return x<1?31:42;};
  for(const mesh of h.scene.meshes)mesh.metadata={noa_chunk_terrain_mesh:true};h.scene.meshes[1].world[12]=2;
  try{await h.api.flush();const packets=h.packets.filter(p=>p.readUInt32LE(4)===14);assert.equal(packets.length,2);
    assert.equal(packets[0].readFloatLE(28),31);assert.equal(packets[0].readFloatLE(32),2);assert.equal(packets[1].readFloatLE(28),42);assert.equal(packets[1].readFloatLE(32),3);assert.deepEqual(reads,[[0,0,-1],[2,0,-1]]);}
  finally{h.api.stop();}
});
test('unknown world blocks remain unknown, and late semantic definitions refresh static geometry',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];mesh.metadata={noa_chunk_terrain_mesh:true};
  try{await h.api.flush();const first=h.packets.find(p=>p.readUInt32LE(4)===14);assert.equal(first.readFloatLE(28),-1);assert.equal(first.readFloatLE(32),0);
    h.root.registry={metadatas:{31:{name:'Water'}}};h.root.getBlock=()=>31;h.advance(1200);await h.api.flush();assert.equal(h.api.status().meshUploads,2);const last=h.packets.filter(p=>p.readUInt32LE(4)===14).at(-1);assert.equal(last.readFloatLE(28),31);assert.equal(last.readFloatLE(32),2);}
  finally{h.api.stop();}
});

test('walking past cached meshes removes old imports and orphan textures without changing distance settings',async()=>{
  const h=await harness({count:30,activeCount:1});h.root.renderDistance=10;
  try{for(let i=0;i<30;++i){
    const mesh=h.scene.meshes[i],handle={};
    mesh.material.pluginManager._plugins[0].textureAtlases=[{getInternalTexture:()=>({width:1,height:1,depth:2,is2DArray:true,_hardwareTexture:{underlyingResource:handle}})}];
    h.setActive([mesh]);await h.api.flush();assert.equal(h.api.status().meshes,1);assert.equal(h.api.status().textures,1);assert.equal(h.root.renderDistance,10);
  }
    assert.equal(h.scene.meshes.length,30);assert.ok(h.packets.filter(p=>p.readUInt32LE(4)===8).length>=29);assert.ok(h.packets.filter(p=>p.readUInt32LE(4)===16).length>=29);
    h.setActive([]);await h.api.flush();assert.equal(h.api.status().meshes,0);assert.equal(h.api.status().textures,0);assert.equal(h.api.presentation().ready,false);
  }finally{h.api.stop();}
});

test('an empty or unavailable active list never falls back to exporting all cached scene meshes',async()=>{
  for(const missing of [false,true]){
    const h=await harness({fixture:false,count:20});if(missing)delete h.scene.getActiveMeshes;else h.setActive([]);
    try{await h.api.flush();assert.equal(h.api.status().meshes,0);assert.equal(h.api.presentation().ready,false);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===3).length,0);}
    finally{h.api.stop();}
  }
});

test('incomplete Lifeform materials and appearance attributes without their plugin keep source fallback',async()=>{
  for(const attributeOnly of [false,true]){
    const h=await harness({count:2}),mesh=h.scene.meshes[1];
    if(attributeOnly)mesh._geometry._vertexBuffers.aAtlasIdx1={getIsInstanced:()=>true};
    else mesh.material.pluginManager._plugins.push({getClassName:()=> 'LifeformMaterialPlugin',numLayers:4,atlasWidth:8,atlasHeight:8});
    try{await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.equal(h.api.status().unsupportedMeshes,1);assert.equal(h.api.status().meshes,0);
      assert.match(h.api.presentation().reason,/atlas|clothing|appearance/i);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===3).length,0);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===15).at(-1).readUInt32LE(24),0);
    }finally{h.api.stop();}
  }
});

test('partial import cannot own the game image merely because capture is streaming',async()=>{
  const h=await harness({count:30});
  try{await h.tick();const status=h.api.presentation();assert.equal(h.api.status().phase,'streaming');assert.equal(status.ready,false);assert.equal(h.api.status().pendingMeshes,14);assert.equal(h.api.setPresentation(true,status.epoch,status.revision),false);
    await h.api.flush();assert.equal(h.api.presentation().ready,true);
  }finally{h.api.stop();}
});

test('regular instances do not inherit and multiply the source thin-instance batch',async()=>{
  const h=await harness({count:2}),source=h.scene.meshes[0],instance=h.scene.meshes[1];
  source._thinInstanceDataStorage={instancesCount:2,matrixData:new Float32Array([...identity(),...identity()])};instance.sourceMesh=source;instance.world[12]=5;h.setActive([instance]);
  try{await h.api.flush();assert.equal(h.api.status().meshes,1);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===9).length,0);assert.equal(h.packets.find(p=>p.readUInt32LE(4)===3).readFloatLE(88),5);}
  finally{h.api.stop();}
});

test('a single-material submesh respects its actual index range',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];mesh._geometry._indices=new Uint32Array([0,1,2,2,1,0]);mesh.subMeshes=[{indexStart:3,indexCount:3,materialIndex:0}];
  try{await h.api.flush();const part=h.packets.find(p=>p.readUInt32LE(4)===3);assert.equal(part.readUInt32LE(36),3);assert.equal(part.readFloatLE(104+4),1);assert.equal(part.readFloatLE(104+56),1);}
  finally{h.api.stop();}
});

test('atlas page offsets use populated layers rather than unused GPU page capacity',async()=>{
  const h=await harness({count:1,atlasDepth:4}),mesh=h.scene.meshes[0],secondHandle={};
  const plugin=mesh.material.pluginManager._plugins[0];plugin.imagesPerAtlas=[2,1];plugin.textureAtlases.push({getInternalTexture:()=>({width:1,height:1,depth:4,is2DArray:true,_hardwareTexture:{underlyingResource:secondHandle}})});
  mesh.data.texAtlasIndices.fill(2);
  try{await h.api.flush();assert.equal(h.api.status().skipped,0);const pages=h.packets.filter(p=>p.readUInt32LE(4)===4);assert.deepEqual(pages.map(p=>p.readUInt32LE(32)),[3,3]);assert.deepEqual(pages.map(p=>p.readUInt32LE(36)),[0,2]);assert.deepEqual(pages.map(p=>p.readUInt32LE(40)),[2,1]);}
  finally{h.api.stop();}
});

test('source draw ownership suppresses only world-canvas draws and restores immediately on selection changes',async()=>{
  const h=await harness({fixture:false,count:2,asyncGPU:true,activeCount:1});
  try{await h.tick();h.signalGPU();h.advance(40);await h.tick();assert.equal(h.api.presentation().ready,true);
    const status=h.api.presentation();assert.equal(h.api.setPresentation(true,status.epoch,status.revision),true);
    h.sourceGL.bindFramebuffer(h.sourceGL.DRAW_FRAMEBUFFER,null);h.sourceGL.drawElements(4,3,5125,0);assert.equal(h.sourceDraws(),0);
    h.sourceGL.bindFramebuffer(h.sourceGL.DRAW_FRAMEBUFFER,{});h.sourceGL.drawElements(4,3,5125,0);assert.equal(h.sourceDraws(),1);
    const otherGL=new h.context.WebGL2RenderingContext();otherGL.drawElements(4,3,5125,0);assert.equal(h.sourceDraws(),2);
    h.setActive([h.scene.meshes[0]]);assert.equal(h.api.status().sourceDrawsSuppressed,false);assert.equal(h.api.presentation().ready,false);assert.notEqual(h.api.presentation().revision,status.revision);
    h.sourceGL.bindFramebuffer(h.sourceGL.DRAW_FRAMEBUFFER,null);h.sourceGL.drawElements(4,3,5125,0);assert.equal(h.sourceDraws(),3);
  }finally{h.api.stop();}
});

test('a stalled presentation lease fails open without stopping simulation or resource updates',async()=>{
  const h=await harness({fixture:false,count:1,asyncGPU:true});
  try{await h.tick();h.signalGPU();h.advance(40);await h.tick();const status=h.api.presentation();h.api.setPresentation(true,status.epoch,status.revision);
    h.sourceGL.bindFramebuffer(h.sourceGL.DRAW_FRAMEBUFFER,null);h.advance(501);h.sourceGL.drawArrays(4,0,3);assert.equal(h.sourceDraws(),1);assert.equal(h.api.status().sourceDrawsSuppressed,false);assert.match(h.api.presentation().reason,/lease/);
  }finally{h.api.stop();}
});

test('custom source GPU spawn rings never become CPU poses or native GL handles',async()=>{
  const h=await harness({count:1}),system=sourceParticles(h);
  let simulated=0;
  Object.assign(system,{ring:{recordBits:new Uint32Array(16),highWater:1,cursor:0},records:{sourceWebGL:true},renderer:{},
    animate(){++simulated;throw Error('Simulation is forbidden.');},prepareDraw(){++simulated;throw Error('Source draw mutation is forbidden.');}});
  try{
    await h.api.flush();assert.equal(h.api.presentation().ready,false);
    assert.match(h.api.status().fallbackReason,/GPU particle/);
    assert.equal(simulated,0);assert.equal(h.packets.some(p=>[26,28,29].includes(p.readUInt32LE(4))),false);
    h.scene._activeParticleSystems.length=0;await h.api.flush();assert.equal(h.api.presentation().ready,true);
    h.scene._activeParticleSystems.length=1;await h.api.flush();assert.equal(h.api.presentation().ready,false);
    assert.equal(h.api.status().meshes,0);assert.equal(simulated,0);
  }finally{h.api.stop();}
});

test('sprite stage and camera masks gate fallback without guessing a renderer or mutating managers',async()=>{
  const h=await harness({count:1}),manager={layerMask:2,render(){throw Error('Source render must not be called.');}};
  h.scene.spriteManagers=[manager];h.scene.spritesEnabled=false;h.scene.activeCamera.layerMask=1;
  try{
    await h.api.flush();assert.equal(h.api.presentation().ready,true);
    h.scene.spritesEnabled=true;await h.api.flush();assert.equal(h.api.presentation().ready,true);
    const ready=h.api.presentation();assert.equal(h.api.setPresentation(true,ready.epoch,ready.revision),true);
    manager.layerMask=1;assert.equal(h.api.presentation().ready,false);assert.equal(h.api.status().sourceDrawsSuppressed,false);
    await h.api.flush();assert.match(h.api.status().fallbackReason,/no audited renderer/);assert.equal(h.api.status().meshes,0);
    delete manager.layerMask;await h.api.flush();assert.equal(h.api.presentation().ready,false);
    manager.layerMask=2;delete h.scene.activeCamera.layerMask;await h.api.flush();assert.equal(h.api.presentation().ready,false);
    h.scene.activeCamera.layerMask=1;h.scene.spriteManagers=new Array(1);await h.api.flush();assert.equal(h.api.presentation().ready,false);
    h.scene.spriteManagers=[manager];
    h.scene.spritesEnabled=false;await h.api.flush();assert.equal(h.api.presentation().ready,true);
    assert.equal(h.scene.spriteManagers[0],manager);
  }finally{h.api.stop();}
});

test('unsupported particles, postprocessing and unreadable texture transforms prevent handover',async()=>{
  for(const mode of ['particles','postprocess','uv','shader','visualmod']){
    const h=await harness({count:1}),mesh=h.scene.meshes[0];
    if(mode==='particles')h.scene.particleSystems=[{isStarted:()=>true}];
    if(mode==='postprocess')h.scene.activeCamera._postProcesses=[{}];
    if(mode==='uv'){mesh.material.pluginManager._plugins=[];mesh.material.diffuseTexture={uScale:2,getInternalTexture:()=>({width:1,height:1,_hardwareTexture:{underlyingResource:{}}})};}
    if(mode==='shader')mesh.material.getClassName=()=> 'ShaderMaterial';
    if(mode==='visualmod')h.context.__BVFX_DOCUMENT_START__=true;
    try{await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.equal(h.api.status().meshes,0);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===3).length,0);}
    finally{h.api.stop();}
  }
});

test('actual source UV matrices and per-axis wrap update independently of static geometry',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0],uv=identity(),handle={};uv[0]=2;uv[5]=3;uv[8]=.25;uv[9]=.5;
  mesh.material.pluginManager._plugins=[];mesh.material.needAlphaTesting=()=>false;
  mesh.material.diffuseTexture={uScale:2,vScale:3,wrapU:0,wrapV:2,level:.5,coordinatesIndex:0,getTextureMatrix:()=>({m:uv}),getInternalTexture:()=>({width:1,height:1,_hardwareTexture:{underlyingResource:handle}})};
  try{
    await h.api.flush();assert.equal(h.api.presentation().ready,true);
    let state=h.packets.filter(p=>p.readUInt32LE(4)===17).at(-1);assert.equal(state.length,112);
    assert.equal(state.readUInt32LE(36),0);assert.equal(state.readUInt32LE(40),2);
    assert.equal(state.readFloatLE(44),2);assert.equal(state.readFloatLE(44+5*4),3);assert.equal(state.readFloatLE(44+8*4),.25);assert.equal(state.readFloatLE(108),.5);
    assert.equal(state.readUInt32LE(24)&16,0,'opaque diffuse alpha must not punch holes');
    const uploads=h.api.status().meshUploads,states=h.packets.filter(p=>p.readUInt32LE(4)===17).length;
    await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===17).length,states);
    uv[8]=.75;await h.api.flush();assert.equal(h.api.status().meshUploads,uploads);state=h.packets.filter(p=>p.readUInt32LE(4)===17).at(-1);assert.equal(state.readFloatLE(76),.75);
  }finally{h.api.stop();}
});

test('source orientation, mirrored world, depth writing, blend and fog form an explicit draw contract',async()=>{
  const h=await harness({count:1}),mesh=h.scene.meshes[0];
  Object.assign(mesh.material,{sideOrientation:0,backFaceCulling:true,cullBackFaces:false,alpha:.5,alphaMode:2,forceDepthWrite:true,depthFunction:515,twoSidedLighting:true,fogEnabled:false});
  mesh.world[0]=-1;
  try{await h.api.flush();const p=h.packets.filter(p=>p.readUInt32LE(4)===17).at(-1);
    assert.equal(p.readUInt32LE(24),1|4|8|16|32);assert.equal(p.readUInt32LE(28),515);assert.equal(p.readUInt32LE(32),2);
    mesh.material.disableDepthWrite=true;await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===17).at(-1).readUInt32LE(24)&8,0);
    mesh.material.transparencyMode=0;mesh.material.needAlphaBlendingForMesh=()=>false;await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===3).at(-1).readUInt32LE(28)&2,0);
  }finally{h.api.stop();}
});

test('unsupported blend, stencil, secondary UVs and invalid UV matrices stay in source fallback',async()=>{
  for(const mode of ['blend','stencil','uv2','nan','short','depth','wrap']){
    const h=await harness({count:1}),mesh=h.scene.meshes[0],uv=identity();
    mesh.material.pluginManager._plugins=[];
    mesh.material.diffuseTexture={getTextureMatrix:()=>({m:uv}),getInternalTexture:()=>({width:1,height:1,_hardwareTexture:{underlyingResource:{}}})};
    if(mode==='blend')Object.assign(mesh.material,{alpha:.5,alphaMode:9});
    if(mode==='stencil')mesh.material.stencil={enabled:true};
    if(mode==='uv2')mesh.material.diffuseTexture.coordinatesIndex=1;
    if(mode==='nan')uv[0]=NaN;
    if(mode==='short')mesh.material.diffuseTexture.getTextureMatrix=()=>new Float32Array(4);
    if(mode==='depth')mesh.material.depthFunction=999;
    if(mode==='wrap')mesh.material.diffuseTexture.wrapU=3;
    try{await h.api.flush();assert.equal(h.api.presentation().ready,false,mode);assert.equal(h.api.status().meshes,0,mode);assert.equal(h.packets.some(p=>p.readUInt32LE(4)===17),false,mode);}
    finally{h.api.stop();}
  }
});

test('a presentation failure pauses native capture for the scene instead of retrying broken overlays',async()=>{
  const h=await harness({count:1});
  try{await h.api.flush();assert.equal(h.api.presentation().ready,true);h.api.rejectPresentation('Presentation context was lost.');await h.api.flush();assert.equal(h.api.presentation().ready,false);assert.equal(h.api.status().meshes,0);assert.equal(h.api.status().textures,0);
    assert.match(h.api.presentation().reason,/context was lost/);const uploads=h.api.status().meshUploads;h.advance(40);await h.tick();assert.equal(h.api.status().meshUploads,uploads);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===15).at(-1).readUInt32LE(24),0);
  }finally{h.api.stop();}
});

test('fallback throttles repeated scene scans and stops camera IPC and GPU-write bookkeeping',async()=>{
  const h=await harness({fixture:false,count:600,asyncGPU:true});
  for(const mesh of h.scene.meshes)mesh.material.pluginManager._plugins=[{}];
  try{await h.tick();const before=h.api.status();assert.equal(before.trackingWrites,false);assert.equal(before.importEnabled,false);
    for(let i=0;i<7;++i){h.advance(33);h.writeBuffer({});h.modifyLayer(0);await h.tick();await h.intervals[1].fn();}
    const after=h.api.status();assert.equal(after.cameraFrames,0);assert.equal(after.trackedCalls,before.trackedCalls);assert.equal(after.idleSkips,7);assert.equal(after.meshUploads,0);
    h.advance(33);await h.tick();assert.equal(h.api.status().idleSkips,7);assert.equal(h.api.presentation().ready,false);
  }finally{h.api.stop();}
});

test('fallback resumes full capture with fresh geometry and observes already-bound buffer writes',async()=>{
  const h=await harness({fixture:false,count:1,asyncGPU:true}),mesh=h.scene.meshes[0],plugins=mesh.material.pluginManager._plugins,handle={};
  mesh._geometry._vertexBuffers.position={getBuffer:()=>({underlyingResource:handle})};mesh.material.pluginManager._plugins=[{}];
  try{await h.tick();mesh.data.position[0]=3;h.writeBuffer(handle);mesh.material.pluginManager._plugins=plugins;
    h.advance(251);await h.tick();assert.equal(h.api.status().trackingWrites,true);assert.equal(h.api.status().meshUploads,1);assert.equal(h.packets.find(p=>p.readUInt32LE(4)===3).readFloatLE(104),3);
    mesh.data.position[0]=5;h.sourceGL.bufferSubData(h.sourceGL.ARRAY_BUFFER,0,new Float32Array(1));h.advance(40);await h.tick();assert.equal(h.api.status().meshUploads,2);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===3).at(-1).readFloatLE(104),5);
  }finally{h.api.stop();}
});

test('newly active chunks are uploaded before an unchanged 200-mesh scan backlog',async()=>{
  const h=await harness({count:201}),existing=h.scene.meshes.slice(0,200),incoming=h.scene.meshes[200];incoming.world[12]=777;h.setActive(existing);
  try{await h.api.flush();const before=h.api.status().meshUploads;h.setActive([...existing,incoming]);h.advance(40);await h.tick();assert.equal(h.api.status().meshUploads,before+1);assert.equal(h.api.status().meshes,201);assert.ok(h.api.status().scanVisited<=64);assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===3).at(-1).readFloatLE(88),777);}
  finally{h.api.stop();}
});

test('source frame cadence reports only finite bounded source-engine values without native ownership',async()=>{
  const h=await harness({count:1});
  try{await h.api.flush();const engine=h.scene.getEngine();h.scene.getEngine=()=>({...engine,getFps:()=>72.5});assert.equal(h.api.status().sourceFPS,72.5);assert.equal(h.api.status().sourceDrawsSuppressed,false);
    for(const fps of [NaN,Infinity,-1,1001]){h.scene.getEngine=()=>({...engine,getFps:()=>fps});assert.equal(h.api.status().sourceFPS,null);}
  }finally{h.api.stop();}
});

// All source objects below are inert data. None of the audited source is evaluated.
function gpuSource(h,s,{count=3,blend=4}={}){
  const gl=h.sourceGL,shader=require('../../launcher/tests/fixtures/gpu-particle-shaders.json');
  const constants={TEXTURE_2D:3553,TEXTURE_BINDING_2D:32873,ACTIVE_TEXTURE:34016,TEXTURE0:33984,CURRENT_PROGRAM:35725,TRIANGLE_STRIP:5,RGBA_INTEGER:36249,UNSIGNED_INT:5125,
    DRAW_FRAMEBUFFER_BINDING:36006,PIXEL_UNPACK_BUFFER_BINDING:35055,UNPACK_ROW_LENGTH:3314,UNPACK_SKIP_ROWS:3315,UNPACK_SKIP_PIXELS:3316,SAMPLER_BINDING:35097,TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,
    CULL_FACE:2884,STENCIL_TEST:2960,SCISSOR_TEST:3089,POLYGON_OFFSET_FILL:32823,RASTERIZER_DISCARD:35977,SAMPLE_ALPHA_TO_COVERAGE:32926,SAMPLE_COVERAGE:32928,DEPTH_TEST:2929,BLEND:3042,
    VIEWPORT:2978,COLOR_WRITEMASK:3107,DEPTH_RANGE:2928,DEPTH_WRITEMASK:2930,DEPTH_FUNC:2932,BLEND_SRC_RGB:32969,BLEND_DST_RGB:32968,BLEND_SRC_ALPHA:32971,BLEND_DST_ALPHA:32970,BLEND_EQUATION_RGB:32777,BLEND_EQUATION_ALPHA:34877};Object.assign(gl,constants);
  let active=gl.TEXTURE0,current=null,factors=[774,0,1,1],simulated=0;const bindings=new Map(),uniforms=new Map();
  const texture=()=>{const handle={};return {handle,source:{getInternalTexture:()=>({width:1,height:1,samplingMode:1,_hardwareTexture:{underlyingResource:handle}})}};};
  const tex=texture(),ramp=texture(),record={};
  const effect=m=>({_pipelineContext:{program:{}},_rawVertexSourceCode:shader.vertex,_rawFragmentSourceCode:shader.fragment,defines:m?'#define MULTIPLY_PASS':''});
  const renderer={tY:h.scene,Iv:s.engine,effect:effect(false),multiplyEffect:effect(true),whiteRamp:ramp.source};h.root.vy.Zk=renderer;
  const records=new Float32Array(count*16),bits=new Uint32Array(records.buffer),params=new Float32Array(284);
  records.set([1,2,3,0,2,0,0,10,2,0,0,0,1,.5,.25,1]);bits[9]=0xffc12345;
  if(count>1){records.set([4,5,6,0,0,1,0,0,1,0,0,0,.5,1,.5,1],16);bits[25]=0xffffffff;}
  if(count>2){records.set([7,8,9,3,0,0,1,10,1,0,0,0,1,1,1,1],32);bits[41]=0x80000001;}
  params[1]=-1;params.set([0,0,0,0],4);params[3]=2;params[8]=2;params[9]=2;params[10]=1;params[12]=0;params[13]=1;
  params.set([1,0,0,1,0,1,0,1],28);params.set([0,1,0,1,1,0,0,1],92);
  params.set([0,1,2,0,1,2,3,0],156);params.set([0,0,1,0,1,.1,.9,0],220);
  const forbidden=()=>{++simulated;throw Error('Source simulation/mutation called');};
  const p={ring:{kY:count,records,recordBits:bits,cursor:count>1?1:0,highWater:count,uploadFrom:-1,wrapTo:0},records:{_hardwareTexture:{underlyingResource:record}},renderer,tY:h.scene,
    perRow:Math.min(count,256),renderingGroupId:0,blendMode:blend,animatedFrame:1,liveUntil:10,time:2,particleTexture:tex.source,ramp:ramp.source,
    animate:forbidden,spawn:forbidden,prepareDraw:forbidden,takeUploads:forbidden,getActiveCount:forbidden};
  h.scene._activeParticleSystems={data:[p],length:1};h.scene.particleSystems=[p];
  gl._gpuActive=unit=>{active=unit;};gl._gpuBind=(_target,handle)=>bindings.set(active,handle);
  const oldParameter=gl.getParameter.bind(gl);gl.getParameter=k=>k===gl.CURRENT_PROGRAM?current:k===gl.ACTIVE_TEXTURE?active:k===gl.TEXTURE_BINDING_2D?bindings.get(active):k===gl.VIEWPORT?[0,0,gl.drawingBufferWidth,gl.drawingBufferHeight]:k===gl.COLOR_WRITEMASK?[true,true,true,true]:k===gl.DEPTH_RANGE?[0,1]:k===gl.DEPTH_WRITEMASK?false:k===gl.DEPTH_FUNC?515:k===gl.BLEND_EQUATION_RGB||k===gl.BLEND_EQUATION_ALPHA?32774:k===gl.BLEND_SRC_RGB?factors[0]:k===gl.BLEND_DST_RGB?factors[1]:k===gl.BLEND_SRC_ALPHA?factors[2]:k===gl.BLEND_DST_ALPHA?factors[3]:[gl.UNPACK_ROW_LENGTH,gl.UNPACK_SKIP_ROWS,gl.UNPACK_SKIP_PIXELS].includes(k)?0:[gl.PIXEL_PACK_BUFFER_BINDING,gl.READ_FRAMEBUFFER_BINDING,gl.READ_BUFFER,gl.PACK_ALIGNMENT,gl.PACK_ROW_LENGTH,gl.PACK_SKIP_ROWS,gl.PACK_SKIP_PIXELS].includes(k)?oldParameter(k):null;
  gl.getTexParameter=(_t,k)=>[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].includes(k)?9728:33071;gl.isEnabled=k=>k===gl.DEPTH_TEST||k===gl.BLEND;gl.getUniformLocation=(_program,key)=>key;gl.getUniform=(_program,key)=>uniforms.get(key);
  function upload(){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,record);for(let first=0;first<count;first+=p.perRow){const n=Math.min(p.perRow,count-first);gl.texSubImage2D(gl.TEXTURE_2D,0,0,Math.floor(first/p.perRow),n*4,1,gl.RGBA_INTEGER,gl.UNSIGNED_INT,bits,first*16);}}
  function draw(){
    uniforms.set('gpuParticleView',s.view);uniforms.set('gpuParticleProjection',s.projection);uniforms.set('gpuParticleFrame',new Float32Array([10,20,30,2]));uniforms.set('gpuParticleRange',[p.ring.cursor<count?p.ring.cursor:0,count]);uniforms.set('gpuParticleRamp',params[10]);
    for(let i=0;i<71;++i)uniforms.set('gpuParticleSystem['+i+']',params.subarray(i*4,i*4+4));
    uniforms.set('gpuParticleTexture',0);uniforms.set('gpuParticleRampTexture',1);uniforms.set('gpuParticleRecords',2);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex.handle);gl.activeTexture(gl.TEXTURE0+1);gl.bindTexture(gl.TEXTURE_2D,ramp.handle);gl.activeTexture(gl.TEXTURE0+2);gl.bindTexture(gl.TEXTURE_2D,record);gl.activeTexture(gl.TEXTURE0);
    const modes=p.blendMode===4?[3,2]:[p.blendMode];for(const mode of modes){current=(mode===3?renderer.multiplyEffect:renderer.effect)._pipelineContext.program;factors=({'-1':[0,769,1,1],0:[1,1,0,1],1:[770,771,1,1],2:[770,1,0,1],3:[774,0,1,1]})[mode];gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,count);}
  }
  function next(){s.next();p.animatedFrame=h.scene.getFrameId();}
  return {p,records,bits,params,upload,draw,next,uniforms,renderer,simulated:()=>simulated};
}
test('GPU actual draw observation transports ring bits, uniforms and both source passes atomically',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),g=gpuSource(h,s),{validatePacket}=require('../transport.cjs');
  try{await h.api.resync();const before=Buffer.from(g.bits.buffer).toString('hex');g.upload();g.draw();s.complete();await h.api.flush();
    let p=h.packets.filter(p=>p.readUInt32LE(4)===31).at(-1);assert.ok(p,h.api.status().fallbackReason+' '+h.api.status().error);validatePacket(p);
    assert.equal(p.readUInt32LE(28),2);const at=32+p.readUInt32LE(24);assert.equal(p.readUInt32LE(at+8),3);assert.equal(p.readUInt32LE(at+12),1);assert.equal(p.readUInt32LE(at+1352+36),0xffc12345);
    assert.equal(p.readUInt32LE(at+24)&8,8);assert.equal(p.readUInt32LE(at+1352+3*64+24)&8,0);
    assert.equal(Buffer.from(g.bits.buffer).toString('hex'),before);assert.equal(g.simulated(),0);
    require('node:fs').writeFileSync(require('node:path').join(__dirname,'../../outputs/native-renderer-verification/gpu-particles.bin'),p);
    // No renewed timestamp or transaction for an already sent source frame.
    const n=h.packets.filter(p=>p.readUInt32LE(4)===31).length;await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===31).length,n);
    g.next();g.draw();s.complete();await h.api.flush();assert.equal(h.api.presentation().ready,true,h.api.status().fallbackReason+' '+h.api.status().error);
    const q=h.api.presentation();h.api.setPresentation(true,q.epoch,q.revision);g.next();g.draw();s.complete();await h.api.flush();assert.equal(g.simulated(),0);
    h.advance(251);assert.equal(h.api.presentation().ready,false);
  }finally{h.api.stop();}
});
test('GPU unknown uploads, changed bits, shader/provider/camera and partial multiply draws retain fallback',async()=>{
  for(const kind of ['unseen','bits','shader','provider','camera','partial']){
    const h=await harness({count:1}),s=authoritativeSource(h),g=gpuSource(h,s);
    try{await h.api.resync();if(kind!=='unseen')g.upload();if(kind==='bits')g.bits[9]^=1;if(kind==='shader')g.renderer.effect._rawVertexSourceCode+=' changed';if(kind==='provider')h.root.vy.KY={particles:{}};
      g.draw();if(kind==='camera')s.view[12]-=1;if(kind==='partial')g.p.blendMode=2;s.complete();await h.api.flush();assert.equal(h.api.presentation().ready,false,kind);assert.equal(g.simulated(),0);
    }finally{h.api.stop();}
  }
});
test('GPU transport rejects malformed complete packets and preserves uint seed payloads',()=>{
  const fs=require('node:fs'),path=require('node:path'),{validatePacket}=require('../transport.cjs');const p=fs.readFileSync(path.join(__dirname,'../../outputs/native-renderer-verification/gpu-particles.bin'));const at=32+p.readUInt32LE(24);
  for(const edit of [b=>b.writeUInt32LE(2,20),b=>b.writeUInt32LE(33,28),b=>b.writeUInt32LE(0,at),b=>b.writeUInt32LE(8193,at+8),b=>b.writeUInt32LE(3,at+12),b=>b.writeUInt32LE(0,at+16),b=>b.writeUInt32LE(16,at+24),b=>b.writeFloatLE(NaN,at+72),b=>b.writeFloatLE(17,at+72+36*4+3*4),b=>b.writeFloatLE(NaN,at+1352)]){const bad=Buffer.from(p);edit(bad);assert.throws(()=>validatePacket(bad));}
  const short=p.subarray(0,p.length-1);short.writeUInt32LE(short.length-16,8);assert.throws(()=>validatePacket(short));
});

test('GPU all proven blend variants, zero/live slots and ring start use actual draw parameters',async()=>{
  const {validatePacket}=require('../transport.cjs');
  for(const blend of [-1,0,1,2,3,4]){
    const h=await harness({count:1}),s=authoritativeSource(h),g=gpuSource(h,s,{blend});
    try{await h.api.resync();g.p.ring.cursor=0;g.upload();g.draw();s.complete();await h.api.flush();const p=h.packets.filter(p=>p.readUInt32LE(4)===31).at(-1);assert.ok(p,h.api.status().error);validatePacket(p);
      const at=32+p.readUInt32LE(24);assert.equal(p.readUInt32LE(at+12),0);assert.equal(p.readUInt32LE(at+8),3);assert.equal(p.readFloatLE(at+1352+16*4+7*4),0);assert.equal(g.simulated(),0);
      const good=h.api.presentation();h.api.setPresentation(true,good.epoch,good.revision);h.sourceGL.drawingBufferWidth=800;assert.equal(h.api.presentation().ready,false);
    }finally{h.api.stop();}
  }
});
test('GPU recovery reads only bounded integer PBO data without waiting or advancing source',async()=>{
  const h=await harness({count:1,asyncGPU:true}),s=authoritativeSource(h),g=gpuSource(h,s,{blend:2});const gl=h.sourceGL;
  const originalRead=gl.readPixels;gl.readPixels=(x,y,w,hh,format,type,offset)=>{
    if(format!==gl.RGBA_INTEGER){if(ArrayBuffer.isView(offset)){offset.fill(255);return;}return originalRead(x,y,w,hh,format,type,offset);}
    assert.equal(type,gl.UNSIGNED_INT);assert.equal(offset,0);const target=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);new Uint32Array(target.bytes.buffer).set(g.bits);
  };
  try{await h.api.resync();g.draw();assert.equal(h.copies(),0);assert.equal(h.api.presentation().ready,false);s.complete();h.signalGPU();h.advance(251);await h.tick();
    g.next();g.draw();s.complete();await h.api.flush();const p=h.packets.filter(p=>p.readUInt32LE(4)===31).at(-1);assert.ok(p,h.api.status().fallbackReason+' '+h.api.status().error);require('../transport.cjs').validatePacket(p);assert.equal(g.simulated(),0);
  }finally{h.api.stop();}
});

test('GPU ring wraps across integer texture rows and preserves unwritten/dead slots',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),g=gpuSource(h,s,{count:257,blend:2});
  try{await h.api.resync();g.p.ring.cursor=256;g.bits[256*16+9]=0xdeadbeef;g.upload();g.draw();s.complete();await h.api.flush();const p=h.packets.filter(p=>p.readUInt32LE(4)===31).at(-1);assert.ok(p,h.api.status().error);require('../transport.cjs').validatePacket(p);
    const at=32+p.readUInt32LE(24);assert.equal(p.readUInt32LE(at+8),257);assert.equal(p.readUInt32LE(at+12),256);assert.equal(p.readUInt32LE(at+1352+(256*16+9)*4),0xdeadbeef);assert.equal(p.readFloatLE(at+1352+(256*16+7)*4),0);assert.equal(g.simulated(),0);
  }finally{h.api.stop();}
});
test('GPU texture generations are immutable across render snapshots and removal revokes ownership',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),g=gpuSource(h,s,{blend:2});
  try{await h.api.resync();g.upload();g.draw();s.complete();await h.api.flush();let p=h.packets.filter(p=>p.readUInt32LE(4)===31).at(-1);const old=p.readUInt32LE(32+p.readUInt32LE(24)+16);
    g.next();g.draw();s.complete();await h.api.flush();const q=h.api.presentation();h.api.setPresentation(true,q.epoch,q.revision);
    // The particle color texture is bound on unit zero by the inert source draw.
    h.sourceGL.activeTexture(h.sourceGL.TEXTURE0);h.sourceGL.texSubImage2D(h.sourceGL.TEXTURE_2D,0,0,0,1,1,h.sourceGL.RGBA,h.sourceGL.UNSIGNED_BYTE,new Uint8Array([1,2,3,4]));
    assert.equal(h.api.presentation().ready,false);g.next();g.draw();s.complete();await h.api.flush();p=h.packets.filter(p=>p.readUInt32LE(4)===31).at(-1);assert.notEqual(p.readUInt32LE(32+p.readUInt32LE(24)+16),old);
    h.scene._activeParticleSystems.length=0;await h.api.flush();assert.equal(g.simulated(),0);assert.equal(h.packets.at(-1).readUInt32LE(4)===31,false);
  }finally{h.api.stop();}
});

function authoritativeLight(h){
  Object.assign(h.root.vy,sourceLighting(),{Tf:[0,.6,.8],XY:[12,3,1],WY:20,pY:[2,3,4],FY:0,visionMinLightColour:[.2,.2,.2]});
  h.root.vy.constructor=function Renderer(){this.sm=[1,1,1];};
  h.root.vy.render=function(){this.pY[0]=neverCalled;this.tY.render();throw Error('Source render called');};
  return sourceDrawObservation(h,h.scene.meshes[0]);
}
test('source world light pre-draw snapshot reaches atomic transport without rereading changed source fields',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h),{validatePacket}=require('../transport.cjs');
  try{await h.api.resync();const before=JSON.stringify({v:h.root.vy.sm,p:h.root.vy.pY,feet:s.feet,eye:s.eye});d.fire();s.complete();
    h.scene.clearColor={r:1,g:0,b:0,a:1};h.root.vy.sm[0]=.99; // after completed render: transmitted data must remain the sampled value
    await h.api.flush();const p=h.packets.filter(p=>p.readUInt32LE(4)===32).at(-1);assert.ok(p);validatePacket(p);
    assert.equal(p.readUInt32LE(28),15);assert.equal(p.readUInt32LE(108),30);assert.equal(p.readFloatLE(104+208),.5);assert.equal(p.readFloatLE(36),Math.fround(.8));assert.equal(p.readFloatLE(48),Math.fround(.2));
    assert.deepEqual(Array.from({length:8},(_,i)=>p.readFloatLE(60+4*i)),[12,3,1,20,2,3,4,0]);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-light.bin',p);
    h.root.vy.sm[0]=.8;assert.equal(JSON.stringify({v:h.root.vy.sm,p:h.root.vy.pY,feet:s.feet,eye:s.eye}),before);
    const n=h.packets.filter(p=>p.readUInt32LE(4)===32).length;await h.api.flush();assert.equal(h.packets.filter(p=>p.readUInt32LE(4)===32).length,n);
    for(const change of [b=>b.writeUInt32LE(2,20),b=>b.writeUInt32LE(16,28),b=>b.writeUInt32LE(0,32),b=>b.writeFloatLE(NaN,36),b=>b.writeFloatLE(16,60),b=>b.writeFloatLE(2,88),b=>b.writeFloatLE(9,92),b=>b.writeUInt32LE(99,120),b=>b.writeUInt32LE(32,108)]){
      const bad=Buffer.from(p);change(bad);assert.throws(()=>validatePacket(bad));}
    const truncated=Buffer.from(p.subarray(0,p.length-1));truncated.writeUInt32LE(truncated.length-16,8);assert.throws(()=>validatePacket(truncated));
  }finally{h.api.stop();assert.equal(d.hooks.size,0);}
});
test('conflicting light observations and unknown groups cannot retain valid source bindings',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h),{validatePacket}=require('../transport.cjs');
  const last=()=>h.packets.filter(p=>[30,32].includes(p.readUInt32LE(4))).at(-1);
  try{await h.api.resync();d.fire();h.root.vy.sm[0]=.4;d.fire();s.complete();await h.api.flush();assert.equal(last().readUInt32LE(4),30);
    s.next();h.root.vy.sm[0]=NaN;h.root.vy.XY[0]=16;h.root.vy.Tf=null;d.fire();s.complete();await h.api.flush();let p=last();validatePacket(p);assert.equal(p.readUInt32LE(28),1);assert.ok(p.subarray(36,104).every(v=>v===0));
    s.next();h.root.vy.yy=false;d.fire();s.complete();await h.api.flush();p=last();validatePacket(p);assert.equal(p.readUInt32LE(28),1);assert.equal(p.readUInt32LE(32),0);
    s.next();delete h.root.vy.yy;d.fire();s.complete();await h.api.flush();p=last();validatePacket(p);assert.equal(p.readUInt32LE(28),0);
    h.advance(251);await h.api.flush();assert.equal(last().readUInt32LE(4),30);assert.equal(last().readUInt32LE(24),0);
  }finally{h.api.stop();}
});
test('light snapshots reject scene camera origin resize and ownership changes and recover on a fresh render',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h);
  try{await h.api.resync();d.fire();s.complete();await h.api.flush();const lightCount=()=>h.packets.filter(p=>p.readUInt32LE(4)===32).length;
    for(const [change,restore] of [[()=>h.sourceGL.drawingBufferWidth=800,()=>h.sourceGL.drawingBufferWidth=640],[()=>h.root.Lj[0]+=32,()=>h.root.Lj[0]-=32],[()=>h.scene.activeCamera={...s.camera},()=>h.scene.activeCamera=s.camera]]){
      const n=lightCount();change();await h.api.flush();assert.equal(lightCount(),n);restore();s.next();d.fire();s.complete();await h.api.flush();assert.equal(lightCount(),n+1);}
    const n=lightCount();await h.api.resync();await h.api.flush();assert.equal(lightCount(),n);s.next();d.fire();s.complete();await h.api.flush();assert.equal(lightCount(),n+1);
    s.next();d.fire();h.root.Lj[0]+=32;s.complete();await h.api.flush();assert.equal(lightCount(),n+1);
  }finally{h.api.stop();}
});
test('light envelope preserves actual q9aot GPU records and CPU particle packets',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),g=gpuSource(h,s),d=authoritativeLight(h),{validatePacket}=require('../transport.cjs');
  const cpu=sourceParticles(h);h.scene.particleSystems=[cpu,g.p];h.scene._activeParticleSystems={data:[cpu,g.p],length:2};
  try{await h.api.resync();g.upload();g.draw();s.complete();await h.api.flush();g.next();assert.equal(d.hooks.size,1);d.fire();g.draw();s.complete();await h.api.flush();const p=h.packets.filter(p=>p.readUInt32LE(4)===32).at(-1);
    assert.ok(p,JSON.stringify(h.api.status()));validatePacket(p);assert.equal(p.readUInt32LE(108),31);assert.equal(p.readUInt32LE(132),2);assert.equal(g.simulated(),0);
    assert.ok(h.packets.some(p=>p.readUInt32LE(4)===26));require('node:fs').writeFileSync('outputs/native-renderer-verification/source-light-gpu.bin',p);
  }finally{h.api.stop();}
});
function emissionSource(h,{mixed=false,zero=false,width=2,preserveRegistry=false}={}){
  h.context.emissionOptions={mixed,zero,width,preserveRegistry};h.context.emissionMesh=h.scene.meshes[0];
  return vm.runInContext(`(()=>{
    const root=testSingletons.noa,mesh=emissionMesh,options=emissionOptions;
    if(!options.preserveRegistry)root.As={Us:[null,options.zero?null:[3,2,1],[7,0,0]]};
    root.Is={my:root,workers:[],tempChunk:{i:0,j:0,k:0,size:2},
      lazyInitMeshingObjs(){return {lightEmissionLookup:Js(ky)};},
      assignMeshDataToChunk(){this.meshBuilder.assignMeshData(my,ys[Ys]);}};
    const worker=new Worker(),lookup=options.preserveRegistry?new Uint16Array(root.As.Us.map(v=>v?v[0]|v[1]<<4|v[2]<<8:0)):new Uint16Array([0,options.zero?0:0x123,7]);
    const init={type:'meshingInit',data:{Zy:2,lightEmissionLookup:lookup}};
    worker.postMessage(init);root.Is.workers.push(worker);
    const block=new Uint16Array(8).fill(1);if(options.mixed)block[1]=2;
    const positions=new Float32Array([1,0,0,1,0,options.width,1,1,options.width,1,1,0]);
    const vertices=new ArrayBuffer(128),view=new DataView(vertices);
    for(let v=0;v<4;++v)for(let c=0;c<3;++c)view.setFloat32(v*32+c*4,positions[v*3+c],true);
    const indices=new Uint32Array([0,1,2,0,2,3]);
    const reply={type:'meshed',i:0,j:0,k:0,meshJobId:1,lightOnlyUpdate:false,
      reusableChunkArrs:[null,null,null,null,null,null,null,block],
      vertexDataInfo:[{terrainID:4,vertices,indices,usesAtlas:true}],
      faceLayout:[{terrainID:4,numFaces:1,is:new Int16Array([1]),js:new Int16Array([0]),ks:new Int16Array([0]),
        wids:new Int16Array([options.width]),hts:new Int16Array([1]),zy:new Uint8Array([0])}]};
    const job={type:'Oy',data:{chunk:root.Is.tempChunk,meshJobId:1}};
    worker.postMessage(job,[]);worker.reply(reply);
    mesh.metadata={noa_chunk_terrain_mesh:true};mesh.data.position=positions;
    mesh.data.normal=new Float32Array([1,0,0,1,0,0,1,0,0,1,0,0]);mesh.data.uv=new Float32Array(8);
    mesh.data.color=new Float32Array(12).fill(1);mesh.data.texAtlasIndices=new Float32Array(4);
    mesh._geometry._indices=indices;mesh._geometry._vertexBuffers.position._buffer={_data:new Uint8Array(vertices)};
    mesh.world[12]=1;mesh.world[13]=4;mesh.world[14]=3;
    mesh.getTotalVertices=()=>4;mesh.getTotalIndices=()=>6;
    return {worker,init,job,reply,lookup,block,vertices,mesh};
  })()`,h.context);
}

// Inert data only: no source mesher or public module is evaluated. Source face
// storage and index order deliberately differ; one greedy face is ambiguous.
function mixedEmissionSource(h,options={}){
  const e=emissionSource(h,{width:1,...options});h.context.mixedEmission=e;
  return vm.runInContext(`(()=>{
    const e=mixedEmission,root=testSingletons.noa;
    root.As.Us=[null,[3,2,1],null,[7,0,0]];e.init.data.lightEmissionLookup=new Uint16Array([0,0x123,0,7]);e.worker.postMessage(e.init);
    const block=new Uint16Array([1,2,1,3,3,0,0,0]),positions=new Float32Array(48),vertices=new ArrayBuffer(512),view=new DataView(vertices);
    const origins=[[1,0,0],[1,0,1],[1,1,0],[2,0,0]],widths=[1,1,2,1];
    for(let f=0;f<4;++f)for(let v=0;v<4;++v)for(let c=0;c<3;++c){const value=origins[f][c]+(c===2&&(v===1||v===2)?widths[f]:0)+(c===1&&v>=2?1:0);
      positions[(f*4+v)*3+c]=value;view.setFloat32((f*4+v)*32+c*4,value,true);}
    const indices=new Uint32Array([3,0,1,2].flatMap(f=>[0,1,2,0,2,3].map(v=>f*4+v)));
    const reply={...e.reply,meshJobId:2,reusableChunkArrs:[null,null,null,null,null,null,null,block],
      vertexDataInfo:[{terrainID:4,vertices,indices,usesAtlas:true}],
      faceLayout:[{terrainID:4,numFaces:4,is:new Int16Array([1,1,1,2]),js:new Int16Array([0,0,1,0]),ks:new Int16Array([0,1,0,0]),
        wids:new Int16Array(widths),hts:new Int16Array([1,1,1,1]),zy:new Uint8Array(4)}]};
    e.job.data.meshJobId=2;e.worker.postMessage(e.job);e.worker.reply(reply);
    const mesh=e.mesh;mesh.data.position=positions;mesh.data.normal=new Float32Array(48).fill(1);mesh.data.uv=new Float32Array(32);
    mesh.data.color=new Float32Array(48).fill(1);mesh.data.texAtlasIndices=new Float32Array(16);
    mesh._geometry._indices=indices;mesh._geometry._vertexBuffers.position._buffer={_data:new Uint8Array(vertices)};
    mesh.getTotalVertices=()=>16;mesh.getTotalIndices=()=>24;
    return {...e,reply,block,vertices};
  })()`,h.context);
}
function emissionEntriesV2(p){
  assert.equal(p.readUInt32LE(20),2);let at=32;const entries=[];
  for(let i=0;i<p.readUInt32LE(28);++i){const e={id:p.readUInt32LE(at),sequence:p.readUInt32LE(at+4),job:p.readUInt32LE(at+8),runs:[]},n=p.readUInt32LE(at+12);at+=16;
    for(let j=0;j<n;++j){e.runs.push([p.readUInt32LE(at),p.readUInt32LE(at+4)]);at+=8;}entries.push(e);}
  return {entries,nested:at};
}
function blockEntries(p){
  assert.equal(p.readUInt32LE(20),4);let at=32;const entries=[];
  for(let i=0;i<p.readUInt32LE(28);++i){const e={id:p.readUInt32LE(at),sequence:p.readUInt32LE(at+4),job:p.readUInt32LE(at+8),kind:p.readUInt32LE(at+12),instanceSequence:p.readUInt32LE(at+16),runs:[]},n=p.readUInt32LE(at+20);at+=24;
    for(let j=0;j<n;++j){const stride=e.kind?5:3;e.runs.push(Array.from({length:stride},(_,k)=>p.readUInt32LE(at+k*4)));at+=stride*4;}entries.push(e);}
  return {entries,nested:at};
}

test('default block identity carries source IDs independently of RGB through exact mixed-face index order',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:null}),s=authoritativeSource(h),d=authoritativeLight(h);
  try{await h.api.resync();const e=mixedEmissionSource(h),before=JSON.stringify(e.reply);await h.api.resync();d.fire();s.complete();await h.api.flush();
    const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);
    const {entries,nested}=blockEntries(p);assert.deepEqual(entries[0].runs,[[6,0x1007,0x10003],[12,0x1123,0x10001],[18,0x1000,0x10002],[24,0,0]]);
    assert.equal(entries[0].instanceSequence,0);assert.equal(p.readUInt32LE(nested+4),32);assert.equal(JSON.stringify(e.reply),before);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-block-faces.bin',p);fs.writeFileSync('outputs/native-renderer-verification/source-block-faces-mesh.bin',h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1));
    e.block.fill(3);s.next();d.fire();s.complete();await h.api.flush();assert.deepEqual(blockEntries(h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1)).entries[0].runs,entries[0].runs);
    for(const [offset,value] of [[20,5],[44,2],[48,1],[52,0],[52,8193],[56,5],[60,8192],[64,1],[64,65535],[64,131072],[64,0xffffffff]]){
      const bad=Buffer.from(p);bad.writeUInt32LE(value,offset);assert.throws(()=>require('../transport.cjs').validatePacket(bad));}
    const cut=Buffer.from(p.subarray(0,-1));cut.writeUInt32LE(cut.length-16,8);assert.throws(()=>require('../transport.cjs').validatePacket(cut));
  }finally{h.api.stop();assert.equal(h.api.status().sourceEmissionSnapshotBytes,0);}
});

test('equal RGB never merges distinct block IDs or labels a greedy face containing different blocks',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),d=authoritativeLight(h);
  try{await h.api.resync();const e=mixedEmissionSource(h);h.context.blockEvidence=e;
    vm.runInContext(`(()=>{const e=blockEvidence;testSingletons.noa.As.Us=[null,[3,2,1],[3,2,1],[3,2,1]];
      e.init.data.lightEmissionLookup=new Uint16Array([0,0x123,0x123,0x123]);e.worker.postMessage(e.init);
      e.job.data.meshJobId=3;e.reply.meshJobId=3;e.worker.postMessage(e.job);e.worker.reply(e.reply);})()`,h.context);
    await h.api.resync();d.fire();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);
    assert.deepEqual(blockEntries(p).entries[0].runs,[[6,0x1123,0x10003],[12,0x1123,0x10001],[18,0x1123,0x10002],[24,0x1123,0]]);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-block-equal-rgb.bin',p);fs.writeFileSync('outputs/native-renderer-verification/source-block-equal-rgb-mesh.bin',h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1));
  }finally{h.api.stop();}
});

test('known block identity survives missing RGB evidence and distinguishes raw block zero from unknown',async()=>{
  for(const zero of [false,true]){const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),d=authoritativeLight(h);
    try{await h.api.resync();const e=emissionSource(h,{width:1});if(zero)e.block.fill(0);else delete h.root.As.Us[1];
      e.worker.postMessage(e.init);e.worker.postMessage(e.job);e.worker.reply(e.reply);
      await h.api.resync();d.fire();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);
      assert.deepEqual(blockEntries(p).entries[0].runs,[[6,zero?0x1000:0,zero?0x10000:0x10001]]);
      const fs=require('node:fs'),name=zero?'zero':'unknown-rgb';fs.writeFileSync('outputs/native-renderer-verification/source-block-'+name+'.bin',p);fs.writeFileSync('outputs/native-renderer-verification/source-block-'+name+'-mesh.bin',h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1));
    }finally{h.api.stop();}
  }
});

test('block identity follows exact triangle and submesh remapping without exporting all-unknown subsets',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),d=authoritativeLight(h);
  try{await h.api.resync();const e=mixedEmissionSource(h),original=e.mesh.material;
    e.mesh.material={subMaterials:[original,{...original},{...original}]};e.mesh.subMeshes=[{indexStart:6,indexCount:9,materialIndex:0},{indexStart:0,indexCount:6,materialIndex:1},{indexStart:18,indexCount:6,materialIndex:2}];
    await h.api.resync();d.fire();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);
    assert.deepEqual(blockEntries(p).entries.map(e=>e.runs),[[[6,0x1123,0x10001],[9,0x1000,0x10002]],[[6,0x1007,0x10003]]]);
    const scans=h.api.status().scanVisited,uploads=h.api.status().meshUploads;s.next();d.fire();s.complete();await h.api.flush();assert.equal(h.api.status().scanVisited,scans);assert.equal(h.api.status().meshUploads,uploads);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-block-remap.bin',p);fs.writeFileSync('outputs/native-renderer-verification/source-block-remap-mesh.bin',Buffer.concat(h.packets.filter(b=>b.readUInt32LE(4)===3).slice(-3)));
  }finally{h.api.stop();}
});

test('v4 instance identity retains upload, slot-swap and reuse lifetimes without treating RGB as a block type',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),e=instanceEmissionSource(h),d=sourceDrawObservation(h,e.mesh);
  e.mesh.world[12]=2;e.mesh.world[13]=4;e.mesh.world[14]=4;
  const frame=async()=>{await h.api.flush();s.next();d.fire();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);return p;};
  try{await h.api.resync();e.manager.Ms(e.chunk,1,0,0,0);e.manager.Ms(e.chunk,2,1,0,0);e.manager.Ms(e.chunk,3,2,0,0);e.manager.ey();
    const p=await frame(),entry=blockEntries(p).entries[0];assert.equal(entry.kind,1);assert.deepEqual(entry.runs.map(r=>r[2]),[1,2,3]);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-block-instances.bin',p);fs.writeFileSync('outputs/native-renderer-verification/source-block-instances-mesh.bin',Buffer.concat([h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1),h.packets.filter(b=>b.readUInt32LE(4)===9).at(-1)]));
    e.manager.Ms(e.chunk,0,0,0,0);e.manager.ey();const swapped=blockEntries(await frame()).entries[0];assert.deepEqual(swapped.runs.map(r=>r[2]),[3,2]);assert.deepEqual(swapped.runs[0].slice(2),entry.runs[2].slice(2));
    e.manager.Ms(e.chunk,1,0,0,0);e.manager.ey();assert.notEqual(blockEntries(await frame()).entries[0].runs[2][4],entry.runs[0][4]);
  }finally{h.api.stop();}
});

test('new block identity revokes changed geometry, initialization and source ownership and accounts its proof storage',async()=>{
  for(const mode of ['bytes','indices','worker','reinit','registry','expiry']){const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),d=authoritativeLight(h);
    try{await h.api.resync();const e=mixedEmissionSource(h);await h.api.resync();d.fire();s.complete();await h.api.flush();
      const count=h.packets.filter(b=>b.readUInt32LE(4)===33).length;assert.ok(count);assert.ok(h.api.status().sourceEmissionSnapshotBytes<=1024*1024);
      if(mode==='bytes')new Uint8Array(e.vertices)[12]^=1;if(mode==='indices')e.reply.vertexDataInfo[0].indices[0]=0;if(mode==='worker')h.root.Is.workers=[];
      if(mode==='reinit')e.worker.postMessage(e.init);if(mode==='registry')h.root.As.Us[1][0]=8;
      if(mode==='expiry'){h.advance(251);await h.api.flush();}else{s.next();d.fire();s.complete();await h.api.flush();}
      assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).length,count,mode);
    }finally{h.api.stop();assert.equal(h.api.status().sourceEmissionSnapshotBytes,0);}
  }
});

test('one atomic block transaction preserves both terrain and observed instance identities',async()=>{
  const h=await harness({count:2,sourceBlockIdentity:true}),s=authoritativeSource(h),d=authoritativeLight(h);
  try{await h.api.resync();mixedEmissionSource(h);const registry=h.root.As.Us;h.scene.meshes.reverse();const e=instanceEmissionSource(h),di=sourceDrawObservation(h,e.mesh);h.scene.meshes.reverse();h.root.As.Us=registry;
    e.mesh.world[12]=2;e.mesh.world[13]=4;e.mesh.world[14]=4;
    await h.api.resync();e.manager.Ms(e.chunk,1,0,0,0);e.manager.Ms(e.chunk,2,1,0,0);e.manager.Ms(e.chunk,3,2,0,0);e.manager.ey();await h.api.flush();
    s.next();d.fire();di.fire();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);
    const {entries}=blockEntries(p);assert.deepEqual(entries.map(e=>e.kind).sort(),[0,1]);assert.equal(entries.reduce((n,e)=>n+e.runs.length,0),7);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-block-hybrid.bin',p);
    const ids=new Set(entries.map(e=>e.id));fs.writeFileSync('outputs/native-renderer-verification/source-block-hybrid-mesh.bin',Buffer.concat([...ids].flatMap(id=>[h.packets.filter(b=>b.readUInt32LE(4)===3&&b.readUInt32LE(20)===id).at(-1),h.packets.filter(b=>b.readUInt32LE(4)===9&&b.readUInt32LE(20)===id).at(-1)].filter(Boolean))));
  }finally{h.api.stop();}
});

test('block identity wraps source light and actual q9aot GPU records while preserving CPU particle packets',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),g=gpuSource(h,s),d=authoritativeLight(h),cpu=sourceParticles(h);
  h.scene.particleSystems=[cpu,g.p];h.scene._activeParticleSystems={data:[cpu,g.p],length:2};
  try{await h.api.resync();mixedEmissionSource(h);await h.api.resync();g.upload();g.draw();s.complete();await h.api.flush();
    g.next();d.fire();g.draw();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);
    const {entries,nested}=blockEntries(p);assert.equal(entries[0].runs.length,4);assert.equal(p.readUInt32LE(nested+4),32);assert.equal(p.readUInt32LE(nested+108),31);
    assert.ok(h.packets.some(b=>b.readUInt32LE(4)===26));assert.equal(g.simulated(),0);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-block-gpu.bin',p);const id=entries[0].id;
    fs.writeFileSync('outputs/native-renderer-verification/source-block-gpu-mesh.bin',h.packets.filter(b=>b.readUInt32LE(4)===3&&b.readUInt32LE(20)===id).at(-1));
  }finally{h.api.stop();}
});
test('mixed terrain exports exact per-face RGB, known zero and unknown greedy runs in source index order',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h);
  try{await h.api.resync();const e=mixedEmissionSource(h);await h.api.resync();d.fire();s.complete();await h.api.flush();
    const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);
    const {entries,nested}=emissionEntriesV2(p);assert.equal(entries.length,1);assert.equal(entries[0].job,2);
    assert.deepEqual(entries[0].runs,[[6,0x1007],[12,0x1123],[18,0x1000],[24,0]]);assert.equal(p.readUInt32LE(nested+4),32);
    const mesh=h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1);assert.equal(entries[0].sequence,mesh.readUInt32LE(12));
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-emission-faces.bin',p);fs.writeFileSync('outputs/native-renderer-verification/source-emission-faces-mesh.bin',mesh);
    // Returning arrays to the pool must not relabel existing immutable faces.
    e.block.fill(3);s.next();d.fire();s.complete();await h.api.flush();assert.deepEqual(emissionEntriesV2(h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1)).entries[0].runs,entries[0].runs);
    for(const edit of [b=>b.writeUInt32LE(0,44),b=>b.writeUInt32LE(8193,44),b=>b.writeUInt32LE(5,48),b=>b.writeUInt32LE(0,48),b=>b.writeUInt32LE(1,52),b=>b.writeUInt32LE(8192,52),b=>b.writeUInt32LE(6,56),b=>b.writeUInt32LE(6000003,48),b=>b.writeUInt32LE(33,nested+4)]){
      const bad=Buffer.from(p);edit(bad);assert.throws(()=>require('../transport.cjs').validatePacket(bad));}
  }finally{h.api.stop();assert.equal(h.api.status().sourceEmissionSnapshotBytes,0);}
});
test('mixed group submeshes and triangle remapping recover homogeneous subsets without labeling ambiguous faces',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h);
  try{await h.api.resync();const e=mixedEmissionSource(h),original=e.mesh.material;
    e.mesh.material={subMaterials:[original,{...original},{...original}]};e.mesh.subMeshes=[{indexStart:6,indexCount:9,materialIndex:0},{indexStart:0,indexCount:6,materialIndex:1},{indexStart:18,indexCount:6,materialIndex:2}];
    await h.api.resync();d.fire();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);
    require('../transport.cjs').validatePacket(p);const {entries}=emissionEntriesV2(p);assert.equal(entries.length,2);
    assert.deepEqual(entries.map(e=>e.runs),[[[6,0x1123],[9,0x1000]],[[6,0x1007]]]);
    const meshes=h.packets.filter(b=>b.readUInt32LE(4)===3).slice(-3);assert.equal(meshes[0].readUInt32LE(32),7);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-emission-remap.bin',p);fs.writeFileSync('outputs/native-renderer-verification/source-emission-remap-mesh.bin',Buffer.concat(meshes));
    const scans=h.api.status().scanVisited,uploads=h.api.status().meshUploads;s.next();d.fire();s.complete();await h.api.flush();
    assert.equal(h.api.status().scanVisited,scans);assert.equal(h.api.status().meshUploads,uploads);
  }finally{h.api.stop();}
});
test('new block job generation replaces per-face proof; old bytes, registry and crossed-face triangles cannot relabel it',async()=>{
  for(const mode of ['block','registry','indices']){
    const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h);
    try{await h.api.resync();const e=mixedEmissionSource(h);await h.api.resync();d.fire();s.complete();await h.api.flush();
      const count=h.packets.filter(b=>b.readUInt32LE(4)===33).length;h.context.changedEmission=e;
      if(mode==='registry')h.root.As.Us[1][0]=5;
      else vm.runInContext(`(()=>{const e=changedEmission;
        if('${mode}'==='indices'){e.reply.vertexDataInfo[0].indices[0]=0;return;}
        const vertices=e.vertices.slice(0);e.block[0]=2;e.job.data.meshJobId=3;e.worker.postMessage(e.job);
        e.reply.meshJobId=3;e.reply.vertexDataInfo[0].vertices=vertices;e.worker.reply(e.reply);
        // assignMeshData installs a new VertexBuffer, not just its retained data.
        e.mesh._geometry._vertexBuffers.position={...e.mesh._geometry._vertexBuffers.position,_buffer:{_data:new Uint8Array(vertices)}};
      })()`,h.context);
      await h.api.flush();assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).length,count);
      if(mode!=='block')await h.api.resync();s.next();d.fire();s.complete();await h.api.flush();
      if(mode==='block'){const changed=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1),entry=emissionEntriesV2(changed).entries[0];assert.equal(entry.job,3);assert.deepEqual(entry.runs,[[6,0x1007],[18,0x1000],[24,0]]);
        const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-emission-block-change.bin',changed);fs.writeFileSync('outputs/native-renderer-verification/source-emission-block-change-mesh.bin',h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1));}
      else assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).length,count);
    }finally{h.api.stop();}
  }
});

test('meshingInit observation reaches capture emission transaction with exact geometry generation and immutable register snapshot',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h);let e;
  try{
    await h.api.resync();e=emissionSource(h);const before=JSON.stringify(e.reply);await h.api.resync();
    d.fire();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);
    assert.ok(p,JSON.stringify(h.api.status()));require('../transport.cjs').validatePacket(p);
    assert.equal(p.readUInt32LE(28),1);assert.equal(p.readUInt32LE(44),0x123);
    const mesh=h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1);assert.equal(p.readUInt32LE(36),mesh.readUInt32LE(12));
    assert.equal(p.readUInt32LE(40),1);assert.equal(JSON.stringify(e.reply),before);
    assert.equal(e.worker.calls.length,2);assert.equal(e.worker.calls[0].args[0],e.init);assert.equal(e.worker.calls[1].args[0],e.job);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-emission.bin',p);fs.writeFileSync('outputs/native-renderer-verification/source-emission-mesh.bin',mesh);
    // Mutating the outgoing source lookup after successful post cannot change the copy.
    e.lookup[1]=7;s.next();d.fire();s.complete();await h.api.flush();assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1).readUInt32LE(44),0x123);
    h.root.As.Us[1][0]=8;const count=h.packets.filter(b=>[32,33].includes(b.readUInt32LE(4))).length;
    await h.api.flush();assert.equal(h.packets.filter(b=>[32,33].includes(b.readUInt32LE(4))).length,count);assert.equal(h.api.presentation().ready,false);
    s.next();d.fire();s.complete();await h.api.flush();assert.notEqual(h.packets.filter(b=>[30,32,33].includes(b.readUInt32LE(4))).at(-1).readUInt32LE(4),33);
  }finally{h.api.stop();assert.equal(e?.worker.listeners.size,0);assert.equal(h.context.Worker.prototype.postMessage,h.originalWorkerPost);}
});

test('source own RGB distinguishes known zero from mixed greedy geometry without deriving emission from material or propagated light',async()=>{
  for(const options of [{mixed:true},{zero:true,width:1}]){
    const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h);
    try{await h.api.resync();const e=emissionSource(h,options);e.mesh.material.emissiveColor={r:15,g:10,b:9};await h.api.resync();d.fire();s.complete();await h.api.flush();
      const p=h.packets.filter(b=>[30,32,33].includes(b.readUInt32LE(4))).at(-1);
      assert.equal(p.readUInt32LE(4)===33,!!options.zero);if(options.zero)assert.equal(p.readUInt32LE(44),0);
    }finally{h.api.stop();}
  }
});

test('authorized Worker wrapper preserves return value, receiver, arguments and original exceptions',async()=>{
  const h=await harness({count:0});
  try{const worker=new h.context.Worker(),message={type:'unrelated'},transfer=[];
    assert.equal(worker.postMessage(message,transfer),worker.result);assert.equal(worker.calls[0].receiver,worker);
    assert.equal(worker.calls[0].args[0],message);assert.equal(worker.calls[0].args[1],transfer);
    const failure=Error('original');worker.failure=failure;assert.throws(()=>worker.postMessage(message),e=>e===failure);assert.equal(worker.calls.length,2);
  }finally{h.api.stop();}
});
test('emission source submesh remapping preserves uniform RGB and validates the complete packet before transport',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h);
  try{await h.api.resync();const e=emissionSource(h);const original=e.mesh.material;
    e.mesh.material={subMaterials:[original,{...original}]};e.mesh.subMeshes=[{indexStart:0,indexCount:3,materialIndex:0},{indexStart:3,indexCount:3,materialIndex:1}];
    await h.api.resync();d.fire();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1),validate=require('../transport.cjs').validatePacket;
    assert.ok(p);validate(p);assert.equal(p.readUInt32LE(28),2);assert.equal(p.readUInt32LE(44),0x123);assert.equal(p.readUInt32LE(60),0x123);
    for(const edit of [b=>b.writeUInt32LE(2,20),b=>b.writeUInt32LE(8193,28),b=>b.writeUInt32LE(0,32),b=>b.writeUInt32LE(0,36),b=>b.writeUInt32LE(0,40),b=>b.writeUInt32LE(4096,44),b=>b.writeUInt32LE(b.readUInt32LE(32),48),b=>b.writeUInt32LE(33,68),b=>b.writeUInt32LE(999,80)]){
      const bad=Buffer.from(p);edit(bad);assert.throws(()=>validate(bad));}
    const cut=Buffer.from(p.subarray(0,p.length-1));cut.writeUInt32LE(cut.length-16,8);assert.throws(()=>validate(cut));
    assert.ok(h.packets.filter(b=>b.readUInt32LE(4)===3).slice(-2).every(b=>b.readUInt32LE(32)===3));
  }finally{h.api.stop();}
});

test('emission rejects late replies, lost worker ownership, changed bytes, instances and conflicts in one source frame',async()=>{
  for(const mode of ['late','bytes','worker','thin','regular','conflict','camera','reinit']){
    const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h);
    try{await h.api.resync();const e=emissionSource(h);await h.api.resync();d.fire();s.complete();await h.api.flush();assert.ok(h.packets.some(b=>b.readUInt32LE(4)===33));
      const initial=h.packets.filter(b=>b.readUInt32LE(4)===33).length;s.next();
      if(mode==='late'){e.reply.meshJobId=999;const copy=vm.runInContext('new ArrayBuffer(128)',h.context);new Uint8Array(copy).set(new Uint8Array(e.vertices));e.reply.vertexDataInfo[0].vertices=copy;e.worker.reply(e.reply);e.mesh._geometry._vertexBuffers.position._buffer._data=new Uint8Array(copy);}
      if(mode==='bytes')new Uint8Array(e.vertices)[12]^=1;
      if(mode==='worker')h.root.Is.workers.length=0;
      if(mode==='thin')e.mesh._thinInstanceDataStorage={matrixData:identity(),instancesCount:1};
      if(mode==='regular')e.mesh.sourceMesh={...e.mesh};
      if(mode==='reinit')e.worker.postMessage(e.init);
      if(mode==='conflict'){d.fire();h.root.As.Us[1][0]=8;d.fire();h.root.As.Us[1][0]=3;}
      d.fire();if(mode==='camera')s.view[12]-=.1;s.complete();await h.api.flush();
      assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).length,initial,mode);
    }finally{h.api.stop();}
  }
});

function instanceEmissionSource(h){
  // Inert source-shape mock. No public bundle/function is evaluated.
  h.context.instanceRoot=h.root;h.context.instanceMesh=h.scene.meshes[0];
  return vm.runInContext(`(()=>{const root=instanceRoot,mesh=instanceMesh;let buffer=null,slots=[],created=false,dirty=false;
    const calls=[],result={forwarded:true};root.emit=function(...args){calls.push({receiver:this,args});api.onEmit?.(...args);return result;};
    root.As={Us:[null,[3,2,1],null,[0,4,0]],bf:[null,mesh,mesh,mesh],cs:[]};
    root.As.vz=function(id,options){this.Us[id]=options.rgb;return result;};
    mesh.PO=function(kind,data){if(kind==='matrix')this._thinInstanceDataStorage={matrixData:data,instancesCount:0};return result;};
    mesh.UO=function(kind){if(api.failure)throw api.failure;calls.push({kind});return result;};
    const chunk={x:0,y:0,z:0,Pf:{}};
    const manager=root.zs={tf:[],Ds(c){c.Pf={};},Ms(c,id,x,y,z){const key=[c.x+x,c.y+y,c.z+z].join(':'),old=c.Pf[key]||0;if(old===id)return result;
      const index=slots.indexOf(key);if(index>=0){const last=slots.length-1;for(let j=0;j<16;j++)buffer[index*16+j]=buffer[last*16+j];slots[index]=slots[last];slots.pop();delete c.Pf[key];}
      if(id){if(!created){created=true;this.tf.push(mesh);root.emit('addingTerrainMesh',mesh);buffer=new Float32Array(128);mesh.PO('matrix',buffer);mesh.PO('aPackedLightLevels',new Float32Array(8));}
        if(slots.length*16===buffer.length){const grown=new Float32Array(buffer.length*2);for(let i=0;i<buffer.length;i++)grown[i]=buffer[i];buffer=grown;mesh.PO('matrix',buffer);}
        const matrix=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);buffer.set(matrix,slots.length*16);slots.push(key);c.Pf[key]=id;}
      dirty=true;return result;},ey(){if(dirty){mesh._thinInstanceDataStorage.instancesCount=slots.length;mesh.UO('matrix');mesh.UO('aPackedLightLevels');dirty=false;}
        if(created&&!slots.length){root.emit('removingTerrainMesh',mesh);created=false;buffer=null;}return result;},
      iy(c){for(const key of [...slots]){const p=key.split(':').map(Number);this.Ms(c,0,...p);}c.Pf=null;},Hf(v){for(let i=0;i<slots.length;i++)for(let c=0;c<3;c++)buffer[i*16+12+c]-=v[c];dirty=true;},wf(){dirty=true;}};
    const api={chunk,mesh,manager,calls,result,failure:null,onEmit:null,get buffer(){return buffer;},get slots(){return [...slots];}};return api;
  })()`,h.context);
}

function materialSource(h){
  const e=instanceEmissionSource(h);h.context.materialRoot=h.root;
  const data=vm.runInContext(`(()=>{const root=materialRoot,registry=root.As,names={};
    const add=(id,name,rootId=id,rootName=name,state='',rot=null,open=null,half=null)=>{const item={id,name,meta:Object.freeze({rootId,rootName,metaStr:state,rot,open,halfblockPlacement:half})};names[id]=names[name]=item;return item;};
    add(1,'Stone');add(2,'Stone|meta|rot2|top',1,'Stone','rot2|top',2,false,1);add(3,'Glass');
    root.bloxd={my:root,As:{metadatas:names}};
    for(const key of ['os','Qs','Xz','us'])registry[key]=[];
    registry.vz=function(id,options){this.Us[id]=options.rgb;this.os[id]=!!options.solid;this.Qs[id]=!!options.opaque;this.Xz[id]=!!options.fluid;this.us[id]=!!options.model;return id;};
    return {names,add,register(id){return registry.vz(id,{rgb:id===1?[3,2,1]:id===2?null:[7,0,0],solid:true,opaque:id!==3,fluid:false,model:false});}};})()`,h.context);
  return {...e,...data};
}
function materialEntries(p){
  assert.equal(p.readUInt32LE(20),5);let at=36;const definitions=[];
  for(let i=0;i<p.readUInt32LE(32);++i){const w=Array.from({length:10},(_,k)=>p.readUInt32LE(at+k*4));at+=40;const length=w[7]+w[8]+w[9],text=p.subarray(at,at+length).toString('ascii');
    definitions.push({token:w[0],id:w[1],root:w[2],flags:w[3],rotation:w[4],open:w[5],half:w[6],name:text.slice(0,w[7]),rootName:text.slice(w[7],w[7]+w[8]),state:text.slice(w[7]+w[8])});at+=(length+3)&~3;}
  const entryAt=at,entries=[];
  for(let i=0;i<p.readUInt32LE(28);++i){const kind=p.readUInt32LE(at+12),n=p.readUInt32LE(at+20),entry={id:p.readUInt32LE(at),kind,runs:[]};at+=24;
    for(let j=0;j<n;++j){const stride=kind?6:4;entry.runs.push(Array.from({length:stride},(_,k)=>p.readUInt32LE(at+k*4)));at+=stride*4;}entries.push(entry);}
  return {definitions,entries,entryAt,nested:at};
}

test('real slab metadata spellings and effective model flags survive observed instance Capture unchanged',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),m=materialSource(h),d=sourceDrawObservation(h,m.mesh);
  m.mesh.world[12]=2;m.mesh.world[13]=4;m.mesh.world[14]=4;
  m.add(1,'Stone Slab',1,'Stone Slab','meta|rot1|bot',1,null,0);
  m.add(2,'Stone Slab|meta|rot1|top',1,'Stone Slab','meta|rot1|top',1,null,1);
  m.add(3,'Stone Slab|meta|rot1|side',1,'Stone Slab','meta|rot1|side',1,null,2);
  try{await h.api.resync();for(let id=1;id<=3;++id)h.root.As.vz(id,{rgb:null,solid:true,opaque:false,fluid:false,model:true});
    for(let id=1;id<=3;++id)m.manager.Ms(m.chunk,id,id-1,0,0);m.manager.ey();await h.api.flush();s.next();d.fire();s.complete();await h.api.flush();
    const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);
    const parsed=materialEntries(p);assert.equal(parsed.entries[0].kind,1);assert.equal(parsed.definitions.length,3);
    for(const x of parsed.definitions){assert.equal(x.flags,9);assert.equal(x.rotation,1);assert.equal(x.open,0);assert.equal(x.half,x.id);assert.equal(x.root,1);assert.equal(x.rootName,'Stone Slab');}
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/minecraft-material-slabs.bin',p);
    fs.writeFileSync('outputs/native-renderer-verification/minecraft-material-slabs-mesh.bin',Buffer.concat([h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1),h.packets.filter(b=>b.readUInt32LE(4)===9).at(-1)]));
  }finally{h.api.stop();}
});

test('static fluids preserve terrain geometry and independent own RGB through material Capture',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),m=materialSource(h),d=authoritativeLight(h);
  try{
    await h.api.resync();for(const [id,name,rgb] of [[1,'Lava',[14,8,2]],[2,'Toxic Waste',[6,14,4]],[3,'Water',null]]){m.add(id,name,id,name,'',null,null,null);h.root.As.vz(id,{rgb,solid:false,opaque:false,fluid:true,model:false});}
    const e=mixedEmissionSource(h,{preserveRegistry:true});h.root.As.Us=[null,[14,8,2],[6,14,4],null];e.init.data.lightEmissionLookup.set([0,0x28e,0x4e6,0]);
    e.worker.postMessage(e.init);e.worker.postMessage(e.job);e.worker.reply(e.reply);
    const vertices=Buffer.from(e.vertices),indices=Array.from(e.mesh._geometry._indices);
    await h.api.flush();d.fire();s.complete();await h.api.flush();
    const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);const parsed=materialEntries(p);
    assert.equal(parsed.entries[0].kind,0);assert.equal(parsed.definitions.length,3);for(const x of parsed.definitions){assert.equal(x.flags,4);assert.equal(x.state,'');assert.equal(x.id,x.root);}
    assert.deepEqual(parsed.entries[0].runs.map(r=>r.slice(0,3)),[[6,0x1000,0x10003],[12,0x128e,0x10001],[18,0x14e6,0x10002],[24,0,0]]);
    assert.deepEqual(Buffer.from(e.vertices),vertices);assert.deepEqual(Array.from(e.mesh._geometry._indices),indices);
    const fs=require('node:fs'),prefix='outputs/native-renderer-verification/minecraft-material-fluid-terrain';fs.writeFileSync(prefix+'.bin',p);fs.writeFileSync(prefix+'-mesh.bin',h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1));
  }finally{h.api.stop();}
});

for(const shaped of ['stairs','doors','logs','cherrylogs','planks','grass','fluids'])test(`observed ${shaped} states retain exact source property evidence through instance Capture`,async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),m=materialSource(h),d=sourceDrawObservation(h,m.mesh);
  m.mesh.world[12]=2;m.mesh.world[13]=4;m.mesh.world[14]=4;
  if(shaped==='stairs'){
    m.add(1,'Stone Stairs',1,'Stone Stairs','meta|rot1|bot',1,null,0);
    m.add(2,'Stone Stairs|meta|rot2|top|innerLeft',1,'Stone Stairs','meta|rot2|top|innerLeft',2,null,1);
    m.add(3,'Stone Stairs|meta|rot1|side',1,'Stone Stairs','meta|rot1|side',1,null,2);
  }else if(shaped==='doors'){
    m.add(1,'Jungle Door',1,'Jungle Door','meta|rot1|closed',1,false,null);
    m.add(20,'_Jungle Door Top',20,'_Jungle Door Top','meta|rot1|closed',1,false,null);
    m.add(2,'_Jungle Door Top|meta|rot4|open',20,'_Jungle Door Top','meta|rot4|open',4,true,null);
    m.add(3,'Maple Door',3,'Maple Door','meta|rot1|closed',1,false,null);
  }else{
    const names={logs:['Jungle Log','Barkless Jungle Log','Maple Log'],cherrylogs:['Cherry Log','Barkless Cherry Log','Pine Log'],planks:['Jungle Wood Planks','Cherry Wood Planks','Mango Wood Planks'],grass:['Grass Block','Cherry Wood Planks','Jungle Grass Block'],fluids:['Water','Lava','Toxic Waste']}[shaped];
    for(let id=1;id<=3;++id)m.add(id,names[id-1],id,names[id-1],'',null,null,null);
  }
  const model=shaped==='stairs'||shaped==='doors';
  try{await h.api.resync();for(let id=1;id<=3;++id)h.root.As.vz(id,{rgb:null,solid:shaped!=='fluids',opaque:!model&&shaped!=='fluids',fluid:shaped==='fluids',model});
    for(let id=1;id<=3;++id)m.manager.Ms(m.chunk,id,id-1,0,0);m.manager.ey();await h.api.flush();s.next();d.fire();s.complete();await h.api.flush();
    const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);
    const parsed=materialEntries(p);assert.equal(parsed.entries[0].kind,1);assert.equal(parsed.definitions.length,3);
    for(const x of parsed.definitions)assert.equal(x.flags,shaped==='fluids'?4:model?9:3);
    assert.equal(parsed.definitions.find(x=>x.id===2).state,shaped==='stairs'?'meta|rot2|top|innerLeft':shaped==='doors'?'meta|rot4|open':'');
    if(!model)for(const x of parsed.definitions){assert.equal(x.rotation,0);assert.equal(x.half,0);assert.equal(x.open,0);assert.equal(x.id,x.root);}
    const fs=require('node:fs'),prefix=`outputs/native-renderer-verification/minecraft-material-${shaped}`;fs.writeFileSync(prefix+'.bin',p);
    fs.writeFileSync(prefix+'-mesh.bin',Buffer.concat([h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1),h.packets.filter(b=>b.readUInt32LE(4)===9).at(-1)]));
  }finally{h.api.stop();}
});

test('observed source registrations carry immutable names, family, properties and variant states through exact terrain ranges',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),m=materialSource(h),d=authoritativeLight(h);
  try{await h.api.resync();for(let id=1;id<=3;++id)assert.equal(m.register(id),id);const e=mixedEmissionSource(h,{preserveRegistry:true});await h.api.flush();d.fire();s.complete();await h.api.flush();
    const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);const parsed=materialEntries(p),byId=new Map(parsed.definitions.map(x=>[x.id,x]));
    assert.equal(parsed.definitions.length,3);assert.deepEqual(parsed.entries[0].runs.map(r=>r.slice(0,3)),[[6,0x1007,0x10003],[12,0x1123,0x10001],[18,0x1000,0x10002],[24,0,0]]);
    assert.deepEqual({...byId.get(2),token:0},{token:0,id:2,root:1,flags:3,rotation:2,open:1,half:2,name:'Stone|meta|rot2|top',rootName:'Stone',state:'rot2|top'});
    assert.equal(byId.get(3).flags,1);assert.deepEqual(parsed.entries[0].runs.map(r=>r[3]),[byId.get(3).token,byId.get(1).token,byId.get(2).token,0]);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-material-faces.bin',p);fs.writeFileSync('outputs/native-renderer-verification/source-material-faces-mesh.bin',h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1));
    e.block.fill(3);s.next();d.fire();s.complete();await h.api.flush();assert.deepEqual(materialEntries(h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1)).definitions,parsed.definitions);
    for(const [at,value] of [[32,0],[32,257],[36,0],[40,0],[44,65536],[48,16],[52,5],[56,3],[60,4],[64,129],[68,0],[parsed.entryAt+36,0xffffffff]]){const bad=Buffer.from(p);bad.writeUInt32LE(value,at);assert.throws(()=>require('../transport.cjs').validatePacket(bad));}
    const bad=Buffer.from(p);bad[76]=0;assert.throws(()=>require('../transport.cjs').validatePacket(bad));
  }finally{h.api.stop();assert.equal(h.api.status().sourceMaterialDefinitions,0);assert.equal(h.api.status().sourceEmissionSnapshotBytes,0);}
});

test('source definitions require observed registration before worker initialization and never relabel old geometry after re-registration',async()=>{
  for(const mode of ['late','reregister','register-after-init']){
    const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),m=materialSource(h),d=authoritativeLight(h);
    const publish=async()=>{s.next();d.fire();s.complete();await h.api.flush();return h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);};
    try{if(mode==='late')for(let id=1;id<=3;++id)m.register(id);await h.api.resync();if(mode!=='late')for(let id=1;id<=3;++id)m.register(id);
      const e=emissionSource(h,{width:1,preserveRegistry:true});await h.api.flush();let p=await publish();assert.equal(p.readUInt32LE(20),mode==='late'?4:5);
      const oldToken=mode==='late'?0:materialEntries(p).definitions[0].token;m.register(1);p=await publish();assert.equal(p.readUInt32LE(20),4);
      e.worker.postMessage(e.init);if(mode==='register-after-init')m.register(1);e.worker.postMessage(e.job);e.worker.reply(e.reply);e.mesh._geometry={...e.mesh._geometry};await h.api.flush();p=await publish();assert.equal(p.readUInt32LE(20),mode==='register-after-init'?4:5);
      if(mode!=='register-after-init')assert.notEqual(materialEntries(p).definitions[0].token,oldToken);
    }finally{h.api.stop();}
  }
});

test('metadata aliases, mutable descriptors, source property mutations and owner changes revoke names without fabricating them',async()=>{
  for(const mode of ['alias','getter','mutable','flags','owner','name']){
    const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),m=materialSource(h),d=authoritativeLight(h);
    try{await h.api.resync();for(let id=1;id<=3;++id)m.register(id);emissionSource(h,{width:1,preserveRegistry:true});await h.api.flush();d.fire();s.complete();await h.api.flush();
      assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1).readUInt32LE(20),5);
      if(mode==='alias')m.names.Stone={...m.names[1]};if(mode==='flags')h.root.As.Qs[1]=false;if(mode==='owner')h.root.bloxd={...h.root.bloxd};if(mode==='name')m.names[1].name='Renamed';
      if(mode==='getter')Object.defineProperty(m.names[1],'name',{get(){throw Error('Source getter must never be invoked');}});
      if(mode==='mutable')m.names[1].meta={...m.names[1].meta};
      s.next();d.fire();s.complete();await h.api.flush();assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1).readUInt32LE(20),4,mode);
    }finally{h.api.stop();}
  }
});

test('observed instance definitions follow append, slot swap and distinct source registration lifetimes',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),m=materialSource(h),d=sourceDrawObservation(h,m.mesh);
  m.mesh.world[12]=2;m.mesh.world[13]=4;m.mesh.world[14]=4;
  const publish=async()=>{await h.api.flush();s.next();d.fire();s.complete();await h.api.flush();return h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);};
  try{await h.api.resync();for(let id=1;id<=3;++id)m.register(id);for(let id=1;id<=3;++id)m.manager.Ms(m.chunk,id,id-1,0,0);m.manager.ey();const p=await publish();require('../transport.cjs').validatePacket(p);
    const parsed=materialEntries(p);assert.equal(parsed.entries[0].kind,1);assert.deepEqual(parsed.entries[0].runs.map(r=>r[2]),[1,2,3]);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-material-instances.bin',p);fs.writeFileSync('outputs/native-renderer-verification/source-material-instances-mesh.bin',Buffer.concat([h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1),h.packets.filter(b=>b.readUInt32LE(4)===9).at(-1)]));
    m.manager.Ms(m.chunk,0,0,0,0);m.manager.ey();const swapped=materialEntries(await publish());assert.deepEqual(swapped.entries[0].runs[0].slice(2),parsed.entries[0].runs[2].slice(2));
  }finally{h.api.stop();}
});

test('source definition tracking uses bounded direct lookups, forwards calls and releases its shared proof budget',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),m=materialSource(h);const original=h.root.As.vz;
  try{await h.api.resync();for(let id=1;id<=1000;++id){if(id>3)m.add(id,'Block '+id);assert.equal(m.register(id),id);assert.ok(h.api.status().sourceEmissionSnapshotBytes<=1024*1024);}
    assert.equal(h.api.status().sourceMaterialDefinitions,256);assert.ok(h.api.status().sourceEmissionSnapshotBytes>256*256);
  }finally{h.api.stop();assert.equal(h.root.As.vz,original);assert.equal(h.api.status().sourceEmissionSnapshotBytes,0);}
});

test('material dictionaries share one atomic light/GPU frame without simulating particles or changing CPU batches',async()=>{
  const h=await harness({count:1,sourceBlockIdentity:true}),s=authoritativeSource(h),m=materialSource(h),g=gpuSource(h,s),d=authoritativeLight(h),cpu=sourceParticles(h);
  h.scene.particleSystems=[cpu,g.p];h.scene._activeParticleSystems={data:[cpu,g.p],length:2};
  try{await h.api.resync();for(let id=1;id<=3;++id)m.register(id);mixedEmissionSource(h,{preserveRegistry:true});await h.api.flush();
    g.upload();g.draw();s.complete();await h.api.flush();g.next();d.fire();g.draw();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);require('../transport.cjs').validatePacket(p);
    const {definitions,nested}=materialEntries(p);assert.equal(definitions.length,3);assert.equal(p.readUInt32LE(nested+4),32);assert.equal(p.readUInt32LE(nested+108),31);assert.equal(g.simulated(),0);assert.ok(h.packets.some(b=>b.readUInt32LE(4)===26));
    require('node:fs').writeFileSync('outputs/native-renderer-verification/source-material-gpu.bin',p);
  }finally{h.api.stop();}
});

test('observed instance appends and swap removal bind mixed RGB to exact instance upload sequences',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),e=instanceEmissionSource(h),d=sourceDrawObservation(h,e.mesh);e.mesh.world[12]=2;e.mesh.world[13]=4;e.mesh.world[14]=4;
  const original={Ms:e.manager.Ms,emit:h.root.emit,PO:e.mesh.PO,UO:e.mesh.UO,set:vm.runInContext('Float32Array.prototype.set',h.context)};
  const validate=require('../transport.cjs').validatePacket;
  const frame=async()=>{await h.api.flush();s.next();d.fire();s.complete();await h.api.flush();return h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);};
  try{await h.api.resync();assert.equal(e.manager.Ms(e.chunk,1,0,0,0),e.result);e.manager.Ms(e.chunk,2,1,0,0);e.manager.Ms(e.chunk,3,2,0,0);e.manager.ey();
    let p=await frame();assert.ok(p,JSON.stringify(h.api.status()));validate(p);assert.equal(p.readUInt32LE(20),3);assert.equal(p.readUInt32LE(44),1);
    assert.deepEqual([56,76,96].map(at=>[p.readUInt32LE(at),p.readUInt32LE(at+4)]),[[1,0x1123],[2,0x1000],[3,0x1040]]);
    assert.equal(p.readUInt32LE(48),h.packets.filter(b=>b.readUInt32LE(4)===9).at(-1).readUInt32LE(12));
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-emission-instances.bin',p);
    fs.writeFileSync('outputs/native-renderer-verification/source-emission-instances-mesh.bin',Buffer.concat([h.packets.filter(b=>b.readUInt32LE(4)===3).at(-1),h.packets.filter(b=>b.readUInt32LE(4)===9).at(-1)]));
    assert.deepEqual([64,84,104].map(at=>p.readUInt32LE(at)),[1,2,3]);
    const swappedRegistration=p.readUInt32LE(108),swappedLife=p.readUInt32LE(112),removedLife=p.readUInt32LE(72);
    const oldSequence=p.readUInt32LE(48),oldLife=p.readUInt32LE(40);e.manager.Ms(e.chunk,0,0,0,0);
    const before=h.packets.filter(b=>b.readUInt32LE(4)===33).length;await frame();assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).length,before,'Uncommitted swap must stay unknown');
    e.manager.ey();p=await frame();validate(p);assert.deepEqual([56,76].map(at=>[p.readUInt32LE(at),p.readUInt32LE(at+4)]),[[1,0x1040],[2,0x1000]]);assert.notEqual(p.readUInt32LE(48),oldSequence);assert.notEqual(p.readUInt32LE(40),oldLife);
    assert.equal(p.readUInt32LE(64),3);assert.equal(p.readUInt32LE(68),swappedRegistration);assert.equal(p.readUInt32LE(72),swappedLife);
    e.manager.Ms(e.chunk,1,0,0,0);e.manager.ey();p=await frame();assert.equal(p.readUInt32LE(100),0x1123);assert.notEqual(p.readUInt32LE(112),removedLife);
    const count=h.packets.filter(b=>b.readUInt32LE(4)===33).length;h.root.As.vz(1,{rgb:[9,0,0]});h.root.As.vz(1,{rgb:[3,2,1]});await frame();assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).length,count,'Register ABA must revoke the old storage');
    for(const edit of [b=>b.writeUInt32LE(2,44),b=>b.writeUInt32LE(0,48),b=>b.writeUInt32LE(0,56),b=>b.writeUInt32LE(8192,60)]){const bad=Buffer.from(p);edit(bad);assert.throws(()=>validate(bad));}
  }finally{h.api.stop();assert.equal(e.manager.Ms,original.Ms);assert.equal(h.root.emit,original.emit);assert.equal(e.mesh.PO,original.PO);assert.equal(e.mesh.UO,original.UO);assert.equal(vm.runInContext('Float32Array.prototype.set',h.context),original.set);assert.equal(h.api.status().sourceInstanceProofs,0);}
});

test('instance observer revokes late, stale, incomplete, replaced, conflicted and failed source lifetimes',async()=>{
  for(const mode of ['late','mid-register','bytes','between-uploads','light-only','owner','chunk','throw','conflict','rebase','register','unknown']){
    const h=await harness({count:1}),s=authoritativeSource(h),e=instanceEmissionSource(h),d=sourceDrawObservation(h,e.mesh);
    const publish=async()=>{s.next();d.fire();s.complete();await h.api.flush();};
    try{
      if(mode==='late'){e.manager.Ms(e.chunk,1,0,0,0);e.manager.ey();}
      await h.api.resync();
      if(mode==='mid-register')e.onEmit=()=>{h.root.As.vz(1,{rgb:[3,2,1]});};
      if(mode!=='late'){e.manager.Ms(e.chunk,1,0,0,0);e.manager.ey();}
      await h.api.flush();await publish();const before=h.packets.filter(b=>b.readUInt32LE(4)===33).length;
      if(mode==='late'||mode==='mid-register'){assert.equal(before,0);continue;}assert.ok(before>0,mode);
      if(mode==='bytes')e.buffer[12]+=1;
      if(mode==='between-uploads'){e.mesh.UO('matrix');e.buffer[12]+=1;e.mesh.UO('aPackedLightLevels');}
      if(mode==='light-only')e.mesh.UO('aPackedLightLevels');
      if(mode==='owner')e.manager.Ms=function foreign(){};
      if(mode==='chunk')e.manager.iy(e.chunk);
      if(mode==='throw'){const failure=Error('original upload failure');e.failure=failure;e.manager.wf();assert.throws(()=>e.manager.ey(),x=>x===failure);}
      if(mode==='register'){h.root.As.vz(1,{rgb:[3,2,1]});}
      if(mode==='unknown'){delete h.root.As.Us[1];}
      if(mode==='rebase')e.manager.Hf([32,0,0]);
      if(mode==='conflict'){s.next();d.fire();e.manager.Ms(e.chunk,2,1,0,0);e.manager.ey();d.fire();s.complete();await h.api.flush();}
      else await publish();
      assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).length,before,mode);
      if(mode==='rebase'){e.manager.ey();await h.api.flush();await publish();assert.ok(h.packets.filter(b=>b.readUInt32LE(4)===33).length>before);}
    }finally{h.api.stop();assert.equal(h.api.status().sourceInstanceProofs,0);assert.equal(h.api.status().sourceEmissionSnapshotBytes,0);}
  }
});

test('instance observer releases empty storage and can prove a new lifetime after source recreation',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),e=instanceEmissionSource(h),d=sourceDrawObservation(h,e.mesh);
  const frame=async()=>{await h.api.flush();s.next();d.fire();s.complete();await h.api.flush();return h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);};
  try{await h.api.resync();e.manager.Ms(e.chunk,1,0,0,0);e.manager.ey();const first=await frame();
    e.manager.Ms(e.chunk,0,0,0,0);e.manager.ey();assert.equal(h.api.status().sourceInstanceProofs,0);assert.equal(h.api.status().sourceEmissionSnapshotBytes,0);
    e.manager.Ms(e.chunk,2,0,0,0);e.manager.ey();const next=await frame();assert.notEqual(next.readUInt32LE(40),first.readUInt32LE(40));assert.equal(next.readUInt32LE(60),0x1000);
  }finally{h.api.stop();}
});

test('instance observation shares the bounded proof pool and releases storage on overflow',async()=>{
  const h=await harness({count:1}),e=instanceEmissionSource(h);
  try{await h.api.resync();for(let i=0;i<7000;++i){e.manager.Ms(e.chunk,1,i,0,0);assert.ok(h.api.status().sourceEmissionSnapshotBytes<=1024*1024);}
    assert.equal(e.slots.length,7000);assert.equal(h.api.status().sourceInstanceProofs,0);assert.equal(h.api.status().sourceEmissionSnapshotBytes,0);
  }finally{h.api.stop();}
});

test('instance slot swap, reuse, removal and register ABA never inherit a terrain emission proof',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),d=authoritativeLight(h);
  try{await h.api.resync();const e=emissionSource(h);await h.api.resync();d.fire();s.complete();await h.api.flush();
    const initial=h.packets.filter(b=>b.readUInt32LE(4)===33).length;assert.ok(initial>0);
    const matrices=new Float32Array([...identity(),...identity()]);matrices[28]=3;
    const storage={matrixData:matrices,instancesCount:2};e.mesh._thinInstanceDataStorage=storage;
    // Even plausible source-like fields are not authoritative ownership evidence.
    e.mesh.blockId=1;e.mesh.Df=['0:0:0','3:0:0'];e.mesh.jr={'0:0:0':0,'3:0:0':16};
    const steps=[()=>{},()=>{matrices.copyWithin(0,16,32);storage.instancesCount=1;},
      ()=>{storage.instancesCount=2;matrices.set(identity(),16);},()=>{storage.instancesCount=0;},
      ()=>{storage.instancesCount=1;h.root.As.Us[1]=[9,0,0];},()=>{h.root.As.Us[1]=[3,2,1];}];
    for(const step of steps){s.next();step();d.fire();s.complete();await h.api.flush();
      assert.equal(h.packets.filter(b=>b.readUInt32LE(4)===33).length,initial);}
  }finally{h.api.stop();}
});

test('worker source messages are not changed on failed initialization and foreign prototype ownership is preserved',async()=>{
  const h=await harness({count:1});let e;
  try{await h.api.resync();e=emissionSource(h);const original=Error('send failed');e.worker.failure=original;
    const calls=e.worker.calls.length,values=Array.from(e.lookup);assert.throws(()=>e.worker.postMessage(e.init),x=>x===original);
    assert.equal(e.worker.calls.length,calls+1);assert.deepEqual(Array.from(e.lookup),values);assert.equal(e.worker.listeners.size,0);
    const foreign=function foreign(){};h.context.Worker.prototype.postMessage=foreign;h.api.stop();assert.equal(h.context.Worker.prototype.postMessage,foreign);
  }finally{h.api.stop();}
});
test('own RGB wraps combined source light and q9aot frame without changing CPU particle packets',async()=>{
  const h=await harness({count:1}),s=authoritativeSource(h),g=gpuSource(h,s),d=authoritativeLight(h);
  const cpu=sourceParticles(h);h.scene.particleSystems=[cpu,g.p];h.scene._activeParticleSystems={data:[cpu,g.p],length:2};
  try{await h.api.resync();mixedEmissionSource(h);await h.api.resync();g.upload();g.draw();s.complete();await h.api.flush();
    g.next();d.fire();g.draw();s.complete();await h.api.flush();const p=h.packets.filter(b=>b.readUInt32LE(4)===33).at(-1);assert.ok(p,JSON.stringify(h.api.status()));
    require('../transport.cjs').validatePacket(p);const {nested:at,entries}=emissionEntriesV2(p);assert.equal(entries[0].runs.length,4);assert.equal(p.readUInt32LE(at+4),32);assert.equal(p.readUInt32LE(at+108),31);
    assert.ok(h.packets.some(b=>b.readUInt32LE(4)===26));assert.equal(g.simulated(),0);
    const fs=require('node:fs');fs.writeFileSync('outputs/native-renderer-verification/source-emission-gpu.bin',p);
    const id=p.readUInt32LE(32);fs.writeFileSync('outputs/native-renderer-verification/source-emission-gpu-mesh.bin',h.packets.filter(b=>b.readUInt32LE(4)===3&&b.readUInt32LE(20)===id).at(-1));
  }finally{h.api.stop();}
});
test('meshing proof storage evicts bounded snapshots and releases worker storage on removal and stop',async()=>{
  for(const sourceBlockIdentity of [false,true]){
  const h=await harness({count:1,sourceBlockIdentity});
  try{await h.api.resync();const e=emissionSource(h);await h.api.resync();
    h.context.budgetSource=e;
    vm.runInContext(`(()=>{
      const e=budgetSource,n=4096;
      for(let job=2;job<=4;++job){
        e.job.data.meshJobId=job;e.worker.postMessage(e.job,[]);
        const vertices=new ArrayBuffer(n*128),raw=new Uint8Array(vertices),unit=new Uint8Array(e.vertices),indices=new Uint32Array(n*6);
        for(let i=0;i<n;++i){raw.set(unit,i*128);for(let k=0;k<6;++k)indices[i*6+k]=i*4+e.reply.vertexDataInfo[0].indices[k];}
        const group={terrainID:4,numFaces:n,is:new Int16Array(n).fill(1),js:new Int16Array(n),ks:new Int16Array(n),wids:new Int16Array(n).fill(2),hts:new Int16Array(n).fill(1),zy:new Uint8Array(n)};
        e.worker.reply({...e.reply,meshJobId:job,faceLayout:[group],vertexDataInfo:[{terrainID:4,usesAtlas:true,vertices,indices}]});
      }
    })()`,h.context);
    const bytes=h.api.status().sourceEmissionSnapshotBytes;assert.ok(bytes>600000&&bytes<=1024*1024+9,bytes);
    h.setActive([]);await h.api.flush();assert.equal(h.api.status().sourceEmissionSnapshotBytes,9);
    h.root.Is.workers=[];await h.api.flush();assert.equal(h.api.status().sourceEmissionSnapshotBytes,0);assert.equal(e.worker.listeners.size,0);
  }finally{h.api.stop();assert.equal(h.api.status().sourceEmissionSnapshotBytes,0);}
  }
});
