'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const source=require('../adapters.cjs').managedSource('bloxd-grassify','grassify.js',fs.readFileSync(path.join(__dirname,'../builtin-mods/grassify.js'),'utf8'));
function observable(){const listeners=new Set();return {add(fn){listeners.add(fn);return fn;},remove(fn){listeners.delete(fn);},fire(info){for(const fn of [...listeners])fn(info);},get size(){return listeners.size;}};}
function fixture(t,saved={}){
  const dom=new JSDOM('<div class="SettingsMenu"><div class="MenuSideBarBody"><button class="MenuSideBarBodyTab">Graphics</button></div><div class="SettingsMenuRight"><div id="native-page">Native settings</div></div></div>',{url:'https://bloxd.io',runScripts:'outside-only'}),w=dom.window;
  t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});Object.defineProperty(w.document,'readyState',{value:'loading'});Object.defineProperty(w.document,'hidden',{value:false});let clock=100;w.performance.now=()=>clock+=.001;
  const intervals=new Map();let next=0;w.setInterval=fn=>{intervals.set(++next,fn);return next;};w.clearInterval=id=>intervals.delete(id);
  w.HTMLCanvasElement.prototype.getContext=()=>{throw Error('No graphics contexts permitted');};w.fetch=()=>{throw Error('No network permitted');};
  w.localStorage.setItem('bloxdy:grassify:v1',JSON.stringify({style:'flat',...saved}));
  const params=new Map(),caps=new Set(),resources=new Set(),uploads=[],draws=[],uniforms={};let enumId=0,reads=0,throwDraw=false;
  const gl=new Proxy({}, {get(target,key){if(key in target)return target[key];if(/^[A-Z_\d]+$/.test(key))return target[key]=++enumId;throw Error('Unimplemented GL call '+key);}});
  for(const name of ['createProgram','createShader','createBuffer','createVertexArray'])gl[name]=()=>{const r={name,id:++next};resources.add(r);return r;};
  for(const name of ['deleteProgram','deleteShader','deleteBuffer','deleteVertexArray'])gl[name]=r=>resources.delete(r);
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram','enableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','bufferData'])gl[name]=()=>{};
  gl.getShaderParameter=gl.getProgramParameter=()=>true;gl.getUniformLocation=(_,name)=>name;gl.getParameter=key=>params.get(key);gl.isEnabled=key=>caps.has(key);gl.enable=key=>caps.add(key);gl.disable=key=>caps.delete(key);gl.isContextLost=()=>false;
  gl.useProgram=p=>params.set(gl.CURRENT_PROGRAM,p);gl.bindVertexArray=p=>params.set(gl.VERTEX_ARRAY_BINDING,p);gl.bindBuffer=(_,p)=>params.set(gl.ARRAY_BUFFER_BINDING,p);gl.depthFunc=p=>params.set(gl.DEPTH_FUNC,p);gl.depthMask=p=>params.set(gl.DEPTH_WRITEMASK,p);gl.colorMask=(...p)=>params.set(gl.COLOR_WRITEMASK,p);
  for(const name of ['uniformMatrix4fv','uniform3fv','uniform1f','uniform1i','uniform4fv'])gl[name]=(key,...v)=>uniforms[key]=v;
  gl.bufferSubData=(_,offset,data)=>uploads.push(Array.from(data));gl.drawArraysInstanced=(...args)=>{if(throwDraw)throw Error('Synthetic draw failure');draws.push(args);};
  gl.useProgram('native-program');gl.bindVertexArray('native-vao');gl.bindBuffer(0,'native-buffer');gl.depthFunc(gl.GREATER);gl.depthMask(false);gl.colorMask(false,true,false,true);gl.enable(gl.BLEND);gl.enable(gl.CULL_FACE);
  const submitted=new Set();const registerMesh=(mesh,position)=>{submitted.add(mesh);mesh.registeredPosition=position;};const scene={renderedMeshes:[],activeCamera:{position:{x:.5,y:0,z:.5}},onBeforeRenderObservable:observable(),onAfterRenderingGroupObservable:observable(),getEngine:()=>({_gl:gl}),getTransformMatrix:()=>({m:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])})};
  let block=1,activeScene=scene,actors=[{position:[.5,-1,.5],height:1.8,width:.7}];const noa={container:{},inputs:{},offset:[0,0,0]},layout={scene,registerMesh,originKey:'offset',world:{owner:{read(x,y,z){reads++;return x===0&&y===-2&&z===0?block:0;}},method:'read',loaded:()=>true},positions:()=>actors};
  w.__GRASSIFY_LAYOUT__=()=>({...layout,scene:activeScene});w.__BLOXD_MOD_HOST__={engine:()=>({singletons:{noa},getBloxd:()=>({getItemName:id=>id===1?'Grass Block':'Stone'})})};
  w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const field=name=>w.document.querySelector('[data-grassify-field="'+name+'"]');
  function change(name,value){const input=field(name);if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new w.Event(input.type==='range'?'input':'change',{bubbles:true}));}
  function webgpu(options={}){
    scene.meshes=[];scene.materials=[];scene.getEngine=()=>({isWebGPU:true});
    class Material{constructor(name,scene){this.name=name;this.scene=scene;this.diffuseColor={r:1,g:1,b:1};this.emissiveColor={r:0,g:0,b:0};scene.materials.push(this);resources.add(this);if(options.gpu){this.customShaderNameResolve=null;this.onBindObservable=observable();this.uniforms={};this._activeEffect={};for(const name of ['setFloat4','setFloat','setArray4'])this._activeEffect[name]=(key,...values)=>{this.uniforms[key]=values.map(v=>ArrayBuffer.isView(v)?Array.from(v):v);};}}getClassName(){return 'MinifiedMaterial';}dispose(){resources.delete(this);this.scene.materials=this.scene.materials.filter(m=>m!==this);}}
    class Mesh{constructor(name,scene){this.name=name;this.scene=scene;this.position={x:0,y:0,z:0};this.buffers={};scene.meshes.push(this);resources.add(this);}setVerticesData(k,data){this.buffers[k]=Array.from(data);}setIndices(data){this.indices=Array.from(data);}updateVerticesData(k,data){this.buffers[k]=Array.from(data);this.positionUpdates=(this.positionUpdates||0)+1;}dispose(){submitted.delete(this);resources.delete(this);this.scene.meshes=this.scene.meshes.filter(m=>m!==this);}}
    const native=new Material('Original native material',scene);resources.delete(native);noa.mesher={babylon:{Mesh}};return native;
  }
  return {w,gl,scene,noa,registerMesh,submitted,webgpu,params,caps,resources,intervals,draws,uploads,uniforms,field,change,get reads(){return reads;},tick(){for(const fn of [...intervals.values()])fn();},frame(dt=50){clock+=dt;scene.onBeforeRenderObservable.fire();scene.renderedMeshes=(scene.meshes||[]).filter(mesh=>submitted.has(mesh));scene.gpuBinds=[];for(const mesh of scene.renderedMeshes){const m=mesh.material;if(m.customShaderNameResolve&&!m.compiled){const options={},defines={_keys:[]};m.customShaderNameResolve('default',[],[],[],defines,[],options);m.vertexCode=options.processFinalCode('vertex',fs.readFileSync(path.join(__dirname,'fixtures/grassify-native-vertex.glsl'),'utf8'));m.compiled=true;}m.onBindObservable?.fire(mesh);if(m.uniforms)scene.gpuBinds.push({mesh,values:JSON.parse(JSON.stringify(m.uniforms))});}scene.onAfterRenderingGroupObservable.fire({renderingGroupId:0,camera:scene.activeCamera});},setActors(v){actors=v;},setBlock(v){block=v;},setScene(v){activeScene=v;},failDraw(){throwDraw=true;}};
}
test('Grassify stays idle when off and mounts native-style settings with requested ranges and color reset',t=>{
  const f=fixture(t);assert.equal(f.resources.size,0);assert.equal(f.intervals.size,0);assert.equal(f.reads,0);
  f.w.document.querySelector('.SettingsMenu').classList.add('blm-selected','bvfx-shader-selected');f.w.document.querySelector('[data-grassify-category]').click();assert.ok(f.w.document.querySelector('.grassify-selected'));assert.equal(f.w.document.querySelector('.blm-selected,.bvfx-shader-selected'),null);
  assert.equal(f.field('distance').min,'1');assert.equal(f.field('distance').max,'100');assert.equal(f.field('height').min,'0.1');assert.equal(f.field('height').max,'3');
  f.change('color','#123456');f.w.document.querySelector('[aria-label="Reset grass color"]').click();assert.equal(f.field('color').value,'#70a844');
  f.w.document.querySelector('.MenuSideBarBodyTab').click();assert.equal(f.w.document.querySelector('.grassify-selected'),null);
});
test('Grassify creates actual instanced blades on exposed grass at one-block distance and restores GL state',t=>{
  const f=fixture(t,{distance:1,density:10});f.change('enabled',true);const before=new Map(f.params),caps=[...f.caps];f.frame();assert.equal(f.draws.length,1);assert.equal(f.draws[0][3],10);assert.equal(f.uploads[0].length,10*6);assert.equal(f.uniforms.actorCount[0],1);assert.deepEqual(f.params,before);assert.deepEqual([...f.caps].sort(),caps.sort());
  f.scene.onAfterRenderingGroupObservable.fire({renderingGroupId:0});assert.equal(f.draws.length,1,'Only one grass draw per world frame');
  f.setBlock(2);f.frame();assert.equal(f.w.__GRASSIFY__.diagnostics().blades,0,'Removed grass does not leave blades');
});
test('disable releases every grass GPU object, callback, timer, cell and actor record; repeat enable works',t=>{
  const f=fixture(t);for(let i=0;i<3;i++){f.change('enabled',true);f.frame();assert.ok(f.resources.size>0);f.change('enabled',false);assert.equal(f.resources.size,0);assert.equal(f.intervals.size,0);assert.equal(f.scene.onBeforeRenderObservable.size,0);assert.equal(f.scene.onAfterRenderingGroupObservable.size,0);const reads=f.reads;f.frame();f.tick();assert.equal(f.reads,reads);assert.equal(f.w.__GRASSIFY__.diagnostics().active,false);}
});
test('render failures restore native GL state and remove all Grassify work',t=>{
  const f=fixture(t,{enabled:true});const before=new Map(f.params);f.failDraw();f.frame();assert.deepEqual(f.params,before);assert.equal(f.resources.size,0);assert.equal(f.intervals.size,0);assert.match(f.w.__GRASSIFY__.diagnostics().status,/Synthetic draw failure/);
});
test('world departure disposes renderer; pagehide also disconnects UI lifecycle',t=>{
  const f=fixture(t,{enabled:true});f.frame();f.setScene(null);f.tick();assert.equal(f.resources.size,0);assert.equal(f.scene.onAfterRenderingGroupObservable.size,0);f.w.dispatchEvent(new f.w.Event('pagehide'));assert.equal(f.intervals.size,0);assert.equal(f.w.document.querySelector('.grassify-page'),null);
});
test('missing render-origin evidence and unavailable native scene APIs leave no grass GPU resources',t=>{
  const f=fixture(t);f.scene.getEngine=()=>({});f.change('enabled',true);assert.match(f.w.__GRASSIFY__.diagnostics().status,/Waiting for Bloxd mesh API/);assert.equal(f.resources.size,0);f.change('enabled',false);assert.equal(f.intervals.size,0);
  f.scene.getEngine=()=>({_gl:f.gl});const layout=f.w.__GRASSIFY_LAYOUT__;f.w.__GRASSIFY_LAYOUT__=()=>({...layout(),originKey:null});f.change('enabled',true);assert.equal(f.resources.size,0);assert.equal(f.reads,0);
});
test('native Bloxd CSS controls Grassify page, boxes, checkbox, sliders and reset button',t=>{
  const f=fixture(t),d=f.w.document,style=d.createElement('style');style.textContent=require('./fixtures/native-bloxd-ui-2026-10-23.json').css;d.head.append(style);
  const page=d.querySelector('.grassify-page'),native=d.createElement('div');native.className='SettingsMenuRightInner';native.innerHTML='<div class="SettingBox"><div class="SliderText">Native</div></div><div class="SettingBox CheckboxContainer"><div class="CheckboxInputAndText"><span class="rc-checkbox rc-checkbox-checked SettingsCheckbox"><input type="checkbox" class="rc-checkbox-input"><span class="rc-checkbox-inner"></span></span><div class="CheckboxText">Native</div></div></div><div class="SettingBox SettingsSliderDiv"><div class="SliderDiv"><div class="rangeslider rangeslider-horizontal"><div class="rangeslider__fill"></div><div class="rangeslider__handle"></div></div></div></div><div class="NewButton GoldButton"><div class="ButtonBody">Reset</div></div>';page.after(native);
  const pairs=[[page,native,['padding','max-width','gap','display']],[page.querySelector('.SettingBox'),native.querySelector('.SettingBox'),['background-color','padding','border']],[page.querySelector('.CheckboxText'),native.querySelector('.CheckboxText'),['font-size','margin-left']],[page.querySelector('.rangeslider'),native.querySelector('.rangeslider'),['height','background-color','border-radius']],[page.querySelector('.rangeslider__handle'),native.querySelector('.rangeslider__handle'),['width','height','background-color','border']],[page.querySelector('.rangeslider__fill'),native.querySelector('.rangeslider__fill'),['background-color']],[page.querySelector('.ButtonBody'),native.querySelector('.ButtonBody'),['padding']]];
  for(const [actual,reference,properties]of pairs)for(const property of properties)assert.equal(f.w.getComputedStyle(actual).getPropertyValue(property),f.w.getComputedStyle(reference).getPropertyValue(property),actual.className+' '+property);
  assert.equal(f.w.getComputedStyle(page).padding,'2rem');assert.equal(f.w.getComputedStyle(page.querySelector('.rangeslider__handle')).width,'30px');assert.equal(page.querySelectorAll('input[type=range]:not([hidden])').length,0);assert.equal(d.querySelector('[data-grassify-category]').tagName,'DIV');assert.ok(d.querySelector('[data-grassify-category] .MenuSideBarBodyTabIcon svg'));
});
test('native checkbox toggles by row, label and keyboard; custom slider handles support keyboard and pointer drag',async t=>{
  const f=fixture(t),d=f.w.document,checkbox=f.field('enabled'),row=checkbox.closest('.SettingBox');
  row.querySelector('.CheckboxText').click();await Promise.resolve();assert.equal(checkbox.checked,true);assert.ok(checkbox.closest('.rc-checkbox-checked'));
  row.querySelector('.CheckboxClickableLabel').click();await Promise.resolve();assert.equal(checkbox.checked,false);assert.equal(f.resources.size,0);
  checkbox.dispatchEvent(new f.w.KeyboardEvent('keydown',{code:'Space',bubbles:true,cancelable:true}));assert.equal(checkbox.checked,true);
  const handle=f.field('height').closest('.SettingBox').querySelector('[role=slider]'),key=code=>handle.dispatchEvent(new f.w.KeyboardEvent('keydown',{code,bubbles:true,cancelable:true}));
  key('End');assert.equal(handle.getAttribute('aria-valuenow'),'3');key('ArrowLeft');assert.equal(f.field('height').value,'2.9');key('Home');assert.equal(handle.getAttribute('aria-valuenow'),'0.1');
  const track=handle.parentElement;track.getBoundingClientRect=()=>({left:0,width:100});const pointer=(type,x)=>{const e=new f.w.MouseEvent(type,{clientX:x,button:0,bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:1});track.dispatchEvent(e);};pointer('pointerdown',50);pointer('pointermove',100);pointer('pointerup',100);assert.equal(f.field('height').value,'3');assert.equal(track.querySelector('.rangeslider__fill').style.width,'100%');assert.equal(handle.style.left,'100%');
});
test('installed Grassify versions receive current settings and renderer through the managed adapter',()=>{
 const {managedSource}=require('../adapters.cjs');for(const version of ['0.1.0','0.1.1','0.2.0']){
 const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/bloxd-grassify-'+version+'.bnmod'))),original=Buffer.from(pack.files.find(f=>f.path==='grassify.js').data,'base64').toString();
 assert.equal(managedSource('bloxd-grassify','grassify.js',original),source);
 }
});
test('reset uses native Bloxd button chrome without browser button padding or text color',t=>{
  const f=fixture(t),d=f.w.document,style=d.createElement('style');style.textContent=require('./fixtures/native-bloxd-ui-2026-10-23.json').css;d.head.append(style);
  const reset=d.querySelector('[aria-label="Reset grass color"]'),reference=d.createElement('div');reference.className='NewButton GoldButton';reference.innerHTML='<div class="ButtonBottomBorder"></div><div class="ButtonTopBorder"></div><div class="ButtonBody">Reset</div>';reset.after(reference);
  assert.equal(reset.tagName,'DIV');assert.equal(reset.getAttribute('role'),'button');assert.equal(reset.tabIndex,0);
  for(const property of ['padding','color','border','border-radius','box-shadow','font-family'])assert.equal(f.w.getComputedStyle(reset).getPropertyValue(property),f.w.getComputedStyle(reference).getPropertyValue(property),property);
  for(const code of ['Enter','Space']){f.change('color','#123456');const event=new f.w.KeyboardEvent('keydown',{code,bubbles:true,cancelable:true});reset.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(f.field('color').value,'#70a844');}
});
test('native scene path owns mesh geometry and material without raw GL; off removes everything',t=>{
  const f=fixture(t,{density:10,distance:1}),original=f.webgpu(),originalColor={...original.emissiveColor};
  for(let pass=0;pass<2;pass++){
    f.change('enabled',true);f.frame();assert.equal(f.draws.length,0);assert.equal(f.scene.meshes.length,1);assert.equal(f.scene.materials.length,2);const mesh=f.scene.meshes[0];assert.equal(mesh.indices.length,10*18);assert.equal(mesh.buffers.position.length,10*8*3);assert.equal(mesh.material.disableLighting,true);assert.equal(f.w.__GRASSIFY__.diagnostics().backend,'scene-webgl');
    f.change('color','#112233');f.frame();assert.ok(Math.abs(mesh.material.emissiveColor.r-17/255)<1e-6);assert.deepEqual(original.emissiveColor,originalColor);
    f.change('enabled',false);assert.equal(f.scene.meshes.length,0);assert.deepEqual(f.scene.materials,[original]);assert.equal(f.resources.size,0);assert.equal(f.scene.onBeforeRenderObservable.size,0);assert.equal(f.intervals.size,0);const reads=f.reads;f.frame();assert.equal(f.reads,reads);
  }
});
test('native scene path discovers mesh and material constructors with minified class names',t=>{
  const f=fixture(t,{density:5,distance:1}),native=f.webgpu();
  const terrain=new f.noa.mesher.babylon.Mesh('Native terrain',f.scene);terrain.material=native;f.resources.delete(terrain);
  delete f.noa.mesher;f.scene.materials=[];
  f.change('enabled',true);f.frame();
  assert.equal(f.w.__GRASSIFY__.diagnostics().backend,'scene-webgl',f.w.__GRASSIFY__.diagnostics().status);
  assert.equal(f.scene.meshes.length,2);assert.equal(f.scene.meshes[1].indices.length,5*18);
  f.change('enabled',false);assert.deepEqual(f.scene.meshes,[terrain]);assert.equal(f.resources.size,0);
  assert.equal(f.scene.onBeforeRenderObservable.size,0);assert.equal(f.intervals.size,0);
});
test('native scene path updates height, origin, movement and block edits',t=>{
  const f=fixture(t,{density:5,distance:1});f.webgpu();f.change('enabled',true);f.frame();const mesh=f.scene.meshes[0],before=[...mesh.buffers.position];f.change('height',5);f.frame();assert.notDeepEqual(mesh.buffers.position,before);assert.ok(Math.max(...mesh.buffers.position.filter((_,i)=>i%3===1))<=5.006);
  f.noa.offset=[10,20,30];f.scene.activeCamera.position={x:-9.5,y:-20,z:-29.5};f.frame();assert.deepEqual(mesh.position,{x:-10,y:-21,z:-30});
  f.setBlock(2);f.frame();assert.equal(f.scene.meshes.length,0);assert.equal(f.w.__GRASSIFY__.diagnostics().blades,0);
});
test('native scene upload failure releases partial mesh, material and render subscription',t=>{
  const f=fixture(t);f.webgpu();f.noa.mesher.babylon.Mesh.prototype.setIndices=()=>{throw Error('Synthetic native upload failure');};f.change('enabled',true);f.frame();assert.equal(f.resources.size,0);assert.equal(f.scene.meshes.length,0);assert.equal(f.scene.materials.length,1);assert.equal(f.scene.onBeforeRenderObservable.size,0);assert.equal(f.intervals.size,0);assert.match(f.w.__GRASSIFY__.diagnostics().status,/Synthetic native upload failure/);
});

