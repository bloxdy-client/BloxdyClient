'use strict';
// Source/CPU/DOM regressions for the user's 1.7.7 screenshot and reports.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {managedSource}=require('../adapters.cjs'),{shaderRuntime,liquidPrograms}=require('./shader-runtime-fixture.cjs');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/bloxd-visual-shader-5.6.14.2.bnmod')));
function sunFixture(){
 const file=pack.files.find(f=>f.path==='sun-shadows.js'),clock={now:0},root={};
 let code=managedSource(pack.manifest.id,file.path,Buffer.from(file.data,'base64').toString());
 code=code.replace("} catch { result.reason='model transition'; }", "} catch(error) { result.reason='model transition: '+error.stack; }");
 code=code.replace('return { invalidateTerrain, qualities, attach, patch, locations, bind, render, refresh,','return { localBodyParts,animatedBodyNodes, invalidateTerrain, qualities, attach, patch, locations, bind, render, refresh,');
 vm.runInNewContext(code,{window:root,performance:{now:()=>clock.now}});
 const sun=root.__BVFX_CREATE_SUN__({enabled:true,sunShadowEnabled:true,entityShadows:true,sunResolutionExponent:8,sunRange:48,sunFrameRate:20},()=>{});
 const unit=()=>({x:1,y:1,z:1}),zero=()=>({x:0,y:0,z:0}),quat=()=>({x:0,y:0,z:0,w:1});
 const nodes=[{position:zero(),rotationQuat:quat(),scale:unit(),thinInstanceId:101},{position:{x:0,y:-.6,z:0},rotationQuat:quat(),scale:unit(),thinInstanceId:102}];
 const object={type:'Player',nodes,visible:true},groups=nodes.map((n,i)=>{const mesh={name:i?'LegLeftMesh':'BodyMesh'};const variation={getMesh:()=>mesh,idToIndex:{[n.thinInstanceId]:0}};return {getEnabled:()=>object.visible,getMesh:()=>mesh,idToMetadata:{[n.thinInstanceId]:{objectId:1,meshVariation:variation}}};});
 const manager={objectData:{1:object},thinMeshes:groups,namedNodes:{Player:{BodyMesh:0,LegLeftMesh:1}},types:{Player:{typeNodes:[{thinMeshIndex:0,parent:null},{thinMeshIndex:1,parent:0}]}},getActuallyVisible:()=>object.visible};
 const states={humanoidMesh:{objectId:1},position:{xQi:new Float64Array([0,0,0])},moveState:{speed:5,crouching:false,pose:'standing'},updateWalkingState:{walkingLegSwingDuration:250,drawnSpeed:5,_walkingSwingCoefficient:0,_walkingSwingDirection:1}};
 const scene={meshes:[],materials:[],activeCamera:{position:{x:100,y:40,z:0}},onBeforeDrawPhaseObservable:{add:fn=>fn,remove(){}}};
 const game={hf:1,camera:{KV:100,heading:0,pitch:0},entities:{names:{moveState:'moveState'},getState:(_id,name)=>states[name]},renderer:{scene,manager}};
 sun.attach(scene,game);return {sun,clock,object,nodes,states,game};
}
test('A distant third-person camera retains the exact animated player nodes and excludes their native duplicate',()=>{
 const {sun,nodes,object}=sunFixture();let result=sun.localBodyParts();assert.equal(result.parts.length,2,result.reason);assert.equal(result.excluded.size,2);assert.equal(result.reason,'generated');
 const before=Array.from(result.parts[1].transform);nodes[1].rotationQuat={x:Math.sin(.4),y:0,z:0,w:Math.cos(.4)};
 result=sun.localBodyParts();assert.notDeepEqual(Array.from(result.parts[1].transform),before);assert.equal(object.nodes,nodes,'native player nodes were never replaced');
});
test('Hidden first-person body reads moveState speed and animates without writing native animation state',()=>{
 const {sun,clock,object,states,nodes}=sunFixture();object.visible=false;
 const snapshot=JSON.stringify({nodes,walk:states.updateWalkingState});let body=sun.localBodyParts();assert.equal(body.parts.length,2,body.reason);
 const first=Array.from(body.parts[1].transform);clock.now=100;body=sun.localBodyParts();assert.notDeepEqual(Array.from(body.parts[1].transform),first);
 assert.equal(JSON.stringify({nodes,walk:states.updateWalkingState}),snapshot);
});

