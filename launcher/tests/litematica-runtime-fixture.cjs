'use strict';
// Inert JS call recorder and CPU-only VM; no graphics, client or network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {managedSource}=require('../adapters.cjs');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/bloxd-litematica-0.14.1.bnmod')));
const original=name=>Buffer.from(pack.files.find(f=>f.path===name).data,'base64').toString();
function recorder(){
 let id=0,active=0;const calls=[],constants=new Map(),state=new Map(),textures=new Map(),enabled=new Set();
 const arrays={VIEWPORT:[0,0,800,600],SCISSOR_BOX:[0,0,800,600],COLOR_WRITEMASK:[true,true,true,true],COLOR_CLEAR_VALUE:[0,0,0,1]};
 const api={calls,canvas:{addEventListener(){},removeEventListener(){}},isContextLost:()=>false,
  getParameter(key){calls.push(['getParameter',key]);const name=[...constants].find(([,v])=>v===key)?.[0];
   if(name==='ACTIVE_TEXTURE')return active||gl.TEXTURE0;
   if(name==='TEXTURE_BINDING_2D')return textures.get(active)||null;
   if(arrays[name])return arrays[name].slice();
   if(name==='DEPTH_BITS')return 24;if(name==='STENCIL_BITS')return 0;if(name==='MAX_DRAW_BUFFERS')return 4;
   if(name==='DEPTH_RANGE')return state.get(key)||[0,1];
   if(name==='DEPTH_WRITEMASK')return state.get(key)??true;
   return state.get(key)??null;
  },
  activeTexture(unit){active=unit;},bindTexture(_target,value){textures.set(active,value);},
  bindFramebuffer(target,value){calls.push(['bindFramebuffer',target,value]);if(target===gl.DRAW_FRAMEBUFFER||target===gl.FRAMEBUFFER)state.set(gl.DRAW_FRAMEBUFFER_BINDING,value);if(target===gl.READ_FRAMEBUFFER||target===gl.FRAMEBUFFER)state.set(gl.READ_FRAMEBUFFER_BINDING,value);},
  bindVertexArray(value){state.set(gl.VERTEX_ARRAY_BINDING,value);},
  bindBuffer(target,value){state.set(target===gl.ARRAY_BUFFER?gl.ARRAY_BUFFER_BINDING:target,value);},
  getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:(_p,name)=>name,
  enable(cap){calls.push(['enable',cap]);enabled.add(cap);},disable(cap){calls.push(['disable',cap]);enabled.delete(cap);},depthMask(value){calls.push(['depthMask',value]);state.set(gl.DEPTH_WRITEMASK,value);},
  depthRange(min,max){calls.push(['depthRange',min,max]);if([min,max].every(Number.isFinite)&&min<=max)state.set(gl.DEPTH_RANGE,[min,max].map(n=>Math.max(0,Math.min(1,n))));},
  getExtension:()=>null,checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,isEnabled:cap=>enabled.has(cap)
 };
 const gl=new Proxy(api,{get(target,name){if(name in target)return target[name];if(/^[A-Z][A-Z_0-9]*$/.test(name)){if(!constants.has(name))constants.set(name,1000+constants.size);return constants.get(name);}return target[name]=(...args)=>{calls.push([name,...args]);return name.startsWith('create')?{kind:name,id:++id}:undefined;};}});
 enabled.add(gl.DEPTH_TEST);return gl;
}
// Capture regressions retain the isolated-target path. New production-path
// tests explicitly pass directDepth:true; no real graphics context is created.
function harness({blocks=[{x:0,y:0,z:0,name:'Stone',layer:0}],actual=0,adapt=true,clockStep=0,earlyGroup=false,hasWork=true,getBlocks=null,sources=null,directDepth=false,onStats=()=>{}}={}){
 let now=0,samples=0,reads=0,box=null,bindTick,discoveries=0;const gl=recorder(),state={enabled:true,fill:true,showWrong:true,showExtra:true,renderMode:'all',layerMode:'all',layer:0,layerEnd:0,distance:128,placementTransparency:0,lineWidth:2.5,wrongTint:.35,extraTint:.08};
 const matrix=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),camera=[0,0,0];
 const observable=()=>{const listeners=new Set();return {add(fn){listeners.add(fn);return fn;},remove(fn){listeners.delete(fn);},notifyObservers(value){for(const fn of listeners)fn(value);},get size(){return listeners.size;}};};
 const scene={activeCamera:{},onBeforeRenderObservable:observable(),onAfterRenderObservable:observable(),onBeforeRenderingGroupObservable:observable(),onAfterRenderingGroupObservable:observable()};
 const connection={scene,canvas:{isConnected:true,addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({width:800})},gpu:()=>gl,matrix:()=>matrix,origin:()=>[0,0,0],camera:()=>camera,clip:()=>({half:false,reverse:false}),texture:()=>({color:[255,255,255]}),expected:name=>name==='Air'?0:1,actualName:()=> 'Dirt',read(){reads++;return {loaded:true,actual};}};
 connection.directDepth=directDepth;
 if(earlyGroup)scene._renderingManager={_renderingGroups:[{_empty:false}]};
 const context=vm.createContext({console,performance:{now:()=>{now+=clockStep;return now;}},document:{hidden:false},setInterval:fn=>{bindTick=fn;return 1;},clearInterval(){},Image:class{},__BLM_ADAPTER__:{connect:()=>{discoveries++;return connection;}}});
 for(const name of ['model.js','geometry.js','native-frame.js','renderer.js'])vm.runInContext(sources?.[name]??(adapt?managedSource(pack.manifest.id,name,original(name)):original(name)),context,{filename:name});
 const renderer=context.__BLM_CREATE_RENDERER__(()=>state,()=>{samples++;return getBlocks?getBlocks():blocks;},onStats,()=>box,()=>hasWork);
 const startFrame=(at=now)=>{now=at;scene.onBeforeRenderObservable.notifyObservers(scene);},endFrame=()=>scene.onAfterRenderObservable.notifyObservers(scene);
 function frame(at=now,groupIds=earlyGroup?[-1,0]:[0]){startFrame(at);for(const renderingGroupId of groupIds){const info={renderingGroupId,camera:scene.activeCamera,renderingManager:scene._renderingManager};scene.onBeforeRenderingGroupObservable.notifyObservers(info);gl.drawElements(gl.TRIANGLES,3,gl.UNSIGNED_SHORT,0);scene.onAfterRenderingGroupObservable.notifyObservers(info);}endFrame();}
 return {renderer,frame,startFrame,endFrame,state,gl,matrix,camera,context,connection,bind:()=>bindTick(),setWork:value=>{hasWork=value;},get discoveries(){return discoveries;},setActual(value){actual=value;},setClockStep(value){clockStep=value;},setBlocks(value){blocks=value;},setBox(value){box=value;},get reads(){return reads;},get samples(){return samples;},get now(){return now;}};
}
module.exports={recorder,harness,original,pack};
