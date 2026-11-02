'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {managedSource}=require('../adapters.cjs'),{harness,original,pack}=require('./litematica-runtime-fixture.cjs');
test('A completed schematic stops world replay and driver queries, but still detects later edits',()=>{
 const h=harness({actual:1});h.frame();assert.equal(h.renderer.diagnostics().quads,0);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,0);
 h.gl.calls.length=0;const readAt=h.reads;for(let i=1;i<50;i++)h.frame(i);
 assert.equal(h.reads,readAt);assert.equal(h.samples,50);assert.equal(h.gl.calls.filter(c=>c[0]==='getParameter').length,0);
 assert.equal(h.gl.calls.filter(c=>c[0]==='drawElements').length,49,'only original world draws');
 h.setActual(0);h.frame(50);assert.ok(h.renderer.diagnostics().quads>0);assert.ok(h.renderer.diagnostics().capture.totalCapturedDraws>0);assert.equal(h.renderer.diagnostics().frames,1);
 h.renderer.destroy();
});
test('Only visible overlay groups capture the world, and return immediately when the camera comes back',()=>{
 const h=harness();h.matrix[12]=100;h.frame();assert.ok(h.renderer.diagnostics().quads>0);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,0);
 h.matrix[12]=0;h.frame(16);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,1);assert.equal(h.samples,2,'sample once per frame');
 h.camera[0]=1000;h.frame(32);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,1,'outside distance skips capture too');
 h.camera[0]=0;h.frame(48);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,2);
 h.renderer.destroy();
});
test('Hidden error overlays and transparent placements stop capture; enabled highlights and selection remain available',()=>{
 const h=harness({actual:2});h.state.showWrong=false;h.frame();assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,0);
 h.state.showWrong=true;h.frame(50);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,1);
 h.setActual(0);h.state.placementTransparency=1;h.renderer.invalidate();h.frame(100);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,1);
 h.state.placementTransparency=0;h.frame(150);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,2,'placement becomes visible again');
 h.setBlocks([]);h.setBox({min:[0,0,0],max:[0,0,0],size:[1,1,1]});h.frame(200);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,3);
 h.state.enabled=false;h.frame(250);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,3);h.renderer.destroy();
});
test('Block checks use a bounded cadence, never catch up after a pause and resume on invalidation',()=>{
 const blocks=Array.from({length:2000},(_,i)=>({x:i%20,y:Math.floor(i/400),z:Math.floor(i/20)%20,name:'Stone',layer:0})),h=harness({blocks,actual:1});
 h.frame();assert.equal(h.reads,1536);for(let i=1;i<=4;i++)h.frame(i*10);assert.equal(h.reads,1536);
 h.frame(50);assert.equal(h.reads,3072);h.frame(10000);assert.equal(h.reads,4608);
 h.renderer.invalidate();h.frame(10001);assert.equal(h.reads,6144);h.renderer.destroy();
});
test('Captured geometry keeps the original full-resolution target and restores world state',()=>{
 const h=harness(),source={world:true};h.gl.bindFramebuffer(h.gl.DRAW_FRAMEBUFFER,source);h.frame();
 assert.equal(h.gl.getParameter(h.gl.DRAW_FRAMEBUFFER_BINDING),source);assert.equal(h.renderer.diagnostics().nativeDepth,true);
 const images=h.gl.calls.filter(c=>c[0]==='texImage2D'&&typeof c[4]==='number');assert.ok(images.some(c=>c[4]===800&&c[5]===600));
 const nativeCalls=h.gl.calls.filter(c=>c[0]==='drawElements');assert.equal(nativeCalls.length,2,'one source draw and its required depth capture');
 h.renderer.destroy();h.gl.calls.length=0;h.gl.drawElements(h.gl.TRIANGLES,3,h.gl.UNSIGNED_SHORT,0);assert.equal(h.gl.calls.length,1,'capture hooks released');
});
test('The original bundled renderer reproduces unnecessary replay and duplicate sampling for completed blocks',()=>{
 const h=harness({actual:1,adapt:false});h.frame();assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,1);assert.equal(h.samples,2);h.renderer.destroy();
});
test('Performance adaptation rejects unverified edited sources',()=>{
 for(const name of ['renderer.js','litematica.js'])assert.throws(()=>managedSource(pack.manifest.id,name,original(name)+'\n'),/does not match/);
});
test('Early and regular world groups sample once and preserve both groups in the required capture',()=>{
 const h=harness({actual:1,earlyGroup:true});h.frame();assert.equal(h.samples,1);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,0);
 h.setActual(0);h.frame(50);assert.equal(h.samples,2);assert.equal(h.renderer.diagnostics().capture.totalCapturedDraws,2);h.renderer.destroy();
});
test('Large row indexes advance in slices, including append, replacement during indexing and cleanup',()=>{
 const rows=n=>Array.from({length:n},(_,i)=>({x:i,y:0,z:0,name:'Stone',layer:0})),first=rows(1024),h=harness({blocks:first,actual:1,clockStep:.8});
 h.frame(0);assert.equal(h.renderer.diagnostics().indexedRows,128);assert.equal(h.renderer.diagnostics().pendingRows,896);
 h.setBlocks(rows(512));for(let i=1;i<=4;i++)h.frame(i*50);assert.equal(h.renderer.diagnostics().indexedRows,512);assert.equal(h.renderer.diagnostics().pendingRows,0);
 const next=rows(256);h.setBlocks(next);h.frame(250);next.push(...rows(256).map(b=>({...b,x:b.x+256})));for(let i=6;i<=8;i++)h.frame(i*50);
 assert.equal(h.renderer.diagnostics().indexedRows,512);assert.equal(h.renderer.diagnostics().pendingRows,0);assert.equal(h.renderer.status(),'');h.renderer.destroy();
});

