'use strict';
// CPU-only GL contract and production shader/data regressions. No GPU/app.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {shaderRuntime}=require('./shader-runtime-fixture.cjs'),{fakeGl}=require('./shader-gl-fixture.cjs');
const native=require('./fixtures/shader-sky-2026-11-08.json');
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function fixture(tracked=false,nativeSky=false){
 const driver=fakeGl();class CpuGl{}Object.assign(CpuGl.prototype,driver);
 const r=shaderRuntime({skyStyle:'golden',sunElevation:14,sunWarmth:.85,cloudCover:.38},tracked?{WebGL2RenderingContext:CpuGl}:{}),gl=tracked?new CpuGl():driver;gl.drawingBufferWidth=1280;gl.drawingBufferHeight=720;gl.viewport(0,0,1280,720);
 const p=gl.createProgram(),s=gl.createShader(gl.FRAGMENT_SHADER);gl.shaderSource(s,r.atmosphere.patchSky('#version 300 es\n#define BVFX_SKYBOX\nprecision highp float;in vec3 vPositionW;uniform vec3 cameraPosition;out vec4 colour;void main(){colour=vec4(1);}'));
 if(nativeSky)gl.shaderSource(s,r.atmosphere.patchSky(native.shaders.find(s=>s.name==='skyPixelShader').code));
 gl.attachShader(p,s);gl.linkProgram(p);gl.useProgram(p);const loc=r.atmosphere.locations(gl,p);
 if(nativeSky){for(const [name,value]of [['luminance',.5],['turbidity',9],['rayleigh',1.5],['mieCoefficient',.0025],['mieDirectionalG',.8]])gl.uniform1f(gl.getUniformLocation(p,name),value);gl.uniform3f(gl.getUniformLocation(p,'up'),0,1,0);}
 r.atmosphere.setViewProjection(identity(),identity());r.atmosphere.setWorldFrame(0,0,0,0,50,0);r.atmosphere.setFog(.65,.48,.32);
 const clouds=r.atmosphere.cloudRenderer,set=clouds.setFrame;let frame;clouds.setFrame=f=>{frame=f;set(f);};
 const bind=()=>r.atmosphere.bind(gl,loc,gl),draw=()=>r.atmosphere.drawSky(gl,loc,gl.drawArrays,[gl.TRIANGLES,0,3]);bind();
 return {r,gl,p,loc,bind,draw,clouds,frame:()=>frame};
}

