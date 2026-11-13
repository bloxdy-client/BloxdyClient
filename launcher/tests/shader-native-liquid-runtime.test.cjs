'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./shader-native-liquid-fixture.cjs');
test('Background liquid preparation preserves native source buffers and commits compact geometry/light once',async()=>{
 const f=fixture(),original=f.packet.packedVertices.slice(),lights=f.packet.FE.slice();f.pump();assert.deepEqual(f.errors,[]);assert.equal(f.liquids.diagnostics().prepared,1);
 const record=f.native.terrain.chunks.get(f.mesh);assert.equal(record.vertexCount,64);assert.equal(record.light.length,64);assert.equal(f.native.terrain.slots.words[record.slot*8+6],record.vertices.start*4);assert.equal(f.native.terrain.slots.words[record.slot*8+7],64);
 assert.deepEqual(f.packet.packedVertices,original);assert.deepEqual(f.packet.FE,lights);assert.equal(f.packet.vertexCount,4);assert.equal(f.allocations.find(b=>b.label==='Bloxdy liquid quad metadata').size,16*40);
 const count=f.allocations.length,uploads=f.liquids.diagnostics().uniformUploads;f.pump(90);assert.equal(f.allocations.length,count);assert.equal(f.liquids.diagnostics().uniformUploads,uploads);await f.dispose();
});
test('Per-chunk liquid metadata keeps original shadow resources and restores the neutral binding for ordinary terrain',async()=>{
 const f=fixture();f.pump();const pass=f.pass();f.native.terrain.bindShaderPackInputs(pass);const base=pass.bound.get(3);f.native.terrain.geometry.draw(pass,f.native.terrain.chunks.get(f.mesh));
 const liquid=f.draws.at(-1).group;assert.notEqual(liquid,base);assert.equal(liquid.layout,base.layout);assert.equal(liquid.entries.find(e=>e.binding===3).resource.buffer.shadow,true);assert.notEqual(liquid.entries.find(e=>e.binding===19).resource.buffer,base.entries.find(e=>e.binding===19).resource.buffer);
 const plain={mesh:{}};f.native.terrain.geometry.draw(pass,plain);assert.equal(f.draws.at(-1).group,base);assert.equal(f.liquids.diagnostics().extraRenderPasses,0);await f.dispose();
});
test('Chunk replacement during a worker job rejects the stale result without losing the native edit',async()=>{
 const f=fixture();f.tick();assert.equal(f.jobs.length,1);const replacement={...f.packet,packedVertices:f.packet.packedVertices.slice()};replacement.packedVertices[0]+=16;
 f.native.terrain.setChunkMesh(f.mesh,replacement,[0,0,0]);f.finish();f.pump();assert(f.liquids.diagnostics().staleResults>0);const record=f.native.terrain.chunks.get(f.mesh);assert(record.data.packedVertices[0]>=16);assert.equal(f.packet.packedVertices.byteLength,12);assert.deepEqual(f.errors,[]);await f.dispose();
});
test('Light-only edits use current native Uint16 light values and do not rebuild geometry',async()=>{
 const f=fixture();f.pump();const record=f.native.terrain.chunks.get(f.mesh),vertices=record.data.packedVertices,prepared=f.liquids.diagnostics().prepared,newLight=new Uint16Array(4).fill(0xfedc);
 f.native.terrain.setChunkMeshLight(f.mesh,newLight);f.pump();assert.equal(f.native.terrain.chunks.get(f.mesh),record);assert.equal(record.data.packedVertices,vertices);assert(record.light.every(v=>v===0xfedc));assert.equal(f.liquids.diagnostics().prepared,prepared);assert.equal(newLight.byteLength,8);await f.dispose();
});
test('Off during preparation restores native geometry and prevents delayed worker results from returning',async()=>{
 const f=fixture();f.tick();f.settings.enabled=false;f.tick();f.finish();f.pump();const record=f.native.terrain.chunks.get(f.mesh);assert.equal(record.vertexCount,4);assert.equal(record.data,f.packet);assert.equal(f.native.terrain.slots.words[record.slot*8+7],0);assert.equal(f.liquids.diagnostics().prepared,0);assert.deepEqual(f.errors,[]);await f.dispose();
});
test('Disposal terminates workers, retires owned buffers and restores native methods',async()=>{
 const f=fixture();f.pump();await f.dispose();assert.equal(f.native.__BVFX_NATIVE_LIQUID_RESOURCES__,undefined);assert.equal(f.native.__BVFX_NATIVE_LIQUID_BIND__,undefined);assert.equal(f.native.__BVFX_REPLACE_NATIVE_BINDING__,undefined);
 for(const b of f.allocations.filter(b=>/^Bloxdy/.test(b.label||'')))assert.equal(b.destroyed,true,b.label);assert.equal(f.root.URL.createObjectURL===undefined,false);const before=f.native.terrain.chunks.size;f.finish();assert.equal(f.native.terrain.chunks.size,before);
});

