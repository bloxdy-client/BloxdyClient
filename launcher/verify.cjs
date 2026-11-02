'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{spawnSync}=require('node:child_process');const {Store}=require('./store.cjs'),{generate}=require('./game-preload.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'outputs','launcher-verification');fs.mkdirSync(output,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bloxd-launcher-verify-'));
try{
  const s=new Store(temp,path.join(__dirname,'catalog'));for(const m of s.catalog.items)s.install(m.id);
  const file=generate(s,s.state.profiles[1],s.state.installed,output);new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
  const nativeFile=generate(s,{...s.state.profiles[1],renderer:'native-preview'},s.state.installed.filter(m=>m.id==='bloxd-party-voice'),path.join(output,'native'));new vm.Script(fs.readFileSync(nativeFile,'utf8'),{filename:nativeFile});
  const portalFile=generate(s,s.state.profiles[1],s.state.installed,path.join(output,'crazygames'),{embedded:true});new vm.Script(fs.readFileSync(portalFile,'utf8'),{filename:portalFile});
  const files=[path.join(root,'entry.cjs'),...fs.readdirSync(__dirname).filter(f=>/\.(cjs|js)$/.test(f)).map(f=>path.join(__dirname,f))];for(const file of files){const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true});if(check.status!==0)throw Error(check.stderr);}
  const tests=[...fs.readdirSync(path.join(__dirname,'tests')).filter(f=>f.endsWith('.test.cjs')).map(f=>'launcher/tests/'+f),'bridge/tests/capture-budget.test.cjs','bridge/tests/google-auth-popup.test.cjs','bridge/tests/transport.test.cjs','bridge/tests/frames.test.cjs','bridge/tests/presenter.test.cjs'];
  const check=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests],{cwd:root,encoding:'utf8',windowsHide:true});fs.writeFileSync(path.join(output,'unit-tests.tap'),check.stdout+check.stderr);
  const report={at:new Date().toISOString(),passed:check.status===0,tests:Number(/# tests (\d+)/.exec(check.stdout)?.[1]||0),syntaxFiles:files.length,standardPreloadSyntax:true,nativeVoicePreloadSyntax:true,crazyGamesPreloadSyntax:true,clientsStarted:0,accountsAccessed:false,liveModCombinationVerified:false,minecraftPackRenderingImplemented:false,resourcepackRenderingImplemented:false,ramReductionMeasured:false,originalModules:s.catalog.items.map(m=>({id:m.id,version:m.version,sha256:m.sha256}))};
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}finally{if(!temp.startsWith(path.join(os.tmpdir(),'bloxd-launcher-verify-')))throw Error('Unexpected temporary path.');fs.rmSync(temp,{recursive:true,force:true});}
