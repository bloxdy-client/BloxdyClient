'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),report=require('../../docs/bloxd-source-block-reference.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('block identity audit pins bytes and actual producer spans without executing public source modules',()=>{
  assert.equal(report.bundlesExecuted,false);assert.equal(report.sources.length,14);assert.equal(report.contracts.length,15);
  for(const s of report.sources)assert.equal(sha(fs.readFileSync(path.join(root,s.local))),s.sha256);
  for(const c of report.contracts){const fixture=JSON.parse(fs.readFileSync(path.join(root,c.fixture),'utf8')),span=fixture.contracts.find(s=>s.kind===c.kind);
    const source=report.sources.find(s=>s.file===c.file),text=fs.readFileSync(path.join(root,source.local),'utf8');
    assert.equal(sha(span.code),c.sha256);assert.equal(text.slice(c.offsetUTF16,c.offsetUTF16+c.lengthUTF16),span.code);}
});
test('raw block identity closes no reference clock weather material or hand semantic requirement',()=>{
  assert.deepEqual(report.newPacket,{type:33,version:4});assert.deepEqual(report.preservedEmissionPackets,[1,2,3]);
  assert.equal(report.sourceBlockIdentityContract,1);assert.equal(report.sourceBlockEmissionContract,3);assert.equal(report.irisContractComplete,false);assert.deepEqual(report.referenceRequirementsClosed,[]);
  assert.equal(report.coverage.filter(c=>c.status==='implemented-bounded').length,1);
  assert.ok(report.coverage.filter(c=>c.status==='unknown').length===5);
  assert.match(report.coverage[0].unit,/Zero and unknown/);assert.match(report.runtimeScope,/not runtime renderer compatibility/);
  assert.match(report.coverage.find(c=>c.candidate==='reference weather/wetness').producer,/Missing words do not prove clear weather/);
});
