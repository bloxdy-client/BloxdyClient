'use strict';
// Only synthetic geometry, mocked texture decoding and temporary file storage.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{encodeCharacter,validateCharacter}=require('../character-glb.cjs'),capture=require('../character-capture.cjs'),fixture=require('./character-fixture.cjs'),{Store}=require('../store.cjs');
test('Saved GLB contains genuine independent 3D parts and passes the Khronos validator',async()=>{const bytes=new Uint8Array(encodeCharacter([fixture.triangle,{...fixture.triangle,name:'Fixture hat',positions:[0,2,0,1,2,0,0,3,0]}]));const validated=validateCharacter(bytes);assert.equal(validated.parts,2);assert.equal(validated.vertices,6);const report=await require('gltf-validator').validateBytes(bytes,{maxIssues:100});assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues.messages));});
test('GLB rejects non-finite vertices, invalid triangles and external texture references',()=>{assert.throws(()=>validateCharacter(encodeCharacter([{...fixture.triangle,positions:[NaN,0,0,1,0,0,0,1,0]}])),/Non-finite/);assert.throws(()=>validateCharacter(encodeCharacter([{...fixture.triangle,indices:[0,1,8]}])),/out of bounds/);const original=validateCharacter(fixture.model());const j=original.json;j.images.push({uri:'https://evil.invalid/image.png'});const raw=Buffer.from(JSON.stringify(j)),len=(raw.length+3)&~3,bin=original.bytes.subarray(28+original.bytes.readUInt32LE(12)),b=Buffer.alloc(28+len+bin.length);b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(len,12);b.writeUInt32LE(0x4e4f534a,16);b.fill(32,20,20+len);raw.copy(b,20);b.writeUInt32LE(bin.length,20+len);b.writeUInt32LE(0x004e4942,24+len);bin.copy(b,28+len);assert.throws(()=>validateCharacter(b),/External character image/);});
test('Model storage is per-account, preserves unchanged models and invalidates changed cosmetics',t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'bloxd-character-unit-'));t.after(()=>{assert.ok(root.startsWith(path.join(os.tmpdir(),'bloxd-character-unit-')));fs.rmSync(root,{recursive:true,force:true});});const s=new Store(root,path.join(__dirname,'../catalog')),id=s.account().id;s.updateAccount(id,{...fixture.metadata,token:'SECRET'});s.saveCharacter(id,fixture.metadata,fixture.model());assert.equal(s.snapshot().accounts[0].character.format,'glb');assert.deepEqual(s.readCharacter(id),Buffer.from(fixture.model()));assert.doesNotMatch(fs.readFileSync(s.file,'utf8'),/SECRET|base64|positions/);s.updateAccount(id,fixture.metadata);assert.ok(s.account().character);s.addAccount('google');assert.throws(()=>s.readCharacter(s.account().id),/Sync/);s.updateAccount(id,{...fixture.metadata,cosmetics:{skin:'different'}});assert.equal(s.account(id).character,undefined);assert.throws(()=>s.saveCharacter(id,fixture.metadata,fixture.model()),/does not match/);});
test('Real preview rig export follows only its body parts and worn attachments',()=>{const r=fixture.rig(),c=capture(encodeCharacter);const unrelated={name:'World terrain'};r.data.thinInstMgr.thinMeshes.push({getMesh:()=>unrelated});const attached={name:'Fixture hat',getVerticesData:r.mesh.getVerticesData,NJ:r.mesh.NJ,getWorldMatrix:()=>fixture.identity,getChildren:()=>[]};r.node.attachedTransformNodes.push(attached);const records=c.records(r.data);assert.equal(records.length,2);assert.ok(!records.some(x=>x.mesh===unrelated));r.node.qy=false;assert.throws(()=>c.records(r.data),/not ready/);});
test('Exporter bakes nonuniform rig transforms, inverse-transpose normals and glTF handedness',()=>{const r=fixture.rig(),c=capture(encodeCharacter);const p=c.bake({mesh:r.mesh,world:[2,0,0,0,0,3,0,0,0,0,4,0,5,6,7,1]});assert.deepEqual(Array.from(p.positions),[5,6,-7,7,6,-7,5,9,-7]);assert.deepEqual(Array.from(p.normals),[0,0,-1,0,0,-1,0,0,-1]);assert.deepEqual(Array.from(p.indices),[0,2,1]);});
test('Try-on props are rejected and texture export composites actual clothing atlas layers',async()=>{const r=fixture.rig(),draws=[],requests=[],closed=[],sandbox=vm.createContext({Uint8Array,Uint32Array,Float32Array,ArrayBuffer,TextEncoder,URL,AbortSignal,setTimeout,clearTimeout,location:{href:'https://bloxd.io/',origin:'https://bloxd.io'},fetch:async(url,options)=>{requests.push({url,options});return {ok:true,blob:async()=>({size:fixture.png.length})};},createImageBitmap:async()=>({width:4,height:4,close(){closed.push(true);}}),document:{createElement:()=>({getContext:()=>({drawImage(...args){draws.push(args);}}),toBlob:fn=>fn({arrayBuffer:async()=>fixture.png.buffer.slice(fixture.png.byteOffset,fixture.png.byteOffset+fixture.png.byteLength)})})}});sandbox.encode=encodeCharacter;sandbox.r=r;vm.runInContext(`globalThis.capture=(${capture.toString()})(encode)`,sandbox);r.canvas.__reactFiber$unit.memoizedProps.forcedCosmetics={hat:'unworn'};assert.throws(()=>sandbox.capture.preview(r.canvas),/trying on/);r.canvas.__reactFiber$unit.memoizedProps.forcedCosmetics={};r.mesh.material.diffuseTexture={url:'/textures/charSkins/fixture.png',_invertY:false,isReady:()=>true};r.mesh.material._pluginManager={_plugins:[]};r.mesh.material.pluginManager={_plugins:[{numLayers:2,atlasWidth:2,atlasHeight:2,getClassName:()=> 'LifeformMaterialPlugin'}]};r.thin.strides.aAtlasIdx1=4;r.variation.get=(_id,kind)=>kind==='aAtlasIdx1'?[0,3,0,0]:[1];const bytes=await sandbox.capture.exportModel(r.canvas);const file=validateCharacter(bytes);assert.equal(file.json.images.length,1);assert.equal(draws.length,2);assert.deepEqual(draws[0].slice(1,5),[2,2,2,2]);assert.deepEqual(draws[1].slice(1,5),[0,0,2,2]);assert.equal(requests[0].options.credentials,'omit');assert.equal(closed.length,1);});
test('Character source files never invoke screenshot capture or read login secrets',()=>{const observer=fs.readFileSync(path.join(__dirname,'../client-observer.cjs'),'utf8'),main=fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8');assert.doesNotMatch(observer+main,/capturePage|skinRect|client:skin/);assert.doesNotMatch(capture.toString(),/readPixels|toDataURL|localStorage|cookie|accessToken/);});
test('A GLB embeds its texture and loads into Three.js without an external request or graphics context',async()=>{const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const loader=new GLTFLoader(),plain=fixture.model();const gltf=await loader.parseAsync(plain.buffer,'');assert.equal(gltf.scene.children.length,1);assert.equal(gltf.scene.children[0].geometry.attributes.position.count,3);assert.equal(gltf.scene.children[0].geometry.index.count,3);const textured=new Uint8Array(encodeCharacter([{...fixture.triangle,image:0}],[{bytes:fixture.png}]));assert.equal(validateCharacter(textured).json.images[0].mimeType,'image/png');const report=await require('gltf-validator').validateBytes(textured,{maxIssues:50});assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues.messages));});
test('Join export uses only the local player, restores body hidden in first person and removes world movement from the pose',async()=>{const r=fixture.rig(),c=capture(encodeCharacter),manager=r.data.thinInstMgr,reads=[];manager.getObjectData=id=>{reads.push(id);return {type:'Player',visible:false,nodes:[r.node]};};manager.getTypeNodes=()=>[{thinMeshIndex:0,worldMatrix:fixture.identity}];manager.groups={Player:{notArmour:new Set([0])}};manager.has=id=>id===7;r.node.qy=false;r.node.worldMatrix=[0,0,-1,0,0,1,0,0,1,0,0,0,150,60,800,1];const engine={Dw:'local-id',Fn:{mY:manager},Qw:{Vy:id=>{assert.equal(id,'local-id');return {rw:7};}}};const api={singletons:{YK:engine,connectedWebsocketUrl:'wss://fixture.invalid/world'}};const data=c.world(api),parts=c.records(data,true);assert.equal(parts.length,1);assert.deepEqual(parts[0].world,fixture.identity);assert.ok(reads.every(id=>id===7));assert.equal(validateCharacter(await c.exportWorld(api)).parts,1);api.singletons.connectedWebsocketUrl=null;assert.throws(()=>c.world(api),/game join/);});
test('Join export maps accessories to body rest pose and skips gameplay armour',()=>{const r=fixture.rig(),c=capture(encodeCharacter),m=r.data.thinInstMgr;r.node.worldMatrix=[1,0,0,0,0,1,0,0,0,0,1,0,100,50,200,1];const attachment={name:'Fixture worn hat',getVerticesData:r.mesh.getVerticesData,NJ:r.mesh.NJ,getWorldMatrix:()=>[1,0,0,0,0,1,0,0,0,0,1,0,101,52,203,1],getChildren:()=>[]};r.node.attachedTransformNodes=[attachment];const armour={...r.node,thinInstanceId:1,attachedTransformNodes:[]};m.getObjectData=()=>({type:'Player',nodes:[r.node,armour]});m.getTypeNodes=()=>[{thinMeshIndex:0,worldMatrix:fixture.identity},{thinMeshIndex:0,worldMatrix:fixture.identity}];m.groups={Player:{notArmour:new Set([0]),armour:new Set([1])}};const records=c.records(r.data,true);assert.equal(records.length,2);assert.deepEqual(records[1].world.slice(12,15),[1,2,3]);assert.equal(records.filter(x=>x.mesh.name==='BodyMesh').length,1);});