test('Camera liquid tint follows native alpha and settings even when the model version is retained',async()=>{
 const f=fixture(),m=f.native.meshes.modelUniforms,writes=[],instance={owner:{name:'camera_screen_mat'},heldVersion:-1,ubo:{updateFloat4:(...values)=>writes.push(values)}},model={name:'camera_screen_mat',diffuseColor:[0,0,0],emissiveColor:[.1,.3,.8],alpha:.4,version:1};
 f.settings.waterUnderwater=25;f.settings.lavaUnderwater=50;m.refreshModelUniforms({},instance,model,{});assert.equal(writes.at(-1)[4],.1);assert.equal(model.alpha,.4);
 const count=writes.length;assert.equal(m.refreshModelUniforms({},instance,model,{}),true);assert.equal(writes.length,count);
 f.settings.waterUnderwater=75;m.refreshModelUniforms({},instance,model,{});assert(Math.abs(writes.at(-1)[4]-.3)<1e-12);
 model.emissiveColor=[1,.2,.02];model.version++;m.refreshModelUniforms({},instance,model,{});assert.equal(writes.at(-1)[4],.2);
 f.settings.enabled=false;m.refreshModelUniforms({},instance,model,{});assert.equal(writes.at(-1)[4],.4);
 instance.owner.name='hurt_flash';model.name='hurt_flash';model.version++;m.refreshModelUniforms({},instance,model,{});assert.equal(writes.at(-1)[4],.4);await f.dispose();
});

test('A duplicate worker reply cannot consume the next active job',async()=>{
 const f=fixture();f.tick();const [worker,job]=f.jobs[0];f.finish();f.tick();f.tick();assert.equal(f.jobs.length,1);const next=f.jobs[0][1];assert.notEqual(next.ticket,job.ticket);
 worker.onmessage({data:{id:job.id,ticket:job.ticket,result:{skip:true}}});assert.equal(f.liquids.diagnostics().workerBusy,true);f.finish();f.pump();assert.equal(f.liquids.diagnostics().prepared,1);assert.deepEqual(f.errors,[]);await f.dispose();
});

test('A light update during a style rebuild keeps both the requested geometry and latest lighting',async()=>{
 const f=fixture();f.settings.waterStyle='flat';f.pump();assert.equal(f.native.terrain.chunks.get(f.mesh).vertexCount,4);
 f.settings.waterStyle='wavey';f.tick();assert.equal(f.jobs.length,1);f.native.terrain.setChunkMeshLight(f.mesh,new Uint16Array(4).fill(0x8abc));f.finish();f.pump();
 const record=f.native.terrain.chunks.get(f.mesh);assert.equal(record.vertexCount,64);assert(record.light.every(v=>v===0x8abc));assert.deepEqual(f.errors,[]);await f.dispose();
});
