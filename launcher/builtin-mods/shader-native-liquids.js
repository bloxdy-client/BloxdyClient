// One background geometry worker, bounded world reads and cached per-chunk
// metadata. The native renderer still owns all draw calls and GPU submission.
function installNativeLiquids(root,payload){
 'use strict';
 root.__BVFX_ATTACH_NATIVE_LIQUIDS__=function(native,settings,environment){
  const device=native.gpuDevice,terrain=native.terrain,undo=[],states=new Map(),pending=new Set(),completed=[],retired=[],passes=new WeakMap();
  const data=new ArrayBuffer(payload.kernel.uniformBytes),floats=new Float32Array(data),words=new Uint32Array(data),previous=new Uint32Array(words.length).fill(0xffffffff),fields=new Map(payload.kernel.fields.map(f=>[f.name,f]));
  let disposed=false,worker=null,workerUrl=null,busy=null,snapshotJob=null,serial=0,ticket=0,key=null,error='',prepared=0,stale=0,frame=0,uploads=0,committing=0,worldOrigin=[0,0,0];
  const uniform=device.createBuffer({label:'Bloxdy liquid parameters',size:data.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let neutral;
  try{neutral=device.createBuffer({label:'Bloxdy neutral liquid metadata',size:40,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});}catch(e){uniform.destroy();throw e;}
  const wrap=(owner,name,make)=>{const d=Object.getOwnPropertyDescriptor(owner,name),old=owner[name];if(typeof old!=='function')throw Error('Native liquid contract changed: '+name);const next=make(old);owner[name]=next;undo.push(()=>{if(owner[name]===next){if(d)Object.defineProperty(owner,name,d);else delete owner[name];}});};
  function ownProperty(name,value){const old=Object.getOwnPropertyDescriptor(native,name);native[name]=value;undo.push(()=>{if(native[name]===value){if(old)Object.defineProperty(native,name,old);else delete native[name];}});}
  function report(e){error=e?.message||String(e);environment.reportNativeError?.('Native liquids: '+error);}
  function retire(buffer){if(buffer)retired.push(buffer);}
  function flushRetired(){if(!retired.length)return;const list=retired.splice(0);device.queue.onSubmittedWorkDone().then(()=>list.forEach(b=>b.destroy()),()=>list.forEach(b=>b.destroy()));}
  function write(name,value){const f=fields.get(name);if(!f)return;const list=typeof value==='number'?[value]:value;if(!list||list.length>f.stride*f.count/4)throw Error('Invalid liquid uniform '+name);
   for(let i=0;i<list.length;i++){const v=Math.fround(list[i]);if(!Number.isFinite(v))throw Error('Non-finite liquid uniform '+name);floats[f.offset/4+i]=v;}
  }
  function parameters(){const values=environment.liquidFrame();for(const [name,value]of Object.entries(values))write(name,value);
   if(words.some((v,i)=>v!==previous[i])){device.queue.writeBuffer(uniform,0,data);previous.set(words);uploads++;}
  }
  function options(){return {waterWave:settings.enabled&&settings.waterEnabled&&settings.waterStyle==='wavey',lavaWave:settings.enabled&&settings.lavaEnabled&&settings.lavaStyle==='wavey',
   underwater:settings.enabled&&(settings.waterEnabled&&settings.underwaterLight>0||settings.lavaEnabled&&settings.lavaUnderwaterLight>0),spacing:root.__BLOXD_MOD_HOST__?.profile?.performance==='quality'&&(settings.lavaPhysics||settings.waterPhysics)?.25:.5};}
  function wanted(){return settings.enabled&&(settings.waterEnabled||settings.lavaEnabled);}
  function stamp(state){const record=terrain.chunks.get(state.mesh);if(!record?.vertices)return;const slot=record.slot*8,slots=terrain.slots;
   if(!(slots.words instanceof Uint32Array)||slot+7>=slots.words.length||typeof slots.markDirty!=='function')throw Error('Native chunk input padding changed');
   slots.words[slot+6]=record.vertices.start*(record.packed?4:1);slots.words[slot+7]=state.active?record.vertexCount:0;slots.markDirty(record.slot,record.slot);
  }
  function reset(state){state.generation=++serial;state.active=false;state.records=null;state.groups=new WeakMap();retire(state.buffer);state.buffer=null;stamp(state);}
  function queue(state,type='probe'){if(type==='light'&&state.rebuild)type='probe';if(type!=='light')state.rebuild=true;state.type=type;pending.add(state);}
  function copyOriginal(value){const copy=v=>ArrayBuffer.isView(v)?new Uint8Array(v.buffer,v.byteOffset,v.byteLength).slice():v.slice(0),out={vertexCount:value.vertexCount,usesAtlas:value.usesAtlas,faceGroups:value.faceGroups?.slice()};if(value.packedVertices)out.packedVertices=copy(value.packedVertices);else out.vertices=copy(value.vertices);if(value.FE)out.FE=value.FE.slice();return out;}
  function cloneJob(state,type){const original=copyOriginal(state.original),metadata=environment.liquidMetadata();return {id:state.generation,type,original,origin:state.origin,texture:state.material?.texture||'none',options:options(),atlasIndices:[...metadata.water,...metadata.lava],liquidHint:!!state.material?.liquid||metadata.names.includes(state.material?.model.name)};}
  function transfer(job){const result=[],seen=new Set();for(const value of [job.original?.packedVertices,job.original?.vertices,job.original?.FE,job.snapshot?.cells,job.records,job.values]){
   const buffer=value instanceof ArrayBuffer?value:value?.buffer;if(buffer&&!seen.has(buffer)){seen.add(buffer);result.push(buffer);}
  }return result;}
  function post(state,job){job.ticket=++ticket;busy={state,id:job.id,ticket:job.ticket};worker.postMessage(job,transfer(job));}
  function choose(){let best=null,distance=Infinity;const eye=native.meshes.view?.eye||[0,0,0];for(const state of pending){
   if(states.get(state.mesh)!==state){pending.delete(state);continue;}const d=state.origin.reduce((sum,v,i)=>sum+(v-worldOrigin[i]-eye[i])**2,0);if(d<distance){distance=d;best=state;}
  }return best;}
  function beginSnapshot(state){const g=state.original.faceGroups;let min=[0,0,0],max=[32,32,32];
   if(g?.length===15&&[...g.slice(9)].every(Number.isFinite)){const lo=[g[10],g[12],g[14]],hi=[g[9],g[11],g[13]];if(lo.every((v,i)=>v>=0&&hi[i]>=v&&hi[i]<=64)){min=lo;max=hi;}}
   min=min.map((v,i)=>Math.floor(v+state.origin[i])-3);max=max.map((v,i)=>Math.ceil(v+state.origin[i])+3);const size=max.map((v,i)=>Math.max(1,v-min[i]+1));
   if(size.some(v=>v>72))throw Error('Native liquid snapshot bounds changed');const cells=new Uint8Array(size[0]*size[1]*size[2]).fill(255);
   snapshotJob={state,id:state.generation,snapshot:{min,size,cells},cursor:0};
  }
  function advanceSnapshot(){const j=snapshotJob;if(!j)return;if(j.id!==j.state.generation||!states.has(j.state.mesh)){snapshotJob=null;return;}
   const world=environment.liquidWorld();if(!world)return;const {min,size,cells}=j.snapshot,start=performance.now();let reads=0;
   while(j.cursor<cells.length&&reads<2048){const at=j.cursor++,z=at%size[2],y=Math.floor(at/size[2])%size[1],x=Math.floor(at/(size[1]*size[2])),wx=x+min[0],wy=y+min[1],wz=z+min[2];
    if(world.loaded(wx,wy,wz)){const id=world.read(wx,wy,wz);if(Number.isInteger(id))cells[at]=world.isWater(id)?1:world.isLava(id)?2:id===0?0:3;}
    reads++;if((reads&63)===0&&performance.now()-start>=1)break;
   }
   if(j.cursor===cells.length){const job=cloneJob(j.state,'prepare');job.snapshot=j.snapshot;snapshotJob=null;post(j.state,job);}
  }
  function commit(){while(completed.length){const {state,id,result}=completed.shift();if(states.get(state.mesh)!==state||state.generation!==id){stale++;continue;}
   if(result.error){report(Error(result.error));continue;}if(result.light){originalLight.call(terrain,state.mesh,result.light);continue;}
   if(result.needsSnapshot){queue(state,'prepare');continue;}if(result.defer)continue;if(result.skip){state.rebuild=false;if(state.active){assign(state,state.original);reset(state);}continue;}
   const buffer=device.createBuffer({label:'Bloxdy liquid quad metadata',size:Math.max(40,result.records.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
   try{device.queue.writeBuffer(buffer,0,result.records);assign(state,{...state.original,...result.data});}catch(e){buffer.destroy();report(e);continue;}
   retire(state.buffer);state.buffer=buffer;state.records=result.records;state.changed=result.changed;state.active=true;state.rebuild=false;state.groups=new WeakMap();stamp(state);prepared++;break;
  }}
  const originalSet=terrain.setChunkMesh,originalLight=terrain.setChunkMeshLight;
  function assign(state,value){committing++;try{return originalSet.call(terrain,state.mesh,value,state.origin);}finally{committing--;}}
  function tick(){frame++;parameters();const metadata=environment.liquidMetadata(),next=JSON.stringify([settings.enabled,settings.waterEnabled,settings.lavaEnabled,settings.waterStyle,settings.lavaStyle,settings.waterPhysics,settings.lavaPhysics,settings.underwaterLight>0,settings.lavaUnderwaterLight>0,root.__BLOXD_MOD_HOST__?.profile?.performance,metadata.water,metadata.lava,metadata.names]);
   if(next!==key){key=next;for(const state of states.values()){state.generation=++serial;queue(state,wanted()?'probe':'restore');}}
   commit();if(busy)return;
   if(snapshotJob){advanceSnapshot();return;}let state=choose();if(!state)return;pending.delete(state);
   if(state.type==='restore'){assign(state,state.original);reset(state);return;}
   if(state.type==='light'&&state.records){const job=cloneJob(state,'light');job.records=state.records.slice();job.values=state.original.FE.slice();post(state,job);return;}
   if(!wanted())return;if(state.type==='probe'){post(state,cloneJob(state,'probe'));return;}beginSnapshot(state);advanceSnapshot();
  }
  try{
   if(typeof environment.geometryKernel!=='function'||typeof root.Worker!=='function')throw Error('Native liquid background worker unavailable');
   const shared=environment.geometryKernel(),functions={...payload.geometry,...shared,prepareNativeLiquidJob:payload.job};
   const source='"use strict";\nconst clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)));\n'+Object.entries(functions).map(([name,fn])=>'const '+name+'='+fn.toString()+';').join('\n')+`
self.onmessage=({data:job})=>{try{const result=prepareNativeLiquidJob(job),list=[],seen=new Set();for(const v of [result.data?.packedVertices,result.data?.vertices,result.data?.FE,result.records,result.kinds,result.light]){const b=v instanceof ArrayBuffer?v:v?.buffer;if(b&&!seen.has(b)){seen.add(b);list.push(b);}}self.postMessage({id:job.id,ticket:job.ticket,result},list);}catch(e){self.postMessage({id:job.id,ticket:job.ticket,result:{error:e.message}});}};`;
   workerUrl=root.URL.createObjectURL(new root.Blob([source],{type:'text/javascript'}));worker=new root.Worker(workerUrl);
   worker.onmessage=({data:message})=>{if(disposed)return;const current=busy;if(!current||message.id!==current.id||message.ticket!==current.ticket){stale++;return;}busy=null;completed.push({...current,result:message.result});};worker.onerror=e=>{if(!disposed){report(Error(e.message||'Liquid worker failed'));busy=null;}};
   ownProperty('__BVFX_NATIVE_LIQUID_RESOURCES__',()=>({uniform,neutral,uniformBytes:data.byteLength}));
   ownProperty('__BVFX_NATIVE_LIQUID_BIND__',(pass,base)=>passes.set(pass,{base,bound:base}));
   wrap(terrain,'shaderModule',old=>function(code,...args){return old.call(this,payload.patch(code,payload.kernel.code),...args);});
   wrap(terrain,'materialFor',old=>function(...args){const material=old.apply(this,args);if(!material)return material;const value=this.isBlended(material)?0:1;
    if(material.uniformData?.length!==16)throw Error('Native terrain material layout changed');if(material.uniformData[15]!==value){material.uniformData[15]=value;device.queue.writeBuffer(material.uniformBuffer,60,material.uniformData,15,1);}return material;
   });
   wrap(terrain,'setChunkMesh',old=>function(mesh,value,origin){let state=states.get(mesh);if(state)reset(state);const result=old.call(this,mesh,value,origin),record=this.chunks.get(mesh);
    if(!record?.material||record.material.customRenderMat)return result;
    state={mesh,original:value,origin:Array.from(origin),material:record.material,generation:++serial,active:false,groups:new WeakMap(),buffer:null};states.set(mesh,state);stamp(state);if(wanted())queue(state);return result;
   });
   wrap(terrain,'setChunkMeshLight',old=>function(mesh,values){if(committing)return old.call(this,mesh,values);const state=states.get(mesh);if(!state)return old.call(this,mesh,values);state.original={...state.original,FE:values.slice()};state.generation=++serial;
    if(state.active){queue(state,'light');return;}if(wanted())queue(state);return old.call(this,mesh,values);
   });
   wrap(terrain,'removeChunkMesh',old=>function(mesh,...rest){const state=states.get(mesh);if(state){reset(state);states.delete(mesh);pending.delete(state);}return old.call(this,mesh,...rest);});
   wrap(terrain.geometry,'draw',old=>function(pass,record,...args){const state=states.get(record.mesh),binding=passes.get(pass);
    if(!binding){if(state?.active&&state.changed)return 0;return old.call(this,pass,record,...args);}
    let group=binding.base;if(state?.active){group=state.groups.get(binding.base);if(!group){group=native.__BVFX_REPLACE_NATIVE_BINDING__(binding.base,19,{buffer:state.buffer});state.groups.set(binding.base,group);}}
    if(binding.bound!==group){pass.setBindGroup(3,group);binding.bound=group;}return old.call(this,pass,record,...args);
   });
   // Lite reads the material model directly and can retain its uniform values.
   // Scale only the camera tint's output alpha; never change the live model.
   const overlayFactors=new WeakMap(),models=native.meshes.modelUniforms;
   function overlayFactor(instance,model){
    if(!/camScreen|camera_screen/i.test(instance.owner?.name||model.name||''))return null;
    const colours=[model.emissiveColor,model.diffuseColor],water=colours.some(c=>c&&c[2]>c[0]&&c[2]>c[1]*.8),lava=colours.some(c=>c&&c[0]>c[2]*2&&c[0]>c[1]*1.2);
    return settings.enabled&&settings.waterEnabled&&water?settings.waterUnderwater/100:settings.enabled&&settings.lavaEnabled&&lava?settings.lavaUnderwater/100:1;
   }
   wrap(models,'writeModelUniforms',old=>function(outer,instance,model,...rest){const result=old.call(this,outer,instance,model,...rest),factor=overlayFactor(instance,model);
    if(factor!==null){const colour=model.diffuseColor;instance.ubo.updateFloat4('vDiffuseColor',colour[0],colour[1],colour[2],model.alpha*factor);overlayFactors.set(instance,factor);}return result;
   });
   wrap(models,'refreshModelUniforms',old=>function(outer,instance,model,...rest){const factor=overlayFactor(instance,model);if(factor!==null&&overlayFactors.get(instance)!==factor)instance.heldVersion=-1;return old.call(this,outer,instance,model,...rest);});
   wrap(native,'drawFrame',old=>function(outer,...rest){worldOrigin=outer?.av?.Wt||[0,0,0];try{try{tick();}catch(e){report(e);}return old.call(this,outer,...rest);}finally{flushRetired();}});
   parameters();
  }catch(e){for(const restore of undo.reverse())restore();worker?.terminate();if(workerUrl)root.URL.revokeObjectURL(workerUrl);uniform.destroy();neutral.destroy();throw e;}
  return {dispose(){if(disposed)return;disposed=true;for(const restore of undo.reverse())restore();worker.terminate();root.URL.revokeObjectURL(workerUrl);for(const state of states.values())retire(state.buffer);retire(uniform);retire(neutral);states.clear();pending.clear();completed.length=0;snapshotJob=null;busy=null;flushRetired();},
   diagnostics:()=>({implementation:'native-liquids-worker',frames:frame,prepared,staleResults:stale,uniformUploads:uploads,pending:pending.size,workerBusy:!!busy,snapshotPending:!!snapshotJob,error,extraRenderPasses:0,readbacks:0})};
 };
}
