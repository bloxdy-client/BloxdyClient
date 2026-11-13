'use strict';
// Byte arrays and command records only. No GPU, canvas, browser or client.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const payload=require('../assets/native-effects.json');
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
async function fixture(fail=false){
 const allocations=[],commands=[],writes=[];let now=0,submits=0;
 const device={createTexture(d){const t={...d,createView(){return {texture:t};},destroy(){t.destroyed=true;}};allocations.push(t);return t;},
  createBuffer(d){const b={...d,bytes:new Uint8Array(d.size),destroy(){b.destroyed=true;}};allocations.push(b);return b;},
  createSampler:d=>d,createBindGroupLayout:d=>d,createBindGroup:d=>d,createPipelineLayout:d=>d,createShaderModule:d=>d,
  async createRenderPipelineAsync(d){if(fail)throw Error('Pipeline rejected');return d;},
  createCommandEncoder(){return {beginRenderPass(d){const command={label:d.label,targets:d.colorAttachments.map(a=>a.view.texture)};commands.push(command);return {
   setPipeline(p){command.pipeline=p;},setBindGroup(_n,g){for(const e of g.entries)if(e.resource?.texture)assert(!command.targets.includes(e.resource.texture),'a render target must never be sampled in its own pass');command.group=g;},draw(n){command.vertices=n;},end(){}};},finish:()=>({})};},
  queue:{writeTexture(){},writeBuffer(b,at,data){b.bytes.set(new Uint8Array(data),at);writes.push({buffer:b,bytes:Array.from(b.bytes)});},submit(){submits++;}}};
 const context=vm.createContext({performance:{now:()=>now},console,DataView,ArrayBuffer,Float32Array,Uint8Array,
  GPUTextureUsage:{TEXTURE_BINDING:1,COPY_DST:2,RENDER_ATTACHMENT:4},GPUBufferUsage:{UNIFORM:1,COPY_DST:2},GPUShaderStage:{VERTEX:1,FRAGMENT:2}});
 vm.runInContext('window=globalThis;',context);
 const cloud=fs.readFileSync(path.join(__dirname,'../builtin-mods/shader-clouds.js'),'utf8').replace('/* BVFX_CLOUD_DATA */null',JSON.stringify(fs.readFileSync(path.join(__dirname,'../assets/cloud-volume.bin')).toString('base64')));
 vm.runInContext(cloud+'\n'+fs.readFileSync(path.join(__dirname,'../builtin-mods/shader-atmosphere.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../builtin-mods/shader-native-effects.js'),'utf8'),context);
 context.payload=payload;vm.runInContext('installNativeEffects(globalThis,payload);',context);
 const settings={enabled:true,atmosphereEnabled:true,skyStyle:'clear',skyBrightness:.65,sunAzimuth:135,sunElevation:35,sunBrightness:.62,sunGlow:.28,sunWarmth:.08,sunLensFlare:true,
  cloudType:'current',cloudCover:.28,cloudScale:1,cloudHeight:120,cloudSpeed:0,cloudShadow:.38,skyHaze:.18,fogDensity:.16,starBrightness:0,rainbowStrength:0};
 const atmosphere=context.__BVFX_CREATE_ATMOSPHERE__(settings),native={gpuDevice:device,meshes:{view:{viewMatrix:identity(),projectionMatrix:identity(),eye:[0,1,0],renderWidth:1920,renderHeight:1080},programs:new Map(),
  lists:{skyDraws:[]},prepare(_scene,view,physical){this.view=view;if(physical)this.pushEarthSky(physical);this.lists.skyDraws.push(...this.nextSkyDraws||[]);},
  createProgram(key,code,kind,pack){const p={key,program:code,kind,packGroup:pack?.group};this.programs.set(key,p);return p;},pushEarthSky(physical){this.lastPhysical=physical;}},drawFrame(){}};
 let adapter;try{adapter=await context.__BVFX_CREATE_NATIVE_EFFECTS__(native,settings,atmosphere);}catch(error){return {error,allocations};}
 const physical={luminance:1,turbidity:10,rayleigh:2,mieCoefficient:.005,mieDirectionalG:.8,up:[0,1,0]};
 return {adapter,native,settings,physical,allocations,commands,writes,get submits(){return submits;},tick(ms=0){now+=ms;native.meshes.pushEarthSky(physical);}};
}
test('Native effects use the original kernels, including separate cloud presets and space objects',()=>{
 const c=vm.createContext({performance:{now:()=>0}});vm.runInContext('window=globalThis;',c);
 for(const f of ['shader-clouds.js','shader-atmosphere.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../builtin-mods',f),'utf8'),c);
 const atmo=c.__BVFX_CREATE_ATMOSPHERE__({}),cloud=atmo.cloudRenderer;
 const sky='#version 450\nlayout(location=0) in vec3 skyRay; layout(location=0) out vec4 colour;\n'+atmo.common+'\nvoid main(){colour=vec4(bvfxSkyColour(skyRay),1.0);}';
 for(const [key,source]of Object.entries({sky,clouds:cloud.fragment,shafts:cloud.shafts,ground:cloud.ground,atmosphere:cloud.atmosphere}))assert.equal(payload.modules[key].sourceSha256,crypto.createHash('sha256').update(source).digest('hex'),key+' must be rebuilt after source changes');
});

