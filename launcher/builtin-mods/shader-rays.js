// Native Bloxd CPU caster contracts, WebGL 2 voxel tracing and bounded light
// volume updates. No shadow maps, framebuffer readback or canvas resizing.
(() => {
 'use strict';const root=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
 const shaders=/* BVFX_RAY_SHADERS */null;
 root.__BVFX_CREATE_RAYS__=function(settings,report){
  let cpu=null,loading=false,nextAttempt=0,scene=null,game=null,r=null,frame=0,revision=0,message='Waiting for shadow scene',busy=false,owner=null,detach=null,failed=null;
  const watched=new WeakSet(),fallbacks=new WeakMap();
  const enabled=()=>settings.enabled&&settings.sunShadowEnabled;
  function status(text){if(text!==message){message=text;report?.(text);}}
  function request(){if(cpu||loading||performance.now()<nextAttempt)return;loading=true;status('Preparing native shadow contracts');root.__BVFX_LOAD_RAY_CPU__().then(value=>{cpu=value;loading=false;status('Preparing voxel shadows');},error=>{loading=false;nextAttempt=performance.now()+5000;status('Voxel shadows unavailable: '+error.message);});}
  function guard(gl,units){
   const get=p=>gl.getParameter(p),active=get(gl.ACTIVE_TEXTURE),bindings=[];
   for(const unit of new Set(units)){gl.activeTexture(gl.TEXTURE0+unit);bindings.push([unit,get(gl.TEXTURE_BINDING_2D),get(gl.SAMPLER_BINDING)]);}gl.activeTexture(active);
   const caps=[gl.DEPTH_TEST,gl.CULL_FACE,gl.BLEND,gl.SCISSOR_TEST,gl.STENCIL_TEST,gl.RASTERIZER_DISCARD],on=caps.map(c=>gl.isEnabled(c));
   const saved={program:get(gl.CURRENT_PROGRAM),vao:get(gl.VERTEX_ARRAY_BINDING),draw:get(gl.DRAW_FRAMEBUFFER_BINDING),read:get(gl.READ_FRAMEBUFFER_BINDING),viewport:get(gl.VIEWPORT),scissor:get(gl.SCISSOR_BOX),mask:get(gl.COLOR_WRITEMASK),depth:get(gl.DEPTH_WRITEMASK)};
   return {discard(textures){for(const b of bindings)if(textures.includes(b[1]))b[1]=null;},restore(){gl.useProgram(saved.program);gl.bindVertexArray(saved.vao);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,saved.draw);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.read);gl.viewport(...saved.viewport);gl.scissor(...saved.scissor);gl.colorMask(...saved.mask);gl.depthMask(saved.depth);caps.forEach((c,i)=>(on[i]?gl.enable:gl.disable).call(gl,c));for(const [unit,texture,sampler]of bindings){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindSampler(unit,sampler);}gl.activeTexture(active);}};
  }
  function unpack(gl,fn){const names=['UNPACK_ALIGNMENT','UNPACK_ROW_LENGTH','UNPACK_IMAGE_HEIGHT','UNPACK_SKIP_ROWS','UNPACK_SKIP_PIXELS','UNPACK_SKIP_IMAGES','UNPACK_FLIP_Y_WEBGL','UNPACK_PREMULTIPLY_ALPHA_WEBGL'];const fields=names.map(n=>gl[n]).filter(v=>v!==undefined),saved=fields.map(p=>gl.getParameter(p)),pbo=gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING);
   try{gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,null);fields.forEach(p=>gl.pixelStorei(p,p===gl.UNPACK_ALIGNMENT?4:0));return fn();}finally{fields.forEach((p,i)=>gl.pixelStorei(p,saved[i]));gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,pbo);}
  }
  function free(){if(detach)detach();detach=null;owner=null;if(r&&!r.gl.isContextLost?.()){const {gl}=r;for(const t of [r.data,r.volume])if(t)gl.deleteTexture(t);if(r.program)gl.deleteProgram(r.program);if(r.fbo)gl.deleteFramebuffer(r.fbo);if(r.vao)gl.deleteVertexArray(r.vao);}r=null;}
  function texture(gl,integer,width,height,bytes){const t=gl.createTexture();if(!t)throw Error('Shadow texture allocation failed');gl.bindTexture(gl.TEXTURE_2D,t);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,integer?gl.NEAREST:gl.LINEAR);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
   try{unpack(gl,()=>gl.texImage2D(gl.TEXTURE_2D,0,integer?gl.RGBA32UI:gl.RGBA8,width,height,0,integer?gl.RGBA_INTEGER:gl.RGBA,integer?gl.UNSIGNED_INT:gl.UNSIGNED_BYTE,bytes));return t;}catch(e){gl.deleteTexture(t);throw e;}
  }
  function program(gl){const p=gl.createProgram(),compiled=[];try{for(const [kind,source]of [[gl.VERTEX_SHADER,shaders.vertex],[gl.FRAGMENT_SHADER,shaders.volume]]){const s=gl.createShader(kind);compiled.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Voxel shadow compile: '+gl.getShaderInfoLog(s));gl.attachShader(p,s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Voxel shadow link: '+gl.getProgramInfoLog(p));return p;}catch(e){gl.deleteProgram(p);throw e;}finally{compiled.forEach(s=>gl.deleteShader(s));}}
  function locations(gl,p){const loc={program:p};for(const n of ['Data','Volume','Offset','Eye','Lo','Light','EntityX','EntityY','Active','Strength','Floor','Ready','Fresh','Entities','OldLo','Sweep'])loc[n]=gl.getUniformLocation(p,'uBvfxRay'+n);return loc;}
  function create(gl,unit){
   if(gl.getParameter(gl.MAX_TEXTURE_SIZE)<2048)throw Error('Voxel shadows require 2048 texture support');
   const height=Math.ceil((7293508+cpu.gridWords)/8192),words=new Uint32Array(height*8192),dirty=new Set();
   r={gl,words,dirty,height,frame:-1,window:null,casters:null,entities:null,lo:null,previousLo:null,light:null,anchor:null,eye:[0,0,0],offset:[0,0,0],view:new Float32Array(16),sweep:0,warm:0,fresh:false,remaining:16,volumeUpdates:0,uploads:0,bytesUploaded:0,counts:{},active:false};
   const allocation=r;
   const mark=(offset,count,world=false)=>{if(!count)return;for(let row=offset>>>13;row<=((offset+count-1)>>>13);row++)dirty.add(row);if(world){allocation.fresh=false;allocation.remaining=16;}};
   const write=(base,offset,value,world=false)=>{if(r!==allocation)return;const bytes=ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):new Uint8Array(value);if((offset|bytes.length)&3)throw Error('Unaligned native shadow upload');const start=base+offset/4;if(start<base||start+bytes.length/4>words.length)throw Error('Native shadow upload overflow');new Uint8Array(words.buffer,start*4,bytes.length).set(bytes);mark(start,bytes.length/4,world);};
   const targets={'sun-shadow-entities':7146048,'sun-shadow-entity-grids':7293508};
   const device={createBuffer({label,size}){if(!Object.hasOwn(targets,label))throw Error('Unexpected native shadow buffer');return {base:targets[label],size};},queue:{writeBuffer(buffer,offset,value,dataOffset=0,size){const stride=ArrayBuffer.isView(value)?value.BYTES_PER_ELEMENT:1,raw=ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):new Uint8Array(value);const n=size===undefined?raw.length-dataOffset*stride:size*stride;if(offset<0||offset+n>buffer.size)throw Error('Native shadow buffer bounds');write(buffer.base,offset,raw.subarray(dataOffset*stride,dataOffset*stride+n));}}};
   r.casters=new cpu.Casters((at,data)=>write(4753984,at*4,data,true),loadTexture,text=>status(text));
   r.window=new cpu.Window(r.casters,(at,data)=>write(0,at*4,data,true),(at,data)=>write(4753984,at*4,data,true),text=>status(text));
   r.entities=new cpu.Entities(device);
   gl.activeTexture(gl.TEXTURE0+unit);r.data=texture(gl,true,2048,height,words);r.volume=texture(gl,false,1040,1056,null);r.vao=gl.createVertexArray();r.program=program(gl);r.loc=locations(gl,r.program);r.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,r.fbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,r.volume,0);if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Voxel light cache framebuffer incomplete');if(gl.getError()!==gl.NO_ERROR)throw Error('Voxel shadow resource allocation rejected');
  }
  async function loadTexture(url){const response=await fetch(url,{credentials:'omit'});if(!response.ok)throw Error('Shadow cutout '+response.status);const image=await createImageBitmap(await response.blob());try{const canvas=new OffscreenCanvas(image.width,image.height),ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Shadow cutout decoder unavailable');ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,image.width,image.height).data,alpha=new Uint8Array(image.width*image.height);for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];return {width:image.width,height:image.height,alpha};}finally{image.close();}}
  function uniform(gl,loc){const f=(n,v)=>{if(loc[n]!=null)gl.uniform1f(loc[n],v);},i=(n,v)=>{if(loc[n]!=null)gl.uniform1i(loc[n],v);},three=(n,v)=>{if(loc[n]!=null)gl.uniform3i(loc[n],...v);};
   f('Active',enabled()&&r?.active?1:0);f('Strength',Math.max(0,Math.min(1,Number(settings.sunStrength)||0)));f('Floor',Math.max(0,Math.min(1,Number(settings.sunFloor)||0)));
   i('Ready',r?.warm>=16?1:0);i('Fresh',r?.fresh?1:0);i('Entities',settings.entityShadows!==false&&r?.active?1:0);
   if(!r)return;three('Offset',r.offset);three('Eye',r.eye);three('Lo',r.lo);if(loc.Light!=null)gl.uniform3f(loc.Light,...r.light);if(loc.EntityX!=null)gl.uniform4fv(loc.EntityX,r.view.subarray(8,12));if(loc.EntityY!=null)gl.uniform4fv(loc.EntityY,r.view.subarray(12,16));
  }
  function lightDirection(){let d=settings.dayNightFrame?.body;if(!d){const a=Number(settings.sunAzimuth)*Math.PI/180,e=Number(settings.sunElevation)*Math.PI/180;d=[Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];}const norm=Math.hypot(...d);if(!(norm>.000001)||!d.every(Number.isFinite))return null;const sign=d[1]<0?-1:1;return d.map(v=>v*sign/norm);}
  function uploads(gl,unit){if(!r.dirty.size)return;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,r.data);gl.bindSampler(unit,null);const rows=[...r.dirty].sort((a,b)=>a-b);unpack(gl,()=>{for(let i=0;i<rows.length;){let low=rows[i],high=low;while(++i<rows.length&&rows[i]===high+1)high=rows[i];const data=r.words.subarray(low*8192,(high+1)*8192);gl.texSubImage2D(gl.TEXTURE_2D,0,0,low,2048,high-low+1,gl.RGBA_INTEGER,gl.UNSIGNED_INT,data);r.uploads++;r.bytesUploaded+=data.byteLength;}});r.dirty.clear();}
  function volume(gl,unit){
   const moved=!r.previousLo||r.lo.some((v,i)=>v!==r.previousLo[i]);if(!moved&&r.remaining===0&&r.warm>=16)return;
   if(r.previousLo&&r.lo.some((v,i)=>Math.abs(v-r.previousLo[i])>=[128,64,128][i])){r.warm=0;r.remaining=16;r.fresh=false;}
   gl.useProgram(r.program);gl.bindVertexArray(r.vao);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,r.fbo);gl.viewport(0,0,1040,1056);for(const cap of [gl.DEPTH_TEST,gl.CULL_FACE,gl.BLEND,gl.STENCIL_TEST,gl.RASTERIZER_DISCARD])gl.disable(cap);gl.depthMask(false);gl.colorMask(true,true,true,true);
   gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,r.data);gl.bindSampler(unit,null);gl.uniform1i(r.loc.Data,unit);uniform(gl,r.loc);gl.uniform3i(r.loc.OldLo,...(r.previousLo||r.lo));gl.uniform1i(r.loc.Sweep,r.sweep);
   if(moved){gl.disable(gl.SCISSOR_TEST);gl.drawArrays(gl.TRIANGLES,0,3);}else{gl.enable(gl.SCISSOR_TEST);for(let column=0;column<8;column++){gl.scissor(column*130+1+r.sweep*8,0,8,1056);gl.drawArrays(gl.TRIANGLES,0,3);if(r.sweep===0||r.sweep===15){gl.scissor(column*130+(r.sweep===0?129:0),0,1,1056);gl.drawArrays(gl.TRIANGLES,0,3);}}}
   r.previousLo=r.lo.slice();r.sweep=(r.sweep+1)%16;r.warm=Math.min(16,r.warm+1);r.remaining=Math.max(0,r.remaining-1);r.fresh=r.warm>=16&&r.remaining===0;r.volumeUpdates++;
  }
  function update(gl,nextScene,nextGame,snapshot){
   if(!enabled()){if(r)free();status('Voxel shadows off');return;}
   if(!cpu){request();return;}if(!gl||gl.isContextLost?.()||failed===gl||busy)return;
   if(gl.TRANSFORM_FEEDBACK_ACTIVE!==undefined&&gl.getParameter(gl.TRANSFORM_FEEDBACK_ACTIVE)&&!gl.getParameter(gl.TRANSFORM_FEEDBACK_PAUSED))return;
   const layout=root.__BVFX_RUNTIME_LAYOUT__?.(nextGame),world=layout?.world,registry=[layout?.registry,nextGame?.eD].find(v=>v?.LD&&v.BI&&v.JD&&typeof v.qDF==='function');
   if(!world||!registry){status('Waiting for native voxel registry');return;}
   const camera=nextScene?.activeCamera?.getAbsolutePosition?.()||nextScene?.activeCamera?.globalPosition||nextScene?.activeCamera?.position;
   const offset=(layout.originKey&&nextGame[layout.originKey])||[0,0,0],eye=camera&&[camera.x,camera.y,camera.z];if(!eye?.every(Number.isFinite)||!offset?.every(Number.isInteger))return;
   const absolute=eye.map((v,i)=>v+offset[i]),chunk=world.chunkAt(...absolute.map(Math.floor));if(!chunk?.Qp?.data||chunk.oD?.length!==32||chunk.Qp.stride?.length!==3){status('Waiting for native 32-block chunks');return;}
   const light=lightDirection();if(!light)return;const unit=Math.max(0,gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)-1),saved=guard(gl,[unit]);busy=true;
   try{
    if(r&&(r.gl!==gl||owner!==world.owner)){saved.discard([r.data,r.volume]);free();}
    if(!r){create(gl,unit);owner=world.owner;if(typeof owner.on==='function'){const window=r.window,listener=c=>window.chunkAdded(c);owner.on('chunkAdded',listener);const observedOwner=owner;detach=()=>{(observedOwner.off||observedOwner.removeListener)?.call(observedOwner,'chunkAdded',listener);};}}
    r.offset=Array.from(offset);r.lo=absolute.map((v,i)=>Math.floor(v)-[64,32,64][i]);r.light=light;
    if(r.anchor&&light.reduce((sum,v,i)=>sum+v*r.anchor[i],0)<Math.cos(Math.PI/180)){r.fresh=false;r.remaining=16;r.anchor=light.slice();}else if(!r.anchor)r.anchor=light.slice();
    r.casters.update(registry,registry.LD.length);r.window.update(absolute,(i,j,k)=>world.chunkAt(i*32,j*32,k*32),1);r.eye=r.window.eyeChunk.slice();
    cpu.project(r.view,8,eye,light);
    if(settings.entityShadows!==false)r.entities.update(r.view,8,{forEachSunShadowCaster:snapshot});
    uploads(gl,unit);volume(gl,unit);r.active=true;r.frame=frame++;
    if(!watched.has(gl)){watched.add(gl);gl.canvas?.addEventListener?.('webglcontextlost',()=>{if(r?.gl===gl)free();fallbacks.delete(gl);failed=null;});}
    status('Voxel ray shadows · '+(r.warm<16?'preparing light cache':r.window.queuedCount+' chunks pending'));
   }catch(error){if(r)saved.discard([r.data,r.volume]);free();failed=gl;status('Voxel shadows unavailable: '+error.message);}finally{saved.restore();busy=false;}
  }
  function bind(gl,loc){if(!loc||loc.Active==null||busy)return;const units=root.__BVFX_SAMPLER_UNITS__(gl,loc.program),dataUnit=units.get('uBvfxRayData'),volumeUnit=units.get('uBvfxRayVolume');if(!(dataUnit>=0&&volumeUnit>=0)){gl.uniform1f(loc.Active,0);status('Voxel shadows: insufficient sampler units');return;}
   const active=gl.getParameter(gl.ACTIVE_TEXTURE),tracker=root.__BVFX_GL_STATE__?.(gl);let fallback=fallbacks.get(gl);
   if(!r||r.gl!==gl){if(!fallback){const saved=guard(gl,[dataUnit]);try{gl.activeTexture(gl.TEXTURE0+dataUnit);fallback={data:texture(gl,true,1,1,new Uint32Array(4)),volume:texture(gl,false,1,1,new Uint8Array([255,255,255,255]))};fallbacks.set(gl,fallback);}finally{saved.restore();}}}
   for(const [unit,texture]of [[dataUnit,r?.gl===gl?r.data:fallback.data],[volumeUnit,r?.gl===gl?r.volume:fallback.volume]]){if(tracker?.bindings?.get((gl.TEXTURE0+unit)+':'+gl.TEXTURE_2D)!==texture||tracker?.samplers?.get(unit)!==null){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindSampler(unit,null);}}
   gl.activeTexture(active);const stamp=[r?.frame??-1,revision,enabled(),r?.gl===gl].join(':');if(loc.stamp!==stamp){loc.stamp=stamp;uniform(gl,loc);if(!enabled()||r?.gl!==gl)gl.uniform1f(loc.Active,0);}
  }
  function patch(source){if(typeof source!=='string'||!source.includes('#define BVFX_TERRAIN_UNDERWATER')||source.includes('bvfxRayVisibility')||!/^\s*#version\s+300/m.test(source)||!source.includes('vPositionW')||!source.includes('vNormalW'))return source;
   const main=/void\s+main\s*\(\s*(?:void)?\s*\)\s*\{/;if(!main.test(source))return source;source=source.replace(main,shaders.common+'\n$&');const factor='mix(1.0,mix(uBvfxRayFloor,1.0,bvfxRayVisibility(vPositionW,vNormalW)),uBvfxRayStrength)';
   const apply=source.includes('vec3 bvfxAmbientComponent')?'skyLightContrib=bvfxAmbientComponent+(skyLightContrib-bvfxAmbientComponent)*'+factor+';':'skyLightContrib*='+factor+';';
   source=source.replace('// BVFX liquid sunlight','exposure*='+factor+';').replace('bvfxSky *= bvfxDaylight;','bvfxDaylight*='+factor+';\nbvfxSky *= bvfxDaylight;');return source.replace('// BVFX sunlight receiver',apply+'\n// BVFX sunlight receiver');
  }
  return {update,bind,patch,locations,refresh(){revision++;failed=null;nextAttempt=0;if(!enabled())free();},attach(s,g){if(scene!==s||game!==g){free();failed=null;}scene=s;game=g;},dispose(){free();},get ready(){return Boolean(r?.active);},get drawing(){return busy;},get diagnostic(){return message;},get resolutionInfo(){return null;},get shadowDiagnostics(){return {implementation:'native-voxel-ray-v1',worldWindow:[21,7,21],lightVolume:[128,64,128],receiverSteps:64,entityGrid:64,pendingChunks:r?.window.queuedCount||0,lightCacheReady:r?.warm>=16,volumeUpdates:r?.volumeUpdates||0,uploads:r?.uploads||0,bytesUploaded:r?.bytesUploaded||0,logicalGpuBytes:r?r.words.byteLength+1040*1056*4:0,entityParts:r?.entities.frame.parts||0};}};
 };
})();
