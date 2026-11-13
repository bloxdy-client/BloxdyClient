'use strict';
// Packaging only: both Electron executables share resources/DLLs. A separately
// named game image lets Windows identify the game apart from the launcher.
const fs=require('node:fs'),path=require('node:path');
const pe=require('pe-library'),resedit=require('resedit');
module.exports=async function afterPack(context){if(context.electronPlatformName!=='win32')return;const folder=path.resolve(context.appOutDir),launcher=path.join(folder,context.packager.appInfo.productFilename+'.exe'),game=path.join(folder,'Bloxdy Game Client.exe');if(path.dirname(launcher)!==folder||path.dirname(game)!==folder||fs.realpathSync(folder)!==folder)throw Error('Invalid package directory.');fs.copyFileSync(launcher,game);
 // electron-builder edits the launcher executable after this hook, so stamp the
 // separately named game executable here with the same icon.
 const icon=resedit.Data.IconFile.from(fs.readFileSync(path.join(__dirname,'assets','bloxdy-icon.ico')));
 const executable=pe.NtExecutable.from(fs.readFileSync(game),{ignoreCert:true});
 const resources=pe.NtExecutableResource.from(executable);
 resedit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries,1,1033,icon.icons.map(item=>item.data));
 // This copy is made before electron-builder brands the launcher image.
 // Windows Task Manager reads these PE strings, not the runtime app name.
 const versions=resedit.Resource.VersionInfo.fromEntries(resources.entries);
 if(!versions.length)throw Error('Game executable version resource is missing.');
 for(const version of versions){version.setFileVersion(context.packager.appInfo.version);version.setProductVersion(context.packager.appInfo.version);
  for(const language of version.getAvailableLanguages())version.setStringValues(language,{FileDescription:'BloxdyClient',ProductName:'Bloxdy Client',InternalName:'BloxdyClient',OriginalFilename:'Bloxdy Game Client.exe',CompanyName:'Bloxdy Client contributors'});
  version.outputToResourceEntries(resources.entries);
 }
 resources.outputResource(executable);
 fs.writeFileSync(game,Buffer.from(executable.generate()));
};
