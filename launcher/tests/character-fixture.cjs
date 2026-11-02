'use strict';
const {encodeCharacter}=require('../character-glb.cjs');
const triangle={name:'Fixture body',positions:[0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],uvs:[0,0,1,0,0,1],indices:[0,1,2]};
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const metadata={loggedIn:true,username:'Synthetic Alex',cosmetics:{skin:'skin_fixture',body:'body_fixture'}};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
function model(){return new Uint8Array(encodeCharacter([triangle]));}
function rig(){const node={qy:true,thinInstanceId:0,worldMatrix:identity,attachedTransformNodes:[],attachedThinObjectIds:[]};const mesh={name:'BodyMesh',material:{diffuseColor:{r:1,g:1,b:1}},getVerticesData:k=>({position:triangle.positions,normal:triangle.normals,uv:triangle.uvs})[k]||null,NJ:()=>triangle.indices};const variation={get:()=>[1]};const thin={strides:{aOpacity:1},idToMetadata:{0:{meshVariation:variation}},getMesh:()=>mesh};const data={rw:7,thinInstMgr:{getObjectData:()=>({visible:true,type:'PlayerPreview',nodes:[node]}),getTypeNodes:()=>[{thinMeshIndex:0}],thinMeshes:[thin]}};const ref={getDevInternals:()=>data,ensureReadyForCapture:async()=>{}};const canvas={__reactFiber$unit:{memoizedProps:{forcedCosmetics:{}},ref:{current:ref}},parentElement:null};data.canvas=canvas;return {canvas,data,ref,node,mesh,thin,variation};}
module.exports={triangle,identity,metadata,png,model,rig};
