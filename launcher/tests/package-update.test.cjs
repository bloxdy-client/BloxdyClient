'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),yaml=require('js-yaml');
test('Windows release produces only the NSIS updater without duplicate or differential artifacts',()=>{
 const root=path.resolve(__dirname,'../..'),config=yaml.load(fs.readFileSync(path.join(root,'electron-builder.yml'),'utf8'));
 assert.deepEqual(config.win.target,['nsis']);
 assert.equal(config.nsis.artifactName,'Bloxdy-Client-Update-${version}-x64.exe');
 assert.equal(config.nsis.differentialPackage,false);
 assert.equal(config.nsis.runAfterFinish,false);
 assert.equal(config.portable,undefined);
 assert.equal(config.afterAllArtifactBuild,undefined);
 assert.equal(require('../../package.json').scripts['dist:windows'],'electron-builder --win nsis --x64 --publish never');
});
