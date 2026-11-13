'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{JSDOM}=require('jsdom');
const {failurePage,installGameLoadRecovery}=require('../game-load-error.cjs');
function fixture(){const window=new EventEmitter(),calls=[],reports=[];Object.assign(window,{webContents:new EventEmitter(),isDestroyed:()=>false,loadURL:async url=>{calls.push(url);},show(){window.visible=true;}});window.webContents.reload=()=>{window.reloads=(window.reloads||0)+1;};const url='https://bloxd.io/?siteUsed=desktopMicrosoftStore',recovery=installGameLoadRecovery(window,{url,report:value=>reports.push(value)});return {window,calls,reports,recovery,url};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('DNS failures show an offline page without scripts, with a user retry to the original official URL',()=>{
 const target='https://bloxd.io/?siteUsed=desktopMicrosoftStore&renderer=webgl2',url=failurePage(target,'ERR_NAME_NOT_RESOLVED'),dom=new JSDOM(decodeURIComponent(url.split(',').slice(1).join(','))),d=dom.window.document;
 assert.match(d.body.textContent,/DNS server could not resolve bloxd.io/);assert.equal(d.querySelector('a').href,target);assert.equal(d.querySelectorAll('script,iframe,img').length,0);dom.window.close();
});
test('Main-frame DNS failure remains visible and F5 retries the official URL in the same window',async()=>{
 const f=fixture();await f.recovery.load();f.window.webContents.emit('did-fail-load',{},-105,'ERR_NAME_NOT_RESOLVED',f.url,true);await tick();assert.equal(f.calls.length,2);assert.match(f.calls[1],/^data:text\/html/);assert.equal(f.window.visible,true);assert.equal(f.reports[0].code,'ERR_NAME_NOT_RESOLVED');
 await f.recovery.reload();assert.equal(f.calls[2],f.url);f.window.webContents.emit('did-finish-load');assert.equal(f.reports.at(-1).phase,'loaded');f.recovery.reload();assert.equal(f.window.reloads,1);
});
test('Rejected initial navigation shows the failure page once even when the failure event was delivered first',async()=>{
 const f=fixture();f.window.loadURL=async url=>{f.calls.push(url);if(url===f.url){f.window.webContents.emit('did-fail-load',{},-105,'ERR_NAME_NOT_RESOLVED',url,true);throw Object.assign(Error('ERR_NAME_NOT_RESOLVED'),{code:'ERR_NAME_NOT_RESOLVED'});}};
 await f.recovery.load();await tick();assert.equal(f.calls.length,2);assert.equal(f.reports.length,1);
});
test('Subframes, aborted navigation and a closed window never trigger a failure page',async()=>{
 const f=fixture();for(const [code,description,url,main] of [[-105,'ERR_NAME_NOT_RESOLVED',f.url,false],[-3,'ERR_ABORTED',f.url,true],[-105,'ERR_NAME_NOT_RESOLVED','data:text/html,error',true]])f.window.webContents.emit('did-fail-load',{},code,description,url,main);
 assert.equal(f.calls.length,0);f.window.emit('closed');f.window.webContents.emit('did-fail-load',{},-105,'ERR_NAME_NOT_RESOLVED',f.url,true);await f.recovery.load();assert.equal(f.calls.length,0);
});
test('Failed user retries display the page again and diagnostic storage errors cannot prevent recovery',async()=>{
 const f=fixture();await f.recovery.load();for(let n=0;n<2;n++){f.window.webContents.emit('did-start-navigation',{},f.url,false,true);f.window.webContents.emit('did-fail-load',{},-106,'ERR_INTERNET_DISCONNECTED',f.url,true);await tick();}assert.equal(f.calls.length,3);assert.equal(f.reports.length,2);
 const other=fixture();other.recovery=installGameLoadRecovery(other.window,{url:other.url,report(){throw Error('Busy diagnostic file');}});other.window.webContents.emit('did-fail-load',{},-105,'ERR_NAME_NOT_RESOLVED',other.url,true);await tick();assert.equal(other.window.visible,true);
});
