'use strict';
// Applied only after the pinned snapshot has passed the original SHA checks.
function adaptLitematicaInteraction(name,source){
 const edit=(from,to)=>{if(!source.includes(from))throw Error('Litematica interaction adapter mismatch: '+name+' / '+from.slice(0,80));source=source.replace(from,()=>to);};
 if(name==='adapter.js'){
  // `native` becomes a discovery-only no-op in the shared mod host. Event
  // properties must still be defined, or our own Enter intercepts native chat.
  edit("native(event,'blmNativeCommand',{value:true})", "Object.defineProperty(event,'blmNativeCommand',{value:true})");
  edit("function pasting(){", "function closeSettings(){if(!app||!menus||app.get('gameState')!=='inGame'||app.get('openEverythingMenuName')!==menus.SETTINGS)return false;app.set({openEverythingMenuName:null,openInGameMenuName:null});return true;}\n  function pasting(){");
  edit('connect, resolveItemName, openSettings, menuOpen,', 'connect, resolveItemName, openSettings, closeSettings, menuOpen,');
 }
 if(name==='place.js'){
  edit('async function start(){', 'async function start({closeSettings=false}={}){');
  edit("if(!session.allowed()){report('Close menus and chat before placing.');return false;}", "if(!session.allowed()&&!closeSettings){report('Close menus and chat before placing.');return false;}");
  edit("      try{\n        const clipboardName=", "      try{\n        if(!session.allowed()){if(!adapter.closeSettings?.())throw Error('Close menus and chat before placing.');for(let i=0;i<80&&!session.allowed();i++){if(cancelled())abort();await new Promise(resolve=>setTimeout(resolve,25));}if(cancelled())abort();if(!session.allowed())throw Error('Close menus and chat before placing.');}\n        const clipboardName=");
 }
 if(name==='building.js'){
  edit("const counters={attempts:0,selections:0};", "let nativeCalls=0;const counters={attempts:0,selections:0};");
  edit('      detach();if(!next)return;session=next;', `      const heldGesture=pressed&&enabled()&&session?.noa===next?.noa&&session?.inputs===next?.inputs&&next?.allowed();
      detach();if(!next)return;session=next;`);
  edit("hook(session.block,'placeBlock',original=>function(...args){if(running)return original.apply(this,args);try{if(attempt(()=>original.apply(this,args)))return;}catch(error){status='EZ Building: '+error.message;cancel();return;}return original.apply(this,args);});", `hook(session.block,'placeBlock',original=>function(...args){if(running)return original.apply(this,args);nativeCalls++;let invoked=false;try{if(attempt(()=>{invoked=true;return original.apply(this,args);}))return;}catch(error){cancel();if(invoked)throw error;status='EZ Building: '+error.message;return original.apply(this,args);}return original.apply(this,args);});`);
  edit("hook(down,'emit',original=>function(name,...args){if(name==='alt-fire'&&enabled()&&session?.allowed()){pressed=true;try{const handled=attempt(session.block.placeBlock);schedule();if(handled){consumed=true;return true;}}catch(error){status='EZ Building: '+error.message;cancel();return true;}}return original.call(this,name,...args);});", `hook(down,'emit',original=>function(name,...args){if(name!=='alt-fire'||!enabled()||!session?.allowed())return original.call(this,name,...args);pressed=true;const calls=nativeCalls;let result;try{result=original.call(this,name,...args);}catch(error){cancel();throw error;}if(pressed&&calls===nativeCalls)try{attempt(session.block.placeBlock);}catch(error){status='EZ Building: '+error.message;cancel();}schedule();return result;});`);
  edit("hook(up,'emit',original=>function(name,...args){if(name==='alt-fire'){const handled=consumed;cancel();if(handled)return true;}return original.call(this,name,...args);});", `hook(up,'emit',original=>function(name,...args){if(name==='alt-fire')cancel();return original.call(this,name,...args);});
      if(heldGesture)pressed=true;`);
 }
 if(name==='renderer.js'){
  edit('let areaMesh=null,', `const buildQueue=new Set(),urgentQueue=new Set(),activeBuilds=new Set(),nearCells=new Map();let priorityCursor=0,nearEpoch=1,nearCount=0,nearScan=0,nearPending=true,nearCenter=null;
    function mark(group){group.dirty=true;buildQueue.add(group);}
    function cancelBuild(group){activeBuilds.delete(group);if(group.work){group.work.return();counters.cancelledBuilds++;}group.work=null;if(gl&&group.pendingBuffer)gl.deleteBuffer(group.pendingBuffer);group.pendingBuffer=null;}
    const cellKey=(x,y,z)=>[Math.floor(x/8),Math.floor(y/8),Math.floor(z/8)].join(',');
    function resetNear(){nearCells.clear();nearCount=0;nearScan=0;nearPending=true;nearEpoch++;priorityCursor=0;}
    function indexNear(block){if(nearCount>=65536||block.nearEpoch===nearEpoch)return;const c=[Math.floor(block.x/8),Math.floor(block.y/8),Math.floor(block.z/8)];if(nearCenter&&c.some((n,i)=>Math.abs(n-nearCenter[i])>2))return;let bucket=nearCells.get(c.join(','));if(!bucket){bucket=[];nearCells.set(c.join(','),bucket);}bucket.push(block);block.nearEpoch=nearEpoch;nearCount++;}
    let areaMesh=null,`);
  // Each bucket contains references to indexed rows, never another world or
  // geometry copy. It is rebuilt with the existing incremental row index.
  edit('selection++;groups=', 'for(const group of old.values())cancelBuild(group);selection++;resetNear();groups=');
  // Preserve source chunks and greedy surfaces: splitting every axis at 16
  // multiplied draw groups and introduced extra seams on unchanged surfaces.
  edit('group.rows.push(block);group.dirty=true;', 'group.rows.push(block);indexNear(block);group.dirty=true;');
  edit('uploadTextures();}index(blocks);', 'uploadTextures();}const nearCamera=connection.camera?.(),center=nearCamera?.map(n=>Math.floor(n/8));if(center&&(!nearCenter||center.some((n,i)=>n!==nearCenter[i]))){nearCenter=center;resetNear();}index(blocks);');
  const scanStart=source.indexOf('      const now=performance.now();if(now-lastScan>=50)'),scanEnd=source.indexOf('      if(now-lastCheck>=1000)',scanStart);
  if(scanStart<0||scanEnd<0)throw Error('Litematica classification adapter mismatch.');
  source=source.slice(0,scanStart)+`      const now=performance.now();if(now-lastScan>=50){lastScan=now;
        let checked=0;const check=(block,priority=false)=>{
          if(!block||block.checkedAt===now)return;block.checkedAt=now;checked++;counters.blockChecks++;
          const actual=connection.read(block.x,block.y,block.z);let status=globalThis.__BLM_MODEL__.classify(actual.actual,connection.expected(block.name),actual.loaded),actualName=status==='wrong'||status==='extra'?connection.actualName(actual.actual):null;
          if(status==='wrong'&&actualName===block.name){status='correct';actualName=null;}
          const look=s=>s==='unknown'||s==='missing'?0:s==='correct'?1:s==='wrong'?2:s==='extra'?3:4;
          if(look(status)!==look(block.status)||actualName!==(block.actualName??null)){mark(block.renderGroup);block.renderGroup.revision++;if(priority)urgentQueue.add(block.renderGroup);}
          if(status!==block.statStatus||block.name!==block.statName||Boolean(block.expectedAir)!==block.statAir){if(!block.overlay)account(block.statName,block.statAir,block.statStatus,-1);block.statName=block.name;block.statAir=Boolean(block.expectedAir);block.statStatus=status;if(!block.overlay)account(block.statName,block.statAir,block.statStatus,1);}
          block.status=status;block.actualName=actualName;
        };
        // A camera move rebuilds only a bounded nearby row-reference index.
        // Its rolling work shares this scan's time budget; no whole-view copy.
        if(nearPending){for(let n=0;n<1024&&nearScan<seenLength&&performance.now()-now<.2;n++)indexNear(blocks[nearScan++]);if(nearScan>=seenLength||nearCount>=65536)nearPending=false;}
        const aim=connection.aim?.(),keys=new Set();
        if(aim?.position?.every(Number.isFinite)&&aim.direction?.every(Number.isFinite))for(let d=0;d<=8;d++)keys.add(cellKey(...aim.position.map((n,i)=>n+aim.direction[i]*d)));
        // Check exact cells under the crosshair first. The bounded bucket walk
        // also catches the newly emptied cell after a removal, before the ray
        // would hit the block behind it. No source events or writes are needed.
        const buckets=[...keys].map(key=>nearCells.get(key)).filter(Boolean),total=buckets.reduce((n,b)=>n+b.length,0);
        let examined=0;for(;examined<Math.min(1024,total)&&checked<256&&performance.now()-now<.4;examined++){
          let at=priorityCursor++%total,bucket;for(bucket of buckets){if(at<bucket.length)break;at-=bucket.length;}const block=bucket[at],v=[block.x+.5-aim.position[0],block.y+.5-aim.position[1],block.z+.5-aim.position[2]],along=v.reduce((n,x,i)=>n+x*aim.direction[i],0);
          if(along>=-1&&along<=9&&v.reduce((n,x)=>n+x*x,0)-along*along<=3)check(block,true);
        }
        // Keep the background sweep and its old 1 ms / 1,536-read ceiling.
        // Priority work shares the same budget and never causes catch-up work.
        for(let n=0;n<Math.min(1536,seenLength)&&checked<1536&&performance.now()-now<1;n++)check(blocks[scan++%seenLength]);
      }
`+source.slice(scanEnd);
  const buildStart=source.indexOf('      const start=performance.now();outer:'),buildEnd=source.indexOf('\n        const matrix=connection.matrix()',buildStart);
  if(buildStart<0||buildEnd<0)throw Error('Litematica build queue adapter mismatch.');
  source=source.slice(0,buildStart)+`      const start=performance.now();let slices=0,prioritySlices=0;
      while((buildQueue.size||activeBuilds.size)&&slices++<128){
        const requested=urgentQueue.values().next().value,priority=requested&&(requested.work||activeBuilds.size<2)&&prioritySlices<8;if(priority)prioritySlices++;
        const group=priority?requested:(activeBuilds.size?activeBuilds:buildQueue).values().next().value,urgent=urgentQueue.has(group);buildQueue.delete(group);urgentQueue.delete(group);activeBuilds.delete(group);
        if(groups.get(group.key)!==group||group.selection!==selection||!group.dirty){cancelBuild(group);continue;}
        withState();gl.bindVertexArray(vao);
        // A status change queues another snapshot; it must not cancel a job
        // every 50 ms before that job has ever reached its upload/commit.
        if(!group.work)group.work=build(group,{...state});
        let step;try{step=group.work.next();}catch(error){group.work=null;if(group.pendingBuffer)gl.deleteBuffer(group.pendingBuffer);group.pendingBuffer=null;buildQueue.add(group);throw error;}if(step.done)group.work=null;
        if(!step.done){activeBuilds.add(group);counters.peakMeshBuilds=Math.max(counters.peakMeshBuilds,activeBuilds.size);if(urgent)urgentQueue.add(group);}else if(group.dirty)buildQueue.add(group);
        if(performance.now()-start>=3)break;
      }
`+source.slice(buildEnd);
  // Every invalidation enters the same fair queue. Resume different groups
  // between generator slices instead of starving the tail behind a large job.
  source=source.replaceAll('group.dirty=true;', 'mark(group);');
  // Restore the implementation, which must not call itself.
  source=source.replace('function mark(group){mark(group);', 'function mark(group){group.dirty=true;');
  // Geometry reads an immutable, cooperatively copied snapshot. Later checks
  // may update live rows while this build finishes; commit then queues the
  // latest revision. Selection/appearance changes still cancel explicitly.
  edit('const eligible=group.rows.filter(b=>globalThis.__BLM_MODEL__.layerVisible(b.layer,state.layerMode,state.layer,state.layerEnd));', `const eligible=[],length=group.rows.length;
      for(let i=0;i<length;i++){const b=group.rows[i];if(globalThis.__BLM_MODEL__.layerVisible(b.layer,state.layerMode,state.layer,state.layerEnd))eligible.push({x:b.x,y:b.y,z:b.z,name:b.name,layer:b.layer,expectedAir:b.expectedAir,faceMask:b.faceMask,status:b.status,actualName:b.actualName});if((i&127)===127)yield;}`);
  edit('if(group.revision!==revision){gl.deleteBuffer(pending);group.pendingBuffer=null;mark(group);return;}', '');
  // These are hard invalidations. Always close the generator AND release its
  // pending buffer instead of losing the suspended job by assigning null.
  source=source.replaceAll('group.work=null;', 'cancelBuild(group);');
  // Keep the cancellation helper non-recursive and its completion path cheap.
  source=source.replace('counters.cancelledBuilds++;}cancelBuild(group);', 'counters.cancelledBuilds++;}group.work=null;');
  edit('if(step.done)cancelBuild(group);', 'if(step.done)group.work=null;');
  edit('meshBuilds:0,uploads:0,', 'blockChecks:0,cancelledBuilds:0,peakMeshBuilds:0,meshBuilds:0,uploads:0,');
  edit('function releaseGraphics(){', 'function releaseGraphics(){buildQueue.clear();urgentQueue.clear();activeBuilds.clear();resetNear();');
  edit('generation++;textures.clear();groups.clear();', 'generation++;buildQueue.clear();urgentQueue.clear();activeBuilds.clear();resetNear();textures.clear();groups.clear();');
  edit('function disposeGroup(group){', 'function disposeGroup(group){buildQueue.delete(group);urgentQueue.delete(group);cancelBuild(group);');
  edit('if(now-lastCheck>=1000)', 'if(now-lastCheck>=250)');
  edit('if(!blocks.length&&!box)return;', 'if(!blocks.length&&!box){if(program)releaseGraphics();return;}');
  edit('groups:groups.size,indexedRows:', 'priorityRows:nearCount,priorityIndexPending:nearPending,activeMeshBuilds:activeBuilds.size,groups:groups.size,indexedRows:');
 }
 if(name==='placement.js'){
  // Reused view rows must follow a changed transform, not their old position.
  edit('row.sourceKey=key;', "if(row.x!==position[0]||row.y!==position[1]||row.z!==position[2]){row.status='unknown';row.actualName=null;delete row.checkedAt;}row.x=position[0];row.y=position[1];row.z=position[2];row.layer=y;row.chunkKey=chunkKey;row.sourceKey=key;");
 }
 if(name==='litematica.js'){
  edit("[['build','Build'],['select','Select'],['place','Place']]", "[['build','Build guide'],['select','Select & export'],['place','Creative paste']]");
  edit("const name=el('div','blm-model-name')", "const modes=el('div','blm-actions blm-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','Litematica task');for(const [value,label]of [['build','Build guide'],['select','Select & export'],['place','Creative paste']]){const b=button(label,()=>change('mode',value));b.dataset.blmMode=value;modes.append(b);}top.append(modes);fields.get('mode').input.closest('.SettingBox').hidden=true;\n    const guide=el('p','blm-note'),legend=el('div','blm-legend');for(const [color,label]of [['blue','Blue: missing block'],['red','Red: wrong block'],['pink','Pink: extra block']])legend.append(el('span','blm-legend-'+color,label));top.append(guide,legend);\n    const name=el('div','blm-model-name')");
  edit("['render','Display',true]", "['render','Appearance & layers',false]");
  edit("cancelPlace=button('Cancel paste',()=>placing?.cancel());", "cancelPlace=button('Cancel paste',()=>placing?.cancel()),pasteButton=button('Paste at these coordinates',()=>placing?.start({closeSettings:true}));");
  edit('paste.rows.append(placeHelp,placeStatus,cancelPlace)', 'paste.rows.append(placeHelp,pasteButton,placeStatus,cancelPlace)');
  edit('cachedUI={page,name,', 'cachedUI={guide,modes,pasteButton,page,name,');
  edit("write(cachedUI.placeHelp,'Close Settings and press '", "write(cachedUI.guide,state.mode==='select'?'1. Hold a Stick to mark both corners. 2. Download your selection.':state.mode==='place'?'1. Import a schematic. 2. Check its position. 3. Paste with Creative and Owner / Builder rights.':'1. Import a schematic. 2. Move it to your player. 3. Follow the blue blocks; enable EZ Building under Appearance & layers if wanted.');for(const b of cachedUI.modes.children)b.setAttribute('aria-pressed',String(b.dataset.blmMode===state.mode));cachedUI.pasteButton.disabled=!model||Boolean(placing?.diagnostics().busy);write(cachedUI.placeHelp,'Target: '+[state.x,state.y,state.z].join(', ')+' · '+(model?model.size.join(' × ')+' cells. ':'')+'Use the paste button, or close Settings and press '");
  edit("#blm-settings-page .blm-title{", "#blm-settings-page .blm-modes button[aria-pressed=true]{outline:2px solid var(--secondary-1,#ffb914);outline-offset:2px}\n      #blm-settings-page .blm-legend{display:flex;flex-wrap:wrap;gap:.6rem;font-size:.85rem;margin:.8rem 0}\n      #blm-settings-page .blm-legend span{border-left:4px solid;padding:.25rem .5rem;background:#0002}\n      #blm-settings-page .blm-legend-blue{border-color:#38a6ff!important}#blm-settings-page .blm-legend-red{border-color:#ff3030!important}#blm-settings-page .blm-legend-pink{border-color:#ff40a6!important}\n      #blm-settings-page .blm-title{");
 }
 return source;
}
module.exports={adaptLitematicaInteraction};
