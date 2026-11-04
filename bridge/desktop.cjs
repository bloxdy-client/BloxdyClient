'use strict';
const {app,BrowserWindow,ipcMain,Menu,dialog}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {Transport}=require('./transport.cjs');
const installCapture=require('./capture-factory.cjs');
const {installGoogleAuthPopups}=require('./google-auth-popup.cjs');
const root=path.resolve(__dirname,'..');
const testMode=process.argv.includes('--bridge-test');
// Live startup was restored at the user's request. Only the user launches or
// operates the client; synthetic tests and --offline remain local-only.
const fixture=testMode||process.argv.includes('--offline');
const output=path.join(root,'outputs',testMode?'bridge-test':fixture?'bridge-offline':'bridge');
let window,transport,quitting=false,lastCapture={phase:'waiting-page'};
// Chromium databases belong in local app storage, outside OneDrive source sync.
app.setPath('userData',path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'BloxdNative',testMode?'bridge-test-profile':fixture?'bridge-offline-profile':'desktop-profile'));
function preload(){
  const source=`'use strict';\nconst {contextBridge,ipcRenderer}=require('electron');\nif(process.isMainFrame){\nconst allowed=${fixture?"location.protocol==='file:'":"location.hostname==='bloxd.io'"};\nif(allowed){contextBridge.exposeInMainWorld('bloxdNative',{send:bytes=>ipcRenderer.invoke('native:packet',bytes),status:value=>ipcRenderer.send('native:status',value)});\nconst installCapture=${installCapture.toString()};\ncontextBridge.executeInMainWorld({func:installCapture,args:[{fixture:${fixture}}]});}}\n`;
  const file=path.join(output,'generated-preload.cjs');fs.writeFileSync(file,source);return file;
}
function trusted(event){
  if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)return false;
  try{const url=new URL(event.senderFrame.url);return fixture?url.protocol==='file:'&&url.pathname.endsWith('/fixture.html'):url.protocol==='https:'&&url.hostname==='bloxd.io';}catch{return false;}
}
async function diagnostics(){
  const capture=lastCapture;
  const report={version:'0.2.1',capture,native:transport.status,transportBytes:transport.bytes,fixture};
  if(!fixture)report.source={url:window.webContents.getURL(),loading:window.webContents.isLoading(),visible:window.isVisible()};
  fs.writeFileSync(path.join(output,'desktop-status.json'),JSON.stringify(report,null,2));return report;
}
async function testBridge(){
  const capture=()=>window.webContents.executeJavaScript('globalThis.__BLOXD_NATIVE_CAPTURE__?.status()');
  for(let i=0;i<100;++i){if((await capture())?.phase==='streaming')break;await new Promise(r=>setTimeout(r,100));}
  const stage=async id=>{const waiting=transport.waitFor(s=>s.snapshot===id);await window.webContents.executeJavaScript(`globalThis.__BLOXD_NATIVE_CAPTURE__.snapshot(${id})`);return waiting;};
  const initial=await stage(1);assert.equal(initial.meshes,1);assert.equal(initial.textures,1);assert.ok(initial.hasCamera);assert.deepEqual(initial.centerRGBA,[40,190,100,255]);assert.ok(initial.foregroundPixels>10000);
  await window.webContents.executeJavaScript('fixture.changeGeometryAndTexture()');const changed=await stage(2);assert.ok(changed.meshUploads>initial.meshUploads);assert.ok(changed.textureUploads>initial.textureUploads);assert.deepEqual(changed.centerRGBA,[220,80,40,255]);assert.notEqual(changed.pixelHash,initial.pixelHash);
  await window.webContents.executeJavaScript('fixture.moveCamera()');const camera=await stage(3);assert.ok(camera.cameraFrames>initial.cameraFrames);assert.notEqual(camera.pixelHash,changed.pixelHash);
  await window.webContents.executeJavaScript('fixture.changeLight()');const light=await stage(6);assert.equal(light.meshUploads,changed.meshUploads);assert.deepEqual(light.centerRGBA,[44,16,8,255]);
  await window.webContents.executeJavaScript('fixture.moveObject()');const object=await stage(7);assert.equal(object.meshUploads,light.meshUploads);assert.notEqual(object.pixelHash,light.pixelHash);
  await window.webContents.executeJavaScript('fixture.addInstances()');const instances=await stage(8);assert.notEqual(instances.pixelHash,object.pixelHash);assert.ok(instances.foregroundPixels>0);
  await window.webContents.executeJavaScript('fixture.moveInstance()');const movingInstance=await stage(9);assert.equal(movingInstance.meshUploads,instances.meshUploads);assert.notEqual(movingInstance.pixelHash,instances.pixelHash);
  await window.webContents.executeJavaScript('fixture.removeMesh()');const removed=await stage(4);assert.equal(removed.meshes,0);assert.equal(removed.removals,1);assert.equal(removed.foregroundPixels,0);
  await window.webContents.executeJavaScript('fixture.replaceWorld()');const world=await stage(5);assert.ok(world.epoch>initial.epoch);assert.equal(world.meshes,1);assert.equal(world.textures,1);
  const readback=await window.webContents.executeJavaScript('fixture.validateSourceState()');assert.equal(readback.passed,true);
  const report={passed:true,fixture:true,realBloxdWorldVerified:false,initial,changed,camera,light,object,instances,movingInstance,removed,world,sourceState:readback,capture:await capture()};
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log('PASS: Electron capture -> binary IPC -> native GPU; geometry, array texture, camera, removal, reset and WebGL state.');
}
app.whenReady().then(async()=>{
  fs.mkdirSync(output,{recursive:true});
  transport=new Transport(root,{hidden:testMode,output});
  transport.on('fault',error=>fs.appendFileSync(path.join(output,'desktop-error.log'),error.stack+'\n'));
  ipcMain.handle('native:packet',async(event,bytes)=>{if(!trusted(event))throw Error('Native bridge sender rejected.');return transport.write(bytes);});
  ipcMain.on('native:status',(event,value)=>{if(trusted(event)&&value&&typeof value.phase==='string'){lastCapture=value;diagnostics().catch(()=>{});}});
  window=new BrowserWindow({width:1280,height:800,show:!testMode,title:fixture?'Bloxd Native 0.2.1 — Offline test scene':'Bloxd Native 0.2.1 — Game and data source',webPreferences:{preload:preload(),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  // No remote HTTP/WebSocket traffic is allowed in the offline bridge session.
  if(fixture)window.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_,done)=>done({cancel:true}));
  installGoogleAuthPopups(window.webContents,{offline:fixture});
  window.webContents.on('preload-error',(_,file,error)=>fs.appendFileSync(path.join(output,'desktop-error.log'),`Preload ${file}: ${error.stack}\n`));
  const logNavigation=value=>fs.appendFileSync(path.join(output,'navigation.log'),JSON.stringify({at:new Date().toISOString(),...value})+'\n');
  window.webContents.on('render-process-gone',(_,details)=>{logNavigation({event:'renderer-gone',...details});lastCapture={phase:'source-renderer-failed',error:details.reason};});
  window.webContents.on('did-start-navigation',(_,url,inside,main)=>{if(main)logNavigation({event:'navigation-start',url});});
  window.webContents.on('did-navigate',(_,url)=>logNavigation({event:'navigation-committed',url}));
  window.webContents.on('did-fail-load',(_,code,description,url,main)=>{if(main)logNavigation({event:'navigation-failed',code,description,url});});
  window.webContents.on('dom-ready',()=>logNavigation({event:'dom-ready',url:window.webContents.getURL()}));
  window.webContents.session.webRequest.onCompleted({urls:['https://bloxd.io/*']},details=>{if(details.resourceType==='mainFrame')logNavigation({event:'document-response',status:details.statusCode});});
  window.webContents.session.webRequest.onErrorOccurred({urls:['https://bloxd.io/*']},details=>{if(details.resourceType==='mainFrame')logNavigation({event:'document-error',error:details.error});});
  window.webContents.on('will-navigate',(event,url)=>{if(fixture)return;try{if(new URL(url).hostname!=='bloxd.io')event.preventDefault();}catch{event.preventDefault();}});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Data bridge',submenu:[
    {label:'Show diagnostics',click:async()=>{try{const d=await diagnostics();const n=d.native;await dialog.showMessageBox(window,{type:'info',title:'Data bridge 0.2.1',message:`${d.capture.phase}\n${n?.meshes||0} native meshes, ${n?.textures||0} textures\nNative preview: ${Number.isFinite(n?.fps)?n.fps.toFixed(1):'—'} FPS, ${n?.visibleMeshes||0} visible meshes\n${d.capture.pendingTextureLayers||0} required texture layers still loading\n${n?.pendingTextureMeshes||0} visible meshes are partially untextured`,detail:d.capture.error||'The native preview displays transferred data using a diagnostic shader. Shadows and Minecraft shaderpacks are not connected yet.'});}catch(error){await dialog.showErrorBox('Diagnostics',error.message);}}},
    {label:'Transfer data again',click:()=>window.webContents.executeJavaScript('globalThis.__BLOXD_NATIVE_CAPTURE__?.resync()').catch(()=>{})},
    {label:'Reload game page',click:()=>window.webContents.reload()},
    {type:'separator'},{role:'quit',label:'Quit'}
  ]}]));
  window.on('closed',()=>{window=null;app.quit();});
  if(!fixture){window.restore();window.show();window.once('ready-to-show',()=>{window.restore();window.show();window.focus();});}
  if(fixture)await window.loadFile(path.join(__dirname,'fixture.html'));
  if(testMode){await testBridge();transport.stop();quitting=true;window.destroy();app.exit(0);}
  else {
    const timer=setInterval(()=>{if(window&&!window.isDestroyed())diagnostics().catch(()=>{});},2000);timer.unref();
    if(!fixture)window.loadURL('https://bloxd.io/?siteUsed=desktopMicrosoftStore').catch(error=>fs.appendFileSync(path.join(output,'page-load-error.log'),error.message+'\n'));
  }
}).catch(error=>{
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({passed:false,fixture,error:error.stack},null,2));console.error(error);
  transport?.stop();app.exit(1);
});
app.on('before-quit',()=>{if(!quitting){quitting=true;transport?.stop();}});
app.on('window-all-closed',()=>app.quit());
