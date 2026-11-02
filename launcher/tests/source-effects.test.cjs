'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture=require('./fixtures/source-effects-2026-10-17.json');
const audit=require('../../docs/bloxd-source-effects-reference.json');
function source(kind){
  const c=fixture.contracts.find(c=>c.kind===kind);assert.ok(c,kind);
  assert.equal(crypto.createHash('sha256').update(c.code).digest('hex'),c.sha256);
  assert.equal(c.code.length,c.lengthUTF16);
  const bundle=audit.sources.find(s=>s.file===c.file);assert.equal(bundle.sha256,c.bundleSha256);
  return c.code;
}
test('custom GPU source uses spawn records and analytic shader evaluation, not current-pose pingpong buffers',()=>{
  const layout=source('gpuLayout'),ring=source('gpuRingAndEmitter'),shader=source('gpuShaders');
  assert.ok(layout.includes('position:0,time:3,direction:4,lifeTime:7,size:8,seed:9,colour:12'));
  assert.ok(layout.includes('Ys=16'));assert.ok(layout.includes('Es=12+17*Rs'));
  assert.ok(ring.includes('drawCount(){return this.highWater}'));
  assert.ok(ring.includes('drawStart(){return this.cursor<this.highWater?this.cursor:0}'));
  assert.ok(ring.includes('this.deaths[vs]>ss'));assert.ok(ring.includes('new Uint32Array(this.records.buffer)'));
  for(const text of ['gpuParticleFrame.w - spawn.w','age >= 0.0 && age < life','spawn.xyz + displacement','colourAt(colour0, age, ratio, seed)','gl_InstanceID','gl_VertexID','uintBitsToFloat'])assert.ok(shader.includes(text),text);
  assert.ok(!source('gpuUploadAndDraw').includes('transformFeedback'));
});
test('GPU source factory and upload contract distinguish the active custom path from a generic Babylon class',()=>{
  const factory=source('gpuFactorySelection'),draw=source('gpuUploadAndDraw');
  assert.ok(factory.includes('this.Iv.Je>=2'));assert.ok(factory.includes('new Qs(this.tY)'));
  assert.ok(factory.includes('this.KY?.particles'));assert.ok(factory.includes('new jy.e(ss,ys,this.tY)'));
  for(const text of ['this.animatedFrame=ys,this.ring.takeUploads(this.uploadSlots)','Os.RGBA_INTEGER,Os.UNSIGNED_INT,es,Ys*Ks.e','ss.prepareDraw(this.warnOnce)','ss.drawOffset(Os,0),Os[3]=ss.drawTime()','es=ss.ring.drawStart(),Ys=ss.ring.drawCount()','vs.drawArraysType(Ds.c.MATERIAL_TriangleStripDrawMode,0,4,Ys)'])assert.ok(draw.includes(text),text);
  assert.ok(!draw.includes('forceDepthWrite'));
});
test('sprite evidence proves dispatch order and layer gating but does not invent a missing renderer',()=>{
  const dispatch=source('sourceParticleAndSpriteDispatch'),order=source('sourceSpriteStage');
  assert.ok(dispatch.includes('!this._scene.spritesEnabled||0===this._spriteManagers.length'));
  assert.ok(dispatch.includes('0!==(ss&&ss.layerMask&vs.layerMask)&&vs.render()'));
  assert.ok(order.indexOf('this._renderSprites()')<order.indexOf('this._renderParticles(Rs)'));
  assert.ok(source('sourceSpriteStub').includes('(0,rs.h)("Scene","spriteManagers")'));
  assert.ok(source('atlasMeshMaterial').includes('new es.nY'));
  for(const row of audit.inventory)for(const term of ['spriteVertexShader','spritePixelShader','SpriteManager','_spriteRenderer','_appendSpriteVertex','GPUParticleSystem'])assert.equal(row.occurrences[term].length,0,row.file+': '+term);
});
test('source effects audit has byte provenance and never evaluates source modules',()=>{
  assert.equal(fixture.bundlesExecuted,false);assert.equal(audit.bundlesExecuted,false);
  assert.equal(audit.sources.length,11);for(const c of fixture.contracts)source(c.kind);
  for(const s of audit.sources){assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.ok(s.bytes>0);}
});

test('GPU draw observation follows applied raster state and source shader ownership',()=>{
  assert.match(source('gpuAppliedDrawState'),/this\.applyStates\(\).*this\._gl\.drawArraysInstanced/);
  assert.match(source('gpuAlphaDepthPolicy'),/depthCullingState\.depthMask=Rs/);
  assert.match(source('gpuBlendFactors'),/case 4:this\.setAlphaBlendFunctionParameters\(774,0,1,1,ys\)/);
  assert.match(source('gpuRawShaderOwnership'),/_rawVertexSourceCode=ss/);
  const shaders=require('./fixtures/gpu-particle-shaders.json'),fs=require('node:fs'),path=require('node:path');
  const header=fs.readFileSync(path.join(__dirname,'../../src/bridge_gpu_particle_shaders.hpp'),'utf8');
  for(const name of ['hash','random','colourPosition','stopColour','velocityFactor','colourAt','travel','displacement','remapAt']){
    const from=shaders.vertex.indexOf(name+'('),end=shaders.vertex.indexOf('\n}\n',from)+3;
    assert.ok(from>=0&&end>from&&header.includes(shaders.vertex.slice(from,end)),name+' formula changed');
  }
  assert.ok(header.includes('gpuParticleFrame.w - spawn.w'));assert.ok(header.includes('age >= 0.0 && age < life'));
  assert.ok(header.includes('colour.rgb * sourceAlpha + vec3(1.0 - sourceAlpha)'));assert.ok(header.includes('uintBitsToFloat(sizeSeed.x)'));
});
