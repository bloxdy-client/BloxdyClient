'use strict';
// Local, bounded diagnostics only. No account storage or native dumps are shared.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const RUN=/^[a-f0-9]{24}$/,MAX_LOG=48*1024,MAX_REPORTS=20;
function redact(value){return String(value??'').slice(0,128*1024)
 .replace(/https?:\/\/[^\s<>"']+/gi,raw=>{try{const u=new URL(raw);return u.origin+u.pathname;}catch{return '[url]';}})
 .replace(/\b(Bearer\s+)[\w.+/=-]+/gi,'$1[redacted]')
 .replace(/(["']?(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|authorization|cookie|password|secret|access_key)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi,'$1[redacted]')
 .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email]')
 .replace(/[A-Z]:[\\/](?:[^\s"'<>\r\n]+)/gi,'[local path]')
 .replace(/\/(?:home|Users)\/[^\s/]+/g,'[user directory]')
 .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[token]');}
function read(file,max=MAX_LOG){try{const fd=fs.openSync(file,'r');try{const size=fs.fstatSync(fd).size,bytes=Buffer.alloc(Math.min(size,max));fs.readSync(fd,bytes,0,bytes.length,Math.max(0,size-max));return bytes.toString('utf8');}finally{fs.closeSync(fd);}}catch{return '';}}
function json(file){try{return JSON.parse(read(file,128*1024));}catch{return null;}}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value));fs.renameSync(file+'.tmp',file);}
function safe(fn){try{return fn();}catch{return null;}}
function append(folder,kind,message){return safe(()=>{const file=path.join(folder,'game.log'),line=new Date().toISOString()+' '+kind+' '+redact(message).slice(0,3000)+'\n',old=read(file);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(file,(old+line).slice(-MAX_LOG));return true;});}
function begin(folder,{version,profile,baseline=false,action='game',platform=process.platform}){return safe(()=>{write(path.join(folder,'diagnostic-session.json'),{startedAt:new Date().toISOString(),version,platform,arch:process.arch,osRelease:os.release(),action,ramGB:profile.ramGB,mods:baseline?[]:profile.enabledMods,baseline,finished:false});append(folder,'session','Started '+action);return true;});}
function intendStop(folder){return safe(()=>{const file=path.join(folder,'diagnostic-session.json'),session=json(file);if(session)write(file,{...session,intentionalStop:true});});}
function fault(folder,kind,details={}){return safe(()=>{const file=path.join(folder,'crash-cause.json'),existing=json(file);if(existing)return existing;const value={at:new Date().toISOString(),kind,reason:redact(details.reason||details.message||'Unknown').slice(0,1000),exitCode:Number.isInteger(details.exitCode)?details.exitCode:null};write(file,value);append(folder,kind,JSON.stringify(value));return value;});}
function startupFailure(folder,error){return safe(()=>{if(json(path.join(folder,'diagnostic-session.json'))?.finished||json(path.join(folder,'game-start.json'))?.phase==='closed')return;return fault(folder,'startup',{message:error?.stack||error?.message||String(error)});});}
function summary(cause,exit){if(cause?.reason==='oom')return 'The game renderer ran out of memory.';
 if(cause?.kind==='renderer')return 'The game renderer stopped ('+cause.reason+').';
 if(cause?.kind==='main-exception')return 'The game process stopped after an uncaught exception.';
 if(cause?.kind==='startup')return 'Bloxd could not finish starting.';
 if(exit?.signal)return 'The game process ended with signal '+exit.signal+'.';
 if(exit?.code!==null&&exit?.code!==undefined&&exit.code!==0)return 'The game process exited with code '+exit.code+'.';
 return 'The game ended without a normal close. The exact cause was not recorded.';}
class CrashReports{
 constructor(data){this.data=data;this.folder=path.join(data,'crash-reports');this.error=null;this.attempts=new Map();}
 attempt(fn){try{const result=fn();this.error=null;return result;}catch{this.error='Crash reports could not be saved. Check available disk space and folder permissions.';return null;}}
 file(id){if(typeof id!=='string'||!RUN.test(id))throw Error('Invalid crash report.');return path.join(this.folder,id+'.json');}
 get(id){const report=json(this.file(id));if(!report||report.id!==id||typeof report.log!=='string')throw Error('This crash report is no longer available.');return report;}
 list(){const files=safe(()=>fs.readdirSync(this.folder))||[];return files.filter(f=>RUN.test(f.slice(0,-5))&&f.endsWith('.json')).map(f=>json(path.join(this.folder,f))).filter(r=>r&&RUN.test(r.id)&&typeof r.log==='string').sort((a,b)=>b.at.localeCompare(a.at)).slice(0,MAX_REPORTS).map(({id,at,reason,reviewed,sentAt})=>({id,at,reason,reviewed:!!reviewed,sentAt:sentAt||null}));}
 update(id,values){const report=this.get(id);write(this.file(id),{...report,...values});return true;}
 email(id){const report=this.get(id),last=this.attempts.get(id)||0;if(Date.now()-last<60000)throw Error('Please wait one minute before reporting this crash again.');if(report.sentAt)throw Error('This report has already been sent.');this.attempts.set(id,Date.now());return {access_key:'68c38ffc-847b-4202-a1ae-e43e1ca09784',subject:'Bloxdy Client crash report '+report.version+' / '+id,from_name:'Bloxdy Client Crash Reports',message:report.log,botcheck:false};}
 finish(id,exit={}){return this.attempt(()=>{this.file(id);const folder=path.join(this.data,'runs',id),session=json(path.join(folder,'diagnostic-session.json'));if(!session||session.finished)return null;
  const status=json(path.join(folder,'game-start.json')),cause=json(path.join(folder,'crash-cause.json')),normal=status?.runId===id&&status.phase==='closed',failed=status?.runId===id&&status.phase==='failed';
  if((exit.intentional||session.intentionalStop)&&!cause||normal&&!cause&&!failed){write(path.join(folder,'diagnostic-session.json'),{...session,finished:true});return null;}
  const effective=cause||(failed?{kind:'startup',reason:status.error}:null),reason=summary(effective,exit),at=effective?.at||new Date().toISOString(),budget=json(path.join(folder,'memory-budget.json'));
  const memory=budget?Object.fromEntries(['enforced','limitGB','limitBytes','privateCommitBytes','workingSetBytes','peakCommitBytes','activeProcesses'].filter(k=>typeof budget[k]==='number'||typeof budget[k]==='boolean').map(k=>[k,budget[k]])):null;
  const startup=json(path.join(folder,'startup-status.json'));
  const sections=['Bloxdy Client crash report','Report: '+id,'Time: '+at,'Client: '+session.version,'System: '+session.platform+' '+session.arch+' / '+session.osRelease,'Reason: '+reason,'Recorded cause: '+(effective?JSON.stringify(effective):'Unknown'),'Process exit: '+JSON.stringify({code:exit.code??null,signal:exit.signal??null,recovered:!!exit.recovered}),'Memory budget (GB): '+session.ramGB,'Mods: '+(session.mods||[]).join(', '),'Baseline: '+!!session.baseline,'Memory at last sample: '+JSON.stringify(memory),'\nRecent game log:\n'+read(path.join(folder,'game.log'),32*1024),'\nProcess errors:\n'+read(path.join(folder,'runner-error.log'),8000),'\nPreload error:\n'+read(path.join(folder,'preload-error.json'),2000),'\nMod startup errors:\n'+JSON.stringify(startup?.errors||[]).slice(0,8000),'\nPage errors:\n'+read(path.join(folder,'page-error.log'),2000),'\nAn exit code or recent error alone may not identify the underlying bug. Native crash dumps stay on this device.'];
  const report={id,at,reason,version:session.version,reviewed:false,sentAt:null,log:redact(sections.join('\n')).slice(0,64000)};
  write(this.file(id),report);write(path.join(folder,'diagnostic-session.json'),{...session,finished:true});
  const keep=new Set(this.list().map(r=>r.id+'.json'));for(const name of fs.readdirSync(this.folder))if(/^[a-f0-9]{24}\.json$/.test(name)&&!keep.has(name))fs.unlinkSync(path.join(this.folder,name));return report;
 });}
 recover(){const ids=this.attempt(()=>{const runs=path.join(this.data,'runs');return fs.existsSync(runs)?fs.readdirSync(runs).filter(id=>RUN.test(id)):[];});let error=null;for(const id of ids||[]){this.finish(id,{recovered:true});if(this.error)error=this.error;}if(error)this.error=error;}
}
function installGameDiagnostics({app,crashReporter,process:proc=process,folder}){
 const native=safe(()=>{const dumps=path.join(folder,'native-crashes');fs.mkdirSync(dumps,{recursive:true});app.setPath('crashDumps',dumps);crashReporter.start({uploadToServer:false,productName:'Bloxdy Client'});return true;});if(!native)append(folder,'diagnostics','Native crash collection is unavailable. Text diagnostics remain enabled.');
 proc.on?.('uncaughtExceptionMonitor',error=>fault(folder,'main-exception',{message:error?.stack||error?.message||String(error)}));
 app.on('child-process-gone',(_event,details)=>append(folder,'child-process-gone',JSON.stringify({type:details.type,reason:details.reason,exitCode:details.exitCode})));
}
function observeWindow(window,folder){let second=0,count=0,performanceSamples=0;
 window.webContents.on('console-message',(event,...args)=>{const info=event?.level!==undefined?event:typeof args[0]==='object'?args[0]:{level:args[0],message:args[1],lineNumber:args[2],sourceId:args[3]};
  // The shader emits two bounded local samples at info level. Keep ordinary
  // page info excluded, independently of the warning/error storm allowance.
  if([1,'info'].includes(info.level)&&performanceSamples<2&&typeof info.message==='string'&&info.message.length<=8192&&info.message.startsWith('[BVFX performance] ')){
   const sample=safe(()=>JSON.parse(info.message.slice(19))),fields=['schema','scope','frames','callbackFps','worstCallbackMs','draws','cpuWallMs','pendingLiquidChunks','liquidChunks','pendingLiquidKinds','pendingUnderwater','shadowReady','shadowResolution','sky','gpu'];
   if(sample?.schema==='shader-performance-v1'&&Object.keys(sample).every(key=>fields.includes(key))){performanceSamples++;append(folder,'shader-performance',info.message);}
   return;
  }
  if(![2,3,'warning','error'].includes(info.level))return;const now=Math.floor(Date.now()/1000);if(now!==second){second=now;count=0;}if(count++>=8)return;append(folder,'console',info.message+' ('+info.sourceId+':'+info.lineNumber+')');});
 window.webContents.on('preload-error',(_event,_file,error)=>append(folder,'preload-error',error?.stack||error?.message));
 window.on('unresponsive',()=>append(folder,'window','Unresponsive'));window.on('responsive',()=>append(folder,'window','Responsive'));
}
module.exports={CrashReports,begin,intendStop,append,fault,startupFailure,redact,installGameDiagnostics,observeWindow,MAX_LOG};
