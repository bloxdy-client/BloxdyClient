'use strict';
// Evaluate the shipped scalar GLSL and real uniform uploads, without graphics.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {shaderRuntime}=require('./shader-runtime-fixture.cjs'),{fakeGl}=require('./shader-gl-fixture.cjs');
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function setup(settings={},globals={}){
 const runtime=shaderRuntime({cloudType:'none',sunAzimuth:0,sunElevation:20,...settings},globals),state={...runtime.state},gl=fakeGl();
 const r={state,atmosphere:runtime.root.__BVFX_CREATE_ATMOSPHERE__(state)};
 gl.drawingBufferWidth=1920;gl.drawingBufferHeight=1080;
 const program=gl.createProgram();gl.useProgram(program);const loc=r.atmosphere.locations(gl,program);
 return {r,gl,bind:()=>r.atmosphere.bind(gl,loc,gl)};
}
function perspective(fov,aspect,sign=1){const f=1/Math.tan(fov*Math.PI/360);return [f/aspect,0,0,0,0,f,0,0,0,0,sign*1.0002,sign,0,0,-.20002,0];}
function scalar(code,name,globals={}){
 const match=code.match(new RegExp('float '+name+'\\(([^)]*)\\)\\{([\\s\\S]*?)\\n\\}'));
 assert(match,'the production shader owns '+name);
 return vm.runInNewContext('(function('+match[1].replace(/\bfloat\s+/g,'')+'){'+match[2].replace(/\bfloat\b/g,'let')+'})',{
  min:Math.min,max:Math.max,abs:Math.abs,pow:Math.pow,sqrt:Math.sqrt,exp:Math.exp,exp2:x=>2**x,smoothstep,...globals});
}

test('The sun has a resolved filled disc and a continuous glow even with bloom disabled',()=>{
 const {r,gl,bind}=setup({bloomEnabled:false,sunGlow:.8});bind();
 const shape=gl.uniformValues.get('uBvfxAtmoSunShape');assert(shape,'solar shape is uploaded independently of bloom');
 const [radius,edge]=shape;assert.equal(radius,.030);assert(edge>0&&edge<radius*.2);
 const disc=scalar(r.atmosphere.common,'bvfxSolarDisc'),halo=scalar(r.atmosphere.common,'bvfxSolarHalo');
 const pixels=2*radius*1080/(2*Math.tan(70*Math.PI/360));
 assert(pixels>46&&pixels<47,'the daylight disc is resolved at about twice the former diameter');
 assert.equal(disc(0,radius,edge),1);assert.equal(disc(radius*.7,radius,edge),1);
 assert(Math.abs(disc(radius,radius,edge)-.5)<1e-9);assert.equal(disc(radius+edge*1.01,radius,edge),0);
 let previous=Infinity;for(let d=0;d<radius*8;d+=radius/30){const v=halo(d,radius,.8);assert(v>=0&&v<=previous);previous=v;}
 assert(halo(radius*1.5,radius,.8)>.03);assert.equal(halo(radius,radius,0),0);
});

test('Solar and flare projection use the same body across FOV, aspect, handedness, rotation and rebase',()=>{
 const {r,gl,bind}=setup();
 for(const aspect of [1,16/9,2.4])for(const fov of [40,70,110])for(const sign of [-1,1]){
  gl.drawingBufferWidth=1080*aspect;
  const sun=[.15,.22,sign*.964935],n=Math.hypot(...sun);r.state.dayNightFrame={phase:'day',body:sun.map(x=>x/n)};
  // Roll plus a large world translation: directions must ignore translation.
  const c=Math.cos(.3),s=Math.sin(.3),view=[c,s,0,0,-s,c,0,0,0,0,1,0,2000,-4000,6000,1],projection=perspective(fov,aspect,sign);
  r.atmosphere.setViewProjection(view,projection);bind();
  const screen=gl.uniformValues.get('uBvfxAtmoSunScreen'),m=gl.uniformValues.get('uBvfxAtmoRayMatrix');assert.equal(screen[2],1);
  const x=screen[0]*2-1,y=screen[1]*2-1,ray=[0,1,2].map(i=>m[i]*x+m[i+4]*y+m[i+8]+m[i+12]),length=Math.hypot(...ray);
  const body=gl.uniformValues.get('uBvfxAtmoSunDir');ray.forEach((v,i)=>assert(Math.abs(v/length-body[i])<2e-6));
  const edge=gl.uniformValues.get('uBvfxAtmoSunShape')[1];assert(edge>0&&edge<.006);
 }
});

