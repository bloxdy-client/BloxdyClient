'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),unzip=require('unzipper');
const root=path.resolve(__dirname,'../..'),report=require('../../docs/iris-material-id-reference.json'),mapping=require('../../docs/bloxd-minecraft-block-reference.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('pack ID rules are grounded in the exact pinned Iris classes, separately from supporting public source',async()=>{
  const jar=fs.readFileSync(path.join(root,'outputs/iris-reference/iris-reference.jar'));assert.equal(crypto.createHash('sha512').update(jar).digest('hex'),report.artifactSha512);
  const zip=await unzip.Open.buffer(jar);assert.equal(report.classes.length,4);assert.equal(report.sources.length,4);
  for(const c of report.classes)assert.equal(sha(await zip.files.find(f=>f.path===c.file).buffer()),c.sha256);
  for(const s of report.sources)assert.equal(sha(fs.readFileSync(path.join(root,s.local))),s.sha256);
  const ops=(c,m)=>report.classes.find(x=>x.file.endsWith('/'+c+'.class')).methods.find(x=>x.key===m).operations;
  assert.ok(ops('IdMap','lambda$parseBlockMap$0').some(o=>o.target==='java/lang/Integer.parseInt(Ljava/lang/String;)I'));
  assert.ok(ops('BlockMaterialMapping','addBlockStates').some(o=>o.target.includes('Object2IntMap.putIfAbsent')));
  assert.ok(ops('BlockMaterialMapping','checkState').some(o=>o.target==='java/lang/String.equals(Ljava/lang/Object;)Z'));
  assert.equal(ops('BlockMaterialMapping','checkState').some(o=>o.target.includes('.split(')),false);
  assert.equal(report.executed,false);assert.equal(report.exactReleaseSourceTagEstablished,false);assert.equal(report.irisContractComplete,false);
});
test('supported slab dry state is tied to actual source cell-ID fluid lookup and effective nonfluid registrations',()=>{
  const source=require('../../docs/bloxd-source-material-reference.json').sources.find(s=>s.file===mapping.fluidAdapter.file),bytes=fs.readFileSync(path.join(root,source.local)),c=mapping.fluidAdapter;
  assert.equal(sha(bytes),c.bundleSha256);assert.equal(bytes.toString('utf8').slice(c.offsetUTF16,c.offsetUTF16+c.lengthUTF16),c.code);assert.equal(sha(c.code),c.sha256);
  assert.match(c.code,/Rs=ss\.As\.Xz/);assert.match(c.code,/var Ys=vs\.hI\(/);assert.match(c.code,/return Rs\[Ys\]/);
  for(const m of mapping.mappings.filter(m=>m.kind==='slab')){assert.equal(m.flags&4,0);assert.deepEqual(m.knownProperties.waterlogged,['false']);assert.equal(m.stateComplete,true);}
  const main=fs.readFileSync(path.join(root,mapping.source.local),'utf8');for(const c of mapping.variantEvidence){assert.equal(main.slice(c.offsetUTF16,c.offsetUTF16+c.lengthUTF16),c.code);assert.equal(sha(c.code),c.sha256);}
  assert.deepEqual(mapping.referenceStates.find(s=>s.type.endsWith('/DoorBlock')).properties,['HALF','FACING','OPEN','HINGE','POWERED']);assert.deepEqual(mapping.referenceStates.find(s=>s.type.endsWith('/StairBlock')).properties,['FACING','HALF','SHAPE','WATERLOGGED']);
});
test('material ID module remains an isolated internal loader component with an explicit input and no default recipe',()=>{
  const file=n=>fs.readFileSync(path.join(root,n),'utf8'),code=file('src/shader_loader/block_ids.hpp');
  assert.match(code,/parsePreprocessed\(std::string_view text\)/);assert.doesNotMatch(code,/ifstream|fstream|fetch\(|system\(|CreateProcess|glUniform|glGen|std::filesystem/);
  assert.match(file('src/bridge_geometry_binding.hpp'),/case U::PackBlockId:known=matrices\.packBlockId\.known/);
  assert.match(file('src/bridge_geometry_binding.hpp'),/a\.name!="mc_Entity"/);
  assert.doesNotMatch(file('src/main.cpp'),/parsePreprocessed|blockIds\s*=/);
  assert.equal(report.clientsStarted,0);assert.equal(report.graphicsContextsCreated,0);
});
