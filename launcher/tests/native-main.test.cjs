'use strict';
// Electron, files, transport and accounts are entirely mocked.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
async function harness(action='game',renderer='native-preview'){
  const dir=path.resolve(__dirname,'..'),ipc=new Map(),windows=[],transports=[],dialogs=[],writes=[],intervals=[];
  const profile={id:'balanced',accountId:'account-existing',name:'Balanced',renderer,performance:'balanced',ramGB:4,enabledMods:[],texture:'default2'};
  const account={id:'account-existing',selectedProfile:'balanced'},app=new EventEmitter();Object.assign(app,{isPackaged:false,setPath(){},setName(){},setAppUserModelId(){},commandLine:{appendSwitch(){}},requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),quit(){},exit(){},getAppMetrics:()=>[]});
  app.getPath=()=> 'C:/Fixture';
  class Window extends EventEmitter{constructor(){super();this.webContents=new EventEmitter();this.webContents.mainFrame={url:''};this.webContents.session={setPermissionRequestHandler(){},setPermissionCheckHandler(){}};windows.push(this);}loadURL(url){this.webContents.mainFrame.url=url;this.emit('ready-to-show');return Promise.resolve();}show(){}focus(){}isVisible(){return true;}isDestroyed(){return false;}}
  class Store{constructor(){this.state={selectedAccount:account.id,settings:{defaultMemoryGB:4}};}selectAccount(){}selectProfile(){}account(){return account;}profile(){return profile;}installedFor(){return [];}profilesFor(){return [profile];}profileFolder(){return 'C:/Fixture/Profile';}}
  class Transport extends EventEmitter{constructor(root,options){super();this.options=options;transports.push(this);}write(){return true;}frame(after){return {sequence:after===null?1:after+1};}stop(){}}
  const sandbox={__dirname:dir,process:{env:{},argv:['--launcher-game','--profile-id=balanced','--run-id='+'a'.repeat(24),'--client-action='+action]},console:{error(message){throw Error(message);}},setInterval(fn){intervals.push(fn);return {unref(){}};},clearInterval(){},setTimeout:()=>({unref(){}}),clearTimeout(){},URL,AbortSignal,
    require(name){if(name==='electron')return {app,BrowserWindow:Window,ipcMain:{handle:(key,fn)=>ipc.set(key,fn),on:(key,fn)=>ipc.set(key,fn)},dialog:{showMessageBox(_window,options){dialogs.push(options);return Promise.resolve({response:0});}},Menu:{setApplicationMenu(){}}};
      if(name==='node:fs')return {existsSync:()=>true,readFileSync:()=>JSON.stringify({enforced:true,limitGB:4}),mkdirSync(){},writeFileSync(file,value){writes.push({file,value});},renameSync(){},appendFileSync(){}};
      if(name==='./session-reload.cjs')return {watchRequests:()=>()=>{}};if(name==='./store.cjs')return {Store};if(name==='../bridge/transport.cjs')return {Transport};if(name==='./paths.cjs')return {paths:()=>({root:'C:/Fixture',data:'C:/Fixture/Data',native:'C:/Fixture/native.exe'})};
      if(name==='./textures.cjs')return {load:async()=>null};if(name==='./game-preload.cjs')return {generate:()=> 'C:/Fixture/preload.cjs'};if(name==='../bridge/google-auth-popup.cjs')return {installBloxdAuthPopups(){}};
      return name.startsWith('.')?require(path.resolve(dir,name)):require(name);
    }};
  vm.runInNewContext(fs.readFileSync(path.join(dir,'main.cjs'),'utf8'),sandbox);await new Promise(resolve=>setImmediate(resolve));return {ipc,windows,transports,dialogs,writes,intervals};
}
test('native game requests embedded output and only its own main frame can fetch native pixels',async()=>{
  const h=await harness(),window=h.windows[0];assert.equal(h.transports.length,1);assert.equal(h.transports[0].options.embedded,true);
  const frame=h.ipc.get('native:frame'),own={sender:window.webContents,senderFrame:window.webContents.mainFrame};assert.equal(frame(own,7).sequence,8);
  assert.throws(()=>frame({sender:window.webContents,senderFrame:{url:'https://bloxd.io'}},7),/not active/);assert.throws(()=>frame({sender:{},senderFrame:window.webContents.mainFrame},7),/not active/);
});
test('account-only windows never create native output or expose pixels',async()=>{
  const h=await harness('account');assert.equal(h.transports.length,0);assert.throws(()=>h.ipc.get('native:frame')({sender:h.windows[0].webContents,senderFrame:h.windows[0].webContents.mainFrame},null),/not active/);
});

