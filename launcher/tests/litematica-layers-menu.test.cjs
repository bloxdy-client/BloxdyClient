'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{menu,sample}=require('./litematica-menu-fixture.cjs'),{managedSource}=require('../adapters.cjs');
test('Above and below layer choices expose the boundary layer, retain inclusive filtering and keep auto advance Single-only',t=>{
 const h=menu(t);h.ui.setModel(sample());const input=h.field('layerMode'),root=input.nextElementSibling;
 assert.deepEqual([...input.options].map(option=>[option.value,option.textContent]),[['all','All layers'],['single','Single layer'],['above','All layers above'],['below','All layers below']]);
 for(const [mode,expected]of [['above',[false,true,true]],['below',[true,true,false]]]){
  root.querySelector('[role="combobox"]').click();[...root.querySelectorAll('[role="option"]')].find(option=>option.textContent==='All layers '+mode).dispatchEvent(new h.w.MouseEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));
  assert.equal(h.w.__BLOXD_LITEMATICA__.diagnostics().settings.layerMode,mode);assert.equal(h.field('layer').closest('[hidden]'),null);assert.equal(h.field('autoLayer').disabled,true);assert.equal(h.ui.change('autoLayer',true),false);
  h.ui.change('layer',1);assert.deepEqual([0,1,2].map(y=>h.w.__BLM_MODEL__.layerVisible(y,mode,1)),expected);const controls=h.field('layer').parentElement.parentElement;controls.lastElementChild.click();assert.equal(h.field('layer').value,'1');controls.children[1].click();assert.equal(h.field('layer').value,'0');
 }
 h.ui.change('layerMode','single');assert.equal(h.field('autoLayer').disabled,false);h.ui.change('layerMode','all');assert.ok(h.field('layer').closest('[hidden]'));assert.deepEqual(h.errors,[]);
});
test('Materials and Settings have regular titles, unrotated right/down chevrons and the same circle-info SVG as Shader help',t=>{
 const h=menu(t,{nativeCss:'.ControlsSectionTitle{font-weight:700}.ControlsSectionChevron{transform:rotate(-90deg);rotate:180deg}'});
 for(const title of ['Materials','Settings']){const group=h.group(title),header=group.querySelector('.ControlsSectionHeader'),arrow=header.querySelector('.ControlsSectionChevron');assert.equal(h.w.getComputedStyle(header).fontWeight,'400');assert.equal(h.w.getComputedStyle(header.querySelector('.ControlsSectionTitle')).fontWeight,'400');
  assert.equal(header.getAttribute('aria-expanded'),'false');assert.equal(arrow.textContent,'▸');assert.equal(h.w.getComputedStyle(arrow).transform,'none');assert.equal(h.w.getComputedStyle(arrow).rotate,'none');header.click();assert.equal(arrow.textContent,'▾');assert.equal(header.getAttribute('aria-expanded'),'true');header.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Enter',bubbles:true,cancelable:true}));assert.equal(arrow.textContent,'▸');assert.equal(h.w.getComputedStyle(arrow).transform,'none');
 }
 const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/bloxd-visual-shader-5.6.14.2.bnmod'))),shader=managedSource('bloxd-visual-shader','shader.js',Buffer.from(pack.files.find(file=>file.path==='shader.js').data,'base64').toString()),svg=/const circleInfoSvg = '([^']+)'/.exec(shader)[1],iconPath=/ d="([^"]+)"/.exec(svg)[1];
 for(const icon of h.page.querySelectorAll('.blm-help-button svg')){assert.equal(icon.getAttribute('data-icon'),'circle-info');assert.equal(icon.querySelector('path').getAttribute('d'),iconPath);}assert.equal(h.page.querySelector('[data-icon="circle-question"]'),null);assert.deepEqual(h.errors,[]);
});
