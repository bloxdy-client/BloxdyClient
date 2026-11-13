'use strict';
// Command/byte models only; never requests a graphics device or context.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {nativeShadowSource}=require('../shader-native-shadows.cjs');
const {nativeWorldSource,patchNativeWorldSource,worldParameterFields,worldUniformBytes}=require('../shader-native-world.cjs');
function fixture(fail=false,extra={}){
 const calls=[],allocations=[],writes=[];
 const device={queue:{writeBuffer(buffer,offset,bytes){buffer.bytes.set(new Uint8Array(bytes.buffer||bytes,bytes.byteOffset||0,bytes.byteLength),offset);writes.push(buffer);}},
  createBuffer(d){const b={...d,bytes:new Uint8Array(d.size),destroy(){this.destroyed=true;}};allocations.push(b);return b;},
  createSampler:d=>d,createBindGroupLayout(d){return d;},createBindGroup(d){return d;},createPipelineLayout(d){calls.push(d);return d;}};
 const parameters=nativeWorldSource(nativeShadowSource()).replaceAll('bvfx','pack_bvfx');
 function makeInput(d){const layout=d.createBindGroupLayout({label:'shader-pack-inputs-shadow',entries:[{binding:0,buffer:{}},{binding:2,buffer:{}},{binding:3,buffer:{}}]});
  const groups=new Map();return {device:d,groups,bindGroupFor(depth,shadow,mask){const key=String(depth)+shadow+mask;let g=groups.get(key);if(!g){g=d.createBindGroup({layout,entries:[{binding:0,resource:{original:true}},{binding:2,resource:{original:true}},{binding:3,resource:{shadow:true}}]});groups.set(key,g);}return g;},bind(pass,depth,shadow,mask){pass.setBindGroup(3,this.bindGroupFor(depth,shadow,mask));},layout};}
 const terrain={device,prepare(_outer,view){calls.push({fog:JSON.parse(JSON.stringify(view))});},shaderModule:code=>code,writeShaderPackInputs(){this.shaderPackInputs??=makeInput(this.device);},bindShaderPackInputs(pass,depth=null,shadow=true,mask=null){this.writeShaderPackInputs();this.shaderPackInputs.bind(pass,depth,shadow,mask);}};
 const meshes={device,programs:new Map(),pushEarthSky(){},prepare(){this.packInputs??=makeInput(this.device);this.pushEarthSky();this.recordBundles?.();},createProgram(key,code,kind,pack){const p={key,code,program:code,kind,packGroup:pack.group,layout:this.device.createPipelineLayout({bindGroupLayouts:[{}, {}, {},pack.layout]})};this.programs.set(key,p);return p;}};
 meshes.meshSlots={data:new Float32Array(256)};meshes.lists={skyDraws:[],opaqueDraws:[],transparentDraws:[],frontDraws:[]};meshes.uploadMeshSlots=()=>{};
 meshes.thinBundle={main:{stale:false},gto:{stale:false},slots:{data:new Float32Array(256)},slotsFrom:Infinity,slotsTo:-1,place(){}};
 const view={fogEnabled:true,fogMode:1,fogStart:3,fogEnd:600,fogDensity:.02,fogColour:[.2,.3,.5]};
 const native={gpuDevice:device,terrain,meshes,drawFrame(){terrain.prepare({},view);if(fail)throw Error('Native frame failure');terrain.writeShaderPackInputs();meshes.prepare();}},settings={enabled:true,bloxdLightingDarkness:.3};
 let equipment=null,metadata={};const environment={worldFrame:()=>({equipment,...metadata}),...extra};
 const root={},context=vm.createContext({root,Float32Array,Uint32Array,ArrayBuffer,WeakMap,WeakSet,Proxy,GPUBufferUsage:{UNIFORM:1,COPY_DST:2},GPUShaderStage:{VERTEX:1,FRAGMENT:2}});
 vm.runInContext(fs.readFileSync(require.resolve('../builtin-mods/shader-native-world.js'),'utf8'),context);
 context.installNativeWorld(root,{uniformBytes:worldUniformBytes,fields:worldParameterFields,patch:patchNativeWorldSource,fog:require('../shader-native-fog.cjs').nativeFogFrame});
 const ground={view:{ground:true},active:0};const before={draw:native.drawFrame,shader:terrain.shaderModule,create:meshes.createProgram};const adapter=root.__BVFX_ATTACH_NATIVE_WORLD__(native,settings,environment,{groundState:()=>({...ground})});
 return {native,device,adapter,settings,parameters,calls,allocations,writes,before,ground,context,root,view,setEquipment:v=>equipment=v,setMetadata:v=>metadata=v};
}
test('Native world uploads bounded parameters only when values change and keeps shadow buffers untouched',()=>{
 const f=fixture();f.native.drawFrame();const uploads=f.writes.length,allocated=f.allocations.length;
 for(let i=0;i<120;i++)f.native.drawFrame();assert.equal(f.writes.length,uploads);assert.equal(f.allocations.length,allocated);
 f.setEquipment({held:[.2,.4,.8,12],armour:[.7,.3,.1,8],position:[100,20,-30]});f.native.drawFrame();assert.equal(f.writes.length,uploads+1);
 const values=new Float32Array(f.allocations[0].bytes.buffer);assert.equal(values[7],12);assert.equal(values[12],100);
 f.settings.enabled=false;f.setEquipment(null);f.native.drawFrame();assert.equal(values[0],0);assert.equal(values[7],0);assert.equal(f.adapter.diagnostics().extraRenderPasses,0);f.adapter.dispose();
});

