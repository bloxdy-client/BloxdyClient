'use strict';
// Pure VM/CPU render-state tests. No Electron, real WebGL context or accounts.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {managedSource}=require('../adapters.cjs'),{defaults,prepare,SHADER_KEY}=require('../profile-settings.cjs');
const {installShaderSamplers}=require('../shader-adapter.cjs');
const {shaderRuntime,liquidPrograms,nativeShaderModules,nativeLiquidPrograms}=require('./shader-runtime-fixture.cjs');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/bloxd-visual-shader-5.6.14.2.bnmod')));
const original=name=>Buffer.from(pack.files.find(f=>f.path===name).data,'base64').toString();
const source=name=>managedSource('bloxd-visual-shader',name,original(name));
const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function factory(name,settings,internals=''){
  const clock={now:0},root={},context=vm.createContext({window:root,performance:{now:()=>clock.now}});
  installShaderSamplers(root);
  let code=source(name);
  if(internals)code=code.replace(name==='sun-shadows.js'?'return { invalidateTerrain, qualities, attach, patch, locations, bind, render, refresh,':'return {palette,common,groundLighting',
    name==='sun-shadows.js'?'return { '+internals+', invalidateTerrain, qualities, attach, patch, locations, bind, render, refresh,':'return { '+internals+',palette,common,groundLighting');
  vm.runInContext(code,context);
  return {clock,root,api:root[name==='sun-shadows.js'?'__BVFX_CREATE_SUN__':'__BVFX_CREATE_ATMOSPHERE__'](settings,()=>{})};
}
function fakeGl(){
  let id=0,active=1000,program=null,drawFbo=null,readFbo=null,vao=null,array=null,viewport=[0,0,800,600];
  const textures=new Map(),samplers=new Map(),caps=new Set(),values=new Map(),events=new Map(),calls=[],allocations=new Map();
  const gl={calls,allocations,events,canvas:{addEventListener:(key,fn)=>events.set(key,fn)}};
  const constants=`ACTIVE_TEXTURE TEXTURE_2D TEXTURE_3D TEXTURE_2D_ARRAY TEXTURE_BINDING_2D TEXTURE_BINDING_3D TEXTURE_BINDING_2D_ARRAY
    TEXTURE_MIN_FILTER TEXTURE_MAG_FILTER TEXTURE_COMPARE_MODE TEXTURE_COMPARE_FUNC COMPARE_REF_TO_TEXTURE LEQUAL NEAREST LINEAR
    TEXTURE_WRAP_S TEXTURE_WRAP_T CLAMP_TO_EDGE DEPTH_COMPONENT24 DEPTH_COMPONENT UNSIGNED_INT UNSIGNED_BYTE RGBA8 RGBA
    CURRENT_PROGRAM VERTEX_ARRAY_BINDING ARRAY_BUFFER ARRAY_BUFFER_BINDING ELEMENT_ARRAY_BUFFER ELEMENT_ARRAY_BUFFER_BINDING
    DRAW_FRAMEBUFFER DRAW_FRAMEBUFFER_BINDING READ_FRAMEBUFFER READ_FRAMEBUFFER_BINDING FRAMEBUFFER FRAMEBUFFER_COMPLETE DEPTH_ATTACHMENT
    COLOR_ATTACHMENT0 DEPTH_BUFFER_BIT COLOR_WRITEMASK DEPTH_WRITEMASK DEPTH_FUNC DEPTH_CLEAR_VALUE DEPTH_RANGE
    POLYGON_OFFSET_FACTOR POLYGON_OFFSET_UNITS POLYGON_OFFSET_FILL RASTERIZER_DISCARD STENCIL_TEST DEPTH_TEST CULL_FACE BLEND SCISSOR_TEST SCISSOR_BOX
    MAX_TEXTURE_SIZE MAX_VIEWPORT_DIMS MAX_TEXTURE_IMAGE_UNITS SAMPLER_BINDING VIEWPORT RENDERER NO_ERROR NONE
    VERTEX_SHADER FRAGMENT_SHADER COMPILE_STATUS LINK_STATUS ACTIVE_UNIFORMS ACTIVE_ATTRIBUTES ACTIVE_UNIFORM_BLOCKS
    PIXEL_UNPACK_BUFFER PIXEL_UNPACK_BUFFER_BINDING UNPACK_ALIGNMENT UNPACK_ROW_LENGTH UNPACK_IMAGE_HEIGHT UNPACK_SKIP_ROWS UNPACK_SKIP_PIXELS UNPACK_SKIP_IMAGES
    UNPACK_FLIP_Y_WEBGL UNPACK_PREMULTIPLY_ALPHA_WEBGL FLOAT STATIC_DRAW DYNAMIC_DRAW TRIANGLES LESS
    SAMPLER_2D SAMPLER_CUBE SAMPLER_3D SAMPLER_2D_ARRAY SAMPLER_2D_SHADOW SHADER_TYPE TEXTURE_CUBE_MAP TEXTURE_BINDING_CUBE_MAP
    FLOAT_VEC2 FLOAT_VEC3 FLOAT_VEC4 FLOAT_MAT4 TRANSFORM_FEEDBACK_ACTIVE TRANSFORM_FEEDBACK_PAUSED`.split(/\s+/).filter(Boolean);
  constants.forEach((name,i)=>gl[name]=i+1);gl.TEXTURE0=1000;
  const key=target=>active+':'+target;
  gl.getParameter=p=>{
    if(p===gl.ACTIVE_TEXTURE)return active;if(p===gl.CURRENT_PROGRAM)return program;
    if(p===gl.TEXTURE_BINDING_2D)return textures.get(key(gl.TEXTURE_2D))||null;
    if(p===gl.TEXTURE_BINDING_3D)return textures.get(key(gl.TEXTURE_3D))||null;
    if(p===gl.TEXTURE_BINDING_2D_ARRAY)return textures.get(key(gl.TEXTURE_2D_ARRAY))||null;
    if(p===gl.TEXTURE_BINDING_CUBE_MAP)return textures.get(key(gl.TEXTURE_CUBE_MAP))||null;
    if(p===gl.SAMPLER_BINDING)return samplers.get(active-gl.TEXTURE0)||null;
    if(p===gl.DRAW_FRAMEBUFFER_BINDING)return drawFbo;if(p===gl.READ_FRAMEBUFFER_BINDING)return readFbo;
    if(p===gl.ARRAY_BUFFER_BINDING)return array;if(p===gl.VERTEX_ARRAY_BINDING)return vao;
    if(p===gl.VIEWPORT)return viewport;if(p===gl.MAX_TEXTURE_IMAGE_UNITS)return 16;
    if(p===gl.SCISSOR_BOX)return values.get(p)||[0,0,800,600];
    if(p===gl.MAX_TEXTURE_SIZE)return 4096;if(p===gl.MAX_VIEWPORT_DIMS)return [4096,4096];
    if(p===gl.COLOR_WRITEMASK)return [true,true,true,true];if(p===gl.DEPTH_RANGE)return [0,1];
    if(p===gl.RENDERER)return 'CPU mock';return values.get(p)??0;
  };
  gl.activeTexture=v=>active=v;gl.bindTexture=(target,t)=>textures.set(key(target),t);
  gl.bindSampler=(unit,sampler)=>samplers.set(unit,sampler);
  gl.useProgram=p=>program=p;gl.bindVertexArray=v=>vao=v;
  gl.bindBuffer=(target,buffer)=>{if(target===gl.ARRAY_BUFFER)array=buffer;else values.set(target,buffer);};
  gl.bindFramebuffer=(target,f)=>{if(target!==gl.READ_FRAMEBUFFER)drawFbo=f;if(target!==gl.DRAW_FRAMEBUFFER)readFbo=f;};
  gl.viewport=(...v)=>viewport=v;gl.enable=cap=>caps.add(cap);gl.disable=cap=>caps.delete(cap);gl.isEnabled=cap=>caps.has(cap);
  gl.scissor=(...v)=>{values.set(gl.SCISSOR_BOX,v);calls.push(['scissor',...v]);};
  for(const type of ['Texture','Framebuffer','Buffer','VertexArray','Shader','Program'])gl['create'+type]=()=>({type,id:++id});
  for(const type of ['Texture','Framebuffer','Buffer','VertexArray','Shader','Program'])gl['delete'+type]=object=>calls.push(['delete'+type,object]);
  for(const name of ['texParameteri','framebufferTexture2D','drawBuffers','readBuffer','shaderSource','compileShader','attachShader','linkProgram',
    'enableVertexAttribArray','disableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','depthRange','polygonOffset','depthFunc','depthMask','colorMask','clearDepth',
    'bufferData','bindAttribLocation'])gl[name]=(...args)=>calls.push([name,...args]);
  gl.texImage2D=(...args)=>{const texture=textures.get(key(gl.TEXTURE_2D));allocations.set(texture,args);calls.push(['texImage2D',texture,...args]);};
  gl.pixelStorei=(field,value)=>values.set(field,value);
  gl.clear=()=>calls.push(['clear',drawFbo]);
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'])gl[name]=()=>calls.push(['draw',drawFbo,program]);
  gl.getError=()=>gl.NO_ERROR;gl.isContextLost=()=>false;gl.getExtension=()=>null;
  gl.checkFramebufferStatus=()=>gl.FRAMEBUFFER_COMPLETE;
  gl.getProgramParameter=(p,key)=>key===gl.LINK_STATUS?true:key===gl.ACTIVE_UNIFORMS?(p.uniforms?.length||0):0;
  gl.getShaderParameter=(shader,key)=>key===gl.SHADER_TYPE?shader.stage:true;
  gl.getActiveUniform=(p,index)=>p.uniforms[index];
  gl.getUniformLocation=(p,name)=>p.strict && !p.uniforms.some(u=>u.name===name)?null:{program:p,name};
  gl.getUniform=(p,loc)=>p.values?.get(loc.name)??0;
  for(const name of ['uniform1f','uniform1i','uniform1iv','uniform1fv','uniform2f','uniform3f','uniform4f','uniform2fv','uniform3fv','uniform4fv','uniformMatrix4fv'])
    gl[name]=(loc,...v)=>{if(loc){assert.equal(loc.program,program,'Uniform belongs to current program');let value=name==='uniformMatrix4fv'?Array.from(v[1]):v.length===1?v[0]:v;if((name==='uniform1iv'||name==='uniform1fv') && value.length===1)value=value[0];values.set(loc.name,value);loc.program.values??=new Map();loc.program.values.set(loc.name,value);}};
  gl.createShader=stage=>({stage,id:++id});gl.shaderSource=(shader,text)=>shader.source=text;
  gl.getShaderSource=shader=>shader.source;gl.attachShader=(p,shader)=>{p.shaders??=[];p.shaders.push(shader);};
  gl.getAttachedShaders=p=>p.shaders||[];
  const typeNames={float:gl.FLOAT,vec2:gl.FLOAT_VEC2,vec3:gl.FLOAT_VEC3,vec4:gl.FLOAT_VEC4,mat4:gl.FLOAT_MAT4,
    sampler2D:gl.SAMPLER_2D,samplerCube:gl.SAMPLER_CUBE,sampler3D:gl.SAMPLER_3D,sampler2DShadow:gl.SAMPLER_2D_SHADOW,sampler2DArray:gl.SAMPLER_2D_ARRAY};
  gl.linkProgram=p=>{p.uniforms=[];p.strict=true;const seen=new Set();for(const shader of p.shaders||[])
    for(const match of shader.source.matchAll(/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(\w+)\s*;/g)){
      if(seen.has(match[2]))continue;seen.add(match[2]);p.uniforms.push({name:match[2],type:typeNames[match[1]],size:1});}};
  gl.uniforms=(p,definitions)=>{p.uniforms=definitions.map(([name,type,size=1])=>({name,type:gl[type],size}));return p;};
  gl.sunProgram=()=>gl.uniforms(gl.createProgram(),['Map','NearMap','LocalMap','DetailMap'].map(key=>['uBvfxSun'+key,'SAMPLER_2D_SHADOW']));
  gl.skyProgram=()=>gl.uniforms(gl.createProgram(),[['uBvfxAtmoSkyCache','SAMPLER_2D']]);
  gl.texImage3D=(...args)=>{const texture=textures.get(key(gl.TEXTURE_3D));allocations.set(texture,args);calls.push(['texImage3D',texture,...args]);};
  gl.framebufferTexture2D=(_target,attachment,_type,texture)=>{drawFbo.attachments??=new Map();drawFbo.attachments.set(attachment,texture);};
  const targets=new Map([[gl.SAMPLER_2D,gl.TEXTURE_2D],[gl.SAMPLER_CUBE,gl.TEXTURE_CUBE_MAP],
    [gl.SAMPLER_3D,gl.TEXTURE_3D],[gl.SAMPLER_2D_ARRAY,gl.TEXTURE_2D_ARRAY],[gl.SAMPLER_2D_SHADOW,gl.TEXTURE_2D]]);
  gl.validateDraw=()=>{
    const occupied=new Map();for(const uniform of program.uniforms||[]){
      const target=targets.get(uniform.type);if(target===undefined)continue;
      const unit=program.values?.get(uniform.name)??0;
      if(occupied.has(unit))assert.equal(occupied.get(unit),uniform.type,'Conflicting sampler types on unit '+unit);
      occupied.set(unit,uniform.type);
      const texture=textures.get((gl.TEXTURE0+unit)+':'+target);
      assert.ok(texture && allocations.has(texture),'Complete sampler '+uniform.name);
      for(const attachment of drawFbo?.attachments?.values()||[])assert.notEqual(texture,attachment,'Read/write framebuffer feedback: '+uniform.name);
    }
  };
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'])gl[name]=()=>{gl.validateDraw();calls.push(['draw',drawFbo,program]);};
  gl.uniformValues=values;gl.boundTextures=textures;return gl;
}
function mesh({terrain=true}={}){
  const geometry={_indices:new Uint32Array([0,1,2])};
  return {name:terrain?'chunk':'mob',metadata:terrain?{noa_chunk_terrain_mesh:true}:{},noa_in_dynamic_list:!terrain,
    material:{},isVisible:true,visibility:1,_geometry:geometry,
    getVerticesData:()=>new Float32Array([0,0,0,1,0,0,0,1,0]),getVertexBuffer:()=>({isUpdatable:()=>true}),
    getWorldMatrix:identity,computeWorldMatrix:identity,isDisposed:()=>false};
}
function sceneFor(gl,meshes){return {meshes,materials:[],lights:[],cameras:[],activeCamera:{position:{x:0,y:0,z:0}},
  getEngine:()=>({_gl:gl}),onBeforeDrawPhaseObservable:{add:fn=>fn,remove(){}}};}
