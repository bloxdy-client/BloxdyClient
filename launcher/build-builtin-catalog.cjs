'use strict';
const fs=require('node:fs'),path=require('node:path');
const {hash}=require('./data-files.cjs');
function buildBuiltinCatalog(catalog){
  const manifest={id:'bloxd-no-ads',name:'No Ads',version:'1.0.0',kind:'bloxd-mod',category:'utility',requires:[{id:'bloxd-mod-host',version:'>=0.1.0'}],conflicts:[],scripts:[{world:'ISOLATED',js:[],css:['no-ads.css']}],compatibility:'launcher-dom-tested',note:'Hides known ad banners and video ad surfaces. Ad timers may still run; live coverage is unverified.'};
  const data=fs.readFileSync(path.join(__dirname,'builtin-mods/no-ads.css'));
  const files=[{path:'no-ads.css',data:data.toString('base64'),sha256:hash(data)}];
  const bytes=Buffer.from(JSON.stringify({schema:1,manifest,files})),filename=`${manifest.id}-${manifest.version}.bnmod`;
  fs.mkdirSync(catalog,{recursive:true});fs.writeFileSync(path.join(catalog,filename),bytes);
  const grassManifest={id:'bloxd-grassify',name:'Grassify',version:'0.2.0',kind:'bloxd-mod',category:'visual',requires:[{id:'bloxd-mod-host',version:'>=0.1.0'}],conflicts:['native-preview'],scripts:[{world:'MAIN',js:['grassify-runtime.js','grassify.js'],css:[]}],compatibility:'cpu-dom-tested-live-unverified',note:'WebGL2 grass in Flat, Round and Realistic styles, adjustable wind and thickness, 5–1000 blades per block, no total blade cap. Configure Grassify in Bloxd Settings. Live verification remains open.'};
  const grassFiles=grassManifest.scripts[0].js.map(name=>{const b=fs.readFileSync(path.join(__dirname,'builtin-mods',name));return {path:name,data:b.toString('base64'),sha256:hash(b)};});
  const grassBytes=Buffer.from(JSON.stringify({schema:1,manifest:grassManifest,files:grassFiles})),grassFilename=`${grassManifest.id}-${grassManifest.version}.bnmod`;
  fs.writeFileSync(path.join(catalog,grassFilename),grassBytes);
  const extras=[
    {id:'bloxd-zoomer',name:'Zoomer',version:'1.0.1',category:'utility',file:'zoomer.js',description:'Hold V to zoom; use the wheel for finer zoom up to 100x and configure camera speed, transitions and indicators in Bloxd Settings.',note:'Camera FOV zoom with configurable wheel steps, look speed and transitions. Live input and visuals remain unverified.'},
    {id:'bloxd-factory-buffer-reuse',name:'Factory Buffer Reuse',version:'1.0.0',category:'performance',file:'factory-buffer-reuse.js',description:'Avoids repeated byte-identical WebGL buffer uploads that can add work near dense Factory 2 machines and belts.',note:'No settings or on-screen text. Exact duplicate upload optimization only; a live FPS improvement is unverified.'}
  ].map(item=>{
    const manifest={id:item.id,name:item.name,version:item.version,kind:'bloxd-mod',category:item.category,requires:[{id:'bloxd-mod-host',version:'>=0.1.0'}],conflicts:[],scripts:[{world:'MAIN',js:[item.file],css:[]}],compatibility:'cpu-dom-tested-live-unverified',note:item.note};
    const data=fs.readFileSync(path.join(__dirname,'builtin-mods',item.file)),files=[{path:item.file,data:data.toString('base64'),sha256:hash(data)}];
    const bytes=Buffer.from(JSON.stringify({schema:1,manifest,files})),filename=`${manifest.id}-${manifest.version}.bnmod`;
    fs.writeFileSync(path.join(catalog,filename),bytes);
    return {...manifest,description:item.description,package:filename,sha256:hash(bytes),size:bytes.length,source:'Bloxdy Client'};
  });
  return [{...manifest,description:'Hides ad banners, promotions and video ad surfaces, including their click targets.',package:filename,sha256:hash(bytes),size:bytes.length,source:'Bloxdy Client'},
    {...grassManifest,description:'Dense grass with wind, player and mob bending, color and distance controls. Uses Bloxd WebGL2.',package:grassFilename,sha256:hash(grassBytes),size:grassBytes.length,source:'Bloxdy Client'},...extras];
}
if(require.main===module){
  const catalog=path.join(__dirname,'catalog'),file=path.join(catalog,'catalog.json');
  const current=JSON.parse(fs.readFileSync(file,'utf8')),builtins=buildBuiltinCatalog(catalog),ids=new Set(builtins.map(m=>m.id));
  current.items=[...current.items.filter(m=>!ids.has(m.id)),...builtins];
  fs.writeFileSync(file,JSON.stringify(current,null,2)+'\n');
}
module.exports={buildBuiltinCatalog};
