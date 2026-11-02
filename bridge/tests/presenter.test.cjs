'use strict';
// DOM and GL calls are mocks; no browser or graphics context is created.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const install=require('../presenter.cjs');
async function harness(){
  const dom=new JSDOM('<div style="position:relative"><canvas id="world" style="opacity:.75"></canvas><button id="menu">Menu</button></div>'),source=dom.window.document.getElementById('world');
  source.width=source.height=2;
  const intervals=[],calls=[],shaders=[],ownership=[],allocations=[],updates=[];let frame=null,phase='streaming',epoch=1,revision=7,ready=true,now=1000,pending=null,error=0,requests=0,uniformLookups=0;
  const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,TEXTURE0:5,TEXTURE_2D:6,TEXTURE_MIN_FILTER:7,TEXTURE_MAG_FILTER:8,NEAREST:9,TEXTURE_WRAP_S:10,TEXTURE_WRAP_T:11,CLAMP_TO_EDGE:12,UNPACK_ALIGNMENT:13,RGBA8:14,RGBA:15,UNSIGNED_BYTE:16,TRIANGLES:17,NO_ERROR:0,
    createShader:()=>({}),shaderSource(handle,text){shaders.push(text);},compileShader(){},getShaderParameter:()=>true,deleteShader(){},createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,deleteProgram(){},createVertexArray:()=>({}),createTexture:()=>({}),deleteTexture(){},deleteVertexArray(){},activeTexture(){},bindTexture(){},texParameteri(){},useProgram(){},bindVertexArray(){},viewport(){},pixelStorei(){},texImage2D(...args){allocations.push(args);calls.push(args);},texSubImage2D(...args){updates.push(args);calls.push(args);},uniform1i(){},getUniformLocation(){++uniformLookups;return 1;},drawArrays(){calls.push('draw');},getError:()=>error};
  dom.window.HTMLCanvasElement.prototype.getContext=function(){return gl;};
  const context=vm.createContext({document:dom.window.document,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),performance:{now:()=>now},setInterval:fn=>{intervals.push(fn);return fn;},clearInterval(){},addEventListener(){},__BLOXD_NATIVE_CAPTURE__:{presentation:()=>({ready:ready&&phase==='streaming',epoch,revision,reason:'Incomplete native scene.'}),canvas:()=>source,setPresentation(owned,e,r){ownership.push(owned);return owned===true&&ready&&e===epoch&&r===revision;}},bloxdNative:{frame:async()=>{++requests;return pending?await pending:frame;}}});
  vm.runInContext(`(${install.toString()})()`,context);
  return {api:context.__BLOXD_NATIVE_PRESENTER__,source,dom,calls,shaders,ownership,allocations,updates,uniformLookups:()=>uniformLookups,requests:()=>requests,tick:()=>intervals[0](),setReady(v){ready=v;},setRevision(v){revision=v;},setFrame(v){frame=v;},setPhase(v){phase=v;},setEpoch(v){epoch=v;},advance(ms){now+=ms;},setError(v){error=v;},setPending(v){pending=v;},valid:()=>({sequence:1,epoch:1,revision:7,width:2,height:2,flags:1,pixels:new Uint8Array(16)})};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('native presentation replaces only the source canvas image after a valid frame and preserves DOM controls',async()=>{
  const h=await harness();try{h.tick();await settle();assert.equal(h.source.style.opacity,'0.75');h.setFrame(h.valid());h.tick();await settle();
    assert.equal(h.api.status().phase,'presenting');assert.equal(h.source.style.opacity,'0');const canvas=h.dom.window.document.querySelector('[data-bloxdy-native]');assert.equal(canvas.width,2);assert.equal(canvas.style.pointerEvents,'none');assert.equal(h.dom.window.document.getElementById('menu').textContent,'Menu');assert.equal(h.calls.at(-1),'draw');assert.equal(h.shaders.length,2);
    assert.equal(h.dom.window.document.querySelector('canvas'),h.source);
    h.api.stop();assert.equal(h.source.style.opacity,'0.75');assert.equal(h.dom.window.document.querySelector('[data-bloxdy-native]'),null);
  }finally{h.api.stop();h.dom.window.close();}
});
test('scene mismatch or leaving the world restores the source canvas',async()=>{
  const h=await harness();try{h.setFrame(h.valid());h.tick();await settle();h.setEpoch(2);h.tick();await settle();assert.equal(h.source.style.opacity,'0.75');assert.equal(h.api.status().phase,'waiting-world');h.setPhase('waiting-scene');h.tick();await settle();assert.equal(h.source.style.opacity,'0.75');}
  finally{h.api.stop();h.dom.window.close();}
});
test('malformed frames fail before hiding the original game canvas',async()=>{
  const h=await harness();try{h.setFrame({...h.valid(),pixels:new Uint8Array(1)});h.tick();await settle();assert.equal(h.api.status().phase,'fallback');assert.equal(h.source.style.opacity,'0.75');assert.equal(h.calls.length,0);}
  finally{h.api.stop();h.dom.window.close();}
});
test('slow native replies do not queue polls and shutdown ignores an outstanding reply',async()=>{
  const h=await harness();let resolve;h.setPending(new Promise(r=>resolve=r));try{h.tick();h.tick();h.api.stop();resolve(h.valid());await settle();assert.equal(h.source.style.opacity,'0.75');assert.equal(h.dom.window.document.querySelector('[data-bloxdy-native]'),null);}
  finally{h.api.stop();h.dom.window.close();}
});
test('native frame timeout and GL error restore the source display',async()=>{
  const h=await harness();try{h.setFrame(h.valid());h.tick();await settle();h.setFrame(null);h.advance(1600);h.tick();await settle();assert.equal(h.source.style.opacity,'0.75');assert.equal(h.api.status().phase,'fallback');h.setFrame({...h.valid(),sequence:2});h.setError(99);h.tick();await settle();assert.equal(h.source.style.opacity,'0.75');assert.equal(h.api.status().phase,'fallback');}
  finally{h.api.stop();h.dom.window.close();}
});

