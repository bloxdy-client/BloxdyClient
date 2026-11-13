'use strict';
// Inspect packaged bytes only. Never executes the installer, Electron or game.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),asar=require('@electron/asar'),pe=require('pe-library');
const root=path.resolve(__dirname,'..'),dist=path.resolve(root,process.argv[2]||'dist-launcher'),archive=path.join(dist,'win-unpacked','resources','app.asar'),output=path.join(root,'outputs','launcher-verification');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function fileHash(file){const hash=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(file))hash.update(bytes);return hash.digest('hex');}
async function run(){
 const runtime=require('./runtime-dependencies.cjs').runtimeDependencies(root),entries=asar.listPackage(archive),checked=[],moduleSources=new Map();
 const transformer=require('app-builder-lib/out/fileTransformer.js').createTransformer(root,require('js-yaml').load(fs.readFileSync(path.join(root,'electron-builder.yml'),'utf8')));
 for(const entry of entries){
  const name=entry.replace(/^[/\\]/,'').replaceAll('\\','/'),internal=path.normalize(name);
  if(asar.statFile(archive,internal).files||name==='package.json')continue;
  if(/(^|\/)(outputs|tests|desktop-profile|launcher-ui-profile|launcher-data)(\/|$)/.test(name))throw Error('Unexpected private/development folder in app: '+name);
  let source=path.join(root,name);
  if(name.startsWith('node_modules/')){
   const prefix=name.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)(?:\/|$)/)[1];
   if(!moduleSources.has(prefix)){
    const packaged=JSON.parse(asar.extractFile(archive,path.normalize(prefix+'/package.json')));
    const actual=[...runtime].find(folder=>{const local=JSON.parse(fs.readFileSync(path.join(folder,'package.json')));return local.name===packaged.name&&local.version===packaged.version;});
    if(!actual)throw Error('Unexpected build/development dependency in app: '+prefix);moduleSources.set(prefix,actual);
   }
   source=path.join(moduleSources.get(prefix),name.slice(prefix.length+1));
  }
  if(!fs.existsSync(source))throw Error('Packaged source missing: '+name);
  const original=name.startsWith('node_modules/')&&name.endsWith('/package.json')?Buffer.from(await transformer(source)||fs.readFileSync(source)):fs.readFileSync(source);
  if(digest(original)!==digest(asar.extractFile(archive,internal)))throw Error('Packaged source differs: '+name);checked.push(name);
 }

 const packed=JSON.parse(asar.extractFile(archive,'package.json'));if(packed.version!==require('../package.json').version||packed.main!=='entry.cjs')throw Error('Packaged entry/version mismatch.');
 // The two executables carry separately stamped icon resources. Compare their
 // actual program sections while allowing only the resource section to differ.
 const sections=name=>pe.NtExecutable.from(fs.readFileSync(path.join(dist,'win-unpacked',name)),{ignoreCert:true}).getAllSections().filter(s=>s.info.name!=='.rsrc').map(s=>[s.info.name,digest(Buffer.from(s.data||[]))]);
 if(JSON.stringify(sections('Bloxdy Game Client.exe'))!==JSON.stringify(sections('Bloxdy Client.exe')))throw Error('Separate game executable program sections differ from the packaged Electron runtime.');
 const resedit=require('resedit'),gameImage=pe.NtExecutable.from(fs.readFileSync(path.join(dist,'win-unpacked','Bloxdy Game Client.exe')),{ignoreCert:true}),resources=pe.NtExecutableResource.from(gameImage),versions=resedit.Resource.VersionInfo.fromEntries(resources.entries);
 if(!versions.length||versions.some(v=>v.getAvailableLanguages().some(language=>v.getStringValues(language).FileDescription!=='BloxdyClient'||v.getStringValues(language).ProductName!=='Bloxdy Client')))throw Error('Windows game process is not branded as BloxdyClient.');
 const yaml=require('js-yaml'),feed=yaml.load(fs.readFileSync(path.join(dist,'win-unpacked','resources','app-update.yml'),'utf8'));
 if(feed.provider!=='generic'||feed.url!==require('./release-update.cjs').FEED_URL)throw Error('Packaged automatic update feed mismatch.');
 await require('./release-update.cjs').verifyUpdate(dist,packed.version);
 for(const [file,source]of [['MemoryBudgetRunner.exe','build-launcher/Release/MemoryBudgetRunner.exe']])if(await fileHash(path.join(dist,'win-unpacked','resources','native',file))!==await fileHash(path.join(root,source)))throw Error('Packaged native helper differs.');
 const artifacts=[];for(const name of [`Bloxdy-Client-Update-${packed.version}-x64.exe`]){const file=path.join(dist,name);artifacts.push({name,bytes:fs.statSync(file).size,sha256:await fileHash(file)});}
 const cpuProof=fs.readFileSync(path.join(output,'memory-budget-cpu.txt'),'utf8');if(!cpuProof.startsWith('PASS:'))throw Error('Missing memory budget verification.');
 const report={at:new Date().toISOString(),version:packed.version,sourceFilesCompared:checked.length,packagedSourceMatches:true,nativeResourcesMatch:true,privateFoldersIncluded:false,windowsKernelBudgetTestPassed:true,gameProcessName:'BloxdyClient',automaticUpdateMetadataVerified:true,runtimeDependenciesVerified:runtime.size,clientStarted:false,secondComputerTested:false,uploaded:false,signed:false,artifacts};fs.writeFileSync(path.join(output,'distribution.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(dist,'SHA256SUMS.txt'),artifacts.map(a=>a.sha256+'  '+a.name).join('\n')+'\n');console.log(JSON.stringify(report,null,2));}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
