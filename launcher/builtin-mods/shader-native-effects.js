// WebGPU implementation of our owned sky/cloud kernels. This creates no
// second device, canvas or renderer. The game retains frame submission.
function installNativeEffects(root,payload){
 'use strict';
 const fullscreen=`struct BvfxQuad{ @builtin(position) p:vec4f, @location(0) uv:vec2f }
 @vertex fn main(@builtin(vertex_index) i:u32)->BvfxQuad{
 let p=vec2f(f32((i<<1u)&2u),f32(i&2u));return BvfxQuad(vec4f(p*2.0-1.0,0,1),p);}`;
 const skyLibrary=payload.modules.sky.code.replace(/@fragment\s+fn sky_main\(@location\(0\) skyRay: vec3<f32>, @builtin\(position\) gl_FragCoord: vec4<f32>\)/,
  'fn sky_bvfxEvaluate(skyRay:vec3f,gl_FragCoord:vec4f)');
 if(skyLibrary===payload.modules.sky.code)throw Error('Native sky entry point changed');
 function createUniformData(){
  const data=new ArrayBuffer(payload.uniformBytes),view=new DataView(data),fields=new Map(payload.fields.map(f=>[f.name,f]));
  return {data,get(name){const f=fields.get(name);return f?Array.from({length:f.stride*f.count/4},(_,i)=>view.getFloat32(f.offset+i*4,true)):[];},set(name,value){const f=fields.get(name);if(!f)return;const list=typeof value==='number'?[value]:value;
   if(!list||list.length*4>f.stride*f.count)throw Error('Invalid native effect parameter '+name);
   for(let i=0;i<list.length;i++){if(!Number.isFinite(list[i]))throw Error('Non-finite native effect parameter '+name);view.setFloat32(f.offset+i*4,list[i],true);}
  }};
 }
 root.__BVFX_CREATE_NATIVE_EFFECTS__=async function(native,settings,atmosphere){
  if(!native?.gpuDevice||!native.meshes||!atmosphere?.cloudRenderer)throw Error('Native effects need the original renderer and atmosphere');
  const device=native.gpuDevice,undo=[],owned=new Set(),layouts=new Map(),pipelines=new Map(),buffers=new Map(),groups=new Map();
  let disposed=false,targets=null,current=null,worldOrigin=[0,0,0],frame=0,cloudUpdates=0,cloudReuses=0,skyUpdates=0,groundUpdates=0;
  function dispose(){if(disposed)return;disposed=true;for(const restore of undo.reverse())restore();for(const resource of owned)resource.destroy();owned.clear();groups.clear();}
  try {
  const values=createUniformData(),cloudRenderer=atmosphere.cloudRenderer;
  const own=x=>(owned.add(x),x);
  const wrap=(o,k,fn)=>{const d=Object.getOwnPropertyDescriptor(o,k),before=o[k];if(typeof before!=='function')throw Error('Native effects contract changed: '+k);const next=fn(before);o[k]=next;undo.push(()=>{if(o[k]===next){if(d)Object.defineProperty(o,k,d);else delete o[k];}});};
  const texture=(label,w,h=1,d=1)=>{const t=own(device.createTexture({label,size:[w,h,d],dimension:d>1?'3d':'2d',format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|(d>1?0:GPUTextureUsage.RENDER_ATTACHMENT)}));return {label,texture:t,view:t.createView({dimension:d>1?'3d':'2d'}),w,h};};
  const neutral=texture('Bloxdy neutral cache',1),volume=texture('Bloxdy cloud density',64,64,64),sampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
  const volumeSampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'repeat',addressModeV:'repeat',addressModeW:'repeat'});
  device.queue.writeTexture({texture:neutral.texture},new Uint8Array([0,0,0,255]),{},[1,1,1]);
  device.queue.writeTexture({texture:volume.texture},cloudRenderer.volumeBytes(),{bytesPerRow:256,rowsPerImage:64},[64,64,64]);
  const extraEntries=[{binding:11,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},
   {binding:12,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},
   {binding:18,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},
   ...payload.textures.map(t=>({binding:t.binding,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float',viewDimension:t.type==='sampler3D'?'3d':'2d'}}))];
  function layout(base=[]){const key=base.map(e=>e.binding).join(',');if(!layouts.has(key))layouts.set(key,device.createBindGroupLayout({label:'Bloxdy native effects '+key,entries:[...base,...extraEntries]}));return layouts.get(key);}
  const fxLayout=layout(),emptyLayout=device.createBindGroupLayout({entries:[]}),pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[emptyLayout,emptyLayout,emptyLayout,fxLayout]});
  const vertex=device.createShaderModule({label:'Bloxdy native effect quad',code:fullscreen});
  for(const name of ['sky','clouds','shafts','ground','atmosphere'])buffers.set(name,own(device.createBuffer({label:'Bloxdy '+name+' parameters',size:payload.uniformBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})));
  function resources(exclude=[]){const r=targets||{},choose=x=>x&&!exclude.includes(x)?x.view:neutral.view;
   return [{binding:12,resource:sampler},{binding:18,resource:volumeSampler},...payload.textures.map(t=>({binding:t.binding,resource:t.name==='uBvfxAtmoVolume'?volume.view:
    choose(({uBvfxAtmoCloudImage:r.filtered,uBvfxAtmoRayImage:r.rays,uBvfxAtmoSkyImage:r.sky,clouds:r.raw})[t.name])}))];}
  function group(name,exclude=[]){const key=name+':'+exclude.map(x=>x.label).join(':');let g=groups.get(key);if(!g){g=device.createBindGroup({label:'Bloxdy '+name,layout:fxLayout,entries:[{binding:11,resource:{buffer:buffers.get(name)}},...resources(exclude)]});groups.set(key,g);}return g;}
  function releaseTargets(){if(!targets)return;for(const key of ['raw','filtered','rays','ground','sky']){const t=targets[key]?.texture;if(t){t.destroy();owned.delete(t);}}targets=null;groups.clear();}
  function ensureTargets(w,h){if(targets?.w===w&&targets?.h===h)return;releaseTargets();targets={w,h,raw:texture('cloud',w,h),filtered:texture('filtered',w,h),rays:texture('rays',w,h),ground:texture('ground',512,512),sky:texture('sky',128,64),cloudKey:null,groundKey:null,skyKey:null};for(const p of native.meshes.programs?.values()||[])if(p.kind==='earthSky'&&p.refreshPackGroup)p.packGroup=p.refreshPackGroup();}
  function upload(name){device.queue.writeBuffer(buffers.get(name),0,values.data);}
  function draw(encoder,name,outputs){upload(name);const pass=encoder.beginRenderPass({label:'Bloxdy '+name,colorAttachments:outputs.map(t=>({view:t.view,loadOp:'clear',storeOp:'store',clearValue:[0,0,0,1]}))});pass.setPipeline(pipelines.get(name));pass.setBindGroup(3,group(name,outputs));pass.draw(3);pass.end();}
  const fake={canvas:{addEventListener(){}},ACTIVE_UNIFORMS:1,drawingBufferWidth:1,drawingBufferHeight:1,
   getUniformLocation:(_p,name)=>name,getProgramParameter:()=>6,getActiveUniform:(_p,i)=>({name:['luminance','turbidity','rayleigh','mieCoefficient','mieDirectionalG','up'][i]}),
   getUniform:(_p,name)=>fake.physical?.[name],uniform1f:(name,x)=>values.set(name,x),uniform2f:(name,...v)=>values.set(name,v),uniform3f:(name,...v)=>values.set(name,v),uniform4f:(name,...v)=>values.set(name,v),uniformMatrix4fv:(name,_t,v)=>values.set(name,v)};
  const locations=atmosphere.locations(fake,{});
  wrap(cloudRenderer,'setFrame',original=>function(value){current=value;return original.call(this,value);});
  function renderCaches(){
   const r=targets,c=current;
   if(!c?.matrix||!c.enabled){values.set('uBvfxAtmoCloudCacheReady',0);values.set('uBvfxAtmoNativeReady',0);return;}
   for(const [key,value]of Object.entries({camera:c.camera,sun:c.sun,cloudTint:c.cloudTint,skyTint:c.skyTint,fogTint:c.fogTint,lightTint:c.lightTint,sunScreen:c.sunScreen,rayMatrix:c.matrix,bufferSize:[r.w,r.h],sunRadius:c.sunRadius||[0,0],controls:c.controls}))values.set(key,value);
   values.set('uBvfxAtmoVolumeReady',1);values.set('uBvfxAtmoSourceSample',[.5/r.w,.5/r.h]);
   const encoder=device.createCommandEncoder({label:'Bloxdy retained sky effects'});let work=false;
   const skyKey=c.nativeParams?JSON.stringify([c.nativeParams,c.sun.reduce((v,n,i)=>v+n*c.nativeUp[i],0)]):null;
   if(skyKey&&skyKey!==r.skyKey){values.set('nativeParams',c.nativeParams.slice(0,4));values.set('nativeG',c.nativeParams[4]);values.set('nativeSunHeight',c.sun.reduce((v,n,i)=>v+n*c.nativeUp[i],0));draw(encoder,'atmosphere',[r.sky]);r.skyKey=skyKey;skyUpdates++;work=true;}
   values.set('uBvfxAtmoNativeReady',skyKey?1:0);
   if(c.clouds[0]>0){
    const t=(c.clouds[2]-c.camera[1])/Math.max(.025,c.sun[1]),ground=[Math.floor((c.camera[0]+c.sun[0]*t)/64)*64,Math.floor((c.camera[2]+c.sun[2]*t)/64)*64,2048];
    const groundKey=c.groundStrength>0&&c.sun[1]>.025?JSON.stringify([ground,c.sun,c.clouds,c.style,c.clouds[3]>0?Math.floor(c.time*10):0]):null;
    if(groundKey&&groundKey!==r.groundKey){values.set('groundFrame',ground);draw(encoder,'ground',[r.ground]);r.groundKey=groundKey;r.groundFrame=ground;groundUpdates++;work=true;}
    const key=JSON.stringify([r.w,r.h,c.matrix,c.camera,c.sun,c.cloudTint,c.skyTint,c.fogTint,c.lightTint,c.clouds,c.style,c.controls,c.sunScreen,c.sunRadius,c.clouds[3]>0?Math.floor(c.time*30):0]);
    if(key!==r.cloudKey){draw(encoder,'clouds',[r.raw]);draw(encoder,'shafts',[r.rays,r.filtered]);r.cloudKey=key;cloudUpdates++;work=true;}else cloudReuses++;
    values.set('uBvfxAtmoCloudCacheReady',1);
   }else values.set('uBvfxAtmoCloudCacheReady',0);
   if(work)device.queue.submit([encoder.finish()]);
  }
  wrap(native.meshes,'pushEarthSky',original=>function(physical){
   const view=this.view;if(view?.viewMatrix?.length!==16||view?.projectionMatrix?.length!==16||view?.eye?.length!==3||!Array.from(view.eye).every(Number.isFinite))return original.call(this,physical);
   const width=view.renderWidth,height=view.renderHeight;
   if(!(width>0&&height>0))return original.call(this,physical);
   const scale=Math.min(.5,960/width,540/height);ensureTargets(Math.max(1,Math.ceil(width*scale)),Math.max(1,Math.ceil(height*scale)));
   fake.drawingBufferWidth=width;fake.drawingBufferHeight=height;fake.physical=physical;
   // Lite's earthSky is separate from the Babylon SkyMaterial mirror. Apply
   // the same controls to our observed scattering inputs, without accumulating
   // multipliers or mutating the game's original sky object.
   if(settings.enabled&&settings.atmosphereEnabled){
    const haze=Math.max(0,Math.min(1,settings.skyHaze)),warmth=Math.max(0,Math.min(1,settings.sunWarmth));
    const moonlit=settings.skyStyle==='moonlit'||atmosphere.palette()?.space;
    fake.physical={...physical,luminance:moonlit?.10:Math.max(.02,Math.min(2,physical.luminance*(.25+1.5*settings.skyBrightness))),
     turbidity:1+14*haze+5*warmth,rayleigh:.5+2*(1-haze),mieCoefficient:.0007+.003*settings.sunGlow,mieDirectionalG:.70+.12*settings.sunGlow};
   }
   atmosphere.setViewProjection(view.viewMatrix,view.projectionMatrix);atmosphere.setWorldFrame(...worldOrigin,...view.eye.map((v,i)=>v+worldOrigin[i]));atmosphere.setFog(...view.fogColour||[0,0,0]);
   atmosphere.bind(fake,locations,fake);renderCaches();upload('sky');frame++;return original.call(this,physical);
  });
  // Custom/cubemap worlds do not have a native earthSky model. Submit our
  // selected sky through the same original sky draw, using an explicitly
  // owned material configuration, and keep the game's sky when effects are Off.
  const ownSky={position:[0,0,0],infiniteDistance:true,cameraOffset:[0,0,0],up:[0,1,0],tint:[1,1,1],luminance:1,turbidity:10,rayleigh:2,mieCoefficient:.005,mieDirectionalG:.8,
   useSunPosition:true,sunPosition:[0,1,0],fog:false,dithering:false};
  wrap(native.meshes,'prepare',original=>function(scene,view,physical,...rest){
   const active=settings.enabled&&settings.atmosphereEnabled;
   if(active&&!physical)ownSky.sunPosition=atmosphere.sunDirection()||[0,1,0];
   const result=original.call(this,scene,view,active&&!physical?ownSky:physical,...rest);
   if(active){const draws=this.lists.skyDraws;let count=0;for(const draw of draws){const name=draw.unit?.owner?.name||'';if(!/^(?:skybox|dayNightSun|dayNightMoon|dayNightStars)$/i.test(name))draws[count++]=draw;}draws.length=count;}
   return result;
  });
  wrap(native.meshes,'createProgram',original=>function(key,code,kind,pack){
   if(kind!=='earthSky')return original.call(this,key,code,kind,pack);
   const anchor='\treturn colour;';if(!code.fragment.includes(anchor))throw Error('Native sky colour contract changed');
   const fragment=code.fragment.replace(anchor,'\tif (sky_global.uBvfxAtmoActive > 0.5) { colour = sky_bvfxEvaluate(normalize(toSky),vec4f(input.position.x, frame.outputHeight-input.position.y,0,1)).sky_colour; }\n'+anchor)+'\n'+skyLibrary;
   const program=original.call(this,key,{...code,fragment},kind,{layout:fxLayout,group:group('sky')});
   program.refreshPackGroup=()=>group('sky');return program;
  });
  wrap(native,'drawFrame',original=>function(outer,...args){worldOrigin=outer?.av?.Wt||[0,0,0];return original.call(this,outer,...args);});
  try{
   await Promise.all(['clouds','shafts','ground','atmosphere'].map(async name=>{
    const module=device.createShaderModule({label:'Bloxdy '+name,code:payload.modules[name].code});
    const pipeline=await device.createRenderPipelineAsync({label:'Bloxdy '+name,layout:pipelineLayout,vertex:{module:vertex,entryPoint:'main'},fragment:{module,entryPoint:name+'_main',targets:Array.from({length:name==='shafts'?2:1},()=>({format:'rgba8unorm'}))},primitive:{topology:'triangle-list'}});
    if(!disposed)pipelines.set(name,pipeline);
   }));
  }catch(error){dispose();throw error;}
  return {dispose,groundState(){const enabled=settings.enabled!==false&&settings.atmosphereEnabled===true&&current?.enabled;
    return {view:targets?.ground?.view||neutral.view,active:enabled?1:0,tint:values.get('uBvfxAtmoGroundTint'),sun:values.get('uBvfxAtmoSunDir'),clouds:values.get('uBvfxAtmoClouds'),origin:worldOrigin,
     frame:[...(targets?.groundFrame||[0,0,1]),enabled&&targets?.groundKey&&current?.clouds[0]>0&&current?.sun[1]>.025?1:0],strength:enabled?values.get('uBvfxAtmoControls')[3]||0:0};
   },diagnostics:()=>({backend:'original-webgpu',frame,cloudUpdates,cloudReuses,skyUpdates,groundUpdates,presentationScale:1}),values,skyLibrary};
  }catch(error){dispose();throw error;}
 };
}
