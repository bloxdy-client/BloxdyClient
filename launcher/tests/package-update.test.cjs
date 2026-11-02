'use strict';
// File operations only: never execute an installer or client.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const packageUpdate=require('../package-update.cjs'),{version}=require('../../package.json');
test('Update artifact uses the complete current installer bytes and refuses a mismatched release',async t=>{
  const outDir=fs.mkdtempSync(path.join(os.tmpdir(),'bloxdy-update-test-'));
  t.after(()=>{assert.ok(outDir.startsWith(path.join(os.tmpdir(),'bloxdy-update-test-')));fs.rmSync(outDir,{recursive:true,force:true});});
  const installer=path.join(outDir,`Bloxdy-Client-Setup-${version}-x64.exe`),bytes=Buffer.from('inert installer fixture');
  fs.writeFileSync(installer,bytes);
  const files=await packageUpdate({outDir,artifactPaths:[installer]});
  assert.deepEqual(files,[path.join(outDir,`Bloxdy-Client-Update-${version}-x64.exe`)]);
  assert.deepEqual(fs.readFileSync(files[0]),bytes);
  await assert.rejects(packageUpdate({outDir,artifactPaths:[path.join(outDir,'Bloxdy-Client-Setup-0.0.0-x64.exe')]}),/current package version/);
  assert.deepEqual(await packageUpdate({outDir,artifactPaths:[path.join(outDir,`Bloxdy-Client-Portable-${version}-x64.exe`)]}),[]);
});
