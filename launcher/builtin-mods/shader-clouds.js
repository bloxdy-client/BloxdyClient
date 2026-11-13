// Owned volumetric clouds. Only cloud integration uses a bounded small buffer;
// native world, sky gradient, solar edge and lens optics retain native pixels.
(() => {
 'use strict';const root=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
 let noiseBytes=null;
 let encodedNoise=/* BVFX_CLOUD_DATA */null;
 function volumeBytes(){
  if(noiseBytes)return noiseBytes;
  if(encodedNoise){
   // The release carries the precomputed volume. Decode once instead of
   // running millions of Worley distance calculations during the first frame.
   const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',table=new Int16Array(128).fill(-1);
   for(let i=0;i<alphabet.length;i++)table[alphabet.charCodeAt(i)]=i;
   const data=new Uint8Array(64**3*4);let bits=0,value=0,index=0;
   for(let i=0;i<encodedNoise.length&&index<data.length;i++){const n=table[encodedNoise.charCodeAt(i)];if(n<0)continue;value=(value<<6)|n;bits+=6;if(bits>=8){bits-=8;data[index++]=(value>>>bits)&255;}}
   if(index!==data.length)throw Error('Cloud data length mismatch');encodedNoise=null;return noiseBytes=data;
  }
  const size=64,periods=[4,8,16],grids=periods.map((period,level)=>{
   const values=new Uint8Array(period**3);let seed=(0x9e3779b9^Math.imul(period,0x85ebca6b)^level)>>>0;
   for(let i=0;i<values.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;values[i]=seed&255;}return values;
  });
  const axes=periods.map(period=>Array.from({length:size},(_,v)=>{const p=v*period/size,i=Math.floor(p),f=p-i;return [i,(i+1)%period,f*f*f*(f*(f*6-15)+10)];}));
  const features=periods.map((period,level)=>{const points=new Float32Array(period**3*3);let seed=(0x68bc21eb^Math.imul(period,0x27d4eb2d)^level)>>>0;for(let i=0;i<points.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;points[i]=(seed>>>0)/4294967296;}return points;});
  const value=(x,y,z,level)=>{
   const period=periods[level],grid=grids[level],a=axes[level],xx=a[x],yy=a[y],zz=a[z];
   let sum=0;for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++)sum+=grid[(zz[k]*period+yy[j])*period+xx[i]]*(i?xx[2]:1-xx[2])*(j?yy[2]:1-yy[2])*(k?zz[2]:1-zz[2]);return sum;
  };
  const worley=(x,y,z,level)=>{
   const period=periods[level],points=features[level],px=x*period/size,py=y*period/size,pz=z*period/size,cx=Math.floor(px),cy=Math.floor(py),cz=Math.floor(pz);let nearest=4;
   for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const a=cx+dx,b=cy+dy,c=cz+dz,index=((((c+period)%period)*period+(b+period)%period)*period+(a+period)%period)*3;
    const xx=a+points[index]-px,yy=b+points[index+1]-py,zz=c+points[index+2]-pz;nearest=Math.min(nearest,xx*xx+yy*yy+zz*zz);
   }return Math.max(0,1-Math.sqrt(nearest)*.92)*255;
  };
  const data=new Uint8Array(size**3*4);
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=((z*size+y)*size+x)*4;
   const broad=(value(x,y,z,0)*.72+value(x,y,z,1)*.28)/255;
   data[i]=Math.round(Math.max(0,Math.min(1,.5+(broad-.5)*1.48))*255);
   for(let level=0;level<3;level++)data[i+level+1]=Math.round(worley(x,y,z,level));
  }
  return noiseBytes=data;
 }
 const model=`
#if __VERSION__ >= 300
uniform highp sampler3D uBvfxAtmoVolume;
#endif
uniform float uBvfxAtmoVolumeReady;
vec2 bvfxCloudLayer(){
 if(uBvfxAtmoCloudStyle>.5 && uBvfxAtmoCloudStyle<2.5)return vec2(0.0,uBvfxAtmoCloudStyle<1.5?8.0:21.0);
 return uBvfxAtmoCloudStyle>2.5?vec2(-12.0,108.0):vec2(-7.0,79.0);
}
float bvfxBlockOccupancy(vec2 cell){
 vec3 p=fract(vec3(mod(cell.x,2048.0),17.3,mod(cell.y,2048.0))*.1031);
 p+=dot(p,p.yzx+33.33);
 return fract((p.x+p.y)*p.z);
}
float bvfxBlockCellSize(){
 return (uBvfxAtmoCloudStyle<1.5?26.0:34.0)/max(.5,uBvfxAtmoClouds.y);
}
float bvfxBlockRadius(float size){return uBvfxAtmoCloudStyle<1.5?0.0:min(6.2,size*.30);}
vec2 bvfxBlockWind(){return vec2(.7776,.3132)*uBvfxAtmoTime*uBvfxAtmoClouds.w;}
float bvfxRoundedCloudBox(vec3 p,vec3 halfSize,float radius){
 vec3 q=abs(p)-halfSize+radius;
 return length(max(q,vec3(0)))+min(max(q.x,max(q.y,q.z)),0.0)-radius;
}
// Common geometry for the visible banks, their sunlight and ground shadows.
float bvfxBlockDensity(vec3 position){
 float size=bvfxBlockCellSize(),height=uBvfxAtmoCloudStyle<1.5?8.0:21.0;
 vec2 p=position.xz-bvfxBlockWind(),cell=floor(p/size);
 if(bvfxBlockOccupancy(cell)<1.0-uBvfxAtmoClouds.x)return 0.0;
 vec3 local=vec3(p.x-(cell.x+.5)*size,position.y-uBvfxAtmoClouds.z-height*.5,p.y-(cell.y+.5)*size);
 float radius=bvfxBlockRadius(size);
 return 1.0-smoothstep(-.15,.25,bvfxRoundedCloudBox(local,vec3(size*.5,height*.5,size*.5),radius));
}
float bvfxCloudHeightShape(float height,float top){
 return smoothstep(0.0,.14,height)*(1.0-smoothstep(max(.12,top-.32),top,height));
}
float bvfxVolumeDensity(vec3 position,float lod){
#if __VERSION__ >= 300
 if(uBvfxAtmoVolumeReady<.5 || uBvfxAtmoClouds.x<=0.0)return 0.0;
 vec2 layer=bvfxCloudLayer();
 if(position.y<=uBvfxAtmoClouds.z+layer.x || position.y>=uBvfxAtmoClouds.z+layer.y)return 0.0;
 if(uBvfxAtmoCloudStyle>.5 && uBvfxAtmoCloudStyle<2.5)return bvfxBlockDensity(position);
 vec3 wind=vec3(.0011,0.0,.00045)*uBvfxAtmoTime*uBvfxAtmoClouds.w;
 float frequency=.0045*uBvfxAtmoClouds.y;
 float cover=clamp(uBvfxAtmoClouds.x,0.0,1.0);
 if(uBvfxAtmoCloudStyle>2.5){
  // Broad translucent horizontal veils, independent of the cumulus volume.
  float h=(position.y-uBvfxAtmoClouds.z+12.0)/120.0;
  float broad=textureLod(uBvfxAtmoVolume,fract(vec3(position.x*frequency*.32,.31,position.z*frequency*.32)+wind*.32),min(4.0,lod+1.0)).r;
  float detail=textureLod(uBvfxAtmoVolume,fract(vec3(position.x*frequency*.72,.67,position.z*frequency*.72)+wind*.21+vec3(.23,0,.53)),min(4.0,lod+1.0)).r;
  float veil=smoothstep(.68-.50*cover,.90-.35*cover,broad*.82+detail*.18);
  float softHeight=smoothstep(0.0,.32,h)*(1.0-smoothstep(.48,1.0,h));
  return veil*softHeight*(.045+.085*cover)*smoothstep(0.0,.06,cover);
 }
 // Reject empty weather regions before fetching the detailed 3D body.
 vec4 w=textureLod(uBvfxAtmoVolume,fract(vec3(position.x*frequency*.25,.173,position.z*frequency*.25)+wind*.34+vec3(.37,0,.61)),min(4.0,lod+1.2));
 float height=(position.y-uBvfxAtmoClouds.z-(w.b-.5)*10.0)/72.0;
 if(height<=0.0 || height>=1.0)return 0.0;
 float weather=w.r*.72+w.g*.28;
 float cut=.65-.38*cover,region=smoothstep(cut,cut+.13,weather);
 if(region<.002)return 0.0;
 float top=mix(.38,.98,smoothstep(cut,min(.96,cut+.25),w.r));
 float heightShape=bvfxCloudHeightShape(height,top);
 if(heightShape<.002)return 0.0;
 vec4 n=textureLod(uBvfxAtmoVolume,fract(position*vec3(frequency,frequency*.85,frequency)+wind),lod);
 // Restore the earlier value/Worley billows and variable-height silhouette.
 // No density floor in empty weather: individual banks keep open blue sky.
 float broad=clamp(n.r*.68+n.g*.48-.08,0.0,1.0);
 float erosion=1.0-dot(n.gba,vec3(.55,.29,.16));
 float body=broad+region*.16-mix(.42,.54,height);
 body-=erosion*mix(.13,.31,height)+(1.0-n.a)*.045;
 float density=smoothstep(-.03,.16,body)*region*heightShape;
 return density*density*(3.0-2.0*density)*smoothstep(0.0,.06,cover);
#else
 return 0.0;
#endif
}
`;
 // Integrate sunlight once in a world-aligned tile. Receivers intersect the
 // cloud base, so hills, rebases and low solar angles share the same field.
 const groundModel=`
uniform sampler2D uBvfxAtmoGroundImage;
uniform vec4 uBvfxAtmoGroundFrame;
float bvfxCloudGroundShadow(vec3 position,vec3 sun){
 if(uBvfxAtmoGroundFrame.w<.5 || sun.y<=.025 || position.y>=uBvfxAtmoClouds.z)return 0.0;
 vec2 point=position.xz+sun.xz*((uBvfxAtmoClouds.z-position.y)/sun.y);
 vec2 uv=(point-uBvfxAtmoGroundFrame.xy)/uBvfxAtmoGroundFrame.z+.5;
 float edge=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
 if(edge<=0.0)return 0.0;
#if __VERSION__ >= 300
 return texture(uBvfxAtmoGroundImage,uv).r*smoothstep(0.0,.04,edge);
#else
 return texture2D(uBvfxAtmoGroundImage,uv).r*smoothstep(0.0,.04,edge);
#endif
}
`;
 const vertex=`#version 300 es
precision highp float;out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.0-1.0,0,1);}`;
 const header=`#version 300 es
precision highp float;in vec2 uv;layout(location=0) out vec4 colour;
uniform mat4 rayMatrix;uniform vec3 camera;uniform vec3 sun;uniform vec3 cloudTint;uniform vec3 skyTint;uniform vec3 fogTint;uniform vec3 lightTint;
uniform vec4 uBvfxAtmoClouds;uniform float uBvfxAtmoTime;uniform float uBvfxAtmoCloudStyle;
uniform vec4 controls;uniform vec3 sunScreen;uniform vec2 sunRadius;uniform vec2 bufferSize;
`;
 const fragment=header+model+`
vec4 bvfxTraceBlocks(vec3 ray,float entry,float exit){
 float size=bvfxBlockCellSize(),height=uBvfxAtmoCloudStyle<1.5?8.0:21.0,radius=bvfxBlockRadius(size);
 vec3 origin=camera-vec3(bvfxBlockWind().x,uBvfxAtmoClouds.z+height*.5,bvfxBlockWind().y);
 vec2 cell=floor((origin.xz+ray.xz*(entry+.001))/size);
 vec2 direction=sign(ray.xz),inverse=1.0/max(abs(ray.xz),vec2(.000001));
 vec2 next=(abs((cell+.5+direction*.5)*size-origin.xz))*inverse;
 vec2 stride=vec2(size)*inverse;
 // A parallel ray must never cross the stationary axis' cell boundary.
 if(abs(ray.x)<.000001)next.x=1e8;
 if(abs(ray.z)<.000001)next.y=1e8;
 vec3 normal=vec3(0,-sign(ray.y),0),radiance=vec3(0);
 float transmission=1.0,t=entry;
 for(int i=0;i<96;i++){
  float end=min(exit,min(next.x,next.y));
  if(bvfxBlockOccupancy(cell)>=1.0-uBvfxAtmoClouds.x){
   vec3 centre=vec3((cell.x+.5)*size,0,(cell.y+.5)*size),halfSize=vec3(size*.5,height*.5,size*.5);
   float hit=t,back=end;
   bool found=radius<.01;
   if(radius>.01){
    // Rounded boxes use conservative distance steps inside the exact cell
    // interval. Flat blocks never use stochastic volume samples.
    for(int j=0;j<16;j++){
     float distance=bvfxRoundedCloudBox(origin+ray*hit-centre,halfSize,radius);
     if(distance<.025){found=true;break;}
     hit+=max(.025,distance);
     if(hit>=end)break;
    }
    if(found){
     // Recover the exit on the same convex rounded box too. Using the
     // enclosing cell's exit would turn grazing corners into opaque slabs.
     for(int j=0;j<16;j++){
      float distance=bvfxRoundedCloudBox(origin+ray*back-centre,halfSize,radius);
      if(distance<.025)break;
      back-=max(.025,distance);
      if(back<=hit)break;
     }
     vec3 p=origin+ray*hit-centre;float e=.04;
     vec3 gradient=vec3(
      bvfxRoundedCloudBox(p+vec3(e,0,0),halfSize,radius)-bvfxRoundedCloudBox(p-vec3(e,0,0),halfSize,radius),
      bvfxRoundedCloudBox(p+vec3(0,e,0),halfSize,radius)-bvfxRoundedCloudBox(p-vec3(0,e,0),halfSize,radius),
      bvfxRoundedCloudBox(p+vec3(0,0,e),halfSize,radius)-bvfxRoundedCloudBox(p-vec3(0,0,e),halfSize,radius));
     normal=dot(gradient,gradient)>.000001?normalize(gradient):-ray;
    }
   }
   if(found && back>hit){
    float diffuse=max(0.0,dot(normal,sun));
    float rim=pow(1.0-max(0.0,dot(normal,-ray)),3.0)*pow(max(0.0,dot(ray,sun)),8.0);
    vec3 lighting=skyTint*.20+cloudTint*(.42+.62*diffuse)+lightTint*rim*controls.y*.22;
    float haze=1.0-exp(-hit*(.0002+controls.z*.0010));
    lighting=mix(lighting,fogTint,haze*.8)*controls.x;
    float alpha=1.0-exp(-(back-hit)*.75);
    radiance+=lighting*(transmission*alpha);transmission*=1.0-alpha;
    if(transmission<.015)break;
   }
  }
  if(end>=exit)break;
  if(next.x<next.y){t=next.x;next.x+=stride.x;cell.x+=direction.x;normal=vec3(-direction.x,0,0);}
  else {t=next.y;next.y+=stride.y;cell.y+=direction.y;normal=vec3(0,0,-direction.y);}
 }
 float fade=(1.0-smoothstep(650.0,950.0,entry))*smoothstep(.055,.17,abs(ray.y));
 return vec4(clamp(radiance*fade,0.0,1.0),mix(1.0,transmission,fade));
}
void main(){
 vec3 ray=normalize((rayMatrix*vec4(uv*2.0-1.0,1,1)).xyz);
 colour=vec4(0,0,0,1);
 if(abs(ray.y)<=.055)return;
 vec2 layer=bvfxCloudLayer();
 float a=(uBvfxAtmoClouds.z+layer.x-camera.y)/ray.y,b=(uBvfxAtmoClouds.z+layer.y-camera.y)/ray.y;
 float entry=max(0.0,min(a,b)),exit=max(a,b);
 if(exit<=entry || entry>950.0)return;
 exit=min(exit,entry+720.0);
 if(uBvfxAtmoCloudStyle>.5 && uBvfxAtmoCloudStyle<2.5){colour=bvfxTraceBlocks(ray,entry,exit);return;}
 float span=exit-entry,stepLength=span/24.0;
 float transmittance=1.0;vec3 radiance=vec3(0);
 float facing=max(0.0,dot(ray,sun));
 float phase=.55+.09*(1.0-.55*.55)/pow(max(.08,1.0+.55*.55-1.1*facing),1.5)
  +.04*(1.0-.2*.2)/pow(max(.08,1.0+.2*.2+.4*facing),1.5);
 // Retain the original 64-voxel volume's directional march footprint.
 float lod=clamp(log2(max(1.0,stepLength*.0045*uBvfxAtmoClouds.y*64.0*.55)),0.0,3.0);
 for(int i=0;i<24;i++){
  vec3 p=camera+ray*(entry+(float(i)+.5)*stepLength);
  float density=bvfxVolumeDensity(p,lod);
  if(density>.002){
   // The original near/far sunlight probes distinguish lit cloud surfaces
   // from their interiors; a distant probe cannot stand in for the normal.
   float shade=0.0,farShade=0.0;
   if(uBvfxAtmoCloudStyle<2.5){shade=bvfxVolumeDensity(p+sun*6.0,min(4.0,lod+.45));farShade=bvfxVolumeDensity(p+sun*45.0,min(4.0,lod+1.8));}
   float depth=shade*.42+farShade*.92,directTransmission=exp(-depth*1.35);
   float height=clamp((p.y-uBvfxAtmoClouds.z+7.0)/86.0,0.0,1.0);
   float facingLight=clamp(.5+(density-shade)*1.8,0.0,1.0);
   float direct=(.12+1.02*directTransmission)*mix(.74,1.05,max(sun.y,0.0))*phase*mix(.66,1.18,facingLight);
   float powder=1.0-exp(-density*2.4),scatter=(1.0-exp(-depth*.72))*.13;
   vec3 lighting=mix(skyTint,cloudTint,.35)*(mix(.23,.43,height)+scatter);
   lighting+=cloudTint*direct*(.52+.30*powder);
   lighting+=lightTint*pow(facing,9.0)*directTransmission*controls.y*.10;
   if(uBvfxAtmoCloudStyle>2.5)lighting=cloudTint*.66+skyTint*.25+lightTint*pow(facing,8.0)*controls.y*.06;
   float distanceToSample=entry+(float(i)+.5)*stepLength;
   float haze=1.0-exp(-distanceToSample*(.0002+controls.z*.0010));
   lighting=mix(lighting,fogTint,haze*.8)*controls.x;
   float alpha=1.0-exp(-density*stepLength*.052);
   radiance+=lighting*(transmittance*alpha);transmittance*=1.0-alpha;
   if(transmittance<.015)break;
  }
 }
 float fade=(1.0-smoothstep(650.0,950.0,entry))*smoothstep(.055,.17,abs(ray.y));
 colour=vec4(clamp(radiance*fade,0.0,1.0),mix(1.0,transmittance,fade));
}`;
 const shafts=header+`
uniform sampler2D clouds;
layout(location=1) out vec4 filtered;
float solarOpening(){
 vec2 r=max(sunRadius,1.0/max(bufferSize,vec2(1))*.25)*.82;
 vec2 d=r*.70710678;
 float opening=texture(clouds,sunScreen.xy).a*.20;
 opening+=(texture(clouds,sunScreen.xy+vec2(r.x,0)).a+texture(clouds,sunScreen.xy-vec2(r.x,0)).a
  +texture(clouds,sunScreen.xy+vec2(0,r.y)).a+texture(clouds,sunScreen.xy-vec2(0,r.y)).a
  +texture(clouds,sunScreen.xy+d).a+texture(clouds,sunScreen.xy-d).a
  +texture(clouds,sunScreen.xy+vec2(d.x,-d.y)).a+texture(clouds,sunScreen.xy+vec2(-d.x,d.y)).a)*.10;
 return opening;
}
void main(){
 vec2 pixel=1.0/max(bufferSize,vec2(1));
 filtered=texture(clouds,uv)*.40;
 filtered+=(texture(clouds,uv+vec2(pixel.x,0))+texture(clouds,uv-vec2(pixel.x,0))
   +texture(clouds,uv+vec2(0,pixel.y))+texture(clouds,uv-vec2(0,pixel.y)))*.15;
 if(uBvfxAtmoCloudStyle>.5 && uBvfxAtmoCloudStyle<1.5)filtered=texture(clouds,uv);
 colour=vec4(0);
 // One corner texel carries source visibility for the full-resolution lens.
 // This adds nine reads per update, not nine per sky/shaft pixel or a pass.
 if(sunScreen.z>.5 && all(lessThan(gl_FragCoord.xy,vec2(1.0))))colour.a=solarOpening();
 if(sunScreen.z<.5 || controls.w<.5)return;
 vec2 delta=(sunScreen.xy-uv)/12.0;float total=0.0,weights=0.0,weight=1.0;
 vec2 p=uv;
 for(int i=0;i<12;i++){p+=delta;total+=texture(clouds,p).a*weight;weights+=weight;weight*=.94;}
 float local=texture(clouds,uv).a;
 float opening=texture(clouds,clamp(sunScreen.xy,vec2(.001),vec2(.999))).a;
 float beam=max(0.0,total/max(weights,.001)-local*.85-.15);
 vec3 ray=normalize((rayMatrix*vec4(uv*2.0-1.0,1,1)).xyz);
 float phase=pow(max(0.0,dot(ray,sun)),5.0);
 float edge=min(min(sunScreen.x,1.0-sunScreen.x),min(sunScreen.y,1.0-sunScreen.y));
 colour.rgb=lightTint*beam*phase*opening*controls.y*(.35+controls.z*.65)*1.8*smoothstep(0.0,.04,edge);
}`;
 const ground=header+model+`
uniform vec3 groundFrame;
void main(){
 vec2 point=groundFrame.xy+(uv-.5)*groundFrame.z;
 vec2 layer=bvfxCloudLayer();
 vec3 p=vec3(point.x,uBvfxAtmoClouds.z+layer.x,point.y);
 float span=min(320.0,(layer.y-layer.x)/max(.025,sun.y));
 float depth=bvfxVolumeDensity(p+sun*(span*.28),3.0)+bvfxVolumeDensity(p+sun*(span*.68),3.0);
 float shadow=(1.0-exp(-depth*span*.026))*smoothstep(.025,.10,sun.y);
 colour=vec4(shadow,shadow,shadow,1);
}`;
 // Native SkyMaterial Rayleigh/Mie background and tone curve from 1.7.6.
 // Cache its two angular dimensions, excluding the disc (drawn at native
 // resolution). A camera turn changes lookup coordinates, never this table.
 const atmosphere=header+`
uniform vec4 nativeParams;uniform float nativeG;uniform float nativeSunHeight;
vec3 tone(vec3 x){return ((x*(.15*x+.10*.50)+.20*.02)/(x*(.15*x+.50)+.20*.30))-.02/.30;}
vec3 atmosphereLight(vec3 scattered,vec3 extinction,float sunE,float sunHeight){
 vec3 light=pow(max(vec3(0),sunE*scattered*(1.0-extinction)),vec3(1.5));
 light*=mix(vec3(1),sqrt(max(vec3(0),sunE*scattered*extinction)),clamp(pow(1.0-sunHeight,5.0),0.0,1.0));
 return (light+.1*extinction)*.04+vec3(0,.001,.0025)*.3;
}
void main(){
 const float pi=3.141592653589793;
 vec2 q=clamp((uv*vec2(128,64)-.5)/vec2(127,63),0.0,1.0);
 float h=q.y*q.y,cosTheta=1.0-2.0*q.x*q.x*q.x*q.x;
 vec3 betaR=.0005/vec3(94,40,18)*nativeParams.z;
 vec3 wavelength=vec3(680e-9,550e-9,450e-9);
 vec3 betaM=.434*(.2*nativeParams.y)*1e-17*pi*pow(vec3(2.0*pi)/wavelength,vec3(2))*vec3(.686,.678,.666)*nativeParams.w;
 float sunE=1000.0*max(0.0,1.0-exp(-(pi/1.95-acos(clamp(nativeSunHeight,-1.0,1.0)))/1.5));
 float air=1.0/(h+.15*pow(93.885-acos(h)*180.0/pi,-1.253));
 vec3 extinction=exp(-(betaR*8400.0+betaM*1250.0)*air);
 float rPhase=3.0/(16.0*pi)*(1.0+pow(cosTheta*.5+.5,2.0));
 float g=nativeG,mPhase=(1.0-g*g)/(4.0*pi*pow(max(.0001,1.0-2.0*g*cosTheta+g*g),1.5));
 vec3 scattered=(betaR*rPhase+betaM*mPhase)/max(betaR+betaM,vec3(1e-12));
 float basePhase=(1.0-g*g)/(4.0*pi*pow(1.0+g*g,1.5));
 vec3 background=(betaR*rPhase+betaM*basePhase)/max(betaR+betaM,vec3(1e-12));
 float exposure=log2(2.0/pow(max(.0001,nativeParams.x),4.0));
 vec3 sky=clamp(tone(exposure*atmosphereLight(background,extinction,sunE,nativeSunHeight))/tone(vec3(1000)),0.0,1.0);
 vec3 forward=clamp(tone(exposure*atmosphereLight(scattered,extinction,sunE,nativeSunHeight))/tone(vec3(1000)),0.0,1.0);
 // The previous tone-mapped forward lobe was almost white over >20 degrees.
 // Separate its excess from the sky, then confine the solar aureole by angle.
 float glow=clamp((g-.70)/.12,0.0,1.0),radius=.020+.012*glow;
 float aureole=exp(-(2.0-2.0*cosTheta)/(radius*radius));
 colour=vec4(sky+max(vec3(0),forward-sky)*aureole,1);
}`;
 root.__BVFX_CREATE_CLOUDS__=function(){
  let resource=null,failure=null,current=null,draws=0,reuses=0;const watched=new WeakSet();
  function release(){if(resource&&!resource.gl.isContextLost?.()){
   const {gl}=resource;for(const texture of [resource.volume,resource.cloud,resource.filtered,resource.rays,resource.shadow,resource.sky])if(texture)gl.deleteTexture(texture);
   for(const p of resource.programs||[])gl.deleteProgram(p.program);for(const f of [...(resource.fbos||[]),resource.groundFbo,resource.skyFbo])if(f)gl.deleteFramebuffer(f);if(resource.vao)gl.deleteVertexArray(resource.vao);
  }resource=null;failure=null;}
  function observe(gl){if(watched.has(gl))return;watched.add(gl);gl.canvas?.addEventListener?.('webglcontextlost',()=>{resource=null;current=null;failure=null;});}
  function state(gl,units){
   const get=p=>gl.getParameter(p),active=get(gl.ACTIVE_TEXTURE),bindings=[];
   for(const unit of new Set(units.filter(n=>n>=0))){gl.activeTexture(gl.TEXTURE0+unit);bindings.push([unit,get(gl.TEXTURE_BINDING_2D),get(gl.TEXTURE_BINDING_3D),get(gl.SAMPLER_BINDING)]);}
   gl.activeTexture(active);
   const caps=[gl.DEPTH_TEST,gl.CULL_FACE,gl.BLEND,gl.SCISSOR_TEST,gl.STENCIL_TEST,gl.RASTERIZER_DISCARD],enabled=caps.map(c=>gl.isEnabled(c));
   const saved={program:get(gl.CURRENT_PROGRAM),vao:get(gl.VERTEX_ARRAY_BINDING),draw:get(gl.DRAW_FRAMEBUFFER_BINDING),read:get(gl.READ_FRAMEBUFFER_BINDING),viewport:get(gl.VIEWPORT),mask:get(gl.COLOR_WRITEMASK),depth:get(gl.DEPTH_WRITEMASK)};
   return {saved,discard(textures){const deleted=new Set(textures);for(const b of bindings)for(const i of [1,2])if(deleted.has(b[i]))b[i]=null;},restore(){gl.useProgram(saved.program);gl.bindVertexArray(saved.vao);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,saved.draw);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.read);gl.viewport(...saved.viewport);gl.colorMask(...saved.mask);gl.depthMask(saved.depth);caps.forEach((cap,i)=>(enabled[i]?gl.enable:gl.disable).call(gl,cap));for(const [unit,two,three,sampler]of bindings){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,two);gl.bindTexture(gl.TEXTURE_3D,three);gl.bindSampler(unit,sampler);}gl.activeTexture(active);}};
  }
  function unpack(gl,fn){
   const fields=[gl.UNPACK_ALIGNMENT,gl.UNPACK_ROW_LENGTH,gl.UNPACK_IMAGE_HEIGHT,gl.UNPACK_SKIP_ROWS,gl.UNPACK_SKIP_PIXELS,gl.UNPACK_SKIP_IMAGES,gl.UNPACK_FLIP_Y_WEBGL,gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL].filter(v=>v!==undefined);
   const saved=fields.map(p=>gl.getParameter(p)),pbo=gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING);
   try{gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,null);fields.forEach(p=>gl.pixelStorei(p,p===gl.UNPACK_ALIGNMENT?4:0));return fn();}
   finally{fields.forEach((p,i)=>gl.pixelStorei(p,saved[i]));gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,pbo);}
  }
  function volume(gl,unit){
   if(resource?.gl!==gl){release();resource={gl,programs:[],fbos:[]};}observe(gl);
   if(resource.volume)return;
   gl.activeTexture(gl.TEXTURE0+unit);resource.volume=gl.createTexture();gl.bindTexture(gl.TEXTURE_3D,resource.volume);
   for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,p,gl.REPEAT);
   gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   unpack(gl,()=>{gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,64,64,64,0,gl.RGBA,gl.UNSIGNED_BYTE,volumeBytes());gl.generateMipmap(gl.TEXTURE_3D);});
   if(gl.getError()!==gl.NO_ERROR)throw Error('Cloud volume upload rejected');
  }
  function bind(gl,loc,program,persistent=false){
   if(!loc)return;
   const allocator=root.__BVFX_SAMPLER_UNITS__?.(gl,program);if(!allocator)return;
   const list=[['volume','uBvfxAtmoVolume',gl.TEXTURE_3D],['cloud','uBvfxAtmoCloudImage',gl.TEXTURE_2D],['rays','uBvfxAtmoRayImage',gl.TEXTURE_2D],['groundImage','uBvfxAtmoGroundImage',gl.TEXTURE_2D],['skyImage','uBvfxAtmoSkyImage',gl.TEXTURE_2D]];
   const tracker=root.__BVFX_GL_STATE__?.(gl),saved=[];let active=null;
   const activeUnit=()=>tracker?.active??gl.getParameter(gl.ACTIVE_TEXTURE);
   const ready=(value)=>{if(loc.volumeReady!=null&&loc.lastVolumeReady!==value){gl.uniform1f(loc.volumeReady,value);loc.lastVolumeReady=value;}};
   try{
    for(const [key,name,target]of list){if(loc[key]==null)continue;const unit=allocator.get(name);if(!(unit>=0))continue;
     const enabled=current?.enabled&&(current.clouds[0]>0||key==='skyImage'&&current.nativeParams)&&failure?.gl!==gl&&gl.texImage3D;
     const property=key==='groundImage'?'shadow':key==='skyImage'?'sky':key==='cloud'&&resource?.filtered?'filtered':key;
     const texture=enabled?resource?.[property]:null;
     if(texture&&tracker?.bindings?.get((gl.TEXTURE0+unit)+':'+target)===texture&&tracker.samplers?.get(unit)===null)continue;
     if(active===null)active=activeUnit();gl.activeTexture(gl.TEXTURE0+unit);
     const bindingKey=(gl.TEXTURE0+unit)+':'+target;
     saved.push([unit,target,tracker?.bindings?.has(bindingKey)?tracker.bindings.get(bindingKey):gl.getParameter(target===gl.TEXTURE_3D?gl.TEXTURE_BINDING_3D:gl.TEXTURE_BINDING_2D),tracker?.samplers?.has(unit)?tracker.samplers.get(unit):gl.getParameter(gl.SAMPLER_BINDING)]);
     if(key==='volume'&&enabled)volume(gl,unit);
     const bound=enabled?resource?.[property]:null;
     if(bound){gl.bindTexture(target,bound);gl.bindSampler(unit,null);}else root.__BVFX_BIND_NEUTRAL__?.(gl,unit,target,true);
     gl.uniform1i(loc[key],unit);
    }
    ready(current?.enabled&&failure?.gl!==gl&&resource?.volume?1:0);
    if(loc.sourceSample!=null && resource?.width && (loc.sourceWidth!==resource.width || loc.sourceHeight!==resource.height)){
     gl.uniform2f(loc.sourceSample,.5/resource.width,.5/resource.height);loc.sourceWidth=resource.width;loc.sourceHeight=resource.height;
    }
    if(loc.groundFrame!=null){const frame=current?.enabled&&current.clouds[0]>0&&current.groundStrength>0&&current.sun[1]>.025&&resource?.groundKey&&failure?.gl!==gl?[...resource.groundFrame,1]:[0,0,1,0];const key=frame.join(',');if(loc.lastGroundFrame!==key){gl.uniform4f(loc.groundFrame,...frame);loc.lastGroundFrame=key;}}
   }catch(error){const reason=String(error.message);release();failure={gl,reason};ready(0);if(loc.nativeReady!=null){gl.uniform1f(loc.nativeReady,0);loc.lastNativeReady=0;}if(loc.groundFrame!=null){gl.uniform4f(loc.groundFrame,0,0,1,0);loc.lastGroundFrame='0,0,1,0';}
    for(const [key,name,target]of list){const unit=allocator.get(name);if(loc[key]!=null&&unit>=0){root.__BVFX_BIND_NEUTRAL__?.(gl,unit,target,true);gl.uniform1i(loc[key],unit);}}
   }
   finally{if(active!==null)gl.activeTexture(active);}
   publish(gl,loc);
   if(!saved.length)return;
   const restore=()=>{const a=gl.getParameter(gl.ACTIVE_TEXTURE);for(const [unit,target,texture,sampler]of saved){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(target,texture);gl.bindSampler(unit,sampler);}gl.activeTexture(a);};
   if(!persistent)return restore;
  }
  function publish(gl,loc,write=gl){
   if(!loc)return;
   const valid=current?.enabled&&resource?.gl===gl&&failure?.gl!==gl;
   if(loc.cacheReady!=null)write.uniform1f.call(gl,loc.cacheReady,valid&&current.clouds[0]>0&&resource.cloudReady?1:0);
   if(loc.nativeReady!=null){const ready=valid&&current.nativeParams&&resource.skyKey?1:0;
    if(loc.lastNativeReady!==ready){write.uniform1f.call(gl,loc.nativeReady,ready);loc.lastNativeReady=ready;}}
  }
  function compile(gl,source){
   const program=gl.createProgram(),shaders=[];
   try{for(const [type,text]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,source]]){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Cloud shader compilation failed');gl.attachShader(program,shader);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Cloud shader linking failed');return {program,locations:new Map()};}
   catch(error){gl.deleteProgram(program);throw error;}finally{for(const s of shaders)gl.deleteShader(s);}
  }
  function draw(gl,loc){
   if(!loc||loc.cacheReady==null||!current?.enabled||current.clouds[0]<=0&&!current.nativeParams||failure?.gl===gl||!gl.texImage3D||!current.matrix)return;
   if(gl.isEnabled(gl.RASTERIZER_DISCARD)||(gl.getParameter(gl.TRANSFORM_FEEDBACK_ACTIVE)&&!gl.getParameter(gl.TRANSFORM_FEEDBACK_PAUSED)))return;
   const view=gl.getParameter(gl.VIEWPORT),scale=Math.min(.5,960/view[2],540/view[3]);
   const w=Math.max(1,Math.ceil(view[2]*scale)),h=Math.max(1,Math.ceil(view[3]*scale));
   const sunHeight=current.nativeParams?current.sun.reduce((v,n,i)=>v+n*current.nativeUp[i],0):0;
   const skyKey=current.nativeParams?JSON.stringify([current.nativeParams,sunHeight]):null;
   const t=(current.clouds[2]-current.camera[1])/Math.max(.025,current.sun[1]);
   const groundFrame=[Math.floor((current.camera[0]+current.sun[0]*t)/64)*64,Math.floor((current.camera[2]+current.sun[2]*t)/64)*64,2048];
   const groundKey=current.groundStrength>0&&current.sun[1]>.025?JSON.stringify([groundFrame,current.sun,current.clouds,current.style,current.clouds[3]>0?Math.floor(current.time*10):0]):null;
   const key=JSON.stringify([w,h,current.matrix,current.camera,current.sun,current.cloudTint,current.skyTint,current.fogTint,current.lightTint,current.clouds,current.style,current.controls,current.sunScreen,current.sunRadius,current.clouds[3]>0?Math.floor(current.time*30):0]);
   // Repeated native sky draws can reuse all completed targets before taking
   // ownership of any GL state. No rebind/restore or render work on this path.
   if(resource?.gl===gl && resource.width===w && resource.height===h && resource.key===key && resource.skyKey===skyKey && resource.groundKey===groundKey){
    reuses++;gl.uniform1f(loc.cacheReady,1);if(loc.viewport!=null)gl.uniform4f(loc.viewport,...view);return;
   }
   const unit=Math.max(0,gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)-1),guard=state(gl,[unit]);let ready=false;
   try{
    volume(gl,unit);
    const r=resource;
    if(!r.programs.length){r.programs.push(compile(gl,fragment));r.programs.push(compile(gl,shafts));r.programs.push(compile(gl,ground));r.programs.push(compile(gl,atmosphere));r.vao=gl.createVertexArray();}
    if(r.width!==w||r.height!==h){
     guard.discard([r.cloud,r.rays,r.filtered]);
     for(const t of [r.cloud,r.rays,r.filtered])if(t)gl.deleteTexture(t);for(const f of r.fbos)gl.deleteFramebuffer(f);r.fbos=[];
     for(const key of ['cloud','rays','filtered']){
      const t=gl.createTexture();r[key]=t;gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      unpack(gl,()=>gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null));
      if(key==='filtered'){gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,r.fbos[1]);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0+1,gl.TEXTURE_2D,t,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT0+1]);}
      else {const f=gl.createFramebuffer();r.fbos.push(f);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,f);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);}
      if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Cloud framebuffer incomplete');
     }r.width=w;r.height=h;r.key=null;r.cloudReady=false;
    }
    const configure=()=>{gl.bindVertexArray(r.vao);for(const cap of [gl.DEPTH_TEST,gl.CULL_FACE,gl.BLEND,gl.SCISSOR_TEST,gl.STENCIL_TEST,gl.RASTERIZER_DISCARD])gl.disable(cap);gl.colorMask(true,true,true,true);gl.depthMask(false);gl.bindSampler(unit,null);};
    const uniforms=(p)=>((name,method,...args)=>{if(!p.locations.has(name))p.locations.set(name,gl.getUniformLocation(p.program,name));const at=p.locations.get(name);if(at!=null)gl[method](at,...args);});
    if(current.nativeParams){
     if(!r.sky){r.sky=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,r.sky);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);unpack(gl,()=>gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,128,64,0,gl.RGBA,gl.UNSIGNED_BYTE,null));r.skyFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,r.skyFbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,r.sky,0);if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Atmosphere framebuffer incomplete');}
     if(skyKey!==r.skyKey){configure();gl.viewport(0,0,128,64);const p=r.programs[3],set=uniforms(p);gl.useProgram(p.program);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,r.skyFbo);set('nativeParams','uniform4f',...current.nativeParams.slice(0,4));set('nativeG','uniform1f',current.nativeParams[4]);set('nativeSunHeight','uniform1f',sunHeight);gl.drawArrays(gl.TRIANGLES,0,3);r.skyKey=skyKey;r.skyUpdates=(r.skyUpdates||0)+1;}
    }else r.skyKey=null;
    if(current.clouds[0]<=0)return;
    if(current.groundStrength>0 && current.sun[1]>.025){
     if(!r.shadow){r.shadow=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,r.shadow);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);unpack(gl,()=>gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,512,512,0,gl.RGBA,gl.UNSIGNED_BYTE,null));r.groundFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,r.groundFbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,r.shadow,0);if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Cloud shadow framebuffer incomplete');}
     const frame=groundFrame;
     if(groundKey!==r.groundKey){configure();gl.viewport(0,0,512,512);const p=r.programs[2],set=uniforms(p);gl.useProgram(p.program);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,r.groundFbo);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,null);gl.bindTexture(gl.TEXTURE_3D,r.volume);set('uBvfxAtmoVolume','uniform1i',unit);set('uBvfxAtmoVolumeReady','uniform1f',1);set('sun','uniform3f',...current.sun);set('groundFrame','uniform3f',...frame);set('uBvfxAtmoClouds','uniform4f',...current.clouds);set('uBvfxAtmoTime','uniform1f',current.time);set('uBvfxAtmoCloudStyle','uniform1f',current.style);gl.drawArrays(gl.TRIANGLES,0,3);r.groundKey=groundKey;r.groundFrame=frame;r.groundUpdates=(r.groundUpdates||0)+1;}
    }else r.groundKey=null;
    if(key!==r.key){
     configure();gl.viewport(0,0,w,h);
     for(let pass=0;pass<2;pass++){
      const p=r.programs[pass];gl.useProgram(p.program);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,r.fbos[pass]);
      const set=uniforms(p);
      for(const [name,v]of Object.entries({camera:current.camera,sun:current.sun,cloudTint:current.cloudTint,skyTint:current.skyTint,fogTint:current.fogTint,lightTint:current.lightTint,sunScreen:current.sunScreen}))set(name,'uniform3f',...v);
      set('rayMatrix','uniformMatrix4fv',false,current.matrix);set('bufferSize','uniform2f',w,h);set('sunRadius','uniform2f',...(current.sunRadius||[0,0]));set('uBvfxAtmoClouds','uniform4f',...current.clouds);set('controls','uniform4f',...current.controls);set('uBvfxAtmoTime','uniform1f',current.time);set('uBvfxAtmoCloudStyle','uniform1f',current.style);
      gl.activeTexture(gl.TEXTURE0+unit);
      if(pass===0){gl.bindTexture(gl.TEXTURE_2D,null);gl.bindTexture(gl.TEXTURE_3D,r.volume);set('uBvfxAtmoVolume','uniform1i',unit);set('uBvfxAtmoVolumeReady','uniform1f',1);}
      else{gl.bindTexture(gl.TEXTURE_3D,null);gl.bindTexture(gl.TEXTURE_2D,r.cloud);set('clouds','uniform1i',unit);}
      gl.drawArrays(gl.TRIANGLES,0,3);
     }r.key=key;r.cloudReady=true;draws++;
    }else reuses++;
    ready=true;
   }catch(error){const reason=String(error.message);if(resource)guard.discard([resource.volume,resource.cloud,resource.filtered,resource.rays,resource.shadow,resource.sky]);release();failure={gl,reason};}
   finally{guard.restore();if(loc.cacheReady!=null)gl.uniform1f(loc.cacheReady,ready?1:0);if(loc.viewport!=null)gl.uniform4f(loc.viewport,...view);}
  }
  return {model,groundModel,vertex,fragment,shafts,ground,atmosphere,volumeBytes,setFrame:frame=>{current=frame;},bind,publish,draw,dispose(){release();current=null;},
   diagnostics:()=>({implementation:'cloud-presets-v5',noiseBytes:resource?.volume?64**3*4:0,volumeTextures:resource?.volume?1:0,offscreenPasses:resource?.programs.length||0,cloudBuffer:resource?.width?[resource.width,resource.height]:null,groundBuffer:resource?.shadow?[512,512]:null,atmosphereBuffer:resource?.sky?[128,64]:null,atmosphereUpdates:resource?.skyUpdates||0,groundUpdates:resource?.groundUpdates||0,integrations:draws,reuses,viewSteps:24,shaftSteps:12,status:failure?.reason||(resource?.programs.length?'Ready':'Waiting for sky draw')})};
 };
})();
