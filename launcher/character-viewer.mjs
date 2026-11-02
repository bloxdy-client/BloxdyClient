import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {dragRotation} from './character-controls.mjs';
import {headBounds,alphaFrame} from './character-head.mjs';

const active=new Map();
function disposeModel(model){if(!model)return;const textures=new Set(),materials=new Set(),geometries=new Set();model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});for(const t of textures){t.source?.data?.close?.();t.dispose();}for(const m of materials)m.dispose();for(const g of geometries)g.dispose();}
function dispose(instance){if(!instance||instance.stopped)return;instance.stopped=true;instance.resize?.disconnect();instance.controls?.dispose();if(instance.visible)document.removeEventListener('visibilitychange',instance.visible);if(instance.lost)instance.canvas.removeEventListener('webglcontextlost',instance.lost);disposeModel(instance.model);instance.renderer?.dispose();instance.renderer?.forceContextLoss();active.delete(instance.canvas);}
function stop(canvas){if(canvas)dispose(active.get(canvas));else for(const instance of [...active.values()])dispose(instance);}
async function mount(canvas,load,onError,{headOnly=false}={}){
 stop(canvas);const instance={canvas,stopped:false,model:null};active.set(canvas,instance);
 try{const bytes=await load();if(instance.stopped)return;const data=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),gltf=await new GLTFLoader().parseAsync(data,'');instance.model=gltf.scene;if(instance.stopped){disposeModel(instance.model);return;}
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});instance.renderer=renderer;renderer.setPixelRatio(headOnly?Math.min(3,Math.max(2,devicePixelRatio)):Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);
  const scene=new THREE.Scene(),camera=headOnly?new THREE.OrthographicCamera(-1,1,1,-1,.01,200):new THREE.PerspectiveCamera(32,1,.01,200);scene.add(new THREE.HemisphereLight(0xffffff,0x7f96aa,2));const sun=new THREE.DirectionalLight(0xfff3e6,2.2);sun.position.set(4,6,5);scene.add(sun);
  const model=instance.model,turntable=new THREE.Group();scene.add(turntable);turntable.add(model);const box=headOnly?headBounds(model):new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());if(!Number.isFinite(size.y)||size.y<=0)throw Error('Saved character geometry is empty.');model.position.sub(center);const height=Math.max(size.y,size.x*1.5,size.z*1.5),distance=height/2/Math.tan(THREE.MathUtils.degToRad(16))*(headOnly?1.13:1.2);
  // The exported Bloxd character faces -Z. Rotate the model to face the camera,
  // including already saved 0.6.0 files, without altering its scale or geometry.
  turntable.rotation.y=Math.PI;camera.near=Math.max(.001,height/1000);camera.far=distance*10;camera.position.set(0,headOnly?0:height*.025,distance);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
  if(headOnly){
   // Frame actual opaque coverage once, including accessories and transparent
   // atlas cutouts. No image is saved or used in place of the 3D model.
   const span=Math.hypot(size.x,size.y)*1.06,edge=256,target=new THREE.WebGLRenderTarget(edge,edge),pixels=new Uint8Array(edge*edge*4);
   camera.left=camera.bottom=-span/2;camera.right=camera.top=span/2;camera.updateProjectionMatrix();
   const previous=renderer.getRenderTarget();let frame;
   try{renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,edge,edge,pixels);frame=alphaFrame(pixels,edge,edge);}finally{renderer.setRenderTarget(previous);target.dispose();}
   if(frame){const x=frame.x*span,y=frame.y*span;camera.position.x=x;camera.position.y=y;camera.lookAt(x,y,0);camera.zoom=.94/frame.diameter;camera.updateProjectionMatrix();}
  }
  const render=()=>{if(!instance.stopped&&document.visibilityState!=='hidden')renderer.render(scene,camera);};
  if(!headOnly)instance.controls=dragRotation(canvas,(yaw,pitch)=>{turntable.rotation.set(pitch,Math.PI+yaw,0);render();});
  const resize=()=>{if(instance.stopped)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;if(headOnly){const span=Math.hypot(size.x,size.y)*1.06;camera.top=span/2;camera.bottom=-span/2;camera.left=-span*camera.aspect/2;camera.right=span*camera.aspect/2;}camera.updateProjectionMatrix();render();};instance.resize=new ResizeObserver(resize);instance.resize.observe(canvas);
  instance.lost=e=>{e.preventDefault();if(!instance.stopped)onError('3D graphics context was lost. Reopen the page.');};canvas.addEventListener('webglcontextlost',instance.lost);instance.visible=render;document.addEventListener('visibilitychange',render);resize();canvas.classList.add('ready');
 }catch(error){if(!instance.stopped){onError(error.message||'Could not display the saved 3D character.');stop(canvas);}}
}
// No animation loop: draw only when the model, view or window size changes.
window.launcherCharacter={mount,mountHead:(canvas,load,onError)=>mount(canvas,load,onError,{headOnly:true}),stop};
