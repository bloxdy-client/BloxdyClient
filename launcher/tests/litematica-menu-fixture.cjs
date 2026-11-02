'use strict';
// Pure DOM/JS fixture. Every world, storage and renderer object is synthetic.
const {JSDOM}=require('jsdom'),{managedSource}=require('../adapters.cjs'),{original}=require('./litematica-runtime-fixture.cjs');
function menu(t,{saved={},savedSchematics=[],nativeCss=''}={}){
 const dom=new JSDOM('<div class="WholeAppWrapper"><div class="WholeAppWrapperInner"><div class="SettingsMenu"><div class="MenuSideBarBody"><div class="MenuSideBarBodyTab">Controls</div><div class="MenuSideBarBodyTab">Graphics</div></div><div class="SettingsMenuRight"></div></div></div></div>',{url:'https://bloxd.io',runScripts:'outside-only'}),w=dom.window,errors=[],timers=new Map(),renders={},library=new Map(savedSchematics.map(entry=>[entry.id,entry])),storageCalls=[];let timer=0,closed=0,picked=0,pastes=0,busy=false,storageHook=null;
 t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});w.addEventListener('error',event=>{errors.push(event.error);event.preventDefault();});
 Object.defineProperty(w.document,'readyState',{value:'loading',configurable:true});w.localStorage.setItem('bloxd-litematica:settings:v4',JSON.stringify(saved));
 w.setInterval=fn=>{timers.set(++timer,fn);return timer;};w.clearInterval=id=>timers.delete(id);w.setTimeout=(fn,ms)=>{if(ms===0){setImmediate(fn);return ++timer;}timers.set(++timer,fn);return timer;};w.clearTimeout=id=>timers.delete(id);
 w.HTMLCanvasElement.prototype.getContext=()=>{throw Error('Graphics forbidden');};w.fetch=()=>{throw Error('Network forbidden');};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 const connection={noa:{},camera:()=>[0,10,0],read:()=>({loaded:true,actual:1}),expected:()=>1,actualName:()=> 'Stone'};let inventory={items:[{name:'Stone',amount:8},{name:'Dirt',amount:3}]};
 w.__BLM_ADAPTER__={connect:()=>connection,resolveItemName:id=>id===1?'Stone':'Dirt',inventory:()=>inventory,status:()=>'',closeSettings(){closed++;return true;}};
 w.__BLM_CREATE_RENDERER__=(state,rows,onStats)=>{Object.assign(renders,{state,rows,onStats,invalidations:0});return {invalidate(){renders.invalidations++;},destroy(){},status:()=>'',diagnostics:()=>({frames:0})};};
 w.__BLM_CREATE_BUILDING__=()=>({cancel(){},refresh(){},destroy(){},status:()=>'',diagnostics:()=>({})});w.__BLM_PLACE__={create:()=>({cancel(){busy=false;},destroy(){},diagnostics:()=>({busy}),status:()=>busy?'Pasting…':'',start(options){pastes++;busy=true;renders.lastPaste=options;}})};
 w.__BLM_CREATE_FILE_PICKER__=onFile=>({open(){picked++;},destroy(){},receive:onFile});
 for(const name of ['model.js','placement.js','bloxdschem.js','selection.js'])w.eval(managedSource('bloxd-litematica',name,original(name)));
 w.BLOXD_BLOCK_NAMES=['Stone','Dirt'];w.BLOXD_BLOCK_IDS={1:'Stone',2:'Dirt'};
 w.fixtureStorage=async(action,value)=>{storageCalls.push({action,value});if(storageHook)await storageHook(action,value);if(action==='getAll')return [...library.values()];if(action==='put')library.set(value.id,value);if(action==='delete')library.delete(value);};
 if(nativeCss){const style=w.document.createElement('style');style.textContent=nativeCss;w.document.head.append(style);}
 let code=managedSource('bloxd-litematica','litematica.js',original('litematica.js'));
 code=code.replace("  if(document.readyState==='loading')",`  storage=globalThis.fixtureStorage;
  globalThis.menuFixture={setModel,importFile,saveCurrent,loadMenuSchematic,change,refresh:sync,updateLibrary,async reloadLibrary(){library=await storage('getAll');},setArea(value){areaResult=value;materialSignature='';renderMaterials();},get picker(){return picker;},get model(){return model;},get checked(){return [...checkedMaterials];}};
  if(document.readyState==='loading')`);
 w.eval(code);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.document.querySelector('[data-litematica-category]').click();
 const page=w.document.getElementById('blm-settings-page'),ui=w.menuFixture;
 return {w,page,ui,errors,renders,library,timers,connection,storageCalls,setStorageHook(hook){storageHook=hook;},field:name=>page.querySelector('[data-blm-field="'+name+'"]'),tab:name=>page.querySelector('[data-blm-mode="'+name+'"]').click(),group(title){return [...page.querySelectorAll('.ControlsSection')].find(e=>e.querySelector('.ControlsSectionTitle').textContent===title);},setInventory(value){inventory=value;},get closed(){return closed;},get picked(){return picked;},get pastes(){return pastes;}};
}
const sample=(name='House')=>({format:'bloxd',name,size:[2,2,1],offset:[0,0,0],counts:{'bloxd:1':2,'bloxd:2':1},nativeMapping:{'bloxd:1':'Stone','bloxd:2':'Dirt'},blocks:[[0,0,0,'bloxd:1'],[1,0,0,'bloxd:2'],[0,1,0,'bloxd:1']],warnings:[]});
module.exports={menu,sample};
