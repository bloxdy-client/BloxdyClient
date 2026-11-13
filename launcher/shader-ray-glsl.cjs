'use strict';
// WebGL 2 implementation of the observed Bloxd voxel/shape/entity trace.
// Integer buffer addressing replaces WebGPU storage bindings. Presentation
// pixels, world cells, cutout masks and entity grid density are independent.
function rayShaders(){
const common=`
precision highp float;
precision highp int;
uniform highp usampler2D uBvfxRayData;
uniform highp sampler2D uBvfxRayVolume;
uniform highp ivec3 uBvfxRayOffset,uBvfxRayEye,uBvfxRayLo;
uniform vec3 uBvfxRayLight;
uniform vec4 uBvfxRayEntityX,uBvfxRayEntityY;
uniform float uBvfxRayActive,uBvfxRayStrength,uBvfxRayFloor;
uniform int uBvfxRayReady,uBvfxRayFresh,uBvfxRayEntities;
const uint RV_SPECIAL=4753984u, RV_FRAME=7146048u, RV_GRIDS=7293508u;
uint rvWord(uint i){uvec4 q=texelFetch(uBvfxRayData,ivec2(int((i>>2u)&2047u),int(i>>13u)),0);uint c=i&3u;return c==0u?q.x:c==1u?q.y:c==2u?q.z:q.w;}
uint rvSpecial(uint i){return rvWord(RV_SPECIAL+i);}
uint rvFrame(uint i){return rvWord(RV_FRAME+i);}
vec4 rvRow(uint i){return uintBitsToFloat(uvec4(rvFrame(i),rvFrame(i+1u),rvFrame(i+2u),rvFrame(i+3u)));}
uint rvSlot(ivec3 chunk){ivec3 s=ivec3((chunk.x%21+21)%21,(chunk.y%7+7)%7,(chunk.z%21+21)%21);return uint(s.x+21*(s.y+7*s.z));}
bool rvHas(ivec3 chunk){return all(lessThanEqual(abs(chunk-uBvfxRayEye),ivec3(10,3,10)));}
vec4 rvExit(vec3 o,vec3 d,vec3 inv,ivec3 lo,ivec3 offset,int size,out ivec3 cell){
 vec3 low=vec3(lo-offset),far=vec3(d.x>0.?low.x+float(size):low.x,d.y>0.?low.y+float(size):low.y,d.z>0.?low.z+float(size):low.z);
 vec3 t=vec3(d.x!=0.?(far.x-o.x)*inv.x:1e30,d.y!=0.?(far.y-o.y)*inv.y:1e30,d.z!=0.?(far.z-o.z)*inv.z:1e30);
 int axis=t.y<t.x?1:0;if(t.z<t[axis])axis=2;
 float at=t[axis];ivec3 inside=clamp(ivec3(floor(o+at*d))+offset,lo,lo+ivec3(size-1));
 ivec3 beyond=ivec3(d.x>0.?lo.x+size:lo.x-1,d.y>0.?lo.y+size:lo.y-1,d.z>0.?lo.z+size:lo.z-1);
 cell=ivec3(axis==0?beyond.x:inside.x,axis==1?beyond.y:inside.y,axis==2?beyond.z:inside.z);return vec4(at,float(axis),0,0);
}
bool rvMask(uint word,uint bit){return ((rvSpecial(word+(bit>>5u))>>(bit&31u))&1u)!=0u;}
bool rvCaster(uint caster,vec3 o,vec3 d,ivec3 cell,ivec3 offset,float t0,float t1,int axis){
 uint b=caster*4u,kind=rvSpecial(b),data=rvSpecial(b+1u),count=min(rvSpecial(b+2u),4u),size=rvSpecial(b+3u);vec3 q=o-vec3(cell-offset);
 if(kind==1u){
  vec3 p=q*8.,v=d*8.,inv=vec3(v.x!=0.?1./v.x:0.,v.y!=0.?1./v.y:0.,v.z!=0.?1./v.z:0.);ivec3 sub=clamp(ivec3(floor(p+t0*v)),ivec3(0),ivec3(7));
  for(int k=0;k<24;k++){if(rvMask(data,uint(sub.x+8*(sub.y+8*sub.z))))return true;ivec3 next;vec4 e=rvExit(p,v,inv,sub,ivec3(0),1,next);if(e.x>=t1||any(lessThan(next,ivec3(0)))||any(greaterThanEqual(next,ivec3(8))))return false;sub=next;}return false;
 }
 if(kind==2u){
  for(uint k=0u;k<4u;k++){if(k>=count)break;uint p=data+k*4u;float tx=uintBitsToFloat(rvSpecial(p)),tz=uintBitsToFloat(rvSpecial(p+1u)),along=uintBitsToFloat(rvSpecial(p+2u)),dn=d.x*tz-d.z*tx;if(abs(dn)<1e-6)continue;
   float t=(along-((q.x-.5)*tz-(q.z-.5)*tx))/dn;if(t<(axis<0?t0+.0009765625:t0)||t>t1)continue;vec3 h=q+t*d;float u=(h.x-.5)*tx+(h.z-.5)*tz+.5,v=1.-h.y;
   if(u>=0.&&u<1.&&v>=0.&&v<1.&&rvMask(rvSpecial(p+3u),uint(floor(u*float(size)))+size*uint(floor(v*float(size)))))return true;
  }return false;
 }
 if(kind==3u&&axis>=0){bool plus=d[axis]<0.;uint face=uint(2*axis)+(plus?0u:1u);vec3 h=clamp(q+t0*d,0.,1.);vec2 uv=vec2(plus?1.-h.x:h.x,1.-h.y);
  if(axis==0)uv=vec2(plus?h.z:1.-h.z,1.-h.y);else if(axis==1)uv=vec2(plus?h.x:1.-h.x,1.-h.z);
  uvec2 texel=min(uvec2(floor(uv*float(size))),uvec2(size-1u));return rvMask(data+face*((size*size+31u)/32u),texel.x+size*texel.y);
 }return false;
}
bool rvFull(ivec3 cell){
 ivec3 chunk=cell>>5;if(!rvHas(chunk))return false;uint slot=rvSlot(chunk),record=slot*4u;
 if(any(notEqual(ivec3(rvWord(record),rvWord(record+1u),rvWord(record+2u)),chunk)))return false;
 uint kind=rvWord(record+3u)&255u;if(kind!=3u)return kind==2u;
 ivec3 p=cell-chunk*32;uint brick=uint((p.x>>2)+8*((p.y>>2)+8*(p.z>>2))),b=12348u+slot*1536u+brick*3u,bit=uint((p.x&3)+4*((p.y&3)+4*(p.z&3)));
 if(((rvWord(b+(bit>>5u))>>(bit&31u))&1u)==0u)return false;uint pool=rvWord(b+2u);if(pool==0u)return true;
 uint entry=rvSpecial(294912u+(pool-1u)*32u+(bit>>1u));return ((entry>>((bit&1u)*16u))&65535u)==65535u;
}
#ifndef BVFX_RAY_VOLUME_PASS
vec4 rvVolume(vec3 p){
 vec3 r=p-vec3(uBvfxRayLo-uBvfxRayOffset);if(uBvfxRayReady==0||any(lessThan(r,vec3(.5)))||any(greaterThan(r,vec3(127.5,63.5,127.5))))return vec4(1,0,0,1);
 vec3 q=p+vec3(uBvfxRayOffset);float z=floor(q.z-.5),f=fract(q.z-.5);vec2 xy=mod(q.xy,vec2(128,64))+1.;
 float a=mod(z,128.),b=mod(z+1.,128.);vec2 ta=vec2(mod(a,8.)*130.,floor(a/8.)*66.),tb=vec2(mod(b,8.)*130.,floor(b/8.)*66.);
 return mix(textureLod(uBvfxRayVolume,(ta+xy)/vec2(1040,1056),0.),textureLod(uBvfxRayVolume,(tb+xy)/vec2(1040,1056),0.),f);
}
float rvVolumeLight(vec3 p){vec4 q=rvVolume(p);return q.g<.03125?1.:min(q.r/q.g,1.);}
#endif
// The result's W is 0 blocked, 1 clear, -1 a retained-volume continuation.
vec4 rvMarch(vec3 o,vec3 d,ivec3 offset,int steps,bool ownCell,out bool crossed){
 ivec3 cell=ivec3(floor(o))+offset,cached=ivec3(-2147483647);vec3 inv=vec3(d.x!=0.?1./d.x:0.,d.y!=0.?1./d.y:0.,d.z!=0.?1./d.z:0.);float t=0.;int axis=-1;uint slot=0u,state=0u;bool named=false;crossed=false;
 uint w=rvWord(4753980u);int top=d.y>0.&&w!=0u?int(w)-1073741824:2147483647;
 for(int k=0;k<128;k++){if(k>=steps)break;
#ifndef BVFX_RAY_VOLUME_PASS
  if(uBvfxRayFresh!=0&&k>0&&(k&1)==0&&rvVolume(o+t*d).b>=.999)return vec4(o+t*d,-1.);
#endif
  if(cell.y>top)return vec4(o+t*d,1.);ivec3 chunk=cell>>5;
  if(any(notEqual(chunk,cached))){if(!rvHas(chunk))return vec4(o+t*d,1.);cached=chunk;slot=rvSlot(chunk);uint rec=slot*4u;named=all(equal(ivec3(rvWord(rec),rvWord(rec+1u),rvWord(rec+2u)),chunk));state=rvWord(rec+3u);}
  ivec3 lo=chunk*32;uint kind=state&255u;ivec3 next;
  if(!named||kind<2u||(d.y>0.&&cell.y-lo.y>int(state>>8u))){vec4 e=rvExit(o,d,inv,lo,offset,32,next);t=max(t,e.x);axis=int(e.y);cell=next;continue;}
  if(kind==2u)return vec4(o+t*d,0.);ivec3 local=cell-lo;uint brick=uint((local.x>>2)+8*((local.y>>2)+8*(local.z>>2))),b=12348u+slot*1536u+brick*3u,low=rvWord(b),high=rvWord(b+1u);
  if(low==0u&&high==0u){vec4 e=rvExit(o,d,inv,lo+(local&ivec3(~3)),offset,4,next);t=max(t,e.x);axis=int(e.y);cell=next;continue;}
  uint bit=uint((local.x&3)+4*((local.y&3)+4*(local.z&3)));vec4 e=rvExit(o,d,inv,cell,offset,1,next);
  if((((bit<32u?low:high)>>(bit&31u))&1u)!=0u){uint pool=rvWord(b+2u);if(pool==0u)return vec4(o+t*d,0.);uint entry=rvSpecial(294912u+(pool-1u)*32u+(bit>>1u)),caster=(entry>>((bit&1u)*16u))&65535u;
   if(caster==65535u||((ownCell||axis>=0)&&rvCaster(caster,o,d,cell,offset,t,e.x,axis)))return vec4(o+t*d,0.);crossed=true;
  }t=max(t,e.x);axis=int(e.y);cell=next;
 }return vec4(o+t*d,-1.);
}
#ifndef BVFX_RAY_VOLUME_PASS
float rvEntityLight(vec3 p,vec3 light,float facing){
 if(uBvfxRayEntities==0)return 1.;vec4 p4=vec4(p,1);vec2 across=vec2(dot(uBvfxRayEntityX,p4),dot(uBvfxRayEntityY,p4));if(any(greaterThanEqual(abs(across),vec2(1))))return 1.;
 ivec2 bin=clamp(ivec2(floor((across*.5+.5)*128.)),ivec2(0),ivec2(127));uint b=uint(bin.y*128+bin.x),start=rvFrame(b),count=min(rvFrame(b+1u)-start,64u);float along=dot(p,light);
 for(uint k=0u;k<64u;k++){if(k>=count)break;uint base=81921u+rvFrame(16385u+start+k)*16u;if(uintBitsToFloat(rvFrame(base+13u))<along)break;
  vec4 r0=rvRow(base),r1=rvRow(base+4u),r2=rvRow(base+8u);uint packed=rvFrame(base+14u);ivec3 dims=ivec3(packed&255u,(packed>>8u)&255u,packed>>16u);
  vec3 q=vec3(dot(r0,p4),dot(r1,p4),dot(r2,p4)),dq=vec3(dot(r0.xyz,light),dot(r1.xyz,light),dot(r2.xyz,light));dq=vec3(abs(dq.x)<1e-9?1e-9:dq.x,abs(dq.y)<1e-9?1e-9:dq.y,abs(dq.z)<1e-9?1e-9:dq.z);
  vec3 inv=1./dq,ta=-q*inv,tb=(vec3(dims)-q)*inv,tlo=min(ta,tb),thi=max(ta,tb);float shortest=min(dot(r0.xyz,r0.xyz),min(dot(r1.xyz,r1.xyz),dot(r2.xyz,r2.xyz))),t0=max(max(tlo.x,tlo.y),max(tlo.z,2.*inversesqrt(shortest)/max(facing,1e-3))),t1=min(thi.x,min(thi.y,thi.z));if(t0>=t1)continue;
  ivec3 at=ivec3(clamp(floor(q+dq*t0),vec3(0),vec3(dims)-1.)),step=ivec3(dq.x>0.?1:-1,dq.y>0.?1:-1,dq.z>0.?1:-1);vec3 delta=abs(inv),next=(vec3(at)+vec3(dq.x>0.?1.:0.,dq.y>0.?1.:0.,dq.z>0.?1.:0.)-q)*inv;uint data=rvFrame(base+12u);
  for(int s=0;s<198;s++){uint i=uint(at.x+dims.x*(at.y+dims.y*at.z));if((rvWord(RV_GRIDS+data+(i>>5u))&(1u<<(i&31u)))!=0u)return 0.;
   if(next.x<=next.y&&next.x<=next.z){at.x+=step.x;next.x+=delta.x;}else if(next.y<=next.z){at.y+=step.y;next.y+=delta.y;}else{at.z+=step.z;next.z+=delta.z;}
   if(any(lessThan(at,ivec3(0)))||any(greaterThanEqual(at,dims)))break;
  }
 }return 1.;
}
float bvfxRayVisibility(vec3 p,vec3 normal){
 if(uBvfxRayActive<.5)return 1.;vec3 n=normalize(normal);float facing=dot(n,uBvfxRayLight);if(facing<=0.)return 0.;bool crossed;vec4 hit=rvMarch(p+n*.25,uBvfxRayLight,uBvfxRayOffset,64,true,crossed);float lit=hit.w<0.?rvVolumeLight(hit.xyz):hit.w;
 if(lit>0.)lit*=rvEntityLight(p,uBvfxRayLight,facing);return smoothstep(0.,.1,uBvfxRayLight.y)*smoothstep(0.,.5,facing)*lit;
}
#endif
`;
const vertex=`#version 300 es
precision highp float;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0,1);}`;
const volume=`#version 300 es
#define BVFX_RAY_VOLUME_PASS
${common}
uniform ivec3 uBvfxRayOldLo;
uniform int uBvfxRaySweep;
out vec4 colour;
void main(){ivec2 pixel=ivec2(gl_FragCoord.xy),tile=pixel/ivec2(130,66),local=pixel-tile*ivec2(130,66)-1;
 ivec3 wrapped=ivec3(local.x&127,local.y&63,tile.x+tile.y*8),mask=ivec3(127,63,127),cell=uBvfxRayLo+((wrapped-(uBvfxRayLo&mask))&mask);
 bool incoming=any(lessThan(cell,uBvfxRayOldLo))||any(greaterThanEqual(cell,uBvfxRayOldLo+ivec3(128,64,128)));
 if(uBvfxRaySweep>=0&&(wrapped.x>>3)!=uBvfxRaySweep&&!incoming)discard;
 bool open=!rvFull(cell),crossed=false;float lit=0.;if(open){vec4 hit=rvMarch(vec3(cell-uBvfxRayLo)+.5,uBvfxRayLight,uBvfxRayLo,128,false,crossed);lit=hit.w<0.?1.:hit.w;}
 colour=vec4(lit,open?1.:0.,lit==1.&&!crossed?1.:0.,1.);
}`;
return {common,vertex,volume};
}
module.exports={rayShaders};
