'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{menu,sample}=require('./litematica-menu-fixture.cjs');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const select=h=>h.page.querySelector('select[aria-label="Schematics"]');
const control=h=>select(h).nextElementSibling.querySelector('[role="combobox"]');
const actions=h=>Object.fromEntries([...h.page.querySelectorAll('.blm-file-actions button')].map(button=>[button.textContent,button]));
function choose(h,value){select(h).value=value;select(h).dispatchEvent(new h.w.Event('change'));select(h).blmRefresh();}
const savedEntry=(id='saved',name='Stored')=>({id,model:sample(name),mapping:{'bloxd:1':'Stone','bloxd:2':'Dirt'},placement:{x:4,y:5,z:6,rotation:90}});
async function importNative(h,name='Imported',filename=name+'.bloxdschem'){
 const box=h.w.__BLM_SELECTION__.bounds([0,0,0],[0,0,0]),scan=await h.w.__BLM_SELECTION__.scan(()=>({loaded:true,actual:1}),box,{resolveId:()=> 'Stone'}),bytes=h.w.__BLM_SELECTION__.encode(scan,name);
 h.w.__BLM_READ_FILE__=async()=>bytes;return h.ui.importFile({name:filename,size:bytes.length});
}

test('Schematic selection starts empty; stored choices enable only Load and Remove until explicitly loaded',async t=>{
 const h=menu(t,{savedSchematics:[savedEntry()],nativeCss:require('./fixtures/native-bloxd-ui-2026-10-23.json').css});await turn();
 assert.equal(control(h).textContent,'Select Schematic');assert.equal(h.w.getComputedStyle(control(h).querySelector('.Dropdown-placeholder')).width,'100%');assert.equal(select(h).value,'');for(const key of ['Load','Save','Remove'])assert.equal(actions(h)[key].disabled,true,key);
 const root=select(h).nextElementSibling;control(h).click();const option=[...root.querySelectorAll('[role="option"]')].find(option=>option.querySelector('.blm-schematic-name')?.textContent==='Stored');assert.ok(option);assert.equal(option.querySelector('.blm-schematic-status').textContent,'Saved');assert.ok(option.querySelector('.blm-schematic-status svg'));
 option.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Enter',bubbles:true,cancelable:true}));assert.equal(h.ui.model,null);assert.equal(actions(h).Load.disabled,false);assert.equal(actions(h).Remove.disabled,false);assert.equal(actions(h).Save.disabled,true);assert.equal(control(h).querySelector('.blm-schematic-status').textContent,'Saved');
 actions(h).Load.click();assert.equal(h.ui.model.name,'Stored');assert.equal(h.field('x').value,'4');assert.equal(actions(h).Save.disabled,false);h.ui.change('x',27);await h.ui.saveCurrent();assert.equal(h.library.size,1);assert.equal(h.library.get('saved').placement.x,27);assert.deepEqual(h.errors,[]);
});

test('New imports select their Not saved entry immediately; Save marks the same selection Saved and survives page recreation',async t=>{
 const h=menu(t,{nativeCss:require('./fixtures/native-bloxd-ui-2026-10-23.json').css});await turn();await importNative(h);const unsaved=select(h).value;
 assert.ok(unsaved);assert.equal(control(h).querySelector('.blm-schematic-name').textContent,'Imported');assert.equal(control(h).querySelector('.blm-schematic-status').textContent,'Not saved');assert.ok(control(h).querySelector('.blm-schematic-status svg'));assert.equal(h.library.size,0);
 // Native styles are installed before adapter execution, as in production.
 assert.equal(h.w.getComputedStyle(control(h).querySelector('.Dropdown-placeholder')).width,'100%');assert.equal(h.w.getComputedStyle(control(h).querySelector('.blm-schematic-name')).textOverflow,'ellipsis');assert.equal(h.w.getComputedStyle(control(h).querySelector('.blm-schematic-status')).marginLeft,'auto');
 for(const key of ['Load','Save','Remove']){assert.equal(actions(h)[key].hidden,false,key);assert.equal(actions(h)[key].disabled,false,key);}
 const help=h.page.querySelector('.blm-menu-section .blm-help-button'),tip=h.w.document.getElementById(help.getAttribute('aria-describedby'));help.click();assert.match(tip.textContent,/Not saved.*deleted when the page reloads unless you save it/);
 h.ui.change('x',19);assert.equal(await h.ui.saveCurrent(),true);assert.notEqual(select(h).value,unsaved);assert.equal(h.library.size,1);assert.equal(control(h).querySelector('.blm-schematic-status').textContent,'Saved');assert.equal([...select(h).options].filter(option=>option.dataset.saveState==='unsaved').length,0);assert.equal([...h.library.values()][0].placement.x,19);
 const recreated=menu(t,{savedSchematics:[...h.library.values()]});await turn();assert.equal(control(recreated).textContent,'Select Schematic');assert.equal(recreated.ui.model,null);assert.equal([...select(recreated).options].filter(option=>option.dataset.saveState==='saved').length,1);assert.deepEqual(h.errors,[]);
});

