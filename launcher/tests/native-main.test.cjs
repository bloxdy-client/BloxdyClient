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
for(const renderer of ['standard','native-preview'])test(`Standard client uses Bloxd even for saved ${renderer} profiles`,async()=>{
 const h=await harness('game',renderer),w=h.windows[0],own={sender:w.webContents,senderFrame:w.webContents.mainFrame};assert.equal(h.transports.length,0);assert.equal(w.webContents.mainFrame.url,'https://bloxd.io/?siteUsed=desktopMicrosoftStore');assert.throws(()=>h.ipc.get('native:frame')(own,null),/not active/);assert.throws(()=>h.ipc.get('native:packet')(own,new Uint8Array()),/not active/);h.ipc.get('native:status')(own,{phase:'streaming',sourceDrawsSuppressed:true});assert.equal(h.writes.some(x=>x.file.endsWith('capture-status.json')),false);
});
