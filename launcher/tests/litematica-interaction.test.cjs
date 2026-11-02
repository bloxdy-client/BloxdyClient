'use strict';
// Only isolated JS/DOM models. No Electron, graphics, network, or game session.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),{managedSource}=require('../adapters.cjs');
const {harness,original}=require('./litematica-runtime-fixture.cjs');
const adapted=name=>managedSource('bloxd-litematica',name,original(name));
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function nativeChat(t,{oldMarker=false,upload='success'}={}){
 const dom=new JSDOM('<input class="ChatInput">',{url:'https://bloxd.io',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,doc=w.document,input=doc.querySelector('input');t.after(()=>w.close());
 const commands=[],events=[],longTimers=new Map(),chat=new Set();let timeout=0,starts=0;
 w.setTimeout=(fn,ms)=>{const id=++timeout;if(ms<100)setImmediate(fn);else longTimers.set(id,fn);return id;};w.clearTimeout=id=>longTimers.delete(id);w.setInterval=()=>1;w.clearInterval=()=>{};
 let values={gameState:'inGame',openEverythingMenuName:null,openInGameMenuName:null};const app={get:key=>values[key],set:next=>Object.assign(values,next)},menus={SETTINGS:'settings'};
 const pub={subscribe(name,fn){assert.equal(name,'chat');chat.add(fn);return fn;},unsubscribe(fn){chat.delete(fn);}},emit=text=>{for(const fn of chat)fn({content:text});};
 const popup={showCustomPopup(params){const close=()=>params.onClose?.();params.body(close);return {getResult:async()=>undefined};}};
 const noa={container:{},inputs:{},options:{creative:true,useInventory:true,canChange:true}},captured={singletons:{noa},getBloxd:()=>({getItemId:()=>1,client:{}})};
 w.__BLOXD_MOD_HOST__={observeDefinitions:()=>()=>{},onEngine:()=>()=>{}};w.__BLM_RUNTIME_LAYOUT__=()=>({scene:{getTransformMatrix(){}}});
 let code=adapted('adapter.js');if(oldMarker)code=code.replace("Object.defineProperty(event,'blmNativeCommand'", "native(event,'blmNativeCommand'");
 code=code.replace('  globalThis.__BLM_ADAPTER__ =', '  globalThis.adapterFixture={command,configure(v){captured=v.captured;app=v.app;menus=v.menus;pub=v.pub;popup=v.popup;}};\n  globalThis.__BLM_ADAPTER__ =');w.eval(code);w.adapterFixture.configure({captured,app,menus,pub,popup});
 // Install the actual Litematica capture-phase shortcut handler, in Place mode.
 w.localStorage.setItem('bloxd-litematica:settings:v4',JSON.stringify({mode:'place'}));w.eval(original('model.js'));w.eval(original('placement.js'));w.BLOXD_BLOCK_NAMES=['Stone'];w.BLOXD_BLOCK_IDS={1:'Stone'};w.__BLM_CREATE_RENDERER__=()=>({});w.__BLM_PLACE__={create:()=>({start(){starts++;}})};
 let ui=adapted('litematica.js');ui=ui.replace("  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();",'');w.eval(ui);
 doc.addEventListener('keydown',event=>{events.push(event);if(doc.activeElement!==input){input.focus();return;}if(!input.value)return;const text=input.value;input.value='';input.blur();commands.push(text);
  if(text==='//schematic load')popup.showCustomPopup({unlockPointerKey:'schematicLoaderPopup',body:()=>({props:{onChosenFile:async()=>{if(upload==='denied')emit('WorldBuilder: permission denied.');else if(upload==='foreign')emit('WorldBuilder: schematic foreign loaded.');else emit('WorldBuilder: schematic ours loaded.');}}})});
  else emit('WorldBuilder: pasted schematic successfully.');
 });
 return {w,commands,events,longTimers,emit,pub,app,get starts(){return starts;},get subscribers(){return chat.size;}};
}
test('Place native Enter keeps its marker through the mod host and reaches the native chat handler',async t=>{
 const h=nativeChat(t);await h.w.adapterFixture.command('//schematic load');assert.deepEqual(h.commands,['//schematic load']);assert.equal(h.starts,0);assert.ok(h.events.every(e=>e.blmNativeCommand===true));
});
test('The previous discovery no-op reproduces Place intercepting its own native Enter',async t=>{
 const h=nativeChat(t,{oldMarker:true});await assert.rejects(h.w.adapterFixture.command('//schematic load'),/Native chat did not (open|submit)/);assert.ok(h.starts>0);assert.equal(h.commands.length,0);
});
test('The real adapter loads a named clipboard before sending one native paste and releases listeners',async t=>{
 const h=nativeChat(t),session=h.w.__BLM_ADAPTER__.pasting();const result=await session.paste(new h.w.File(['fixture'],'ours.bloxdschem'),[-7,12,3],{clipboardName:'ours'});
 assert.equal(result.confirmed,true);assert.deepEqual(h.commands,['//schematic load','//paste -7 12 3']);assert.equal(h.starts,0);assert.equal(h.subscribers,0);assert.equal(h.longTimers.size,0);
});
test('A foreign clipboard acknowledgement cannot send a paste; timeout releases the operation',async t=>{
 const h=nativeChat(t,{upload:'foreign'}),promise=h.w.__BLM_ADAPTER__.pasting().paste(new h.w.File(['fixture'],'ours.bloxdschem'),[0,0,0],{clipboardName:'ours'}),rejected=assert.rejects(promise,/did not confirm a loaded clipboard/);
 for(let i=0;i<8;i++)await turn();assert.deepEqual(h.commands,['//schematic load']);assert.equal(h.subscribers,1);
 for(const fn of [...h.longTimers.values()])fn();await rejected;assert.equal(h.subscribers,0);assert.deepEqual(h.commands,['//schematic load']);
});
test('Native World Builder permission errors never proceed to paste',async t=>{
 const h=nativeChat(t,{upload:'denied'});await assert.rejects(h.w.__BLM_ADAPTER__.pasting().paste(new h.w.File(['fixture'],'ours.bloxdschem'),[0,0,0],{clipboardName:'ours'}),/permission denied/);assert.deepEqual(h.commands,['//schematic load']);assert.equal(h.subscribers,0);
});
test('Chat text, invalid commands, and unrelated menus are preserved by Place',async t=>{
 const h=nativeChat(t),input=h.w.document.querySelector('input');input.value='unfinished';await assert.rejects(h.w.adapterFixture.command('//schematic load'),/finish your chat message/);assert.equal(input.value,'unfinished');
 await assert.rejects(h.w.adapterFixture.command('/anything else'),/Invalid World Builder command/);assert.equal(h.w.__BLM_ADAPTER__.closeSettings(),false);assert.equal(h.commands.length,0);
});
function placeController({close=true}={}){
 let allowed=false,closed=0,pastes=0,sessionId={};const reports=[],callbacks=[];
 const ctx=vm.createContext({performance:{now:()=>0},TextEncoder,Uint8Array,File:class{constructor(_parts,name){this.name=name;}},setTimeout:fn=>callbacks.push(fn)});
 for(const name of ['placement.js','selection.js','place.js'])vm.runInContext(adapted(name),ctx);
 const model={format:'bloxd',name:'fixture',size:[1,1,1],offset:[0,0,0],counts:{'bloxd:1':1},nativeMapping:{'bloxd:1':'Stone'},blocks:[[0,0,0,'bloxd:1']]},plan={enabled:true,mode:'place',model,mapping:{'bloxd:1':'Stone'},options:{origin:[-5,10,3]}};
 const session={noa:sessionId,creative:()=>true,allowed:()=>allowed,expected:()=>1,paste:async()=>{pastes++;return {confirmed:true,message:'fixture'};}},adapter={connect:()=>({noa:sessionId}),pasting:()=>session,closeSettings(){closed++;if(close)allowed=true;return close;}};
 const controller=ctx.__BLM_PLACE__.create(adapter,()=>plan,text=>reports.push(text));return {controller,plan,callbacks,reports,get closed(){return closed;},get pastes(){return pastes;},allow(){allowed=true;},replaceWorld(){sessionId={};}};
}
test('The explicit paste button closes Settings once, prevents duplicates and finishes one paste',async()=>{
 const h=placeController(),first=h.controller.start({closeSettings:true});assert.equal(await h.controller.start({closeSettings:true}),false);assert.equal(await first,true);assert.equal(h.closed,1);assert.equal(h.pastes,1);assert.equal(h.controller.diagnostics().busy,false);
});
test('A failed Settings close and a changed world cannot paste through the button',async()=>{
 const denied=placeController({close:false});assert.equal(await denied.controller.start({closeSettings:true}),false);assert.equal(denied.pastes,0);
 const moved=placeController();moved.allow();const pending=moved.controller.start();moved.replaceWorld();assert.equal(await pending,false);assert.equal(moved.pastes,0);assert.equal(moved.controller.diagnostics().busy,false);
});
test('Crosshair changes update the tail of a large schematic within the same bounded scan',()=>{
 const target={x:0,y:0,z:0,name:'Stone',layer:0,faceMask:63},blocks=[...Array.from({length:20000},(_,i)=>({x:1000+i,y:0,z:0,name:'Stone',layer:0})),target],h=harness({blocks,actual:1});let value=1;
 h.connection.aim=()=>({position:[.5,.5,-4],direction:[0,0,1]});h.connection.read=(x)=>({loaded:true,actual:x===0?value:1});h.frame();assert.equal(target.status,'correct');const before=h.renderer.diagnostics().blockChecks;
 value=2;h.frame(50);assert.equal(target.status,'wrong');assert.ok(h.renderer.diagnostics().blockChecks-before<=1536);assert.ok(h.renderer.diagnostics().quads>0);h.renderer.destroy();
});
test('Fair mesh work completes multiple groups, coalesces stale jobs and keeps upload slices bounded',()=>{
 const rows=Array.from({length:1024},(_,i)=>({x:i%8+(i>=512?32:0),y:Math.floor(i%512/64),z:Math.floor(i/8)%8,name:'Stone',layer:0,faceMask:63,status:'wrong',actualName:'Dirt'})),h=harness({blocks:rows,actual:2,clockStep:.1});
 for(let i=0;i<250&&h.renderer.diagnostics().uploads<2;i++)h.frame(i*16);
 assert.equal(h.renderer.status(),'');assert.equal(h.renderer.diagnostics().uploads,2);assert.ok(h.gl.calls.filter(c=>c[0]==='bufferSubData').every(c=>c[3].byteLength<=262144));h.renderer.destroy();
});
test('Masked source chunks stay merged and release geometry when the view becomes empty',()=>{
 const blocks=[{x:0,y:0,z:0,name:'Stone',layer:0,faceMask:63,chunkKey:'source'},{x:16,y:0,z:0,name:'Stone',layer:0,faceMask:63,chunkKey:'source'}],h=harness({blocks});h.frame();assert.equal(h.renderer.diagnostics().groups,1);
 const before=h.gl.calls.filter(c=>c[0]==='deleteBuffer').length;h.setBlocks([]);h.frame(50);assert.equal(h.renderer.diagnostics().groups,0);assert.ok(h.gl.calls.filter(c=>c[0]==='deleteBuffer').length>before);h.renderer.destroy();
});
test('Reused chunk-view rows follow translation, rotation and negative coordinates',()=>{
 const ctx=vm.createContext({performance:{now:()=>0}});vm.runInContext(adapted('placement.js'),ctx);const view=ctx.BloxdSchem.createView({size:[2,1,1],selection:[0,0,0],chunks:[{x:0,y:0,z:0,nonAir:32768,data:Uint8Array.from([128,128,2,1])}]});
 const state={layerMode:'all',distance:128,maxRender:32768,showExtra:false},mapping={'bloxd:1':'Stone'},first=view.sample(mapping,{origin:[0,0,0]},[0,0,0],state),row=first[0],next=view.sample(mapping,{origin:[-8,3,7],rotation:90},[-8,3,7],state);
 assert.ok(next.includes(row));assert.deepEqual([row.x,row.y,row.z],[-8,3,7]);assert.equal(row.status,'unknown');
});
test('Priority references are bounded and camera relocation frees the old neighbourhood',()=>{
 const blocks=Array.from({length:70000},(_,i)=>({x:i%40-16,y:Math.floor(i/1600)%40-16,z:Math.floor(i/40)%40-16,name:'Stone',layer:0,status:'correct'})),h=harness({blocks,actual:1});h.frame();assert.equal(h.renderer.diagnostics().priorityRows,65536);assert.equal(h.renderer.diagnostics().priorityIndexPending,false);
 h.camera[0]=1000;h.frame(50);assert.equal(h.renderer.diagnostics().priorityRows,0);assert.equal(h.renderer.status(),'');h.renderer.destroy();
});
test('Blue/red/pink changes and removals repeatedly replace the overlay without accumulating buffers',()=>{
 const block={x:0,y:0,z:0,name:'Stone',layer:0,faceMask:63},h=harness({blocks:[block]});h.connection.aim=()=>({position:[.5,.5,-2],direction:[0,0,1]});
 for(let i=0;i<32;i++){const actual=i%4;h.setActual(actual);h.frame(i*50);assert.equal(block.status,actual===0?'missing':actual===1?'correct':'wrong');assert.equal(h.renderer.diagnostics().quads,actual===1?0:6);}
 const extra={x:0,y:0,z:0,name:'Air',layer:0,expectedAir:true,faceMask:63};h.setBlocks([extra]);h.setActual(2);h.frame(1600);assert.equal(extra.status,'extra');h.setActual(0);h.frame(1650);assert.equal(extra.status,'air');assert.equal(h.renderer.diagnostics().quads,0);
 h.renderer.destroy();const created=h.gl.calls.filter(c=>c[0]==='createBuffer').length,deleted=h.gl.calls.filter(c=>c[0]==='deleteBuffer').length;assert.equal(deleted,created);
});
test('Place and interaction sources retain the original snapshot hash gate',()=>{
 for(const name of ['place.js','adapter.js','placement.js'])assert.throws(()=>managedSource('bloxd-litematica',name,original(name)+'\n'),/does not match/);
});
test('An upload exception frees the pending mesh and retries while preserving the last committed buffer',()=>{
 const h=harness({actual:2});h.frame();const committed=h.renderer.diagnostics().uploads,originalUpload=h.gl.bufferSubData;h.setActual(0);h.gl.bufferSubData=()=>{throw Error('synthetic upload failure');};h.frame(50);
 assert.equal(h.renderer.diagnostics().uploads,committed);assert.match(h.renderer.status(),/synthetic upload failure/);const deleted=h.gl.calls.filter(c=>c[0]==='deleteBuffer').length;
 h.gl.bufferSubData=originalUpload;h.frame(100);assert.equal(h.renderer.status(),'');assert.equal(h.renderer.diagnostics().uploads,committed+1);assert.ok(h.gl.calls.filter(c=>c[0]==='deleteBuffer').length>deleted);h.renderer.destroy();
});
