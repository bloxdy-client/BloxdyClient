/* Local controls: native selects retain their values and form participation. */
(() => {
 'use strict';
 const controls=new WeakMap();let opened=null,next=0;
 function close(focus=false){if(!opened)return;const {button,list,anchor}=opened;anchor.classList.remove('select-open');button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');list.remove();opened=null;if(focus)button.focus();}
 function enhance(root=document){
  root.querySelectorAll('select').forEach(select=>{
   let control=controls.get(select);
   if(!control){
    const wrap=document.createElement('span'),button=document.createElement('button');wrap.className='select-control';button.type='button';button.className='select-button';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','select-list-'+(++next));
    select.before(wrap);wrap.append(select,button);select.classList.add('select-source');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    control={select,wrap,button};controls.set(select,control);
    button.addEventListener('click',()=>opened?.button===button?close():open(control));
    button.addEventListener('keydown',event=>key(event,control));select.addEventListener('change',()=>sync(control));
   }
   sync(control);
  });
 }
 function sync({select,wrap,button}){button.disabled=select.disabled;button.textContent=select.selectedOptions[0]?.textContent||'Choose…';button.setAttribute('aria-label',select.getAttribute('aria-label')||select.closest('label')?.childNodes[0]?.textContent?.trim()||'Choose an option');wrap.classList.toggle('profile-select-control',select.classList.contains('profile-picker'));wrap.classList.toggle('account-select-control',select.id==='account-select');}
 function open(control){
  close();if(control.select.disabled)return;
  const list=document.createElement('div');list.id=control.button.getAttribute('aria-controls');list.className='select-menu';list.setAttribute('role','listbox');list.setAttribute('aria-label',control.button.getAttribute('aria-label'));
  const anchor=control.wrap.closest('.profile-picker-wrap,.account-switch')||control.wrap;
  const options=[...control.select.options].filter(o=>!o.hidden).map(option=>{const item=document.createElement('div');item.id=list.id+'-'+option.index;item.className='select-option';item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.setAttribute('aria-disabled',String(option.disabled));item.textContent=option.textContent;item.title=option.textContent;item.addEventListener('pointermove',()=>{if(!option.disabled)activate(options.findIndex(x=>x.option===option));});item.addEventListener('click',()=>choose(option));list.append(item);return {option,item};});
  document.body.append(list);opened={...control,anchor,list,options,index:Math.max(0,options.findIndex(x=>x.option.selected)),search:'',searchedAt:0};anchor.classList.add('select-open');control.button.setAttribute('aria-expanded','true');position();activate(opened.index);
 }
 function position(){
  if(!opened)return;
  const r=opened.anchor.getBoundingClientRect(),list=opened.list,gap=6,edge=12;
  const width=Math.max(0,Math.min(r.width,innerWidth-edge*2));
  list.style.width=width+'px';list.style.maxHeight='280px';
  const desired=Math.min(list.scrollHeight||list.offsetHeight,280);
  const below=Math.max(0,innerHeight-r.bottom-gap-edge),above=Math.max(0,r.top-gap-edge);
  const upward=below<desired&&above>below,available=upward?above:below;
  list.style.maxHeight=Math.min(280,available)+'px';
  list.style.left=Math.max(edge,Math.min(r.left,innerWidth-width-edge))+'px';
  list.style.top=Math.max(edge,upward?r.top-Math.min(list.offsetHeight,available)-gap:r.bottom+gap)+'px';
  list.dataset.side=upward?'above':'below';
 }
 function activate(index){if(!opened||!opened.options.length)return;opened.index=index;opened.options.forEach((x,i)=>x.item.classList.toggle('focused',i===index));const item=opened.options[index].item;opened.button.setAttribute('aria-activedescendant',item.id);item.scrollIntoView?.({block:'nearest'});}
 function choose(option){if(!opened||option.disabled)return;const {select,button}=opened;select.value=option.value;close();sync(controls.get(select));button.focus();select.dispatchEvent(new Event('change',{bubbles:true}));}
 function key(event,control){
  const keys=['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape','Tab'];if(!keys.includes(event.key)&&event.key.length!==1)return;
  if(event.key==='Tab'){close();return;}if(event.key==='Escape'){if(opened){event.preventDefault();event.stopPropagation();close(true);}return;}
  event.preventDefault();event.stopPropagation();const wasOpen=opened?.button===control.button;if(!wasOpen)open(control);if(!opened)return;
  const enabled=opened.options.map((x,i)=>x.option.disabled?-1:i).filter(i=>i>=0);if(!enabled.length)return;
  if(['Enter',' '].includes(event.key)){if(wasOpen)choose(opened.options[opened.index].option);return;}
  if(event.key==='Home')activate(enabled[0]);else if(event.key==='End')activate(enabled.at(-1));else if(event.key==='ArrowDown'||event.key==='ArrowUp'){const i=enabled.indexOf(opened.index),direction=event.key==='ArrowDown'?1:-1;activate(enabled[(i+direction+enabled.length)%enabled.length]);}else {const now=Date.now();opened.search=now-opened.searchedAt>650?event.key:opened.search+event.key;opened.searchedAt=now;const i=opened.options.findIndex(x=>!x.option.disabled&&x.option.textContent.toLowerCase().startsWith(opened.search.toLowerCase()));if(i>=0)activate(i);}
 }
 document.addEventListener('pointerdown',event=>{if(opened&&!opened.list.contains(event.target)&&!opened.button.contains(event.target))close();});
 document.addEventListener('focusin',event=>{if(opened&&event.target!==opened.button&&!opened.list.contains(event.target))close();});
 document.addEventListener('scroll',event=>{if(opened&&!opened.list.contains(event.target))close();},true);window.addEventListener('resize',()=>close());
 window.launcherSelect={enhance,close};
})();
