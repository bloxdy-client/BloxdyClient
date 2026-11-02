'use strict';
// Small bounded static GLB reader. It reads assets into the mod's own arrays;
// no game meshes/materials are created, mutated, hidden or disposed.
async function readBlockModel(input,shape,decodeCompressed=null){
 const bytes=new Uint8Array(input),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),fail=()=>{throw Error('Unsupported or invalid block GLB');};
 if(bytes.length<20||bytes.length>8*1024*1024||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length)fail();
 let json,bin;for(let at=12;at+8<=bytes.length;){const length=view.getUint32(at,true),kind=view.getUint32(at+4,true);at+=8;if(at+length>bytes.length)fail();if(kind===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(bytes.subarray(at,at+length)));if(kind===0x004e4942)bin=bytes.subarray(at,at+length);at+=length;}
 if(!json||!bin||json.nodes?.length>512||json.meshes?.length>128||json.buffers?.some(b=>b.uri)||json.skins?.length||json.extensionsRequired?.some(n=>!['KHR_draco_mesh_compression','KHR_materials_unlit','KHR_texture_transform','KHR_materials_emissive_strength'].includes(n)))fail();
 const data=new DataView(bin.buffer,bin.byteOffset,bin.byteLength),sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},formats={5120:[1,'getInt8',127],5121:[1,'getUint8',255],5122:[2,'getInt16',32767],5123:[2,'getUint16',65535],5125:[4,'getUint32',4294967295],5126:[4,'getFloat32',1]};
 function accessor(id){const a=json.accessors?.[id],b=json.bufferViews?.[a?.bufferView],format=formats[a?.componentType],n=sizes[a?.type];if(!a||!b||a.sparse||!format||!n||a.count>65536||a.count<0||b.buffer!==0)fail();const stride=b.byteStride||n*format[0],base=(b.byteOffset||0)+(a.byteOffset||0),end=base+Math.max(0,a.count-1)*stride+n*format[0];if(end>bin.length||end>(b.byteOffset||0)+b.byteLength||stride<n*format[0])fail();return {count:a.count,n,get(i,k){if(i<0||i>=a.count||k>=n)fail();let v=data[format[1]](base+i*stride+k*format[0],true);if(a.normalized)v=Math.max(-1,v/format[2]);if(!Number.isFinite(v))fail();return v;}};}
 const ident=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],mul=(a,b)=>Array.from({length:16},(_,i)=>{const r=i%4,c=Math.floor(i/4);return a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];});
 function local(node){if(node.matrix){if(node.matrix.length!==16||!node.matrix.every(Number.isFinite))fail();return node.matrix;}const[x,y,z,w]=node.rotation||[0,0,0,1],[sx,sy,sz]=node.scale||[1,1,1],t=node.translation||[0,0,0];return [(1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,(2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,(2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,...t,1];}
 let steps=0,deadline=performance.now()+2;const pause=async()=>{if(++steps%128===0&&performance.now()>=deadline){await new Promise(r=>setTimeout(r,0));deadline=performance.now()+2;}};
 const images=new Map();async function imageUrl(index){if(images.has(index))return images.get(index);const image=json.images?.[index];if(!image)return null;let url=image.uri;if(url&&!/^data:image\/(png|jpeg|webp);base64,/.test(url))fail();if(image.bufferView!==undefined){const b=json.bufferViews?.[image.bufferView];if(!b||b.buffer!==0||(b.byteOffset||0)+b.byteLength>bin.length||!['image/png','image/jpeg','image/webp'].includes(image.mimeType))fail();let raw='';const start=b.byteOffset||0;for(let at=0;at<b.byteLength;at+=4096){raw+=String.fromCharCode(...bin.subarray(start+at,start+Math.min(b.byteLength,at+4096)));await pause();}url='data:'+image.mimeType+';base64,'+btoa(raw);}images.set(index,url);return url;}
 const triangles=[],seen=new Set();
 async function visit(id,parent,depth=0){if(depth>32||seen.has(id))fail();seen.add(id);const node=json.nodes?.[id];if(!node||node.skin!==undefined)fail();const m=mul(parent,local(node));
  if(node.mesh!==undefined)for(const primitive of json.meshes?.[node.mesh]?.primitives||[]){if(primitive.mode===0)continue;if(primitive.mode!==undefined&&primitive.mode!==4||primitive.targets)fail();
   let decoded=null;const compression=primitive.extensions?.KHR_draco_mesh_compression;if(compression){const b=json.bufferViews?.[compression.bufferView];if(!decodeCompressed||!b||b.buffer!==0||(b.byteOffset||0)+b.byteLength>bin.length)fail();decoded=await decodeCompressed(bin.subarray(b.byteOffset||0,(b.byteOffset||0)+b.byteLength),compression.attributes);}
   const wrap=a=>({count:a.array.length/a.n,n:a.n,get(i,k){const value=a.array[i*a.n+k];if(i<0||i>=this.count||k>=a.n||!Number.isFinite(value))fail();return value;}}),p=decoded?wrap(decoded.attributes.POSITION):accessor(primitive.attributes?.POSITION),uv=decoded?.attributes.TEXCOORD_0?wrap(decoded.attributes.TEXCOORD_0):primitive.attributes?.TEXCOORD_0!==undefined?accessor(primitive.attributes.TEXCOORD_0):null,indices=decoded?wrap({n:1,array:decoded.indices}):primitive.indices!==undefined?accessor(primitive.indices):null,count=indices?.count??p.count;if(p.n!==3||uv&&uv.n!==2||count%3||triangles.length+count/3>16384)fail();
   const mat=json.materials?.[primitive.material],pbr=mat?.pbrMetallicRoughness||{},color=pbr.baseColorFactor||[1,1,1,1],image=json.textures?.[pbr.baseColorTexture?.index]?.source,url=await imageUrl(image),spec={color:color.slice(0,3).map(n=>n*255),alpha:color[3]??1,doubleSided:mat?.doubleSided??false,...url?{url}:{}};
   for(let at=0;at<count;at+=3){const points=[],coords=[];for(let j=0;j<3;j++){const ix=indices?indices.get(at+j,0):at+j,raw=[p.get(ix,0),p.get(ix,1),p.get(ix,2)],q=[0,1,2].map(k=>m[k]*raw[0]+m[4+k]*raw[1]+m[8+k]*raw[2]+m[12+k]);
     // Babylon's GLB loader converts to the native left handed coordinates.
     let[x,y,z]=[q[0]*shape.scale,q[1]*shape.scale,-q[2]*shape.scale],angle=(shape.rot-1)*Math.PI/2+(shape.info.yRotOffset||0),rx=shape.info.xRotOffset||0,oy=shape.info.yOffset||0;
     const yy=y*Math.cos(rx)-z*Math.sin(rx),zz=y*Math.sin(rx)+z*Math.cos(rx);y=yy;z=zz;
     const c=Math.cos(angle),s=Math.sin(angle),xx=x*c+z*s;z=-x*s+z*c;x=xx;
     x+=oy*Math.sin(rx)*Math.sin(angle);y+=oy*Math.cos(rx);z+=oy*Math.sin(rx)*Math.cos(angle);
     if(shape.modelKind?.includes('rotatableOffset')){const offset=shape.offset??.4375,dir=[[0,-1],[-1,0],[0,1],[1,0]][(shape.rot-1)%4];x+=dir[0]*offset;z+=dir[1]*offset;}
     points.push([x+.5,y+.5,z+.5]);coords.push(uv?[uv.get(ix,0),uv.get(ix,1)]:[0,0]);}
    // Reflection reverses winding. Double-sided source materials retain both.
    [points[1],points[2]]=[points[2],points[1]];[coords[1],coords[2]]=[coords[2],coords[1]];
    triangles.push({points,uv:coords,spec});if(spec.doubleSided)triangles.push({points:[points[0],points[2],points[1]],uv:[coords[0],coords[2],coords[1]],spec});await pause();
   }
  }
  for(const child of node.children||[])await visit(child,m,depth+1);
 }
 const roots=json.scenes?.[json.scene??0]?.nodes||json.nodes?.map((_,i)=>i).filter(i=>!json.nodes.some(n=>n.children?.includes(i)))||[];for(const id of roots)await visit(id,ident());if(!triangles.length)fail();return {triangles};
}
function modelCache(getPack,decode,decodeCompressed){
 const cache=new Map(),pending=[],MAX_BYTES=32*1024*1024;let running=0,bytes=0,stopped=false;
 async function load(entry){running++;try{const pack=getPack(),asset=pack?.getModel?.(entry.shape.model,'BLOCK');if(!asset?.url||asset.notFound)throw Error('Block model unavailable');let url=asset.url.replace(/^data:base64,/, 'data:application/octet-stream;base64,');const response=await fetch(url,{credentials:'omit',signal:entry.abort.signal});if(!response.ok)throw Error('Block model unavailable');const declared=Number(response.headers?.get?.('content-length')||0);if(declared>8*1024*1024)throw Error('Block model too large');
   const reader=response.body?.getReader();let input;if(reader){let length=0;const parts=[];for(;;){const item=await reader.read();if(item.done)break;length+=item.value.byteLength;if(length>8*1024*1024){await reader.cancel();throw Error('Block model too large');}parts.push(item.value);}input=new Uint8Array(length);let at=0;for(const part of parts){input.set(part,at);at+=part.byteLength;}}else input=new Uint8Array(await response.arrayBuffer());
   const result=await decode(input,entry.shape,decodeCompressed);if(stopped)return;const cost=result.triangles.length*512+input.byteLength;if(bytes+cost>MAX_BYTES)throw Error('Block model cache limit');entry.result=result;entry.bytes=cost;bytes+=cost;
  }catch(error){entry.result={unsupported:true};entry.retry=performance.now()+10000;entry.error=error.message;}finally{entry.pending=false;running--;pump();}}
 function pump(){while(!stopped&&running<2&&pending.length)load(pending.shift());}
 return {get(name,shape){let entry=cache.get(name);if(entry?.retry&&performance.now()>=entry.retry){cache.delete(name);entry=null;}if(!entry&&cache.size<128){entry={shape,pending:true,result:{pending:true},abort:new AbortController()};cache.set(name,entry);pending.push(entry);pump();}return entry?.result||{unsupported:true};},dispose(){stopped=true;for(const entry of cache.values())entry.abort.abort();pending.length=0;cache.clear();bytes=0;}};
}
module.exports={readBlockModel,modelCache};
