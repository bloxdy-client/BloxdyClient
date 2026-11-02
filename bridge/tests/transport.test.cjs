'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validatePacket}=require('../transport.cjs');
function reset(){const bytes=Buffer.alloc(20);bytes.writeUInt32LE(0x31444e42);bytes.writeUInt32LE(1,4);bytes.writeUInt32LE(4,8);bytes.writeUInt32LE(1,12);bytes.writeUInt32LE(1,16);return bytes;}
test('reject broken binary framing and unsupported packet types before native write',()=>{
  assert.equal(validatePacket(reset()).length,20);
  const length=reset();length.writeUInt32LE(64,8);assert.throws(()=>validatePacket(length),/framing/);
  const magic=reset();magic.writeUInt32LE(0);assert.throws(()=>validatePacket(magic),/framing/);
  const type=reset();type.writeUInt32LE(100,4);assert.throws(()=>validatePacket(type),/type/);
  assert.throws(()=>validatePacket({buffer:'not binary'}),/size/);
});
test('respect a typed-array subview rather than sending surrounding bytes',()=>{
  const bytes=Buffer.alloc(60);reset().copy(bytes,20);const view=new Uint8Array(bytes.buffer,bytes.byteOffset+20,20);
  assert.equal(validatePacket(view).length,20);assert.equal(validatePacket(view).readUInt32LE(16),1);
});
test('native geometry, material, presentation and resource-release extensions have accepted framing',()=>{
  for(const type of [11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29]){const bytes=reset();bytes.writeUInt32LE(type,4);assert.equal(validatePacket(bytes).readUInt32LE(4),type);}
  const future=reset();future.writeUInt32LE(34,4);assert.throws(()=>validatePacket(future),/type/);
});
