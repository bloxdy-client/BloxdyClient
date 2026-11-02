'use strict';
// Execute generated scripts in two synthetic JS worlds and a DOM only.
// No Electron, client, network, account session or graphics context is started.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const {Store}=require('../store.cjs'),{generate}=require('../game-preload.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function startup(t,{failScript=false,includeMods=true,modIds=null}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bloxdy-preload-unit-')),store=new Store(root,path.join(__dirname,'../catalog'));
 t.after(()=>{assert.ok(root.startsWith(path.join(os.tmpdir(),'bloxdy-preload-unit-')));fs.rmSync(root,{recursive:true,force:true});});
 const ids=modIds||(includeMods?['bloxd-visual-shader','bloxd-litematica']:[]);for(const id of ids)store.install(id);
 store.saveProfile({...store.profile(),enabledMods:ids});
 const mods=store.snapshot().plan.modules;
 const code=fs.readFileSync(generate(store,store.profile(),mods,path.join(root,'generated'),{texture:{metaData:{id:'default2',version:1}}}),'utf8');
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://bloxd.io/',runScripts:'outside-only'}),w=dom.window,errors=[],sent=[],characters=[],timers=new Map(),receivers=new Map();let timer=0;
 t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});
 Object.defineProperty(w.document,'readyState',{value:'loading',configurable:true});
 for(const name of ['setTimeout','setInterval','requestAnimationFrame'])w[name]=fn=>{timers.set(++timer,fn);return timer;};
 for(const name of ['clearTimeout','clearInterval','cancelAnimationFrame'])w[name]=id=>timers.delete(id);
 w.addEventListener('error',event=>{errors.push(event.error);event.preventDefault();});
 w.HTMLCanvasElement.prototype.getContext=()=>{throw Error('Graphics forbidden in pure preload test.');};
 w.fetch=()=>{throw Error('Network forbidden in pure preload test.');};
 const electron={contextBridge:{exposeInMainWorld:(name,value)=>{w[name]=value;},executeInMainWorld:({func,args})=>{if(failScript&&func.toString().includes('globalThis.__BVFX_RUNTIME_LAYOUT__='))throw Error('Synthetic startup failure');return w.eval(`(${func.toString()})(...${JSON.stringify(args)})`);}},webFrame:{insertCSS:async()=>''},ipcRenderer:{on:(channel,fn)=>receivers.set(channel,fn),send:(channel,value)=>sent.push({channel,value}),invoke:async(channel,payload={})=>{if(channel==='client:character')characters.push(payload);return channel==='mods:get'?store.storage(store.profile().id,payload.id):true;}}};
 const sandbox={require:name=>{assert.equal(name,'electron');return electron;},process:{isMainFrame:true},location:w.location,window:w,console};
 vm.runInNewContext(code,sandbox,{filename:'generated-game-preload.cjs'});
 w.document.body.innerHTML='<div class="SettingsMenu Menu"><div class="MenuSideBar"><div class="MenuSideBarBody"><div class="MenuSideBarBody"><div class="MenuSideBarSection"><div class="MenuSideBarBodyTab">Controls</div><div class="MenuSideBarBodyTab">Graphics</div></div></div></div></div><div class="MenuBody SettingsMenuRight"></div></div>';
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();
 return {w,errors,sent,characters,timers,receivers};
}
test('Litematica F9 snapshot stays dormant until the user request and copies only its diagnostic return value',async t=>{
 const h=await startup(t,{modIds:['bloxd-litematica']});let calls=0;h.w.__BLOXD_LITEMATICA__.diagnostics=()=>{calls++;return {renderer:{frames:0,pipeline:{beforeGroups:0}},settings:{mode:'select'}};};
 assert.equal(calls,0);assert.equal(h.sent.some(s=>s.channel==='client:litematica-diagnostics'),false);
 h.receivers.get('client:litematica-diagnostics-request')();assert.equal(calls,1);assert.deepEqual(JSON.parse(h.sent.at(-1).value),{renderer:{frames:0,pipeline:{beforeGroups:0}},settings:{mode:'select'}});
 h.w.__BLOXD_LITEMATICA__.diagnostics=()=>{throw Error('Synthetic snapshot failure');};h.receivers.get('client:litematica-diagnostics-request')();assert.match(JSON.parse(h.sent.at(-1).value).error,/Synthetic snapshot failure/);
 const bare=await startup(t,{includeMods:false});assert.equal(bare.receivers.has('client:litematica-diagnostics-request'),false);assert.deepEqual(h.errors,[]);
});

