'use strict';
const HEADER=36,MAX_PIXELS=16*1024*1024,MAGIC=0x31464e42;
function newer(sequence,previous){const delta=(sequence-previous)>>>0;return delta>0&&delta<0x80000000;}
class FrameDecoder {
  constructor(){this.header=Buffer.alloc(HEADER);this.headerBytes=0;this.current=null;this.pixels=null;this.pixelBytes=0;this.sequence=null;}
  push(input){
    if(!Buffer.isBuffer(input)||input.length>256*1024)throw Error('Invalid native frame stream chunk.');
    let consumed=0,latest=null;
    while(consumed<input.length){
      if(!this.current){
        const count=Math.min(HEADER-this.headerBytes,input.length-consumed);input.copy(this.header,this.headerBytes,consumed,consumed+count);this.headerBytes+=count;consumed+=count;
        if(this.headerBytes!==HEADER)continue;
        const header=this.header,magic=header.readUInt32LE(0),version=header.readUInt32LE(4),sequence=header.readUInt32LE(8),epoch=header.readUInt32LE(12),width=header.readUInt32LE(16),height=header.readUInt32LE(20),bytes=header.readUInt32LE(24),flags=header.readUInt32LE(28);
        const revision=header.readUInt32LE(32);
        if(magic!==MAGIC||version!==2||!revision||!width||!height||width>8192||height>8192||width*height>MAX_PIXELS||bytes!==width*height*4||flags!==1)throw Error('Invalid native frame header.');
        this.current={sequence,epoch,revision,width,height,flags,bytes};this.pixels=Buffer.allocUnsafe(bytes);this.pixelBytes=0;
      }
      const count=Math.min(this.current.bytes-this.pixelBytes,input.length-consumed);input.copy(this.pixels,this.pixelBytes,consumed,consumed+count);this.pixelBytes+=count;consumed+=count;
      if(this.pixelBytes===this.current.bytes){
        if(this.sequence===null||newer(this.current.sequence,this.sequence)){latest={...this.current,pixels:this.pixels};this.sequence=latest.sequence;}
        this.current=this.pixels=null;this.headerBytes=this.pixelBytes=0;
      }
    }
    return latest;
  }
}
module.exports={FrameDecoder,newer,HEADER,MAX_PIXELS,MAGIC};
