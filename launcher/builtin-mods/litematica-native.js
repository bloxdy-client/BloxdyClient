// An owned graphics interface for the existing schematic renderer. It never
// replaces WebGL globals or game GPU methods. CPU geometry/check budgets stay
// in renderer.js; cached vertices draw in Lite's existing transparent pass.
function installNativeLitematica(root,payload){
 'use strict';
 root.__BLM_ATTACH_NATIVE_GPU__=async function(native){
  const device=native.gpuDevice,task=native.sceneTask,signature=task?._targetSignature;
  if(!signature?._depthStencilFormat||!Array.isArray(native.Ln?._renderables)||typeof task.record!=='function')throw Error('Native schematic world pass unavailable');
  const undo=[],buffers=new Set(),textures=new Set(),pages=[],records=[],pool=[],pipelines=new Map(),retired=[];
  const fields=new Map(payload.fields.map(f=>[f.name,f])),current=new ArrayBuffer(payload.uniformBytes),currentBytes=new Uint8Array(current),view=new DataView(current);
  const align=device.limits?.minUniformBufferOffsetAlignment||256,stride=Math.ceil(payload.uniformBytes/align)*align,pageDraws=256;
  let disposed=false,scene=null,frameView=null,origin=[0,0,0],count=0,frame=0,uploads=0,draws=0,pagesCreated=0,boundBuffer=null,boundVao=null,boundTexture=null,currentProgram=null;
  let front='CW',viewport=[0,0,1,1],uniformValues=new Map();const enabled=new Set(),states=new WeakMap(),constants=new Map();let constant=4096;
  const enumValue=name=>{if(!constants.has(name))constants.set(name,constant++);return constants.get(name);};
  const gpuLayout=device.createBindGroupLayout({label:'Bloxdy schematic inputs',entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform',hasDynamicOffset:true,minBindingSize:payload.uniformBytes}},
   {binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}}]});
  const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[gpuLayout]}),sampler=device.createSampler({minFilter:'nearest',magFilter:'nearest',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
  const vertex=device.createShaderModule({label:'Bloxdy schematic vertex',code:payload.codes.vertex}),fragment=device.createShaderModule({label:'Bloxdy schematic fragment',code:payload.codes.fragment});
  const layout=[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x2'},{shaderLocation:2,offset:20,format:'float32x3'},{shaderLocation:3,offset:32,format:'float32'},{shaderLocation:4,offset:36,format:'float32x3'}]}];
  await Promise.all(['CW','CCW'].flatMap(winding=>[false,true].map(async cull=>{
   const p=await device.createRenderPipelineAsync({label:'Bloxdy schematic '+winding+':'+cull,layout:pipelineLayout,
    vertex:{module:vertex,entryPoint:'main',buffers:layout},fragment:{module:fragment,entryPoint:'main',targets:[{format:signature._colorFormat,blend:{color:{operation:'add',srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha'},alpha:{operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]},
    depthStencil:{format:signature._depthStencilFormat,depthWriteEnabled:false,depthCompare:signature._depthCompare||'greater-equal'},multisample:{count:signature._sampleCount},
    // WebGPU's framebuffer-area convention accounts for its downward Y axis
    // (w3.org/TR/webgpu/#polygon-rasterization); keep the original winding.
    primitive:{topology:'triangle-list',frontFace:winding==='CW'?'cw':'ccw',cullMode:cull?'back':'none'}});pipelines.set(winding+':'+cull,p);
  })));
  function retire(resource,set){if(!resource)return;set?.delete(resource);retired.push(resource);}
  function flush(){if(!retired.length)return;const list=retired.splice(0);device.queue.onSubmittedWorkDone().then(()=>list.forEach(x=>x.destroy()),()=>list.forEach(x=>x.destroy()));}
  function page(index){let p=pages[index];if(!p){const gpu=device.createBuffer({label:'Bloxdy schematic draw parameters',size:stride*pageDraws,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});buffers.add(gpu);p=pages[index]={gpu,cpu:new Uint8Array(stride*pageDraws),groups:new WeakMap(),used:frame};pagesCreated++;}p.used=frame;return p;}
  function write(name,value){const f=fields.get(name);if(!f)return;const list=typeof value==='number'?[value]:value;
   if(!list||list.length*4>f.size||!Array.from(list).every(v=>Number.isFinite(v)&&Number.isFinite(Math.fround(v))))throw Error('Invalid schematic shader parameter '+name);
   for(let i=0;i<list.length;i++)view.setFloat32(f.offset+i*4,list[i],true);uniformValues.set(name,typeof value==='number'?value:Array.from(value));}
  function texImage(...args){const record=boundTexture;if(!record)throw Error('No schematic texture selected');let width,height,source,raw;
   if(args.length===9){[, , ,width,height, , , ,raw]=args;}else{source=args[5];width=source.naturalWidth||source.width;height=source.naturalHeight||source.height;}
   if(!(Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0))throw Error('Invalid schematic image dimensions');
   const gpu=device.createTexture({label:'Bloxdy schematic texture',size:[width,height],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});textures.add(gpu);
   try{if(source)device.queue.copyExternalImageToTexture({source,flipY:false},{texture:gpu,premultipliedAlpha:false},[width,height]);else device.queue.writeTexture({texture:gpu},raw,{bytesPerRow:width*4},[width,height]);
    retire(record.gpu,textures);record.gpu=gpu;record.view=gpu.createView();record.version=(record.version||0)+1;
   }catch(error){retire(gpu,textures);throw error;}
  }
  const api={__native:true,canvas:null,isContextLost:()=>disposed,
   createShader:type=>({type}),shaderSource(shader,source){shader.source=source;shader.ok=source===(shader.type===api.VERTEX_SHADER?payload.original.vertex:shader.type===api.FRAGMENT_SHADER?payload.original.fragment:null);},compileShader(){},getShaderParameter:s=>s.ok,getShaderInfoLog:()=> 'Schematic shader version does not match the compiled native shader',deleteShader(){},
   createProgram:()=>({shaders:[]}),attachShader:(p,s)=>p.shaders.push(s),linkProgram:p=>{p.ok=p.shaders.length===2&&p.shaders.every(s=>s.ok);},getProgramParameter:p=>p.ok,getProgramInfoLog:()=> 'Native schematic shaders unavailable',deleteProgram(){},useProgram:p=>{currentProgram=p;},
   getUniformLocation:(_p,name)=>name,getAttribLocation:(_p,name)=>({position:0,uv:1,other:2,side:3,blockMin:4})[name]??-1,
   uniform1f:write,uniform1i:write,uniform2f:(name,...v)=>write(name,v),uniform3fv:write,uniform4fv:write,uniformMatrix4fv:(name,_transpose,v)=>write(name,v),getUniform:(_p,name)=>uniformValues.get(name),
   createVertexArray:()=>({}),bindVertexArray:v=>{boundVao=v;},deleteVertexArray(){},enableVertexAttribArray(){},vertexAttribPointer(){if(boundVao)boundVao.buffer=boundBuffer;},
   createBuffer:()=>({}),bindBuffer(target,b){if(target===api.ARRAY_BUFFER)boundBuffer=b;},
   bufferData(_target,data){if(!boundBuffer)throw Error('No schematic vertex buffer selected');const size=typeof data==='number'?data:data.byteLength;
    if(!Number.isSafeInteger(size)||size<0||size%4)throw Error('Invalid schematic vertex size');const gpu=device.createBuffer({label:'Bloxdy schematic vertices',size:Math.max(4,size),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});buffers.add(gpu);retire(boundBuffer.gpu,buffers);boundBuffer.gpu=gpu;boundBuffer.size=size;
    if(typeof data!=='number')device.queue.writeBuffer(gpu,0,data.buffer,data.byteOffset,data.byteLength);},
   bufferSubData(_target,offset,data){if(!boundBuffer?.gpu||offset+data.byteLength>boundBuffer.size)throw Error('Schematic vertex upload exceeds its buffer');device.queue.writeBuffer(boundBuffer.gpu,offset,data.buffer,data.byteOffset,data.byteLength);},
   deleteBuffer(b){if(b){retire(b.gpu,buffers);b.gpu=null;}},createTexture:()=>({version:0}),bindTexture:(_target,t)=>{boundTexture=t;},texImage2D:texImage,texParameteri(){},deleteTexture(t){if(t){retire(t.gpu,textures);t.gpu=null;t.view=null;t.version++;}},
   activeTexture(){},bindSampler(){},pixelStorei(){},drawBuffers(){},blendEquationSeparate(){},blendFuncSeparate(){},depthMask(){},colorMask(){},cullFace(){},depthFunc(){},frontFace:v=>{front=v===api.CCW?'CCW':'CW';},enable:v=>enabled.add(v),disable:v=>enabled.delete(v),isEnabled:v=>enabled.has(v),getError:()=>0,
   getParameter(value){if(value===api.VIEWPORT)return Array.from(viewport);if(value===api.DEPTH_RANGE)return [0,1];if(value===api.DEPTH_FUNC)return api.GEQUAL;if(value===api.VERSION)return 'Bloxdy owned WebGPU schematic interface';if(value===api.DRAW_BUFFER0)return api.BACK;return null;},
   drawArrays(mode,start,length){if(mode!==api.TRIANGLES||start<0||length<0||!Number.isInteger(start)||!Number.isInteger(length))throw Error('Unsupported schematic draw');
    const b=boundVao?.buffer;if(!length)return;if(!b?.gpu||!boundTexture?.view||!currentProgram?.ok)throw Error('Schematic draw resources are not ready');
    if((start+length)*48>b.size)throw Error('Schematic draw exceeds its cached vertices');const p=page(Math.floor(count/pageDraws)),offset=(count%pageDraws)*stride;p.cpu.set(currentBytes,offset);
    const record=pool[count]||(pool[count]={});Object.assign(record,{buffer:b.gpu,texture:boundTexture,version:boundTexture.version,page:p,offset,start,length,pipeline:pipelines.get(front+':'+enabled.has(api.CULL_FACE))});records[count++]=record;},
   __save(){return {CURRENT_PROGRAM:currentProgram,VAO:boundVao,ARRAY_BUFFER:boundBuffer,TEXTURE:boundTexture,front,flags:new Set(enabled),enabled:{DEPTH_TEST:enabled.has(api.DEPTH_TEST)},VIEWPORT:Array.from(viewport),DEPTH_RANGE:[0,1],DEPTH_FUNC:api.GEQUAL,DRAW_FRAMEBUFFER_BINDING:task};},
   __restore(state){currentProgram=state.CURRENT_PROGRAM;boundVao=state.VAO;boundBuffer=state.ARRAY_BUFFER;boundTexture=state.TEXTURE;front=state.front;enabled.clear();for(const flag of state.flags)enabled.add(flag);}
  };
  for(const name of ['ARRAY_BUFFER','BACK','BLEND','BROWSER_DEFAULT_WEBGL','CCW','CLAMP_TO_EDGE','COLOR_ATTACHMENT0','COMPILE_STATUS','CULL_FACE','CW','DEPTH_TEST','DRAW_FRAMEBUFFER_BINDING','DRAW_BUFFER0','DEPTH_RANGE','DEPTH_FUNC','VERSION','FLOAT','FRAGMENT_SHADER','FUNC_ADD','GEQUAL','LEQUAL','LINK_STATUS','NEAREST','ONE','ONE_MINUS_SRC_ALPHA','PIXEL_UNPACK_BUFFER','POLYGON_OFFSET_FILL','RASTERIZER_DISCARD','RGBA','SAMPLE_ALPHA_TO_COVERAGE','SAMPLE_COVERAGE','SCISSOR_TEST','SRC_ALPHA','STATIC_DRAW','STENCIL_TEST','TEXTURE0','TEXTURE_2D','TEXTURE_MAG_FILTER','TEXTURE_MIN_FILTER','TEXTURE_WRAP_S','TEXTURE_WRAP_T','TRIANGLES','UNPACK_ALIGNMENT','UNPACK_COLORSPACE_CONVERSION_WEBGL','UNPACK_FLIP_Y_WEBGL','UNPACK_PREMULTIPLY_ALPHA_WEBGL','UNPACK_ROW_LENGTH','UNPACK_IMAGE_HEIGHT','UNPACK_SKIP_ROWS','UNPACK_SKIP_PIXELS','UNPACK_SKIP_IMAGES','UNSIGNED_BYTE','VERTEX_SHADER','VIEWPORT'])api[name]=enumValue(name);
  function observable(){const callbacks=new Set();return {add(fn){callbacks.add(fn);return fn;},remove:fn=>callbacks.delete(fn),emit(value){for(const fn of callbacks)fn(value);},get size(){return callbacks.size;}};}
  const before=observable(),after=observable(),beforeGroup=observable(),afterGroup=observable();
  function bindConnection(raw){let bound=states.get(raw);if(bound)return bound;
   const sceneProxy=new Proxy(raw.scene,{get(target,key){return ({onBeforeRenderObservable:before,onAfterRenderObservable:after,onBeforeRenderingGroupObservable:beforeGroup,onAfterRenderingGroupObservable:afterGroup})[key]??Reflect.get(target,key,target);}});
   bound=new Proxy(raw,{get(target,key){if(key==='scene')return sceneProxy;return Reflect.get(target,key,target);}});states.set(raw,bound);api.canvas=raw.canvas;return bound;
  }
  const handle={gpu:api,wrap:bindConnection,matrix:()=>(frameView||native.meshes.view)?.viewProjectionMatrix||null,
   camera:()=>(frameView||native.meshes.view)?.eye?.map((v,i)=>v+origin[i])||null,clip:()=>({half:true,reverse:true}),scene:()=>scene};
  const previous=root.__BLM_NATIVE_CONNECTION__,provider=value=>!disposed&&value===scene?handle:previous?.(value)||null;root.__BLM_NATIVE_CONNECTION__=provider;
  function wrap(owner,key,transform){const descriptor=Object.getOwnPropertyDescriptor(owner,key),old=owner[key];if(typeof old!=='function')throw Error('Native schematic lifecycle changed: '+key);const next=transform(old);owner[key]=next;undo.push(()=>{if(owner[key]===next){if(descriptor)Object.defineProperty(owner,key,descriptor);else delete owner[key];}});}
  function prepare(realScene,renderView){frame++;frameView=renderView;count=0;records.length=0;if(!beforeGroup.size){while(pages.length&&pages.at(-1).used<frame-120){const p=pages.pop();retire(p.gpu,buffers);}return;}
   viewport=[0,0,renderView.renderWidth,renderView.renderHeight];write('nativeSrgb',signature._colorFormat.endsWith('-srgb')?1:0);
   const info={renderingGroupId:0,camera:realScene.activeCamera};before.emit(realScene);beforeGroup.emit(info);afterGroup.emit(info);after.emit(realScene);
   for(let i=0;i<Math.ceil(count/pageDraws);i++){const p=pages[i],used=Math.min(pageDraws,count-i*pageDraws)*stride;device.queue.writeBuffer(p.gpu,0,p.cpu,0,used);uploads++;}
   // Release high-water pages after two seconds of disuse without reducing
   // visible geometry or the user's render distance.
   while(pages.length&&pages.at(-1).used<frame-120){const p=pages.pop();retire(p.gpu,buffers);}
  }
  const renderable={order:250,isTransparent:true,_worldCenter:[0,0,0],bind:(_engine,target)=>({renderable,pipeline:native.terrain.createBinding(renderable,target,false).pipeline,
   draw(pass){if(!count)return 0;let pipeline=null,buffer=null;try{for(let i=0;i<count;i++){const r=records[i];if(!r.texture.view||r.version!==r.texture.version)continue;
    if(pipeline!==r.pipeline){pipeline=r.pipeline;pass.setPipeline(pipeline);}if(buffer!==r.buffer){buffer=r.buffer;pass.setVertexBuffer(0,buffer);}
    let entry=r.page.groups.get(r.texture);if(!entry||entry.version!==r.version){entry={version:r.version,group:device.createBindGroup({label:'Bloxdy schematic draw',layout:gpuLayout,entries:[{binding:0,resource:{buffer:r.page.gpu,size:payload.uniformBytes}},{binding:1,resource:r.texture.view},{binding:2,resource:sampler}]})};r.page.groups.set(r.texture,entry);}
    pass.setBindGroup(0,entry.group,[r.offset]);pass.draw(r.length,1,r.start,0);draws++;
   }}finally{pass.setBindGroup(0,task._sceneBG);}return count;}})};
  try{
   if(typeof native.attach==='function')wrap(native,'attach',old=>function(outer,...rest){scene=outer.Ln;return old.call(this,outer,...rest);});
   wrap(native,'drawFrame',old=>function(outer,realScene,...rest){scene=realScene;origin=outer?.av?.Wt||[0,0,0];try{return old.call(this,outer,realScene,...rest);}finally{flush();}});
   wrap(native.meshes,'prepare',old=>function(realScene,renderView,...rest){prepare(realScene,renderView);return old.call(this,realScene,renderView,...rest);});
   native.Ln._renderables.push(renderable);if(task._config.autoMirror===false&&task._renderables!==native.Ln._renderables)task._renderables.push(renderable);task.record();
  }catch(error){for(const restore of undo.reverse())restore();for(const list of [native.Ln._renderables,task._renderables]){const index=list?.indexOf(renderable);if(index>=0)list.splice(index,1);}if(root.__BLM_NATIVE_CONNECTION__===provider)root.__BLM_NATIVE_CONNECTION__=previous;throw error;}
  return {dispose(){if(disposed)return;disposed=true;for(const restore of undo.reverse())restore();if(root.__BLM_NATIVE_CONNECTION__===provider)root.__BLM_NATIVE_CONNECTION__=previous;
    for(const list of [native.Ln._renderables,task._renderables]){const index=list?.indexOf(renderable);if(index>=0)list.splice(index,1);}for(const b of buffers)retired.push(b);for(const t of textures)retired.push(t);buffers.clear();textures.clear();records.length=pool.length=pages.length=0;flush();},
   diagnostics:()=>({implementation:'native-schematic-gpu',frames:frame,draws,uniformUploads:uploads,uniformPages:pages.length,pagesCreated,extraRenderPasses:0,readbacks:0}),handle};
 };
}
