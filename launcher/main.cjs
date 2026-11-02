'use strict';
const {app,BrowserWindow,ipcMain,dialog,Menu}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{fileURLToPath}=require('node:url');
const {Store}=require('./store.cjs'),{plan,ID,validateSettings}=require('./model.cjs'),packs=require('./minecraft-packs.cjs'),textures=require('./textures.cjs'),{generate}=require('./game-preload.cjs');
const {Transport}=require('../bridge/transport.cjs'),{installBloxdAuthPopups}=require('../bridge/google-auth-popup.cjs');
const {defaults}=require('./profile-settings.cjs'),{partition,publicMetadata}=require('./accounts.cjs'),{validateCharacter,MAX_BYTES}=require('./character-glb.cjs');
const accountConnection=require('./account-capabilities.cjs');
const crazyGames=require('./crazygames.cjs');
const appIcon=path.join(__dirname,'assets','bloxdy-icon.png');
const {canReadPack}=require('./pack-permissions.cjs'),{writeRequest,watchRequests}=require('./session-reload.cjs');
const {paths}=require('./paths.cjs'),{GameRunner}=require('./game-runner.cjs'),locations=paths(app,process),root=locations.root;
const gameMode=process.argv.includes('--launcher-game'),arg=name=>process.argv.find(v=>v.startsWith(name+'='))?.slice(name.length+1),runId=arg('--run-id'),clientAction=arg('--client-action')||'game';
let launcher,game,store,transport,runner,sessionProfile=null,sessionAccount=null,enabled=new Set(),downloadBusy=false,metrics=[],quitting=false,updates={sequence:0,modules:{}};
let pendingDeletion=null;
let litematicaDiagnosticRequested=false;
let shaderDiagnosticRequested=false;
let embeddedGame=false,sessionGameFrame=null;
app.setPath('userData',path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'BloxdNative',gameMode?'desktop-profile':'launcher-ui-profile'));
app.setName(gameMode?'Bloxdy Game Client':'Bloxdy Client');app.setAppUserModelId(gameMode?'io.bloxdnative.game':'io.bloxdnative.launcher');
app.commandLine.appendSwitch('lang','en-US');
const ownsInstance=app.requestSingleInstanceLock();if(!ownsInstance)app.quit();
function local(event){try{return launcher&&event.sender===launcher.webContents&&event.senderFrame===launcher.webContents.mainFrame&&fileURLToPath(event.senderFrame.url)===path.join(__dirname,'index.html');}catch{return false;}}
function fromGame(event){try{return game&&event.sender===game.webContents&&crazyGames.gameFrame(game.webContents,event.senderFrame,embeddedGame);}catch{return false;}}
function runFolder(){if(!/^[a-f0-9]{24}$/.test(runId))throw Error('Invalid game session.');return path.join(locations.data,'runs',runId);}
function writeRun(file,value){const folder=runFolder();fs.mkdirSync(folder,{recursive:true});const target=path.join(folder,file),temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(value));fs.renameSync(temp,target);}
let updateTimer=null,updateDelay=50,updatePending=false,updateStopped=false,updateErrorCode=null;
function updateDiagnostic(code){try{writeRun('client-update-error.json',{code,pending:updatePending});}catch{/* Diagnostics must not interrupt gameplay either. */}}
function flushUpdates(retry=true){
 if(!updatePending)return true;
 try{writeRun('client-updates.json',updates);updatePending=false;updateDelay=50;if(updateErrorCode!==null){updateErrorCode=null;updateDiagnostic(null);}return true;}
 catch(error){
  const code=typeof error?.code==='string'?error.code:'UNKNOWN';
  if(updateErrorCode!==code){updateErrorCode=code;console.error('Client status could not be saved ('+code+').');updateDiagnostic(code);}
  // Keep the last committed JSON intact. Retry on a timer, never in a blocking
  // loop; every retry publishes the latest combined delta, not an old snapshot.
  if(retry&&!updateStopped&&['EPERM','EACCES','EBUSY'].includes(code)){
   updateTimer=setTimeout(()=>{updateTimer=null;flushUpdates();},updateDelay);updateTimer.unref?.();updateDelay=Math.min(updateDelay*2,5000);
  }
  return false;
 }
}
function writeUpdates(){updates.sequence++;updatePending=true;return updateTimer===null?flushUpdates():false;}
function stopUpdates(){updateStopped=true;clearTimeout(updateTimer);updateTimer=null;flushUpdates(false);}
function sample(){
 const all=app.getAppMetrics(),memoryKB=all.reduce((n,p)=>n+(Number(p.memory?.workingSetSize)||0),0),cpu=all.reduce((n,p)=>n+(Number(p.cpu?.percentCPUUsage)||0),0);let budget=null;
 if(gameMode)try{budget=JSON.parse(fs.readFileSync(path.join(runFolder(),'memory-budget.json'),'utf8'));}catch{}
 const capture=transport?.captureStatus,nativeActive=capture?.sourceDrawsSuppressed===true&&capture?.presentation?.phase==='presenting';
 const renderer=transport?{mode:nativeActive?'native':capture?'source-fallback':'waiting',sourceFPS:capture?.sourceFPS??null,captureMs:capture?.tickMs??null,pendingMeshes:capture?.pendingMeshes??null,importEnabled:capture?.importEnabled===true,fallbackReason:capture?.fallbackReason??null}:null;
 return {at:Date.now(),workingSetMB:Math.round(memoryKB/1024*10)/10,cpuPercent:Math.round(cpu*10)/10,nativePreview:!!transport,nativeFPS:nativeActive?transport.status?.fps??null:null,renderer,budget,scope:'Electron working sets; the game budget limits committed memory across its process group, excluding VRAM.'};
}
async function showLauncher(){if(launcher&&!launcher.isDestroyed()){if(launcher.isMinimized?.())launcher.restore();launcher.show();launcher.focus?.();return;}
 launcher=new BrowserWindow({width:1280,height:800,minWidth:1024,minHeight:700,frame:false,title:'Bloxdy Client',icon:appIcon,backgroundColor:'#0b0e11',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});Menu.setApplicationMenu(null);
 launcher.webContents.setWindowOpenHandler(()=>({action:'deny'}));launcher.webContents.on('will-navigate',event=>event.preventDefault());launcher.on('closed',()=>{launcher=null;});await launcher.loadFile(path.join(__dirname,'index.html'));
}
function readUpdates(child){let value;try{value=JSON.parse(fs.readFileSync(path.join(child.output,'client-updates.json'),'utf8'));}catch{return;}if(!Number.isInteger(value.sequence)||value.sequence<=child.lastSequence)return;child.lastSequence=value.sequence;
 // The parent alone writes launcher-state.json; a game sends scoped deltas.
 try{if(value.account&&store.state.accounts.some(a=>a.id===child.options.accountId)){const accountChanged=JSON.stringify(publicMetadata(store.account(child.options.accountId)))!==JSON.stringify(publicMetadata(value.account));store.updateAccount(child.options.accountId,value.account);if(accountChanged&&runner===child)launcher?.webContents.send?.('launcher:state-changed');if(value.character&&(value.character.sha256!==child.lastCharacter||!store.account(child.options.accountId).character)&&value.character.file==='character.glb'){const file=path.join(child.output,'character.glb');if(fs.realpathSync(file)!==file||fs.statSync(file).size>MAX_BYTES)throw Error('Invalid character transfer.');const bytes=fs.readFileSync(file);if(require('./data-files.cjs').hash(bytes)!==value.character.sha256)throw Error('Character transfer checksum mismatch.');store.saveCharacter(child.options.accountId,value.account,bytes);child.lastCharacter=value.character.sha256;}}child.characterStatus=value.characterStatus||null;child.lastModules??={};for(const [id,values]of Object.entries(value.modules||{})){const encoded=JSON.stringify(values);if(child.lastModules[id]!==encoded&&child.profile.enabledMods.includes(id)&&store.state.profiles.some(p=>p.id===child.profile.id)){store.writeStorage(child.profile.id,id,values);child.lastModules[id]=encoded;}}if(value.benchmark&&child.lastBenchmark!==value.benchmark.at){child.lastBenchmark=value.benchmark.at;store.state.benchmarks.push(value.benchmark);store.state.benchmarks=store.state.benchmarks.slice(-12);store.save();}child.textureStatus=value.texture||null;child.reloadStatus=value.reload||null;}catch(error){child.updateError=error.message;child.characterStatus={phase:'error',message:error.message};}
}
function accountProfile(accountId){const all=store.profilesFor(accountId),p=all.find(p=>p.id===store.account(accountId).selectedProfile)||all[0];return {...(p||{id:'account-window',accountId,name:'Account',performance:'balanced',ramGB:store.state.settings.defaultMemoryGB}),renderer:'standard',enabledMods:[]};}
function deletionTarget(kind,id){if(typeof id!=='string'||!ID.test(id)||!['profile','account'].includes(kind))throw Error('Invalid deletion request.');if(kind==='profile'){const p=store.profile(id);if(p.accountId!==store.state.selectedAccount)throw Error('Select this account first.');if(runner?.profile.id===id)throw Error('Close this profile’s Bloxd window first.');return {kind,id,name:p.name};}const a=store.account(id);if(runner?.options.accountId===id)throw Error('Close this account’s Bloxd window first.');return {kind,id,name:a.username||a.label};}
function confirmedDeletion(kind,value){if(!value||!pendingDeletion||pendingDeletion.kind!==kind||pendingDeletion.id!==value.id||pendingDeletion.token!==value.token||Date.now()>pendingDeletion.expires)throw Error('Confirm this deletion in Bloxdy Client first.');const target=deletionTarget(kind,value.id);pendingDeletion=null;return target.id;}
async function startClient(baseline=false,action='game',accountId=store.state.selectedAccount){if(!['game','account'].includes(action))throw Error('Invalid account window action.');if(runner)throw Error('A Bloxd window is already open. Close it before starting another session.');const account=store.account(accountId),profile=action==='game'?store.profile():accountProfile(accountId);if(profile.accountId!==account.id)throw Error('Profile and account do not match.');if(action==='game'&&!baseline&&account.provider==='crazygames'&&profile.renderer==='native-preview')throw Error('CrazyGames profiles currently require Standard Bloxd.');const result=baseline||action!=='game'?{ok:true}:plan(profile,store.installedFor(profile.id));if(!result.ok)throw Error(result.errors.join('\n'));
 const child=new GameRunner(profile,baseline,{...locations,executable:locations.gameExecutable,packaged:app.isPackaged,runner:locations.runner,accountId:account.id,action});child.lastSequence=0;runner=child;const poll=setInterval(()=>readUpdates(child),action==='account'?250:1000);poll.unref();
 child.on('closed',()=>{clearInterval(poll);readUpdates(child);if(runner!==child)return;runner=null;if(!quitting){launcher?.webContents.send?.('launcher:state-changed');showLauncher().catch(()=>{});}});
 try{const result=await child.start();if(action==='game'&&store.state.settings.minimizeOnPlay&&launcher&&!launcher.isDestroyed())launcher.minimize();return {...result,action};}catch(error){clearInterval(poll);if(runner===child)runner=null;throw error;}
}
async function openGameWindow(baseline=false){if(!['game','account'].includes(clientAction))throw Error('Invalid client action.');sessionAccount=arg('--account-id')||store.state.selectedAccount;if(!ID.test(sessionAccount))throw Error('Invalid account.');store.selectAccount(sessionAccount);const account=store.account(),isGame=clientAction==='game';embeddedGame=account.provider==='crazygames';if(isGame)store.selectProfile(arg('--profile-id'));
 const profile=isGame?store.profile():accountProfile(sessionAccount),result=baseline||!isGame?{ok:true,modules:[]}:plan(profile,store.installedFor());if(!result.ok)throw Error(result.errors.join('\n'));sessionProfile=profile.id;enabled=new Set(result.modules.map(m=>m.id));
 if(embeddedGame&&isGame&&!baseline&&profile.renderer==='native-preview')throw Error('CrazyGames profiles currently require Standard Bloxd.');
 const native=isGame&&!baseline&&profile.renderer==='native-preview',activeProfile={...profile,renderer:native?'native-preview':'standard'},output=runFolder(),budget=JSON.parse(fs.readFileSync(path.join(output,'memory-budget.json'),'utf8'));if(!budget.enforced||budget.limitGB!==profile.ramGB)throw Error('The memory budget was not confirmed.');
 const texture=isGame?await textures.load(profile.texture||'default2',path.join(store.profileFolder(),'textures')):null;
 const preloadOptions={action:clientAction,texture,textureKey:runId+':0',embedded:embeddedGame};
 const preload=generate(store,activeProfile,result.modules,output,preloadOptions);
 if(native){if(!fs.existsSync(locations.native))throw Error('Native preview is missing from the installation.');transport=new Transport(root,{output,executable:locations.native,embedded:true});transport.on('fault',error=>fs.appendFileSync(path.join(output,'native-error.log'),error.message+'\n'));}
 game=new BrowserWindow({width:1280,height:800,show:false,title:embeddedGame?'Bloxdy Client - CrazyGames':!isGame?'Bloxdy Client — Account settings':baseline?'Bloxdy Client — Bloxd baseline':'Bloxdy Client — '+profile.name,icon:appIcon,backgroundColor:'#111318',webPreferences:{preload,partition:partition(account),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,nodeIntegrationInSubFrames:embeddedGame,backgroundThrottling:!native}});
 const ownedGame=game;let closingGame=false,reloadingGame=false,closeDeadline;
 function reloadPage(){if(ownedGame.isDestroyed()||closingGame)return;reloadingGame=true;ownedGame.webContents.reload();}
 const stopRequests=isGame?watchRequests(output,runId,profile.id,async request=>{
  const next=await textures.load(request.texture,path.join(store.profileFolder(profile.id),'textures'));
  if(ownedGame.isDestroyed()||closingGame)return;
  generate(store,activeProfile,result.modules,output,{...preloadOptions,texture:next,textureKey:runId+':'+request.textureRevision});
  updates.reload={sequence:request.sequence,prepared:true};writeUpdates();
 },reloadPage,error=>{updates.reload={prepared:false,error:String(error.message).slice(0,200)};writeUpdates();}):()=>{};
 ownedGame.webContents.on('preload-error',(_event,_file,error)=>writeRun('preload-error.json',{message:String(error?.message||error).slice(0,200)}));
 // A native close/Alt+F4 must complete even when Bloxd's beforeunload or a
 // hung renderer refuses it. All cleanup belongs to this game process alone.
 ownedGame.on('close',()=>{closingGame=true;if(!closeDeadline){closeDeadline=setTimeout(()=>{if(!ownedGame.isDestroyed())ownedGame.destroy();},1500);closeDeadline.unref?.();}});
 ownedGame.webContents.on('will-prevent-unload',event=>{if(closingGame||reloadingGame)event.preventDefault();});
 ownedGame.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame){sessionGameFrame=null;litematicaDiagnosticRequested=false;}});
 ownedGame.webContents.on('did-finish-load',()=>{reloadingGame=false;litematicaDiagnosticRequested=false;});
 ownedGame.webContents.on('render-process-gone',()=>{if(!ownedGame.isDestroyed())ownedGame.destroy();});
 let microphoneGranted=false;
 const packPermissionStats={checks:0,requests:0,allowed:0,denied:0,cases:[]};
 function checkPackPermission(kind,contents,origin,details){
  const allowed=isGame&&canReadPack(contents,ownedGame.webContents,origin,details,embeddedGame);
  packPermissionStats[kind==='check'?'checks':'requests']++;
  packPermissionStats[allowed?'allowed':'denied']++;
  const item={kind,allowed,ownedContents:contents===ownedGame.webContents,bloxdOrigin:origin==='https://bloxd.io',access:details?.fileAccessType==='readable'?'readable':details?.fileAccessType==='writable'?'writable':'missing-or-other',hasPath:typeof details?.filePath==='string'&&details.filePath.length>0,embedded:!!details?.embeddingOrigin};
  const prior=packPermissionStats.cases.find(value=>Object.keys(item).every(key=>value[key]===item[key]));
  if(prior)prior.count++;else if(packPermissionStats.cases.length<24)packPermissionStats.cases.push({...item,count:1});
  const total=packPermissionStats.checks+packPermissionStats.requests;
  if(total<=10||(total&(total-1))===0)try{writeRun('shader-pack-access.json',packPermissionStats);}catch{/* A diagnostic must not interrupt the file picker. */}
  return allowed;
 }
 installBloxdAuthPopups(game.webContents,embeddedGame?{additionalAuthURL:crazyGames.authURL}:{});game.webContents.on('will-navigate',(event,url)=>{try{if(embeddedGame?!crazyGames.portalNavigation(url):new URL(url).origin!=='https://bloxd.io')event.preventDefault();}catch{event.preventDefault();}});
 game.once('ready-to-show',()=>{game.show();game.focus?.();if(game.isVisible?.()!==false)writeRun('game-start.json',{runId,phase:'visible'});});
 const timer=isGame?setInterval(()=>{if(game&&!game.isDestroyed()){metrics.push(sample());if(metrics.length>600)metrics.shift();}},2000):null;timer?.unref();
 Menu.setApplicationMenu(null);
 // Keep diagnostics available without a native menu bar, even on Alt.
 ownedGame.webContents.on('before-input-event',(event,input)=>{
  if(input.type==='keyDown'&&!input.isAutoRepeat&&!input.alt&&!input.meta&&!input.shift&&(input.key==='F5'||input.control&&input.key.toLowerCase()==='r')){event.preventDefault();reloadPage();return;}
  if(input.type!=='keyDown'||input.isAutoRepeat||input.control||input.alt||input.meta||input.shift)return;
  if(input.key==='F9'&&isGame&&enabled.has('bloxd-visual-shader')){
    shaderDiagnosticRequested=true;
    if(embeddedGame){if(sessionGameFrame&&crazyGames.gameFrame(ownedGame.webContents,sessionGameFrame,true))sessionGameFrame.send('client:shader-diagnostics-request');}
    else ownedGame.webContents.send?.('client:shader-diagnostics-request');
  }
  if(input.key==='F8'){event.preventDefault();const s=sample(),fps=s.renderer?.mode==='native'?s.nativeFPS:s.renderer?.sourceFPS;
    const detail=s.renderer?`Renderer: ${s.renderer.mode}\n${s.renderer.mode==='native'?'Native render FPS':'Source engine FPS'}: ${fps===null?'unavailable':Math.round(fps*10)/10}\nCapture: ${s.renderer.captureMs===null?'unavailable':Math.round(s.renderer.captureMs*10)/10+' ms'}\nPending native meshes: ${s.renderer.pendingMeshes??'unavailable'}\n\n${s.scope}`:s.scope;
    dialog.showMessageBox(ownedGame,{title:'Performance',message:`${s.workingSetMB} MB RAM · ${s.cpuPercent}% CPU`,detail});}
  else if(input.key==='F9'&&isGame){event.preventDefault();if(enabled.has('bloxd-litematica')){litematicaDiagnosticRequested=true;if(embeddedGame){if(sessionGameFrame&&crazyGames.gameFrame(ownedGame.webContents,sessionGameFrame,true))sessionGameFrame.send('client:litematica-diagnostics-request');}else ownedGame.webContents.send?.('client:litematica-diagnostics-request');}updates.benchmark={at:new Date().toISOString(),profile:profile.name,baseline,modules:[...enabled],samples:metrics};const saved=writeUpdates();dialog.showMessageBox(ownedGame,{message:saved?'Measurement saved.':'Measurement could not be saved yet.'});}
 });
 game.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>{let origin='';try{origin=new URL(details.requestingUrl||'').origin;}catch{}if(permission==='fileSystem')return callback(checkPackPermission('request',contents,origin,details));if(contents===game?.webContents&&embeddedGame&&crazyGames.portalGame(ownedGame.webContents.mainFrame.url)&&['https://www.crazygames.com','https://gameframe.crazygames.com'].includes(origin)&&permission==='fullscreen')return callback(true);if(contents!==game?.webContents||origin!=='https://bloxd.io')return callback(false);if(embeddedGame&&!crazyGames.portalGame(ownedGame.webContents.mainFrame.url))return callback(false);if(['fullscreen','pointerLock','keyboardLock'].includes(permission))return callback(true);if(permission==='loopback-network'&&enabled.has('bloxd-party-voice'))return callback(true);if(permission!=='media'||!enabled.has('bloxd-party-voice')||!details.mediaTypes?.length||details.mediaTypes.some(type=>type!=='audio'))return callback(false);dialog.showMessageBox(game,{type:'question',message:'Allow microphone access for Party Voice?',buttons:['Allow','Cancel'],defaultId:1,cancelId:1}).then(({response})=>{microphoneGranted=response===0;callback(microphoneGranted);}).catch(()=>callback(false));});
 game.webContents.session.setPermissionCheckHandler((contents,permission,requestingOrigin,details)=>{let origin='';try{origin=new URL(requestingOrigin).origin;}catch{}if(permission==='fileSystem')return checkPackPermission('check',contents,origin,details);if(contents===game?.webContents&&embeddedGame&&crazyGames.portalGame(ownedGame.webContents.mainFrame.url)&&['https://www.crazygames.com','https://gameframe.crazygames.com'].includes(origin)&&permission==='fullscreen')return true;if(contents!==game?.webContents||origin!=='https://bloxd.io')return false;if(embeddedGame&&!crazyGames.portalGame(ownedGame.webContents.mainFrame.url))return false;if(['fullscreen','pointerLock','keyboardLock'].includes(permission))return true;if(permission==='loopback-network')return enabled.has('bloxd-party-voice');return permission==='media'&&details.mediaType==='audio'&&enabled.has('bloxd-party-voice')&&microphoneGranted;});
 game.on('closed',()=>{stopRequests();clearTimeout(closeDeadline);clearInterval(timer);stopUpdates();try{writeRun('game-start.json',{runId,phase:'closed'});}finally{try{transport?.stop();}finally{transport=null;game=null;app.exit(0);}}});
 game.loadURL(embeddedGame?crazyGames.GAME_URL:'https://bloxd.io/?siteUsed=desktopMicrosoftStore').catch(error=>{fs.appendFileSync(path.join(output,'page-error.log'),error.message+'\n');writeRun('game-start.json',{runId,phase:'failed',error:'Bloxd could not load. Check your internet connection and retry.'});game?.show();});
}
if(ownsInstance)app.whenReady().then(async()=>{
 store=new Store(locations.data,locations.catalog,{readOnly:gameMode});
 ipcMain.handle('launcher:call',async(event,request)=>{if(!local(event)||!request||typeof request.action!=='string')throw Error('Launcher request denied.');const value=request.value;
  switch(request.action){
   case 'window':if(value==='minimize')launcher.minimize();else if(value==='maximize'){launcher.isMaximized()?launcher.unmaximize():launcher.maximize();}else if(value==='close')launcher.close();else throw Error('Invalid window action.');return true;
   case 'state':if(runner)readUpdates(runner);return {...store.snapshot(),appVersion:require('../package.json').version,clientRunning:!!runner,runningProfile:runner?.options.action==='game'?runner.profile.id:null,reloadStatus:runner?.reloadStatus||null,textureStatus:runner?.textureStatus||null,characterStatus:runner?.options.accountId===store.state.selectedAccount?runner?.characterStatus||null:null,accountConnection:accountConnection.capabilities()};
   case 'character':return new Uint8Array(store.readCharacter(value));
   case 'select':return store.selectProfile(value);case 'selectAccount':return store.selectAccount(value);case 'profile':return store.saveProfile(value);
   case 'prepareDelete':{const target=deletionTarget(value?.kind,value?.id),token=require('node:crypto').randomBytes(16).toString('hex');pendingDeletion={...target,token,expires:Date.now()+300000};return {...target,token};}
   case 'deleteProfile':return store.deleteProfile(confirmedDeletion('profile',value));
   case 'addAccount':{if(runner)throw Error('Close the current Bloxd window before adding an account.');store.addAccount(value);return startClient(false,value==='crazygames'?'game':'account',store.state.selectedAccount);}
   case 'connectAccount':return startClient(false,'account',value);
   case 'accountWindow':if(!value||value.action!=='account')throw Error('Invalid account action.');return startClient(false,value.action,value.id);
   case 'deleteAccount':return store.deleteAccount(confirmedDeletion('account',value));
   case 'settings':{const settings=validateSettings(value),changed=settings.startWithDevice!==store.state.settings.startWithDevice;if(changed){const executable=process.env.PORTABLE_EXECUTABLE_FILE||process.execPath;app.setLoginItemSettings({openAtLogin:settings.startWithDevice,path:executable,args:app.isPackaged?[]:[root]});}return store.saveSettings(settings);}
   case 'install':return store.install(value);case 'uninstall':return store.uninstall(value);case 'removePack':return store.removePack(value);
   case 'reloadGame':{if(!runner||runner.options.action!=='game'||runner.profile.id!==store.state.selected)throw Error('Select the open game profile first.');writeRequest(runner,store.profile().texture,true);return {queued:true};}
   case 'texture':{if(downloadBusy)throw Error('A download is already in progress.');downloadBusy=true;const p={...store.profile()};try{await textures.load(value,path.join(store.profileFolder(p.id),'textures'));const result=store.saveProfile({...p,texture:value});if(runner?.profile.id===p.id&&runner.options.action==='game')writeRequest(runner,value);return result;}finally{downloadBusy=false;}}
   case 'importTexture':{if(downloadBusy)throw Error('A download is already in progress.');downloadBusy=true;try{const p={...store.profile()},chosen=await dialog.showOpenDialog(launcher,{title:'Import Bloxd texture pack',properties:['openFile'],filters:[{name:'Bloxd texture pack',extensions:['json']}]});if(chosen.canceled)return store.snapshot();textures.importCustom(chosen.filePaths[0],path.join(store.profileFolder(p.id),'textures'));const result=store.saveProfile({...p,texture:'custom'});if(runner?.profile.id===p.id&&runner.options.action==='game')writeRequest(runner,'custom');return result;}finally{downloadBusy=false;}}
   case 'play':return startClient(false);case 'baseline':return startClient(true);case 'search':return packs.search(value.type,value.query);
   case 'download':if(downloadBusy)throw Error('A download is already in progress.');downloadBusy=true;{const owner=store.state.selected;try{const pack=await packs.download(value.id,value.type,path.join(store.profileFolder(owner),'packs'));return store.addPack(owner,pack);}finally{downloadBusy=false;}}
   case 'metrics':return {current:sample(),benchmarks:store.state.benchmarks};default:throw Error('Unknown launcher action.');
  }
 });
 ipcMain.on('client:frame-authorized',(event)=>{const authorized=embeddedGame&&fromGame(event);if(authorized)sessionGameFrame=event.senderFrame;event.returnValue=!!authorized;});
 function modRequest(event,request){if(!fromGame(event)||!request||!enabled.has(request.id))throw Error('Mod request denied.');return store.storage(sessionProfile,request.id);}
 ipcMain.handle('mods:get',(event,request)=>{const saved=modRequest(event,request),p=store.profile(sessionProfile),data={...(defaults(p.performance)[request.id]||{}),...saved},keys=request.value;if(typeof keys==='string')return {[keys]:data[keys]};if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>typeof k==='string').map(k=>[k,data[k]]));if(keys&&typeof keys==='object')return {...keys,...data};return {...data};});
 ipcMain.handle('mods:set',(event,request)=>{modRequest(event,request);store.writeStorage(sessionProfile,request.id,request.value);updates.modules[request.id]={...store.storage(sessionProfile,request.id)};writeUpdates();return true;});
 ipcMain.handle('mods:message',async(event,request)=>{modRequest(event,request);if(request.id!=='bloxd-party-voice'||request.value?.type!=='bpv-discover-local-server')throw Error('Unsupported mod message.');try{const response=await fetch('http://127.0.0.1:8787/health',{signal:AbortSignal.timeout(2000),redirect:'error'});if(!response.ok)return null;const data=await response.json();return data?.ok&&data.invitations&&data.protocol>=2?{publicServer:data.publicServer||'',version:data.version}:null;}catch{return null;}});
 ipcMain.handle('native:packet',(event,bytes)=>{if(!fromGame(event)||!transport)throw Error('Native preview is not active.');return transport.write(bytes);});
 ipcMain.handle('native:frame',(event,after)=>{if(!fromGame(event)||!transport)throw Error('Native rendering is not active.');return transport.frame(after);});
 ipcMain.on('native:status',(event,value)=>{
  if(!fromGame(event)||!transport||!value||typeof value.phase!=='string')return;
  const clean={phase:value.phase.slice(0,40),error:typeof value.error==='string'?value.error.slice(0,200):null};
  for(const key of ['epoch','meshes','textures','meshUploads','poseUpdates','surfaceUpdates','materialUpdates','cameraFrames','pendingTextureLayers','textureJobs','skipped','tickMs','textureReadMs','activeMeshes','pendingMeshes','unsupportedMeshes','suppressedDraws','revision','idleSkips','trackedCalls'])if(Number.isFinite(value[key])&&value[key]>=0)clean[key]=value[key];
  clean.nativeReady=value.nativeReady===true;clean.sourceDrawsSuppressed=value.sourceDrawsSuppressed===true;
  clean.importEnabled=value.importEnabled===true;clean.trackingWrites=value.trackingWrites===true;
  clean.sourceFPS=Number.isFinite(value.sourceFPS)&&value.sourceFPS>=0&&value.sourceFPS<=1000?value.sourceFPS:null;
  clean.fallbackReason=typeof value.fallbackReason==='string'?value.fallbackReason.slice(0,200):null;
  if(value.presentation&&typeof value.presentation.phase==='string')clean.presentation={phase:value.presentation.phase.slice(0,40),frames:Number.isSafeInteger(value.presentation.frames)&&value.presentation.frames>=0?value.presentation.frames:0,error:typeof value.presentation.error==='string'?value.presentation.error.slice(0,200):null};
  transport.captureStatus=clean;writeRun('capture-status.json',clean);
 });
 ipcMain.on('client:account',(event,value)=>{if(!fromGame(event))return;try{const clean=publicMetadata(value),changed=JSON.stringify(clean)!==JSON.stringify(updates.account);if(changed){delete updates.character;delete updates.characterStatus;updates.account=clean;writeUpdates();}}catch{}});
 ipcMain.on('client:startup',(event,value)=>{
  if(!fromGame(event)||value?.profile!==sessionProfile||!Array.isArray(value.loaded)||!Array.isArray(value.errors))return;
  const stage=v=>typeof v==='string'&&v.length<=160&&(/^[a-z0-9-]+:[a-zA-Z0-9_.-]+$/.test(v))&&(v.startsWith('launcher:')||enabled.has(v.split(':')[0]));
  if(embeddedGame)sessionGameFrame=event.senderFrame;
  const clean={profile:sessionProfile,modules:[...enabled],loaded:value.loaded.slice(0,256).filter(stage),errors:value.errors.slice(0,32).filter(v=>stage(v?.stage)&&typeof v.message==='string').map(v=>({stage:v.stage,message:v.message.slice(0,200)})),webgpuApi:value.webgpuApi===true};
  writeRun('startup-status.json',clean);
 });
 ipcMain.handle('client:character',(event,value)=>{if(!fromGame(event)||!updates.account?.loggedIn)throw Error('Character sync denied.');const metadata=publicMetadata(value?.metadata);if(JSON.stringify(metadata)!==JSON.stringify(updates.account)||!value.bytes||value.bytes.byteLength>MAX_BYTES)throw Error('Character account changed during sync.');const {bytes}=validateCharacter(value.bytes),file=path.join(runFolder(),'character.glb'),temp=file+'.tmp';for(const target of [file,temp])if(fs.existsSync(target)&&fs.realpathSync(target)!==target)throw Error('Linked character transfer file.');fs.writeFileSync(temp,bytes);fs.renameSync(temp,file);updates.character={file:'character.glb',sha256:require('./data-files.cjs').hash(bytes)};writeUpdates();return true;});
 ipcMain.on('client:character-status',(event,value)=>{if(!fromGame(event)||!['reading','ready','waiting','error'].includes(value?.phase))return;updates.characterStatus={phase:value.phase,message:String(value.message||'').slice(0,200)};writeUpdates();});
 ipcMain.on('client:shader-diagnostics',(event,text)=>{if(!fromGame(event)||!shaderDiagnosticRequested||!enabled.has('bloxd-visual-shader')||typeof text!=='string'||text.length>65536)return;shaderDiagnosticRequested=false;try{const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))return;writeRun('shader-diagnostics.json',{clientVersion:require('../package.json').version,at:new Date().toISOString(),shader:value});}catch(error){console.error('Shader diagnostic could not be saved: '+String(error.message).slice(0,160));}});
 ipcMain.on('client:litematica-diagnostics',(event,text)=>{if(!fromGame(event)||!litematicaDiagnosticRequested||!enabled.has('bloxd-litematica')||typeof text!=='string'||text.length>65536)return;litematicaDiagnosticRequested=false;try{const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))return;writeRun('litematica-diagnostics.json',{clientVersion:require('../package.json').version,at:new Date().toISOString(),litematica:value});}catch(error){console.error('Litematica diagnostic could not be saved: '+String(error.message).slice(0,160));}});
 ipcMain.on('client:texture',(event,value)=>{if(fromGame(event)&&typeof value?.applied==='boolean'&&typeof value.id==='string'){updates.texture={id:value.id,applied:value.applied,reason:String(value.reason||'').slice(0,200)};writeUpdates();}});
 if(gameMode)await openGameWindow(process.argv.includes('--baseline'));else await showLauncher();
}).catch(error=>{if(gameMode)try{writeRun('game-start.json',{runId,phase:'failed',error:error.message});}catch{}console.error(error.message);process.exitCode=1;app.quit();});
app.on('second-instance',()=>{if(!gameMode&&!quitting)showLauncher().catch(()=>{});});
app.on('before-quit',()=>{quitting=true;stopUpdates();transport?.stop();runner?.stop();});
app.on('window-all-closed',()=>{if(!game&&!launcher&&!runner)app.quit();});
