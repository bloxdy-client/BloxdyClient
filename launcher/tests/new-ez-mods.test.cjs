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
  assert.equal(item.version,'1.0.6');
});
test('Zoomer uses the native camera, consumes wheel only while held, and restores FOV',t=>{
  const dom=new JSDOM('<html><head></head><body><div class="SettingsMenu" hidden><div class="MenuSideBarBody"></div><div class="SettingsMenuRight"></div></div><div id="game"></div></body></html>',{url:'https://bloxd.io/',runScripts:'outside-only'}),w=dom.window,d=w.document;
  t.after(()=>dom.window.close());
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
  // baseline. Preserve the latest native FOV when V is released.
  camera.fov=.75;tick(100);assert.ok(camera.fov<1);
  key('keyup','KeyV');assert.equal(w.__BLOXDY_ZOOMER__.diagnostics().active,false);
  wheel(-120);assert.equal(nativeWheel,2);
  tick(100);tick(100);tick(100);assert.ok(Math.abs(camera.fov-.75)<.001);assert.equal(d.getElementById('bloxdy-zoomer-indicator').hidden,true);
  w.dispatchEvent(new w.Event('pagehide'));assert.equal(callbacks.size,0);assert.equal(camera.fov,.75);dom.window.close();
});
test('Zoomer supports 100x and each normal wheel detent changes its target',t=>{
  const dom=new JSDOM('<html><head></head><body><div class="SettingsMenu" hidden><div class="MenuSideBarBody"></div><div class="SettingsMenuRight"></div></div><div id="game"></div></body></html>',{url:'https://bloxd.io/',runScripts:'outside-only'}),w=dom.window,d=w.document;
  t.after(()=>dom.window.close());
  const callbacks=new Set(),camera={fov:1},scene={meshes:[],materials:[],activeCamera:camera,onBeforeRenderObservable:{add(fn){callbacks.add(fn);return fn;},remove(fn){callbacks.delete(fn);}}};
  w.__BLOXD_MOD_HOST__={engine:()=>({singletons:{noa:{container:{},renderer:{scene}}}})};
  Object.defineProperty(d,'pointerLockElement',{configurable:true,value:d.getElementById('game')});
  let now=0;Object.defineProperty(w.performance,'now',{value:()=>now});
  w.eval(fs.readFileSync(path.join(root,'builtin-mods/zoomer.js'),'utf8'));d.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.equal(w.__BLOXDY_ZOOMER__.diagnostics().settings.maxZoom,50);
  const max=d.querySelector('[data-zoomer-field="maxZoom"]');assert.equal(max.max,'100');max.value='100';max.dispatchEvent(new w.Event('input'));
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
  for(const name of ['defaultZoom','lookSpeed','zoomInSeconds','zoomOutSeconds','wheelStep','maxZoom','smoothWheel','showPercent','showFactor','textSize','textX','textY','textColor'])assert.ok(d.querySelector(`[data-zoomer-field="${name}"]`),name);
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

test('Zoom runs on the Lite animation clock while native FOV is rewritten each frame, and releases on focus loss',t=>{
 const dom=new JSDOM('<html><head></head><body><div id="game"></div></body></html>',{url:'https://bloxd.io/',runScripts:'outside-only'}),w=dom.window,d=w.document;t.after(()=>w.close());
 let raf,now=0;w.requestAnimationFrame=fn=>{raf=fn;return 1;};w.cancelAnimationFrame=()=>{raf=null;};
 Object.defineProperty(w.performance,'now',{value:()=>now});
 Object.defineProperty(d,'pointerLockElement',{configurable:true,value:d.getElementById('game')});
 const camera={fov:1},scene={meshes:[],materials:[],activeCamera:camera,onBeforeRenderObservable:{add:()=>1,remove(){}}};
 const original=Object.getOwnPropertyDescriptor(camera,'fov');
 w.__BLOXD_MOD_HOST__={engine:()=>({singletons:{noa:{container:{},renderer:{scene}}}})};
 w.eval(fs.readFileSync(path.join(root,'builtin-mods/zoomer.js'),'utf8'));d.dispatchEvent(new w.Event('DOMContentLoaded'));
 w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyV',bubbles:true}));
 for(let n=0;n<40;n++){camera.fov=1.2;now+=16;raf();assert.ok(camera.fov<=1.2);}
 assert.ok(Math.abs(camera.fov-2*Math.atan(Math.tan(.6)/10))<.001);
 const movement=new w.MouseEvent('mousemove',{bubbles:true});Object.defineProperty(movement,'movementX',{configurable:true,value:30});Object.defineProperty(movement,'movementY',{configurable:true,value:12});w.dispatchEvent(movement);
 assert.ok(Math.abs(movement.movementX-15)<.01,'look speed is a direct multiplier');
 w.dispatchEvent(new w.Event('blur'));assert.equal(camera.fov,1.2,'focus loss restores immediately without another render frame');
 assert.equal(w.__BLOXDY_ZOOMER__.diagnostics().active,false);
 w.dispatchEvent(new w.Event('pagehide'));assert.deepEqual(Object.getOwnPropertyDescriptor(camera,'fov'),{...original,value:1.2});assert.equal(raf,null);
});

test('Zoom preserves inherited native FOV accessors and restores them when the active camera changes',t=>{
 const dom=new JSDOM('<html><head></head><body><div id="game"></div></body></html>',{url:'https://bloxd.io/',runScripts:'outside-only'}),w=dom.window,d=w.document;t.after(()=>w.close());
 let frame,now=0,native=1;const camera=Object.create({get fov(){return native;},set fov(v){native=v;}}),scene={meshes:[],materials:[],activeCamera:camera,onBeforeRenderObservable:{add:fn=>{frame=fn;return fn;},remove(){}}};
 Object.defineProperty(w.performance,'now',{value:()=>now});Object.defineProperty(d,'pointerLockElement',{configurable:true,value:d.getElementById('game')});
 w.__BLOXD_MOD_HOST__={engine:()=>({singletons:{noa:{container:{},renderer:{scene}}}})};
 w.eval(fs.readFileSync(path.join(root,'builtin-mods/zoomer.js'),'utf8'));d.dispatchEvent(new w.Event('DOMContentLoaded'));
 w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyV',bubbles:true}));now=100;frame();camera.fov=.9;assert.equal(native,.9);assert.ok(camera.fov<.9);
 scene.activeCamera={fov:1.1};frame();assert.equal(Object.hasOwn(camera,'fov'),false);assert.equal(camera.fov,.9);assert.equal(scene.activeCamera.fov,1.1);
 w.dispatchEvent(new w.Event('pagehide'));
});

test('Zoom owns V and the actual source model camera for both Lite and Babylon, even when a scene camera is present',t=>{
 const evidence=require('./zoom-camera-fixture.cjs');
 for(const fixture of evidence.versions)for(const backend of ['lite','babylon']){
  const dom=new JSDOM('<html><head></head><body><div id="game"></div><div class="SettingsMenu"></div></body></html>',{url:'https://bloxd.io/',runScripts:'outside-only'}),w=dom.window,d=w.document;t.after(()=>w.close());
  let now=0,raf;w.requestAnimationFrame=fn=>{raf=fn;return 1;};w.cancelAnimationFrame=()=>{};Object.defineProperty(w.performance,'now',{value:()=>now});
  Object.defineProperty(d,'pointerLockElement',{configurable:true,value:d.getElementById('game')});
  // The current source settings shell may exist while gameplay owns the lock.
  d.querySelector('.SettingsMenu').getClientRects=()=>[{}];
  const NativeCamera=w.eval('('+fixture.cameraClass+')'),camera=new NativeCamera(),model={view:{},nodes:{},meshes:{},[fixture.cameraField]:camera},renderer={model},nativeCamera=w.eval('('+fixture.cameraGetter+')');
  const staleSceneCamera={fov:1.1};if(backend==='babylon')renderer.scene={meshes:[],materials:[],activeCamera:staleSceneCamera,onBeforeRenderObservable:{add(){throw Error('Must use model camera, not scene render');},remove(){}}};
  w.__BLOXD_MOD_HOST__={engine:()=>({singletons:{noa:{container:{canvas:d.getElementById('game')},renderer}}})};
  w.eval(fs.readFileSync(path.join(root,'builtin-mods/zoomer.js'),'utf8'));d.dispatchEvent(new w.Event('DOMContentLoaded'));
  const diagnostics=()=>w.__BLOXDY_ZOOMER__.diagnostics();assert.equal(diagnostics().hasCamera,true,backend);assert.equal(diagnostics().backend,'model');
  let nativeDown=0,nativeUp=0,nativeWheel=0;d.addEventListener('keydown',()=>nativeDown++);d.addEventListener('keyup',()=>nativeUp++);d.addEventListener('wheel',()=>nativeWheel++);
  const key=type=>d.dispatchEvent(new w.KeyboardEvent(type,{code:'KeyV',bubbles:true,cancelable:true}));key('keydown');
  d.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyV',repeat:true,bubbles:true,cancelable:true}));assert.equal(nativeDown,0,'native Zoom handler never sees V or its repeats');
  for(let n=0;n<40;n++){nativeCamera(renderer).fov=1.2;now+=16;raf();}
  assert.ok(Math.abs(nativeCamera(renderer).fov-2*Math.atan(Math.tan(.6)/10))<.001,backend+' projection reads mod zoom');assert.equal(staleSceneCamera.fov,1.1);
  const target=diagnostics().target;d.dispatchEvent(new w.WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}));assert.ok(diagnostics().target>target);assert.equal(nativeWheel,0);
  key('keyup');assert.equal(nativeUp,0);for(let n=0;n<30;n++){now+=16;raf();}assert.equal(nativeCamera(renderer).fov,1.2);
  // A native renderer/model replacement revokes the old camera immediately.
  renderer.model={...model,[fixture.cameraField]:new NativeCamera()};now+=16;raf();assert.equal(Object.getOwnPropertyDescriptor(camera,'fov').get,undefined);assert.equal(camera.fov,1.2);
  key('keydown');assert.equal(diagnostics().active,true);w.dispatchEvent(new w.Event('pagehide'));assert.equal(renderer.model[fixture.cameraField].fov,.8);
 }
});

