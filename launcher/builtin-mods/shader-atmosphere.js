// Native-resolution sky/solar optics with a separate bounded cloud integrator.
(() => {
  'use strict';
  const root=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
  root.__BVFX_CREATE_ATMOSPHERE__=function(settings){
    const styles={clear:{index:0,sky:[.48,.69,1],cloud:[1,.98,.94],ground:[1,1,1]},golden:{index:1,sky:[.32,.48,.74],cloud:[1,.86,.68],ground:[1.08,.94,.82]},dreamy:{index:2,sky:[.62,.55,.83],cloud:[.98,.88,1],ground:[1.02,.96,1]},moonlit:{index:3,sky:[.045,.075,.16],cloud:[.17,.22,.33],ground:[.50,.62,.83]},overcast:{index:4,sky:[.43,.52,.61],cloud:[.76,.79,.81],ground:[.87,.91,.95]},storm:{index:5,sky:[.16,.23,.30],cloud:[.30,.35,.40],ground:[.70,.77,.84]},milkyway:{index:6,space:true,sky:[.025,.035,.09],cloud:[.1,.1,.2],ground:[.55,.62,.8]},blackhole:{index:7,space:true,sky:[.025,.022,.055],cloud:[.1,.1,.2],ground:[.65,.60,.75]},andromeda:{index:8,space:true,sky:[.025,.045,.09],cloud:[.1,.1,.2],ground:[.5,.65,.8]}};
    const palette=()=>styles[settings.skyStyle]||styles.clear;
    function bodyDirection(){const style=palette(),moonlit=style.index===3||style.space,az=(settings.sunAzimuth+(moonlit&&!settings.dayNightFrame?180:0))*Math.PI/180,el=(moonlit&&!settings.dayNightFrame?42:settings.sunElevation)*Math.PI/180;
      return settings.dayNightFrame?.body||[Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)];}
    const clouds=root.__BVFX_CREATE_CLOUDS__?.();
    let fogFrame=null;
    let origin=[0,0,0],camera=[0,0,0],sunScreen=[0,0,0],cloudOffset=null;
    let rayMatrix=null,clipMatrix=null,solarCache=null;
    let nativeFrames=new WeakMap();const nativeObserved=new WeakSet();
    function setViewProjection(view,projection){
      // A missing/singular observation is not a new camera. Keep the last
      // completed camera until a valid replacement or explicit world disposal.
      if(view?.length!==16||projection?.length!==16||!Array.from(view).every(Number.isFinite)||!Array.from(projection).every(Number.isFinite))return;
      // Invert the observed projection and camera rotation, excluding camera
      // translation. Sky geometry may be finite, rebased or a cubemap face.
      const rotation=Array.from(view);rotation[12]=rotation[13]=rotation[14]=0;
      const matrix=Array.from({length:4},(_,row)=>Array.from({length:8},(_,col)=>col<4
        ?[0,1,2,3].reduce((n,k)=>n+projection[k*4+row]*rotation[col*4+k],0):Number(col-4===row)));
      const forward=Array.from({length:16},(_,i)=>matrix[i%4][Math.floor(i/4)]);
      for(let col=0;col<4;col++){
        let pivot=col;for(let row=col+1;row<4;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;
        if(Math.abs(matrix[pivot][col])<1e-10)return;
        [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
        const divisor=matrix[col][col];for(let i=0;i<8;i++)matrix[col][i]/=divisor;
        for(let row=0;row<4;row++)if(row!==col){const scale=matrix[row][col];for(let i=0;i<8;i++)matrix[row][i]-=scale*matrix[col][i];}
      }
      const inverse=Float32Array.from({length:16},(_,i)=>matrix[i%4][4+Math.floor(i/4)]);
      if(Array.from(inverse).every(Number.isFinite)){rayMatrix=inverse;clipMatrix=forward;}
    }
    function projectSolar(sun,width,height){
      if(solarCache&&solarCache.matrix===clipMatrix&&solarCache.width===width&&solarCache.height===height
          &&solarCache.source===sunScreen&&sun.every((v,i)=>v===solarCache.sun[i]))return solarCache;
      let screen=sunScreen;
      if(clipMatrix){
        // A direction has w=0, so world rebases cannot shift lens optics.
        const clip=[0,1,3].map(i=>clipMatrix[i]*sun[0]+clipMatrix[i+4]*sun[1]+clipMatrix[i+8]*sun[2]);
        screen=clip[2]>.0001?[.5+.5*clip[0]/clip[2],.5+.5*clip[1]/clip[2],1]:[.5,.5,0];
      }
      if(!screen.every(Number.isFinite))screen=[.5,.5,0];
      const onScreen=screen[2]>.5&&screen[0]>0&&screen[0]<1&&screen[1]>0&&screen[1]<1;
      let pixel=2/Math.max(1,Math.min(width,height)),angular=[2*width/Math.max(1,height),2];
      // Pixel angle is independent of the flare checkbox and brightness.
      if(rayMatrix&&screen[2]>.5){
        const ray=(x,y)=>{const v=[0,1,2].map(i=>rayMatrix[i]*x+rayMatrix[i+4]*y+rayMatrix[i+8]+rayMatrix[i+12]),n=Math.hypot(...v);return v.map(c=>c/n);};
        const x=screen[0]*2-1,y=screen[1]*2-1,a=ray(x,y),b=ray(x+2/width,y),c=ray(x,y+2/height);
        const dx=Math.hypot(...a.map((v,i)=>v-b[i])),dy=Math.hypot(...a.map((v,i)=>v-c[i]));
        pixel=Math.max(dx,dy);angular=[dx*width,dy*height];
      }
      // Native programs can bind many times per frame. Project/unproject once
      // per observed camera/source/size, never once per terrain draw.
      return solarCache={matrix:clipMatrix,width,height,source:sunScreen,sun:Array.from(sun),screen,onScreen,pixel,angular};
    }
    const common=`
uniform float uBvfxAtmoActive;
uniform vec3 uBvfxAtmoSkyTint;
uniform vec3 uBvfxAtmoLegacyTint;
uniform vec3 uBvfxAtmoSunDir;
uniform vec3 uBvfxAtmoCloudTint;
uniform vec3 uBvfxAtmoGroundTint;
uniform vec4 uBvfxAtmoControls;
uniform vec4 uBvfxAtmoClouds;
uniform vec3 uBvfxAtmoCameraWorld;
uniform vec3 uBvfxAtmoWorldOrigin;
uniform float uBvfxAtmoTime;
uniform float uBvfxAtmoStars;
uniform vec4 uBvfxAtmoArt;
uniform float uBvfxAtmoCloudStyle;
uniform float uBvfxAtmoStyle;
uniform vec3 uBvfxAtmoSunScreen;
uniform vec2 uBvfxAtmoScreen;
uniform vec2 uBvfxAtmoSunShape;
uniform highp mat4 uBvfxAtmoRayMatrix;
uniform float uBvfxAtmoRayReady;
uniform vec3 uBvfxAtmoFogTint;
uniform vec4 uBvfxAtmoViewport;
uniform float uBvfxAtmoCloudCacheReady;
uniform sampler2D uBvfxAtmoCloudImage;
uniform sampler2D uBvfxAtmoRayImage;
uniform vec2 uBvfxAtmoSourceSample;
uniform sampler2D uBvfxAtmoSkyImage;
uniform float uBvfxAtmoNativeReady;
uniform vec3 uBvfxAtmoNativeUp;
${clouds?.model||''}
#if __VERSION__ >= 300
#define BVFX_SKY_TEXTURE texture
#else
#define BVFX_SKY_TEXTURE texture2D
#endif
vec2 bvfxSkyUV(){return (gl_FragCoord.xy-uBvfxAtmoViewport.xy)/max(uBvfxAtmoViewport.zw,vec2(1));}
vec3 bvfxViewRay(vec3 fallback){
 if(uBvfxAtmoRayReady<.5)return fallback;
 vec2 ndc=bvfxSkyUV()*2.0-1.0;
 return normalize((uBvfxAtmoRayMatrix*vec4(ndc,1.0,1.0)).xyz);
}
// Bounded lattice hashing avoids large sine arguments/rounding discontinuities.
float bvfxSkyHash(vec2 p){p=mod(p,289.0);float h=mod((p.x*34.0+1.0)*p.x,289.0);h=mod(h+p.y,289.0);return mod((h*34.0+1.0)*h,289.0)/289.0;}
float bvfxSkyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(bvfxSkyHash(i),bvfxSkyHash(i+vec2(1,0)),f.x),mix(bvfxSkyHash(i+vec2(0,1)),bvfxSkyHash(i+vec2(1)),f.x),f.y);}
// Smooth styles never quantize ray coordinates. Four bounded octaves give
// broad banks, billowing edges and small detail without a volume raymarch.
float bvfxCloudField(vec2 p){return bvfxSkyNoise(p);}
vec2 bvfxCloudPoint(vec3 position,vec3 direction){
 return (position.xz+direction.xz*max(0.0,uBvfxAtmoClouds.z-position.y)/max(.025,direction.y))*(.006*uBvfxAtmoClouds.y)+uBvfxAtmoTime*uBvfxAtmoClouds.w*vec2(.035,.014);
}
float bvfxCloudOpacity(float field){
 float cover=clamp(uBvfxAtmoClouds.x,0.0,1.0);
 float cut=mix(.82,.18,cover);
 return smoothstep(cut-.065,cut+.105,field)*smoothstep(0.0,.06,cover);
}
vec2 bvfxCloudSample(vec2 point){
 if(uBvfxAtmoCloudStyle>.5 && uBvfxAtmoCloudStyle<1.5)point=floor(point*8.0)/8.0;
 float field=bvfxCloudField(point);
 if(uBvfxAtmoCloudStyle>1.5 && uBvfxAtmoCloudStyle<2.5)field=mix(field,bvfxSkyNoise(point*.65+9.0),.25);
 if(uBvfxAtmoCloudStyle>2.5)field=mix(field,bvfxSkyNoise(point*.45+5.0),.55);
 return vec2(bvfxCloudOpacity(field),field);
}
// Retained analytic objects from the pinned authored sky; no volume passes.
vec2 bvfxSpaceUV(vec3 ray,vec3 direction) {
  vec3 forward=normalize(direction);
  vec3 right=normalize(cross(vec3(0.0,1.0,0.0),forward));
  vec3 up=cross(forward,right);
  return vec2(dot(ray,right),dot(ray,up))/max(0.01,dot(ray,forward));
}
vec2 bvfxSpaceRotate(vec2 p,float a) {
  return mat2(cos(a),-sin(a),sin(a),cos(a))*p;
}
float bvfxSpaceNoise(vec2 p) {
  vec2 cell=floor(p),f=fract(p);
  vec2 w=f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(bvfxSkyHash(cell),bvfxSkyHash(cell+vec2(1.0,0.0)),w.x),
    mix(bvfxSkyHash(cell+vec2(0.0,1.0)),bvfxSkyHash(cell+vec2(1.0,1.0)),w.x),w.y)*2.0-1.0;
}
float bvfxSpaceGrain(vec2 p) {
  float value=0.0,weight=0.53;
  for(int octave=0;octave<4;octave++) {
    value+=(0.5+0.5*bvfxSpaceNoise(p))*weight;
    p=mat2(1.61,-1.19,1.19,1.61)*p+vec2(7.3,11.9);
    weight*=0.49;
  }
  return value;
}
vec3 bvfxSpaceGalaxy(vec3 sky,vec3 ray,vec3 direction,float size,float tilt,vec3 tint,float pixel) {
  if(dot(ray,normalize(direction))<inversesqrt(1.0+size*size*7.29))return sky;
  vec2 p=bvfxSpaceRotate(bvfxSpaceUV(ray,direction)/size,tilt);
  p.y*=2.65;
  float r=length(p);
  if(r>2.7)return sky;
  float angle=atan(p.y,p.x),grain=bvfxSpaceGrain(p*22.0);
  float warp=bvfxSpaceNoise(p*3.1)*1.05+bvfxSpaceNoise(p*8.7)*0.45;
  float spiral=angle*2.0+log(r+0.16)*8.2+warp;
  float arms=pow(0.5+0.5*cos(spiral),2.2);
  float envelope=exp(-r*r*0.90)*(1.0-smoothstep(1.7,2.7,r));
  float lane=pow(0.5+0.5*cos(spiral+0.85),7.0);
  float broken=smoothstep(0.25,0.67,bvfxSpaceGrain(p*31.0+vec2(5.0,9.0)));
  float dust=lane*(0.40+0.60*broken)*smoothstep(0.15,0.55,r);
  float disk=envelope*(0.38+arms*0.34)*(0.70+grain*0.55);
  vec3 diskTint=mix(vec3(0.90,0.69,0.49),tint,clamp(r*0.85,0.0,1.0));
  vec3 galaxy=diskTint*disk*(1.0-dust*0.84);
  float bulge=dot(p/vec2(1.0,1.9),p/vec2(1.0,1.9));
  galaxy+=vec3(0.92,0.79,0.65)*(exp(-bulge*8.0)*0.28+exp(-bulge*55.0)*0.62);
  galaxy+=vec3(1.0,0.97,0.88)*exp(-bulge*900.0)*0.60;
  float knots=pow(smoothstep(0.54,0.76,grain),3.0)*arms*envelope*smoothstep(0.32,0.70,r);
  galaxy+=vec3(1.0,0.075,0.18)*knots*0.56;
  galaxy+=vec3(0.25,0.49,0.95)*arms*envelope*smoothstep(0.75,1.4,r)*(0.08+knots*0.22);
  sky+=galaxy;
  return sky;
}
vec3 bvfxSpaceHole(vec3 sky,vec3 ray,vec3 direction,float size,float tilt,vec3 tint,float pixel) {
  if(dot(ray,normalize(direction))<inversesqrt(1.0+size*size*7.0225))return sky;
  vec2 p=bvfxSpaceRotate(bvfxSpaceUV(ray,direction)/size,tilt);
  float r=length(p);
  if(r>2.65)return sky;
  float aa=max(0.004,pixel/size),horizon=0.48;
  float angle=atan(p.y,p.x);
  float turbulence=bvfxSpaceGrain(p*vec2(11.0,29.0));
  float ringGrain=bvfxSpaceGrain(vec2(cos(angle)*8.0,sin(angle)*8.0)+r*19.0);
  float ring=exp(-pow((r-0.505)/max(0.012,aa),2.0));
  float upper=smoothstep(-0.45,0.45,p.y/max(r,0.001));
  float lens=exp(-pow((r-0.57)/0.075,2.0))*(0.55+upper*0.65);
  float diskRadius=length(vec2(p.x,p.y*6.5));
  float disk=exp(-pow((diskRadius-0.98)/0.55,2.0));
  float beaming=clamp(1.0-p.x*0.26,0.65,1.4);
  vec3 hot=vec3(1.0,0.94,0.77),amber=mix(tint,vec3(1.0,0.38,0.055),0.65);
  vec3 light=hot*ring*1.10+amber*lens*(0.70+ringGrain*0.45)
    +mix(amber,hot,0.30)*disk*(0.40+turbulence*0.65)*beaming;
  float voidMask=1.0-smoothstep(horizon-aa,horizon+aa,r);
  sky=mix(sky,vec3(0.001,0.001,0.003),voidMask);
  // The thin foreground part of the accretion disk crosses the dark core.
  float foreground=exp(-pow(p.y/max(0.026,aa),2.0))
    *exp(-p.x*p.x*0.85)*(0.95+turbulence*0.30);
  float diskGlow=exp(-pow(p.y/0.105,2.0))*exp(-p.x*p.x*0.55);
  float gain=size<0.06?0.20:1.12;
  sky+=((light+amber*diskGlow*0.22)*(1.0-voidMask)+hot*foreground)*gain;
  sky+=amber*exp(-pow((r-0.62)/0.23,2.0))*0.18*(1.0-voidMask)*gain;
  return sky;
}
vec3 bvfxSpacePlanet(vec3 sky,vec3 ray,vec3 direction,float radius,vec3 tint,float ringed,float pixel) {
  if(dot(ray,normalize(direction))<0.93)return sky;
  vec2 p=bvfxSpaceUV(ray,direction)/radius;
  float r=length(p),aa=max(0.012,pixel/radius);
  if(r>2.4)return sky;
  vec2 q=bvfxSpaceRotate(p,0.45);
  float ringRadius=length(vec2(q.x,q.y*3.4));
  float rings=(1.0-smoothstep(1.95,2.1,ringRadius))*smoothstep(1.2,1.32,ringRadius)
    *ringed;
  sky+=tint*rings*0.13;
  float disk=1.0-smoothstep(1.0-aa,1.0+aa,r);
  float z=sqrt(max(0.0,1.0-dot(p,p)));
  vec3 normal=vec3(p,z);
  float lighting=0.09+0.91*max(0.0,dot(normal,normalize(vec3(-0.6,0.4,0.85))));
  float bands=0.65+0.10*bvfxSpaceNoise(p*5.0);
  vec3 planet=tint*lighting*bands;
  planet+=vec3(0.24,0.32,0.45)*pow(1.0-z,4.0)*0.08;
  sky=mix(sky,planet,disk);
  // Only the front arc covers the sphere; the rear ring is occluded.
  sky+=tint*rings*step(0.0,q.y)*disk*0.13;
  return sky;
}

// These profiles are filled and monotone. Their scale is independent of bloom.
float bvfxSolarDisc(float distance,float radius,float edge){
 return 1.0-smoothstep(radius-edge,radius+edge,distance);
}
float bvfxSolarHalo(float distance,float radius,float glow){
 float q=distance/max(radius,.001);
 return (exp2(-1.5*q*q)*.72+exp2(-.16*q*q)*.20+exp2(-.018*q*q)*.035)*glow;
}
float bvfxFlareSpot(float x,float y,float radius){
 float q=(x*x+y*y)/(radius*radius);
 if(q>16.0)return 0.0;
 return exp2(-2.5*q);
}
float bvfxFlareStreak(float x,float y){
 if(abs(y)>=.15)return 0.0;
 return exp(-abs(y)*700.0)*exp(-abs(x)*35.0);
}
float bvfxFlareGhost(float x,float y,float axisX,float axisY,float position,float radius){
 float px=abs(x-axisX*position),py=abs(y-axisY*position);
 if(max(px,py)>radius*1.12)return 0.0;
 float radial=sqrt(px*px+py*py)/radius;
 float q=radial;
 if(q>=1.0)return 0.0;
 // Defocused reflections taper across the whole footprint: no filled
 // translucent discs with a conspicuous hard aperture edge.
 return exp2(-4.0*q*q)*(1.0-smoothstep(.35,1.0,q));
}
float bvfxFlareTransmission(float opacity,float elevation){
 float transmission=max(0.0,1.0-opacity);
 return transmission*smoothstep(.015,.10,transmission)*smoothstep(-.008,.035,elevation);
}
vec3 bvfxSolarFlare(vec2 uv){
 vec2 aspect=vec2(uBvfxAtmoScreen.x/max(1.0,uBvfxAtmoScreen.y),1.0);
 vec2 axis=(vec2(.5)-uBvfxAtmoSunScreen.xy)*aspect;
 vec2 p=(uv-vec2(.5))*aspect;
 vec2 light=(uv-uBvfxAtmoSunScreen.xy)*aspect;
 // Compact photographic glare around the restored native angular disc.
 // Long, bright exponential wings previously saturated almost the whole sky.
 // Skip finite aperture support and profiles below float32 precision.
 float source=dot(light,light)<.0044?exp(-dot(light,light)*24000.0)*.42:0.0;
 float horizontal=bvfxFlareStreak(light.x,light.y)*.08;
 float vertical=abs(light.x)<.10?exp(-abs(light.x)*1100.0)*exp(-abs(light.y)*60.0)*.035:0.0;
 vec2 diagonal=vec2(light.x+light.y,light.x-light.y)*.70710678;
 float spikeA=abs(diagonal.x)<.08?exp(-abs(diagonal.x)*1400.0)*exp(-abs(diagonal.y)*100.0):0.0;
 float spikeB=abs(diagonal.y)<.08?exp(-abs(diagonal.y)*1400.0)*exp(-abs(diagonal.x)*100.0):0.0;
 float spikes=(spikeA+spikeB)*.012;
 // Uneven, faint optical reflections. Their peak energy and edge falloff
 // vary instead of producing a string of equally bright coloured bubbles.
 float ghost0=bvfxFlareGhost(p.x,p.y,axis.x,axis.y,-.38,.012);
 float ghost1=bvfxFlareGhost(p.x,p.y,axis.x,axis.y,.52,.028);
 float ghost2=bvfxFlareGhost(p.x,p.y,axis.x,axis.y,1.30,.048);
 float separate=smoothstep(.025,.20,length(axis));
 vec3 warm=mix(vec3(1.0,.9,.72),vec3(1.0,.78,.52),uBvfxAtmoArt.y);
 vec3 flare=warm*(source+horizontal+vertical+spikes);
 flare+=(vec3(.74,.83,1.0)*ghost0*.085+warm*ghost1*.045
   +vec3(.60,.82,.75)*ghost2*.022)*separate;
 float edge=min(min(uBvfxAtmoSunScreen.x,1.0-uBvfxAtmoSunScreen.x),min(uBvfxAtmoSunScreen.y,1.0-uBvfxAtmoSunScreen.y));
 flare*=1.20*smoothstep(0.0,.06,edge)*smoothstep(-.008,.06,uBvfxAtmoSunDir.y)*max(0.0,uBvfxAtmoControls.z);
 // Nine disc samples are evaluated once in the existing shaft draw, then
 // read from its first texel. Opaque clouds cannot leave a bright cross.
 if(uBvfxAtmoCloudCacheReady>.5)
  flare*=bvfxFlareTransmission(1.0-BVFX_SKY_TEXTURE(uBvfxAtmoRayImage,uBvfxAtmoSourceSample).a,uBvfxAtmoSunDir.y);
 return flare;
}
vec3 bvfxEnvironment(vec3 ray,float roughness){
 float h=clamp(ray.y,0.0,1.0),day=step(uBvfxAtmoStyle,2.5);
 float toward=pow(max(0.0,dot(ray,uBvfxAtmoSunDir)),6.0);
 float lowSun=1.0-smoothstep(.08,.55,uBvfxAtmoSunDir.y);
 float warmth=uBvfxAtmoArt.y*lowSun;
 vec3 zenith=mix(uBvfxAtmoSkyTint,uBvfxAtmoSkyTint*vec3(.56,.76,1.02),day*.60);
 vec3 horizon=mix(uBvfxAtmoSkyTint,vec3(.76,.84,.94),day*.72);
 horizon=mix(horizon,vec3(1.0,.64,.39),day*warmth*(.25+.65*toward));
 horizon=mix(horizon,uBvfxAtmoFogTint,uBvfxAtmoArt.x*.38);
 vec3 sky=mix(horizon,zenith,pow(h,.45+uBvfxAtmoArt.x*.35));
 sky*=uBvfxAtmoControls.x;
 // Authored angular size: a resolved sun with a wider warm low-sun profile.
 // Camera-derived antialiasing follows FOV/zoom and never changes disc size.
 float distance=length(ray-uBvfxAtmoSunDir),radius=uBvfxAtmoSunShape.x;
 float disc=bvfxSolarDisc(distance,radius,uBvfxAtmoSunShape.y);
 float halo=bvfxSolarHalo(distance,radius*(1.0+roughness*3.0),uBvfxAtmoControls.z);
 float limb=sqrt(max(0.0,1.0-pow(min(1.0,distance/radius),2.0)));
 // Wavelength-dependent extinction (Rayleigh + Mie) warms a low sun. Map
 // radiance smoothly instead of clipping an additive flat coloured circle.
 float airMass=1.0/max(.10,uBvfxAtmoSunDir.y+.10);
 vec3 extinction=exp(-vec3(.035,.075,.15)*airMass*(.35+warmth*.65));
 vec3 core=mix(vec3(1.0,.98,.95),extinction,day*.68);
 vec3 corona=mix(vec3(1.0,.95,.83),vec3(1.0,.63,.27),warmth*.75);
 vec3 radiance=(core*disc*(3.5+2.5*limb)+corona*halo*2.2)*uBvfxAtmoControls.y*step(uBvfxAtmoStyle,5.5);
 sky=vec3(1.0)-(vec3(1.0)-min(sky,vec3(.99)))*exp(-radiance);
 return max(vec3(0),sky);
}
vec3 bvfxLegacySky(vec3 nativeColour,vec3 ray){
 float horizon=1.0-smoothstep(-.015,.46,ray.y);
 vec3 sky=mix(nativeColour,nativeColour*uBvfxAtmoLegacyTint,.35+.22*horizon);
 float sunset=uBvfxAtmoArt.y*(1.0-smoothstep(.08,.55,uBvfxAtmoSunDir.y));
 vec3 hazeLight=mix(uBvfxAtmoFogTint,vec3(1.0,.78,.55),.45)*(.7+.3*uBvfxAtmoControls.x);
 sky=mix(sky,hazeLight,horizon*horizon*sunset*.55);
 float alignment=max(0.0,dot(ray,uBvfxAtmoSunDir));
 sky+=uBvfxAtmoLegacyTint*pow(alignment,75.0)*uBvfxAtmoControls.z*.04;
 sky+=vec3(1.0,.78,.56)*pow(alignment,1100.0)*uBvfxAtmoControls.z*.08;
 return sky;
}
vec3 bvfxNativeSky(vec3 ray){
 ray=bvfxViewRay(ray);
 vec2 q=vec2(sqrt(sqrt(clamp((1.0-dot(ray,uBvfxAtmoSunDir))*.5,0.0,1.0))),sqrt(clamp(dot(ray,uBvfxAtmoNativeUp),0.0,1.0)));
 vec3 sky=BVFX_SKY_TEXTURE(uBvfxAtmoSkyImage,(q*vec2(127,63)+.5)/vec2(128,64)).rgb;
 float distance=length(ray-uBvfxAtmoSunDir),radius=uBvfxAtmoSunShape.x;
 float disc=bvfxSolarDisc(distance,radius,uBvfxAtmoSunShape.y);
 float halo=bvfxSolarHalo(distance,radius,uBvfxAtmoControls.z);
 vec3 corona=mix(vec3(1.0,.94,.78),vec3(1.0,.65,.32),uBvfxAtmoArt.y*.70);
 vec3 radiance=(vec3(1.0,.96,.84)*disc*5.0+corona*halo*1.15)*uBvfxAtmoControls.y;
 return vec3(1.0)-(vec3(1.0)-sky)*exp(-radiance);
}
vec3 bvfxSkyColour(vec3 ray,vec3 physicalSky){
 ray=bvfxViewRay(ray);
 vec3 sky=physicalSky.r>=0.0?bvfxLegacySky(physicalSky,ray):bvfxEnvironment(ray,0.0);
 if(uBvfxAtmoCloudCacheReady>.5 && uBvfxAtmoClouds.x>0.0){
  vec2 uv=bvfxSkyUV();vec4 cloud=BVFX_SKY_TEXTURE(uBvfxAtmoCloudImage,uv);
  sky=sky*cloud.a+cloud.rgb;
  vec3 shafts=BVFX_SKY_TEXTURE(uBvfxAtmoRayImage,uv).rgb;
  float beam=min(.28,max(max(shafts.r,shafts.g),shafts.b)*uBvfxAtmoControls.y);
  sky=mix(sky,mix(vec3(1.0,.95,.82),vec3(1.0,.73,.42),uBvfxAtmoArt.y),beam);
 }else if(ray.y>.025 && uBvfxAtmoClouds.x>0.0 && uBvfxAtmoClouds.z>uBvfxAtmoCameraWorld.y){
  vec2 sampleCloud=bvfxCloudSample(bvfxCloudPoint(uBvfxAtmoCameraWorld,ray));
  float opacity=sampleCloud.x,field=sampleCloud.y;
  float horizonFade=smoothstep(.025,.18,ray.y);
  float forward=pow(max(0.0,dot(ray,uBvfxAtmoSunDir)),12.0);
  float silver=pow(1.0-opacity,2.0)*opacity*4.0*forward;
  vec3 shade=mix(uBvfxAtmoSkyTint,vec3(.40,.48,.60),.55)*.72;
  vec3 light=uBvfxAtmoCloudTint*(.90+.10*smoothstep(.05,.6,uBvfxAtmoSunDir.y));
  vec3 cloudColour=mix(light,shade,smoothstep(.35,.85,field)*.64);
  cloudColour+=uBvfxAtmoCloudTint*silver*.32*uBvfxAtmoControls.y;
  sky=mix(sky,cloudColour*uBvfxAtmoControls.x,opacity*horizonFade*.98);
 }
 if(uBvfxAtmoArt.z>0.0){float angle=dot(ray,-uBvfxAtmoSunDir);float band=exp(-pow((angle-.72)*90.0,2.0));sky+=band*uBvfxAtmoArt.z*(.5+.5*cos(vec3(0,2,4)+(angle-.72)*150.0));}
 if(uBvfxAtmoStyle>5.5){float band=exp(-pow(dot(ray,normalize(vec3(.4,.7,.3)))*8.0,2.0));sky+=uBvfxAtmoSkyTint*band*(.5+bvfxSkyNoise(ray.xz*35.0))*uBvfxAtmoStars;}
 if(uBvfxAtmoArt.w>.5 && uBvfxAtmoSunScreen.z>.5){
  sky=vec3(1.0)-(vec3(1.0)-sky)*exp(-bvfxSolarFlare(bvfxSkyUV()));
 }
 if(uBvfxAtmoStars>0.0 && ray.y>0.0){
  vec2 starUV=ray.xz/(1.0+ray.y)*420.0;vec2 cell=floor(starUV);
  float star=step(.9955,bvfxSkyHash(cell))*pow(max(0.0,1.0-length(fract(starUV)-.5)*2.0),8.0);
  sky+=star*uBvfxAtmoStars;
 }
 if(uBvfxAtmoStyle>5.5){
  float pixel=1.5/max(1.0,min(uBvfxAtmoScreen.x,uBvfxAtmoScreen.y));
  if(uBvfxAtmoStyle<6.5)sky=bvfxSpaceGalaxy(sky,ray,vec3(.92,.58,1),.09,-.45,vec3(.49,.55,.65),pixel);
  else if(uBvfxAtmoStyle<7.5)sky=bvfxSpaceHole(sky,ray,vec3(0,.68,1),.70,0.0,vec3(.94,.65,.37),pixel);
  else sky=bvfxSpaceGalaxy(sky,ray,vec3(.18,.72,1),.86,.57,vec3(.43,.59,.85),pixel);
  sky=bvfxSpacePlanet(sky,ray,vec3(.78,.22,1),.013,vec3(.50,.54,.61),1.0,pixel);
  sky=bvfxSpacePlanet(sky,ray,vec3(-.68,.28,1),.009,vec3(.43,.33,.24),0.0,pixel);
 }
 return clamp(sky,0.0,1.0);
}
vec3 bvfxSkyColour(vec3 ray){return bvfxSkyColour(ray,uBvfxAtmoNativeReady>.5?bvfxNativeSky(ray):vec3(-1.0));}
`;
    // World materials sample a retained world-space shadow tile. No 3D density
    // evaluation, exponentials, ray integration or solar optics per world pixel.
    const terrainCommon=`
uniform float uBvfxAtmoActive;
uniform vec3 uBvfxAtmoSunDir;
uniform vec3 uBvfxAtmoGroundTint;
uniform vec4 uBvfxAtmoControls;
uniform vec4 uBvfxAtmoClouds;
uniform vec3 uBvfxAtmoWorldOrigin;
uniform float uBvfxAtmoTime;
uniform float uBvfxAtmoCloudStyle;
${clouds?.groundModel||''}
`;
    const groundLighting=`
 if(uBvfxAtmoActive>.5){
  skyLightContrib*=uBvfxAtmoGroundTint;
  if(uBvfxAtmoControls.w>0.0){
   vec3 worldPosition=vPositionW+uBvfxAtmoWorldOrigin;
   float cloud=bvfxCloudGroundShadow(worldPosition,uBvfxAtmoSunDir);
   skyLightContrib*=1.0-cloud*uBvfxAtmoControls.w*.35;
  }
 }
`;
    function patchSky(source){
      if(typeof source!=='string'||source.includes('uBvfxAtmoActive')||!/(?:#define BVFX_SKYBOX|uniform\s+(?:highp\s+)?float\s+luminance\s*;)/.test(source)
          ||! /\b(?:in|varying)\s+(?:(?:lowp|mediump|highp)\s+)?vec3\s+vPositionW\b/.test(source))return source;
      const output=/\bgl_FragColor\b/.test(source)?'gl_FragColor':source.match(/\bout\s+(?:(?:lowp|mediump|highp)\s+)?vec4\s+(\w+)\s*;/)?.[1];
      // Native SkyMaterial uses cameraPosition; cubemap StandardMaterial uses
      // vEyePosition. Both are real source uniforms, never an inferred camera.
      const eye=/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?vec3\s+cameraPosition\s*;/.test(source)?'cameraPosition'
        :/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?vec[34]\s+vEyePosition\s*;/.test(source)?'vEyePosition.xyz':null;
      if(!output||!eye)return source;
      const nativeSource=source;
      // A sky mesh is beyond the terrain fog end. Applying native distance
      // fog here replaces the entire authored atmosphere with one flat colour.
      // Support source includes and the already-expanded native dialect.
      source=source.replace('#include<fogFragment>','\nif(uBvfxAtmoActive<.5){\n#include<fogFragment>\n}\n')
        .replace(/float fog=CalcFogFactor\(\);[\s\S]*?color\.rgb=mix\(vFogColor,color\.rgb,fog\);/,
          block=>'if(uBvfxAtmoActive<.5){\n'+block+'\n}');
      // Native mesh vertex colours can be a blue sky tint. Multiplying the
      // already composed sun/cloud lighting by that tint produces a cyan sun.
      source=source.replace(/retColor\.rgb\s*\*=\s*vColor\.rgb\s*;/g,block=>'if(uBvfxAtmoActive<.5){'+block+'}');
      // Replace the colour at the native output assignment. Keep clip planes,
      // logarithmic depth, fog and image-processing control flow intact. An
      // early return skipped those writes and could overwrite later sky draws.
      const main=/void\s+main\s*\(\s*(?:void)?\s*\)\s*\{/;
      const start=source.match(main);if(!start)return nativeSource;
      let end=start.index+start[0].length,depth=1;
      for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}
      if(depth)return nativeSource;
      const begin=start.index+start[0].length,body=source.slice(begin,end-1);
      // Source-backed SkyMaterial path: choose one sky computation and keep
      // the native output/depth processing shared. Computing both skies before
      // overwriting the colour would waste the native scattering calculation.
      const scattering=body.indexOf('float sunfade='),alpha=body.indexOf('float alpha=1.0;',scattering);
      if(scattering>=0&&alpha>scattering){
        const native=body.slice(scattering,alpha);
        const declarations=(native.match(/\bvec3\s+retColor\s*=/g)||[]).length;
        if(declarations>=1&&declarations<=2){
          // Restore native Rayleigh/Mie scattering and tone mapping as the
          // daylight basis. The old rewrite discarded it for a flat gradient.
          // Each path still computes one sky, sharing native depth/output code.
          let physical=native.replace(/\bvec3\s+retColor\s*=/g,'retColor=');
          physical=physical.replaceAll('normalize(sunPosition)','(uBvfxAtmoActive>.5?uBvfxAtmoSunDir:normalize(sunPosition))');
          for(const expression of ['normalize(vPositionW-cameraPosition+cameraOffset)','normalize(vPositionW-cameraPosition)'])physical=physical.replaceAll(expression,`(uBvfxAtmoActive>.5?bvfxViewRay(${expression}):${expression})`);
          physical=physical.replaceAll('sunAngularDiameterCos','(uBvfxAtmoActive>.5?1.0-.5*uBvfxAtmoSunShape.x*uBvfxAtmoSunShape.x:sunAngularDiameterCos)');
          const ray=`normalize(vPositionW-${eye})`;
          // An unavailable cache uses the bounded authored sky too. Never
          // reintroduce the native broad white lobe while custom sky is active.
          const choose=`vec3 retColor;\nif(uBvfxAtmoActive>.5 && uBvfxAtmoStyle<2.5 && uBvfxAtmoNativeReady>.5){retColor=bvfxSkyColour(${ray},bvfxNativeSky(${ray}));}else if(uBvfxAtmoActive>.5){retColor=bvfxSkyColour(${ray});}else{\n${physical}\n}\n`;
          return (source.slice(0,begin+scattering)+choose+source.slice(begin+alpha)).replace(main,common+'\n$&');
        }
      }
      const writes=[...body.matchAll(new RegExp('\\b'+output+'\\s*=\\s*[^;]+;','g'))];
      if(!writes.length)return nativeSource;
      const last=writes.at(-1),at=begin+last.index+last[0].length;
      const colour=`\nif(uBvfxAtmoActive>.5){${output}=vec4(bvfxSkyColour(normalize(vPositionW-${eye})),1.0);}\n`;
      return (source.slice(0,at)+colour+source.slice(at)).replace(main,common+'\n$&');
    }
    const names={active:'Active',skyTint:'SkyTint',legacyTint:'LegacyTint',sunDir:'SunDir',sunShape:'SunShape',cloudTint:'CloudTint',groundTint:'GroundTint',controls:'Controls',clouds:'Clouds',camera:'CameraWorld',origin:'WorldOrigin',time:'Time',stars:'Stars',art:'Art',cloudStyle:'CloudStyle',style:'Style',sunScreen:'SunScreen',screen:'Screen',rayReady:'RayReady',rayMatrix:'RayMatrix',fogTint:'FogTint',viewport:'Viewport',volume:'Volume',volumeReady:'VolumeReady',cloud:'CloudImage',rays:'RayImage',sourceSample:'SourceSample',cacheReady:'CloudCacheReady',groundImage:'GroundImage',groundFrame:'GroundFrame'};
    function locations(gl,program,get=gl.getUniformLocation){const loc={program};for(const [k,v]of Object.entries(names))loc[k]=get.call(gl,program,'uBvfxAtmo'+v);
      for(const [key,name]of [['skyImage','SkyImage'],['nativeReady','NativeReady'],['nativeUp','NativeUp']])loc[key]=get.call(gl,program,'uBvfxAtmo'+name);
      const native=['luminance','turbidity','rayleigh','mieCoefficient','mieDirectionalG','up'],active=new Set();
      if(get.call(gl,program,'luminance')!=null)for(let i=0,n=gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i<n;i++)active.add(gl.getActiveUniform(program,i)?.name);
      if(native.every(name=>active.has(name)))loc.nativeInputs=native.map(name=>({name,location:get.call(gl,program,name),method:name==='up'?'uniform3fv':'uniform1fv',revision:-1,value:null}));
      return loc;
    }
    function nativeInputs(gl,loc){
      if(!nativeObserved.has(gl)){nativeObserved.add(gl);gl.canvas?.addEventListener?.('webglcontextlost',()=>nativeFrames.delete(gl));}
      const previous=nativeFrames.get(gl)||null;
      if(!loc.nativeInputs)return previous;const tracker=root.__BVFX_GL_STATE__?.(gl),values=[];
      for(const entry of loc.nativeInputs){const watched=tracker?.watchUniform(entry.location);if(watched)watched.capture={method:entry.method,size:1};
        const revision=watched?.revision??0;
        if(watched?.valueRevision===revision&&watched.value!==undefined)entry.value=Array.from(watched.value);
        else if(!watched||entry.revision!==revision||entry.value===null){const value=gl.getUniform(loc.program,entry.location);entry.value=typeof value==='number'?[value]:value?Array.from(value):[];}
        entry.revision=revision;values.push(entry.value);
      }
      const parameters=values.slice(0,5).map(v=>v[0]),up=values[5];
      if(!parameters.every(Number.isFinite)||parameters[0]<=0||parameters[1]<0||parameters[2]<=0||parameters[3]<0||Math.abs(parameters[4])>=1||up?.length!==3||!up.every(Number.isFinite))return previous;
      const length=Math.hypot(...up);if(!(length>0))return previous;
      const frame={parameters,up:up.map(v=>v/length)};nativeFrames.set(gl,frame);return frame;
    }
    function bind(gl,loc,original=gl){
      if(loc?.active==null)return;
      const one=(k,v)=>{if(loc[k]!=null)original.uniform1f.call(gl,loc[k],v);};
      const three=(k,v)=>{if(loc[k]!=null)original.uniform3f.call(gl,loc[k],...v);};
      const four=(k,v)=>{if(loc[k]!=null)original.uniform4f.call(gl,loc[k],...v);};
      one('active',settings.enabled&&settings.atmosphereEnabled?1:0);
      const rayReady=Boolean(rayMatrix&&loc.rayMatrix!=null&&typeof original.uniformMatrix4fv==='function');
      if(rayReady)original.uniformMatrix4fv.call(gl,loc.rayMatrix,false,rayMatrix);
      // Publish readiness only after a real matrix upload. Missing optional
      // methods retain the geometry ray and still upload every sky colour.
      one('rayReady',rayReady?1:0);
      const style=palette(),moonlit=style.index===3||style.space;
      const physical=style.index<3?nativeInputs(gl,loc):null;three('nativeUp',physical?.up||[0,1,0]);
      const sun=bodyDirection();
      const width=gl.drawingBufferWidth||1,height=gl.drawingBufferHeight||1;
      const projected=projectSolar(sun,width,height),day=!moonlit&&settings.dayNightFrame?.phase!=='night';
      const visible=projected.onScreen&&sun[1]>0&&day&&settings.sunLensFlare&&settings.sunBrightness>0;
      const screen=[projected.screen[0],projected.screen[1],visible?1:0];
      // Modest resolved solar disc; keep the compact aureole independent.
      const radius=moonlit?.0093:.030;
      if(loc.sunShape!=null)original.uniform2f.call(gl,loc.sunShape,radius,Math.max(.000001,Math.min(radius*.15,projected.pixel*.75)));
      const skyTint=settings.skyColorCustom&&/^#[a-f0-9]{6}$/i.test(settings.skyColor)?[1,3,5].map(i=>parseInt(settings.skyColor.slice(i,i+2),16)/255):style.sky;
      three('sunDir',sun);three('skyTint',skyTint);
      three('legacyTint',settings.skyColorCustom?skyTint:({0:[.78,.89,1],1:[1,.74,.55],2:[.92,.77,1]})[style.index]||skyTint);
      three('cloudTint',style.cloud);three('groundTint',style.ground);three('camera',camera);three('origin',origin);
      const fog=fogFrame||style.sky;
      three('fogTint',fog);four('viewport',[0,0,width,height]);
      if(loc.volumeReady!=null&&loc.lastVolumeReady===undefined)one('volumeReady',0);
      four('controls',[.4+settings.skyBrightness*1.1,settings.sunBrightness,settings.sunGlow,settings.cloudType==='none'||style.space?0:settings.cloudShadow]);
      four('clouds',[settings.cloudType==='none'||style.space?0:settings.cloudCover,settings.cloudScale,settings.cloudHeight+(cloudOffset||0),settings.cloudSpeed]);
      four('art',[settings.skyHaze||0,settings.sunWarmth||0,settings.rainbowStrength||0,settings.sunLensFlare?1:0]);
      one('cloudStyle',({current:0,vanilla:1,amethyst:2,bliss:3})[settings.cloudType]||0);one('style',style.index);three('sunScreen',screen);
      if(loc.screen!=null)original.uniform2f.call(gl,loc.screen,width,height);
      one('time',performance.now()*.001);one('stars',style.index>=3&&style.index!==4&&style.index!==5?settings.starBrightness:0);
      clouds?.setFrame({enabled:settings.enabled&&settings.atmosphereEnabled&&!style.space,matrix:rayMatrix?Array.from(rayMatrix):null,camera:Array.from(camera),sun:Array.from(sun),skyTint,cloudTint:style.cloud,fogTint:fog,
        lightTint:[1,.96-(settings.sunWarmth||0)*.18,.87-(settings.sunWarmth||0)*.34],clouds:[settings.cloudType==='none'?0:settings.cloudCover,settings.cloudScale,settings.cloudHeight+(cloudOffset||0),settings.cloudSpeed],
        controls:[.4+settings.skyBrightness*1.1,settings.sunGlow,settings.fogDensity||0,day?1:0],nativeParams:physical?.parameters||null,nativeUp:physical?.up||[0,1,0],groundStrength:settings.cloudShadow,style:({current:0,vanilla:1,amethyst:2,bliss:3})[settings.cloudType]||0,sunScreen:[projected.screen[0],projected.screen[1],projected.onScreen&&day&&sun[1]>0?1:0],sunRadius:projected.angular.map(angle=>radius/Math.max(.000001,angle)),time:performance.now()*.001});
      clouds?.publish?.(gl,loc,original);
    }
    return {palette,common,groundLighting,terrainCommon,patchSky,locations,bind,sunDirection:()=>settings.enabled&&settings.atmosphereEnabled?bodyDirection():null,
      surfaceLighting:()=>'',bindVolume:(...args)=>clouds?.bind(...args),setViewProjection,setFog(r,g,b){if([r,g,b].every(Number.isFinite))fogFrame=[r,g,b];},setWorldFrame(x,y,z,cx,cy,cz){origin=[x,y,z];camera=[cx,cy,cz];if(cloudOffset===null)cloudOffset=Math.max(0,Math.ceil(cy+64-settings.cloudHeight));},setWaterFrame(){},setSunScreen(x,y,z){sunScreen=Number.isFinite(x)&&Number.isFinite(y)?[x,y,z&&x>0&&x<1&&y>0&&y<1?1:0]:[.5,.5,0];},dispose(){clouds?.dispose();fogFrame=null;cloudOffset=null;rayMatrix=null;clipMatrix=null;solarCache=null;nativeFrames=new WeakMap();sunScreen=[.5,.5,0];},
      drawSky(gl,loc,draw,args){const start=loc?.cacheReady!=null?performance.now():null;try{clouds?.draw(gl,loc);const restore=clouds?.bind(gl,loc,root.__BVFX_GL_STATE__?.(gl)?.currentProgram||gl.getParameter(gl.CURRENT_PROGRAM));try{return draw.apply(gl,args);}finally{restore?.();}}finally{if(start!==null)root.__BVFX_FRAME_BUDGET__?.recordCpu('sky',performance.now()-start);}},
      skyDiagnostics:()=>({...clouds?.diagnostics(),implementation:'controlled-solar-sky-v9',cameraRays:!!rayMatrix}),cloudRenderer:clouds};
  };
})();
