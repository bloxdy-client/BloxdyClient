'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const contracts=require('./fixtures/particle-contracts-2026-10-15.json').contracts;
function source(kind){const item=contracts.find(item=>item.kind===kind);assert.equal(crypto.createHash('sha256').update(item.code).digest('hex'),item.sha256);return item.code;}
function vector(x=0,y=0,z=0){return {x,y,z};}
function appendFixture(options={}){
  const scratch={...vector(),Rs(value){Object.assign(this,value);return this;}},math={ZeroReadOnly:vector(),TransformNormalToRef(value,matrix,out){const values=[value.x,value.y,value.z];for(let c=0;c<3;++c)out[['x','y','z'][c]]=values.reduce((sum,v,i)=>sum+v*matrix[i*4+c],0);}};
  const append=vm.runInNewContext('({'+source('append')+'})._appendParticleVertex',{es:{i:{by:[scratch]},k:math}},{timeout:1000});
  const system={_vertexBufferSize:20,_vertexData:new Float32Array(80),_scene:{floatingOriginOffset:vector(100,200,300)},iD:vector(1,2,3),_isBillboardBased:true,billboardMode:7,_useInstancing:true,...options};
  const particle={position:vector(104,205,306),color:{r:3,g:.5,b:.25,a:.75},angle:.2,scale:{x:2,y:3},size:4,cellIndex:2,direction:vector(1,2,3),_properties:{}};
  return {system,particle,append:(u=0,v=0,index=0)=>{append.call(system,index,particle,u,v);return Array.from(system._vertexData.slice(index*20,(index+1)*20));}};
}
function close(actual,expected){assert.equal(actual.length,expected.length);actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-6,`${i}: ${value} != ${expected[i]}`));}

test('isolated actual particle upload retains world positions, source offsets, scale and HDR colors',()=>{
  const h=appendFixture({isLocal:true,_emitterWorldMatrix:new Float32Array(16).fill(8)}),before=JSON.stringify(h.particle);
  close(h.append().slice(0,10),[5,7,9,3,.5,.25,.75,.2,8,12]);assert.equal(JSON.stringify(h.particle),before);
  h.system._scene.floatingOriginOffset=null;close(h.append().slice(0,3),[105,207,309]);
});

test('isolated actual sheet uploads preserve the source cell clock and noninstanced corner inset',()=>{
  const h=appendFixture({_isAnimationSheetEnabled:true,_useInstancing:false,_epsilon:.01});
  const lower=h.append(0,0),upper=h.append(1,1,1);close(lower.slice(10,13),[2,.01,.01]);close(upper.slice(10,13),[2,.99,.99]);
  h.system._useInstancing=true;assert.equal(h.append()[10],2);assert.equal(h.particle.cellIndex,2);
  const shader=source('particlesVertexShader');assert.ok(shader.includes('float rowOffset=floor(cellIndex*particlesInfos.z)'));assert.ok(shader.includes('vec2 uvOffset=vec2(offset.x ,1.0-offset.y)'));assert.ok(shader.includes('vUV=(uvOffset+vec2(columnOffset,rowOffset))*uvScale'));
});

test('isolated actual particle directions distinguish stretched local and fixed local systems',()=>{
  const matrix=[0,0,-1,0,0,1,0,0,1,0,0,0,50,60,70,1],h=appendFixture({isLocal:true,_emitterWorldMatrix:matrix,billboardMode:8});
  close(h.append().slice(10,13),[1,2,3]);h.system.billboardMode=9;close(h.append().slice(10,13),[1,2,3]);
  h.system._isBillboardBased=false;h.particle._properties.initialDirection=vector(1,0,0);close(h.append().slice(10,13),[0,0,-1]);
  h.particle._properties.initialDirection=vector(0,1,0);close(h.append().slice(10,13),[.001,1,0]);assert.equal(h.particle._properties.initialDirection.x,0);
  delete h.particle._properties.initialDirection;close(h.append().slice(10,13),[3,2,-1]);close(h.append().slice(0,3),[5,7,9]);
});

