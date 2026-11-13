// Own shader code, compiled through Bloxd's native API. Never installs,
// selects, downloads or saves a shader pack, or changes account/profile data.
function installNativeShaderBridge(root,helpers){
 'use strict';
 const host=root.__BLOXD_MOD_HOST__;
 if(!host?.observeDefinitions)throw Error('Native shadows need the mod host');
 let settings={enabled:true,blockShadows:true,entityShadows:true,sunStrength:.75,shadowDistance:128},message='Waiting for original Bloxd renderer';
 let compilerLoader=null,textureLoader=null,textures=null,validator=null,compiled=null,compilePromise=null,report=null,stopped=false,environment=null;
 const pages=new WeakSet(),factories=new WeakSet(),backends=new WeakSet(),adapters=new Set(),undo=[];
 const source=helpers.source(),files=[{path:'bloxdy-client.wgsl',source}];
 const options=()=>({...helpers.options(settings),direction:environment?.atmosphere?.sunDirection?.()||null});
 function status(text){message=text;report?.(text);}
 function failure(error){
  const detail=String(error?.message||error).replace(/[\u0000-\u001f]+/g,' ').slice(0,1200);
  status('Native shadows unavailable: '+detail);
  // Compiler diagnostics contain our shader/ABI messages only. Keep one
  // bounded line in the existing log instead of hiding it behind the modal.
  root.console?.error('[Bloxdy native shaders] '+detail);
 }
 function replace(owner,key,value){const before=Object.getOwnPropertyDescriptor(owner,key);if(before&&!before.writable&&!before.set)throw Error('Native extension point is read-only: '+key);owner[key]=value;undo.push(()=>{if(owner[key]!==value)return;if(before)Object.defineProperty(owner,key,before);else delete owner[key];});}
 async function compile(){
  if(compiled)return compiled;
  if(compilePromise)return compilePromise;
  compilePromise=(async()=>{
   if(!compilerLoader||!textureLoader||!textures||!validator)throw Error('Original shader compiler contracts unavailable');
   status('Compiling Bloxdy native shadows');
   await textureLoader();const compiler=await compilerLoader();if(!compiler)throw Error('Original shader compiler unavailable');
   const validation=await validator(compiler,files);
   if(!validation?.ok)throw Error(validation?.errors?.map(x=>x.message).join('; ')||'Native WebGPU validation unavailable');
   const result=compiler.Fno(files,textures());
   if(result.errors?.length)throw Error(result.errors.map(x=>x.message).join('; '));
   if(result.variants.length!==6||result.variants.some(v=>!v.sunShadow))throw Error('Native compiler did not retain all shadow receivers');
   // Validate the precise post-compile patch contract before handing any
   // variants to the game. The real native factories validate the full GPU
   // programs after their engine prelude has been added.
   for(const variant of result.variants){
    if(!variant.moduleCode.includes('bvfxShadowStrength')||!variant.moduleCode.includes('bvfxShadowDistance'))throw Error('Native compiler changed the parameter helpers');
   }
   compiled={status:'active',pack:{name:'Bloxdy Client shaders',variants:result.variants,keepCircleShadows:false}};
   status('Bloxdy native shaders prepared');return compiled;
  })().catch(error=>{failure(error);throw error;});
  return compilePromise;
 }
 function preparePage(Class){
  if(pages.has(Class)||!Class?.prototype||typeof Class.prototype.load!=='function'||typeof Class.prototype.loadActive!=='function')return;
  pages.add(Class);
  // Reuse only the ephemeral per-page compiler result. The original stored
  // pack, settings selection and save/remove methods are untouched.
  replace(Class.prototype,'load',function(){
   return this.pagePack??=Promise.resolve().then(()=>this.compiler()).then(()=>compile())
    .catch(()=>({status:'blocked',messageKey:'shaderPack:failedToCompile',variants:null}))
    .then(result=>(this.resolved=result,result));
  });
 }
 function nativeObject(record){
  const matches=Object.values(Object.getOwnPropertyDescriptors(record||{})).filter(d=>'value'in d).map(d=>d.value)
   .filter(v=>v?.gpuDevice&&v.sunShadow&&v.terrain&&v.meshes&&typeof v.drawFrame==='function');
  if(record?.sunShadow&&record?.terrain&&record?.meshes&&typeof record.drawFrame==='function')matches.push(record);
  return [...new Set(matches)].length===1?matches[0]:null;
 }
 function prepareFactory(factory){
  if(factories.has(factory)||typeof factory?.load!=='function'||!String(factory.load).includes('createLiteRendererAsync'))return;
  factories.add(factory);const load=factory.load;
  replace(factory,'load',async function(...args){
   const backend=await load.apply(this,args);
   if(!backend||typeof backend.create!=='function')throw Error('Original WebGPU factory contract changed');
   if(!backends.has(backend)){
    backends.add(backend);const create=backend.create;
    replace(backend,'create',async function(...parameters){
     const record=await create.apply(this,parameters),native=nativeObject(record);
     if(!native)throw Error('Original shadow resources not created');
     let shadows,effects;
     try{
      shadows=helpers.attach(native,options,helpers.patch);
      if(helpers.effects){if(!environment)throw Error('Native atmosphere has not been initialized');effects=await helpers.effects(native,settings,environment.atmosphere,environment);}
     }catch(error){failure(error);effects?.dispose();shadows?.dispose(true);record.dispose?.();throw error;}
     const adapter={dispose(lost=false){effects?.dispose();shadows.dispose(lost);},diagnostics:()=>({...shadows.diagnostics(),effects:effects?.diagnostics()||null})};adapters.add(adapter);
     if(typeof record.dispose==='function'){const dispose=record.dispose;replace(record,'dispose',function(...args){adapter.dispose(true);adapters.delete(adapter);return dispose.apply(this,args);});}
     native.gpuDevice.lost.then(()=>{adapter.dispose(true);adapters.delete(adapter);if(!stopped)status('Native shadow device lost');});
     status('Bloxd original shadows · Bloxdy controls');return record;
    });
   }
   return backend;
  });
 }
 const release=host.observeDefinitions('bloxdy-native-shadows',(target,key,descriptor)=>{
  if(stopped||typeof descriptor?.get!=='function')return;
  const selected=['ShaderPackPage','loadPageShaderPackCompiler','loadShaderPackTextures','shaderPackTextures'].includes(key);
  // Inspect simple module getters only. Never enumerate arbitrary game data
  // or invoke unrelated accessor properties on engine/scene objects.
  if(!selected&&!/^\(\)=>[\w$]+$/.test(String(descriptor.get)))return;
  queueMicrotask(()=>{
   if(stopped)return;
   try{
    const value=descriptor.get();
    if(key==='ShaderPackPage')return preparePage(value);
    if(key==='loadPageShaderPackCompiler'){compilerLoader=value;return;}
    if(key==='loadShaderPackTextures'){textureLoader=value;return;}
    if(key==='shaderPackTextures'){textures=value;return;}
    if(typeof value!=='function')return;
    const text=String(value);
    if(text.includes('validationModules')&&text.includes('getCompilationInfo')&&text.includes('requestDevice'))validator=value;
    if(/^function\s*[\w$]*\(\)\s*\{\s*return\s+[\w$]+\(["']lite["']\);?\s*\}$/.test(text))prepareFactory(value());
   }catch(error){status('Native shader integration: '+error.message);}
  });
 });
 const api={configure(value,notify){settings=value;report=notify;return api;},connectEffects(value){environment=value;},
  attach(){},patch:s=>s,locations:()=>({Active:null}),bind(){},render(){},refresh(){},invalidateTerrain(){},invalidateSettings(){},
  dispose(){if(stopped)return;stopped=true;release();for(const adapter of adapters)adapter.dispose(true);adapters.clear();for(const restore of undo.reverse())restore();},
  get ready(){return adapters.size>0;},get drawing(){return false;},get diagnostic(){return message;},get resolutionInfo(){return null;},
  get shadowDiagnostics(){return {implementation:'bloxd-original-webgpu',internalShaderApi:true,externalPack:false,settings:options(),renderers:[...adapters].map(x=>x.diagnostics())};}};
 root.__BVFX_NATIVE_SHADOWS__=api;
 root.__BVFX_RENDER_BACKEND__='Bloxd WebGPU (Lite)';
 root.addEventListener?.('pagehide',()=>api.dispose(),{once:true});
 return api;
}
