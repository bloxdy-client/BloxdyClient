'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),fixture=require('./fixtures/source-material-2026-10-20.json'),report=require('../../docs/bloxd-source-material-reference.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('source material names and properties have exact pinned producer and frozen-state evidence without public code execution',()=>{
  assert.equal(report.sources.length,14);assert.equal(fixture.contracts.length,12);assert.equal(fixture.bundlesExecuted,false);
  for(const c of fixture.contracts){const s=report.sources.find(s=>s.file===c.file),text=fs.readFileSync(path.join(root,s.local),'utf8');assert.equal(sha(c.code),c.sha256);assert.equal(text.slice(c.offsetUTF16,c.offsetUTF16+c.lengthUTF16),c.code);}
  const code=k=>fixture.contracts.find(c=>c.kind===k).code;
  assert.match(code('sourceNameAndMetadataApi'),/this\.As\.metadatas\[ss\]\.name/);
  assert.match(code('engineSourceObjectJoin'),/ss\.bloxd=Ns\.singletons\.bloxd/);
  assert.match(code('metadataFrozenState'),/Object\.freeze\(new es/);
  assert.match(code('renderRegistrationFromMetadata'),/ss\.As\.vz\(ys\.id/);
  assert.match(code('registryWriter'),/this\.os=Os,this\.Qs=my,this\.Xz=Es,this\.us=Zs/);
});
test('source material dictionary remains distinct from Minecraft and preserves all old emission layouts',()=>{
  assert.equal(report.sourceBlockMaterialContract,1);assert.deepEqual(report.newPacket,{type:33,version:5});assert.deepEqual(report.preservedEmissionVersions,[1,2,3,4]);
  assert.equal(report.minecraftMappingImplemented,false);assert.equal(report.irisContractComplete,false);assert.deepEqual(report.referenceRequirementsClosed,[]);
  assert.match(report.lifetime,/actual observed worker initialization barrier/);assert.match(report.limits,/256 observed definitions/);
});
