'use strict';
// CPU-only definitions and synthetic GL calls; no rendering or client process.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {shaderRuntime,liquidPrograms}=require('./shader-runtime-fixture.cjs');
function observable(){const callbacks=new Set();return {add:fn=>{callbacks.add(fn);return fn;},remove:fn=>callbacks.delete(fn),emit:value=>{for(const fn of [...callbacks])fn(value);}};}
test('Automatic performance records are bounded, local and contain only whitelisted timing/queue data',()=>{
 const messages=[],r=shaderRuntime({enabled:true},{console:{...console,info:message=>messages.push(message)}});
 r.root.__BLOXD_MOD_HOST__.profile.privateAccountName='PRIVATE_ACCOUNT_SENTINEL';
 for(let i=0;i<10000;i++)r.recordShaderFrame(i*16.667);
 assert.equal(messages.length,2);
 for(const message of messages){
  assert(message.startsWith('[BVFX performance] '));assert(!message.includes('PRIVATE_ACCOUNT_SENTINEL'));
  const sample=JSON.parse(message.slice('[BVFX performance] '.length));
  assert.equal(sample.schema,'shader-performance-v1');assert(sample.callbackFps>59&&sample.callbackFps<61);
  assert.equal(sample.frames,120);assert.match(sample.scope,/not presented FPS/);
  assert(!('renderer' in sample));assert(!('profile' in sample));assert(!('account' in sample));
 }
});
test('Master Off compiles unmodified native sources and draws without mod uniform or sampler lookups',()=>{
  class GL {
    constructor(){this.canvas={addEventListener(){}};this.reads=0;this.writes=0;this.draws=0;}
    getParameter(key){return key===this.RENDERER?'CPU diagnostic sink':key===this.VERSION?'WebGL 2 synthetic':16;}getUniformLocation(){this.reads++;return null;}
    shaderSource(shader,source){shader.source=source;}compileShader(){}
    attachShader(program,shader){(program.shaders ||= []).push(shader);}
    linkProgram(){}getProgramParameter(){return true;}getShaderParameter(){return true;}
    getShaderInfoLog(){return '';}getProgramInfoLog(){return '';}
    useProgram(program){this.program=program;}uniform1f(){this.writes++;}
    drawArrays(){this.draws++;}drawElements(){this.draws++;}
  }
  const shader=shaderRuntime({enabled:false},{WebGL2RenderingContext:GL});
  const gl=new GL(),program={},pair=liquidPrograms({patchLiquidVertexShader:s=>s,patchTerrainShader:s=>s,sun:{patch:s=>s}},'water');
  for(const enabled of [false,true,false]){
    shader.state.enabled=enabled;
    const vertex={},fragment={};gl.shaderSource(vertex,pair.vertex);gl.shaderSource(fragment,pair.fragment);
    assert.equal(vertex.source,pair.vertex);assert.equal(fragment.source,pair.fragment,'untagged native cache entries are never patched');
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.useProgram(program);
    for(let i=0;i<1000;i++)gl.drawArrays(0,0,3);
  }
  assert.equal(gl.draws,3000);assert.equal(gl.reads,0);assert.equal(gl.writes,0);
  shader.state.enabled=true;
  const tagged={},source=pair.fragment.replace('#version 300 es','#version 300 es\n#define BVFX_MASTER_ACTIVE');
  gl.shaderSource(tagged,source);assert.match(tagged.source,/uBvfxWaterMode/,'the tagged enabled variant still receives effects');
  gl.RENDERER=1001;gl.VERSION=1002;
  const report=shader.root.__BVFX_INSTANCE__.diagnostics();
  assert.equal(report.renderer,'CPU diagnostic sink');assert.equal(report.version,'WebGL 2 synthetic','diagnostics reuse the observed context without creating one');
});

test('Master switches use separate cache keys and refreeze each native or patched material only after binding its correct effect',()=>{
  const shader=shaderRuntime(),onBindObservable=observable();let dirty=0,effect;
  const material={name:'terrain-alpha-19',checkReadyOnlyOnce:true,onBindObservable,_blockDirtyMechanism:true,
    markAsDirty(){if(!this._blockDirtyMechanism)dirty++;},getEffect:()=>effect};
  const scene={meshes:[],materials:[material],onBeforeRenderObservable:observable()};material._scene=scene;
  const noa={container:{},inputs:{},entities:{},renderer:{scene}};
  const keys=new Set();
  for(const enabled of [true,false,true,false]){
    shader.state.enabled=enabled;shader.syncMasterShaderMaterials(scene);shader.bindWaterMaterials(noa,false);
    const defines={toString:()=> '#define NATIVE_TERRAIN\n'};
    material.customShaderNameResolve('default',[],[],[],defines,[]);
    const key=defines.toString();keys.add(key);
    assert.equal(key.includes('BVFX_MASTER_ACTIVE'),enabled);
    assert.equal(key.includes('BVFX_WATER_GEOMETRY'),enabled);
    assert.equal(material.checkReadyOnlyOnce,false);
    assert.equal(material._blockDirtyMechanism,true,'native dirty guards are restored');
    effect={defines:key,getUniform:()=>enabled?{}:null};onBindObservable.emit({material});
    assert.equal(material.checkReadyOnlyOnce,true,'cached native effects can refreeze without mod uniforms');
  }
  assert.equal(keys.size,2);assert.ok(dirty>=4);
});