test('discovers the world engine without an inputs property, including inside the current client',t=>{
  const f=fixture(t);delete f.noa.inputs;f.w.__BLOXD_MOD_HOST__.engine=()=>({singletons:{bloxd:{client:{world:f.noa}}},getBloxd:()=>({getItemName:id=>id===1?'Grass Block':'Stone'})});
  f.change('enabled',true);f.frame();assert.equal(f.w.__GRASSIFY__.diagnostics().active,true);assert.ok(f.w.__GRASSIFY__.diagnostics().blades>0);
});
test('distinguishes a missing mod host from an ambiguous world scene',t=>{
  const f=fixture(t);f.w.__BLOXD_MOD_HOST__.engine=()=>null;f.change('enabled',true);assert.match(f.w.__GRASSIFY__.diagnostics().status,/mod host/);
  f.w.__BLOXD_MOD_HOST__.engine=()=>({singletons:{a:f.noa,b:{container:{}}}});f.tick();assert.match(f.w.__GRASSIFY__.diagnostics().status,/unambiguous/);assert.equal(f.w.__GRASSIFY__.diagnostics().active,false);
});
test('Bloxd Lite renderer cannot silently report visible grass for an undrawn scene mesh',t=>{
  const f=fixture(t);const layout=f.w.__GRASSIFY_LAYOUT__;
  f.w.__GRASSIFY_LAYOUT__=noa=>({...layout(noa),renderer:{tP:{render(){}}}});
  f.change('enabled',true);
  assert.match(f.w.__GRASSIFY__.diagnostics().status,/needs WebGL2/);
  assert.equal(f.w.__GRASSIFY__.diagnostics().active,false);
  assert.equal(f.resources.size,0);
});
test('current Noa-style world, renderer and client structure reaches visible scene meshes',t=>{
  const f=fixture(t,{density:5,distance:1}),material=f.webgpu();
  const terrain=new f.noa.mesher.babylon.Mesh('Native terrain',f.scene);terrain.material=material;f.resources.delete(terrain);
  class World{
    constructor(){this.ET={HT:()=>({qe:{get:(x,y,z)=>x===0&&y===-2&&z===0?1:0}})};}
    nI(x,y,z){return [x,y,z];}
    VI(x,y,z){return [x,y,z];}
    qQ(x,y,z){var [a,b,c]=this.nI(x,y,z),d=this.ET.HT(a,b,c);if(!d)return 0;var [e,g,h]=this.VI(x,y,z);return d.qe.get(e,g,h);}
  }
  class Noa{constructor(scene){this.MT=[0,0,0];this.container={};this.entities={};this.Bx={mj:scene,tP:null};this.Ne=new World;}}
  const noa=new Noa(f.scene);
  f.w.eval(fs.readFileSync(path.join(__dirname,'../builtin-mods/grassify-runtime.js'),'utf8'));
  const discover=f.w.__GRASSIFY_LAYOUT__;f.w.__GRASSIFY_LAYOUT__=value=>({...discover(value),registerMesh:f.registerMesh});
  f.w.__BLOXD_MOD_HOST__.engine=()=>({singletons:{bloxd:{client:{He:noa}}},getBloxd:()=>({getItemName:id=>id===1?'Grass Block':'Stone'})});
  f.change('enabled',true);f.frame();
  assert.equal(f.w.__GRASSIFY__.diagnostics().backend,'scene-webgl',f.w.__GRASSIFY__.diagnostics().status);
  assert.equal(f.w.__GRASSIFY__.diagnostics().blades,5);
  assert.equal(f.scene.meshes.length,2);
});

