'use strict';
// Native depth testing eliminates the second world render, framebuffer copies,
// foreground masks and all interception of source draw/uniform/resource calls.
function adaptLitematicaDirect(name,source){
 if(name==='native-frame.js')return source.replace(':[gl.BACK];', ':[gl.getParameter(gl.DRAW_BUFFER0)??gl.BACK];');
 if(name==='litematica.js')return source.replace("diagnostics:()=>({version:'0.14.1'", "diagnostics:(inspect=false)=>({version:'0.14.1'").replace('renderer:renderer.diagnostics?.()', 'renderer:renderer.diagnostics?.(inspect)');
 if(name!=='renderer.js')return source;
 const edit=(a,b)=>{if(!source.includes(a))throw Error('Litematica direct adapter mismatch: '+a.slice(0,90));source=source.replace(a,()=>b);};
 edit('let frameBefore=null,', 'let direct=false,directReady=false,directDrawn=false;let frameBefore=null,');
 edit('function resetFrame(){', 'function resetFrame(){directReady=false;directDrawn=false;');
 edit('function finishFrame(){if(lastWorldInfo&&nativeFrame?.active())', 'function finishFrame(){if(lastWorldInfo&&(direct?directReady&&!directDrawn:nativeFrame?.active()))');
 edit("nativeFrame=globalThis.__BLM_CREATE_NATIVE_FRAME__(gl,compile);foreground=globalThis.__BLM_CREATE_FOREGROUND__?.(gl,compile)||null;", "direct=connection.directDepth!==false;if(!direct){nativeFrame=globalThis.__BLM_CREATE_NATIVE_FRAME__(gl,compile);foreground=globalThis.__BLM_CREATE_FOREGROUND__?.(gl,compile)||null;}");
 // Both paths share cached meshes and CPU budgets; the legacy private-target
 // path remains exercisable by CPU regression fixtures, never enabled by UI.
 edit('&&nativeFrame?.active())draw(lastWorldInfo,true)', '&&(direct?directReady&&!directDrawn:nativeFrame?.active()))draw(lastWorldInfo,true)');
 edit('        withState();resetUnpack();\n        const viewport=', '        if(direct){directReady=true;return;}withState();resetUnpack();\n        const viewport=');
 edit("earlyPrepared=false;if(!nativeFrame?.active()){", "earlyPrepared=false;if(direct&&(!directReady||directDrawn))return;if(!direct&&!nativeFrame?.active()){");
 edit('nativeFrame.finish();let saved=null;try{', 'if(direct)directDrawn=true;else nativeFrame.finish();let saved=null;try{');
 edit('const target=nativeFrame.prepare();', `const target=direct?{w:saved.VIEWPORT[2],h:saved.VIEWPORT[3],bits:24,captureUV:[1,1,0,0]}:nativeFrame.prepare();
      if(direct){gl.activeTexture(gl.TEXTURE0);gl.bindSampler(0,null);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.STENCIL_TEST);gl.disable(gl.RASTERIZER_DISCARD);gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);gl.disable(gl.SAMPLE_COVERAGE);gl.disable(gl.POLYGON_OFFSET_FILL);gl.cullFace(gl.BACK);gl.drawBuffers([saved.DRAW_FRAMEBUFFER_BINDING?gl.COLOR_ATTACHMENT0:gl.BACK]);}`);
 edit("'matrix','inverseMatrix'", "'directDepth','matrix','inverseMatrix'");
 edit('gl.useProgram(program);gl.uniform1i(uniform.image,0);', 'gl.useProgram(program);gl.uniform1f(uniform.directDepth,direct?1:0);gl.uniform1i(uniform.image,0);');
 edit('gl.uniform1i(uniform.sceneDepth,1);gl.uniform1i(uniform.sceneColor,2);', 'gl.uniform1i(uniform.sceneDepth,direct?0:1);gl.uniform1i(uniform.sceneColor,direct?0:2);');
 edit('gl.uniform1f(uniform.reverseDepth,clip.reverse?1:0);', 'gl.uniform1f(uniform.reverseDepth,!direct&&clip.reverse?1:0);');
 edit('gl.depthFunc(gl.LEQUAL);', 'gl.depthFunc(direct&&clip.reverse?gl.GEQUAL:gl.LEQUAL);');
 // The native depth buffer is read-only for every overlay draw, including
 // selection and outlines. Later water/actors/HUD retain their original depth.
 edit('gl.disable(gl.BLEND);if(opacity<1){', 'if(direct){gl.enable(gl.BLEND);gl.colorMask(true,true,true,true);gl.depthMask(false);drawFaces(false);}else{gl.disable(gl.BLEND);if(opacity<1){');
 edit('gl.depthMask(opacity===1);drawFaces(false);', 'gl.depthMask(opacity===1);drawFaces(false);}');
 edit("depth?1:item.kind==='placement'?opacity:1", "depth?1:item.kind==='placement'?opacity*(item.alpha??1):direct?(strength||0):1");
 edit('if(box)drawArea(box,origin);gl.depthMask(true);', 'if(box)drawArea(box,origin);if(!direct)gl.depthMask(true);');
 edit('lastActors=foreground?.draw(connection,matrix,clip,[width,height],target.captureUV)||0;nativeFrame.composite(saved);', 'if(!direct){lastActors=foreground?.draw(connection,matrix,clip,[width,height],target.captureUV)||0;nativeFrame.composite(saved);}');
 edit('nativeDepth:!!nativeFrame?.diagnostics().ready', 'directDepth:direct,nativeDepth:direct||!!nativeFrame?.diagnostics().ready');
 edit('capture:nativeFrame?.diagnostics()||null', 'capture:nativeFrame?.diagnostics()||{totalCapturedDraws:0,pendingCaptureCommands:0,pendingCaptureBytes:0}');
 edit('uniform float depthEpsilon;', 'uniform float depthEpsilon;uniform float directDepth;');
 edit('vec2 screen=gl_FragCoord.xy/viewport;', 'if(directDepth<0.5){vec2 screen=gl_FragCoord.xy/viewport;');
 edit('if(gl_FragCoord.z>depth+depthEpsilon)discard;', 'if(gl_FragCoord.z>depth+depthEpsilon)discard;}');
 edit('vec3 color=mix(pixel.rgb*tint.rgb,errorColor,errorStrength);float alpha=tint.a;', 'vec3 color=directDepth>0.5&&errorMode>0.5&&errorMode<1.5?errorColor:mix(pixel.rgb*tint.rgb,errorColor,errorStrength);float alpha=tint.a;');
 // Bounded passive evidence for the user's F9 report. No GL reads, source
 // hooks or extra render work; state below is already saved for restoration.
 edit('let direct=false,', 'const pipeline={sourceFrames:0,endedFrames:0,beforeGroups:0,afterGroups:0,ready:0,invisible:0,lastBefore:null,lastAfter:null,lastDraw:null};const stage=info=>({group:info?.renderingGroupId,cameraMatches:!info?.camera||info.camera===connection?.scene.activeCamera,managerMatches:!info?.renderingManager||!connection?.scene._renderingManager||info.renderingManager===connection.scene._renderingManager,intermediate:Boolean(connection?.scene._isInIntermediateRendering?.())});let direct=false,');
 edit('function resetFrame(){', 'function resetFrame(){pipeline.sourceFrames++;');
 edit('function finishFrame(){', 'function finishFrame(){pipeline.endedFrames++;');
 edit('function begin(info){', 'function begin(info){pipeline.beforeGroups++;pipeline.lastBefore=stage(info);');
 edit('function draw(info,finalize=false){', 'function draw(info,finalize=false){pipeline.afterGroups++;pipeline.lastAfter={...stage(info),finalize:Boolean(finalize)};');
 edit('if(!visible)return;', 'if(!visible){pipeline.invisible++;return;}');
 edit('if(direct){directReady=true;return;}', 'if(direct){pipeline.ready++;directReady=true;return;}');
 edit('const {w:width,h:height}=target,dpr=', 'pipeline.lastDraw={defaultTarget:!saved.DRAW_FRAMEBUFFER_BINDING,viewport:Array.from(saved.VIEWPORT),depthRange:Array.from(saved.DEPTH_RANGE),depthFunc:saved.DEPTH_FUNC,depthTest:saved.enabled.DEPTH_TEST,matrix:Array.from(matrix),origin:Array.from(origin),camera:Array.from(camera)};const {w:width,h:height}=target,dpr=');
 source=source.replaceAll('gl.drawArrays(', 'overlayDraw(');
 edit('const pipeline={sourceFrames:0,', `function overlayDraw(...args){pipeline.drawCalls=(pipeline.drawCalls||0)+1;pipeline.vertices=(pipeline.vertices||0)+args[2];gl.drawArrays(...args);}
 function inspectGPU(){if(!gl)return null;try{const pendingErrors=[];for(let n=0;n<8;n++){const code=gl.getError();if(!code)break;pendingErrors.push(code);}const get=name=>{const v=gl.getParameter(gl[name]);return ArrayBuffer.isView(v)?Array.from(v):v;};return {version:get('VERSION'),viewport:get('VIEWPORT'),depthRange:get('DEPTH_RANGE'),depthFunc:get('DEPTH_FUNC'),depthTest:gl.isEnabled(gl.DEPTH_TEST),defaultTarget:!gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),drawBuffer0:get('DRAW_BUFFER0'),contextLost:Boolean(gl.isContextLost?.()),linked:program?Boolean(gl.getProgramParameter(program,gl.LINK_STATUS)):false,unattributedPendingErrors:pendingErrors,directUniform:program?gl.getUniform(program,uniform.directDepth):null};}catch(error){return {error:String(error.message).slice(0,200)};}}
 const pipeline={sourceFrames:0,`);
 edit('diagnostics:()=>({...counters,', 'diagnostics:(inspect=false)=>({...counters,gpu:inspect?inspectGPU():undefined,pipeline:{...pipeline},connected:Boolean(connection),canvasConnected:Boolean(connection?.canvas?.isConnected),gpuConnected:Boolean(gl),programReady:Boolean(program),');
 return source;
}
module.exports={adaptLitematicaDirect};
