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
const {fakeGl}=require('./shader-gl-fixture.cjs');
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

test('Native player/mob variations cast from batch.matrices and interleaved skin attributes without disabled slots',()=>{
  const {nativeVariation}=require('./shader-instance-fixture.cjs'),actor=mesh({terrain:false});
  actor.name='BodyMesh';actor.noa_in_dynamic_list=false;
  const terrain=mesh(),f=sunSetup([terrain,actor]),texture=f.gl.createTexture(),arrayTexture=f.gl.createTexture();f.gl.bindTexture(f.gl.TEXTURE_2D,texture);
  f.gl.isTexture=value=>value===texture||value===arrayTexture;
  f.gl.texImage2D(f.gl.TEXTURE_2D,0,f.gl.RGBA8,1,1,0,f.gl.RGBA,f.gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  f.gl.bindTexture(f.gl.TEXTURE_2D_ARRAY,arrayTexture);f.gl.texImage3D(f.gl.TEXTURE_2D_ARRAY,0,f.gl.RGBA8,1,1,2,0,f.gl.RGBA,f.gl.UNSIGNED_BYTE,null);
  terrain.material={needAlphaTesting:()=>true,pluginManager:{_plugins:[{useWebGL2:true,textureAtlases:[{_texture:{_webGLTexture:arrayTexture}}],imagesPerAtlas:[2]}]}};
  terrain.getVerticesData=kind=>kind==='position'?new Float32Array([0,0,0,1,0,0,0,1,0]):kind==='uv'?new Float32Array([0,0,1,0,0,1]):kind==='texAtlasIndices'?new Float32Array([1,1,1]):null;
  const surfaces=shaderRuntime({wavyLeaves:true}).surfaces;surfaces.updateMetadata({1:{id:1,name:'Oak Leaves',atlasIndex:1}},new Map());f.root.__BVFX_SURFACES__=surfaces;
  let leafAttribute=false,actorsDrawn=0;const enable=f.gl.enableVertexAttribArray,disable=f.gl.disableVertexAttribArray,validate=f.gl.validateDraw;
  f.gl.enableVertexAttribArray=index=>{if(index===6)leafAttribute=true;enable(index);};f.gl.disableVertexAttribArray=index=>{if(index===6)leafAttribute=false;disable(index);};
  f.gl.validateDraw=()=>{
    validate();const p=f.gl.getParameter(f.gl.CURRENT_PROGRAM);
    if(p.uniforms?.some(u=>u.name==='maskTexture')&&p.uniforms.some(u=>u.name==='uBvfxSurfaceAtlas'))assert.notEqual(p.values.get('maskTexture'),p.values.get('uBvfxSurfaceAtlas'),'skin/cutout and leaf samplers must occupy distinct units');
    if(p.uniforms?.some(u=>u.name==='lifeformAtlasSize')){actorsDrawn++;assert.equal(leafAttribute,false,'actors cannot inherit the terrain leaf attribute');}
  };
  actor.material={needAlphaTesting:()=>true,diffuseTexture:{_texture:{_webGLTexture:texture}},pluginManager:{_plugins:[{atlasWidth:64,atlasHeight:64,numLayers:2}]}};
  const positionBuffer={isUpdatable:()=>false};actor.getVertexBuffer=()=>positionBuffer;
  actor.getVerticesData=kind=>kind==='position'?new Float32Array([0,0,0,1,0,0,0,1,0]):kind==='uv'?new Float32Array([0,0,1,0,0,1]):null;
  const matrices=new Float32Array(3*16);for(let slot=0;slot<3;slot++){matrices.set(identity(),slot*16);matrices[slot*16+12]=slot*2;}
  const {variation,group}=nativeVariation(actor,matrices,2),manager={thinMeshes:[group],objectData:{}};
  assert.equal(variation.getMesh,undefined,'the native variation exposes .mesh, not a getMesh method');
  assert.deepEqual(Array.from(variation.get(100,'aAtlasIdx1')),[11,12,13,14]);
  f.gl.activeTexture(f.gl.TEXTURE0+15);f.api.attach(f.scene,{renderer:{scene:f.scene,manager}});f.api.render();
  assert.equal(f.api.shadowDiagnostics.moving?.count,2,f.api.diagnostic+' '+JSON.stringify(f.api.shadowDiagnostics.moving));
  assert(actorsDrawn>0);
  assert(f.api.shadowDiagnostics.moving.drawCalls>0,f.api.diagnostic);
  const atlas=f.gl.calls.filter(c=>c[0]==='bufferData'&&c[2]?.length===16).at(-1)?.[2];
  assert.deepEqual(Array.from(atlas||[]),[11,12,13,14,21,22,23,24,31,32,33,34,41,42,43,44]);
  variation.batch.matrices[12]=5;f.clock.now=60;f.api.render();
  const uploaded=f.gl.calls.filter(c=>c[0]==='bufferData'&&c[2]?.length===32).at(-1)?.[2];assert.equal(uploaded?.[12],5,'moving poses are read live');
});

test('Full repairs in retained projections cannot reset the approach distance and strand the sharp cascade',()=>{
  const terrain=mesh(),object=mesh({terrain:false});object.name='objectRock';object.noa_in_dynamic_list=false;object.metadata={noa_object_base_mesh:true};
  const f=sunSetup([terrain,object]);Object.assign(f.settings,{sunRange:80,entityShadows:false});f.api.render();
  const p=f.gl.sunProgram(),loc=f.api.locations(f.gl,p),read=()=>{f.gl.useProgram(p);f.api.bind(f.gl,loc,f.clock.now);return f.gl.uniformValues.get('uBvfxSunDetailMatrix').slice();};
  const initial=read();
  for(let step=1;step<=18;step++){f.scene.activeCamera.position.x=step;f.clock.now=step*60;f.api.invalidateTerrain([terrain]);f.api.render();}
  assert.notDeepEqual(read(),initial,'small walking steps must accumulate until the high-resolution projection follows');
});

test('Orbit view keeps close terrain on the live player and moving shadows use the requested close density',()=>{
  const f=sunSetup([mesh()]),position={xQi:new Float64Array([0,0,0])};
  Object.assign(f.settings,{sunRange:80,sunResolutionExponent:11,entityShadows:true});
  f.scene.activeCamera.position={x:100,y:50,z:100};
  f.api.attach(f.scene,{hf:1,entities:{getState:(_id,name)=>name==='position'?position:null},renderer:{scene:f.scene}});f.api.render();
  const p=f.gl.sunProgram(),loc=f.api.locations(f.gl,p),read=()=>{f.gl.useProgram(p);f.api.bind(f.gl,loc,f.clock.now);return f.gl.uniformValues.get('uBvfxSunDetailMatrix').slice();};
  const before=read();assert.equal(Math.abs(before[12])+Math.abs(before[13]),0);
  assert.equal(f.api.resolutionInfo.detail,2048);assert.equal(f.api.resolutionInfo.moving,4096);
  position.xQi[0]=10;f.clock.now=100;f.api.render();assert.notDeepEqual(read(),before);
  assert.equal([...f.gl.allocations.values()].filter(a=>a[2]===f.gl.DEPTH_COMPONENT24&&a[3]>1).length,4,'reuse four maps, without another entity pass');
});

test('Static object batches no longer force full terrain-map redraws, including in-place instance edits',()=>{
 const {nativeVariation}=require('./shader-instance-fixture.cjs'),terrain=mesh(),tree=mesh({terrain:false});
 tree.name='objectOak';tree.metadata={noa_object_base_mesh:true};tree.noa_in_dynamic_list=false;tree.getVertexBuffer=()=>({isUpdatable:()=>false});
 const matrices=identity(),{variation,group}=nativeVariation(tree,matrices,1),manager={thinMeshes:[group],objectData:{}};
 // Keep a stable native vertex-buffer identity, as the real immutable batch does.
 const buffer=tree.getVertexBuffer();tree.getVertexBuffer=()=>buffer;
 const f=sunSetup([terrain,tree]);f.settings.sunRange=16;f.settings.entityShadows=false;
 f.api.attach(f.scene,{renderer:{scene:f.scene,manager}});f.api.render();
 const full=f.api.chunkCacheDiagnostics.fullPasses;
 f.clock.now=60;f.api.invalidateTerrain([terrain]);f.api.render();
 assert.equal(f.api.chunkCacheDiagnostics.fullPasses,full,'a static tree batch must not poison the cache');
 assert(f.api.chunkCacheDiagnostics.partialPasses>0);
 const partial=f.api.chunkCacheDiagnostics.partialPasses;
 variation.batch.matrices[12]=2;f.clock.now=120;f.api.invalidateTerrain([terrain]);f.api.render();
 assert(f.api.chunkCacheDiagnostics.partialPasses>partial,'an in-place native transform is included in the repair');
});

test('An explicitly selected 8K detail map allocates on capable hardware without adding maps or enlarging the others',()=>{
 const f=sunSetup([mesh()]);f.settings.sunResolutionExponent=13;f.settings.sunRange=80;
 const get=f.gl.getParameter;f.gl.getParameter=key=>key===f.gl.MAX_TEXTURE_SIZE?8192:key===f.gl.MAX_VIEWPORT_DIMS?[8192,8192]:get(key);
 f.api.render();assert.equal(f.api.resolutionInfo.detail,8192);assert.equal(f.api.resolutionInfo.moving,4096);
 const maps=[...f.gl.allocations.values()].filter(a=>a[2]===f.gl.DEPTH_COMPONENT24&&a[3]>1);
 assert.equal(maps.length,4);assert.equal(maps.filter(a=>a[3]===8192).length,1);
 assert(maps.reduce((n,a)=>n+a[3]*a[4]*4,0)<=352*1024*1024);
});

test('Every rendered cascade remains sample-complete as raw depth, including the primary map and Off fallback',()=>{
  for(const sunRange of [16,48,100]){
    const f=sunSetup([mesh(),mesh({terrain:false})]);f.settings.sunRange=sunRange;
    const p=f.gl.sunProgram();f.gl.useProgram(p);const loc=f.api.locations(f.gl,p);
    for(const enabled of [true,false,true]){
      f.settings.enabled=enabled;f.clock.now+=60;f.api.render();f.gl.useProgram(p);
      f.api.bind(f.gl,loc,f.clock.now);f.gl.validateDraw();
    }
  }
});

test('Production cascade projections light an unobstructed plane and retain a one-block caster in a CPU ray reference',()=>{
  const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),project=(m,p)=>[0,1,2].map(i=>(m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12])*.5+.5);
  const read=(m,uv,box)=>{
    const rows=[0,1,2].map(i=>[m[i],m[i+4],m[i+8]]),clip=[uv[0]*2-1,uv[1]*2-1,0];
    const origin=[0,1,2].map(i=>rows.reduce((n,row,j)=>n+row[i]*(clip[j]-m[j+12])/dot(row,row),0));
    const direction=rows[2].map(v=>-v/Math.hypot(...rows[2]));
    let hit=-origin[1]/direction[1];
    if(box){let enter=-Infinity,exit=Infinity;
      for(let i=0;i<3;i++){const lo=i===1?0:-.5,hi=i===1?2:.5;
        if(Math.abs(direction[i])<1e-9){if(origin[i]<lo||origin[i]>hi){enter=Infinity;exit=-Infinity;break;}continue;}
        const a=(lo-origin[i])/direction[i],b=(hi-origin[i])/direction[i];enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
      if(enter<=exit)hit=Math.max(hit,exit);
    }
    const p=origin.map((v,i)=>v+direction[i]*hit),z=project(m,p)[2];
    return Math.round(z*0xffffff)/0xffffff;
  };
  const sample=(m,texel,bias,position,box,smooth)=>{
    const p=project(m,position),rows=[0,1,2].map(i=>[m[i],m[i+4],m[i+8]]),normal=[0,1,0];
    const transformed=rows.map(row=>dot(normal,row)/dot(row,row)),gradient=transformed.slice(0,2).map(v=>Math.max(-4,Math.min(4,-v/transformed[2])));
    const compare=uv=>{const reference=p[2]+dot(gradient,uv.map((v,i)=>v-p[i]))-bias;
      return reference<=read(m,uv,box)?1:0;};
    if(!smooth)return compare(p.slice(0,2).map(v=>(Math.floor(v/texel)+.5)*texel));
    const base=p.slice(0,2).map(v=>Math.floor(v/texel-.5)),weight=p.slice(0,2).map((v,i)=>v/texel-.5-base[i]);
    let visibility=0;for(let x=0;x<2;x++)for(let y=0;y<2;y++)visibility+=compare([(base[0]+x+.5)*texel,(base[1]+y+.5)*texel])*(x?weight[0]:1-weight[0])*(y?weight[1]:1-weight[1]);
    return visibility;
  };
  for(const exponent of [8,10,12])for(const azimuth of [0,45,135,270])for(const elevation of [8,35,80]){
    const f=sunSetup([mesh()]);Object.assign(f.settings,{sunRange:100,sunResolutionExponent:exponent,entityShadows:false,sunAzimuth:azimuth,sunElevation:elevation});
    f.api.render();const p=f.gl.sunProgram();f.gl.useProgram(p);f.api.bind(f.gl,f.api.locations(f.gl,p),1);f.gl.validateDraw();
    const direction=f.gl.uniformValues.get('uBvfxSunDirection'),shadow=[-direction[0]/direction[1],0,-direction[2]/direction[1]];
    for(const kind of ['','Local','Detail']){
      const m=f.gl.uniformValues.get('uBvfxSun'+kind+'Matrix'),texel=f.gl.uniformValues.get('uBvfxSun'+kind+'Texel');assert(m);
      const bias=f.gl.uniformValues.get('uBvfxSun'+kind+'Bias')*(1+2*(1-direction[1]))+.000002;
      for(const smooth of [false,true]){
        for(let x=-8;x<=8;x+=2)for(let z=-8;z<=8;z+=2)assert(Math.abs(sample(m,texel,bias,[x,0,z],false,smooth)-1)<1e-7,'empty floor stays lit across every cascade');
        assert.equal(sample(m,texel,bias,[8,0,8],true,smooth),1,'the caster does not darken unrelated ground');
        if(kind==='Detail')assert(sample(m,texel,bias,shadow,true,smooth)<.01,'one-block-wide occluder retains its cast shadow');
      }
    }
  }
});
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
  vm.runInContext("const STORAGE_KEY='synthetic',PAGE=globalThis;\n"+code.slice(start,end)+'\nglobalThis.result={DEFAULTS,SKY_STYLES,loaded:loadSettings()};',context);
  assert.equal(context.result.SKY_STYLES.golden.cloudType,'current');assert.equal(context.result.DEFAULTS.atmosphereEnabled,true);
  assert.equal(context.result.loaded.atmosphereEnabled,false);
});

