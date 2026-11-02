'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),map=require('../../docs/bloxd-minecraft-block-map.json'),report=require('../../docs/bloxd-minecraft-block-reference.json'),reference=require('../../docs/render-reference.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('static Water and Lava map only exact fluid registrations without inventing Minecraft levels or flow',()=>{
  const fluid=report.fluid;assert.deepEqual(fluid.domain,Array.from({length:16},(_,n)=>String(n)));
  assert.equal(fluid.bundlesExecuted,false);assert.equal(fluid.javaExecuted,false);
  assert.deepEqual(report.mappings.filter(m=>m.kind==='fluid').map(m=>[m.sourceName,m.target,m.flags]),[['Water','minecraft:water',4],['Lava','minecraft:lava',4]]);
  assert.match(report.mappings.find(m=>m.sourceName==='Water').source.code,/textureInfo:\[\.5,\.5,\.8,\.9\]/);
  const lava=report.mappings.find(m=>m.sourceName==='Lava').source.code;assert.match(lava,/animationInterval:200/);assert.match(lava,/sO:\[14,8,2\]/);
  assert.match(fluid.unknownPolicy,/Never borrow level=0/);assert.match(fluid.flagsPolicy,/non-solid\/non-opaque\/fluid\/non-model/);
  for(const c of [...fluid.sourceContracts,report.fluidAdapter]){const source=require('../../docs/bloxd-source-material-reference.json').sources.find(s=>s.file===c.file),text=fs.readFileSync(path.join(root,source.local),'utf8');assert.equal(sha(fs.readFileSync(path.join(root,source.local))),source.sha256);assert.equal(text.slice(c.offsetUTF16,c.offsetUTF16+c.lengthUTF16),c.code);assert.equal(sha(c.code),c.sha256);}
  assert.equal(report.mappings.filter(m=>m.stateComplete).length,48);assert.equal(report.mappings.filter(m=>!m.stateComplete).length,11);
});