test('Shader F9 diagnostics run only on request and are absent without the shader mod',async t=>{
 const h=await startup(t,{modIds:['bloxd-visual-shader']});let calls=0;
 h.w.__BVFX_INSTANCE__.diagnostics=()=>{calls++;return {enabled:false,fps:5,backend:'webgl2'};};
 assert.equal(calls,0);assert.equal(h.sent.some(s=>s.channel==='client:shader-diagnostics'),false);
 h.receivers.get('client:shader-diagnostics-request')();assert.equal(calls,1);
 assert.deepEqual(JSON.parse(h.sent.at(-1).value),{enabled:false,fps:5,backend:'webgl2'});
 const bare=await startup(t,{includeMods:false});assert.equal(bare.receivers.has('client:shader-diagnostics-request'),false);
 assert.deepEqual(h.errors,[]);
});
test('Generated shader + Litematica preload creates both real mod menus in separate synthetic worlds',async t=>{
 const {w,errors,sent}=await startup(t);assert.deepEqual(errors,[]);assert.ok(w.__BVFX_INSTANCE__);assert.ok(w.__BLOXD_LITEMATICA__);
 assert.ok(w.document.querySelector('[data-shader-category]'));assert.ok(w.document.querySelector('[data-litematica-category]'));
 assert.equal(w.__BLOXD_MOD_HOST__.status().errors.length,0);
 const report=sent.find(s=>s.channel==='client:startup').value;assert.equal(report.errors.length,0);assert.ok(report.loaded.includes('bloxd-visual-shader:shader.js'));assert.ok(report.loaded.includes('bloxd-litematica:litematica.js'));
});

test('Renamed engine exports connect both real mod adapters, with no document, game or profile writes',async t=>{
 const h=await startup(t),w=h.w;
 w.eval(`globalThis.fixtureScene={meshes:[],materials:[],activeCamera:{position:{x:1,y:2,z:3}},onBeforeRenderObservable:{add(){}},getTransformMatrix(){return {m:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]};}};
 class Engine{constructor(){this.origin=[0,0,0];this.container={querySelector(){return null;}};this.inputs={};this.entities={};this.render={scene:fixtureScene};}}
 const singleton={pointerLockWrapper:{},itemsClient:null,blocksClient:null,connectedWebsocketUrl:null,bloxd:null,world:new Engine()};const exports={};Object.defineProperty(exports,'j',{get:()=>singleton});`);
 await tick();const engine=w.__BLOXD_MOD_HOST__.engine();assert.ok(engine);assert.equal(w.__BLM_ADAPTER__.connect().scene,w.fixtureScene);
 // The actual shader closure receives the same facade as Litematica.
 assert.equal(w.__BLOXD_MOD_HOST__.status().observers.includes('shader-runtime'),false);
 assert.deepEqual(h.errors,[]);assert.equal(w.location.search,'?renderer=webgl2');
});

test('Only WebGL mods select the official URL backend and preserve portal/game query parameters without storage writes',()=>{
 const {selectModRenderer}=require('../game-preload.cjs');
 for(const href of ['https://bloxd.io/?siteUsed=desktopMicrosoftStore#lobby','https://bloxd.io/?siteUsed=crazygames&renderer=lite&other=kept']){
  const writes=[],location={href},history={state:{keep:1},replaceState(state,_title,url){writes.push({state,url});location.href=url;}};
  vm.runInNewContext('('+selectModRenderer.toString()+')()',{URL,location,history});const url=new URL(location.href);assert.equal(url.searchParams.get('renderer'),'webgl2');assert.equal(url.searchParams.get('siteUsed'),new URL(href).searchParams.get('siteUsed'));assert.equal(url.hash,new URL(href).hash);assert.equal(writes.length,1);assert.equal(writes[0].state,history.state);
  vm.runInNewContext('('+selectModRenderer.toString()+')()',{URL,location,history});assert.equal(writes.length,1);
 }
 for(const href of ['https://bloxd.io/auth-callback/google','https://www.crazygames.com/game/bloxdhop-io'])vm.runInNewContext('('+selectModRenderer.toString()+')()',{URL,location:{href},history:{replaceState(){throw Error('Unexpected URL change');}}});
});