function composition(){
 let now=0;const context=vm.createContext({performance:{now:()=>now},localStorage:{getItem:()=>null},document:{readyState:'loading',addEventListener(){}},__BLM_MODEL__:{stats:()=>({totals:{},materials:{}})},BLOXD_BLOCK_NAMES:[],BLOXD_BLOCK_IDS:{},__BLM_ADAPTER__:{connect:()=>({camera:()=>[0,0,0]})},BloxdSchem:{},__BLM_CREATE_RENDERER__:()=>({})});
 let source=managedSource(pack.manifest.id,'litematica.js',original('litematica.js'));
 source=source.replace('  globalThis.__BLOXD_LITEMATICA__=',`  globalThis.fixture={renderRows,state,setScene(value){scene=value;},setBlocks(value){blocks=value;},deadline(value){sampleDeadline=value;}};\n  globalThis.__BLOXD_LITEMATICA__=`);
 vm.runInContext(source,context);return {...context.fixture,time(value){now=value;},spend(value){now+=value;}};
}
test('Pinned rows include incremental appends and retained-view completion without resampling twice per frame',()=>{
 const c=composition(),rows=[{x:0,y:0,z:0,name:'Stone'}];rows.retainPrevious=true;let samples=0;
 const entry={id:'pinned',visible:true,model:{chunks:[{}],counts:{}},mapping:{},placement:{x:0,y:0,z:0},view:{pending:()=>rows.retainPrevious,sample(){samples++;return rows;}}};c.setScene([entry]);
 let result=c.renderRows();assert.equal(result.length,1);assert.equal(result.retainPrevious,true);c.renderRows();assert.equal(samples,1);
 const initial=result,initialRow=entry.rows[0],initialRows=entry.rows;rows.push({x:1,y:0,z:0,name:'Stone'});c.time(16);result=c.renderRows();assert.equal(result.length,2);assert.equal(samples,2);assert.equal(result,initial);assert.equal(entry.rows,initialRows);assert.equal(entry.rows[0],initialRow);
 rows.retainPrevious=false;c.time(32);result=c.renderRows();assert.equal(result.retainPrevious,false);
 const active=[{x:4,y:0,z:0,name:'Stone'}];c.setBlocks(active);result=c.renderRows();assert.equal(result.length,3);active.push({x:5,y:0,z:0,name:'Stone'});assert.equal(c.renderRows().length,4);
});
test('Multiple pinned jobs share the sampling budget and retain their previous rows while waiting',()=>{
 const c=composition();let samples=0;
 const entry=id=>({id,visible:true,model:{chunks:[{}],counts:{}},mapping:{},placement:{x:0,y:0,z:0},view:{pending:()=>false,sample(){samples++;c.spend(3);return [{x:0,y:0,z:0,name:'Stone'}];}}});
 c.setScene([entry('a'),entry('b'),entry('c')]);c.deadline(3);assert.equal(c.renderRows().length,1);assert.equal(samples,1);
 c.time(16);c.deadline(19);assert.equal(c.renderRows().length,2);assert.equal(samples,2);
 c.time(32);c.deadline(35);assert.equal(c.renderRows().length,3);assert.equal(samples,3);
});
test('600 static CPU frames remove redundant world capture for completed and offscreen schematics',t=>{
 const measurements=[];
 for(const scenario of ['completed','offscreen','visible']){
  const result={scenario};for(const adapt of [false,true]){
   const h=harness({actual:scenario==='completed'?1:0,adapt});if(scenario==='offscreen')h.matrix[12]=100;
   for(let frame=0;frame<600;frame++)h.frame(frame*1000/60);
   result[adapt?'adapted':'original']={captures:h.renderer.diagnostics().capture.totalCapturedDraws,samples:h.samples,driverReads:h.gl.calls.filter(c=>c[0]==='getParameter').length,overlayFrames:h.renderer.diagnostics().frames};h.renderer.destroy();
  }
  assert.equal(result.original.captures,600);assert.equal(result.original.samples,1200);assert.equal(result.adapted.samples,600);
  assert.equal(result.adapted.captures,scenario==='visible'?600:0);if(scenario!=='visible')assert.ok(result.adapted.driverReads<result.original.driverReads/100);
  measurements.push(result);
 }
 t.diagnostic('CPU call counts only; no gameplay FPS: '+JSON.stringify(measurements));
});



test('Idle renderer skips discovery and hooks, wakes for work, and releases capture resources before idling again',()=>{
 const h=harness({hasWork:false});for(let i=0;i<120;i++){h.bind();h.frame(i*500);}assert.equal(h.discoveries,0);assert.equal(h.samples,0);assert.equal(h.gl.calls.filter(c=>c[0]==='getParameter'||c[0]==='createProgram').length,0);
 h.setWork(true);h.bind();h.frame(60000);assert.equal(h.discoveries,1);assert.ok(h.renderer.diagnostics().capture.totalCapturedDraws>0);const samples=h.samples;
 h.setWork(false);h.bind();assert.equal(h.renderer.diagnostics().groups,0);assert.equal(h.renderer.diagnostics().nativeDepth,false);
 h.gl.calls.length=0;for(let i=0;i<120;i++){h.bind();h.frame(60500+i*500);}assert.equal(h.discoveries,1);assert.equal(h.samples,samples);assert.equal(h.gl.calls.length,120,'idle keeps only the original world draws');
 h.setWork(true);h.bind();h.frame(121000);assert.equal(h.discoveries,2);assert.ok(h.renderer.diagnostics().quads>0);h.renderer.destroy();h.bind();assert.equal(h.discoveries,2);
});
