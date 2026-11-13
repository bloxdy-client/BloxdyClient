'use strict';
// Renderer resources are byte-array models only. No real device or context.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {shadowOptions,nativeShadowSource,patchShadowParameters,attachNativeShadowControls}=require('../shader-native-shadows.cjs');
globalThis.GPUBufferUsage={STORAGE:1,COPY_DST:2};globalThis.GPUTextureUsage={TEXTURE_BINDING:1,COPY_DST:2};
function fixture(){
 const allocations=[],writes=[],counts={world:0,volume:0,entities:0},settings={enabled:true,blockShadows:true,entityShadows:true,sunStrength:.75,shadowDistance:128};
 const device={createBuffer(options){const b={...options,bytes:new Uint8Array(options.size),destroy(){this.destroyed=true;}};allocations.push(b);return b;},
  createTexture(options){const t={...options,createView:()=>({texture:t}),destroy(){this.destroyed=true;}};allocations.push(t);return t;},
  queue:{writeBuffer(b,offset,data,from=0,size=data.byteLength-from){b.bytes.set(new Uint8Array(data.buffer||data,(data.byteOffset||0)+from,size),offset);writes.push({buffer:b,offset,size});},writeTexture(){}}};
 const window={records:new Int32Array([0,0,0,3]),slotChunk:[{}],slotVersion:new Float64Array([2]),eyeChunk:[0,0,0],queued:[],
  update(){counts.world++;},writeVoxels(at,data){this.written=Array.from(data);},writeWindowTop(){this.top=this.records.some(x=>x!==0)?32:1;},enqueue(i){this.queued.push(i);}};
 const shadow={entities:{frameBuffer:device.createBuffer({size:589828}),gridBuffer:device.createBuffer({size:16})},volumeView:{native:true},
  entries(){return [{binding:6,resource:this.volumeView},{binding:8,resource:{buffer:this.entities.frameBuffer}},{binding:9,resource:{buffer:this.entities.gridBuffer}}];},
  start:()=>window,prepare(world,eye,provider){if(!provider.sunShadowReach().sunShadow)return;this.start().update(eye);this.computeVolume();},
  computeVolume(){counts.volume++;},traceEntities(){counts.entities++;}};
 const input=()=>({data:new ArrayBuffer(80),buffer:device.createBuffer({size:80}),groups:new Map(),write(){device.queue.writeBuffer(this.buffer,0,this.data);},bindGroupFor(){const group={entries:shadow.entries()};this.groups.set(2,group);return group;}});
 const terrainInput=input(),meshInput=input(),provider={options:{variants:[]},sunShadowReach:()=>({sunShadow:true,airShadow:false})},outer={av:{DE:provider}};
 const terrain={shaderPackInputs:terrainInput,shaderModule:s=>s,writeShaderPackInputs(){terrainInput.write();},bindShaderPackInputs(){return terrainInput.bindGroupFor(null,true);}};
 const meshes={packInputs:meshInput,programs:new Map([['model',{packGroup:{old:true}}]]),createProgram:(key,p)=>p,prepare(){meshInput.write();}};
 const native={gpuDevice:device,sunShadow:shadow,terrain,meshes,drawFrame(outer){shadow.prepare(null,[1,2,3],outer.av.DE);terrain.writeShaderPackInputs();meshes.prepare();shadow.traceEntities();}};
 const original={draw:native.drawFrame,entries:shadow.entries,update:window.update,write:terrainInput.write};
 const adapter=attachNativeShadowControls(native,()=>shadowOptions(settings),patchShadowParameters);
 return {adapter,native,settings,allocations,writes,counts,window,shadow,terrainInput,meshInput,meshes,provider,outer,original,frame(){native.drawFrame(outer);}};
}
test('Native controls keep the renderer-owned shadow path and upload slider values with native uniforms',()=>{
 const f=fixture();f.frame();const first=f.allocations.length;
 for(let i=0;i<120;i++){f.settings.sunStrength=i/120;f.settings.shadowDistance=16+i;f.frame();}
 assert.equal(f.allocations.length,first,'no recurring resource allocation');
 assert.equal(f.adapter.diagnostics().extraRenderPasses,0);assert.equal(f.adapter.diagnostics().ownCasterBaker,false);
 assert.equal(new DataView(f.terrainInput.buffer.bytes.buffer).getFloat32(8,true),Math.fround(119/120));
 assert.equal(new DataView(f.meshInput.buffer.bytes.buffer).getFloat32(12,true),135);
 assert(f.writes.filter(x=>x.offset===8).length<=2,'only initial discovery needs a separate upload');f.adapter.dispose();
});
test('Block switch clears only shadow records, disables stale volume and restores the native rebuild budget',()=>{
 const f=fixture();f.frame();f.settings.blockShadows=false;f.frame();
 assert.equal(f.counts.world,1);assert.equal(f.counts.volume,1);assert.equal(f.counts.entities,2);assert.deepEqual(f.window.written,[0,0,0,0]);assert.equal(f.window.top,1);
 const off=f.shadow.entries();assert.notEqual(off[0].resource,f.shadow.volumeView);assert.equal(off[1].resource.buffer,f.shadow.entities.frameBuffer);
 const allocations=f.allocations.length;f.frame();assert.equal(f.allocations.length,allocations);
 f.settings.blockShadows=true;f.frame();assert.equal(f.counts.world,2);assert.equal(f.window.eyeChunk,null);assert.equal(f.window.slotVersion[0],-1);assert.deepEqual(f.window.queued,[0]);f.adapter.dispose();
});
test('Entity switch uses an in-bounds empty frame without stopping block shadows or reusing stale model groups',()=>{
 const f=fixture();f.frame();const old=f.meshes.programs.get('model').packGroup;
 f.settings.entityShadows=false;f.frame();const entries=f.shadow.entries(),record=f.meshes.programs.get('model');
 assert.equal(f.counts.entities,1);assert.equal(f.counts.world,2);assert.equal(entries[0].resource,f.shadow.volumeView);
 assert.notEqual(entries[1].resource.buffer,f.shadow.entities.frameBuffer);assert.equal(entries[1].resource.buffer.size,589828);
 assert.equal(entries[2].resource.buffer,f.shadow.entities.gridBuffer);assert.notEqual(record.packGroup,old);
 assert.equal(record.packGroup.entries[1].resource.buffer,entries[1].resource.buffer);f.adapter.dispose();
});
test('Both caster switches, strength zero and master off stop native shadow preparation',()=>{
 for(const settings of [{blockShadows:false,entityShadows:false},{sunStrength:0},{enabled:false}]){
  const f=fixture();f.frame();Object.assign(f.settings,settings);f.frame();assert.equal(f.counts.world,1);assert.equal(f.counts.volume,1);
  assert.equal(new DataView(f.terrainInput.data).getFloat32(8,true),0);f.adapter.dispose();
 }
});
test('Disposal restores every extension point and releases only our neutral resources',()=>{
 const f=fixture();f.settings.entityShadows=false;f.frame();const own=f.allocations.slice(4);f.adapter.dispose();f.adapter.dispose();
 assert.equal(f.native.drawFrame,f.original.draw);assert.equal(f.shadow.entries,f.original.entries);assert.equal(f.window.update,f.original.update);assert.equal(f.terrainInput.write,f.original.write);
 assert.equal(f.shadow.entities.frameBuffer.destroyed,undefined);assert(own.every(x=>x.destroyed));assert.equal(f.provider.__bvfxShadowReach,undefined);
});
test('Generated shader parameters preserve native input offsets and reject incompatible layouts',()=>{
 const header='struct BloxdPackInputs {seconds:f32,lit:u32,renderOffset:vec3i,sunDirection:vec3f,eyePosition:vec3f,shadowDirection:vec3f,}';
 const source=header+'\n'+nativeShadowSource().replaceAll('bvfx','pack_bvfx');const patched=patchShadowParameters(source);
 assert.match(patched,/lit:u32,\s*bvfxStrength: f32,\s*bvfxDistance: f32,\s*renderOffset/);assert.equal(patchShadowParameters(patched),patched);
 assert.throws(()=>patchShadowParameters(source.replace('lit:u32','lit:f32')),/contract changed/);assert.equal(patchShadowParameters('native sky'),'native sky');
});
test('Bridge triggers native lazy compiler loading before compiling our ephemeral shader',async()=>{
 const callbacks=[],created=[],calls=[],root={__BLOXD_MOD_HOST__:{observeDefinitions(id,fn){callbacks.push(fn);return()=>calls.push('unobserve');}},addEventListener(){}};
 const attach=(native,options)=>{created.push(options());return {dispose(){},diagnostics:()=>({})};};
 const compiler={Fno(files){calls.push('compile');assert.match(files[0].source,/bloxdModelLight/);return {errors:[],variants:Array.from({length:6},()=>({sunShadow:true,moduleCode:'pack_bvfxShadowStrength pack_bvfxShadowDistance'}))};}};
 const context=vm.createContext({root,helpers:{source:nativeShadowSource,options:shadowOptions,patch:patchShadowParameters,attach},queueMicrotask,console});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../builtin-mods/shader-native.js'),'utf8')+';installNativeShaderBridge(root,helpers);',context);
 const emit=(key,value)=>callbacks[0]({},key,{get:()=>value});
 class Page{load(){throw Error('Must not read saved packs');}async loadActive(){const r=await this.load();return r.status==='active'?r.pack:null;}async compiler(){calls.push('load-lazy');emit('loadPageShaderPackCompiler',async()=>compiler);emit('loadShaderPackTextures',async()=>calls.push('textures'));emit('shaderPackTextures',()=>({}));emit('validator',async function(){const validationModules=true,getCompilationInfo=true,requestDevice=true;return {ok:validationModules&&getCompilationInfo&&requestDevice};});}}
 emit('ShaderPackPage',Page);await new Promise(setImmediate);const page=new Page(),pack=await page.loadActive();assert.equal(pack.name,'Bloxdy Client shaders');assert(calls.indexOf('load-lazy')<calls.indexOf('compile'));assert.equal(page.resolved.status,'active');
 await page.loadActive();assert.equal(calls.filter(x=>x==='compile').length,1);root.__BVFX_NATIVE_SHADOWS__.dispose();assert(calls.includes('unobserve'));
});
