'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {harness,original}=require('./litematica-runtime-fixture.cjs');
const {managedSource}=require('../adapters.cjs');

test('Changing world colours cannot repeatedly cancel every slice of a large mesh',()=>{
 const rows=Array.from({length:512},(_,i)=>({x:i%8,y:Math.floor(i/64),z:Math.floor(i/8)%8,name:'Stone',layer:0,faceMask:63,status:'wrong',actualName:'Dirt'}));
 const h=harness({blocks:rows,actual:2,clockStep:.15});
 for(let frame=0;frame<96;frame++){h.setActual(frame%2?0:2);h.frame(frame*50);}
 assert.ok(h.renderer.diagnostics().uploads>0,'finish coherent meshes while more colour changes arrive');
 h.setActual(1);for(let frame=96;frame<650&&(rows.some(r=>r.status!=='correct')||h.renderer.diagnostics().pendingMeshes);frame++)h.frame(frame*50);
 assert.ok(rows.every(r=>r.status==='correct'));assert.equal(h.renderer.diagnostics().pendingMeshes,0);assert.equal(h.renderer.diagnostics().quads,0);
 const uploads=h.renderer.diagnostics().uploads;for(let frame=650;frame<670;frame++)h.frame(frame*50);assert.equal(h.renderer.diagnostics().uploads,uploads,'settled meshes stop rebuilding');
 h.renderer.destroy();assert.equal(h.gl.calls.filter(c=>c[0]==='createBuffer').length,h.gl.calls.filter(c=>c[0]==='deleteBuffer').length);
});

test('One masked source chunk stays merged across its 16-block centre',()=>{
 const rows=Array.from({length:1024},(_,i)=>{const x=i%32,z=Math.floor(i/32);return {x,y:0,z,name:'Stone',layer:0,chunkKey:'slab',faceMask:12|(x===31?1:0)|(x===0?2:0)|(z===31?16:0)|(z===0?32:0)};}),h=harness({blocks:rows});
 for(let frame=0;frame<30&&(!h.renderer.diagnostics().uploads||h.renderer.diagnostics().pendingMeshes);frame++)h.frame(frame*16);
 assert.equal(h.renderer.diagnostics().groups,1);assert.equal(h.renderer.diagnostics().quads,6,'six exterior faces, no extra seams or smaller draw groups');
 h.renderer.destroy();
});

test('A suspended geometry generator sees the same row snapshot after live world statuses change',()=>{
 const row={x:0,y:0,z:0,name:'Stone',layer:0,status:'missing',faceMask:63},h=harness({blocks:[row]});let snapshot,resumed=false;
 h.context.__BLM_GEOMETRY__.greedySteps=function*(eligible){snapshot=eligible;h.setClockStep(5);yield;assert.equal(eligible[0].status,'missing');resumed=true;return [];};
 h.frame();assert.ok(snapshot);row.status='correct';h.frame(50);assert.equal(resumed,true);assert.notEqual(snapshot[0],row);h.renderer.destroy();
});

test('Many dirty chunks keep at most two live builders and eventually finish every chunk',()=>{
 const rows=Array.from({length:32*128},(_,i)=>({x:(i%8)+32*Math.floor(i/128),y:Math.floor(i%128/64),z:Math.floor(i/8)%8,name:'Stone',layer:0,faceMask:63,status:'wrong',actualName:'Dirt'})),h=harness({blocks:rows,actual:2,clockStep:.05});
 for(let frame=0;frame<800&&(frame===0||h.renderer.diagnostics().pendingMeshes||h.renderer.diagnostics().pendingRows);frame++){h.frame(frame*16);assert.ok(h.renderer.diagnostics().activeMeshBuilds<=2);}
 const d=h.renderer.diagnostics();assert.equal(d.groups,32);assert.equal(d.pendingMeshes,0);assert.equal(d.pendingRows,0);assert.equal(d.uploads,32);assert.ok(d.peakMeshBuilds<=2);
 h.renderer.destroy();assert.equal(h.gl.calls.filter(c=>c[0]==='createBuffer').length,h.gl.calls.filter(c=>c[0]==='deleteBuffer').length);
});

