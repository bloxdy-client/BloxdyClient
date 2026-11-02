'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {managedSource}=require('../adapters.cjs'),{original}=require('./litematica-runtime-fixture.cjs');
function controls({nativeError=false,adapterError=false,asyncSelection=false}={}){
 let time=0,timer=0,tick,next,selected=0,requested=null,placements=0,canUse=true,required='Stone',worldActual=0,loaded=true;const timers=new Map(),listeners=new Map(),noa={},down=new EventEmitter(),up=new EventEmitter(),events=[];
 const inputs={down,up},inventory={items:[{name:'Dirt',amount:64,typeObj:{id:2}},{name:'Stone',amount:64,typeObj:{id:1}}],getSelectedSlotIndex:()=>selected};
 const state={enabled:true,ezBuilding:true,ezSpeed:20,ezSchematicOnly:true,ezPreventExtra:true};
 const makeBlock=()=>({getBlockIdToPlace:()=>inventory.items[selected].typeObj.id,placeBlock(){placements++;if(nativeError)throw Error('native fault');}});
 const first=makeBlock();
 const session=block=>({noa,inputs,block,inventory,allowed:()=>canUse,target(){if(adapterError)throw Error('adapter fault');return {position:[0,0,0]};},selectSlot(index){if(asyncSelection){requested=index;return false;}selected=index;return true;},read:()=>({loaded,actual:worldActual}),aim:()=>null});next=session(first);
 const doc={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const ctx=vm.createContext({document:doc,performance:{now:()=>time},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),setInterval(fn){tick=fn;return ++timer;},clearInterval(){},setTimeout(fn){const id=++timer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),__BLM_ADAPTER__:{building:()=>next}});
 vm.runInContext(managedSource('bloxd-litematica','building.js',original('building.js')),ctx);
 const controller=ctx.__BLM_CREATE_BUILDING__(()=>state,()=>required?{name:required,layer:0}:null,()=>true,()=>true);
 down.on('alt-fire',payload=>{events.push(['down',payload]);next.block.placeBlock();});up.on('alt-fire',payload=>events.push(['up',payload]));
 return {controller,state,first,events,timers,down:payload=>down.emit('alt-fire',payload),up:payload=>up.emit('alt-fire',payload),tick:()=>tick(),advance(ms=60){time+=ms;const tasks=[...timers];timers.clear();for(const [,fn]of tasks)fn();},switchHeld(){next=session(makeBlock());tick();},completeSelection(){assert.notEqual(requested,null);selected=requested;requested=null;next=session(makeBlock());tick();},replaceWorld(){next={...session(makeBlock()),noa:{}};tick();},blur:()=>listeners.get('blur')?.(),allow:value=>{canUse=value;},require:value=>{required=value;},actual:value=>{worldActual=value;},load:value=>{loaded=value;},get placements(){return placements;},get selected(){return selected;}};
}

test('EZ Building forwards native right-button down and up events with the original payload and return',()=>{
 const h=controls(),payload={button:2};assert.equal(h.down(payload),true);assert.equal(h.up(payload),true);assert.deepEqual(h.events,[['down',payload],['up',payload]]);h.controller.destroy();
});

test('A user-held click survives its automatic hotbar/held-item replacement and places without a second click',()=>{
 const h=controls();h.down({button:2});assert.equal(h.selected,1);assert.equal(h.placements,1); // resolver in this fixture switches synchronously
 h.switchHeld();assert.equal(h.controller.diagnostics().held,true);h.advance();assert.equal(h.placements,2);
 h.up({button:2});const count=h.placements;h.advance(1000);assert.equal(h.placements,count);h.controller.destroy();
});

test('Asynchronous native hotbar selection resumes the original held gesture but a released gesture stays cancelled',()=>{
 for(const release of [false,true]){const h=controls({asyncSelection:true});h.down({});assert.equal(h.placements,0);assert.equal(h.selected,0);if(release)h.up({});h.completeSelection();h.advance();assert.equal(h.selected,1);assert.equal(h.placements,release?0:1);h.up({});h.controller.destroy();}
});

test('EZ Building never retries an original native placement exception or hides it',()=>{
 const h=controls({nativeError:true});assert.throws(()=>h.first.placeBlock(),/native fault/);assert.equal(h.placements,1);h.controller.destroy();
});

test('An adapter failure leaves the users direct native placement usable and releases its hold timer',()=>{
 const h=controls({adapterError:true});h.down({button:2});assert.equal(h.placements,1);assert.equal(h.controller.diagnostics().held,false);h.up({button:2});assert.equal(h.events.length,2);h.controller.destroy();
});

test('Explicit schematic-only, unloaded-cell and occupied-cell guards still prevent extra automatic placements',()=>{
 const h=controls();h.require(null);h.down({});h.advance();assert.equal(h.placements,0);h.up({});
 h.require('Stone');h.load(false);h.down({});h.advance();assert.equal(h.placements,0);h.up({});
 h.load(true);h.actual(2);h.down({});h.advance();assert.equal(h.placements,0);h.up({});h.controller.destroy();
});

test('Release, blur, menu entry, world replacement and disabling EZ Building cancel a held action',()=>{
 for(const cancel of [h=>h.up({}),h=>h.blur(),h=>{h.allow(false);h.tick();},h=>h.replaceWorld(),h=>{h.state.ezBuilding=false;h.tick();}]){
  const h=controls();h.down({});cancel(h);const count=h.placements;h.advance(1000);assert.equal(h.placements,count);assert.equal(h.controller.diagnostics().held,false);h.controller.destroy();
 }
});

test('Building source changes require the same pinned hash verification as the other adapted files',()=>{
 assert.throws(()=>managedSource('bloxd-litematica','building.js',original('building.js')+'\n'),/does not match/);
});