test('500 blades per block exceed the old global cap with safe tile indices and rendered-block counts',t=>{
 const f=fixture(t),native=f.webgpu(),{createSceneGrass}=require('../grassify-scene.cjs');
 const settings={density:500,height:5,width:.04,distance:100,color:'#70a844'};
 const create=f.w.eval('('+createSceneGrass.toString()+')');const runtime=create({scene:f.scene,noa:f.noa,layout:{registerMesh:f.registerMesh},camera:()=>[8,2,7],origin:()=>[0,0,0],read:(_x,y)=>y===0?1:0,grass:id=>id===1,actors:()=>[]},()=>settings,{limit:Infinity,hash:(_x,_y,_z,i)=>(i%4)/4,scan:function*(){for(let x=0;x<18;x++)for(let z=0;z<15;z++)yield [x,0,z];},onError:error=>{throw error;}});
 t.after(()=>runtime.dispose());for(let i=0;i<4;i++)f.frame();
 assert.equal(runtime.stats().blades,135000);assert.equal(runtime.stats().renderedBlocks,270);
 for(const mesh of f.scene.meshes){assert.ok(mesh.indices.every(i=>i<mesh.buffers.position.length/3));const p=mesh.buffers.position;
 const rootWidth=Math.hypot(p[3]-p[0],p[5]-p[2]),tipWidth=Math.hypot(p[21]-p[18],p[23]-p[20]);assert.ok(Math.abs(rootWidth-.04)<1e-5);assert.ok(Math.abs(rootWidth-tipWidth)<1e-5);}
 runtime.dispose();assert.deepEqual(f.scene.materials,[native]);assert.equal(f.resources.size,0);
});
test('new controls default to 50 blades, snap by five and expose height/thickness',t=>{
 const f=fixture(t);assert.equal(f.field('density').value,'50');assert.equal(f.field('density').max,'1000');assert.equal(f.field('density').step,'5');assert.equal(f.field('height').step,'0.1');assert.ok(f.field('width'));
 f.change('density',499);assert.equal(f.field('density').value,'500');f.change('height',2.66);assert.equal(f.field('height').value,'2.7');
});

