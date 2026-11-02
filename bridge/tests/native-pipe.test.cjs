'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');const root=path.resolve(__dirname,'../..');
function packet(type,epoch,tail=Buffer.alloc(0)){const bytes=Buffer.alloc(20+tail.length);bytes.writeUInt32LE(0x31444e42);bytes.writeUInt32LE(type,4);bytes.writeUInt32LE(4+tail.length,8);bytes.writeUInt32LE(1,12);bytes.writeUInt32LE(epoch,16);tail.copy(bytes,20);return bytes;}
async function run(label,fragments){
  const output=path.join(root,'outputs','pipe-tests',label);fs.mkdirSync(output,{recursive:true});
  const child=spawn(path.join(root,'build-streaming/Release/BloxdNative.exe'),['--bridge','--hidden','--output',output],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr+=b;});child.stdin.on('error',()=>{});
  const finished=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code));});
  const timeout=setTimeout(()=>child.kill(),15000);
  for(let i=0;i<100&&!stdout.includes('BRIDGE_READY');++i)await new Promise(r=>setTimeout(r,20));
  for(const chunk of fragments){if(child.stdin.writable)child.stdin.write(chunk);await new Promise(r=>setTimeout(r,30));}
  child.stdin.end();const code=await finished;clearTimeout(timeout);return {code,stdout,stderr,output};
}
test('native pipe reassembles split headers and ignores stale-world packets',{timeout:20000},async()=>{
  const reset=packet(1,5),snapshot=packet(7,5,Buffer.from([8,0,0,0]));
  const staleCamera=packet(2,4);const result=await run('fragmented',[reset.subarray(0,3),reset.subarray(3,17),reset.subarray(17),staleCamera,snapshot]);
  assert.equal(result.code,0,result.stderr);assert.match(result.stdout,/"epoch":5/);assert.match(result.stdout,/"snapshot":8/);
});
test('native receiver rejects an index outside captured geometry without displaying a dialog',{timeout:20000},async()=>{
  const tail=Buffer.alloc(20+64+56+12);tail.writeUInt32LE(1,0);tail.writeUInt32LE(0,4);tail.writeUInt32LE(0,8);tail.writeUInt32LE(1,12);tail.writeUInt32LE(3,16);
  for(let i=0;i<16;++i)tail.writeFloatLE(i%5===0?1:0,20+i*4);
  tail.writeUInt32LE(0,20+64+56);tail.writeUInt32LE(9,20+64+56+4);tail.writeUInt32LE(0,20+64+56+8);
  const result=await run('invalid-index',[packet(1,1),packet(3,1,tail)]);assert.equal(result.code,1);assert.match(result.stderr,/index outside vertex buffer/);
});
