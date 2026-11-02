'use strict';
// Explicit local input only. No extraction, network, account/profile writes,
// page APIs, native process launch or automatic renderer activation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const LIMITS=Object.freeze({archive:128*1024*1024,entries:4096,virtualNodes:16384,total:128*1024*1024,file:16*1024*1024,text:1024*1024,textTotal:16*1024*1024,path:512,depth:32,snapshot:20*1024*1024});
const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const demand=(ok,message)=>{if(!ok)throw Error('Shader pack: '+message);};
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function canonical(name,directory=false){
 demand(typeof name==='string'&&Buffer.byteLength(name)<=LIMITS.path&&name.length>0,'invalid path length');
 demand(!/[\\\x00-\x1f\x7f<>:"|?*]/u.test(name)&&!name.startsWith('/'),'absolute, alternate or control path');
 if(directory){demand(name.endsWith('/'),'directory name mismatch');name=name.slice(0,-1);}
 const parts=name.split('/');demand(parts.length<=LIMITS.depth,'path depth limit');
 for(const part of parts)demand(part&&part!=='.'&&part!=='..'&&!/[. ]$/.test(part)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),'unsafe or aliased path component');
 return name;
}
function sourcePath(name){canonical(name);demand(/^[A-Za-z0-9_.\-/]+$/.test(name),'unsupported source path encoding');return name;}
function selected(name){return /\.(?:glsl|inc|vsh|fsh|gsh|csh|tcs|tes|properties|txt)$/i.test(name);}
function extras(bytes){for(let at=0;at<bytes.length;){demand(at+4<=bytes.length,'truncated ZIP extra');const id=bytes.readUInt16LE(at),n=bytes.readUInt16LE(at+2);at+=4;demand(at+n<=bytes.length,'truncated ZIP extra value');demand(![0x0001,0x7075,0x9901].includes(id),'ZIP64, alternate Unicode names or AES are unsupported');at+=n;}}
function rootOf(records){const roots=new Set();for(const e of records){if(e.directory||e.name.startsWith('__MACOSX/'))continue;const parts=e.name.split('/');const at=parts.indexOf('shaders');if(at===0||at===1)roots.add(parts.slice(0,at+1).join('/')+'/');}
 demand(roots.size===1,'missing or ambiguous shaders root');return [...roots][0];}
function immutable(records,kind,sourceSha256){
 const tree=new Map();for(const e of records){const parts=e.name.split('/');let prefix='';for(let i=0;i<parts.length;i++){prefix+=(i?'/':'')+parts[i];const directory=i<parts.length-1||e.directory,key=prefix.toLowerCase(),old=tree.get(key);demand(!old||old.name===prefix&&old.directory&&directory,'case-aliased or file-parent tree path');tree.set(key,{name:prefix,directory});demand(tree.size<=LIMITS.virtualNodes,'virtual tree node limit');}}
 const root=rootOf(records),texts=new Map(),manifest=[];let total=0;
 for(const e of records.filter(e=>!e.directory&&e.name.startsWith(root)&&selected(e.name)).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
  const name=sourcePath(e.name.slice(root.length));demand(e.size<=LIMITS.text,'text file exceeds 1 MiB');const bytes=e.read();demand(bytes.length===e.size,'source size changed');
  let text=decoder.decode(bytes);demand(!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text),'control byte in source');if(text.charCodeAt(0)===0xfeff)text=text.slice(1);
  const normalized=Buffer.from(text,'utf8');total+=normalized.length;demand(total<=LIMITS.textTotal,'text total exceeds 16 MiB');texts.set(name,text);manifest.push(Object.freeze({path:name,bytes:bytes.length,sha256:digest(bytes),textSha256:digest(normalized)}));
 }
 demand(texts.size>0,'no supported shader/property text files');
 for(const e of records)if(e.validate)e.validate();
 const chunks=[Buffer.from('SPK1'),Buffer.alloc(4)];chunks[1].writeUInt32LE(texts.size);let snapshotSize=8;
 for(const [name,text] of texts){const a=Buffer.from(name),b=Buffer.from(text),header=Buffer.alloc(8);header.writeUInt32LE(a.length);header.writeUInt32LE(b.length,4);snapshotSize+=8+a.length+b.length;demand(snapshotSize<=LIMITS.snapshot,'snapshot limit');chunks.push(header,a,b);}
 const snapshot=Buffer.concat(chunks),paths=Object.freeze([...texts.keys()]);
 return Object.freeze({kind,root,paths,sourceSha256,snapshotSha256:digest(snapshot),files:Object.freeze(manifest),textBytes:total,
  read(name){sourcePath(name);demand(texts.has(name),'missing source '+name);return texts.get(name);},
  snapshot(){return Buffer.from(snapshot);}});
}
function fromZip(input){
 demand(Buffer.isBuffer(input)&&input.length>=22&&input.length<=LIMITS.archive,'invalid ZIP size');const bytes=Buffer.from(input);
 let end=-1;for(let at=bytes.length-22;at>=Math.max(0,bytes.length-22-65535);--at)if(bytes.readUInt32LE(at)===0x06054b50&&at+22+bytes.readUInt16LE(at+20)===bytes.length){end=at;break;}
 demand(end>=0,'missing ZIP end record');demand(bytes.readUInt16LE(end+4)===0&&bytes.readUInt16LE(end+6)===0,'multi-disk ZIP unsupported');
 const count=bytes.readUInt16LE(end+10),centralSize=bytes.readUInt32LE(end+12),central=bytes.readUInt32LE(end+16);
 demand(count>0&&count<=LIMITS.entries&&bytes.readUInt16LE(end+8)===count&&count!==65535&&central!==0xffffffff&&centralSize!==0xffffffff,'entry count or ZIP64 limit');
 demand(central+centralSize===end,'invalid central directory bounds');let at=central,total=0;const records=[],names=new Set(),ranges=[];
 for(let index=0;index<count;index++){
  demand(at+46<=end&&bytes.readUInt32LE(at)===0x02014b50,'invalid central entry');
  const madeBy=bytes.readUInt16LE(at+4),needed=bytes.readUInt16LE(at+6),flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),crc=bytes.readUInt32LE(at+16),compressed=bytes.readUInt32LE(at+20),size=bytes.readUInt32LE(at+24),n=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),disk=bytes.readUInt16LE(at+34),attrs=bytes.readUInt32LE(at+38),local=bytes.readUInt32LE(at+42);
  demand(needed>=10&&needed<=20&&(flags&~0x080e)===0&&[0,8].includes(method)&&(method!==8||needed>=20)&&disk===0,'unsupported encrypted/flagged ZIP entry');
  demand(size<=LIMITS.file&&compressed<=LIMITS.archive&&local!==0xffffffff&&at+46+n+extra+comment<=end,'entry size/bounds limit');
  const nameBytes=bytes.subarray(at+46,at+46+n);if(!(flags&0x800))demand([...nameBytes].every(b=>b<128),'non-UTF8 ZIP name unsupported');const raw=decoder.decode(nameBytes),directory=raw.endsWith('/'),name=canonical(raw,directory);
  demand(!names.has(name.toLowerCase()),'duplicate/case-aliased entry');names.add(name.toLowerCase());extras(bytes.subarray(at+46+n,at+46+n+extra));
  const unix=madeBy>>>8,mode=attrs>>>16,type=mode&0xf000;demand(![3,19].includes(unix)||[0,0x8000,0x4000].includes(type),'symlink or special ZIP entry');demand(type!==0x4000||directory,'directory mode mismatch');demand(type!==0x8000||!directory,'regular mode mismatch');demand(!(attrs&0x10)||directory,'directory attribute mismatch');demand(!directory||size===0,'directory has payload');
  total+=size;demand(total<=LIMITS.total,'expanded archive total limit');
  demand(local+30<=central&&bytes.readUInt32LE(local)===0x04034b50,'invalid local header');const localName=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28),start=local+30+localName+localExtra;
  demand(start+compressed<=central&&bytes.readUInt16LE(local+4)===needed&&bytes.readUInt16LE(local+6)===flags&&bytes.readUInt16LE(local+8)===method,'local header mismatch');
  demand(bytes.subarray(local+30,local+30+localName).equals(nameBytes),'local/central filename mismatch');extras(bytes.subarray(local+30+localName,start));
  const localCrc=bytes.readUInt32LE(local+14),localCompressed=bytes.readUInt32LE(local+18),localSize=bytes.readUInt32LE(local+22);
  if(flags&8)demand((localCrc===0||localCrc===crc)&&(localCompressed===0||localCompressed===compressed)&&(localSize===0||localSize===size),'descriptor local size mismatch');
  else demand(localCrc===crc&&localCompressed===compressed&&localSize===size,'local CRC/size mismatch');
  let until=start+compressed;if(flags&8){demand(until+12<=central,'truncated data descriptor');if(bytes.readUInt32LE(until)===0x08074b50)until+=4;demand(until+12<=central&&bytes.readUInt32LE(until)===crc&&bytes.readUInt32LE(until+4)===compressed&&bytes.readUInt32LE(until+8)===size,'data descriptor mismatch');until+=12;}
  ranges.push([local,until]);records.push({name,directory,size,read(){const packed=bytes.subarray(start,start+compressed);let result;if(method===0){demand(compressed===size,'stored size mismatch');result=Buffer.from(packed);}else{const inflated=zlib.inflateRawSync(packed,{info:true,maxOutputLength:Math.max(1,Math.min(size,LIMITS.text))});demand(inflated.engine.bytesWritten===packed.length,'trailing compressed data');result=inflated.buffer;}demand(result.length===size&&crc32(result)===crc,'source ZIP CRC/size failure');return result;}});
  at+=46+n+extra+comment;
 }
 demand(at===end,'central directory entry count mismatch');ranges.sort((a,b)=>a[0]-b[0]);let previous=0;for(const [start,until] of ranges){demand(start===previous&&until>start,'overlapping or unindexed local ZIP data');previous=until;}demand(previous===central,'unindexed local ZIP tail');
 return immutable(records,'zip',digest(bytes));
}
function identity(a,b){return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.nlink===b.nlink&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;}
function readStable(file,max,root,expected){
 const before=fs.lstatSync(file,{bigint:true});demand(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1n&&before.size<=BigInt(max),'linked/special/oversized file');
 if(expected)demand(identity(expected,before),'source changed after inventory');
 const real=fs.realpathSync.native(file);if(root){const relative=path.relative(root,real);demand(relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative),'file outside pack root');}
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(process.platform==='win32'?0:fs.constants.O_NOFOLLOW||0));
 try{const opened=fs.fstatSync(fd,{bigint:true});demand(identity(before,opened),'file changed before read');const bytes=Buffer.alloc(Number(opened.size));let at=0;while(at<bytes.length){const n=fs.readSync(fd,bytes,at,bytes.length-at,at);demand(n>0,'short source read');at+=n;}demand(identity(opened,fs.fstatSync(fd,{bigint:true}))&&identity(before,fs.lstatSync(file,{bigint:true})),'file changed while reading');return bytes;}finally{fs.closeSync(fd);}
}
function fromDirectory(folder){
 const initial=fs.lstatSync(folder,{bigint:true});demand(initial.isDirectory()&&!initial.isSymbolicLink(),'pack root is not a real directory');const root=fs.realpathSync.native(folder),records=[],names=new Set(),directories=[];let total=0;
 function walk(directory,prefix,depth){
  demand(depth<=LIMITS.depth,'directory depth limit');const before=fs.lstatSync(directory,{bigint:true});directories.push([directory,before]);demand(before.isDirectory()&&!before.isSymbolicLink(),'linked/special directory');const real=fs.realpathSync.native(directory),relative=path.relative(root,real);demand(relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative),'directory outside pack root');
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name),stat=fs.lstatSync(file,{bigint:true});demand(!stat.isSymbolicLink()&&(stat.isDirectory()||stat.isFile()),'linked/special directory entry');const directoryEntry=stat.isDirectory(),name=canonical(prefix+entry.name+(directoryEntry?'/':''),directoryEntry);demand(!names.has(name.toLowerCase()),'duplicate/case-aliased directory entry');names.add(name.toLowerCase());demand(names.size<=LIMITS.entries,'directory entry count limit');
   if(directoryEntry){records.push({name,directory:true,size:0});walk(file,name+'/',depth+1);}else {demand(stat.nlink===1n&&stat.size<=BigInt(LIMITS.file),'linked/oversized directory file');total+=Number(stat.size);demand(total<=LIMITS.total,'directory total size limit');records.push({name,directory:false,size:Number(stat.size),read:()=>readStable(file,LIMITS.text,root,stat),validate:()=>demand(identity(stat,fs.lstatSync(file,{bigint:true})),'source changed during pack read')});}
  }demand(identity(before,fs.lstatSync(directory,{bigint:true})),'directory changed during inventory');
 }
 walk(folder,'',0);const result=immutable(records,'directory',null);for(const [directory,stat] of directories)demand(identity(stat,fs.lstatSync(directory,{bigint:true})),'pack directory changed');return result;
}
function readShaderPack(file){demand(typeof file==='string'&&path.isAbsolute(file),'explicit absolute pack path required');const stat=fs.lstatSync(file);if(stat.isDirectory())return fromDirectory(file);demand(/\.zip$/i.test(file),'expected a ZIP or pack directory');return fromZip(readStable(file,LIMITS.archive));}
module.exports={readShaderPack,fromZip,fromDirectory,LIMITS};