function modernRig({old=false,slot=7}={}){
 const r=fixture.rig(),manager=r.data.thinInstMgr,player=42,component={[old?'qY':'ow']:slot,_poseEpoch:-1,_posePitch:0};
 manager.has=id=>id===slot;manager.getEntityId=id=>{assert.equal(id,slot);return player;};manager.getObjectData=()=>({type:'Player',visible:false,nodes:[r.node]});manager.getTypeNodes=()=>[{thinMeshIndex:0,worldMatrix:fixture.identity}];manager.groups={Player:{notArmour:new Set([0])}};
 const components={humanoidMesh:component,meshAttachments:{attachments:[]}},entities={add:()=>player,getState:(id,name)=>{assert.equal(id,player);assert.ok(Object.hasOwn(components,name));return components[name];}};
 class Current{constructor(){this.container={};this.inputs={};this.entities=entities;const ecs=this.entities;this.Vw=ecs.add();this.ff={mS:manager};}}
 class Previous{constructor(){this.container={};this.inputs={};this.entities=entities;const ecs=this.entities;this.bY=ecs.add();this.vy={NY:manager};}}
 const engine=old?new Previous():new Current(),api={singletons:{SZ:engine,connectedWebsocketUrl:'wss://fixture.invalid/world'}};return {r,api,engine,manager,component,components,player};
}
test('Joined armour atlas selects the worn horizontal tile and keeps its tint',async()=>{
 const f=modernRig(),draws=[],r=f.r;
 r.mesh.material.diffuseTexture={url:'/textures/charSkins/armour-atlas.png',_invertY:false,isReady:()=>true};
 r.mesh.material._pluginManager={_plugins:[]};
 r.mesh.material.pluginManager={_plugins:[{getClassName:()=> 'ArmourMaterialPlugin',numTexturesInAtlas:4}]};
 r.thin.strides.aAtlasIdx1=1;r.thin.strides.aArmourTint=3;
 r.variation.get=(_id,kind)=>kind==='aAtlasIdx1'?[2]:kind==='aArmourTint'?[.25,.5,.75]:[1];
 const sandbox=vm.createContext({Uint8Array,Uint32Array,Float32Array,ArrayBuffer,TextEncoder,URL,AbortSignal,setTimeout,clearTimeout,location:{href:'https://bloxd.io/',origin:'https://bloxd.io'},fetch:async()=>({ok:true,blob:async()=>({size:fixture.png.length})}),createImageBitmap:async()=>({width:16,height:4,close(){}}),document:{createElement:()=>({getContext:()=>({drawImage(...args){draws.push(args);}}),toBlob:fn=>fn({arrayBuffer:async()=>fixture.png.buffer.slice(fixture.png.byteOffset,fixture.png.byteOffset+fixture.png.byteLength)})})},encode:encodeCharacter});
 vm.runInContext(`globalThis.capture=(${capture.toString()})(encode)`,sandbox);
 const saved=validateCharacter(await sandbox.capture.exportWorld(f.api));
 assert.deepEqual(draws[0].slice(1,5),[8,0,4,4]);
 assert.deepEqual(saved.json.materials[0].pbrMetallicRoughness.baseColorFactor.slice(0,3),[.25,.5,.75]);
 assert.equal(saved.json.images.length,1);
 r.variation.get=(_id,kind)=>kind==='aAtlasIdx1'?[5]:kind==='aArmourTint'?[.25,.5,.75]:[1];
 await assert.rejects(sandbox.capture.exportWorld(f.api),/armour is not ready/);
});
test('Current Bloxd featureState wrappers export settled Lifeform and Armour atlases through automatic join sync',async()=>{
 for(const kind of ['Lifeform','Armour']){
  const f=modernRig(),draws=[],sent=[],statuses=[],r=f.r;let scan;
  const state=Object.freeze(kind==='Lifeform'?{numLayers:2,atlasWidth:4,atlasHeight:2}:{numTexturesInAtlas:4});
  const plugin=Object.freeze({getClassName:()=>kind+'MaterialPlugin',featureState:state});
  r.mesh.material.diffuseTexture={url:'/textures/charSkins/feature-atlas.png',_invertY:false,isReady:()=>true};
  r.mesh.material.pluginManager={_plugins:[plugin]};
  r.thin.strides.aAtlasIdx1=4;r.thin.strides.aArmourTint=3;
  r.variation.get=(_id,key)=>key==='aAtlasIdx1'?[2,5,0,0]:key==='aArmourTint'?[.25,.5,.75]:[1];
  f.api.singletons.clientSidePartyStateManager={userContext:{isLoggedIn:()=>true,getPlayerName:()=>fixture.metadata.username,getPlayerCosmetics:()=>fixture.metadata.cosmetics}};
  const sandbox=vm.createContext({Uint8Array,Uint32Array,Float32Array,ArrayBuffer,TextEncoder,URL,AbortSignal,Date,setTimeout,clearTimeout,queueMicrotask,setInterval:fn=>{scan=fn;return 1;},clearInterval(){},addEventListener(){},location:{href:'https://bloxd.io/',origin:'https://bloxd.io'},fetch:async()=>({ok:true,blob:async()=>({size:fixture.png.length})}),createImageBitmap:async()=>({width:16,height:8,close(){}}),document:{createElement:()=>({getContext:()=>({drawImage(...args){draws.push(args.slice(1));}}),toBlob:fn=>fn({arrayBuffer:async()=>fixture.png.buffer.slice(fixture.png.byteOffset,fixture.png.byteOffset+fixture.png.byteLength)})})},__BLOXD_MOD_HOST__:{observeDefinitions:()=>()=>{},engine:()=>f.api},bloxdLauncherClient:{account(){},characterStatus:s=>statuses.push(s),character:async s=>{sent.push(s);return true;}},factory:capture,encode:encodeCharacter});
  vm.runInContext(`globalThis.factory=(${capture.toString()});(${require('../client-observer.cjs').toString()})({action:'game'},factory,encode)`,sandbox);
  scan();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sent.length,1,JSON.stringify(statuses));assert.equal(statuses.at(-1).phase,'ready');
  const saved=validateCharacter(sent[0].bytes);assert.equal(saved.parts,1);
  assert.deepEqual(draws,kind==='Lifeform'?[[4,4,4,4,0,0,4,4],[8,0,4,4,0,0,4,4]]:[[8,0,4,8,0,0,4,8]]);
  if(kind==='Armour')assert.deepEqual(saved.json.materials[0].pbrMetallicRoughness.baseColorFactor.slice(0,3),[.25,.5,.75]);
  assert.deepEqual(Object.keys(plugin),['getClassName','featureState']);
 }
});

