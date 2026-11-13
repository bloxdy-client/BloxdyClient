// Synthetic DOM/geometry only; never opens a browser, client or account.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
function setup(t,html,rect,{width=800,height=700}={}){
 const dom=new JSDOM(html,{runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window,d=w.document;
 Object.defineProperties(w,{innerWidth:{value:width},innerHeight:{value:height}});
 const anchor=d.querySelector('[data-anchor]');anchor.getBoundingClientRect=()=>rect;
 Object.defineProperties(w.HTMLElement.prototype,{offsetHeight:{get(){return this.classList.contains('select-menu')?Math.min(200,parseFloat(this.style.maxHeight)||200):0;}},scrollHeight:{get(){return 200;}}});
 w.eval(fs.readFileSync(path.join(__dirname,'../custom-select.js'),'utf8'));w.launcherSelect.enhance();
 const button=d.querySelector('.select-button');button.getBoundingClientRect=()=>({left:rect.left+40,top:rect.top+24,bottom:rect.bottom,width:rect.width-60});button.click();
 return {w,d,button,anchor,list:d.querySelector('.select-menu')};
}
test('Profile menu aligns with the entire field, clearing its label when opening above',t=>{
 const s=setup(t,'<div class="profile-picker-wrap" data-anchor><label>Active profile<select class="profile-picker"><option>Default</option><option>Shaders</option></select></label></div>',{left:30,top:500,bottom:575,width:400});
 assert.equal(s.list.style.width,'400px');assert.equal(s.list.style.left,'30px');assert.equal(s.list.style.top,'294px');assert.equal(s.list.dataset.side,'above');
 assert.equal(s.button.getAttribute('aria-expanded'),'true');s.w.launcherSelect.close();assert.equal(s.anchor.classList.contains('select-open'),false);
});
test('Account menu anchors below the complete account field rather than the inset button',t=>{
 const s=setup(t,'<label class="account-switch" data-anchor><select><option>Account</option></select></label>',{left:500,top:20,bottom:64,width:220});
 assert.equal(s.list.style.width,'220px');assert.equal(s.list.style.top,'70px');assert.equal(s.list.dataset.side,'below');
});
test('Ordinary fields keep their width and constrain a long list to the available viewport',t=>{
 const s=setup(t,'<label data-anchor>Appearance<select><option>Black</option><option>Gray</option></select></label>',{left:10,top:50,bottom:94,width:500},{width:320,height:240});
 // Ordinary select-control is itself the anchor.
 s.w.launcherSelect.close();const wrap=s.d.querySelector('.select-control');wrap.getBoundingClientRect=()=>({left:10,top:50,bottom:94,width:500});s.button.click();const list=s.d.querySelector('.select-menu');
 assert.equal(list.style.width,'296px');assert.equal(list.style.left,'12px');assert.equal(list.style.top,'100px');assert.equal(list.style.maxHeight,'128px');
});