function sunSetup(meshes){
  const settings={...defaults('quality')['bloxd-visual-shader'][SHADER_KEY],sunRange:16,sunResolutionExponent:8,sunStrength:.75,sunFloor:.5,sunAzimuth:135,sunElevation:35};
  const fixture=factory('sun-shadows.js',settings,'positionsFor, world');const gl=fakeGl(),scene=sceneFor(gl,meshes);
  fixture.api.attach(scene,{});gl.useProgram(gl.sunProgram());fixture.api.bind(gl,fixture.api.locations(gl,gl.getParameter(gl.CURRENT_PROGRAM)),0);
  return {...fixture,gl,scene,settings};
}
test('Shader fixes guard original bytes and every generated module compiles',()=>{
  for(const f of pack.files)new vm.Script(source(f.path),{filename:f.path});
  assert.throws(()=>managedSource('bloxd-visual-shader','sun-shadows.js',original('sun-shadows.js')+'\n'),/does not match/);
});

test('Today\'s native terrain light emitter receives terrain, liquid and sunlight patches without changing its scope',()=>{
  const {read}=nativeShaderModules(),native=read(29957).mb(0);
  assert.match(native,/vec4 terrainLightLevels = vLightLevels/);
  const shader=shaderRuntime(),fragment=liquidPrograms(shader,'water').fragment;
  const patched=nativeLiquidPrograms(shader,'water').fragment;
  assert.match(patched,/#define BLOXD_LIGHTING/);assert.match(patched,/uBvfxWaterMode/);assert.match(patched,/uBvfxSunMap/);
  assert.match(patched,/terrainLightLevels\.w/);assert.doesNotMatch(patched,/\blightLevels\b/);
  assert.match(patched,/terrainHeldLight = heldLight/,'native held-light calculation remains present');
  assert.ok(fragment.includes('uBvfxWaterMode'),'legacy native dialect still works');
});
test('Slow-frame diagnostics preserve chosen shadow resolution instead of degrading it',()=>{
  const {createShaderBudget}=require('../shader-budget.cjs');
  const budget=createShaderBudget(()=>true,()=> 'balanced');
  for(let i=0;i<8;i++)budget.sample(180);
  const authored={...defaults('quality')['bloxd-visual-shader'][SHADER_KEY],sunResolutionExponent:12,sunFrameRate:60,sunRange:80};
  const f=factory('sun-shadows.js',budget.settings(authored)),gl=fakeGl();
  f.root.__BVFX_FRAME_BUDGET__=budget;
  f.api.attach(sceneFor(gl,[mesh(),mesh({terrain:false})]),{});
  const program=gl.sunProgram();gl.useProgram(program);f.api.bind(gl,f.api.locations(gl,program),0);f.api.render();
  const maps=[...gl.allocations.values()].filter(a=>a[2]===gl.DEPTH_COMPONENT24 && a[3]>1);
  assert.equal(maps.length,4);assert.ok(maps.some(map=>map[3]===4096));
  assert.equal(authored.sunResolutionExponent,12);assert.equal(authored.sunFrameRate,60);
});

test('All launcher defaults enable bloom, glowing ores and custom skies; explicit saved Off persists',()=>{
  for(const mode of ['economy','balanced','quality']){
    const prefs=defaults(mode)['bloxd-visual-shader'][SHADER_KEY];
    for(const key of ['bloomEnabled','oreGlowEnabled','atmosphereEnabled'])assert.equal(prefs[key],true);
    assert.ok(prefs.bloom>0);assert.ok(prefs.oreGlowStrength>0);
  }
  const saved={[SHADER_KEY]:{enabled:true,waterStyle:'flat',bloomEnabled:false,oreGlowEnabled:false,atmosphereEnabled:false}};
  const seed=prepare({storage:()=>saved},{id:'synthetic',performance:'balanced'},[{id:'bloxd-visual-shader'}]);
  assert.equal(seed['bloxd-visual-shader'][SHADER_KEY].atmosphereEnabled,false);
  const partial=prepare({storage:()=>({[SHADER_KEY]:{sunRange:64}})},{id:'synthetic',performance:'balanced'},[{id:'bloxd-visual-shader'}]);
  assert.equal(partial['bloxd-visual-shader'][SHADER_KEY].bloomEnabled,true);
  assert.equal(partial['bloxd-visual-shader'][SHADER_KEY].sunRange,64);
});
test('Golden Hour selects Cumulus and runtime defaults preserve explicit atmosphere Off',()=>{
  const code=source('shader.js'),start=code.indexOf('  const PRESETS ='),end=code.indexOf('  const storedState=loadSettings();');
  const context=vm.createContext({localStorage:{getItem:()=>JSON.stringify({visualDefaultsRevision:1,sliderModel:'normalized-v2',atmosphereEnabled:false})}});
  vm.runInContext("const STORAGE_KEY='synthetic';\n"+code.slice(start,end)+'\nglobalThis.result={DEFAULTS,SKY_STYLES,loaded:loadSettings()};',context);
  assert.equal(context.result.SKY_STYLES.golden.cloudType,'current');assert.equal(context.result.DEFAULTS.atmosphereEnabled,true);
  assert.equal(context.result.loaded.atmosphereEnabled,false);
});

test('High shadow settings keep close detail while bounding four depth maps and the resolution UI',()=>{
  const settings={enabled:true,sunShadowEnabled:true,entityShadows:true,sunResolutionExponent:14,sunRange:160,sunQuality:100};
  const f=factory('sun-shadows.js',settings,'quality'),q=f.api.quality();
  assert.equal(q.detailSize,4096);assert.ok(q.size<=2048);assert.ok(q.localSize<=2048);
  const {gl}=sunSetup([mesh()]);const scene=sceneFor(gl,[mesh()]);
  f.api.attach(scene,{});gl.useProgram(gl.sunProgram());f.api.bind(gl,f.api.locations(gl,gl.getParameter(gl.CURRENT_PROGRAM)),0);
  f.api.render();
  const maps=[...gl.allocations.values()].filter(args=>args[2]===gl.DEPTH_COMPONENT24 && args[3]>1);
  assert.equal(maps.length,4);assert.ok(maps.reduce((bytes,args)=>bytes+args[3]*args[4]*4,0)<=112*1024*1024);
  assert.match(source('shader.js'),/\['sunResolutionExponent', 'Shadow resolution', 5, 12,/);
  const runtime=shaderRuntime({sunResolutionExponent:14});assert.equal(runtime.state.sunResolutionExponent,12);
  assert.equal(shaderRuntime({sunQuality:100}).state.sunResolutionExponent,12,'legacy quality-only settings use the same bound');
});
test('Native sky Off still binds a complete 2D cache sampler and restores draw state',()=>{
  const settings={enabled:true,atmosphereEnabled:false,cloudCover:0,cloudType:'current',skyStyle:'clear'};
  const {api}=factory('atmosphere.js',settings),gl=fakeGl(),program=gl.skyProgram();gl.useProgram(program);
  const loc=api.locations(gl,program,gl.getUniformLocation);loc.volume=null;
  api.bind(gl,loc,gl);const previous=gl.getParameter(gl.ACTIVE_TEXTURE),restore=api.bindVolume(gl,loc,program);
  const texture=gl.boundTextures.get((gl.TEXTURE0+loc.skyUnit)+':'+gl.TEXTURE_2D);
  assert.ok(texture);assert.equal(gl.allocations.get(texture)[3],1);
  assert.equal(gl.uniformValues.get('uBvfxAtmoActive'),0);assert.equal(gl.uniformValues.get('uBvfxAtmoCacheReady'),0);
  let draws=0;api.drawSky(gl,loc,()=>{draws++;},[]);assert.equal(draws,1);assert.equal(gl.getParameter(gl.ACTIVE_TEXTURE),previous);
  restore();assert.equal(gl.boundTextures.get((gl.TEXTURE0+loc.skyUnit)+':'+gl.TEXTURE_2D),null);
  settings.atmosphereEnabled=true;api.bind(gl,loc,gl);assert.equal(gl.uniformValues.get('uBvfxAtmoActive'),1);
  settings.atmosphereEnabled=false;api.bind(gl,loc,gl);assert.equal(gl.uniformValues.get('uBvfxAtmoActive'),0);
});
test('Custom sky cache draws never sample their attached render target; every style toggles back to native',()=>{
  const settings={enabled:true,atmosphereEnabled:true,cloudCover:0,cloudType:'current',skyStyle:'clear',sunAzimuth:135,sunElevation:35};
  const {api,root}=factory('atmosphere.js',settings,'skyCaches'),gl=fakeGl();
  root.__BLOXD_MOD_HOST__={profile:{performance:'balanced'}};gl.viewport(0,0,1920,1080);
  const p=gl.createProgram(),vert=gl.createShader(gl.VERTEX_SHADER),frag=gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(vert,'#version 300 es\nprecision highp float;layout(location=0)in vec3 position;out highp vec3 vPositionW;void main(){vPositionW=position;gl_Position=vec4(position,1.0);}');
  gl.shaderSource(frag,api.patchSky('#version 300 es\n#define BVFX_SKYBOX\nprecision highp float;uniform samplerCube reflectionSampler;uniform vec4 vEyePosition;in highp vec3 vPositionW;out vec4 color;void main(){color=texture(reflectionSampler,normalize(vPositionW-vEyePosition.xyz));}'));
  gl.attachShader(p,vert);gl.attachShader(p,frag);gl.linkProgram(p);gl.useProgram(p);
  const cube=gl.createTexture();gl.bindTexture(gl.TEXTURE_CUBE_MAP,cube);gl.allocations.set(cube,['complete native cubemap']);
  const loc=api.locations(gl,p,gl.getUniformLocation);
  for(const style of ['clear','golden','moonlit','milkyway','blackhole','andromeda']){
    settings.skyStyle=style;
    for(const on of [true,false,true]){
      settings.atmosphereEnabled=on;api.bind(gl,loc,gl);const restore=api.bindVolume(gl,loc,p);
      const before=gl.calls.filter(c=>c[0]==='draw').length;api.drawSky(gl,loc,gl.drawArrays,[]);
      assert.equal(loc.cacheError,undefined,loc.cacheError);assert.ok(gl.calls.filter(c=>c[0]==='draw').length>before);
      if(on){const cache=api.skyCaches.get(gl);assert.ok(cache.drawWidth<=(style==='clear'||style==='golden'||style==='moonlit'?640:960));}
      assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),p);assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),null);
      restore?.();
    }
  }
  assert.ok(api.skyDiagnostics(gl).renders>0);
  root.__BLOXD_MOD_HOST__.profile.performance='quality';settings.skyStyle='clear';settings.atmosphereEnabled=true;
  api.bind(gl,loc,gl);const restore=api.bindVolume(gl,loc,p);api.drawSky(gl,loc,gl.drawArrays,[]);restore?.();
  assert.equal(api.skyCaches.get(gl).drawWidth,960);assert.equal(api.skyCaches.get(gl).drawHeight,540);
});
test('Combined terrain/liquid samplers allocate distinct units and follow native reassignments',()=>{
  const gl=fakeGl(),root={};const revisions=new WeakMap();root.__BVFX_GL_STATE__=()=>({programRevisions:revisions,markSampler(){}});installShaderSamplers(root);
  const p=gl.uniforms(gl.createProgram(),[['terrainAtlas','SAMPLER_2D_ARRAY'],['environment','SAMPLER_CUBE'],['uBvfxOreAtlasLookup','SAMPLER_2D'],
    ['uBvfxAtmoCloudVolume','SAMPLER_3D'],['uBvfxSunMap','SAMPLER_2D_SHADOW'],['uBvfxSunNearMap','SAMPLER_2D_SHADOW'],
    ['uBvfxSunLocalMap','SAMPLER_2D_SHADOW'],['uBvfxSunDetailMap','SAMPLER_2D_SHADOW']]);gl.useProgram(p);
  gl.uniform1i(gl.getUniformLocation(p,'terrainAtlas'),0);gl.uniform1i(gl.getUniformLocation(p,'environment'),1);
  let units=root.__BVFX_SAMPLER_UNITS__(gl,p);assert.equal(new Set(units.values()).size,units.size);
  for(const unit of units.values())assert.ok(unit!==0 && unit!==1);
  const highest=Math.max(...units.values());gl.uniform1i(gl.getUniformLocation(p,'environment'),highest);revisions.set(p,1);
  units=root.__BVFX_SAMPLER_UNITS__(gl,p);for(const unit of units.values())assert.notEqual(unit,highest);
  assert.equal(new Set(units.values()).size,units.size);assert.equal(root.__BVFX_SAMPLER_UNITS__(gl,p),units);
});