test('Retained reference maps keep bounded close detail; the current UI omits map resolution',()=>{
  const settings={enabled:true,sunShadowEnabled:true,entityShadows:true,sunResolutionExponent:14,sunRange:160,sunQuality:100};
  const f=factory('sun-shadows.js',settings,'quality'),q=f.api.quality();
  assert.equal(q.detailSize,8192);assert.ok(q.size<=2048);assert.ok(q.localSize<=2048);
  const {gl}=sunSetup([mesh()]);const scene=sceneFor(gl,[mesh()]);
  f.api.attach(scene,{});gl.useProgram(gl.sunProgram());f.api.bind(gl,f.api.locations(gl,gl.getParameter(gl.CURRENT_PROGRAM)),0);
  f.api.render();
  const maps=[...gl.allocations.values()].filter(args=>args[2]===gl.DEPTH_COMPONENT24 && args[3]>1);
  assert.equal(maps.length,4);assert.ok(maps.reduce((bytes,args)=>bytes+args[3]*args[4]*4,0)<=160*1024*1024);
  assert.doesNotMatch(source('shader.js'),/\['sunResolutionExponent', 'Shadow resolution', 5, 13,/);
  const runtime=shaderRuntime({sunResolutionExponent:14});assert.equal(runtime.state.sunResolutionExponent,13);
  assert.equal(shaderRuntime({sunQuality:100}).state.sunResolutionExponent,12,'legacy quality-only settings use the same bound');
});
test('Analytic sky toggles return to native without allocating textures or offscreen passes',()=>{
  const settings={enabled:true,atmosphereEnabled:false,cloudCover:0,cloudType:'current',skyStyle:'clear'};
  const {api}=factory('atmosphere.js',settings),gl=fakeGl(),program=gl.createProgram();gl.useProgram(program);
  const loc=api.locations(gl,program,gl.getUniformLocation);
  for(const style of ['clear','golden','moonlit','milkyway','blackhole','andromeda'])for(const on of [true,false,true]){
    settings.skyStyle=style;settings.atmosphereEnabled=on;api.bind(gl,loc,gl);
    assert.equal(gl.uniformValues.get('uBvfxAtmoActive'),on?1:0);
    api.drawSky(gl,loc,gl.drawArrays,[]);assert.equal(gl.getParameter(gl.CURRENT_PROGRAM),program);
  }
  assert.equal(gl.allocations.size,0);assert.equal(api.skyDiagnostics().offscreenPasses,0);
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

test('Analytic sky uniform uploads never read native uniforms or the viewport',()=>{
  const {api}=factory('atmosphere.js',{enabled:true,atmosphereEnabled:true,skyStyle:'clear'}),gl=fakeGl(),p=gl.createProgram();gl.useProgram(p);
  gl.getUniform=()=>{throw Error('Unexpected readback');};gl.getParameter=()=>{throw Error('Unexpected driver query');};
  api.bind(gl,api.locations(gl,p,gl.getUniformLocation),gl);
  assert.equal(gl.uniformValues.get('uBvfxAtmoActive'),1);
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
    assert.match(program.fragment,/uBvfxOreAtlasLookup/);assert.match(program.fragment,/bvfxCloudGroundShadow/);assert.doesNotMatch(program.fragment,/bvfxLavaNoise3|sampler2DShadow|bvfxSkyColour|bvfxSpaceHole/);
    assert.match(program.fragment,/sampler2D uBvfxAtmoGroundImage/,'cloud shadows sample the retained world-space tile');
    assert.doesNotMatch(program.fragment,/sampler3D uBvfxAtmoVolume|bvfxVolumeDensity/,'liquid fragments never integrate cloud density');
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
      runtime.root.__BVFX_SURFACES__.bind(gl,runtime.root.__BVFX_SURFACES__.locations(gl,p),gl,undefined,on?1:0);
      const restoreOre=runtime.bindOreLookup(gl,ore,p),restoreAtmosphere=runtime.atmosphere.bindVolume(gl,atmosphere,p),restoreShadow=runtime.sun.bind(gl,shadow,2);
      gl.validateDraw();assert.equal(gl.uniformValues.get('uBvfxSunActive'),on?1:0,runtime.sun.diagnostic);
      restoreShadow?.();restoreAtmosphere?.();restoreOre?.();
    }
  }
});