test('Selecting a different saved entry cannot save the previously loaded model over that choice; shared Paste controls agree',async t=>{
 const h=menu(t,{savedSchematics:[savedEntry()]});await turn();await importNative(h,'Draft');const draft=select(h).value;choose(h,'saved');assert.equal(actions(h).Save.disabled,true);assert.equal(h.ui.model.name,'Draft');actions(h).Save.click();await turn();assert.equal(h.storageCalls.filter(call=>call.action==='put').length,0);
 h.tab('place');assert.equal(actions(h).Paste.disabled,false);assert.equal(actions(h).Save.disabled,true);choose(h,draft);assert.equal(actions(h).Save.disabled,false);assert.equal(control(h).querySelector('.blm-schematic-status').textContent,'Not saved');actions(h).Paste.click();assert.equal(h.pastes,1);assert.equal(h.ui.model.name,'Draft');assert.deepEqual(h.errors,[]);
});

test('Automatic save follows Hide checked, persists its opt-in, and saves only successful new imports',async t=>{
 const h=menu(t);await turn();assert.equal(h.field('autoSaveSchematics').checked,false);const row=h.field('autoSaveSchematics').closest('.SettingBox');assert.equal(h.field('hideChecked').closest('.SettingBox').nextElementSibling,row);assert.match(row.querySelector('.CheckboxText').textContent,/Automatically save new schematics/);row.click();assert.equal(h.field('autoSaveSchematics').checked,true);assert.equal(JSON.parse(h.w.localStorage.getItem('bloxd-litematica:settings:v4')).autoSaveSchematics,true);
 await importNative(h,'Automatic');assert.equal(h.library.size,1);assert.equal(control(h).querySelector('.blm-schematic-status').textContent,'Saved');const id=select(h).value;h.ui.loadMenuSchematic();await turn();assert.equal(h.library.size,1);assert.equal(select(h).value,id);
 assert.equal(actions(h).Save.disabled,true);h.tab('place');assert.equal(actions(h).Save.disabled,true);h.ui.change('autoSaveSchematics',false);assert.equal(actions(h).Save.disabled,false);h.ui.change('autoSaveSchematics',true);assert.equal(actions(h).Save.disabled,true);
 await h.ui.importFile({name:'bad.txt',size:1});assert.equal(h.library.size,1);assert.equal(h.storageCalls.filter(call=>call.action==='put').length,1);
 const restored=menu(t,{saved:JSON.parse(h.w.localStorage.getItem('bloxd-litematica:settings:v4'))});assert.equal(restored.field('autoSaveSchematics').checked,true);assert.deepEqual(h.errors,[]);
});

test('Failed saves and a full library retain truthful Not saved status and allow retry without losing the active model',async t=>{
 const h=menu(t,{saved:{autoSaveSchematics:true}});await turn();h.setStorageHook(action=>{if(action==='put')throw Error('Quota exceeded');});await importNative(h,'Retry');assert.equal(h.library.size,0);assert.equal(control(h).querySelector('.blm-schematic-status').textContent,'Not saved');assert.match(h.page.querySelector('.blm-notice').textContent,/Save failed/);assert.equal(actions(h).Save.disabled,false);h.setStorageHook(null);assert.equal(await h.ui.saveCurrent(),true);assert.equal(control(h).querySelector('.blm-schematic-status').textContent,'Saved');
 const full=menu(t,{saved:{autoSaveSchematics:true},savedSchematics:Array.from({length:8},(_,i)=>savedEntry('stored-'+i,'Stored '+i))});await turn();await importNative(full,'Overflow');assert.equal(full.library.size,8);assert.equal(control(full).querySelector('.blm-schematic-status').textContent,'Not saved');assert.match(full.page.querySelector('.blm-notice').textContent,/Library full/);assert.equal(full.storageCalls.filter(call=>call.action==='put').length,0);assert.equal(full.ui.model.name,'Overflow');assert.deepEqual(full.errors,[]);
});