test('Sky variant consumes observed uniform uploads without synchronous driver reads',()=>{
  const {api,root}=factory('atmosphere.js',{},'copySkyUniforms'),gl=fakeGl(),program=gl.createProgram(),target=gl.createProgram();
  const from={},to={program:target,name:'nativeSun'},entry={revision:1,valueRevision:1,value:new Float32Array([.1,.2,.3])};
  root.__BVFX_GL_STATE__=()=>({watchUniform:()=>entry});gl.getUniform=()=>{throw Error('Unexpected synchronous uniform read');};
  const variant={uniforms:[{from,to,type:gl.FLOAT_VEC3,size:1}],attributes:[],blocks:[],revision:0};gl.useProgram(target);
  api.copySkyUniforms(gl,program,variant);assert.deepEqual(Array.from(target.values.get('nativeSun')),Array.from(entry.value));
  entry.revision++;entry.valueRevision++;entry.value=new Float32Array([.4,.5,.6]);
  api.copySkyUniforms(gl,program,variant);assert.deepEqual(Array.from(target.values.get('nativeSun')),Array.from(entry.value));
  assert.deepEqual({...entry.capture},{method:'uniform3fv',size:1});
});

test('Native sampler changes reuse reflection, while relinks rediscover the complete layout',()=>{
  const gl=fakeGl(),root={},revisions=new WeakMap(),links=new WeakMap();
  root.__BVFX_GL_STATE__=()=>({programRevisions:revisions,linkRevisions:links,markSampler(){}});
  installShaderSamplers(root);
  const p=gl.uniforms(gl.createProgram(),[['atlas','SAMPLER_2D_ARRAY'],['uBvfxSunMap','SAMPLER_2D_SHADOW'],
    ...Array.from({length:200},(_,i)=>['ordinary'+i,'FLOAT'])]);gl.useProgram(p);
  let reflections=0,values=0;
  const reflect=gl.getActiveUniform,read=gl.getUniform;
  gl.getActiveUniform=(...args)=>{reflections++;return reflect(...args);};
  gl.getUniform=(...args)=>{values++;return read(...args);};
  const first=root.__BVFX_SAMPLER_UNITS__(gl,p);assert.equal(reflections,202);
  const occupied=first.get('uBvfxSunMap');
  for(let i=1;i<=50;i++){
    gl.uniform1i(gl.getUniformLocation(p,'atlas'),i%2?occupied:0);revisions.set(p,i);
    const units=root.__BVFX_SAMPLER_UNITS__(gl,p);
    assert.notEqual(units.get('uBvfxSunMap'),i%2?occupied:0);
  }
  assert.equal(reflections,202,'no repeated full-program reflection');assert.equal(values,51);
  p.uniforms.push({name:'uBvfxOreAtlasLookup',type:gl.SAMPLER_2D,size:1});links.set(p,1);
  const relinked=root.__BVFX_SAMPLER_UNITS__(gl,p);
  assert.equal(reflections,405);assert.ok(relinked.has('uBvfxOreAtlasLookup'));
  assert.equal(new Set(relinked.values()).size,relinked.size);
});

