/* Grassify: local visual vegetation. No world writes or gameplay collisions. */
(() => {
  'use strict';
  const KEY='bloxdy:grassify:v1', defaults={enabled:false,density:50,distance:16,height:0.5,width:0.025,style:'round',wind:30,color:'#70a844'}, LIMIT=Infinity;
  const clamp=(n,a,b,f)=>Number.isFinite(Number(n))?Math.min(b,Math.max(a,Number(n))):f;
  const normalize=s=>({enabled:s.enabled===true,density:Math.round(clamp(s.density,5,1000,50)/5)*5,distance:Math.round(clamp(s.distance,1,100,16)),height:Math.round(clamp(s.height,.1,3,.5)*10)/10,width:Math.round(clamp(s.width,.005,.2,.025)*1000)/1000,style:['flat','round','realistic'].includes(s.style)?s.style:defaults.style,wind:Math.round(clamp(s.wind,0,100,30)),color:/^#[\da-f]{6}$/i.test(s.color)?s.color:defaults.color});
  let settings;try{settings=normalize(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{settings={...defaults};}
  let runtime=null,timer=null,release=null,status='Off',destroyed=false,uiObserver=null;
  const actorLayouts=new WeakMap();
  const actorIds=new WeakMap();let nextActorId=0;
  const own=o=>Object.values(Object.getOwnPropertyDescriptors(o||{})).filter(d=>'value'in d).map(d=>d.value);
  function connection(){
    const host=globalThis.__BLOXD_MOD_HOST__,engine=host?.engine();
    if(!engine)throw Error('Waiting for Bloxd mod host');
    const singleton=engine.singletons,client=singleton?.bloxd?.client;
    const candidates=[...new Set([...own(singleton),...own(client)])].filter(v=>v&&typeof v==='object'&&v.container);
    const matches=[];
    for(const candidate of candidates){const found=globalThis.__GRASSIFY_LAYOUT__?.(candidate);if(found?.scene)matches.push({noa:candidate,layout:found});}
    if(matches.length>1)throw Error('Waiting for an unambiguous Bloxd scene');
    const fallback=candidates.length===1?candidates[0]:null;
    const noa=matches[0]?.noa||fallback,layout=matches[0]?.layout||(noa&&globalThis.__GRASSIFY_LAYOUT__?.(noa));
    if(!noa)throw Error('Waiting for Bloxd world engine');
    if(!layout?.scene)throw Error('Waiting for Bloxd scene');
    // Bloxd Lite submits its own meshes and bypasses scene.render(). Our
    // Babylon-owned meshes would exist but never be drawn there.
    if(layout.renderer?.tP)throw Error('Grassify needs WebGL2. Rejoin the world to apply it.');
    if(!layout.scene.activeCamera)throw Error('Waiting for Bloxd camera');
    if(!layout.world)throw Error('Waiting for Bloxd world reader');
    if(!layout.originKey||noa[layout.originKey]?.length!==3||!Array.from(noa[layout.originKey]).every(Number.isFinite))throw Error('Waiting for Bloxd world origin');
    const api=engine.getBloxd?.(),registries=[...new Set([...own(api),layout.registry].filter(value=>value?.metadatas))];
    const scene=layout.scene,gl=(scene.getEngine?.()||scene._engine)?._gl;
    const origin=()=>{const o=layout.originKey&&noa[layout.originKey];return o?.length===3&&Array.from(o).every(Number.isFinite)?o:[0,0,0];};
    return {scene,gl,layout,noa,origin,
      camera(){const p=scene.activeCamera?.globalPosition||scene.activeCamera?.position,o=origin();return p&&[p.x,p.y,p.z].every(Number.isFinite)?[p.x+o[0],p.y+o[1],p.z+o[2]]:null;},
      read(x,y,z){const w=layout.world;try{return w.loaded(x,y,z)?w.owner[w.method](x,y,z):null;}catch{return null;}},
      grass(id){try{return id>0&&engine.getBloxd()?.getItemName?.(id)==='Grass Block';}catch{return false;}},
      cover(id){
        if(id===0)return true;if(id===null||!Number.isInteger(id)||id<0)return false;
        try{const state=api?.getMetaInfo?.(id),name=api?.getItemName?.(id),root=typeof name==='string'?name.split('|')[0]:null;
          const record=registries.map(owner=>owner.metadatas?.[id]||owner.metadatas?.[name]).find(value=>value&&(value.name===name||value.id===id));
          const stat=key=>typeof api?.getDefaultItemStat==='function'?api.getDefaultItemStat(id,key):record?.[key]??state?.[key];
          const meta={model:stat('model'),solid:stat('solid'),harvestType:stat('harvestType'),blockModel:stat('blockModel')};
          if(!meta||!root||root==='Cobweb'||meta.harvestType!=='cuttable')return false;
          if(meta.solid===false&&['CentreCross','SquareSided','CustomPlanes|rotatable'].includes(meta.model))return true;
          return (root==='Vines'&&meta.model==='rotatableOffset'&&meta.blockModel==='Vines'&&meta.solid===false)||(root==='Dangling Vine'&&meta.model==='CustomModel'&&meta.blockModel==='Dangling Vine'&&meta.solid===false)||(root==='Lily Pad'&&meta.model==='rotatable'&&meta.blockModel==='lily_pad_model');
        }catch{return false;}
      },
      actors(){try{const list=layout.positions?.();if(!Array.isArray(list))return [];const o=origin();return list.map(value=>{
        if(!value||typeof value!=='object')return value;if(!actorIds.has(value))actorIds.set(value,++nextActorId);const grassActorId=value.GP!=null?'native:'+value.GP:'object:'+actorIds.get(value);
        const ctor=value?.constructor;if(typeof ctor!=='function')return value;let keys=actorLayouts.get(ctor);
        if(keys===undefined){const match=String(ctor).match(/this\.position=null,this\.width=[^,]+,this\.height=[^,]+,this\.([\w$]+)=null,this\.([\w$]+)=null,this\.([\w$]+)=null,this\.([\w$]+)=null/);keys=match?{render:match[2],origin:match[4]}:null;actorLayouts.set(ctor,keys);}
        const position=keys&&value[keys.render],offset=keys&&value[keys.origin]||o;
        if(position?.length===3&&offset?.length===3&&Array.from(position).every(Number.isFinite)&&Array.from(offset).every(Number.isFinite))return {grassActorId,GP:value.GP,height:value.height,width:value.width,position:Array.from(position,(v,i)=>v+offset[i])};return {grassActorId,GP:value.GP,height:value.height,width:value.width,position:value.position};
      });}catch{return []; }},
    };
  }
  // Expand outwards, with no radius-sized allocation. Actual loaded cells are
  // checked before placement; camera height never implies a ground surface.
  function* scan(center,radius,read,grass,cover){
    // Prioritize genuine exposed surfaces column by column; retain the full
    // volume pass afterwards for caves, overhangs and additional grass layers.
    if(read&&grass){
      const column=function*(dx,dz){for(let d=0;d<=radius+3;d++)for(const y of d===0?[-2]:[-2-d,-2+d]){if(Math.abs(y)>radius+2)continue;const p=[center[0]+dx,center[1]+y,center[2]+dz];yield p;const id=read(...p);if(id!==null&&grass(id)){const above=read(p[0],p[1]+1,p[2]);if(cover?cover(above):above===0)return;}}};
      yield* column(0,0);for(let r=1;r<=radius+1;r++){for(let z=-r;z<=r;z++)for(const x of [-r,r])if(x*x+z*z<=(radius+1)*(radius+1))yield* column(x,z);for(let x=-r+1;x<r;x++)for(const z of [-r,r])if(x*x+z*z<=(radius+1)*(radius+1))yield* column(x,z);}
    }
    const point=(x,y,z)=>[center[0]+x,center[1]+y,center[2]+z];
    yield point(0,0,0);
    for(let r=1;r<=radius+2;r++){
      for(let y=-r;y<=r;y++)for(let z=-r;z<=r;z++)for(const x of [-r,r])if(x*x+z*z<=(radius+1)*(radius+1))yield point(x,y,z);
      for(let y=-r;y<=r;y++)for(let x=-r+1;x<r;x++)for(const z of [-r,r])if(x*x+z*z<=(radius+1)*(radius+1))yield point(x,y,z);
      for(let z=-r+1;z<r;z++)for(let x=-r+1;x<r;x++)for(const y of [-r,r])if(x*x+z*z<=(radius+1)*(radius+1))yield point(x,y,z);
    }
  }
  const hash=(x,y,z,i)=>{let v=Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791)^Math.imul(i+1,2654435761);v=Math.imul(v^(v>>>16),2246822507);return (v>>>0)/4294967296;};
  const vertex=`#version 300 es
  precision highp float;
  layout(location=0)in vec2 blade;layout(location=1)in vec4 root;layout(location=2)in vec2 variation;
  uniform mat4 matrix;uniform vec3 origin;uniform vec3 eye;uniform float height;uniform float width;uniform float windSpeed;uniform float seconds;uniform vec4 actors[32];uniform int actorCount;
  out float shade;out float distanceToEye;
  void main(){float t=blade.y;vec3 base=root.xyz;vec2 side=vec2(cos(root.w),sin(root.w));
    vec2 bend=vec2(sin(seconds*windSpeed*1.8+base.x*.5+base.z*.4),cos(seconds*windSpeed*1.3+base.z*.6))*(windSpeed > 0.0 ? 0.10 : 0.0);
    for(int i=0;i<32;i++){if(i>=actorCount)break;vec3 a=actors[i].xyz;vec2 d=base.xz-a.xz;float len=length(d);float influence=(1.-smoothstep(.15,actors[i].w,len))*(1.-smoothstep(.4,1.5,abs(base.y-a.y)));bend+=d/max(len,.08)*influence*.65;}
    float h=height*variation.x;vec3 p=base+vec3(side.x*blade.x*width*.5,0.,side.y*blade.x*width*.5);
    p.xz+=bend*t*t;p.y+=h*t-min(length(bend)*.25,h*.6)*t*t;
    distanceToEye=distance(base.xz,eye.xz);shade=mix(.48,1.12,t)*variation.y;gl_Position=matrix*vec4(p-origin,1.);
  }`;
  const fragment=`#version 300 es
  precision highp float;uniform vec3 color;uniform float radius;in float shade;in float distanceToEye;out vec4 result;
  void main(){if(distanceToEye>radius)discard;result=vec4(color*shade,1.);}`;
  function createRenderer(c){
    const gl=c.gl;if(!gl?.createVertexArray)throw Error('Waiting for a compatible Bloxd renderer.');
    let program=null,vao=null,shape=null,instances=null,disposed=false,drawn=false,count=0,dirty=true,iterator=null,center=null,nextScan=0;
    let data=new Float32Array(0),cells=new Map(),audit=null,lastActors=0,actorData=new Float32Array(128),actorCount=0;
    const subscriptions=[],shaders=[];
    function dispose(){if(disposed)return;disposed=true;for(const [o,t]of subscriptions)o.remove(t);subscriptions.length=0;for(const s of shaders)gl.deleteShader(s);shaders.length=0;if(program)gl.deleteProgram(program);if(shape)gl.deleteBuffer(shape);if(instances)gl.deleteBuffer(instances);if(vao)gl.deleteVertexArray(vao);program=vao=shape=instances=null;cells.clear();data=actorData=null;iterator=audit=center=null;count=0;}
    try{
      program=gl.createProgram();for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Grass shader compilation failed');gl.attachShader(program,s);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Grass shader linking failed');
      vao=gl.createVertexArray();shape=gl.createBuffer();instances=gl.createBuffer();
      const previousVAO=gl.getParameter(gl.VERTEX_ARRAY_BINDING),previousBuffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      try{gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,shape);
        const points=[];for(let i=0;i<3;i++){const a=i/3,b=(i+1)/3;points.push(-1,a,1,a,-1,b,1,a,1,b,-1,b);}gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,instances);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,24,0);gl.vertexAttribDivisor(1,1);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,24,16);gl.vertexAttribDivisor(2,1);
      }finally{gl.bindVertexArray(previousVAO);gl.bindBuffer(gl.ARRAY_BUFFER,previousBuffer);}
      const u=Object.fromEntries(['matrix','origin','eye','width','windSpeed','height','seconds','actors[0]','actorCount','color','radius'].map(n=>[n,gl.getUniformLocation(program,n)]));
      function valid(p){const id=c.read(...p);return id!==null&&c.grass(id)&&c.cover(c.read(p[0],p[1]+1,p[2]));}
      function rebuild(){const size=cells.size*settings.density*6;if(data.length<size)data=new Float32Array(size);count=0;for(const p of cells.values())for(let i=0;i<settings.density&&count<LIMIT;i++){const a=hash(...p,i*4),b=hash(...p,i*4+1),v=hash(...p,i*4+2);data.set([p[0]+a,p[1]+1.005,p[2]+b,v*Math.PI*2,.7+v*.3,.85+hash(...p,i*4+3)*.3],count++*6);}dirty=true;}
      function update(now,eye){
        const target=eye.map(Math.floor);if(!center||Math.hypot(...target.map((v,i)=>v-center[i]))>=3||!iterator&&now>=nextScan){center=target;iterator=scan(center,settings.distance,c.read,c.grass,c.cover);nextScan=now+2000;}
        let changed=false;for(const [key,p]of cells)if(Math.hypot(p[0]+.5-eye[0],p[2]+.5-eye[2])>settings.distance+1||Math.abs(p[1]-eye[1])>settings.distance+3){cells.delete(key);changed=true;}
        const start=performance.now();for(let n=0;iterator&&(cells.size+1)*settings.density<=LIMIT&&n<512&&performance.now()-start<2;n++){
          const item=iterator.next();if(item.done){iterator=null;break;}const p=item.value,key=p.join(',');if(cells.has(key)||(cells.size+1)*settings.density>LIMIT)continue;
          if(valid(p)){cells.set(key,p);changed=true;}
        }
        audit??=cells.entries();for(let n=0;n<16;n++){const item=audit.next();if(item.done){audit=null;break;}const [key,p]=item.value;if(!valid(p)){cells.delete(key);changed=true;}}
        if(changed)rebuild();
        if(now-lastActors>=50){lastActors=now;const nearby=c.actors().filter(a=>a?.position?.length===3&&Array.from(a.position).every(Number.isFinite)&&Number.isFinite(a.height)&&a.height>=.6).sort((a,b)=>Math.hypot(...a.position.map((v,i)=>v-eye[i]))-Math.hypot(...b.position.map((v,i)=>v-eye[i]))).slice(0,32);actorData.fill(0);actorCount=nearby.length;nearby.forEach((a,i)=>actorData.set([a.position[0],a.position[1],a.position[2],clamp(a.width,.35,2,.7)],i*4));}
      }
      function render(info){
        if(disposed||drawn||document.hidden||info?.renderingGroupId!==0||info.camera&&info.camera!==c.scene.activeCamera||c.scene._isInIntermediateRendering?.())return;
        drawn=true;const eye=c.camera();if(!eye)return;const now=performance.now();update(now,eye);if(!count||gl.isContextLost())return;
        const m=c.scene.getTransformMatrix(),matrix=[m?.m,m?._m,m,...own(m)].find(v=>v?.length===16&&Array.from(v).every(Number.isFinite));if(!matrix)return;
        const saved={program:gl.getParameter(gl.CURRENT_PROGRAM),vao:gl.getParameter(gl.VERTEX_ARRAY_BINDING),buffer:gl.getParameter(gl.ARRAY_BUFFER_BINDING),depth:gl.getParameter(gl.DEPTH_FUNC),mask:gl.getParameter(gl.DEPTH_WRITEMASK),color:gl.getParameter(gl.COLOR_WRITEMASK)};
        const caps=[gl.DEPTH_TEST,gl.CULL_FACE,gl.BLEND,gl.SCISSOR_TEST,gl.STENCIL_TEST,gl.RASTERIZER_DISCARD,gl.POLYGON_OFFSET_FILL,gl.SAMPLE_ALPHA_TO_COVERAGE,gl.SAMPLE_COVERAGE],enabled=caps.map(v=>gl.isEnabled(v));
        try{gl.useProgram(program);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,instances);if(dirty){gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,count*6));dirty=false;}
          caps.forEach(v=>gl.disable(v));gl.enable(gl.DEPTH_TEST);gl.depthFunc((c.scene.getEngine?.()||c.scene._engine)?._useReverseDepthBuffer?gl.GEQUAL:gl.LEQUAL);gl.depthMask(true);gl.colorMask(true,true,true,true);
          gl.uniformMatrix4fv(u.matrix,false,matrix);gl.uniform3fv(u.origin,c.origin());gl.uniform3fv(u.eye,eye);gl.uniform1f(u.height,settings.height);gl.uniform1f(u.width,settings.width);gl.uniform1f(u.windSpeed,Math.pow(settings.wind/30,2));gl.uniform1f(u.seconds,(now/1000)%3600);gl.uniform1f(u.radius,settings.distance);gl.uniform4fv(u['actors[0]'],actorData);gl.uniform1i(u.actorCount,actorCount);gl.uniform3fv(u.color,[1,3,5].map(i=>parseInt(settings.color.slice(i,i+2),16)/255));gl.drawArraysInstanced(gl.TRIANGLES,0,18,count);
        }finally{caps.forEach((v,i)=>enabled[i]?gl.enable(v):gl.disable(v));gl.depthFunc(saved.depth);gl.depthMask(saved.mask);gl.colorMask(...saved.color);gl.bindVertexArray(saved.vao);gl.bindBuffer(gl.ARRAY_BUFFER,saved.buffer);gl.useProgram(saved.program);}
      }
      for(const [o,fn]of [[c.scene.onBeforeRenderObservable,()=>{drawn=false;}],[c.scene.onAfterRenderingGroupObservable,info=>{try{render(info);}catch(error){stop();status='Grassify stopped: '+error.message;sync();}}]]){if(!o?.add||!o?.remove)throw Error('Unsupported Bloxd render lifecycle');subscriptions.push([o,o.add(fn)]);}
      return {scene:c.scene,dispose,reset(){cells.clear();count=0;iterator=null;center=null;audit=null;dirty=true;},stats:()=>({blades:count,cells:cells.size,actorCount,budget:LIMIT,limited:(cells.size+1)*settings.density>LIMIT})};
    }catch(error){dispose();throw error;}
  }
  function stop(){if(timer!==null)clearInterval(timer);timer=null;release?.();release=null;runtime?.dispose();runtime=null;status='Off';}
  function connect(){if(!settings.enabled||destroyed)return;try{const c=connection();if(!c){runtime?.dispose();runtime=null;status='Waiting for a loaded world';return;}if(runtime?.scene===c.scene){const s=runtime.stats();status=`On · ${(s.renderedBlocks??s.cells).toLocaleString()} grass blocks prepared · ${s.blades.toLocaleString()} blades`;return;}runtime?.dispose();runtime=null;runtime=createRenderer(c);status='On';}catch(error){runtime?.dispose();runtime=null;status=error.message;}finally{sync();}}
  function start(){stop();if(!settings.enabled||destroyed)return;connect();timer=setInterval(connect,1000);}
  function change(name,value){settings=normalize({...settings,[name]:value});try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}if(name==='enabled'||name==='style')start();else if(name==='distance'||name==='density')runtime?.reset();sync();}
  function element(tag,cls,text){const e=document.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;}
  function sync(){
    for(const button of document.querySelectorAll('[data-grassify-style]')){const selected=button.dataset.grassifyStyle===settings.style;button.setAttribute('aria-pressed',String(selected));button.style.opacity=selected?'1':'.55';}
    for(const input of document.querySelectorAll('[data-grassify-field]')){
      const name=input.dataset.grassifyField,row=input.closest('.SettingBox');
      if(input.type==='checkbox'){
        input.checked=settings[name];input.closest('.rc-checkbox').classList.toggle('rc-checkbox-checked',settings[name]);
      }else if(input.value!==String(settings[name]))input.value=settings[name];
      const output=row.querySelector('output');
      if(output){
        const value=String(settings[name])+(name==='height'||name==='distance'||name==='width'?' blocks':'');if(output.textContent!==value)output.textContent=value;
        const percent=(settings[name]-Number(input.min))/(Number(input.max)-Number(input.min))*100,handle=row.querySelector('[role=slider]');
        row.querySelector('.rangeslider__fill').style.width=percent+'%';handle.style.left=percent+'%';handle.setAttribute('aria-valuenow',settings[name]);handle.setAttribute('aria-valuetext',value);
      }
    }
    for(const e of document.querySelectorAll('[data-grassify-status]'))if(e.textContent!==status)e.textContent=status;
  }
  function mount(){
    for(const menu of document.querySelectorAll('.SettingsMenu')){
      const sidebar=menu.querySelector('.MenuSideBarSection')||menu.querySelector('.MenuSideBarBody'),right=menu.querySelector('.SettingsMenuRight');
      if(!sidebar||!right||menu.querySelector('[data-grassify-category]'))continue;
      const tab=element('div','MenuSideBarBodyTab');tab.dataset.grassifyCategory='true';tab.tabIndex=0;tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.setAttribute('aria-controls','grassify-settings-page');
      const icon=element('div','MenuSideBarBodyTabIcon');icon.innerHTML='<svg class="svg-inline--fa" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="M11 22C11 13 7 7 2 5c3 4 4 10 4 17h5zm2 0h5c0-6 1-11 4-15-5 2-9 7-9 15zm-1-8c-1-5-1-9 1-13 2 5 2 8-1 13z"/></svg>';tab.append(icon,element('div','','Grassify'));
      const page=element('div','SettingsMenuRightInner grassify-page');page.id='grassify-settings-page';page.setAttribute('role','tabpanel');page.setAttribute('aria-label','Grassify');
      const toggle=element('div','SettingBox CheckboxContainer');
      toggle.innerHTML='<div class="CheckboxInputAndText"><label class="CheckboxClickableLabel"><span class="rc-checkbox SettingsCheckbox"><input type="checkbox" class="rc-checkbox-input" data-grassify-field="enabled" aria-label="Enable Grassify"><span class="rc-checkbox-inner"></span></span></label><div class="CheckboxText">Enable Grassify</div></div>';
      const enabled=toggle.querySelector('input');enabled.addEventListener('change',()=>change('enabled',enabled.checked));
      toggle.addEventListener('click',e=>{e.preventDefault();change('enabled',!settings.enabled);queueMicrotask(sync);});
      enabled.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();e.stopPropagation();change('enabled',!settings.enabled);}});page.append(toggle);
      const group=element('div','SettingBoxGroup');page.append(group);
      function slider(name,title,min,max,step){
        const row=element('div','SettingBox SettingsSliderDiv'),label=element('div','SliderText',title+': '),output=element('output'),input=element('input');
        label.append(output);input.type='range';input.hidden=true;input.min=min;input.max=max;input.step=step;input.dataset.grassifyField=name;input.setAttribute('aria-label',title);
        const wrap=element('div','SliderDiv'),track=element('div','rangeslider rangeslider-horizontal'),fill=element('div','rangeslider__fill'),handle=element('div','rangeslider__handle');
        handle.append(element('div','rangeslider__handle-label'));handle.tabIndex=0;handle.setAttribute('role','slider');handle.setAttribute('aria-label',title);handle.setAttribute('aria-valuemin',min);handle.setAttribute('aria-valuemax',max);handle.setAttribute('aria-orientation','horizontal');
        track.style.touchAction='none';track.append(fill,handle);wrap.append(track);row.append(label,input,wrap);group.append(row);
        const update=value=>change(name,Math.min(max,Math.max(min,Number((Math.round(value/step)*step).toFixed(2)))));
        input.addEventListener('input',()=>update(Number(input.value)));
        const drag=e=>{const bounds=track.getBoundingClientRect();if(bounds.width)update(min+(e.clientX-bounds.left)/bounds.width*(max-min));};
        let pointer=null;
        track.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();pointer=e.pointerId;track.setPointerCapture?.(e.pointerId);handle.focus();drag(e);});
        track.addEventListener('pointermove',e=>{if(pointer===e.pointerId)drag(e);});
        const release=e=>{if(pointer!==e.pointerId)return;pointer=null;if(track.hasPointerCapture?.(e.pointerId))track.releasePointerCapture(e.pointerId);};
        track.addEventListener('pointerup',release);track.addEventListener('pointercancel',release);track.addEventListener('lostpointercapture',()=>{pointer=null;});
        handle.addEventListener('keydown',e=>{const delta={ArrowLeft:-step,ArrowDown:-step,ArrowRight:step,ArrowUp:step,PageDown:-step*5,PageUp:step*5};if(e.code in delta||e.code==='Home'||e.code==='End'){e.preventDefault();e.stopPropagation();update(e.code==='Home'?min:e.code==='End'?max:settings[name]+delta[e.code]);}});
      }
      slider('density','Grass blades per block',5,1000,5);slider('distance','Render distance',1,100,1);slider('height','Grass height',.1,3,.1);slider('width','Grass thickness',.005,.2,.005);slider('wind','Wind speed',0,100,1);
      const shape=element('div','SettingBox'),title=element('div','SliderText','Grass style'),choices=element('div');choices.style.cssText='display:flex;gap:.5rem;flex-wrap:wrap';
      for(const [value,label]of [['flat','Flat'],['round','Round'],['realistic','Realistic']]){const button=element('div','NewButton GoldButton');button.dataset.grassifyStyle=value;button.tabIndex=0;button.setAttribute('role','button');button.innerHTML='<div class="ButtonBottomBorder"></div><div class="ButtonTopBorder"></div><div class="ButtonBody">'+label+'</div>';button.addEventListener('click',()=>change('style',value));button.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();button.click();}});choices.append(button);}shape.append(title,choices);group.prepend(shape);
      const color=element('div','SettingBox grassify-color-row');
      color.innerHTML='<div class="SliderText">Grass color</div><div class="grassify-color-controls"><input type="color" data-grassify-field="color" aria-label="Grass color"><div role="button" tabindex="0" class="NewButton GoldButton grassify-color-reset" aria-label="Reset grass color" title="Restore the default grass color"><div class="ButtonBottomBorder"></div><div class="ButtonTopBorder"></div><div class="ButtonBody">Reset</div></div></div>';
      color.querySelector('input').addEventListener('input',e=>change('color',e.target.value));color.querySelector('input').addEventListener('change',e=>change('color',e.target.value));const reset=color.querySelector('[role=button]');reset.addEventListener('click',()=>change('color',defaults.color));reset.addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();e.stopPropagation();reset.click();}});page.append(color);
      const info=element('div','SettingBox'),note=element('div','SmallTextLight');note.dataset.grassifyStatus='true';note.setAttribute('role','status');info.append(note);page.append(info);
      tab.addEventListener('click',()=>{for(const other of menu.querySelectorAll('.ActiveMenuSideBarBodyTab'))other.classList.remove('ActiveMenuSideBarBodyTab');menu.classList.remove('blm-selected','bvfx-shader-selected');menu.classList.add('grassify-selected');tab.classList.add('ActiveMenuSideBarBodyTab');tab.setAttribute('aria-selected','true');sync();});
      tab.addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();e.stopPropagation();tab.click();}});
      sidebar.addEventListener('click',e=>{if(e.target.closest?.('.MenuSideBarBodyTab')&&!tab.contains(e.target)){menu.classList.remove('grassify-selected');tab.classList.remove('ActiveMenuSideBarBodyTab');tab.setAttribute('aria-selected','false');}},true);
      const anchor=menu.querySelector('[data-shader-category]')||[...sidebar.querySelectorAll('.MenuSideBarBodyTab')].find(t=>/^(graphics|grafik)$/i.test(t.textContent.trim()));
      if(anchor)anchor.after(tab);else sidebar.append(tab);right.append(page);
    }sync();
  }
  function boot(){
    const style=element('style');style.id='grassify-style';
    // Native Bloxd CSS owns page layout, boxes, font, checkbox and sliders.
    // The color row uses the same additional layout as Shader's water color.
    style.textContent='.SettingsMenu.grassify-selected .SettingsMenuRight>:not(.grassify-page){display:none!important}.SettingsMenu:not(.grassify-selected) .grassify-page{display:none!important}.grassify-page [hidden]{display:none!important}.grassify-color-row{display:flex;align-items:center;justify-content:space-between;gap:1rem}.grassify-color-row input[type=color]{width:4.5rem;height:2.5rem;border:1px solid #101522;background:#222a40;cursor:pointer}.grassify-color-controls{display:flex;align-items:center;gap:.6rem;flex-shrink:0}.grassify-color-reset.NewButton{font-size:1rem;min-width:4.5rem}';document.head.append(style);
    mount();uiObserver=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.SettingsMenu,.MenuSideBarBody,.SettingsMenuRight')||n.querySelector?.('.SettingsMenu,.MenuSideBarBody,.SettingsMenuRight')))))mount();});uiObserver.observe(document.body,{childList:true,subtree:true});if(settings.enabled)start();
  }
  addEventListener('pagehide',()=>{destroyed=true;stop();uiObserver?.disconnect();document.getElementById('grassify-style')?.remove();document.querySelectorAll('[data-grassify-category],.grassify-page').forEach(e=>e.remove());document.querySelectorAll('.grassify-selected').forEach(e=>e.classList.remove('grassify-selected'));},{once:true});

  globalThis.__GRASSIFY__={version:'0.2.0',diagnostics:()=>({settings:{...settings},status,active:!!runtime,timers:timer===null?0:1,...runtime?.stats()})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
