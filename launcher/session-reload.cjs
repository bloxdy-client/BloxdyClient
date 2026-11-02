'use strict';
const fs=require('node:fs'),path=require('node:path');
const {textures}=require('./texture-catalog.cjs');
const FILE='game-request.json';
function writeRequest(child,texture,reload=false){
 if(!/^[a-f0-9]{24}$/.test(child.id))throw Error('Invalid game session.');
 if(child.options.action!=='game')throw Error('Open a game profile first.');
 if(!textures.some(t=>t.id===texture))throw Error('Unsupported texture pack.');
 const request={runId:child.id,profile:child.profile.id,sequence:(child.requestSequence||0)+1,texture,reload,textureRevision:reload?(child.textureRevision||0):(child.textureRevision||0)+1};
 fs.mkdirSync(child.output,{recursive:true});const target=path.join(child.output,FILE),temp=target+'.tmp';
 fs.writeFileSync(temp,JSON.stringify(request));fs.renameSync(temp,target);child.requestSequence=request.sequence;child.textureRevision=request.textureRevision;
 return request;
}
// Event driven, with one coalesced drain. No per-frame or interval disk reads.
function watchRequests(folder,runId,profile,prepare,reload,onError=()=>{}){
 let stopped=false,running=false,pending=false,last=0;
 async function drain(){
  if(stopped||running)return;running=true;
  try{while(pending&&!stopped){pending=false;let value;
   try{const file=path.join(folder,FILE);if(fs.statSync(file).size>4096)throw Error('Invalid reload request.');value=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){if(error.code!=='ENOENT')onError(error);continue;}
   if(!value||typeof value!=='object'||Array.isArray(value)||value.runId!==runId||value.profile!==profile||!Number.isSafeInteger(value.sequence)||value.sequence<=last||typeof value.reload!=='boolean'||!Number.isSafeInteger(value.textureRevision)||value.textureRevision<0||!textures.some(t=>t.id===value.texture))continue;
   last=value.sequence;
   try{await prepare(value);if(!stopped&&!pending&&value.reload)reload();}catch(error){onError(error);}
  }}finally{running=false;}
 }
 const watcher=fs.watch(folder,(_event,name)=>{if(name!==null&&String(name)!==FILE)return;pending=true;void drain();});watcher.unref?.();watcher.on('error',onError);
 pending=true;void drain();
 return ()=>{stopped=true;watcher.close();};
}
module.exports={writeRequest,watchRequests};