test('Round has genuine closed volume, Realistic has curved tapered blades, and 1000 is exact',t=>{
 for(const [style,vertices,indices] of [['round',40,228],['realistic',21,72],['flat',8,18]]){
 const f=fixture(t,{style,density:1000,distance:1,wind:0,height:3});f.webgpu();f.setActors([]);f.change('enabled',true);f.frame();
 const mesh=f.scene.meshes[0];assert.ok(f.scene.renderedMeshes.includes(mesh),'native scene submits only registered meshes');assert.equal(f.w.__GRASSIFY__.diagnostics().blades,1000);assert.equal(mesh.buffers.position.length,1000*vertices*3);assert.equal(mesh.indices.length,1000*indices);assert.ok(mesh.indices.every(i=>i<1000*vertices));
 if(style==='round'){const p=mesh.buffers.position;const xs=[],zs=[];for(let i=0;i<8;i++){xs.push(p[i*3]);zs.push(p[i*3+2]);}assert.ok(Math.max(...xs)-Math.min(...xs)>.02);assert.ok(Math.max(...zs)-Math.min(...zs)>.02);}
 if(style==='realistic'){assert.equal(mesh.material.disableLighting,true);const p=mesh.buffers.position;assert.ok(Math.hypot(p[6]-p[0],p[8]-p[2])>Math.hypot(p[60]-p[54],p[62]-p[56])*10);}
 }
});
test('Wind zero is still, speed 100 moves at 60Hz, and walking bends then releases grass',t=>{
 const f=fixture(t,{style:'round',density:50,distance:1,wind:0});f.webgpu();f.setActors([]);f.change('enabled',true);f.frame();const mesh=f.scene.meshes[0],rest=[...mesh.buffers.position];
 for(let i=0;i<12;i++)f.frame(16);assert.deepEqual(mesh.buffers.position,rest);
 f.change('wind',100);for(let i=0;i<12;i++)f.frame(16);assert.notDeepEqual(mesh.buffers.position,rest,'nearby updates must not reset their clock before deforming');
 f.change('wind',0);for(let i=0;i<80;i++)f.frame(16);const settled=[...mesh.buffers.position];
 f.setActors([{GP:1,position:[-.5,-1,.5],height:1.8,width:.7}]);f.frame();f.setActors([{GP:1,position:[1.2,-1,.5],height:1.8,width:.7}]);f.frame();const pressed=[...mesh.buffers.position];assert.notDeepEqual(pressed,settled);
 f.setActors([]);for(let i=0;i<100;i++)f.frame(16);const error=a=>a.reduce((sum,v,i)=>sum+Math.abs(v-rest[i]),0);assert.ok(error(mesh.buffers.position)<error(pressed)*.1,'contact decays smoothly after the actor leaves');
 assert.equal(f.field('wind').min,'0');assert.equal(f.field('wind').max,'100');assert.equal(f.field('wind').step,'1');
 f.w.document.querySelector('[data-grassify-style="realistic"]').click();assert.equal(f.w.__GRASSIFY__.diagnostics().settings.style,'realistic');assert.equal(f.w.document.querySelector('[data-grassify-style="realistic"]').getAttribute('aria-pressed'),'true');
});
test('actual source position-list name is available through the current ECS reader',t=>{
 const f=fixture(t);f.webgpu();const positions=[{position:[0,0,0],width:.8,height:1.8}];f.noa.entities={names:{position:'position'},ZQ(name){assert.equal(name,'position');return positions;}};
 f.w.eval(fs.readFileSync(path.join(__dirname,'../builtin-mods/grassify-runtime.js'),'utf8'));assert.equal(f.w.__GRASSIFY_LAYOUT__(f.noa).positions(),positions);
});

