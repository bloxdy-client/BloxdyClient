'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {nativeSchematic}=require('./litematica-native-fixture.cjs');
test('The production schematic builder submits its unchanged cached faces in the native world pass',async()=>{
 const h=await nativeSchematic();h.frame();assert.equal(h.renderer.status(),'');assert(h.draws.length>0);assert(h.renderer.diagnostics().quads>0);
 assert.equal(h.currentGroup,h.sceneGroup,'native scene binding restored');assert(h.draws.every(d=>d.pipeline.depthStencil.depthWriteEnabled===false&&d.pipeline.depthStencil.depthCompare==='greater-equal'));
 assert.equal(h.adapter.diagnostics().extraRenderPasses,0);assert.equal(h.adapter.diagnostics().readbacks,0);h.dispose();
});
test('Completed blocks, wrong/extra overlays and placement transparency retain existing behavior',async()=>{
 const h=await nativeSchematic();h.setActual(1);h.frame();assert.equal(h.draws.length,0);
 h.setActual(2);h.frame(50);assert(h.draws.length>0);h.state.showWrong=false;const at=h.draws.length;h.frame(100);assert.equal(h.draws.length,at);
 h.setActual(0);h.state.placementTransparency=1;h.renderer.invalidate();h.frame(150);assert.equal(h.draws.length,at);
 h.state.placementTransparency=0;h.frame(200);assert(h.draws.length>at);h.dispose();
});
test('Selection faces and outlines remain available without schematic blocks',async()=>{
 const h=await nativeSchematic();h.setBlocks([]);h.setBox({min:[0,0,0],max:[0,0,0],size:[1,1,1]});h.frame();assert.equal(h.renderer.status(),'');assert(h.draws.length>=2);assert.equal(h.renderer.diagnostics().selectionBox,true);h.dispose();
});
test('Unchanged schematics reuse vertex buffers and texture groups while world checks keep their cadence',async()=>{
 const h=await nativeSchematic();h.frame();const allocations=h.buffers.length,groups=h.groups.length,reads=h.reads;
 for(let i=1;i<40;i++)h.frame(i);assert.equal(h.buffers.length,allocations);assert.equal(h.groups.length,groups);assert.equal(h.reads,reads);assert.equal(h.adapter.diagnostics().uniformPages,1);h.dispose();
});
test('Disabling and disposal stop draw work and free only schematic-owned resources',async()=>{
 const h=await nativeSchematic();h.frame();const count=h.draws.length;h.state.enabled=false;h.bind();h.frame(100);assert.equal(h.draws.length,count);
 h.dispose();await Promise.resolve();assert(h.buffers.every(b=>b.destroyed));assert(h.textures.every(t=>t.destroyed));assert.equal(h.native.Ln._renderables.length,0);assert.equal(h.context.__BLM_NATIVE_CONNECTION__,undefined);
});
test('Large draw lists keep per-draw colours distinct across aligned parameter pages',async()=>{
 const h=await nativeSchematic(),payload=require('../assets/native-litematica.json');h.renderer.destroy();
 const gl=h.handle.gpu,scene=h.handle.wrap(h.raw).scene,program=gl.createProgram();
 for(const [type,source]of [[gl.VERTEX_SHADER,payload.original.vertex],[gl.FRAGMENT_SHADER,payload.original.fragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.attachShader(program,shader);}gl.linkProgram(program);
 const vao=gl.createVertexArray(),buffer=gl.createBuffer(),texture=gl.createTexture();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(36));gl.vertexAttribPointer();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 const token=scene.onBeforeRenderingGroupObservable.add(()=>{gl.useProgram(program);gl.bindVertexArray(vao);gl.bindTexture(gl.TEXTURE_2D,texture);for(let i=0;i<300;i++){gl.uniform4fv('tint',[i/300,.1,.2,.75]);gl.drawArrays(gl.TRIANGLES,0,3);}});
 h.frame();assert.equal(h.draws.length,300);assert.equal(h.adapter.diagnostics().uniformPages,2);assert.equal(h.groups.length,2);
 const offset=payload.fields.find(f=>f.name==='tint').offset;
 for(let i=0;i<300;i++){const draw=h.draws[i],data=draw.group.entries[0].resource.buffer.data;assert.equal(new DataView(data.buffer).getFloat32(draw.offset+offset,true),Math.fround(i/300));assert.equal(draw.offset%256,0);}
 const allocations=h.buffers.length;h.frame(16);assert.equal(h.buffers.length,allocations);assert.equal(h.groups.length,2);
 scene.onBeforeRenderingGroupObservable.remove(token);for(let i=0;i<122;i++)h.frame(32+i*16);assert.equal(h.adapter.diagnostics().uniformPages,0);h.dispose();
});
test('Unverified shader text is rejected without a dynamic runtime compiler',async()=>{
 const h=await nativeSchematic(),gl=h.handle.gpu,shader=gl.createShader(gl.VERTEX_SHADER);gl.shaderSource(shader,'unverified shader');assert.equal(gl.getShaderParameter(shader,gl.COMPILE_STATUS),false);assert.match(gl.getShaderInfoLog(shader),/does not match/);h.dispose();
});
