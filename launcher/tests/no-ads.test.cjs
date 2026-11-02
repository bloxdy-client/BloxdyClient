'use strict';
// Synthetic DOM and generated preload only; no browser, network or client.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),{Store}=require('../store.cjs'),{generate}=require('../game-preload.cjs');
function setup(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bloxdy-no-ads-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=new Store(dir,path.join(__dirname,'../catalog'));store.install('bloxd-no-ads');return {dir,store};}
test('No Ads installs through the real catalog and injects user CSS only when enabled',t=>{
  const {dir,store}=setup(t),profile=store.profile(),mod=store.installedFor()[0],sheets=[];
  assert.equal(mod.name,'No Ads');assert.equal(store.snapshot().plan.modules.length,1);
  store.saveProfile({...profile,enabledMods:[]});
  const disabled=fs.readFileSync(generate(store,store.profile(),[],path.join(dir,'disabled')),'utf8');assert.doesNotMatch(disabled,/GenericVideoWrapper|cssOrigin/);
  store.saveProfile({...store.profile(),enabledMods:[mod.id]});assert.equal(store.snapshot().plan.ok,true);
  for(const renderer of ['standard','native-preview']){
    assert.equal(require('../model.cjs').plan({...store.profile(),renderer},[mod]).ok,true);
    const code=fs.readFileSync(generate(store,{...store.profile(),renderer},[mod],path.join(dir,renderer)),'utf8');new vm.Script(code);
    if(renderer!=='standard')continue;
    const electron={contextBridge:{executeInMainWorld(){},exposeInMainWorld(){}},ipcRenderer:{send(){},invoke:async()=>true},webFrame:{insertCSS:async(css,options)=>{sheets.push({css,options});}}};
    vm.runInNewContext(code,{require:name=>{assert.equal(name,'electron');return electron;},process:{isMainFrame:true},location:{protocol:'https:',hostname:'bloxd.io'}});
  }
  assert.equal(sheets.length,1);assert.equal(sheets[0].options.cssOrigin,'user');
  assert.equal(sheets[0].css,fs.readFileSync(path.join(__dirname,'../builtin-mods/no-ads.css'),'utf8'));
  store.saveProfile({...store.profile(),enabledMods:[]});assert.equal(store.snapshot().plan.modules.length,0);
});
test('Ad rules hide present and late ad hosts and their click targets while preserving game UI',t=>{
  const {store}=setup(t),mod=store.installedFor()[0],css=store.readModule(mod,'no-ads.css');
  const dom=new JSDOM('<!doctype html><html><head></head><body><canvas id="renderCanvas"></canvas><div class="LoadingOverlay"><button id="play">Play</button><div class="LoadingOverlayRightAdBannerContainer"><a href="#ad">Ad</a></div></div><div class="SettingsMenu">Settings</div><div class="ThumbnailUploadContainer">Upload</div><div id="shadow">Shadow</div><iframe id="login" src="https://accounts.google.com/"></iframe></body></html>');t.after(()=>dom.window.close());
  const {document}=dom.window,style=document.createElement('style');style.textContent=css;document.head.append(style);
  for(const selector of ['.LoadingOverlayRightAdBannerContainer','.LoadingOverlayRightAdBannerContainer a']){const computed=dom.window.getComputedStyle(document.querySelector(selector));assert.equal(computed.display,'none');assert.equal(computed.pointerEvents,'none');}
  const late=document.createElement('div');late.innerHTML='<div class="AdBannerContainer"><iframe src="https://ads.example/"></iframe></div><div id="GenericVideoWrapper"><video></video></div><iframe src="https://securepubads.g.doubleclick.net/ad"></iframe><div class="HomePageAdContainer"></div>';document.body.append(late);
  for(const selector of ['.AdBannerContainer','.AdBannerContainer iframe','#GenericVideoWrapper','#GenericVideoWrapper video','iframe[src*="doubleclick.net"]','.HomePageAdContainer'])assert.equal(dom.window.getComputedStyle(document.querySelector(selector)).display,'none',selector);
  for(const selector of ['#renderCanvas','.LoadingOverlay','#play','.SettingsMenu','.ThumbnailUploadContainer','#shadow','#login'])assert.notEqual(dom.window.getComputedStyle(document.querySelector(selector)).display,'none',selector);
  document.querySelector('.AdBannerContainer').style.display='block';assert.match(css,/display: none !important/); // user-origin precedence is verified at the preload boundary above.
});


test('CSS injection accepts synchronous Electron keys and reports real synchronous or asynchronous failures',async t=>{
 const {dir,store}=setup(t),mod=store.installedFor()[0],code=fs.readFileSync(generate(store,store.profile(),[mod],path.join(dir,'css-contract')),'utf8');
 for(const mode of ['string','undefined','promise','throw','reject']){
  const sent=[],electron={contextBridge:{executeInMainWorld(){},exposeInMainWorld(){}},ipcRenderer:{send:(_channel,value)=>sent.push(JSON.parse(JSON.stringify(value)))},webFrame:{insertCSS(){if(mode==='throw')throw Error('CSS failure');if(mode==='reject')return Promise.reject(Error('CSS failure'));if(mode==='promise')return Promise.resolve('key');return mode==='string'?'key':undefined;}}};
  vm.runInNewContext(code,{require:()=>electron,process:{isMainFrame:true},location:{protocol:'https:',hostname:'bloxd.io'}});await new Promise(resolve=>setImmediate(resolve));
  const errors=sent.at(-1).errors;assert.equal(errors.length,['throw','reject'].includes(mode)?1:0,mode);if(errors.length)assert.equal(errors[0].message,'CSS failure');
 }
});

 test('known ad media is muted on insertion and play, while game media remains audible',async t=>{
  const dom=new JSDOM('<div id="GenericVideoWrapper"><video id="ad"></video></div><video id="game"></video>',{runScripts:'outside-only'});t.after(()=>dom.window.close());
  const w=dom.window;w.eval('('+require('../game-preload.cjs').muteAdMedia.toString()+')()');
  const ad=w.document.querySelector('#ad'),game=w.document.querySelector('#game');assert.equal(ad.muted,true);assert.equal(game.muted,false);
  const late=w.document.createElement('audio');w.document.querySelector('#GenericVideoWrapper').append(late);await Promise.resolve();assert.equal(late.muted,true);
  late.muted=false;late.dispatchEvent(new w.Event('play'));assert.equal(late.muted,true);assert.equal(game.muted,false);
 });

test('No Ads accepts only the identified ad skip dialog, leaving other prompts alone',async t=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;w.eval('('+require('../game-preload.cjs').muteAdMedia.toString()+')()');
 const make=(title,subtitle,buttonText)=>{const popup=w.document.createElement('div');popup.className='PromptGenericPopup';const h=w.document.createElement('div'),sub=w.document.createElement('div'),b=w.document.createElement('button');h.className='PromptGenericPopupTitle';h.textContent=title;sub.className='PromptGenericPopupSubtitle';sub.textContent=subtitle;b.className='PromptGenericPopupBodyPrimaryButton';b.textContent=buttonText;let count=0;b.onclick=()=>count++;popup.append(h,sub,b);w.document.body.append(popup);return {popup,get count(){return count;}};};
 const other=make('Skip AD?','Something else','Skip'),target=make('Skip AD?','AD not showing? Click the button below to skip.','Skip');await Promise.resolve();assert.equal(target.count,1);assert.equal(other.count,0);target.popup.append(w.document.createElement('span'));await Promise.resolve();assert.equal(target.count,1);
});