test('Hit/menu helper churn keeps the shadow registry without rereading terrain or object metadata',()=>{
  const terrain=mesh(),mob=mesh({terrain:false});let reads=0;
  const positions=terrain.getVerticesData;terrain.getVerticesData=(...args)=>{reads++;return positions(...args);};
  const fixture=factory('sun-shadows.js',{},'casterRegistry'),gl=fakeGl(),scene=sceneFor(gl,[terrain,mob]);
  fixture.api.attach(scene,{});
  const registry=fixture.api.casterRegistry(),initialReads=reads;
  for(let i=1;i<=100;i++){
    fixture.clock.now=i;
    scene.meshes.push({...mesh({terrain:false}),name:'damage-impact-'+i});
    assert.equal(fixture.api.casterRegistry(),registry);
  }
  scene.meshes.splice(2);fixture.clock.now=110;
  assert.equal(fixture.api.casterRegistry(),registry);assert.equal(reads,initialReads);
  const incoming=mesh();incoming.getVerticesData=()=>null;
  scene.meshes.push(incoming);fixture.clock.now=120;
  const replacement=fixture.api.casterRegistry();assert.notEqual(replacement,registry);
  assert.ok(replacement.staticItems.some(entry=>entry.mesh===incoming),'pending chunks must be included immediately');
  scene.meshes.splice(scene.meshes.indexOf(mob),1);fixture.clock.now=130;
  const removed=fixture.api.casterRegistry();assert.notEqual(removed,replacement);
  assert.ok(!removed.movingItems.some(entry=>entry.mesh===mob));
  fixture.clock.now=400;assert.notEqual(fixture.api.casterRegistry(),removed,'periodic discovery still runs');
});

