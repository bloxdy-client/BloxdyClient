'use strict';
const {adaptShader}=require('./shader-adapter.cjs');
const {adaptLitematicaPerformance}=require('./litematica-performance.cjs');
const {adaptGrassifyUI}=require('./grassify-ui.cjs');
const {adaptGrassifyScene}=require('./grassify-scene.cjs');
function replace(source,from,to,label){if(!source.includes(from))throw Error(`Launcher adapter does not match ${label}. Check the mod version.`);return source.replace(from,to);}
function managedSource(id,name,source){
  // Refresh installed 1.0.0 Zoomer snapshots with the corrected camera and
  // wheel handling without touching user profiles or stored preferences.
  if(id==='bloxd-zoomer'&&name==='zoomer.js')source=require('node:fs').readFileSync(require('node:path').join(__dirname,'builtin-mods/zoomer.js'),'utf8');
  if(id==='bloxd-grassify'){
    if(name==='grassify-runtime.js')source=require('node:fs').readFileSync(require('node:path').join(__dirname,'builtin-mods/grassify-runtime.js'),'utf8');
    if(name==='grassify.js')source=require('node:fs').readFileSync(require('node:path').join(__dirname,'builtin-mods/grassify.js'),'utf8');
    source=adaptGrassifyScene(name,adaptGrassifyUI(name,source));
  }
  if(id==='bloxd-visual-shader')source=adaptShader(name,source);
  if(id==='bloxd-litematica')source=adaptLitematicaPerformance(name,source);
  // Adapt only the launcher copy's discovery hook. Original project files and
  // PC/Safari/Firefox voice releases remain byte-for-byte unchanged.
  if(id==='bloxd-party-voice'&&name==='runtime.js'){
    source=replace(source,'const native = Object.defineProperty;',"let releaseDefinitionObserver = null; const native = target => target;",id);
    source=replace(source,'function restore() { if (Object.defineProperty === capture) Object.defineProperty = native; }','function restore() { releaseDefinitionObserver?.(); }',id);
    source=replace(source,'Object.defineProperty = capture;',"releaseDefinitionObserver = globalThis.__BLOXD_MOD_HOST__.observeDefinitions('voice-runtime', capture);",id);
  }
  if(id==='bloxd-litematica'&&name==='adapter.js'){
    source=replace(source,'const native = Object.defineProperty;',"let releaseDefinitionObserver = null; const native = target => target;",id);
    source=replace(source,'captured && texturePack && app && menus && pub && popup && Object.defineProperty === wrapped) Object.defineProperty = native','captured && texturePack && app && menus && pub && popup) releaseDefinitionObserver?.()',id);
    source=replace(source,'Object.defineProperty = wrapped;',"releaseDefinitionObserver = globalThis.__BLOXD_MOD_HOST__.observeDefinitions('litematica-runtime', wrapped);",id);
    source=replace(source,"releaseDefinitionObserver = globalThis.__BLOXD_MOD_HOST__.observeDefinitions('litematica-runtime', wrapped);", "releaseDefinitionObserver = globalThis.__BLOXD_MOD_HOST__.observeDefinitions('litematica-runtime', wrapped);\n  const releaseEngineObserver=globalThis.__BLOXD_MOD_HOST__.onEngine(api=>{capture(api);restore();});\n  addEventListener('pagehide',releaseEngineObserver,{once:true});",id);
    source=replace(source,'if (Object.defineProperty === wrapped) Object.defineProperty = native;','releaseDefinitionObserver?.();',id);
  }
  if(id==='bloxd-visual-shader'&&name==='shader.js'){
    source=replace(source,'const nativeDefineProperty = PAGE_OBJECT.defineProperty;','let releaseDefinitionObserver = null; const nativeDefineProperty = target => target;',id);
    source=replace(source,'if (PAGE_OBJECT.defineProperty === interceptedDefineProperty) PAGE_OBJECT.defineProperty = nativeDefineProperty;','releaseDefinitionObserver?.();',id);
    source=replace(source,'PAGE_OBJECT.defineProperty = interceptedDefineProperty;',"releaseDefinitionObserver = globalThis.__BLOXD_MOD_HOST__.observeDefinitions('shader-runtime', interceptedDefineProperty);",id);
    source=replace(source,"releaseDefinitionObserver = globalThis.__BLOXD_MOD_HOST__.observeDefinitions('shader-runtime', interceptedDefineProperty);", "releaseDefinitionObserver = globalThis.__BLOXD_MOD_HOST__.observeDefinitions('shader-runtime', interceptedDefineProperty);\n    const releaseEngineObserver=PAGE.__BLOXD_MOD_HOST__.onEngine(api=>{runtime.api=api;runtime.lighting='captured';restore();queueStatus();});\n    addEventListener('pagehide',releaseEngineObserver,{once:true});",id);
  }
  return source;
}
module.exports={managedSource};