test('Master Off restores the original native voxel-lighting flag and stops periodic mod scans',()=>{
  const shader=shaderRuntime(),scene={meshes:[],materials:[],onBeforeRenderObservable:observable()};
  const noa={container:{},inputs:{},entities:{},renderer:{scene,lighting:false}};
  const controller={noa,applyLighting(){const enableLighting=true;this.noa.renderer.lighting=enableLighting;}};
  noa.bloxd={client:{environmentController:controller}};
  shader.runtime.api={singletons:{noa},getBloxd:()=>noa.bloxd};
  shader.maintainVoxelLighting();assert.equal(noa.renderer.lighting,true);
  shader.state.enabled=false;shader.maintainVoxelLighting();assert.equal(noa.renderer.lighting,false);
  let scans=0;scene.materials=new Proxy([],{get:(target,key)=>{if(key===Symbol.iterator)scans++;return Reflect.get(target,key);}});
  for(let i=0;i<100;i++)shader.periodicMaintenance();
  assert.equal(scans,0);assert.equal(noa.renderer.lighting,false);
});

test('Shader frame diagnostics remain bounded, exclude long pauses and contain no account state',()=>{
  const shader=shaderRuntime();shader.recordShaderFrame(0);
  for(let i=1;i<=400;i++)shader.recordShaderFrame(i*20);
  shader.recordShaderFrame(14000);
  const report=shader.root.__BVFX_INSTANCE__.diagnostics();
  assert.equal(report.frames,120);assert.equal(report.fps,50);assert.equal(report.worstFrameMs,20);
  assert.equal(report.renderer,null);assert.equal(report.version,null);
  assert.equal(Object.hasOwn(report,'account'),false);
});

test('Smoothing toggles select distinct terrain effects, retain maps and wait for the matching variant before refreezing',()=>{
  const shader=shaderRuntime({sunSmoothing:false});let effect,dirty=0,skyDirty=0;
  const onBindObservable=observable(),material={name:'terrain-textured-19',checkReadyOnlyOnce:false,onBindObservable,
    markAsDirty(){dirty++;},getEffect:()=>effect};
  const sky={name:'sky',onBindObservable:observable(),markAsDirty(){skyDirty++;}};
  const scene={meshes:[],materials:[material,sky],onBeforeRenderObservable:observable()};material._scene=scene;
  const noa={container:{},inputs:{},entities:{},renderer:{scene}};shader.runtime.api={singletons:{noa}};
  shader.syncMasterShaderMaterials(scene);shader.bindWaterMaterials(noa,false);
  material.checkReadyOnlyOnce=true; // Native materials may freeze after the initial integration scan.
  shader.sun.refresh=()=>assert.fail('a filter toggle must retain the depth maps');
  const initialSkyDirty=skyDirty,keys=new Set();
  const defines={toString:()=> '#define NATIVE_TERRAIN\n'};
  material.customShaderNameResolve('default',[],[],[],defines,[]);
  for(const smoothing of [true,false,true,false]){
    shader.changeShaderSetting('sunSmoothing',smoothing);
    const key=defines.toString();keys.add(key);
    assert.equal(key.includes('#define BVFX_SUN_SMOOTHING'),smoothing);
    assert.equal(material.checkReadyOnlyOnce,false);
    effect={defines:key.replace(smoothing?'#define BVFX_SUN_SMOOTHING':'#define NATIVE_TERRAIN',
      smoothing?'':'#define BVFX_SUN_SMOOTHING'),getUniform:()=>({})};
    onBindObservable.emit({material});assert.equal(material.checkReadyOnlyOnce,false,'old filter variants cannot refreeze');
    effect={defines:key,getUniform:()=>({})};onBindObservable.emit({material});
    assert.equal(material.checkReadyOnlyOnce,true);
    assert.equal(shader.root.__BVFX_INSTANCE__.diagnostics().authoredShadows.smoothing,smoothing);
  }
  assert.equal(keys.size,2);assert.ok(dirty>=4);assert.equal(skyDirty,initialSkyDirty);
});

test('Original native SkyMaterial readiness selects separate native and shader cache entries',()=>{
  const {method}=require('./fixtures/sky-readiness-2026-10-29.json');
  class Defines {
    constructor(){this.isDirty=true;this._renderId=-1;}
    toString(){return '#define NATIVE_SKY\n';}
    markAsProcessed(){this.isDirty=false;}markAsUnprocessed(){this.isDirty=true;}
    markAsMiscDirty(){this.isDirty=true;}
  }
  const methods=vm.runInNewContext('({'+method+'})',{Vv:Defines,bv:{cb(){},U(){}},ev:{c(){}},zv:{d:class{addFallback(){}}},Xv:{f:{PositionKind:'position'}},vv:{_ShaderLoader:{getLoadCallback(){}}}});
  const programs=new Map(),scene={meshes:[],materials:[],imageProcessingConfiguration:{applyByPostProcess:false},getRenderId:()=>1,resetCachedMaterial(){},XW:()=>({createEffect:(_name,options)=>{
    if(!programs.has(options.defines))programs.set(options.defines,{defines:options.defines,isReady:()=>true,getUniform:()=>({})});return programs.get(options.defines);
  }})};
  const sub={_drawWrapper:{},setEffect(effect){this.effect=effect;this._drawWrapper.effect=effect;}};
  const material={...methods,onBindObservable:observable(),getClassName:()=> 'SkyMaterial',ac:()=>scene,_scene:scene,
    checkReadyOnlyOnce:false,_isReadyForSubMesh:s=>s.materialDefines._renderId===1};
  scene.materials.push(material);const shader=shaderRuntime();
  for(const enabled of [true,false,true,false]){
    shader.state.enabled=enabled;shader.syncMasterShaderMaterials(scene);
    assert.equal(material.isReadyForSubMesh({},sub),true);
    assert.equal(sub.effect.defines.includes('BVFX_MASTER_ACTIVE'),enabled);
  }
  assert.equal(programs.size,2,'sky cache cannot retain an untagged patched program');
});