test('Grassify alone selects WebGL2 before loading its runtime',async t=>{
 const h=await startup(t,{modIds:['bloxd-grassify']});
 const report=h.sent.find(s=>s.channel==='client:startup').value;
 assert.equal(h.w.location.search,'?renderer=webgl2');
 assert.ok(report.loaded.indexOf('launcher:mod-renderer')<report.loaded.indexOf('bloxd-grassify:grassify-runtime.js'));
 assert.equal(report.errors.length,0);
});

test('Shader sliders and buttons use current native chrome and retain pointer/keyboard controls',async t=>{
 const h=await startup(t),w=h.w,d=w.document;const style=d.createElement('style');style.textContent=require('./fixtures/native-bloxd-ui-2026-10-28.json').css;d.head.append(style);
 d.querySelector('[data-shader-category]').click();const page=d.getElementById('bloxd-engine-voxel-shadows--settings'),reference=d.createElement('div');reference.className='SettingsMenuRightInner';reference.innerHTML='<div class="NewButton GoldButton"><div class="ButtonBottomBorder"></div><div class="ButtonTopBorder"></div><div class="ButtonBody">Reset</div></div><div class="SettingBox SettingsSliderDiv"><div class="SliderDiv"><div class="rangeslider rangeslider-horizontal"><div class="rangeslider__fill"></div><div class="rangeslider__handle"></div></div></div></div>';page.after(reference);
 assert.equal(page.querySelector('[data-shader-check="adaptiveQuality"]'),null,'removed resolution degradation is not offered');
 const button=page.querySelector('[aria-label="Reset water color"]');assert.ok(button.classList.contains('GoldButton'));assert.equal(page.querySelectorAll('.YellowButton').length,0);
 for(const property of ['background-color','border','box-shadow'])assert.equal(w.getComputedStyle(button).getPropertyValue(property),w.getComputedStyle(reference.querySelector('.NewButton')).getPropertyValue(property),property);
 assert.equal(w.getComputedStyle(button).padding,'0px');assert.equal(w.getComputedStyle(page.querySelector('.bvfx-custom-button .ButtonTopBorder')).display,w.getComputedStyle(reference.querySelector('.ButtonTopBorder')).display);
 const row=page.querySelector('[data-shader-slider="brightness"]'),track=row.querySelector('.rangeslider'),handle=row.querySelector('[role=slider]');
 for(const [actual,native,props]of [[track,reference.querySelector('.rangeslider'),['height','background-color','border-radius']],[handle,reference.querySelector('.rangeslider__handle'),['width','height','border','background-color']]])for(const prop of props)assert.equal(w.getComputedStyle(actual).getPropertyValue(prop),w.getComputedStyle(native).getPropertyValue(prop),prop);
 assert.equal(w.getComputedStyle(track.parentElement).width,'100%');
 handle.dispatchEvent(new w.KeyboardEvent('keydown',{code:'End',bubbles:true,cancelable:true}));assert.equal(handle.getAttribute('aria-valuenow'),'1');handle.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Home',bubbles:true,cancelable:true}));assert.equal(handle.getAttribute('aria-valuenow'),'0');
 let captured=false;track.setPointerCapture=()=>{captured=true;};track.hasPointerCapture=()=>captured;track.releasePointerCapture=()=>{captured=false;};track.getBoundingClientRect=()=>({left:0,width:200});
 for(const [type,x]of [['pointerdown',100],['pointermove',200],['pointerup',200]]){const event=new w.MouseEvent(type,{button:0,clientX:x,bubbles:true,cancelable:true});Object.defineProperty(event,'pointerId',{value:1});track.dispatchEvent(event);}
 assert.equal(handle.getAttribute('aria-valuenow'),'1');assert.equal(handle.style.left,'100%');assert.equal(track.querySelector('.rangeslider__fill').style.width,'100%');assert.equal(captured,false);assert.deepEqual(h.errors,[]);
});
test('An early mod script exception is reported and cannot abort the other enabled mod',async t=>{
 const {w,errors,sent}=await startup(t,{failScript:true});assert.deepEqual(errors,[]);
 assert.ok(w.document.querySelector('[data-litematica-category]'));assert.ok(w.document.querySelector('[data-shader-category]'));
 const report=sent.find(s=>s.channel==='client:startup').value;assert.equal(report.errors.length,1);assert.equal(report.errors[0].stage,'bloxd-visual-shader:runtime.js');assert.equal(report.errors[0].message,'Synthetic startup failure');
 assert.ok(report.loaded.includes('bloxd-litematica:litematica.js'));
});
test('Regular game menus do not build or attach shader controls; explicit selection builds once and reuses them',async t=>{
 const {w,errors,timers}=await startup(t),doc=w.document,tab=doc.querySelector('[data-shader-category]');
 assert.equal(doc.querySelectorAll('[data-shader-check], [data-shader-slider]').length,0);
 tab.click();assert.deepEqual(errors,[]);const page=doc.getElementById('bloxd-engine-voxel-shadows--settings');
 assert.ok(page);assert.ok(page.querySelectorAll('[data-shader-slider]').length>30,'the complete settings page remains available');
 const first=page.querySelector('input'),inputs=page.querySelectorAll('input').length;
 const graphics=[...doc.querySelectorAll('.MenuSideBarBodyTab')].find(e=>e.textContent==='Graphics');graphics.click();
 assert.equal(page.isConnected,false);assert.equal(doc.querySelectorAll('[data-shader-check], [data-shader-slider]').length,0);
 tab.click();assert.equal(page.querySelector('input'),first);assert.equal(page.querySelectorAll('input').length,inputs);
 graphics.click();const host=doc.querySelector('.SettingsMenu'),replacement=host.cloneNode(true);host.replaceWith(replacement);
 // Flush only our synthetic scheduling queues, never browser/game actions.
 for(let i=0;i<3;i++){await tick();const queued=[...timers];timers.clear();for(const [,fn]of queued)fn();}
 const nextTab=doc.querySelector('[data-shader-category]');assert.ok(nextTab);assert.equal(page.isConnected,false);
 nextTab.click();assert.equal(page.querySelector('input'),first);assert.equal(page.parentElement,doc.querySelector('.SettingsMenuRight'));assert.deepEqual(errors,[]);
});