test('First-person shadows retain additional model parts and their native per-part skin selectors',()=>{
 const {sun,object,game}=sunFixture(),manager=game.renderer.manager;
 const index=object.nodes.length,node={position:{x:.1,y:1,z:.2},rotationQuat:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1},thinInstanceId:103};
 const mesh={name:'CrownMesh'},values=[new Float32Array([1,2,3,4]),new Float32Array([5,6,7,8])];
 const variation={mesh,idToIndex:{103:0},strides:{aAtlasIdx1:4,aAtlasIdx2:4},get:(_id,name)=>values[name==='aAtlasIdx1'?0:1]};
 object.nodes.push(node);manager.types.Player.typeNodes.push({thinMeshIndex:index,parent:0});manager.namedNodes.Player.CrownMesh=index;
 manager.thinMeshes.push({getEnabled:()=>false,idToMetadata:{103:{objectId:1,meshVariation:variation}}});
 object.visible=false;const before=JSON.stringify(object),body=sun.localBodyParts();
 const crown=body.parts.find(p=>p.mesh===mesh);assert(crown,'a cosmetic is not excluded by a body-name whitelist');
 assert.deepEqual(Array.from(crown.atlasIndices),[1,2,3,4,5,6,7,8]);assert.equal(JSON.stringify(object),before);
});

test('The visible local player casts its native animated batch once; only its hidden body needs a clone',()=>{
 const {nativeVariation}=require('./shader-instance-fixture.cjs'),f=sunFixture(),manager=f.game.renderer.manager;
 for(const [index,group]of manager.thinMeshes.entries()){
  const id=f.nodes[index].thinInstanceId,mesh=group.getMesh(),matrix=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,index*2,0,0,1]);
  const {variation}=nativeVariation(mesh,matrix,1);variation.idToIndex={[id]:0};
  group.meshVariations={__DEFAULT__:variation};group.idToMetadata={[id]:{objectId:1,meshVariation:variation}};
 }
 let body=f.sun.localBodyParts();assert.equal(body.reason,'native visible');assert.equal(body.parts.length,0);assert.equal(body.excluded.size,0);
 f.object.visible=false;body=f.sun.localBodyParts();assert.equal(body.reason,'generated');assert.equal(body.parts.length,2);assert.equal(body.excluded.size,2);
});
test('Planar surfaces cannot self-shadow differently at near and far cascade resolutions',()=>{
 const r=shaderRuntime(),fragment=liquidPrograms(r,'water').fragment;
 assert.match(fragment,/reference=p\.z\+dot\(gradient,uv-p\.xy\)-bias/);assert.match(fragment,/floor\(\(p\.xy\+offset\)\/texel\)/);
 let legacyFalseShadows=0;
 for(const size of [256,512,1024,2048,4096])for(const slope of [.12,.35,.7])for(let x=1;x<80;x++){
  const texel=1/size,p=[x/83,.413],gradient=[slope,-slope*.3],depthAt=uv=>.4+gradient[0]*uv[0]+gradient[1]*uv[1];
  const uv=p.map(v=>(Math.floor(v/texel)+.5)*texel),reference=depthAt(p)+gradient[0]*(uv[0]-p[0])+gradient[1]*(uv[1]-p[1])-.000002;
  assert(reference<depthAt(uv),'same plane is lit at every cascade resolution');if(depthAt(p)-.000002>depthAt(uv))legacyFalseShadows++;
 }
 assert(legacyFalseShadows>100,'the old pixel/texel mismatch reproduces false shadows');
});
test('Native SkyMaterial cameraPosition source receives sun/cloud/star code',()=>{
 const r=shaderRuntime(),fixture=require('./fixtures/shader-sky-2026-11-08.json'),native=fixture.shaders.find(s=>s.name==='skyPixelShader').code;
 const patched=r.atmosphere.patchSky(native);assert.notEqual(patched,native);assert.match(patched,/normalize\(vPositionW-cameraPosition\)/);assert.match(patched,/bvfxSkyColour/);
 assert.equal(r.atmosphere.patchSky('uniform vec3 cameraPosition;void main(){}'),'uniform vec3 cameraPosition;void main(){}','ordinary world materials cannot turn into sky');
});