test('Custom solar colours bypass native cyan vertex tint; native Off keeps the exact tint',()=>{
 const api=shaderRuntime().atmosphere,patched=api.patchSky(native.shaders.find(s=>s.name==='skyPixelShader').code);
 const guard=patched.match(/if\(uBvfxAtmoActive<\.5\)\{retColor\.rgb\s*\*=\s*vColor\.rgb;\}/)?.[0];assert(guard);
 const code=guard.replace('retColor.rgb*=vColor.rgb;','retColor.rgb=retColor.rgb.map((v,i)=>v*vColor.rgb[i]);');
 for(const active of [0,1]){const c={uBvfxAtmoActive:active,retColor:{rgb:[1,.98,.94]},vColor:{rgb:[.3,.85,1]}};vm.runInNewContext(code,c);assert.deepEqual(c.retColor.rgb,active?[1,.98,.94]:[.3,.833,.94]);}
 assert.match(patched,/#include<logDepthFragment>/);assert.match(patched,/#include<imageProcessingCompatibility>/);
});

test('The shared periodic cloud volume contains three independent spatial octaves and is generated once',()=>{
 const c=shaderRuntime().atmosphere.cloudRenderer,bytes=c.volumeBytes();assert.equal(bytes.length,64**3*4);assert.equal(c.volumeBytes(),bytes);
 const at=(x,y,z,ch=0)=>bytes[((z*64+y)*64+x)*4+ch];
 for(const axis of [0,1,2]){const values=Array.from({length:64},(_,v)=>{const p=[24,24,24];p[axis]=v;return at(...p);});assert(Math.max(...values)-Math.min(...values)>30,'density changes through every spatial axis');}
 for(let ch=0;ch<3;ch++)for(const axis of [0,1,2]){const a=[25,25,25],b=[25,25,25];a[axis]=0;b[axis]=63;assert(Math.abs(at(...a,ch)-at(...b,ch))<20,'smooth repeat seam');}
 assert.notEqual(at(25,17,31,0),at(25,17,31,1));
});

test('Cloud density has a finite vertical body; ground and sky share the volume rather than a 2D mask',()=>{
 const c=shaderRuntime().atmosphere.cloudRenderer;
 assert.match(c.fragment,/p=camera\+ray\*/);assert.match(c.fragment,/i<24/);assert.match(c.fragment,/p\+sun\*6.0/);assert.match(c.fragment,/p\+sun\*45.0/);
 assert.match(c.model,/height=\(position.y-uBvfxAtmoClouds.z-\(w.b-.5\)\*10.0\)\/72.0/);
 assert.match(c.model,/textureLod\(uBvfxAtmoVolume/);assert.doesNotMatch(c.model,/bvfxSkyHash|bvfxSkyNoise/);
 const body=c.model.match(/float bvfxCloudHeightShape\(float height,float top\)\{([^}]+)\}/)[1];
 const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const shape=vm.runInNewContext('(function(height,top){'+body+'})',{smoothstep,max:Math.max});
 assert.equal(shape(-.1,.8),0);assert.equal(shape(0,.8),0);assert.equal(shape(1,.8),0);assert(shape(.4,.8)>.9);assert(shape(.65,.8)>shape(.65,.6),'weather creates different tower heights');
});

test('Preset selection retains separate cumulus, flat, rounded and mist layer bounds',()=>{
 const {r,bind,frame}=fixture(),model=r.atmosphere.cloudRenderer.model;
 const body=model.match(/vec2 bvfxCloudLayer\(\)\{([^}]+)\}/)[1];
 for(const [type,style,bounds]of [['current',0,[-7,79]],['vanilla',1,[0,8]],['amethyst',2,[0,21]],['bliss',3,[-12,108]]]){
  r.state.cloudType=type;bind();assert.equal(frame().style,style,'the selected preset reaches the integration pass');
  const actual=vm.runInNewContext('(function(){'+body+'})()',{uBvfxAtmoCloudStyle:style,vec2:(...v)=>v});
  assert.deepEqual(actual,bounds,'the production model bounds fit the selected form');
 }
});

test('Only clouds integrate in the small buffer; native sky draws stay full size and repeated faces reuse it',()=>{
 const {r,gl,p,draw,clouds}=fixture();draw();
 assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),p);assert.deepEqual(gl.getParameter(gl.VIEWPORT),[0,0,1280,720]);
 const d=clouds.diagnostics();assert.deepEqual(Array.from(d.cloudBuffer),[640,360]);assert.equal(d.integrations,1);assert.equal(d.offscreenPasses,4);assert.equal(d.volumeTextures,1);
 assert.equal(gl.calls.filter(c=>c[0]==='draw').length,4);
 for(let i=0;i<50;i++)draw();assert.equal(clouds.diagnostics().integrations,1);assert.equal(clouds.diagnostics().reuses,50);
 assert.equal(gl.calls.filter(c=>c[0]==='texImage3D'&&c[5]===64).length,1,'one immutable 3D noise upload');
 assert.deepEqual(Array.from(gl.uniformValues.get('uBvfxAtmoFogTint')),[.65,.48,.32]);
 r.atmosphere.dispose();assert(gl.calls.filter(c=>c[0]==='deleteTexture').length>=3);
});

