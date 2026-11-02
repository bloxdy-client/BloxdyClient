'use strict';
// Adapt only the verified launcher copy. No changes to original mod packages.
function createSamplerValueCache(){
 let programs=new WeakMap();
 const split=name=>{const m=/\[(\d+)\]$/.exec(name);return {name:m?name.slice(0,m.index):name,index:m?Number(m[1]):0};};
 const find=(program,name)=>{const key=split(name);return {entry:programs.get(program)?.get(key.name),index:key.index};};
 const invalidate=entry=>{if(entry)entry.known.fill(0);};
 return {
  mark(program,name,size,limit){
   if(!Number.isInteger(size)||size<1||size>4096||!Number.isInteger(limit)||limit<1)return;
   let entries=programs.get(program);if(!entries){entries=new Map();programs.set(program,entries);}
   const key=split(name).name,previous=entries.get(key);
   if(previous?.values.length===size&&previous.limit===limit)return;
   entries.set(key,{values:new Int32Array(size),known:new Uint8Array(size),limit});
  },
  read(program,name){const {entry,index}=find(program,name);if(!entry||index!==0||!entry.known.every(Boolean))return undefined;return entry.values.length===1?entry.values[0]:entry.values;},
  seed(program,name,value){
   const {entry,index}=find(program,name);if(!entry||index!==0)return;
   const count=typeof value==='number'?1:value?.length;
   if(count!==entry.values.length)return invalidate(entry);
   for(let i=0;i<count;i++){const v=count===1&&typeof value==='number'?value:value[i];if(!Number.isInteger(v)||v<0||v>=entry.limit)return invalidate(entry);}
   for(let i=0;i<count;i++)entry.values[i]=count===1&&typeof value==='number'?value:value[i];entry.known.fill(1);
  },
  write(program,name,value,offset=0,length=0){
   const {entry,index}=find(program,name);if(!entry)return true;
   const scalar=typeof value==='number',count=scalar?1:length||((value?.length||0)-offset);
   if(!Number.isInteger(offset)||offset<0||!Number.isInteger(count)||count<1||index+count>entry.values.length
       || (!scalar&&offset+count>value?.length)){invalidate(entry);return true;}
   for(let i=0;i<count;i++){const v=scalar?value:value[offset+i];if(!Number.isInteger(v)||v<0||v>=entry.limit){invalidate(entry);return true;}}
   let changed=false;for(let i=0;i<count;i++){const v=scalar?value:value[offset+i],at=index+i;if(!entry.known[at]||entry.values[at]!==v)changed=true;entry.values[at]=v;entry.known[at]=1;}return changed;
  },
  invalidate(program,name){invalidate(find(program,name).entry);},
  reset(program){programs.delete(program);},clear(){programs=new WeakMap();}
 };
}
function captureWatchedUniform(entry,meta,method,args,state){
 entry.value=undefined;entry.valueRevision=-1;
 const spec=entry.capture;
 if(!spec?.method || spec.size!==1 || !meta || /\[/.test(meta.sourceName)
     || !state.programKnown || state.currentProgram!==meta.program
     || meta.link!==(state.linkRevisions.get(meta.program)||0))return;
 const matrix=spec.method.startsWith('uniformMatrix');
 if(method!==spec.method && (matrix || method!==spec.method.slice(0,-1)))return;
 const dimensions=spec.method.match(/Matrix(\d)(?:x(\d))?/);
 const count=matrix?Number(dimensions[1])*Number(dimensions[2] || dimensions[1]):Number(spec.method.match(/^uniform(\d)/)[1]);
 let values;
 if(matrix || method.endsWith('v')){
  if(matrix && Boolean(args[1]))return;
  const at=matrix?2:1,source=args[at],offset=Number(args[at+1]??0),length=Number(args[at+2]??0);
  if(!(Array.isArray(source)||ArrayBuffer.isView(source)) || !Number.isInteger(offset) || offset<0
      || !Number.isInteger(length) || length<0 || (length || source.length-offset)!==count || offset+count>source.length)return;
  values=Array.from(source).slice(offset,offset+count);
 }else{if(args.length<count+1)return;values=args.slice(1,count+1);}
 const ArrayType=spec.method.includes('uiv')?Uint32Array:spec.method.endsWith('iv')?Int32Array:Float32Array;
 entry.value=new ArrayType(values);entry.valueRevision=entry.revision;
}
function adaptShaderPerformance(name,source){
 const edit=(from,to)=>{if(!source.includes(from))throw Error('Shader performance adapter mismatch: '+name+' / '+from.slice(0,65));source=source.replace(from,()=>to);};
 if(name==='bootstrap.js'){
  edit('s={active:null,blend:null,bindings:',`s={samplerValues:(${createSamplerValueCache.toString()})(),currentProgram:null,programKnown:false,active:null,blend:null,bindings:`);
  edit('s.active=null;s.blend=null;s.bindings.clear();', 's.samplerValues.clear();s.programKnown=false;s.currentProgram=null;s.active=null;s.blend=null;s.bindings.clear();');
  edit("    wrap('activeTexture'", "    wrap('useProgram',(_gl,s,[program])=>{s.currentProgram=program;s.programKnown=true;});\n    wrap('activeTexture'");
  edit('const integers=new WeakMap(), locations=new WeakMap();','const locations=new WeakMap();');
  edit("locations.set(loc,{program,name:name.replace(/\\[\\d+\\]$/,''),own:/^uBvfx/.test(name)})", "locations.set(loc,{program,name:name.replace(/\\[\\d+\\]$/,''),sourceName:name,link:state(this).linkRevisions.get(program)||0,own:/^uBvfx/.test(name)})");
  const from=source.indexOf('    const changed=(s,loc)=>'),to=source.indexOf('    // Watch only uniforms copied',from);
  if(from<0||to<0)throw Error('Sampler write tracker mismatch.');
  source=source.slice(0,from)+`    const changed=(s,loc,value,offset,length)=>{const entry=loc && locations.get(loc);
      if(!entry || entry.own || entry.link!==(s.linkRevisions.get(entry.program)||0)
          || (!s.samplerLocations.has(loc) && !s.samplerNames.get(entry.program)?.has(entry.name)))return;
      if(!s.programKnown || s.currentProgram!==entry.program)s.samplerValues.invalidate(entry.program,entry.sourceName);
      else if(!s.samplerValues.write(entry.program,entry.sourceName,value,offset,length))return;
      s.programRevisions.set(entry.program,(s.programRevisions.get(entry.program)||0)+1);s.samplerRevision++;
    };
    wrap('uniform1i',(_gl,s,[loc,value])=>changed(s,loc,value));
    wrap('uniform1iv',(_gl,s,[loc,value,offset,length])=>changed(s,loc,value,offset,length));
`+source.slice(to);
  edit('s.samplerNames.delete(program);s.watchedBlocks.delete(program);','s.samplerValues.reset(program);s.samplerNames.delete(program);s.watchedBlocks.delete(program);');
  edit('    // Watch only uniforms copied',`    const captureWatchedUniform=(${captureWatchedUniform.toString()});\n    // Watch only uniforms copied`);
  edit('wrap(name,(_gl,s,[loc])=>{','wrap(name,(_gl,s,args)=>{const [loc]=args;');
  edit('        if(entry)entry.revision++;','        if(entry){entry.revision++;captureWatchedUniform(entry,meta,name,args,s);}');
 }
 if(name==='atmosphere.js'){
  edit('uniforms.push({from,to,type:uniform.type,affectsCycle:', 'uniforms.push({from,to,type:uniform.type,size:uniform.size,affectsCycle:');
  edit('        const watched=tracker?.watchUniform?.(uniform.from);', '        const watched=tracker?.watchUniform?.(uniform.from);\n        if(watched)watched.capture={method:matrix || vector,size:uniform.size};');
  edit('const value=gl.getUniform(source,uniform.from);if(value===null)continue;', 'const value=watched?.valueRevision===watched?.revision && watched?.value!==undefined\n          ? watched.value:gl.getUniform(source,uniform.from);if(value===null)continue;');
 }
 if(name==='shader.js'){
  // 16k shadow maps are not a useful playable setting: one depth image can
  // consume about a GiB. Keep the UI and saved-setting clamp in agreement.
  edit('Math.min(14,Math.round(Number(stored.sunResolutionExponent)))','Math.min(12,Math.round(Number(stored.sunResolutionExponent)))');
  edit('Math.min(14,11+Math.round(', 'Math.min(12,11+Math.round(');
  edit("['sunResolutionExponent', 'Shadow resolution', 5, 14,", "['sunResolutionExponent', 'Shadow resolution', 5, 12,");
  // The regular game settings menu needs a tab, not every shader control.
  // Build controls detached on explicit selection and retain them offscreen
  // between menu opens. Opening unrelated menus never constructs this tree.
  edit("      page.append(makeNativeCheckbox('enabled', 'Shader enabled'));",`      const buildPage=()=>{
      if(cachedShaderUi.built)return;
      page.append(makeNativeCheckbox('enabled', 'Shader enabled'));`);
  edit('      statusBox.append(statusText, versionText); page.append(statusBox);\n      right.append(page);',`      statusBox.append(statusText, versionText); page.append(statusBox);
      cachedShaderUi.built=true;
      };`);
  edit('        right.append(page);',`        tab.classList.remove('ActiveMenuSideBarBodyTab');
        tab.setAttribute('aria-selected','false');state.panelOpen=false;`);
  edit('      cachedShaderUi = {page,tab};','      cachedShaderUi = {page,tab,build:buildPage,built:false};');
  source=source.replaceAll('settingsBinding={menu,page,tab,previous:null};','settingsBinding={menu,page,tab,right,previous:null};')
   .replaceAll('settingsBinding = { menu, page, tab, previous: null };','settingsBinding = { menu, page, tab, right, previous: null };');
  edit('!settingsBinding.page.isConnected || !settingsBinding.tab.isConnected','settingsBinding.right!==right || !settingsBinding.tab.isConnected');
  edit('    const { menu, tab } = settingsBinding;\n    if (active) {',`    const { menu, tab, page, right } = settingsBinding;
    if(active){cachedShaderUi.build();if(page.parentElement!==right)right.append(page);}
    else page.remove();
    if (active) {`);
  edit('    if (!settingsBinding) {settingsUiDirty=true;return;}',`    if (!settingsBinding || !cachedShaderUi?.built
        || !settingsBinding.menu.classList.contains('bvfx-shader-selected')) {settingsUiDirty=true;return;}`);
  edit('!settingsBinding.page.isConnected || !settingsBinding.tab.isConnected','!settingsBinding.right.isConnected || !settingsBinding.tab.isConnected');
  edit("          if (node.nodeType !== 1) continue;",`          if (node.nodeType !== 1 || node.id===shaderSettingsId || node.matches?.('[data-shader-category]')) continue;`);
 }
 if(name==='sun-shadows.js'){
  // Native chunk uploads now rewrite existing interleaved buffers. Object
  // identity and mesh membership no longer prove unchanged shadow geometry.
  edit('const terrainFrames=new WeakMap();','const terrainFrames=new WeakMap(),terrainRevisions=new WeakMap();\n    let terrainRevision=0;');
  edit('function geometry(gl,mesh,maskKind=null){',`function invalidateTerrain(meshes){
      let changed=false,unknown=false;
      for(const mesh of meshes || []){
        const source=mesh?.sourceMesh || mesh;if(!source)continue;
        const revision=++terrainRevision;terrainRevisions.set(source,revision);
        terrainFrames.delete(source);incompleteTerrain.delete(source);
        if(registryCache){
          if(!registryCache.sceneCasters.has(mesh))unknown=true;
          else {const token=staticTokens.get(mesh);if(token){token[3]=revision;changed=true;}}
        }
      }
      if(unknown)registryCache=null;
      else if(changed && registryCache)registryCache.staticRevision=++staticRevision;
    }
    function geometry(gl,mesh,maskKind=null){`);
  edit('const source = mesh.sourceMesh || mesh;', 'const source = mesh.sourceMesh || mesh;\n      const revision=terrainRevisions.get(source)||0;');
  edit('const sameBuffers=entry?.positionBuffer===positionBuffer','const sameBuffers=entry?.terrainRevision===revision && entry?.positionBuffer===positionBuffer');
  edit('|| entry?.poseFrame===shadowFrame)', '|| entry?.poseFrame===shadowFrame && entry?.terrainRevision===revision)');
  edit('if (entry.positions !== positions || entry.positionBuffer!==positionBuffer || animated || mutable)', 'if (entry.terrainRevision!==revision || entry.positions !== positions || entry.positionBuffer!==positionBuffer || animated || mutable)');
  edit('if (entry.indexSource !== indices || mutable)', 'if (entry.terrainRevision!==revision || entry.indexSource !== indices || mutable)');
  edit('if(entry.uvSource!==uv || mutable)', 'if(entry.terrainRevision!==revision || entry.uvSource!==uv || mutable)');
  edit('if(entry.atlasSource!==atlas || mutable)', 'if(entry.terrainRevision!==revision || entry.atlasSource!==atlas || mutable)');
  edit('entry.positionBuffer=positionBuffer;', 'entry.terrainRevision=revision;entry.positionBuffer=positionBuffer;');
  edit('|| previous[2]!==fingerprint)staticChanged=true;', '|| previous[2]!==fingerprint || previous[3]!==(terrainRevisions.get(mesh)||0))staticChanged=true;');
  edit('nextStaticTokens.set(mesh,[geometry,indices,fingerprint]);','nextStaticTokens.set(mesh,[geometry,indices,fingerprint,terrainRevisions.get(mesh)||0]);');
  edit('return { qualities, attach, patch, locations, bind, render, refresh,', 'return { invalidateTerrain, qualities, attach, patch, locations, bind, render, refresh,');
  // Keep up to 4k for the close terrain cascade. Auxiliary world/entity maps
  // use at most 2k each: four resident Depth24 maps total <=112 MiB logical
  // storage, instead of several 16k images. GPU allocation can add overhead.
  edit('const qualities = [32,64,128,256,512,1024,2048,4096,8192,16384];','const qualities = [32,64,128,256,512,1024,2048,4096];');
  edit('const safeAllocationCap = 16384;','const safeAllocationCap = 4096;');
  edit('Math.min(14,Math.round(settings.sunResolutionExponent))','Math.min(12,Math.round(settings.sunResolutionExponent))');
  edit('size:farSize, localSize,localRadius,detailSize:selectedSize,detailRadius,','size:Math.min(farSize,2048),localSize:Math.min(localSize,2048),localRadius,detailSize:selectedSize,detailRadius,');
  edit(':Math.min(q.selectedSize,getSafeAllocationLimit())',':Math.min(q.selectedSize,2048,getSafeAllocationLimit())');
  // Observe actual scene membership changes instead of re-walking the whole
  // scene for every transient hit/menu helper. Keep the count-based fallback
  // and periodic discovery for runtimes without these source observables.
  edit('    function sameSceneCasters(registry) {',`    let casterScene=null,casterAdded=null,casterRemoved=null;
    function observeCasterScene(next){
      if(next===casterScene)return;
      registryCache=null;
      if(casterScene){
        if(casterAdded!=null)casterScene.onNewMeshAddedObservable.remove(casterAdded);
        if(casterRemoved!=null)casterScene.onMeshRemovedObservable.remove(casterRemoved);
      }
      casterScene=null;casterAdded=casterRemoved=null;
      if(typeof next?.onNewMeshAddedObservable?.add!=='function' || typeof next?.onNewMeshAddedObservable?.remove!=='function'
          || typeof next?.onMeshRemovedObservable?.add!=='function' || typeof next?.onMeshRemovedObservable?.remove!=='function')return;
      const changed=(mesh,removed)=>{
        if(!registryCache || registryScene!==next)return;
        try{
        if(removed?registryCache.sceneCasters.has(mesh)
            :!mesh.isDisposed?.() && registeredCaster(mesh,registryCache) && !casterRejection(mesh,registryCache.batches.has(mesh)))registryCache=null;
        else {if(!removed)registryCache.knownSceneMeshes.add(mesh);registryCache.meshCount=next.meshes.length;}
        }catch{registryCache=null;}
      };
      try{
        casterAdded=next.onNewMeshAddedObservable.add(mesh=>changed(mesh,false));
        casterRemoved=next.onMeshRemovedObservable.add(mesh=>changed(mesh,true));casterScene=next;
      }catch{
        if(casterAdded!=null)next.onNewMeshAddedObservable.remove(casterAdded);
        if(casterRemoved!=null)next.onMeshRemovedObservable.remove(casterRemoved);
        casterAdded=casterRemoved=null;
      }
    }
    function sameSceneCasters(registry) {`);
  edit('    function attach(nextScene, nextGame=game) {','    function attach(nextScene, nextGame=game) {\n      observeCasterScene(enabled()?nextScene:null);');
 }
 return source;
}
module.exports={adaptShaderPerformance,createSamplerValueCache,captureWatchedUniform};