test('incomplete native scene keeps source ownership and avoids pixel IPC entirely',async()=>{
  const h=await harness();try{h.setReady(false);h.setFrame(h.valid());h.tick();await settle();assert.equal(h.api.status().phase,'source-fallback');assert.equal(h.source.style.opacity,'0.75');assert.equal(h.requests(),0);assert.equal(h.calls.length,0);assert.equal(h.ownership.at(-1),false);}
  finally{h.api.stop();h.dom.window.close();}
});

test('frames from an old draw-selection revision cannot conceal the current source world',async()=>{
  const h=await harness();try{h.setRevision(8);h.setFrame(h.valid());h.tick();await settle();assert.equal(h.source.style.opacity,'0.75');assert.equal(h.calls.length,0);assert.equal(h.ownership.at(-1),false);}
  finally{h.api.stop();h.dom.window.close();}
});

test('losing completeness during an awaited reply rejects that reply before presentation',async()=>{
  const h=await harness();let resolve;h.setPending(new Promise(r=>resolve=r));try{h.tick();h.setReady(false);resolve(h.valid());await settle();assert.equal(h.source.style.opacity,'0.75');assert.equal(h.calls.length,0);assert.equal(h.api.status().phase,'source-fallback');}
  finally{h.api.stop();h.dom.window.close();}
});

test('source selection can synchronously release the overlay before its next native poll',async()=>{
  const h=await harness();try{h.setFrame(h.valid());h.tick();await settle();assert.equal(h.ownership.at(-1),true);h.api.release('Selection changed.');assert.equal(h.source.style.opacity,'0.75');assert.equal(h.ownership.at(-1),false);assert.equal(h.dom.window.document.querySelector('[data-bloxdy-native]'),null);}
  finally{h.api.stop();h.dom.window.close();}
});

test('an old viewport frame is not stretched over a resized source canvas',async()=>{
  const h=await harness();try{h.source.width=3;h.setFrame(h.valid());h.tick();await settle();assert.equal(h.source.style.opacity,'0.75');assert.equal(h.calls.length,0);assert.equal(h.ownership.at(-1),false);assert.equal(h.api.status().phase,'waiting-world');}
  finally{h.api.stop();h.dom.window.close();}
});

test('same-sized frames reuse texture storage and uniform lookup; only a resize reallocates',async()=>{
  const h=await harness();try{for(let sequence=1;sequence<=5;++sequence){h.setFrame({...h.valid(),sequence});h.tick();await settle();}
    assert.equal(h.api.status().frames,5);assert.equal(h.allocations.length,1);assert.equal(h.updates.length,4);assert.equal(h.uniformLookups(),1);assert.equal(h.updates[0].at(-1).byteLength,16);
    h.source.width=3;h.setFrame({...h.valid(),sequence:6,width:3,pixels:new Uint8Array(24)});h.tick();await settle();assert.equal(h.api.status().frames,6);assert.equal(h.allocations.length,2);assert.equal(h.uniformLookups(),1);
  }finally{h.api.stop();h.dom.window.close();}
});
