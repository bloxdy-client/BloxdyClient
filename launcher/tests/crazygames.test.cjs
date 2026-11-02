'use strict';
// Pure filesystem, VM and DOM checks. Never creates a real browser or session.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const cg=require('../crazygames.cjs'),{Store}=require('../store.cjs'),{partition}=require('../accounts.cjs'),{generate}=require('../game-preload.cjs'),{canReadPack}=require('../pack-permissions.cjs'),{installBloxdAuthPopups}=require('../../bridge/google-auth-popup.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(t){const folder=fs.mkdtempSync(path.join(os.tmpdir(),'bloxdy-crazygames-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));return {folder,store:new Store(folder,path.join(__dirname,'../catalog'))};}
function frames(){const main={url:cg.GAME_URL},wrapper={url:'https://gameframe.crazygames.com/v2.13/',parent:main},game={url:'https://bloxd.io/',parent:wrapper};return {main,wrapper,game,contents:{mainFrame:main}};}
test('CrazyGames is a built-in account provider with its own persistent partition and no login mod',t=>{
 const {folder,store}=setup(t),old=store.account().id;store.addAccount('crazygames');const id=store.account().id;
 assert.equal(store.account().label,'CrazyGames account');assert.equal(store.account().provider,'crazygames');assert.notEqual(id,old);assert.match(partition(store.account()),/^persist:bloxd-account-/);
 assert.equal(partition({id:'account-existing',legacySession:true,provider:'crazygames'}),'persist:bloxd-account-existing');
 assert.equal(store.profile().renderer,'standard');assert.deepEqual(store.profile().enabledMods,[]);assert.equal(store.catalog.items.some(m=>/crazygames/i.test(m.id)),false);
 store.install('bloxd-no-ads');store.saveProfile({...store.profile(),enabledMods:['bloxd-no-ads']});
 const reloaded=new Store(folder,path.join(__dirname,'../catalog'));assert.equal(reloaded.account().id,id);assert.equal(reloaded.account().provider,'crazygames');assert.equal(partition(reloaded.account()),partition(store.account()));
 assert.throws(()=>reloaded.saveProfile({...reloaded.profile(),renderer:'native-preview'}),/Standard Bloxd/);
 reloaded.selectAccount(old);assert.equal(reloaded.account().provider,null);assert.equal(reloaded.profile().id,'balanced');
});
test('Only the owned Bloxd iframe under the exact official game portal is authorized',()=>{
 const f=frames();assert.equal(cg.gameFrame(f.contents,f.game,true),true);assert.equal(cg.gameFrame(f.contents,f.main,true),false);assert.equal(cg.gameFrame(f.contents,f.wrapper,true),false);
 assert.equal(cg.gameFrame(f.contents,{url:'https://bloxd.io/',parent:{url:'https://evil.test',parent:f.main}},true),false);
 for(const url of ['https://bloxd.io.evil.test/','https://user:pass@bloxd.io/','http://bloxd.io/','https://bloxd.io:123/','https://bloxd.io/auth-callback/google'])assert.equal(cg.gameFrame(f.contents,{url,parent:f.wrapper},true),false,url);
 f.main.url='https://www.crazygames.com/game/another-game';assert.equal(cg.gameFrame(f.contents,f.game,true),false);
 f.main.url=cg.GAME_URL;f.wrapper.parent=f.wrapper;assert.equal(cg.gameFrame(f.contents,f.game,true),false);
 assert.equal(cg.gameFrame({mainFrame:f.game},f.game),true);assert.equal(cg.gameFrame({mainFrame:f.main},f.game),false);
});
test('Portal navigation and auth callbacks reject lookalikes and unrelated Firebase projects',()=>{
 assert.equal(cg.portalGame(cg.GAME_URL),true);assert.equal(cg.portalGame('https://www.crazygames.com/de/game/bloxdhop-io'),true);
 for(const u of ['https://www.crazygames.com.evil.test/game/bloxdhop-io','https://user@www.crazygames.com/game/bloxdhop-io','http://www.crazygames.com/game/bloxdhop-io'])assert.equal(cg.portalNavigation(u),false);
 assert.equal(cg.authURL('https://auth.crazygames.com/__/auth/handler?providerId=google.com'),true);
 for(const u of ['https://auth.crazygames.com/anything','https://evil.firebaseapp.com/__/auth/handler','https://www.crazygames.com/game/anything'])assert.equal(cg.authURL(u),false);
 const contents={on(){},setWindowOpenHandler(fn){this.open=fn;}};installBloxdAuthPopups(contents);assert.equal(contents.open({url:'https://auth.crazygames.com/__/auth/handler'}).action,'deny');
 installBloxdAuthPopups(contents,{additionalAuthURL:cg.authURL});const allowed=contents.open({url:'https://auth.crazygames.com/__/auth/handler'});assert.equal(allowed.action,'allow');assert.equal(allowed.overrideBrowserWindowOptions.webPreferences.preload,'');assert.equal(allowed.overrideBrowserWindowOptions.webPreferences.sandbox,true);assert.equal(allowed.overrideBrowserWindowOptions.webPreferences.nodeIntegrationInSubFrames,false);
});
test('Generated embedded preload exposes nothing in the portal, ad frames or a denied Bloxd iframe',t=>{
 const {folder,store}=setup(t),code=fs.readFileSync(generate(store,store.profile(),[],folder,{embedded:true}),'utf8');new vm.Script(code);
 for(const hostname of ['www.crazygames.com','gameframe.crazygames.com','evil.test','bloxd.io']){
  const exposed=[],stages=[],calls=[],electron={contextBridge:{exposeInMainWorld:(...a)=>exposed.push(a),executeInMainWorld:(...a)=>stages.push(a)},ipcRenderer:{sendSync:channel=>{calls.push(channel);return false;}}};
  vm.runInNewContext(code,{require:()=>electron,process:{isMainFrame:false},location:{protocol:'https:',hostname}});assert.deepEqual(exposed,[]);assert.deepEqual(stages,[]);assert.equal(calls.length,hostname==='bloxd.io'?1:0);
 }
});
test('Authorized Bloxd iframe gets built-in observation and enabled modules in isolated generated worlds',async t=>{
 const {folder,store}=setup(t);store.addAccount('crazygames');store.install('bloxd-no-ads');store.saveProfile({...store.profile(),enabledMods:['bloxd-no-ads']});
 const code=fs.readFileSync(generate(store,store.profile(),store.snapshot().plan.modules,folder,{embedded:true,action:'account'}),'utf8');
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{runScripts:'outside-only',url:'https://bloxd.io/'});t.after(()=>{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();});
 const sent=[],css=[],w=dom.window,exposed=[];let scan;
 w.setInterval=fn=>{scan=fn;return 1;};w.clearInterval=()=>{};
 const electron={contextBridge:{exposeInMainWorld:(name,value)=>{exposed.push(name);w[name]=value;},executeInMainWorld:({func,args})=>w.eval(`(${func.toString()})(...${JSON.stringify(args)})`)},webFrame:{insertCSS:source=>css.push(source)},ipcRenderer:{sendSync:()=>true,send:(channel,value)=>sent.push({channel,value}),invoke:async()=>true}};
 vm.runInNewContext(code,{require:()=>electron,process:{isMainFrame:false},location:w.location});
 w.eval(`const api={getBloxd(){}};Object.defineProperty(api,'singletons',{value:{clientSidePartyStateManager:{userContext:{isLoggedIn:()=>true,getPlayerName:()=> 'PortalPlayer',getPlayerCosmetics:()=>({skin:'one'})}}}});const app={get(){},set(){throw Error('Account navigation must remain user-operated on CrazyGames');},setClientEscMenuOptions(){}};Object.defineProperty({},'app',{get:()=>app});`);
 await tick();scan();assert.ok(exposed.includes('bloxdLauncherClient'));assert.equal(css.length,1);assert.equal(sent.find(s=>s.channel==='client:account').value.username,'PortalPlayer');assert.equal(w.__BLOXD_MOD_HOST__.status().observers.length,0);
 const status=sent.find(s=>s.channel==='client:startup').value;assert.equal(status.errors.length,0);assert.ok(status.loaded.includes('bloxd-no-ads:no-ads.css'));
});
test('Embedded file reads require the official game portal and retain read-only picker scope',()=>{
 const f=frames(),details={fileAccessType:'readable',filePath:'C:\\Packs\\Sample',embeddingOrigin:'https://www.crazygames.com'};
 assert.equal(canReadPack(f.contents,f.contents,'https://bloxd.io',details,true),true);
 assert.equal(canReadPack(f.contents,f.contents,'https://bloxd.io',{...details,embeddingOrigin:'https://gameframe.crazygames.com'},true),true);
 assert.equal(canReadPack(f.contents,f.contents,'https://bloxd.io',{...details,fileAccessType:'writable'},true),false);
 assert.equal(canReadPack(f.contents,f.contents,'https://bloxd.io',{...details,embeddingOrigin:'https://evil.test'},true),false);
 f.main.url='https://www.crazygames.com/game/another-game';assert.equal(canReadPack(f.contents,f.contents,'https://bloxd.io',details,true),false);
});