test('Retained bundles receive a resized ground view inside sky preparation before native recording',()=>{
 const f=fixture();f.native.drawFrame();const m=f.native.meshes,input=m.packInputs,p=m.createProgram('entity',{vertex:f.parameters,fragment:f.parameters},'standard-sp',{layout:input.layout,group:input.bindGroupFor(null,true,null)});
 const expected={resized:true};f.ground.view=expected;
 m.recordBundles=function(){assert.equal(p.packGroup.entries.find(e=>e.binding===13).resource,expected);assert.equal(this.thinBundle.main.stale,true);};
 f.native.drawFrame();f.adapter.dispose();
});

test('Native atmosphere light overrides preserve point lights and restore original directional arrays',()=>{
 const f=fixture(false,{atmosphere:{palette:()=>({sky:[.4,.6,.8]})}}),lights=new Float64Array(88);lights.set([1,0,-1,0,.8,.6,.4,.2,.3,.4,100]);lights.set([0,2,3,4,.3,.4,.5,.6,.7,.8,16],11);
 f.view.lights=lights;f.view.lightCount=2;Object.assign(f.settings,{atmosphereEnabled:true,skyStyle:'clear',sunBrightness:.5,sunWarmth:.4,fogDensity:0,fogDistance:100,fogWarmth:0,fogColorMix:0});
 const original=Array.from(lights);f.native.drawFrame();let drawn=f.calls.findLast(c=>c.fog).fog;assert.equal(drawn.fogEnabled,false);assert.deepEqual(Array.from({length:11},(_,i)=>drawn.lights[11+i]),original.slice(11,22));assert.equal(drawn.lights[4],.8);assert(Math.abs(drawn.lights[5]-.54)<1e-12);assert.equal(f.view.lights,lights);assert.deepEqual(Array.from(lights),original);
 f.settings.skyStyle='moonlit';f.native.drawFrame();drawn=f.calls.findLast(c=>c.fog).fog;assert(Math.abs(drawn.lights[4]-.8*.12*.46)<1e-12);assert.deepEqual(Array.from(lights),original);f.adapter.dispose();
});
test('The first lazy terrain draw extends world bindings while the original mask group stays original',()=>{
 const f=fixture(),bound=[];f.native.terrain.bindShaderPackInputs({setBindGroup:(...args)=>bound.push(args)});
 const base=f.native.terrain.shaderPackInputs.bindGroupFor(null,true,null),world=bound[0][1];
 assert.equal(base.entries.length,3);assert.equal(world.entries.length,7);assert.equal(world.entries[3].binding,11);assert.equal(world.entries[4].binding,12);
 assert.equal(world.entries[0],base.entries[0]);assert.equal(world.entries[2],base.entries[2]);
 const native=f.native.terrain.device.createPipelineLayout({bindGroupLayouts:[{}, {}, {},base.layout]});assert.equal(native.bindGroupLayouts[3],world.layout);
 f.native.terrain.bindShaderPackInputs({setBindGroup:(_n,g)=>assert.equal(g,world)});assert.equal(base.entries.length,3);f.adapter.dispose();
});
test('Model parameter groups share the world layout and refresh after native shadow invalidation',()=>{
 const f=fixture();f.native.drawFrame();const input=f.native.meshes.packInputs,base=input.bindGroupFor(null,true,null),code={vertex:f.parameters,fragment:f.parameters};
 const p=f.native.meshes.createProgram('entity',code,'standard-sp',{layout:input.layout,group:base});
 assert.match(p.code.fragment,/var<uniform> bvfxWorld/);assert.equal(p.layout.bindGroupLayouts[3],p.packGroup.layout);
 const previous=p.packGroup;input.groups.clear();p.packGroup=p.refreshPackGroup();assert.notEqual(p.packGroup,previous);assert.equal(p.packGroup.entries.length,7);
 const sky={vertex:'native sky',fragment:'native sky'};const s=f.native.meshes.createProgram('sky',sky,'earthSky',{layout:{},group:{}});assert.equal(s.code,sky);f.adapter.dispose();
});
test('Disposal restores instance devices and hooks without changing the GPU prototype',()=>{
 const f=fixture();f.native.drawFrame();f.adapter.dispose();f.adapter.dispose();assert.equal(f.native.terrain.device,f.device);assert.equal(f.native.meshes.device,f.device);
 assert.equal(f.native.drawFrame,f.before.draw);assert.equal(f.native.terrain.shaderModule,f.before.shader);assert.equal(f.native.meshes.createProgram,f.before.create);assert(f.allocations.every(x=>x.destroyed));
});
test('World shader patching is idempotent and retains all native shadow early-return paths',()=>{
 const source=nativeWorldSource(nativeShadowSource());assert.equal((source.match(/return bvfxDefaultWorldLight/g)||[]).length,3);
 const patched=patchNativeWorldSource(source.replaceAll('bvfx','pack_bvfx'));assert.equal(patchNativeWorldSource(patched),patched);assert.match(patched,/@binding\(11\)/);
 assert.throws(()=>patchNativeWorldSource(source.replaceAll('bvfx','pack_bvfx').replace('fn pack_bvfxWorld_held','fn broken_held')),/contract changed/);
 assert.equal(patchNativeWorldSource('original mask'),'original mask');
});
test('Leaf identification and ore emission share the existing metadata and update only on its revision',()=>{
 const f=fixture(),leaves=new Uint8Array(16);leaves[2*4]=255;
 const sample={surfaces:{revision:1,bytes:leaves,motion:[.06,2,1,0]},ores:{revision:2,count:1,indices:[3],colours:[.2,.6,1]},oreStrength:1.5};f.setMetadata(sample);f.native.drawFrame();
 const metadata=f.allocations.find(x=>x.label==='Bloxdy surface metadata'),values=new Float32Array(metadata.bytes.buffer);
 assert.equal(values[2*4+3],1);assert.equal(values[3*4+3],0);assert.equal(values[3*4+2],1);assert.equal(values[4],0);
 const writes=f.writes.filter(x=>x===metadata).length;for(let i=0;i<60;i++)f.native.drawFrame();assert.equal(f.writes.filter(x=>x===metadata).length,writes);
 sample.ores.revision++;sample.ores.count=0;sample.surfaces.revision++;leaves.fill(0);f.native.drawFrame();assert(values.every(x=>x===0));f.adapter.dispose();
});
test('Native frames advance our existing animation clock once without emitting game scene callbacks',()=>{
 const {shaderRuntime}=require('./shader-runtime-fixture.cjs');let now=0,additions=0;
 const r=shaderRuntime({wavyLeaves:true,leafSpeed:1},{__BVFX_NATIVE_REQUESTED__:true,performance:{now:()=>now}});
 const scene={meshes:[],materials:[],activeCamera:{position:{x:0,y:0,z:0}},
  onBeforeRenderObservable:{add(){additions++;throw Error('The native clock must not also register a scene observer');},remove(){}},onAfterRenderObservable:{add:()=>1,remove(){}}};
 const environment=r.root.__testNativeEnvironment;environment.advanceFrame(scene);assert.equal(additions,0);
 now=100;environment.advanceFrame(scene);const first=environment.worldFrame().surfaces.motion[1];assert.equal(first,.1);
 now=200;environment.advanceFrame(scene);assert.equal(environment.worldFrame().surfaces.motion[1],.2);assert.equal(additions,0);
});

