'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FrameDecoder,newer,HEADER,MAGIC}=require('../frames.cjs');
function frame(sequence=1,epoch=2,width=2,height=2){const out=Buffer.alloc(HEADER+width*height*4);[MAGIC,2,sequence,epoch,width,height,width*height*4,1,7].forEach((v,i)=>out.writeUInt32LE(v,i*4));out.fill(sequence&255,HEADER);return out;}
test('native frame decoder handles every possible header/body split without exposing incomplete pixels',()=>{
  const bytes=frame();for(let split=1;split<bytes.length;++split){const decoder=new FrameDecoder();assert.equal(decoder.push(bytes.subarray(0,split)),null);const result=decoder.push(bytes.subarray(split));assert.equal(result.sequence,1);assert.equal(result.epoch,2);assert.equal(result.revision,7);assert.deepEqual(result.pixels,bytes.subarray(HEADER));}
});
test('multiple frames in a stream retain only the newest complete image',()=>{
  const decoder=new FrameDecoder(),bytes=Buffer.concat([frame(1),frame(2),frame(3)]);const result=decoder.push(bytes);assert.equal(result.sequence,3);assert.equal(decoder.pixels,null);assert.equal(decoder.headerBytes,0);
  assert.equal(decoder.push(frame(2)),null);assert.equal(decoder.push(frame(3)),null);assert.equal(decoder.push(frame(4)).sequence,4);
});
test('native frame sequence accepts unsigned wraparound and rejects old frames',()=>{
  assert.equal(newer(0,0xffffffff),true);assert.equal(newer(0xffffffff,0),false);
  const decoder=new FrameDecoder();assert.equal(decoder.push(frame(0xffffffff)).sequence,0xffffffff);assert.equal(decoder.push(frame(0)).sequence,0);assert.equal(decoder.push(frame(0xffffffff)),null);
});
test('malformed and oversized frame headers are rejected before allocating pixels',()=>{
  for(const [offset,value] of [[0,0],[4,1],[16,0],[16,8193],[20,8193],[24,1],[28,0],[32,0]]){const decoder=new FrameDecoder(),bytes=frame();bytes.writeUInt32LE(value,offset);assert.throws(()=>decoder.push(bytes),/header/);assert.equal(decoder.pixels,null);}
  const decoder=new FrameDecoder(),bytes=frame();bytes.writeUInt32LE(8192,16);bytes.writeUInt32LE(8192,20);bytes.writeUInt32LE(8192*8192*4,24);assert.throws(()=>decoder.push(bytes),/header/);
});
test('fragmented large frames fill one bounded allocation rather than recopying the accumulated image',()=>{
  const decoder=new FrameDecoder(),bytes=frame(1,2,512,512);assert.equal(decoder.push(bytes.subarray(0,HEADER+1)),null);const allocation=decoder.pixels;
  let result;for(let at=HEADER+1;at<bytes.length;at+=65536){result=decoder.push(bytes.subarray(at,Math.min(bytes.length,at+65536)));if(at+65536<bytes.length)assert.equal(decoder.pixels,allocation);}
  assert.deepEqual(result.pixels,bytes.subarray(HEADER));assert.equal(result.pixels,allocation);
});
test('oversized or non-binary stream chunks are rejected',()=>{
  const decoder=new FrameDecoder();assert.throws(()=>decoder.push(new Uint8Array(1)),/chunk/);assert.throws(()=>decoder.push(Buffer.alloc(256*1024+1)),/chunk/);
});
