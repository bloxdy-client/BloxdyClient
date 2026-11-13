'use strict';
// Explicit, user-requested website delivery only; never called by client builds.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
async function run(){
  const root=path.resolve(__dirname,'..'),log=require('./dev-log.json'),version=require('../package.json').version;
  if(log.release.version!==version)throw Error('Website and client versions differ.');
  const distribution=JSON.parse(fs.readFileSync(path.join(root,'outputs/launcher-verification/distribution.json')));
  if(distribution.version!==version||!distribution.packagedSourceMatches||!distribution.nativeResourcesMatch)throw Error('Current package verification is required.');
  const artifact=distribution.artifacts.find(a=>a.name===log.release.file),file=path.join(root,'dist-bloxdy-v'+version,log.release.file);
  const digest=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))digest.update(chunk);
  if(!artifact||digest.digest('hex')!==artifact.sha256)throw Error('Release file differs from the verified package.');
  const credential=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
  const token=credential.stdout.split('\n').find(line=>line.startsWith('password='))?.slice(9).trim();if(!token)throw Error('GitHub publication credential unavailable.');
  const headers={Authorization:'Bearer '+token,'User-Agent':'Bloxdy-release',Accept:'application/vnd.github+json'},api='https://api.github.com/repos/bloxdy-client/BloxdyClient';
  async function request(url,options={}){const response=await fetch(url,{...options,headers:{...headers,...options.headers}});const data=await response.json();if(!response.ok)throw Error('GitHub returned '+response.status+': '+data.message);return data;}
  const tag='binary-'+version;let release;
  const existing=(await request(api+'/releases?per_page=100')).find(item=>item.tag_name===tag);
  if(existing)release=existing;else{
    release=await request(api+'/releases',{method:'POST',body:JSON.stringify({tag_name:tag,target_commitish:'main',name:'Bloxdy Client '+version,draft:true,body:['Windows x64 binary distribution.',...log.fixed.filter(item=>item.version===version).flatMap(item=>[item.title,...item.items]),...log.added.filter(item=>item.version===version).flatMap(item=>[item.title,...item.items]),'CPU/DOM/package checks passed. In-game appearance and input still need user verification.','Use the Update EXE below. GitHub-generated source archives represent the repository baseline, not the local source snapshot used for this binary.'].join('\n\n')}),headers:{'Content-Type':'application/json'}});
  }
  const upload=release.upload_url.replace(/\{.*$/,'');
  for(const name of [log.release.file,'SHA256SUMS.txt']){
    const target=path.join(root,'dist-bloxdy-v'+version,name),bytes=fs.statSync(target).size;
    let asset=release.assets.find(a=>a.name===name);
    if(!asset){console.log('Uploading '+name+' ('+bytes+' bytes)');asset=await request(upload+'?name='+encodeURIComponent(name),{method:'POST',body:fs.createReadStream(target),duplex:'half',headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes)}});}
    if(asset.state!=='uploaded'||asset.size!==bytes)throw Error('Incomplete release asset: '+name);
    if(name===log.release.file&&asset.digest!=='sha256:'+artifact.sha256)throw Error('Remote release checksum differs.');
    if(!release.draft&&name===log.release.file&&asset.browser_download_url!==log.release.url)throw Error('Website points to a different release file.');
  }
  if(release.draft)release=await request(api+'/releases/'+release.id,{method:'PATCH',body:JSON.stringify({draft:false}),headers:{'Content-Type':'application/json'}});
  if(release.assets.find(a=>a.name===log.release.file)?.browser_download_url!==log.release.url)throw Error('Published download URL differs from the website.');
  const report={version,releaseId:release.id,url:log.release.url,sha256:artifact.sha256,published:!release.draft,at:new Date().toISOString()};
  fs.writeFileSync(path.join(root,'dist-bloxdy-v'+version,'download-publication.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
