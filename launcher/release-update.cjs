'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),yaml=require('js-yaml');
const PUBLIC_INSTALLER='BloxdyClient-Installer-x64.exe';
const FEED_URL='https://github.com/bloxdy-client/BloxdyClient/releases/latest/download';
function installerName(version){if(!/^\d+\.\d\.\d$/.test(version))throw Error('Invalid release version.');return `Bloxdy-Client-Update-${version}-x64.exe`;}
function installerUrl(version){installerName(version);return `https://github.com/bloxdy-client/BloxdyClient/releases/download/binary-${version}/${PUBLIC_INSTALLER}`;}
async function sha512(file){const hash=crypto.createHash('sha512');for await(const bytes of fs.createReadStream(file))hash.update(bytes);return hash.digest('base64');}
async function prepareUpdate(folder,version,now=new Date()){
 const installer=path.join(folder,installerName(version)),size=fs.statSync(installer).size;if(size<1024*1024)throw Error('Incomplete Windows installer.');
 const digest=await sha512(installer),url=installerUrl(version),manifest={version,files:[{url,sha512:digest,size}],path:url,sha512:digest,releaseDate:now.toISOString()};
 fs.writeFileSync(path.join(folder,'latest.yml'),yaml.dump(manifest,{lineWidth:-1}));return manifest;
}
async function verifyUpdate(folder,version){
 const manifest=yaml.load(fs.readFileSync(path.join(folder,'latest.yml'),'utf8')),file=path.join(folder,installerName(version)),entry=manifest.files?.[0];
 if(manifest.version!==version||manifest.path!==installerUrl(version)||manifest.files?.length!==1||entry.url!==installerUrl(version)||entry.size!==fs.statSync(file).size||manifest.sha512!==entry.sha512||entry.sha512!==await sha512(file))throw Error('Installer/update metadata mismatch.');
 return manifest;
}
module.exports={PUBLIC_INSTALLER,FEED_URL,installerName,installerUrl,prepareUpdate,verifyUpdate};
if(require.main===module)prepareUpdate(path.resolve(process.argv[2]),require('../package.json').version).then(value=>console.log('Prepared automatic update '+value.version)).catch(error=>{console.error(error.message);process.exitCode=1;});
