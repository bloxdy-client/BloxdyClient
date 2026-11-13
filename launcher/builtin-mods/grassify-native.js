// Native material programs and one retained contact buffer. The game's mesh
// renderer submits grass in its existing opaque pass and keeps depth ordering.
function installNativeGrass(root,payload){
 'use strict';
 root.__BVFX_ATTACH_NATIVE_GRASS__=function(native){
  const device=native.gpuDevice,materials=new Map(),programs=new Map(),composed=new WeakMap(),undo=[];
  let buffer=null,layout=null,group=null,disposed=false,sceneMirror=null,origin=[0,0,0],uploads=0,patched=0,activeBins=0;
  const bytes=new ArrayBuffer(payload.bytes),floats=new Float32Array(bytes),words=new Uint32Array(bytes),bins=words.subarray((48+32*16*3)/4);
  const finite=p=>p?.length===3&&Array.from(p).every(Number.isFinite);
  const wrap=(owner,key,fn)=>{const d=Object.getOwnPropertyDescriptor(owner,key),before=owner[key];if(typeof before!=='function')throw Error('Native grass contract changed: '+key);const next=fn(before);owner[key]=next;undo.push(()=>{if(owner[key]===next){if(d)Object.defineProperty(owner,key,d);else delete owner[key];}});};
  function allocate(){if(buffer)return;const owned=device.createBuffer({label:'Bloxdy grass wind and contacts',size:payload.bytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
   try{const nextLayout=device.createBindGroupLayout({label:'Bloxdy native grass',entries:[{binding:16,visibility:GPUShaderStage.VERTEX,buffer:{type:'uniform',minBindingSize:payload.bytes}}]});
    const nextGroup=device.createBindGroup({label:'Bloxdy native grass',layout:nextLayout,entries:[{binding:16,resource:{buffer:owned}}]});buffer=owned;layout=nextLayout;group=nextGroup;
   }catch(error){owned.destroy();throw error;}
  }
  function inputsFor(base){const original=base.refreshPackGroup?base.refreshPackGroup():base.packGroup;if(!original)return {layout,group};
   let result=composed.get(original);if(!result){if(typeof native.__BVFX_EXTEND_NATIVE_GROUP__!=='function')throw Error('Native grass cannot preserve existing shader inputs');
    result=native.__BVFX_EXTEND_NATIVE_GROUP__(original,{entries:[{binding:16,visibility:GPUShaderStage.VERTEX,buffer:{type:'uniform',minBindingSize:payload.bytes}}],resources:[{binding:16,resource:{buffer}}]});composed.set(original,result);
   }return result;
  }
  const factory=(material,tracker,onError)=>{
   if(disposed||!material?.model)return null;
   if(materials.size&&!materials.has(material.model))throw Error('Native grass material is ambiguous');
   allocate();materials.set(material.model,{tracker,onError});let released=false;
   return {register(){},frame:tracker.frame,dispose(){if(released)return;released=true;materials.delete(material.model);},
    stats:()=>({gpuWind:true,backend:'original-webgpu',shaderPatched:patched>0,contactBufferUploads:uploads,activeContactBins:activeBins})};
  };
  function upload(view){
   if(!materials.size||!finite(view?.eye)||!finite(origin))return;
   const state=materials.values().next().value,values=state.tracker.snapshot(),contacts=state.tracker.contacts();
   if(!Number.isFinite(values.phase))return;
   const tau=Math.PI*2,phase=x=>((x%tau)+tau)%tau;
   floats.set([phase(values.phase*1.8+origin[0]*.5+origin[2]*.4),phase(values.phase*.7+origin[0]*.13),phase(values.phase*1.3+origin[2]*.6),values.wind?1:0],0);
   const low=[Math.floor(view.eye[0]/4)*4-104,Math.floor(view.eye[2]/4)*4-104];floats.set([low[0],low[1],4,52],4);bins.fill(0);let count=0;
   for(const actor of contacts){
    if(!finite(actor.position)||!finite(actor.previous)||![actor.weight,actor.height,actor.directionX,actor.directionZ].every(Number.isFinite)||actor.weight<=.0001)continue;
    const p=actor.position.map((v,i)=>v-origin[i]),previous=actor.previous.map((v,i)=>v-origin[i]),radius=Math.max(.35,(actor.width||.7)*.5)+.4;
    if(!Number.isFinite(radius))continue;floats.set([p[0],p[1],p[2],radius],12+count*4);floats.set([previous[0],previous[1],previous[2],actor.height],12+32*4+count*4);floats.set([actor.weight,actor.directionX,actor.directionZ,0],12+64*4+count*4);
    const minX=Math.max(0,Math.floor((Math.min(p[0],previous[0])-radius-low[0])/4)),maxX=Math.min(51,Math.floor((Math.max(p[0],previous[0])+radius-low[0])/4));
    const minZ=Math.max(0,Math.floor((Math.min(p[2],previous[2])-radius-low[1])/4)),maxZ=Math.min(51,Math.floor((Math.max(p[2],previous[2])+radius-low[1])/4));
    for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)bins[z*52+x]|=1<<count;
    if(++count===32)break;
   }
   floats[8]=count;activeBins=0;for(const mask of bins)if(mask)activeBins++;
   device.queue.writeBuffer(buffer,0,bytes);uploads++;
  }
  try{
   if(typeof native.attach==='function')wrap(native,'attach',original=>function(outer,...args){sceneMirror=outer.Ln;return original.call(this,outer,...args);});
   wrap(native,'drawFrame',original=>function(outer,scene,...args){if(scene)sceneMirror=scene;origin=outer?.av?.Wt||[0,0,0];return original.call(this,outer,scene,...args);});
   wrap(native.meshes,'prepare',original=>function(scene,view,...rest){try{upload(view);}catch(error){for(const state of materials.values())state.onError(error);}return original.call(this,scene,view,...rest);});
   wrap(native.meshes,'programWithModel',original=>function(model,...args){
    const base=original.call(this,model,...args);if(!base||!materials.has(model))return base;
    let program=programs.get(base);if(program)return program;
    const source=base.program,attributes=[...source.attributes,{name:'grassRoot',type:'vec4f'},{name:'grassShape',type:'vec2f'}];
    const input=/struct VertexInputs\s*\{[^}]*\}/,anchor=/var worldPos:\s*vec4f\s*=\s*finalWorld\s*\*\s*vec4f\(positionUpdated,\s*1\.0\);/;
    if(!input.test(source.vertex)||!anchor.test(source.vertex))throw Error('Native grass vertex program changed');
    const vertex=source.vertex.replace(input,body=>body.slice(0,-1)+`@location(${attributes.length-2}) grassRoot:vec4f,\n@location(${attributes.length-1}) grassShape:vec2f,\n}`)
     .replace(anchor,match=>'positionUpdated=grass_bvfxGrassMove(positionUpdated,vec4f((finalWorld*vec4f(vertexInputs.grassRoot.xyz,1)).xyz,vertexInputs.grassRoot.w),vertexInputs.grassShape);\n'+match)+'\n'+payload.code;
    program=this.createProgram(base.key+'#bloxdy-native-grass',{...source,vertex,attributes},base.kind,inputsFor(base));program.refreshPackGroup=()=>inputsFor(base).group;
    programs.set(base,program);patched++;return program;
   });
  }catch(error){for(const restore of undo.reverse())restore();buffer?.destroy();throw error;}
  const previous=root.__BVFX_NATIVE_GRASS_FACTORY__;root.__BVFX_NATIVE_GRASS_FACTORY__=factory;
  const camera=scene=>(sceneMirror||native.Ln)===scene&&finite(native.meshes.view?.eye)?native.meshes.view.eye.map((v,i)=>v+origin[i]):null;
  const previousCamera=root.__BVFX_NATIVE_GRASS_CAMERA__;root.__BVFX_NATIVE_GRASS_CAMERA__=camera;
  return {dispose(){if(disposed)return;disposed=true;for(const restore of undo.reverse())restore();if(root.__BVFX_NATIVE_GRASS_FACTORY__===factory)root.__BVFX_NATIVE_GRASS_FACTORY__=previous;if(root.__BVFX_NATIVE_GRASS_CAMERA__===camera)root.__BVFX_NATIVE_GRASS_CAMERA__=previousCamera;materials.clear();buffer?.destroy();programs.clear();},
   diagnostics:()=>({gpuWind:true,contactBufferUploads:uploads,activeContactBins:activeBins,programs:programs.size})};
 };
}