function zoomHarness(t,saved){
  const dom=new JSDOM('<html><head></head><body><div class="SettingsMenu"><div class="MenuSideBarBody"></div><div class="SettingsMenuRight"></div></div><div id="game"></div></body></html>',{url:'https://bloxd.io/',runScripts:'outside-only'}),w=dom.window,d=w.document;
  t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});
  let now=0,raf;w.requestAnimationFrame=fn=>{raf=fn;return 1;};w.cancelAnimationFrame=()=>{};Object.defineProperty(w.performance,'now',{value:()=>now});
  Object.defineProperty(d,'pointerLockElement',{configurable:true,value:d.getElementById('game')});
  const camera={fov:1.2,near:1/32,far:1e4,holderPosition:new Float64Array(3),holderRotation:new Float64Array(3)};
  w.__BLOXD_MOD_HOST__={engine:()=>({singletons:{noa:{container:{},renderer:{model:{view:{},nodes:{},meshes:{},camera}}}}})};
  if(saved)w.localStorage.setItem('bloxdy:zoomer:v1',JSON.stringify(saved));
  w.eval(fs.readFileSync(path.join(root,'builtin-mods/zoomer.js'),'utf8'));d.dispatchEvent(new w.Event('DOMContentLoaded'));
  return {w,d,camera,state:()=>w.__BLOXDY_ZOOMER__.diagnostics(),tick:ms=>{now+=ms;raf();},key:type=>w.dispatchEvent(new w.KeyboardEvent(type,{code:'KeyV',bubbles:true,cancelable:true})),wheel:deltaY=>w.dispatchEvent(new w.WheelEvent('wheel',{deltaY,bubbles:true,cancelable:true})),set(name,value){const input=d.querySelector(`[data-zoomer-field="${name}"]`);if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new w.Event(input.type==='checkbox'?'change':'input'));}};
}

