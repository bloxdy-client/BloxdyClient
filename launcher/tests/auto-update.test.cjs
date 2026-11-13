'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {installAutoUpdates}=require('../auto-update.cjs');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
 const updater=new EventEmitter(),timers=new Set(),calls=[];let busy=!!options.busy,fail=false,finishDownload;
 class CancellationToken{cancel(){this.cancelled=true;finishDownload?.reject(Error('Cancelled'));}}
 updater.checkForUpdates=async()=>{calls.push('check');if(fail)throw Error('Offline');updater.emit(options.available===false?'update-not-available':'update-available',{version:'2.0.0'});};
 updater.downloadUpdate=token=>{calls.push('download');return new Promise((resolve,reject)=>{finishDownload={resolve,reject,token};});};
 const api=installAutoUpdates({app:{isPackaged:true},platform:'win32',isBusy:()=>busy,load:()=>({autoUpdater:updater,CancellationToken}),schedule(fn,ms){const timer={fn,ms,unref(){}};timers.add(timer);return timer;},cancel:t=>timers.delete(t),...options});
 return {api,updater,timers,calls,get download(){return finishDownload;},setBusy(v){busy=v;api.activityChanged();},setFail(v){fail=v;},async tick(){const timer=timers.values().next().value;if(timer){timers.delete(timer);timer.fn();}await flush();}};
}
test('Development, game processes and Linux never load update libraries or schedule network work',()=>{
 for(const options of [{app:{isPackaged:false}},{gameMode:true},{platform:'linux'}]){const f=fixture({...options,load(){throw Error('Must not load');}});assert.equal(f.api.status().phase,'disabled');assert.equal(f.timers.size,0);}
});
test('Installed launchers download automatically and stage a silent update for quit without relaunching',async()=>{
 const f=fixture();assert.deepEqual(f.calls,[]);await f.tick();assert.deepEqual(f.calls,['check','download']);assert.equal(f.api.status().phase,'downloading');
 f.updater.emit('update-downloaded',{version:'2.0.0'});f.download.resolve();await flush();assert.equal(f.api.status().phase,'ready');assert.equal(f.updater.autoInstallOnAppQuit,true);assert.equal(f.updater.autoRunAppAfterInstall,false);assert.equal(f.updater.disableDifferentialDownload,true);f.api.dispose();
});
test('Game startup cancels background downloads, resumes when idle and cannot install during a game',async()=>{
 const f=fixture();await f.tick();f.setBusy(true);await flush();assert.equal(f.download.token.cancelled,true);assert.equal(f.updater.autoInstallOnAppQuit,false);assert.equal(f.api.status().phase,'waiting');
 f.setBusy(false);await f.tick();assert.deepEqual(f.calls,['check','download','check','download']);f.updater.emit('update-downloaded',{version:'2.0.0'});f.download.resolve();await flush();
 f.setBusy(true);assert.equal(f.updater.autoInstallOnAppQuit,false);assert.equal(f.api.status().phase,'ready');f.setBusy(false);assert.equal(f.updater.autoInstallOnAppQuit,true);f.api.dispose();
});
test('Offline checks and failed downloads retry without quitting, while staged updates survive later events',async()=>{
 const f=fixture();f.setFail(true);await f.tick();assert.equal(f.api.status().phase,'error');assert.equal([...f.timers][0].ms,15*60*1000);
 f.setFail(false);await f.tick();f.download.reject(Error('Connection lost'));await flush();assert.equal(f.api.status().phase,'error');await f.tick();
 f.updater.emit('update-downloaded',{version:'2.0.0'});f.download.resolve();await flush();f.updater.emit('error',Error('Late'));f.updater.emit('update-not-available');assert.equal(f.api.status().phase,'ready');f.api.dispose();
});
test('Disposal ignores delayed work and never installs or starts applications in the test',async()=>{
 const f=fixture();await f.tick();f.api.dispose();await flush();assert.equal(f.timers.size,0);assert.equal(f.updater.autoInstallOnAppQuit,false);assert.equal(f.updater.listenerCount('update-downloaded'),0);
});