test('In-place native chunk rewrites invalidate their shadow buffers and static maps',()=>{
  const positions=new Float32Array([0,0,0,1,0,0,0,1,0]),terrain=mesh();
  const buffer={isUpdatable:()=>false};terrain.getVertexBuffer=()=>buffer;terrain.getVerticesData=()=>positions;
  const f=factory('sun-shadows.js',{},'geometry,casterRegistry'),gl=fakeGl(),scene=sceneFor(gl,[terrain]);f.api.attach(scene,{});
  const initial=f.api.casterRegistry(),revision=initial.staticRevision,entry=f.api.geometry(gl,terrain),before=entry.bounds[3];
  positions[3]=8; // Same mesh, geometry, buffer and typed-array identities.
  f.api.invalidateTerrain([terrain]);
  const next=f.api.casterRegistry();assert.ok(next.staticRevision>revision);
  assert.equal(next,initial,'known chunk rewrites preserve the caster registry');
  const updated=f.api.geometry(gl,terrain);assert.equal(updated,entry,'reuse owned GPU buffers');
  assert.equal(updated.bounds[3],8);assert.notEqual(updated.bounds[3],before);
});
test('Repeated in-place chunk uploads preserve the scene registry',()=>{
  let scans=0;const terrain=mesh(),f=factory('sun-shadows.js',{},'casterRegistry'),gl=fakeGl();
  const scene=sceneFor(gl,new Proxy([terrain],{get:(target,key)=>{if(key===Symbol.iterator)scans++;return Reflect.get(target,key);}}));
  f.api.attach(scene,{});const registry=f.api.casterRegistry(),before=registry.staticRevision;scans=0;
  for(let i=0;i<1000;i++){f.api.invalidateTerrain([terrain]);assert.equal(f.api.casterRegistry(),registry);}
  assert.equal(scans,0);assert.ok(registry.staticRevision>before);
});