test('Lens reflections taper continuously without bright flat bubbles or broad bleaching streaks',()=>{
 const code=shaderRuntime().atmosphere.common,spot=scalar(code,'bvfxFlareSpot'),streak=scalar(code,'bvfxFlareStreak');
 for(const radius of [.025,.04,.065,.085]){
  assert.equal(spot(0,0,radius),1);let previous=1;
  for(let x=radius/30;x<radius*5;x+=radius/30){const v=spot(x,0,radius);assert(v<=previous&&v>=0);previous=v;}
  assert(spot(radius,0,radius)>.1);assert(spot(radius*4,0,radius)<.00001);
  assert.equal(spot(.01,.02,radius),spot(.02,.01,radius),'circular in height-corrected coordinates');
 }
 assert(streak(.02,0)>.4);assert(streak(.1,0)<.04);assert(streak(0,.01)<.001);
 const ghost=scalar(code,'bvfxFlareGhost',{bvfxFlareSpot:spot});
 assert.equal(ghost(0,0,0,0,0,.04),1);
 assert(ghost(0,.6*.04,0,0,0,.04)<.30,'reflections fade throughout their footprint');
 assert(ghost(0,.86*.04,0,0,0,.04)<.03,'no bright aperture edge remains');
 assert(Math.abs(ghost(.7*.04,0,0,0,0,.04)-ghost(0,.7*.04,0,0,0,.04))<.02,'small aperture variation cannot form dominant flat hexagons');
 assert.equal(ghost(0,1.02*.04,0,0,0,.04),0,'bounded aperture edges stay focused rather than Gaussian smears');
 const ghosts=[...code.matchAll(/float ghost\d=bvfxFlareGhost\(p.x,p.y,axis.x,axis.y,([-.\d]+),([.\d]+)\)/g)].map(m=>m.slice(1).map(Number));
 assert.equal(ghosts.length,3,'three unequal optical reflections');
 for(const [position,radius]of ghosts){
  assert(radius<=.048,'defocused reflections have bounded support');
  assert.equal(ghost(.3*position,.1*position,.3,.1,position,radius),1);
  assert(ghost(.3*position+radius*4,.1*position,.3,.1,position,radius)<.00001);
 }
 assert.doesNotMatch(code,/ghost3/,'the fourth bubble no longer contributes');
 let previous=1;for(let d=.001;d<=.04;d+=.001){const v=ghost(d,0,0,0,0,.04);assert(v<=previous&&v>=0);previous=v;}
 assert.match(code,/sky=vec3\(1.0\)-\(vec3\(1.0\)-sky\)\*exp\(-bvfxSolarFlare/);
 assert.doesNotMatch(code.slice(code.indexOf('vec3 bvfxSolarFlare')),/float ring=/);
});

test('The larger daylight disc preserves the moon size and keeps lunar lens optics disabled',()=>{
 const {r,gl,bind}=setup();bind();assert.equal(gl.uniformValues.get('uBvfxAtmoSunShape')[0],.030);
 r.state.skyStyle='moonlit';bind();assert.equal(gl.uniformValues.get('uBvfxAtmoSunShape')[0],.0093);
 assert.equal(gl.uniformValues.get('uBvfxAtmoSunScreen')[2],0);
});

test('Flare source rejection is finite and respects source position, night, space, toggles and disposal',()=>{
 const {r,gl,bind}=setup();const api=r.atmosphere;
 for(const [x,y,valid,expected]of [[.4,.6,true,1],[-.1,.5,true,0],[.5,1.1,true,0],[.5,.5,false,0],[NaN,.5,true,0],[Infinity,.5,true,0]]){
  api.setSunScreen(x,y,valid);bind();const screen=gl.uniformValues.get('uBvfxAtmoSunScreen');assert.equal(screen[2],expected);assert(screen.every(Number.isFinite));
 }
 api.setViewProjection(identity(),perspective(70,16/9));
 for(const settings of [{sunElevation:-10},{sunAzimuth:180},{sunAzimuth:90},{skyStyle:'moonlit'},{skyStyle:'milkyway'},{sunLensFlare:false},{sunBrightness:0}]){
  Object.assign(r.state,{sunAzimuth:0,sunElevation:20,skyStyle:'clear',sunLensFlare:true,sunBrightness:.62},settings);bind();
  assert.equal(gl.uniformValues.get('uBvfxAtmoSunScreen')[2],0,JSON.stringify(settings));
 }
 Object.assign(r.state,{sunAzimuth:0,sunElevation:20,skyStyle:'clear',sunLensFlare:true,sunBrightness:.62});
 r.state.dayNightFrame={phase:'night',body:[0,.2,.98]};bind();assert.equal(gl.uniformValues.get('uBvfxAtmoSunScreen')[2],0);
 api.dispose();r.state.dayNightFrame=null;bind();assert.equal(gl.uniformValues.get('uBvfxAtmoSunScreen')[2],0,'world departure clears stale optics');
 assert.equal(gl.allocations.size,0);
});

test('Solar edge follows zoom/resolution while optics toggles cannot alter it; repeated draws reuse projection',()=>{
 let calculations=0;const cpuMath=Object.create(Math);cpuMath.hypot=(...v)=>{calculations++;return Math.hypot(...v);};
 const {r,gl,bind}=setup({}, {Math:cpuMath}),api=r.atmosphere;
 api.setViewProjection(identity(),perspective(70,16/9));bind();const first=gl.uniformValues.get('uBvfxAtmoSunShape');
 const count=calculations;assert(count>=5);
 for(let i=0;i<500;i++)bind();assert.equal(calculations,count,'no per-draw projection/unprojection work');
 r.state.sunLensFlare=false;bind();assert.deepEqual(gl.uniformValues.get('uBvfxAtmoSunShape'),first);
 api.setViewProjection(identity(),perspective(20,16/9));bind();const zoom=gl.uniformValues.get('uBvfxAtmoSunShape');
 assert.equal(zoom[0],first[0]);assert(zoom[1]<first[1]*.5);
 gl.drawingBufferWidth*=2;gl.drawingBufferHeight*=2;bind();const highDpi=gl.uniformValues.get('uBvfxAtmoSunShape');
 assert.equal(highDpi[0],first[0]);assert(Math.abs(highDpi[1]/zoom[1]-.5)<.001);
 r.state.skyStyle='golden';r.state.sunElevation=14;r.state.sunWarmth=.85;bind();
 assert.equal(gl.uniformValues.get('uBvfxAtmoSunShape')[0],first[0],'warmth changes colour without inflating the disc');
});

test('Flare uses integrated cloud transmission; partial cover softens it and opaque clouds block it',()=>{
 const transmission=scalar(shaderRuntime().atmosphere.common,'bvfxFlareTransmission');
 for(const elevation of [.05,.12,.3,.9]){
  assert.equal(transmission(0,elevation),1);let previous=1;
  for(let opacity=0;opacity<=1;opacity+=.01){const value=transmission(opacity,elevation);assert(value>=0&&value<=previous);previous=value;}
 }
 assert.equal(transmission(1,.3),0);assert.equal(transmission(.99,.3),0,'nearly opaque clouds cannot leak bright optics');
 assert.equal(transmission(.75,.3),.25,'partial cover attenuates radiance without lifting it with a square root');
});