test('Cloud passes restore native draw/read targets, viewport, colour/depth masks, caps, PBO and unpack state',()=>{
 const {gl,p,draw}=fixture(),drawTarget=gl.createFramebuffer(),readTarget=gl.createFramebuffer(),pbo=gl.createBuffer();
 gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,drawTarget);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,readTarget);gl.viewport(40,20,960,540);
 gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,pbo);gl.pixelStorei(gl.UNPACK_ROW_LENGTH,97);gl.pixelStorei(gl.UNPACK_SKIP_ROWS,11);
 const originalGet=gl.getParameter;let mask=[true,false,true,false],depth=true;
 gl.getParameter=p=>p===gl.COLOR_WRITEMASK?mask:p===gl.DEPTH_WRITEMASK?depth:originalGet(p);
 gl.colorMask=(...v)=>{mask=v;};gl.depthMask=v=>{depth=v;};
 for(const cap of [gl.DEPTH_TEST,gl.CULL_FACE,gl.SCISSOR_TEST,gl.BLEND])gl.enable(cap);
 draw();assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),p);assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),drawTarget);assert.equal(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),readTarget);
 assert.deepEqual(gl.getParameter(gl.VIEWPORT),[40,20,960,540]);assert.deepEqual(mask,[true,false,true,false]);assert.equal(depth,true);
 assert.equal(gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING),pbo);assert.equal(gl.getParameter(gl.UNPACK_ROW_LENGTH),97);assert.equal(gl.getParameter(gl.UNPACK_SKIP_ROWS),11);
 for(const cap of [gl.DEPTH_TEST,gl.CULL_FACE,gl.SCISSOR_TEST,gl.BLEND])assert.equal(gl.isEnabled(cap),true);
});

test('Failed cloud targets fail once, keep native draws and release partial GPU resources',()=>{
 const {gl,draw,clouds}=fixture();gl.checkFramebufferStatus=()=>-1;
 for(let i=0;i<10;i++)draw();assert.match(clouds.diagnostics().status,/incomplete/);assert.equal(clouds.diagnostics().integrations,0);
 assert.equal(gl.calls.filter(c=>c[0]==='draw').length,10,'no cloud draw after rejection; native sky keeps drawing');
 assert.equal(gl.calls.filter(c=>c[0]==='texImage3D'&&c[5]===64).length,1,'failed targets are not rebuilt every draw');
 assert(gl.calls.some(c=>c[0]==='deleteFramebuffer'));assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),null);
});

