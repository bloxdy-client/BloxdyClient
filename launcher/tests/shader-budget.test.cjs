'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createShaderBudget}=require('../shader-budget.cjs');
const {shaderRuntime}=require('./shader-runtime-fixture.cjs');

test('Slow frames never lower authored quality or resolution, even with legacy adaptive settings',()=>{
  const budget=createShaderBudget(()=>true,()=> 'balanced');
  const authored={sunResolutionExponent:12,sunFrameRate:60,sunRange:50},view=budget.settings(authored);
  for(let i=0;i<2000;i++)budget.sample(i===0?448:173);
  assert.equal(view,authored);assert.equal(view.sunResolutionExponent,12);assert.equal(view.sunFrameRate,60);
  assert.equal(budget.limits().renderFactor,1);assert.equal(budget.limits().skyFactor,1);assert.equal(budget.limits().adaptive,false);
});

test('Fast frames and pauses cannot trigger quality oscillation',()=>{
  const budget=createShaderBudget(),before=budget.limits();
  for(let i=0;i<2000;i++)budget.sample(i%2?16:200);
  budget.sample(5000);assert.equal(budget.limits(),before);
});

test('Actual scene callbacks never access native resolution controls',()=>{
  let now=0,callback,reads=0,writes=0;
  const engine={getHardwareScalingLevel(){reads++;return .5;},setHardwareScalingLevel(){writes++;}};
  const shader=shaderRuntime({adaptiveQuality:true,sunResolutionExponent:12,sunFrameRate:60},{performance:{now:()=>now}});
  shader.bindWaterClock({_engine:engine,onBeforeRenderObservable:{add(fn){callback=fn;return fn;}}});
  for(let i=0;i<50;i++){now+=180;callback();}
  assert.equal(reads,0);assert.equal(writes,0);assert.equal(shader.state.sunResolutionExponent,12);assert.equal(shader.state.sunFrameRate,60);
  assert.equal(shader.root.__BVFX_INSTANCE__.diagnostics().renderScale,null);
});

test('CPU wall measurements retain bounded per-frame histories without changing quality',()=>{
  const budget=createShaderBudget();
  for(let i=0;i<500;i++){budget.recordCpu('shadows',2);budget.recordCpu('shadows',3);budget.sample(20);}
  const result=budget.cpuWall().shadows;assert.equal(result.frames,120);assert.equal(result.averageMs,5);assert.equal(result.maxMs,5);
  assert.equal(budget.limits().adaptive,false);
});