test('dense round tiles preserve indices above 65535 without wrapped blades',t=>{
 const f=fixture(t);f.webgpu();const {createSceneGrass}=require('../grassify-scene.cjs'),create=f.w.eval('('+createSceneGrass.toString()+')');
 const settings={style:'round',wind:0,density:1000,height:1,width:.025,distance:10,color:'#70a844'};
 const runtime=create({scene:f.scene,noa:f.noa,layout:{registerMesh:f.registerMesh},camera:()=>[1,2,1],origin:()=>[0,0,0],read:(_x,y)=>y===0?1:0,grass:id=>id===1,actors:()=>[]},()=>settings,{limit:Infinity,hash:(_x,_y,_z,i)=>(i%4)/4,scan:function*(){yield [0,0,0];yield [0,0,1];yield [1,0,0];yield [1,0,1];},onError:error=>{throw error;}});
 t.after(()=>runtime.dispose());f.frame();const mesh=f.scene.meshes[0];assert.equal(runtime.stats().blades,4000);assert.equal(mesh.buffers.position.length,4000*40*3);assert.equal(mesh.indices.reduce((a,b)=>Math.max(a,b),0),159999);assert.ok(mesh.indices.every(i=>i<160000));
});

test('missing native registration cannot report prepared grass as an active renderer',t=>{
 const f=fixture(t,{style:'round'});f.webgpu();const layout=f.w.__GRASSIFY_LAYOUT__;f.w.__GRASSIFY_LAYOUT__=noa=>({...layout(noa),registerMesh:undefined});
 f.change('enabled',true);f.frame();assert.equal(f.w.__GRASSIFY__.diagnostics().active,false);assert.match(f.w.__GRASSIFY__.diagnostics().status,/mesh registration API/);assert.equal(f.resources.size,0);
});
test('isolated official registration function joins native selection at world coordinates and removes on disposal',t=>{
 const f=fixture(t);f.webgpu();const vm=require('node:vm'),record=require('./fixtures/grassify-registration-2026-10-29.json'),selected=new Map();
 const add=vm.runInNewContext('('+record.function+')',{jM:class Metadata{},Vx:'noa_added_to_scene',Ae:{d:{xk(){},SQ(){}}}});
 class Renderer{constructor(){this.scene=f.scene;this.He={cP(world,_unused,out){world.forEach((v,i)=>out[i]=v-[100,20,300][i]);return out;}};this.wL={xk(mesh,isStatic,world){selected.set(mesh,{isStatic,world});},SQ(mesh){selected.delete(mesh);}};}}
 Renderer.prototype.renamedAdd=add;f.noa.renderer=new Renderer();
 f.w.eval(fs.readFileSync(path.join(__dirname,'../builtin-mods/grassify-runtime.js'),'utf8'));const layout=f.w.__GRASSIFY_LAYOUT__(f.noa);assert.equal(typeof layout.registerMesh,'function');
 const disposed=observable(),mesh={position:{x:0,y:0,z:0,XP(){return [this.x,this.y,this.z];},vP(p){[this.x,this.y,this.z]=p;}},Xk:disposed};
 layout.registerMesh(mesh,[110,21,310]);assert.equal(selected.size,1);assert.equal(selected.get(mesh).isStatic,false);assert.deepEqual(selected.get(mesh).world,[110,21,310]);assert.deepEqual([mesh.position.x,mesh.position.y,mesh.position.z],[10,1,10]);disposed.fire();assert.equal(selected.size,0);
});
test('registration failure disposes partial geometry rather than reporting success',t=>{
 const f=fixture(t,{style:'round'});f.webgpu();const layout=f.w.__GRASSIFY_LAYOUT__;f.w.__GRASSIFY_LAYOUT__=noa=>({...layout(noa),registerMesh(){throw Error('Synthetic selection failure');}});
 f.change('enabled',true);f.frame();assert.equal(f.resources.size,0);assert.equal(f.scene.meshes.length,0);assert.match(f.w.__GRASSIFY__.diagnostics().status,/Synthetic selection failure/);
});

test('non-square densities have no partially empty final row or repeated empty bands',t=>{
 const f=fixture(t,{style:'flat',density:50,distance:1,wind:0});f.webgpu();f.setActors([]);f.change('enabled',true);f.frame();const p=f.scene.meshes[0].buffers.position,x=[],z=[];
 for(let i=0;i<50;i++){x.push((p[i*24]+p[i*24+3])*.5);z.push((p[i*24+2]+p[i*24+5])*.5);}
 const gap=values=>{const a=[0,...[...values].sort((a,b)=>a-b),1];return Math.max(...a.slice(1).map((v,i)=>v-a[i]));};assert.ok(gap(x)<.065);assert.ok(gap(z)<.065);
 assert.ok(x.some((v,i)=>v>.5&&z[i]>.8),'the final strip covers the whole block width');
});
test('Realistic custom colors retain channel ratios and use only neutral vertex shading',t=>{
 const f=fixture(t,{style:'realistic',density:50,distance:1,wind:0});f.webgpu();f.setActors([]);f.change('enabled',true);f.frame();const mesh=f.scene.meshes[0];
 for(const hex of ['#2040e0','#e03090','#eeeeee','#000000']){f.change('color',hex);f.frame();assert.equal(mesh.material.disableLighting,true);for(const [i,k]of ['r','g','b'].entries()){assert.equal(mesh.material.emissiveColor[k],parseInt(hex.slice(1+i*2,3+i*2),16)/255);assert.equal(mesh.material.diffuseColor[k],0);}}
 const colors=mesh.buffers.color;for(let i=0;i<colors.length;i+=4){assert.equal(colors[i],colors[i+1]);assert.equal(colors[i+1],colors[i+2]);assert.ok(colors[i]>=0&&colors[i]<=1);}
});
test('wind displacement is continuous across a shared grass-block edge',t=>{
 const f=fixture(t);f.webgpu();const {createSceneGrass}=require('../grassify-scene.cjs'),create=f.w.eval('('+createSceneGrass.toString()+')');
 const settings={style:'flat',wind:30,density:1000,height:1,width:.025,distance:10,color:'#70a844'};
 const runtime=create({scene:f.scene,noa:f.noa,layout:{registerMesh:f.registerMesh},camera:()=>[1,2,.5],origin:()=>[0,0,0],read:(_x,y)=>y===0?1:0,grass:id=>id===1,actors:()=>[]},()=>settings,{limit:Infinity,hash:()=>.5,scan:function*(){yield [0,0,0];yield [1,0,0];},onError:error=>{throw error;}});
 t.after(()=>runtime.dispose());for(let i=0;i<40;i++)f.frame();const p=f.scene.meshes[0].buffers.position,left=[],right=[];
 for(let i=0;i<2000;i++){const k=i*24,x=(p[k]+p[k+3])*.5,z=(p[k+2]+p[k+5])*.5,bx=(p[k+18]+p[k+21])*.5-x,bz=(p[k+20]+p[k+23])*.5-z;if(x>.97&&x<1)left.push({x,z,bx,bz});if(x>=1&&x<1.03)right.push({x,z,bx,bz});}
 let pair=null,best=Infinity;for(const a of left)for(const b of right){const distance=Math.hypot(a.x-b.x,a.z-b.z);if(distance<best){best=distance;pair=[a,b];}}
 assert.ok(best<.03);assert.ok(Math.hypot(pair[0].bx-pair[1].bx,pair[0].bz-pair[1].bz)<.003,'a shared edge must not introduce a discrete wind jump');
});