test('Incomplete featureState never falls back to stale direct atlas fields or saves a full atlas',async()=>{
 const f=modernRig(),r=f.r;r.mesh.material.diffuseTexture={url:'/textures/charSkins/fixture.png'};
 r.mesh.material.pluginManager={_plugins:[{getClassName:()=> 'LifeformMaterialPlugin',featureState:null,numLayers:1,atlasWidth:1,atlasHeight:1}]};
 await assert.rejects(capture(encodeCharacter).exportWorld(f.api),/feature state is not ready/);
});

test('Character discovery follows the owned local humanoid across observed source renames, including thin object zero',async()=>{
 const c=capture(encodeCharacter);for(const old of [false,true])for(const slot of [0,7]){const f=modernRig({old,slot}),s=c.world(f.api);assert.equal(s.engine,f.engine);assert.equal(s.rw,slot);assert.equal(s.component,f.component);assert.equal(s.player,f.player);assert.equal(validateCharacter(await c.exportWorld(f.api)).parts,1);}
});
test('Character discovery refuses other players, previews and ambiguous managers without writing source values',()=>{
 const c=capture(encodeCharacter),f=modernRig(),original=f.manager.getEntityId;
 f.manager.getEntityId=()=>99;assert.throws(()=>c.world(f.api),/your player model/);f.manager.getEntityId=original;
 const get=f.manager.getObjectData;f.manager.getObjectData=()=>({...get(),type:'PlayerPreview'});assert.throws(()=>c.world(f.api),/your player model/);f.manager.getObjectData=get;
 f.engine.ff.other={...f.manager};assert.throws(()=>c.world(f.api),/unambiguous/);delete f.engine.ff.other;
 Object.freeze(f.component);Object.freeze(f.engine);assert.equal(c.world(f.api).rw,7);
 f.api.singletons.connectedWebsocketUrl=null;assert.throws(()=>c.world(f.api),/game join/);
});

