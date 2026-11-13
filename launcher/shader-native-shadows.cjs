'use strict';

// Our receiver code uses Bloxd's original GPU shadow resources. No caster
// baker, ray tracer, depth map renderer, downloaded pack or pack storage here.
function shadowOptions(value={}) {
  const number=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  return {
    enabled:value.enabled!==false,
    blocks:value.blockShadows!==false,
    entities:value.entityShadows!==false,
    strength:Math.max(0,Math.min(1,number(value.sunStrength,.75))),
    distance:Math.max(16,Math.min(320,number(value.shadowDistance,128)))
  };
}

function nativeShadowSource() {
  // Bloxd's compiler sees valid standalone functions. The renderer adapter
  // replaces these two bodies with reads from verified uniform padding.
  return `
fn bvfxShadowStrength() -> f32 { return 0.0; }
fn bvfxShadowDistance() -> f32 { return 16.0; }
fn bvfxNativeShadow(s: BloxdSurface, l: BloxdLightIn) -> BloxdLight {
    let strength = bvfxShadowStrength();
    let reach = bvfxShadowDistance();
    let distanceToEye = distance(l.position, bloxdEyePosition());
    if (strength <= 0.0 || distanceToEye >= reach) {
        return bloxdDefaultLight(s, l);
    }
    let direction = -bloxdShadowDirection();
    let facing = smoothstep(0.0, 0.5, dot(l.normal, direction)) * smoothstep(0.0, 0.1, direction.y);
    if (facing <= 0.0001) { return bloxdDefaultLight(s, l); }
    // The API includes face/horizon lighting. Preserve native face shading
    // and apply only the cast occlusion to the sky-light channel.
    let visibility = clamp(bloxdShadow() / facing, 0.0, 1.0);
    let fade = 1.0 - smoothstep(max(0.0, reach - min(16.0, reach * 0.1)), reach, distanceToEye);
    var shaded = l;
    shaded.skyLight *= mix(1.0, visibility, strength * fade);
    return bloxdDefaultLight(s, shaded);
}
fn bloxdTerrainLight(s: BloxdSurface, l: BloxdLightIn) -> BloxdLight { return bvfxNativeShadow(s,l); }
fn bloxdLiquidLight(s: BloxdSurface, l: BloxdLightIn) -> BloxdLight { return bvfxNativeShadow(s,l); }
fn bloxdModelLight(s: BloxdSurface, l: BloxdLightIn) -> BloxdLight { return bvfxNativeShadow(s,l); }
`;
}

function patchShadowParameters(source) {
  if(typeof source!=='string'||!source.includes('fn pack_bvfxShadowStrength'))return source;
  if(source.includes('bvfxStrength: f32'))return source;
  // Current native input layout: seconds@0, lit@4, padding@8/12,
  // renderOffset@16, sun@32, eye@48, shadowDirection@64; total 80 bytes.
  // Two scalar fields consume only existing padding, preserving every
  // original offset, binding, buffer size and native write operation.
  const layout=/struct\s+BloxdPackInputs\s*\{\s*seconds:\s*f32,\s*lit:\s*u32,\s*renderOffset:\s*vec3i,\s*sunDirection:\s*vec3f,\s*eyePosition:\s*vec3f,\s*shadowDirection:\s*vec3f,?\s*\}/;
  const strength=/fn\s+pack_bvfxShadowStrength\s*\(\s*\)\s*->\s*f32\s*\{\s*return\s+0(?:\.0)?;\s*\}/;
  const distance=/fn\s+pack_bvfxShadowDistance\s*\(\s*\)\s*->\s*f32\s*\{\s*return\s+16(?:\.0)?;\s*\}/;
  if(!layout.test(source)||!strength.test(source)||!distance.test(source))throw Error('Native shadow parameter contract changed');
  return source.replace(layout,body=>body.replace(/lit:\s*u32,/, '$&\n    bvfxStrength: f32,\n    bvfxDistance: f32,'))
    .replace(strength,'fn pack_bvfxShadowStrength() -> f32 { return bloxdPackInputs.bvfxStrength; }')
    .replace(distance,'fn pack_bvfxShadowDistance() -> f32 { return bloxdPackInputs.bvfxDistance; }');
}

