// Original nine-tap bloom on the game's device. Redirect only the scene colour
// output; native depth, shadow masks, MSAA and transmission stay with Lite.
function installNativePost(root){
 'use strict';
 const shader=`struct Post {texel:vec2f,strength:f32,srgb:f32}
@group(0) @binding(0) var image:texture_2d<f32>;
@group(0) @binding(1) var linearSampler:sampler;
@group(0) @binding(2) var<uniform> post:Post;
struct Quad {@builtin(position) position:vec4f,@location(0) uv:vec2f}
@vertex fn vertex(@builtin(vertex_index) i:u32)->Quad{
 let p=vec2f(f32((i<<1u)&2u),f32(i&2u));return Quad(vec4f(p*vec2f(2,-2)+vec2f(-1,1),0,1),p);}
fn bright(uv:vec2f)->vec3f{let c=textureSampleLevel(image,linearSampler,uv,0).rgb;let l=max(max(c.r,c.g),c.b);return c*max(0.0,l-0.65)/max(l,0.001);}
fn srgbToLinear(c:vec3f)->vec3f{return select(pow((c+0.055)/1.055,vec3f(2.4)),c/12.92,c<=vec3f(0.04045));}
@fragment fn fragment(input:Quad)->@location(0) vec4f{
 let uv=input.uv;let d=post.texel*3.0;
 var bloom=bright(uv)*0.20;
 bloom+=(bright(uv+vec2f(d.x,0))+bright(uv-vec2f(d.x,0))+bright(uv+vec2f(0,d.y))+bright(uv-vec2f(0,d.y)))*0.12;
 bloom+=(bright(uv+d)+bright(uv-d)+bright(uv+vec2f(d.x,-d.y))+bright(uv+vec2f(-d.x,d.y)))*0.08;
 let base=textureSampleLevel(image,linearSampler,uv,0);
 let colour=clamp(base.rgb+bloom*post.strength*0.45,vec3f(0),vec3f(1));
 return vec4f(select(colour,srgbToLinear(colour),post.srgb>0.5),base.a);
}`;
 root.__BVFX_NATIVE_POST_SHADER__=shader;
 root.__BVFX_ATTACH_NATIVE_POST__=async function(native,settings){
  const task=native.sceneTask,device=native.gpuDevice,engine=native.engine;
  if(!task?._colorAttachment||typeof task._executeWithTransmission!=='function'||!engine)throw Error('Original native scene pass unavailable');
  const format=task._targetSignature?._colorFormat;
  if(!/^(?:rgba|bgra)8unorm(?:-srgb)?$/.test(format))throw Error('Unsupported native bloom colour format');
  const original=task._executeWithTransmission,descriptor=Object.getOwnPropertyDescriptor(task,'_executeWithTransmission');
  const originalDraw=native.drawFrame,drawDescriptor=Object.getOwnPropertyDescriptor(native,'drawFrame');
  let buffer=null,target=null,group=null,disposed=false,frames=0,allocations=0,retired=[],retirementCalls=0;
  const uniforms=new Float32Array(4),sampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
  function flushRetired(){if(!retired.length)return;const list=retired;retired=[];retirementCalls++;
   // Called after the native frame submitted its command encoder. This promise
   // is never awaited on the render thread and is needed only on resize/Off.
   device.queue.onSubmittedWorkDone().then(()=>{for(const t of list)t.destroy();},()=>{for(const t of list)t.destroy();});
  }
  function releaseTarget(){if(target){retired.push(target.texture);target=null;group=null;}}
  function dispose(){if(disposed)return;disposed=true;if(task._executeWithTransmission===execute){if(descriptor)Object.defineProperty(task,'_executeWithTransmission',descriptor);else delete task._executeWithTransmission;}
   if(native.drawFrame===drawFrame){if(drawDescriptor)Object.defineProperty(native,'drawFrame',drawDescriptor);else delete native.drawFrame;}releaseTarget();flushRetired();buffer?.destroy();}
  let pipeline;
  try{
   const module=device.createShaderModule({label:'Bloxdy native bloom',code:shader});
   pipeline=await device.createRenderPipelineAsync({label:'Bloxdy native bloom',layout:'auto',vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint:'fragment',targets:[{format}]},primitive:{topology:'triangle-list'}});
   buffer=device.createBuffer({label:'Bloxdy bloom parameters',size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  }catch(error){buffer?.destroy();throw error;}
  function ensureTarget(width,height){if(target?.width===width&&target?.height===height)return;
   releaseTarget();const baseFormat=format.replace('-srgb','');
   const texture=device.createTexture({label:'Bloxdy bloom scene colour',size:[width,height],format:baseFormat,viewFormats:format===baseFormat?[]:[format],usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
   try{target={texture,width,height,drawView:texture.createView({format}),sampleView:texture.createView({format:baseFormat})};group=device.createBindGroup({label:'Bloxdy native bloom',layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:target.sampleView},{binding:1,resource:sampler},{binding:2,resource:{buffer}}]});allocations++;}
   catch(error){texture.destroy();target=null;throw error;}
  }
  function execute(...args){
   if(disposed||!settings.enabled||!settings.bloomEnabled||!(settings.bloom>0)){releaseTarget();return original.apply(this,args);}
   const config=task._config,rt=config?.rst||config?.rt,attachment=task._colorAttachment,encoder=engine._currentEncoder;
   if(!rt||!encoder||!(rt._width>0&&rt._height>0))return original.apply(this,args);
   const destination=attachment.resolveTarget||attachment.view;if(!destination)return original.apply(this,args);
   ensureTarget(rt._width,rt._height);
   const view=attachment.view,resolve=attachment.resolveTarget;
   try{
    if(task._targetSignature._sampleCount>1)attachment.resolveTarget=target.drawView;else attachment.view=target.drawView;
    const calls=original.apply(this,args);
    uniforms.set([1/target.width,1/target.height,settings.bloom,format.endsWith('-srgb')?1:0]);device.queue.writeBuffer(buffer,0,uniforms);
    const pass=encoder.beginRenderPass({label:'Bloxdy native bloom',colorAttachments:[{view:destination,loadOp:'clear',storeOp:'store',clearValue:[0,0,0,0]}]});
    pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(3);pass.end();frames++;return calls+1;
   }finally{attachment.view=view;attachment.resolveTarget=resolve;}
  }
  function drawFrame(...args){try{return originalDraw.apply(this,args);}finally{flushRetired();}}
  task._executeWithTransmission=execute;native.drawFrame=drawFrame;
  return {dispose,diagnostics:()=>({implementation:'native-nine-tap-bloom',frames,allocations,retirementCalls,presentationScale:1,readbacks:0,extraPasses:settings.enabled&&settings.bloomEnabled&&settings.bloom>0?1:0})};
 };
}
