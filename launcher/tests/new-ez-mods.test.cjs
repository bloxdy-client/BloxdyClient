'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
test('Existing Zoomer installations receive the repaired source',()=>{
  const packageFile=path.join(root,'catalog/bloxd-zoomer-1.0.0.bnmod');
  const old=JSON.parse(fs.readFileSync(packageFile,'utf8'));
  const installed=Buffer.from(old.files.find(file=>file.path==='zoomer.js').data,'base64').toString();
  const current=fs.readFileSync(path.join(root,'builtin-mods/zoomer.js'),'utf8');
  assert.notEqual(installed,current);
  assert.equal(require('../adapters.cjs').managedSource('bloxd-zoomer','zoomer.js',installed),current);
  const item=JSON.parse(fs.readFileSync(path.join(root,'catalog/catalog.json'),'utf8')).items.find(item=>item.id==='bloxd-zoomer');
  assert.equal(item.version,'1.0.1');
});
test('Zoomer uses the native camera, consumes wheel only while held, and restores FOV',()=>{
  const dom=new JSDOM('<html><head></head><body><div class="SettingsMenu" hidden><div class="MenuSideBarBody"></div><div class="SettingsMenuRight"></div></div><div id="game"></div></body></html>',{url:'https://bloxd.io/',runScripts:'outside-only'}),w=dom.window,d=w.document;
  const callbacks=new Set(),camera={fov:1},canvas={clientWidth:1600,clientHeight:900};
  const scene={meshes:[],materials:[],activeCamera:camera,onBeforeRenderObservable:{add(fn){callbacks.add(fn);return fn;},remove(fn){callbacks.delete(fn);}},getEngine(){return {getRenderingCanvas(){return canvas;}}}};
  w.__BLOXD_MOD_HOST__={engine:()=>({singletons:{noa:{container:{},renderer:{scene}}}})};
  let now=0;Object.defineProperty(w.performance,'now',{value:()=>now});
  Object.defineProperty(d,'pointerLockElement',{configurable:true,value:d.getElementById('game')});
  let nativeWheel=0;w.addEventListener('wheel',()=>nativeWheel++);
  w.eval(fs.readFileSync(path.join(root,'builtin-mods/zoomer.js'),'utf8'));d.dispatchEvent(new w.Event('DOMContentLoaded'));
  const tick=ms=>{now+=ms;for(const cb of callbacks)cb();};
  const key=(type,code)=>w.dispatchEvent(new w.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));
  const wheel=deltaY=>w.dispatchEvent(new w.WheelEvent('wheel',{deltaY,bubbles:true,cancelable:true}));
  assert.equal(callbacks.size,1);
  wheel(-120);assert.equal(nativeWheel,1);
  key('keydown','KeyV');tick(16);tick(100);assert.ok(camera.fov<1);
  assert.equal(d.getElementById('bloxdy-zoomer-indicator').hidden,false);
  const before=w.__BLOXDY_ZOOMER__.diagnostics().target;wheel(-120);assert.equal(nativeWheel,1);assert.ok(w.__BLOXDY_ZOOMER__.diagnostics().target>before);
  wheel(120);assert.equal(w.__BLOXDY_ZOOMER__.diagnostics().target,before);
  // Native camera updates between render callbacks used to corrupt the
  // baseline and leave the player zoomed in after releasing V.
  camera.fov=.75;tick(100);assert.ok(camera.fov<1);
  key('keyup','KeyV');assert.equal(w.__BLOXDY_ZOOMER__.diagnostics().active,false);
  wheel(-120);assert.equal(nativeWheel,2);
  tick(100);tick(100);tick(100);assert.ok(Math.abs(camera.fov-1)<.001);assert.equal(d.getElementById('bloxdy-zoomer-indicator').hidden,true);
  w.dispatchEvent(new w.Event('pagehide'));assert.equal(callbacks.size,0);assert.equal(camera.fov,1);dom.window.close();
});
test('Zoomer supports 100x and each normal wheel detent changes its target',t=>{
  const dom=new JSDOM('<html><head></head><body><div class="SettingsMenu" hidden><div class="MenuSideBarBody"></div><div class="SettingsMenuRight"></div></div><div id="game"></div></body></html>',{url:'https://bloxd.io/',runScripts:'outside-only'}),w=dom.window,d=w.document;
  t.after(()=>dom.window.close());
  const callbacks=new Set(),camera={fov:1},scene={meshes:[],materials:[],activeCamera:camera,onBeforeRenderObservable:{add(fn){callbacks.add(fn);return fn;},remove(fn){callbacks.delete(fn);}}};
  w.__BLOXD_MOD_HOST__={engine:()=>({singletons:{noa:{container:{},renderer:{scene}}}})};
  Object.defineProperty(d,'pointerLockElement',{configurable:true,value:d.getElementById('game')});
  let now=0;Object.defineProperty(w.performance,'now',{value:()=>now});
  w.eval(fs.readFileSync(path.join(root,'builtin-mods/zoomer.js'),'utf8'));d.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.equal(w.__BLOXDY_ZOOMER__.diagnostics().settings.maxZoom,100);
  const max=d.querySelector('[data-zoomer-field="maxZoom"]');assert.equal(max.max,'100');
  const wheel=deltaY=>w.dispatchEvent(new w.WheelEvent('wheel',{deltaY,bubbles:true,cancelable:true}));
  w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyV',bubbles:true}));
  let target=w.__BLOXDY_ZOOMER__.diagnostics().target;
  // A newly mounted settings shell must not silently deactivate the wheel
  // while the game still owns pointer lock and V remains held.
  d.querySelector('.SettingsMenu').getClientRects=()=>[{}];
  wheel(-1);assert.ok(w.__BLOXDY_ZOOMER__.diagnostics().target===target);
  for(let n=0;n<10;n++)wheel(-1);
  assert.ok(w.__BLOXDY_ZOOMER__.diagnostics().target>target);
  target=w.__BLOXDY_ZOOMER__.diagnostics().target;wheel(-100);assert.ok(w.__BLOXDY_ZOOMER__.diagnostics().target>target);
  for(let n=0;n<150;n++)wheel(-100);
  assert.equal(w.__BLOXDY_ZOOMER__.diagnostics().target,100);
  now+=500;for(const cb of callbacks)cb();now+=500;for(const cb of callbacks)cb();assert.ok(camera.fov<.1);
  w.dispatchEvent(new w.KeyboardEvent('keyup',{code:'KeyV',bubbles:true}));
  w.dispatchEvent(new w.Event('pagehide'));dom.window.close();
});
test('Zoomer settings expose all requested controls and zero look speed blocks movement',()=>{
  const dom=new JSDOM('<html><head></head><body><div class="SettingsMenu"><div class="MenuSideBarBody"></div><div class="SettingsMenuRight"></div></div><div id="game"></div></body></html>',{url:'https://bloxd.io/',runScripts:'outside-only'}),w=dom.window,d=w.document;
  const scene={meshes:[],materials:[],activeCamera:{fov:1},onBeforeRenderObservable:{add(fn){return fn;},remove(){}}};
  w.__BLOXD_MOD_HOST__={engine:()=>({singletons:{noa:{container:{},renderer:{scene}}}})};
  Object.defineProperty(d,'pointerLockElement',{configurable:true,value:d.getElementById('game')});
  w.eval(fs.readFileSync(path.join(root,'builtin-mods/zoomer.js'),'utf8'));d.dispatchEvent(new w.Event('DOMContentLoaded'));
  for(const name of ['defaultZoom','lookSpeed','zoomInSeconds','zoomOutSeconds','wheelStep','maxZoom','smoothWheel','showPercent','showBlocks'])assert.ok(d.querySelector(`[data-zoomer-field="${name}"]`),name);
  const speed=d.querySelector('[data-zoomer-field="lookSpeed"]');speed.value='0';speed.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyV',bubbles:true}));
  let reached=false;w.addEventListener('mousemove',()=>{reached=true;});
  const move=new w.MouseEvent('mousemove',{bubbles:true});Object.defineProperty(move,'movementX',{value:10});Object.defineProperty(move,'movementY',{value:10});w.dispatchEvent(move);
  assert.equal(reached,false);assert.equal(w.__BLOXDY_ZOOMER__.diagnostics().settings.lookSpeed,0);
  w.dispatchEvent(new w.Event('pagehide'));dom.window.close();
});
test('Factory Buffer Reuse skips only exact duplicate writes and invalidates on native changes',()=>{
  const calls=[],listeners={};
  class GL {constructor(){this.ARRAY_BUFFER=1;this.ELEMENT_ARRAY_BUFFER=2;this.COPY_WRITE_BUFFER=3;this.bound=new Map();this.gpu=new Map();}
    bindBuffer(target,buffer){this.bound.set(target,buffer);}
    bufferData(target,data){this.gpu.set(this.bound.get(target),new Uint8Array(data));calls.push('data');}
    bufferSubData(target,offset,data){const old=this.gpu.get(this.bound.get(target));old.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),offset);calls.push('sub');}
    copyBufferSubData(){calls.push('copy');}
    deleteBuffer(buffer){this.gpu.delete(buffer);calls.push('delete');}
  }
  const original=GL.prototype.bufferSubData;
  const sandbox={WebGLRenderingContext:GL,performance:{now:()=>0},addEventListener:(name,fn)=>listeners[name]=fn};vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root,'builtin-mods/factory-buffer-reuse.js'),'utf8'),sandbox);
  const gl=new GL(),buffer={};gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(4096));
  const bytes=new Uint8Array(2048).fill(7);gl.bufferSubData(gl.ARRAY_BUFFER,0,bytes);gl.bufferSubData(gl.ARRAY_BUFFER,0,bytes.slice());assert.equal(calls.filter(x=>x==='sub').length,1);
  const changed=bytes.slice();changed[100]=8;gl.bufferSubData(gl.ARRAY_BUFFER,0,changed);assert.equal(calls.filter(x=>x==='sub').length,2);
  gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(4096));gl.bufferSubData(gl.ARRAY_BUFFER,0,changed);assert.equal(calls.filter(x=>x==='sub').length,3);
  gl.bindBuffer(gl.COPY_WRITE_BUFFER,buffer);gl.copyBufferSubData(gl.ARRAY_BUFFER,gl.COPY_WRITE_BUFFER,0,0,4);gl.bufferSubData(gl.ARRAY_BUFFER,0,changed);assert.equal(calls.filter(x=>x==='sub').length,4);
  listeners.pagehide();assert.equal(GL.prototype.bufferSubData,original);
});