test('Joined model discovery accepts the source session without a websocket URL and refuses stale engines or replays',()=>{
 const f=modernRig(),c=capture(encodeCharacter),client={SZ:f.engine,clientGame:{},gameReplayer:{recording:null}};f.api.singletons.connectedWebsocketUrl=null;f.api.singletons.bloxd={client};assert.equal(c.world(f.api).connection,client.clientGame);
 client.msgHandler={};assert.equal(c.world(f.api).connection,client.msgHandler);client.SZ={};assert.throws(()=>c.world(f.api),/joined player|player model/);client.SZ=f.engine;
 client.gameReplayer.recording={};assert.throws(()=>c.world(f.api),/game join/);client.gameReplayer.recording=null;client.msgHandler=null;client.clientGame=null;assert.throws(()=>c.world(f.api),/game join/);
});

function cosmeticRig(){
 const f=modernRig(),m=f.manager,root=m.getObjectData(),rootTypes=m.getTypeNodes(),hat={type:'highSociety_set_2_attachable|HeadMesh',parentThinObjectId:7,parentNodeIndex:0,nodes:[{thinInstanceId:0,enabled:false,worldStale:true,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1],worldMatrix:new Array(16).fill(0),attachedTransformNodes:[],attachedThinObjectIds:[]}]},hatTypes=[{thinMeshIndex:1,parent:null,worldMatrix:fixture.identity}],hatMesh={...f.r.mesh,name:'High Society HeadMesh',uniqueId:20},colours={value:[35/255,50/255,80/255,1]};
 f.r.node.attachedThinObjectIds=[20];f.r.node.enabled=false;rootTypes[0].worldMatrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,1.7,0,1];
 const objects=new Map([[7,root],[20,hat]]),types=new Map([['Player',rootTypes],[hat.type,hatTypes]]);
 f.components.meshAttachments.attachments=[{modelGlb:'highSociety_set_2_attachable',modelNode:'HeadMesh',destNode:'HeadMesh',owners:['hat'],ow:20}];
 m.has=id=>objects.has(id);m.getObjectData=id=>{assert.ok(objects.has(id));return objects.get(id);};m.getTypeNodes=type=>types.get(type);m.getEntityId=id=>objects.has(id)?42:null;
 m.thinMeshes.push({strides:{aOpacity:1,aOverlayColour:4,aHueColour:4},idToMetadata:{0:{meshVariation:{get:(_id,kind)=>kind==='aHueColour'?colours.value:kind==='aOverlayColour'?[1,0,0,.5]:[0]}}},getMesh:()=>hatMesh});
 return {...f,hat,hatTypes,hatMesh,root,rootTypes,objects,types,colours};
}

