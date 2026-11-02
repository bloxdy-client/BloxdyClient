'use strict';
const {spawn}=require('node:child_process');
const {EventEmitter}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net'),crypto=require('node:crypto');
const {FrameDecoder,newer}=require('./frames.cjs');
const {validateSourceFrame}=require('./source-frame.cjs');
const {validateGpuParticles}=require('./gpu-particles.cjs');
const {validateSourceLight}=require('./source-light.cjs');
const {validateSourceEmission}=require('./source-emission.cjs');
function validatePacket(input){
  const bytes=input instanceof ArrayBuffer?Buffer.from(input):ArrayBuffer.isView(input)?Buffer.from(input.buffer,input.byteOffset,input.byteLength):null;
  if(!bytes||bytes.length<20||bytes.length>64*1024*1024+16)throw Error('Invalid native packet size.');
  if(bytes.readUInt32LE(0)!==0x31444e42||bytes.readUInt32LE(8)!==bytes.length-16)throw Error('Invalid BND1 packet framing.');
  const type=bytes.readUInt32LE(4);if(type<1||type>33)throw Error('Unknown BND1 packet type.');
  if(type===33)validateSourceEmission(bytes);
  if(type===32)validateSourceLight(bytes);
  if(type===30)validateSourceFrame(bytes);
  if(type===31)validateGpuParticles(bytes);
  return bytes;
}
class Transport extends EventEmitter {
  constructor(root,{hidden=false,embedded=false,output=path.join(root,'outputs','bridge'),executable=path.join(root,'build-release','Release','BloxdNative.exe')}={}){
    super();fs.mkdirSync(output,{recursive:true});this.output=output;this.closed=false;this.ready=false;this.bytes=0;this.status=null;
    this.latestFrame=null;
    const frameArgs=[];
    if(embedded){
      const endpoint='\\\\.\\pipe\\bloxdy-frame-'+process.pid+'-'+crypto.randomBytes(8).toString('hex');frameArgs.push('--frame-pipe',endpoint);
      this.frameServer=net.createServer(socket=>{
        if(this.frameSocket||this.closed){socket.destroy();return;}this.frameSocket=socket;const decoder=new FrameDecoder();
        socket.on('data',chunk=>{try{const frame=decoder.push(chunk);if(frame)this.latestFrame=frame;}catch(error){socket.destroy();this.emit('fault',error);}});
        socket.on('error',error=>{if(!this.closed)this.emit('fault',error);});
      });
      this.frameServer.on('error',error=>this.emit('fault',error));this.frameServer.listen(endpoint);this.frameServer.unref();
    }
    this.child=spawn(executable,['--bridge',...(hidden||embedded?['--hidden']:[]),...frameArgs,'--output',output],{cwd:path.dirname(executable),windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child.stdin.on('error',()=>{});this.child.on('error',error=>{this.closed=true;this.closeFrames();this.emit('fault',error);});
    this.child.on('exit',(code,signal)=>{this.closed=true;this.closeFrames();this.emit('closed',{code,signal});});
    let buffered='';this.child.stdout.on('data',chunk=>{
      buffered+=chunk.toString();let newline;while((newline=buffered.indexOf('\n'))>=0){const line=buffered.slice(0,newline).trim();buffered=buffered.slice(newline+1);
        fs.appendFileSync(path.join(output,'native.log'),line+'\n');
        if(line==='BRIDGE_READY'){this.ready=true;this.emit('ready');}
        if(line.startsWith('BRIDGE_STATUS ')){try{this.status=JSON.parse(line.slice(14));this.emit('status',this.status);}catch(error){this.emit('fault',error);}}
      }
    });
    this.child.stderr.on('data',chunk=>{fs.appendFileSync(path.join(output,'native-error.log'),chunk);this.emit('diagnostic',chunk.toString());});
  }
  async write(input){
    const bytes=validatePacket(input);if(this.closed||!this.child.stdin.writable)throw Error('The native renderer is closed.');
    await new Promise((resolve,reject)=>this.child.stdin.write(bytes,error=>error?reject(error):resolve()));this.bytes+=bytes.length;
    return {accepted:true,bytes:this.bytes};
  }
  frame(after=null){if(this.closed)throw Error('The native renderer is closed.');if(after!==null&&(!Number.isInteger(after)||after<0||after>0xffffffff))throw Error('Invalid native frame sequence.');const frame=this.latestFrame;if(!frame||after!==null&&!newer(frame.sequence,after))return null;return {...frame,pixels:new Uint8Array(frame.pixels)};}
  closeFrames(){this.frameSocket?.destroy();this.frameSocket=null;this.frameServer?.close(()=>{});this.frameServer=null;this.latestFrame=null;}
  stop(){this.closeFrames();if(this.closed)return;this.child.stdin.end();const timeout=setTimeout(()=>{if(!this.closed)this.child.kill();},2000);timeout.unref();}
  waitFor(predicate,timeoutMs=20000){
    if(this.status&&predicate(this.status))return Promise.resolve(this.status);
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(Error('Native status timed out.')),timeoutMs);const check=s=>{if(predicate(s))finish(null,s);};const fault=e=>finish(e);const closed=()=>finish(Error('Native renderer closed before the requested status.'));
      const finish=(error,status)=>{clearTimeout(timer);this.off('status',check);this.off('fault',fault);this.off('closed',closed);error?reject(error):resolve(status);};
      this.on('status',check);this.on('fault',fault);this.on('closed',closed);
    });
  }
}
module.exports={Transport,validatePacket};
