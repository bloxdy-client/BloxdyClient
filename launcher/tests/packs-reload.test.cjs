'use strict';
// CPU, filesystem fixtures and VM only. Never starts Electron or a browser.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {writeRequest,watchRequests}=require('../session-reload.cjs'),{canReadPack}=require('../pack-permissions.cjs'),textures=require('../textures.cjs'),host=require('../mod-host.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Saved character audits avoid repeated mesh traversals, while outfit changes and rejoins sync immediately',async()=>{
 let now=0,scan,reads=0,exports=0,outfit='one',connection='room-one';const engine={},manager={},component={};
 class Clock extends Date{static now(){return now;}}
 const context=vm.createContext({Date:Clock,queueMicrotask,setInterval:fn=>{scan=fn;return 1;},clearInterval(){},addEventListener(){},Uint8Array,bloxdLauncherClient:{account(){},characterStatus(){},character:async()=>{exports++;return true;}}});
 context.factory=()=>({world:()=>({engine,thinInstMgr:manager,component,player:1,rw:2,connection}),signature:()=>{reads++;return outfit;},exportWorld:async()=>new Uint8Array([1]).buffer});
 context.cosmetics=()=>({skin:outfit});
 vm.runInContext(`(${host.toString()})({});(${require('../client-observer.cjs').toString()})({action:'game'},factory);const api={getBloxd(){}};Object.defineProperty(api,'singletons',{value:{clientSidePartyStateManager:{userContext:{isLoggedIn:()=>true,getPlayerName:()=> 'Alex',getPlayerCosmetics:cosmetics}}}});`,context);
 await tick();scan();scan();await tick();assert.equal(exports,1);scan();const before=reads;
 for(let n=0;n<50;n++){now+=2000;scan();}assert.ok(reads-before<=10);assert.equal(exports,1);
 outfit='two';scan();scan();await tick();assert.equal(exports,2);
 connection='room-two';scan();scan();await tick();assert.equal(exports,3);
});
function temp(t){const folder=fs.mkdtempSync(path.join(os.tmpdir(),'bloxdy-pack-reload-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));return folder;}
test('Texture discovery timeout and teardown before discovery cannot throw or inspect queued getters',()=>{
 const queue=[],events={},statuses=[];let timeout;
 const context=vm.createContext({queueMicrotask:fn=>queue.push(fn),setTimeout:fn=>{timeout=fn;return 1;},clearTimeout(){},addEventListener:(key,fn)=>{(events[key]??=[]).push(fn);},bloxdLauncherClient:{texture:v=>statuses.push(v)}});
 vm.runInContext(`(${host.toString()})({});(${textures.install.toString()})({metaData:{id:'default2',version:1}});globalThis.reads=0;const value={};Object.defineProperty({},'value',{get:()=>value});`,context);
 assert.doesNotThrow(()=>timeout());for(const fn of events.pagehide)assert.doesNotThrow(fn);while(queue.length)queue.shift()();assert.equal(statuses[0].applied,false);assert.equal(context.__BLOXD_MOD_HOST__.status().observers.length,0);
});
test('JamBloxds 16x16 is the official bundled pack and requires no download',async t=>{
 const pack=await textures.load('jamBloxds16x16',temp(t),()=>{throw Error('Unexpected network');});
 assert.equal(pack.metaData.id,'jamBloxds16x16');assert.equal(pack.metaData.name,'JamBloxds 16x16');assert.equal(pack.metaData.author,'januaryboy');assert.ok(Object.keys(pack.textureOverrides).length>200);
});
test('Pack imports grant readable file and folder handles only to the owned Bloxd page',()=>{
 const contents={getURL:()=> 'https://bloxd.io/play/creative'},base={fileAccessType:'readable',filePath:'C:\\Packs\\Pack'};
 for(const isDirectory of [true,false])assert.equal(canReadPack(contents,contents,'https://bloxd.io',{...base,isDirectory,isMainFrame:false}),true);
 for(const details of [{...base,fileAccessType:'writable'},{...base,fileAccessType:undefined},{...base,filePath:''},{...base,embeddingOrigin:'https://evil.test'}])assert.equal(canReadPack(contents,contents,'https://bloxd.io',details),false);
 for(const origin of ['https://evil.test','https://bloxd.io.evil.test','file:///tmp'])assert.equal(canReadPack(contents,contents,origin,base),false);
 assert.equal(canReadPack({},contents,'https://bloxd.io',base),false);assert.equal(canReadPack({getURL:()=> 'https://accounts.google.com'},contents,'https://bloxd.io',base),false);
});
test('Preparing a pack and reloading preserve its selection token in the same exact session',t=>{
 const child={id:'a'.repeat(24),profile:{id:'balanced'},options:{action:'game'},output:temp(t)};
 const first=writeRequest(child,'jamBloxds16x16'),second=writeRequest(child,'jamBloxds16x16',true),third=writeRequest(child,'custom');
 assert.equal(first.reload,false);assert.equal(second.reload,true);assert.equal(first.textureRevision,second.textureRevision);assert.equal(third.textureRevision,first.textureRevision+1);assert.equal(third.sequence,3);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(child.output,'game-request.json'))),third);
 assert.throws(()=>writeRequest({...child,options:{action:'account'}},'default2'),/game profile/);
 assert.throws(()=>writeRequest(child,'../../secret'),/Unsupported/);
});
test('File watcher ignores other sessions, coalesces newer preparations and reloads only after prepare',async t=>{
 const folder=temp(t),id='a'.repeat(24),prepared=[],events=[],errors=[];let unblock;
 const blocked=new Promise(resolve=>unblock=resolve);
 const stop=watchRequests(folder,id,'balanced',async v=>{prepared.push(v);events.push('prepare:'+v.sequence);if(v.sequence===1)await blocked;},()=>events.push('reload'),error=>errors.push(error));t.after(stop);
 const child={id,profile:{id:'balanced'},options:{action:'game'},output:folder};
 const waitFor=async check=>{const end=Date.now()+2500;while(!check()){if(Date.now()>end)throw Error('Watcher did not complete.');await new Promise(resolve=>setTimeout(resolve,10));}};
 fs.writeFileSync(path.join(folder,'unrelated.json'),'{}');await tick();assert.equal(prepared.length,0);
 fs.writeFileSync(path.join(folder,'game-request.json'),'null');await new Promise(resolve=>setTimeout(resolve,30));assert.equal(prepared.length,0);assert.deepEqual(errors,[]);
 writeRequest(child,'default2',true);await waitFor(()=>prepared.length===1);assert.deepEqual(events,['prepare:1']);
 writeRequest(child,'jamBloxds16x16',true);await new Promise(resolve=>setTimeout(resolve,30));unblock();await waitFor(()=>events.includes('reload'));
 assert.deepEqual(events,['prepare:1','prepare:2','reload']);
 fs.writeFileSync(path.join(folder,'game-request.json'),JSON.stringify({...prepared[1],sequence:100,runId:'b'.repeat(24)}));await new Promise(resolve=>setTimeout(resolve,30));assert.equal(prepared.length,2);assert.deepEqual(errors,[]);
 stop();writeRequest(child,'custom',true);await new Promise(resolve=>setTimeout(resolve,30));assert.equal(prepared.length,2);
});
test('Pending atlas setup is bounded and later native saves, errors and temporary packs retain source semantics',async()=>{
 const memory=new Map(),events={},values=[];let finishAssets,timer;
 const context=vm.createContext({queueMicrotask,setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){},addEventListener:(name,fn)=>{(events[name]??=[]).push(fn);},sessionStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},bloxdLauncherClient:{texture:v=>values.push(v)}});
 context.assets=new Promise(resolve=>finishAssets=resolve);
 vm.runInContext(`(${host.toString()})({});globalThis.persisted=0;globalThis.texture={getTexture(){},getBlockAtlasArr(){return [];},setFromJson(pack){this.metaData=pack.metaData;return 7;},saveTexturePack(...args){persisted++;if(args[0]==='throw')throw Error('Disk error');if(args[0]==='reject')return Promise.reject(Error('Quota'));return Promise.resolve(args[0]);},indexedDBValuesLoadedPromise:Promise.resolve(),necessaryAssetsGeneratedPromise:assets};globalThis.original=texture.setFromJson;(${textures.install.toString()})({metaData:{id:'jamBloxds16x16',version:1}},{key:'one'});Object.defineProperty({},'texture',{get:()=>texture});`,context);
 await tick();assert.equal(context.texture.metaData.id,'jamBloxds16x16');await context.texture.saveTexturePack();assert.equal(context.persisted,0);assert.equal(values.length,0);
 finishAssets();await tick();assert.equal(context.texture.setFromJson,context.original);assert.equal(values.at(-1).applied,true);
 assert.equal(context.texture.setFromJson({metaData:{id:'custom',version:1}}),7);assert.equal(await context.texture.saveTexturePack(true),true);assert.equal(memory.size,0);
 assert.throws(()=>context.texture.saveTexturePack('throw'),/Disk/);assert.equal(memory.size,0);await assert.rejects(context.texture.saveTexturePack('reject'),/Quota/);await tick();assert.equal(memory.size,0);
 await context.texture.saveTexturePack(false);assert.equal(memory.get('bloxdy-texture-native'),'one');timer();assert.equal(values.at(-1).applied,true);
 for(const fn of events.pagehide)fn();assert.equal(context.__BLOXD_MOD_HOST__.status().observers.length,0);
});
