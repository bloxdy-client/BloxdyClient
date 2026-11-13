'use strict';
// The launcher alone owns update I/O. Game processes and development runs
// never load the updater. Installation is deferred to a normal, idle quit.
function installAutoUpdates({app,gameMode=false,platform=process.platform,isBusy=()=>false,onState=()=>{},load=()=>require('electron-updater'),schedule=setTimeout,cancel=clearTimeout}){
 let state={phase:'disabled',version:null,message:platform==='win32'?'Automatic updates are available in the installed client.':'Automatic updates are available for Windows.'};
 const api={status:()=>({...state}),activityChanged(){},dispose(){}};
 if(gameMode||!app.isPackaged||platform!=='win32')return api;
 let updater,CancellationToken;
 try{({autoUpdater:updater,CancellationToken}=load());}catch{state={phase:'error',version:null,message:'Automatic updates could not start. Restart the launcher to try again.'};return api;}
 updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.autoRunAppAfterInstall=false;
 updater.allowDowngrade=false;updater.allowPrerelease=false;updater.disableDifferentialDownload=true;updater.disableWebInstaller=true;
 updater.logger={info(){},warn(){},error(){},debug(){}};
 let disposed=false,timer=null,checking=false,download=null,available=null,ready=false;
 function publish(phase,message,version=available?.version||null){if(disposed)return;state={phase,version,message};try{onState();}catch{/* A closing window must not interrupt update handling. */}}
 function later(ms){cancel(timer);if(disposed)return;timer=schedule(()=>{timer=null;void check();},ms);timer?.unref?.();}
 async function fetchUpdate(){
  if(disposed||download||ready||!available)return;
  if(isBusy()){publish('waiting','Updates will download after the Bloxd window closes.');return;}
  const token=new CancellationToken();download=token;publish('downloading','Downloading an update in the background.');
  try{await updater.downloadUpdate(token);}catch(error){if(!disposed&&!token.cancelled){publish('error','Update download failed. It will retry automatically.');later(15*60*1000);}}
  finally{if(download===token)download=null;if(!disposed&&token.cancelled&&!ready){publish('waiting','Updates will download after the Bloxd window closes.');if(!isBusy())later(1000);}}
 }
 async function check(){
  if(disposed||checking||download||ready)return;
  if(isBusy()){publish('waiting','Updates will be checked after the Bloxd window closes.');return;}
  checking=true;publish('checking','Checking for updates.');
  try{await updater.checkForUpdates();}catch{if(!disposed)publish('error','Could not check for updates. Retrying automatically.');}
  finally{checking=false;if(!disposed&&!ready&&!download)later(state.phase==='error'?15*60*1000:4*60*60*1000);}
 }
 const handlers={
  'update-available':info=>{if(disposed||ready)return;available={version:info.version};void fetchUpdate();},
  'update-not-available':()=>{if(!ready)publish('current','You have the latest version.');},
  'update-downloaded':info=>{if(disposed)return;available={version:info.version};ready=true;updater.autoInstallOnAppQuit=!isBusy();publish('ready','Update ready. It installs when you close the launcher.');},
  error:()=>{if(!disposed&&!ready&&!download&&!checking){publish('error','Could not check for updates. Retrying automatically.');later(15*60*1000);}}
 };
 for(const [event,handler]of Object.entries(handlers))updater.on(event,handler);
 api.activityChanged=()=>{if(disposed)return;updater.autoInstallOnAppQuit=ready&&!isBusy();if(isBusy()){cancel(timer);timer=null;download?.cancel();if(!ready)publish('waiting','Updates resume after the Bloxd window closes.');}else if(!ready)later(1000);};
 api.dispose=()=>{if(disposed)return;disposed=true;cancel(timer);download?.cancel();updater.autoInstallOnAppQuit=false;for(const [event,handler]of Object.entries(handlers))updater.removeListener(event,handler);};
 publish('idle','Updates download automatically and install when the launcher closes.');later(10000);return api;
}
module.exports={installAutoUpdates};
