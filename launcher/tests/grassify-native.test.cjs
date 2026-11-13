'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {installGrassGpu}=require('../grassify-gpu.cjs');
const payload=require('../assets/native-grass.json');
function fixture(){
 const buffers=[],writes=[];const device={createBuffer(d){const b={...d,data:new Uint8Array(d.size),destroy(){b.destroyed=true;}};buffers.push(b);return b;},createBindGroupLayout:d=>d,createBindGroup:d=>d,
  queue:{writeBuffer(b,at,data){b.data.set(new Uint8Array(data),at);writes.push(b);}}};
 const base={key:'standard',kind:'standard',program:{attributes:[{name:'position',type:'vec3f'}],vertex:'struct VertexInputs {@location(0) position:vec3f,}\nvar<private> vertexInputs:VertexInputs;\nfn main(){var finalWorld=mat4x4f();var positionUpdated=vertexInputs.position;var worldPos:vec4f=finalWorld*vec4f(positionUpdated,1.0);}',fragment:''}};
 const native={gpuDevice:device,Ln:{},drawFrame(){},meshes:{view:{eye:[0,2,0]},programs:new Map(),prepare(){},programWithModel(){return base;},createProgram(key,program,kind,pack){const p={key,program,kind,packGroup:pack.group};this.programs.set(key,p);return p;}}};
 const context=vm.createContext({ArrayBuffer,Float32Array,Uint32Array,Uint8Array,GPUBufferUsage:{UNIFORM:1,COPY_DST:2},GPUShaderStage:{VERTEX:1},payload,native});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../builtin-mods/grassify-native.js'),'utf8')+';installNativeGrass(globalThis,payload);globalThis.adapter=__BVFX_ATTACH_NATIVE_GRASS__(native);',context);
 vm.runInContext('globalThis.installGrassGpu='+installGrassGpu.toString(),context);
 const material={model:{name:'Grassify'}},errors=[];context.material=material;context.onError=e=>errors.push(e);
 const gpu=vm.runInContext('installGrassGpu(material,onError)',context);
 return {context,native,material,gpu,buffers,writes,errors,base,tick(now,actors=[],origin=[0,0,0]){native.drawFrame({av:{Wt:origin}});gpu.frame({phase:now/1000,wind:30,now,actors});native.meshes.prepare({},native.meshes.view);},dispose(){gpu.dispose();context.adapter.dispose();}};
}
test('Native Grassify retains one buffer and the same GPU program across material recreation',()=>{
 const f=fixture();const p=f.native.meshes.programWithModel(f.material.model);assert.equal(p.program.attributes.length,3);assert.match(p.program.vertex,/grass_bvfxGrassMove/);assert.match(p.program.vertex,/@location\(1\) grassRoot/);
 for(let i=0;i<120;i++)f.tick(i*16);assert.equal(f.buffers.length,1);assert.equal(f.native.meshes.programWithModel(f.material.model),p);assert.equal(f.errors.length,0);
 f.gpu.dispose();f.context.material={model:{name:'Grassify'}};const next=vm.runInContext('installGrassGpu(material,onError)',f.context);assert.equal(f.native.meshes.programWithModel(f.context.material.model),p);assert.equal(f.buffers.length,1);next.dispose();f.context.adapter.dispose();assert(f.buffers[0].destroyed);
});
test('Contact bins contain nearby actors and preserve the native world rebase',()=>{
 const f=fixture(),actor={id:1,position:[1001,1,-499],height:1.8,width:.7},origin=[1000,0,-500];
 f.tick(0,[actor],origin);f.tick(16,[actor],origin);const data=f.buffers[0].data,view=new DataView(data.buffer);
 assert.equal(view.getFloat32(8*4,true),1);assert.equal(view.getFloat32(12*4,true),1);assert.equal(view.getFloat32(14*4,true),1);
 const bins=new Uint32Array(data.buffer,(48+32*16*3));assert(bins.some(x=>x===1));assert(bins.filter(x=>x!==0).length<=4);
 assert.deepEqual(Array.from(f.context.__BVFX_NATIVE_GRASS_CAMERA__(f.native.Ln)),[1000,2,-500]);f.dispose();
});
test('Contact removal empties the bins and disabled grass does no recurring GPU uploads',()=>{
 const f=fixture(),actor={id:1,position:[0,0,0],height:1.8,width:.7};f.tick(0,[actor]);f.tick(16,[actor]);
 for(let i=1;i<=12;i++)f.tick(16+i*100,[]);const data=f.buffers[0].data;
 assert.equal(new DataView(data.buffer).getFloat32(8*4,true),0);assert(new Uint32Array(data.buffer,(48+32*16*3)).every(x=>x===0));
 f.gpu.dispose();const count=f.writes.length;for(let i=0;i<60;i++)f.native.meshes.prepare({},f.native.meshes.view);assert.equal(f.writes.length,count);f.context.adapter.dispose();
});
test('Unknown positions never upload non-finite contact data',()=>{
 const f=fixture();f.tick(0,[]);f.native.meshes.view.eye=[NaN,0,0];const before=f.writes.length;f.native.meshes.prepare({},f.native.meshes.view);assert.equal(f.writes.length,before);f.dispose();
});
test('Native adapter disposal restores the prior renderer and camera owners',()=>{
 const f=fixture();f.native.meshes.programWithModel(f.material.model);f.dispose();f.context.adapter.dispose();assert.equal(f.context.__BVFX_NATIVE_GRASS_FACTORY__,undefined);assert.equal(f.context.__BVFX_NATIVE_GRASS_CAMERA__,undefined);assert.equal(f.native.meshes.programWithModel(f.material.model),f.base);
});
test('Grass camera follows the actual Noa scene rather than the separate frame-graph scene',()=>{
 const f=fixture(),mirror={};f.native.drawFrame({av:{Wt:[32,0,-16]}},mirror);assert.deepEqual(Array.from(f.context.__BVFX_NATIVE_GRASS_CAMERA__(mirror)),[32,2,-16]);assert.equal(f.context.__BVFX_NATIVE_GRASS_CAMERA__(f.native.Ln),null);f.dispose();
});
