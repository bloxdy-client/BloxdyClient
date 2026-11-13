/* Bloxdy Zoomer: temporary camera field-of-view control. */
(() => {
  'use strict';
  const KEY='bloxdy:zoomer:v1';
  const defaults={defaultZoom:10,lookSpeed:0.5,zoomInSeconds:0.5,zoomOutSeconds:0.1,wheelStep:5,maxZoom:50,wheelSeconds:0.2,smoothWheel:true,showPercent:true,showFactor:true,textSize:24,textX:50,textY:85,textColor:'#ffffff'};
  const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
  function normalize(raw){const source=raw&&typeof raw==='object'?raw:{};const maxZoom=clamp(source.maxZoom,2,100,defaults.maxZoom);return {
    defaultZoom:Math.min(maxZoom,clamp(source.defaultZoom,1.25,100,defaults.defaultZoom)),
    lookSpeed:clamp(source.lookSpeed,0,1,defaults.lookSpeed),
    zoomInSeconds:clamp(source.zoomInSeconds,0,3,defaults.zoomInSeconds),
    zoomOutSeconds:clamp(source.zoomOutSeconds,0,3,defaults.zoomOutSeconds),
    wheelStep:clamp(source.wheelStep,.1,20,defaults.wheelStep),maxZoom,wheelSeconds:clamp(source.wheelSeconds,0,1,defaults.wheelSeconds),
    smoothWheel:source.smoothWheel!==false,showPercent:source.showPercent!==false,showFactor:source.showFactor!==false,
    textSize:clamp(source.textSize,12,96,defaults.textSize),textX:clamp(source.textX,0,100,defaults.textX),textY:clamp(source.textY,0,100,defaults.textY),
    textColor:/^#[0-9a-f]{6}$/i.test(source.textColor)?source.textColor:defaults.textColor};}
  let settings;try{settings=normalize(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{settings={...defaults};}
  const own=o=>Object.values(Object.getOwnPropertyDescriptors(o||{})).filter(d=>'value'in d).map(d=>d.value);
  const isScene=o=>Array.isArray(o?.meshes)&&Array.isArray(o?.materials)&&typeof o?.onBeforeRenderObservable?.add==='function';
  let scene=null,camera=null,binding=null,observer=null,connectionTimer=null,uiObserver=null,style=null,indicator=null;
  let pressed=false,target=1,current=1,baseFov=null,restoreFov=null,animation=0,wheelUnits=0,transition=null;
  function advance(now=performance.now()){
    if(!transition)return;
    const progress=Math.min(1,Math.max(0,(now-transition.start)/(transition.seconds*1000)));
    current=transition.from+(target-transition.from)*progress;
    if(progress===1){current=target;transition=null;}
  }
  function retarget(value,seconds){advance();target=value;transition=seconds>0&&current!==target?{from:current,start:performance.now(),seconds}:null;if(!transition)current=target;}
  const isModelCamera=o=>o&&Number.isFinite(o.fov)&&o.fov>0&&Number.isFinite(o.near)&&Number.isFinite(o.far)&&o.near>0&&o.far>o.near&&o.holderPosition?.length===3&&o.holderRotation?.length===3;
  function findCamera(){
    const singleton=globalThis.__BLOXD_MOD_HOST__?.engine()?.singletons;
    if(!singleton)return null;
    const candidates=[],fallback=[];
    for(const noa of new Set([...own(singleton),...own(singleton.bloxd?.client)])){
      if(!noa||typeof noa!=='object'||!noa.container)continue;
      for(const renderer of new Set(own(noa))){
        if(!renderer||typeof renderer!=='object'||Array.isArray(renderer))continue;
        // Bloxd's renderer always updates model camera FOV first, then copies
        // it to the Babylon camera or builds the Lite projection from it.
        // The camera field itself is minified; identify its source structure.
        const model=renderer.model;
        if(model?.view&&model.nodes&&model.meshes){
          for(const value of new Set(own(model).filter(isModelCamera)))if(!candidates.some(c=>c.camera===value))candidates.push({camera:value,renderer,model,scene:null,canvas:noa.container.canvas,backend:'model'});
        }
        for(const found of own(renderer).filter(isScene))if(found.activeCamera&&Number.isFinite(found.activeCamera.fov)&&found.activeCamera.fov>0&&!fallback.some(c=>c.camera===found.activeCamera))fallback.push({camera:found.activeCamera,renderer,scene:found,canvas:noa.container.canvas,backend:'scene'});
      }
    }
    if(candidates.length)return candidates.length===1?candidates[0]:null;
    return fallback.length===1?fallback[0]:null;
  }
  function ownsCamera(){return binding?.backend==='model'?binding.renderer.model===binding.model&&own(binding.model).includes(camera):scene?.activeCamera===camera;}
  const fovFor=(base,zoom)=>2*Math.atan(Math.tan(base/2)/zoom);
  function show(){
    if(!indicator)return;
    indicator.hidden=!pressed||!settings.showFactor&&!settings.showPercent;
    indicator.style.fontSize=settings.textSize+'px';indicator.style.left=settings.textX+'%';indicator.style.top=settings.textY+'%';
    indicator.style.transform=`translate(-${settings.textX}%,-${settings.textY}%)`;indicator.style.color=settings.textColor;
    if(!pressed)return;
    const parts=[];
    if(settings.showFactor)parts.push(current.toFixed(current<10?2:1)+'\u00d7');
    if(settings.showPercent)parts.push(Math.min(100,Math.max(0,Math.round(current/settings.maxZoom*100)))+'%');
    indicator.textContent=parts.join(' \u00b7 ');
  }
  function release(immediate=false){if(!pressed&&!immediate)return;pressed=false;wheelUnits=0;retarget(1,immediate?0:settings.zoomOutSeconds);show();}
  function bindFov(value){
    const original=Object.getOwnPropertyDescriptor(value,'fov');
    let owner=value,descriptor=original;
    while(!descriptor&&(owner=Object.getPrototypeOf(owner)))descriptor=Object.getOwnPropertyDescriptor(owner,'fov');
    if(original?.configurable===false||descriptor&&('value'in descriptor?!descriptor.writable:!descriptor.get||!descriptor.set))return false;
    let native=value.fov;
    const read=()=>descriptor?.get?descriptor.get.call(value):native;
    const get=()=>{advance();baseFov=read();return current===1?baseFov:fovFor(baseFov,current);};
    const set=v=>{if(descriptor?.set)descriptor.set.call(value,v);else native=v;baseFov=read();};
    Object.defineProperty(value,'fov',{configurable:true,enumerable:descriptor?.enumerable??true,get,set});
    restoreFov=()=>{
      // Preserve the latest native FOV, including sprint/settings changes.
      const active=Object.getOwnPropertyDescriptor(value,'fov');
      if(active?.get!==get)return;
      const latest=read();delete value.fov;
      if(original)Object.defineProperty(value,'fov','value'in original?{...original,value:latest}:original);
      else if(!descriptor?.set)value.fov=latest;
    };
    baseFov=read();return true;
  }
  function detach(){if(scene&&observer!==null)scene.onBeforeRenderObservable.remove(observer);release(true);restoreFov?.();restoreFov=null;scene=camera=binding=observer=null;baseFov=null;}
  function frame(){
    if(!camera||!ownsCamera()||!Number.isFinite(camera.fov)){detach();return;}
    if(pressed&&!document.pointerLockElement)release(true);
    advance();
    show();
  }
  function connect(){
    const found=findCamera();if(found?.camera===camera&&ownsCamera())return;
    detach();if(!found)return;
    if(!bindFov(found.camera))return;binding=found;scene=found.scene;camera=found.camera;
    if(scene)observer=scene.onBeforeRenderObservable.add(frame);
  }
  function playing(){return !!(camera&&ownsCamera()&&document.pointerLockElement?.isConnected);}
  const isZoomKey=e=>e.code==='KeyV'||String(e.key||'').toLowerCase()==='v';
  function onKeyDown(e){
    if(!isZoomKey(e))return;
    if(pressed){e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.target?.closest?.('input,textarea,[contenteditable=true]'))return;
    connect();if(!playing())return;
    e.preventDefault();e.stopImmediatePropagation();pressed=true;retarget(settings.defaultZoom,settings.zoomInSeconds);show();
  }
  function onKeyUp(e){if(isZoomKey(e)){if(pressed){e.preventDefault();e.stopImmediatePropagation();}release();}}
  function onWheel(e){if(!pressed)return;if(!document.pointerLockElement){release();return;}e.preventDefault();e.stopImmediatePropagation();const units=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?window.innerHeight:1);wheelUnits+=units;
    const threshold=e.deltaMode===0&&Math.abs(units)<10?10:1;
    if(Math.abs(wheelUnits)>=threshold){const direction=Math.sign(wheelUnits);const steps=Math.max(1,Math.round(Math.abs(wheelUnits)/(e.deltaMode===0?100:16)));const next=clamp(target-direction*settings.wheelStep*steps,1,settings.maxZoom,target);wheelUnits=0;if(next!==target)retarget(next,settings.smoothWheel?settings.wheelSeconds:0);}
    show();}
  function onMove(e){if(!pressed&&current===1)return;const speed=pressed?settings.lookSpeed:1+(settings.lookSpeed-1)*Math.min(1,Math.max(0,current-1));
    if(speed===0){e.stopImmediatePropagation();return;}
    try{Object.defineProperty(e,'movementX',{configurable:true,value:e.movementX*speed});Object.defineProperty(e,'movementY',{configurable:true,value:e.movementY*speed});}catch{/* The camera remains usable if a browser makes these fields immutable. */}
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}}
  function change(name,value){settings=normalize({...settings,[name]:value});if(pressed){const next=clamp(target,1,settings.maxZoom,1);if(next!==target||name==='smoothWheel'&&!settings.smoothWheel)retarget(next,0);}save();sync();show();}
  function element(tag,cls,text){const e=document.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;}
  function sync(){for(const input of document.querySelectorAll('[data-zoomer-field]')){
    const name=input.dataset.zoomerField,row=input.closest('.SettingBox');
    if(input.type==='checkbox'){input.checked=settings[name];input.closest('.rc-checkbox').classList.toggle('rc-checkbox-checked',settings[name]);}
    else if(input.type==='color')input.value=settings[name];
    else {
      input.value=settings[name];const output=row.querySelector('output'),handle=row.querySelector('[role=slider]');
      const value=String(settings[name])+(name.endsWith('Seconds')?' s':name==='textSize'?' px':name==='textX'||name==='textY'?'%':'\u00d7');output.textContent=value;
      const percent=(settings[name]-Number(input.min))/(Number(input.max)-Number(input.min))*100;
      row.querySelector('.rangeslider__fill').style.width=percent+'%';handle.style.left=percent+'%';handle.setAttribute('aria-valuenow',settings[name]);handle.setAttribute('aria-valuetext',value);
      const disabled=name==='wheelSeconds'&&!settings.smoothWheel;input.disabled=disabled;handle.setAttribute('aria-disabled',String(disabled));handle.tabIndex=disabled?-1:0;row.classList.toggle('zoomer-disabled',disabled);row.classList.toggle('SettingBoxDisabled',disabled);row.setAttribute('aria-disabled',String(disabled));
    }
  }}
  function mount(){for(const menu of document.querySelectorAll('.SettingsMenu')){
    const sidebar=menu.querySelector('.MenuSideBarSection')||menu.querySelector('.MenuSideBarBody'),right=menu.querySelector('.SettingsMenuRight');if(!sidebar||!right)continue;
    const existing=menu.querySelector('[data-zoomer-category]'),existingPage=right.querySelector('.zoomer-page');if(existing&&sidebar.contains(existing)&&existingPage)continue;
    existing?.remove();menu.querySelector('.zoomer-page')?.remove();menu.classList.remove('zoomer-selected');
    const tab=element('div','MenuSideBarBodyTab');tab.dataset.zoomerCategory='true';tab.tabIndex=0;tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');const icon=element('div','MenuSideBarBodyTabIcon');icon.innerHTML='<svg class="svg-inline--fa" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm-1 2v3H6v2h3v3h2v-3h3V9h-3V6z"/></svg>';tab.append(icon,element('div','','Zoomer'));
    const page=element('div','SettingsMenuRightInner zoomer-page');page.setAttribute('role','tabpanel');page.setAttribute('aria-label','Zoomer');
    const group=page;
    const info=element('div','SettingBox zoomer-info');info.append(element('div','SmallTextLight','Hold V to zoom. Use the wheel to change magnification. Percentage shows zoom relative to your maximum.'));
      function slider(name,title,min,max,step){
        const row=element('div','SettingBox SettingsSliderDiv'),label=element('div','SliderText',title+': '),output=element('output'),input=element('input');
        label.append(output);input.type='range';input.hidden=true;input.min=min;input.max=max;input.step=step;input.dataset.zoomerField=name;input.setAttribute('aria-label',title);
        const wrap=element('div','SliderDiv'),track=element('div','rangeslider rangeslider-horizontal'),fill=element('div','rangeslider__fill'),handle=element('div','rangeslider__handle');
        handle.append(element('div','rangeslider__handle-label'));handle.tabIndex=0;handle.setAttribute('role','slider');handle.setAttribute('aria-label',title);handle.setAttribute('aria-valuemin',min);handle.setAttribute('aria-valuemax',max);handle.setAttribute('aria-orientation','horizontal');
        track.style.touchAction='none';track.append(fill,handle);wrap.append(track);row.append(label,input,wrap);group.append(row);
        const update=value=>{if(input.disabled)return;change(name,Math.min(max,Math.max(min,Number((Math.round(value/step)*step).toFixed(2)))));};
        input.addEventListener('input',()=>update(Number(input.value)));
        const drag=e=>{const bounds=track.getBoundingClientRect();if(bounds.width)update(min+(e.clientX-bounds.left)/bounds.width*(max-min));};
        let pointer=null;
        track.addEventListener('pointerdown',e=>{if(e.button!==0||input.disabled)return;e.preventDefault();pointer=e.pointerId;track.setPointerCapture?.(e.pointerId);handle.focus();drag(e);});
        track.addEventListener('pointermove',e=>{if(pointer===e.pointerId)drag(e);});
        const release=e=>{if(pointer!==e.pointerId)return;pointer=null;if(track.hasPointerCapture?.(e.pointerId))track.releasePointerCapture(e.pointerId);};
        track.addEventListener('pointerup',release);track.addEventListener('pointercancel',release);track.addEventListener('lostpointercapture',()=>{pointer=null;});
        handle.addEventListener('keydown',e=>{const delta={ArrowLeft:-step,ArrowDown:-step,ArrowRight:step,ArrowUp:step,PageDown:-step*5,PageUp:step*5};if(e.code in delta||e.code==='Home'||e.code==='End'){e.preventDefault();e.stopPropagation();update(e.code==='Home'?min:e.code==='End'?max:settings[name]+delta[e.code]);}});
      }
    function toggle(name,label){
      const row=element('div','SettingBox CheckboxContainer');
      row.innerHTML='<div class="CheckboxInputAndText"><label class="CheckboxClickableLabel"><span class="rc-checkbox SettingsCheckbox"><input type="checkbox" class="rc-checkbox-input"><span class="rc-checkbox-inner"></span></span></label><div class="CheckboxText"></div></div>';
      const input=row.querySelector('input');input.dataset.zoomerField=name;input.setAttribute('aria-label',label);row.querySelector('.CheckboxText').textContent=label;
      input.addEventListener('change',()=>change(name,input.checked));
      row.addEventListener('click',e=>{e.preventDefault();change(name,!settings[name]);queueMicrotask(sync);});
      input.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();e.stopPropagation();change(name,!settings[name]);}});group.append(row);
    }
    slider('defaultZoom','Default zoom',1.25,100,.25);slider('lookSpeed','Look speed while zoomed',0,1,.05);slider('zoomInSeconds','Zoom in time',0,3,.05);slider('zoomOutSeconds','Zoom out time',0,3,.05);slider('wheelStep','Zoom per wheel step',.1,20,.1);slider('maxZoom','Maximum zoom',2,100,.5);
    toggle('smoothWheel','Smooth wheel zoom');slider('wheelSeconds','Wheel zoom time',0,1,.01);toggle('showPercent','Show zoom percentage');toggle('showFactor','Show zoom multiplier');
    slider('textSize','Text size',12,96,1);slider('textX','Text X position',0,100,1);slider('textY','Text Y position',0,100,1);
    const colorRow=element('div','SettingBox zoomer-color-row'),color=element('input');color.type='color';color.dataset.zoomerField='textColor';color.setAttribute('aria-label','Text color');colorRow.append(element('div','SliderText','Text color'),color);color.addEventListener('input',()=>change('textColor',color.value));group.append(colorRow);page.append(info);
    tab.addEventListener('click',()=>{for(const other of menu.querySelectorAll('.ActiveMenuSideBarBodyTab'))other.classList.remove('ActiveMenuSideBarBodyTab');menu.classList.remove('grassify-selected','blm-selected','bvfx-shader-selected');menu.classList.add('zoomer-selected');tab.classList.add('ActiveMenuSideBarBodyTab');tab.setAttribute('aria-selected','true');sync();});
    tab.addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();tab.click();}});
    sidebar.addEventListener('click',e=>{if(e.target.closest?.('.MenuSideBarBodyTab')&&!tab.contains(e.target)){menu.classList.remove('zoomer-selected');tab.classList.remove('ActiveMenuSideBarBodyTab');tab.setAttribute('aria-selected','false');}},true);
    sidebar.append(tab);right.append(page);
  }sync();}
  function boot(){style=element('style');style.textContent='.SettingsMenu.zoomer-selected .SettingsMenuRight>:not(.zoomer-page){display:none!important}.SettingsMenu:not(.zoomer-selected) .zoomer-page{display:none!important}.zoomer-page [hidden]{display:none!important}.zoomer-page .zoomer-disabled{opacity:.45;filter:grayscale(1)}.zoomer-color-row{display:flex;align-items:center;justify-content:space-between;gap:1rem}.zoomer-color-row input[type=color]{width:4.5rem;height:2.5rem;border:1px solid #101522;background:#222a40;cursor:pointer}.zoomer-page .zoomer-disabled .SliderDiv{pointer-events:none}#bloxdy-zoomer-indicator{position:fixed;z-index:2147483646;left:50%;top:85%;transform:translate(-50%,-85%);padding:0;border:0;color:#fff;background:none;font-family:var(--root-font-family,inherit);font-weight:600;line-height:1.2;pointer-events:none;white-space:nowrap}#bloxdy-zoomer-indicator[hidden]{display:none!important}';document.head.append(style);
    indicator=element('div');indicator.id='bloxdy-zoomer-indicator';indicator.hidden=true;document.body.append(indicator);mount();uiObserver=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.SettingsMenu,.MenuSideBarBody,.SettingsMenuRight')||n.querySelector?.('.SettingsMenu,.MenuSideBarBody,.SettingsMenuRight')))))mount();});uiObserver.observe(document.body,{childList:true,subtree:true});}
  addEventListener('keydown',onKeyDown,true);addEventListener('keyup',onKeyUp,true);addEventListener('wheel',onWheel,{capture:true,passive:false});addEventListener('pointermove',onMove,true);addEventListener('mousemove',onMove,true);
  addEventListener('blur',()=>release(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)release(true);});document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement)release(true);});
  connectionTimer=setInterval(connect,500);connect();
  // Lite rendering does not run Babylon's scene render callback. Keep the
  // transition clock independent of that backend; native FOV writes still
  // pass through the same accessor before projection matrices are computed.
  function animate(){frame();animation=requestAnimationFrame(animate);}
  if(typeof requestAnimationFrame==='function')animation=requestAnimationFrame(animate);
  addEventListener('pagehide',()=>{clearInterval(connectionTimer);if(animation)cancelAnimationFrame(animation);detach();uiObserver?.disconnect();style?.remove();indicator?.remove();document.querySelectorAll('[data-zoomer-category],.zoomer-page').forEach(e=>e.remove());},{once:true});
  globalThis.__BLOXDY_ZOOMER__={diagnostics:()=>({active:pressed,current,target,hasCamera:!!camera,backend:binding?.backend||null,settings:{...settings}})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
