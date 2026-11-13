'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {shaderRuntime}=require('./shader-runtime-fixture.cjs');
function fixture(t,settings={}){
 const dom=new JSDOM('<html><body><div class="SettingsMenu"><div class="MenuSideBarBody"></div><div class="SettingsMenuRight"></div></div></body></html>',{url:'https://bloxd.io/'});t.after(()=>dom.window.close());
 const add=dom.window.document.addEventListener.bind(dom.window.document);dom.window.document.addEventListener=(type,...args)=>{if(type!=='DOMContentLoaded')add(type,...args);};
 const r=shaderRuntime({sunShadowEnabled:true,shadowDistance:96,...settings},{__BVFX_NATIVE_REQUESTED__:true,document:dom.window.document,getComputedStyle:dom.window.getComputedStyle,innerWidth:1200,innerHeight:800});
 r.installShaderSettings();r.selectShaderCategory(true);r.syncUi();return {r,dom,d:dom.window.document};
}
test('Native shadow settings expose exactly the four agreed controls',t=>{
 const {r,d}=fixture(t),group=d.querySelector('[data-shader-check="blockShadows"]').parentElement;
 assert.equal(r.state.shadowEngine,'bloxd-native-v1');assert.deepEqual([...group.querySelectorAll('[data-shader-check]')].map(x=>x.dataset.shaderCheck),['blockShadows','entityShadows']);
 assert.deepEqual([...group.querySelectorAll('[data-shader-slider]')].map(x=>x.dataset.shaderSlider),['sunStrength','shadowDistance']);
 for(const key of ['sunFloor','sunResolutionExponent','sunRange','sunFrameRate','shadowStrength','shadowFloor'])assert.equal(d.querySelector('[data-shader-slider="'+key+'"]'),null,key);
 assert.equal(d.querySelector('[data-shader-check="sunSmoothing"]'),null);
});
test('Entity shadows stay independently usable while block shadows are off',t=>{
 const {r,d}=fixture(t,{entityShadows:false});const block=d.querySelector('[data-shader-check="blockShadows"]'),entity=d.querySelector('[data-shader-check="entityShadows"]');
 block.click();assert.equal(r.state.blockShadows,false);assert.equal(entity.querySelector('input').disabled,false);
 const distance=d.querySelector('[data-shader-slider="shadowDistance"] [role=slider]');assert.equal(distance.getAttribute('aria-disabled'),'true');
 entity.click();assert.equal(r.state.entityShadows,true);assert.equal(r.state.blockShadows,false);assert.equal(distance.getAttribute('aria-disabled'),'false');
 assert.equal(r.sun.shadowDiagnostics.externalPack,false);
});
test('Distance and strength preserve native keyboard controls and normalized settings',t=>{
 const {r,d,dom}=fixture(t);const distance=d.querySelector('[data-shader-slider="shadowDistance"] [role=slider]'),strength=d.querySelector('[data-shader-slider="sunStrength"] [role=slider]');
 distance.dispatchEvent(new dom.window.KeyboardEvent('keydown',{code:'ArrowRight',bubbles:true}));assert.equal(r.state.shadowDistance,97);
 strength.dispatchEvent(new dom.window.KeyboardEvent('keydown',{code:'Home',bubbles:true}));assert.equal(r.state.sunStrength,0);
 strength.dispatchEvent(new dom.window.KeyboardEvent('keydown',{code:'End',bubbles:true}));assert.equal(r.state.sunStrength,1);
 assert.equal(r.state.preset,'custom');assert.equal(JSON.parse(JSON.stringify(r.state)).nativeShadows,undefined);
});
test('An explicitly disabled old shadow setting remains off during migration',t=>{
 const {r,d}=fixture(t,{sunShadowEnabled:false,entityShadows:true});assert.equal(r.state.blockShadows,false);assert.equal(r.state.entityShadows,false);
 assert.equal(d.querySelector('[data-shader-check="entityShadows"] input').disabled,false);
});