test('Join export includes ungrouped High Society attachments even with first-person-disabled roots and stale world matrices',async()=>{
 const f=cosmeticRig(),c=capture(encodeCharacter),before=JSON.stringify([f.root,f.hat,f.rootTypes,f.hatTypes]),items=c.records(c.world(f.api),true);
 assert.equal(items.length,2);assert.deepEqual(items[1].world.slice(12,15),[1,3.7,3]);assert.deepEqual(items[1].attributes.aOpacity,[1]);assert.deepEqual(items[1].attributes.aOverlayColour,[0,0,0,0]);assert.deepEqual(items[1].attributes.aHueColour,f.colours.value);
 const bytes=await c.exportWorld(f.api),file=validateCharacter(bytes);assert.equal(file.parts,2);assert.equal(file.vertices,6);const report=await require('gltf-validator').validateBytes(new Uint8Array(bytes),{maxIssues:50});assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues.messages));
 assert.equal(JSON.stringify([f.root,f.hat,f.rootTypes,f.hatTypes]),before,'source poses, visibility and materials remain untouched');
});

test('Nested cosmetic attachments use their actual local matrices and exclude explicitly disabled internal parts',()=>{
 const f=cosmeticRig(),c=capture(encodeCharacter),child={type:'Fixture nested accessory',parentThinObjectId:20,parentNodeIndex:0,nodes:[{...f.hat.nodes[0],matrix:[1,0,0,0,0,1,0,0,0,0,1,0,4,5,6,1],attachedThinObjectIds:[]}]};f.objects.set(21,child);f.types.set(child.type,[{thinMeshIndex:1,parent:null}]);f.components.meshAttachments.attachments.push({modelGlb:'Fixture nested accessory',modelNode:'Decoration',destNode:'HeadMesh',qY:21});f.hat.nodes[0].attachedThinObjectIds=[21];f.hat.nodes.push({...f.hat.nodes[0],enabled:false,attachedThinObjectIds:[]});f.hatTypes.push({thinMeshIndex:1,parent:0});
 const records=c.records(c.world(f.api),true);assert.equal(records.length,3);assert.deepEqual(records[2].world.slice(12,15),[5,8.7,9]);
});