test('fluid reference level domain comes from LiquidBlock class properties rather than property-free blockstate JSON',async()=>{
  const zip=await require('unzipper').Open.file(path.join(root,'outputs/minecraft-block-reference/reference.jar')),read=require('../../tools/read-java-class.cjs');
  for(const c of report.fluid.referenceClasses){const b=await zip.files.find(f=>f.path===c.type+'.class').buffer();assert.equal(sha(b),c.sha256);}
  const blocks=read(await zip.files.find(f=>f.path==='net/minecraft/world/level/block/Blocks.class').buffer());
  for(const f of report.fluid.factories){assert.deepEqual(blocks.methods.find(m=>m.key===f.method.key),f.method);assert.ok(f.method.operations.some(o=>o.target==='net/minecraft/world/level/material/Fluids.'+f.target.split(':')[1].toUpperCase()+'Lnet/minecraft/world/level/material/FlowingFluid;'));}
  const props=report.fluid.referenceClasses.find(c=>c.type.endsWith('/BlockStateProperties'));
  const b=await zip.files.find(f=>f.path===props.type+'.class').buffer(),ops=read(b,{numeric:true}).methods.find(m=>m.key==='<clinit>').operations;
  const at=ops.findIndex(o=>o.target===props.type+'.LEVELLnet/minecraft/world/level/block/state/properties/IntegerProperty;');
  assert.deepEqual(ops.slice(at-4,at+1),report.fluid.levelRegistration);assert.equal(ops[at-3].integer,0);assert.equal(ops[at-2].integer,15);
  for(const name of ['water','lava']){const m=report.mappings.find(m=>m.target==='minecraft:'+name),resource=await zip.files.find(f=>f.path===m.reference.resource).buffer();assert.equal(sha(resource),m.reference.sha256);assert.deepEqual(Object.keys(JSON.parse(resource).variants),['']);assert.equal(m.stateComplete,false);}
  // Default class-reader output is unchanged; opt-in numeric operands do not
  // alter the pinned reports used by earlier material audits.
  assert.ok(!read(b).methods.find(m=>m.key==='<clinit>').operations.some(o=>Object.hasOwn(o,'integer')));
});
test('explicit block mapping uses pinned Java reference bytes and concrete source definitions without executing either',()=>{
  assert.equal(map.minecraftVersion,reference.minecraftVersion);assert.equal(report.minecraftVersion,reference.minecraftVersion);assert.equal(report.irisVersion,reference.irisVersion);
  assert.equal(report.origin.jarSha1,'e877b6a07acd633fb3bb475002175cec036e7b87');assert.equal(report.origin.executed,false);assert.equal(report.clientsStarted,0);assert.equal(report.graphicsContextsCreated,0);assert.equal(report.bundlesExecuted,false);
  const bytes=fs.readFileSync(path.join(root,report.source.local)),text=bytes.toString('utf8');assert.equal(sha(bytes),report.source.sha256);
  for(const m of report.mappings){const c=m.source;assert.equal(text.slice(c.offsetUTF16,c.offsetUTF16+c.lengthUTF16),c.code);assert.equal(sha(c.code),c.sha256);assert.match(c.code,m.kind.startsWith("door_")?/itemTexture:/:/textureInfo:/);assert.match(m.reference.resource,/^assets\/minecraft\/blockstates\/[a-z_]+\.json$/);assert.ok(m.reference.registration.some(o=>o.op===0xb3));assert.ok(m.reference.classChain.length);}
  const g=report.slabGenerator;assert.equal(text.slice(g.offsetUTF16,g.offsetUTF16+g.lengthUTF16),g.code);assert.equal(sha(g.code),g.sha256);assert.match(g.code,/\[ss\]:\{\.\.\.ys,yO:qs\.bot\}/);assert.match(g.code,/\|meta\|rot1\|top/);
});
test('canonical block table preserves exact names and state coverage independently of raw IDs or pack assignments',()=>{
  assert.equal(map.blocks.length,59);assert.equal(new Set(map.blocks.map(b=>b[0])).size,59);
  for(const [source,target,kind,flags] of map.blocks){const m=report.mappings.find(m=>m.sourceName===source);assert.ok(m);assert.equal(m.target,'minecraft:'+target);assert.equal(m.kind,kind);assert.equal(m.flags,flags);
    if(kind==='cube'){assert.equal(m.stateComplete,true);assert.deepEqual(m.knownProperties,{});assert.deepEqual(m.unknownProperties,[]);assert.deepEqual(m.reference.variants,['']);}
    else if(kind==='slab'){assert.equal(m.stateComplete,true);assert.deepEqual(m.knownProperties,{type:['bottom','top'],waterlogged:['false']});assert.deepEqual(m.unknownProperties,[]);assert.match(m.source.code,/model:"Slab"/);assert.equal(flags,9);}
    else if(kind==='stairs'){assert.equal(m.stateComplete,true);assert.deepEqual(m.unknownProperties,[]);assert.equal(m.knownProperties.shape.length,5);assert.deepEqual(m.knownProperties.waterlogged,['false']);assert.equal(flags,9);}
    else if(kind==='log'||kind==='grass'){assert.equal(m.stateComplete,false);assert.deepEqual(m.knownProperties,{});assert.deepEqual(m.unknownProperties,[kind==='log'?'axis':'snowy']);assert.equal(flags,3);}
    else if(kind==='fluid'){assert.equal(m.stateComplete,false);assert.deepEqual(m.knownProperties,{});assert.deepEqual(m.unknownProperties,['level']);assert.equal(flags,4);assert.deepEqual(m.reference.variants,['']);}
    else {assert.equal(m.stateComplete,false);assert.deepEqual(m.unknownProperties,['powered']);assert.deepEqual(m.knownProperties.hinge,['right']);assert.match(m.source.code,/model:"door"/);assert.equal(flags,9);}}
  assert.equal(report.mappings.find(m=>m.sourceName==='Snow').target,'minecraft:snow_block');assert.equal(report.mappings.find(m=>m.sourceName==='Messy Stone').target,'minecraft:cobblestone');
  for(const name of ['Toxic Waste','Water|level|0','Jungle Grass Block','Maple Log','Moonstone','Stone|meta|rot2|top'])assert.equal(map.blocks.some(b=>b[0]===name),false);
  assert.equal(map.packIdsImplemented,false);assert.equal(report.packIdsImplemented,false);assert.equal(report.irisContractComplete,false);
  assert.equal(map.contract,5);assert.equal(report.contract,5);assert.match(report.fluidAdapter.code,/Rs=ss\.As\.Xz/);assert.match(report.fluidAdapter.code,/return Rs\[Ys\]/);assert.match(report.waterloggedInference,/exact observed nonfluid slab/);
});
test('native mapping table agrees with audited identities and remains outside default capture and production shaders',()=>{
  const file=n=>fs.readFileSync(path.join(root,n),'utf8'),expected='// Generated by tools/audit-minecraft-block-map.cjs; no numeric Minecraft IDs.\n'+map.blocks.map(([s,t,k,f])=>`{${JSON.stringify(s)},${JSON.stringify('minecraft:'+t)},MinecraftBlockKind::${k},${f}},`).join('\n')+'\n';
  assert.equal(file('src/bridge_minecraft_block_rules.inc'),expected);
  assert.match(file('src/bridge_source_emission.hpp'),/m\.minecraft=mapMinecraftBlock\(m\)/);
  assert.doesNotMatch(file('bridge/capture-factory.cjs'),/mapMinecraftBlock|minecraftBlockRules/);
  assert.doesNotMatch(file('src/bridge_minecraft_blocks.hpp'),/glUniform|glGen|SemanticIds|OwnEmission/);
});