test('Native fog uses original view values each frame and restores them on success, failure and Off',()=>{
 for(const fail of [false,true]){
  const f=fixture(fail,{atmosphere:{palette:()=>({sky:[.4,.6,.8]})}}),original=Object.getOwnPropertyDescriptors(f.view);
  Object.assign(f.settings,{atmosphereEnabled:true,fogDensity:.6,fogDistance:100,fogWarmth:.2,fogColorMix:.3,fogColor:'#804020'});
  for(let frame=0;frame<2;frame++){
   if(fail)assert.throws(()=>f.native.drawFrame(),/frame failure/);else f.native.drawFrame();
   assert.deepEqual(Object.getOwnPropertyDescriptors(f.view),original);
   const drawn=f.calls.findLast(c=>c.fog).fog;assert.equal(drawn.fogMode,3);assert.equal(drawn.fogStart,26.8);assert.equal(drawn.fogEnd,130);
   const expected=((.4*.82+.2*.18)*.8+.9*.2)*.7+(128/255)*.3;assert(Math.abs(drawn.fogColour[0]-expected)<1e-12);
  }
  f.settings.atmosphereEnabled=false;try{f.native.drawFrame();}catch{}assert.deepEqual(f.calls.findLast(c=>c.fog).fog,f.view);f.adapter.dispose();
 }
});

