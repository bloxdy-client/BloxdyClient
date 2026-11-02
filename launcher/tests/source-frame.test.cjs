'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture=require('./fixtures/source-frame-2026-10-17.json');
function source(kind){const c=fixture.contracts.find(c=>c.kind===kind);assert.ok(c);assert.equal(crypto.createHash('sha256').update(c.code).digest('hex'),c.sha256);return c.code;}
test('audited source defines absolute tick positions, local render feet and followed render eye separately',()=>{
  assert.match(source('origin'),/this\.Lj=\[0,0,0\]/);assert.match(source('playerEntity'),/this\.bY=Rs\.add/);
  assert.match(source('positionAccess'),/this\.le=this\.xI\(this\.names\.position\)/);
  assert.match(source('positionWrite'),/copy\(ys\.OI,ys\.vD\)/);assert.match(source('positionWrite'),/ys\.Lj\?\?this\.my\.Lj/);
  assert.match(source('positionComponent'),/Rs\[1\]=vs\[1\]/);assert.match(source('positionComponent'),/Rs\[4\]=vs\[1\]\+ss\.height/);
  assert.match(source('renderFeetConsumer'),/add\(this\.playerPos,ss\.OI,this\.iD\)/);
  assert.match(source('eyeRig'),/copy\(ys,ss\.OI\)/);assert.match(source('followRender'),/add\(Zs\.OI,Ss\.OI,vs\)/);
  assert.match(source('worldCoordinates'),/subtract\(vs,ss,Rs\)/);assert.match(source('worldCoordinates'),/add\(ys,ss,Rs\)/);
});
test('audited source hand, bob, far and animation retain their actual meanings',()=>{
  assert.match(source('sourceViewBob'),/ss\.vy\.camera\.fov=Os\.movementBasedFov/);
  assert.match(source('sourceViewBob'),/Rs\.offset\[ss\]=/);assert.match(source('rendererCamera'),/ss\.Ck\.position\.ZO/);
  assert.match(source('sourceFar'),/this\.camera\.cO=vs\*\(ys\+2\)\*2/);
  assert.match(source('handOverride'),/Rs\.activeCamera\.cO=0/);assert.match(source('handRestore'),/Ss\.cO=Zs/);
  assert.match(source('animationClock'),/const Os=100/);assert.match(source('animationClock'),/this\.animTick\+\+/);
  assert.equal(fixture.bundlesExecuted,false);for(const c of fixture.contracts)source(c.kind);
});
