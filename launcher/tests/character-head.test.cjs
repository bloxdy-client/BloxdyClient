'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {encodeCharacter}=require('../character-glb.cjs'),fixture=require('./character-fixture.cjs');

test('Account portrait uses only head meshes from the same saved GLB',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{headBounds}=await import('../character-head.mjs');
 const body={...fixture.triangle,name:'BodyMesh',positions:[0,0,0,1,0,0,0,1,0]};
 const head={...fixture.triangle,name:'HeadMesh',positions:[0,1,0,1,1,0,0,2,0]};
 const glasses={...fixture.triangle,name:'GlassesMesh',positions:[0,1.5,-.1,1,1.5,-.1,0,1.8,-.1]};
 const glb=encodeCharacter([body,head,glasses]),loaded=await new GLTFLoader().parseAsync(glb,'');
 const bounds=headBounds(loaded.scene),parts=loaded.scene.children;
 assert.deepEqual(parts.map(part=>part.visible),[false,true,true]);
 assert.equal(bounds.min.y,1);assert.equal(bounds.max.y,2);
 assert.ok(Math.abs(bounds.min.z+.1)<1e-5);
});

test('Head portrait has no drag controls or separate saved avatar path',()=>{
 const viewer=fs.readFileSync(path.join(__dirname,'../character-viewer.mjs'),'utf8');
 assert.match(viewer,/mountHead:\(canvas,load,onError\)=>mount\(canvas,load,onError,\{headOnly:true\}\)/);
 assert.match(viewer,/if\(!headOnly\)instance\.controls=dragRotation/);
 assert.doesNotMatch(viewer,/toDataURL|capturePage|screenshot/i);
});

test('Saved cosmetic asset prefixes retain head accessories and exclude body parts',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{headBounds}=await import('../character-head.mjs');
 const names=['BodyMesh','HeadMesh','High Society HeadMesh','cosmetic|HatMesh','LeftArmMesh','LegMesh','Headless BodyMesh'];
 const loaded=await new GLTFLoader().parseAsync(encodeCharacter(names.map(name=>({...fixture.triangle,name}))), '');
 headBounds(loaded.scene);
 assert.deepEqual(loaded.scene.children.map(part=>part.visible),[false,true,true,true,false,false,false]);
});

test('Portrait framing centers visible coverage and enlarges it despite invisible GLB margins',async()=>{
 const {alphaFrame}=await import('../character-head.mjs'),edge=256,pixels=new Uint8Array(edge*edge*4);
 // Visible face sits in the upper part of a taller transparent head mesh.
 for(let y=140;y<220;y++)for(let x=90;x<170;x++)pixels[(y*edge+x)*4+3]=255;
 // Asymmetric monocle belongs in the same centered portrait.
 for(let y=135;y<170;y++)for(let x=70;x<95;x++)pixels[(y*edge+x)*4+3]=255;
 const frame=alphaFrame(pixels,edge,edge),zoom=.94/frame.diameter;
 assert.ok(frame.y>0);assert.ok(zoom>1.5);
 const points=[];
 for(let y=0;y<edge;y++)for(let x=0;x<edge;x++)if(pixels[(y*edge+x)*4+3]>16)points.push({x:((x+.5)/edge-.5-frame.x)*2*zoom,y:((y+.5)/edge-.5-frame.y)*2*zoom});
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 assert.ok(Math.abs(Math.min(...xs)+Math.max(...xs))<1e-12);
 assert.ok(Math.abs(Math.min(...ys)+Math.max(...ys))<1e-12);
 const radius=Math.max(...points.map(p=>Math.hypot(p.x,p.y)));
 assert.ok(radius>.90&&radius<.94,'visible coverage fills the circular field with a narrow margin');
 assert.equal(alphaFrame(new Uint8Array(edge*edge*4),edge,edge),null);
});