test('Join export uses the source cosmetic registry to exclude held items and other gameplay attachments',()=>{
 const f=cosmeticRig(),c=capture(encodeCharacter),held={type:'Fixture held block',parentThinObjectId:7,parentNodeIndex:0,nodes:[{...f.hat.nodes[0]}]};f.objects.set(22,held);f.types.set(held.type,f.hatTypes);f.r.node.attachedThinObjectIds.push(22);const getOwner=f.manager.getEntityId;f.manager.getEntityId=id=>id===22?null:getOwner(id);assert.equal(c.records(c.world(f.api),true).length,2);
 f.components.meshAttachments=null;assert.throws(()=>c.records(c.world(f.api),true),/registry is not ready/);f.components.meshAttachments={attachments:[]};assert.equal(c.records(c.world(f.api),true).length,1,'no invented attachment from a mesh name or parent alone');
});

test('Cosmetic support keeps Player groups mandatory and refuses foreign ownership, changed parents, stale local matrices and cycles',()=>{
 const c=capture(encodeCharacter);for(const [change,error] of [[f=>delete f.manager.groups.Player,/Player body groups/],[f=>{f.hat.parentThinObjectId=99;},/ownership/],[f=>{f.hat.parentNodeIndex=1;},/ownership/],[f=>{f.manager.getEntityId=id=>id===20?99:42;},/ownership/],[f=>{f.hat.nodes[0].matrix=[];},/transforms/],[f=>{f.hat.nodes[0].dirtyQueued=true;},/transforms/],[f=>{f.hat.nodes[0].attachedThinObjectIds=[20];},/hierarchy/]]){const f=cosmeticRig();change(f);assert.throws(()=>c.records(c.world(f.api),true),error);}
});

test('Worn cosmetic colour changes invalidate the automatic sync signature without including transient hit overlays',()=>{
 const f=cosmeticRig(),c=capture(encodeCharacter),data=c.world(f.api),before=c.signature(data);f.colours.value=[1,0,0,1];assert.notEqual(c.signature(data),before);const after=c.signature(data);f.hat.nodes[0].worldMatrix=[...fixture.identity];f.hat.nodes[0].enabled=true;assert.equal(c.signature(data),after);
});

