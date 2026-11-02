'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{harness,recorder,original}=require('./litematica-runtime-fixture.cjs'),{managedSource}=require('../adapters.cjs');

test('A missing group zero finishes at the frame boundary and never keeps capture open across later frames',()=>{
 const h=harness({earlyGroup:true});
 for(let frame=0;frame<12;frame++){h.frame(frame*16,frame%5===4?[-1,0]:[-1]);assert.equal(h.renderer.diagnostics().frames,frame+1);assert.equal(h.samples,frame+1);assert.equal(h.renderer.status(),'');}
 h.renderer.destroy();
});

test('A later foreground group closes the waiting world overlay before drawing that group',()=>{
 const h=harness({earlyGroup:true});h.startFrame();const scene=h.connection.scene,info={renderingGroupId:-1,camera:scene.activeCamera,renderingManager:scene._renderingManager};
 scene.onBeforeRenderingGroupObservable.notifyObservers(info);h.gl.drawElements(h.gl.TRIANGLES,3,h.gl.UNSIGNED_SHORT,0);scene.onAfterRenderingGroupObservable.notifyObservers(info);assert.equal(h.renderer.diagnostics().frames,0);
 scene.onBeforeRenderingGroupObservable.notifyObservers({...info,renderingGroupId:1});assert.equal(h.renderer.diagnostics().frames,1);h.endFrame();assert.equal(h.renderer.diagnostics().frames,1);h.renderer.destroy();
});

test('An interrupted source frame drops its queued capture instead of replaying it into the next frame',()=>{
 const h=harness(),scene=h.connection.scene;h.startFrame();scene.onBeforeRenderingGroupObservable.notifyObservers({renderingGroupId:0,camera:scene.activeCamera,renderingManager:scene._renderingManager});h.gl.drawElements(h.gl.TRIANGLES,3,h.gl.UNSIGNED_SHORT,0);
 assert.ok(h.renderer.diagnostics().capture.pendingCaptureCommands>0);h.startFrame(16);assert.equal(h.renderer.diagnostics().capture.pendingCaptureCommands,0);assert.equal(h.renderer.diagnostics().abortedFrames,1);
 h.frame(32);assert.equal(h.renderer.diagnostics().frames,1);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,1);h.renderer.destroy();
});

test('The overlay uses a canonical depth range and returns the exact native range afterwards',()=>{
 const h=harness();h.gl.depthRange(.2,.8);h.gl.calls.length=0;h.frame();assert.ok(h.gl.calls.some(c=>c[0]==='depthRange'&&c[1]===0&&c[2]===1));assert.deepEqual(h.gl.getParameter(h.gl.DEPTH_RANGE),[.2,.8]);h.renderer.destroy();
});

test('Idling and destroying remove frame-boundary callbacks as well as render-group callbacks',()=>{
 const h=harness(),scene=h.connection.scene;assert.equal(scene.onBeforeRenderObservable.size,1);assert.equal(scene.onAfterRenderObservable.size,1);
 h.setWork(false);h.bind();assert.equal(scene.onBeforeRenderObservable.size,0);assert.equal(scene.onAfterRenderObservable.size,0);h.setWork(true);h.bind();assert.equal(scene.onBeforeRenderObservable.size,1);h.renderer.destroy();assert.equal(scene.onBeforeRenderObservable.size,0);assert.equal(scene.onAfterRenderObservable.size,0);
});

test('Capture normalizes depth coordinates without changing the native draws or their final depth range',()=>{
 const gl=recorder(),ranges=[],source={},draw=gl.drawElements,ctx=vm.createContext({});gl.drawElements=function(...args){ranges.push({target:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),range:Array.from(gl.getParameter(gl.DEPTH_RANGE))});return draw.apply(this,args);};
 vm.runInContext(managedSource('bloxd-litematica','native-frame.js',original('native-frame.js')),ctx);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,source);gl.depthRange(.2,.8);
 const frame=ctx.__BLM_CREATE_NATIVE_FRAME__(gl,()=>({})),saved=ctx.__BLM_NATIVE_FRAME__.save(gl);frame.begin(saved,{reverse:false});ctx.__BLM_NATIVE_FRAME__.restore(gl,saved);gl.depthRange(NaN,.8);gl.depthRange(.8,.2);gl.drawElements(gl.TRIANGLES,3,gl.UNSIGNED_SHORT,0);frame.finish();
 assert.equal(ranges.length,2);assert.equal(ranges[0].target,source);assert.notEqual(ranges[1].target,source);assert.deepEqual(ranges.map(r=>r.range),[[.2,.8],[0,1]]);assert.deepEqual(gl.getParameter(gl.DEPTH_RANGE),[.2,.8]);frame.destroy();
});

test('The shipped depth comparison tolerates quantization without accepting a separate occluding surface',()=>{
 const source=managedSource('bloxd-litematica','renderer.js',original('renderer.js')),shader=source.match(/const fs=`([\s\S]*?)`;/)[1],expr=shader.match(/if\((gl_FragCoord\.z>depth\+depthEpsilon)\)discard/)[1];
 const hidden=new Function('z','depth','depthEpsilon','return '+expr.replace('gl_FragCoord.z','z')+';');
 assert.ok(shader.indexOf('if(errorMode>0.5')<shader.indexOf('if(gl_FragCoord.z>depth+depthEpsilon)'),'native cell reconstruction validates error highlights before proxy-cube clipping');
 const cellExpr=shader.match(/if\((any\(lessThan\(local,[\s\S]*?)\)discard;fragmentColor/)[1],outside=new Function('local','any','lessThan','greaterThan','vec3','return '+cellExpr+';'),any=v=>v.some(Boolean),less=(a,b)=>a.map((n,i)=>n<b[i]),greater=(a,b)=>a.map((n,i)=>n>b[i]),vec3=n=>[n,n,n];
 assert.equal(hidden(.75,.5,2/16777215),true,'the proxy front may be behind the actual partial-block surface');
 assert.equal(outside([.5,.5,.5],any,less,greater,vec3),false,'native surface inside this cell must still be highlighted');
 assert.equal(outside([.5,.5,1.5],any,less,greater,vec3),true,'an occluding neighbouring cell must not receive that highlight');
 for(const bits of [16,24,32]){
  const h=harness(),get=h.gl.getParameter;h.gl.getParameter=function(key){return key===h.gl.DEPTH_BITS?bits:get.call(this,key);};h.frame();
  const epsilon=h.gl.calls.find(c=>c[0]==='uniform1f'&&c[1]==='depthEpsilon')[2];for(const depth of [.25,.75,.99]){const quantum=bits===16?1/65535:1/16777215;assert.equal(hidden(depth+quantum,depth,epsilon),false);assert.equal(hidden(depth+epsilon*32,depth,epsilon),true);}h.renderer.destroy();
 }
});