test('Observed chunk geometry stays uploaded, edits repair a scissored region and camera moves rebuild the projection',()=>{
  let reads=0;
  const chunks=Array.from({length:36},(_,i)=>{
    const value=mesh(),buffer={isUpdatable:()=>true},positions=new Float32Array([0,0,0,1,0,0,0,1,0]),wm=identity();
    wm[12]=(i%6-3)*4;wm[14]=(Math.floor(i/6)-3)*4;
    value.getVertexBuffer=()=>buffer;value.getVerticesData=()=>{reads++;return positions.slice();};
    value.getWorldMatrix=value.computeWorldMatrix=()=>wm;value.positions=positions;return value;
  });
  const s=sunSetup(chunks);s.settings.entityShadows=false;s.api.invalidateTerrain(chunks);s.api.render();
  assert.equal(reads,chunks.length);const uploaded=s.gl.calls.filter(c=>c[0]==='bufferData').length;
  for(let i=1;i<=50;i++){s.clock.now=i*20;s.api.render();}
  assert.equal(reads,chunks.length,'even periodic registry discovery must not deinterleave unchanged chunks');
  assert.equal(s.gl.calls.filter(c=>c[0]==='bufferData').length,uploaded);
  s.gl.scissor(7,8,90,91);s.gl.enable(s.gl.SCISSOR_TEST);
  chunks[21].positions[3]=1.5;s.api.invalidateTerrain([chunks[21]]);s.clock.now=1100;s.api.render();
  assert.equal(reads,chunks.length+1,'only the edited chunk is read again');
  assert.equal(s.api.chunkCacheDiagnostics.partialPasses,1);
  assert.ok(s.api.shadowDiagnostics.world.drawCalls<chunks.length/2);
  assert.deepEqual(s.gl.getParameter(s.gl.SCISSOR_BOX),[7,8,90,91]);assert.equal(s.gl.isEnabled(s.gl.SCISSOR_TEST),true);
  const full=s.api.chunkCacheDiagnostics.fullPasses;s.scene.activeCamera.position.x=5;s.clock.now=1200;s.api.render();
  assert.ok(s.api.chunkCacheDiagnostics.fullPasses>full,'a shifted view cannot retain the old projection');
});

test('Continuous chunk edits respect the selected cadence and cannot starve outer shadow cascades',()=>{
  const terrain=mesh(),buffer={isUpdatable:()=>true};terrain.getVertexBuffer=()=>buffer;
  const s=sunSetup([terrain]);s.settings.sunRange=80;s.settings.sunFrameRate=5;s.settings.entityShadows=false;
  s.api.invalidateTerrain([terrain]);s.api.render();
  let previous=s.api.shadowDiagnostics;
  const counts={world:0,local:0,detail:0},times={world:0,local:0,detail:0};
  for(let now=10;now<=2000;now+=10){
    s.clock.now=now;s.api.invalidateTerrain([terrain]);s.api.render();
    const current=s.api.shadowDiagnostics;let passes=0;
    for(const key of Object.keys(counts))if(current[key]!==previous[key]){
      assert.ok(now-times[key]>=200,`${key} ignored the authored 5 Hz cadence`);
      counts[key]++;times[key]=now;passes++;
    }
    assert.ok(passes<=1,'streaming cannot rebuild all static cascades in one frame');previous=current;
  }
  for(const [key,count]of Object.entries(counts))assert.ok(count>=9 && count<=10,`${key} was starved: ${count} updates`);
});

test('Chunk edits retain a matching projection during slow sun motion until the orbit refresh is due',()=>{
  const terrain=mesh(),buffer={isUpdatable:()=>true};terrain.getVertexBuffer=()=>buffer;
  const s=sunSetup([terrain]);s.settings.entityShadows=false;
  const cycle=degrees=>({phase:'day',preset:'test',body:[Math.sin(degrees*Math.PI/180),Math.cos(degrees*Math.PI/180),0]});
  s.settings.dayNightFrame=cycle(0);s.api.invalidateTerrain([terrain]);s.api.render();
  const full=s.api.chunkCacheDiagnostics.fullPasses;
  s.clock.now=100;s.settings.dayNightFrame=cycle(.05);s.api.invalidateTerrain([terrain]);s.api.render();
  assert.equal(s.api.chunkCacheDiagnostics.fullPasses,full,'small sun steps must not defeat chunk caching');
  assert.equal(s.api.chunkCacheDiagnostics.partialPasses,1);
  s.clock.now=600;s.settings.dayNightFrame=cycle(.2);s.api.render();
  assert.ok(s.api.chunkCacheDiagnostics.fullPasses>full,'partial edits must not postpone the accumulated orbit refresh');
});