test('Sun shafts follow cloud openings and lens ghosts use integrated source transmission without repeated noise',()=>{
 const r=shaderRuntime(),c=r.atmosphere.cloudRenderer;
 assert.match(c.shafts,/i<12/);assert.match(c.shafts,/texture\(clouds,p\).a/);assert.match(c.shafts,/total\/max\(weights/);assert.doesNotMatch(c.shafts,/bvfxVolumeDensity|textureLod/);
 const flare=r.atmosphere.common.slice(r.atmosphere.common.indexOf('vec3 bvfxSolarFlare'),r.atmosphere.common.indexOf('vec3 bvfxEnvironment'));
 assert.doesNotMatch(flare,/bvfxCloudSample|bvfxVolumeDensity/);assert.match(flare,/uBvfxAtmoRayImage,uBvfxAtmoSourceSample/);
});

test('Warm fog and preset changes invalidate cloud lighting immediately; resize and world departure release caches',()=>{
 const {r,gl,bind,draw,clouds}=fixture();draw();r.atmosphere.setFog(.12,.23,.34);bind();draw();assert.equal(clouds.diagnostics().integrations,2);
 gl.viewport(0,0,1920,1080);draw();assert.deepEqual(Array.from(clouds.diagnostics().cloudBuffer),[960,540]);
 r.atmosphere.dispose();assert.equal(clouds.diagnostics().volumeTextures,0);assert.equal(clouds.diagnostics().offscreenPasses,0);
});

test('Production sampler tracking avoids per-draw driver reads and preserves native sampler changes',()=>{
 let reads=0;const native=fakeGl(),get=native.getParameter;native.getParameter=p=>{reads++;return get(p);};
 class CpuGl{}Object.assign(CpuGl.prototype,native);
 const r=shaderRuntime({cloudType:'current',sunShadowEnabled:false},{WebGL2RenderingContext:CpuGl}),gl=new CpuGl();gl.drawingBufferWidth=800;gl.drawingBufferHeight=600;
 r.atmosphere.setViewProjection(identity(),identity());
 const p=gl.createProgram(),s=gl.createShader(gl.FRAGMENT_SHADER);
 gl.shaderSource(s,'#version 300 es\n#define BVFX_MASTER_ACTIVE\n#define BVFX_SKYBOX\nprecision highp float;in vec3 vPositionW;uniform vec3 cameraPosition;out vec4 colour;void main(){colour=vec4(1);}');gl.attachShader(p,s);gl.linkProgram(p);gl.useProgram(p);gl.drawArrays(gl.TRIANGLES,0,3);
 const loc=r.atmosphere.locations(gl,p);r.atmosphere.bindVolume(gl,loc,p,true);reads=0;
 for(let i=0;i<500;i++)r.atmosphere.bindVolume(gl,loc,p,true);
 assert.equal(reads,0,'no native getParameter or getUniform read in stable repeated cloud binding');
 const units=r.root.__BVFX_SAMPLER_UNITS__(gl,p),unit=units.get('uBvfxAtmoCloudImage'),foreign=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,foreign);
 r.atmosphere.bindVolume(gl,loc,p,true);assert.notEqual(gl.getParameter(gl.TEXTURE_BINDING_2D),foreign,'real intervening native texture writes are observed and repaired');
});

test('Partial cloud compilation releases successful earlier programs and never retries each frame',()=>{
 const {gl,draw,clouds}=fixture();let compiles=0;gl.getShaderParameter=(_shader,key)=>key===gl.COMPILE_STATUS?++compiles<3:true;
 draw();draw();assert.match(clouds.diagnostics().status,/compilation failed/);assert.equal(compiles,3);
 assert.equal(gl.calls.filter(c=>c[0]==='deleteProgram').length,2,'release both the rejected program and the previously linked first pass');
 assert.equal(gl.calls.filter(c=>c[0]==='draw').length,2);assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),null);
});

test('Discard/active transform feedback cannot trigger an offscreen cloud draw or illegal program switch',()=>{
 const {gl,draw,clouds}=fixture();gl.enable(gl.RASTERIZER_DISCARD);draw();gl.disable(gl.RASTERIZER_DISCARD);
 const get=gl.getParameter;gl.getParameter=p=>p===gl.TRANSFORM_FEEDBACK_ACTIVE?true:p===gl.TRANSFORM_FEEDBACK_PAUSED?false:get(p);draw();
 assert.equal(clouds.diagnostics().integrations,0);assert.equal(gl.calls.filter(c=>c[0]==='draw').length,2);
 assert.equal(gl.calls.filter(c=>c[0]==='texImage2D'&&c[5]>1).length,0,'no cloud target allocation on discarded draws');
});

test('Stationary frozen clouds reuse their lighting across clock ticks, while camera motion invalidates immediately',()=>{
 const {draw,clouds,frame}=fixture(),f=frame();f.clouds[3]=0;clouds.setFrame(f);draw();
 clouds.setFrame({...f,time:100});draw();assert.equal(clouds.diagnostics().integrations,1);
 clouds.setFrame({...f,time:100,camera:[1,50,0]});draw();assert.equal(clouds.diagnostics().integrations,2);
});