test('Zoom text toggles independently, remembers its appearance, and removes the old width display',t=>{
  const h=zoomHarness(t,{showBlocks:true,textSize:40,textX:20,textY:70,textColor:'#35aaff'});
  h.key('keydown');h.tick(500);const hud=h.d.getElementById('bloxdy-zoomer-indicator');
  assert.equal(hud.textContent,'10.0× · 20%');assert.equal(hud.style.fontSize,'40px');assert.equal(hud.style.left,'20%');assert.equal(hud.style.top,'70%');assert.equal(hud.style.color,'rgb(53, 170, 255)');
  assert.equal(h.d.querySelector('[data-zoomer-field="showBlocks"]'),null);
  h.set('showFactor',false);assert.equal(hud.textContent,'20%');h.set('showPercent',false);assert.equal(hud.hidden,true);
  h.set('showFactor',true);assert.equal(hud.hidden,false);assert.equal(hud.textContent,'10.0×');
  h.set('textSize',60);h.set('textX',100);h.set('textY',0);h.set('textColor','#ff8800');
  assert.equal(hud.style.fontSize,'60px');assert.equal(hud.style.transform,'translate(-100%,-0%)');
  const saved=JSON.parse(h.w.localStorage.getItem('bloxdy:zoomer:v1'));assert.equal(saved.textColor,'#ff8800');assert.equal(saved.showBlocks,undefined);
  const page=h.d.querySelector('.zoomer-page');assert.equal(page.lastElementChild.classList.contains('zoomer-info'),true);
  assert.equal(h.w.getComputedStyle(hud).backgroundColor,'rgba(0, 0, 0, 0)');
});