test('Cosmetic HueTint is baked from original texture pixels, with separate colour variants and preserved alpha',async()=>{
 const f=cosmeticRig(),written=[],requests=[];f.hatMesh.material={diffuseColor:{r:1,g:1,b:1},diffuseTexture:{url:'/static/media/highSociety-fixture.png',_invertY:false},_pluginManager:{_plugins:[{getClassName:()=> 'HueTintMaterialPlugin'}]}};
 f.hat.nodes.push({...f.hat.nodes[0],enabled:true,thinInstanceId:1});f.hatTypes.push({thinMeshIndex:1,parent:0});const thin=f.manager.thinMeshes[1];thin.idToMetadata[1]=thin.idToMetadata[0];
 const input=[0,0,0,255,255,255,255,128,128,128,128,50,64,64,64,0,192,192,192,255],sandbox={Uint8Array,Uint8ClampedArray,Uint32Array,Float32Array,ArrayBuffer,TextEncoder,URL,AbortSignal,setTimeout,clearTimeout,location:{href:'https://bloxd.io/',origin:'https://bloxd.io'},fetch:async(url,options)=>{requests.push({url,options});return {ok:true,blob:async()=>({size:fixture.png.length})};},createImageBitmap:async()=>({width:5,height:1,close(){}}),document:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(input)}),putImageData:p=>written.push(Array.from(p.data))}),toBlob:fn=>fn({arrayBuffer:async()=>fixture.png.buffer.slice(fixture.png.byteOffset,fixture.png.byteOffset+fixture.png.byteLength)})})},encode:encodeCharacter,api:f.api};
 vm.runInNewContext(`globalThis.capture=(${capture.toString()})(encode)`,sandbox);const file=validateCharacter(await sandbox.capture.exportWorld(f.api));assert.equal(file.json.images.length,1);assert.equal(written.length,1);assert.deepEqual(written[0].slice(0,8),input.slice(0,8));assert.deepEqual(written[0].filter((_,i)=>i%4===3),[255,128,50,0,255]);assert.deepEqual(written[0].slice(8,11),[35,50,80]);
 const first=written[0];thin.idToMetadata[1]={meshVariation:{get:(_id,kind)=>kind==='aHueColour'?[1,0,0,1]:kind==='aOverlayColour'?[0,0,0,0]:[1]}};const variants=validateCharacter(await sandbox.capture.exportWorld(f.api));assert.equal(variants.json.images.length,2);assert.deepEqual(written[1],first);assert.notDeepEqual(written[2],first);assert.equal(requests.length,2,'each export decodes the original texture once across both variants');assert.equal(requests[0].options.credentials,'omit');
 f.hat.nodes.pop();f.hatTypes.pop();f.colours.value=[1,0,0,0];await sandbox.capture.exportWorld(f.api);assert.equal(written.length,3,'inactive hue does not read or rewrite pixels');f.colours.value=[NaN,0,0,1];await assert.rejects(sandbox.capture.exportWorld(f.api),/colours are not ready/);
});

test('The real observer and capture export joined default and cosmetic models without a websocket URL or menu actions',async()=>{
 for(const family of ['default','y2k','spring','astro','highSociety','bee','medieval']){
  const f=family==='default'?modernRig():cosmeticRig(),sent=[],statuses=[];let scan;const metadata={...fixture.metadata,cosmetics:{skin:'skin_fixture',hat:family+'_fixture'}},client={SZ:f.engine,clientGame:{},gameReplayer:{recording:null}};
  f.api.singletons.connectedWebsocketUrl=null;f.api.singletons.bloxd={client};f.api.singletons.clientSidePartyStateManager={userContext:{isLoggedIn:()=>true,getPlayerName:()=>metadata.username,getPlayerCosmetics:()=>metadata.cosmetics}};
  const sandbox={Uint8Array,Date,setInterval:fn=>{scan=fn;return 1;},clearInterval(){},addEventListener(){},__BLOXD_MOD_HOST__:{observeDefinitions:()=>()=>{},engine:()=>f.api},bloxdLauncherClient:{account(){},character:async value=>{sent.push(value);return true;},characterStatus:value=>statuses.push(value)},factory:capture,encode:encodeCharacter};
  vm.runInNewContext(`(${require('../client-observer.cjs').toString()})({action:'game'},factory,encode)`,sandbox);scan();await new Promise(resolve=>setImmediate(resolve));assert.equal(sent.length,1,family);assert.equal(validateCharacter(sent[0].bytes).parts,family==='default'?1:2);assert.equal(statuses.at(-1).phase,'ready');
  scan();assert.equal(sent.length,1,'unchanged model is reused');client.clientGame=null;scan();assert.equal(statuses.at(-1).message,'Waiting for a game join.');
 }
});

