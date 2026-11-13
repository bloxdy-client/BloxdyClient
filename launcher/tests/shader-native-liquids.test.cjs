'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
test('Native liquid kernels retain the shared production source and the eight-impact uniform ABI',()=>{
 const context=vm.createContext({});vm.runInContext('window=globalThis;',context);vm.runInContext(fs.readFileSync(require.resolve('../builtin-mods/shader-liquids.js'),'utf8'),context);
 const payload=require('../assets/native-liquids.json'),source=context.__BVFX_LIQUID_SHADER__.vertexUniforms;
 assert.equal(payload.sourceSha256,crypto.createHash('sha256').update(source).digest('hex'),'Rebuild native liquid kernels after changing the shared wave source');
 assert(payload.uniformBytes>=240);const ripples=payload.fields.find(f=>f.name==='uBvfxWaterRipples');assert.equal(ripples.count,8);assert(ripples.offset+ripples.count*ripples.stride<=payload.uniformBytes);
 assert.match(payload.code,/fn liquid_bvfxWaterSpectrum/);assert.match(payload.code,/fn liquid_bvfxLiquidImpacts/);assert.doesNotMatch(payload.code,/@fragment/);
});
