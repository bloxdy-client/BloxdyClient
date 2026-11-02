'use strict';
const fs=require('node:fs'),path=require('node:path');
async function build(){await require('esbuild').build({entryPoints:[path.join(__dirname,'character-viewer.mjs')],outfile:path.join(__dirname,'assets','character-viewer.js'),bundle:true,format:'iife',platform:'browser',target:'chrome140',minify:true,legalComments:'eof'});const license=fs.readFileSync(require.resolve('three').replace(/build[\\/]three\.cjs$/,'LICENSE'),'utf8');fs.writeFileSync(path.join(__dirname,'assets','THREE-LICENSE.txt'),license);console.log('Local 3D viewer bundled; no client started.');}
build().catch(error=>{console.error(error.message);process.exitCode=1;});
