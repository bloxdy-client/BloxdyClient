'use strict';
const fs=require('node:fs'),path=require('node:path'),source=fs.readFileSync(path.resolve(__dirname,'../outputs/bloxd-public-source/main-0.js'),'utf8');
const terms=process.argv.slice(2);for(const term of terms){let index=-1,n=0;while(n<5&&(index=source.toLowerCase().indexOf(term.toLowerCase(),index+1))>=0){console.log(term,source.slice(Math.max(0,index-180),index+420));++n;}}