test('native particle shader preserves the source pivot, orientation axes and texture-mask formulas',()=>{
  const vertex=source('particlesVertexShader'),pixel=source('particlesPixelShader'),native=fs.readFileSync(path.join(__dirname,'../../src/bridge_renderer.hpp'),'utf8');
  for(const snippet of ['cornerPos=(vec2(offset.x-0.5,offset.y -0.5)-translationPivot)*size','rotatedCorner.xy+=translationPivot','rotatedCorner.xz+=translationPivot','vec3 toCamera=position-eyePosition','normalize(cross(normalize(direction),normalizedToCamera))','vec3 row1=normalize(direction);','vec3 yaxis=normalize(direction);'])assert.ok(vertex.includes(snippet),snippet);
  assert.ok(pixel.includes('(textureColor*textureMask+(vec4(1.,1.,1.,1.)-textureMask))*vColor'));
  for(const snippet of ['position.xy*a.enchant.w','local.xy+=sourceSpecial.zw','cross(vec3(0,1,0),axis)','cross(direction,axis)','particleMode==3?direction','vUV=a.hue.xy+uv*a.hue.zw','texel=texel*particleMask+(vec4(1)-particleMask)'])assert.ok(native.includes(snippet),snippet);
});

test('isolated actual engine and particle blend methods preserve subtract/multiply and source alpha accumulation',()=>{
  const modes={BLENDMODE_SUBTRACT:-1,BLENDMODE_ONEONE:0,BLENDMODE_STANDARD:1,BLENDMODE_ADD:2,BLENDMODE_MULTIPLY:3,BLENDMODE_MULTIPLYADD:4};
  const engine=vm.runInNewContext('({'+source('blendFactors')+'})',{}, {timeout:1000}),calls=[],equations=[];
  engine.setAlphaBlendFunctionParameters=(...args)=>calls.push(args);engine.setAlphaEquationParameters=(...args)=>equations.push(args);
  for(const [mode,expected] of [[1,[770,1,0,1]],[2,[770,771,1,1]],[3,[0,769,1,1]],[4,[774,0,1,1]],[6,[1,1,0,1]],[7,[1,771,1,1]],[8,[1,771,1,771]]]){engine.setAlphaMode(mode,0);assert.deepEqual(calls.at(-1),[...expected,0]);assert.deepEqual(equations.at(-1),[32774,32774,0]);}
  const method=vm.runInNewContext('({'+source('particleBlend')+'})._setEngineBasedOnBlendMode',{Ks:modes},{timeout:1000}),selected=[];
  for(const [particle,mode] of [[-1,3],[0,6],[1,2],[2,1],[3,4]]){method.call({_engine:{setAlphaMode:value=>selected.push(value)}},particle);assert.equal(selected.at(-1),mode);}
});

test('isolated actual MultiplyAdd render wrapper draws multiply before additive without simulating particles',()=>{
  const render=vm.runInNewContext('({'+source('particlePasses')+'}).render',{Ks:{BLENDMODE_MULTIPLYADD:4,BLENDMODE_MULTIPLY:3,BLENDMODE_ADD:2}},{timeout:1000}),passes=[],states=[];
  const system={isReady:()=>true,ED:[{}],blendMode:4,_engine:{setState(){},unbindInstanceAttributes(){},setAlphaMode:value=>states.push(value)},_render(mode){passes.push(mode);return 1;}};
  assert.equal(render.call(system),2);assert.deepEqual(passes,[3,2]);assert.deepEqual(states,[0]);assert.equal(system.ED.length,1);
});

test('actual upload and pixel shader retain ramp ranges and raw-alpha multiply before fog',()=>{
  const h=appendFixture({_useRampGradients:true});h.particle.remapData={x:.1,y:.8,z:.2,w:.6};close(h.append().slice(10,14),[.1,.8,.2,.6]);
  const sourcePixel=source('particlesPixelShader'),native=fs.readFileSync(path.join(__dirname,'../../src/bridge_renderer.hpp'),'utf8');
  for(const snippet of ['clamp((alpha-remapRanges.x)/remapRanges.y,0.0,1.0)','vec2(1.0-remappedColorIndex,0.)','clamp((alpha*rampColor.a-remapRanges.z)/remapRanges.w,0.0,1.0)','float sourceAlpha=vColor.a*textureColor.a'])assert.ok(sourcePixel.includes(snippet),snippet);
  assert.ok(sourcePixel.indexOf('baseColor.rgb=baseColor.rgb*sourceAlpha')<sourcePixel.indexOf('#include<fogFragment>(color,baseColor)'));
  for(const snippet of ['particleSourceAlpha=texel.a*vTint.a','(alpha-vParticleRemap.x)/vParticleRemap.y','(alpha*ramp.a-vParticleRemap.z)/vParticleRemap.w','albedo=albedo*particleSourceAlpha'])assert.ok(native.includes(snippet),snippet);
  assert.ok(native.indexOf('albedo=albedo*particleSourceAlpha')<native.indexOf('color.rgb=mix(fogColor,color.rgb'));
});
