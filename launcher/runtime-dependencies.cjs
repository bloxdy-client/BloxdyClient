'use strict';
const fs=require('node:fs'),path=require('node:path');
// Only dependencies reachable from the runtime manifest are permitted in ASAR.
// Build tools, development dependencies and arbitrary node_modules stay out.
function runtimeDependencies(root){
 const roots=new Set();function visit(manifest){const directory=path.dirname(manifest),data=JSON.parse(fs.readFileSync(manifest,'utf8'));
  for(const name of Object.keys(data.dependencies||{})){
   let file;try{file=require.resolve(name+'/package.json',{paths:[directory]});}catch{let current=path.dirname(require.resolve(name,{paths:[directory]}));while(current!==path.dirname(current)){const candidate=path.join(current,'package.json');if(fs.existsSync(candidate)&&JSON.parse(fs.readFileSync(candidate)).name===name){file=candidate;break;}current=path.dirname(current);}}
   if(!file)throw Error('Runtime dependency manifest missing: '+name);const folder=path.dirname(file);if(roots.has(folder))continue;roots.add(folder);visit(file);
  }
 }visit(path.join(root,'package.json'));return roots;
}
module.exports={runtimeDependencies};
