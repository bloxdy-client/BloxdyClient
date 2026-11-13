'use strict';
// Same custom-fog controls as updateAtmosphere; original view values remain
// the source for the native-colour component. Off returns no override.
function nativeFogFrame(view,settings,palette){
 if(!settings.enabled||!settings.atmosphereEnabled)return null;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v))),density=clamp(settings.fogDensity,0,1),distance=clamp(settings.fogDistance,24,256),warmth=clamp(settings.fogWarmth,0,1),mix=clamp(settings.fogColorMix,0,1);
 if(![density,distance,warmth,mix].every(Number.isFinite)||view.fogColour?.length!==3)return null;
 const hex=/^#[0-9a-f]{6}$/i.test(settings.fogColor)?settings.fogColor:'#94a8c0',custom=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),warm=[.9,.54,.32];
 const fogColour=Array.from(view.fogColour,(base,i)=>clamp(((palette?.sky?palette.sky[i]*.82+base*.18:base)*(1-warmth)+warm[i]*warmth)*(1-mix)+custom[i]*mix,0,1));
 const result={fogEnabled:density>0,fogMode:density>0?3:view.fogMode,fogStart:distance*(.52-.42*density),fogEnd:distance*(1.45-.25*density),fogColour};
 // Native view light ABI: 11 numbers (kind, vector[3], diffuse[3],
 // specular[3], range). Mirror Light edits alone do not reach this array.
 if(view.lights?.length===88&&Number.isInteger(view.lightCount)&&view.lightCount<=8&&Number.isFinite(settings.sunBrightness)&&Number.isFinite(settings.sunWarmth)){
  const lights=view.lights.slice(),moonlit=settings.skyStyle==='moonlit'||palette?.space,scale=moonlit?.12:.25+1.5*settings.sunBrightness;
  const tint=moonlit?[.46,.67,1]:[1,1-.25*settings.sunWarmth,1-.55*settings.sunWarmth];
  for(let i=0;i<view.lightCount;i++){const at=i*11;if(lights[at]!==1)continue;for(let c=0;c<3;c++){lights[at+4+c]*=scale*tint[c];lights[at+7+c]*=scale;}}
  result.lights=lights;
 }
 return result;
}
module.exports={nativeFogFrame};