test('GPU wind updates every submitted near and far tile each frame without vertex uploads',t=>{
 const f=fixture(t,{style:'flat',density:5,distance:12,wind:50});f.webgpu({gpu:true});f.setActors([]);const layout=f.w.__GRASSIFY_LAYOUT__;
 f.w.__GRASSIFY_LAYOUT__=noa=>{const value=layout(noa);return {...value,world:{...value.world,owner:{read(_x,y){return y===-2?1:0;}}}};};
 f.change('enabled',true);for(let i=0;i<8;i++)f.frame(16);assert.equal(f.w.__GRASSIFY__.diagnostics().gpuWind,true);assert.equal(f.w.__GRASSIFY__.diagnostics().shaderPatched,true);
 const first=new Map(f.scene.gpuBinds.map(b=>[b.mesh,b.values.grassWindPhase[0]]));assert.ok([...first.keys()].some(m=>Math.hypot(m.registeredPosition[0],m.registeredPosition[2])>5));f.frame(16);
 const tau=Math.PI*2,deltas=[];for(const b of f.scene.gpuBinds){assert.equal(b.mesh.positionUpdates||0,0);if(first.has(b.mesh))deltas.push((b.values.grassWindPhase[0]-first.get(b.mesh)+tau)%tau);}
 assert.ok(deltas.length>10);assert.ok(deltas.every(d=>d>0&&Math.abs(d-deltas[0])<1e-4));assert.equal(f.scene.gpuBinds.length,f.scene.renderedMeshes.length);
 f.change('wind',0);f.frame(16);assert.ok(f.scene.gpuBinds.every(b=>b.values.grassWindPhase[3]===0));f.change('enabled',false);assert.equal(f.resources.size,0);
});
test('surface-first discovery prepares a flat grass field before scanning the whole volume',t=>{
 const f=fixture(t,{style:'flat',density:5,distance:8,wind:0});f.webgpu({gpu:true});f.setActors([]);const layout=f.w.__GRASSIFY_LAYOUT__;
 f.w.__GRASSIFY_LAYOUT__=noa=>{const value=layout(noa);return {...value,world:{...value.world,owner:{read(_x,y){return y===-2?1:0;}}}};};
 f.change('enabled',true);f.frame();assert.ok(f.w.__GRASSIFY__.diagnostics().cells>=240,'surface pass should reach the horizontal area without first traversing its full height');assert.ok(f.w.__GRASSIFY__.diagnostics().renderedBlocks>=240,'builds must not wait for a two-tile round robin');
});
test('flowers, non-solid plant models and stems allow grass; furniture, slabs and non-plants do not',t=>{
 const f=fixture(t,{style:'flat',density:5,distance:1,wind:0});f.webgpu();let above=2;
 const layout=f.w.__GRASSIFY_LAYOUT__;f.w.__GRASSIFY_LAYOUT__=noa=>{const value=layout(noa);return {...value,world:{...value.world,owner:{read(x,y,z){return x===0&&z===0?(y===-2?1:y===-1?above:0):0;}}}};};
 const plants=['Dandelion','Poppy','Red Tulip','Pink Tulip','White Tulip','Orange Tulip','Daisy','Bluebell','Forget-me-not','Allium','Azure Bluet','Lily of the Valley','Shadow Rose','Pine Fern','Grass','Tall Grass','Maple Sapling','Tomato Plant|FreshlyGrown','Attached Pumpkin Stem'];
 const cases=plants.map(name=>({name,meta:{solid:false,harvestType:'cuttable',model:name.startsWith('Attached')?'CustomPlanes|rotatable':'CentreCross'},allowed:true}));
 cases.push(...['Wheat Seeds','Wheat|FreshlyGrown','Rice','Corn Plant|Growing'].map(name=>({name,meta:{solid:false,harvestType:'cuttable',model:'SquareSided'},allowed:true})),{name:'Vines|meta|rot1',meta:{solid:false,harvestType:'cuttable',model:'rotatableOffset',blockModel:'Vines'},allowed:true},{name:'Dangling Vine',meta:{solid:false,harvestType:'cuttable',model:'CustomModel',blockModel:'Dangling Vine'},allowed:true},{name:'Lily Pad|meta|rot1',meta:{solid:true,harvestType:'cuttable',model:'rotatable',blockModel:'lily_pad_model'},allowed:true},{name:'Potion Table|meta|rot1',meta:{solid:false,harvestType:'wood',model:'rotatable'},allowed:false},{name:'Stone Slab',meta:{model:'Slab',solid:false},allowed:false},{name:'Cobweb',meta:{solid:false,harvestType:'cuttable',model:'CentreCross'},allowed:false},{name:'Maple Leaves',meta:{harvestType:'cuttable'},allowed:false},{name:'Unknown',meta:{solid:false},allowed:false});
 for(const item of cases){f.w.__BLOXD_MOD_HOST__.engine=()=>({singletons:{noa:f.noa},getBloxd:()=>({getItemName:id=>id===1?'Grass Block':item.name,getMetaInfo:()=>item.meta})});f.change('enabled',true);f.frame();assert.equal(f.w.__GRASSIFY__.diagnostics().cells,item.allowed?1:0,item.name);f.change('enabled',false);}
 above=null;f.change('enabled',true);f.frame();assert.equal(f.w.__GRASSIFY__.diagnostics().cells,0,'unloaded blocks never count as air or plants');
});

