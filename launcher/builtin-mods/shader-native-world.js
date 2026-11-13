// Extend only the two owned Lite renderer instances. Original mask/volume
// inputs stay unchanged; no GPU prototype, second device or render pass.
function installNativeWorld(root,payload){
 'use strict';
 root.__BVFX_ATTACH_NATIVE_WORLD__=function(native,settings,environment,sky){
  if(typeof sky?.groundState!=='function')throw Error('Native world needs the shared atmosphere cache');
  const device=native.gpuDevice,undo=[],descriptors=new WeakMap(),groupDescriptors=new WeakMap(),extendedLayouts=new WeakMap(),extendedGroups=new WeakMap(),inputs=new WeakSet();
  let disposed=false,uploads=0,frame=0,metadataUploads=0,metadataKey=null,ground=sky.groundState();const fogRestores=[];
  const bytes=new ArrayBuffer(payload.uniformBytes),values=new Float32Array(bytes),previous=new Uint32Array(payload.uniformBytes/4).fill(0xffffffff),words=new Uint32Array(bytes);
  const buffer=device.createBuffer({label:'Bloxdy world parameters',size:payload.uniformBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  let metadataBuffer,sampler;
  try{metadataBuffer=device.createBuffer({label:'Bloxdy surface metadata',size:65536*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
   sampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
  }catch(error){buffer.destroy();metadataBuffer?.destroy();throw error;}
  const metadata=new Float32Array(65536*4);
  const liquid=native.__BVFX_NATIVE_LIQUID_RESOURCES__?.();
  const liquidEntries=liquid?[{binding:15,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform',minBindingSize:liquid.uniformBytes}},{binding:19,visibility:GPUShaderStage.VERTEX,buffer:{type:'read-only-storage',minBindingSize:40}}]:[];
  const liquidResources=liquid?[{binding:15,resource:{buffer:liquid.uniform}},{binding:19,resource:{buffer:liquid.neutral}}]:[];
  const wrap=(owner,key,make)=>{const descriptor=Object.getOwnPropertyDescriptor(owner,key),old=owner[key];if(typeof old!=='function')throw Error('Native world contract changed: '+key);const next=make(old);owner[key]=next;undo.push(()=>{if(owner[key]===next){if(descriptor)Object.defineProperty(owner,key,descriptor);else delete owner[key];}});};
  function isInputs(layout){return /^(?:terrain-)?shader-pack-inputs(?:-|$)/.test(descriptors.get(layout)?.label||'');}
  function layout(base){let extended=extendedLayouts.get(base);if(!extended){const d=descriptors.get(base);if(!d||!isInputs(base))throw Error('Unobserved native input layout');
    if(d.entries.some(e=>e.binding>=11))throw Error('Native input bindings changed');
    const desc={label:'Bloxdy world inputs',entries:[...d.entries,{binding:11,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform',minBindingSize:payload.uniformBytes}},{binding:12,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage',minBindingSize:65536*16}},
     {binding:13,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:14,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},...liquidEntries]};extended=device.createBindGroupLayout(desc);descriptors.set(extended,desc);extendedLayouts.set(base,extended);}return extended;}
  function group(base){let entry=extendedGroups.get(base);if(!entry||entry.view!==ground.view){const d=groupDescriptors.get(base);if(!d)throw Error('Unobserved native input group');
    const desc={label:'Bloxdy world inputs',layout:layout(d.layout),entries:[...d.entries,{binding:11,resource:{buffer}},{binding:12,resource:{buffer:metadataBuffer}},{binding:13,resource:ground.view},{binding:14,resource:sampler},...liquidResources]};
    entry={view:ground.view,group:device.createBindGroup(desc)};groupDescriptors.set(entry.group,desc);extendedGroups.set(base,entry);}return entry.group;}
  function extendGroup(base,extra){const d=groupDescriptors.get(base),l=d&&descriptors.get(d.layout);if(!d||!l)throw Error('Cannot extend unobserved native inputs');
   if(extra.entries.some(e=>l.entries.some(before=>before.binding===e.binding)))throw Error('Native extension binding collision');
   const desc={label:'Bloxdy composed native inputs',entries:[...l.entries,...extra.entries]},layout=device.createBindGroupLayout(desc);descriptors.set(layout,desc);
   const bind={label:desc.label,layout,entries:[...d.entries,...extra.resources]},group=device.createBindGroup(bind);groupDescriptors.set(group,bind);return {layout,group};
  }
  function replaceBinding(base,binding,resource){const d=groupDescriptors.get(base);if(!d||!d.entries.some(e=>e.binding===binding))throw Error('Native binding replacement unavailable');
   const desc={...d,entries:d.entries.map(e=>e.binding===binding?{...e,resource}:e)},result=device.createBindGroup(desc);groupDescriptors.set(result,desc);return result;
  }
  const methodCache=new Map();
  const proxy=new Proxy(device,{get(target,key){
   if(methodCache.has(key))return methodCache.get(key);
   let value=Reflect.get(target,key,target);
   if(key==='createBindGroupLayout')value=d=>{const result=target.createBindGroupLayout(d);descriptors.set(result,d);return result;};
   else if(key==='createBindGroup')value=d=>{const result=target.createBindGroup(d);groupDescriptors.set(result,d);return result;};
   else if(key==='createPipelineLayout')value=d=>{const base=d.bindGroupLayouts[3];return target.createPipelineLayout(base&&isInputs(base)?{...d,bindGroupLayouts:d.bindGroupLayouts.map((x,i)=>i===3?layout(x):x)}:d);};
   else if(typeof value==='function')value=value.bind(target);else return value;
   methodCache.set(key,value);return value;
  }});
  function discover(){for(const input of [native.terrain.shaderPackInputs,native.meshes.packInputs])if(input&&!inputs.has(input)){
   if(input.device!==proxy)throw Error('Native world inputs were created before attachment');inputs.add(input);
  }}
  function write(name,value){const index=payload.fields.indexOf(name);if(index<0)throw Error('Unknown world parameter '+name);if(value.length>4)throw Error('Invalid world parameter '+name);
   for(let i=0;i<4;i++){const v=Math.fround(value[i]??0);if(!Number.isFinite(v))throw Error('Non-finite world parameter '+name);values[index*4+i]=v;}}
  function invalidateBundles(){const b=native.meshes.thinBundle;if(b?.main)b.main.stale=true;if(b?.gto)b.gto.stale=true;}
  function refreshGround(){const previousGround=ground;ground=sky.groundState();
   if(previousGround.view!==ground.view){for(const p of native.meshes.programs.values())if(p.bvfxWorld)p.packGroup=p.refreshPackGroup();invalidateBundles();}
  }
  function receiver(mesh){const kind=environment?.entityKind?.(mesh);return kind==='player'?1:kind==='mob'?2:0;}
  function fog(view){const next=payload.fog?.(view,settings,environment?.atmosphere?.palette?.());if(!next)return;
   for(const [key,value]of Object.entries(next)){const descriptor=Object.getOwnPropertyDescriptor(view,key);fogRestores.push(()=>{if(descriptor)Object.defineProperty(view,key,descriptor);else delete view[key];});view[key]=value;}
  }
  function update(){
   const sample=environment?.worldFrame?.()||{};
   refreshGround();
   write('groundTint',[...(ground.tint||[1,1,1]),ground.active||0]);write('groundFrame',ground.frame||[0,0,1,0]);write('cloudSun',[...(ground.sun||[0,1,0]),ground.clouds?.[2]||0]);write('cloudOrigin',[...(ground.origin||[0,0,0]),ground.strength||0]);
   write('controls',[settings.enabled===false?0:1,settings.bloxdLighting===false?1:0,Number(settings.bloxdLightingDarkness)||0,Number(sample.oreStrength)||0]);
   write('held',sample.equipment?.held||[]);write('armour',sample.equipment?.armour||[]);write('lightPosition',sample.equipment?.position||[]);write('leafMotion',sample.surfaces?.motion||[]);
   write('entityRules',[settings.dynamicPlayersAffected===false?0:1,settings.dynamicMobsAffected===false?0:1,settings.enabled&&settings.atmosphereEnabled?1:0,0]);
   const key=[sample.ores?.revision??-1,sample.surfaces?.revision??-1].join(':');
   if(key!==metadataKey){metadata.fill(0);const leaves=sample.surfaces?.bytes,ores=sample.ores;
    if(leaves)for(let index=1;index<Math.min(65536,leaves.length/4);index++)metadata[index*4+3]=leaves[index*4]/255;
    if(ores)for(let i=0;i<ores.count;i++){const index=Math.round(ores.indices[i]);if(index<=0||index>=65536)continue;for(let c=0;c<3;c++){const v=ores.colours[i*3+c];metadata[index*4+c]=Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;}}
    device.queue.writeBuffer(metadataBuffer,0,metadata);metadataKey=key;metadataUploads++;
   }
   if(words.some((word,i)=>word!==previous[i])){device.queue.writeBuffer(buffer,0,bytes);previous.set(words);uploads++;}frame++;
  }
  try{
   const previousExtender=Object.getOwnPropertyDescriptor(native,'__BVFX_EXTEND_NATIVE_GROUP__');native.__BVFX_EXTEND_NATIVE_GROUP__=extendGroup;
   undo.push(()=>{if(native.__BVFX_EXTEND_NATIVE_GROUP__===extendGroup){if(previousExtender)Object.defineProperty(native,'__BVFX_EXTEND_NATIVE_GROUP__',previousExtender);else delete native.__BVFX_EXTEND_NATIVE_GROUP__;}});
   const previousReplacer=Object.getOwnPropertyDescriptor(native,'__BVFX_REPLACE_NATIVE_BINDING__');native.__BVFX_REPLACE_NATIVE_BINDING__=replaceBinding;
   undo.push(()=>{if(native.__BVFX_REPLACE_NATIVE_BINDING__===replaceBinding){if(previousReplacer)Object.defineProperty(native,'__BVFX_REPLACE_NATIVE_BINDING__',previousReplacer);else delete native.__BVFX_REPLACE_NATIVE_BINDING__;}});
   for(const owner of [native.terrain,native.meshes]){const before=owner.device;if(before!==device)throw Error('Native world device ownership changed');owner.device=proxy;undo.push(()=>{if(owner.device===proxy)owner.device=before;});}
   wrap(native.terrain,'shaderModule',old=>function(code,...rest){return old.call(this,payload.patch(code),...rest);});
   if(payload.fog)wrap(native.terrain,'prepare',old=>function(outer,view,...rest){fog(view);return old.call(this,outer,view,...rest);});
   wrap(native.terrain,'writeShaderPackInputs',old=>function(...args){const result=old.apply(this,args);discover();return result;});
   wrap(native.terrain,'bindShaderPackInputs',old=>function(pass,...args){
    // This method only forwards setBindGroup to the native input object.
    // Adapting that one sink also covers the very first lazy input creation.
    // bindGroupFor itself stays original for the native shadow-mask pass.
    const sink={setBindGroup(index,base,...rest){const bound=index===3?group(base):base;const result=pass.setBindGroup(index,bound,...rest);if(index===3)native.__BVFX_NATIVE_LIQUID_BIND__?.(pass,bound);return result;}};
    const result=old.call(this,sink,...args);discover();return result;
   });
   wrap(native.meshes,'createProgram',old=>function(key,code,kind,pack){
    const patched={...code,vertex:payload.patch(code.vertex),fragment:payload.patch(code.fragment)};
    if(patched.vertex===code.vertex&&patched.fragment===code.fragment){const p=old.call(this,key,code,kind,pack);if(code.fragment.includes('var<uniform> bvfxWorld: BvfxWorldParameters'))p.bvfxWorld=true;return p;}
    if(!pack?.group||!pack?.layout)throw Error('Native world model inputs missing');
    const p=old.call(this,key,patched,kind,{layout:layout(pack.layout),group:group(pack.group)});
    p.bvfxWorld=true;
    p.refreshPackGroup=()=>group(native.meshes.packInputs.bindGroupFor(null,true));return p;
   });
   wrap(native.meshes,'prepare',old=>function(...args){const result=old.apply(this,args);discover();update();return result;});
   // Sky resize happens inside prepare, before native retained bundles are
   // recorded. Refresh their ground view there, rather than one frame later.
   if(typeof native.meshes.pushEarthSky==='function')wrap(native.meshes,'pushEarthSky',old=>function(...args){const result=old.apply(this,args);refreshGround();return result;});
   if(environment?.entityKind){
    if(!(native.meshes.meshSlots?.data instanceof Float32Array)||typeof native.meshes.uploadMeshSlots!=='function'||typeof native.meshes.thinBundle?.place!=='function')throw Error('Native entity draw slots unavailable');
    wrap(native.meshes,'uploadMeshSlots',old=>function(...args){
     for(const name of ['skyDraws','opaqueDraws','transparentDraws','frontDraws'])for(const draw of this.lists[name]){
      const offset=draw.slotOffset;if(!Number.isSafeInteger(offset)||offset%256||offset/4+17>=this.meshSlots.data.length)throw Error('Native entity draw stride changed');
      this.meshSlots.data[offset/4+17]=receiver(draw.unit?.owner);
     }return old.apply(this,args);
    });
    wrap(native.meshes.thinBundle,'place',old=>function(record,draw,...args){const result=old.call(this,record,draw,...args),at=record.slot*64+17,kind=receiver(draw.unit?.owner);
     if(at>=this.slots.data.length)throw Error('Native retained entity slot changed');
     if(this.slots.data[at]!==kind){this.slots.data[at]=kind;this.slotsFrom=Math.min(this.slotsFrom,record.slot);this.slotsTo=Math.max(this.slotsTo,record.slot);}return result;
    });
   }
   wrap(native,'drawFrame',old=>function(...args){environment?.advanceFrame?.(args[1]);try{return old.apply(this,args);}finally{for(const restore of fogRestores.reverse())restore();fogRestores.length=0;}});update();
  }catch(error){for(const restore of undo.reverse())restore();buffer.destroy();metadataBuffer.destroy();throw error;}
  return {dispose(){if(disposed)return;disposed=true;for(const restore of undo.reverse())restore();buffer.destroy();metadataBuffer.destroy();},diagnostics:()=>({implementation:'native-world-parameters',frames:frame,uniformUploads:uploads,metadataUploads,extraRenderPasses:0,readbacks:0})};
 };
}
