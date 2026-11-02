'use strict';
const {contextBridge,ipcRenderer}=require('electron');
if(process.isMainFrame&&location.protocol==='file:')contextBridge.exposeInMainWorld('launcher',{call:(action,value)=>ipcRenderer.invoke('launcher:call',{action,value}),onStateChange(callback){if(typeof callback!=='function')return;const listener=()=>callback();ipcRenderer.on('launcher:state-changed',listener);return ()=>ipcRenderer.removeListener('launcher:state-changed',listener);}});
