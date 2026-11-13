'use strict';
// Standalone source contract regression, also runnable in public CPU CI.
const test=require('node:test'),assert=require('node:assert/strict');
const {nativeShadowSource}=require('../shader-native-shadows.cjs');
const {nativeWorldSource,patchNativeWorldSource,worldParameterFields,worldUniformBytes}=require('../shader-native-world.cjs');
test('Runtime modules may omit unreachable neutral helpers while retaining the complete world uniform ABI',()=>{
 const source=nativeWorldSource(nativeShadowSource()).replaceAll('bvfx','pack_bvfx');
 // Bloxd emits these in validationModules, then removes them from moduleCode.
 // The post-compile leaf/cloud implementations read the uniform fields directly.
 const stripped=['leafMotion','groundFrame','cloudSun','cloudOrigin'].reduce((code,name)=>code.replace(new RegExp('fn pack_bvfxWorld_'+name+'\\(\\) -> vec4f \\{ return vec4f\\(0.0\\); \\}'),' '),source);
 assert.notEqual(stripped,source);
 const patched=patchNativeWorldSource(stripped);assert.equal(patchNativeWorldSource(patched),patched);
 for(const name of worldParameterFields)assert(patched.includes(name+':vec4f,'));
 assert.match(patched,/let motion = bvfxWorld.leafMotion/);assert.match(patched,/let sun=bvfxWorld.cloudSun.xyz/);
 assert.equal(worldUniformBytes,160);
 assert.throws(()=>patchNativeWorldSource(stripped.replace('fn pack_bvfxWorld_held() -> vec4f { return vec4f(0.0); }','fn pack_bvfxWorld_held() -> vec4f { return vec4f(1.0); }')),/contract changed: held/);
});
