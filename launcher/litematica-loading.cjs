'use strict';
// Serialized into the verified Litematica snapshot. No game/account access.
async function parseResponsive(input,fileName,resolveId,{cancelled=()=>false}={}){
 const MAX_AXIS=32768,MAX_CHUNKS=8192,MAX_BLOCKS=8000000,bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 const fail=message=>{throw Error(message);};if(bytes.length>8*1024*1024)fail('File exceeds 8 MB.');
 let pos=0,deadline=performance.now()+2,steps=0;
 const check=()=>{if(cancelled())throw Object.assign(Error('Import cancelled.'),{name:'AbortError'});};
 async function pause(){check();await new Promise(resolve=>setTimeout(resolve,0));check();deadline=performance.now()+2;}
 function reserve(n){if(!Number.isSafeInteger(n)||n<0||pos+n>bytes.length)fail('Bloxd schematic is truncated or corrupted.');const start=pos;pos+=n;return start;}
 function uint(end=bytes.length){let value=0;for(let shift=0;shift<=28;shift+=7){if(pos>=end)fail('Bloxd schematic has truncated block data.');const b=bytes[pos++];value+=(b&127)*2**shift;if(!(b&128)){if(value>0xffffffff)fail('Invalid Bloxd integer.');return value;}}fail('Invalid Bloxd integer.');}
 const int=()=>{const value=uint();return value%2?-(value+1)/2:value/2;},decoder=new TextDecoder('utf-8',{fatal:true});
 const blob=()=>{const n=int(),start=reserve(n);return bytes.subarray(start,start+n);},string=()=>decoder.decode(blob());
 async function array(read,limit){let total=0;for(;;){let count=int();if(!count)return total;let end=null;if(count<0){count=-count;const length=int();if(length<0||length>bytes.length-pos)fail('Invalid Bloxd array block size.');end=pos+length;}total+=count;if(total>limit)fail('Bloxd schematic contains too many records.');for(let i=0;i<count;i++){const task=read();if(task?.then)await task;if((++steps&255)===0&&performance.now()>=deadline)await pause();}if(end!==null&&end!==pos)fail('Invalid Bloxd array block size.');}}
 reserve(4);const version=bytes[0];if(version>4||bytes[1]||bytes[2]||bytes[3])fail('Unsupported Bloxd schematic header (supported versions: 0–4).');
 const name=string(),selection=[int(),int(),int()],size=[int(),int(),int()];if(size.some(n=>n<1||n>MAX_AXIS))fail('Invalid dimensions (maximum 32,768 blocks per axis).');if(!Number.isSafeInteger(size[0]*size[1]*size[2]))fail('Invalid schematic volume.');
 const blocks=[],chunks=[],counts=Object.create(null),nativeMapping=Object.create(null),seen=new Set(),unknown=new Set(),expand=size[0]*size[1]*size[2]<=32768;let blockCount=0,variants=false;
 function sourceFor(id){const source='bloxd:'+id;if(Object.hasOwn(nativeMapping,source))return source;let raw;try{raw=resolveId?.(id);}catch{}if(typeof raw!=='string'||!raw||raw==='Air')raw=globalThis.BLOXD_BLOCK_IDS?.[id];const blockName=typeof raw==='string'&&raw!=='Air'?raw:'';nativeMapping[source]=blockName;if(!blockName)unknown.add(id);return source;}
 await array(async()=>{
  check();const chunk=[int(),int(),int()],key=chunk.join(',');if(seen.has(key))fail('Duplicate Bloxd schematic chunk.');seen.add(key);
  const data=blob(),end=pos,start=end-data.length,saved={x:chunk[0],y:chunk[1],z:chunk[2],data:data.slice(),nonAir:0};
  const lo=chunk.map((v,i)=>Math.max(0,Math.min(32,selection[i]-v*32))),hi=chunk.map((v,i)=>Math.max(0,Math.min(32,selection[i]+size[i]-v*32))),dy=hi[1]-lo[1],dz=hi[2]-lo[2];
  // Count selection-clipped cells in [0,n) in X/Y/Z chunk order. A long RLE
  // run is counted arithmetically, without expanding millions of required rows.
  function prefix(n){const x=n>>>10,y=(n>>>5)&31,z=n&31;let count=Math.max(0,Math.min(x,hi[0])-lo[0])*dy*dz;if(x>=lo[0]&&x<hi[0]){count+=Math.max(0,Math.min(y,hi[1])-lo[1])*dz;if(y>=lo[1]&&y<hi[1])count+=Math.max(0,Math.min(z,hi[2])-lo[2]);}return count;}
  pos=start;let index=0,runs=0;
  while(pos<end){const count=uint(end),id=uint(end);if(!count||count>32768-index)fail('Invalid Bloxd block run length.');
   if(id){const inside=prefix(index+count)-prefix(index);if(inside){const source=sourceFor(id);blockCount+=inside;if(blockCount>MAX_BLOCKS)fail('Schematic exceeds 8,000,000 required blocks.');saved.nonAir+=inside;counts[source]=(counts[source]||0)+inside;
     if(expand)for(let i=index;i<index+count;i++){const x=chunk[0]*32+(i>>>10)-selection[0],y=chunk[1]*32+((i>>>5)&31)-selection[1],z=chunk[2]*32+(i&31)-selection[2];if(x>=0&&y>=0&&z>=0&&x<size[0]&&y<size[1]&&z<size[2])blocks.push([x,y,z,source]);if((i&1023)===1023&&performance.now()>=deadline)await pause();}
   }}index+=count;if((++runs&1023)===0&&performance.now()>=deadline)await pause();
  }if(index!==32768)fail('Bloxd chunk must contain exactly 32,768 positions.');chunks.push(saved);if(performance.now()>=deadline)await pause();
 },MAX_CHUNKS);
 let metadata=0,global=null,originMode=null;if(pos<bytes.length)metadata=await array(()=>{int();int();int();string();},1000000);else if(version>=1)fail('Bloxd schematic is truncated or corrupted.');if(pos<bytes.length)global=[int(),int(),int()];if(pos<bytes.length){originMode=int();int();}if(pos!==bytes.length||version>=4&&(global===null||originMode===null))fail('Invalid Bloxd schematic metadata.');if(!blockCount)fail('Schematic contains only air inside its selection.');check();
 const warnings=[];if(metadata)warnings.push('Block data, such as code, chest contents and sign text, is omitted.');if(variants)warnings.push('Block variant states and orientation are represented by the base Bloxd block.');if(unknown.size)warnings.push('Unknown Bloxd block IDs: '+[...unknown].slice(0,20).join(', ')+'. Choose replacements in Block mapping.');
 return {name:name||fileName||'Bloxd schematic',format:'bloxd',version,size,offset:[0,0,0],selection,global,originMode,blocks,blockCount,chunks,counts,nativeMapping,warnings};
}
function adaptLitematicaLoading(name,source){
 const edit=(from,to)=>{if(!source.includes(from))throw Error('Litematica loading adapter mismatch: '+name+' / '+from.slice(0,70));source=source.replace(from,()=>to);};
 if(name==='bloxdschem.js'){
  const start=source.indexOf('  async function parseBloxdSchem('),end=source.indexOf('  return { parseBloxdSchem,',start);if(start<0||end<0)throw Error('Litematica parser mismatch.');
  source=source.slice(0,start)+'  const parseBloxdSchem='+parseResponsive.toString()+';\n'+source.slice(end);
 }
 if(name==='litematica.js')edit('lib.parseBloxdSchem(input,file.name,id=>adapter.resolveItemName(id))','lib.parseBloxdSchem(input,file.name,id=>adapter.resolveItemName(id),{cancelled:()=>token!==importToken})');
 if(name==='placement.js'){
  edit('let previous=new Map(),plan=null,', "let requestedKey='',previous=new Map(),plan=null,");
  edit('if(!plan||plan.key!==key){', `requestedKey=key;
      const parameters=JSON.stringify([state.layerMode,state.layer,state.layerEnd,state.distance,state.maxRender,state.showExtra,options,mapping]);
      // Finish a nearby pending camera selection instead of restarting it on
      // every 16-block boundary. Explicit settings/transforms and teleports
      // still replace it immediately. Keep the latest request observable.
      const continuePending=plan&&!plan.done&&plan.parameters===parameters&&local.reduce((n,v,i)=>n+(v-plan.local[i])**2,0)<=32*32;
      if(!plan||plan.key!==key&&!continuePending){`);
  edit('if(plan?.rows.length)previous=new Map(plan.rows.map(row=>[row.sourceKey,row]));', 'const fallback=plan?.rows.length?plan.rows:plan?.fallback||[];if(plan?.rows.length)previous=plan.next;');
  edit('plan={key,relevant,cursor:', 'plan={fallback,key,parameters,relevant,cursor:');
  edit('          plan.emitAt=j+1;', '          if((j&255)===0&&performance.now()>=deadline){interrupted=true;break;}plan.emitAt=j+1;');
  edit('          if((j&255)===255&&performance.now()>=deadline){interrupted=true;break;}', '');
  edit('const rows=plan.rows.length?plan.rows:[...previous.values()];', 'const rows=plan.rows.length||plan.done?plan.rows:plan.fallback;');
  source=source.replaceAll('Boolean(plan&&!plan.done)', 'Boolean(plan&&(!plan.done||plan.key!==requestedKey))');
 }
 if(name==='renderer.js'){
  edit('function disposeGroup(group){', 'function disposeGroup(group){if(gl&&group.pendingBuffer)gl.deleteBuffer(group.pendingBuffer);group.pendingBuffer=null;if(gl&&group.vao)gl.deleteVertexArray(group.vao);group.vao=null;');
  edit('      const revision=group.revision;', '      if(group.pendingBuffer)gl.deleteBuffer(group.pendingBuffer);group.pendingBuffer=null;const revision=group.revision;');
  edit('if(!group.buffer)group.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,group.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);', `const packed=new Float32Array(data.length);for(let i=0;i<data.length;i++){packed[i]=data[i];if((i&8191)===8191)yield;}data.length=0;
      const pending=gl.createBuffer();group.pendingBuffer=pending;gl.bindBuffer(gl.ARRAY_BUFFER,pending);gl.bufferData(gl.ARRAY_BUFFER,packed.byteLength,gl.STATIC_DRAW);
      for(let at=0;at<packed.length;at+=65536){gl.bindBuffer(gl.ARRAY_BUFFER,pending);gl.bufferSubData(gl.ARRAY_BUFFER,at*4,packed.subarray(at,Math.min(packed.length,at+65536)));yield;}
      if(group.revision!==revision){gl.deleteBuffer(pending);group.pendingBuffer=null;group.dirty=true;return;}
      if(group.buffer)gl.deleteBuffer(group.buffer);if(group.vao)gl.deleteVertexArray(group.vao);group.vao=null;group.buffer=pending;group.pendingBuffer=null;`);
  edit('count:item.vertices.length/12});}', 'count:item.vertices.length/12});item.vertices=null;}');
  edit('color:item.color});}', 'color:item.color});item.vertices=null;}');
  edit('function attributes(group){gl.bindBuffer', 'function attributes(group){if(group.vao){gl.bindVertexArray(group.vao);return;}group.vao=gl.createVertexArray();gl.bindVertexArray(group.vao);gl.bindBuffer');
  edit('if(areaMesh?.buffer)gl.deleteBuffer(areaMesh.buffer);const fill=', 'if(areaMesh?.buffer)gl.deleteBuffer(areaMesh.buffer);if(areaMesh?.vao)gl.deleteVertexArray(areaMesh.vao);const fill=');
  edit('if(areaMesh?.buffer)gl.deleteBuffer(areaMesh.buffer);if(program)', 'if(areaMesh?.buffer)gl.deleteBuffer(areaMesh.buffer);if(areaMesh?.vao)gl.deleteVertexArray(areaMesh.vao);if(program)');
  edit('lastActors=foreground?.draw(', 'gl.bindVertexArray(vao);lastActors=foreground?.draw(');
  // A conservative screen rectangle limits only the secondary capture. The
  // source draw and source scissor are always executed unchanged.
  edit('withState();resetUnpack();nativeFrame.begin(saved,connection.clip?.()||{reverse:false});', `withState();resetUnpack();
        const viewport=saved.VIEWPORT,rect=[viewport[0]+viewport[2],viewport[1]+viewport[3],viewport[0],viewport[1]];let full=false,colorNeeded=false;
        function include(b){if(!b||!matrix||!origin){full=true;return;}for(let i=0;i<8;i++){const x=b[i&1?3:0]-origin[0],y=b[i&2?4:1]-origin[1],z=b[i&4?5:2]-origin[2],w=x*matrix[3]+y*matrix[7]+z*matrix[11]+matrix[15];if(w<=.001){full=true;return;}const sx=viewport[0]+((x*matrix[0]+y*matrix[4]+z*matrix[8]+matrix[12])/w+1)*viewport[2]/2,sy=viewport[1]+((x*matrix[1]+y*matrix[5]+z*matrix[9]+matrix[13])/w+1)*viewport[3]/2;rect[0]=Math.min(rect[0],sx);rect[1]=Math.min(rect[1],sy);rect[2]=Math.max(rect[2],sx);rect[3]=Math.max(rect[3],sy);}}
        if(visibleBox)include([...box.min,...box.max.map(n=>n+1)]);
        for(const group of groups.values())if(drawable(group,state)&&inView(group.bounds,matrix,origin,camera,state.distance)){include(group.bounds);if(group.draws.some(item=>item.kind==='wrong'&&state.showWrong||item.kind==='extra'&&state.showExtra))colorNeeded=true;}
        const pad=Math.ceil(state.lineWidth*(viewport[2]/Math.max(1,connection.canvas.getBoundingClientRect().width)))+2;
        const x0=full?viewport[0]:Math.max(viewport[0],Math.floor(rect[0]-pad)),y0=full?viewport[1]:Math.max(viewport[1],Math.floor(rect[1]-pad)),x1=full?viewport[0]+viewport[2]:Math.min(viewport[0]+viewport[2],Math.ceil(rect[2]+pad)),y1=full?viewport[1]+viewport[3]:Math.min(viewport[1]+viewport[3],Math.ceil(rect[3]+pad));
        nativeFrame.begin(saved,connection.clip?.()||{reverse:false},{rect:[x0,y0,Math.max(0,x1-x0),Math.max(0,y1-y0)],color:colorNeeded});`);
 }
 if(name==='native-frame.js'){
  edit("let targets=null,active=false", "let region=null,limited=false,nativeScissor=null,nativeScissorEnabled=false;const scissor=gl.scissor,enable=gl.enable,disable=gl.disable;\n    let targets=null,active=false");
  edit('try{originalBind.call(gl,gl.DRAW_FRAMEBUFFER,targets.snapshot);method.apply(object,args);', `try{originalBind.call(gl,gl.DRAW_FRAMEBUFFER,targets.snapshot);
        if(limited&&region){let r=region;if(nativeScissorEnabled){const x=Math.max(r[0],nativeScissor[0]),y=Math.max(r[1],nativeScissor[1]);r=[x,y,Math.max(0,Math.min(r[0]+r[2],nativeScissor[0]+nativeScissor[2])-x),Math.max(0,Math.min(r[1]+r[3],nativeScissor[1]+nativeScissor[3])-y)];}enable.call(gl,gl.SCISSOR_TEST);scissor.apply(gl,r);}
        method.apply(object,args);`);
  edit('finally{originalBind.call(gl,gl.DRAW_FRAMEBUFFER,current);replaying=false;}', 'finally{if(limited&&region){scissor.apply(gl,nativeScissor);(nativeScissorEnabled?enable:disable).call(gl,gl.SCISSOR_TEST);}originalBind.call(gl,gl.DRAW_FRAMEBUFFER,current);replaying=false;}');
  edit("    hook(gl,'bindFramebuffer',true);", `    let scissorObserved=true;
    for(const [name,original]of [['scissor',scissor],['enable',enable],['disable',disable]]){const wrapper=function(...args){const result=original.apply(this,args);if(active&&!replaying){if(name==='scissor'){if(args.length===4&&args.every(Number.isInteger)&&args.every(n=>n>=-2147483648&&n<=2147483647)&&args[2]>=0&&args[3]>=0)nativeScissor=args.slice();else region=null;}else if(args[0]===gl.SCISSOR_TEST)nativeScissorEnabled=name==='enable';}return result;};try{gl[name]=wrapper;if(gl[name]!==wrapper)scissorObserved=false;else hooks.push({object:gl,name,original,wrapper});}catch{scissorObserved=false;}}
    hook(gl,'bindFramebuffer',true);`);
  edit('function begin(s,clip){', 'function begin(s,clip,capture={}){region=scissorObserved?capture.rect||null:null;limited=!!region&&region[2]*region[3]<s.VIEWPORT[2]*s.VIEWPORT[3]*.75;nativeScissor=s.SCISSOR_BOX.slice();nativeScissorEnabled=s.enabled.SCISSOR_TEST;');
  edit('gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,targets.snapshot);gl.disable(gl.SCISSOR_TEST);', 'gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,targets.snapshot);targets.colorCapture=capture.color!==false;gl.drawBuffers([capture.color===false?gl.NONE:gl.COLOR_ATTACHMENT0]);if(limited&&region){enable.call(gl,gl.SCISSOR_TEST);scissor.apply(gl,region);}else gl.disable(gl.SCISSOR_TEST);');
  edit('diagnostics:()=>({...counts,ready,fault})', 'diagnostics:()=>({...counts,ready,fault,region:region?.slice(),colorCapture:targets?.colorCapture!==false})');
 }
 return source;
}
module.exports={adaptLitematicaLoading,parseResponsive};
