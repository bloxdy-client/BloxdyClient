'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {fromZip,fromDirectory,readShaderPack,LIMITS}=require('../shader-pack-files.cjs');
function crc(b){if(zlib.crc32)return zlib.crc32(b);let n=0xffffffff;for(const c of b){n^=c;for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;}return (n^0xffffffff)>>>0;}
function zip(entries){let offset=0;const local=[],central=[],positions=[];for(const e of entries){const name=Buffer.from(e.name),data=Buffer.isBuffer(e.data)?e.data:Buffer.from(e.data||''),method=e.method??8,packed=method===8?zlib.deflateRawSync(data):data,flags=0x800|(e.descriptor?8:0),sum=crc(data),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(flags,6);h.writeUInt16LE(method,8);if(!e.descriptor){h.writeUInt32LE(sum,14);h.writeUInt32LE(packed.length,18);h.writeUInt32LE(data.length,22);}h.writeUInt16LE(name.length,26);const descriptor=e.descriptor?Buffer.alloc(e.unsigned?12:16):Buffer.alloc(0);if(e.descriptor){let p=0;if(!e.unsigned){descriptor.writeUInt32LE(0x08074b50);p=4;}descriptor.writeUInt32LE(sum,p);descriptor.writeUInt32LE(packed.length,p+4);descriptor.writeUInt32LE(data.length,p+8);}const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x0314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(flags,8);c.writeUInt16LE(method,10);c.writeUInt32LE(sum,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(((e.mode??(e.name.endsWith('/')?0x41ed:0x81a4))*65536)>>>0,38);c.writeUInt32LE(offset,42);positions.push({local:offset,start:offset+30+name.length,nameLength:name.length});local.push(h,name,packed,descriptor);central.push(c,name);offset+=h.length+name.length+packed.length+descriptor.length;}
 const start=offset,cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(start,16);let at=start;entries.forEach((e,i)=>{positions[i].central=at;at+=46+Buffer.byteLength(e.name);});return {bytes:Buffer.concat([...local,cd,end]),positions,end:start+cd.length};}
function temporary(t){const prefix=path.join(os.tmpdir(),'bloxdy-pack-source-'),folder=fs.mkdtempSync(prefix);t.after(()=>{assert.ok(path.resolve(folder).startsWith(path.resolve(prefix)));fs.rmSync(folder,{recursive:true,force:true});});return folder;}
const material=`#ifdef UNAVAILABLE_OPTION
#error wrong branch
#else
block.16777217=stone
block.0=glass
block.31=stone_slab:type=bottom:waterlogged=false stone_stairs:facing=north:half=bottom:shape=straight:waterlogged=false jungle_door:facing=north:half=lower:hinge=right:open=false jungle_log cherry_log jungle_planks grass_block water
block.32=stone_slab:type=top:waterlogged=false stone_stairs:facing=west:half=top:shape=inner_right:waterlogged=false jungle_door:facing=east:half=upper:hinge=right:open=true stripped_jungle_log stripped_cherry_log cherry_planks lava
#endif
`;
const sources={
 'block.properties':material,
 'gbuffers_terrain.vsh':'#version 330 core\nlayout(location=0) in vec3 position;\n#include "lib/math.glsl"\nvoid main(){gl_Position=packPosition(position);}\n',
 'gbuffers_terrain.fsh':'#version 330 core\n#include "/lib/tint.glsl"\nout vec4 color;\nvoid main(){color=packTint();}\n',
 'lib/math.glsl':'#include "../lib/constants.glsl"\nvec4 packPosition(vec3 p){return vec4(p*packConstant,1.0);}\n',
 'lib/constants.glsl':'const float packConstant=1.0;\n',
 'lib/tint.glsl':'#ifndef PACK_COLOR_OVERRIDE\n#define PACK_COLOR(r,g,b) vec4(r,g,b,1.0)\n#else\n#define PACK_COLOR(r,g,b) vec4(b,g,r,1.0)\n#endif\n#if PACK_TEST_LEVEL >= 2\n#define PACK_BLUE 0.8\n#else\n#define PACK_BLUE 0.5\n#endif\nvec4 packTint(){return PACK_COLOR(0.2,0.4,PACK_BLUE);}\n',
 'faulty.fsh':'#version 330 core\n#include "/lib/bad.glsl"\nout vec4 color;\nvoid main(){color=sourceBad();}\n',
 'lib/bad.glsl':'vec4 sourceBad(){\nreturn impossibleSymbol;\n}\n'
};
test('stored, deflated, signed/unsigned descriptor ZIPs and folder input produce identical owned source snapshots',t=>{
 const folder=temporary(t);for(const [name,data] of Object.entries(sources)){const file=path.join(folder,'shaders',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}fs.writeFileSync(path.join(folder,'shaders','ignored.png'),Buffer.from([0,255,1]));
 const entries=Object.entries(sources).map(([name,data])=>({name:'Example/shaders/'+name,data}));let snapshot;
 for(const options of [{method:0},{method:8},{method:8,descriptor:true},{method:8,descriptor:true,unsigned:true}]){const bytes=zip(entries.map(e=>({...e,...options}))).bytes,p=fromZip(bytes);assert.equal(p.read('block.properties'),material);assert.deepEqual(p.paths,Object.keys(sources).sort());snapshot??=p.snapshot();assert.deepEqual(p.snapshot(),snapshot);bytes.fill(0);const returned=p.snapshot();returned.fill(0);assert.deepEqual(p.snapshot(),snapshot);assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.files));}
 const dir=fromDirectory(folder);assert.deepEqual(dir.snapshot(),snapshot);const archive=path.join(folder,'fixture.zip');fs.writeFileSync(archive,zip(entries).bytes);assert.deepEqual(readShaderPack(archive).snapshot(),snapshot);assert.deepEqual(require('../minecraft-packs.cjs').readSources(archive).snapshot(),snapshot);
 const out=path.resolve('outputs/native-renderer-verification');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'pack-source-fixture.bin'),snapshot);fs.writeFileSync(path.join(out,'pack-source-fixture.json'),JSON.stringify({files:dir.files,snapshotSha256:crypto.createHash('sha256').update(snapshot).digest('hex'),sourceKindParity:true,clientsStarted:0,accountsAccessed:false},null,2));
});
test('pack roots, paths, implicit directory aliases, duplicates and file-parent conflicts fail atomically',()=>{
 for(const name of ['../shaders/a.vsh','/shaders/a.vsh','C:/shaders/a.vsh','shaders/../a.vsh','shaders\\a.vsh','shaders/a.vsh.','shaders/NUL.glsl','shaders/COM1.inc','shaders//a.vsh'])assert.throws(()=>fromZip(zip([{name,data:'x'}]).bytes));
 for(const names of [['shaders/a.vsh','shaders/a.vsh'],['shaders/a.vsh','shaders/A.vsh'],['shaders/lib/a.vsh','shaders/Lib/b.vsh'],['shaders/lib','shaders/lib/a.vsh'],['one/shaders/a.vsh','two/shaders/b.vsh'],['shaders/a.vsh','wrapper/shaders/b.vsh']])assert.throws(()=>fromZip(zip(names.map(name=>({name,data:'x'}))).bytes));
 assert.throws(()=>fromZip(zip([{name:'resource/readme.txt',data:'x'}]).bytes));assert.throws(()=>fromZip(zip([{name:'shaders/link.glsl',data:'target',mode:0xa1ff}]).bytes));
});
test('ZIP bounds, central/local agreement, encryption, unsupported methods and corrupt descriptors are rejected',()=>{
 const original=zip([{name:'shaders/a.vsh',data:'void main(){}',descriptor:true}]);const {local,start,central}=original.positions[0];
 for(const edit of [b=>b.writeUInt16LE(1,local+6),b=>b.writeUInt16LE(1,central+8),b=>b.writeUInt16LE(99,central+10),b=>b.writeUInt16LE(45,central+6),b=>b.writeUInt32LE(0xffffffff,central+24),b=>b.writeUInt32LE(0xffffffff,central+42),b=>b.writeUInt32LE(0,central+42),b=>b[local+30]^=1,b=>b.writeUInt32LE(1,central+16),b=>b.writeUInt16LE(2,original.end+8),b=>b.writeUInt16LE(1,original.end+4),b=>b.writeUInt32LE(10,original.end+12),b=>b.writeUInt32LE(0xdeadbeef,start+zlib.deflateRawSync(Buffer.from('void main(){}')).length+4)]){
  const bytes=Buffer.from(original.bytes);edit(bytes);if(bytes.equals(original.bytes))continue;assert.throws(()=>fromZip(bytes));}
 for(const length of [0,10,original.bytes.length-1])assert.throws(()=>fromZip(original.bytes.subarray(0,length)));
 const overlaps=zip([{name:'shaders/a.vsh',data:'a'},{name:'shaders/b.vsh',data:'b'}]);overlaps.bytes.writeUInt32LE(0,overlaps.positions[1].central+42);assert.throws(()=>fromZip(overlaps.bytes));
});
test('source decompression validates actual length/CRC, UTF-8/control bytes and normalized BOM without reading binary assets',()=>{
 const stored=zip([{name:'shaders/a.vsh',data:'void main(){}',method:0}]);stored.bytes[stored.positions[0].start]^=1;assert.throws(()=>fromZip(stored.bytes),/CRC/);
 const bad=zip([{name:'shaders/a.vsh',data:'hello'}]);bad.bytes[bad.positions[0].start]=255;assert.throws(()=>fromZip(bad.bytes));
 for(const data of [Buffer.from([0xc0,0xaf]),Buffer.from([0]),Buffer.from([0x7f])])assert.throws(()=>fromZip(zip([{name:'shaders/a.vsh',data}]).bytes));
 const p=fromZip(zip([{name:'shaders/a.vsh',data:Buffer.from('\ufeff// Grüß\n')},{name:'shaders/b.png',data:Buffer.from([255,0])}]).bytes);assert.equal(p.read('a.vsh'),'// Grüß\n');assert.equal(p.files.length,1);assert.throws(()=>p.read('../a.vsh'));assert.throws(()=>p.read('absent.vsh'));
});
test('text count/size and inventory limits reject ZIP bombs before returning a partial snapshot',()=>{
 assert.throws(()=>fromZip(zip([{name:'shaders/a.vsh',data:Buffer.alloc(LIMITS.text+1,32)}]).bytes),/1 MiB/);
 const tiny=zip([{name:'shaders/a.vsh',data:'x'}]);tiny.bytes.writeUInt32LE(LIMITS.file+1,tiny.positions[0].central+24);assert.throws(()=>fromZip(tiny.bytes),/size/);
 const entries=Array.from({length:17},(_,i)=>({name:`shaders/p${i}.glsl`,data:Buffer.alloc(LIMITS.text,32)}));assert.throws(()=>fromZip(zip(entries).bytes),/total/);
 const count=zip([{name:'shaders/a.vsh',data:'x'}]);count.bytes.writeUInt16LE(4097,count.end+8);count.bytes.writeUInt16LE(4097,count.end+10);assert.throws(()=>fromZip(count.bytes),/count/);
});
test('folder reading rejects junctions, hard links and files changed during reads',t=>{
 const folder=temporary(t),outside=temporary(t),shader=path.join(folder,'shaders');fs.mkdirSync(shader);const file=path.join(shader,'a.vsh');fs.writeFileSync(file,'void main(){}');const linked=path.join(shader,'linked');fs.symlinkSync(outside,linked,process.platform==='win32'?'junction':'dir');assert.throws(()=>fromDirectory(folder),/linked/);fs.unlinkSync(linked);
 const hard=path.join(shader,'hard.vsh');fs.linkSync(file,hard);assert.throws(()=>fromDirectory(folder),/linked/);fs.unlinkSync(hard);
 const read=fs.readSync;try{let changed=false;fs.readSync=function(...args){const n=read.apply(this,args);if(!changed){changed=true;fs.appendFileSync(file,'!');}return n;};assert.throws(()=>fromDirectory(folder),/changed/);}finally{fs.readSync=read;}
 assert.throws(()=>readShaderPack('relative.zip'),/absolute/);
});