test('GPU material hook patches only its own native vertex shader and reports incompatible templates',()=>{
 const {installGrassGpu}=require('../grassify-gpu.cjs'),errors=[],bind=observable(),material={customShaderNameResolve:null,onBindObservable:bind},gpu=installGrassGpu(material,e=>errors.push(e.message)),options={},defines={_keys:[]},uniforms=[],attributes=[];
 material.customShaderNameResolve('default',uniforms,[],[],defines,attributes,options);assert.ok(defines.BLOXDY_GRASSIFY_CONTACT_V4);assert.equal(defines._keys.filter(k=>k==='BLOXDY_GRASSIFY_CONTACT_V4').length,1);
 const native=fs.readFileSync(path.join(__dirname,'fixtures/grassify-native-vertex.glsl'),'utf8'),patched=options.processFinalCode('vertex',native);assert.ok(patched.includes('uniform vec4 grassWindPhase'));assert.ok(patched.includes('positionUpdated.xz+=mix(gBend'));assert.equal(options.processFinalCode('fragment','original fragment'),'original fragment');assert.equal(errors.length,0);
 options.processFinalCode('vertex','incompatible native shader');assert.match(errors[0],/vertex shader changed/);gpu.dispose();assert.equal(bind.size,0);assert.equal(material.customShaderNameResolve,null);
});

test('GPU compiler errors are reported and late callbacks cannot stop a replacement runtime',()=>{
 const {installGrassGpu}=require('../grassify-gpu.cjs'),errors=[],material={customShaderNameResolve:null,onBindObservable:observable()},gpu=installGrassGpu(material,e=>errors.push(e.message)),fail=material.onError,options={};
 material.customShaderNameResolve('default',[],[],[],{_keys:[]},[],options);fail(null,'synthetic compiler error');assert.match(errors[0],/synthetic compiler error/);gpu.dispose();fail(null,'late error');options.processFinalCode('vertex','late template');assert.equal(errors.length,1);
});

test('plant checks use raw block traits when getMetaInfo contains only state data',t=>{
 for(const useApi of [true,false]){
 const f=fixture(t,{style:'flat',density:5,distance:1,wind:0});f.webgpu();let above=2;const layout=f.w.__GRASSIFY_LAYOUT__;
 f.w.__GRASSIFY_LAYOUT__=noa=>{const value=layout(noa);return {...value,world:{...value.world,owner:{read(x,y,z){return x===0&&z===0?(y===-2?1:y===-1?above:0):0;}}}};};
 for(const [name,model,solid,harvestType,allowed] of [['Poppy','CentreCross',false,'cuttable',true],['Wheat','SquareSided',false,'cuttable',true],['Stone Slab','Slab',false,'rock',false],['Potion Table|meta|rot1','rotatable',false,'wood',false]]){
 const record={id:2,name,model,solid,harvestType,meta:{rootName:name.split('|')[0],rootId:2}},api={getItemName:id=>id===1?'Grass Block':name,getMetaInfo:()=>record.meta,renamedRegistry:{metadatas:{2:record,[name]:record}}};
 if(useApi)api.getDefaultItemStat=(id,key)=>{assert.equal(id,2);return record[key];};
 f.w.__BLOXD_MOD_HOST__.engine=()=>({singletons:{noa:f.noa},getBloxd:()=>api});f.change('enabled',true);f.frame();assert.equal(f.w.__GRASSIFY__.diagnostics().cells,allowed?1:0,name+' raw traits via '+(useApi?'API':'registry'));f.change('enabled',false);
 }
 }
});
test('source-proven render-feet layouts keep contact aligned across origin rebases',t=>{
 for(const [physical,render,bounds,override]of [['RP','xQ','yI','MT'],['RD','tu','bc','ck']]){
 const f=fixture(t,{style:'flat',density:5,distance:1,wind:0});f.webgpu({gpu:true});
 const Position=f.w.eval('(class {constructor(){this.position=null,this.width=.8,this.height=.8,this.'+physical+'=null,this.'+render+'=null,this.'+bounds+'=null,this.'+override+'=null}})'),actor=new Position;actor.position=[100,20,300];actor[render]=[-9.5,-21,-29.5];actor.GP=1;actor.height=1.8;
 f.noa.offset=[10,20,30];f.scene.activeCamera.position={x:-9.5,y:-20,z:-29.5};f.setActors([actor]);f.change('enabled',true);for(let i=0;i<12;i++)f.frame(16);
 assert.ok(f.scene.gpuBinds.some(b=>b.values.grassContactCount[0]>0),'contact must follow interpolated render feet, not the distant tick position');
 }
});
test('stationary contact coalesces and far tiles skip contact uploads and vertex loops',t=>{
 const f=fixture(t,{style:'flat',density:5,distance:12,wind:0});f.webgpu({gpu:true});const layout=f.w.__GRASSIFY_LAYOUT__;
 f.w.__GRASSIFY_LAYOUT__=noa=>{const value=layout(noa);return {...value,world:{...value.world,owner:{read(_x,y){return y===-2?1:0;}}}};};
 f.setActors([{GP:1,position:[.5,-1,.5],height:1.8,width:.7}]);f.change('enabled',true);for(let i=0;i<25;i++)f.frame(16);
 const near=f.scene.gpuBinds.filter(b=>b.values.grassContactCount[0]>0),far=f.scene.gpuBinds.filter(b=>Math.hypot(b.mesh.registeredPosition[0],b.mesh.registeredPosition[2])>8);
 assert.ok(near.length>0);assert.ok(near.every(b=>b.values.grassContactCount[0]===1),'standing still must not create a stack of duplicate contacts');assert.ok(far.length>0);assert.ok(far.every(b=>b.values.grassContactCount[0]===0));
 assert.ok(f.w.__GRASSIFY__.diagnostics().meshes<50,'4x4 default-density batches reduce mesh submissions');
});
test('GPU contact weights fade in and out rather than appearing at full strength',()=>{
 const {installGrassGpu}=require('../grassify-gpu.cjs'),bind=observable(),values={},effect={setFloat4(){},setFloat:(key,value)=>values[key]=value,setArray4:(key,value)=>values[key]=Array.from(value)},material={customShaderNameResolve:null,onBindObservable:bind,_activeEffect:effect},gpu=installGrassGpu(material,error=>{throw error;}),mesh={};gpu.register(mesh,{x:0,y:0,z:0,span:4});
 const contact={position:[.5,0,.5],previous:[.4,0,.5],height:1.8,width:.7,born:0,at:0};
 const sample=now=>{gpu.frame({phase:0,wind:0,now,contacts:[contact]});bind.fire(mesh);return values.grassContactCount?values.grassWeights[0]:0;};
 assert.equal(sample(0),0);const first=sample(16),next=sample(32);assert.ok(first>0&&first<.5);assert.ok(next>first&&next<.8);assert.ok(sample(740)<.001);assert.equal(sample(750),0);gpu.dispose();
});

