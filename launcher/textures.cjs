'use strict';
const fs=require('node:fs'),path=require('node:path'),{textures}=require('./texture-catalog.cjs');
function validate(value,id){if(!value||value.metaData?.id!==id||!Number.isInteger(value.metaData.version)||value.metaData.version<1)throw Error('Invalid Bloxd texture pack.');let nodes=0;function check(v,depth=0){if(++nodes>250000||depth>20)throw Error('Texture pack is too complex.');if(v&&typeof v==='object')for(const [k,child]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Invalid texture key.');check(child,depth+1);}}check(value);return value;}
async function load(id,folder,fetcher=fetch){if(!textures.some(t=>t.id===id))throw Error('Unsupported texture pack.');if(id==='default2')return {metaData:{id,version:1}};const file=path.join(folder,id+'.json');if(fs.existsSync(file))return validate(JSON.parse(fs.readFileSync(file,'utf8')),id);if(id==='custom')throw Error('Import a Bloxd texture-pack JSON file first.');const bundled=path.join(__dirname,'assets','texture-packs',id+'.json');if(fs.existsSync(bundled))return validate(JSON.parse(fs.readFileSync(bundled,'utf8')),id);const response=await fetcher('https://raw.githubusercontent.com/Bloxdy/texture-packs/main/_json/'+id+'.json',{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('The Bloxd texture pack could not be downloaded.');const reader=response.body.getReader(),parts=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32*1024**2)throw Error('Texture pack is too large.');parts.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}const bytes=Buffer.concat(parts),pack=validate(JSON.parse(bytes.toString('utf8')),id);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(file,bytes);return pack;}
function importCustom(file,folder){if(fs.statSync(file).size>32*1024**2)throw Error('Texture pack is too large.');const value=JSON.parse(fs.readFileSync(file,'utf8'));if(!value?.metaData)throw Error('Choose a Bloxd texture-pack JSON file.');value.metaData.id='custom';validate(value,'custom');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'custom.json'),JSON.stringify(value));}
// Apply the launcher choice during initial atlas setup only. A later native
// save hands this window to Bloxd; page reloads retain that native choice.
function install(pack,options={}){
 const host=globalThis.__BLOXD_MOD_HOST__,key='bloxdy-texture-native',token=options.key||pack.metaData.id;
 try{if(globalThis.sessionStorage?.getItem(key)===token){globalThis.bloxdLauncherClient.texture({id:pack.metaData.id,applied:false,native:true,reason:'Using the texture pack selected in Bloxd.'});return;}}catch{}
 let manager=null,done=false,stopped=false,initializing=true,seeded=false,timer,originalSet,originalSave,setWrapper,saveWrapper;
 function restoreSet(){if(manager&&setWrapper&&manager.setFromJson===setWrapper)manager.setFromJson=originalSet;}
 function cleanup(){stopped=true;clearTimeout(timer);release();restoreSet();if(manager&&saveWrapper&&manager.saveTexturePack===saveWrapper)manager.saveTexturePack=originalSave;}
 function fail(error){if(stopped||done)return;done=true;cleanup();globalThis.bloxdLauncherClient.texture({id:pack.metaData.id,applied:false,reason:String(error?.message||error).slice(0,200)});}
 const release=host.observeDefinitions('launcher-textures',(_target,_key,d)=>{
  if(stopped||manager||!d?.get||!/^\(\)=>[\w$]+$/.test(String(d.get)))return;
  queueMicrotask(()=>{if(stopped||manager)return;let v;try{v=d.get();}catch{return;}
   if(typeof v?.getTexture!=='function'||typeof v?.getBlockAtlasArr!=='function'||typeof v?.setFromJson!=='function')return;
   manager=v;release();
   try{
    if(v.getBlockAtlasArr().length)return fail(Error('Texture atlases were already generated.'));
    originalSet=v.setFromJson;originalSave=v.saveTexturePack;
    setWrapper=function(...args){if(initializing)seeded=true;return originalSet.apply(this,initializing?[pack]:args);};v.setFromJson=setWrapper;
    if(typeof originalSave==='function'){
     saveWrapper=function(...args){
      if(initializing)return Promise.resolve(true);
      // A temporary server pack must not change the user's persistent choice.
      const persistent=args[0]!==true;let previous=null;
      if(persistent)try{previous=globalThis.sessionStorage?.getItem(key);globalThis.sessionStorage?.setItem(key,token);}catch{}
      const rollback=()=>{if(persistent)try{if(globalThis.sessionStorage?.getItem(key)===token){if(previous===null)globalThis.sessionStorage?.removeItem(key);else globalThis.sessionStorage?.setItem(key,previous);}}catch{}};
      try{const result=originalSave.apply(this,args);if(result?.then)result.then(undefined,rollback);return result;}catch(error){rollback();throw error;}
     };v.saveTexturePack=saveWrapper;
    }
    Promise.resolve(v.indexedDBValuesLoadedPromise).then(()=>{
     if(stopped)return;if(!seeded){seeded=true;originalSet.call(v,pack);}
     return Promise.resolve(v.necessaryAssetsGeneratedPromise).then(()=>{
      if(stopped)return;initializing=false;restoreSet();done=true;clearTimeout(timer);
      globalThis.bloxdLauncherClient.texture({id:pack.metaData.id,applied:true});
     });
    }).catch(fail);
   }catch(error){fail(error);}
  });
 });
 timer=setTimeout(()=>fail(Error('Bloxd texture manager was not available.')),20000);
 addEventListener('pagehide',cleanup,{once:true});
}
module.exports={load,validate,importCustom,install};
