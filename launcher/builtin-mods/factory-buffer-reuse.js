/* Preserve exact GPU buffer contents while avoiding redundant uploads. */
(() => {
  'use strict';
  const targets=['ARRAY_BUFFER','ELEMENT_ARRAY_BUFFER'];
  const states=new WeakMap(),restores=[];
  function state(gl){let value=states.get(gl);if(!value){value={bound:new Map(),last:new WeakMap(),misses:0,pausedUntil:0};states.set(gl,value);}return value;}
  function bytes(view){return new Uint8Array(view.buffer,view.byteOffset,view.byteLength);}
  function same(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
  function install(proto){if(!proto||typeof proto.bindBuffer!=='function'||typeof proto.bufferData!=='function'||typeof proto.bufferSubData!=='function')return;
    const original={bindBuffer:proto.bindBuffer,bufferData:proto.bufferData,bufferSubData:proto.bufferSubData};
    if(typeof proto.deleteBuffer==='function')original.deleteBuffer=proto.deleteBuffer;
    for(const name of ['bindBufferBase','bindBufferRange','copyBufferSubData'])if(typeof proto[name]==='function')original[name]=proto[name];
    proto.bindBuffer=function(target,buffer){const result=original.bindBuffer.apply(this,arguments);state(this).bound.set(target,buffer);return result;};
    if(original.deleteBuffer)proto.deleteBuffer=function(buffer){const result=original.deleteBuffer.apply(this,arguments),s=state(this);if(buffer){s.last.delete(buffer);for(const [target,bound] of s.bound)if(bound===buffer)s.bound.set(target,null);}return result;};
    proto.bufferData=function(target){const s=state(this),buffer=s.bound.get(target);if(buffer)s.last.delete(buffer);return original.bufferData.apply(this,arguments);};
    proto.bufferSubData=function(target,offset,view){
      const s=state(this),buffer=s.bound.get(target),now=performance.now();
      // Only the exact three-argument ArrayBufferView overload is inspected.
      // Other overloads and unknown bindings follow the native path.
      if(!targets.some(name=>target===this[name])||!buffer||arguments.length!==3||!ArrayBuffer.isView(view)||!Number.isSafeInteger(offset)||offset<0||view.byteLength<1024||view.byteLength>65536||now<s.pausedUntil){
        if(buffer)s.last.delete(buffer);return original.bufferSubData.apply(this,arguments);
      }
      const incoming=bytes(view),last=s.last.get(buffer);
      if(last&&last.target===target&&last.offset===offset&&same(last.data,incoming)){s.misses=0;return;}
      const result=original.bufferSubData.apply(this,arguments);
      s.last.set(buffer,{target,offset,data:incoming.slice()});
      if(++s.misses>=128){s.misses=0;s.pausedUntil=now+2000;}
      return result;
    };
    for(const name of ['bindBufferBase','bindBufferRange'])if(original[name])proto[name]=function(target,index,buffer){if(buffer)state(this).last.delete(buffer);return original[name].apply(this,arguments);};
    if(original.copyBufferSubData)proto.copyBufferSubData=function(readTarget,writeTarget){const s=state(this),buffer=s.bound.get(writeTarget);if(buffer)s.last.delete(buffer);return original.copyBufferSubData.apply(this,arguments);};
    restores.push(()=>{for(const name of Object.keys(original))if(proto[name]!==original[name])proto[name]=original[name];});
  }
  const webgl1=globalThis.WebGLRenderingContext?.prototype,webgl2=globalThis.WebGL2RenderingContext?.prototype;
  install(webgl1);
  if(webgl2&&(!webgl1||!webgl1.isPrototypeOf(webgl2)))install(webgl2);
  addEventListener('pagehide',()=>{for(const restore of restores)restore();},{once:true});
})();