test('Zoom settings recover after the native right pane or sidebar is replaced',async t=>{
  const h=zoomHarness(t),menu=h.d.querySelector('.SettingsMenu');
  menu.querySelector('[data-zoomer-category]').click();assert.equal(menu.classList.contains('zoomer-selected'),true);
  menu.querySelector('.SettingsMenuRight').outerHTML='<div class="SettingsMenuRight"><div class="SettingsMenuRightInner">Graphics</div></div>';
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(menu.querySelectorAll('[data-zoomer-category]').length,1);assert.equal(menu.querySelectorAll('.zoomer-page').length,1);
  menu.querySelector('.MenuSideBarBody').outerHTML='<div class="MenuSideBarBody"></div>';
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(menu.querySelectorAll('[data-zoomer-category]').length,1);assert.equal(menu.querySelectorAll('.zoomer-page').length,1);
  assert.equal(menu.classList.contains('zoomer-selected'),false);
});
test('Zoom defaults, constant magnification speed and exact in/out deadlines',t=>{
  const h=zoomHarness(t),settings=h.state().settings;
  assert.deepEqual(JSON.parse(JSON.stringify(settings)),{defaultZoom:10,lookSpeed:.5,zoomInSeconds:.5,zoomOutSeconds:.1,wheelStep:5,maxZoom:50,wheelSeconds:.2,smoothWheel:true,showPercent:true,showFactor:true,textSize:24,textX:50,textY:85,textColor:'#ffffff'});
  h.key('keydown');for(const expected of [2.8,4.6,6.4,8.2,10]){h.tick(100);assert.ok(Math.abs(h.state().current-expected)<1e-10);}
  assert.match(h.d.getElementById('bloxdy-zoomer-indicator').textContent,/20%/);
  h.key('keyup');h.tick(50);assert.equal(h.state().current,5.5);h.tick(50);assert.equal(h.state().current,1);assert.equal(h.camera.fov,1.2);
});
test('Instant wheel cancels in-flight animation and cannot bounce across render/native FOV writes',t=>{
  const h=zoomHarness(t);h.set('smoothWheel',false);h.key('keydown');h.tick(40);h.wheel(-100);assert.equal(h.state().current,15);
  for(let i=0;i<8;i++){h.camera.fov=1.2;h.tick(17);assert.equal(h.state().current,15);}
  for(const delta of [100,-100,100,100,-100]){h.wheel(delta);const target=h.state().target;assert.equal(h.state().current,target);h.tick(17);assert.equal(h.state().current,target);}
  assert.equal(h.d.querySelector('[data-zoomer-field="wheelSeconds"]').disabled,true);
});
test('Wheel duration, retargeting, disabled smooth timing and high-zoom projection remain exact',t=>{
  const h=zoomHarness(t);h.key('keydown');h.tick(500);h.set('wheelSeconds',1);h.wheel(-100);h.tick(250);assert.equal(h.state().current,11.25);
  h.wheel(100);h.tick(500);assert.equal(h.state().current,10.625);h.tick(500);assert.equal(h.state().current,10);
  h.set('wheelSeconds',0);h.wheel(-100);assert.equal(h.state().current,15);
  h.set('maxZoom',100);h.set('smoothWheel',false);
  let previous=0;for(const magnification of [30,50,100]){while(h.state().target<magnification)h.wheel(-100);const projectedScale=Math.tan(1.2/2)/Math.tan(h.camera.fov/2);assert.ok(Math.abs(projectedScale-magnification)<1e-10);assert.ok(projectedScale>previous);previous=projectedScale;h.tick(100);assert.equal(h.state().current,magnification);}
  assert.match(h.d.getElementById('bloxdy-zoomer-indicator').textContent,/100%/);h.wheel(-100);assert.equal(h.state().current,100);
  h.set('maxZoom',50);assert.equal(h.state().current,50);assert.match(h.d.getElementById('bloxdy-zoomer-indicator').textContent,/100%/);
});
test('Bloxd controls have native markup, accessible keyboard sliders and no reset; look speed 1x is unscaled',t=>{
  const h=zoomHarness(t);assert.equal(h.d.querySelectorAll('.zoomer-page .rangeslider__handle').length,10);assert.equal(h.d.querySelectorAll('.zoomer-page .rc-checkbox-inner').length,3);assert.doesNotMatch(h.d.querySelector('.zoomer-page').textContent,/Reset/);
  const wheelRow=h.d.querySelector('[data-zoomer-field="wheelSeconds"]').closest('.SettingBox'),handle=wheelRow.querySelector('[role=slider]');
  handle.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'End'}));assert.equal(h.state().settings.wheelSeconds,1);
  h.set('smoothWheel',false);assert.equal(handle.getAttribute('aria-disabled'),'true');handle.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Home'}));assert.equal(h.state().settings.wheelSeconds,1);
  h.set('lookSpeed',1);h.key('keydown');h.tick(500);
  const move=new h.w.MouseEvent('mousemove');Object.defineProperties(move,{movementX:{configurable:true,value:30},movementY:{configurable:true,value:12}});h.w.dispatchEvent(move);assert.equal(move.movementX,30);assert.equal(move.movementY,12);
  h.set('lookSpeed',.5);const half=new h.w.MouseEvent('pointermove');Object.defineProperties(half,{movementX:{configurable:true,value:30},movementY:{configurable:true,value:12}});h.w.dispatchEvent(half);assert.equal(half.movementX,15);assert.equal(half.movementY,6);
});
