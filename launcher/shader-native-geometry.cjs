'use strict';

// CPU counterpart of the saved Lite packed terrain decoder (j3ktyq, module
// 35512 and lite/terrain WGSL). Keep native face words and slot ordering.
// This does not upload, remesh or replace any game geometry by itself.
function decodeNativeQuads(data,texture='atlas'){
 const packed=data?.packedVertices;
 if(!packed)return null;
 if(!['atlas','single','none'].includes(texture))throw Error('Unknown native terrain texture mode');
 const view=ArrayBuffer.isView(packed)?new DataView(packed.buffer,packed.byteOffset,packed.byteLength):new DataView(packed);
 if(view.byteLength%12)throw Error('Native packed quad record size changed');
 const faces=view.byteLength/12,count=faces*4;
 if(data.vertexCount!=null&&data.vertexCount!==count)throw Error('Native packed quad count changed');
 if(data.FE!=null&&(!(data.FE instanceof Uint16Array)||data.FE.length<count))throw Error('Native packed light format changed');
 const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2),atlas=new Float32Array(count),ao=new Uint8Array(count),indices=new Uint32Array(faces*6);
 const pattern=[0,1,2,0,2,3],epsilon=.0015;
 for(let face=0;face<faces;face++){
  const r0=view.getUint32(face*12,true),word=view.getUint32(face*12+4,true),r2=view.getUint32(face*12+8,true),dir=r2&7,axis=dir>>1;
  if(dir>5)throw Error('Native packed face direction changed');
  const sign=1-2*(dir&1),x=r0&63,y=(r0>>>6)&63,z=(r0>>>12)&63,width=((r0>>>18)&63)+1,height=((r0>>>24)&63)+1;
  for(let slot=0;slot<4;slot++){
   const corner=(((r2>>>11)&1)+(((22>>>dir)&1)?4-slot:slot))&3;
   const du=corner===1||corner===2?width:0,dv=corner>=2?height:0;
   const p=[x+(axis===2?du:axis===1?dv:0),y+(axis!==1?dv:0),z+(axis!==2?du:0)],vertex=face*4+slot;
   positions.set(p,vertex*3);normals[vertex*3+axis]=sign;atlas[vertex]=word&65535;ao[vertex]=(r2>>>(3+2*slot))&3;
   if(texture==='none')continue;
   const u=corner===0||corner===3?epsilon:-epsilon,v=corner<2?epsilon:-epsilon;
   let a,b;
   if(axis===0){a=sign*(p[2]+u);b=-(p[1]+v);}else if(axis===1){a=sign*(p[0]+v);b=-(p[2]+u);}else{a=-sign*(p[0]+u);b=-(p[1]+v);}
   if(texture==='single'){if(axis===0){a-=sign*z;b+=y+height;}else if(axis===1){a-=sign*x;b+=z+width;}else{a+=sign*x;b+=y+height;}}
   uvs.set([a,b],vertex*2);
  }
  for(let i=0;i<6;i++)indices[face*6+i]=face*4+pattern[i];
 }
 const result={...data,positions,normals,uvs,indices,indicesAcrossAtlasArr:atlas,bvfxNativeAO:ao};
 // The existing liquid subdivision routine owns light interpolation. Its
 // canonical CPU field is Uo; the native FE input remains untouched.
 if(data.FE)result.Uo=Float32Array.from(data.FE.subarray(0,count));
 delete result.vertices;
 return result;
}
function encodeNativeLiquidQuads(original,built,kinds,underwater=null){
 if(!built?.data||!built.mapping)return null;
 const data=built.data,mapping=built.mapping,count=data.positions?.length/3;
 const packed=original.packedVertices,raw=ArrayBuffer.isView(packed)?new DataView(packed.buffer,packed.byteOffset,packed.byteLength):new DataView(packed);
 if(raw.byteLength%12||!Number.isInteger(count)||count%4||data.uvs?.length!==count*2||mapping.length!==count*4||kinds?.length!==raw.byteLength/12||data.Uo&&data.Uo.length!==count)
  throw Error('Native liquid geometry mapping changed');
 if(underwater&&underwater.length!==count)throw Error('Native underwater attribute count changed');
 const words=new Uint32Array(count/4*3),extra=new Float32Array(count*12),light=data.Uo?new Uint16Array(count):null;
 for(let vertex=0;vertex<count;vertex++){
  const at=vertex*4,base=mapping[at],u=mapping[at+1],v=mapping[at+2],order=mapping[at+3],face=base/4,kind=kinds[face];
  const side=Math.floor(order/4),opposite=order%4;
  if(!Number.isInteger(face)||face<0||face>=kinds.length||!Number.isInteger(kind)||kind<0||kind>3||!Number.isInteger(order)||side<1||side>3||opposite<1||opposite>3||side===opposite||u<0||u>1||v<0||v>1)
   throw Error('Invalid native liquid source mapping');
  if(vertex%4===0){if((raw.getUint32(face*12+8,true)&7)>5)throw Error('Native packed face direction changed');for(let word=0;word<3;word++)words[vertex/4*3+word]=raw.getUint32(face*12+word*4,true);}
  else if(mapping[(vertex-vertex%4)*4]!==base)throw Error('Native liquid output quad crosses source faces');
  const offset=vertex*12;
  for(let axis=0;axis<3;axis++)extra[offset+axis]=data.positions[vertex*3+axis];extra[offset+3]=data.bvfxWaterEdge?.[vertex*3]??0;
  extra[offset+4]=data.uvs[vertex*2];extra[offset+5]=data.uvs[vertex*2+1];extra[offset+6]=kind;extra[offset+7]=underwater?.[vertex]??0;
  extra[offset+8]=(1-u)*(1-v);extra[offset+8+side]=u*(1-v);extra[offset+8+opposite]=u*v;extra[offset+8+6-side-opposite]=(1-u)*v;
  if(light){const value=data.Uo[vertex];if(!Number.isInteger(value)||value<0||value>65535)throw Error('Invalid native interpolated light');light[vertex]=value;}
 }
 if(!extra.every(Number.isFinite))throw Error('Non-finite native liquid attributes');
 const result={...original,packedVertices:words,vertexCount:count,faceGroups:data.faceGroups};
 if(light)result.FE=light;
 return {data:result,attributes:extra,attributeStride:48};
}
function decodeNativeTerrain(data,texture='atlas'){
 if(data.packedVertices)return decodeNativeQuads(data,texture);
 if(data.usesAtlas)throw Error('Native atlas terrain requires quad records');
 const bytes=data.vertices,view=ArrayBuffer.isView(bytes)?new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength):new DataView(bytes),count=view.byteLength/28;
 if(!Number.isInteger(count)||count%4||data.vertexCount!=null&&data.vertexCount!==count||data.FE&&(!(data.FE instanceof Uint16Array)||data.FE.length<count))throw Error('Native raw terrain format changed');
 const out={...data,positions:new Float32Array(count*3),normals:new Float32Array(count*3),colors:new Float32Array(count*4),uvs:new Float32Array(count*2),indices:new Uint32Array(count/4*6)};
 for(let v=0;v<count;v++){for(let c=0;c<3;c++){out.positions[v*3+c]=view.getFloat32(v*28+c*4,true);out.normals[v*3+c]=Math.max(-1,view.getInt8(v*28+12+c)/127);}
  for(let c=0;c<4;c++)out.colors[v*4+c]=view.getUint8(v*28+16+c)/255;out.uvs[v*2]=view.getFloat32(v*28+20,true);out.uvs[v*2+1]=view.getFloat32(v*28+24,true);
 }
 const pattern=[0,1,2,0,2,3];for(let f=0;f<count/4;f++)for(let i=0;i<6;i++)out.indices[f*6+i]=f*4+pattern[i];
 if(data.FE)out.Uo=Float32Array.from(data.FE.subarray(0,count));delete out.vertices;return out;
}
function compactNativeLiquids(original,built,kinds,wet=null,texture='atlas'){
 const data=built.data,map=built.mapping,count=data.positions.length/3,faces=count/4,records=new Uint32Array(faces*10),floats=new Float32Array(records.buffer);
 if(!Number.isInteger(faces)||map.length!==count*4||wet&&wet.length!==count)throw Error('Invalid native liquid preparation');
 const packed=!!original.packedVertices,bytes=packed?original.packedVertices:original.vertices,raw=ArrayBuffer.isView(bytes)?new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength):new DataView(bytes);
 const output=packed?new Uint32Array(faces*3):new ArrayBuffer(count*28),view=packed?null:new DataView(output);
 const light=data.Uo?Uint16Array.from(data.Uo):null;
 for(let f=0;f<faces;f++){
  const base=map[f*16],source=base/4,kind=kinds[source],order=map[f*16+3],side=Math.floor(order/4),opp=order%4,other=6-side-opp;
  if(!Number.isInteger(source)||source<0||source>=kinds.length||!Number.isInteger(kind)||kind<0||kind>3||side<1||side>3||opp<1||opp>3||side===opp)throw Error('Invalid native liquid face mapping');
  const u0=map[f*16+1],v0=map[f*16+2],du=Math.abs(map[(f*4+side)*4+1]-u0),dv=Math.abs(map[(f*4+other)*4+2]-v0),nx=Math.round(1/du),nz=Math.round(1/dv),x=Math.round(u0*nx),z=Math.round(v0*nz);
  if(nx<1||nx>256||nz<1||nz>256||x<0||x>=nx||z<0||z>=nz)throw Error('Native liquid subdivision grid changed');
  const at=f*10;records[at]=(x|(z<<8)|((nx&255)<<16)|((nz&255)<<24))>>>0;records[at+1]=(kind<<10)|(order<<12);records[at+7]=source;
  for(let slot=0;slot<4;slot++){
   const vertex=f*4+slot;if(map[vertex*4]!==base)throw Error('Native output face crosses original faces');
   floats[at+2+slot]=data.bvfxWaterEdge?.[vertex*3]??0;
   const value=wet?.[vertex]??0,code=Math.round(value*2)+2;if(code<0||code>4||Math.abs((code-2)*.5-value)>1e-6)throw Error('Unknown native underwater weight');records[at+6]|=code<<(slot*3);
   if(!packed){const b=vertex*28,sourceVertex=data.bvfxPackedSources?.[vertex]??base+slot;
    for(let c=0;c<3;c++){view.setFloat32(b+c*4,data.positions[vertex*3+c],true);view.setInt8(b+12+c,Math.round(Math.max(-1,Math.min(1,data.normals[vertex*3+c]))*127));}
    for(let c=0;c<4;c++)view.setUint8(b+16+c,Math.round(Math.max(0,Math.min(1,data.colors[vertex*4+c]))*255));view.setFloat32(b+20,data.uvs[vertex*2],true);view.setFloat32(b+24,data.uvs[vertex*2+1],true);
    view.setUint8(b+15,raw.getUint8(sourceVertex*28+15));view.setUint8(b+19,raw.getUint8(sourceVertex*28+19));
   }
  }
  if(packed){const r0=raw.getUint32(source*12,true),r2=raw.getUint32(source*12+8,true),axis=(r2&7)>>>1,sign=1-2*(r2&1),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(let slot=0;slot<4;slot++)for(let c=0;c<3;c++){const value=data.positions[(f*4+slot)*3+c];min[c]=Math.min(min[c],value);max[c]=Math.max(max[c],value);}
   const whole=min.map(Math.floor),fractions=min.map((value,c)=>Math.round((value-whole[c])*4));
   if(whole.some(v=>v<0||v>63)||fractions.some((v,c)=>v<0||v>3||Math.abs(whole[c]+v*.25-min[c])>1e-5))throw Error('Native packed liquid coordinates left the quarter-block grid');
   const w=max[axis===2?0:2]-min[axis===2?0:2],h=max[axis===1?0:1]-min[axis===1?0:1];
   const size=value=>value===.25?[1,2]:value===.5?[1,1]:Number.isInteger(value)&&value>=1&&value<=64?[value,0]:null,ws=size(w),hs=size(h);if(!ws||!hs)throw Error('Native packed liquid face size changed');
   output[f*3]=(whole[0]|(whole[1]<<6)|(whole[2]<<12)|((ws[0]-1)<<18)|((hs[0]-1)<<24))>>>0;output[f*3+1]=raw.getUint32(source*12+4,true);output[f*3+2]=r2;
   records[at+1]|=fractions[0]|(fractions[1]<<2)|(fractions[2]<<4)|(ws[1]<<6)|(hs[1]<<8);
   if(texture==='single'){const ox=r0&63,oy=(r0>>>6)&63,oz=(r0>>>12)&63,ow=((r0>>>18)&63)+1,oh=((r0>>>24)&63)+1;
    floats[at+8]=axis===0?-sign*oz:axis===1?-sign*ox:sign*ox;floats[at+9]=axis===1?oz+ow:oy+oh;
   }
  }
 }
 for(let f=0;f<faces;f++)for(const c of [2,3,4,5,8,9])if(!Number.isFinite(floats[f*10+c]))throw Error('Non-finite native liquid metadata');
 const next={...original,vertexCount:count,faceGroups:data.faceGroups};if(packed)next.packedVertices=output;else next.vertices=output;if(light)next.FE=light;
 return {data:next,records,changed:count!==(original.vertexCount??(packed?raw.byteLength/12*4:raw.byteLength/28))};
}
function nativeLiquidLight(original,records,values){
 if(!(values instanceof Uint16Array))throw Error('Native light update format changed');const out=new Uint16Array(records.length/10*4);
 for(let f=0;f<records.length/10;f++){const at=f*10,grid=records[at],nx=(grid>>>16)&255||256,nz=(grid>>>24)&255||256,x=grid&255,z=(grid>>>8)&255,order=(records[at+1]>>>12)&15,side=order>>>2,opp=order&3,other=6-side-opp,base=records[at+7]*4;
  for(let s=0;s<4;s++){const u=(x+(s===side||s===opp?1:0))/nx,v=(z+(s===other||s===opp?1:0))/nz,w=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v],slots=[0,side,opp,other];let light=0;
   for(let shift=0;shift<16;shift+=4){let level=0;for(let i=0;i<4;i++)level+=((values[base+slots[i]]>>>shift)&15)*w[i];light|=Math.round(level)<<shift;}out[f*4+s]=light;
  }
 }
 return out;
}
module.exports={decodeNativeQuads,decodeNativeTerrain,encodeNativeLiquidQuads,compactNativeLiquids,nativeLiquidLight};