function observerFixture(){
 const api={singletons:{connectedWebsocketUrl:'wss://fixture.invalid/world',clientSidePartyStateManager:{userContext:{isLoggedIn:()=>true,getPlayerName:()=>fixture.metadata.username,getPlayerCosmetics:()=>fixture.metadata.cosmetics}}}},sent=[],statuses=[],pending=[];
 const f={source:{engine:{},thinInstMgr:{},component:{},player:42,rw:7,connection:api.singletons.connectedWebsocketUrl},signatureError:false};let scan;
 const captureStub={world:()=>f.source,signature:()=>{if(f.signatureError)throw Error('Synthetic incomplete geometry');return 'fixture-outfit';},exportWorld:()=>new Promise(resolve=>pending.push(resolve))};
 const sandbox={Uint8Array,Date,setInterval:fn=>{scan=fn;return 1;},clearInterval(){},addEventListener(){},__BLOXD_MOD_HOST__:{observeDefinitions:()=>()=>{},engine:()=>api},bloxdLauncherClient:{account(){},character:async value=>{sent.push(value);return true;},characterStatus:value=>statuses.push(value)}};
 const observe=require('../client-observer.cjs');sandbox.captureFactory=()=>captureStub;
 vm.runInNewContext(`(${observe.toString()})({action:'game'},captureFactory,null)`,sandbox);
 return {f,api,sent,statuses,pending,scan:()=>scan()};
}
test('Automatic join sync retries on component/manager replacement and rejects in-flight exports from the old owner',async()=>{
 const f=observerFixture();f.scan();assert.equal(f.pending.length,1);
 f.f.source={...f.f.source,component:{},thinInstMgr:{}};f.pending.shift()(fixture.model());await new Promise(resolve=>setImmediate(resolve));assert.equal(f.sent.length,0);
 f.scan();f.scan();assert.equal(f.pending.length,1);f.pending.shift()(fixture.model());await new Promise(resolve=>setImmediate(resolve));assert.equal(f.sent.length,1);
 f.scan();assert.equal(f.pending.length,0,'unchanged successful model is not exported again');
});
test('A new source session revokes an in-flight character even when the local entity and outfit stay identical',async()=>{
 const f=observerFixture();f.scan();assert.equal(f.pending.length,1);f.f.source={...f.f.source,connection:{}};f.pending.shift()(fixture.model());await new Promise(resolve=>setImmediate(resolve));assert.equal(f.sent.length,0);f.scan();f.scan();assert.equal(f.pending.length,1);f.pending.shift()(fixture.model());await new Promise(resolve=>setImmediate(resolve));assert.equal(f.sent.length,1);
});
test('Automatic join sync rechecks the current metadata provider and reports incomplete geometry',async()=>{
 const f=observerFixture();f.scan();f.api.singletons.clientSidePartyStateManager.userContext={isLoggedIn:()=>false,getPlayerName:()=>'',getPlayerCosmetics:()=>({})};f.pending.shift()(fixture.model());await new Promise(resolve=>setImmediate(resolve));assert.equal(f.sent.length,0);
 const g=observerFixture();g.f.signatureError=true;g.scan();assert.equal(g.statuses.at(-1).phase,'waiting');assert.equal(g.statuses.at(-1).message,'Synthetic incomplete geometry');assert.equal(g.pending.length,0);
});

test('Observer reports early missing readiness and re-publishes the same wait after account metadata clears it',()=>{
 const f=observerFixture();f.f.signatureError=true;f.scan();const before=f.statuses.length;f.api.singletons.clientSidePartyStateManager.userContext.getPlayerCosmetics=()=>({hat:'new-fixture'});f.scan();assert.equal(f.statuses.length,before+1);assert.equal(f.statuses.at(-1).message,'Synthetic incomplete geometry');
 const statuses=[],sandbox={Date,setInterval:()=>1,clearInterval(){},addEventListener(){},__BLOXD_MOD_HOST__:{observeDefinitions:()=>()=>{},engine:()=>null},bloxdLauncherClient:{characterStatus:value=>statuses.push(value)},factory:()=>({})};vm.runInNewContext(`(${require('../client-observer.cjs').toString()})({action:'game'},factory)`,sandbox);assert.equal(statuses[0].message,'Waiting for Bloxd to initialize.');
});