test('Observed hit/menu mesh events avoid whole-scene membership scans and clean up on scene changes',()=>{
 const observable=()=>{const listeners=new Set();return {listeners,add:fn=>{listeners.add(fn);return fn;},remove:fn=>listeners.delete(fn),emit:value=>{for(const fn of listeners)fn(value);}};};let scans=0;
 const settings={enabled:true,sunShadowEnabled:true},fixture=factory('sun-shadows.js',settings,'casterRegistry'),gl=fakeGl(),scene=sceneFor(gl,[]);
 scene.onNewMeshAddedObservable=observable();scene.onMeshRemovedObservable=observable();
 scene.meshes=new Proxy([mesh(),mesh({terrain:false})],{get:(target,key)=>{if(key===Symbol.iterator)scans++;return Reflect.get(target,key);}});
 fixture.api.attach(scene,{});const initial=fixture.api.casterRegistry();scans=0;
 for(let i=0;i<1000;i++){
  const helper={...mesh({terrain:false}),name:'damage-impact-'+i};scene.meshes.push(helper);scene.onNewMeshAddedObservable.emit(helper);fixture.clock.now=i/10;
  assert.equal(fixture.api.casterRegistry(),initial);scene.meshes.pop();scene.onMeshRemovedObservable.emit(helper);
 }
 assert.equal(scans,0,'helper events require no scene.meshes iteration');
 const incoming=mesh();scene.meshes.push(incoming);scene.onNewMeshAddedObservable.emit(incoming);
 const replaced=fixture.api.casterRegistry();assert.notEqual(replaced,initial);assert.ok(replaced.staticItems.some(e=>e.mesh===incoming));
 scene.meshes.splice(scene.meshes.indexOf(incoming),1);scene.onMeshRemovedObservable.emit(incoming);assert.notEqual(fixture.api.casterRegistry(),replaced);
 const next=sceneFor(gl,[]);next.onNewMeshAddedObservable=observable();next.onMeshRemovedObservable=observable();fixture.api.attach(next,{});
 assert.equal(scene.onNewMeshAddedObservable.listeners.size,0);assert.equal(scene.onMeshRemovedObservable.listeners.size,0);
 assert.equal(next.onNewMeshAddedObservable.listeners.size,1);settings.sunShadowEnabled=false;fixture.api.attach(next,{});assert.equal(next.onNewMeshAddedObservable.listeners.size,0);
 settings.sunShadowEnabled=true;fixture.api.attach(next,{});assert.equal(next.onNewMeshAddedObservable.listeners.size,1);
 fixture.api.dispose();assert.equal(next.onNewMeshAddedObservable.listeners.size,0);assert.equal(next.onMeshRemovedObservable.listeners.size,0);
});
test('Turning cloud and ore effects Off binds complete neutral textures without touching native units',()=>{
  const gl=fakeGl(),root={};installShaderSamplers(root);
  const program=gl.uniforms(gl.createProgram(),[['terrainAtlas','SAMPLER_2D_ARRAY'],['uBvfxOreAtlasLookup','SAMPLER_2D'],['uBvfxAtmoCloudVolume','SAMPLER_3D']]);gl.useProgram(program);
  const native=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,native);gl.allocations.set(native,['native atlas']);
  const units=root.__BVFX_SAMPLER_UNITS__(gl,program),restoreOre=root.__BVFX_BIND_NEUTRAL__(gl,units.get('uBvfxOreAtlasLookup'),gl.TEXTURE_2D);
  const restoreCloud=root.__BVFX_BIND_NEUTRAL__(gl,units.get('uBvfxAtmoCloudVolume'),gl.TEXTURE_3D);
  gl.validateDraw();assert.equal(gl.boundTextures.get(gl.TEXTURE0+':'+gl.TEXTURE_2D_ARRAY),native);
  restoreCloud();restoreOre();assert.equal(gl.getParameter(gl.ACTIVE_TEXTURE),gl.TEXTURE0);
});
test('Every inactive shadow sampler has a complete comparison texture before terrain draws',()=>{
  const {api,gl,settings}=sunSetup([]);settings.sunShadowEnabled=false;
  const program=gl.sunProgram();gl.useProgram(program);const loc=api.locations(gl,program);
  const restore=api.bind(gl,loc,1);
  for(const key of ['Map','NearMap','DetailMap','LocalMap']){
    const unit=gl.uniformValues.get('uBvfxSun'+key),texture=gl.boundTextures.get((gl.TEXTURE0+unit)+':'+gl.TEXTURE_2D);
    assert.ok(texture,key);assert.equal(gl.allocations.get(texture)[2],gl.DEPTH_COMPONENT24);
  }
  assert.equal(gl.uniformValues.get('uBvfxSunActive'),0);restore?.();
});
test('Pending block geometry retries after its grace period without waiting for a camera move',()=>{
  const terrain=mesh(),s=sunSetup([terrain]);s.api.render();assert.ok(s.api.shadowDiagnostics.world?.drawCalls>0,s.api.diagnostic);
  const before=s.gl.calls.filter(c=>c[0]==='deleteTexture').length;
  terrain.getVerticesData=()=>null;terrain._geometry={_indices:new Uint32Array([0,1,2])};s.clock.now=200;s.settings.sunAzimuth=150;
  s.api.refresh();s.api.render();s.clock.now=800;s.api.render();
  const program=s.gl.sunProgram();s.gl.useProgram(program);s.api.bind(s.gl,s.api.locations(s.gl,program),2);
  assert.equal(s.gl.uniformValues.get('uBvfxSunActive'),1);
  assert.equal(s.gl.calls.filter(c=>c[0]==='deleteTexture').length,before);
  terrain.getVerticesData=()=>new Float32Array([0,0,0,1,0,0,0,1,0]);s.clock.now=1000;s.api.render();
  assert.ok(s.api.shadowDiagnostics.world.drawCalls>0);
});
test('Partial chunk maps keep retrying when the geometry object and world revision stay unchanged',()=>{
  const terrain=mesh(),other=mesh(),s=sunSetup([terrain,other]);terrain.getVertexBuffer=()=>undefined;s.api.render();
  const positions=terrain.getVerticesData;terrain._geometry={_indices:new Uint32Array([0,1,2])};terrain.getVerticesData=()=>null;s.clock.now=200;s.api.refresh();s.api.render();
  s.clock.now=700;s.api.render();assert.equal(s.api.shadowDiagnostics.world.pending,true);
  terrain.getVerticesData=positions;s.clock.now=850;s.api.render();assert.ok(s.api.shadowDiagnostics.world.drawCalls>1,s.api.diagnostic);
  assert.equal(s.api.shadowDiagnostics.world.pending,false);
});

