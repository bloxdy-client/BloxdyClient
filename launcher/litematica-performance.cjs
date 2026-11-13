'use strict';
// Source adapters for the bundled snapshot, also applied to existing installs.
// Keep catalog bytes, source rendering and all user quality settings intact.
const crypto=require('node:crypto');
const {adaptLitematicaLoading}=require('./litematica-loading.cjs');
const {adaptLitematicaCapture}=require('./litematica-capture.cjs');
const {adaptLitematicaInteraction}=require('./litematica-interaction.cjs');
const {adaptLitematicaMenu}=require('./litematica-menu.cjs');
const {adaptLitematicaPlacement}=require('./litematica-placement.cjs');
const {adaptLitematicaDirect}=require('./litematica-direct.cjs');
const hashes={
 'adapter.js':'e0a766e31ea6658ec470ccc4ae269183911e79b2043f3adf95a42e009987cc79',
 'bloxdschem.js':'d84b3bd1bf35c65fddf3a4ef8b5d9a23d7a94f0babcb5ccfbde56130ca95ac7c',
 'native-frame.js':'63ea0076c100b709c4d0f64a28ebbc6ed962477b7953bd32c945a1d7af61123b',
 'placement.js':'9d2237b909f3d3bb90fe545d705b8a720ba08bbf2ac654aabea3a469417f1ac8',
 'place.js':'6ed02cbe8b35cdc624a00dab28d613749a1d468429ed015be4c663ac1b10bc1d',
 'building.js':'ca5ce3f7cc18140a6f8c5d5b03a2d3738cb62f50a8d9ad233af0b79198682057',
 'renderer.js':'3c76171757c75ef607e1142c87b3daf80861dea6832cf0c46abf2fe36dd03354',
 'litematica.js':'b3413bf085cd311bec16ea509c721e83202bec7b627e9fc92e116e0b338b8092'
};
function adaptLitematicaPerformance(name,source){
 if(!hashes[name])return source;
 if(crypto.createHash('sha256').update(source).digest('hex')!==hashes[name])throw Error('Litematica performance adapter does not match '+name+'. Check the mod version.');
 source=source.replaceAll('\r\n','\n');
 const edit=(from,to)=>{if(!source.includes(from))throw Error('Litematica performance adapter mismatch: '+name+' / '+from.slice(0,70));source=source.replace(from,()=>to);};
 if(name==='litematica.js'){
  // Opening the ordinary game settings needs only our category tab. Keep the
  // full page detached between selections, including all existing controls.
  edit("if(cachedUI){\n      for(const [name,rows]", "if(cachedUI&&binding?.menu.isConnected&&binding.menu.classList.contains('blm-selected')){\n      for(const [name,rows]");
  edit("if(!binding)return;const {menu,tab}=binding;", "if(!binding)return;const {menu,tab,right}=binding;");
  edit("    if(active){const clean=", "    if(active){const page=cachedUI?.page||buildUI();if(page.parentElement!==right)right.append(page);sync();const clean=");
  edit("queueMicrotask(clean);renderMaterials();}\n  }\n  function install()", "queueMicrotask(clean);renderMaterials();}else cachedUI?.page.remove();\n  }\n  function install()");
  edit('binding?.menu===menu&&binding.tab.isConnected&&cachedUI?.page.isConnected', 'binding?.menu===menu&&binding.tab.isConnected&&binding.right===right');
  edit('const page=cachedUI?.page||buildUI();right.append(page);binding={menu,tab};', 'cachedUI?.page.remove();binding={menu,tab,right};');
  edit('  function renderMaterials() {', "  function renderMaterials() {\n    if(!binding?.menu.isConnected||!binding.menu.classList.contains('blm-selected'))return;");
  edit('if(cachedUI&&!cachedUI.materialRows.hidden)renderMaterials();', "if(cachedUI&&binding?.menu.isConnected&&binding.menu.classList.contains('blm-selected')&&!cachedUI.materialRows.hidden)renderMaterials();");
  // Pinned views must not run additional 3 ms sampling jobs twice per frame.
  // Include append length and retainPrevious in composition invalidation.
  edit("      const source=entry.view?entry.view.sample(effective,opts,camera,state):", "      const sampleAt=performance.now(),sampleKey=JSON.stringify([...camera.map(n=>Math.floor(n/16)),opts,effective,state.layerMode,state.layer,state.layerEnd,state.distance,state.maxRender,state.showExtra]);\n      const resample=(!entry.sourceRows||sampleKey!==entry.sampleKey||sampleAt-(entry.sampleAt??-Infinity)>=(entry.view?.pending()?16:100))&&sampleAt<sampleDeadline;\n      const source=entry.view?(resample?(entry.sampleAt=sampleAt,entry.sampleKey=sampleKey,entry.view.sample(effective,opts,camera,state)):entry.sourceRows||emptyBlocks):");
  edit('if(source!==entry.sourceRows){entry.sourceRows=source;entry.rows=source.map(row=>', 'if(source!==entry.sourceRows||source.length!==entry.sourceLength||source.retainPrevious!==entry.rows.retainPrevious){const append=source===entry.sourceRows&&source.length>=(entry.sourceLength||0),start=append?entry.sourceLength:0;if(!append)entry.rows=[];entry.sourceRows=source;entry.sourceLength=source.length;for(let i=start;i<source.length;i++){const row=source[i];entry.rows.push');
  edit('overlay:true}));}', 'overlay:true});}entry.rows.retainPrevious=source.retainPrevious;}');
  edit('sceneComposite=[];', 'sceneComposite=[],sceneLengths=[],sceneRetained=[],sampleDeadline=Infinity;');
  edit('parts.some((p,i)=>p!==sceneParts[i])){sceneParts=parts;sceneComposite=parts.flat();sceneComposite.retainPrevious=parts.some(p=>p.retainPrevious);}', 'parts.some((p,i)=>p!==sceneParts[i]||p.length<sceneLengths[i])){sceneParts=parts;sceneComposite=parts.flat();}else for(let i=0;i<parts.length;i++)for(let j=sceneLengths[i];j<parts[i].length;j++)sceneComposite.push(parts[i][j]);\n    sceneLengths=parts.map(p=>p.length);sceneRetained=parts.map(p=>p.retainPrevious);sceneComposite.retainPrevious=sceneRetained.some(Boolean);');
  edit("()=>{if(state.mode==='select')return emptyBlocks;refreshView();return renderRows();}", "()=>{if(state.mode==='select')return emptyBlocks;sampleDeadline=performance.now()+3;refreshView();return renderRows();}");
 }
 if(name==='renderer.js'){
  edit('let areaMesh=null;', 'let areaMesh=null,lastScan=-Infinity,texturePending=false,indexPrevious=null,earlyPrepared=false;');
  edit('value.image=image;', 'value.image=image;texturePending=true;');
  edit('function uploadTextures(){gl.activeTexture', 'function uploadTextures(){if(!texturePending)return;texturePending=false;gl.activeTexture');
  edit('function disposeGroup(group){if(gl&&group.buffer)', 'function disposeGroup(group){counters.quads-=group.quads||0;group.quads=0;if(gl&&group.buffer)');
  edit('group.quads=quads;counters.meshBuilds++;counters.uploads++;counters.quads=[...groups.values()].reduce((n,g)=>n+(g.quads||0),0);', 'counters.quads+=quads-(group.quads||0);group.quads=quads;counters.meshBuilds++;counters.uploads++;');
  edit('generation++;textures.clear();groups.clear();seen=null;', 'generation++;textures.clear();groups.clear();counters.quads=0;seen=null;');
  // Importing hundreds of thousands of rows must not perform one synchronous
  // indexing pass. Retain cached GPU groups until the replacement is indexed.
  edit('const replacing=seen!==blocks,old=groups;if(replacing){selection++;', 'const replacing=seen!==blocks||blocks.length<seenLength,old=groups;if(replacing){if(indexPrevious)for(const [key,group]of indexPrevious)if(old.get(key)!==group)disposeGroup(group);indexPrevious=old;selection++;');
  edit('      for(let i=seenLength;i<blocks.length;i++){', '      let indexed=seenLength;const deadline=performance.now()+.75;\n      for(let i=seenLength;i<blocks.length;i++){');
  edit('const cached=old.get(key);group=cached||', 'const cached=(indexPrevious||old).get(key);group=cached||');
  edit("if(!block.overlay)account(block.statName,block.statAir,block.statStatus,1);\n      }", "if(!block.overlay)account(block.statName,block.statAir,block.statStatus,1);\n        indexed=i+1;if((indexed&127)===0&&performance.now()>=deadline)break;\n      }");
  edit('if(replacing)for(const [key,group]of old)if(!groups.has(key))disposeGroup(group);seen=blocks;seenLength=blocks.length;', 'if(indexed===blocks.length&&indexPrevious){for(const [key,group]of indexPrevious)if(!groups.has(key))disposeGroup(group);indexPrevious=null;}seen=blocks;seenLength=indexed;');
  edit('if(!blocks.retainPrevious)for(const [key,group]of groups)', 'if(indexed===blocks.length&&!blocks.retainPrevious)for(const [key,group]of groups)');
  edit('function releaseGraphics(){nativeFrame?.detach();', 'function releaseGraphics(){nativeFrame?.detach();if(indexPrevious){for(const [key,group]of indexPrevious)if(groups.get(key)!==group)disposeGroup(group);indexPrevious=null;}');
  // Maintenance belongs before capture so checks/builds keep advancing even
  // when the finished overlay is empty, out of range or behind the camera.
  const start=source.indexOf('      const now=performance.now();for(let n=0;'),end=source.indexOf('      gl.useProgram(program);gl.uniform1i(uniform.image,0);',start);
  if(start<0||end<0)throw Error('Litematica maintenance adapter mismatch.');
  let maintenance=source.slice(start,end);
  maintenance=maintenance.replace('const now=performance.now();for(let n=0;n<Math.min(512,blocks.length)&&performance.now()-now<1.5;n++){', 'const now=performance.now();if(now-lastScan>=50){lastScan=now;for(let n=0;n<Math.min(1536,seenLength)&&performance.now()-now<1;n++){');
  maintenance=maintenance.replace('blocks[scan++%blocks.length]', 'blocks[scan++%seenLength]');
  maintenance=maintenance.replace('      if(now-lastCheck>=1000)', '      }\n      if(now-lastCheck>=1000)');
  maintenance=maintenance.replace('if(!group.work)group.work=build(group,{...state});', 'withState();gl.bindVertexArray(vao);if(!group.work)group.work=build(group,{...state});');
  source=source.slice(0,start)+source.slice(end);
  const beginStart=source.indexOf('    function begin(info){'),beginEnd=source.indexOf('    function draw(info){',beginStart);
  if(beginStart<0||beginEnd<0)throw Error('Litematica begin adapter mismatch.');
  source=source.slice(0,beginStart)+`    function inView(bounds,matrix,origin,camera,distance){
      if(!bounds||!matrix||!origin||!camera)return true;
      let d=0;for(let i=0;i<3;i++)d+=Math.max(bounds[i]-camera[i],0,camera[i]-bounds[i+3])**2;
      if(d>distance*distance)return false;
      let outside=15;
      for(let i=0;i<8&&outside;i++){const x=bounds[i&1?3:0]-origin[0],y=bounds[i&2?4:1]-origin[1],z=bounds[i&4?5:2]-origin[2],sx=x*matrix[0]+y*matrix[4]+z*matrix[8]+matrix[12],sy=x*matrix[1]+y*matrix[5]+z*matrix[9]+matrix[13],w=x*matrix[3]+y*matrix[7]+z*matrix[11]+matrix[15];outside&=(sx< -w?1:0)|(sx>w?2:0)|(sy< -w?4:0)|(sy>w?8:0);}
      return !outside;
    }
    function drawable(group,state){
      if(!group.buffer)return false;
      if(group.lines.some(line=>line.color[2]>.5?state.showExtra:state.showWrong))return true;
      return group.draws.some(item=>item.count>0&&(item.kind==='placement'
        ?state.fill&&state.placementTransparency!==1&&state.renderMode!=='errors'&&(item.tex?item.tex.ready:item.solidColor)
        :item.kind==='wrong'?state.showWrong:item.kind==='extra'?state.showExtra:false));
    }
    function begin(info){
      if(!mainPass(info))return;
      if(info.renderingGroupId===-1)earlyPrepared=false;
      if(info.renderingGroupId===0&&earlyPrepared||nativeFrame?.active())return;
      if(info.renderingGroupId===-1)earlyPrepared=true;
      let saved=null;
      const withState=()=>{if(!saved)saved=frameAPI.save(gl);};
      try{
        const state=getState();if(!state.enabled||document.hidden||!connection?.canvas?.isConnected||!mount())return;
        const blocks=getBlocks(),box=getSelection();if(!blocks.length&&!box)return;
        const native=connection.gpu?.();if(!native?.createVertexArray){issue='Schematic graphics require Bloxd WebGL 2';return;}if(native.isContextLost?.())return;
        if(gl!==native){releaseGraphics();gl=native;dirty=true;}
        if(!program){withState();if(!initialize())return;}
        if(texturePending){withState();uploadTextures();}index(blocks);
${maintenance}
        const matrix=connection.matrix(),origin=connection.origin(),camera=connection.camera();
        const visibleBox=box&&inView([...box.min,...box.max.map(n=>n+1)],matrix,origin,camera,Infinity);
        let visible=Boolean(visibleBox);if(!visible)for(const group of groups.values())if(drawable(group,state)&&inView(group.bounds,matrix,origin,camera,state.distance)){visible=true;break;}
        if(!visible)return;
        withState();resetUnpack();nativeFrame.begin(saved,connection.clip?.()||{reverse:false});
      }catch(error){issue='Schematic capture: '+error.message;}finally{if(saved)frameAPI.restore(gl,saved);}
    }
`+source.slice(beginEnd);
  // Sampling/indexing happens once in begin, never again after world drawing.
  edit('const blocks=getBlocks(),box=getSelection();if(!blocks.length&&!box){clear();return;}', 'const box=getSelection();');
  edit("if(!nativeFrame?.active()){const fault=", "earlyPrepared=false;if(!nativeFrame?.active()){const fault=");
  edit('gl.bindVertexArray(vao);uploadTextures();index(blocks);\n      gl.useProgram(program);', 'gl.bindVertexArray(vao);\n      gl.useProgram(program);');
  const visStart=source.indexOf('      const visible=[];for(const group of groups.values())'),visEnd=source.indexOf('      const opacity=',visStart);
  if(visStart<0||visEnd<0)throw Error('Litematica visibility adapter mismatch.');
  source=source.slice(0,visStart)+'      const visible=[];for(const group of groups.values())if(drawable(group,state)&&inView(group.bounds,matrix,origin,camera,state.distance))visible.push(group);\n'+source.slice(visEnd);
  edit('scan=0;}},clear,status:', 'scan=0;lastScan=-Infinity;}},clear,status:');
  edit('lastCheck=-Infinity;if(connection?', 'lastCheck=-Infinity;lastScan=-Infinity;if(connection?');
  edit('function disconnect(){nativeFrame?.finish();', 'function disconnect(){earlyPrepared=false;nativeFrame?.finish();');
  edit('state.fill,state.showWrong,state.showExtra,state.renderMode,state.focusMaterial].join', 'state.fill,state.showWrong,state.showExtra,state.renderMode,state.focusMaterial,state.placementTransparency===1].join');
  edit('groups:groups.size,selectionBox:', 'groups:groups.size,indexedRows:seenLength,pendingRows:Math.max(0,(seen?.length||0)-seenLength),selectionBox:');
 }
 source=adaptLitematicaMenu(name,adaptLitematicaInteraction(name,adaptLitematicaCapture(name,adaptLitematicaLoading(name,source))));
 if(name==='litematica.js'){
  // With no placement, no pinned view and no selection task there is no world
  // work. Keep the menu/keyboard handlers alive without renderer discovery.
  edit('  const renderer=globalThis.__BLM_CREATE_RENDERER__(', "  const worldNeeded=()=>state.enabled&&Boolean(model||scene.some(entry=>entry.visible)||state.mode==='select');\n  const renderer=globalThis.__BLM_CREATE_RENDERER__(");
  edit('},selectionBox);', "},selectionBox,()=>worldNeeded()&&(state.mode!=='select'||Boolean(selectionBox())));");
  edit("enabled:state.enabled&&state.mode==='build',ezBuilding:", "enabled:state.enabled&&state.mode==='build'&&Boolean(model),ezBuilding:");
  edit('setInterval(()=>{adapter.connect();if(areaWaiting', 'setInterval(()=>{if(worldNeeded()){adapter.connect();if(areaWaiting');
  edit('resolveNativeMappings();checkAutoLayer();if(cachedUI', 'resolveNativeMappings();checkAutoLayer();}if(cachedUI');
 }
 if(name==='renderer.js'){
  edit('getSelection=()=>null){', 'getSelection=()=>null,hasWork=()=>true){');
  edit('function bind(){const next=', 'function bind(){if(stopped)return;if(!getState().enabled||!hasWork()){if(connection){disconnect();connection=null;}if(program)releaseGraphics();return;}const next=');
  // A source render group can disappear after the sky group has opened our
  // capture. Never let that pending capture span two independent game frames.
  edit('let areaMesh=null,', `let frameBefore=null,frameAfter=null,lastWorldInfo=null,abortedFrames=0;
    function resetFrame(){if(nativeFrame?.active()){nativeFrame.abort();abortedFrames++;}earlyPrepared=false;lastWorldInfo=null;}
    function finishFrame(){if(lastWorldInfo&&nativeFrame?.active())draw(lastWorldInfo,true);if(nativeFrame?.active())nativeFrame.abort();earlyPrepared=false;lastWorldInfo=null;}
    let areaMesh=null,`);
  edit('if(!mainPass(info))return;\n      if(info.renderingGroupId===-1)', `if(!mainPass(info)){if(info?.renderingGroupId>0&&lastWorldInfo&&info.camera===lastWorldInfo.camera&&info.renderingManager===lastWorldInfo.renderingManager&&nativeFrame?.active())draw(lastWorldInfo,true);return;}
      lastWorldInfo={renderingGroupId:info.renderingGroupId,camera:info.camera,renderingManager:info.renderingManager};
      if(info.renderingGroupId===-1)`);
  edit('function draw(info){if(!mainPass(info)||info.renderingGroupId===-1&&', 'function draw(info,finalize=false){if(!mainPass(info)||!finalize&&info.renderingGroupId===-1&&');
  edit('function disconnect(){earlyPrepared=false;nativeFrame?.finish();', 'function disconnect(){earlyPrepared=false;lastWorldInfo=null;nativeFrame?.abort();if(frameBefore)connection?.scene.onBeforeRenderObservable?.remove(frameBefore);if(frameAfter)connection?.scene.onAfterRenderObservable?.remove(frameAfter);frameBefore=null;frameAfter=null;');
  edit('beforeObserver=connection.scene.onBeforeRenderingGroupObservable.add(begin);', 'frameBefore=connection.scene.onBeforeRenderObservable?.add(resetFrame);frameAfter=connection.scene.onAfterRenderObservable?.add(finishFrame);beforeObserver=connection.scene.onBeforeRenderingGroupObservable.add(begin);');
  edit('diagnostics:()=>({...counters,', 'diagnostics:()=>({...counters,abortedFrames,');
  // Error highlights are validated against the reconstructed native surface
  // inside their cell. A proxy cube depth comparison can reject that very
  // surface before reconstruction. Other faces use the actual target precision.
  edit('uniform float halfDepth;uniform float errorMode;', 'uniform float halfDepth;uniform float depthEpsilon;uniform float errorMode;');
  edit('if(gl_FragCoord.z>depth+0.00000003)discard;', '');
  edit('    vec2 uv=fract(texUV);', '    if(gl_FragCoord.z>depth+depthEpsilon)discard;vec2 uv=fract(texUV);');
  edit("'captureUV','outlineWidth'", "'captureUV','depthEpsilon','outlineWidth'");
  edit('gl.uniform4fv(uniform.captureUV,target.captureUV);', 'gl.uniform4fv(uniform.captureUV,target.captureUV);gl.uniform1f(uniform.depthEpsilon,target.bits===16?2/65535:target.bits===32?4/16777216:2/16777215);');
 }
 return require('./litematica-native-adapter.cjs').adaptNativeLitematica(name,adaptLitematicaDirect(name,adaptLitematicaPlacement(name,source)));
}
module.exports={adaptLitematicaPerformance};
