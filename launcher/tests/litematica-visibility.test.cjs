'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./litematica-runtime-fixture.cjs'),{menu}=require('./litematica-menu-fixture.cjs');
const {visibility}=require('./litematica-visibility-fixture.cjs');
test('Passive trace distinguishes missing callbacks, rejected stages, invisible geometry and submitted draws without driver reads',()=>{
 const h=harness({directDepth:true});let value=h.renderer.diagnostics();assert.equal(value.pipeline.beforeGroups,0);assert.equal(value.programReady,false);
 h.frame();value=h.renderer.diagnostics();assert.equal(value.pipeline.sourceFrames,1);assert.equal(value.pipeline.beforeGroups,1);assert.equal(value.pipeline.ready,1);assert.ok(value.pipeline.vertices>0);assert.equal(value.pipeline.lastDraw.defaultTarget,true);
 const reads=h.gl.calls.filter(c=>c[0]==='getParameter').length;h.renderer.diagnostics();assert.equal(h.gl.calls.filter(c=>c[0]==='getParameter').length,reads);assert.equal(h.gl.calls.some(c=>c[0]==='getError'),false);
 h.renderer.diagnostics(true);assert.equal(h.gl.calls.some(c=>c[0]==='getError'),true);h.renderer.destroy();
 const rejected=harness({directDepth:true});rejected.startFrame();const scene=rejected.connection.scene;scene.onBeforeRenderingGroupObservable.notifyObservers({renderingGroupId:0,camera:{other:true}});assert.equal(rejected.renderer.diagnostics().pipeline.lastBefore.cameraMatches,false);assert.equal(rejected.renderer.diagnostics().frames,0);rejected.renderer.destroy();
 const hidden=harness({directDepth:true,blocks:[{x:1000,y:0,z:0,name:'Stone',layer:0}]});hidden.frame();assert.equal(hidden.renderer.diagnostics().pipeline.invisible,1);assert.equal(hidden.renderer.diagnostics().frames,0);hidden.renderer.destroy();
});
test('Build, Paste and Save area establish colour output despite leftover source scissor/cull/draw-buffer state',()=>{
 for(const mode of ['build','place','select']){const h=harness({directDepth:true}),v=visibility(h);h.state.mode=mode;if(mode==='select'){h.setBlocks([]);h.setBox({min:[0,0,0],max:[0,0,0],size:[1,1,1]});}h.frame();assert.equal(h.renderer.status(),'');assert.equal(h.renderer.diagnostics().frames,1);assert.ok(v.fragments>0,mode+' must produce colour writes, not only count calls');assert.equal(h.gl.isEnabled(h.gl.SCISSOR_TEST),true);assert.deepEqual(v.scissor,[0,0,0,0]);assert.equal(v.cull,h.gl.FRONT_AND_BACK);assert.deepEqual(v.drawBuffers,[h.gl.NONE]);h.renderer.destroy();}
});
test('A distant old corner cannot reject either Stick pick or replace its coordinate confirmation with a scan error',t=>{
 const h=menu(t),inputs={down:{emit:()=>false},up:{emit:()=>false}},noa={},calls=[];let target=[2,10,3];h.connection.read=(...p)=>{calls.push(p);return {loaded:p[0]<100,actual:1};};
 h.w.__BLM_ADAPTER__.selection=()=>({noa,inputs,allowed:()=>true,isStick:()=>true,target:()=>target.slice()});h.tab('select');h.ui.change('ax',5000);h.ui.change('bx',5001);h.ui.change('ay',10);h.ui.change('by',10);h.ui.change('aSet',true);h.ui.change('bSet',true);
 inputs.down.emit('fire');inputs.up.emit('fire');assert.equal(Number(h.field('ax').value),2);assert.equal(Number(h.field('az').value),3);assert.equal(Number(h.field('bx').value),5001);let status=h.w.__BLOXD_LITEMATICA__.diagnostics().selection.status;assert.match(status,/Corner 1 set to 2, 10, 3/);assert.match(status,/Corners remain editable/);assert.equal(h.w.__BLOXD_LITEMATICA__.diagnostics().selection.busy,false);
 target=[4,10,5];inputs.down.emit('alt-fire');inputs.up.emit('alt-fire');assert.equal(Number(h.field('bx').value),4);assert.equal(Number(h.field('bz').value),5);status=h.w.__BLOXD_LITEMATICA__.diagnostics().selection.status;assert.match(status,/Corner 2 set to 4, 10, 5/);assert.deepEqual(h.errors,[]);assert.ok(calls.length<30,'endpoint readiness only, no old-volume scan');
});
test('Selection scan failures leave Stick picking active and never rewrite coordinates',async t=>{
 const h=menu(t),inputs={down:{emit:()=>false},up:{emit:()=>false}},noa={};let target=[1,10,1];h.connection.read=(x,y,z)=>({loaded:x===1||x===3,actual:1});h.w.__BLM_ADAPTER__.selection=()=>({noa,inputs,allowed:()=>true,isStick:()=>true,target:()=>target});h.tab('select');inputs.down.emit('fire');inputs.up.emit('fire');target=[3,10,1];inputs.down.emit('alt-fire');inputs.up.emit('alt-fire');
 const before=[h.field('ax').value,h.field('bx').value];for(const fn of [...h.timers.values()])fn();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual([h.field('ax').value,h.field('bx').value],before);assert.match(h.w.__BLOXD_LITEMATICA__.diagnostics().selection.status,/Corners remain editable/);
 target=[1,10,2];inputs.down.emit('fire');inputs.up.emit('fire');assert.equal(Number(h.field('az').value),2);assert.deepEqual(h.errors,[]);
});
module.exports={visibility};