test('High DPI cannot multiply cloud integration beyond the fixed budget or resize native presentation',()=>{
 const {gl,draw,clouds}=fixture();
 for(const [width,height]of [[2880,1920],[3840,2160],[7680,4320],[2160,3840]]){
  gl.drawingBufferWidth=width;gl.drawingBufferHeight=height;gl.viewport(0,0,width,height);draw();
  const [w,h]=clouds.diagnostics().cloudBuffer;
  assert(w<=960&&h<=540&&w*h<=960*540);
  assert(Math.abs(w/h-width/height)<.01,'preserve projection aspect');
  assert.deepEqual(gl.getParameter(gl.VIEWPORT),[0,0,width,height]);
  assert.equal(gl.drawingBufferWidth,width);assert.equal(gl.drawingBufferHeight,height);
 }
});

test('Ground shadow integration is retained across camera rotation and updates only field changes',()=>{
 const {gl,draw,clouds,frame}=fixture();draw();const f=frame();
 assert.equal(clouds.diagnostics().groundUpdates,1);
 for(let i=1;i<=50;i++){const matrix=f.matrix.slice();matrix[0]=1+i*.001;clouds.setFrame({...f,matrix});draw();}
 assert.equal(clouds.diagnostics().integrations,51,'view-dependent volume tracks the camera');
 assert.equal(clouds.diagnostics().groundUpdates,1,'a full camera turn must not integrate ground shadows again');
 clouds.setFrame({...f,time:.05});draw();assert.equal(clouds.diagnostics().groundUpdates,1);
 clouds.setFrame({...f,time:.11});draw();assert.equal(clouds.diagnostics().groundUpdates,2);
 clouds.setFrame({...f,time:.11,sun:[.5,.5,.7071]});draw();assert.equal(clouds.diagnostics().groundUpdates,3);
 clouds.setFrame({...f,time:.11,camera:[128,50,0]});draw();assert.equal(clouds.diagnostics().groundUpdates,4);
 const integration=clouds.ground;assert.match(integration,/bvfxVolumeDensity/);
 assert.doesNotMatch(clouds.groundModel,/sampler3D|textureLod|exp\(|bvfxVolumeDensity/,'no 3D density evaluation in any terrain fragment');
 assert.deepEqual(Array.from(clouds.diagnostics().groundBuffer),[512,512]);
});

test('Terrain binds the completed tile and disables stale shadows at zero coverage, Off and sunset',()=>{
 const {r,gl,draw,clouds,frame}=fixture(true);draw();const f=frame();
 const p=gl.createProgram(),s=gl.createShader(gl.FRAGMENT_SHADER);
 gl.shaderSource(s,'#version 300 es\nprecision highp float;'+r.atmosphere.terrainCommon+'\nout vec4 colour;void main(){colour=vec4(bvfxCloudGroundShadow(vec3(0),uBvfxAtmoSunDir));}');gl.attachShader(p,s);gl.linkProgram(p);gl.useProgram(p);
 const loc=r.atmosphere.locations(gl,p),bind=()=>r.atmosphere.bindVolume(gl,loc,p,true);bind();
 assert.equal(gl.uniformValues.get('uBvfxAtmoGroundFrame')[3],1);
 assert.equal(gl.getError(),gl.NO_ERROR);
 const queries=gl.getParameter;let reads=0;gl.getParameter=(...args)=>{reads++;return queries(...args);};
 for(let i=0;i<500;i++)bind();assert.equal(reads,0,'steady terrain draws add no driver state queries');
 for(const change of [{enabled:false},{clouds:[0,...f.clouds.slice(1)]},{groundStrength:0},{sun:[.8,0,.6]}]){
  clouds.setFrame({...f,...change});bind();assert.equal(gl.uniformValues.get('uBvfxAtmoGroundFrame')[3],0);
 }
 clouds.setFrame(f);bind();assert.equal(gl.uniformValues.get('uBvfxAtmoGroundFrame')[3],1);
 r.atmosphere.dispose();bind();assert.equal(gl.uniformValues.get('uBvfxAtmoGroundFrame')[3],0);
});

test('Resizing cloud buffers cannot restore a deleted scratch texture into the native sky',()=>{
 const {gl,draw}=fixture();draw();const old=gl.calls.find(c=>c[0]==='texImage2D'&&c[5]===640)[1];
 const deleted=new Set(),remove=gl.deleteTexture,bind=gl.bindTexture;
 gl.deleteTexture=t=>{deleted.add(t);remove(t);};
 gl.bindTexture=(target,t)=>{assert(!deleted.has(t),'deleted texture must never be rebound');bind(target,t);};
 gl.activeTexture(gl.TEXTURE0+15);gl.bindTexture(gl.TEXTURE_2D,old);
 gl.viewport(0,0,1920,1080);draw();assert(deleted.has(old));assert.equal(gl.getError(),gl.NO_ERROR);
});

test('Native scattering is baked once into an angular table and reused across camera turns and resizing',()=>{
 const {gl,draw,clouds,frame}=fixture(false,true);draw();const f=frame();assert(f.nativeParams);
 assert.deepEqual(Array.from(clouds.diagnostics().atmosphereBuffer),[128,64]);assert.equal(clouds.diagnostics().atmosphereUpdates,1);
 for(let i=0;i<60;i++){const matrix=f.matrix.slice();matrix[0]+=(i+1)*.002;clouds.setFrame({...f,matrix});draw();}
 assert.equal(clouds.diagnostics().atmosphereUpdates,1,'camera motion does not repeat atmospheric scattering');
 gl.viewport(0,0,2880,1920);draw();assert.equal(clouds.diagnostics().atmosphereUpdates,1);
 clouds.setFrame({...f,nativeParams:[.6,...f.nativeParams.slice(1)]});draw();assert.equal(clouds.diagnostics().atmosphereUpdates,2,'observed native exposure updates the table');
 clouds.setFrame({...f,sun:[0,.8,.6]});draw();assert.equal(clouds.diagnostics().atmosphereUpdates,3,'solar elevation updates scattering');
});

test('Observed native float uploads update scattering without repeated getUniform driver reads',()=>{
 const {r,gl,p,bind,draw,clouds}=fixture(true,true);draw();
 let reads=0;const nativeGet=gl.getUniform;gl.getUniform=(...args)=>{reads++;return nativeGet(...args);};
 for(let i=0;i<100;i++)bind();assert.equal(reads,0);
 gl.uniform1f(gl.getUniformLocation(p,'luminance'),.65);bind();draw();assert.equal(reads,0,'the scalar writer is captured, not read back');
 assert.equal(clouds.diagnostics().atmosphereUpdates,2);assert.equal(gl.uniformValues.get('uBvfxAtmoNativeReady'),1);
 r.atmosphere.dispose();bind();
 r.atmosphere.bindVolume(gl,r.atmosphere.locations(gl,p),p,true);assert.equal(gl.uniformValues.get('uBvfxAtmoNativeReady'),0);
});

test('Completed sky and cloud images remain published through repeated binds without new passes or driver reads',()=>{
 const {r,gl,p,loc,bind,draw,clouds}=fixture(true,true);
 assert.equal(gl.uniformValues.get('uBvfxAtmoCloudCacheReady'),0);draw();
 const integrations=clouds.diagnostics().integrations,updates=clouds.diagnostics().atmosphereUpdates;
 let reads=0;const query=gl.getParameter,uniform=gl.getUniform;gl.getParameter=(...a)=>{reads++;return query(...a);};gl.getUniform=(...a)=>{reads++;return uniform(...a);};
 for(let i=0;i<500;i++){
  bind();assert.equal(gl.uniformValues.get('uBvfxAtmoCloudCacheReady'),1);
  assert.equal(gl.uniformValues.get('uBvfxAtmoNativeReady'),1);
 }
 assert.equal(reads,0);assert.equal(clouds.diagnostics().integrations,integrations);assert.equal(clouds.diagnostics().atmosphereUpdates,updates);
 r.state.atmosphereEnabled=false;bind();assert.equal(gl.uniformValues.get('uBvfxAtmoCloudCacheReady'),0);assert.equal(gl.uniformValues.get('uBvfxAtmoNativeReady'),0);
 r.state.atmosphereEnabled=true;bind();assert.equal(gl.uniformValues.get('uBvfxAtmoCloudCacheReady'),1);
 r.atmosphere.dispose();bind();assert.equal(gl.uniformValues.get('uBvfxAtmoCloudCacheReady'),0);
 assert.equal(p,loc.program);
});

test('New native sky programs reuse only actual observed scattering until their own uniforms become valid',()=>{
 const {r,gl,bind,draw,clouds,frame}=fixture(true,true);bind();draw();const observed=Array.from(frame().nativeParams);
 const program=gl.createProgram(),shader=gl.createShader(gl.FRAGMENT_SHADER);
 gl.shaderSource(shader,r.atmosphere.patchSky(native.shaders.find(s=>s.name==='skyPixelShader').code));gl.attachShader(program,shader);gl.linkProgram(program);gl.useProgram(program);
 const loc=r.atmosphere.locations(gl,program),nextBind=()=>r.atmosphere.bind(gl,loc,gl),nextDraw=()=>r.atmosphere.drawSky(gl,loc,gl.drawArrays,[gl.TRIANGLES,0,3]);
 for(let i=0;i<20;i++){nextBind();nextDraw();assert.deepEqual(Array.from(frame().nativeParams),observed);assert.equal(gl.uniformValues.get('uBvfxAtmoNativeReady'),1);}
 assert.equal(clouds.diagnostics().atmosphereUpdates,1,'no analytic/native swap or duplicate atmospheric bake');
 for(const [name,value]of [['luminance',.7],['turbidity',7],['rayleigh',2],['mieCoefficient',.003],['mieDirectionalG',.75]])gl.uniform1f(gl.getUniformLocation(program,name),value);
 gl.uniform3f(gl.getUniformLocation(program,'up'),0,2,0);nextBind();nextDraw();
 const replacement=[.7,7,2,.003,.75].map(Math.fround);
 assert.deepEqual(Array.from(frame().nativeParams),replacement);assert.deepEqual(Array.from(frame().nativeUp),[0,1,0]);
 assert.equal(clouds.diagnostics().atmosphereUpdates,2,'valid native replacements take effect immediately');
 // A second variant has no physical uniforms. It shares only this context's
 // observed basis, and must not delete the completed table every face.
 const variant=gl.createProgram(),s=gl.createShader(gl.FRAGMENT_SHADER);gl.shaderSource(s,r.atmosphere.patchSky('#version 300 es\n#define BVFX_SKYBOX\nprecision highp float;in vec3 vPositionW;uniform vec3 cameraPosition;out vec4 colour;void main(){colour=vec4(1);}'));gl.attachShader(variant,s);gl.linkProgram(variant);gl.useProgram(variant);
 r.atmosphere.bind(gl,r.atmosphere.locations(gl,variant),gl);assert.deepEqual(Array.from(frame().nativeParams),replacement);
 const other=fakeGl(),p=other.createProgram();other.useProgram(p);r.atmosphere.bind(other,r.atmosphere.locations(other,p),other);assert.equal(frame().nativeParams,null,'another context cannot inherit observations');
 gl.useProgram(program);nextBind();assert(frame().nativeParams);gl.events.get('webglcontextlost')();
 // Restored contexts use new program objects with no native uploads.
 const fresh=gl.createProgram(),fs=gl.createShader(gl.FRAGMENT_SHADER);gl.shaderSource(fs,r.atmosphere.patchSky(native.shaders.find(s=>s.name==='skyPixelShader').code));gl.attachShader(fresh,fs);gl.linkProgram(fresh);gl.useProgram(fresh);
 const restored=r.atmosphere.locations(gl,fresh);r.atmosphere.bind(gl,restored,gl);
 assert.equal(frame().nativeParams,null,'context loss releases the previous physical observations');
 assert.equal(gl.uniformValues.get('uBvfxAtmoCloudCacheReady'),0);
});

test('Native daylight selects the cached physical sky while preserving the original Off/depth path',()=>{
 const source=shaderRuntime().atmosphere.patchSky(native.shaders.find(s=>s.name==='skyPixelShader').code);
 const cached=source.match(/if\(uBvfxAtmoActive>\.5 && uBvfxAtmoStyle<2.5 && uBvfxAtmoNativeReady>\.5\)\{([^}]+)\}/)?.[1];assert(cached);
 assert.match(cached,/bvfxNativeSky/);assert.doesNotMatch(cached,/sunIntensity|totalMie|Uncharted2/);
 assert.match(source,/else if\(uBvfxAtmoActive>\.5\)\{retColor=bvfxSkyColour/,'cache failure in any active style uses bounded authored scattering');
 assert.match(source,/sunIntensity\(dot\(sunDirection,up\)\)/,'native scattering remains the Off/failure fallback');
 assert.match(source,/#include<logDepthFragment>/);assert.match(source,/#include<imageProcessingCompatibility>/);
});

test('Cloud grain filtering shares the shaft draw and the sky samples its separate completed attachment',()=>{
 const {gl,draw}=fixture(),nativeDraw=gl.drawArrays;let sampled=null;
 gl.drawArrays=function(...args){if(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null){const p=gl.getParameter(gl.CURRENT_PROGRAM),unit=p.values.get('uBvfxAtmoCloudImage');sampled=gl.boundTextures.get((gl.TEXTURE0+unit)+':'+gl.TEXTURE_2D);}return nativeDraw.apply(gl,args);};
 draw();const mrt=gl.calls.find(c=>c[0]==='drawBuffers'&&c[1]?.length===2);assert(mrt);
 const rayDraw=gl.calls.filter(c=>c[0]==='draw')[2],fbo=rayDraw[1];assert.equal(fbo.attachments.size,2);
 const filtered=fbo.attachments.get(gl.COLOR_ATTACHMENT0+1);assert(filtered);assert.notEqual(filtered,fbo.attachments.get(gl.COLOR_ATTACHMENT0));
 assert.equal(sampled,filtered);
 assert.equal(gl.calls.filter(c=>c[0]==='draw').length,4,'filtering adds no pass beyond cloud, ground, shafts and native sky');
});

test('Repeated completed sky targets skip every offscreen GL state mutation and keep source visibility at its texel centre',()=>{
 const {gl,draw,clouds,loc}=fixture(false,true);draw();
 assert.deepEqual(Array.from(gl.uniformValues.get('uBvfxAtmoSourceSample')),[.5/640,.5/360]);
 let mutations=0;
 for(const name of ['useProgram','bindFramebuffer','bindVertexArray','viewport','activeTexture','bindTexture','bindSampler','enable','disable']){
  const original=gl[name];gl[name]=function(...args){mutations++;return original.apply(this,args);};
 }
 const before=gl.calls.filter(c=>c[0]==='draw').length;
 for(let i=0;i<100;i++)clouds.draw(gl,loc);
 assert.equal(mutations,0);assert.equal(gl.calls.filter(c=>c[0]==='draw').length,before);
 assert.equal(gl.uniformValues.get('uBvfxAtmoCloudCacheReady'),1);assert.equal(clouds.diagnostics().reuses,100);
});

test('The completed-target shortcut cannot reuse textures from a different graphics context',()=>{
 const first=fixture(),second=fixture();first.draw();
 first.clouds.draw(second.gl,second.loc);
 assert.equal(second.gl.calls.filter(c=>c[0]==='texImage3D').length,1,'a different CPU GL model allocates its own volume despite identical frame keys');
 assert(first.gl.calls.some(c=>c[0]==='deleteTexture'),'old context resources are released');
 assert.equal(first.clouds.diagnostics().integrations,2);assert.equal(first.clouds.diagnostics().reuses,0);
});