test('The generated no-mod preload transfers a genuine GLB across synthetic JS worlds after a source session joins',async t=>{
 const h=await startup(t,{includeMods:false}),{w}=h,f=require('./character-fixture.cjs'),r=f.rig(),manager=r.data.thinInstMgr,component={ow:7};w.TextEncoder=TextEncoder;
 manager.getObjectData=()=>({type:'Player',visible:false,nodes:[r.node]});manager.getTypeNodes=()=>[{thinMeshIndex:0,worldMatrix:f.identity}];manager.groups={Player:{notArmour:new Set([0])}};manager.has=id=>id===7;manager.getEntityId=()=>42;
 const entities={add:()=>42,getState:(_id,name)=>name==='humanoidMesh'?component:{attachments:[]}};class Engine{constructor(){this.container={};this.inputs={};this.entities=entities;const ecs=this.entities;this.Vw=ecs.add();this.ff={mS:manager};}}const engine=new Engine(),client={SZ:engine,clientGame:{},gameReplayer:{recording:null}};
 w.syntheticApi={getBloxd(){}};w.syntheticSingletons={SZ:engine,bloxd:{client},connectedWebsocketUrl:null,clientSidePartyStateManager:{userContext:{isLoggedIn:()=>true,getPlayerName:()=>f.metadata.username,getPlayerCosmetics:()=>f.metadata.cosmetics}}};
 w.eval("Object.defineProperty(syntheticApi,'singletons',{value:syntheticSingletons});");await tick();const scan=[...h.timers.values()].find(fn=>fn.name==='scan');assert.equal(typeof scan,'function');scan();scan();await tick();await tick();assert.equal(h.characters.length,1);assert.equal(require('../character-glb.cjs').validateCharacter(h.characters[0].bytes).parts,1);assert.equal(h.sent.filter(s=>s.channel==='client:character-status').at(-1).value.phase,'ready');assert.deepEqual(h.errors,[]);assert.equal(h.sent.find(s=>s.channel==='client:startup').value.modules.length,0);
});

