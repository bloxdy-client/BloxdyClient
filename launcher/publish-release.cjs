'use strict';
// Publishes only verified Windows installer bytes and their update manifest.
// No source tree, local logs, profiles or credentials are uploaded.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {PUBLIC_INSTALLER,FEED_URL,installerName,verifyUpdate}=require('./release-update.cjs');
async function publishRelease(folder,{token,fetcher=fetch,version=require('../package.json').version}={}){
 const manifest=await verifyUpdate(folder,version),proof=JSON.parse(fs.readFileSync(path.join(folder,'verification.json'),'utf8'));
 if(proof.version!==version||!proof.packagedSourceMatches||!proof.pureChecksPassed||!proof.automaticUpdateMetadataVerified)throw Error('A verified release is required before publishing.');
 const artifact=proof.artifacts?.find(a=>a.name===installerName(version)),file=path.join(folder,installerName(version)),hash=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(file))hash.update(bytes);
 if(!artifact||artifact.bytes!==fs.statSync(file).size||artifact.sha256!==hash.digest('hex'))throw Error('The installer changed after verification.');
 if(!token)throw Error('Existing GitHub release credentials are required.');
 const base='https://api.github.com/repos/bloxdy-client/BloxdyClient',headers={Authorization:'Bearer '+token,'User-Agent':'Bloxdy-Release',Accept:'application/vnd.github+json'};
 async function request(url,options={}){const result=await fetcher(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(15*60*1000)});if(!result.ok)throw Error('GitHub release request failed ('+result.status+').');return result.json();}
 const tag='binary-'+version,existing=await fetcher(base+'/releases/tags/'+tag,{headers});if(existing.status!==404)throw Error('This release already exists or cannot be checked. Released binaries are never overwritten.');
 const release=await request(base+'/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,name:'Bloxdy Client '+version,draft:true,prerelease:false,body:'Windows installer. Install once; future versions download automatically and install when the launcher closes. Includes the current client and built-in mods.'})});
 try{
  const upload=release.upload_url.replace(/\{.*$/,'');
  for(const [name,file,type]of [[PUBLIC_INSTALLER,path.join(folder,installerName(version)),'application/octet-stream'],['latest.yml',path.join(folder,'latest.yml'),'application/yaml']]){
   await request(upload+'?name='+encodeURIComponent(name),{method:'POST',headers:{'Content-Type':type,'Content-Length':String(fs.statSync(file).size)},body:fs.createReadStream(file),duplex:'half'});
  }
  const published=await request(base+'/releases/'+release.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:false,make_latest:'true'})});
  return {version,release:published.html_url,installer:FEED_URL+'/'+PUBLIC_INSTALLER,manifest:FEED_URL+'/latest.yml',sha512:manifest.sha512};
 }catch(error){try{const response=await fetcher(base+'/releases/'+release.id,{headers});if(response.ok&&(await response.json()).draft===true)await fetcher(base+'/releases/'+release.id,{method:'DELETE',headers});}catch{}throw error;}
}
function credentials(){let token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;if(!token){const result=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});if(result.status===0)token=/^password=(.+)$/m.exec(result.stdout)?.[1];}return token;}
module.exports={publishRelease};
if(require.main===module)publishRelease(path.resolve(process.argv[2]),{token:credentials()}).then(result=>{fs.writeFileSync(path.join(process.argv[2],'publication.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}).catch(error=>{console.error(error.message);process.exitCode=1;});
