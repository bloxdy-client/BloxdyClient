'use strict';
const fs=require('node:fs'),path=require('node:path');const {managedSource}=require('./adapters.cjs');
const host=require('./mod-host.cjs'),capture=process.platform==='linux'?null:require('../bridge/capture-factory.cjs');
const presenter=process.platform==='linux'?null:require('../bridge/presenter.cjs');
const {prepare,installProfileStorage}=require('./profile-settings.cjs');
const observer=require('./client-observer.cjs'),{install:installTextures}=require('./textures.cjs');
const characterCapture=require('./character-capture.cjs'),{encodeCharacter}=require('./character-glb.cjs');
function muteAdMedia(){
  if(typeof document==='undefined')return;
  const selector='#GenericVideoWrapper,#GenericVideoInner,#aip-video-player,#aip-video-player-wrapper,#aip-preroll,#preroll,#preroll-container,#ad-container,#adContainer';
  const mute=media=>{if(media.closest?.(selector))media.muted=true;};
  const handled=new WeakSet();
  const skip=popup=>{
    if(handled.has(popup))return;
    const title=popup.querySelector('.PromptGenericPopupTitle')?.textContent?.trim();
    const subtitle=popup.querySelector('.PromptGenericPopupSubtitle')?.textContent?.trim();
    const button=popup.querySelector('.PromptGenericPopupBodyPrimaryButton');
    if(title!=='Skip AD?'||subtitle!=='AD not showing? Click the button below to skip.'||button?.textContent?.trim()!=='Skip')return;
    handled.add(popup);button.click();
  };
  const scan=node=>{if(node.nodeType!==1)return;if(node.matches?.('video,audio'))mute(node);node.querySelectorAll?.('video,audio').forEach(mute);if(node.matches?.('.PromptGenericPopup'))skip(node);node.querySelectorAll?.('.PromptGenericPopup').forEach(skip);const parent=node.closest?.('.PromptGenericPopup');if(parent)skip(parent);};
  document.addEventListener('play',event=>mute(event.target),true);
  const start=()=>{scan(document.documentElement);const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);});observer.observe(document.documentElement,{childList:true,subtree:true});addEventListener('pagehide',()=>observer.disconnect(),{once:true});};
  if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
}
// Select Bloxd's official JavaScript backend before scripts run. The shader
// mod uses original Lite shadows; Litematica/Grassify also retain WebGL alone.
// Do not overwrite the user's persisted renderer, game settings or accounts.
function selectModRenderer(nativeShaders=false){
  const url=new URL(location.href);
  if(url.protocol!=='https:'||url.hostname!=='bloxd.io'||url.pathname!=='/')return;
  globalThis.__BVFX_NATIVE_REQUESTED__=nativeShaders===true;
  url.searchParams.set('renderer',nativeShaders?'lite':'webgl2');
  url.searchParams.set('client','js');
  if(url.href!==location.href)history.replaceState(history.state,'',url.href);
}
function generate(store,profile,modules,folder,options={}){
  const main=[],isolated=[],css=[];
  for(const mod of modules){const sources=store.moduleSources(mod);for(const script of mod.scripts){for(const name of script.js){if(!sources.has(name))throw Error('Mod script is missing.');const source=managedSource(mod.id,name,sources.get(name));(script.world==='MAIN'?main:isolated).push({id:mod.id,name,source});}for(const name of script.css){if(!sources.has(name))throw Error('Mod stylesheet is missing.');css.push({id:mod.id,name,source:sources.get(name)});}}}
  const config={id:profile.id,name:profile.name,performance:profile.performance,modules:modules.map(m=>({id:m.id,version:m.version}))};
  const seed=prepare(store,profile,modules);
  let code=`'use strict';const {contextBridge,ipcRenderer,webFrame}=require('electron');\nif((process.isMainFrame||${options.embedded===true})&&location.protocol==='https:'&&location.hostname==='bloxd.io'&&(!${options.embedded===true}||ipcRenderer.sendSync('client:frame-authorized')===true)){\n`;
  // A page/adapter exception must not silently abort every subsequent mod.
  // Record exactly which scripts were requested and executed in this run.
  code+=`const startup={profile:${JSON.stringify(profile.id)},modules:${JSON.stringify(config.modules)},loaded:[],errors:[],webgpuApi:typeof navigator!=='undefined'&&typeof navigator.gpu?.requestAdapter==='function'};function publishStartup(){ipcRenderer.send('client:startup',startup);}function startupError(stage,error){startup.errors.push({stage,message:String(error?.message||error).slice(0,200)});}function runStage(stage,fn){try{fn();startup.loaded.push(stage);}catch(error){startupError(stage,error);}}\n`;
  if(modules.some(m=>m.id==='bloxd-visual-shader'))code+=`ipcRenderer.on('client:shader-diagnostics-request',()=>{try{const text=contextBridge.executeInMainWorld({func:function(){try{return JSON.stringify(globalThis.__BVFX_INSTANCE__?.diagnostics?.()||{unavailable:true});}catch(error){return JSON.stringify({error:String(error?.message||error).slice(0,200)});}},args:[]});if(typeof text==='string'&&text.length<=65536)ipcRenderer.send('client:shader-diagnostics',text);}catch(error){ipcRenderer.send('client:shader-diagnostics',JSON.stringify({error:String(error?.message||error).slice(0,200)}));}});\n`;
  if(modules.some(m=>m.id==='bloxd-litematica'))code+=`ipcRenderer.on('client:litematica-diagnostics-request',()=>{try{const text=contextBridge.executeInMainWorld({func:function(){try{return JSON.stringify(globalThis.__BLOXD_LITEMATICA__?.diagnostics?.(true)||{unavailable:true});}catch(error){return JSON.stringify({error:String(error?.message||error).slice(0,200)});}},args:[]});if(typeof text==='string'&&text.length<=65536)ipcRenderer.send('client:litematica-diagnostics',text);}catch(error){ipcRenderer.send('client:litematica-diagnostics',JSON.stringify({error:String(error?.message||error).slice(0,200)}));}});\n`;
  const stage=(name,body)=>`runStage(${JSON.stringify(name)},()=>{${body}});\n`;
  if(modules.some(m=>['bloxd-visual-shader','bloxd-litematica','bloxd-grassify'].includes(m.id)))code+=stage('launcher:mod-renderer',`contextBridge.executeInMainWorld({func:${selectModRenderer.toString()},args:[${modules.some(m=>m.id==='bloxd-visual-shader')}]});`);
  code+=stage('launcher:host',`contextBridge.executeInMainWorld({func:${host.toString()},args:[${JSON.stringify(config)}]});`);
  if(modules.length)code+=stage('launcher:settings-navigation',`contextBridge.executeInMainWorld({func:${require('./settings-navigation.cjs').toString()},args:[]});`);
  code+=stage('launcher:character',`contextBridge.exposeInMainWorld('bloxdLauncherClient',{account:value=>ipcRenderer.send('client:account',value),character:value=>ipcRenderer.invoke('client:character',value),characterStatus:value=>ipcRenderer.send('client:character-status',value),texture:value=>ipcRenderer.send('client:texture',value)});contextBridge.executeInMainWorld({func:function(options){(${observer.toString()})(options,${characterCapture.toString()},${encodeCharacter.toString()});},args:[${JSON.stringify({action:options.action||'game',platform:options.embedded?'crazygames':'bloxd'})}]});`);
  if(options.texture)code+=stage('launcher:textures',`contextBridge.executeInMainWorld({func:${installTextures.toString()},args:[${JSON.stringify(options.texture)},${JSON.stringify({key:options.textureKey||profile.id})}]});`);
  if(modules.length)code+=stage('launcher:storage',`contextBridge.exposeInMainWorld('__BLOXD_PROFILE_SAVE__',{save:(id,value)=>ipcRenderer.invoke('mods:set',{id,value})});contextBridge.executeInMainWorld({func:${installProfileStorage.toString()},args:[${JSON.stringify(seed)}]});`);
  // Existing No Ads installations only contain CSS; attach the media guard at
  // preload generation so they receive it without changing profile storage.
  if(modules.some(m=>m.id==='bloxd-no-ads'))code+=stage('bloxd-no-ads:media',`(${muteAdMedia.toString()})();`);
  for(const script of css)code+=stage(script.id+':'+script.name,`Promise.resolve(webFrame.insertCSS(${JSON.stringify(script.source)}${script.id==='bloxd-no-ads'?",{cssOrigin:'user'}":''})).catch(error=>{startupError(${JSON.stringify(script.id+':'+script.name)},error);publishStartup();});`);
  for(const script of main)code+=stage(script.id+':'+script.name,`contextBridge.executeInMainWorld({func:function(){const localStorage=globalThis.__BLOXD_MOD_STORAGE__.forModule(${JSON.stringify(script.id)});\n${script.source}\n},args:[]});`);
  const shim=`function storageFor(id){const invoke=(name,value)=>ipcRenderer.invoke(name,{id,value});return {storage:{local:{get(keys,callback){const p=invoke('mods:get',keys);if(callback)p.then(callback);return p;},set(value,callback){const p=invoke('mods:set',value);if(callback)p.then(()=>callback());return p;}}},runtime:{sendMessage(message){return invoke('mods:message',message);}}};}`;
  code+=shim+'\n';
  code+=`const moduleSeed=${JSON.stringify(seed)};function isolatedStorage(id){return {getItem(key){return Object.hasOwn(moduleSeed[id],key)?JSON.stringify(moduleSeed[id][key]):null;},setItem(key,text){const value=JSON.parse(text);moduleSeed[id][key]=value;return ipcRenderer.invoke('mods:set',{id,value:{[key]:value}});}};}\n`;
  for(const script of isolated)code+=stage(script.id+':'+script.name,`(function(chrome,localStorage){globalThis.chrome=chrome;\n${script.source}\n})(storageFor(${JSON.stringify(script.id)}),isolatedStorage(${JSON.stringify(script.id)}));`);
  if(profile.renderer==='native-preview')code+=`contextBridge.exposeInMainWorld('bloxdNative',{send:bytes=>ipcRenderer.invoke('native:packet',bytes),status:value=>ipcRenderer.send('native:status',value),frame:after=>ipcRenderer.invoke('native:frame',after)});contextBridge.executeInMainWorld({func:${capture.toString()},args:[{fixture:false}]});contextBridge.executeInMainWorld({func:${presenter.toString()},args:[]});\n`;
  code+='publishStartup();}\n';fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,'game-preload.cjs');fs.writeFileSync(file,code);return file;
}
module.exports={generate,muteAdMedia,selectModRenderer};