test('Custom sky colour preserves native clipping and depth writes and cannot create a second patch',()=>{
 const r=shaderRuntime(),fixture=require('./fixtures/shader-sky-2026-11-08.json');
 const native=fixture.shaders.find(s=>s.name==='skyPixelShader').code,patched=r.atmosphere.patchSky(native);
 const main=patched.slice(patched.indexOf('void main(void)'));
 assert(main.indexOf('#include<clipPlaneFragment>')<main.indexOf('if(uBvfxAtmoActive'));
 assert(main.indexOf('#include<logDepthFragment>')>main.indexOf('if(uBvfxAtmoActive'));
 assert.match(main,/vec3 retColor;\s*if\(uBvfxAtmoActive>\.5 && uBvfxAtmoStyle<2.5 && uBvfxAtmoNativeReady>\.5\)/,'cached physical daylight avoids full-screen scattering');
 assert.match(main,/else\{\s*float sunfade=/,'the native Off/failure computation remains in the alternative branch');
 assert(main.indexOf('if(uBvfxAtmoActive')<main.indexOf('#include<imageProcessingCompatibility>'));
 assert.doesNotMatch(main,/\breturn\b/,'native main reaches its own complete output/depth path');
 assert.equal(r.atmosphere.patchSky(patched),patched);
});

test('Solar flare uses filled ghosts and rejects offscreen, invalid and behind-camera sources',()=>{
 const r=shaderRuntime(),{fakeGl}=require('./shader-gl-fixture.cjs'),gl=fakeGl(),p=gl.createProgram();gl.useProgram(p);
 const loc=r.atmosphere.locations(gl,p);
 for(const [x,y,z,active]of [[.4,.6,true,1],[-.1,.5,true,0],[.5,1.1,true,0],[.5,.5,false,0],[NaN,.5,true,0],[Infinity,.5,true,0]]){
  r.atmosphere.setSunScreen(x,y,z);r.atmosphere.bind(gl,loc,gl);assert.equal(gl.uniformValues.get('uBvfxAtmoSunScreen')[2],active);
 }
 assert.match(r.atmosphere.common,/bvfxSolarDisc\(distance,radius,uBvfxAtmoSunShape.y\)/);assert.match(r.atmosphere.common,/float ghost0=bvfxFlareGhost/);
 assert.doesNotMatch(r.atmosphere.common.slice(r.atmosphere.common.indexOf('vec3 bvfxSkyColour')),/float ring=/,'solar flare has no detached outline ring');
 assert.doesNotMatch(r.atmosphere.common,/fwidth\(|dFdx\(/);
});
test('Hundreds of protection, menu, hit and particle materials leave native effect keys untouched',()=>{
 const r=shaderRuntime();let dirties=0;
 const names=['protectedOverlay','InventoryGUI','hitFlash','damageOverlay','particle-22','selectionBox','MenuBackground'];
 const native=function(){return 'native';};const materials=Array.from({length:800},(_,i)=>({name:names[i%names.length],onBindObservable:{add(){}},customShaderNameResolve:native,markAsDirty(){dirties++;}}));
 const world={meshes:[],materials,onBeforeRenderObservable:{add(){}}};for(let i=0;i<5;i++)r.syncMasterShaderMaterials(world);
 assert.equal(dirties,0);for(const material of materials)assert.equal(material.customShaderNameResolve,native);
 const terrain={name:'terrain-textured-1',onBindObservable:{add(){}},markAsDirty(){dirties++;}};world.materials.push(terrain);r.syncMasterShaderMaterials(world);assert.equal(dirties,1);
 const clone={name:'hitFlash',customShaderNameResolve:terrain.customShaderNameResolve};const defines={toString:()=>''};clone.customShaderNameResolve('native',[],[],[],defines);assert.equal(defines.toString(),'');
});
test('F9 timing retains one-FPS event drops while still excluding hidden/long pause samples',()=>{
 const r=shaderRuntime();r.recordShaderFrame(10);r.recordShaderFrame(1010);r.recordShaderFrame(1030);
 const diagnostic=r.root.__BVFX_INSTANCE__.diagnostics();assert.equal(diagnostic.worstFrameMs,1000);assert(diagnostic.fps<3);
});
test('Bloxd Lighting defaults On and migrates the previous inverted checkbox exactly once',()=>{
 assert.equal(shaderRuntime().state.bloxdLighting,true);
 const old=shaderRuntime({disableBloxdLighting:true});assert.equal(old.state.bloxdLighting,false);assert.equal('disableBloxdLighting' in old.state,false);
 assert.equal(shaderRuntime({bloxdLighting:true,disableBloxdLighting:true}).state.bloxdLighting,true);
 const off=liquidPrograms(old,'water').fragment;assert.match(off,/if\(uBvfxDisableNative>\.5\)\{\s*skyLightContrib=vec3\(1\.0\)/);
});
