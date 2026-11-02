'use strict';
// Evaluate one isolated public shader-string builder. No client initialization.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const fixture=require('./fixtures/lifeform-shader-2026-10-15.json');
const sourceContracts=require('./fixtures/material-contracts-2026-10-15.json').contracts;
const specialContracts=require('./fixtures/special-materials-2026-10-15.json').contracts;
function verifiedContract(kind){const item=sourceContracts.find(item=>item.kind===kind);assert.equal(crypto.createHash('sha256').update(item.code).digest('hex'),item.sha256);return item.code;}
function specialContract(kind){const item=specialContracts.find(item=>item.kind===kind);assert.equal(crypto.createHash('sha256').update(item.code).digest('hex'),item.sha256);return item.code;}
function shaderHelpers(){return {e:(_s,name,type)=>`in ${type} ${name};`,vb:(_s,name,type)=>`in ${type} ${name};`,Db:(_s,name)=>name,zb:(_s,name)=>name,ub:(_s,name)=>name,L:(_s,name)=>name,N:()=>false,
  cb:(_s,name,value)=>`${name}.xyz = ${value};`,F:(_s,glsl)=>glsl,C:()=> 'diffuse',ob:(_s,value)=>`int(${value})`,M:(_s,value)=>`inversesqrt(${value})`,S:(_s,a,b)=>`mod(${a},${b})`,
  z:(_s,type,name,value)=>`${type} ${name} = ${value};`,s:(_s,type,name,value)=>`const ${type} ${name} = ${value};`,l:(_s,type,...values)=>`${type}(${values.join(',')})`,hb:(_s,test,a,b)=>`(${test}?${a}:${b})`,
  u:(_s,type,name,args,body)=>`${type} ${name}(${args.map(a=>a.type+' '+a.name).join(',')}){${body}}`};}

test('actual cape shader selects the last fallback bone and pivots around the original vertex z',()=>{
  const context=vm.createContext({ky:shaderHelpers()});vm.runInContext(specialContract('capeHelpers'),context,{timeout:1000});const code=specialContract('cape');
  const cape=vm.runInContext('('+code.slice(code.indexOf('=')+1)+')',context,{timeout:1000});
  const vertex=cape.getCustomCode.call({skeleLen:3},'vertex',0);assert.match(vertex.CUSTOM_VERTEX_DEFINITIONS,/mat2\(c,s,-s,c\)/);assert.match(vertex.CUSTOM_VERTEX_UPDATE_POSITION,/int\(BLOXD_CAPE_MAX_Y - positionUpdated.y\)/);
  assert.match(vertex.CUSTOM_VERTEX_UPDATE_POSITION,/boneIdx == 0\?skele0:\(boneIdx == 1\?skele1:skele2\)\)/);assert.match(vertex.CUSTOM_VERTEX_UPDATE_POSITION,/vec2\(0.0,position.z\)/);assert.match(vertex.CUSTOM_VERTEX_UPDATE_POSITION,/bone.yz \+ rotate\(bone.x\) \* pivot - pivot/);
});