function attachNativeShadowControls(native,readOptions,patchSource) {
  if(!native?.gpuDevice||!native.sunShadow||!native.terrain||!native.meshes)throw Error('Original Bloxd shadow renderer unavailable');
  const device=native.gpuDevice,shadow=native.sunShadow,undo=[],inputs=new Set(),wrappedInputs=new WeakSet();
  const originalEntries=shadow.entries;
  if(typeof originalEntries!=='function'||typeof shadow.prepare!=='function'||typeof shadow.traceEntities!=='function'
      ||typeof shadow.start!=='function'||typeof shadow.computeVolume!=='function'||typeof native.drawFrame!=='function'
      ||typeof native.terrain.shaderModule!=='function'||typeof native.terrain.writeShaderPackInputs!=='function'
      ||typeof native.terrain.bindShaderPackInputs!=='function'||typeof native.meshes.prepare!=='function'
      ||typeof native.meshes.createProgram!=='function')throw Error('Native shadow renderer contract changed');
  let neutral=null,previous=null,disposed=false,frames=0,parameterWrites=0;
  const options=()=>readOptions();
  const active=o=>o.enabled&&(o.blocks||o.entities)&&o.strength>0;
  function wrap(owner,key,transform){const descriptor=Object.getOwnPropertyDescriptor(owner,key),original=owner[key];if(typeof original!=='function')throw Error('Missing native method '+key);const replacement=transform(original);owner[key]=replacement;undo.push(()=>{if(owner[key]===replacement){if(descriptor)Object.defineProperty(owner,key,descriptor);else delete owner[key];}});}
  function neutralResources(){
    if(neutral)return neutral;
    // Keep all bin-header reads in bounds. Only the empty frame is needed;
    // zero bin counts prevent any access to entity geometry grids.
    const size=shadow.entities?.frameBuffer?.size;
    if(!Number.isSafeInteger(size)||size<65540)throw Error('Native entity frame contract changed');
    const buffer=device.createBuffer({label:'Bloxdy disabled entity shadows',size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
    let texture;
    try{texture=device.createTexture({label:'Bloxdy unoccluded light',size:[1,1,1],dimension:'3d',format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
      device.queue.writeTexture({texture},new Uint8Array([255,255,255,255]),{},[1,1,1]);
      neutral={buffer,texture,view:texture.createView({dimension:'3d'})};return neutral;
    }catch(error){buffer.destroy();texture?.destroy();throw error;}
  }
  function stamp(input){
    if(!input||input.data?.byteLength!==80||!input.buffer||typeof input.write!=='function'||!(input.groups instanceof Map))throw Error('Native shadow uniform layout changed');
    inputs.add(input);const o=options(),view=new DataView(input.data),strength=active(o)?o.strength:0;
    const changed=view.getFloat32(8,true)!==Math.fround(strength)||view.getFloat32(12,true)!==Math.fround(o.distance);
    if(changed){view.setFloat32(8,strength,true);view.setFloat32(12,o.distance,true);}
    if(!wrappedInputs.has(input)){
      wrappedInputs.add(input);
      wrap(input,'write',original=>function(...args){stamp(this);return original.apply(this,args);});
      // Discovery follows the first native upload. Later writes carry both
      // values in the native 80-byte upload, without an additional GPU call.
      if(changed){device.queue.writeBuffer(input.buffer,8,input.data,8,8);parameterWrites++;}
    }
  }
  function discover(){for(const input of [native.terrain.shaderPackInputs,native.meshes.packInputs])if(input)stamp(input);}
  function invalidateGroups(){
    for(const input of inputs)input.groups.clear();
    // Terrain asks for its bind group at every draw. Models retain the group
    // in their original program record, so refresh these references too.
    const input=native.meshes.packInputs;
    if(input)for(const program of native.meshes.programs?.values()||[])if(program.packGroup)program.packGroup=program.refreshPackGroup?program.refreshPackGroup():input.bindGroupFor(null,true);
    // Retained GPU render bundles contain their original setBindGroup calls.
    // A new program reference alone cannot replace those recorded bindings.
    const bundles=native.meshes.thinBundle;if(bundles?.main)bundles.main.stale=true;if(bundles?.gto)bundles.gto.stale=true;
  }
  try {
  wrap(shadow,'entries',()=>function(){const list=originalEntries.call(this),o=options();if(o.blocks&&o.entities&&o.enabled)return list;const empty=neutralResources();
    return list.map(entry=>{const buffer=entry.resource?.buffer;
      if(!o.blocks||!o.enabled){if(entry.resource===this.volumeView)return {...entry,resource:empty.view};}
      if(!o.entities||!o.enabled){if(buffer===this.entities?.frameBuffer)return {...entry,resource:{buffer:empty.buffer}};}
      return entry;
    });
  });
  wrap(shadow,'start',original=>function(...args){const window=original.apply(this,args);if(!window.__bvfxShadowWindow){
    Object.defineProperty(window,'__bvfxShadowWindow',{value:true,configurable:true});let skipped=false;
    wrap(window,'update',update=>function(eye,...rest){if(!options().blocks){
      if(!skipped){
        if(!(this.records instanceof Int32Array)||typeof this.writeVoxels!=='function'||typeof this.writeWindowTop!=='function')throw Error('Native block window contract changed');
        this.eyeChunk??=eye.map(v=>Math.floor(v/32));this.records.fill(0);this.writeVoxels(0,this.records);this.windowTopStale=true;this.writeWindowTop();
      }
      this.eyeChunk??=eye.map(v=>Math.floor(v/32));skipped=true;return;
    }
      if(skipped){this.eyeChunk=null;this.slotVersion.fill(-1);for(let i=0;i<this.slotChunk.length;i++)if(this.slotChunk[i])this.enqueue(i);shadow.volumeHolds=null;skipped=false;}return update.call(this,eye,...rest);
    });undo.push(()=>delete window.__bvfxShadowWindow);
  }return window;});
  wrap(shadow,'computeVolume',original=>function(...args){if(options().blocks)return original.apply(this,args);});
  wrap(shadow,'traceEntities',original=>function(...args){if(options().entities)return original.apply(this,args);});
  wrap(native.terrain,'shaderModule',original=>function(code,...args){return original.call(this,patchSource(code),...args);});
  wrap(native.meshes,'createProgram',original=>function(key,code,...args){return original.call(this,key,{...code,vertex:patchSource(code.vertex),fragment:patchSource(code.fragment)},...args);});
  for(const [owner,name]of [[native.terrain,'writeShaderPackInputs'],[native.terrain,'bindShaderPackInputs'],[native.meshes,'prepare']]){
    wrap(owner,name,original=>function(...args){const result=original.apply(this,args);discover();return result;});
  }
  wrap(native,'drawFrame',original=>function(outer,...args){
    const provider=outer?.av&&Object.values(Object.getOwnPropertyDescriptors(outer.av)).map(x=>x.value).find(x=>typeof x?.sunShadowReach==='function'&&x.options?.variants);
    if(provider&&!provider.__bvfxShadowReach){Object.defineProperty(provider,'__bvfxShadowReach',{value:true,configurable:true});wrap(provider,'sunShadowReach',reach=>function(){return active(options())?reach.call(this):{sunShadow:false,airShadow:false};});
      if(typeof provider.Ino==='function')wrap(provider,'Ino',original=>function(){const direction=options().direction;return direction?.length===3&&Array.from(direction).every(Number.isFinite)?direction:original.call(this);});
      undo.push(()=>delete provider.__bvfxShadowReach);}
    const o=options(),key=[o.enabled,o.blocks,o.entities].join(':');
    if(previous!==key){discover();invalidateGroups();previous=key;}
    const result=original.call(this,outer,...args);discover();frames++;return result;
  });
  } catch(error) {for(const restore of undo.reverse())restore();neutral?.buffer.destroy();neutral?.texture.destroy();throw error;}
  return {dispose(lost=false){if(disposed)return;disposed=true;for(const restore of undo.reverse())restore();if(!lost)invalidateGroups();neutral?.buffer.destroy();neutral?.texture.destroy();inputs.clear();},
    diagnostics(){return {implementation:'bloxd-original-webgpu',frames,parameterWrites,extraRenderPasses:0,ownCasterBaker:false,ownShadowMaps:false};}};
}

module.exports={shadowOptions,nativeShadowSource,patchShadowParameters,attachNativeShadowControls};