test('shaped mappings have all forty stair geometries and thirty-two door orientations checked against exact reference model bytes',()=>{
  const {shaped:s}=report,text=fs.readFileSync(path.join(root,report.source.local),'utf8');
  assert.equal(s.bundlesExecuted,false);assert.equal(s.javaExecuted,false);assert.equal(s.records.length,72);
  for(const c of s.spans){assert.equal(text.slice(c.offsetUTF16,c.offsetUTF16+c.lengthUTF16),c.code);assert.equal(sha(c.code),c.sha256);}
  const stairs=s.records.filter(r=>r.kind==='stairs'),doors=s.records.filter(r=>r.kind==='door');assert.equal(stairs.length,40);assert.equal(doors.length,32);
  for(const r of stairs){assert.match(r.occupancySha256,/^[a-f0-9]{64}$/);assert.equal(r.renderOccupancySha256,r.occupancySha256);if(r.sourceShape==='innerLeft')assert.match(r.reference,/shape=inner_right/);if(r.sourceShape==='outerRight')assert.match(r.reference,/shape=outer_left/);}
  for(const r of doors){assert.equal(r.hinge,'right');assert.match(r.reference,/hinge=right/);assert.equal(r.edge.length,2);}
  assert.equal(report.mappings.filter(m=>m.kind==='stairs').length,10);assert.equal(report.mappings.filter(m=>m.kind.startsWith('door_')).length,4);
  assert.match(s.doorLimit,/powered is unknown/);for(const name of ['Maple Door','Pine Door','Smooth Stone Stairs'])assert.equal(map.blocks.some(b=>b[0]===name),false);
});

test('shaped audit reference resources match the pinned jar independently of the stored geometry report',async()=>{
  const unzip=require('unzipper'),zip=await unzip.Open.file(path.join(root,'outputs/minecraft-block-reference/reference.jar'));
  for(const resource of report.shaped.resources){const b=await zip.files.find(f=>f.path===resource.file).buffer();assert.equal(sha(b),resource.sha256);assert.deepEqual(JSON.parse(b),resource.json);}
  for(const c of report.shaped.referenceClasses)assert.equal(sha(await zip.files.find(f=>f.path===c.type+'.class').buffer()),c.sha256);
});
test('wood and grass mappings expose reference domains without inventing axes, snowy defaults or species aliases',()=>{
  const w=report.woodGrass;assert.equal(w.bundlesExecuted,false);assert.equal(w.javaExecuted,false);assert.equal(w.partial.length,5);
  for(const p of w.partial){const m=report.mappings.find(m=>m.sourceName===p.sourceName);assert.equal(m.stateComplete,false);assert.deepEqual(m.knownProperties,{});assert.deepEqual(p.domain,m.kind==='log'?['x','y','z']:['false','true']);assert.deepEqual(m.unknownProperties,p.unknown);}
  const wood=report.mappings.filter(m=>m.kind==='log');assert.equal(wood.length,4);assert.ok(wood.every(m=>/^(?:Barkless )?(Jungle|Cherry) Log$/.test(m.sourceName)));
  for(const name of ['Maple Log','Pine Log','Aspen Log','Mango Log','Jungle Log|TreeBase|Jungle','Barkless Cherry Log|TreeBase|Cherry','Jungle Grass Block'])assert.equal(map.blocks.some(b=>b[0]===name),false);
  for(const m of wood)assert.deepEqual(m.reference.variants,['axis=x','axis=y','axis=z']);assert.deepEqual(report.mappings.find(m=>m.kind==='grass').reference.variants,['snowy=false','snowy=true']);
  for(const c of w.sourceContracts){const source=require('../../docs/bloxd-source-material-reference.json').sources.find(s=>s.file===c.file),text=fs.readFileSync(path.join(root,source.local),'utf8');assert.equal(text.slice(c.offsetUTF16,c.offsetUTF16+c.lengthUTF16),c.code);assert.equal(sha(c.code),c.sha256);}
  assert.match(w.unknownPolicy,/Reference defaults/);assert.equal(map.blocks.filter(b=>['Jungle Wood Planks','Cherry Wood Planks'].includes(b[0])).length,2);
});
test('wood axis and grass snowy domains are backed by exact reference class bytes and property registration',async()=>{
  const zip=await require('unzipper').Open.file(path.join(root,'outputs/minecraft-block-reference/reference.jar'));
  for(const c of report.woodGrass.referenceClasses){const b=await zip.files.find(f=>f.path===c.type+'.class').buffer();assert.equal(sha(b),c.sha256);}
  for(const m of report.mappings.filter(m=>m.kind==='log'||m.kind==='grass'))assert.ok(m.reference.classChain.some(c=>c.type.endsWith(m.kind==='log'?'/RotatedPillarBlock':'/SnowyBlock')));
});
