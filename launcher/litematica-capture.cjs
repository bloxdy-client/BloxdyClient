'use strict';
// Serialized into the SHA-checked native-frame snapshot. Source draws still
// execute synchronously. Only their independent capture is queued, until a
// resource mutation or the end of the world group. No framebuffer reads.
function deferredCapture(gl,access){
 const hooks=[],raw={},queue=[],initial=new Map(),assigned=new Set(),usedPrograms=new Set(),uniformKeys=new Map();
 const MAX_BYTES=1024*1024,MAX_COMMANDS=4096;
 const activeQueries=new Set();
 let replaying=false,compatible=true,queryActive=false,feedbackActive=!!gl.getParameter(gl.TRANSFORM_FEEDBACK_ACTIVE),bytes=0,draws=0,program=gl.getParameter(gl.CURRENT_PROGRAM),unit=gl.getParameter(gl.ACTIVE_TEXTURE),scissor=[0,0,0,0],scissorEnabled=false;
 if(gl.getQuery){const timer=gl.getExtension?.('EXT_disjoint_timer_query_webgl2');for(const target of [gl.ANY_SAMPLES_PASSED,gl.ANY_SAMPLES_PASSED_CONSERVATIVE,gl.TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN,timer?.TIME_ELAPSED_EXT])if(target!==undefined&&gl.getQuery(target,gl.CURRENT_QUERY))activeQueries.add(target);queryActive=activeQueries.size>0;}
 let sourceRange=Array.from(gl.getParameter(gl.DEPTH_RANGE)),depthWritable=gl.getParameter(gl.DEPTH_WRITEMASK)!==false,depthEnabled=gl.isEnabled(gl.DEPTH_TEST),stencilEnabled=gl.isEnabled(gl.STENCIL_TEST);
 let startProgram=program,startUnit=unit,startScissor=scissor,startEnabled=false;
 const stats={captureBatches:0,immediateDraws:0,totalDepthOnlySkippedDraws:0,peakCaptureBytes:0,peakCaptureCommands:0};
 const copy=v=>ArrayBuffer.isView(v)?new v.constructor(v):Array.isArray(v)?v.slice():v;
 const size=args=>96+args.reduce((n,v)=>n+(ArrayBuffer.isView(v)?v.byteLength:Array.isArray(v)?v.length*8:8),0);
 const param=n=>gl.getParameter(gl[n]);
 const call=(name,args)=>raw[name].apply(gl,args);
 function reset(s){queue.length=0;initial.clear();assigned.clear();usedPrograms.clear();uniformKeys.clear();bytes=0;draws=0;scissor=s.SCISSOR_BOX.slice();scissorEnabled=s.enabled.SCISSOR_TEST;if(!compatible)access.unlimit?.();if(!hooks.some(h=>h.object===gl&&h.name==='drawElements'))throw Error('Cannot capture Bloxd world draw calls');}
 function beginBatch(){if(queue.length)return;startProgram=program;startUnit=unit;startScissor=scissor.slice();startEnabled=scissorEnabled;}
 function captureScissor(box,enabled){const r=access.region();if(!r)return;let cut=r;if(enabled){const x=Math.max(r[0],box[0]),y=Math.max(r[1],box[1]);cut=[x,y,Math.max(0,Math.min(r[0]+r[2],box[0]+box[2])-x),Math.max(0,Math.min(r[1]+r[3],box[1]+box[3])-y)];}call('enable',[gl.SCISSOR_TEST]);call('scissor',cut);}
 function flush(){
  if(replaying||!queue.length)return;
  if(!draws){queue.length=0;initial.clear();assigned.clear();usedPrograms.clear();uniformKeys.clear();bytes=0;return;}
  const source=access.current(),endProgram=program,endUnit=unit,endScissor=scissor.slice(),endEnabled=scissorEnabled,endRange=sourceRange.slice();
  replaying=true;
  try{
   call('bindFramebuffer',[gl.DRAW_FRAMEBUFFER,access.target()]);
   for(const commands of [...initial.values()].reverse())for(const [name,args]of commands)call(name,args);
   call('useProgram',[startProgram]);call('activeTexture',[startUnit]);call('depthRange',[0,1]);
   let box=startScissor,enabled=startEnabled;
   for(const entry of queue){
    if(entry.draw){captureScissor(box,enabled);entry.method.apply(entry.object,entry.args);access.count(entry.draw===1);}
    else{if(entry.name!=='depthRange')call(entry.name,entry.args);if(entry.name==='scissor')box=entry.args;else if((entry.name==='enable'||entry.name==='disable')&&entry.args[0]===gl.SCISSOR_TEST)enabled=entry.name==='enable';}
   }
   stats.captureBatches++;
  }catch(error){access.fail(error);}
  finally{
   // The source state commands have now run in their original order, so their
   // final uniforms/textures/VAO/raster state are identical. Only these private
   // capture overrides need restoring, including on a failed secondary draw.
   // On failure finish the remaining state commands without repeating draws.
   if(access.failed())for(const entry of queue)if(!entry.draw){try{call(entry.name,entry.args);}catch{}}
   call('useProgram',[endProgram]);call('activeTexture',[endUnit]);call('scissor',endScissor);call(endEnabled?'enable':'disable',[gl.SCISSOR_TEST]);call('depthRange',endRange);
   call('bindFramebuffer',[gl.DRAW_FRAMEBUFFER,source]);replaying=false;
   queue.length=0;initial.clear();assigned.clear();usedPrograms.clear();uniformKeys.clear();bytes=0;draws=0;
  }
 }
 function room(cost){if(queue.length>=MAX_COMMANDS||bytes+cost>MAX_BYTES)flush();if(cost>MAX_BYTES)throw Error('Schematic capture command exceeds its memory budget');}
 function append(entry,cost){queue.push(entry);bytes+=cost;stats.peakCaptureBytes=Math.max(stats.peakCaptureBytes,bytes);stats.peakCaptureCommands=Math.max(stats.peakCaptureCommands,queue.length);}
 function hook(object,name,wrapper){const original=object?.[name];if(typeof original!=='function')return;try{const next=wrapper(original);object[name]=next;if(object[name]===next)hooks.push({object,name,original,wrapper:next});else compatible=false;}catch{compatible=false;}}
 function failed(error){access.fail(error);queue.length=0;initial.clear();assigned.clear();usedPrograms.clear();uniformKeys.clear();bytes=0;draws=0;}
 function cancel(){queue.length=0;initial.clear();assigned.clear();usedPrograms.clear();uniformKeys.clear();bytes=0;draws=0;}
 function track(name,args){if(name==='useProgram')program=args[0];if(name==='activeTexture')unit=args[0];if(name==='scissor')scissor=args.slice();if(name==='depthRange')sourceRange=args.length===2&&args.every(Number.isFinite)&&args[0]<=args[1]?args.map(n=>Math.max(0,Math.min(1,n))):Array.from(param('DEPTH_RANGE'));if(name==='depthMask')depthWritable=Boolean(args[0]);if(name==='enable'||name==='disable'){const on=name==='enable';if(args[0]===gl.SCISSOR_TEST)scissorEnabled=on;if(args[0]===gl.DEPTH_TEST)depthEnabled=on;if(args[0]===gl.STENCIL_TEST)stencilEnabled=on;}}
 // Inverses are needed only for a field first changed after a queued draw.
 // Fields assigned before that draw already have a command restoring them.
 const rules={
  useProgram:()=>['program',[['useProgram',[program]]]],
  activeTexture:()=>['unit',[['activeTexture',[unit]]]],
  bindVertexArray:()=>['vao',[['bindVertexArray',[param('VERTEX_ARRAY_BINDING')]]]],
  viewport:()=>['viewport',[['viewport',Array.from(param('VIEWPORT'))]]],
  scissor:()=>['scissor',[['scissor',scissor.slice()]]],
  enable:a=>['cap:'+a[0],[[gl.isEnabled(a[0])?'enable':'disable',[a[0]]]]],
  disable:a=>['cap:'+a[0],[[gl.isEnabled(a[0])?'enable':'disable',[a[0]]]]],
  bindTexture:a=>['texture:'+unit+':'+a[0],[['activeTexture',[unit]],['bindTexture',[a[0],gl.getParameter(a[0]===gl.TEXTURE_2D?gl.TEXTURE_BINDING_2D:a[0]===gl.TEXTURE_CUBE_MAP?gl.TEXTURE_BINDING_CUBE_MAP:a[0]===gl.TEXTURE_3D?gl.TEXTURE_BINDING_3D:gl.TEXTURE_BINDING_2D_ARRAY)]]]],
  bindSampler:a=>{call('activeTexture',[gl.TEXTURE0+a[0]]);let old;try{old=param('SAMPLER_BINDING');}finally{call('activeTexture',[unit]);}return ['sampler:'+a[0],[['bindSampler',[a[0],old]]]];}
 };
 const fields={depthFunc:['DEPTH_FUNC'],depthMask:['DEPTH_WRITEMASK'],depthRange:['DEPTH_RANGE'],colorMask:['COLOR_WRITEMASK'],clearColor:['COLOR_CLEAR_VALUE'],clearDepth:['DEPTH_CLEAR_VALUE'],clearStencil:['STENCIL_CLEAR_VALUE'],blendColor:['BLEND_COLOR'],blendEquationSeparate:['BLEND_EQUATION_RGB','BLEND_EQUATION_ALPHA'],blendFuncSeparate:['BLEND_SRC_RGB','BLEND_DST_RGB','BLEND_SRC_ALPHA','BLEND_DST_ALPHA'],cullFace:['CULL_FACE_MODE'],frontFace:['FRONT_FACE'],polygonOffset:['POLYGON_OFFSET_FACTOR','POLYGON_OFFSET_UNITS'],sampleCoverage:['SAMPLE_COVERAGE_VALUE','SAMPLE_COVERAGE_INVERT'],lineWidth:['LINE_WIDTH']};
 for(const [name,names]of Object.entries(fields))rules[name]=()=>[name,[[name,names.flatMap(n=>{const v=param(n);return ArrayBuffer.isView(v)||Array.isArray(v)?Array.from(v):[v];})]]];
 // Aliased setters share the same baseline, restored through the full setter.
 rules.blendEquation=()=>rules.blendEquationSeparate();rules.blendFunc=()=>rules.blendFuncSeparate();
 // Compute keys without consulting the driver. Query an inverse only when it
 // will actually be used; stable per-draw values need no repeated getUniform.
 function keyFor(name,a){if(name==='useProgram')return 'program';if(name==='activeTexture')return 'unit';if(name==='bindVertexArray')return 'vao';if(name==='enable'||name==='disable')return 'cap:'+a[0];if(name==='bindTexture')return 'texture:'+unit+':'+a[0];if(name==='bindSampler')return 'sampler:'+a[0];if(name.startsWith('stencil'))return name.replace('Separate','');if(name.startsWith('blendEquation'))return 'blendEquationSeparate';if(name.startsWith('blendFunc'))return 'blendFuncSeparate';return name;}
 for(const name of Object.keys(rules))hook(gl,name,original=>{raw[name]=original;return function(...args){
  if(replaying)return original.apply(this,args);
  if(name==='scissor'&&access.active()&&(args.length!==4||!args.every(Number.isInteger)||args.some(n=>n< -2147483648||n>2147483647)||args[2]<0||args[3]<0)){flush();const result=original.apply(this,args);try{scissor=Array.from(param('SCISSOR_BOX'));access.unlimit?.();}catch(error){failed(error);}return result;}
  if(access.active()&&compatible){
   const cost=size(args),key=keyFor(name,args);try{room(cost);beginBatch();
   if(draws&&!assigned.has(key)&&!initial.has(key)){const [,undo]=rules[name](args),extra=undo.reduce((n,c)=>n+size(c[1]),0);if(bytes+extra+cost>MAX_BYTES)flush();else{initial.set(key,undo);bytes+=extra;}}
   beginBatch();}catch(error){failed(error);}const result=original.apply(this,args);if(access.active()){assigned.add(key);append({name,args:args.map(copy)},cost);}
   track(name,args);return result;
  }
  const result=original.apply(this,args);track(name,args);return result;
 };});
 for(const suffix of ['1f','2f','3f','4f','1i','2i','3i','4i','1ui','2ui','3ui','4ui','1fv','2fv','3fv','4fv','1iv','2iv','3iv','4iv','1uiv','2uiv','3uiv','4uiv','Matrix2fv','Matrix3fv','Matrix4fv','Matrix2x3fv','Matrix3x2fv','Matrix2x4fv','Matrix4x2fv','Matrix3x4fv','Matrix4x3fv']){
  const name='uniform'+suffix;hook(gl,name,original=>{raw[name]=original;return function(...args){
   if(!access.active()||replaying||!compatible||args[0]===null)return original.apply(this,args);
   // Array uploads may write only a prefix of a uniform array. They are an
   // explicit boundary, avoiding any assumption about hidden tail elements or
   // aliased array locations. Single vectors/matrices remain batchable.
   if(suffix.endsWith('v')){const matrix=suffix.startsWith('Matrix'),at=matrix?2:1,dims=matrix?suffix.match(/Matrix(\d)(?:x(\d))?/):null,components=matrix?Number(dims[1])*Number(dims[2]||dims[1]):Number(suffix[0]);if(args.length>at+1||args[at]?.length>components){flush();return original.apply(this,args);}}
   let copied,cost,key;try{cost=size(args);room(cost);copied=args.map(copy);beginBatch();let keys=uniformKeys.get(program);if(!keys)uniformKeys.set(program,keys=new Map());key=keys.get(args[0]);if(!key)keys.set(args[0],key={});
   if(usedPrograms.has(program)&&!assigned.has(key)&&!initial.has(key)){
    const old=copy(gl.getUniform(program,args[0])),matrix=suffix.startsWith('Matrix'),restoreName=matrix?name:name.replace(/v?$/,'v');
    const value=ArrayBuffer.isView(old)||Array.isArray(old)?old:[old],undo=[['useProgram',[program]],[restoreName,matrix?[args[0],false,value]:[args[0],value]]],extra=undo.reduce((n,c)=>n+size(c[1]),0);
    if(bytes+extra+cost>MAX_BYTES)flush();else{initial.set(key,undo);bytes+=extra;}
   }
   beginBatch();}catch(error){failed(error);}const result=original.apply(this,args);if(access.active()){assigned.add(key);append({name,args:copied},cost);}return result;
  };});
 }
 // Resource writes cannot be postponed or replayed: flush their preceding
 // readers first. The source call then executes once with its original bytes.
 const barriers=['bindFramebuffer','drawBuffers','bindBufferBase','bindBufferRange','uniformBlockBinding','stencilMask','stencilMaskSeparate','stencilFunc','stencilFuncSeparate','stencilOp','stencilOpSeparate','bufferData','bufferSubData','copyBufferSubData','texImage2D','texImage3D','texSubImage2D','texSubImage3D','compressedTexImage2D','compressedTexImage3D','compressedTexSubImage2D','compressedTexSubImage3D','copyTexImage2D','copyTexSubImage2D','copyTexSubImage3D','texStorage2D','texStorage3D','texParameteri','texParameterf','generateMipmap','samplerParameteri','samplerParameterf','vertexAttribPointer','vertexAttribIPointer','enableVertexAttribArray','disableVertexAttribArray','vertexAttribDivisor','bindTransformFeedback','beginTransformFeedback','endTransformFeedback','pauseTransformFeedback','resumeTransformFeedback','linkProgram','attachShader','detachShader','readPixels','blitFramebuffer','invalidateFramebuffer','invalidateSubFramebuffer','deleteBuffer','deleteVertexArray','deleteTexture','deleteProgram','deleteSampler','deleteFramebuffer','deleteRenderbuffer','framebufferTexture2D','framebufferTextureLayer','framebufferRenderbuffer','renderbufferStorage','renderbufferStorageMultisample','getBufferSubData','flush','finish'];
 for(let i=1;i<=4;i++)for(const suffix of ['f','fv','I4i','I4iv','I4ui','I4uiv'])barriers.push('vertexAttrib'+(suffix[0]==='I'?suffix:i+suffix));
 for(const name of new Set(barriers))hook(gl,name,original=>{raw[name]=original;return function(...args){if(!replaying&&access.active())flush();const result=original.apply(this,args);if(!replaying&&name==='bindFramebuffer')access.bind(args);if(!replaying&&name==='beginTransformFeedback')feedbackActive=true;if(!replaying&&name==='endTransformFeedback')feedbackActive=false;return result;};});
 for(const name of ['beginQuery','endQuery'])hook(gl,name,original=>function(...args){if(!replaying&&access.active())flush();const result=original.apply(this,args);if(!replaying){if(name==='beginQuery')activeQueries.add(args[0]);else activeQueries.delete(args[0]);queryActive=activeQueries.size>0;}return result;});
 hook(gl,'bindBuffer',original=>function(...args){if(!replaying&&access.active()&&args[0]===gl.ELEMENT_ARRAY_BUFFER)flush();return original.apply(this,args);});
 function replayNow(object,method,args,draw){flush();if(!access.active())return;if(!compatible){scissor=Array.from(param('SCISSOR_BOX'));scissorEnabled=gl.isEnabled(gl.SCISSOR_TEST);sourceRange=Array.from(param('DEPTH_RANGE'));}replaying=true;try{call('bindFramebuffer',[gl.DRAW_FRAMEBUFFER,access.target()]);call('depthRange',[0,1]);captureScissor(scissor,scissorEnabled);method.apply(object,args);access.count(draw);stats.immediateDraws++;}catch(error){access.fail(error);}finally{call('depthRange',sourceRange);call('scissor',scissor);call(scissorEnabled?'enable':'disable',[gl.SCISSOR_TEST]);call('bindFramebuffer',[gl.DRAW_FRAMEBUFFER,access.current()]);replaying=false;}}
 function drawHook(object,name){hook(object,name,original=>{const native=typeof WebGL2RenderingContext==='undefined'||object===gl&&original===WebGL2RenderingContext.prototype[name];return function(...args){
  const direct=compatible&&native;
  if(!direct&&!replaying&&access.active())flush();
  const result=original.apply(this,args);if(!replaying&&!compatible)access.bind([gl.DRAW_FRAMEBUFFER,param('DRAW_FRAMEBUFFER_BINDING')]);if(!access.active()||replaying||access.current()!==access.source())return result;
  const draw=!name.startsWith('clear');if(draw)access.observe?.();if(draw&&direct&&access.depthOnly?.()&&!stencilEnabled&&(!depthEnabled||!depthWritable)){stats.totalDepthOnlySkippedDraws++;return result;}if(queryActive||feedbackActive){failed(Error('World capture paused for a native query or transform feedback'));return result;}if(!direct){replayNow(this,original,args,draw);return result;}
  try{const cost=size(args);room(cost);if(access.active()){beginBatch();append({object:this,method:original,args:args.map(copy),draw:draw?1:2},cost);draws++;if(draw)usedPrograms.add(program);}}catch(error){failed(error);}return result;
 };});}
 for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','clear','clearBufferfv','clearBufferiv','clearBufferuiv','clearBufferfi'])drawHook(gl,name);
 const multi=gl.getExtension?.('WEBGL_multi_draw');for(const name of ['multiDrawArraysWEBGL','multiDrawElementsWEBGL','multiDrawArraysInstancedWEBGL','multiDrawElementsInstancedWEBGL'])drawHook(multi,name);
 return {flush,reset,cancel,diagnostics:()=>({...stats,pendingCaptureBytes:bytes,pendingCaptureCommands:queue.length}),detach(){cancel();for(const h of hooks.reverse())if(h.object[h.name]===h.wrapper)h.object[h.name]=h.original;hooks.length=0;}};
}
// Event discovery plus a bounded rolling audit handles late parenting without
// repeatedly walking every terrain mesh in one foreground frame.
function createForegroundIndex(getScenes,getRendererCamera=()=>null){
 const records=new Map(),actors=new Map();let list=[],nextScene=0,discovery=-Infinity,output=[],changed=false;
 function remove(mesh){if(actors.delete(mesh))changed=true;}
 function actor(mesh,current){
  let found=false;const rendererCamera=getRendererCamera();
  for(let node=mesh,depth=0;node&&depth<16;node=node.parent,depth++){
   const name=String(node.name||'');if(/chunk|terrain|skybox|worldmesh|liquid|watermesh/i.test(name))return false;
   if(node===current.activeCamera||node===rendererCamera||/^(TorsoNode|HeadMesh|Arm(Left|Right)Mesh|Leg(Left|Right)Mesh|HandMesh)$/.test(name)||/^(player|humanoid|firstperson|held[-_ ]?item)(\b|[-_:])/i.test(name)||node.metadata?.playerId!==undefined)found=true;
  }
  return found;
 }
 function inspect(mesh,record){if(!mesh)return;if(actor(mesh,record.scene)){const prior=actors.get(mesh);if(!prior||prior.scene!==record.scene){actors.set(mesh,{mesh,scene:record.scene,epoch:record.epoch});changed=true;}else prior.epoch=record.epoch;}else remove(mesh);}
 function disposeRecord(r){for(const [observable,token]of r.subscriptions)observable.remove?.(token);for(const [mesh,item]of actors)if(item.scene===r.scene)remove(mesh);r.pending.clear();}
 function discover(now){
  if(now-discovery<500&&list.length)return;discovery=now;const scenes=new Set(getScenes().filter(Boolean));
  for(const [scene,r]of records)if(!scenes.has(scene)){disposeRecord(r);records.delete(scene);}
  for(const scene of scenes)if(!records.has(scene)){
   const r={scene,cursor:0,epoch:1,auditAt:-Infinity,pending:new Map(),subscriptions:[]};records.set(scene,r);
   for(const [observable,fn]of [[scene.onNewMeshAddedObservable,mesh=>{if(r.pending.size<256)r.pending.set(mesh,performance.now()+1000);}],[scene.onMeshRemovedObservable,mesh=>{r.pending.delete(mesh);remove(mesh);}]])if(observable?.add){const token=observable.add(fn);r.subscriptions.push([observable,token]);}
  }
  list=[...records.values()];nextScene%=Math.max(1,list.length);
 }
 function scan(){
  const now=performance.now();discover(now);const deadline=now+1;let visits=0;
  // Each pending candidate gets one check per invocation, leaving half the
  // budget for the audit so repeated additions cannot starve existing meshes.
  pending:for(const r of list){let remaining=r.pending.size;for(const [mesh,until]of r.pending){if(!remaining--)break;inspect(mesh,r);r.pending.delete(mesh);if(now<until)r.pending.set(mesh,until);if(++visits>=64||performance.now()>=deadline)break pending;}}
  for(const r of list)if(!r.scene.meshes?.length)for(const [mesh,item]of actors)if(item.scene===r.scene)remove(mesh);
  const work=list.length?list.map(r=>now<r.auditAt?0:Math.min(128,(r.scene.meshes||[]).length)):[];
  while(list.length&&visits<128){
   let picked=-1;for(let i=0;i<list.length;i++){const at=(nextScene+i)%list.length;if(work[at]>0){picked=at;break;}}if(picked<0)break;
   nextScene=(picked+1)%list.length;work[picked]--;const r=list[picked],meshes=r.scene.meshes||[];
   if(r.cursor>=meshes.length)r.cursor=0;inspect(meshes[r.cursor++],r);visits++;
   if(r.cursor>=meshes.length){for(const [mesh,item]of actors)if(item.scene===r.scene&&item.epoch!==r.epoch)remove(mesh);r.cursor=0;r.epoch++;r.auditAt=now+500;}
   if((visits&15)===0&&performance.now()>=deadline)break;
  }
  if(changed){output=[...actors.values()].map(({mesh,scene})=>({mesh,scene}));changed=false;}return output;
 }
 return {scan,dispose(){for(const r of records.values())disposeRecord(r);records.clear();actors.clear();list=[];output=[];changed=false;}};
}
function adaptLitematicaCapture(name,source){
 if(name==='adapter.js'){
  const start=source.indexOf('      foreground() {'),end=source.indexOf('      matrix() {',start);
  if(start<0||end<0||!source.includes('let actorAt=-Infinity,actors=[];'))throw Error('Litematica foreground source mismatch');
  source=source.replace('let actorAt=-Infinity,actors=[];', 'let foregroundIndex=null;');
  return source.slice(0,source.indexOf('      foreground() {'))+`      foreground(){foregroundIndex??=(${createForegroundIndex.toString()})(()=>[scene,...own(layout.renderer).filter(v=>v!==scene&&Array.isArray(v?.meshes))],()=>layout.renderer?.camera);return foregroundIndex.scan();},
      foregroundDispose(){foregroundIndex?.dispose();foregroundIndex=null;},
`+source.slice(source.indexOf('      matrix() {',source.indexOf('      foreground() {')));
 }
 if(name==='renderer.js')return source.replace('function disconnect(){earlyPrepared=false;nativeFrame?.finish();','function disconnect(){earlyPrepared=false;nativeFrame?.finish();connection?.foregroundDispose?.();');
 if(name!=='native-frame.js')return source;
 const start=source.indexOf('    let region=null,'),end=source.indexOf('    function dispose()',start);
 if(start<0||end<0)throw Error('Litematica deferred capture source mismatch');
 source=source.slice(0,start)+`    let region=null,limited=false,nativeScissor=null,nativeScissorEnabled=false;const scissor=gl.scissor,enable=gl.enable,disable=gl.disable,scissorObserved=true;
    let targets=null,active=false,source=null,current=null,ready=false,fault='',sourceDraws=0;
    const batch=(${deferredCapture.toString()})(gl,{
      active:()=>active&&!fault,current:()=>current,source:()=>source,target:()=>targets?.snapshot,
      region:()=>limited?region:null,depthOnly:()=>targets?.colorCapture===false,unlimit:()=>{limited=false;region=null;},failed:()=>!!fault,
      fail:error=>{fault=error.message;active=false;ready=false;},
      observe:()=>{sourceDraws++;},
      bind:args=>{if(args[0]===gl.DRAW_FRAMEBUFFER||args[0]===gl.FRAMEBUFFER)current=args[1];},
      count:draw=>{if(draw){counts.capturedDraws++;counts.totalCapturedDraws++;}else counts.mirroredClears++;}
    });
    function detach(){active=false;ready=false;batch.detach();}
    function abort(){active=false;ready=false;batch.cancel();}
`+source.slice(end);
 source=source.replace("if(!hooks.some(h=>h.name==='drawElements'))throw Error('Cannot capture Bloxd world draw calls');",'sourceDraws=0;batch.reset(s);');
 source=source.replace('function finish(){active=false;', 'function finish(){batch.flush();active=false;');
 source=source.replace('targets&&counts.capturedDraws','targets&&(counts.capturedDraws||sourceDraws)');
 source=source.replace('({...counts,ready,fault,region:', '({...counts,...batch.diagnostics(),sourceDraws,ready,fault,region:');
 source=source.replace('return {begin,finish,prepare,composite,detach,', 'return {begin,finish,prepare,composite,detach,abort,');
 source=source.replace("'SCISSOR_BOX','DEPTH_FUNC'", "'SCISSOR_BOX','DEPTH_RANGE','DEPTH_FUNC'");
 source=source.replace('gl.depthFunc(s.DEPTH_FUNC);', 'gl.depthFunc(s.DEPTH_FUNC);gl.depthRange(...s.DEPTH_RANGE);');
 source=source.replace('gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,targets.ghost);gl.viewport(0,0,targets.w,targets.h);', 'gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,targets.ghost);gl.viewport(0,0,targets.w,targets.h);gl.depthRange(0,1);');
 return source;
}
module.exports={adaptLitematicaCapture,deferredCapture,createForegroundIndex};
