'use strict';
// Serialized into the user-opened game's MAIN world. Reads the actual preview
// rig and source textures. Never reads a rendered character image or tokens.
module.exports=function createCharacterCapture(encode){
 const own=o=>o&&typeof o==='object'?Object.values(Object.getOwnPropertyDescriptors(o)).filter(d=>'value'in d).map(d=>d.value):[];
 const matrix=m=>Array.from(m?.m||m?._m||m||[]),finite=a=>a&&Array.from(a).every(Number.isFinite);
 // LiteMesh exposes the original model's indexData; its index getter is
 // minified on each deployment. Babylon keeps indices on geometry.
 const indicesOf=mesh=>mesh.getIndices?.()||mesh.model?.indexData||mesh.geometry?._indices||mesh.NJ?.()||mesh._geometry?._indices;
 function preview(canvas){
  // Bloxd exposes its preview through a React imperative ref. The public bundle
  // supplies getDevInternals/ensureReadyForCapture. Only read that preview ref.
  for(let element=canvas,depth=0;element&&depth<5;element=element.parentElement,depth++){
   const key=Object.keys(element).find(k=>k.startsWith('__reactFiber$'));let fiber=key&&element[key];
   for(let n=0;fiber&&n<14;fiber=fiber.return,n++){
    const forced=fiber.memoizedProps?.forcedCosmetics;if(forced&&Object.keys(forced).length)throw Error('Finish trying on items before syncing your worn character.');
    const ref=fiber.ref?.current;if(typeof ref?.getDevInternals==='function'){const data=ref.getDevInternals();if(data?.canvas===canvas)return {ref,data,element,fiber};}
    for(let hook=fiber.memoizedState,h=0;hook&&h<40;hook=hook.next,h++)for(const value of [hook.memoizedState?.current,...own(hook.memoizedState)])if(typeof value?.getDevInternals==='function'){const data=value.getDevInternals();if(data?.canvas===canvas)return {ref:value,data,element,fiber};}
   }
  }
  throw Error('Waiting for Bloxd’s character model. Keep My Character open.');
 }
 function home(){
  const found=[];for(const canvas of document.querySelectorAll?.('canvas')||[]){try{const p=preview(canvas),type=p.data.thinInstMgr?.getObjectData(p.data.rw)?.type;if(type!=='PlayerPreview')continue;const props=p.fiber?.memoizedProps;if(props?.forcedCosmetics&&Object.keys(props.forcedCosmetics).length)continue;found.push({...p.data,home:true,canvas,engine:p.ref,connection:canvas});}catch{}}
  if(found.length!==1)throw Error('Waiting for your homepage 3D character preview.');return found[0];
 }
 function multiply(a,b){const m=new Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)m[col*4+row]+=a[k*4+row]*b[col*4+k];return m;}
 function inverse(m){if(m.length!==16||!finite(m))throw Error('Character transform is not ready.');const rows=Array.from({length:4},(_,r)=>[m[r],m[4+r],m[8+r],m[12+r],...Array.from({length:4},(_,c)=>Number(c===r))]);for(let c=0;c<4;c++){let pivot=c;for(let r=c+1;r<4;r++)if(Math.abs(rows[r][c])>Math.abs(rows[pivot][c]))pivot=r;if(Math.abs(rows[pivot][c])<1e-12)throw Error('Invalid character transform.');[rows[c],rows[pivot]]=[rows[pivot],rows[c]];const scale=rows[c][c];rows[c]=rows[c].map(v=>v/scale);for(let r=0;r<4;r++)if(r!==c){const n=rows[r][c];rows[r]=rows[r].map((v,k)=>v-n*rows[c][k]);}}return Array.from({length:16},(_,i)=>rows[i%4][4+Math.floor(i/4)]);}
 function world(api){
  const s=api?.singletons,client=s?.bloxd?.client,active=client?.msgHandler||client?.clientGame;
  // The source's finalized game/handler identifies a joined session as well.
  // A URL alone is not its only active-session signal. Never use a replay or
  // a preloaded menu engine as evidence of the account's joined character.
  if(!s||!s.connectedWebsocketUrl&&(!active||typeof active!=='object')||client?.gameReplayer?.recording!=null)throw Error('Waiting for a game join.');
  const connection=active&&typeof active==='object'?active:s.connectedWebsocketUrl;
  // The local entity and renderer fields are renamed on Bloxd deployments.
  // Follow the constructor's local ECS add, then the named humanoid component.
  // A thin object is accepted only when its manager confirms that entity as
  // owner. Never choose a player by its mesh name, position or slot number.
  const matches=[];
  for(const engine of new Set(own(s))){
   const entities=engine?.entities;if(!engine?.container||!engine.inputs||typeof entities?.getState!=='function'||!s.connectedWebsocketUrl&&!own(client).includes(engine))continue;
   const playerKey=String(engine.constructor).match(/this\.([\w$]+)=[\w$]+\.add\(/)?.[1],player=playerKey&&engine[playerKey];
   if(player===undefined||player===null)continue;
   let component;try{component=entities.getState(player,'humanoidMesh');}catch{continue;}if(!component)continue;
   for(const renderer of new Set(own(engine).filter(v=>v&&typeof v==='object'&&!Array.isArray(v)&&!ArrayBuffer.isView(v))))for(const manager of new Set(own(renderer))){
    if(!Array.isArray(manager?.thinMeshes)||typeof manager.getObjectData!=='function'||typeof manager.getTypeNodes!=='function'||typeof manager.getEntityId!=='function'||typeof manager.has!=='function')continue;
    for(const rw of new Set(own(component).filter(v=>Number.isInteger(v)&&v>=0))){try{
     if(!manager.has(rw)||manager.getEntityId(rw)!==player)continue;const object=manager.getObjectData(rw);
     if(!/^Player(?:\||$)/.test(object.type)||object.type.endsWith('Preview'))continue;
     if(!matches.some(m=>m.engine===engine&&m.thinInstMgr===manager&&m.rw===rw))matches.push({thinInstMgr:manager,rw,engine,entities,player,component,connection});
    }catch{}}
   }
  }
  if(matches.length===1)return matches[0];if(matches.length>1)throw Error('Waiting for an unambiguous local player model.');
  // Preserve the previously supported source layout, without applying its
  // old field names to a structurally discovered modern engine.
  const engine=s.YK||s.bloxd?.YK||own(s).find(v=>v?.Fn?.mY&&v?.Qw&&v.Dw!==undefined),manager=engine?.Fn?.mY;
  if(!s.connectedWebsocketUrl&&!own(client).includes(engine))throw Error('Waiting for your joined player model.');
  if(!manager||!engine.Qw||engine.Dw===undefined||engine.Dw===null)throw Error('Waiting for your player model.');const component=engine.Qw.Vy?.(engine.Dw)||engine.Qw.PN?.(engine.Dw),rw=component?.rw;if(!Number.isInteger(rw)||manager.has?.(rw)===false)throw Error('Waiting for your player geometry.');const object=manager.getObjectData(rw);if(!/^Player(?:\||$)/.test(object.type)||object.type.endsWith('Preview'))throw Error('Waiting for your own player model.');return {thinInstMgr:manager,rw,engine,component,connection};
 }
 function records(data,restPose=false){
  const manager=data.thinInstMgr,result=[],visited=new Set();
  let cosmeticEntries;
  function worn(id){if(!restPose||!data.entities||data.player==null)return true;if(!cosmeticEntries){const component=data.entities.getState(data.player,'meshAttachments');if(!Array.isArray(component?.attachments))throw Error('Worn cosmetic registry is not ready.');cosmeticEntries=component.attachments;}return cosmeticEntries.some(entry=>typeof entry.modelGlb==='string'&&typeof entry.modelNode==='string'&&typeof entry.destNode==='string'&&own(entry).includes(id));}
  function attachment(node,remap){if(!node)return;const indices=indicesOf(node);const visible=node.isVisible!==false&&node.visibility!==0&&(restPose?node._nodeDataStorage?._isEnabled!==false:node.isEnabled?.()!==false);if(indices?.length&&visible){const actual=matrix(node.getWorldMatrix?.()||node.computeWorldMatrix?.(false));result.push({mesh:node,world:remap?multiply(remap,actual):actual,attributes:null});}for(const child of node.getChildren?.()||[])attachment(child,remap);}
  function walk(id,parent=null){if(parent&&!worn(id))return;if(visited.has(id)||visited.size>=64)throw Error('Character attachment hierarchy is invalid.');visited.add(id);const object=manager.getObjectData(id),types=manager.getTypeNodes(object.type);if(parent&&(object.parentThinObjectId!==parent.id||object.parentNodeIndex!==parent.index||typeof manager.getEntityId==='function'&&manager.getEntityId(id)!==manager.getEntityId(data.rw)))throw Error('Worn character attachment ownership is not ready.');if(!restPose&&object.visible===false)throw Error('Character model is not visible yet.');
   // Only the Player type defines armour/body groups. Cosmetic types created
   // by meshAttachments have ordinary strides and intentionally no groups.
   // Their root enabled bit follows first-person body visibility. Read their
   // local matrices against the body rest pose, as the source manager does,
   // even when their cached world matrices are stale while hidden.
   const body=restPose&&!parent?manager.groups?.[object.type]?.notArmour:null;if(restPose&&!parent&&typeof body?.has!=='function'&&!Array.isArray(body)&&!(body instanceof Uint32Array))throw Error('Player body groups are not ready.');
   const enabled=[];
   object.nodes.forEach((node,i)=>{const type=types[i];enabled[i]=(i===0||node.enabled!==false)&&(type.parent==null||enabled[type.parent]!==false);if(restPose?(parent?!enabled[i]:!(body.has?.(i)??body.includes(i))):node.qy===false)return;const actual=matrix(node.worldMatrix);let transform=restPose?matrix(type.worldMatrix):actual;if(restPose&&parent){const local=matrix(node.matrix);if(local.length!==16||!finite(local)||node.dirtyQueued)throw Error('Worn cosmetic transforms are not ready.');transform=multiply(parent.transform,local);}if(node.thinInstanceId!==null&&type.thinMeshIndex!==null){const thin=manager.thinMeshes[type.thinMeshIndex],variation=thin.idToMetadata[node.thinInstanceId]?.meshVariation;if(!variation)throw Error('Character part is not ready.');const attributes={};for(const kind of Object.keys(thin.strides))attributes[kind]=Array.from(variation.get(node.thinInstanceId,kind));if(restPose){attributes.aOpacity=[1];attributes.aOverlayColour=[0,0,0,0];}const motionName=type.name||thin.getMesh(node.thinInstanceId).name;const motion=/^(Leg|Arm)(Left|Right)Mesh$/.test(motionName)?{bone:motionName,pivot:[transform[12],transform[13],-transform[14]]}:null;result.push({mesh:thin.getMesh(node.thinInstanceId),world:transform,attributes,motion});}if(node.attachedTransformNodes?.length||node.attachedThinObjectIds?.length){if(node.attachedTransformNodes?.length){const remap=restPose?multiply(transform,inverse(actual)):null;for(const a of node.attachedTransformNodes)attachment(a,remap);}for(const child of node.attachedThinObjectIds||[])walk(child,{id,index:i,transform});}});
  }
  walk(data.rw);if(!result.length||result.length>128)throw Error('Character geometry is not ready.');return result;
 }
 function bake(record){const {mesh,world:m}=record,positions=mesh.getVerticesData('position',false,false,true),normals=mesh.getVerticesData('normal',false,false,true),uvs=mesh.getVerticesData('uv',false,false,true),indices=indicesOf(mesh);if(m.length!==16||!finite(m)||!finite(positions)||!positions.length||positions.length%3||positions.length>750000||!indices?.length||indices.length%3||indices.length>1500000||!finite(indices)||Array.from(indices).some(i=>!Number.isInteger(i)||i<0||i>=positions.length/3))throw Error('Unsupported character geometry.');
  // This preview uses rigid thin-instance body parts. Refuse unknown skinning
  // rather than saving an incorrect bind pose.
  if(mesh.skeleton||mesh.getVerticesData('matricesWeights')?.some(x=>x!==0))throw Error('This character uses an unsupported skeletal mesh.');
  const a=m[0],b=m[4],c=m[8],d=m[1],e=m[5],f=m[9],g=m[2],h=m[6],i=m[10],det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);if(Math.abs(det)<1e-12)throw Error('Character part has an invalid transform.');
  const out=new Float32Array(positions.length),normal=normals?new Float32Array(normals.length):null;
  for(let v=0;v<positions.length;v+=3){const x=positions[v],y=positions[v+1],z=positions[v+2];out[v]=a*x+b*y+c*z+m[12];out[v+1]=d*x+e*y+f*z+m[13];out[v+2]=-(g*x+h*y+i*z+m[14]);if(normal){const x=normals[v],y=normals[v+1],z=normals[v+2],nx=((e*i-f*h)*x+(f*g-d*i)*y+(d*h-e*g)*z)/det,ny=((c*h-b*i)*x+(a*i-c*g)*y+(b*g-a*h)*z)/det,nz=-((b*f-c*e)*x+(c*d-a*f)*y+(a*e-b*d)*z)/det,len=Math.hypot(nx,ny,nz)||1;normal[v]=nx/len;normal[v+1]=ny/len;normal[v+2]=nz/len;}}
  const triangles=new Uint32Array(indices);if(det>0)for(let t=0;t<triangles.length;t+=3){const x=triangles[t+1];triangles[t+1]=triangles[t+2];triangles[t+2]=x;}
  return {name:mesh.name,positions:out,normals:normal,uvs:uvs?new Float32Array(uvs):null,indices:triangles};
 }
 function materialOf(mesh){
  const material=mesh.material;
  // LiteMaterial is a small mirror. Its owned model holds textures/features;
  // these properties deliberately do not exist on the mirror itself.
  if(material?.getClassName?.()==='LiteMaterial'){
   const model=material.model;
   if(!model||model.mirror!==material||!Array.isArray(model.features)||model.diffuseColor?.length!==3)throw Error('Character material model is not ready.');
   return model;
  }
  if(!material&&mesh.getClassName?.()==='LiteMesh')throw Error('Character material is not ready.');
  return material;
 }
 const textureUrl=texture=>texture?.source?texture.source.url:texture?.url||texture?.name;
 const inverted=texture=>texture?.sampler?texture.sampler.invertY===true:texture?._invertY===true;
 function plugins(material){
  if(Array.isArray(material?.features))return material.features.filter(entry=>entry.active===true).map(entry=>({getClassName:()=>entry.feature?.className,featureState:entry.state}));
  // Babylon can expose both manager fields. An empty first array must not
  // hide the populated manager that owns the active material plugins.
  return [...new Set([material?._pluginManager,material?.pluginManager,...own(material)].flatMap(manager=>Array.isArray(manager?._plugins)?manager._plugins:[]))];
 }
 // Current Bloxd wraps a feature definition in a Babylon plugin. Its shader
 // callbacks receive featureState as `this`; older plugins own fields directly.
 function pluginState(plugin){return plugin&&Object.hasOwn(plugin,'featureState')?plugin.featureState:plugin;}
 async function sourceImage(texture){if(texture.released===true||texture.isReady?.()===false)throw Error('Waiting for character textures.');const source=textureUrl(texture);if(typeof source!=='string'||source.length>12*1024*1024)throw Error('Character texture file is unavailable.');const embedded=/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/]+=*$/.test(source),url=embedded?null:new URL(source,location.href);if(!embedded&&(url.protocol!=='https:'||url.origin!==location.origin||(!url.pathname.startsWith('/textures/')&&!url.pathname.startsWith('/static/media/'))))throw Error('Character texture must come from a Bloxd asset file.');const response=await fetch(embedded?source:url.href,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Character texture could not be loaded.');const blob=await response.blob();if(blob.size>8*1024*1024)throw Error('Character texture is too large.');const bitmap=await createImageBitmap(blob);if(bitmap.width>4096||bitmap.height>4096){bitmap.close();throw Error('Character texture exceeds image budget.');}return bitmap;}
 function canvas(width,height){const c=document.createElement('canvas');c.width=width;c.height=height;const context=c.getContext('2d');if(!context)throw Error('Texture decoding is unavailable.');context.imageSmoothingEnabled=false;return {c,context};}
 async function png(c){const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not encode character texture.');return new Uint8Array(await blob.arrayBuffer());}
 // Bake Bloxd's HueTintMaterialPlugin from original asset pixels. This is
 // texture processing, independent of any game canvas or graphics context.
 function tintTexture(context,width,height,colour){
  const [r,g,b]=colour,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  const overlayHue=delta?((max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4)/6+1)%1:0,overlaySat=delta/(max+1e-10);
  const pixels=context.getImageData(0,0,width,height),p=pixels.data,palette=new Uint8Array(256*3),phase=[0,2/3,1/3];
  // The source tint depends only on the largest 8-bit colour channel. Build
  // its 256-entry palette once instead of doing HSV/trigonometry per pixel.
  for(let grey=3;grey<253;grey++){const t=grey/255-.5,abst=Math.abs(t),target=t>0?.125:.625;let dh=target-overlayHue;dh-=Math.floor(dh+.5);const hue=(overlayHue+dh*abst*.5*Math.sin(3.14159265*Math.abs(dh)*2)+1)%1,sign=t>0?-1:1,sat=overlaySat+sign*.5*abst,val=max-sign*.5*abst;
   for(let k=0;k<3;k++){const wave=Math.abs(((hue+phase[k])%1)*6-3),channel=Math.max(0,Math.min(1,wave-1));palette[grey*3+k]=Math.round(Math.max(0,Math.min(1,val*((1-sat)+channel*sat)))*255);}
  }
  for(let i=0;i<p.length;i+=4){const grey=Math.max(p[i],p[i+1],p[i+2]);if(grey<3||grey>252)continue;for(let k=0;k<3;k++)p[i+k]=palette[grey*3+k];}
  context.putImageData(pixels,0,0);
 }
 async function exportModel(canvasElement){
  const found=preview(canvasElement);for(const key of ['skin','hat','head','eyebrows','eyes','back','body','legs','shoes','cape']){let timer;try{await Promise.race([found.ref.ensureReadyForCapture?.(key),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Character assets are still loading.')),8000);})]);}finally{clearTimeout(timer);}}
  // Check forced try-on props again after asynchronous loading finishes.
  const data=preview(canvasElement).data;return exportRecords(records(data));
 }
 async function exportWorld(api){return exportRecords(records(world(api),true));}
 async function exportRecords(items){const parts=[],images=[],cache=new Map(),imageSources=new Map();
  try{for(const item of items){const part=bake(item);if(item.motion)part.motion=item.motion;const material=materialOf(item.mesh);if(material?.subMaterials)throw Error('Unsupported character multi-material.');const texture=material?.diffuseTexture||material?.albedoTexture,materialPlugins=plugins(material),lifeformPlugin=materialPlugins.find(p=>p.getClassName?.()==='LifeformMaterialPlugin'),armourPlugin=materialPlugins.find(p=>p.getClassName?.()==='ArmourMaterialPlugin'),lifeform=pluginState(lifeformPlugin),armour=pluginState(armourPlugin),attrs=item.attributes||{};
   if(lifeformPlugin&&(!lifeform||typeof lifeform!=='object')||armourPlugin&&(!armour||typeof armour!=='object'))throw Error('Character material feature state is not ready.');
   if(lifeform&&armour)throw Error('Conflicting character atlas materials.');
   if((material?.lifeform===true||lifeformPlugin||armourPlugin)&&!texture)throw Error('Character texture is not ready.');
   const diffuse=material?.diffuseColor||material?.albedoColor;part.color=lifeform?[1,1,1,1]:[diffuse?.r??diffuse?.[0]??1,diffuse?.g??diffuse?.[1]??1,diffuse?.b??diffuse?.[2]??1,material?.alpha??1];const overlay=attrs.aOverlayColour;if(overlay?.length===4&&overlay[3]>0){for(let n=0;n<3;n++)part.color[n]=part.color[n]*(1-overlay[3])+overlay[n]*overlay[3];}part.color[3]*=attrs.aOpacity?.[0]??1;part.color=part.color.map(v=>Math.max(0,Math.min(1,v)));part.doubleSided=material?.backFaceCulling===false;part.alphaMode=part.color[3]<1?'BLEND':'MASK';
   if(texture){if(!part.uvs)throw Error('Character texture coordinates are missing.');if(!imageSources.has(texture))imageSources.set(texture,await sourceImage(texture));const bitmap=imageSources.get(texture),layers=[];if(lifeform){if(!Number.isInteger(lifeform.numLayers)||lifeform.numLayers<1||lifeform.numLayers>16||!Number.isInteger(lifeform.atlasWidth)||!Number.isInteger(lifeform.atlasHeight)||lifeform.atlasWidth<1||lifeform.atlasHeight<1)throw Error('Character atlas layout is not ready.');for(let n=0;n<lifeform.numLayers;n++){const index=attrs['aAtlasIdx'+(1+(n>>2))]?.[n%4];if(!Number.isInteger(index)||index<0||index>=lifeform.atlasWidth*lifeform.atlasHeight)throw Error('Worn character layers are not ready.');layers.push(index);}}
    if(armour){if(!Number.isInteger(armour.numTexturesInAtlas)||armour.numTexturesInAtlas<1||armour.numTexturesInAtlas>4096)throw Error('Character armour atlas layout is not ready.');const index=attrs.aAtlasIdx1?.[0],tint=attrs.aArmourTint;if(!Number.isInteger(index)||index<0||index>=armour.numTexturesInAtlas||!tint||![3,4].includes(tint.length)||!finite(tint)||Array.from(tint).slice(0,3).some(v=>v<0||v>1))throw Error('Worn character armour is not ready.');layers.push(index);for(let n=0;n<3;n++)part.color[n]*=tint[n];}
    const huePlugin=plugins(material).some(p=>p.getClassName?.()==='HueTintMaterialPlugin'),hue=huePlugin?attrs.aHueColour:null;if(huePlugin&&(!hue||hue.length!==4||!finite(hue)||hue.some(v=>v<0||v>1)))throw Error('Worn cosmetic colours are not ready.');const tint=hue?.[3]>.5?hue.slice(0,3):null;
    const key=textureUrl(texture)+'|'+(lifeform?'lifeform':armour?'armour':'plain')+'|'+layers.join(',')+'|'+(tint?.join(',')||'');if(!cache.has(key)){let width=bitmap.width,height=bitmap.height;const cols=lifeform?.atlasWidth||armour?.numTexturesInAtlas||1,rows=lifeform?.atlasHeight||1;if(lifeform||armour){width/=cols;height/=rows;}if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Invalid character atlas dimensions.');const {c,context}=canvas(width,height);if(layers.length){for(const tile of [...layers].reverse()){const col=tile%cols,row=Math.floor(tile/cols);if(row>=rows)throw Error('Character atlas index is out of bounds.');const y=inverted(texture)?rows-row-1:row;context.drawImage(bitmap,col*width,y*height,width,height,0,0,width,height);}}else context.drawImage(bitmap,0,0);if(tint)tintTexture(context,width,height,tint);cache.set(key,images.length);images.push({bytes:await png(c)});}part.image=cache.get(key);
    if(inverted(texture))for(let n=1;n<part.uvs.length;n+=2)part.uvs[n]=1-part.uvs[n];
   }
   // Source vertex colours are part of attachment appearance, when present.
   const color=item.mesh.getVerticesData('color',false,false,true);if(color?.length===part.positions.length/3*4)part.colors=new Float32Array(color);
   parts.push(part);
  }}finally{for(const image of imageSources.values())image.close();}
  if(parts.reduce((n,p)=>n+p.positions.length/3,0)>250000)throw Error('Character exceeds geometry budget.');const bytes=encode(parts,images);if(bytes.byteLength>32*1024*1024)throw Error('3D character exceeds file budget.');return bytes;
 }
 function signature(data){return JSON.stringify(records(data,!data.home).map(r=>({name:r.mesh.name,id:r.mesh.uniqueId,vertices:r.mesh.getTotalVertices?.(),texture:textureUrl(materialOf(r.mesh)?.diffuseTexture||materialOf(r.mesh)?.albedoTexture),layers:Object.entries(r.attributes||{}).filter(([k])=>k.startsWith('aAtlasIdx')||k==='aHueColour'||k==='aArmourTint'),visible:r.mesh._nodeDataStorage?._isEnabled})));}
 return {preview,home,world,records,bake,signature,exportModel,exportWorld};
};