test('Custom world skies keep the selected shader sky and restore original sky draws when Off',async()=>{
 const f=await fixture(),m=f.native.meshes,original={name:'skyBox'},stars={name:'dayNightStars'},other={name:'worldMarker'};m.nextSkyDraws=[original,stars,other].map(owner=>({unit:{owner}}));
 m.prepare({},m.view,null);assert(m.lastPhysical);assert.deepEqual(Array.from(m.lists.skyDraws,d=>d.unit.owner),[other]);assert.equal(f.adapter.diagnostics().frame,1);
 m.lists.skyDraws.length=0;f.settings.atmosphereEnabled=false;m.lastPhysical=null;m.prepare({},m.view,null);assert.equal(m.lastPhysical,null);assert.deepEqual(Array.from(m.lists.skyDraws,d=>d.unit.owner),[original,stars,other]);f.adapter.dispose();
});
test('Cloud passes never sample their own targets and reuse completed caches without allocations',async()=>{
 const f=await fixture();assert.ifError(f.error);f.tick();assert.equal(f.commands.length,4);assert.deepEqual(f.commands.map(x=>x.targets.length),[1,1,1,2]);
 const allocations=f.allocations.length,submits=f.submits;for(let i=0;i<120;i++)f.tick();
 assert.equal(f.commands.length,4);assert.equal(f.allocations.length,allocations);assert.equal(f.submits,submits);assert.equal(f.adapter.diagnostics().cloudReuses,120);f.adapter.dispose();
});
test('World and sky presentation keep native pixels while only the existing cloud targets are bounded',async()=>{
 const f=await fixture();f.tick();const textures=f.allocations.filter(x=>x.dimension);
 assert(textures.some(x=>x.size[0]===960&&x.size[1]===540));assert.equal(f.native.meshes.view.renderWidth,1920);assert.equal(f.native.meshes.view.renderHeight,1080);
 assert.equal(f.adapter.diagnostics().presentationScale,1);f.adapter.dispose();
});
test('Resizing replaces retained texture groups before the native sky draws again',async()=>{
 const f=await fixture();f.tick();const p=f.native.meshes.createProgram('sky',{fragment:'\treturn colour;',vertex:''},'earthSky');
 assert.match(p.program.fragment,/sky_bvfxEvaluate/);assert.match(p.program.fragment,/\.sky_colour/);const old=p.packGroup;
 f.native.meshes.view.renderWidth=1280;f.native.meshes.view.renderHeight=720;f.tick();assert.notEqual(p.packGroup,old);
 for(const e of p.packGroup.entries)assert(!e.resource?.texture?.destroyed);f.adapter.dispose();
});
test('Disabling effects stops cache work, and re-enabling restores it without native resolution changes',async()=>{
 const f=await fixture();f.tick();f.settings.atmosphereEnabled=false;f.settings.cloudSpeed=1;f.tick(100);assert.equal(f.commands.length,4);
 f.settings.atmosphereEnabled=true;f.tick(100);assert(f.commands.length>4);assert.equal(f.native.meshes.view.renderWidth,1920);f.adapter.dispose();
});
test('Failed startup and normal disposal release all owned GPU resources',async()=>{
 const failed=await fixture(true);assert.match(failed.error.message,/Pipeline rejected/);assert(failed.allocations.every(x=>x.destroyed));
 const f=await fixture();f.tick();f.adapter.dispose();f.adapter.dispose();assert(f.allocations.every(x=>x.destroyed));
});

test('Native scattering keeps the existing haze, brightness and glow controls without changing the game sky',async()=>{
 const f=await fixture(),before={...f.physical};f.tick();const read=()=>Array.from(f.adapter.values.get('nativeParams'));
 assert(Math.abs(read()[0]-(.25+1.5*f.settings.skyBrightness))<1e-6);assert(Math.abs(read()[1]-(1+14*f.settings.skyHaze+5*f.settings.sunWarmth))<1e-6);
 assert.deepEqual(f.physical,before);const first=f.commands.length;f.settings.skyHaze=.8;f.tick();assert(f.commands.length>first);assert(Math.abs(read()[2]-.9)<1e-6);assert.deepEqual(f.physical,before);
 f.settings.skyStyle='moonlit';f.tick();assert.equal(f.adapter.values.get('uBvfxAtmoNativeReady')[0],0);assert.deepEqual(f.physical,before);
 const count=f.commands.length;f.settings.skyStyle='milkyway';f.tick();assert.equal(f.commands.length,count);assert.deepEqual(f.physical,before);f.settings.atmosphereEnabled=false;f.tick();assert.deepEqual(f.physical,before);f.adapter.dispose();
});