test('actual shader contact overrides opposing wind for short and tall blades and releases fully',()=>{
 const {installGrassGpu}=require('../grassify-gpu.cjs'),bind=observable(),values={},effect={setFloat4:(key,...v)=>values[key]=v,setFloat:(key,v)=>values[key]=v,setArray4:(key,v)=>values[key]=Array.from(v)},material={customShaderNameResolve:null,onBindObservable:bind,_activeEffect:effect},gpu=installGrassGpu(material,error=>{throw error;}),mesh={};gpu.register(mesh,{x:0,y:0,z:0,span:4});
 const options={};material.customShaderNameResolve('default',[],[],[],{_keys:[]},[],options);
 const shader=options.processFinalCode('vertex','attribute vec3 position;void main(){vec3 positionUpdated=position;vec4 worldPos=finalWorld*vec4(positionUpdated,1.0);}');
 // Execute the emitted scalar GLSL kernel on CPU; no copied contact equations or graphics context.
 const kernel=shader.match(/float gWindX=[\s\S]*?(?=vec2 gBend=)/)[0].replace(/\b(?:float|int)\s+/g,'let ').replace(/\bfloat\(/g,'Number(');
 const evaluate=new Function('grassRoot','grassShape','grassWindPhase','grassContactCount','grassContacts','grassPrevious','grassWeights',`const {sin,cos,sqrt,max,min}=Math,clamp=(v,a,b)=>max(a,min(b,v)),smoothstep=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);},gRoot={x:grassRoot.x,y:grassRoot.z};${kernel};return {x:gBendX,z:gBendZ,drop:gDrop,pressure:gPressure};`);
 const vec=a=>({x:a[0],y:a[1],z:a[2],w:a[3]}),array=key=>Array.from({length:values.grassContactCount},(_,i)=>vec(values[key].slice(i*4,i*4+4)));
 const sample=(height,now,contact,rootX=.2)=>{gpu.frame({phase:0,wind:100,now,contacts:contact?[contact]:[]});bind.fire(mesh);return evaluate({x:rootX,y:0,z:0,w:height},{y:1.2},{x:-Math.PI/2-.5*rootX,y:-Math.PI/2-.13*rootX,z:Math.PI/2,w:1},values.grassContactCount,array('grassContacts'),array('grassPrevious'),array('grassWeights'));};
 for(const height of [.1,.5,3])for(const moving of [false,true]){
   const contact={position:[0,0,0],previous:[moving?-.1:0,0,0],height:1.8,width:.7,born:0,at:200};
   const wind=sample(height,200,null),pressed=sample(height,200,contact),fading=sample(height,650,contact),rest=sample(height,950,contact);
   assert.ok(wind.x<-.15);assert.ok(pressed.x>0,`entity must override opposing wind, height=${height}, moving=${moving}`);
   assert.ok(pressed.drop>height*.45);assert.ok(fading.pressure<pressed.pressure);assert.deepEqual(rest,wind,'expired contact must leave precisely the original wind');
 }
 const standing={position:[0,0,0],previous:[0,0,0],height:.6,width:.7,born:0,at:200};
 assert.ok(sample(.5,200,standing,0).drop>.2,'directly underneath a still mob, blades press down even without a radial direction');
 assert.deepEqual(sample(.5,200,{...standing,position:[0,2,0],previous:[0,2,0]}),sample(.5,200,null),'airborne entities must not suppress ground wind');gpu.dispose();
});

test('persistent entity response stays continuous while moving, stopping, reversing and leaving',()=>{
 const {installGrassGpu}=require('../grassify-gpu.cjs'),bind=observable(),values={},material={customShaderNameResolve:null,onBindObservable:bind,_activeEffect:{setFloat4(){},setFloat:(k,v)=>values[k]=v,setArray4:(k,v)=>values[k]=Array.from(v)}},gpu=installGrassGpu(material,error=>{throw error;}),mesh={};gpu.register(mesh,{x:0,y:0,z:0,span:4});
 const frame=(now,x)=>{gpu.frame({phase:0,wind:0,now,actors:x===null?[]:[{id:'player',position:[x,0,.5],height:1.8,width:.7}]});bind.fire(mesh);return {n:values.grassContactCount,x:values.grassContacts?.[0],weight:values.grassWeights?.[0],direction:values.grassWeights?.[1]};};
 let last=frame(0,.5);
 for(let i=1;i<=200;i++){const target=i<60?.5+i/120:i<120?1:1-(i-120)/160,now=i*16,next=frame(now,target);assert.equal(next.n,1,'moving one actor must never stack history contacts');assert.ok(Math.abs(next.x-last.x)<.05,'smoothed feet must not jump between frames');assert.ok(Math.abs(next.weight-last.weight)<.31,'contact pressure must not restart for each movement sample');last=next;}
 for(let i=201;i<=300;i++)last=frame(i*16,.5);assert.ok(Math.abs(last.direction)<.001,'standing must not preserve a stale walking direction');
 let weight=last.weight;for(let i=301;i<=370;i++){const next=frame(i*16,null);if(next.n){assert.ok(next.weight<weight);weight=next.weight;}else weight=0;}assert.equal(values.grassContactCount,0,'removed entity must fully release');gpu.dispose();
});

test('critically damped contact tracks agree across refresh rates and reset teleport sweeps',()=>{
 const {installGrassGpu}=require('../grassify-gpu.cjs');const samples=[];
 for(const hz of [30,60,120]){const bind=observable(),values={},material={customShaderNameResolve:null,onBindObservable:bind,_activeEffect:{setFloat4(){},setFloat:(k,v)=>values[k]=v,setArray4:(k,v)=>values[k]=Array.from(v)}},gpu=installGrassGpu(material,error=>{throw error;}),mesh={};gpu.register(mesh,{x:0,y:0,z:0,span:20});
 const frame=(now,x)=>{gpu.frame({phase:0,wind:0,now,actors:[{id:1,position:[x,0,.5],height:1.8,width:.7}]});bind.fire(mesh);};frame(0,.5);
 for(let i=1;i<=hz/2;i++){frame(i*1000/hz,1);assert.ok(values.grassContacts[0]>=.5&&values.grassContacts[0]<=1,'step response cannot overshoot');}samples.push(values.grassContacts[0]);
 frame(600,10);assert.equal(values.grassContacts[0],10);assert.equal(values.grassPrevious[0],10,'teleport must not sweep grass between old and new position');gpu.dispose();}
 assert.ok(Math.max(...samples)-Math.min(...samples)<.00001,'elapsed time governs settling, not frame count');
});

test('emitted contact arc pins roots and bends down while preserving centreline length',()=>{
 const {installGrassGpu}=require('../grassify-gpu.cjs'),material={customShaderNameResolve:null,onBindObservable:observable()},gpu=installGrassGpu(material,error=>{throw error;}),options={};material.customShaderNameResolve('default',[],[],[],{_keys:[]},[],options);
 const shader=options.processFinalCode('vertex','attribute vec3 position;void main(){vec3 positionUpdated=position;vec4 worldPos=finalWorld*vec4(positionUpdated,1.0);}');
 const kernel=shader.match(/float gBendLength=[\s\S]*?(?=vec2 gDirection=)/)[0].replace(/\bfloat\s+/g,'let ').replace('length(gBend)','.5');
 const arc=new Function('gPressure','grassRoot','grassShape',`const {sin,cos,max}=Math,smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};${kernel};return [gArcX,gArcY];`);
 for(const h of [.1,.5,3]){assert.deepEqual(arc(.9,{w:h},{x:0}),[0,0],'root must stay fixed');let previous=[0,0],length=0;
 for(let i=1;i<=64;i++){const next=arc(.9,{w:h},{x:i/64});length+=Math.hypot(next[0]-previous[0],next[1]-previous[1]);assert.ok(next[1]>=0);previous=next;}
 assert.ok(Math.abs(length-h)<h*.0001,'bending must preserve centreline length');assert.ok(previous[0]>h*.7&&previous[1]<h*.4,'tip bends sideways and down');}gpu.dispose();
});
