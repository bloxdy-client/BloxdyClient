'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{menu,sample}=require('./litematica-menu-fixture.cjs'),{harness,original}=require('./litematica-runtime-fixture.cjs'),{managedSource}=require('../adapters.cjs');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const visible=node=>!node.closest('[hidden]');
test('HUD requires an actual session and game chat surface, and hides again after leaving in Build and Save area',t=>{
 const h=menu(t),stub=h.w.__BLM_ADAPTER__,engine={container:{},inputs:{}},client={msgHandler:{},engine};h.w.__testSession={singletons:{engine,bloxd:{client}}};
 h.w.__BLOXD_MOD_HOST__={observeDefinitions:()=>()=>{},onEngine:()=>()=>{}};h.w.eval(managedSource('bloxd-litematica','adapter.js',original('adapter.js')).replace('let captured = null','let captured = globalThis.__testSession'));const real=h.w.__BLM_ADAPTER__;h.w.__BLM_ADAPTER__=stub;stub.inGame=()=>real.inGame();h.ui.setModel(sample());const hud=h.w.document.getElementById('blm-hud');assert.equal(hud.hidden,true);
 const chat=h.w.document.createElement('div');chat.className='ChatInput';h.w.document.body.append(chat);h.ui.refresh();assert.equal(hud.hidden,false);chat.remove();h.ui.refresh();assert.equal(hud.hidden,true);h.w.document.body.append(chat);client.gameReplayer={recording:{}};h.ui.refresh();assert.equal(hud.hidden,true);delete client.gameReplayer;
 h.tab('select');h.ui.change('ax',0);h.ui.change('aSet',true);h.ui.change('bSet',true);h.ui.refresh();assert.equal(hud.hidden,false);client.msgHandler=null;h.ui.refresh();assert.equal(hud.hidden,true);assert.deepEqual(h.errors,[]);
});
test('The agreed Build, Save area and Paste layouts share just Materials and Settings',async t=>{
 const h=menu(t);await turn();assert.deepEqual(h.errors,[]);
 assert.deepEqual([...h.page.querySelectorAll('[data-blm-mode]')].map(n=>n.textContent),['Build','Save area','Paste']);
 assert.deepEqual([...h.page.querySelectorAll('.ControlsSectionTitle')].map(n=>n.textContent),['Materials','Settings']);
 for(const title of ['Materials','Settings'])assert.equal(h.group(title).querySelector('.ControlsSectionRows').hidden,true);
 assert.equal(visible(h.field('ezBuilding')),true);assert.equal(visible(h.field('ax')),false);assert.equal(visible(h.field('preview')),false);
 h.tab('select');assert.equal(visible(h.field('selectionName')),true);assert.equal(visible(h.field('ax')),true);assert.equal(visible(h.field('x')),false);assert.equal(visible(h.group('Settings')),true);
 h.tab('place');assert.equal(visible(h.field('preview')),true);assert.equal(visible(h.field('ezBuilding')),false);assert.equal(visible(h.field('placementLocked')),false);
 assert.ok([...h.page.querySelectorAll('.blm-help-tip')].every(n=>n.hidden));assert.equal(h.page.querySelector('.blm-legend'),null);assert.equal(h.page.querySelector('.blm-notice').hidden,true);
 assert.equal(h.page.querySelector('[aria-label="Close Litematica"]'),null);assert.equal(h.page.querySelector('[aria-label="Rotate left"],[aria-label="Rotate right"]'),null);
});
test('Every placement and corner coordinate has one left +1 / right -1 button, bounded and isolated',async t=>{
 const h=menu(t);for(const name of ['x','y','z','ax','ay','az','bx','by','bz']){
  if(name.length===2)h.tab('select');const input=h.field(name),step=input.nextElementSibling,before=h.w.__BLOXD_LITEMATICA__.diagnostics().settings[name];assert.equal(step.textContent,'+/−');step.click();assert.equal(Number(input.value),before+1);
  const event=new h.w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2});step.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(Number(input.value),before);
 }
 h.tab('build');h.ui.change('x',1000000);h.field('x').nextElementSibling.click();assert.equal(Number(h.field('x').value),1000000);
 h.ui.change('x',-1000000);h.field('x').nextElementSibling.dispatchEvent(new h.w.MouseEvent('contextmenu',{bubbles:true,cancelable:true}));assert.equal(Number(h.field('x').value),-1000000);assert.deepEqual(h.errors,[]);
});
test('Placement locking blocks coordinate buttons, text, rotation and Move to player',t=>{
 const h=menu(t);h.ui.setModel(sample());h.ui.change('placementLocked',true);const before=h.w.__BLOXD_LITEMATICA__.diagnostics().settings;
 assert.equal(h.field('x').disabled,true);assert.equal(h.field('x').nextElementSibling.disabled,true);assert.equal(h.field('rotation').disabled,true);
 assert.equal(h.ui.change('x',99),false);assert.equal(h.ui.change('rotation',90),false);assert.equal(h.w.__BLOXD_LITEMATICA__.diagnostics().settings.x,before.x);
 h.ui.change('placementLocked',false);h.field('rotation').value='270';h.field('rotation').dispatchEvent(new h.w.Event('change',{bubbles:true}));assert.equal(h.w.__BLOXD_LITEMATICA__.diagnostics().settings.rotation,270);
});
test('Automatic layer advance is only editable in Single layer and the chosen layer stays bounded',t=>{
 const h=menu(t);h.ui.setModel(sample());assert.equal(h.field('autoLayer').disabled,true);assert.equal(h.ui.change('autoLayer',true),false);
 h.ui.change('layerMode','single');assert.equal(h.field('autoLayer').disabled,false);assert.equal(h.ui.change('autoLayer',true),true);h.ui.change('layer',1);assert.equal(h.field('layer').max,'1');
 h.ui.change('layerMode','all');assert.equal(h.field('autoLayer').disabled,true);assert.equal(visible(h.field('layer')),false);
});
test('Question-mark help works with focus, click and Escape without toggling its setting, and leaves no detached popup',t=>{
 const h=menu(t),field=h.field('ezBuilding'),button=field.closest('.SettingBox').querySelector('.blm-help-button'),id=button.getAttribute('aria-describedby'),tooltip=h.w.document.getElementById(id);
 button.focus();assert.equal(tooltip.hidden,false);assert.equal(tooltip.parentNode,h.w.document.querySelector('.WholeAppWrapperInner'));assert.equal(tooltip.classList.contains('tooltip-container'),true);button.click();assert.equal(tooltip.hidden,false);assert.equal(h.w.__BLOXD_LITEMATICA__.diagnostics().settings.ezBuilding,false);
 button.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Escape',bubbles:true,cancelable:true}));assert.equal(tooltip.hidden,true);assert.equal(button.getAttribute('aria-expanded'),'false');
 button.click();h.tab('select');assert.equal(tooltip.hidden,true);assert.notEqual(tooltip.parentNode,h.w.document.body);assert.deepEqual(h.errors,[]);
});
test('Material checks move rows to the faded Checked table, preserve current-placement counts and Reset restores them',t=>{
 const h=menu(t);h.ui.setModel(sample());const group=h.group('Materials');group.querySelector('.ControlsSectionHeader').click();
 h.renders.onStats({totals:{correct:1,missing:1,wrong:0,extra:0,unknown:1,total:3},materials:{Stone:{total:2,remaining:1,unknown:0},Dirt:{total:1,remaining:0,unknown:1}}});
 const tables=()=>[...group.querySelectorAll('table')];assert.deepEqual([...tables()[0].querySelectorAll('th')].map(n=>n.childNodes[0].textContent),['Material','Total','Missing','Inventory','Check']);
 assert.deepEqual([...tables()[0].querySelector('tr[data-blm-material="Stone"]').querySelectorAll('td')].slice(0,4).map(n=>n.textContent),['Stone','2','1','8']);
 assert.equal(tables()[0].querySelector('tr[data-blm-material="Dirt"] td:nth-child(3)').textContent,'≥0');
 group.querySelector('[aria-label="Check Stone"]').click();assert.deepEqual(Array.from(h.ui.checked),['Stone']);assert.equal(tables()[0].querySelector('[data-blm-material="Stone"]'),null);assert.equal(tables()[1].querySelector('[data-blm-material="Stone"]').className,'blm-checked-material');
 h.tab('place');assert.ok(tables()[1].querySelector('[data-blm-material="Stone"]'));[...group.querySelectorAll('button')].find(n=>n.textContent==='Reset materials').click();assert.equal(h.ui.checked.length,0);assert.ok(tables()[0].querySelector('[data-blm-material="Stone"]'));
 h.tab('select');h.ui.setArea({materials:[{name:'Dirt',count:10}]});assert.deepEqual([...tables()[0].querySelectorAll('th')].map(n=>n.childNodes[0].textContent),['Material','Total','Check']);assert.deepEqual(h.errors,[]);
});
test('Unchanged material snapshots retain their DOM and unavailable / unlimited inventory is truthful',t=>{
 const h=menu(t);h.ui.setModel(sample());h.group('Materials').querySelector('.ControlsSectionHeader').click();const stats={totals:{total:3,correct:0,missing:0,wrong:0,extra:0,unknown:3},materials:{Stone:{total:2,remaining:0,unknown:2}}};
 h.setInventory(null);h.renders.onStats(stats);const row=h.group('Materials').querySelector('[data-blm-material="Stone"]');assert.equal(row.children[3].textContent,'—');h.renders.onStats(stats);assert.equal(h.group('Materials').querySelector('[data-blm-material="Stone"]'),row);
 h.setInventory({items:[{name:'Stone|variant',amount:-1}]});h.renders.onStats(stats);assert.equal(h.group('Materials').querySelector('[data-blm-material="Stone"]').children[3].textContent,'∞');
});
test('Load and Paste honor explicit library selection while keeping edited placement coordinates',async t=>{
 const h=menu(t);await turn();h.library.set('saved',{id:'saved',model:sample('Saved'),mapping:{'bloxd:1':'Stone','bloxd:2':'Dirt'},placement:{x:4,y:5,z:6,rotation:90}});await h.ui.reloadLibrary();h.ui.updateLibrary('saved');
 const load=[...h.page.querySelectorAll('button')].find(n=>n.textContent==='Load');load.click();assert.equal(h.ui.model.name,'Saved');assert.equal(Number(h.field('x').value),4);h.ui.change('x',11);
 h.tab('place');[...h.page.querySelectorAll('.blm-menu-section .blm-actions button')].find(n=>n.textContent==='Paste').click();assert.equal(h.pastes,1);assert.equal(h.renders.lastPaste.closeSettings,true);assert.equal(Number(h.field('x').value),11);h.ui.refresh();assert.equal(h.page.querySelector('.blm-paste-progress').hidden,false);assert.ok([...h.page.querySelectorAll('button')].some(n=>n.textContent==='Cancel'&&!n.hidden));assert.deepEqual(h.errors,[]);
});
test('A click on the drop area opens the picker; a real encoded native file imports and Remove clears it',async t=>{
 const h=menu(t);h.page.querySelector('.blm-drop-zone').click();assert.equal(h.picked,1);
 const box=h.w.__BLM_SELECTION__.bounds([0,0,0],[0,0,0]),result=await h.w.__BLM_SELECTION__.scan(()=>({loaded:true,actual:1}),box,{resolveId:()=> 'Stone'}),bytes=h.w.__BLM_SELECTION__.encode(result,'Fixture');
 h.w.__BLM_READ_FILE__=async()=>bytes;await h.ui.importFile({name:'Fixture.bloxdschem',size:bytes.length});assert.equal(h.ui.model.name,'Fixture');assert.equal(h.w.__BLOXD_LITEMATICA__.diagnostics().import.phase,'loaded');
 [...h.page.querySelectorAll('.blm-actions button')].find(n=>n.textContent==='Remove').click();await turn();assert.equal(h.ui.model,null);assert.equal(h.renders.rows().length,0);assert.deepEqual(h.errors,[]);
});
test('Sliders keep their native keyboard controls and expose the exact requested labels and percentages',t=>{
 const h=menu(t);h.group('Settings').querySelector('.ControlsSectionHeader').click();
 for(const [name,label]of [['distance','Render Distance'],['placementTransparency','Placement transparency'],['lineWidth','Outline width'],['missingTint','Missing block tint'],['wrongTint','Wrong blocks tint'],['extraTint','Extra blocks tint']]){
  const input=h.field(name),row=input.closest('.SettingBox'),handle=row.querySelector('[role="slider"]');assert.equal(handle.getAttribute('aria-label'),label);assert.ok(row.querySelector('.blm-help-button'));handle.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'End',bubbles:true,cancelable:true}));assert.equal(Number(input.value),Number(input.max));
 }
 assert.equal(h.field('placementTransparency').closest('.SettingBox').querySelector('output').textContent,'100%');assert.deepEqual(h.errors,[]);
});
test('Hide checked blocks changes only the preview geometry and Show preview stops capture without unloading',()=>{
 const h=harness({blocks:[{x:0,y:0,z:0,name:'Stone',layer:0,faceMask:63}],actual:0});h.state.checkedMaterials=new Set(['Stone']);h.state.hideChecked=true;h.frame();assert.equal(h.renderer.diagnostics().quads,0);assert.equal(h.renderer.diagnostics().indexedRows,1);
 h.state.hideChecked=false;h.renderer.invalidate(true);h.frame(50);assert.equal(h.renderer.diagnostics().quads,6);
 h.state.preview=false;const before=h.gl.calls.filter(c=>c[0]==='drawArrays').length;h.frame(100);assert.equal(h.gl.calls.filter(c=>c[0]==='drawArrays').length,before);h.renderer.destroy();
});
test('The new menu and preview adapter still reject any modification of the original pinned mod bytes',()=>{
 for(const name of ['litematica.js','renderer.js'])assert.throws(()=>managedSource('bloxd-litematica',name,original(name)+'\n'),/does not match/);
});
test('Paste preview visibility does not leave Build without a preview, and hidden checked state does not consume classification rows',t=>{
 const h=menu(t);h.ui.setModel(sample());h.tab('place');h.ui.change('preview',false);assert.equal(h.renders.state().preview,false);h.tab('build');assert.equal(h.renders.state().preview,true);h.tab('place');assert.equal(h.renders.state().preview,false);
});
test('Rotation uses the same native dropdown as Schematics, with exactly four angles and a guarded lock',t=>{
 const h=menu(t),select=h.field('rotation'),root=select.nextElementSibling,control=root.querySelector('[role="combobox"]'),schematics=h.page.querySelector('[aria-label="Schematics"][role="combobox"]');
 assert.equal(control.className,schematics.className);assert.deepEqual([...select.options].map(option=>[option.value,option.textContent]),[['0','0°'],['90','90°'],['180','180°'],['270','270°']]);
 for(const angle of [90,180,270,0]){control.click();const option=[...root.querySelectorAll('[role="option"]')].find(option=>option.textContent===angle+'°');option.dispatchEvent(new h.w.MouseEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));assert.equal(h.w.__BLOXD_LITEMATICA__.diagnostics().settings.rotation,angle);assert.equal(control.querySelector('.Dropdown-placeholder').textContent,angle+'°');}
 h.ui.change('placementLocked',true);assert.equal(control.getAttribute('aria-disabled'),'true');control.click();assert.equal(root.querySelector('[role="listbox"]'),null);h.tab('place');assert.equal(control.getAttribute('aria-disabled'),'true');assert.deepEqual(h.errors,[]);
});
test('The native texture-pack upload component retains click, keyboard, nested drag and active file states',t=>{
 const h=menu(t),drop=h.page.querySelector('.CustomTexturePackContainer>.CustomTextureFolderUpload'),icon=drop.querySelector('.CustomTextureFolderUploadIcon'),text=drop.querySelector('.CustomTextureFolderUploadInstructions');assert.ok(drop);assert.equal(drop.classList.contains('NewButton'),false);assert.equal(drop.querySelector('.ButtonBody'),null);
 const reference=require('./fixtures/native-bloxd-ui-2026-10-23.json');assert.equal(icon.querySelector('path').getAttribute('d'),reference.icons['up-from-bracket'].path);drop.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Enter',bubbles:true,cancelable:true}));drop.click();assert.equal(h.picked,2);
 h.ui.setModel(sample());assert.equal(icon.classList.contains('Active'),true);assert.equal(text.textContent,'House');assert.equal(icon.querySelector('path').getAttribute('d'),reference.icons['file-lines'].path);
 for(let i=0;i<2;i++)drop.dispatchEvent(new h.w.Event('dragenter',{bubbles:true,cancelable:true}));assert.equal(drop.classList.contains('ActiveDrag'),true);assert.equal(icon.classList.contains('Active'),false);assert.match(text.textContent,/Drag and drop/);
 drop.dispatchEvent(new h.w.Event('dragleave',{bubbles:true,cancelable:true}));assert.equal(drop.classList.contains('ActiveDrag'),true);drop.dispatchEvent(new h.w.Event('dragleave',{bubbles:true,cancelable:true}));assert.equal(drop.classList.contains('ActiveDrag'),false);assert.equal(icon.classList.contains('Active'),true);assert.deepEqual(h.errors,[]);
});
test('Bloxd source CSS owns upload metrics, input chrome, button bevels, checkbox and slider appearance',t=>{
 const h=menu(t),reference=require('./fixtures/native-bloxd-ui-2026-10-23.json'),style=h.w.document.createElement('style');style.textContent=reference.css;h.w.document.head.append(style);
 const panel=h.w.document.createElement('div');panel.className='SettingsMenuRightInner';panel.innerHTML='<div class="CustomTexturePackContainer"><div class="CustomTextureFolderUpload"><div class="CustomTextureFolderUploadIcon"></div><div class="CustomTextureFolderUploadInstructions"></div></div></div><button class="NewButton BlueButton"><div class="ButtonBody">Native</div></button><div class="Dropdown-control BloxdDropdownControl SmallTextLight"></div><span class="rc-checkbox rc-checkbox-checked"><span class="rc-checkbox-inner"></span></span><div class="rangeslider-horizontal"><div class="rangeslider__fill"></div><div class="rangeslider__handle"></div></div>';
 const nativeNumber=h.w.document.createElement('input');nativeNumber.type='number';nativeNumber.className='TextInput';panel.append(nativeNumber);panel.querySelector('.rangeslider-horizontal').classList.add('rangeslider');h.page.parentNode.append(panel);const pairs=[
  [h.page,panel,['padding','max-width']],
  [h.page.querySelector('.CustomTexturePackContainer'),panel.querySelector('.CustomTexturePackContainer'),['border']],
  [h.page.querySelector('.CustomTextureFolderUpload'),panel.querySelector('.CustomTextureFolderUpload'),['height','padding','gap','display','flex-direction']],
  [h.page.querySelector('.CustomTextureFolderUploadIcon'),panel.querySelector('.CustomTextureFolderUploadIcon'),['font-size','opacity']],
  [h.page.querySelector('.blm-coordinate-step'),panel.querySelector('.BlueButton'),['background-color','border','box-shadow','--buttonNormalColour','--buttonTopColour']],
  [h.page.querySelector('.blm-coordinate-step .ButtonBody'),panel.querySelector('.ButtonBody'),['padding']],
  [h.page.querySelector('[aria-label="Rotation"][role="combobox"]'),panel.querySelector('.BloxdDropdownControl'),['background-color','border','border-radius','padding-right']],
  [h.field('x'),nativeNumber,['background','border','box-shadow']],
  [h.page.querySelector('.rc-checkbox-checked .rc-checkbox-inner'),panel.querySelector('.rc-checkbox-inner'),['background-color','border-color']],
  [h.page.querySelector('.rangeslider__fill'),panel.querySelector('.rangeslider__fill'),['background-color']],
  [h.page.querySelector('.rangeslider__handle'),panel.querySelector('.rangeslider__handle'),['background-color','border','width','height']]
 ];for(const [actual,native,properties]of pairs){assert.ok(actual);for(const property of properties)assert.equal(h.w.getComputedStyle(actual).getPropertyValue(property),h.w.getComputedStyle(native).getPropertyValue(property),actual.className+' / '+property);}
 assert.equal(h.w.getComputedStyle(h.page.querySelector('.CustomTextureFolderUpload')).height,'8rem');assert.equal(h.page.querySelector('.blm-coordinate-step').style.getPropertyValue('--buttonNormalColour'),'');assert.ok([...h.page.querySelectorAll('.blm-help-button path')].every(path=>path.getAttribute('d')===reference.icons['circle-info'].path));assert.deepEqual(h.errors,[]);
});
test('Annotated layout follows Shader controls and retains the same shared elements across Build, Paste and Save area',t=>{
 const h=menu(t),fs=require('node:fs'),path=require('node:path'),pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/bloxd-visual-shader-5.6.14.2.bnmod'))),file=pack.files.find(file=>file.path==='shader.js'),shader=managedSource('bloxd-visual-shader','shader.js',Buffer.from(file.data,'base64').toString()),categoryCSS=/categoryStyle.textContent = '([^']+)'/.exec(shader)?.[1],inputHeight=/--h:([\d.]+rem);/.exec(shader)?.[1];assert.ok(categoryCSS&&inputHeight);
 const style=h.w.document.createElement('style');style.textContent=categoryCSS;h.w.document.head.append(style);const reference=h.w.document.createElement('div');reference.className='ControlsSection bvfx-category';reference.innerHTML='<div class="ControlsSectionHeader"><div class="ControlsSectionTitle">Shader</div><div class="ControlsSectionChevron">▸</div></div><div class="ControlsSectionRows"></div>';h.page.append(reference);
 const enabled=h.field('enabled');assert.equal(enabled.closest('.SettingBox'),h.page.firstElementChild);assert.match(enabled.closest('.SettingBox').querySelector('.CheckboxText').textContent,/Litematica enabled/);assert.equal(h.page.querySelector('.blm-menu-header'),null);
 for(const title of ['Materials','Settings']){const group=h.group(title),header=group.querySelector('.ControlsSectionHeader');assert.equal(header.classList.contains('SettingBox'),false);for(const property of ['padding','color'])assert.equal(h.w.getComputedStyle(header).getPropertyValue(property),h.w.getComputedStyle(reference.firstElementChild).getPropertyValue(property),title+' '+property);
  header.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Enter',bubbles:true,cancelable:true}));assert.equal(header.getAttribute('aria-expanded'),'true');header.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Space',bubbles:true,cancelable:true}));assert.equal(header.getAttribute('aria-expanded'),'false');assert.equal(header.getAttribute('aria-controls'),group.querySelector('.ControlsSectionRows').id);
 }
 assert.equal(h.w.getComputedStyle(h.page).getPropertyValue('--blm-input-height'),inputHeight);assert.equal(h.w.getComputedStyle(h.page.querySelector('.CustomTexturePackContainer')).marginTop,'0px');assert.equal(h.page.querySelector('[aria-label="Schematics"][role="combobox"] .Dropdown-placeholder').textContent,'Select Schematic');
 const inputs=['x','y','z','layer','selectionName','ax','ay','az','bx','by','bz'];for(const name of inputs){const css=h.w.getComputedStyle(h.field(name));assert.equal(parseFloat(css.padding),.7,name);assert.equal(css.height,'var(--blm-input-height)',name);}
 const files=h.page.querySelector('.blm-file-actions'),upload=h.page.querySelector('.blm-drop-zone'),position=h.field('x');for(const mode of ['build','place','select','build']){h.tab(mode);for(const parent of [h.page.querySelector('.blm-modes'),files]){const css=h.w.getComputedStyle(parent);assert.equal(css.display,'grid');assert.equal(css.gridTemplateColumns,'repeat(3,minmax(0,1fr))');assert.equal(css.width,'100%');}if(mode!=='select'){assert.equal(h.page.querySelector('.blm-drop-zone'),upload);assert.equal(h.field('x'),position);assert.deepEqual([...files.children].filter(node=>!node.hidden).map(node=>node.textContent),mode==='place'?['Paste','Save','Remove']:['Load','Save','Remove']);}}
 assert.deepEqual(h.errors,[]);
});
