'use strict';
// Public catalog reads only. Does not launch or access Bloxd or any account.
const fs=require('node:fs'),path=require('node:path'),packs=require('./minecraft-packs.cjs');
async function run(){const results=await Promise.allSettled([packs.search('shader','Complementary'),packs.search('resourcepack','Faithful')]);const report=results.map((r,i)=>({type:i?'resourcepack':'shader',ok:r.status==='fulfilled',count:r.value?.length||0,examples:r.value?.slice(0,3).map(p=>({id:p.id,title:p.title,compatibility:p.compatibility})),error:r.reason?.message}));const dir=path.resolve(__dirname,'../outputs/launcher-verification');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'public-catalog.json'),JSON.stringify({at:new Date().toISOString(),bloxdAccessed:false,results:report},null,2));console.log(JSON.stringify(report));if(report.some(r=>!r.ok||r.count===0))process.exitCode=1;}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
