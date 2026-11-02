/* Bloxdy Zoomer: temporary camera field-of-view control. */
(() => {
  'use strict';
  const KEY='bloxdy:zoomer:v1';
  const defaults={defaultZoom:3,lookSpeed:0.5,zoomInSeconds:0.18,zoomOutSeconds:0.18,wheelStep:1,maxZoom:100,smoothWheel:true,showPercent:true,showBlocks:false};
  const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
  function normalize(raw){const source=raw&&typeof raw==='object'?raw:{};const maxZoom=clamp(source.maxZoom,2,100,defaults.maxZoom);return {
    defaultZoom:Math.min(maxZoom,clamp(source.defaultZoom,1.25,100,defaults.defaultZoom)),
    lookSpeed:clamp(source.lookSpeed,0,1,defaults.lookSpeed),
    zoomInSeconds:clamp(source.zoomInSeconds,0,3,defaults.zoomInSeconds),
    zoomOutSeconds:clamp(source.zoomOutSeconds,0,3,defaults.zoomOutSeconds),
    wheelStep:clamp(source.wheelStep,.1,20,defaults.wheelStep),maxZoom,
    smoothWheel:source.smoothWheel!==false,showPercent:source.showPercent!==false,showBlocks:source.showBlocks===true};}
  let settings;try{settings=normalize(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{settings={...defaults};}
  const own=o=>Object.values(Object.getOwnPropertyDescriptors(o||{})).filter(d=>'value'in d).map(d=>d.value);
  const isScene=o=>Array.isArray(o?.meshes)&&Array.isArray(o?.materials)&&typeof o?.onBeforeRenderObservable?.add==='function';
  let scene=null,camera=null,observer=null,connectionTimer=null,uiObserver=null,style=null,indicator=null;
  let pressed=false,target=1,current=1,baseFov=null,lastFov=null,lastFrame=0,wheelUnits=0,wheelTransition=false;
  function findCamera(){
    const engine=globalThis.__BLOXD_MOD_HOST__?.engine(),singleton=engine?.singletons;
    if(!singleton)return null;
    const client=singleton.bloxd?.client;
    for(const noa of [...new Set([...own(singleton),...own(client)])]){
      if(!noa||typeof noa!=='object'||!noa.container)continue;
      for(const renderer of own(noa)){
        if(!renderer||typeof renderer!=='object'||Array.isArray(renderer))continue;
        const found=own(renderer).find(isScene);
        if(found?.activeCamera&&Number.isFinite(found.activeCamera.fov)&&found.activeCamera.fov>0)return found;
      }
    }
    return null;
  }
  const fovFor=(base,zoom)=>2*Math.atan(Math.tan(base/2)/zoom);
  function show(){
    if(!indicator)return;
    indicator.hidden=!pressed;
    if(!pressed)return;
    const parts=[];
    if(settings.showPercent)parts.push(Math.round(100*(current-1)/(settings.maxZoom-1))+'% of max zoom');
    if(settings.showBlocks){
      const fov=baseFov&&fovFor(baseFov,current);
      const canvas=scene?.getEngine?.().getRenderingCanvas?.();
      const aspect=canvas?.clientWidth&&canvas?.clientHeight?canvas.clientWidth/canvas.clientHeight:canvas?.width&&canvas?.height?canvas.width/canvas.height:1;
      if(fov&&Number.isFinite(aspect))parts.push((20*Math.tan(fov/2)*aspect).toFixed(1)+' blocks wide at 10 blocks');
    }
    indicator.textContent=parts.join(' · ')||current.toFixed(1)+'×';
  }
  function release(){pressed=false;target=1;wheelUnits=0;wheelTransition=false;if(settings.zoomOutSeconds===0&&camera&&baseFov){current=1;camera.fov=baseFov;lastFov=baseFov;}show();}
  function detach(){if(scene&&observer!==null)scene.onBeforeRenderObservable.remove(observer);if(camera&&baseFov&&Number.isFinite(baseFov))camera.fov=baseFov;scene=camera=observer=null;baseFov=lastFov=null;current=target=1;lastFrame=0;release();}
  function frame(){
    if(!scene||!camera||scene.activeCamera!==camera||!Number.isFinite(camera.fov)){detach();return;}
    if(!pressed&&current===1){
      // Restore once, then leave the unzoomed camera entirely to Bloxd.
      if(lastFov!==null){camera.fov=baseFov;lastFov=null;}
      else baseFov=camera.fov;
      lastFrame=performance.now();return;
    }
    const now=performance.now(),dt=lastFrame?Math.min(.1,Math.max(0,(now-lastFrame)/1000)):0;lastFrame=now;
    const duration=pressed?(wheelTransition?(settings.smoothWheel?.12:0):settings.zoomInSeconds):settings.zoomOutSeconds;
    if(duration===0)current=target;
    else current+= (target-current)*Math.min(1,dt/duration*4);
    if(Math.abs(current-target)<.001)current=target;
    camera.fov=fovFor(baseFov,current);lastFov=camera.fov;show();
  }
  function connect(){
    const found=findCamera();if(found===scene&&found?.activeCamera===camera)return;
    detach();if(!found)return;
    scene=found;camera=found.activeCamera;baseFov=camera.fov;
    observer=scene.onBeforeRenderObservable.add(frame);
  }
  function playing(){return !!(scene&&camera&&document.pointerLockElement&&document.pointerLockElement.isConnected&&![...document.querySelectorAll('.SettingsMenu')].some(menu=>menu.getClientRects().length));}
  const isZoomKey=e=>e.code==='KeyV'||String(e.key||'').toLowerCase()==='v';
  function onKeyDown(e){if(!isZoomKey(e)||e.repeat||!playing()||e.altKey||e.ctrlKey||e.metaKey||e.target?.closest?.('input,textarea,[contenteditable=true]'))return;e.preventDefault();e.stopImmediatePropagation();if(current===1)baseFov=camera.fov;pressed=true;wheelTransition=false;target=settings.defaultZoom;show();}
  function onKeyUp(e){if(isZoomKey(e)){if(pressed){e.preventDefault();e.stopImmediatePropagation();}release();}}
  function onWheel(e){if(!pressed)return;if(!document.pointerLockElement){release();return;}e.preventDefault();e.stopImmediatePropagation();const units=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?window.innerHeight:1);wheelUnits+=units;
    const threshold=e.deltaMode===0&&Math.abs(units)<10?10:1;
    if(Math.abs(wheelUnits)>=threshold){const direction=Math.sign(wheelUnits);const steps=Math.max(1,Math.round(Math.abs(wheelUnits)/(e.deltaMode===0?100:16)));target=clamp(target-direction*settings.wheelStep*steps,1,settings.maxZoom,target);wheelUnits=0;wheelTransition=true;}
    if(!settings.smoothWheel)current=target;show();}
  function onMove(e){if(!pressed||settings.lookSpeed===1)return;const speed=settings.lookSpeed;
    if(speed===0){e.stopImmediatePropagation();return;}
    try{Object.defineProperty(e,'movementX',{configurable:true,value:e.movementX*speed});Object.defineProperty(e,'movementY',{configurable:true,value:e.movementY*speed});}catch{/* The camera remains usable if a browser makes these fields immutable. */}
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}}
  function change(name,value){settings=normalize({...settings,[name]:value});if(pressed)target=clamp(target,1,settings.maxZoom,1);save();sync();show();}
  function element(tag,cls,text){const e=document.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;}
  function sync(){for(const input of document.querySelectorAll('[data-zoomer-field]')){const name=input.dataset.zoomerField;if(input.type==='checkbox')input.checked=settings[name];else input.value=settings[name];const output=input.closest('.SettingBox')?.querySelector('output');if(output)output.textContent=String(settings[name])+(name.endsWith('Seconds')?' s':name==='lookSpeed'?'×':'×');}}
  function mount(){for(const menu of document.querySelectorAll('.SettingsMenu')){
    const sidebar=menu.querySelector('.MenuSideBarSection')||menu.querySelector('.MenuSideBarBody'),right=menu.querySelector('.SettingsMenuRight');if(!sidebar||!right||menu.querySelector('[data-zoomer-category]'))continue;
    const tab=element('div','MenuSideBarBodyTab');tab.dataset.zoomerCategory='true';tab.tabIndex=0;tab.setAttribute('role','tab');tab.textContent='Zoomer';
    const page=element('div','SettingsMenuRightInner zoomer-page');page.setAttribute('role','tabpanel');page.setAttribute('aria-label','Zoomer');
    const group=element('div','SettingBoxGroup');page.append(group);
    function slider(name,label,min,max,step){const row=element('div','SettingBox SettingsSliderDiv'),title=element('label','SliderText',label+': '),output=element('output'),input=element('input');input.type='range';input.min=min;input.max=max;input.step=step;input.dataset.zoomerField=name;input.setAttribute('aria-label',label);title.append(output);row.append(title,input);group.append(row);input.addEventListener('input',()=>change(name,Number(input.value)));}
    function toggle(name,label){const row=element('div','SettingBox CheckboxContainer'),title=element('label','CheckboxInputAndText'),input=element('input');input.type='checkbox';input.dataset.zoomerField=name;title.append(input,document.createTextNode(' '+label));row.append(title);group.append(row);input.addEventListener('change',()=>change(name,input.checked));}
    slider('defaultZoom','Default zoom',1.25,100,.25);slider('lookSpeed','Look speed while zoomed',0,1,.05);slider('zoomInSeconds','Zoom in time',0,3,.05);slider('zoomOutSeconds','Zoom out time',0,3,.05);slider('wheelStep','Zoom per wheel step',.1,20,.1);slider('maxZoom','Maximum zoom',2,100,.5);
    toggle('smoothWheel','Smooth wheel zoom');toggle('showPercent','Show zoom percentage');toggle('showBlocks','Show visible width in blocks');
    tab.addEventListener('click',()=>{for(const other of menu.querySelectorAll('.ActiveMenuSideBarBodyTab'))other.classList.remove('ActiveMenuSideBarBodyTab');menu.classList.remove('grassify-selected','blm-selected','bvfx-shader-selected');menu.classList.add('zoomer-selected');tab.classList.add('ActiveMenuSideBarBodyTab');sync();});
    tab.addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();tab.click();}});
    sidebar.addEventListener('click',e=>{if(e.target.closest?.('.MenuSideBarBodyTab')&&!tab.contains(e.target))menu.classList.remove('zoomer-selected');},true);
    sidebar.append(tab);right.append(page);
  }sync();}
  function boot(){style=element('style');style.textContent='.SettingsMenu.zoomer-selected .SettingsMenuRight>:not(.zoomer-page){display:none!important}.SettingsMenu:not(.zoomer-selected) .zoomer-page{display:none!important}.zoomer-page input[type=range]{width:min(24rem,100%);accent-color:#eabf54}.zoomer-page .SettingBox{display:flex;align-items:center;justify-content:space-between;gap:1rem}.zoomer-page .CheckboxInputAndText{cursor:pointer}#bloxdy-zoomer-indicator{position:fixed;z-index:2147483646;left:50%;bottom:15%;transform:translateX(-50%);padding:.3rem .55rem;color:#fff;background:#111a;border-radius:.35rem;font:600 12px/1.3 sans-serif;pointer-events:none;white-space:nowrap}#bloxdy-zoomer-indicator[hidden]{display:none!important}';document.head.append(style);
    indicator=element('div');indicator.id='bloxdy-zoomer-indicator';indicator.hidden=true;document.body.append(indicator);mount();uiObserver=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.SettingsMenu,.MenuSideBarBody,.SettingsMenuRight')||n.querySelector?.('.SettingsMenu,.MenuSideBarBody,.SettingsMenuRight')))))mount();});uiObserver.observe(document.body,{childList:true,subtree:true});}
  addEventListener('keydown',onKeyDown,true);addEventListener('keyup',onKeyUp,true);addEventListener('wheel',onWheel,{capture:true,passive:false});addEventListener('pointermove',onMove,true);addEventListener('mousemove',onMove,true);
  addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement)release();});
  connectionTimer=setInterval(connect,500);connect();
  addEventListener('pagehide',()=>{clearInterval(connectionTimer);detach();uiObserver?.disconnect();style?.remove();indicator?.remove();document.querySelectorAll('[data-zoomer-category],.zoomer-page').forEach(e=>e.remove());},{once:true});
  globalThis.__BLOXDY_ZOOMER__={diagnostics:()=>({active:pressed,current,target,hasCamera:!!camera,settings:{...settings}})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