test('A newly selected pending chunk cannot clear the complete shadow map during a projection change',()=>{
  const terrain=mesh(),s=sunSetup([terrain]);s.api.render();
  const clears=s.gl.calls.filter(c=>c[0]==='clear').length;
  const incoming=mesh();incoming.getVerticesData=()=>null;incoming._geometry={_indices:new Uint32Array([0,1,2])};
  s.scene.meshes.push(incoming);s.clock.now=200;s.settings.sunAzimuth=150;s.api.refresh();s.api.render();
  assert.equal(s.api.shadowDiagnostics.world.pending,true);assert.equal(s.gl.calls.filter(c=>c[0]==='clear').length,clears);
  incoming.getVerticesData=()=>new Float32Array([0,0,0,1,0,0,0,1,0]);s.clock.now=320;s.api.render();
  assert.ok(s.api.shadowDiagnostics.world.drawCalls>1);assert.equal(s.api.shadowDiagnostics.world.pending,false);
});
test('Active terrain draws remain valid when the moving cascade is empty or disabled',()=>{
  const s=sunSetup([mesh()]);s.api.render();const program=s.gl.sunProgram();s.gl.useProgram(program);
  const loc=s.api.locations(s.gl,program);s.api.bind(s.gl,loc,1);
  assert.equal(s.gl.uniformValues.get('uBvfxSunActive'),1);assert.equal(s.gl.uniformValues.get('uBvfxSunNearActive'),0);
  for(const key of ['Map','NearMap','DetailMap','LocalMap']){
    const unit=s.gl.uniformValues.get('uBvfxSun'+key),texture=s.gl.boundTextures.get((s.gl.TEXTURE0+unit)+':'+s.gl.TEXTURE_2D);
    assert.ok(s.gl.allocations.has(texture),key);
  }
  s.settings.entityShadows=false;s.clock.now=100;s.api.refresh();s.api.render();s.api.bind(s.gl,loc,2);
  assert.equal(s.gl.uniformValues.get('uBvfxSunActive'),1);assert.equal(s.gl.uniformValues.get('uBvfxSunNearActive'),0);
});
test('Removing the last mob removes its silhouette without a stale grace frame',()=>{
  const mob=mesh({terrain:false}),s=sunSetup([mesh(),mob]);s.api.render();assert.ok(s.api.shadowDiagnostics.moving.drawCalls>0);
  s.scene.meshes.pop();s.clock.now=60;s.api.render();const program=s.gl.sunProgram();s.gl.useProgram(program);
  s.api.bind(s.gl,s.api.locations(s.gl,program),2);assert.equal(s.gl.uniformValues.get('uBvfxSunNearActive'),0);
  assert.equal(s.gl.uniformValues.get('uBvfxSunActive'),1);
});
test('A malformed mob cannot release world shadows or the other moving casters',()=>{
  const a=mesh({terrain:false}),b=mesh({terrain:false}),s=sunSetup([mesh(),a,b]);s.api.render();
  const clears=s.gl.calls.filter(c=>c[0]==='clear').length;
  b.getVerticesData=()=>{throw Error('Model is being rebuilt');};s.clock.now=60;s.api.render();
  assert.ok(s.api.ready,s.api.diagnostic);assert.ok(s.api.shadowDiagnostics.moving.drawCalls>0);
  assert.equal(s.api.shadowDiagnostics.moving?.pending,true,s.api.diagnostic);
  b.getVerticesData=()=>new Float32Array([0,0,0,1,0,0,0,1,0]);s.clock.now=120;s.api.render();
  assert.ok(s.gl.calls.filter(c=>c[0]==='clear').length>clears);
});
test('CPU skinning keeps zero-weight vertices and rejects missing extra influences without NaNs',()=>{
  const {api}=factory('sun-shadows.js',{},'positionsFor');const positions=new Float32Array([1,2,3]);
  const matrices=identity();matrices[12]=2;
  const model={numBoneInfluencers:8,skeleton:{getTransformMatrices:()=>matrices},getVerticesData:key=>
    key==='matricesIndices'?new Float32Array([0,99,0,0]):key==='matricesWeights'?new Float32Array([.5,.5,0,0]):null};
  assert.deepEqual(Array.from(api.positionsFor(model,positions)),[3,2,3]);
  model.getVerticesData=key=>key==='matricesIndices'?new Float32Array(4):key==='matricesWeights'?new Float32Array(4):null;
  assert.deepEqual(Array.from(api.positionsFor(model,positions)),[1,2,3]);
});
test('Moving mesh transforms are composed before cached world matrices are read',()=>{
  const {api}=factory('sun-shadows.js',{},'world');let computed=0;
  const fresh=identity();fresh[12]=5;const matrix=api.world({computeWorldMatrix:()=>{computed++;return fresh;},getWorldMatrix:identity});
  assert.equal(computed,1);assert.equal(matrix[12],5);
});
test('Actual document-start pipeline patches water and lava and keeps their in-game settings',()=>{
  const runtime=shaderRuntime({waterStyle:'wavey',waterPhysics:true,lavaEnabled:true,lavaStyle:'wavey',atmosphereEnabled:false,oreGlowEnabled:false});
  assert.equal(runtime.runtime.error,'');assert.equal(runtime.state.lavaEnabled,true);assert.equal(runtime.state.atmosphereEnabled,false);
  for(const kind of ['water','lava']){
    const program=liquidPrograms(runtime,kind);assert.match(program.vertex,/bvfxVertexWaterHeight/);
    assert.match(program.fragment,/bvfxLiquidSurfacePosition/);assert.match(program.fragment,/uBvfxSunMap/);
    assert.match(program.fragment,/uBvfxOreAtlasLookup/);assert.match(program.fragment,/uBvfxAtmoCloudVolume/);
  }
});
test('Ore, atmosphere and shadow binding functions coexist in the actual water/lava pipeline',()=>{
  const runtime=shaderRuntime({oreGlowEnabled:false,atmosphereEnabled:false,sunShadowEnabled:false,lavaEnabled:true,lavaStyle:'wavey'});
  const gl=fakeGl();runtime.sun.attach(sceneFor(gl,[mesh()]),{});runtime.state.sunResolutionExponent=8;
  for(const kind of ['water','lava']){
    const pair=liquidPrograms(runtime,kind),p=gl.createProgram(),v=gl.createShader(gl.VERTEX_SHADER),f=gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(v,pair.vertex);gl.shaderSource(f,pair.fragment);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.useProgram(p);
    const ore={oreLookup:gl.getUniformLocation(p,'uBvfxOreAtlasLookup'),oreStrength:gl.getUniformLocation(p,'uBvfxOreGlowStrength'),oreSize:gl.getUniformLocation(p,'uBvfxOreAtlasSize')};
    const atmosphere=runtime.atmosphere.locations(gl,p,gl.getUniformLocation),shadow=runtime.sun.locations(gl,p);
    for(const on of [false,true,false,true]){
      runtime.state.oreGlowEnabled=on;runtime.state.atmosphereEnabled=on;runtime.state.sunShadowEnabled=on;runtime.state.cloudCover=0;
      runtime.sun.bind(gl,shadow,1);runtime.sun.refresh();runtime.sun.render();
      const restoreOre=runtime.bindOreLookup(gl,ore,p),restoreAtmosphere=runtime.atmosphere.bindVolume(gl,atmosphere,p),restoreShadow=runtime.sun.bind(gl,shadow,2);
      gl.validateDraw();assert.equal(gl.uniformValues.get('uBvfxSunActive'),on?1:0,runtime.sun.diagnostic);
      restoreShadow?.();restoreAtmosphere?.();restoreOre?.();
    }
  }
});