test('standard Bloxd mode never constructs the experimental native transport or exposes native pixels',async()=>{
  const h=await harness('game','standard');assert.equal(h.transports.length,0);assert.throws(()=>h.ipc.get('native:frame')({sender:h.windows[0].webContents,senderFrame:h.windows[0].webContents.mainFrame},null),/not active/);
});
test('native diagnostics persist only bounded render fields and ignore unrelated page data',async()=>{
  const h=await harness(),window=h.windows[0],send=h.ipc.get('native:status'),own={sender:window.webContents,senderFrame:window.webContents.mainFrame};
  send(own,{phase:'streaming',meshes:10,error:'x'.repeat(300),source:{bodyText:'PRIVATE'},nativeReady:false,sourceDrawsSuppressed:false,activeMeshes:14,pendingMeshes:4,unsupportedMeshes:1,fallbackReason:'x'.repeat(300),presentation:{phase:'presenting',frames:4,token:'PRIVATE'}});
  assert.equal(h.transports[0].captureStatus.meshes,10);assert.equal(h.transports[0].captureStatus.error.length,200);assert.equal(h.transports[0].captureStatus.presentation.frames,4);assert.doesNotMatch(JSON.stringify(h.transports[0].captureStatus),/PRIVATE/);
  assert.equal(h.transports[0].captureStatus.nativeReady,false);assert.equal(h.transports[0].captureStatus.sourceDrawsSuppressed,false);assert.equal(h.transports[0].captureStatus.unsupportedMeshes,1);assert.equal(h.transports[0].captureStatus.fallbackReason.length,200);
  send({sender:{},senderFrame:window.webContents.mainFrame},{phase:'error',meshes:99});assert.equal(h.transports[0].captureStatus.meshes,10);
});

test('F8 and saved F9 samples distinguish source cadence from a paused native renderer',async()=>{
  const h=await harness(),window=h.windows[0],own={sender:window.webContents,senderFrame:window.webContents.mainFrame};
  h.transports[0].status={fps:0};h.ipc.get('native:status')(own,{phase:'streaming',sourceFPS:72.5,sourceDrawsSuppressed:false,importEnabled:false,tickMs:.2,pendingMeshes:612,presentation:{phase:'source-fallback',frames:0}});
  for(const fn of h.intervals)fn();window.webContents.emit('before-input-event',{preventDefault(){}},{type:'keyDown',key:'F8'});
  assert.match(h.dialogs.at(-1).detail,/Renderer: source-fallback/);assert.match(h.dialogs.at(-1).detail,/Source engine FPS: 72\.5/);assert.doesNotMatch(h.dialogs.at(-1).detail,/Native render FPS/);
  window.webContents.emit('before-input-event',{preventDefault(){}},{type:'keyDown',key:'F9'});
  const saved=JSON.parse(h.writes.filter(w=>w.file.endsWith('client-updates.json.tmp')).at(-1).value).benchmark.samples.at(-1);
  assert.equal(saved.nativeFPS,null);assert.equal(saved.renderer.sourceFPS,72.5);assert.equal(saved.renderer.mode,'source-fallback');assert.equal(saved.renderer.importEnabled,false);
});

test('F8 native FPS requires actual presentation ownership and invalid source FPS stays unavailable',async()=>{
  const h=await harness(),window=h.windows[0],own={sender:window.webContents,senderFrame:window.webContents.mainFrame},send=h.ipc.get('native:status');
  h.transports[0].status={fps:59.5};send(own,{phase:'streaming',sourceFPS:Infinity,sourceDrawsSuppressed:false,presentation:{phase:'source-fallback'}});
  window.webContents.emit('before-input-event',{preventDefault(){}},{type:'keyDown',key:'F8'});assert.match(h.dialogs.at(-1).detail,/Source engine FPS: unavailable/);
  send(own,{phase:'streaming',sourceFPS:72.5,sourceDrawsSuppressed:true,presentation:{phase:'presenting'}});
  window.webContents.emit('before-input-event',{preventDefault(){}},{type:'keyDown',key:'F8'});assert.match(h.dialogs.at(-1).detail,/Native render FPS: 59\.5/);
});
