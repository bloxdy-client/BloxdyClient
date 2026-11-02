'use strict';
const {spawn}=require('node:child_process'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const {validateProfile,ID}=require('./model.cjs');
function command(profile,baseline,options){validateProfile(profile);const {runner,executable,packaged,root,runId,status,accountId,action='game'}=options;if(!/^[a-f0-9]{24}$/.test(runId))throw Error('Invalid session ID.');if(accountId&&!ID.test(accountId))throw Error('Invalid account ID.');if(!['game','account'].includes(action))throw Error('Invalid client action.');const gameArgs=[...(packaged?[]:[root]),'--launcher-game',`--profile-id=${profile.id}`,`--run-id=${runId}`,`--client-action=${action}`,...(accountId?[`--account-id=${accountId}`]:[]),...(baseline?['--baseline']:[])];return {file:runner,args:['--limit-gb',String(profile.ramGB),'--status-file',status,'--',executable,...gameArgs]};}
function windowStatus(folder,id,reader=fs.readFileSync){let value;try{value=JSON.parse(reader(path.join(folder,'game-start.json'),'utf8'));}catch{return null;}return value?.runId===id?value:null;}
function launchStatus(folder,id,reader=fs.readFileSync){const value=windowStatus(folder,id,reader);if(value?.phase==='failed')throw Error(String(value.error||'Bloxd could not open.').slice(0,500));return value?.phase==='visible'?value:null;}
class GameRunner extends EventEmitter{
 constructor(profile,baseline,options){super();this.options=options;this.id=crypto.randomBytes(12).toString('hex');this.output=path.join(options.data,'runs',this.id);this.profile=profile;this.baseline=baseline;this.child=null;this.ready=false;}
 start(){if(!fs.existsSync(this.options.runner))throw Error('The memory helper is missing. Developer builds require Build-Launcher.ps1.');fs.mkdirSync(this.output,{recursive:true});const invocation=command(this.profile,this.baseline,{...this.options,runId:this.id,status:path.join(this.output,'memory-budget.json')});this.child=(this.options.spawn||spawn)(invocation.file,invocation.args,{windowsHide:true,stdio:['ignore','pipe','pipe'],cwd:path.dirname(this.options.executable)});
  return new Promise((resolve,reject)=>{let lines='',errors='',settled=false,budgetReady=false,closed=false;let timer,poll;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)clearInterval(poll);error?reject(error):resolve(value);};
   const close=value=>{if(closed)return;closed=true;clearTimeout(timer);clearInterval(poll);finish(Error(errors||'Bloxd closed before showing a window.'));this.emit('closed',value);};
   timer=setTimeout(()=>{this.child.kill();finish(Error('Bloxd did not show a window in time. The launcher is still available.'));},this.options.timeoutMS||45000);timer.unref();
   // Keep the window protocol alive after startup. Its exact-run closed
   // marker is independent of delayed Electron/helper process teardown.
   const checkWindow=()=>{try{const status=windowStatus(this.output,this.id);if(status?.phase==='closed'){close({code:0,error:null});return;}if(!this.ready&&status?.phase==='failed')throw Error(String(status.error||'Bloxd could not open.').slice(0,500));if(!this.ready&&budgetReady&&status?.phase==='visible'){this.ready=true;clearInterval(poll);poll=setInterval(checkWindow,250);poll.unref();finish(null,{started:true,ramGB:this.profile.ramGB});}}catch(error){this.child.kill();finish(error);}};
   poll=setInterval(checkWindow,100);poll.unref();
   this.child.stdout.on('data',chunk=>{lines=(lines+chunk.toString()).slice(-4096);if(lines.includes('BUDGET_READY '))budgetReady=true;});this.child.stderr.on('data',chunk=>{errors=(errors+chunk.toString()).slice(-4096);fs.appendFileSync(path.join(this.output,'runner-error.log'),chunk);});
   this.child.on('error',error=>{finish(error);close({code:1,error:error.message});});this.child.on('exit',code=>close({code,error:code?errors||'The game closed. The memory budget may have been too low.':null}));
  });}
 stop(){this.child?.kill();}
}
module.exports={GameRunner,command,launchStatus};
