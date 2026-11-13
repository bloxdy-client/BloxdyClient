'use strict';
// Render-graph and byte-array model only. No graphics device or app starts.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
async function fixture(samples=1,format='bgra8unorm',enabled=true){
 const textures=[],buffers=[],events=[],passes=[];let retirements=0,fail=false;
 const device={createSampler:d=>d,createShaderModule:d=>d,async createRenderPipelineAsync(d){return {...d,getBindGroupLayout:()=>({})};},
  createBuffer(d){const b={...d,destroy(){b.destroyed=true;}};buffers.push(b);return b;},
  createTexture(d){const t={...d,createView(options){return {texture:t,...options};},destroy(){t.destroyed=true;}};textures.push(t);return t;},createBindGroup:d=>d,
  queue:{writeBuffer(){events.push('uniform');},onSubmittedWorkDone(){retirements++;assert.equal(events.at(-1),'submit','retirement is scheduled only after native submission');return Promise.resolve();}}};
 const target={native:true},resolve={nativeResolve:true},attachment={view:target,resolveTarget:samples>1?resolve:undefined};
 const engine={_currentEncoder:{beginRenderPass(d){const p={descriptor:d};passes.push(p);return {setPipeline(){},setBindGroup(_i,g){p.group=g;assert.notEqual(g.entries[0].resource,d.colorAttachments[0].view,'no feedback loop');},draw(n){assert.equal(n,3);events.push('post');},end(){}};}}};
 const task={_colorAttachment:attachment,_targetSignature:{_colorFormat:format,_sampleCount:samples},_config:{rt:{_width:1920,_height:1080}},_executeWithTransmission(){events.push('scene');assert(attachment.view!==target||attachment.resolveTarget!==resolve);if(fail)throw Error('Native scene failed');return 7;}};
 const original=task._executeWithTransmission;
 const native={gpuDevice:device,engine,sceneTask:task,drawFrame(){const n=task._executeWithTransmission();events.push('submit');return n;}};
 const settings={enabled:true,bloomEnabled:enabled,bloom:.2},context=vm.createContext({Float32Array,GPUBufferUsage:{UNIFORM:1,COPY_DST:2},GPUTextureUsage:{TEXTURE_BINDING:1,RENDER_ATTACHMENT:2}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../builtin-mods/shader-native-post.js'),'utf8')+';installNativePost(globalThis);',context);
 const adapter=await context.__BVFX_ATTACH_NATIVE_POST__(native,settings);
 return {adapter,native,task,settings,textures,buffers,events,passes,target,resolve,original,get retirements(){return retirements;},fail(){fail=true;},frame:()=>native.drawFrame()};
}
test('Native bloom preserves MSAA and native attachments across the additional colour pass',async()=>{
 for(const samples of [1,4]){const f=await fixture(samples);assert.equal(f.frame(),8);assert.deepEqual(f.events,['scene','uniform','post','submit']);assert.equal(f.task._colorAttachment.view,f.target);assert.equal(f.task._colorAttachment.resolveTarget,samples>1?f.resolve:undefined);
  assert.equal(f.passes[0].descriptor.colorAttachments[0].view,samples>1?f.resolve:f.target);assert.equal(f.passes[0].descriptor.depthStencilAttachment,undefined);f.adapter.dispose();}
});
test('Native bloom reuses one full-resolution texture without readbacks or extra submission waits',async()=>{
 const f=await fixture();for(let i=0;i<120;i++)f.frame();assert.equal(f.textures.length,1);assert.deepEqual(Array.from(f.textures[0].size),[1920,1080]);assert.equal(f.retirements,0);assert.equal(f.adapter.diagnostics().readbacks,0);assert.equal(f.adapter.diagnostics().presentationScale,1);f.adapter.dispose();
});
test('Bloom Off performs no post pass and releases the retained image after native submission',async()=>{
 const f=await fixture(1,'bgra8unorm',false);f.frame();assert.equal(f.textures.length,0);assert.equal(f.passes.length,0);
 f.settings.bloomEnabled=true;f.frame();f.settings.bloomEnabled=false;f.frame();await Promise.resolve();assert.equal(f.passes.length,1);assert.equal(f.retirements,1);assert.equal(f.textures[0].destroyed,true);f.adapter.dispose();
});
test('Resizing retires the old target asynchronously and sRGB keeps separate render/sample views',async()=>{
 const f=await fixture(4,'bgra8unorm-srgb');f.frame();assert.equal(f.textures[0].format,'bgra8unorm');assert.deepEqual(Array.from(f.textures[0].viewFormats),['bgra8unorm-srgb']);
 f.task._config.rt._width=1280;f.frame();await Promise.resolve();assert.equal(f.textures.length,2);assert.equal(f.textures[0].destroyed,true);assert.equal(f.retirements,1);f.adapter.dispose();
});
test('A native scene exception restores both attachment references and disposal restores the owner',async()=>{
 const f=await fixture(4);f.fail();assert.throws(()=>f.frame(),/Native scene failed/);assert.equal(f.task._colorAttachment.view,f.target);assert.equal(f.task._colorAttachment.resolveTarget,f.resolve);assert.equal(f.passes.length,0);
 f.events.push('submit');f.adapter.dispose();assert.equal(f.task._executeWithTransmission,f.original);assert(f.buffers.every(b=>b.destroyed));
});
