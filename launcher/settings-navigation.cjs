'use strict';
// Shared ownership of the native settings sidebar, including installed mods.
module.exports=function installSettingsNavigation(){
  if(globalThis.__BLOXDY_SETTINGS_NAVIGATION__)return;
  const definitions=[
    ['zoomer-selected','[data-zoomer-category]','.zoomer-page'],
    ['grassify-selected','[data-grassify-category]','.grassify-page'],
    ['blm-selected','[data-litematica-category]','#blm-settings-page'],
    ['bvfx-shader-selected','[data-shader-category]','[role=tabpanel][aria-label="Shader"]']
  ];
  const menus=new Map();let queued=false,stopped=false;
  function apply(menu,state){
    const right=menu.querySelector('.SettingsMenuRight');
    if(state.tab&&!menu.contains(state.tab))state.tab=null;
    let active=definitions.find(([,tab])=>state.tab?.matches(tab));
    // A native rerender may temporarily remove a mod's page. Never hide the
    // native page while its replacement is absent.
    if(active&&!right?.querySelector(active[2])){state.tab=null;active=null;}
    for(const [cls,tab]of definitions){
      const selected=active?.[0]===cls;
      if(menu.classList.contains(cls)!==selected)menu.classList.toggle(cls,selected);
      for(const node of menu.querySelectorAll(tab)){
        if(node.classList.contains('ActiveMenuSideBarBodyTab')!==selected)node.classList.toggle('ActiveMenuSideBarBodyTab',selected);
        if(node.getAttribute('aria-selected')!==String(selected))node.setAttribute('aria-selected',String(selected));
      }
    }
    if(state.tab){
      if(!state.tab.classList.contains('ActiveMenuSideBarBodyTab'))state.tab.classList.add('ActiveMenuSideBarBodyTab');
      for(const tab of menu.querySelectorAll('.ActiveMenuSideBarBodyTab'))if(tab!==state.tab)tab.classList.remove('ActiveMenuSideBarBodyTab');
    }
  }
  function scan(){queued=false;if(stopped)return;
    for(const menu of menus.keys())if(!menu.isConnected)menus.delete(menu);
    for(const menu of document.querySelectorAll('.SettingsMenu')){
      let state=menus.get(menu);if(!state){state={tab:null};menus.set(menu,state);}
      if(menu.hidden||getComputedStyle(menu).display==='none')state.tab=null;
      apply(menu,state);
    }
  }
  function schedule(){if(!queued&&!stopped){queued=true;queueMicrotask(scan);}}
  function click(event){const tab=event.target.closest?.('.MenuSideBarBodyTab'),menu=tab?.closest('.SettingsMenu');if(!menu)return;
    const state=menus.get(menu)||{tab:null};state.tab=tab;menus.set(menu,state);
    // Run again after every mod listener and React's native update.
    apply(menu,state);schedule();
  }
  function reset(){for(const [menu,state]of menus){state.tab=null;apply(menu,state);}}
  function locked(){if(document.pointerLockElement)reset();}
  const observer=new MutationObserver(records=>{
    // Toolbar shortcuts can open a mod page without clicking its sidebar tab.
    // Adopt a single newly selected category before enforcing exclusivity.
    for(const menu of new Set(records.filter(r=>r.type==='attributes'&&r.attributeName==='class'&&r.target.matches('.SettingsMenu')).map(r=>r.target))){
      const selected=definitions.filter(([cls])=>menu.classList.contains(cls));
      if(selected.length===1){const state=menus.get(menu)||{tab:null};state.tab=menu.querySelector(selected[0][1]);menus.set(menu,state);}
    }
    if(records.some(record=>record.type==='attributes'
      ?record.target.matches('.SettingsMenu,.MenuSideBarBodyTab')
      :[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.matches?.('.SettingsMenu,.MenuSideBarBody,.MenuSideBarSection,.SettingsMenuRight,.MenuSideBarBodyTab,.SettingsMenuRightInner')||node.querySelector?.('.SettingsMenu,.SettingsMenuRight,.MenuSideBarBodyTab')))))schedule();
  });
  function boot(){observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','style']});scan();}
  document.addEventListener('click',click,true);document.addEventListener('pointerlockchange',locked);addEventListener('blur',reset);
  globalThis.__BLOXDY_SETTINGS_NAVIGATION__={reset};
  addEventListener('pagehide',()=>{stopped=true;observer.disconnect();document.removeEventListener('click',click,true);document.removeEventListener('pointerlockchange',locked);removeEventListener('blur',reset);menus.clear();},{once:true});
  if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
};
