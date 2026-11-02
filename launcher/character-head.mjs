import * as THREE from 'three';

// The saved GLB keeps the source mesh names. Head accessories exported as
// separate meshes retain their head-related names and are framed together.
const HEAD_PART=/(?:^|[\s_|.-])(?:head|hair|hat|face|eyes?|eyebrows?|monocle|glasses)(?:mesh)?(?:$|[\s_|.-])/i;

export function headBounds(model){
 const bounds=new THREE.Box3();let count=0;
 model.traverse(part=>{
  if(!part.isMesh)return;
  part.visible=HEAD_PART.test(part.name);
  if(part.visible){bounds.expandByObject(part);count++;}
 });
 if(!count||bounds.isEmpty())throw Error('The saved character has no head geometry.');
 return bounds;
}

// Measure only rendered coverage: GLB bounds can include invisible atlas faces.
// The temporary alpha mask is discarded; portraits always render the real GLB.
export function alphaFrame(pixels,width,height){
 let left=width,right=-1,bottom=height,top=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);bottom=Math.min(bottom,y);top=Math.max(top,y);}
 if(right<left)return null;
 const x=(left+right+1)/2,y=(bottom+top+1)/2;let radius=0;
 for(let py=bottom;py<=top;py++)for(let px=left;px<=right;px++)if(pixels[(py*width+px)*4+3]>16)radius=Math.max(radius,Math.hypot(Math.abs(px+.5-x)+.5,Math.abs(py+.5-y)+.5));
 return {x:x/width-.5,y:y/height-.5,diameter:radius*2/Math.min(width,height)};
}