test('Delayed saves cannot steal a newer import selection; repeat Save is coalesced and the new model remains unsaved',async t=>{
 const h=menu(t);await turn();await importNative(h,'First');let release;const wait=new Promise(resolve=>release=resolve);h.setStorageHook(action=>action==='put'?wait:undefined);const first=h.ui.saveCurrent(),again=h.ui.saveCurrent();assert.equal(first,again);assert.equal(actions(h).Save.disabled,true);await turn();
 await importNative(h,'Second');assert.equal(control(h).querySelector('.blm-schematic-name').textContent,'Second');control(h).click();assert.ok(select(h).nextElementSibling.querySelector('[role="listbox"]'));release();assert.equal(await first,true);assert.equal(select(h).nextElementSibling.querySelector('[role="listbox"]'),null);assert.equal(h.library.size,1);assert.equal(h.ui.model.name,'Second');assert.equal(control(h).querySelector('.blm-schematic-name').textContent,'Second');assert.equal(control(h).querySelector('.blm-schematic-status').textContent,'Not saved');assert.equal(actions(h).Save.disabled,false);assert.equal(h.storageCalls.filter(call=>call.action==='put').length,1);
 h.setStorageHook(null);await h.ui.saveCurrent();assert.equal(h.library.size,2);assert.equal(control(h).querySelector('.blm-schematic-status').textContent,'Saved');assert.deepEqual(h.errors,[]);
});

test('Removing a selected saved entry preserves a different active import; removing the import does not delete storage',async t=>{
 const h=menu(t,{savedSchematics:[savedEntry()]});await turn();await importNative(h,'Keep');choose(h,'saved');actions(h).Remove.click();await turn();assert.equal(h.library.size,0);assert.equal(h.ui.model.name,'Keep');assert.equal(control(h).querySelector('.blm-schematic-status').textContent,'Not saved');actions(h).Remove.click();await turn();assert.equal(h.ui.model,null);assert.equal(control(h).textContent,'Select Schematic');assert.equal(h.storageCalls.filter(call=>call.action==='delete').length,1);for(const key of ['Load','Save','Remove'])assert.equal(actions(h)[key].disabled,true);
 const reloaded=menu(t,{savedSchematics:[...h.library.values()]});await turn();assert.equal(reloaded.ui.model,null);assert.equal(control(reloaded).textContent,'Select Schematic');assert.deepEqual(h.errors,[]);
});

test('Import uses the exact filename stem rather than embedded name; statuses are colored and the control reserves only arrow space',async t=>{
 const h=menu(t,{nativeCss:require('./fixtures/native-bloxd-ui-2026-10-23.json').css});await turn();await importNative(h,'Selection','My Stash.v2.BLOXDSCHEM');assert.equal(h.ui.model.name,'My Stash.v2');assert.equal(control(h).querySelector('.blm-schematic-name').textContent,'My Stash.v2');assert.equal(h.w.getComputedStyle(control(h)).paddingRight,'2.5rem');
 let status=control(h).querySelector('.blm-schematic-status');assert.equal(h.w.getComputedStyle(status).color,'rgb(255, 112, 112)');assert.equal(status.querySelector('path').getAttribute('stroke'),'currentColor');await h.ui.saveCurrent();status=control(h).querySelector('.blm-schematic-status');assert.equal(h.w.getComputedStyle(status).color,'rgb(99, 212, 113)');assert.equal([...h.library.values()][0].model.name,'My Stash.v2');control(h).click();const row=select(h).nextElementSibling.querySelector('[role="option"] .blm-schematic-status');assert.equal(h.w.getComputedStyle(row).color,'rgb(99, 212, 113)');assert.deepEqual(h.errors,[]);
});
