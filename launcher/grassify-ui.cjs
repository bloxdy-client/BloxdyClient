'use strict';
// Apply the current UI to installed 0.1.x packages too. Existing profile mod
// snapshots stay intact; only the in-memory UI section is replaced, exactly
// as for the bundled Litematica/Shader adapters. Renderer and state stay local.
const fs=require('node:fs'),path=require('node:path');
let currentUI;
function uiBounds(source){const start=source.indexOf('  function element('),end=source.indexOf('  globalThis.__GRASSIFY__');if(start<0||end<=start)throw Error('Grassify UI adapter does not match this mod version.');return {start,end};}
function adaptGrassifyUI(name,source){
  if(name!=='grassify.js')return source;
  if(currentUI===undefined){const current=fs.readFileSync(path.join(__dirname,'builtin-mods/grassify.js'),'utf8'),bounds=uiBounds(current);currentUI=current.slice(bounds.start,bounds.end);}
  const bounds=uiBounds(source);return source.slice(0,bounds.start)+currentUI+source.slice(bounds.end);
}
module.exports={adaptGrassifyUI};