test('Litematica controls are built only on selection and reused detached across settings menus',async t=>{
 const {w,errors,timers}=await startup(t),doc=w.document,tab=doc.querySelector('[data-litematica-category]');
 assert.equal(doc.getElementById('blm-settings-page'),null);tab.click();
 const page=doc.getElementById('blm-settings-page'),first=page.querySelector('input'),inputs=page.querySelectorAll('input').length;
 assert.ok(inputs>20,'all original controls remain');
 const graphics=[...doc.querySelectorAll('.MenuSideBarBodyTab')].find(e=>e.textContent==='Graphics');graphics.click();assert.equal(page.isConnected,false);
 tab.click();assert.equal(page.querySelector('input'),first);assert.equal(page.querySelectorAll('input').length,inputs);
 graphics.click();const menu=doc.querySelector('.SettingsMenu');menu.replaceWith(menu.cloneNode(true));
 for(let i=0;i<3;i++){await tick();const queue=[...timers];timers.clear();for(const [,fn]of queue)fn();}
 assert.equal(page.isConnected,false);doc.querySelector('[data-litematica-category]').click();assert.equal(page.querySelector('input'),first);assert.equal(page.parentElement,doc.querySelector('.SettingsMenuRight'));assert.deepEqual(errors,[]);
});

test('Litematica presents the agreed three tabs and inline help instead of permanent explanations',async t=>{
 const {w,errors}=await startup(t),doc=w.document;doc.querySelector('[data-litematica-category]').click();const page=doc.getElementById('blm-settings-page'),tasks=[...page.querySelectorAll('[data-blm-mode]')];
 assert.deepEqual(tasks.map(b=>b.textContent),['Build','Save area','Paste']);assert.equal(page.querySelectorAll('.blm-legend').length,0);assert.equal(tasks[0].getAttribute('aria-pressed'),'true');
 const settings=[...page.querySelectorAll('.ControlsSection')].find(e=>e.querySelector('.ControlsSectionTitle')?.textContent==='Settings');assert.equal(settings.querySelector('.ControlsSectionRows').hidden,true);assert.ok(page.querySelectorAll('.SettingsTextInputCircleInfo').length>15);
 tasks[2].click();assert.equal(w.__BLOXD_LITEMATICA__.diagnostics().settings.mode,'place');assert.equal(tasks[2].getAttribute('aria-pressed'),'true');const paste=[...page.querySelectorAll('.blm-menu-section button')].find(b=>b.textContent==='Paste');assert.ok(paste);assert.equal(paste.disabled,true,'no file means no paste');
 tasks[1].click();assert.equal(w.__BLOXD_LITEMATICA__.diagnostics().settings.mode,'select');assert.equal(tasks[1].getAttribute('aria-pressed'),'true');assert.match(page.querySelector('.blm-corner-title [role="tooltip"]').textContent,/Stick/);assert.deepEqual(errors,[]);
});


test('Real Litematica preload performs no world discovery while idle, including stored EZ Building, and wakes for selection',async t=>{
 const h=await startup(t,{modIds:['bloxd-litematica']}),{w,timers}=h;let connects=0;
 const connect=w.__BLM_ADAPTER__.connect;w.__BLM_ADAPTER__.connect=(...args)=>{connects++;return connect(...args);};
 // Exercise the real generated module timers; no game or graphics involved.
 for(let n=0;n<120;n++)for(const fn of [...timers.values()])fn();
 assert.equal(connects,0,'no repeated world-layout scans with no schematic');
 assert.deepEqual(h.errors,[]);
 w.document.querySelector('[data-litematica-category]').click();
 assert.ok(w.document.querySelector('#blm-settings-page'));
 w.document.querySelector('[data-blm-mode="select"]').click();
 for(const fn of [...timers.values()])fn();
 assert.ok(connects>0,'explicit selection still discovers the world');
 w.document.querySelector('[data-blm-mode="build"]').click();
 const ez=w.document.querySelector('[data-blm-field="ezBuilding"]');ez.closest('.SettingBox').click();assert.equal(w.__BLOXD_LITEMATICA__.diagnostics().settings.ezBuilding,true);
 connects=0;for(let n=0;n<20;n++)for(const fn of [...timers.values()])fn();assert.equal(connects,0);
 assert.deepEqual(h.errors,[]);
});
