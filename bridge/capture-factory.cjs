'use strict';
module.exports = function installCapture(config) {
  'use strict';
  config ||= {};
  // Production always carries proven raw block identity. Inert legacy wire
  // fixtures can explicitly exercise the preserved v1-v3 emission encoder.
  const blockIdentity=!config.fixture||config.sourceBlockIdentity!==false;
  if (globalThis.__BLOXD_NATIVE_CAPTURE__) return;
  const sink = globalThis.bloxdNative;
  if (!sink || (!config.fixture && location.hostname !== 'bloxd.io')) return;
  const own = value => value && typeof value === 'object'
    ? Object.values(Object.getOwnPropertyDescriptors(value)).filter(d => 'value' in d).map(d => d.value) : [];
  const finite = values => {if(!values)return false;for(const value of values)if(!Number.isFinite(value))return false;return true;};
  const identity = () => new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const matrixData = value => value?.m || value?._m || value;
  const state = { api:null,scene:null,epoch:0,nextId:1,sequence:0,busy:false,stopped:false,
    scanAt:0,scanCursor:0,activeCursor:0,scanRound:0,paused:false,root:null,origin:null,meshes:new Map(),textureIds:new WeakMap(),textures:new Map(),bytes:0,
    meshUploads:0,poseUpdates:0,materialUpdates:0,surfaceUpdates:0,cameraFrames:0,textureChunks:0,skipped:0,error:null,phase:'waiting-engine',
    cameraBusy:false,tickMs:0,maxTickMs:0,textureReadMs:0,maxTextureReadMs:0,scanVisited:0,
    textureJobs:[],originKey:null,originRoot:null,rebases:0,readbackMode:'pending',
    ready:false,revision:1,owned:false,reason:'Waiting for source draw selection.',active:new Set(),
    pendingMeshes:0,unsupportedMeshes:0,suppressedDraws:0,controlKey:null,observer:null,observerScene:null,presentationFault:null,
    importEnabled:false,observeWrites:!!config.fixture,captureGL:null,fallbackUntil:0,idleSkips:0,trackedCalls:0 };
  const meshIds = new WeakMap(), glStates = new WeakMap(), revisions = new WeakMap();
  const particleMeshes=new WeakMap(),particleMaterials=new WeakSet();
  const drawObservers=new Map(),drawOrder=new WeakMap();let observedViews=new WeakMap();
  const partKeys=new WeakMap();
  let exportedParts=new WeakMap();
  const verifiedTextures=new WeakSet(),textureKeys=new WeakMap();
  const textureChanges=new WeakMap();
  const wrappers=[];
  // Authorized transparent native Worker observer. Never creates a worker,
  // sends a message of its own, or calls a mesher/registry/source simulation.
  const meshingWorkers=new Map(),meshingProofs=new Map();let meshingProofBytes=0;
  const meshingLimit=1024*1024,meshingWorkerLimit=8;
  const dataField=(o,k)=>o&&Object.getOwnPropertyDescriptor(o,k)?.value;
  let materialOwner=null,materialBytes=0,materialSerial=0;
  const materialRecords=new Map(),materialTokens=new Map();
  const proofBytes=()=>meshingProofBytes+instanceBytes+materialBytes;
  function dropMaterial(id){const r=materialRecords.get(id);if(r){materialBytes-=r.cost;materialRecords.delete(id);materialTokens.delete(r.token);}}
  function resetMaterials(){materialRecords.clear();materialTokens.clear();materialBytes=0;materialOwner=null;}
  function materialProvider(){
    const root=state.root,bloxd=dataField(root,'bloxd'),registry=dataField(root,'As'),names=dataField(dataField(bloxd,'As'),'metadatas');
    if(!root||dataField(bloxd,'my')!==root||!names||typeof names!=='object'||!registry)return null;
    if(!config.fixture){const proto=Object.getPrototypeOf(bloxd),base=Object.getPrototypeOf(proto||{});
      const method=k=>dataField(bloxd,k)||dataField(proto,k)||dataField(base,k);
      if(!/this\.As\.metadatas\[ss\]\.name/.test(String(method('getItemName')))||!/this\.As\.metadatas\[ss\]\.id/.test(String(method('getItemId'))))return null;}
    return {root,bloxd,registry,names};
  }
  function materialMetadata(provider,id){
    if(!provider||!Number.isInteger(id)||id<1||id>65535)return null;
    const names=provider.names,item=dataField(names,String(id)),meta=dataField(item,'meta'),name=dataField(item,'name');
    const text=v=>typeof v==='string'&&v.length<=128&&/^[\x20-\x7e]*$/.test(v);
    if(!item||dataField(item,'id')!==id||!text(name)||!name||dataField(names,name)!==item||!meta||!Object.isFrozen(meta))return null;
    const rootId=dataField(meta,'rootId'),rootName=dataField(meta,'rootName'),stateText=dataField(meta,'metaStr'),rotation=dataField(meta,'rot'),open=dataField(meta,'open'),half=dataField(meta,'halfblockPlacement');
    const base=dataField(names,String(rootId));
    if(!Number.isInteger(rootId)||rootId<1||rootId>65535||!text(rootName)||!rootName||!text(stateText)||dataField(names,rootName)!==base||dataField(base,'id')!==rootId||dataField(base,'name')!==rootName||
      !(rotation===null||Number.isInteger(rotation)&&rotation>=1&&rotation<=4)||!(open===null||typeof open==='boolean')||!(half===null||Number.isInteger(half)&&half>=0&&half<=2))return null;
    return {item,meta,name,rootId,rootName,stateText,rotation:rotation??0,open:open===null?0:open?2:1,half:half===null?0:half+1};
  }
  function materialFlags(provider,id){let flags=0;for(const [i,key] of ['os','Qs','Xz','us'].entries()){
    const value=dataField(dataField(provider.registry,key),String(id));if(typeof value!=='boolean')return null;if(value)flags|=1<<i;}return flags;}
  function sameMaterial(a,b){return a&&b&&['item','meta','name','rootId','rootName','stateText','rotation','open','half'].every(k=>a[k]===b[k]);}
  function beforeMaterial(id){if(!Number.isInteger(id)||id<1||id>65535){resetMaterials();return null;}dropMaterial(id);const p=materialProvider();
    if(!p){resetMaterials();return null;}
    if(!materialOwner||['root','bloxd','registry','names'].some(k=>materialOwner[k]!==p[k])){resetMaterials();materialOwner=p;}
    const metadata=materialMetadata(p,id);return metadata?{owner:materialOwner,metadata}:null;
  }
  function afterMaterial(id,before){if(!before||before.owner!==materialOwner)return;
    const p=materialProvider(),metadata=materialMetadata(p,id),flags=p&&materialFlags(p,id);
    if(!p||['root','bloxd','registry','names'].some(k=>p[k]!==materialOwner[k])||!sameMaterial(before.metadata,metadata)||flags===null||materialRecords.size>=256||materialSerial>=0xffffffff)return;
    const cost=256+2*(metadata.name.length+metadata.rootName.length+metadata.stateText.length);
    if(proofBytes()+cost>meshingLimit)return;
    const r={...metadata,owner:materialOwner,id,flags,token:++materialSerial,cost};materialRecords.set(id,r);materialTokens.set(r.token,r);materialBytes+=cost;
  }
  function currentMaterial(token){const r=materialTokens.get(token),p=materialProvider();if(!r)return null;
    if(!instanceAlive()||r.owner!==materialOwner||!p||['root','bloxd','registry','names'].some(k=>p[k]!==materialOwner[k])||!sameMaterial(r,materialMetadata(p,r.id))||materialFlags(p,r.id)!==r.flags){dropMaterial(r.id);return null;}return r;
  }
  function meshMaterialToken(entry,id){const r=materialRecords.get(id);return entry.materialOwner===materialOwner&&r&&r.token<=entry.materialEpoch&&currentMaterial(r.token)?r.token:0;}
  function registeredEmission(registry,id){
    if(!registry||!Object.prototype.hasOwnProperty.call(registry,id))return null;
    const rgb=dataField(registry,String(id));if(rgb===null)return 0;
    if(!Array.isArray(rgb)||rgb.length!==3)return null;
    const v=[0,1,2].map(i=>dataField(rgb,String(i)));
    return v.every(x=>Number.isInteger(x)&&x>=0&&x<=15)?v[0]|v[1]<<4|v[2]<<8:null;
  }
  function meshingRoot(){
    const root=state.root,manager=dataField(root,'Is'),registry=dataField(dataField(root,'As'),'Us');
    if(!manager||manager.my!==root||!Array.isArray(manager.workers)||!Array.isArray(registry)||
      !/lightEmissionLookup:Js\(ky\)/.test(String(manager.lazyInitMeshingObjs))||
      !/this\.meshBuilder\.assignMeshData\(my,ys\[Ys\]\)/.test(String(manager.assignMeshDataToChunk)))return null;
    return {root,manager,registry};
  }
  function dropMeshingWorker(worker){const e=meshingWorkers.get(worker);if(!e)return;
    e.valid=false;e.pending.clear();try{worker.removeEventListener('message',e.listener);}catch{}meshingWorkers.delete(worker);
    e.packed=new Uint16Array(0);e.known=new Uint8Array(0);
    for(const [buffer,p] of meshingProofs)if(p.entry===e)releaseMeshingProof(buffer,p);
  }
  function releaseMeshingProof(buffer,p){meshingProofBytes-=p.cost;meshingProofs.delete(buffer);p.entry=null;p.bytes=p.indices=p.faces=p.blocks=p.materials=null;p.used.clear();p.exports.clear();}
  function forgetEmissionExport(id){const p=state.meshes.get(id)?.emissionProof,runs=p?.exports.get(id)?.runs;
    if(runs){const cost=runs.byteLength+(p.exports.get(id).materials?.byteLength||0)+32;p.exports.delete(id);p.cost-=cost;if(p.kind===1)instanceBytes-=cost;else meshingProofBytes-=cost;}}
  function forgetMesh(id){forgetEmissionExport(id);state.meshes.delete(id);}
  function resetMeshing(){for(const worker of [...meshingWorkers.keys()])dropMeshingWorker(worker);meshingProofs.clear();meshingProofBytes=0;}
  function meshingReply(entry,message){
    if(!entry.valid||state.root!==entry.root||entry.root.Is!==entry.manager||!entry.manager.workers.includes(entry.worker))return;
    const id=dataField(message,'meshJobId'),job=entry.pending.get(id);entry.pending.delete(id);
    if(!job||dataField(message,'type')!=='meshed'||dataField(message,'lightOnlyUpdate')!==false||
      ['i','j','k'].some(k=>dataField(message,k)!==job[k]))return;
    const groups=dataField(message,'faceLayout'),geometry=dataField(message,'vertexDataInfo'),arrays=dataField(message,'reusableChunkArrs');
    if(!Array.isArray(groups)||!Array.isArray(geometry)||groups.length!==geometry.length||groups.length>64||!Array.isArray(arrays))return;
    const blocks=arrays[7],size=job.size;if(!(blocks instanceof Uint16Array)||blocks.length!==size**3)return;
    const byTerrain=new Map(groups.map(g=>[g.terrainID,g]));if(byTerrain.size!==groups.length)return;
    let work=0;const materialValues=new Map(),materialValue=id=>{if(!materialValues.has(id))materialValues.set(id,meshMaterialToken(entry,id));return materialValues.get(id);};
    for(const g of geometry){const f=byTerrain.get(g.terrainID),n=f?.numFaces;
      const stride=g.usesAtlas===true?32:g.usesAtlas===false?28:0;
      if(!Number.isInteger(n)||n<1||n>8192||!stride||!(g.vertices instanceof ArrayBuffer)||!(g.indices instanceof Uint32Array)||g.indices.length!==n*6||
        g.vertices.byteLength!==n*4*stride||!['is','js','ks','wids','hts','zy'].every(k=>ArrayBuffer.isView(f[k])&&f[k].length===n))continue;
      const faces=new Uint16Array(n),faceBlocks=blockIdentity?new Uint32Array(n):null,faceMaterials=blockIdentity&&entry.materialOwner?new Uint32Array(n):null,used=new Map(),view=new DataView(g.vertices);let valid=true;
      for(let face=0;face<n;++face){const direction=f.zy[face],axis=direction>>1,w=f.wids[face],h=f.hts[face],p=[f.is[face],f.js[face],f.ks[face]];
        if(!Number.isInteger(direction)||direction<0||direction>5||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>size||h>size||(work+=w*h)>1048576){valid=false;break;}
        const wa=axis===2?0:2,ha=axis===1?0:1;let known=true,rgb=null,blockKnown=true,owner=null;const faceUsed=new Map();
        for(let v=0;v<4;++v)for(let c=0;c<3;++c)if(view.getFloat32((face*4+v)*stride+c*4,true)!==p[c]+(c===wa&&(v===1||v===2)?w:0)+(c===ha&&v>=2?h:0))valid=false;
        if(!valid)break;
        p[axis]-=direction%2===0?1:0;
        for(let y=0;y<h&&(known||blockIdentity&&blockKnown);++y)for(let x=0;x<w;++x){const qx=p[0]+(wa===0?x:0)+(ha===0?y:0),qy=p[1]+(wa===1?x:0)+(ha===1?y:0),qz=p[2]+(wa===2?x:0)+(ha===2?y:0);
          if(!Number.isInteger(qx)||!Number.isInteger(qy)||!Number.isInteger(qz)||qx<0||qy<0||qz<0||qx>=size||qy>=size||qz>=size){known=blockKnown=false;break;}
          const block=blocks[qx*size*size+qy*size+qz],value=entry.known[block]?entry.packed[block]:null;
          if(owner!==null&&owner!==block)blockKnown=false;owner=block;
          if(value===null||rgb!==null&&rgb!==value)known=false;
          if(known){rgb=value;faceUsed.set(block,value);if(faceUsed.size>256)known=false;}
        }
        if(faceBlocks&&blockKnown&&owner!==null)faceBlocks[face]=65536|owner;
        if(faceMaterials&&blockKnown&&owner!==null)faceMaterials[face]=materialValue(owner);
        if(known&&rgb!==null){faces[face]=4096|rgb;for(const [block,value] of faceUsed)used.set(block,value);if(used.size>256){valid=false;break;}}
      }
      if(!valid||!faces.some(v=>v!==0)&&!faceBlocks?.some(v=>v!==0)||g.indices.some(i=>i>=n*4))continue;
      const bytes=g.vertices.byteLength+g.indices.byteLength+faces.byteLength+(faceBlocks?.byteLength||0)+(faceMaterials?.byteLength||0)+used.size*32+256;if(bytes>meshingLimit)continue;
      while((proofBytes()+bytes>meshingLimit||meshingProofs.size>=1024)&&meshingProofs.size){const [key,old]=meshingProofs.entries().next().value;releaseMeshingProof(key,old);}
      if(proofBytes()+bytes>meshingLimit)continue;
      const previous=meshingProofs.get(g.vertices);if(previous)releaseMeshingProof(g.vertices,previous);
      meshingProofs.set(g.vertices,{entry,job:id,faces,blocks:faceBlocks,materials:faceMaterials,used,stride,exports:new Map(),cost:bytes,bytes:new Uint8Array(g.vertices).slice(),indices:g.indices.slice()});meshingProofBytes+=bytes;
    }
  }
  function installMeshingObserver(){
    const proto=globalThis.Worker?.prototype,original=proto?.postMessage;
    if(typeof original!=='function'||!config.fixture&&!/\[native code\]/.test(Function.prototype.toString.call(original)))return;
    function wrapped(...args){
      let candidate=null,entry=null,job=null;
      try{
        const type=dataField(args[0],'type'),data=dataField(args[0],'data');
        if(type==='meshingInit'){
          dropMeshingWorker(this);const owner=meshingRoot(),lookup=dataField(data,'lightEmissionLookup'),size=dataField(data,'Zy');
          if(owner&&meshingWorkers.size<meshingWorkerLimit&&lookup instanceof Uint16Array&&lookup.buffer instanceof ArrayBuffer&&lookup.length>0&&lookup.length<=65536&&
            Number.isInteger(size)&&size>0&&size<=64&&owner.registry.length===lookup.length&&typeof this.addEventListener==='function'){
            const packed=lookup.slice(),known=new Uint8Array(packed.length);
            for(let i=0;i<packed.length;++i)if(packed[i]<=4095&&registeredEmission(owner.registry,i)===packed[i])known[i]=1;
            candidate={...owner,worker:this,packed,known,size,pending:new Map(),valid:false,proto,hook:wrapped,materialOwner,materialEpoch:materialSerial};
            candidate.listener=event=>{try{meshingReply(candidate,event.data);}catch{/* Unknown, never change source dispatch. */}};
            this.addEventListener('message',candidate.listener);
          }
        }else if(type==='Oy'){
          entry=meshingWorkers.get(this);const chunk=dataField(data,'chunk'),id=dataField(data,'meshJobId');
          if(entry?.valid&&chunk===entry.manager.tempChunk&&entry.manager.workers.includes(this)&&entry.pending.size<64&&
            Number.isInteger(id)&&id>0&&id<=0xffffffff&&chunk.size===entry.size&&['i','j','k'].every(k=>Number.isSafeInteger(chunk[k])))
            job={id,size:chunk.size,i:chunk.i,j:chunk.j,k:chunk.k};
        }
      }catch{/* Observation failure cannot suppress an original source call. */}
      let result;try{result=Reflect.apply(original,this,args);}catch(error){if(candidate)try{this.removeEventListener('message',candidate.listener);}catch{}throw error;}
      if(candidate){candidate.valid=true;meshingWorkers.set(this,candidate);}
      if(entry&&job)entry.pending.set(job.id,job);
      return result;
    }
    try{proto.postMessage=wrapped;if(proto.postMessage===wrapped)wrappers.push({proto,name:'postMessage',original,wrapped});}catch{/* Prototype ownership unavailable: emission remains unknown. */}
  }
  installMeshingObserver();
  // Explicitly authorized source-call observers (19 October). All state below
  // is adapter-owned. No source method is invoked except its original call.
  let instanceOwner=null,instanceContext=null,instanceBytes=0,instanceSerial=0;
  const instanceRecords=new Map(),instanceHooks=[];
  function releaseInstanceSlot(s){const g=instanceOwner?.generations.get(s.block);if(g===s.generation&&--g.refs===0)instanceOwner.generations.delete(s.block);}
  function instanceDrop(r){if(!r)return;r.valid=false;instanceBytes-=r.cost;r.cost=0;for(const s of r.slots)releaseInstanceSlot(s);r.slots=[];r.slotBytes=0;r.committed=r.pending=r.buffer=r.bufferHandle=null;r.exports.clear();instanceRecords.delete(r.mesh);
    for(let i=instanceHooks.length-1;i>=0;--i){const h=instanceHooks[i];if(h.object!==r.mesh)continue;
      try{if(h.object[h.key]===h.wrapped){if(h.descriptor)Object.defineProperty(h.object,h.key,h.descriptor);else delete h.object[h.key];}}catch{}instanceHooks.splice(i,1);}}
  function instanceReset(){for(const r of [...instanceRecords.values()])instanceDrop(r);
    for(const h of instanceHooks.reverse())try{if(h.object[h.key]===h.wrapped){if(h.descriptor)Object.defineProperty(h.object,h.key,h.descriptor);else delete h.object[h.key];}}catch{}
    instanceHooks.length=0;instanceOwner=null;instanceContext=null;resetMaterials();}
  function instanceCharge(r,cost){const delta=cost-r.cost;if(delta>0&&proofBytes()+delta>meshingLimit){instanceDrop(r);return false;}instanceBytes+=delta;r.cost=cost;return true;}
  function instanceAlive(){return instanceOwner&&instanceOwner.root===state.root&&state.root.zs===instanceOwner.manager&&state.root.As===instanceOwner.registry&&
    instanceHooks.every(h=>h.object[h.key]===h.wrapped);}
  function instanceDirty(r){if(r?.valid){r.committed=null;r.pending=null;r.job=++instanceSerial;r.exports.clear();instanceCharge(r,256+r.slotBytes);}}
  function instanceRemove(chunk,key){for(const r of instanceRecords.values()){const i=r.slots.findIndex(s=>s.chunk===chunk&&s.key===key);if(i<0)continue;
    instanceDirty(r);releaseInstanceSlot(r.slots[i]);r.slotBytes-=r.slots[i].cost;if(i!==r.slots.length-1)r.slots[i]=r.slots[r.slots.length-1];r.slots.pop();instanceCharge(r,256+r.slotBytes);return;}}
  function instanceCommit(r){
    if(!r.valid||!instanceAlive())return;const storage=r.mesh._thinInstanceDataStorage,m=storage?.matrixData,n=r.slots.length,pending=r.pending;r.pending=null;
    if(!m||!pending||pending.buffer!==m||pending.count!==n||storage.instancesCount!==n||m.length<n*16||n>8192||!n||!config.fixture&&!state.observeWrites){r.committed=null;return;}
    const handle=rawBuffer(storage.matrixBuffer);if(handle!==pending.handle||revision(handle)!==pending.revision||!pending.bytes.every((v,i)=>m[i]===v)){r.committed=null;return;}
    r.bufferHandle=handle;r.bufferRevision=pending.revision;
    r.exports.clear();r.committed=null;
    if(!instanceCharge(r,256+r.slotBytes))return;
    r.buffer=m;r.committed=pending.bytes;r.job=++instanceSerial;
  }
  function instanceProof(mesh){const r=instanceRecords.get(mesh);if(!r?.valid||!r.committed||r.job>0xffffffff||!instanceAlive()||!config.fixture&&!state.observeWrites||mesh.sourceMesh||mesh.skeleton||mesh.morphTargetManager)return null;
    const storage=mesh._thinInstanceDataStorage;if(storage?.matrixData!==r.buffer||storage.instancesCount!==r.slots.length)return null;
    if(rawBuffer(storage.matrixBuffer)!==r.bufferHandle||revision(r.bufferHandle)!==r.bufferRevision)return null;
    for(let i=0;i<r.committed.length;++i)if(r.buffer[i]!==r.committed[i])return null;
    for(const s of r.slots){if(s.chunk.Pf!==s.pf||s.pf[s.key]!==s.block||s.registry!==instanceOwner.registry.Us||
      registeredEmission(s.registry,s.block)!==s.rgb||instanceOwner.generations.get(s.block)!==s.generation)return null;}
    return r;
  }
  function instanceWrap(object,key,before,after){const original=object?.[key];if(typeof original!=='function')throw Error('Missing instance observer boundary.');
    const descriptor=Object.getOwnPropertyDescriptor(object,key);
    const wrapped=function(...args){if(object!==Float32Array.prototype&&this!==object)return Reflect.apply(original,this,args);
      let token;try{token=before?.(this,args);}catch{for(const r of [...instanceRecords.values()])instanceDrop(r);}
      let result;try{result=Reflect.apply(original,this,args);}catch(error){for(const r of [...instanceRecords.values()])instanceDrop(r);instanceContext=null;throw error;}
      try{after?.(this,args,token);}catch{for(const r of [...instanceRecords.values()])instanceDrop(r);instanceContext=null;}return result;};
    Object.defineProperty(object,key,{configurable:true,writable:true,value:wrapped,enumerable:descriptor?.enumerable??false});instanceHooks.push({object,key,descriptor,wrapped});
  }
  function installInstanceObserver(){
    if(instanceAlive())return;if(instanceOwner)instanceReset();const root=state.root,manager=root?.zs,registry=root?.As;
    if(!manager||!registry||!Array.isArray(registry.Us)||!registry.bf||!registry.cs||!Array.isArray(manager.tf)||
      !/\[native code\]/.test(Function.prototype.toString.call(Float32Array.prototype.set))||
      !config.fixture&&(!/vs\.Pf\[hs\]\|\|0/.test(String(manager.Ms))||!/jy\.VO\(vs,hs,Ys,my,Es,Ds,ys\)/.test(String(manager.Ms))||
        !/ss\.Pf=null/.test(String(manager.iy))||!/ys\.ce\(\),0===ys\.count&&ys\.dispose\(\)/.test(String(manager.ey))||!/Ns\[ss\]=Ds\.sO/.test(String(registry.vz))))return;
    instanceOwner={root,manager,registry,generations:new Map(),registerEpoch:0};
    try{
      instanceWrap(registry,'vz',(_,a)=>{const id=a[0];++instanceOwner.registerEpoch;instanceOwner.generations.delete(id);for(const r of [...instanceRecords.values()])if(r.slots.some(s=>s.block===id))instanceDrop(r);return beforeMaterial(id);},(_,a,before)=>afterMaterial(a[0],before));
      // Observe the actual destination offset of the source's 16-float append.
      // The active context is synchronous and only covers an original Ms call.
      const proto=Float32Array.prototype;
      instanceWrap(proto,'set',null,(target,a)=>{if(instanceContext&&ArrayBuffer.isView(a[0])&&a[0].length===16&&Number.isInteger(a[1])&&a[1]>=0&&a[1]%16===0){
        if(instanceContext.writes.length<8)instanceContext.writes.push({target,slot:a[1]/16});else instanceContext.bad=true;}});
      instanceWrap(root,'emit',null,(_,a)=>{if(a[0]==='removingTerrainMesh')instanceDrop(instanceRecords.get(a[1]));
        if(a[0]!=='addingTerrainMesh'||!instanceContext)return;const mesh=a[1];
        if(instanceRecords.has(mesh)||instanceRecords.size>=256)return;
        if(!config.fixture&&(!/this\._thinInstanceDataStorage\.matrixData=ys/.test(String(mesh.PO))||!/matrixBuffer\?\.updateDirectly/.test(String(mesh.UO))))return;
        const r={mesh,kind:1,valid:true,slots:[],slotBytes:0,buffer:null,committed:null,exports:new Map(),cost:0,job:++instanceSerial};
        if(!instanceCharge(r,256))return;instanceRecords.set(mesh,r);instanceContext.created.push(r);
        instanceWrap(mesh,'PO',()=>{instanceDirty(r);});
        instanceWrap(mesh,'UO',(_,args)=>{r.committed=null;if(args[0]==='matrix')r.pending=null;},(_,args)=>{
          if(args[0]==='matrix'){const s=mesh._thinInstanceDataStorage;
            if(s?.matrixData&&s.instancesCount===r.slots.length&&r.slots.length&&
              (config.fixture||state.observeWrites&&s.matrixBuffer?.isUpdatable?.()&&rawBuffer(s.matrixBuffer))){
              const bytes=new Float32Array(r.slots.length*16);for(let i=0;i<bytes.length;++i)bytes[i]=s.matrixData[i];const handle=rawBuffer(s.matrixBuffer);
              r.pending={buffer:s.matrixData,count:s.instancesCount,bytes,handle,revision:revision(handle)};}}
          else if(args[0]==='aPackedLightLevels')instanceCommit(r);
        });
      });
      instanceWrap(manager,'Ms',(_,a)=>{
        const previous=instanceContext;instanceContext=null;
        if(previous){for(const r of [...instanceRecords.values()])instanceDrop(r);return {nested:true};}
        const [chunk,block,x,y,z]=a,key=`${chunk.x+x}:${chunk.y+y}:${chunk.z+z}`,pf=chunk.Pf;
        const c={chunk,block,key,pf,old:pf?.[key]||0,writes:[],created:[],bad:false,registry:registry.Us,rgb:registeredEmission(registry.Us,block),generation:instanceOwner.generations.get(block),model:registry.bf[block],registerEpoch:instanceOwner.registerEpoch};
        if(!pf||!Number.isInteger(block)||block<0||block>65535||![chunk.x+x,chunk.y+y,chunk.z+z].every(Number.isSafeInteger))c.bad=true;
        if(c.old!==block)instanceRemove(chunk,key);instanceContext=c;return c;
      },(_,a,c)=>{
        instanceContext=null;if(!c||c.nested)return;
        if(c.bad||c.chunk.Pf!==c.pf||((c.pf[c.key]||0)!==c.block)){for(const r of [...instanceRecords.values()])instanceDrop(r);return;}
        if(!c.block||c.block===c.old)return;
        const matches=[];for(const w of c.writes)for(const r of instanceRecords.values())if(r.mesh._thinInstanceDataStorage?.matrixData===w.target)matches.push({r,w});
        if(matches.length!==1){for(const r of c.created)instanceDrop(r);return;}const {r,w}=matches[0];
        if(w.slot!==r.slots.length||r.slots.length>=8192||registry.cs[c.block]?.yz){instanceDrop(r);return;}
        const rgb=registeredEmission(registry.Us,c.block);if(rgb===null||rgb!==c.rgb||registry.Us!==c.registry||registry.bf[c.block]!==c.model||instanceOwner.registerEpoch!==c.registerEpoch||instanceOwner.generations.get(c.block)!==c.generation){instanceDrop(r);return;}
        const cost=256+c.key.length*2;instanceDirty(r);if(!r.valid||!instanceCharge(r,256+r.slotBytes+cost))return;r.slotBytes+=cost;
        if(!instanceOwner.generations.has(c.block))instanceOwner.generations.set(c.block,{token:++instanceSerial,refs:0});
        ++instanceOwner.generations.get(c.block).refs;
        r.slots.push({chunk:c.chunk,pf:c.pf,key:c.key,block:c.block,rgb,registry:registry.Us,generation:instanceOwner.generations.get(c.block),lifetime:++instanceSerial,cost,material:materialRecords.get(c.block)?.token||0});
      });
      instanceWrap(manager,'iy',(_,a)=>{const chunk=a[0];for(const r of [...instanceRecords.values()])if(r.slots.some(s=>s.chunk===chunk))instanceDrop(r);});
      instanceWrap(manager,'Ds',(_,a)=>{const chunk=a[0];for(const r of [...instanceRecords.values()])if(r.slots.some(s=>s.chunk===chunk))instanceDrop(r);});
      // Rebase/light refresh commit through the same successful UO pair.
      for(const key of ['Hf','wf'])instanceWrap(manager,key,()=>{for(const r of instanceRecords.values())r.committed=null;});
      instanceWrap(manager,'ey');
    }catch{instanceReset();}
  }
  let emissionObserved=new WeakMap(),emissionSent=[],emissionMaterialSent=[];
  function meshEmission(mesh,g=geometry(mesh)){
    if(mesh._thinInstanceDataStorage?.matrixData)return instanceProof(mesh);
    if(mesh.sourceMesh||mesh.skeleton||mesh.morphTargetManager||mesh._thinInstanceDataStorage?.matrixData||!mesh.metadata?.noa_chunk_terrain_mesh)return null;
    const raw=dataField(dataField(g?._vertexBuffers?.position,'_buffer'),'_data');
    if(!ArrayBuffer.isView(raw)||raw.byteOffset!==0||raw.byteLength!==raw.buffer.byteLength)return null;
    const p=meshingProofs.get(raw.buffer),entry=p?.entry;
    if(!entry?.valid||entry.proto.postMessage!==entry.hook||entry.root!==state.root||entry.manager!==state.root?.Is||!entry.manager.workers.includes(entry.worker)||entry.registry!==state.root?.As?.Us||
      raw.byteLength!==p.bytes.length||g._indices?.length!==p.indices.length)return null;
    for(const [id,value] of p.used)if(registeredEmission(entry.registry,id)!==value)return null;
    const bytes=new Uint8Array(raw.buffer);if(!bytes.every((v,i)=>v===p.bytes[i])||!g._indices.every((v,i)=>v===p.indices[i]))return null;
    return p;
  }
  function observeEmission(mesh){const proof=meshEmission(mesh),frame=sourceRenderFrame(state.scene),current=sourceCamera(state.scene),player=current&&playerSource(state.scene,current.camera);
    const old=emissionObserved.get(mesh);
    if(old?.frame===frame){if(old.proof!==proof||old.job!==proof?.job||!current||!old.current||current.camera!==old.current.camera||!samePlayer(old.player,player)||
      current.width!==old.current.width||current.height!==old.current.height||current.flags!==old.current.flags||
      ['view','projection','position'].some(k=>current[k].some((v,i)=>v!==old.current[k][i])))old.conflict=true;return;}
    emissionObserved.set(mesh,{proof,job:proof?.job,frame,current,player,at:performance.now(),utc:Date.now(),conflict:false});
  }
  function emissionPacket(inner,snapshot){
    const entries=[];
    for(const e of snapshot?.emissions||[]){const r=state.meshes.get(e.id);
      if(r?.meshSequence===e.sequence&&e.job===e.proof.job&&r.emissionProof===e.proof&&e.proof.exports.get(e.id)?.sequence===e.sequence&&meshEmission(r.mesh,r.geometry)===e.proof)entries.push(e);
    }
    emissionSent=entries;
    emissionMaterialSent=[];
    if(!entries.length)return inner;
    const definitions=new Map(),entryMaterials=new Map(),checkedMaterials=new Map();
    if(blockIdentity)for(const e of entries){const x=e.proof.exports.get(e.id),tokens=x.materials;if(!tokens)continue;
      entryMaterials.set(e.id,Array.from(tokens,token=>{if(!checkedMaterials.has(token))checkedMaterials.set(token,currentMaterial(token));const r=checkedMaterials.get(token);if(r){definitions.set(r.token,r);return r.token;}return 0;}));}
    emissionMaterialSent=[...definitions.keys()];
    const material=definitions.size>0,instanced=entries.some(e=>e.proof.kind===1),extended=blockIdentity||instanced,uniform=!extended&&entries.every(e=>{const a=e.proof.exports.get(e.id)?.runs;return a?.length===2&&a[1]>=4096;});
    const words=[state.epoch,material?5:blockIdentity?4:instanced?3:uniform?1:2,inner.byteLength,entries.length];let runs=0;
    if(material){words.push(definitions.size);for(const r of definitions.values()){
      words.push(r.token,r.id,r.rootId,r.flags,r.rotation,r.open,r.half,r.name.length,r.rootName.length,r.stateText.length);
      const text=r.name+r.rootName+r.stateText;for(let i=0;i<text.length;i+=4){let value=0;for(let j=0;j<4&&i+j<text.length;++j)value|=text.charCodeAt(i+j)<<(j*8);words.push(value);}}}
    for(const e of entries){const a=e.proof.exports.get(e.id)?.runs;if(!a)throw Error('Source emission export expired.');
      const stride=e.proof.kind===1?5:blockIdentity?3:2;
      words.push(e.id,e.sequence,e.proof.job,extended?e.proof.kind||0:uniform?a[1]&4095:a.length/stride);
      if(extended)words.push(e.proof.kind===1?e.proof.exports.get(e.id).instanceSequence:0,a.length/stride);
      if(!uniform){runs+=a.length/stride;for(let i=0;i<a.length;i+=stride){for(let j=0;j<stride;++j)words.push(a[i+j]);if(material)words.push(entryMaterials.get(e.id)?.[i/stride]||0);}}}
    if(entries.length>8192||runs>8192||inner.byteLength+16+words.length*4>1024*1024)throw Error('Source emission transaction exceeds the shared packet limit.');
    return packet(33,words,[],new Uint8Array(inner));
  }
  // Export order is an exact slice of the immutable source index stream. A
  // triangle may only inherit the face containing ALL three distinct vertices.
  // Each run covers complete triangles; RGB/validity are draw constants.
  function exportEmission(p,id,sequence,indices,vertexMap,start){
    const words=[],materials=[],stride=blockIdentity?3:2;for(let i=0;i<indices.length;i+=3){const a=vertexMap?.[indices[i]]??indices[i],b=vertexMap?.[indices[i+1]]??indices[i+1],c=vertexMap?.[indices[i+2]]??indices[i+2];
      if(a!==p.indices[start+i]||b!==p.indices[start+i+1]||c!==p.indices[start+i+2])return false;
      const face=Math.floor(a/4),exact=a!==b&&a!==c&&b!==c&&Math.floor(b/4)===face&&Math.floor(c/4)===face,value=exact?p.faces[face]:0,block=exact&&blockIdentity?p.blocks[face]:0;
      const material=exact?p.materials?.[face]||0:0;
      if(words.length&&words[words.length-stride+1]===value&&(!blockIdentity||words[words.length-1]===block)&&materials.at(-1)===material)words[words.length-stride]=i+3;
      else {words.push(i+3,value);if(blockIdentity)words.push(block);materials.push(material);}
    }
    if(!words.some((v,i)=>i%stride===1&&v>=4096||blockIdentity&&i%stride===2&&v>=65536)||words.length>8192*stride)return false;
    const metadata=materials.some(v=>v)?new Uint32Array(materials):null,cost=words.length*4+(metadata?.byteLength||0)+32;
    while(proofBytes()+cost>meshingLimit&&meshingProofs.size){const [buffer,old]=meshingProofs.entries().next().value;releaseMeshingProof(buffer,old);}
    if(proofBytes()+cost>meshingLimit)return false;
    if(!p.entry)return false;
    p.exports.set(id,{sequence,runs:new Uint32Array(words),materials:metadata});p.cost+=cost;meshingProofBytes+=cost;return true;
  }
  function emissionCurrent(){return emissionMaterialSent.every(token=>currentMaterial(token))&&emissionSent.every(e=>{const r=state.meshes.get(e.id);return r?.meshSequence===e.sequence&&e.job===e.proof.job&&e.proof.exports.get(e.id)?.sequence===e.sequence&&meshEmission(r.mesh,r.geometry)===e.proof;});}
  // q9aot analytic GPU path. Storage belongs to this observer, never the source.
  const gpuSystems=new Map(),gpuPrograms=new WeakMap(),gpuAllocations=new Map(),gpuReads=[];let gpuFrame=null,gpuSentFrame=-1,gpuExportBusy=false,gpuDirty=false;
  const gpuLimit=8192,gpuDrawLimit=32;
  const isGpu=p=>!!(p?.ring&&p.records&&p.renderer);
  const gpuHandle=p=>p?.records?._hardwareTexture?.underlyingResource;
  function shaderFingerprint(s){if(typeof s!=='string')return '';s=s.replace(/\s/g,'');let h=2166136261;for(let i=0;i<s.length;++i)h=Math.imul(h^s.charCodeAt(i),16777619);return s.length+':'+(h>>>0);}
  function registerGpu(){
    const selected=selectedParticles(state.scene).filter(isGpu),keep=new Set(selected);let slots=0;
    if(selected.length!==gpuSystems.size||selected.some(p=>!gpuSystems.has(p))){gpuFrame=null;gpuSentFrame=-1;gpuDirty=true;invalidate('Source GPU particle selection changed.');}
    for(const [p,e] of gpuSystems)if(!keep.has(p)){if(e.read){releaseRead(e.read);gpuReads.splice(gpuReads.indexOf(e.read),1);}gpuSystems.delete(p);}
    for(const p of selected){const n=p.ring.kY;slots+=n;
      if(!Number.isInteger(n)||n<1||n>gpuLimit||slots>gpuLimit||selected.length>gpuDrawLimit)throw Error('Source GPU particle snapshot budget exceeded.');
      const renderer=state.root?.vy?.Zk,handle=gpuHandle(p),r=p.ring;
      if(!handle||!state.scene.getEngine()._gl.isTexture(handle)||p.renderer!==renderer||state.root.vy.KY?.particles||p.tY!==state.scene||renderer.tY!==state.scene||renderer.Iv!==state.scene.getEngine()||
        p.perRow!==Math.min(n,256)||r.records?.length!==n*16||r.recordBits?.length!==n*16||r.records.buffer!==r.recordBits.buffer||r.records.byteOffset!==r.recordBits.byteOffset||
        (p.renderingGroupId!==0)||![-1,0,1,2,3,4].includes(p.blendMode))throw Error('Source GPU particles have no matching q9aot renderer/ownership contract.');
      const old=gpuSystems.get(p);if(!old||old.handle!==handle||old.capacity!==n){if(old?.read){releaseRead(old.read);gpuReads.splice(gpuReads.indexOf(old.read),1);}const allocation=gpuAllocations.get(handle);gpuAllocations.delete(handle);
        gpuSystems.set(p,{handle,capacity:n,bits:allocation?.bits.length>=n*16?allocation.bits:new Uint32Array(n*16),known:allocation?.bits.length>=n*16?allocation.known:new Uint8Array(n),draws:[],frame:-1});}
    }
  }
  // Observe the actual successful source upload call. Unseen slots remain unknown;
  // never infer a GPU image from a dirty flag or a later mutable CPU ring.
  function gpuWrite(gl,name,a){
    if(gl!==state.scene?.getEngine()?._gl||a[0]!==gl.TEXTURE_2D)return;
    const handle=gl.getParameter(gl.TEXTURE_BINDING_2D);let entry=[...gpuSystems.values()].find(e=>e.handle===handle)||gpuAllocations.get(handle);
    if(name==='texImage2D'&&!entry&&a[1]===0&&a[6]===gl.RGBA_INTEGER&&a[7]===gl.UNSIGNED_INT&&a[8]===null&&a[3]%4===0&&a[3]>0&&a[3]<=1024&&a[4]>0&&a[3]*a[4]/4<=gpuLimit&&gpuAllocations.size<32){
      const n=a[3]*a[4]/4,total=[...gpuSystems.values(),...gpuAllocations.values()].reduce((n,e)=>n+e.known.length,0);
      if(total+n<=gpuLimit)gpuAllocations.set(handle,{bits:new Uint32Array(n*16),known:new Uint8Array(n).fill(1),perRow:a[3]/4});return;
    }
    if(!entry)return;
    if(name!=='texSubImage2D'){entry.known.fill(0);return;}
    const [target,level,x,y,w,h,format,type,data,offset=0]=a;
    const p=[...gpuSystems].find(([,e])=>e===entry)?.[0],row=p?.perRow??entry.perRow;
    if(level!==0||format!==gl.RGBA_INTEGER||type!==gl.UNSIGNED_INT||h!==1||x%4||w%4||x<0||y<0||x+w>row*4||!ArrayBuffer.isView(data)||data.BYTES_PER_ELEMENT!==4||
      offset<0||!Number.isInteger(offset)||offset+w*4>data.length||
      gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING)!==null||gl.getParameter(gl.UNPACK_ROW_LENGTH)!==0||gl.getParameter(gl.UNPACK_SKIP_ROWS)!==0||gl.getParameter(gl.UNPACK_SKIP_PIXELS)!==0){entry.known.fill(0);return;}
    const first=y*row+x/4,count=w/4;if(first+count>entry.known.length){entry.known.fill(0);return;}
    entry.bits.set(new Uint32Array(data.buffer,data.byteOffset+offset*4,count*16),first*16);entry.known.fill(1,first,first+count);entry.read?.updated.fill(1,first,first+count);
  }
  function gpuRecover(gl,p,e){
    if(e.read||gpuReads.length+state.textureJobs.length>=3||!['createBuffer','bufferData','fenceSync','clientWaitSync','getBufferSubData'].every(n=>typeof gl[n]==='function'))return;
    const width=p.perRow*4,height=Math.ceil(e.capacity/p.perRow),bytes=width*height*16;
    if(bytes>512*1024||gpuReads.reduce((n,j)=>n+j.size,0)+bytes>512*1024)return;
    const expected=new Uint32Array(p.ring.recordBits);const job=beginRead(gl,{handle:e.handle,width,height,integer:true},0,1);
    Object.assign(job,{entry:e,system:p,expected,updated:new Uint8Array(e.capacity),at:performance.now()});e.read=job;gpuReads.push(job);
  }
  function pollGpuReads(){
    let bytes=0;
    for(const job of [...gpuReads]){
      const gl=job.gl,result=gl.clientWaitSync(job.sync,0,0);if(result===gl.TIMEOUT_EXPIRED&&performance.now()-job.at<=250)continue;
      gpuReads.splice(gpuReads.indexOf(job),1);job.entry.read=null;
      try{
        if(result===gl.WAIT_FAILED||result===gl.TIMEOUT_EXPIRED||!gpuSystems.has(job.system))continue;
        const saved=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),bits=new Uint32Array(job.size/4);
        try{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,job.buffer);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,bits);}finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,saved);}
        if(job.expected.some((v,i)=>v!==bits[i]))continue;
        for(let i=0;i<job.entry.capacity;++i)if(!job.updated[i]){job.entry.bits.set(bits.subarray(i*16,i*16+16),i*16);job.entry.known[i]=1;}
        bytes+=job.size;
      }finally{releaseRead(job);}
      if(bytes>=512*1024)break;
    }
  }
  function gpuObserveDraw(gl,name,args){
    if(!gpuSystems.size||gl!==state.scene?.getEngine()?._gl)return;
    const renderer=state.root?.vy?.Zk,program=gl.getParameter(gl.CURRENT_PROGRAM);
    const effect=[renderer?.effect,renderer?.multiplyEffect].find(e=>e?._pipelineContext?.program===program);if(!effect)return;
    try{
      const fail=()=>{throw Error('Source GPU draw is incomplete, changed or unsupported.');};
      if(name!=='drawArraysInstanced'||args[0]!==gl.TRIANGLE_STRIP||args[1]!==0||args[2]!==4||gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null||state.scene._isInIntermediateRendering?.())fail();
      if(shaderFingerprint(effect._rawVertexSourceCode)!=='4477:1104319981'||shaderFingerprint(effect._rawFragmentSourceCode)!=='751:1258827443'||
        effect._processFinalCode||effect._processCodeAfterIncludes||effect._vertexSourceCodeOverride||effect._fragmentSourceCodeOverride||effect._transformFeedbackVaryings||
        (effect.defines||'').replace(/#define (MULTIPLY_PASS|IS_NDC_HALF_ZRANGE|USE_REVERSE_DEPTHBUFFER|USE_EXACT_SRGB_CONVERSIONS)\s*/g,'').trim())fail();
      let locations=gpuPrograms.get(program);if(!locations){locations=new Map();gpuPrograms.set(program,locations);}
      const uniform=key=>{let loc=locations.get(key);if(loc===undefined){loc=gl.getUniformLocation(program,key);locations.set(key,loc);}if(loc===null)fail();return gl.getUniform(program,loc);};
      const sampler=key=>{const unit=uniform(key);if(!Number.isInteger(unit)||unit<0||unit>=16)fail();const active=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0+unit);
        try{if(gl.getParameter(gl.SAMPLER_BINDING)!==null)fail();return {handle:gl.getParameter(gl.TEXTURE_BINDING_2D),sampling:[gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER),gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER)],wrap:[gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S),gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T)]};}finally{gl.activeTexture(active);}};
      const records=sampler('gpuParticleRecords'),pair=[...gpuSystems].find(([,e])=>e.handle===records.handle);if(!pair)fail();
      const [p,e]=pair,r=p.ring,frame=sourceRenderFrame(state.scene),current=sourceCamera(state.scene),origin=vector(state.root?.[state.originKey],3);
      if(state.owned&&gpuSentFrame!==frame)invalidate('Waiting for the current source GPU render snapshot.');
      const range=Array.from(uniform('gpuParticleRange')||[]),count=r.highWater,start=r.cursor<count?r.cursor:0;
      if(!current||!origin||frame===null||p.animatedFrame!==frame||r.uploadFrom!==-1||r.wrapTo!==0||!Number.isInteger(count)||count<1||count>e.capacity||
        !Number.isInteger(r.cursor)||r.cursor<0||r.cursor>=e.capacity||args[3]!==count||range.length!==2||range[0]!==start||range[1]!==count)fail();
      for(let i=0;i<count;++i)if(!e.known[i]){gpuRecover(gl,p,e);fail();}
      for(let i=0;i<count*16;++i)if(e.bits[i]!==r.recordBits[i])fail();
      const view=Array.from(uniform('gpuParticleView')||[]),projection=Array.from(uniform('gpuParticleProjection')||[]),f=Array.from(uniform('gpuParticleFrame')||[]),params=[];
      for(let i=0;i<71;++i)params.push(...uniform('gpuParticleSystem['+i+']'));
      if(view.length!==16||projection.length!==16||f.length!==4||params.length!==284||!finite([...view,...projection,...f,...params])||
        view.some((v,i)=>v!==current.view[i])||projection.some((v,i)=>v!==current.projection[i])||uniform('gpuParticleRamp')!==params[10])fail();
      const texture=sampler('gpuParticleTexture'),ramp=sampler('gpuParticleRampTexture');
      const desc=materialTextures(gl,{diffuseTexture:p.particleTexture},false),rd=materialTextures(gl,{diffuseTexture:p.ramp||renderer.whiteRamp},false);
      if(!desc||!rd||desc.pages[0].handle!==texture.handle||rd.pages[0].handle!==ramp.handle||desc.flags&9||rd.flags&9||rd.height!==1||
        texture.sampling.some((v,i)=>v!==desc.sampling[i])||ramp.sampling.some((v,i)=>v!==rd.sampling[i]))fail();
      for(const key of ['CULL_FACE','STENCIL_TEST','SCISSOR_TEST','POLYGON_OFFSET_FILL','RASTERIZER_DISCARD','SAMPLE_ALPHA_TO_COVERAGE','SAMPLE_COVERAGE'])if(gl.isEnabled(gl[key]))fail();
      const viewport=gl.getParameter(gl.VIEWPORT),mask=gl.getParameter(gl.COLOR_WRITEMASK),depthRange=gl.getParameter(gl.DEPTH_RANGE);
      if(!viewport||viewport[0]||viewport[1]||viewport[2]!==current.width||viewport[3]!==current.height||!mask?.every(Boolean)||depthRange?.[0]!==0||depthRange?.[1]!==1)fail();
      const flags=(gl.isEnabled(gl.DEPTH_TEST)?1:0)|(gl.getParameter(gl.DEPTH_WRITEMASK)?2:0)|(gl.isEnabled(gl.BLEND)?4:0)|(effect===renderer.multiplyEffect?8:0);
      const raster=['DEPTH_FUNC','BLEND_SRC_RGB','BLEND_DST_RGB','BLEND_SRC_ALPHA','BLEND_DST_ALPHA','BLEND_EQUATION_RGB','BLEND_EQUATION_ALPHA'].map(k=>gl.getParameter(gl[k]));
      const order=selectedParticles(state.scene).indexOf(p);if(order<0)fail();
      if(e.frame!==frame){e.frame=frame;e.draws=[];}
      const pass=p.blendMode===4?e.draws.length:0;if(e.draws.length>=(p.blendMode===4?2:1)||(!!(flags&8)!==(p.blendMode===3||p.blendMode===4&&pass===0)))fail();
      // GPU draw textures use immutable native generations. Ordinary mesh texture
      // updates cannot alter a previously accepted analytic snapshot's samplers.
      desc.gpuRevision=revision(texture.handle)+':'+desc.sampling.join(':');rd.gpuRevision=revision(ramp.handle)+':'+rd.sampling.join(':');
      const snapshot={system:p,order:order*2+pass,id:sourceId(p),count,start,flags,raster,wrap:[...texture.wrap,...ramp.wrap],view,projection,f,params,
        bits:e.bits.slice(0,count*16),desc,rd,textureRevision:revision(texture.handle),rampRevision:revision(ramp.handle),current,origin,frame,at:performance.now(),utc:Date.now()};
      e.draws.push(snapshot);
    }catch(error){gpuFrame=null;invalidate(error.message);for(const e of gpuSystems.values())e.draws=[];}
  }
  function finishGpuFrame(current,renderFrame){
    if(!gpuSystems.size)return [];
    const draws=[];let slots=0;
    for(const [p,e] of gpuSystems){if(e.frame!==renderFrame||e.draws.length!==(p.blendMode===4?2:1))return null;
      for(const d of e.draws){if(d.current.camera!==current.camera||d.current.root!==current.root||d.current.flags!==current.flags||d.current.width!==current.width||d.current.height!==current.height||
        d.origin.some((v,i)=>v!==state.root[state.originKey]?.[i])||d.view.some((v,i)=>v!==current.view[i])||d.projection.some((v,i)=>v!==current.projection[i]))return null;
        draws.push(d);slots+=d.count;}}
    if(draws.length>gpuDrawLimit||slots>gpuLimit)return null;
    return draws.sort((a,b)=>a.order-b.order);
  }
  function gpuCurrent(){const scene=state.scene,gl=scene?.getEngine()?._gl;return gpuFrame&&sourceSnapshot&&gpuFrame.frame===sourceSnapshot.renderFrame&&gpuFrame.frame===sourceRenderFrame(scene)&&performance.now()-gpuFrame.at<=250&&gpuFrame.draws.every(d=>
    gpuSystems.has(d.system)&&d.current.camera===(scene.activeCamera||scene._activeCamera)&&d.current.root===state.root&&d.current.width===gl?.drawingBufferWidth&&d.current.height===gl?.drawingBufferHeight&&
    d.origin.every((v,i)=>v===state.root[state.originKey]?.[i])&&revision(d.desc.pages[0].handle)===d.textureRevision&&revision(d.rd.pages[0].handle)===d.rampRevision);}
  function gpuPacket(cameraPacket,observed=gpuFrame){
    if(!gpuCurrent())throw Error('Source GPU render snapshot is unavailable or stale.');
    const textures=new Map();for(const d of observed.draws)for(const t of [d.desc,d.rd]){if(t.width*t.height*4>8*1024*1024)throw Error('Source GPU color texture exceeds 8 MiB.');textures.set(t.pages[0].handle,t.width*t.height*4*(t.sampling[2]?2:1));}
    if([...textures.values()].reduce((n,b)=>n+b,0)>16*1024*1024)throw Error('Source GPU texture generations exceed 16 MiB.');
    const chunks=[new Uint8Array(cameraPacket)];
    for(const d of observed.draws){const texture=ensureTexture(d.desc),ramp=ensureTexture(d.rd);requestLayers(texture,[0]);requestLayers(ramp,[0]);d.texture=texture;d.ramp=ramp;
      const words=[d.id,d.order,d.count,d.start,texture,ramp,d.flags,...d.raster,...d.wrap];
      const values=[...d.view,...d.projection,...d.f,...d.params];
      const part=new ArrayBuffer(words.length*4+values.length*4+d.bits.byteLength),v=new DataView(part);let at=0;
      for(const x of words){v.setUint32(at,x,true);at+=4;}for(const x of values){v.setFloat32(at,x,true);at+=4;}new Uint8Array(part,at).set(new Uint8Array(d.bits.buffer));chunks.push(new Uint8Array(part));
    }
    const tail=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){tail.set(c,at);at+=c.length;}
    return packet(31,[state.epoch,1,cameraPacket.byteLength,observed.draws.length],[],tail);
  }
  // Experimental data only. No source update/simulation methods are invoked.
  let frameObserver=null,frameObservable=null,sourceSnapshot=null,sourceSerial=0;
  let lightObservation=null,lightSentFrame=-1;const lightProfiles=new WeakMap();
  const sameLight=(a,b)=>a===b||!!a&&!!b&&a.flags===b.flags&&a.enabled===b.enabled&&a.values.every((v,i)=>v===b.values[i]);
  function sourceLightValues(){
    const r=state.root?.vy;
    // q9aot renderer + render implementation guards; inspect text, never invoke it.
    if(!r||r.my!==state.root||r.tY!==state.scene||r.KY)return null;
    let profile=lightProfiles.get(r);if(!profile||profile.ctor!==r.constructor||profile.render!==r.render){
      profile={ctor:r.constructor,render:r.render,valid:/this\.sm=\[1,1,1\]/.test(String(r.constructor))&&/this\.pY\[0\]=/.test(String(r.render))&&/this\.tY\.render\(\)/.test(String(r.render))};lightProfiles.set(r,profile);}
    if(!profile.valid)return null;
    let flags=0,enabled=0;const values=new Array(17).fill(0);
    const bounded=(v,min,max)=>v&&v.every(x=>Number.isFinite(x)&&x>=min&&x<=max);
    if(typeof r.yy==='boolean'){flags|=1;enabled=r.yy?1:0;}
    if(enabled){
      const sky=vector(r.skyLightColourOverride??r.sm,3),ambient=vector(r.ambientLightColourOverride??r.ym,3);
      const vision=r.visionMinLightColour==null?[0,0,0]:vector(r.visionMinLightColour,3);
      if(bounded(sky,0,65504)&&bounded(ambient,0,65504)&&bounded(vision,0,65504)){
        flags|=2;for(let i=0;i<3;++i){values[i]=Math.max(sky[i],vision[i]);values[3+i]=Math.max(ambient[i],vision[i]);}}
      const color=vector(r.XY,3),pos=vector(r.pY,3),range=r.WY,cone=r.FY;
      if(bounded(color,0,15)&&bounded(pos,-16777216,16777216)&&bounded([range],0,16777216)&&bounded([cone],0,1)&&
        (cone===0||Math.abs(Math.hypot(...pos)-1)<=1e-4)){
        flags|=4;values.splice(6,8,...color,range,...pos,cone);}
    }
    const sun=vector(r.Tf,3);if(sun&&Math.abs(Math.hypot(...sun)-1)<=1e-4){flags|=8;values.splice(14,3,...sun);}
    return {flags,enabled,values:Array.from(new Float32Array(values))};
  }
  function observeSourceLight(){
    const current=sourceCamera(state.scene),frame=sourceRenderFrame(state.scene);if(!current||frame===null)return;
    const player=playerSource(state.scene,current.camera),light=sourceLightValues();
    if(!lightObservation||lightObservation.frame!==frame)lightObservation={frame,current,player,light,conflict:false,at:performance.now(),utc:Date.now()};
    const o=lightObservation;
    if(!player||!samePlayer(o.player,player)||o.current.camera!==current.camera||o.current.root!==current.root||
      o.current.width!==current.width||o.current.height!==current.height||o.current.flags!==current.flags||
      ['view','projection','position'].some(k=>o.current[k].some((v,i)=>v!==current[k][i]))||!sameLight(o.light,light))o.conflict=true;
  }
  function lightPacket(inner,snapshot){
    if(!snapshot?.light)return inner;
    const l=snapshot.light,tail=new Uint8Array(inner);
    if(inner.byteLength+104>1024*1024)throw Error('Source light transaction exceeds the shared packet limit.');
    return packet(32,[state.epoch,1,inner.byteLength,l.flags,l.enabled],l.values,tail);
  }
  const sourceIds=new WeakMap();let nextSourceId=1;
  function sourceId(value){if(!value||typeof value!=='object')return 0;let id=sourceIds.get(value);if(!id){id=nextSourceId++;sourceIds.set(value,id);}return id;}
  function sourceRenderFrame(scene){const n=scene.getFrameId?.();return Number.isInteger(n)&&n>=0&&n<=0xffffffff?n:null;}
  function playerSource(scene,camera){
    const root=state.root,e=root?.hY,r=root?.vy;
    // Pinned q9aot profile. Different obfuscations/layouts remain unknown.
    // WI establishes OI as local render feet; the position bounds start at Y.
    if(e!==root?.entities||e?.my!==root||r?.my!==root||r?.tY!==scene||r?.camera!==camera||state.originKey!=='Lj'||
      !/this\.bY=\w+\.add\(/.test(String(root?.constructor))||
      !/copy\(\w+\.OI,\w+\.vD\)/.test(String(e?.WI))||!/\w+\.Lj\?\?this\.my\.Lj/.test(String(e?.WI))||
      !/\.OI/.test(String(root.camera?.NI))||typeof e?.le!=='function')return null;
    const entity=root.bY,origin=vector(root.Lj,3);
    if(!Number.isInteger(entity)||entity<1||entity>0xffffffff||!origin||origin.some(v=>Math.abs(v)>2**52))return null;
    const eyeId=root.camera.cI;if(!Number.isInteger(eyeId)||eyeId<1||eyeId>0xffffffff||eyeId===entity)return null;
    const feet=e.le(entity),eye=e.le(eyeId),attachment=e.kI?.(eyeId);
    if(!feet||!eye||attachment?.CD!==entity)return null;
    const feetOrigin=feet.Lj==null?origin:vector(feet.Lj,3),eyeOrigin=eye.Lj==null?origin:vector(eye.Lj,3);
    if(!feetOrigin||!eyeOrigin||feetOrigin.some((v,i)=>v!==origin[i])||eyeOrigin.some((v,i)=>v!==origin[i]))return null;
    const localFeet=vector(feet.OI,3),localEye=vector(eye.OI,3);
    if(!localFeet||!localEye)return null;
    return {entity,token:sourceId(feet),eyeToken:sourceId(eye),originToken:sourceId(root.Lj),origin,
      feet:localFeet.map((v,i)=>v+origin[i]),eye:localEye.map((v,i)=>v+origin[i])};
  }
  function samePlayer(a,b){return !!a&&!!b&&a.entity===b.entity&&a.token===b.token&&a.eyeToken===b.eyeToken&&a.originToken===b.originToken&&
    ['origin','feet','eye'].every(k=>a[k].every((v,i)=>v===b[k][i]));}
  function sourceCamera(scene){
    const camera=scene.activeCamera||scene._activeCamera,engine=scene.getEngine(),gl=engine._gl;
    const view=matrixData(camera?.getViewMatrix?.()),projection=matrixData(camera?.getProjectionMatrix?.()),position=vector(camera?.globalPosition||camera?.position,3);
    if(!gl||view?.length!==16||projection?.length!==16||!finite(view)||!finite(projection)||!position||!invertibleDrawMatrix(view)||!invertibleDrawMatrix(projection))return null;
    const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,clear=vector(scene.clearColor||{r:.5,g:.65,b:.8,a:1},4);
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!clear)return null;
    return {camera,root:state.root,view:Array.from(view),projection:Array.from(projection),position,clear,width,height,
      flags:(engine.isNDCHalfZRange?1:0)|(engine._useReverseDepthBuffer?2:0)};
  }
  function observeSourceFrame(scene){
    if(frameObserver!==null)frameObservable.remove(frameObserver);frameObserver=frameObservable=null;sourceSnapshot=null;lightObservation=null;lightSentFrame=-1;
    const observable=scene?.onAfterRenderObservable;
    if(typeof observable?.add!=='function'||typeof observable.remove!=='function')return;
    frameObservable=observable;frameObserver=observable.add(()=>{
      sourceSnapshot=null;
      try{
        if(scene!==state.scene||state.stopped||scene._isInIntermediateRendering?.()===true)return;
        const gl=scene.getEngine()._gl;if(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null)return;
        const current=sourceCamera(scene),renderFrame=sourceRenderFrame(scene);if(!current||renderFrame===null)return;
        const player=playerSource(scene,current.camera);let hand=null,conflict=false;
        for(const mesh of state.active)if(observedCameraNeeded(mesh)&&(mesh.ignoreCameraMaxZ===true||mesh.sourceMesh?.ignoreCameraMaxZ===true||cameraAttached(mesh))){
          const sample=observedViews.get(mesh.sourceMesh||mesh);
          if(!sample||sample.renderFrame!==renderFrame||sample.camera!==current.camera||sample.width!==current.width||sample.height!==current.height||
            sample.halfZ!==!!(current.flags&1)||sample.reverse!==!!(current.flags&2)||sample.group<=0||!samePlayer(sample.player,player)||
            hand&&(hand.group!==sample.group||hand.values.some((v,i)=>v!==sample.values[i]))){conflict=true;break;}
          hand=sample;
        }
        sourceSnapshot={...current,player,renderFrame,hand:conflict?null:hand,revision:state.revision,at:performance.now(),utc:Date.now()};
        sourceSnapshot.emissions=[];
        for(const [id,record] of state.meshes){const e=emissionObserved.get(record.mesh);
          if(state.active.has(record.mesh)&&e?.proof&&!e.conflict&&e.frame===renderFrame&&e.current?.camera===current.camera&&samePlayer(e.player,player)&&
            e.current.width===current.width&&e.current.height===current.height&&e.current.flags===current.flags&&
            ['view','projection','position'].every(k=>e.current[k].every((v,i)=>v===current[k][i]))&&
            e.job===e.proof.job&&e.proof===record.emissionProof&&meshEmission(record.mesh,record.geometry)===e.proof){
            sourceSnapshot.emissions.push({id,sequence:record.meshSequence,proof:e.proof,job:e.job});
            sourceSnapshot.at=Math.min(sourceSnapshot.at,e.at);sourceSnapshot.utc=Math.min(sourceSnapshot.utc,e.utc);
          }
        }
        const o=lightObservation;
        if(o&&!o.conflict&&o.frame===renderFrame&&samePlayer(o.player,player)&&o.current.camera===current.camera&&o.current.root===current.root&&
          o.current.width===current.width&&o.current.height===current.height&&o.current.flags===current.flags&&
          ['view','projection','position'].every(k=>o.current[k].every((v,i)=>v===current[k][i]))&&sameLight(o.light,sourceLightValues())&&o.light){
          sourceSnapshot.light=o.light;sourceSnapshot.at=Math.min(sourceSnapshot.at,o.at);sourceSnapshot.utc=Math.min(sourceSnapshot.utc,o.utc);
        }
        const draws=finishGpuFrame(current,renderFrame);gpuFrame=draws?{frame:renderFrame,draws,at:draws.length?Math.min(...draws.map(d=>d.at)):sourceSnapshot.at}:null;
      }catch{sourceSnapshot=null;}
    });
  }
  function sourceFramePacket(current,snapshot){
    if(snapshot)current=snapshot; // Include the captured clear color, never a later camera read.
    const player=snapshot?.player,hand=snapshot?.hand;
    const words=[state.epoch,1,current.flags|(player?4|8:0)|(hand?16:0)|(snapshot?32:0),current.width,current.height,++sourceSerial,
      sourceId(current.camera),sourceId(current.root),player?.entity||0,player?.token||0,player?.originToken||0,snapshot?.renderFrame||0,hand?hand.group+1:0];
    const floats=[...current.view,...current.projection,...current.position,...current.clear];
    const doubles=[snapshot?.utc??Date.now(),snapshot?performance.now()-snapshot.at:0];
    if(player)doubles.push(...player.origin,...player.feet,...player.eye);
    // Camera/player/hand form ONE packet and one native transaction.
    const tail=new ArrayBuffer(doubles.length*8+(hand?35*4:0)),data=new DataView(tail);let at=0;
    for(const v of doubles){if(!Number.isFinite(v))throw Error('Non-finite source frame.');data.setFloat64(at,v,true);at+=8;}
    if(hand)for(const v of hand.values){data.setFloat32(at,v,true);at+=4;}
    return packet(30,words,floats,tail);
  }
  function releasePresentation(reason){
    state.owned=false;
    globalThis.__BLOXD_NATIVE_PRESENTER__?.release?.(reason);
  }
  function invalidate(reason){
    if(state.ready){state.revision=(state.revision+1)>>>0||1;state.ready=false;}
    state.reason=reason;releasePresentation(reason);
  }
  function idFor(value) { let id=meshIds.get(value);if(!id){id=state.nextId++;meshIds.set(value,id);}return id; }
  function revision(handle) { return handle ? revisions.get(handle)||0 : 0; }
  function touch(handle) { if(handle&&typeof handle==='object')revisions.set(handle,revision(handle)+1); }
  function track(proto,name,after) {
    const original=proto?.[name];if(typeof original!=='function')return;
    const wrapped=function(...args){
      const result=original.apply(this,args);
      if(name.startsWith('tex'))try{gpuWrite(this,name,args);}catch{for(const e of gpuSystems.values())e.known.fill(0);gpuFrame=null;invalidate('Source GPU upload ownership was lost.');}
      if(!state.observeWrites||!config.fixture&&this!==state.captureGL)return result;
      let s=glStates.get(this);if(!s){s={buffers:new Map(),textures:new Map(),active:this.getParameter(this.ACTIVE_TEXTURE)??this.TEXTURE0};glStates.set(this,s);}
      ++state.trackedCalls;after(this,s,args);return result;
    };
    proto[name]=wrapped;wrappers.push({proto,name,original,wrapped});
  }
  function observeWrites(enabled,gl=state.captureGL){
    if(gl!==state.captureGL||enabled!==state.observeWrites){if(state.captureGL)glStates.delete(state.captureGL);if(gl)glStates.delete(gl);
      for(const r of instanceRecords.values()){r.committed=null;r.pending=null;}}
    state.captureGL=gl;state.observeWrites=enabled;
  }
  function writtenBuffer(gl,s,target){
    if(s.buffers.has(target))return s.buffers.get(target);
    const binding=target===gl.ARRAY_BUFFER?gl.ARRAY_BUFFER_BINDING:target===gl.ELEMENT_ARRAY_BUFFER?gl.ELEMENT_ARRAY_BUFFER_BINDING:target===gl.COPY_WRITE_BUFFER?gl.COPY_WRITE_BUFFER_BINDING:null;
    const handle=binding===null?null:gl.getParameter(binding);s.buffers.set(target,handle);return handle;
  }
  // Observe writes without changing their arguments, result or ordering.
  for(const proto of [globalThis.WebGLRenderingContext?.prototype,globalThis.WebGL2RenderingContext?.prototype]) {
    track(proto,'bindBuffer',(_,s,[target,buffer])=>s.buffers.set(target,buffer));
    for(const name of ['bufferData','bufferSubData'])track(proto,name,(gl,s,[target])=>touch(writtenBuffer(gl,s,target)));
    track(proto,'copyBufferSubData',(gl,s,[,target])=>touch(writtenBuffer(gl,s,target)));
    track(proto,'activeTexture',(_,s,[unit])=>{s.active=unit;});
    track(proto,'bindTexture',(_,s,[target,texture])=>s.textures.set(`${s.active}:${target}`,texture));
    for(const name of ['texImage2D','texSubImage2D','texImage3D','texSubImage3D'])
      track(proto,name,(gl,s,args)=>{
        const target=args[0]>=34069&&args[0]<=34074?gl.TEXTURE_CUBE_MAP:args[0],key=`${s.active}:${target}`;
        let handle=s.textures.get(key);
        if(handle===undefined){const binding=target===gl.TEXTURE_2D?gl.TEXTURE_BINDING_2D:target===gl.TEXTURE_2D_ARRAY?gl.TEXTURE_BINDING_2D_ARRAY:target===gl.TEXTURE_3D?gl.TEXTURE_BINDING_3D:target===gl.TEXTURE_CUBE_MAP?gl.TEXTURE_BINDING_CUBE_MAP:null;
          handle=binding===null?null:gl.getParameter(binding);s.textures.set(key,handle);}
        if(!handle)return;touch(handle);
        const changes=textureChanges.get(handle)||[];
        changes.push({revision:revision(handle),first:name==='texSubImage3D'&&args[1]===0?args[4]:0,count:name==='texSubImage3D'&&args[1]===0?args[7]:null});
        if(changes.length>64)changes.shift();textureChanges.set(handle,changes);
      });
    for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
      const original=proto?.[name];if(typeof original!=='function')continue;
      const wrapped=function(...args){
        try{gpuObserveDraw(this,name,args);}catch{gpuFrame=null;invalidate('Source GPU draw observation failed.');}
        if(!state.owned)return original.apply(this,args);
        const source=state.captureGL;
        if(state.owned&&this===source){
          try{if(this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)===null){
            if(performance.now()-state.presentedAt>500)invalidate('Native presentation lease expired.');
            else {++state.suppressedDraws;return;}
          }}catch{invalidate('Source draw ownership could not be verified.');}
        }
        return original.apply(this,args);
      };
      proto[name]=wrapped;wrappers.push({proto,name,original,wrapped});
    }
  }
  function packet(type,words,floats=[],tail=null) {
    if(state.sequence>=0xffffffff)throw Error('Capture packet sequence exhausted.');
    const tailBytes=tail?.byteLength||0,length=words.length*4+floats.length*4+tailBytes;
    if(length>64*1024*1024)throw Error('Bridge packet exceeds 64 MiB.');
    const buffer=new ArrayBuffer(16+length),view=new DataView(buffer);
    view.setUint32(0,0x31444e42,true);view.setUint32(4,type,true);view.setUint32(8,length,true);view.setUint32(12,++state.sequence,true);
    let offset=16;for(const word of words){view.setUint32(offset,word,true);offset+=4;}
    for(const value of floats){if(!Number.isFinite(value))throw Error('Non-finite capture data.');view.setFloat32(offset,value,true);offset+=4;}
    if(tail)new Uint8Array(buffer,offset).set(new Uint8Array(tail.buffer||tail,tail.byteOffset||0,tailBytes));
    return buffer;
  }
  async function send(buffer) { await sink.send(buffer);state.bytes+=buffer.byteLength; }
  function geometry(source) {
    return source?._geometry || own(source).find(v=>v?._vertexBuffers&&(v._indices||v._indexBuffer)) || null;
  }
  function rawBuffer(vertexBuffer) {
    const buffer=vertexBuffer?.getBuffer?.()||vertexBuffer;
    return buffer?.underlyingResource||buffer?.getBuffer?.()?.underlyingResource||buffer?.getBuffer?.()||buffer?._buffer||vertexBuffer?._buffer?._buffer||null;
  }
  function instancedAttribute(buffer){return !!(buffer?.getIsInstanced?.()||buffer?.getInstanceDivisor?.()>0);}
  function vertexData(source,g,kind){
    const buffer=source.getVertexBuffer?.(kind)||g._vertexBuffers?.[kind];
    // Babylon's generic accessor can interpret instance data as vertex data and
    // request a typed-array view beyond the backing buffer. Use geometry-only
    // access for base vertices; instance attributes get their own element count.
    if(instancedAttribute(buffer))return null;
    return source.getVerticesData?.(kind,false,false,true);
  }
  function instanceData(source,g,kind,count){
    const buffer=source.getVertexBuffer?.(kind)||g._vertexBuffers?.[kind];
    if(!instancedAttribute(buffer))return null;
    const raw=buffer.getData?.(),size=buffer.getSize?.()||1;
    const available=raw?.byteLength&&buffer.byteStride?Math.floor((raw.byteLength-(buffer.byteOffset||0))/buffer.byteStride):raw?.length?Math.floor(raw.length/size):count;
    return buffer.getFloatData?.(Math.min(count,available),false)||raw||null;
  }
  function bufferSignature(g) {
    // Instance matrices and instance-light writes must not retransmit the model
    // geometry. Their own update packets track those changes separately.
    const kinds=new Set(['position','normal','uv','color','texAtlasIndices','matricesIndices','matricesWeights','matricesIndicesExtra','matricesWeightsExtra']);
    const signature=Object.entries(g?._vertexBuffers||{}).filter(([key])=>kinds.has(key)).map(([,v])=>[v,rawBuffer(v),revision(rawBuffer(v))]);
    if(g?._indexBuffer)signature.push([g._indexBuffer,rawBuffer(g._indexBuffer),revision(rawBuffer(g._indexBuffer))]);return signature;
  }
  function hash(values,count=values?.length||0){if(!values)return 0;const floats=values instanceof Float32Array?values:new Float32Array(values);const bits=new Uint32Array(floats.buffer,floats.byteOffset,Math.min(count,floats.length));let out=2166136261;for(const value of bits)out=Math.imul(out^value,16777619);return out>>>0;}
  function sameSignature(a,b){return a?.length===b.length&&b.every((v,i)=>v[0]===a[i][0]&&v[1]===a[i][1]&&v[2]===a[i][2]);}
  function materialPlugins(material){const manager=material?._pluginManager||material?.pluginManager||own(material).find(v=>Array.isArray(v?._plugins));return (manager?._activePlugins||manager?._plugins||[]).filter(p=>p.isEnabled!==false);}
  function vector(value,size){if(size===1&&Number.isFinite(value))return [value];const keys=value?.r!==undefined?['r','g','b','a']:['x','y','z','w'];const out=Array.from({length:size},(_,i)=>value?.[i]??value?.[keys[i]]);return finite(out)?out:null;}
  function appearanceContract(material,mesh=null){
    let flags=0,columns=1,rows=1,layers=0,ambient=[0,0,0],sky=[1,1,1],held=[0,0,0,0],heldPosition=[0,0,0,0],directional=[];
    const plugins=materialPlugins(material);let lighting=null,animated=null,fadeDither=false,textBias=0,enchantment=false;
    if(particleMaterials.has(material))flags|=16384;
    for(const plugin of plugins){
      const kind=plugin.getClassName?.();
      if(Array.isArray(plugin.textureAtlases)){
        if(kind&&kind!=='AtlasTextureMaterialPlugin')throw Error('Unrecognized source atlas material program '+String(kind).replace(/[^A-Za-z0-9_]/g,'').slice(0,64)+'.');
        const buffers=geometry(mesh?.sourceMesh||mesh)?._vertexBuffers;
        if(buffers?.aAtlasIdxFaces012||buffers?.aAtlasIdxFaces345)flags|=1024;
        continue;
      }
      if(kind==='LifeformMaterialPlugin'){
        ({atlasWidth:columns,atlasHeight:rows,numLayers:layers}=plugin);
        if(![columns,rows,layers].every(Number.isInteger)||columns<1||rows<1||columns>256||rows>256||layers<1||layers>8)throw Error('Unsupported Lifeform atlas dimensions/layers.');flags|=1;
      }else if(kind==='OverlayMaterialPlugin')flags|=2;
      else if(kind==='ArmourMaterialPlugin'){
        columns=plugin.numTexturesInAtlas;rows=1;layers=1;
        if(!Number.isInteger(columns)||columns<1||columns>256)throw Error('Invalid source armour atlas.');flags|=256;
      }
      else if(kind==='HueTintMaterialPlugin')flags|=512;
      else if(kind==='EnchantmentMaterialPlugin'){flags|=2048;enchantment=true;if(geometry(mesh?.sourceMesh||mesh)?._vertexBuffers?.aPosition)flags|=8192;}
      else if(kind==='TextSamplerMaterialPlugin'){textBias=plugin.lodBias;if(!Number.isFinite(textBias)||Math.abs(textBias)>16)throw Error('Invalid source text LOD bias.');flags|=4096;}
      else if(kind==='CapeMaterialPlugin')capePose(material);
      else if(kind==='DitherMaterialPlugin'){flags|=4;if(plugin.ignoreTextureAlpha)flags|=128;}
      else if(kind==='TerrainFadeMaterialPlugin'){flags|=8;fadeDither=!plugin.ditherOnlyWhileFading||plugin.prewarmingDither===true||(mesh?.visibility??1)<1;}
      else if(kind==='EntityLightMaterialPlugin'){flags|=16;lighting=plugin;}
      else if(kind==='TerrainLightMaterialPlugin'){flags|=32;lighting=plugin;}
      else if(kind==='AnimatedMaterialPlugin')animated=plugin;
      else throw Error('Source material plugin '+String(kind||'unknown').replace(/[^A-Za-z0-9_]/g,'').slice(0,64)+' is not implemented.');
    }
    if((flags&1)&&(flags&256))throw Error('Combined Lifeform/Armour atlas is not implemented.');
    if(lighting){
      const renderer=lighting.vy||lighting.renderer;
      if(typeof renderer?.yy!=='boolean')throw Error('Source plugin lighting state is unavailable.');
      if(renderer.yy){
        flags|=64;
        sky=vector(renderer.skyLightColourOverride??renderer.sm,3);ambient=vector(renderer.ambientLightColourOverride??renderer.ym,3);
        held=vector(renderer.XY,3);heldPosition=vector(renderer.pY,3);
        if(!sky||!ambient||!held||!heldPosition||!Number.isFinite(renderer.WY)||!Number.isFinite(renderer.FY))throw Error('Source plugin light uniforms are unavailable.');
        const vision=renderer.visionMinLightColour&&vector(renderer.visionMinLightColour,3);if(renderer.visionMinLightColour&&!vision)throw Error('Invalid source vision light.');
        if(vision){sky=sky.map((v,i)=>Math.max(v,vision[i]));ambient=ambient.map((v,i)=>Math.max(v,vision[i]));}
        held.push(renderer.WY);heldPosition.push(renderer.FY);
      }
      if(flags&32){
        const count=lighting.dirLightCount??0,lights=lighting.dirLightWriter?.lights||renderer.rm||[];
        if(!Number.isInteger(count)||count<0||count>4||lights.length<count)throw Error('Unsupported source directional-light contract.');
        const source=mesh?.sourceMesh||mesh,hasNormals=!mesh||!!geometry(source)?._vertexBuffers?.normal;
        for(const light of lights.slice(0,hasNormals?count:0)){
          const direction=vector(light.parent?light.transformedDirection:light.direction,3),color=vector(light.HY||light.diffuse,3),intensity=light.getScaledIntensity?.()??light.intensity;
          if(!direction||!color||color[0]!==color[1]||color[1]!==color[2]||!Number.isFinite(intensity)||intensity<0)throw Error('Source terrain directional light is unavailable.');
          const length=Math.hypot(...direction);directional.push(...direction.map(v=>length?-v/length:0),light.isEnabled?.()===false||renderer.tY?.lightsEnabled===false?0:color[0]*intensity);
        }
      }
    }
    const visibility=flags&8?(mesh?.visibility??1):1,fadeAlpha=fadeDither?visibility*(material.alpha??1):1;
    const values=[...ambient,...sky,...held,...heldPosition,visibility,fadeAlpha,...directional];
    if(!finite(values)||[...ambient,...sky,...held].some(v=>v<0))throw Error('Invalid source lighting values.');
    const uniformLight=lighting?.uniformLevels&&vector(lighting.uniformLevels,4);
    if(lighting?.uniformLevels&&!uniformLight)throw Error('Invalid source entity light.');
    let animation=null;
    if(animated){const tick=animated.animTicker?.getAnimTick?.(),states=animated.numAnimStates,stride=animated.ticksPerAnimState;
      if(!Number.isFinite(tick)||!Number.isInteger(states)||states<1||states>4096||!Number.isFinite(stride)||stride<1)throw Error('Source animated texture state is unavailable.');animation={states,frame:Math.floor(tick/stride)%states};}
    const ubo=material._uniformBuffer,location=ubo?._uniformLocations?.uAnimTick;
    const boundTick=Number.isInteger(location)&&location>=0?ubo.getData?.()?.[location]??ubo._bufferData?.[location]:null;
    const tick=enchantment?(Number.isFinite(boundTick)?boundTick:performance.now()):0;
    if(!Number.isFinite(tick)||Math.abs(tick)>1e12)throw Error('Invalid source enchantment clock.');
    const pivot=particleMaterials.has(material)?vector(material.particleSource.translationPivot,2)||[0,0]:[0,0];
    return {flags,columns,rows,layers,values,uniformLight,animation,special:[tick,textBias,...pivot],key:[flags,columns,rows,layers,...values].join(':')};
  }
  function appearanceAttributes(mesh,source,g,contract,count,vertexMap,instances=false){
    const stride=contract.flags&2048?36:contract.flags>255?24:20;
    const attributes=new Map();
    function read(kind,size,required){
      let values=instances?instanceData(source,g,kind,count):vertexData(source,g,kind);
      if(!values){const value=mesh.instancedBuffers?.[kind]??mesh.Ge?.[kind]??mesh.Wq?.[kind]??source.instancedBuffers?.[kind]??source.Ge?.[kind]??source.Wq?.[kind];const constant=vector(value,size);if(constant)values={constant};}
      if(!values&&required)throw Error('Source appearance attribute '+kind+' is unavailable.');
      if(values&&!values.constant&&values.length<(instances?count:source.getTotalVertices?.())*size)throw Error('Source appearance attribute '+kind+' is incomplete.');
      attributes.set(kind,{values,size});
    }
    if(contract.flags&1)for(let group=1;group<=Math.ceil(contract.layers/4);++group)read('aAtlasIdx'+group,4,true);
    if(contract.flags&2)read('aOverlayColour',4,true);
    if(contract.flags&4)read('aOpacity',1,true);
    if(contract.flags&16&&!contract.uniformLight)read('aLightLevels',4,true);
    if(contract.flags&256){read('aAtlasIdx1',1,true);read('aArmourTint',3,true);}
    if(contract.flags&512)read('aHueColour',4,true);
    if(contract.flags&1024){read('aAtlasIdxFaces012',3,true);read('aAtlasIdxFaces345',3,true);}
    if(contract.flags&2048){read('aEnchantmentColour',3,true);read('aEnchantmentSpeed',1,true);}
    if(contract.flags&8192){read('aPosition',3,true);read('aRotation',3,true);read('aOffset',3,true);}
    const data=new Float32Array(count*stride);
    for(let v=0;v<count;++v){const at=v*stride,s=vertexMap?.[v]??v;data[at+16]=1;data.fill(-1,at+12,at+16);
      for(const [kind,{values,size}] of attributes){if(!values)continue;if(kind==='aRotation'){data[at+31]=values.constant?.[1]??values[s*size+1];continue;}
        const offset=kind==='aEnchantmentColour'?24:kind==='aEnchantmentSpeed'?27:kind==='aPosition'?28:kind==='aOffset'?32:kind==='aAtlasIdxFaces012'?0:kind==='aAtlasIdxFaces345'?3:kind==='aArmourTint'?17:kind==='aHueColour'?20:kind.startsWith('aAtlasIdx')?(Number(kind.slice(9))-1)*4:kind==='aOverlayColour'?8:kind==='aLightLevels'?12:16;
        for(let i=0;i<size;++i)data[at+offset+i]=values.constant?.[i]??values[s*size+i];}
      if(contract.uniformLight)data.set(contract.uniformLight,at+12);
      if(contract.flags&(1|256))for(let i=0;i<contract.layers;++i)if(!Number.isInteger(data[at+i])||data[at+i]<0||data[at+i]>=contract.columns*contract.rows)throw Error('Lifeform/Armour atlas index is outside its actual tile grid.');
      if(contract.flags&1024)for(let i=0;i<6;++i)if(!Number.isInteger(data[at+i])||data[at+i]<0||data[at+i]>2047)throw Error('Invalid per-face atlas index.');
      if(contract.flags&256&&Array.from(data.subarray(at+17,at+20)).some(x=>x<0||x>1)||contract.flags&512&&Array.from(data.subarray(at+20,at+24)).some(x=>x<0||x>1))throw Error('Invalid armour/hue colour.');
      if(contract.flags&2048&&(Array.from(data.subarray(at+24,at+27)).some(x=>x<0||x>1)||Math.abs(data[at+27])>1024))throw Error('Invalid source enchantment attributes.');
      if(data[at+16]<0||data[at+16]>1||Array.from(data.subarray(at+8,at+12)).some(x=>x<0||x>1)||contract.flags&16&&Array.from(data.subarray(at+12,at+16)).some(x=>x<0||x>1))throw Error('Invalid entity opacity/overlay/light values.');
    }
    if(!finite(data))throw Error('Invalid source appearance values.');return data;
  }
  function findScene(api) {
    const roots=own(api?.singletons).filter(v=>v?.container&&v?.inputs);
    const scenes=new Set();for(const root of roots)for(const renderer of own(root))for(const scene of own(renderer))
      if(Array.isArray(scene?.meshes)&&Array.isArray(scene?.materials)&&scene.onAfterRenderObservable&&scene.getEngine)scenes.add(scene);
    if(scenes.size===1){const scene=[...scenes][0];state.root=roots.find(root=>own(root).some(renderer=>own(renderer).includes(scene)));return scene;}return null;
  }
  const originalDefine=Object.defineProperty;
  let restored=false,releaseHost=null;
  function restoreCapture(){if(restored)return;restored=true;releaseHost?.();if(Object.defineProperty===interceptedDefine)Object.defineProperty=originalDefine;}
  function interceptedDefine(target,key,descriptor){
    const result=originalDefine.call(this,target,key,descriptor);
    if(key==='singletons')queueMicrotask(()=>{if(typeof target?.getBloxd==='function'){state.api=target;restoreCapture();state.phase='waiting-scene';}});
    return result;
  }
  if(globalThis.__BLOXD_MOD_HOST__?.onEngine){releaseHost=globalThis.__BLOXD_MOD_HOST__.onEngine(api=>{state.api=api;state.phase='waiting-scene';restoreCapture();});if(state.api)releaseHost?.();}
  else Object.defineProperty=interceptedDefine;
  const captureTimeout=setTimeout(()=>{restoreCapture();if(!state.api)state.phase='engine-not-found';},45000);
  function textureHandle(gl,texture){
    const internal=texture?.getInternalTexture?.()||texture?._texture||texture;
    const hardware=internal?._hardwareTexture||internal?.hardwareTexture;
    const handle=hardware?.underlyingResource||hardware?._webGLTexture||internal?._webGLTexture;
    if(!handle)return null;
    if(!verifiedTextures.has(handle)){if(!gl.isTexture(handle))return null;verifiedTextures.add(handle);}
    const size=internal.width&&internal.height?null:texture?.getSize?.();
    const width=internal.width||size?.width,height=internal.height||size?.height;
    const array=!!internal.is2DArray,cube=!!internal.isCube,layers=array?(internal.depth||size?.depth):cube?6:1;
    if(!width||!height||!layers)return null;
    const mode=internal.samplingMode??texture.samplingMode??1,mips=internal.useMipMaps===true||internal.generateMipMaps===true;
    const filters={1:[9728,9728],2:[9729,9729],3:[mips?9987:9729,9729],4:[mips?9984:9728,9728],5:[mips?9985:9729,9728],6:[mips?9987:9729,9728],7:[9729,9728],8:[mips?9986:9728,9728],9:[mips?9984:9728,9729],10:[mips?9986:9728,9729],11:[mips?9985:9729,9729],12:[9728,9729]};
    if(!Number.isInteger(mode)||!filters[mode])throw Error('Unsupported source texture sampling mode.');
    return {handle,internal,width,height,layers,array,cube,sampling:[...filters[mode],filters[mode][0]>=9984?1:0],srgb:internal._useSRGBBuffer===true};
  }
  function materialTextures(gl,material,hasLayers,sky=false){
    const plugin=materialPlugins(material).find(v=>Array.isArray(v?.textureAtlases));
    if(plugin&&hasLayers){
      const pages=plugin.textureAtlases.map((t,i)=>{
        const page=textureHandle(gl,t),used=plugin.imagesPerAtlas?.[i];
        if(page&&used!==undefined){if(!Number.isInteger(used)||used<1||used>page.layers)throw Error('Invalid block atlas page range.');return {...page,layers:used};}
        return page;
      });
      if(!pages.length||pages.some(t=>!t))return null;
      if(pages.some(t=>!t.array||t.width!==pages[0].width||t.height!==pages[0].height||t.srgb!==pages[0].srgb||t.sampling.join(':')!==pages[0].sampling.join(':')))throw Error('Unsupported mixed or WebGL1 block atlas.');
      let animation=null;
      if(plugin.animDataPerTex){const params=Array.from(plugin.animDataPerTex),tick=plugin.animTicker?.getAnimTick?.(),stride=plugin.animData?.y??plugin.animData?.[1];
        if(!params.length||params.length%3||params.length>2049*3||!finite(params)||!Number.isFinite(tick)||tick<0||!Number.isFinite(stride)||stride<=0)throw Error('Invalid source atlas animation.');
        const total=pages.reduce((n,p)=>n+p.layers,0);
        for(let i=0;i<params.length;i+=3)if(!Number.isInteger(params[i])||params[i]<0||!Number.isInteger(params[i+1])||params[i+1]<0||params[i+2]<0||params[i]>0&&params[i+1]+params[i]>total)throw Error('Animated atlas range exceeds its source texture.');
        animation={params,tick,stride,key:[tick,stride,...params].join(':'),layout:[stride,...params].join(':')};
      }
      return {key:plugin,pages,width:pages[0].width,height:pages[0].height,layers:pages.reduce((n,p)=>n+p.layers,0),flags:7|(pages[0].srgb?16:0),sampling:pages[0].sampling,animation};
    }
    if(material?.subMaterials)throw Error('Multi-material meshes need a separate submesh adapter.');
    // Active textures also contain normal/emissive/plugin maps; they are not
    // interchangeable with the material's color texture.
    const candidates=[sky?material?.reflectionTexture:null,material?.diffuseTexture,material?.albedoTexture].filter(Boolean);
    let texture=null;for(const candidate of candidates){const data=textureHandle(gl,candidate);if(data&&(!data.cube||sky)&&!data.internal.is3D){texture={key:candidate,pages:[data],width:data.width,height:data.height,layers:data.layers,flags:(data.cube?12:(data.array?1:0)|6)|(data.srgb?16:0),sampling:data.sampling};break;}}
    return texture;
  }
  function ensureTexture(descriptor){
    if(!descriptor)return 0;
    if(descriptor.width>8192||descriptor.height>8192||descriptor.layers>2048||descriptor.width*descriptor.height*descriptor.layers*4>256*1024*1024)throw Error('Texture exceeds bridge dimensions or memory budget.');
    if(descriptor.sampling[2]){let w=descriptor.width,h=descriptor.height,bytes=w*h*descriptor.layers*4;while(w>1||h>1){w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));bytes+=w*h*descriptor.layers*4;}if(bytes>256*1024*1024)throw Error('Source texture mip chain exceeds the native memory budget.');}
    // Material plugins can be cloned while their actual atlas handles are shared.
    // Export that shared GPU resource once, not once per material/plugin object.
    let keys=textureKeys.get(descriptor.pages[0].handle);
    if(!keys){keys=[];textureKeys.set(descriptor.pages[0].handle,keys);}
    let key=keys.find(k=>k.gpuRevision===descriptor.gpuRevision&&k.width===descriptor.width&&k.height===descriptor.height&&k.layers===descriptor.layers&&k.flags===descriptor.flags&&k.handles.length===descriptor.pages.length&&k.handles.every((h,i)=>h===descriptor.pages[i].handle));
    if(!key){key={gpuRevision:descriptor.gpuRevision,width:descriptor.width,height:descriptor.height,layers:descriptor.layers,flags:descriptor.flags,handles:descriptor.pages.map(p=>p.handle)};keys.push(key);}
    // Only the current immutable generation needs a retained lookup key.
    if(descriptor.gpuRevision!==undefined)textureKeys.set(descriptor.pages[0].handle,keys.filter(k=>k.gpuRevision===undefined||k===key));
    let id=state.textureIds.get(key);if(!id){id=state.nextId++;state.textureIds.set(key,id);}
    const signature=descriptor.pages.map(p=>[p.handle,revision(p.handle)]),old=state.textures.get(id);
    if(!old){
      const texture={...descriptor,id,signature,loaded:new Set(),required:new Set(),queued:new Set(),inFlight:new Set(),complete:!config.fixture};
      state.textures.set(id,texture);
      if(config.fixture)for(let layer=0;layer<texture.layers;++layer){texture.required.add(layer);texture.queued.add(layer);}
    }else{
      let offset=0;
      for(let page=0;page<signature.length;++page){
        const previous=old.signature[page][1],current=signature[page][1];
        if(previous!==current){
          const changes=(textureChanges.get(signature[page][0])||[]).filter(c=>c.revision>previous);
          const full=!changes.length||changes[0].revision!==previous+1||changes.some(c=>c.count===null);
          for(const layer of old.required){const local=layer-offset;
            if(local>=0&&local<descriptor.pages[page].layers&&(full||changes.some(c=>local>=c.first&&local<c.first+c.count))){old.loaded.delete(layer);old.queued.add(layer);}
          }
        }
        offset+=descriptor.pages[page].layers;
      }
      old.signature=signature;old.sampling=descriptor.sampling;old.animation=descriptor.animation;old.complete=[...old.required].every(layer=>old.loaded.has(layer));
    }
    return id;
  }
  async function syncTextureSampling(id){
    const texture=state.textures.get(id);if(!texture)return;const key=texture.sampling.join(':');
    if(texture.sentSampling!==key){invalidate('Native texture sampling is being updated.');await renderControl();
      await send(packet(21,[state.epoch,id,...texture.sampling]));texture.sentSampling=key;}
    const animation=texture.animation,animationKey=animation?.key||'none';
    if(texture.sentAnimation!==animationKey&&(animation||texture.sentAnimation)){
      const layout=animation?.layout||'none';if(texture.sentAnimationLayout!==layout){invalidate('Native atlas animation layout is being updated.');await renderControl();}
      await send(packet(23,[state.epoch,id,(animation?.params.length||0)/3],animation?[animation.tick,animation.stride,...animation.params]:[0,1]));texture.sentAnimation=animationKey;
      texture.sentAnimationLayout=layout;
    }
  }
  function requestLayers(id,values){
    const texture=state.textures.get(id);if(!texture)return;
    const requested=new Set(values?.length?values:[0]);
    if(texture.animation){const params=texture.animation.params;for(const value of [...requested]){const at=3*Math.min(params.length/3-1,Math.floor(value));for(let frame=0;frame<(params[at]||0);++frame)requested.add(params[at+1]+frame);}}
    for(const value of requested){const layer=Math.round(value);if(layer<0||layer>=texture.layers||!Number.isFinite(layer))continue;
      texture.required.add(layer);if(!texture.loaded.has(layer)&&!texture.inFlight.has(layer))texture.queued.add(layer);
    }
    texture.complete=[...texture.required].every(layer=>texture.loaded.has(layer));
  }
  function readLayers(gl,page,first,count){
    const saved={read:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),draw:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),readBuffer:gl.getParameter(gl.READ_BUFFER),pack:gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),align:gl.getParameter(gl.PACK_ALIGNMENT),row:gl.getParameter(gl.PACK_ROW_LENGTH),skipRows:gl.getParameter(gl.PACK_SKIP_ROWS),skipPixels:gl.getParameter(gl.PACK_SKIP_PIXELS)};
    const fbo=gl.createFramebuffer(),pixels=new Uint8Array(page.width*page.height*count*4),sliceSize=page.width*page.height*4;
    try{
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,fbo);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
      gl.pixelStorei(gl.PACK_ALIGNMENT,1);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);
      for(let layer=0;layer<count;++layer){
        if(page.array)gl.framebufferTextureLayer(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,page.handle,0,first+layer);
        else gl.framebufferTexture2D(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,page.cube?gl.TEXTURE_CUBE_MAP_POSITIVE_X+first+layer:gl.TEXTURE_2D,page.handle,0);
        gl.readBuffer(gl.COLOR_ATTACHMENT0);
        if(gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Cannot read source albedo framebuffer.');
        gl.readPixels(0,0,page.width,page.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels.subarray(layer*sliceSize,(layer+1)*sliceSize));
      }
      return pixels;
    }finally{
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.read);gl.readBuffer(saved.readBuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,saved.draw);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER,saved.pack);gl.pixelStorei(gl.PACK_ALIGNMENT,saved.align);gl.pixelStorei(gl.PACK_ROW_LENGTH,saved.row);gl.pixelStorei(gl.PACK_SKIP_ROWS,saved.skipRows);gl.pixelStorei(gl.PACK_SKIP_PIXELS,saved.skipPixels);gl.deleteFramebuffer(fbo);
    }
  }
  function beginRead(gl,page,first,count){
    const saved={read:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),draw:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),readBuffer:gl.getParameter(gl.READ_BUFFER),pack:gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),align:gl.getParameter(gl.PACK_ALIGNMENT),row:gl.getParameter(gl.PACK_ROW_LENGTH),skipRows:gl.getParameter(gl.PACK_SKIP_ROWS),skipPixels:gl.getParameter(gl.PACK_SKIP_PIXELS)};
    const pixelBytes=page.integer?16:4,fbo=gl.createFramebuffer(),buffer=gl.createBuffer(),size=page.width*page.height*count*pixelBytes;let sync=null;
    try{
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,fbo);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);gl.bufferData(gl.PIXEL_PACK_BUFFER,size,gl.STREAM_READ);
      gl.pixelStorei(gl.PACK_ALIGNMENT,1);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);
      for(let layer=0;layer<count;++layer){
        if(page.array)gl.framebufferTextureLayer(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,page.handle,0,first+layer);
        else gl.framebufferTexture2D(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,page.cube?gl.TEXTURE_CUBE_MAP_POSITIVE_X+first+layer:gl.TEXTURE_2D,page.handle,0);
        gl.readBuffer(gl.COLOR_ATTACHMENT0);
        if(gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Cannot queue source albedo framebuffer.');
        gl.readPixels(0,0,page.width,page.height,page.integer?gl.RGBA_INTEGER:gl.RGBA,page.integer?gl.UNSIGNED_INT:gl.UNSIGNED_BYTE,layer*page.width*page.height*pixelBytes);
      }
      sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw Error('Cannot create texture readback fence.');gl.flush();
      return {gl,buffer,sync,size};
    }catch(error){if(sync)gl.deleteSync(sync);gl.deleteBuffer(buffer);throw error;}
    finally{
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.read);gl.readBuffer(saved.readBuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,saved.draw);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER,saved.pack);gl.pixelStorei(gl.PACK_ALIGNMENT,saved.align);gl.pixelStorei(gl.PACK_ROW_LENGTH,saved.row);gl.pixelStorei(gl.PACK_SKIP_ROWS,saved.skipRows);gl.pixelStorei(gl.PACK_SKIP_PIXELS,saved.skipPixels);gl.deleteFramebuffer(fbo);
    }
  }
  function releaseRead(job){job.gl.deleteSync(job.sync);job.gl.deleteBuffer(job.buffer);}
  function staleRead(job){
    const current=revision(job.texture.pages[job.pageIndex].handle);if(current===job.revision)return false;
    const changes=(textureChanges.get(job.texture.pages[job.pageIndex].handle)||[]).filter(c=>c.revision>job.revision);
    return !changes.length||changes[0].revision!==job.revision+1||changes.some(c=>c.count===null||c.first<job.localFirst+job.count&&c.first+c.count>job.localFirst);
  }
  async function deliverRead(texture,first,count,pixels){
    await send(packet(4,[state.epoch,texture.id,texture.width,texture.height,texture.layers,first,count,texture.flags],[],pixels));++state.textureChunks;
    for(let layer=first;layer<first+count;++layer){texture.loaded.add(layer);texture.inFlight.delete(layer);texture.queued.delete(layer);}
    texture.complete=[...texture.required].every(layer=>texture.loaded.has(layer));
  }
  async function pumpTextures(gl){
    const start=performance.now();let bytes=0;
    for(const job of [...state.textureJobs]){
      const result=job.gl.clientWaitSync(job.sync,0,0);if(result===job.gl.TIMEOUT_EXPIRED)continue;
      state.textureJobs.splice(state.textureJobs.indexOf(job),1);
      try{
        if(result===job.gl.WAIT_FAILED)throw Error('Texture readback fence failed.');
        if(staleRead(job)){for(let layer=job.first;layer<job.first+job.count;++layer){job.texture.inFlight.delete(layer);job.texture.queued.add(layer);}continue;}
        const saved=job.gl.getParameter(job.gl.PIXEL_PACK_BUFFER_BINDING),pixels=new Uint8Array(job.size),readAt=performance.now();
        try{job.gl.bindBuffer(job.gl.PIXEL_PACK_BUFFER,job.buffer);job.gl.getBufferSubData(job.gl.PIXEL_PACK_BUFFER,0,pixels);}finally{job.gl.bindBuffer(job.gl.PIXEL_PACK_BUFFER,saved);}
        state.textureReadMs=performance.now()-readAt;state.maxTextureReadMs=Math.max(state.maxTextureReadMs,state.textureReadMs);
        await deliverRead(job.texture,job.first,job.count,pixels);bytes+=pixels.byteLength;
      }catch(error){for(let layer=job.first;layer<job.first+job.count;++layer){job.texture.inFlight.delete(layer);job.texture.queued.add(layer);}throw error;}
      finally{releaseRead(job);}
      if(bytes>=512*1024||performance.now()-start>=4)return;
    }
    const asyncRead=!config.fixture&&['createBuffer','bufferData','fenceSync','clientWaitSync','getBufferSubData'].every(name=>typeof gl[name]==='function');
    state.readbackMode=asyncRead?'gpu-async':config.fixture?'synchronous-fixture':'synchronous-fallback';
    for(const texture of state.textures.values()){
      if(texture.complete||!texture.queued.size)continue;
      do{
      if(asyncRead&&state.textureJobs.length+gpuReads.length>=3)return;
      const first=[...texture.queued].filter(layer=>!texture.inFlight.has(layer)).sort((a,b)=>a-b)[0];if(first===undefined)continue;
      let pageIndex=0,offset=0;while(first>=offset+texture.pages[pageIndex].layers){offset+=texture.pages[pageIndex++].layers;}
      const page=texture.pages[pageIndex],localFirst=first-offset,limit=Math.max(1,Math.min(16,Math.floor(128*1024/(texture.width*texture.height*4))));
      let count=1;while(count<limit&&localFirst+count<page.layers&&texture.queued.has(first+count)&&!texture.inFlight.has(first+count))++count;
      const readAt=performance.now();
      if(asyncRead){const job=beginRead(gl,page,localFirst,count);Object.assign(job,{texture,first,count,localFirst,pageIndex,revision:revision(page.handle)});state.textureJobs.push(job);for(let layer=first;layer<first+count;++layer)texture.inFlight.add(layer);}
      else{const pixels=readLayers(gl,page,localFirst,count);await deliverRead(texture,first,count,pixels);bytes+=pixels.byteLength;}
      state.textureReadMs=performance.now()-readAt;state.maxTextureReadMs=Math.max(state.maxTextureReadMs,state.textureReadMs);
      if(bytes>=512*1024||performance.now()-start>=4)return;
      }while(asyncRead&&[...texture.queued].some(layer=>!texture.inFlight.has(layer)));
    }
  }
  function indicesFor(source,g){
    const indices=g?._indices||source.getIndices?.();
    if(indices?.length)return new Uint32Array(indices);
    if(source.getTotalIndices?.()>0)throw Error('Indexed mesh has no readable index buffer.');
    const count=source.getTotalVertices?.()||0;return Uint32Array.from({length:count},(_,i)=>i);
  }
  function poseVertices(source,positions,normals,bones){
    if(!source.skeleton)return {positions,normals};
    const indices=source.getVerticesData?.('matricesIndices'),weights=source.getVerticesData?.('matricesWeights');
    if(!bones||!indices||!weights)throw Error('Skinning matrices/weights are not readable.');
    if(indices.length!==positions.length/3*4||weights.length!==indices.length)throw Error('Skinning attribute counts differ.');
    const out=new Float32Array(positions.length),normalOut=normals?new Float32Array(normals.length):null;
    const extraIndices=source.getVerticesData?.('matricesIndicesExtra'),extraWeights=source.getVerticesData?.('matricesWeightsExtra');
    if(extraIndices&&extraWeights&&(extraIndices.length!==indices.length||extraWeights.length!==weights.length))throw Error('Extra skinning attribute counts differ.');
    for(let v=0;v<positions.length/3;++v){
      let total=0;for(let slot=0;slot<(extraIndices&&extraWeights?8:4);++slot){const ids=slot<4?indices:extraIndices,ws=slot<4?weights:extraWeights,weight=ws[v*4+slot%4]??0;if(!Number.isFinite(weight)||weight<0)throw Error('Invalid skinning weight.');if(!weight)continue;const index=ids[v*4+slot%4],at=index*16;if(!Number.isInteger(index)||index<0||at+15>=bones.length)throw Error('Bone matrix index is outside the pose.');total+=weight;
        for(let axis=0;axis<3;++axis){out[v*3+axis]+=weight*(bones[at+axis]*positions[v*3]+bones[at+4+axis]*positions[v*3+1]+bones[at+8+axis]*positions[v*3+2]+bones[at+12+axis]);if(normalOut)normalOut[v*3+axis]+=weight*(bones[at+axis]*normals[v*3]+bones[at+4+axis]*normals[v*3+1]+bones[at+8+axis]*normals[v*3+2]);}}
      if(!total){out.set(positions.subarray?positions.subarray(v*3,v*3+3):positions.slice(v*3,v*3+3),v*3);if(normalOut)normalOut.set(normals.slice(v*3,v*3+3),v*3);}
    }
    return {positions:out,normals:normalOut};
  }
  function capePose(material){
    const plugin=materialPlugins(material).find(p=>p.getClassName?.()==='CapeMaterialPlugin');if(!plugin)return null;
    const count=plugin.skeleLen,maxY=Number(plugin._defines?.BLOXD_CAPE_MAX_Y),joints=plugin.skele;
    if(!Number.isInteger(count)||count<1||count>256||!joints||joints.length!==count*3||!finite(joints)||!Number.isFinite(maxY))throw Error('Source cape pose/defines are unavailable.');
    return {count,maxY,joints,key:maxY+':'+hash(joints)};
  }
  function deformation(source,material=source.material){
    const bones=source.skeleton?.getTransformMatrices?.(source);
    if(source.skeleton&&(!bones?.length||bones.length%16||!finite(bones)))throw Error('Invalid skinning pose.');
    const manager=source.morphTargetManager,targets=[];
    if(manager){
      if(!Number.isInteger(manager.numTargets)||manager.numTargets<0||manager.numTargets>256)throw Error('Invalid morph target count.');
      for(let i=0;i<manager.numTargets;++i){const target=manager.getTarget?.(i);if(!target||!Number.isFinite(target.influence))throw Error('Invalid morph target influence.');
        if(target.influence!==0)targets.push({influence:target.influence,positions:target.getPositions?.(),normals:manager.enableNormalMorphing===false?null:target.getNormals?.(),uv:manager.enableUVMorphing===false?null:target.getUVs?.()});}
    }
    const cape=capePose(material);if(cape&&source.skeleton)throw Error('Combined source cape/bone deformation is not implemented.');
    return {bones,targets,cape,key:`${hash(bones)}:${targets.map(t=>[t.influence,hash(t.positions),hash(t.normals),hash(t.uv)].join(':')).join(';')}:${cape?.key||''}`};
  }
  function deformedGeometry(source,g,pose){
    const base=vertexData(source,g,'position'),baseNormals=vertexData(source,g,'normal'),baseUV=vertexData(source,g,'uv');
    if(!base?.length||base.length%3||base.length/3>1000000)throw Error('Invalid mesh vertex count.');
    if(baseNormals&&baseNormals.length!==base.length||baseUV&&baseUV.length!==base.length/3*2)throw Error('Mesh attribute counts differ.');
    let positions=base,normals=baseNormals,uv=baseUV;
    if(pose.targets.length){
      positions=new Float32Array(base);normals=baseNormals?new Float32Array(baseNormals):null;uv=baseUV?new Float32Array(baseUV):null;
      for(const target of pose.targets)for(const [kind,original,out] of [['positions',base,positions],['normals',baseNormals,normals],['uv',baseUV,uv]]){
        const values=target[kind];if(!values)continue;if(!original||values.length!==original.length||!finite(values))throw Error('Morph target vertex count or values differ.');
        for(let i=0;i<out.length;++i)out[i]+=(values[i]-original[i])*target.influence;
      }
    }
    if(pose.cape){positions=new Float32Array(positions);const {count,maxY,joints}=pose.cape;
      for(let v=0;v<positions.length;v+=3){let bone=Math.trunc(maxY-positions[v+1]);if(bone<0||bone>=count-1)bone=count-1;const at=bone*3,angle=joints[at],pivot=base[v+2];
        positions[v+1]+=joints[at+1]-Math.sin(angle)*pivot;positions[v+2]+=joints[at+2]+(Math.cos(angle)-1)*pivot;}}
    const posed=poseVertices(source,positions,normals,pose.bones);return {...posed,uv};
  }
  function drawParts(mesh,source,g){
    const material=mesh.material||source.material;
    const submeshes=mesh.subMeshes?.length?mesh.subMeshes:source.subMeshes;
    if(!material?.subMaterials&&(!submeshes?.length||submeshes.length===1&&submeshes[0].indexStart===0&&submeshes[0].indexCount===(g._indices||source.getIndices?.())?.length))return [{key:mesh,material,indexStart:0,indexCount:null}];
    if(!submeshes?.length)throw Error('Multi-material mesh has no submesh ranges.');
    let keys=partKeys.get(mesh);if(!keys){keys=[];partKeys.set(mesh,keys);}
    const count=(g._indices||source.getIndices?.())?.length||source.getTotalVertices?.()||0;
    return submeshes.map((part,i)=>{
      const {indexStart,indexCount,materialIndex}=part;
      if(!Number.isInteger(indexStart)||indexStart<0||!Number.isInteger(indexCount)||indexCount<0||indexCount%3||indexStart+indexCount>count||material?.subMaterials&&(!Number.isInteger(materialIndex)||materialIndex<0||materialIndex>=material.subMaterials.length))throw Error('Invalid submesh index/material range.');
      keys[i]||={};return {key:keys[i],material:material?.subMaterials?material.subMaterials[materialIndex]:material,indexStart,indexCount};
    }).filter(part=>part.indexCount>0);
  }
  function worldLayout(){
    const now=performance.now();if(state.layoutOwner===state.root&&state.layout&&now-state.layoutAt<1000)return state.layout;
    state.layoutOwner=state.root;state.layoutAt=now;
    let bloxd=null;try{bloxd=state.api?.getBloxd?.();}catch{}
    const objects=[state.root,bloxd,...own(state.root),...own(bloxd)].filter(Boolean);
    const definitions=objects.find(value=>value.metadatas&&typeof value.metadatas==='object')?.metadatas||null;
    let read=null;
    if(typeof state.root?.getBlock==='function')read=(x,y,z)=>state.root.getBlock(x,y,z);
    if(!read)for(const object of objects){
      const methods=Object.getOwnPropertyDescriptors(Object.getPrototypeOf(object)||{});
      for(const [method,descriptor] of Object.entries(methods)){
        const fn=descriptor.value;if(typeof fn!=='function'||method==='constructor')continue;const source=String(fn);
        if(!/return\s+0\s*;/.test(source)||!/return\s+[\w$]+\.[\w$]+\.get\(/.test(source))continue;
        const match=source.match(/\]\s*=\s*this\.([\w$]+)\([^)]*\)\s*,\s*[\w$]+\s*=\s*this\.([\w$]+)\.([\w$]+)\(/);
        if(match&&typeof object[match[1]]==='function'&&typeof object[match[2]]?.[match[3]]==='function'){read=(x,y,z)=>object[method](x,y,z);break;}
      }if(read)break;
    }
    const water=new Set(),lava=new Set();
    for(const [names,ids] of [[['Water','Flowing Water'],water],[['Lava','Flowing Lava'],lava]])for(const name of names){
      try{const id=bloxd?.getItemId?.(name);if(Number.isInteger(id)&&id>0&&id<=65535)ids.add(id);}catch{}
    }
    const byId=new Map();let revision=2166136261;
    for(const [key,item] of Object.entries(definitions||{})){const id=Number(item?.id??item?.blockId??key);if(!Number.isInteger(id)||id<0||id>65535)continue;byId.set(id,item);
      const name=String(item?.name||item?.displayName||key);revision=Math.imul(revision^id,16777619);for(let i=0;i<name.length;++i)revision=Math.imul(revision^name.charCodeAt(i),16777619);}
    return state.layout={read,definitions,byId,water,lava,revision:`${!!read}:${revision>>>0}:${[...water].join(',')}:${[...lava].join(',')}`};
  }
  function surfaceValues(mesh,source,g,vertices,indices,world,vertexMap){
    const layout=worldLayout(),count=vertices.length/14,values=new Float32Array(count*2),terrain=!!mesh.metadata?.noa_chunk_terrain_mesh;
    const explicit=vertexData(source,g,'aBlockId')||vertexData(source,g,'blockId');
    const baseKind=mesh.infiniteDistance===true||mesh.metadata?.isSkybox===true?7:source.skeleton||mesh.metadata?.noa_entity_mesh===true?5:0;
    function assign(vertex,id){
      if(!Number.isInteger(id)||id<0||id>65535)id=-1;
      if(terrain&&id===0)id=-1;
      const definition=id>=0?layout.byId.get(id):null;
      const name=String(definition?.name||definition?.displayName||'').toLowerCase().replace(/[^a-z0-9]/g,'');
      let kind=baseKind;
      if(id>=0&&terrain){kind=layout.water.has(id)||name==='water'||name==='flowingwater'?2:layout.lava.has(id)||name==='lava'||name==='flowinglava'?3:1;}
      values[vertex*2]=id;values[vertex*2+1]=kind;
    }
    for(let v=0;v<count;++v)assign(v,explicit?.[vertexMap?.[v]??v]??-1);
    if(!explicit&&terrain&&layout.read){
      const origin=state.origin||[0,0,0];
      const point=vertex=>[0,1,2].map(axis=>world[axis]*vertices[vertex*14]+world[4+axis]*vertices[vertex*14+1]+world[8+axis]*vertices[vertex*14+2]+world[12+axis]+origin[axis]);
      for(let at=0;at<indices.length;at+=3){
        const ids=[indices[at],indices[at+1],indices[at+2]],points=ids.map(point),center=[0,1,2].map(axis=>(points[0][axis]+points[1][axis]+points[2][axis])/3);
        const normal=[0,1,2].map(axis=>world[axis]*vertices[ids[0]*14+3]+world[4+axis]*vertices[ids[0]*14+4]+world[8+axis]*vertices[ids[0]*14+5]);
        const length=Math.hypot(...normal);if(!length)continue;
        const position=center.map((v,axis)=>Math.floor(v-normal[axis]/length*.02));
        let id=-1;try{id=layout.read(...position);}catch{}
        for(const vertex of ids)assign(vertex,id);
      }
    }
    return values;
  }
  function materialDrawState(mesh,source,item,world,layers,sky,blended,alphaTest){
    const texture=sky||layers?null:item.diffuseTexture||item.albedoTexture;
    let uv=identity();
    if(texture){
      const transformed=[texture.uOffset??0,texture.vOffset??0,texture.uAng??0,texture.vAng??0,texture.wAng??0].some(v=>v!==0)||(texture.uScale??1)!==1||(texture.vScale??1)!==1;
      const supplied=texture.getTextureMatrix?.();
      if(supplied)uv=matrixData(supplied);
      else if(transformed)throw Error('Source UV transform matrix is unavailable.');
      if(uv?.length!==16||!finite(uv))throw Error('Invalid source UV transform matrix.');
      uv=new Float32Array(uv);if(!finite(uv))throw Error('Source UV transform exceeds float precision limits.');
    }
    const appearance=appearanceContract(item);
    if(appearance.flags&(1|256)||particleMaterials.has(item))uv=identity();
    if(appearance.animation){const base=identity();if(!uv.every((v,i)=>v===base[i]))throw Error('Animated source UV transforms are not implemented.');uv[5]=1/appearance.animation.states;uv[9]=appearance.animation.frame/appearance.animation.states;}
    const determinant=world[0]*(world[5]*world[10]-world[6]*world[9])-world[4]*(world[1]*world[10]-world[2]*world[9])+world[8]*(world[1]*world[6]-world[2]*world[5]);
    let orientation=source.overrideMaterialSideOrientation??item.sideOrientation??source.sideOrientation??(state.scene.useRightHandedSystem?1:0);
    if(orientation!==0&&orientation!==1)throw Error('Invalid source side orientation.');
    if(determinant<0)orientation=1-orientation;
    const depthFunction=item.depthFunction??0,blendMode=blended?(item.alphaMode??2):0;
    const wrapU=texture?.wrapU??1,wrapV=texture?.wrapV??1,level=Math.fround(particleMaterials.has(item)?1:texture?.level??1);
    if(!Number.isInteger(depthFunction)||depthFunction!==0&&(depthFunction<512||depthFunction>519)||![0,1,2,3,4,6,7,8].includes(blendMode)||![wrapU,wrapV].every(v=>Number.isInteger(v)&&v>=0&&v<=2)||!Number.isFinite(level)||level<0)throw Error('Unsupported source material draw state.');
    const textureAlpha=particleMaterials.has(item)||layers||sky||alphaTest||texture?.hasAlpha===true&&item.useAlphaFromDiffuseTexture===true;
    const cullBack=state.scene.getEngine().cullBackFaces??item.cullBackFaces??true;
    const flags=(item.backFaceCulling===true?1:0)|(orientation===0?2:0)|(cullBack?0:4)|(!sky&&!item.disableDepthWrite&&(!blended||blendMode===0||item.forceDepthWrite)?8:0)|(textureAlpha?16:0)|(item.twoSidedLighting===true?32:0)|(item.fogEnabled!==false&&mesh.applyFog!==false?64:0);
    return {flags,depthFunction,blendMode,wrapU,wrapV,values:[...uv,level],key:[flags,depthFunction,blendMode,wrapU,wrapV,...uv,level].join(':')};
  }
  function materialBlended(material,mesh,alpha){
    const supplied=material.needAlphaBlendingForMesh?.(mesh);if(typeof supplied==='boolean')return supplied;
    const mode=material.transparencyMode??material.Ue;if(Number.isInteger(mode)&&mode>=0&&mode<=3)return mode===2||mode===3;
    return alpha<1||mesh.hasVertexAlpha===true;
  }
  function materialAlphaTest(material,mesh){
    const supplied=material.needAlphaTestingForMesh?.(mesh)??material.needAlphaTesting?.();if(typeof supplied==='boolean')return supplied;
    const mode=material.transparencyMode??material.Ue;return Number.isInteger(mode)&&mode>=0&&mode<=3?mode===1||mode===3:true;
  }
  function sourceGroup(mesh){return mesh.particleSource?.renderingGroupId??mesh.renderingGroupId??mesh._renderingGroupId??mesh.sourceMesh?.renderingGroupId??0;}
  function cameraAttached(mesh){const camera=state.scene?.activeCamera||state.scene?._activeCamera;for(let node=mesh.parent,depth=0;node&&depth<64;node=node.parent,++depth)if(node===camera)return true;return false;}
  function observedCameraNeeded(mesh){return !mesh.particleSource&&(sourceGroup(mesh)!==0||mesh.ignoreCameraMaxZ===true||mesh.sourceMesh?.ignoreCameraMaxZ===true||cameraAttached(mesh));}
  function drawOriginKey(){const origin=state.originKey&&state.root?.[state.originKey];return origin?.length===3&&finite(origin)?Array.from(origin).join(':'):'unknown';}
  function invertibleDrawMatrix(m){
    const a=new Float32Array(m),b=[a[0]*a[5]-a[1]*a[4],a[0]*a[6]-a[2]*a[4],a[0]*a[7]-a[3]*a[4],a[1]*a[6]-a[2]*a[5],a[1]*a[7]-a[3]*a[5],a[2]*a[7]-a[3]*a[6],a[8]*a[13]-a[9]*a[12],a[8]*a[14]-a[10]*a[12],a[8]*a[15]-a[11]*a[12],a[9]*a[14]-a[10]*a[13],a[9]*a[15]-a[11]*a[13],a[10]*a[15]-a[11]*a[14]];
    const determinant=b[0]*b[11]-b[1]*b[10]+b[2]*b[9]+b[3]*b[8]-b[4]*b[7]+b[5]*b[6];return Number.isFinite(determinant)&&Math.abs(determinant)>=1e-12;
  }
  function groupPolicy(group){
    if(!Number.isInteger(group)||group< -1||group>3)throw Error('Unsupported source rendering group.');
    const manager=state.scene?._renderingManager;
    const type=manager?._renderingGroups?.[group]?.constructor,opaque=manager?._customOpaqueSortCompareFn?.[group],cutout=manager?._customAlphaTestSortCompareFn?.[group],transparent=manager?._customTransparentSortCompareFn?.[group];
    if(opaque&&opaque!==type?.oY||cutout&&cutout!==type?.oY)throw Error('Custom source opaque group sorting is not implemented.');
    let sortFlags=0;
    if(transparent){if(transparent===type?.oY)sortFlags=32;else if(transparent===type?.backToFrontSortCompare)sortFlags=64;else if(transparent===type?.frontToBackSortCompare)sortFlags=128;else if(transparent!==type?.defaultTransparentSortCompare)throw Error('Custom source transparent group sorting is not implemented.');}
    if(group===-1)return sortFlags;
    const setup=state.scene?.getAutoClearDepthStencilSetup?.(group),enabled=setup?.autoClear??setup?.cY;
    if(group===0&&setup===undefined)return sortFlags;
    if(typeof enabled!=='boolean'||typeof setup.depth!=='boolean')throw Error('Source rendering group depth policy is unavailable.');
    return sortFlags|(manager?.constructor?.AUTOCLEAR!==false&&enabled&&setup.depth?2:0);
  }
  function observeDraws(selected){
    const owners=new Set([...selected].map(mesh=>mesh.sourceMesh||mesh));
    for(const [owner,entry] of drawObservers)if(!owners.has(owner)){entry.observable.remove(entry.token);drawObservers.delete(owner);observedViews.delete(owner);}
    for(const owner of owners){if(drawObservers.has(owner))continue;const observable=owner.onBeforeDrawObservable;
      if(typeof observable?.add!=='function'||typeof observable.remove!=='function')continue;
      const scene=state.scene,token=observable.add(()=>{
        if(state.stopped||state.scene!==scene)return;
        try{
          const engine=scene.getEngine(),gl=engine._gl;
          if(scene._isInIntermediateRendering?.()===true||gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null)return;
          if(sourceGroup(owner)===0&&!observedCameraNeeded(owner)){observeSourceLight();observeEmission(owner);}
          if(!observedCameraNeeded(owner))return;
          const camera=scene.activeCamera||scene._activeCamera,view=matrixData(scene.getViewMatrix?.()),projection=matrixData(scene.getProjectionMatrix?.()),position=vector(camera?.globalPosition||camera?.position,3);
          if(view?.length!==16||projection?.length!==16||!finite(view)||!finite(projection)||!position)throw Error('Source draw camera matrices are unavailable.');
          if(!invertibleDrawMatrix(view)||!invertibleDrawMatrix(projection))throw Error('Source draw camera is singular.');
          const values=[...view,...projection,...position];if(!finite(new Float32Array(values)))throw Error('Source draw camera exceeds float range.');
          observedViews.set(owner,{camera,group:sourceGroup(owner),origin:drawOriginKey(),at:performance.now(),halfZ:!!engine.isNDCHalfZRange,reverse:!!engine._useReverseDepthBuffer,
            renderFrame:sourceRenderFrame(scene),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,player:playerSource(scene,camera),values});
        }catch(error){observedViews.delete(owner);invalidate(error.message||'Source draw camera observation failed.');}
      });
      drawObservers.set(owner,{observable,token});
    }
  }
  function sourceDrawState(mesh,material,partOrder=0,requireCamera=true){
    const group=sourceGroup(mesh),policy=groupPolicy(group),owner=mesh.sourceMesh||mesh,custom=observedCameraNeeded(mesh),hand=mesh.ignoreCameraMaxZ===true||owner.ignoreCameraMaxZ===true||cameraAttached(mesh);
    if(hand&&group<=0)throw Error('Camera-attached source overlays need an isolated positive render group.');
    const alpha=mesh.alphaIndex??Number.MAX_VALUE,sort=material?.uniqueId??mesh.uniqueId??0,order=drawOrder.get(mesh)??0;
    if(!Number.isFinite(alpha)||!Number.isSafeInteger(sort)||sort<0||order>1000000||partOrder>1000000)throw Error('Invalid source draw ordering.');
    let flags=policy|(hand?8:0),values=[];
    if(custom&&requireCamera){
      const snapshot=observedViews.get(owner),camera=state.scene.activeCamera||state.scene._activeCamera;
      if(!snapshot||snapshot.camera!==camera||snapshot.group!==group||snapshot.origin!==drawOriginKey()||performance.now()-snapshot.at>250)throw Error('Waiting for a current source draw camera observation.');
      flags|=1|(snapshot.halfZ?4:0);values=snapshot.values.slice();
    }
    const bounds=mesh.getBoundingInfo?.()??mesh.gO?.(),center=vector(bounds?.boundingSphere?.centerWorld??bounds?.TO?.centerWorld,3);
    if(center){flags|=16;values.push(...center);}
    const layout=[group,flags,order,partOrder,sort,alpha].join(':');
    return {group,flags,order,partOrder,sort,alpha,values,layout,key:layout+':'+values.join(':')};
  }
  function drawStatesCurrent(){
    for(const record of state.meshes.values()){
      try{if(record.renderLayout!==sourceDrawState(record.mesh,record.material,record.partOrder).layout)return false;}catch{return false;}
    }
    return true;
  }
  async function uploadMesh(mesh,gl){
    if(mesh.particleSource)updateParticleMesh(mesh);
    const source=mesh.sourceMesh||mesh,g=geometry(source);if(!g)return false;
    const parts=drawParts(mesh,source,g),pose=deformation(source,mesh.material||source.material),frame={pose,geometry:null},alive=new Set();
    let tracked=exportedParts.get(mesh);if(!tracked){tracked=new Set();exportedParts.set(mesh,tracked);}
    for(const [order,part] of parts.entries()){part.drawOrder=order;const id=idFor(part.key);if(await uploadPart(mesh,source,g,part,frame,gl)){alive.add(id);tracked.add(id);}}
    const obsolete=[];for(const id of tracked)if(!alive.has(id))obsolete.push(id);
    if(obsolete.length){await send(packet(8,[state.epoch,obsolete.length,...obsolete]));for(const id of obsolete)forgetMesh(id);}
    exportedParts.set(mesh,alive);
    return alive.size>0;
  }
  async function uploadPart(mesh,source,g,part,frame,gl){
    const id=idFor(part.key),old=state.meshes.get(id),signature=bufferSignature(g),material=part.material;
    const layout=worldLayout();
    const world=matrixData(mesh.getWorldMatrix?.()||mesh.computeWorldMatrix?.(false));
    if(!world||world.length!==16||!finite(world))throw Error('Mesh has no valid world matrix.');
    const layers=!!g._vertexBuffers?.texAtlasIndices;
    const appearance=appearanceContract(material,mesh);
    const sky=mesh.infiniteDistance===true||mesh.metadata?.isSkybox===true;
    const texture=ensureTexture(materialTextures(gl,material,layers,sky));
    await syncTextureSampling(texture);
    const visibility=Number.isFinite(mesh.visibility)?mesh.visibility:1;
    const alpha=(Number.isFinite(material?.alpha)?material.alpha:1)*(appearance.flags&8?1:visibility);
    if(alpha<0||alpha>1)throw Error('Invalid material alpha.');
    const blended=materialBlended(material,mesh,alpha);
    const diffuse=material?.albedoColor||material?.diffuseColor||{r:1,g:1,b:1};
    const diffuseKey=[diffuse.r,diffuse.g,diffuse.b].join(':');
    const alphaTest=materialAlphaTest(material,mesh);
    const drawState=materialDrawState(mesh,source,material,world,state.textures.get(texture)?.pages[0]?.array===true,sky,blended,alphaTest);
    const cutoff=alphaTest?(Number.isFinite(material?.alphaCutOff)?material.alphaCutOff:0.05):0;
    const emissive=material?.emissiveColor||{r:0,g:0,b:0},unlit=appearance.flags&32?(appearance.flags&64)===0:material?.disableLighting===true||!!(appearance.flags&16)&&!(appearance.flags&64);
    const materialKey=[unlit,cutoff,emissive.r,emissive.g,emissive.b].join(':');
    if(cutoff<0||cutoff>1||[diffuse.r,diffuse.g,diffuse.b,emissive.r,emissive.g,emissive.b].some(v=>!Number.isFinite(v)||v<0))throw Error('Invalid material color/cutoff/emission.');
    const packedBuffer=source.getVertexBuffer?.('aPackedLightLevels')||g._vertexBuffers?.aPackedLightLevels;
    let flags=(packedBuffer?1:0)|(blended?2:0)|(sky?4:0)|(mesh.metadata?.noa_chunk_terrain_mesh?8:0)|(mesh.particleSource?16:0);
    const lightBuffer=packedBuffer,lightRevision=revision(rawBuffer(lightBuffer));
    const rangeKey=`${part.indexStart}:${part.indexCount}`;
    const hasInstances=source===mesh&&!!source._thinInstanceDataStorage?.matrixData;
    const uvMorphed=frame.pose.targets.some(t=>t.uv);
    const changed=!old||old.geometry!==g||old.indexSource!==g._indices||old.texture!==texture||old.flags!==flags||old.alpha!==alpha||old.diffuseKey!==diffuseKey||old.rangeKey!==rangeKey||old.hasInstances!==hasInstances||old.surfaceRevision!==layout.revision||!sameSignature(old.signature,signature)||old.poseKey!==frame.pose.key&&(uvMorphed||old.uvMorphed);
    const poseChanged=old&&old.poseKey!==frame.pose.key;
    if(changed){
      invalidate('Native geometry is being replaced.');await renderControl();
      frame.geometry||=deformedGeometry(source,g,frame.pose);
      const {positions,normals,uv}=frame.geometry,sourceCount=positions.length/3;
      const colors=vertexData(source,g,'color'),atlas=vertexData(source,g,'texAtlasIndices'),light=vertexData(source,g,'aPackedLightLevels');
      const colorSize=g._vertexBuffers?.color?.getSize?.()||(colors?.length/sourceCount);
      const hasColors=colorSize===3||colorSize===4;
      let indices=indicesFor(source,g);if(indices.length%3)throw Error('Non-triangle topology is not exported.');
      if(indices.length>6000000)throw Error('Mesh index limit exceeded.');
      for(const index of indices)if(index>=sourceCount)throw Error('Mesh index exceeds vertex count.');
      let vertexMap=null;
      if(part.indexCount!==null){
        indices=indices.slice(part.indexStart,part.indexStart+part.indexCount);
        const remap=new Map();vertexMap=[];
        indices=indices.map(index=>{if(!remap.has(index)){remap.set(index,vertexMap.length);vertexMap.push(index);}return remap.get(index);});
      }
      const count=vertexMap?.length??sourceCount;
      const vertices=new Float32Array(count*14);
      for(let v=0;v<count;++v){const p=v*14,s=vertexMap?.[v]??v;vertices[p]=positions[s*3];vertices[p+1]=positions[s*3+1];vertices[p+2]=positions[s*3+2];vertices[p+3]=normals?.[s*3]??0;vertices[p+4]=normals?.[s*3+1]??1;vertices[p+5]=normals?.[s*3+2]??0;vertices[p+6]=uv?.[s*2]??0;vertices[p+7]=uv?.[s*2+1]??0;vertices[p+8]=(hasColors?colors[s*colorSize]:1)*diffuse.r;vertices[p+9]=(hasColors?colors[s*colorSize+1]:1)*diffuse.g;vertices[p+10]=(hasColors?colors[s*colorSize+2]:1)*diffuse.b;vertices[p+11]=(colorSize===4?colors[s*4+3]:1)*alpha;vertices[p+12]=atlas?.[s]??0;vertices[p+13]=light?.[s]??61440;}
      if(!finite(vertices))throw Error('Invalid mesh vertex attributes.');
      const tail=new Uint8Array(vertices.byteLength+indices.byteLength);tail.set(new Uint8Array(vertices.buffer));tail.set(new Uint8Array(indices.buffer),vertices.byteLength);
      let emissionProof=source===mesh&&!mesh._thinInstanceDataStorage?.matrixData?meshEmission(mesh,g):null;
      if(emissionProof){const raw=new DataView(emissionProof.bytes.buffer);for(let v=0;v<count&&emissionProof;++v)for(let c=0;c<3;++c)
        if(vertices[v*14+c]!==raw.getFloat32((vertexMap?.[v]??v)*emissionProof.stride+c*4,true)){emissionProof=null;break;}}
      forgetEmissionExport(id);
      const meshPacket=packet(3,[state.epoch,id,texture,flags,count,indices.length],world,tail),meshSequence=new DataView(meshPacket).getUint32(12,true);
      if(emissionProof&&!exportEmission(emissionProof,id,meshSequence,indices,vertexMap,part.indexCount===null?0:part.indexStart))emissionProof=null;
      await send(meshPacket);++state.meshUploads;
      state.meshes.set(id,{mesh,geometry:g,indexSource:g._indices,signature,texture,flags,alpha,diffuseKey,rangeKey,poseKey:frame.pose.key,uvMorphed,vertexMap,count,hasInstances,lightBuffer,lightRevision,world:Array.from(world),instanceSignature:null,layers:[...new Set(Array.from({length:count},(_,v)=>vertices[v*14+12]))]});
      state.meshes.get(id).surfaceRevision=layout.revision;
      Object.assign(state.meshes.get(id),{emissionProof,meshSequence});
      const surfaces=surfaceValues(mesh,source,g,vertices,indices,world,vertexMap);
      await send(packet(14,[state.epoch,id,count],surfaces));++state.surfaceUpdates;
    }else if(!old.world.every((x,i)=>x===world[i])){
      if(!mesh.particleSource)await send(packet(5,[state.epoch,id],world));old.world=Array.from(world);
    }
    const record=state.meshes.get(id);
    const render=sourceDrawState(mesh,material,part.drawOrder);record.material=material;record.partOrder=part.drawOrder;
    if(changed||record.renderKey!==render.key){
      if(changed||record.renderLayout!==render.layout){invalidate('Native draw group/order is being updated.');await renderControl();}
      const ordering=new Uint8Array(16),orderingView=new DataView(ordering.buffer);orderingView.setFloat64(0,render.alpha,true);orderingView.setFloat64(8,render.sort,true);
      await send(packet(27,[state.epoch,id,render.group+1,render.flags,render.order,render.partOrder],render.values,ordering));record.renderKey=render.key;record.renderLayout=render.layout;
    }
    if(changed||record.drawStateKey!==drawState.key){
      invalidate('Native material state is being updated.');await renderControl();
      await send(packet(17,[state.epoch,id,drawState.flags,drawState.depthFunction,drawState.blendMode,drawState.wrapU,drawState.wrapV],drawState.values));record.drawStateKey=drawState.key;
    }
    if(changed||record.materialKey!==materialKey){
      invalidate('Native material properties are being updated.');await renderControl();
      await send(packet(12,[state.epoch,id,unlit?1:0],[cutoff,emissive.r,emissive.g,emissive.b]));record.materialKey=materialKey;++state.materialUpdates;
    }
    const appearanceLayout=[appearance.flags,appearance.columns,appearance.rows,appearance.layers].join(':'),appearanceReplaced=changed||record.appearanceLayout!==appearanceLayout;
    if((appearance.flags||record.appearanceKey)&&(changed||record.appearanceKey!==appearance.key)){
      invalidate('Native source plugin state is being updated.');await renderControl();
      await send(packet(18,[state.epoch,id,appearance.flags,appearance.columns,appearance.rows,appearance.layers,(appearance.values.length-16)>>2],appearance.values));record.appearanceKey=appearance.key;
      record.appearanceLayout=appearanceLayout;
    }
    const specialKey=appearance.special.join(':');if(!mesh.particleSource&&(appearance.flags&(2048|4096)||record.specialKey)&&(changed||record.specialKey!==specialKey)){
      if(changed||record.textBias!==appearance.special[1]){invalidate('Native special material state is being updated.');await renderControl();}
      await send(packet(24,[state.epoch,id],appearance.special));record.specialKey=specialKey;record.textBias=appearance.special[1];
    }
    if(appearance.flags&(1|2|4|16|256|512|1024|2048)){
      const instanceCount=source===mesh&&source._thinInstanceDataStorage?.matrixData?(source._thinInstanceDataStorage.instancesCount??source.forcedInstanceCount??0):null;
      const data=appearanceAttributes(mesh,source,g,appearance,instanceCount??record.count,instanceCount===null?record.vertexMap:null,instanceCount!==null),key=hash(data)+':'+data.length;
      const stride=appearance.flags&2048?36:appearance.flags>255?24:20;
      if(appearance.flags&1024){const descriptor=state.textures.get(texture),requested=new Set();for(let at=0;at<data.length;at+=stride)for(let i=0;i<6;++i){const layer=data[at+i];if(!descriptor||layer>=descriptor.layers)throw Error('Per-face index exceeds the loaded block atlas.');requested.add(layer);}requestLayers(texture,[...requested]);}
      if(appearanceReplaced||record.appearanceDataKey!==key){invalidate('Native entity appearance is being updated.');await renderControl();
        const type=stride===36?25:stride===24?20:19;
        for(let at=0;at<data.length/stride;at+=262144){const count=Math.min(262144,data.length/stride-at);await send(packet(type,[state.epoch,id,instanceCount===null?0:1,data.length/stride,at,count],data.subarray(at*stride,(at+count)*stride)));}
        if(!data.length)await send(packet(type,[state.epoch,id,instanceCount===null?0:1,0,0,0]));record.appearanceDataKey=key;
      }
    }
    if(mesh.particleSource){const data=mesh.particleData,contract=mesh.particleContract,ramp=ensureTexture(contract.ramp),key=[hash(data),data.length,mesh.particleOrder,mesh.particleExtended,mesh.particleV3,contract.mode,ramp,contract.blend,...contract.rampWrap,...contract.pivot,...contract.mask].join(':');
      await syncTextureSampling(ramp);requestLayers(ramp,[0]);
      if(changed||record.particleKey!==key){
        if((record.rampTexture||0)!==ramp){invalidate('Native particle ramp texture is being updated.');await renderControl();}
        if(mesh.particleExtended){const values=new Float32Array(6+data.length);values.set(contract.pivot);values.set(contract.mask,2);values.set(data,6);
          await send(mesh.particleV3?packet(29,[state.epoch,id,data.length/32,mesh.particleOrder,contract.mode,ramp,contract.blend+1,...contract.rampWrap],values):packet(28,[state.epoch,id,data.length/28,mesh.particleOrder,contract.mode],values));}
        else await send(packet(26,[state.epoch,id,data.length/20,mesh.particleOrder],data));record.particleKey=key;
      }record.rampTexture=ramp;}
    if(!changed&&poseChanged){
      frame.geometry||=deformedGeometry(source,g,frame.pose);const {positions,normals}=frame.geometry;
      const values=new Float32Array(record.count*6);
      for(let v=0;v<record.count;++v){const s=record.vertexMap?.[v]??v;values.set(positions.subarray?positions.subarray(s*3,s*3+3):positions.slice(s*3,s*3+3),v*6);values[v*6+3]=normals?.[s*3]??0;values[v*6+4]=normals?.[s*3+1]??1;values[v*6+5]=normals?.[s*3+2]??0;}
      await send(packet(11,[state.epoch,id,record.count],values));record.poseKey=frame.pose.key;++state.poseUpdates;
    }
    if(!changed&&flags&1&&!instancedAttribute(lightBuffer)&&(old.lightBuffer!==lightBuffer||old.lightRevision!==lightRevision)){
      const light=vertexData(source,g,'aPackedLightLevels');
      if(light?.length===source.getTotalVertices?.()){const values=record.vertexMap?record.vertexMap.map(i=>light[i]):light;await send(packet(6,[state.epoch,id,values.length],values));}
      old.lightBuffer=lightBuffer;old.lightRevision=lightRevision;
    }
    const storage=source===mesh?source._thinInstanceDataStorage:null,matrices=storage?.matrixData;
    const instanceCount=storage?.instancesCount??source.forcedInstanceCount??0;
    requestLayers(texture,sky?[0,1,2,3,4,5]:state.meshes.get(id)?.layers);
    if(!mesh.particleSource&&matrices&&Number.isInteger(instanceCount)&&instanceCount>=0){
      const buffer=storage.matrixBuffer||source.getVertexBuffer?.('world0')||source.getVertexBuffer?.('matrix'),matrixHandle=rawBuffer(buffer),rev=revision(matrixHandle);
      const count=Math.min(instanceCount,Math.floor(matrices.length/16));if(count>65536)throw Error('Instance export limit exceeded.');
      const instanceLight=instanceData(source,g,'aPackedLightLevels',count),instanceAtlas=instanceData(source,g,'texAtlasIndices',count);
      if(instanceAtlas?.length===count)requestLayers(texture,instanceAtlas);
      const signature=`${count}:${rev}:${matrixHandle&&rev?'tracked':hash(matrices,count*16)}:${hash(instanceLight)}:${hash(instanceAtlas)}`;
      if(changed||record.instanceSignature!==signature){
        const instances=new Float32Array(count*18);
        for(let i=0;i<count;++i){instances.set(matrices.subarray(i*16,i*16+16),i*18);instances[i*18+16]=instanceAtlas?.length===count?instanceAtlas[i]:-1;instances[i*18+17]=instanceLight?.length===count?instanceLight[i]:-1;}
        const upload=packet(9,[state.epoch,id,count],instances);await send(upload);record.instanceSequence=new DataView(upload).getUint32(12,true);record.instanceSignature=signature;
      }
      const proof=instanceProof(mesh),existing=proof?.exports.get(id);
      if(proof&&existing?.sequence===record.meshSequence&&existing?.instanceSequence===record.instanceSequence){record.emissionProof=proof;}
      else {forgetEmissionExport(id);record.emissionProof=null;
      if(proof&&record.instanceSequence&&record.meshSequence){const words=[],tokens=[];for(let i=0;i<proof.slots.length;++i){const slot=proof.slots[i];
        words.push(i+1,4096|slot.rgb,slot.block,slot.generation.token,slot.lifetime);tokens.push(slot.material);}
        const metadata=blockIdentity&&tokens.some(v=>v)?new Uint32Array(tokens):null,cost=words.length*4+(metadata?.byteLength||0)+32;if(words.length&&instanceCharge(proof,proof.cost+cost)){
          proof.exports.set(id,{sequence:record.meshSequence,instanceSequence:record.instanceSequence,runs:new Uint32Array(words),materials:metadata});record.emissionProof=proof;}}}
    }
    return true;
  }
  function selectedMeshes(scene){
    const active=scene?.getActiveMeshes?.();
    const list=active?.data&&Number.isInteger(active.length)&&active.length>=0&&active.length<=active.data.length
      ? active.data.slice(0,active.length):config.fixture?scene?.meshes:null;
    if(!list)return null;
    const selected=new Set(list.filter(mesh=>mesh&&mesh.isVisible!==false&&mesh.visibility!==0&&mesh.isEnabled?.()!==false&&mesh.isDisposed?.()!==true&&mesh.isBlocked!==true
      &&!(mesh._internalAbstractMeshDataInfo?._onlyForInstances&&!mesh.sourceMesh)));
    let order=0;for(const system of selectedParticles(scene)){if(isGpu(system)){++order;continue;}const mesh=particleMesh(system);mesh.particleOrder=order++;selected.add(mesh);}
    order=0;for(const mesh of selected)drawOrder.set(mesh,order++);return selected;
  }
  function selectedParticles(scene){
    if(scene?.particlesEnabled===false)return [];
    const active=scene?._activeParticleSystems;
    const systems=active?.data&&Number.isInteger(active.length)&&active.length>=0&&active.length<=active.data.length?active.data.slice(0,active.length):scene?.particleSystems||[];
    const camera=scene?.activeCamera||scene?._activeCamera;
    return systems.filter(p=>p&&p.isDisposed?.()!==true&&(isGpu(p)?p.fm!==true&&!(typeof p.liveUntil==='number'&&Number.isFinite(p.time)&&p.liveUntil<=p.time):(p.getActiveCount?.()??(p.isStarted?.()===false?0:1))!==0)&&!(Number.isInteger(p.layerMask)&&Number.isInteger(camera?.layerMask)&&(p.layerMask&camera.layerMask)===0));
  }
  function particleContract(system){
    const scene=state.scene,active=scene?._activeParticleSystems;
    if(!config.fixture&&!(active?.data&&Number.isInteger(active.length)&&active.length>=0&&active.length<=active.data.length))throw Error('Source particles need an authoritative active system list.');
    // q9aot's custom gpuParticles is not Babylon GPUParticleSystem. Its ring
    // contains spawn inputs, not current poses. Never reinterpret that mirror
    // (or its WebGL records texture) as a CPU particle/result buffer.
    if(isGpu(system)){if(!gpuSystems.has(system)||!gpuCurrent())throw Error('Source GPU particles need a complete observed q9aot draw/upload snapshot.');return;}
    const count=system.getActiveCount?.(),particles=system.particles,kind=system.getClassName?.();
    if(!['ParticleSystem','sY'].includes(kind)||!Number.isInteger(count)||count<0||count>8192||!Array.isArray(particles)||particles.length!==count)throw Error('Unsupported source particles or CPU particle count.');
    if(typeof system.isBillboardBased!=='boolean'||system.isBillboardBased&&![2,7,8,9].includes(system.billboardMode)||system.customShader||system.vertexShaderName&&system.vertexShaderName!=='particles'||(system.renderingGroupId??0)!==0)throw Error('Source particle billboard/program/group is not implemented.');
    if(system.defaultViewMatrix||system.defaultProjectionMatrix||system.useLogarithmicDepth||Array.from({length:6},(_,i)=>'clipPlane'+(i?i+1:'')).some(key=>system[key]||scene[key]))throw Error('Source particle custom camera/log-depth/clip planes are not implemented.');
    const mode=system.isBillboardBased?({7:0,2:1,8:2,9:3}[system.billboardMode]):4;
    if(![-1,0,1,2,3,4].includes(system.blendMode))throw Error('Source particle blend mode is not implemented.');
    if((system.blendMode===4?[3,2]:[system.blendMode]).some(mode=>system.getCustomEffect?.(mode))||system._useFixedCapacityForSnapshot||scene.forceWireframe||scene.forcePointsCloud)throw Error('Custom particle pass, snapshot capacity or wireframe is not implemented.');
    const mask=vector(system.textureMask,4);if(!mask||mask.some(v=>v<0||v>1))throw Error('Invalid source particle texture mask.');
    const image=system.imageProcessingConfiguration||system._imageProcessingConfiguration;
    if(image?.isEnabled!==false&&(image?.applyByPostProcess||image?.toneMappingEnabled||image?.colorCurvesEnabled||image?.colorGradingEnabled||image?.vignetteEnabled||image?.exposure!==undefined&&image.exposure!==1||image?.contrast!==undefined&&image.contrast!==1))throw Error('Source particle image processing is not implemented.');
    if(!system.particleTexture||system.particleTexture.isReady?.()===false)throw Error('Source particle texture is unavailable.');
    const texture=textureHandle(scene.getEngine()._gl,system.particleTexture);if(!texture||texture.array||texture.cube)throw Error('Source particles need a complete 2D texture.');
    let ramp=null,rampWrap=[1,1];
    if(system.useRampGradients===true){const source=system._rampGradientsTexture,page=source&&textureHandle(scene.getEngine()._gl,source);rampWrap=[source?.wrapU??1,source?.wrapV??1];
      if(!system._rampGradients?.length||source?.isReady?.()===false||!page||page.array||page.cube||page.internal.is3D||page.height!==1||page.handle===texture.handle||!rampWrap.every(v=>Number.isInteger(v)&&v>=0&&v<=2))throw Error('Source particle ramp texture is incomplete or unsupported.');
      ramp={key:source,pages:[page],width:page.width,height:page.height,layers:1,flags:6|(page.srgb?16:0),sampling:page.sampling};
    }
    const pivot=vector(system.translationPivot??[0,0],2);if(!pivot||pivot.some(v=>Math.abs(v)>16))throw Error('Invalid source particle pivot.');
    const floating=vector(scene.floatingOriginOffset??[0,0,0],3),offset=vector(system.iD??system.worldOffset??[0,0,0],3);
    if(!floating||!offset)throw Error('Invalid source particle world offset.');
    const sheet=system.isAnimationSheetEnabled??system._isAnimationSheetEnabled??system._animationSheetEnabled??false;
    if(typeof sheet!=='boolean')throw Error('Invalid source particle sheet state.');
    let columns=1,rows=1,inset=1,epsilon=0;
    if(sheet){const base=system.particleTexture.getBaseSize?.()??texture,cw=system.spriteCellWidth,ch=system.spriteCellHeight;
      if(![base.width,base.height,cw,ch].every(v=>Number.isInteger(v)&&v>0)||base.width%cw||base.height%ch||base.width/cw*(base.height/ch)>1048576)throw Error('Unsupported source particle sheet grid.');
      columns=base.width/cw;rows=base.height/ch;
      if(system._useInstancing!==true){epsilon=system._epsilon;if(!Number.isFinite(epsilon)||epsilon<0||epsilon>=.5)throw Error('Invalid source particle sheet inset.');inset=1-2*epsilon;}
    }
    let emitter=null;if(mode===4&&system.isLocal){emitter=matrixData(system._emitterWorldMatrix);if(emitter?.length!==16||!finite(emitter)||emitter[3]!==0||emitter[7]!==0||emitter[11]!==0||emitter[15]!==1)throw Error('Source particle emitter matrix is unavailable.');}
    const eye=vector((scene.activeCamera||scene._activeCamera)?.globalPosition??(scene.activeCamera||scene._activeCamera)?.position,3);
    if(!eye)throw Error('Source particle eye position is unavailable.');
    const view=matrixData((scene.activeCamera||scene._activeCamera)?.getViewMatrix?.());if(!view||view.length!==16||!finite(view))throw Error('Source particle view is unavailable.');
    const axes=[0,1,2].map(i=>[view[i],view[4+i],view[8+i]]);if(axes.some(v=>Math.abs(Math.hypot(...v)-1)>.001)||Math.abs(axes[0].reduce((s,v,i)=>s+v*axes[1][i],0))>.001||Math.abs(axes[0].reduce((s,v,i)=>s+v*axes[2][i],0))>.001||Math.abs(axes[1].reduce((s,v,i)=>s+v*axes[2][i],0))>.001)throw Error('Non-rigid source particle view is not implemented.');
    return {particles,mode,mask,pivot,sheet,columns,rows,inset,epsilon,emitter,eye,ramp,rampWrap,blend:system.blendMode,offset:offset.map((v,i)=>v-floating[i])};
  }
  function particleMesh(system){
    let mesh=particleMeshes.get(system);if(mesh)return mesh;
    const data={position:new Float32Array([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0]),normal:new Float32Array([0,0,-1,0,0,-1,0,0,-1,0,0,-1]),uv:new Float32Array([0,0,1,0,1,1,0,1]),color:new Float32Array(16).fill(1)};
    const buffers={};for(const [kind,size] of [['position',3],['normal',3],['uv',2],['color',4]])buffers[kind]={getSize:()=>size,getIsInstanced:()=>false};
    const material={alpha:1,disableLighting:true,useAlphaFromDiffuseTexture:true,alphaCutOff:0,backFaceCulling:false,needAlphaBlendingForMesh:()=>true,needAlphaTesting:()=>false,getClassName:()=> 'StandardMaterial',particleSource:system};particleMaterials.add(material);
    mesh={particleSource:system,isVisible:true,_geometry:{_vertexBuffers:buffers,_indices:new Uint32Array([0,1,2,0,2,3])},material,data,getVerticesData:k=>data[k],getVertexBuffer:k=>buffers[k],getTotalVertices:()=>4,getTotalIndices:()=>6,getWorldMatrix:()=>identity(),_thinInstanceDataStorage:{matrixData:new Float32Array(16),instancesCount:0}};
    particleMeshes.set(system,mesh);return mesh;
  }
  function updateParticleMesh(mesh){
    const system=mesh.particleSource,contract=particleContract(system),{particles,mode,sheet,pivot,mask,columns,rows,epsilon,inset,offset,emitter,eye}=contract;
    mesh.particleV3||=!!contract.ramp||contract.blend<0||contract.blend>=3;
    mesh.particleExtended||=mesh.particleV3||mode!==0||sheet||pivot.some(v=>v!==0)||mask.some(v=>v!==1);const stride=mesh.particleV3?32:mesh.particleExtended?28:20,data=new Float32Array(particles.length*stride);
    for(let i=0;i<particles.length;++i){const p=particles[i],position=vector(p.position,3),color=vector(p.color,4),scale=vector(p.scale,2),size=p.size,angle=p.angle;
      if(!position||!color||!scale||!Number.isFinite(size)||size<0||!Number.isFinite(angle)||scale.some(v=>v<0)||color.some((v,c)=>v<0||v>(c===3?1:64)))throw Error('Invalid source particle state.');
      const center=position.map((v,c)=>v+offset[c]);let direction=[0,0,0];
      if(mode>=2){direction=vector(mode===4?p._properties?.initialDirection??p.direction:p.direction,3);if(!direction)throw Error('Source particle direction is unavailable.');
        if(emitter)direction=[0,1,2].map(c=>emitter[c]*direction[0]+emitter[4+c]*direction[1]+emitter[8+c]*direction[2]);
        if(mode===4&&direction[0]===0&&direction[2]===0)direction[0]=.001;
        if(Math.hypot(...direction)<1e-8||direction.some(v=>Math.abs(v)>1e16))throw Error('Degenerate or oversized source particle direction.');
      }
      const delta=center.map((v,c)=>v-eye[c]);
      if(mode===1&&Math.hypot(delta[0],delta[2])<1e-8)throw Error('Degenerate source particle camera alignment.');
      if(mode===2||mode===3){const cross=[direction[1]*delta[2]-direction[2]*delta[1],direction[2]*delta[0]-direction[0]*delta[2],direction[0]*delta[1]-direction[1]*delta[0]];
        if(Math.hypot(...cross)<1e-8)throw Error('Degenerate source particle camera alignment.');}
      const c=Math.cos(angle),s=Math.sin(angle),x=size*scale[0],y=size*scale[1],at=i*stride;data.set([c*x,s*x,0,0,-s*y,c*y,0,0,0,0,1,0,...center,1,...color],at);
      if(mesh.particleExtended){let rect=[0,0,1,1];if(sheet){const cell=p.cellIndex;if(!Number.isInteger(cell)||cell<0||cell>=columns*rows)throw Error('Invalid source particle sheet cell.');const row=Math.floor(cell/columns),column=cell-row*columns;rect=[(column+epsilon)/columns,(row+1-epsilon)/rows,inset/columns,-inset/rows];}
        data.set([...rect,...direction,inset],at+20);}
      if(mesh.particleV3){const remap=contract.ramp?vector(p.remapData,4):[0,1,0,1];if(!remap||remap.some((v,c)=>Math.abs(v)>64||((c===1||c===3)&&v<=1e-8)))throw Error('Invalid source particle ramp remap ranges.');data.set(remap,at+28);}
    }
    if(!finite(data))throw Error('Source particle state exceeds float range.');mesh.particleData=data;mesh.particleContract=contract;mesh._thinInstanceDataStorage.instancesCount=particles.length;
    Object.assign(mesh.material,{diffuseTexture:system.particleTexture,alphaMode:({[-1]:3,0:6,1:2,2:1,3:4,4:4})[system.blendMode],forceDepthWrite:system.forceDepthWrite===true,fogEnabled:system.applyFog===true});
  }
  function sameSelection(a,b){return a&&b&&a.size===b.size&&[...a].every(mesh=>b.has(mesh));}
  function unsupportedMesh(mesh){
    if(mesh.particleSource){particleContract(mesh.particleSource);return null;}
    const source=mesh.sourceMesh||mesh,g=geometry(source),material=mesh.material||source.material;
    sourceDrawState(mesh,material,0,false);
    if(!g)return 'Source geometry is unavailable.';
    if(mesh.billboardMode)return 'Billboard rendering is not implemented.';
    if(source._LODLevels?.length)return 'Source LOD selection is not implemented.';
    if(source.forcedInstanceCount>0&&!source._thinInstanceDataStorage?.matrixData)return 'Source instance matrices are unavailable.';
    const exotic=Object.keys(g._vertexBuffers||{}).find(key=>/^aAtlasIdx/.test(key)&&!/^aAtlasIdx(?:[12]|Faces012|Faces345)$/.test(key)||/^aArmour/.test(key)&&key!=='aArmourTint'||/^aEnchantment/.test(key)&&!['aEnchantmentColour','aEnchantmentSpeed'].includes(key)||/^aHue/.test(key)&&key!=='aHueColour');
    if(exotic)return 'Source appearance attribute '+exotic+' is not implemented.';
    const materials=material?.subMaterials||[material];
    for(const item of materials){
      if(!item)return 'Source material is unavailable.';
      const plugins=materialPlugins(item),appearance=appearanceContract(item,mesh);
      if(plugins.some(p=>p.getClassName?.()==='CapeMaterialPlugin')&&(source.skeleton||material.subMaterials))return 'Combined source cape/bone or submaterial deformation is not implemented.';
      if(appearance.flags&1024){const selectors=vertexData(source,g,'texAtlasIndices');if(!selectors?.length||Array.from(selectors).some(v=>!Number.isInteger(v)||v<0||v>5))return 'Invalid per-face atlas selector.';}
      if(Object.keys(g._vertexBuffers||{}).some(key=>/^aAtlasIdx[12]$/.test(key)&&!(appearance.flags&(1|256))||/^aAtlasIdxFaces/.test(key)&&!(appearance.flags&1024)||key==='aArmourTint'&&!(appearance.flags&256)||key==='aHueColour'&&!(appearance.flags&512)||/^aEnchantment/.test(key)&&!(appearance.flags&2048)||key==='aOpacity'&&!(appearance.flags&4)||key==='aOverlayColour'&&!(appearance.flags&2)||key==='aLightLevels'&&!(appearance.flags&16)))return 'Source appearance attributes have no matching material contract.';
      const kind=item.getClassName?.();
      if(kind&&kind!=='StandardMaterial'&&kind!=='nY')return 'The source material shader is not implemented.';
      if(item.customShaderNameResolve)return 'Custom source shader resolution is not implemented.';
      if(item.fillMode!==undefined&&item.fillMode!==0)return 'Non-triangle material rendering is not implemented.';
      if(item.stencil?.enabled||item.disableColorWrite||item.needDepthPrePass||item.separateCullingPass||item.zOffset||item.zOffsetUnits)return 'Source stencil/depth-prepass/offset rendering is not implemented.';
      if(item.alphaMode!==undefined&&![0,1,2,3,4,6,7,8].includes(item.alphaMode))return 'The source blend mode is not implemented.';
      if(item.alphaEquation&&item.alphaEquation!==0||item.useLogarithmicDepth)return 'Source blend equations or logarithmic depth are not implemented.';
      if(item.bumpTexture||item.opacityTexture||item.emissiveTexture||item.reflectionTexture&&!mesh.infiniteDistance&&!mesh.metadata?.isSkybox)return 'Additional source material maps are not implemented.';
      const sky=mesh.infiniteDistance===true||mesh.metadata?.isSkybox===true;
      const descriptor=materialTextures(state.scene.getEngine()._gl,item,!!g._vertexBuffers?.texAtlasIndices,sky);
      if(appearance.flags&(1|256)&&(!descriptor||descriptor.pages[0].array||descriptor.pages[0].cube||descriptor.width%appearance.columns||descriptor.height%appearance.rows))return 'Lifeform/Armour needs a complete compatible 2D atlas.';
      if(appearance.flags&4096&&(!descriptor||descriptor.pages[0].array||descriptor.pages[0].cube))return 'TextSampler needs a complete compatible 2D texture.';
      if((item.diffuseTexture||item.albedoTexture||plugins.some(p=>p.textureAtlases))&&!descriptor)return 'Source color texture is not ready.';
      if(sky&&!descriptor?.pages[0]?.cube)return 'The source sky shader is not implemented.';
      const texture=item.diffuseTexture||item.albedoTexture;
      if(texture&&(texture.coordinatesIndex??0)!==0)return 'Secondary source UV coordinates are not implemented.';
      try{
        const world=matrixData(mesh.getWorldMatrix?.()||mesh.computeWorldMatrix?.(false));
        if(world?.length!==16||!finite(world))return 'Source world matrix is unavailable.';
        materialDrawState(mesh,source,item,world,descriptor?.pages[0]?.array===true,sky,materialBlended(item,mesh,item.alpha??1),materialAlphaTest(item,mesh));
      }catch(error){return error.message;}
    }
    return null;
  }
  function sceneRestriction(scene){
    const camera=scene.activeCamera||scene._activeCamera;
    if(state.presentationFault)return state.presentationFault;
    if(globalThis.__BVFX_DOCUMENT_START__)return 'Source visual shader mod programs are not implemented by the native renderer.';
    if(!camera)return 'Source camera is unavailable.';
    if(!config.fixture&&(!state.observer||!wrappers.some(w=>w.name==='drawElements')))return 'Source draw handover hooks are unavailable.';
    if(scene.activeCameras?.length>1||camera?.cameraRigMode>0)return 'Multiple source cameras are not implemented.';
    if(scene.postProcesses?.length||camera?._postProcesses?.some(Boolean)||scene.effectLayers?.some(layer=>layer.isEnabled!==false))return 'Source postprocessing is not implemented.';
    // The audited _renderSprites path skips a disabled stage and managers
    // excluded by the camera layer mask. No visibility/count/layout guesses:
    // an otherwise selected manager still needs its actual renderer contract.
    if(scene.spriteManagers?.length&&scene.spritesEnabled!==false){
      const mask=camera.layerMask;
      if(!Array.isArray(scene.spriteManagers)||Array.from(scene.spriteManagers).some(manager=>
        !Number.isInteger(mask)||!Number.isInteger(manager?.layerMask)||(mask&manager.layerMask)!==0))
        return 'Active source sprites have no audited renderer/data layout.';
    }
    try{registerGpu();for(const system of selectedParticles(scene))particleContract(system);}catch(error){return error.message;}
    return null;
  }
  async function pruneMeshes(selected){
    const removals=[];
    for(const [id,record] of state.meshes)if(!selected.has(record.mesh))removals.push(id);
    for(let at=0;at<removals.length;at+=8192)await send(packet(8,[state.epoch,Math.min(8192,removals.length-at),...removals.slice(at,at+8192)]));
    for(const id of removals)forgetMesh(id);
    const used=new Set([...state.meshes.values()].flatMap(record=>[record.texture,record.rampTexture]));for(const d of gpuFrame?.draws||[]){used.add(d.texture);used.add(d.ramp);}const unused=[...state.textures.keys()].filter(id=>!used.has(id));
    if(unused.length){
      const ids=new Set(unused);
      state.textureJobs=state.textureJobs.filter(job=>{if(!ids.has(job.texture.id))return true;releaseRead(job);return false;});
      for(let at=0;at<unused.length;at+=8192)await send(packet(16,[state.epoch,Math.min(8192,unused.length-at),...unused.slice(at,at+8192)]));
      for(const id of unused)state.textures.delete(id);
    }
  }
  async function renderControl(){
    const key=`${state.epoch}:${state.revision}:${state.ready}`;if(key===state.controlKey)return;
    await send(packet(15,[state.epoch,state.revision,state.ready?1:0]));state.controlKey=key;
  }
  function updateReadiness(){
    if(!emissionCurrent()){invalidate('Waiting for a fresh source emission frame.');return;}
    state.pendingMeshes=[...state.active].filter(mesh=>{const ids=exportedParts.get(mesh);return !ids?.size||[...ids].some(id=>!state.meshes.has(id));}).length;
    if(state.unsupportedMeshes||sceneRestriction(state.scene))return;
    const texturesReady=[...state.textures.values()].every(texture=>texture.complete);
    if(!sameSelection(selectedMeshes(state.scene),state.active))invalidate('Source draw selection changed.');
    else if(state.pendingMeshes||!texturesReady||!drawStatesCurrent())invalidate(state.pendingMeshes?'Native geometry is incomplete.':!texturesReady?'Native color textures are incomplete.':'Native draw group/camera state is incomplete.');
    else if((state.active.size||gpuSystems.size)&&!state.unsupportedMeshes&&!sceneRestriction(state.scene)&&(!gpuSystems.size||gpuSentFrame===gpuFrame?.frame)){state.ready=true;state.reason=null;}
  }
  function presentationState(){
    if(state.ready&&!emissionCurrent())invalidate('Source emission generation changed.');
    if(state.ready&&(!sameSelection(selectedMeshes(state.scene),state.active)||sceneRestriction(state.scene)||!drawStatesCurrent()))invalidate('Source draw selection or camera state changed.');
    return {ready:state.ready,epoch:state.epoch,revision:state.revision,reason:state.reason};
  }
  function sourceFPS(){
    try{const fps=state.scene?.getEngine?.()?.getFps?.();return Number.isFinite(fps)&&fps>=0&&fps<=1000?fps:null;}catch{return null;}
  }
  function observeSelection(scene){
    if(state.observer)state.observerScene.onAfterActiveMeshesEvaluationObservable.remove(state.observer);
    state.observer=null;state.observerScene=scene;
    const observable=scene?.onAfterActiveMeshesEvaluationObservable;
    if(typeof observable?.add!=='function'||typeof observable.remove!=='function')return;
    state.observer=observable.add(()=>{
      if(state.owned&&(!sameSelection(selectedMeshes(scene),state.active)||sceneRestriction(scene)||!drawStatesCurrent()))invalidate('Source draw selection or camera state changed.');
    });
  }
  async function reset(scene){
    instanceReset();
    emissionObserved=new WeakMap();emissionSent=[];
    for(const job of gpuReads)releaseRead(job);gpuReads.length=0;
    gpuSystems.clear();gpuAllocations.clear();gpuFrame=null;gpuSentFrame=-1;gpuExportBusy=false;gpuDirty=false;
    observeSourceFrame(null);
    observeDraws(new Set());observedViews=new WeakMap();
    invalidate('Waiting for a complete native scene.');observeSelection(scene);
    state.importEnabled=false;state.fallbackUntil=0;observeWrites(!!config.fixture,null);
    for(const job of state.textureJobs)releaseRead(job);state.textureJobs.length=0;
    state.scene=scene;++state.epoch;state.meshes.clear();state.textures.clear();state.textureIds=new WeakMap();exportedParts=new WeakMap();state.layout=null;state.scanAt=0;state.scanCursor=state.activeCursor=state.scanRound=0;state.origin=null;
    state.active=new Set();state.controlKey=null;state.pendingMeshes=state.unsupportedMeshes=0;state.presentationFault=null;
    sourceSerial=0;observeSourceFrame(scene);
    await send(packet(1,[state.epoch]));state.phase=scene?'streaming':'waiting-scene';
    await renderControl();
  }
  async function cameraFrame(scene){
    const current=sourceCamera(scene);if(!current)return;
    const s=sourceSnapshot,age=s?performance.now()-s.at:Infinity;
    const snapshot=s&&age>=0&&age<=250&&s.root===state.root&&s.camera===current.camera&&s.renderFrame===sourceRenderFrame(scene)&&s.revision===state.revision&&
      s.width===current.width&&s.height===current.height&&s.flags===current.flags&&samePlayer(s.player,playerSource(scene,current.camera))&&
      ['view','projection','position'].every(k=>s[k].every((v,i)=>v===current[k][i]))?s:null;
    if(snapshot&&!emissionCurrent()&&(lightSentFrame===snapshot.renderFrame||gpuSentFrame===snapshot.renderFrame)){
      invalidate('Waiting for a fresh source emission frame.');return;
    }
    if(gpuSystems.size){
      if(!snapshot||!gpuCurrent()){invalidate('Source GPU render frame is unavailable or stale.');return;}
      if(gpuExportBusy||gpuSentFrame===snapshot.renderFrame)return;
      gpuExportBusy=true;const observed=gpuFrame,epoch=state.epoch;
      try{
      // The packet age starts at the first actual draw, not at post-render/export.
      const captured={...snapshot,at:Math.min(snapshot.at,...observed.draws.map(d=>d.at)),utc:Math.min(snapshot.utc,...observed.draws.map(d=>d.utc))};
      const out=emissionPacket(lightPacket(gpuPacket(sourceFramePacket(current,captured),observed),captured),captured);for(const d of observed.draws){await syncTextureSampling(d.texture);await syncTextureSampling(d.ramp);}if(epoch!==state.epoch||!emissionCurrent())return;await send(out);gpuSentFrame=snapshot.renderFrame;
      }finally{gpuExportBusy=false;}
    }else {if((snapshot?.light||snapshot?.emissions?.length)&&lightSentFrame===snapshot.renderFrame&&emissionCurrent())return;await send(emissionPacket(lightPacket(sourceFramePacket(current,snapshot),snapshot),snapshot));lightSentFrame=snapshot?.light||snapshot?.emissions?.length?snapshot.renderFrame:-1;gpuSentFrame=-1;}gpuDirty=false;++state.cameraFrames;
    if(scene===state.scene)await environmentFrame(scene,current.camera);
  }
  async function environmentFrame(scene,camera){
    const directional=(scene.lights||[]).find(light=>light?.getTypeID?.()===1&&light.isEnabled?.()!==false&&light.direction);
    const direction=directional?.direction,color=directional?.diffuse,intensity=Number.isFinite(directional?.intensity)?directional.intensity:1;
    let sun=[0,1,0],sunColor=[1,1,1],sunKnown=false;
    if(direction&&color){const length=Math.hypot(direction.x,direction.y,direction.z);
      if(Number.isFinite(length)&&length>1e-6){sun=[-direction.x/length,-direction.y/length,-direction.z/length];sunColor=[color.r,color.g,color.b].map(v=>v*intensity);sunKnown=finite(sunColor)&&sunColor.every(v=>v>=0);}}
    const fogMode=Number.isInteger(scene.fogMode)&&scene.fogMode>=0&&scene.fogMode<=3?scene.fogMode:0;
    const fog=scene.fogColor||{r:clearValue(scene,'r'),g:clearValue(scene,'g'),b:clearValue(scene,'b')};
    const start=Number.isFinite(scene.fogStart)?scene.fogStart:0,end=Number.isFinite(scene.fogEnd)?scene.fogEnd:256,density=Number.isFinite(scene.fogDensity)?scene.fogDensity:0;
    const near=Number.isFinite(camera.minZ)&&camera.minZ>0?camera.minZ:.1,far=Number.isFinite(camera.maxZ)&&camera.maxZ>near?camera.maxZ:256;
    const fogEnabled=scene.fogEnabled!==false&&fogMode>0&&density>=0&&(fogMode!==3||end>start);
    const values=[...sun,...(sunKnown?sunColor:[1,1,1]),fog.r,fog.g,fog.b,start,end,Math.max(0,density),near,far,Math.max(0,performance.now()/1000)];
    if(!finite(values))throw Error('Invalid source environment values.');
    await send(packet(13,[state.epoch,(sunKnown?1:0)|(fogEnabled?2:0),fogMode],values));
  }
  function clearValue(scene,key){return Number.isFinite(scene.clearColor?.[key])?scene.clearColor[key]:0;}
  async function tick(force=false){
    if(state.busy||state.stopped||!state.api||(state.paused&&!force))return;
    if(!force&&performance.now()<state.fallbackUntil){++state.idleSkips;state.tickMs=0;return;}
    state.busy=true;const tickAt=performance.now();
    try{
      const scene=findScene(state.api);if(scene!==state.scene)await reset(scene);if(!scene)return;
      installInstanceObserver();
      for(const [worker,e] of meshingWorkers)if(e.root!==state.root||e.manager!==state.root?.Is||!e.manager.workers.includes(worker))dropMeshingWorker(worker);
      const resident=new Set([...selectedMeshes(scene)].map(m=>dataField(dataField(geometry(m)?._vertexBuffers?.position,'_buffer'),'_data')?.buffer));
      for(const [buffer,p] of meshingProofs)if(!resident.has(buffer)){
        releaseMeshingProof(buffer,p);
      }
      pollGpuReads();
      const gl=scene.getEngine()?._gl;if(!gl||typeof gl.framebufferTextureLayer!=='function'){invalidate('The capture bridge requires Bloxd WebGL2.');await renderControl();state.phase='unsupported-backend';state.error=state.reason;return;}
      if(!config.fixture){const rect=gl.canvas?.getBoundingClientRect?.();if(!rect||rect.width<320||rect.height<180){invalidate('Waiting for a source world canvas.');await renderControl();if(state.meshes.size)await reset(scene);state.phase='waiting-world';return;}}
      if(state.originRoot!==state.root){state.originRoot=state.root;state.originKey=String(state.root?.constructor||'').match(/this\.([\w$]+)=\[0,0,0\]/)?.[1]||null;}
      const origin=state.originKey&&state.root[state.originKey];
      if(origin?.length===3&&finite(origin)){
        if(state.origin&&origin.some((v,i)=>v!==state.origin[i])){
          const shift=origin.map((v,i)=>state.origin[i]-v);await send(packet(10,[state.epoch],shift));
          for(const record of state.meshes.values())for(let i=0;i<3;++i)record.world[12+i]+=shift[i];++state.rebases;
        }
        if(!state.origin||origin.some((v,i)=>v!==state.origin[i])){const high=Array.from(origin,Math.fround);await send(packet(22,[state.epoch,1],[...high,...Array.from(origin,(v,i)=>v-high[i])]));}
        state.origin=Array.from(origin);
      }else if(state.origin){await send(packet(22,[state.epoch,0],[0,0,0,0,0,0]));state.origin=null;sourceSnapshot=null;}
      const selected=selectedMeshes(scene);
      if(!sameSelection(selected,state.active))invalidate('Source draw selection changed.');
      state.active=selected||new Set();
      let restriction=selected?sceneRestriction(scene):'Source active draw selection is unavailable.';
      state.unsupportedMeshes=0;
      if(!restriction)for(const mesh of selected){
        try{const reason=unsupportedMesh(mesh);if(reason){++state.unsupportedMeshes;restriction||=reason;}}
        catch(error){++state.unsupportedMeshes;restriction||=String(error.message||error);}
      }
      if(!restriction){
        observeDraws(selected);
        for(const mesh of selected)if(observedCameraNeeded(mesh))try{sourceDrawState(mesh,mesh.material||mesh.sourceMesh?.material);}catch(error){++state.unsupportedMeshes;restriction=error.message;break;}
      }else observeDraws(new Set());
      if(restriction){
        invalidate(restriction);state.pendingMeshes=state.active.size;
        state.importEnabled=false;await renderControl();await pruneMeshes(new Set());observeWrites(gpuSystems.size>0,gl);
        state.fallbackUntil=performance.now()+250;state.phase='streaming';return;
      }
      state.importEnabled=true;state.fallbackUntil=0;observeWrites(true,gl);
      if(force||config.fixture||gpuSystems.size||gpuDirty)await cameraFrame(scene);
      await pruneMeshes(state.active);
      if(!state.active.size&&!gpuSystems.size){invalidate('Source draw selection is empty.');state.pendingMeshes=0;state.importEnabled=false;observeWrites(false,gl);await renderControl();state.phase='streaming';return;}
      const now=performance.now();
      if(force||now-state.scanAt>32){
        state.scanAt=now;let uploaded=0,visited=0;const scanStart=performance.now(),seen=new Set();
        const pending=[],existing=[];
        for(const mesh of state.active){const ids=exportedParts.get(mesh);(ids?.size&&[...ids].every(id=>state.meshes.has(id))?existing:pending).push(mesh);}
        const total=existing.length;
        const exhausted=()=>!force&&(uploaded>=16||visited>=64||performance.now()-scanStart>=4);
        async function visit(mesh){
          if(seen.has(mesh))return;seen.add(mesh);++visited;
          if(!mesh||mesh.isVisible===false||mesh.visibility===0||mesh.isEnabled?.()===false)return;
          try{const before=state.meshUploads;await uploadMesh(mesh,gl);uploaded+=state.meshUploads-before;}catch(error){
            ++state.skipped;state.error=error.message;invalidate('A source mesh could not be exported.');
            const keep=new Set(state.active);keep.delete(mesh);await pruneMeshes(keep);
          }
        }
        // Respect the engine's active list, including its distance/visibility
        // decisions. Cached scene templates are not an extra world draw list.
        for(const mesh of pending){if(exhausted())break;await visit(mesh);}
        for(let i=0;i<total&&!exhausted();++i){
          const index=force?i:state.activeCursor%total;state.activeCursor=(index+1)%total;
          await visit(existing[index]);
        }
        state.scanVisited=visited;
      }
      await pumpTextures(gl);
      updateReadiness();
      await renderControl();state.phase='streaming';
    }catch(error){state.error=error.message;state.phase='error';invalidate('Native capture failed.');try{await renderControl();}catch{}}finally{state.busy=false;state.tickMs=performance.now()-tickAt;state.maxTickMs=Math.max(state.maxTickMs,state.tickMs);}
  }
  const timer=setInterval(()=>void tick(),33);
  // Camera updates must not wait for a complete geometry/texture scan. One
  // pending camera invocation bounds its queue even if the native pipe is busy.
  const cameraTimer=config.fixture?null:setInterval(async()=>{
    if(state.stopped||state.paused||state.cameraBusy||!state.importEnabled||state.phase!=='streaming'||!state.scene)return;
    const gl=state.scene.getEngine()?._gl,rect=gl?.canvas?.getBoundingClientRect?.();
    if(!rect||rect.width<320||rect.height<180)return;
    state.cameraBusy=true;
    try{await cameraFrame(state.scene);}catch(error){state.error=error.message;}finally{state.cameraBusy=false;}
  },33);
  async function waitIdle(){for(let i=0;i<1000&&(state.busy||state.cameraBusy);++i)await new Promise(r=>setTimeout(r,10));if(state.busy||state.cameraBusy)throw Error('Capture did not become idle.');}
  const api={
    canvas:()=>state.scene?.getEngine?.()?._gl?.canvas||null,
    presentation:presentationState,
    rejectPresentation:reason=>{state.presentationFault=String(reason||'Native presentation failed.').slice(0,200);invalidate(state.presentationFault);},
    setPresentation:(owned,epoch,revision)=>{if(owned===true)presentationState();state.owned=owned===true&&state.ready&&state.epoch===epoch&&state.revision===revision&&!state.stopped;if(state.owned)state.presentedAt=performance.now();return state.owned;},
    status:()=>({sourceMaterialDefinitions:materialRecords.size,sourceEmissionSnapshotBytes:materialBytes+instanceBytes+meshingProofBytes+[...meshingWorkers.values()].reduce((n,e)=>n+e.packed.byteLength+e.known.byteLength,0),sourceEmissionWorkers:meshingWorkers.size,sourceInstanceProofs:instanceRecords.size,phase:state.phase,epoch:state.epoch,meshes:state.meshes.size,textures:state.textures.size,pendingTextures:[...state.textures.values()].filter(t=>!t.complete).length,pendingTextureLayers:[...state.textures.values()].reduce((n,t)=>n+[...t.required].filter(layer=>!t.loaded.has(layer)).length,0),textureJobs:state.textureJobs.length,readbackMode:state.readbackMode,rebases:state.rebases,bytes:state.bytes,cameraFrames:state.cameraFrames,meshUploads:state.meshUploads,poseUpdates:state.poseUpdates,materialUpdates:state.materialUpdates,surfaceUpdates:state.surfaceUpdates,textureChunks:state.textureChunks,skipped:state.skipped,error:state.error,tickMs:state.tickMs,maxTickMs:state.maxTickMs,textureReadMs:state.textureReadMs,maxTextureReadMs:state.maxTextureReadMs,scanVisited:state.scanVisited,
      nativeReady:state.ready,sourceDrawsSuppressed:state.owned,suppressedDraws:state.suppressedDraws,activeMeshes:state.active.size,pendingMeshes:state.pendingMeshes,unsupportedMeshes:state.unsupportedMeshes,fallbackReason:state.reason,revision:state.revision,importEnabled:state.importEnabled,trackingWrites:state.observeWrites,idleSkips:state.idleSkips,trackedCalls:state.trackedCalls,sourceFPS:sourceFPS()}),
    resync:async()=>{state.paused=true;try{await waitIdle();await reset(state.scene);await tick(true);}finally{state.paused=false;}},
    flush:async()=>{state.paused=true;try{await waitIdle();await tick(true);state.busy=true;for(let i=0;i<1000&&[...state.textures.values()].some(t=>!t.complete);++i){await pumpTextures(state.scene.getEngine()._gl);if(state.textureJobs.length)await new Promise(r=>setTimeout(r,4));}if([...state.textures.values()].some(t=>!t.complete))throw Error('Texture readback did not finish within the flush limit.');if(state.scene){updateReadiness();await renderControl();}}finally{state.busy=false;state.paused=false;}},
    snapshot:async stage=>{await api.flush();await send(packet(7,[state.epoch,stage]));},
    stop:()=>{instanceReset();resetMeshing();emissionSent=[];for(const job of gpuReads)releaseRead(job);gpuReads.length=0;gpuSystems.clear();gpuAllocations.clear();state.stopped=true;invalidate('Native capture stopped.');observeSelection(null);observeDraws(new Set());observeSourceFrame(null);clearInterval(timer);if(cameraTimer!==null)clearInterval(cameraTimer);clearInterval(statusTimer);clearTimeout(captureTimeout);for(const job of state.textureJobs)releaseRead(job);state.textureJobs.length=0;restoreCapture();for(const w of wrappers.reverse())if(w.proto[w.name]===w.wrapped)w.proto[w.name]=w.original;}
  };
  const statusTimer=setInterval(()=>{if(sink.status)sink.status({...api.status(),presentation:globalThis.__BLOXD_NATIVE_PRESENTER__?.status?.()||null});},500);
  globalThis.__BLOXD_NATIVE_CAPTURE__=api;
  addEventListener('pagehide',api.stop,{once:true});
};
