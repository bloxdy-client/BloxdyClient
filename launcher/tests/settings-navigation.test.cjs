'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const navigation=require('../settings-navigation.cjs');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('All mod categories have exclusive content and selection across clicks, shortcuts and reopen',async t=>{
  const dom=new JSDOM('<body><div id="game"></div><div class="SettingsMenu"><div class="MenuSideBarBody"><div class="MenuSideBarBodyTab ActiveMenuSideBarBodyTab" id="graphics">Graphics</div></div><div class="SettingsMenuRight"><div class="SettingsMenuRightInner" id="native">Graphics</div></div></div></body>',{runScripts:'outside-only'}),w=dom.window,d=w.document;
  t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});w.eval(`(${navigation.toString()})();`);
  const menu=d.querySelector('.SettingsMenu'),sidebar=d.querySelector('.MenuSideBarBody'),right=d.querySelector('.SettingsMenuRight');
  const mods=[['zoomer','zoomer-selected','zoomer-page'],['grassify','grassify-selected','grassify-page'],['litematica','blm-selected',''],['shader','bvfx-shader-selected','']];
  for(const [name,cls,pageClass]of mods){
    const tab=d.createElement('div');tab.className='MenuSideBarBodyTab';tab.setAttribute(`data-${name}-category`,'true');sidebar.append(tab);
    const page=d.createElement('div');page.className='SettingsMenuRightInner '+pageClass;
    if(name==='litematica')page.id='blm-settings-page';if(name==='shader'){page.setAttribute('role','tabpanel');page.setAttribute('aria-label','Shader');}right.append(page);
    // Model legacy listeners that do not clear the other mods' selected class.
    tab.addEventListener('click',()=>{menu.classList.add(cls);tab.classList.add('ActiveMenuSideBarBodyTab');});
    const style=d.createElement('style');style.textContent=`.SettingsMenu.${cls} .SettingsMenuRight>:not(${pageClass?'.'+pageClass:name==='litematica'?'#blm-settings-page':'[aria-label="Shader"]'}){display:none!important}`;d.head.append(style);
  }
  await flush();
  for(let round=0;round<2;round++)for(const [name,cls]of mods){
    const tab=sidebar.querySelector(`[data-${name}-category]`);tab.click();await flush();
    assert.deepEqual(mods.filter(([,c])=>menu.classList.contains(c)).map(([n])=>n),[name]);
    assert.deepEqual([...menu.querySelectorAll('.ActiveMenuSideBarBodyTab')],[tab]);assert.equal(tab.getAttribute('aria-selected'),'true');
  }
  d.getElementById('graphics').click();await flush();assert.ok(mods.every(([,cls])=>!menu.classList.contains(cls)));assert.notEqual(w.getComputedStyle(d.getElementById('native')).display,'none');
  menu.classList.add('bvfx-shader-selected');await flush();assert.equal(sidebar.querySelector('[data-shader-category]').getAttribute('aria-selected'),'true');
  Object.defineProperty(d,'pointerLockElement',{configurable:true,value:d.getElementById('game')});d.dispatchEvent(new w.Event('pointerlockchange'));await flush();
  assert.ok(mods.every(([,cls])=>!menu.classList.contains(cls)));
  sidebar.querySelector('[data-zoomer-category]').click();await flush();menu.hidden=true;await flush();menu.hidden=false;await flush();
  assert.ok(mods.every(([,cls])=>!menu.classList.contains(cls)));
  sidebar.querySelector('[data-grassify-category]').click();await flush();right.replaceChildren(d.createElement('div'));await flush();assert.ok(mods.every(([,cls])=>!menu.classList.contains(cls)));
});
