'use strict';
// Read-only snapshots of existing projects. Their original releases are untouched.
const fs=require('node:fs'),path=require('node:path');const {hash}=require('./store.cjs');
const root=path.resolve(__dirname,'..'),workspace=path.resolve(root,process.argv[2]||process.env.BLOXDY_MOD_SOURCE_ROOT||'..'),catalog=path.join(__dirname,'catalog');
const sources=[
  {id:'bloxd-visual-shader',folder:'Bloxd-Shader-OperaGX',category:'shaders',description:'Shadows, water and atmosphere built for Bloxd.',conflicts:['native-preview'],note:'A Bloxd shader mod with its own lighting controls.'},
  {id:'bloxd-litematica',folder:'Bloxd-Litematica',category:'building',description:'Schematic previews, material lists and .bloxdschem tools.',conflicts:['native-preview'],note:'A schematic mod built for Bloxd.'}
];
for(const source of sources)if(!fs.existsSync(path.join(workspace,source.folder,'manifest.json')))throw Error('Mod sources not found. Use npm run catalog -- <source-root> or BLOXDY_MOD_SOURCE_ROOT. Current root: '+workspace);
fs.mkdirSync(catalog,{recursive:true});
const items=[];
for(const source of sources){const sourceRoot=path.join(workspace,source.folder),extension=JSON.parse(fs.readFileSync(path.join(sourceRoot,'manifest.json'),'utf8'));
  const scripts=extension.content_scripts.map(s=>({world:s.world||'ISOLATED',js:s.js||[],css:s.css||[]}));const names=[...new Set(scripts.flatMap(s=>[...s.js,...s.css]))];
  const manifest={id:source.id,name:extension.name,version:extension.version,kind:'bloxd-mod',category:source.category,requires:[{id:'bloxd-mod-host',version:'>=0.1.0'}],conflicts:source.conflicts,scripts,compatibility:'launcher-adapter-unverified',note:source.note};
  const files=names.map(name=>{const bytes=fs.readFileSync(path.join(sourceRoot,name));return {path:name,data:bytes.toString('base64'),sha256:hash(bytes)};});
  const bytes=Buffer.from(JSON.stringify({schema:1,manifest,files})),filename=`${source.id}-${extension.version}.bnmod`;fs.writeFileSync(path.join(catalog,filename),bytes);
  items.push({...manifest,description:source.description,package:filename,sha256:hash(bytes),size:bytes.length,source:'Local Bloxd project'});
}
items.push(...require('./build-builtin-catalog.cjs').buildBuiltinCatalog(catalog));
fs.writeFileSync(path.join(catalog,'catalog.json'),JSON.stringify({schema:1,items},null,2));console.log(`Catalog built: ${items.length} local mods; original projects unchanged.`);
