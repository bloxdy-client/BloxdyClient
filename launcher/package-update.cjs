'use strict';
// Build hook only. Reuse the complete NSIS upgrade installer, including the
// existing application identity and data paths. Never run it or start a client.
const fs=require('node:fs'),path=require('node:path');
module.exports=async function packageUpdate(result){
  const version=require('../package.json').version;
  const folder=path.resolve(result.outDir);
  const setup=path.join(folder,`Bloxdy-Client-Setup-${version}-x64.exe`);
  const installers=result.artifactPaths.filter(file=>/^Bloxdy-Client-Setup-.*-x64\.exe$/.test(path.basename(file)));
  if(!installers.length)return [];
  if(installers.length!==1 || path.resolve(installers[0])!==setup)
    throw Error('Update installer does not match the current package version.');
  const update=path.join(folder,`Bloxdy-Client-Update-${version}-x64.exe`);
  fs.copyFileSync(setup,update);
  return [update];
};