test('Per-draw entity rules distinguish shared materials and refresh retained slot padding only',()=>{
 const f=fixture(false,{entityKind:m=>m?.kind}),m=f.native.meshes,shared={};
 m.meshSlots.data.fill(123);const kinds=['player','mob','item',null];
 for(let i=0;i<4;i++)m.lists.opaqueDraws.push({slotOffset:i*256,unit:{owner:{kind:kinds[i],material:shared}}});
 m.uploadMeshSlots();for(let i=0;i<4;i++){assert.equal(m.meshSlots.data[i*64+17],[1,2,0,0][i]);assert.equal(m.meshSlots.data[i*64+16],123);assert.equal(m.meshSlots.data[i*64+18],123);}
 const retained=m.thinBundle;retained.slots.data.fill(321);retained.place({slot:2},m.lists.opaqueDraws[1]);assert.equal(retained.slots.data[2*64+17],2);assert.equal(retained.slots.data[2*64+16],321);assert.equal(retained.slotsFrom,2);assert.equal(retained.slotsTo,2);
 retained.slotsFrom=Infinity;retained.slotsTo=-1;retained.place({slot:2},m.lists.opaqueDraws[1]);assert.equal(retained.slotsFrom,Infinity);
 f.settings.dynamicPlayersAffected=false;f.settings.dynamicMobsAffected=true;f.native.drawFrame();const at=worldParameterFields.indexOf('entityRules')*4,values=new Float32Array(f.allocations[0].bytes.buffer);assert.deepEqual(Array.from(values.subarray(at,at+2)),[0,1]);
 f.ground.view={replacement:true};f.native.drawFrame();assert.equal(retained.main.stale,true);assert.equal(retained.gto.stale,true);f.adapter.dispose();
});
test('Replacing the shared ground cache refreshes model and terrain groups without copying or rerendering it',()=>{
 const f=fixture();f.native.drawFrame();const input=f.native.meshes.packInputs;
 const p=f.native.meshes.createProgram('entity',{vertex:f.parameters,fragment:f.parameters},'standard-sp',{layout:input.layout,group:input.bindGroupFor(null,true,null)}),old=p.packGroup;
 f.ground.view={resized:true};f.ground.tint=[.8,.9,1];f.ground.active=1;f.ground.frame=[64,128,2048,1];f.ground.sun=[.5,.7,.3];f.ground.clouds=[.5,1,120];f.ground.strength=.4;f.native.drawFrame();
 assert.notEqual(p.packGroup,old);assert.equal(p.packGroup.entries.find(e=>e.binding===13).resource,f.ground.view);
 const bound=[];f.native.terrain.bindShaderPackInputs({setBindGroup:(_n,g)=>bound.push(g)});assert.equal(bound[0].entries.find(e=>e.binding===13).resource,f.ground.view);assert.equal(f.adapter.diagnostics().extraRenderPasses,0);f.adapter.dispose();
});
test('Grassify composes its buffer with native shadows and world effects, including a cache resize',()=>{
 const f=fixture();f.native.drawFrame();const input=f.native.meshes.packInputs;
 const vertex='struct VertexInputs {@location(0) position:vec3f,}\nvar<private> vertexInputs:VertexInputs;\nfn main(){var finalWorld=mat4x4f();var positionUpdated=vertexInputs.position;var worldPos:vec4f=finalWorld*vec4f(positionUpdated,1.0);}\n'+f.parameters;
 const base=f.native.meshes.createProgram('grass',{attributes:[{name:'position',type:'vec3f'}],vertex,fragment:f.parameters},'standard-sp',{layout:input.layout,group:input.bindGroupFor(null,true,null)});
 f.native.meshes.programWithModel=()=>base;vm.runInContext(fs.readFileSync(require.resolve('../builtin-mods/grassify-native.js'),'utf8'),f.context);f.context.installNativeGrass(f.root,require('../assets/native-grass.json'));
 const grass=f.root.__BVFX_ATTACH_NATIVE_GRASS__(f.native),model={},handle=f.root.__BVFX_NATIVE_GRASS_FACTORY__({model},{frame(){},contacts:()=>[],snapshot:()=>({phase:0})},()=>{});
 const p=f.native.meshes.programWithModel(model),bindings=Array.from(p.packGroup.entries,e=>e.binding);
 assert.deepEqual(bindings,[0,2,3,11,12,13,14,16]);assert.equal(new Set(bindings).size,bindings.length);assert.match(p.program.vertex,/@binding\(16\)/);assert.equal(p.bvfxWorld,true);
 f.ground.view={resized:true};f.native.drawFrame();assert.equal(p.packGroup.entries.find(e=>e.binding===13).resource,f.ground.view);assert.equal(p.packGroup.entries.find(e=>e.binding===16).resource.buffer,f.allocations.at(-1));
 const old=p.packGroup;input.groups.clear();p.packGroup=p.refreshPackGroup();assert.notEqual(p.packGroup,old);assert.equal(p.packGroup.entries[2].resource.shadow,true);handle.dispose();grass.dispose();f.adapter.dispose();
});
