'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture=require('./fixtures/source-light-2026-10-18.json');
const source=kind=>fixture.contracts.find(c=>c.kind===kind).code;
test('pinned light source evidence preserves writer, RGB units, held-vector modes and source sun meaning',()=>{
  assert.equal(fixture.bundlesExecuted,false);
  for(const c of fixture.contracts)assert.equal(crypto.createHash('sha256').update(c.code).digest('hex'),c.sha256);
  assert.match(source('lightUniformWriterAndPacking'),/updateFloat3\("uSkyLightColour"/);
  assert.match(source('lightUniformWriterAndPacking'),/Math.max\(Os\[0\],my\)/);
  assert.match(source('renderHeldVectorAndSceneCall'),/this.FY>0/);
  assert.match(source('renderHeldVectorAndSceneCall'),/this.my.camera.Ne\(\)/);
  assert.match(source('renderHeldVectorAndSceneCall'),/this.my.hY.le\(this.my.bY\)/);
  assert.match(source('skyDirectionUpdate'),/this.my.vy.Tf=\[Rs,Os,es\]/);
  assert.match(source('skyRuntimeAndEffectClock'),/performance.now\(\)\/1e3%3600/);
  assert.match(source('workerEmissionLookup'),/this.lightEmissionLookup\[Ns\[/);
  assert.match(source('emissionApiContract'),/each 0-15/);
});
test('coverage keeps source light separate from unproven world clocks weather and reference emission',()=>{
  const r=require('../../docs/bloxd-source-light-reference.json');
  assert.equal(r.sources.length,11);assert.deepEqual(r.referenceRequirementsClosed,[]);assert.equal(r.irisContractComplete,false);
  assert.ok(r.coverage.every(c=>c.referenceEquivalent===false&&c.unit&&c.timing&&c.validity&&c.consumer));
  assert.match(r.coverage.find(c=>c.candidate==='block own emission').validity,/primitive.*generation/);
  assert.match(r.coverage.find(c=>c.candidate==='weather/rain/wetness').validity,/absence does not mean clear/);
});
