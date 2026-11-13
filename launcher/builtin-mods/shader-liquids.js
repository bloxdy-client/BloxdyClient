// Shared bounded wave kernel for both stages. All animated coordinates stay local.
(() => {
 'use strict';const root=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
 const wave=`
highp vec3 bvfxWaterSpectrum(highp vec2 p,highp float t,highp vec3 c){
 float f=c.y*1.4;vec2 d=vec2(cos(c.z),sin(c.z)),e=vec2(-d.y,d.x);
 float a=dot(p,d)*f-t*.85,b=dot(p,e)*f*1.73+t*.62;
 return vec3((sin(a)*.68+sin(b)*.32)*c.x,(cos(a)*d*.68+cos(b)*e*.5536)*c.x*f);
}
highp vec3 bvfxLiquidImpacts(highp vec2 p,highp float t,highp float kind){
 vec3 result=vec3(0);
 for(int i=0;i<8;i++){if(float(i)>=uBvfxWaterRippleCount)break;vec4 r=uBvfxWaterRipples[i];
  if((kind>1.5)!=(r.w<0.0))continue;float age=t-r.z;if(age<0.0||age>3.4)continue;
  vec2 delta=p-r.xy;float d=length(delta),q=d-age*2.0;
  float env=exp(-q*q*3.0)*abs(r.w)*(1.0-smoothstep(1.8,3.4,age))*.12;
  result+=vec3(sin(q*4.0)*env,delta/max(d,.001)*(4.0*cos(q*4.0)-6.0*q*sin(q*4.0))*env);
 }return result;
}
highp vec3 bvfxLiquidSurfacePosition(highp vec3 rest,highp vec3 displaced,highp vec3 eye,highp vec3 normal){return rest;}
`;
 const controls=`
uniform highp vec3 uBvfxWaveSettings;
uniform highp vec3 uBvfxLavaWaveSettings;
uniform highp vec3 uBvfxLavaWavePhase;
uniform highp vec3 uBvfxLavaTextureOrigin;
uniform highp float uBvfxWaterPhysics;
uniform highp float uBvfxLavaPhysics;
uniform highp float uBvfxWaterPhysicsTime;
uniform highp float uBvfxWaterRippleCount;
uniform highp vec4 uBvfxWaterRipples[8];
`;
 const vertexUniforms=`uniform highp float uBvfxWaterMode;uniform highp float uBvfxWaterTime;
uniform highp float uBvfxLavaMode;uniform highp float uBvfxLavaTime;uniform highp vec2 uBvfxWaterOrigin;
${controls}${wave}
float bvfxVertexWaterHeight(vec2 p,float t){vec3 w=bvfxWaterSpectrum(p,t,uBvfxWaveSettings);if(uBvfxWaterPhysics>.5)w+=bvfxLiquidImpacts(p,uBvfxWaterPhysicsTime,1.0);return w.x;}
float bvfxVertexLavaHeight(vec2 p,float t){vec3 w=bvfxWaterSpectrum(p,t*.35,uBvfxLavaWaveSettings);if(uBvfxLavaPhysics>.5)w+=bvfxLiquidImpacts(p+uBvfxWaterOrigin,uBvfxWaterPhysicsTime,2.0);return w.x;}
`;
 function lavaFragment({output,normal,nativeTexture=false}){return `
 if(uBvfxLavaMode>.5 && abs(vBvfxLiquidKind-2.0)<.5 && uBvfxLavaNativeTexture${nativeTexture?'>':'<'} .5){
 ${nativeTexture?'':`vec3 p=vBvfxLiquidRestPosition+uBvfxLavaTextureOrigin;
 float t=uBvfxLavaMode>1.5?uBvfxLavaTime*.12:0.0;
 float field=sin(p.x*1.3+sin(p.z*1.1+t))*sin(p.z*1.5-p.y*.8-t);
 float hot=1.0-smoothstep(.05,.6,abs(field));
 ${output}.rgb=mix(vec3(.12,.018,.006),vec3(1,.38,.035),hot);
 ${output}.rgb+=vec3(.35,.15,.025)*hot*uBvfxLavaGlow;`}
 ${output}.a=uBvfxLavaOpacity;
 if(uBvfxLavaOpaquePass>.5 && uBvfxLavaOpacity<1.0){
  vec2 p=mod(floor(gl_FragCoord.xy),4.0),lo=mod(p,2.0),hi=floor(p/2.0);
  float threshold=(4.0*(2.0*lo.x+3.0*lo.y-4.0*lo.x*lo.y)+2.0*hi.x+3.0*hi.y-4.0*hi.x*hi.y+.5)/16.0;
  if(uBvfxLavaOpacity<threshold)discard;${output}.a=1.0;
 }
 ${nativeTexture?'':`#ifdef FOG
 ${output}.rgb=mix(vFogColor,${output}.rgb,CalcFogFactor());
 #endif
 return;`}
 }`;}
 function fragment({output,normal}){return `
 if(uBvfxWaterMode>.5 && abs(vBvfxLiquidKind-1.0)<.5){
  vec3 n=${normal};float top=step(.9,abs(n.y));vec2 p=vBvfxLiquidRestPosition.xz+uBvfxWaterOrigin;
  vec3 wave=vec3(0);if(uBvfxWaterMode>1.5){wave=bvfxWaterSpectrum(p,uBvfxWaterTime,uBvfxWaveSettings);if(uBvfxWaterPhysics>.5)wave+=bvfxLiquidImpacts(p,uBvfxWaterPhysicsTime,1.0);}
  n=normalize(n-vec3(wave.y,0,wave.z)*top*clamp(vBvfxWaterEdge,0.0,1.0));
  vec3 v=normalize(vEyePosition.xyz-vPositionW);vec3 r=reflect(-v,n);
  float f=.02+.98*pow(1.0-max(dot(n,v),0.0),5.0);
  float exposure=clamp(dot(uSkyLightColour,vec3(.2126,.7152,.0722)),.02,1.0);
  // BVFX liquid sunlight
  ${output}.rgb=uBvfxWaterColor*(.55+.45*exposure);
  ${output}.rgb+=uBvfxWaterColor*uBvfxWaterGlow*.3;
  ${output}.a=clamp(uBvfxWaterOpacity,0.0,1.0);
  #ifdef FOG
  ${output}.rgb=mix(vFogColor,${output}.rgb,CalcFogFactor());
  #endif
 }
 ${lavaFragment({output,normal,nativeTexture:true})}`;}
 root.__BVFX_LIQUID_SHADER__={uniforms:controls+wave,vertexUniforms,fragment,lavaFragment};
})();
