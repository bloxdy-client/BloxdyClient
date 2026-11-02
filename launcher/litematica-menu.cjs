'use strict';
// Serialized into the hash-verified bundled mod, within its existing closure.
// These functions are never run in Node or against a live client by this file.
function menuIcon(name) {
  // Font Awesome Free icons by Fonticons, Inc. https://fontawesome.com
  // SVG shapes: CC BY 4.0 https://creativecommons.org/licenses/by/4.0/
  // Same unmodified shapes as Bloxd's upload/file/question icons.
  const icons={
    'file-lines':[384,'M0 64C0 28.7 28.7 0 64 0L213.5 0c17 0 33.3 6.7 45.3 18.7L365.3 125.3c12 12 18.7 28.3 18.7 45.3L384 448c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm208-5.5l0 93.5c0 13.3 10.7 24 24 24L325.5 176 208 58.5zM120 256c-13.3 0-24 10.7-24 24s10.7 24 24 24l144 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-144 0zm0 96c-13.3 0-24 10.7-24 24s10.7 24 24 24l144 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-144 0z'],
    'up-from-bracket':[448,'M241 7c-9.4-9.4-24.6-9.4-33.9 0L63 151c-6.9 6.9-8.9 17.2-5.2 26.2S70.3 192 80 192l80 0 0 112c0 26.5 21.5 48 48 48l32 0c26.5 0 48-21.5 48-48l0-112 80 0c9.7 0 18.5-5.8 22.2-14.8s1.7-19.3-5.2-26.2L241 7zM64 352c0-17.7-14.3-32-32-32S0 334.3 0 352l0 64c0 53 43 96 96 96l256 0c53 0 96-43 96-96l0-64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 64c0 17.7-14.3 32-32 32L96 448c-17.7 0-32-14.3-32-32l0-64z'],
    'circle-info':[512,'M256 512a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM224 160a32 32 0 1 1 64 0 32 32 0 1 1-64 0zm-8 64h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-80c-13.3 0-24-10.7-24-24s10.7-24 24-24h24v-64h-24c-13.3 0-24-10.7-24-24s10.7-24 24-24z']
  },[width,data]=icons[name],svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');
  svg.setAttribute('class','svg-inline--fa fa-'+name);svg.setAttribute('viewBox','0 0 '+width+' 512');svg.setAttribute('width',width/512+'em');svg.setAttribute('height','1em');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.setAttribute('data-icon',name);path.setAttribute('fill','currentColor');path.setAttribute('d',data);svg.append(path);return svg;
}
function button(text,action) {
  const node=el('button','NewButton BlueButton blm-button');node.type='button';
  node.append(el('div','ButtonBottomBorder'),el('div','ButtonTopBorder'),el('div','ButtonBody',text));node.addEventListener('click',action);return node;
}
function menuHelp(text) {
  const wrap=el('span','blm-help'),trigger=el('button','CircleInfo SettingsTextInputCircleInfo blm-help-button'),tip=el('span','tooltip-container SmallTextLight blm-help-tip'),content=el('span','CircleInfoTooltip',text),arrow=el('span','tooltip-arrow');trigger.append(menuIcon('circle-info'));tip.append(content,arrow);tip.setAttribute('data-popper-placement','bottom');
  trigger.type='button';trigger.setAttribute('aria-label','Help');trigger.setAttribute('aria-expanded','false');tip.id='blm-help-'+(++helpSequence);tip.setAttribute('role','tooltip');trigger.setAttribute('aria-describedby',tip.id);tip.hidden=true;
  const close=()=>{tip.hidden=true;trigger.setAttribute('aria-expanded','false');wrap.append(tip);if(activeMenuHelp===close)activeMenuHelp=null;};
  const show=value=>{if(!value){close();return;}if(activeMenuHelp!==close)activeMenuHelp?.();activeMenuHelp=close;(document.querySelector('.WholeAppWrapperInner')||document.body).append(tip);tip.hidden=false;trigger.setAttribute('aria-expanded','true');const rect=trigger.getBoundingClientRect(),width=tip.getBoundingClientRect().width,height=tip.getBoundingClientRect().height,above=rect.bottom+height+12>innerHeight,left=Math.max(8,Math.min(rect.left,innerWidth-width-8));tip.setAttribute('data-popper-placement',above?'top':'bottom');tip.style.left=left+'px';tip.style.top=Math.max(8,above?rect.top-height-6:rect.bottom+6)+'px';arrow.style.left=Math.max(8,Math.min(width-8,rect.left+rect.width/2-left))+'px';};
  wrap.addEventListener('mouseenter',()=>show(true));wrap.addEventListener('mouseleave',()=>show(false));trigger.addEventListener('focus',()=>show(true));trigger.addEventListener('blur',()=>show(false));
  trigger.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();show(true);});
  wrap.addEventListener('keydown',event=>{event.stopPropagation();if(event.code==='Escape'){event.preventDefault();show(false);}});
  wrap.append(trigger,tip);return wrap;
}
function menuField(parent,name,label,type,help,extra={}) {
  const input=field(parent,name,label,type,extra),row=input.closest('.SettingBox'),title=row.querySelector('.CheckboxText,.SliderText')||row;
  if(help)title.append(menuHelp(help));
  if(/^(?:[ab])?[xyz]$/.test(name)){
    const step=button('+/−',()=>change(name,state[name]+1));step.classList.add('blm-coordinate-step');step.setAttribute('aria-label',label+': left click +1, right click -1');
    step.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();change(name,state[name]-1);});
    input.after(step);fields.get(name).step=step;
  }
  return input;
}
function menuPosition(parent,prefix='') {
  const coordinates=el('div','blm-position');parent.append(coordinates);
  for(const axis of ['x','y','z'])menuField(coordinates,prefix+axis,axis.toUpperCase(),'number','Type a coordinate. Left click +/− to add 1; right click to subtract 1.',{step:1});
}
function menuActiveSchematic() {return model?(loadedLibraryId||'blm-unsaved'):'';}
function menuOptionLabel(target,option) {
  target.replaceChildren();target.classList.toggle('blm-schematic-label',option?.parentElement?.getAttribute('aria-label')==='Schematics');if(!option)return;
  if(!option.dataset.saveState){target.textContent=option.textContent;return;}
  const name=el('span','blm-schematic-name',option.textContent),saved=option.dataset.saveState==='saved',status=el('span','blm-schematic-status',saved?'Saved':'Not saved'),icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),shape=document.createElementNS('http://www.w3.org/2000/svg','path');
  icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('width','1em');icon.setAttribute('height','1em');icon.setAttribute('aria-hidden','true');shape.setAttribute('fill','none');shape.setAttribute('stroke','currentColor');shape.setAttribute('stroke-width','2');shape.setAttribute('stroke-linecap','round');shape.setAttribute('stroke-linejoin','round');shape.setAttribute('d',saved?'M5 12l4 4L19 6':'M12 3L2 21h20L12 3z M12 9v5 M12 17v.1');icon.append(shape);status.prepend(icon);status.dataset.saveState=option.dataset.saveState;target.append(name,status);target.classList.add('blm-schematic-label');
}
function queueLibraryChange(action) {const task=libraryWrite.then(action);libraryWrite=task.catch(()=>{});return task;}
function updateLibrary(selected=cachedUI?.librarySelect.value||menuActiveSchematic()) {
  if(!cachedUI)return;const select=cachedUI.librarySelect;select.blmClose?.();select.replaceChildren();
  const empty=el('option','','Select Schematic');empty.value='';select.append(empty);
  if(model&&!loadedLibraryId){const option=el('option','',String(model.name));option.value='blm-unsaved';option.dataset.saveState='unsaved';select.append(option);}
  for(const entry of library.filter(entry=>entry.model.format==='bloxd')){const option=el('option','',String(entry.model.name));option.value=entry.id;option.dataset.saveState='saved';select.append(option);}
  select.value=[...select.options].some(option=>option.value===selected)?selected:menuActiveSchematic();if(select.selectedIndex<0)select.value='';select.blmRefresh?.();sync();
}
function saveCurrent() {
  if(!model)return Promise.resolve(false);const current=model,pending=menuSaves.get(current);if(pending)return pending;
  const id=loadedLibraryId||'schem-'+Date.now().toString(36)+'-'+(++librarySequence).toString(36),selected=cachedUI?.librarySelect.value,token=importToken,entry={id,model:current,mapping:{...mapping},placement:Object.fromEntries(placementFields.map(name=>[name,state[name]]))};
  const task=queueLibraryChange(async()=>{
    try{
      if(!library.some(item=>item.id===id)&&library.length>=8){if(model===current)notify('Library full: remove a saved schematic (limit: 8). This schematic is not saved.');return false;}
      await storage('put',entry);library=[...library.filter(item=>item.id!==id),entry];
      const choice=cachedUI?.librarySelect.value;if(model===current)loadedLibraryId=id;
      updateLibrary(model===current&&choice===selected?id:choice);
      if(model===current&&token===importToken)notify('Schematic, placement and block mapping saved locally.');return true;
    }catch{if(model===current&&token===importToken)notify('Save failed. The schematic remains available until reload.');return false;}
    finally{menuSaves.delete(current);sync();}
  });menuSaves.set(current,task);sync();return task;
}
function loadMenuSchematic() {
  const id=cachedUI.librarySelect.value,entry=library.find(item=>item.id===id);
  if(entry&&id!==loadedLibraryId){++importToken;setModel(entry.model,entry.mapping,entry.placement);loadedLibraryId=id;updateLibrary(id);}
  else if(!model||id!==menuActiveSchematic()){notify('Choose a schematic or drop a .bloxdschem file first.');return false;}
  return true;
}
async function removeMenuSchematic() {
  const id=cachedUI.librarySelect.value;
  try {
    if(!id)return;const current=model;
    if(id!=='blm-unsaved'){await queueLibraryChange(async()=>{await storage('delete',id);library=library.filter(entry=>entry.id!==id);scene=scene.filter(entry=>entry.id!==id);saveScene();});}
    if((id==='blm-unsaved'&&model===current&&!loadedLibraryId)||loadedLibraryId===id){++importToken;model=null;activeSceneId=null;loadedLibraryId='';checkedMaterials=new Set();checkedRevision++;pendingPlacement=false;mapping=Object.create(null);rebuild();}
    updateLibrary();renderMaterials();notify('Schematic removed.');
  }catch{notify('Could not remove the schematic.');}
}
function menuMaterialTable(items,owned,selection,checked=false) {
  const table=el('table','blm-materials'),head=el('thead',''),titles=el('tr',''),body=el('tbody','');
  const labels=checked?['Material','Total']:selection?['Material','Total','Check']:['Material','Total','Missing','Inventory','Check'];
  for(const label of labels){const cell=el('th','',label);cell.scope='col';if(label==='Missing')cell.append(menuHelp('Required blocks not yet correct in the current placement. ≥ means some positions are still unchecked or unloaded.'));if(label==='Inventory')cell.append(menuHelp('Blocks currently in your inventory. — means inventory data is unavailable.'));if(label==='Check')cell.append(menuHelp('Move this material to Checked. Reset materials clears all checks.'));titles.append(cell);}head.append(titles);table.append(head,body);
  for(const item of items){
    const row=el('tr',checked?'blm-checked-material':''),name=item.name,total=item.total;row.dataset.blmMaterial=name;row.append(el('td','',name),el('td','',String(total)));
    if(!checked&&!selection){const have=owned?.[name]||0;row.append(el('td','',item.unknown?'≥'+item.remaining:String(item.remaining)),el('td','',owned?(have===Infinity?'∞':String(have)):'—'));}
    if(!checked){const cell=el('td',''),label=el('label','rc-checkbox SettingsCheckbox'),input=el('input','rc-checkbox-input');input.type='checkbox';input.setAttribute('aria-label','Check '+name);label.append(input,el('span','rc-checkbox-inner'));cell.append(label);row.append(cell);input.addEventListener('change',()=>{if(input.checked){checkedMaterials=new Set([...checkedMaterials,name]);checkedRevision++;materialSignature='';renderer.invalidate(true);renderMaterials();}});}
    body.append(row);
  }
  return table;
}
function renderMaterials() {
  if(!cachedUI||!binding?.menu.isConnected||!binding.menu.classList.contains('blm-selected')||cachedUI.materialRows.hidden)return;
  const selection=state.mode==='select',items=selection?(areaResult?.materials||[]).map(item=>({name:item.name,total:item.count})):Object.entries(stats.materials).map(([name,counts])=>({name,...counts}));
  let owned=null;
  if(!selection){const inventory=adapter.inventory?.();if(inventory){owned=Object.create(null);for(const item of inventory.items||[]){const name=String(item?.name||'').split('|')[0];if(name)owned[name]=(owned[name]||0)+(item.amount===-1?Infinity:Math.max(0,Number(item.amount)||0));}}}
  items.sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'en'));
  const signature=JSON.stringify([state.mode,items,owned&&Object.entries(owned).map(([name,count])=>[name,count===Infinity?'infinite':count]),[...checkedMaterials]]);if(signature===materialSignature)return;materialSignature=signature;
  const host=cachedUI.materials,open=items.filter(item=>!checkedMaterials.has(item.name)),checked=items.filter(item=>checkedMaterials.has(item.name));host.replaceChildren();
  const scroll=el('div','SettingBox blm-table-scroll');scroll.append(menuMaterialTable(open,owned,selection));host.append(scroll);
  const checkedTitle=el('div','SliderText blm-checked-title','Checked'),checkedScroll=el('div','SettingBox blm-table-scroll');checkedScroll.append(menuMaterialTable(checked,owned,selection,true));host.append(checkedTitle,checkedScroll,button('Reset materials',()=>{checkedMaterials=new Set();checkedRevision++;materialSignature='';renderer.invalidate(true);renderMaterials();}));
}
function buildUI() {
  const page=el('div','SettingsMenuRightInner ControlsContainer');page.id='blm-settings-page';page.setAttribute('role','tabpanel');page.setAttribute('aria-label','Litematica');
  menuField(page,'enabled','Litematica enabled','checkbox','Enable or disable Litematica.');
  const modes=el('div','blm-actions blm-three-actions blm-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','Litematica task');for(const [value,label]of [['build','Build'],['select','Save area'],['place','Paste']]){const tab=button(label,()=>change('mode',value));tab.dataset.blmMode=value;modes.append(tab);}page.append(modes);
  const sections={},files=el('div','blm-menu-section'),fileHeading=el('div','SliderText','Schematics'),fileHelp=menuHelp('Choose or drop one .bloxdschem file, up to 8 MB. Load opens the selected saved schematic. Save stores the active schematic locally. Paste requires Creative and Owner / Builder rights.');sections.files=files;fileHeading.append(fileHelp);files.append(fileHeading);page.append(files);
  if(!picker)picker=globalThis.__BLM_CREATE_FILE_PICKER__(importFile,notify);
  const upload=el('div','CustomTexturePackContainer'),dropZone=el('div','CustomTextureFolderUpload blm-drop-zone'),uploadIcon=el('div','CustomTextureFolderUploadIcon'),uploadText=el('div','CustomTextureFolderUploadInstructions','Drag and drop a .bloxdschem file here');dropZone.tabIndex=0;dropZone.setAttribute('role','button');dropZone.setAttribute('aria-label','Schematic file drop area');uploadIcon.append(menuIcon('up-from-bracket'));dropZone.append(uploadIcon,uploadText);upload.append(dropZone);files.append(upload);
  dropZone.addEventListener('click',()=>picker.open());dropZone.addEventListener('keydown',event=>{if(event.code==='Enter'||event.code==='Space'){event.preventDefault();picker.open();}});
  const refreshUpload=()=>{const active=Boolean(model)&&!dropZone.classList.contains('ActiveDrag'),icon=active?'file-lines':'up-from-bracket',text=active?String(model.name):'Drag and drop a .bloxdschem file here';uploadIcon.classList.toggle('Active',active);uploadText.classList.toggle('Active',active);if(uploadText.textContent!==text)uploadText.textContent=text;if(uploadIcon.firstElementChild?.getAttribute('data-icon')!==icon)uploadIcon.replaceChildren(menuIcon(icon));};
  let depth=0;const clear=()=>{depth=0;dropZone.classList.remove('ActiveDrag');refreshUpload();};
  dropZone.addEventListener('dragenter',event=>{event.preventDefault();event.stopPropagation();depth++;dropZone.classList.add('ActiveDrag');refreshUpload();});dropZone.addEventListener('dragleave',event=>{event.preventDefault();event.stopPropagation();if(--depth<=0)clear();});
  page.addEventListener('dragover',event=>{if(state.mode==='select')return;event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
  page.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();clear();if(state.mode==='select')return;const chosen=event.dataTransfer?.files;if(chosen?.length>1){notify('Drop one .bloxdschem file at a time.');return;}importFile(chosen?.[0]);});page.addEventListener('dragend',clear);
  const librarySelect=el('select','blm-input');librarySelect.setAttribute('aria-label','Schematics');librarySelect.addEventListener('change',()=>sync());files.append(librarySelect);nativeDropdown(librarySelect,'Schematics');
  const fileActions=el('div','blm-actions blm-three-actions blm-file-actions'),load=button('Load',loadMenuSchematic),paste=button('Paste',()=>{if(loadMenuSchematic())placing?.start({closeSettings:true});}),save=button('Save',()=>saveCurrent()),remove=button('Remove',removeMenuSchematic);fileActions.append(load,paste,save,remove);files.append(fileActions);
  const selection=el('div','blm-menu-section');sections.select=selection;page.append(selection);menuField(selection,'selectionName','Name','text','Name of the exported .bloxdschem file.');
  const areaActions=el('div','blm-actions'),download=button('Save schematic',()=>scanArea(true));areaActions.append(download,button('Clear selection',()=>{state.aSet=false;state.bSet=false;checkedMaterials=new Set();checkedRevision++;persist();scheduleArea();renderer.invalidate(true);sync();}));selection.append(areaActions);
  for(const [prefix,title]of [['a','Corner 1'],['b','Corner 2']]){const heading=el('div','SliderText blm-corner-title',title);heading.append(menuHelp('Use a Stick: left click selects Corner 1, right click selects Corner 2. Both corner blocks are included. You can also type coordinates.'));selection.append(heading);menuPosition(selection,prefix);}
  const placement=el('div','blm-menu-section');sections.placement=placement;page.append(placement);const preview=menuField(placement,'preview','Show preview','checkbox','Show or hide the schematic without unloading it.');
  placement.append(el('div','SliderText','Position'));menuPosition(placement);const moveButton=button('Move to player',()=>moveToPlayer());placement.append(moveButton);
  menuField(placement,'rotation','Rotation','select','Select the schematic rotation.',{options:[[0,'0°'],[90,'90°'],[180,'180°'],[270,'270°']]});
  menuField(placement,'placementLocked','Lock Placement','checkbox','Prevent coordinate, rotation and Move to player changes until unlocked.');
  const build=el('div','blm-menu-section');sections.build=build;page.append(build);
  menuField(build,'layerMode','Layer','select','Choose all layers, one layer, or the selected layer together with all layers above or below it.',{options:[['all','All layers'],['single','Single layer'],['above','All layers above'],['below','All layers below']]});
  const layer=el('div','blm-layer-choice'),layerNumber=menuField(layer,'layer','Layer','number','Schematic layer index, starting at 0.',{step:1}),previous=button('−',()=>change('layer',Math.max(0,state.layer-1))),next=button('+',()=>change('layer',Math.min((model?.size[1]||1)-1,state.layer+1)));layer.append(previous,next);build.append(layer);
  menuField(build,'autoLayer','Next layer when complete','checkbox','Only active with Single layer. Advance after every required block in that layer has been verified correct.');
  menuField(build,'ezBuilding','Easy building','checkbox','Hold the Place button to build using the required hotbar block. Native game limits still apply.');
  menuField(build,'ezSchematicOnly','Only build in schematic','checkbox','Restrict Easy building to the schematic bounds.');menuField(build,'ezPreventExtra','Prevent extra blocks','checkbox','Prevent Easy building at positions that are empty in the schematic.');
  menuField(build,'ezSpeed','Easy building speed (blocks/sec)','range','Maximum attempted building rate while holding Place. Game limits and inventory availability still apply.',{step:1});
  const materialsGroup=group('Materials',false,renderMaterials),materials=el('div','');materialsGroup.rows.append(materials);page.append(materialsGroup.section);
  const settings=group('Settings',false);page.append(settings.section);
  for(const [name,label,help]of [['fill','Highlight missing blocks','Show missing schematic blocks.'],['showWrong','Highlight wrong blocks','Highlight positions occupied by the wrong block.'],['showExtra','Highlight extra blocks','Highlight blocks at schematic air positions.'],['hud','Show Litematica HUD','Show the Litematica overlay while playing.'],['hideChecked','Hide checked blocks','Hide preview blocks whose material is in the Checked section of Materials.'],['autoSaveSchematics','Automatically save new schematics','Save newly imported schematics to this device automatically. If saving fails or the library is full, the schematic remains Not saved and is lost when the page reloads.']])menuField(settings.rows,name,label,'checkbox',help);
  for(const [name,label,help,step]of [['distance','Render Distance','Maximum preview distance in blocks.',16],['placementTransparency','Placement transparency','Transparency of the missing-block preview, from opaque to invisible.',.05],['lineWidth','Outline width','Width of the preview outlines.',.5],['missingTint','Missing block tint','Strength of the missing-block color tint.',.05],['wrongTint','Wrong blocks tint','Strength of the wrong-block color tint.',.05],['extraTint','Extra blocks tint','Strength of the extra-block color tint.',.01]])menuField(settings.rows,name,label,'range',help,{step});
  const notice=el('div','blm-notice');notice.setAttribute('role','status');page.append(notice);
  const pasteStatus=el('div','blm-paste-progress'),cancelPlace=button('Cancel',()=>placing?.cancel());pasteStatus.setAttribute('role','status');page.append(pasteStatus,cancelPlace);
  for(const type of ['click','contextmenu','pointerdown','pointerup','mousedown','mouseup','keydown','keyup','wheel'])page.addEventListener(type,event=>event.stopPropagation());
  for(const section of page.querySelectorAll('.ControlsSection')){section.classList.add('blm-category');const rows=section.querySelector('.ControlsSectionRows');rows.classList.add('SettingBoxGroup');rows.id='blm-category-'+section.querySelector('.ControlsSectionTitle').textContent.toLowerCase();section.querySelector('.ControlsSectionHeader').setAttribute('aria-controls',rows.id);}
  cachedUI={page,modes,sections,librarySelect,fileHelp,refreshUpload,load,pasteButton:paste,save,remove,preview,layer,layerNumber,previous,next,moveButton,download,materials,materialRows:materialsGroup.rows,notice,pasteStatus,cancelPlace};
  updateLibrary();renderMaterials();sync();return page;
}
function syncMenu() {
  if(!cachedUI||!binding?.menu.isConnected||!binding.menu.classList.contains('blm-selected'))return;
  const write=(node,text)=>{if(node.textContent!==text)node.textContent=text;},selection=state.mode==='select',place=state.mode==='place',busy=Boolean(placing?.diagnostics().busy);
  for(const [id,node]of Object.entries(cachedUI.sections))node.hidden=id==='select'?!selection:id==='build'?state.mode!=='build':selection;
  for(const tab of cachedUI.modes.children){const selected=tab.dataset.blmMode===state.mode;tab.setAttribute('aria-pressed',String(selected));tab.classList.toggle('BlueButton',selected);tab.classList.toggle('DarkBlueButton',!selected);}
  const choice=cachedUI.librarySelect.value,selected=Boolean(choice)&&(choice===menuActiveSchematic()||library.some(entry=>entry.id===choice)),saving=Boolean(model&&menuSaves.has(model));
  cachedUI.load.hidden=place;cachedUI.load.disabled=busy||!selected;cachedUI.pasteButton.hidden=!place;cachedUI.pasteButton.disabled=busy||!selected;cachedUI.save.disabled=busy||!model||choice!==menuActiveSchematic()||saving||Boolean(state.autoSaveSchematics&&loadedLibraryId&&library.some(entry=>entry.id===loadedLibraryId));cachedUI.remove.disabled=busy||!selected||(choice===menuActiveSchematic()&&saving);
  for(const name of ['x','y','z','rotation'])fields.get(name).input.disabled=state.placementLocked;
  for(const [name,{input,refresh,step}]of fields){if(document.activeElement!==input){if(input.type==='checkbox')input.checked=state[name];else if(input.value!==String(state[name]))input.value=state[name];}refresh?.();if(step)step.disabled=Boolean(!selection&&state.placementLocked&&['x','y','z'].includes(name));}
  fields.get('autoLayer').input.disabled=state.layerMode!=='single';fields.get('autoLayer').input.closest('.SettingBox').classList.toggle('blm-disabled',state.layerMode!=='single');
  cachedUI.moveButton.disabled=state.placementLocked;
  fields.get('placementLocked').input.closest('.SettingBox').hidden=place;cachedUI.preview.closest('.SettingBox').hidden=!place;
  cachedUI.layer.hidden=state.layerMode==='all';cachedUI.layerNumber.max=Math.max(0,(model?.size[1]||1)-1);cachedUI.previous.disabled=state.layer<=0;cachedUI.next.disabled=!model||state.layer>=model.size[1]-1;
  cachedUI.download.disabled=areaBusy||!state.aSet||!state.bSet;cachedUI.cancelPlace.hidden=!busy;cachedUI.pasteStatus.hidden=!busy;write(cachedUI.pasteStatus,busy?placing.status():'');
  const fileTip=cachedUI.fileHelp.querySelector('[role="tooltip"]')||document.getElementById(cachedUI.fileHelp.querySelector('button').getAttribute('aria-describedby'));write(fileTip.querySelector('.CircleInfoTooltip'),'Click to choose or drop one .bloxdschem file, up to 8 MB. Load opens the selected saved schematic. Save stores the active schematic locally. A Not saved schematic is deleted when the page reloads unless you save it. Paste requires Creative and Owner / Builder rights.'+(model?.warnings?.length?' '+model.warnings.join(' '):''));
  const status=selection?(areaBusy||/^(Selection:|World changed|Downloaded|Join a world|Reading)/.test(areaStatus)?areaStatus:''):message;
  cachedUI.notice.hidden=!status||busy;write(cachedUI.notice,status||'');
  cachedUI.refreshUpload();
  for(const node of cachedUI.page.querySelectorAll('.blm-button'))node.classList.toggle('DisabledNewButton',node.disabled);
}
const menuCSS=`
  .SettingsMenu.blm-selected .SettingsMenuRight>:not(#blm-settings-page){display:none!important}
  .SettingsMenu:not(.blm-selected) #blm-settings-page{display:none!important}
  #blm-settings-page{min-width:0;--blm-input-height:3.2rem}
  #blm-settings-page .blm-menu-section{display:flex;flex-direction:column;gap:.5rem}
  #blm-settings-page .blm-actions{display:flex;flex-wrap:wrap;gap:1rem}
  #blm-settings-page .blm-three-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%}
  #blm-settings-page .blm-three-actions>.blm-button{width:100%;min-width:0;box-sizing:border-box}
  #blm-settings-page .CustomTexturePackContainer{margin-top:0}
  #blm-settings-page .blm-schematic-label{display:flex;align-items:center;gap:1rem}
  #blm-settings-page .Dropdown-placeholder.blm-schematic-label{width:100%}
  #blm-settings-page .Dropdown-control[aria-label="Schematics"]{padding-right:2.5rem}
  #blm-settings-page .blm-schematic-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #blm-settings-page .blm-schematic-status{display:inline-flex;align-items:center;gap:.35rem;white-space:nowrap;margin-left:auto}
  #blm-settings-page .blm-schematic-status[data-save-state="saved"]{color:#63d471}
  #blm-settings-page .blm-schematic-status[data-save-state="unsaved"]{color:#ff7070}
  #blm-settings-page .blm-button{appearance:none;font:inherit;color:inherit;padding:0}
  #blm-settings-page .blm-button:disabled{cursor:default}
  #blm-settings-page .blm-position{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem}
  #blm-settings-page .blm-position .blm-field{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:.5rem}
  #blm-settings-page .blm-position .SliderText{grid-column:1/-1}
  #blm-settings-page .blm-input{box-sizing:border-box;min-width:0;max-width:100%}
  #blm-settings-page .blm-field>.TextInput{width:100%;height:var(--blm-input-height);min-height:var(--blm-input-height);padding:.7rem;font:inherit}
  #blm-settings-page .blm-coordinate-step{height:var(--blm-input-height)}
  #blm-settings-page .blm-field>.Dropdown-root{margin-top:.5rem}
  #blm-settings-page .blm-layer-choice{display:flex;align-items:center;gap:.5rem}
  #blm-settings-page .blm-layer-choice>.SettingBox{flex:1;min-width:0}
  #blm-settings-page .blm-category>.ControlsSectionHeader{display:flex;align-items:center;justify-content:space-between;padding:1rem .8rem;cursor:pointer;color:#ffcf65;font-weight:400}
  #blm-settings-page .blm-category>.ControlsSectionHeader>.ControlsSectionTitle{font-weight:400}
  #blm-settings-page .blm-category>.ControlsSectionHeader>.ControlsSectionChevron{transform:none;rotate:none}
  #blm-settings-page .blm-category>.ControlsSectionHeader:focus-visible{outline:2px solid #ffcf65;outline-offset:-2px}
  #blm-settings-page .blm-category>.ControlsSectionRows{padding-bottom:.5rem}
  #blm-settings-page .blm-disabled,#blm-settings-page .Dropdown-control[aria-disabled=true]{opacity:.5}
  #blm-settings-page .blm-materials{width:100%;font:inherit;border-collapse:collapse}
  #blm-settings-page .blm-materials th,#blm-settings-page .blm-materials td{padding:.5rem;text-align:left;overflow-wrap:anywhere}
  #blm-settings-page .blm-table-scroll{overflow-x:auto;max-width:100%}
  #blm-settings-page .blm-checked-material{opacity:.5}
  #blm-settings-page .blm-help{display:inline-flex;vertical-align:middle}
  #blm-settings-page .blm-help-button{appearance:none;background:none;border:0;padding:0;font:inherit}
  .blm-help-tip{position:fixed;width:max-content;max-width:calc(100vw - 16px);pointer-events:none}
  body>.blm-help-tip{--tooltipBackground:var(--primary-1);--tooltipColor:var(--gray-1);--tooltipBorder:var(--near-black)}
  .blm-help-tip[hidden]{display:none!important}
  #blm-settings-page [hidden],[data-blm-controls] .ControlsSectionRows[hidden]{display:none!important}
  #blm-settings-page .blm-notice:empty{display:none}
  @media(max-width:520px){#blm-settings-page .blm-position{grid-template-columns:1fr}}
`;
function adaptLitematicaMenu(name,source){
 const edit=(from,to)=>{if(!source.includes(from))throw Error('Litematica menu adapter mismatch: '+name+' / '+from.slice(0,80));source=source.replace(from,()=>to);};
 const replaceFunction=(start,end,fn)=>{const a=source.indexOf(start),b=source.indexOf(end,a);if(a<0||b<0)throw Error('Litematica menu function mismatch: '+start);source=source.slice(0,a)+'  '+fn.toString()+'\n'+source.slice(b);};
 if(name==='litematica.js'){
  if(source.split('hud.hidden=!state.hud').length!==3)throw Error('Litematica HUD gate mismatch');source=source.replaceAll('hud.hidden=!state.hud','hud.hidden=!adapter.inGame?.()||!state.hud');
  edit('autoLayer:false, placementLocked:false', 'autoLayer:true, placementLocked:false');
  edit("defaults.openKey='KeyM';", "defaults.preview=true;defaults.hideChecked=false;defaults.autoSaveSchematics=false;defaults.openKey='KeyM';");
  edit("const state = { ...defaults };", "let helpSequence=0,materialSignature='',loadedLibraryId='',activeMenuHelp=null,checkedRevision=0,checkedMaterials=new Set(),libraryWrite=Promise.resolve(),librarySequence=0;const menuSaves=new WeakMap();\n  const state = { ...defaults };");
  edit("message = 'Import a .bloxdschem file or drop it into the box below.'", "message = ''");
  edit("if (!valid(field, value)) return false;", "if (!valid(field, value)) return false;if(field==='autoLayer'&&state.layerMode!=='single')return false;");
  edit("state[field] = value; persist();", "state[field] = value; persist();if(field==='mode')activeMenuHelp?.();if(['hideChecked','preview'].includes(field)){renderer.invalidate(true);sync();return true;}");
  edit('function select(active) {', 'function select(active) {if(!active)activeMenuHelp?.();');
  edit("header.setAttribute('aria-expanded',String(open));", "header.setAttribute('aria-expanded',String(open));header.querySelector('.ControlsSectionChevron').textContent=open?'▾':'▸';");
  edit('cachedUI?.page.remove();binding={menu,tab,right};', 'activeMenuHelp?.();cachedUI?.page.remove();binding={menu,tab,right};');
  edit("addEventListener('pagehide',()=>{placing?.destroy();", "addEventListener('pagehide',()=>{activeMenuHelp?.();placing?.destroy();");
  edit("activeSceneId=null;history=[];redoHistory=[];", "activeSceneId=null;loadedLibraryId='';checkedMaterials=new Set();checkedRevision++;materialSignature='';history=[];redoHistory=[];");
  edit('persist();rebuild();renderMapping();updateLibrary();renderScene();', 'persist();rebuild();renderMapping();updateLibrary(menuActiveSchematic());renderScene();');
  edit("lastImport.phase='loaded';lastImport.blocks=next.blockCount;", "lastImport.phase='loaded';lastImport.blocks=next.blockCount;if(state.autoSaveSchematics)await saveCurrent();");
  edit('if(token!==importToken)return;setModel(next);', "if(token!==importToken)return;setModel({...next,name:String(file.name).replace(/\\.bloxdschem$/i,'')});");
  const announcement="notify(String(model.name)+' loaded · '+(model.blockCount??model.blocks.length).toLocaleString('en-US')+' blocks.'+(pendingPlacement?' Join a world to see the placement.':' Placement is ready.'));";
  edit(announcement,"notify(String(model.name)+' loaded.');");
  // The saved library choice is loaded explicitly by Load or Paste.
  replaceFunction('  async function saveCurrent() {','  function updateLibrary(',saveCurrent);
  replaceFunction('  function updateLibrary(', '  function renderScene()',updateLibrary);
  replaceFunction('  function button(text, action) {','  function group(',button);
  edit("const open=()=>{if(root.classList.contains('is-open'))", "const open=()=>{if(select.disabled)return;if(root.classList.contains('is-open'))");
  edit("const choose=()=>{select.value=item.value;", "const choose=()=>{if(select.disabled)return;select.value=item.value;");
  edit("select.blmRefresh=()=>{text.textContent=select.selectedOptions[0]?.textContent||'';", "select.blmClose=close;select.blmRefresh=()=>{control.setAttribute('aria-disabled',String(select.disabled));control.tabIndex=select.disabled?-1:0;if(select.disabled)close();menuOptionLabel(text,select.selectedOptions[0]);");
  edit("option.tabIndex=0;option.setAttribute('role','option');", "menuOptionLabel(option,item);option.tabIndex=0;option.setAttribute('role','option');");
  replaceFunction('  function renderAreaMaterials(){','  function renderMapping()',function renderAreaMaterials(){materialSignature='';renderMaterials();});
  replaceFunction('  function renderMapping() {','  function renderMaterials()',function renderMapping(){});
  replaceFunction('  function renderMaterials() {','  function updateFocusOptions()',renderMaterials);
  replaceFunction('  function buildUI() {','  function select(active)',buildUI);
  const syncStart=source.indexOf('    if(cachedUI&&binding?.menu.isConnected',source.indexOf('  function sync() {')),syncEnd=source.indexOf('    for(const b of document.querySelectorAll',syncStart);
  if(syncStart<0||syncEnd<0)throw Error('Litematica menu sync mismatch');source=source.slice(0,syncStart)+'    syncMenu();\n'+source.slice(syncEnd);
  const helpers=[menuIcon,menuHelp,menuField,menuPosition,menuActiveSchematic,menuOptionLabel,queueLibraryChange,loadMenuSchematic,removeMenuSchematic,menuMaterialTable,syncMenu].map(fn=>fn.toString()).join('\n');
  edit('  function buildUI() {',helpers+'\n  function buildUI() {');
  edit("const renderer=globalThis.__BLM_CREATE_RENDERER__(()=>state,", "const renderer=globalThis.__BLM_CREATE_RENDERER__(()=>({...state,preview:state.mode!=='place'||state.preview,checkedMaterials,checkedRevision}),");
  // Replace the previous custom skin entirely; native Bloxd classes own paint,
  // font sizes, button bevels, upload dimensions, checkboxes and slider tracks.
  const styleStart=source.indexOf("const style=el('style','');style.textContent=`"),styleEnd=source.indexOf('`;\n    document.head.append(style);',styleStart),hud=/#blm-hud\{[^}]*\}/.exec(source)?.[0];
  if(styleStart<0||styleEnd<0||!hud)throw Error('Litematica native style adapter mismatch');
  source=source.slice(0,styleStart)+"const style=el('style','');style.textContent=`"+menuCSS+'\n'+hud+'\n#blm-hud[hidden]{display:none}`;'+source.slice(styleEnd+2);
 }
 if(name==='adapter.js'){
  edit('= { connect, resolveItemName,', "= { inGame:()=>{const s=captured?.singletons,c=s?.bloxd?.client,a=c?.msgHandler||c?.clientGame;return Boolean(s&&document.querySelector('.ChatInput')&&c?.gameReplayer?.recording==null&&(s.connectedWebsocketUrl||a&&typeof a==='object')&&own(s).some(n=>n?.container&&n?.inputs&&(s.connectedWebsocketUrl||own(c).includes(n))));}, connect, resolveItemName,");
 }
 if(name==='renderer.js'){
  edit('const next=[state.layerMode,', 'const next=[state.hideChecked,state.checkedRevision,state.layerMode,');
  edit("if(globalThis.__BLM_MODEL__.layerVisible(b.layer,state.layerMode,state.layer,state.layerEnd))eligible.push", "if(globalThis.__BLM_MODEL__.layerVisible(b.layer,state.layerMode,state.layer,state.layerEnd)&&!(state.hideChecked&&state.checkedMaterials?.has(b.name)))eligible.push");
  edit('function drawable(group,state){', 'function drawable(group,state){if(state.preview===false)return false;');
 }
 return source;
}
module.exports={adaptLitematicaMenu};
