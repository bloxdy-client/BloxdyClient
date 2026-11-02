'use strict';
const SHADER_KEY='bloxd-engine-voxel-shadows:settings:v2';
const LITEMATICA_KEY='bloxd-litematica:settings:v4';
function defaults(performance){
  const economy=performance==='economy',quality=performance==='quality';
  return {
    'bloxd-visual-shader':{[SHADER_KEY]:{enabled:true,preset:'custom',sliderModel:'normalized-v2',visualDefaultsRevision:1,waterStyle:economy?'flat':'wavey',waterPhysics:!economy,bloomEnabled:true,bloom:.20,oreGlowEnabled:true,oreGlowStrength:.5,oreBlockStrength:.5,oreSurfaceBrightness:.5,atmosphereEnabled:true,skyStyle:'clear',cloudType:'current',shadowEnabled:!economy,sunShadowEnabled:quality,entityShadows:!economy,sunRange:quality?80:48,sunResolutionExponent:quality?11:10,sunQuality:quality?20:10}},
    'bloxd-litematica':{[LITEMATICA_KEY]:{distance:economy?64:quality?192:128,maxRender:economy?32768:quality?262144:131072}},
    'bloxd-party-voice':{bpvPrefs:{enabled:true,server:'ws://127.0.0.1:8787/signal',muted:true,deafened:false}}
  };
}
function prepare(store,profile,modules){const initial=defaults(profile.performance),seed={};for(const m of modules){const saved=store.storage(profile.id,m.id);seed[m.id]={...(initial[m.id]||{}),...saved};if(m.id==='bloxd-visual-shader')seed[m.id][SHADER_KEY]={...initial[m.id][SHADER_KEY],...saved[SHADER_KEY]};}return seed;}
// Serialized into the game MAIN world. Only module-local lexical bindings use
// this storage; Bloxd's Storage prototype, login data and cookies are untouched.
function installProfileStorage(seed){
  const modules=new Map();
  function forModule(id){if(!Object.hasOwn(seed,id))throw Error('Unknown mod.');if(modules.has(id))return modules.get(id);const values=seed[id];
    const api=Object.freeze({getItem(key){return Object.hasOwn(values,key)?JSON.stringify(values[key]):null;},setItem(key,text){if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)||text.length>1024*1024)throw Error('Invalid mod storage.');const value=JSON.parse(text);values[key]=value;globalThis.__BLOXD_PROFILE_SAVE__.save(id,{[key]:value}).catch(()=>{});}});modules.set(id,api);return api;
  }
  Object.defineProperty(globalThis,'__BLOXD_MOD_STORAGE__',{value:Object.freeze({forModule}),configurable:true});
}
module.exports={defaults,prepare,installProfileStorage,SHADER_KEY,LITEMATICA_KEY};