test('actual text shader uses explicit source LOD bias and reverses premultiplied texture rounding',()=>{
  const code=specialContract('text'),context=vm.createContext({my:shaderHelpers(),Ss:'bloxdTextLodBias',hs:'bloxdTextSample'});
  const text=vm.runInContext('('+code.slice(code.indexOf('=')+1)+')',context,{timeout:1000}),fragment=text.getCustomCode('fragment',0);
  assert.match(fragment.CUSTOM_FRAGMENT_DEFINITIONS,/texture2D\(s, uv, bias\)/);assert.match(fragment.CUSTOM_FRAGMENT_DEFINITIONS,/clamp\(texel.rgb \/ max\(texel.a, 1.0 \/ 255.0\)/);assert.match(fragment.diffuse,/bloxdTextLodBias/);assert.equal(text.getCustomCode('vertex',0),null);
});

test('actual enchantment shader preserves node/local coordinates, noise constants and pre-fog composition',()=>{
  const code=specialContract('enchant'),context=vm.createContext({Ys:shaderHelpers(),Zs:{pb:String},Ss:{b:()=>''}});
  const enchant=vm.runInContext('('+code.slice(code.indexOf('=')+1)+')',context,{timeout:1000}),vertex=enchant.getCustomCode('vertex',0),fragment=enchant.getCustomCode('fragment',0);
  assert.match(vertex.CUSTOM_VERTEX_MAIN_END,/worldPos.xyz - aPosition \+ aOffset/);assert.match(vertex.CUSTOM_VERTEX_MAIN_END,/positionUpdated.xyz \/ 3.0/);assert.match(vertex.CUSTOM_VERTEX_MAIN_END,/uAnimTick \* aEnchantmentSpeed \* 1.2/);assert.match(vertex.CUSTOM_VERTEX_MAIN_END,/uAnimTick \* aEnchantmentSpeed \* 0.9/);
  assert.match(fragment.CUSTOM_FRAGMENT_DEFINITIONS,/37.837227241611314102871574478976/);assert.match(fragment.CUSTOM_FRAGMENT_DEFINITIONS,/635.298681,682.357502,668.926525/);assert.match(fragment.CUSTOM_FRAGMENT_BEFORE_FOG,/mix1 \* 0.77 \+ mix2 \* 0.42/);assert.match(fragment.CUSTOM_FRAGMENT_BEFORE_FOG,/minDiffForHueShift = 0.18/);assert.match(fragment.CUSTOM_FRAGMENT_BEFORE_FOG,/mix\(color.xyz, newColor, totalMix\)/);
});
test('the actual source sampler maps all twelve modes with and without mipmaps',()=>{
  const build=vm.runInNewContext('({'+verifiedContract('sampling')+'})._getSamplingParameters',Object.create(null),{timeout:1000});
  const gl={NEAREST:9728,LINEAR:9729,NEAREST_MIPMAP_NEAREST:9984,LINEAR_MIPMAP_NEAREST:9985,NEAREST_MIPMAP_LINEAR:9986,LINEAR_MIPMAP_LINEAR:9987};
  const expected=[[9728,9728],[9729,9729],[9987,9729],[9984,9728],[9985,9728],[9987,9728],[9729,9728],[9986,9728],[9984,9729],[9986,9729],[9985,9729],[9728,9729]];
  for(let mode=1;mode<=12;++mode)for(const mipmaps of [false,true]){const result=build.call({_gl:gl},mode,mipmaps),pair=expected[mode-1];assert.equal(result.mag,pair[1]);assert.equal(result.min,mipmaps?pair[0]:pair[0]===9984||pair[0]===9986?9728:pair[0]>=9984?9729:pair[0]);}
});
test('actual armour and hue shader builders preserve horizontal tiles, independent tint and shortest hue shift',()=>{
  const helper={e:(_s,name,type)=>`in ${type} ${name};`,vb:(_s,name,type)=>`in ${type} ${name};`,Db:(_s,name)=>name,zb:(_s,name)=>name,ub:(_s,name)=>name,L:(_s,name)=>name,
    cb:(_s,name,value)=>`${name}.xyz = ${value};`,ab:(_s,name,value)=>`${name}.rgb = ${value};`,ob:()=>'',C:()=> 'diffuse',$:(_s,name,uv)=>`texture(${name},${uv})`,
    z:(_s,type,name,value)=>`${type} ${name} = ${value};`,l:(_s,type,...values)=>`${type}(${values.join(',')})`,hb:(_s,test,a,b)=>`(${test}?${a}:${b})`,
    u:(_s,type,name,args,body)=>`${type} ${name}(${args.map(a=>a.type+' '+a.name).join(',')}){${body}}`};
  const armourCode=verifiedContract('armour'),hueCode=verifiedContract('hue');
  const context=vm.createContext({es:helper,Es:helper,Zs:helper,qs:{b:()=>''}});
  const armour=vm.runInContext('('+armourCode.slice(armourCode.indexOf('=')+1)+')',context,{timeout:1000});
  const vertex=armour.getCustomCode('vertex',0).CUSTOM_VERTEX_MAIN_END;assert.match(vertex,/vMainUV1\.x = \(vMainUV1\.x \+ aAtlasIdx1\) \/ uArmourAtlasTexNum/);assert.match(vertex,/vTintAndOpacity\.xyz = aArmourTint/);
  const hue=vm.runInContext('('+hueCode.slice(hueCode.indexOf('=')+1)+')',context,{timeout:1000});const fragment=hue.getCustomCode('fragment',0);
  assert.match(fragment.CUSTOM_FRAGMENT_DEFINITIONS,/hueDelta = hueDelta - floor\(hueDelta \+ 0\.5\)/);assert.match(fragment.CUSTOM_FRAGMENT_UPDATE_ALPHA,/greyValue > 0\.01 && greyValue < 0\.99/);assert.match(fragment.CUSTOM_FRAGMENT_UPDATE_ALPHA,/vHueColour\.a > 0\.5/);
});
test('the actual Bloxd Lifeform shader composes top-first layers with premultiplied alpha and integer grid rows',()=>{
  assert.equal(crypto.createHash('sha256').update(fixture.method).digest('hex'),fixture.methodSha256);
  const helper={e:(_s,name,type)=>`in ${type} ${name};`,vb:(_s,name,type)=>`in ${type} ${name};`,Db:(_s,name)=>name,L:(_s,name)=>name,ub:(_s,name)=>name,
    l:(_s,type,...args)=>`${type}(${args.join(',')})`,S:(_s,a,b)=>`mod(${a},${b})`,z:(_s,type,name,value)=>`${type} ${name} = ${value};`,
    V:(_s,name,value)=>`${name}.rgb *= ${value};`,ab:(_s,name,value)=>`${name}.rgb = ${value};`,C:()=> 'diffuse',$:(_s,sampler,uv)=>`texture(${sampler},${uv})`};
  const context=vm.createContext({Es:helper,ds:n=>Math.ceil(n/4),Ns:n=>'aAtlasIdx'+n,qs:n=>'vAtlasIdx'+n,hs:n=>({vec4Index:1+Math.floor((n-1)/4),component:(n-1)%4})});
  const build=vm.runInContext('({'+fixture.method+'}).getCustomCode',context,{timeout:1000});
  for(const layers of [1,2,7,8]){const fragment=build.call({numLayers:layers},'fragment',0).diffuse;
    assert.match(fragment,new RegExp('outCol = col'+layers+';'));assert.match(fragment,/outCol\.rgb \*= outCol\.a/);
    assert.match(fragment,/outCol\.rgb \/ max\(outCol\.a, 0\.001\)/);
    assert.match(fragment,/floor\(\(atlasIdx1 \+ 0\.5\) \/ uLifeformAtlasSize\.x\)/);
    if(layers>1)assert.ok(fragment.indexOf('mix(outCol.rgb, col'+(layers-1)+'.rgb')<fragment.indexOf('mix(outCol.rgb, col1.rgb')||layers===2);
  }
});