test('Changing selection or appearance during a pending upload cancels it and frees every private buffer',()=>{
 const h=harness({actual:2});h.frame();const upload=h.gl.bufferSubData;
 h.gl.bufferSubData=function(...args){const result=upload.apply(this,args);h.setClockStep(5);return result;};
 const rows=offset=>Array.from({length:512},(_,i)=>({x:i%8+offset,y:Math.floor(i/64),z:Math.floor(i/8)%8,name:'Stone',layer:0,faceMask:63,status:'wrong',actualName:'Dirt'}));
 for(let change=0;change<3;change++){
  h.setClockStep(.15);h.setBlocks(rows(change%2?0:32));const before=h.gl.calls.filter(c=>c[0]==='bufferSubData').length;
  for(let frame=0;frame<120&&h.gl.calls.filter(c=>c[0]==='bufferSubData').length===before;frame++)h.frame(change*10000+frame*16);
  assert.ok(h.gl.calls.filter(c=>c[0]==='bufferSubData').length>before);h.state.renderMode=change%2?'all':'errors';h.renderer.invalidate();
 }
 h.setBlocks([]);h.frame(50000);h.renderer.destroy();assert.equal(h.gl.calls.filter(c=>c[0]==='createBuffer').length,h.gl.calls.filter(c=>c[0]==='deleteBuffer').length);
});

function viewFixture(){
 let now=0;const ctx=vm.createContext({performance:{now:()=>now+=.02}});
 vm.runInContext(managedSource('bloxd-litematica','placement.js',original('placement.js')),ctx);
 const view=ctx.BloxdSchem.createView({size:[128,32,32],selection:[0,0,0],chunks:Array.from({length:4},(_,x)=>({x,y:0,z:0,nonAir:32768,data:Uint8Array.from([128,128,2,1])}))});
 return {view,state:{layerMode:'all',layer:0,layerEnd:0,distance:128,maxRender:262144,showExtra:false},mapping:{'bloxd:1':'Stone'},options:{origin:[0,0,0]}};
}

test('Walking across a camera cell boundary cannot restart a pending placement forever',()=>{
 const {view,state,mapping,options}=viewFixture();let completed=false,rows;
 for(let sample=0;sample<260;sample++){rows=view.sample(mapping,options,[sample%2?17:15,1,1],state);const d=view.diagnostics();if(d.chunksReady===d.chunksTotal&&d.chunksTotal===4){completed=true;break;}}
 assert.equal(completed,true,'complete the current nearby view even if the next camera selection is queued');assert.ok(rows.length>0);
 for(let sample=0;sample<260&&view.pending();sample++)rows=view.sample(mapping,options,[17,1,1],state);
 assert.equal(view.pending(),false);assert.equal(view.diagnostics().chunksReady,4);assert.equal(rows.retainPrevious,false);
});

test('A deferred camera request remains pending for the launcher and explicit layer/position changes apply immediately',()=>{
 const {view,state,mapping,options}=viewFixture();
 view.sample(mapping,options,[15,1,1],state);let queued=false;
 for(let sample=0;sample<260;sample++){view.sample(mapping,options,[17,1,1],state);const d=view.diagnostics();if(d.chunksReady===4){queued=true;assert.equal(view.pending(),true,'launcher must sample again for the queued camera');break;}}
 assert.ok(queued);state.layerMode='single';state.layer=0;
 let rows;for(let sample=0;sample<260;sample++){rows=view.sample(mapping,{origin:[-200,4,-20]},[-200,4,-20],state);if(!view.pending())break;}
 assert.equal(view.pending(),false);assert.ok(rows.length>0);assert.ok(rows.every(r=>r.y===4&&r.x<0&&r.z>=-20));
});
