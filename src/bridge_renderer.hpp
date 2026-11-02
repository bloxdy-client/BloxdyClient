#pragma once
#include "bridge_protocol.hpp"
#include <glm/gtc/type_ptr.hpp>
#include <unordered_map>
#include <limits>
#include "bridge_pipeline.hpp"
#include "bridge_scene.hpp"
#include "bridge_frames.hpp"
#include "bridge_material.hpp"
#include "bridge_appearance.hpp"
#include "bridge_iris.hpp"
#include "bridge_sampling.hpp"
#include "bridge_camera.hpp"
#include "bridge_draw.hpp"
#include "bridge_particles.hpp"
#include "bridge_motion.hpp"
#include "bridge_postprocess.hpp"
#include "bridge_render_graph.hpp"
#include "bridge_geometry_binding.hpp"
#include "bridge_source_frame.hpp"
#include "bridge_gpu_particles.hpp"
#include "bridge_source_emission.hpp"

namespace bridge {
inline constexpr const char* vertexSource=R"GLSL(#version 430 core
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec2 uv;
layout(location=3) in vec4 tint;
layout(location=4) in float atlasLayer;
layout(location=5) in float packedLight;
layout(location=6) in mat4 instanceMatrix;
layout(location=10) in vec2 instanceExtras;
layout(location=11) in vec2 blockData;
layout(location=12) in vec4 at_tangent;
layout(location=13) in vec2 mc_midTexCoord;
layout(location=14) in vec4 at_midBlock;
layout(location=15) in ivec2 vaUV2;
uniform mat4 world,view,projection,shadowViewProjection,textureMatrix,inverseView;
uniform mat4 motionPreviousWorld,motionPreviousViewProjection;
uniform int motionValid,motionPosed;
layout(std430,binding=4) readonly buffer PreviousPose {vec4 motionPositions[];};
uniform int halfZ,instanced,renderShadow;
struct Appearance {vec4 atlas1;vec4 atlas2;vec4 overlay;vec4 light;vec4 extras;vec4 hue;vec4 enchant;vec4 node;vec4 offset;};
layout(std430,binding=7) readonly buffer AppearanceRecords {Appearance appearances[];};
layout(std430,binding=6) readonly buffer AtlasAnimationRecords {vec4 atlasAnimation[];};
uniform int atlasAnimationCount;uniform float atlasAnimationTick,atlasAnimationStride;
uniform int appearanceFlags,vertexAppearance,instanceAppearance,instanceAppearanceOffset;
uniform int particleMode;uniform vec3 cameraPosition;
uniform vec4 sourceSpecial;
uniform ivec2 lifeformGrid;
uniform vec3 sourceAmbient,sourceSky;uniform vec4 sourceDirLights[4];uniform int sourceDirections;
out vec2 vUV;
out vec4 vTint;
out vec3 vNormal;
out vec4 vLight;
out vec4 vRawLight;
out vec3 vWorldPosition;
flat out float vLayer;
flat out vec2 vBlockData;
out vec4 vOverlay;out float vOpacity;flat out vec4 vAtlas1;flat out vec4 vAtlas2;
out vec3 vSourceLighting;out float vLambert;out vec4 vHue;out vec4 vEnchant;out vec4 vEnchantPosition;
out vec4 vParticleRemap;
out vec4 vMotionCurrent,vMotionPrevious;flat out int vMotionValid;
vec4 lightCurve(vec4 levels){vec4 base=levels/(3.0-2.0*levels);vec4 dark=1.0-base;return 1.0-dark*dark*dark;}
vec3 particleUnit(vec3 v){return v*inversesqrt(max(dot(v,v),1e-20));}
void main(){
    Appearance a=Appearance(vec4(0),vec4(0),vec4(0),vec4(-1),vec4(1,0,0,0),vec4(0),vec4(0),vec4(0),vec4(0));
    if(vertexAppearance!=0)a=appearances[gl_VertexID];
    if(instanced!=0&&instanceAppearance!=0)a=appearances[instanceAppearanceOffset+gl_InstanceID];
    mat4 transform=instanced!=0?world*instanceMatrix:world;
    vec4 point=transform*vec4(position,1.0),viewPoint=view*point;
    if((appearanceFlags&16384)!=0){vec3 local=mat3(instanceMatrix)*(vec3(position.xy*a.enchant.w,0)-vec3(sourceSpecial.zw,0));local.xy+=sourceSpecial.zw;
        vec4 center=world*vec4(instanceMatrix[3].xyz,1);
        if(particleMode==0){viewPoint=view*center+vec4(local,0);point=inverseView*viewPoint;}
        else {vec3 aligned;
            if(particleMode==1||particleMode==4){vec3 axis=particleMode==1?center.xyz-cameraPosition:a.enchant.xyz;if(particleMode==1)axis.y=0;axis=particleUnit(axis);
                vec3 x=particleUnit(cross(vec3(0,1,0),axis)),z=particleUnit(cross(axis,x));aligned=mat3(x,axis,z)*vec3(local.x,0,local.y);}
            else {vec3 axis=particleUnit(center.xyz-cameraPosition),direction=particleUnit(a.enchant.xyz),x=particleUnit(cross(direction,axis));
                vec3 y=particleMode==3?direction:particleUnit(cross(axis,x));aligned=mat3(x,y,axis)*local;}
            point=vec4(center.xyz+aligned,1);viewPoint=view*point;
        }}
    vec4 clip=renderShadow!=0?shadowViewProjection*point:projection*viewPoint;
    if(halfZ!=0&&renderShadow==0)clip.z=clip.z*2.0-clip.w;
    gl_Position=clip;
    vMotionCurrent=clip;vMotionPrevious=clip;vMotionValid=motionValid;
    if(motionValid!=0){vec4 oldPosition=motionPosed!=0?motionPositions[gl_VertexID]:vec4(position,1);if(instanced!=0)oldPosition=instanceMatrix*oldPosition;vMotionPrevious=motionPreviousViewProjection*motionPreviousWorld*oldPosition;}
    vUV=(textureMatrix*vec4(uv,1.0,0.0)).xy;vTint=tint;vLayer=instanced!=0&&instanceExtras.x>=0.0?instanceExtras.x:atlasLayer;
    vWorldPosition=point.xyz;
    vBlockData=blockData;
    mat3 basis=mat3(transform);
    vec3 transformed=abs(determinant(basis))>0.000001?transpose(inverse(basis))*normal:normal;
    vNormal=length(transformed)>0.000001?normalize(transformed):vec3(0.0,1.0,0.0);
    float light=instanced!=0&&instanceExtras.y>=0.0?instanceExtras.y:packedLight;
    vLight=vec4(mod(light,16.0),mod(floor(light/16.0),16.0),mod(floor(light/256.0),16.0),floor(light/4096.0))/15.0;
    if((appearanceFlags&16384)!=0)vUV=a.hue.xy+uv*a.hue.zw;
    if((appearanceFlags&256)!=0){vUV=vec2((uv.x+a.atlas1.x)/float(lifeformGrid.x),uv.y);vTint.rgb=a.extras.yzw;}
    if((appearanceFlags&1024)!=0){int face=int(round(atlasLayer));vLayer=face<4?a.atlas1[clamp(face,0,3)]:a.atlas2[clamp(face-4,0,1)];}
    if(atlasAnimationCount>0){vec3 data=atlasAnimation[min(atlasAnimationCount-1,int(max(0.0,floor(vLayer))))].xyz;
        float state=mod(floor((atlasAnimationStride/max(atlasAnimationStride,data.z))*atlasAnimationTick),data.x+1.0);
        if(state>=1.0)vLayer=data.y+state-1.0;}
    vHue=a.hue;
    vParticleRemap=a.node;
    bool node=(appearanceFlags&8192)!=0;vEnchant=vec4(a.enchant.rgb,node?a.node.w:0.0);
    vEnchantPosition=vec4(node?point.xyz-a.node.xyz+a.offset.xyz:position/3.0,sourceSpecial.x*a.enchant.w*(node?1.2:.9));
    if((appearanceFlags&16384)!=0)vTint*=a.overlay;
    vOverlay=a.overlay;vOpacity=a.extras.x;vAtlas1=a.atlas1;vAtlas2=a.atlas2;
    if((appearanceFlags&16)!=0&&a.light.w>=0.0)vLight=a.light;
    vRawLight=vLight;
    vec4 levels=vLight;
    if((appearanceFlags&48)!=0)levels.rgb=max(levels.rgb,vec3(max(max(levels.r,levels.g),levels.b)*0.35));
    if((appearanceFlags&32)!=0)vLight=levels;
    levels=lightCurve(levels);vSourceLighting=max(sourceAmbient+levels.rgb*(1.0-sourceAmbient),mix(sourceAmbient,sourceSky,levels.w));
    vLambert=0.0;for(int i=0;i<sourceDirections;++i)vLambert+=max(0.0,dot(vNormal,sourceDirLights[i].xyz))*sourceDirLights[i].w;
}
)GLSL";
inline constexpr const char* fragmentSource=R"GLSL(#version 430 core
in vec2 vUV;in vec4 vTint;in vec3 vNormal;in vec4 vLight;in vec3 vWorldPosition;flat in float vLayer;
in vec4 vRawLight;
flat in vec2 vBlockData;
uniform sampler2D plainTexture;uniform sampler2DArray arrayTexture;
uniform samplerCube skyCube;uniform sampler2D shadowDepth;uniform sampler2D blockAtlas;
uniform sampler2D layerReadiness;uniform int textureLayers;
uniform ivec2 atlasGrid,atlasTile;
uniform int textureKind;uniform int hasLight;uniform int unlit;
uniform float alphaCutoff;uniform vec3 emission;
uniform int textureAlpha,twoSidedLighting,materialFog,premultipliedOutput;uniform float textureLevel;uniform vec4 sourceSpecial;
uniform vec4 particleMask;uniform sampler2D particleRamp;uniform int particleRampEnabled,particleMultiply;
uniform int appearanceFlags,lifeformLayers;uniform ivec2 lifeformGrid;
uniform float sourceVisibility,sourceFadeAlpha;
uniform vec3 sourceAmbient,sourceSky;uniform vec4 sourceHeldColor,sourceHeldPosition;
in vec4 vOverlay;in float vOpacity;flat in vec4 vAtlas1;flat in vec4 vAtlas2;in vec3 vSourceLighting;in float vLambert;in vec4 vHue;in vec4 vEnchant;in vec4 vEnchantPosition;
in vec4 vParticleRemap;
in vec4 vMotionCurrent,vMotionPrevious;flat in int vMotionValid;
uniform int renderShadow,shadowEnabled,fogMode;
uniform mat4 shadowViewProjection;
uniform vec3 cameraPosition,sunDirection,sunColor,fogColor;
uniform float fogStart,fogEnd,fogDensity;
layout(location=0) out vec4 color;
layout(location=1) out vec4 surfaceAlbedo;
layout(location=2) out vec4 surfaceNormal;
layout(location=3) out vec4 surfaceLight;
layout(location=4) out vec4 surfaceMaterial;
layout(location=5) out vec4 surfaceMotion;
vec4 backwardMotion(){
    if(vMotionValid==0||vMotionCurrent.w<=1e-8||vMotionPrevious.w<=1e-8)return vec4(0);
    vec3 current=vMotionCurrent.xyz/vMotionCurrent.w,previous=vMotionPrevious.xyz/vMotionPrevious.w;
    if(any(isnan(current))||any(isinf(current))||any(isnan(previous))||any(isinf(previous)))return vec4(0);
    if(any(lessThan(previous,vec3(-1)))||any(greaterThan(previous,vec3(1))))return vec4(0);
    return vec4((previous.xy-current.xy)*.5,previous.z*.5+.5,1);
}
float shadowVisibility(vec3 n){
    if(shadowEnabled==0)return 1.0;
    vec4 projected=shadowViewProjection*vec4(vWorldPosition+n*0.012,1.0);
    vec3 coord=projected.xyz/projected.w*0.5+0.5;
    if(any(lessThan(coord,vec3(0.0)))||any(greaterThan(coord,vec3(1.0))))return 1.0;
    float visible=0.0;vec2 pixel=1.0/vec2(textureSize(shadowDepth,0));
    float bias=max(0.000025,0.0002*(1.0-max(dot(n,sunDirection),0.0)));
    for(int y=-1;y<=1;++y)for(int x=-1;x<=1;++x)visible+=coord.z-bias<=texture(shadowDepth,coord.xy+vec2(x,y)*pixel).r?1.0:0.0;
    return visible/9.0;
}
float bayerDither(vec2 pixel){const int values[16]=int[16](1,9,3,11,13,5,15,7,4,12,2,10,16,8,14,6);ivec2 p=ivec2(mod(floor(pixel),4.0));return float(values[p.y*4+p.x])/16.0;}
vec4 lightCurve(vec4 levels){vec4 dark=1.0-levels/(3.0-2.0*levels);return 1.0-dark*dark*dark;}
vec3 hueRgb2hsv(vec3 c){vec4 K=vec4(0,-1.0/3.0,2.0/3.0,-1);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.0*d+1e-10)),d/(q.x+1e-10),q.x);}
vec3 hueHsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(1,2.0/3.0,1.0/3.0))*6.0-3.0);return c.z*mix(vec3(1),clamp(p-1.0,0.0,1.0),c.y);}
vec3 hueTint(vec3 base,vec4 hue){
    if(hue.a<=.5)return base;vec3 overlay=hueRgb2hsv(hue.rgb);float grey=hueRgb2hsv(base).z;
    if(grey<=.01||grey>=.99)return base;float t=grey-.5,abst=abs(t),delta=(t>0.0?.125:.625)-overlay.x;
    delta-=floor(delta+.5);float h=fract(overlay.x+delta*abst*.5*sin(3.14159265*abs(delta)*2.0)),s=t>0.0?-1.0:1.0;
    return hueHsv2rgb(vec3(h,overlay.y+s*.5*abst,overlay.z-s*.5*abst));
}
float enchantmentNoise(vec3 source){
    vec3 P=source;if(all(equal(P,vec3(0))))P.x=.00001;P*=.7071067811865475244;
    vec3 Pi=floor(P+dot(P,vec3(1.0/3.0))),x0=P-Pi+dot(Pi,vec3(1.0/6.0));
    vec3 g=step(x0.yzx,x0.xyz),notG=1.0-g,Pi1=min(g.xyz,notG.zxy),Pi2=max(g.xyz,notG.zxy);
    vec3 x1=x0-Pi1+1.0/6.0,x2=x0-Pi2+1.0/3.0,x3=x0-.5;
    vec4 vx=vec4(x0.x,x1.x,x2.x,x3.x),vy=vec4(x0.y,x1.y,x2.y,x3.y),vz=vec4(x0.z,x1.z,x2.z,x3.z);
    Pi=Pi-floor(Pi*(1.0/69.0))*69.0;vec3 inc=step(Pi,vec3(69.0-1.5))*(Pi+1.0);
    vec4 Pt=vec4(Pi.xy,inc.xy)+vec2(50,161).xyxy;Pt*=Pt;
    vec4 xy=mix(Pt.xyxy,Pt.zwzw,vec4(Pi1.xy,Pi2.xy));Pt=vec4(Pt.x,xy.xz,Pt.z)*vec4(Pt.y,xy.yw,Pt.w);
    vec3 large=vec3(635.298681,682.357502,668.926525),zinc=vec3(48.500388,65.294118,63.934599);
    vec3 low=1.0/(large+Pi.zzz*zinc),high=1.0/(large+inc.zzz*zinc);Pi1=Pi1.z<.5?low:high;Pi2=Pi2.z<.5?low:high;
    vec4 h0=fract(Pt*vec4(low.x,Pi1.x,Pi2.x,high.x))-.49999;
    vec4 h1=fract(Pt*vec4(low.y,Pi1.y,Pi2.y,high.y))-.49999;
    vec4 h2=fract(Pt*vec4(low.z,Pi1.z,Pi2.z,high.z))-.49999;
    vec4 grads=inversesqrt(h0*h0+h1*h1+h2*h2)*(h0*vx+h1*vy+h2*vz),kernel=max(.5-(vx*vx+vy*vy+vz*vz),vec4(0));
    return dot(kernel*kernel*kernel,grads)*37.8372272416113141;
}
float enchantmentLine(vec3 localPos,float tick,float tilt){
    const float golden=1.6180339887498948;float plane=tick*golden+localPos.y*2.25;
    float intersection=dot(localPos*vec3(tilt,1,tilt),normalize(vec3(sin(plane)*.5,1,cos(plane)*.5)));
    float saw=mod(intersection-fract(tick),1.0),noise=(enchantmentNoise(localPos*4.0-vec3(0,tick*golden*golden,0))+1.0)/2.0;
    saw=clamp(saw+noise*.2,0.0,1.0);float truncated=max(saw/.35-1.0/.35+1.0,0.0);
    return 6.75*truncated*truncated*(1.0-truncated);
}
vec3 enchantmentColor(vec3 color,vec3 base,vec4 enchant,vec4 pos){
    if(!any(greaterThan(enchant.rgb,vec3(0))))return color;
    float c=cos(enchant.w),s=sin(enchant.w);vec3 localPos=mat3(-c,0,-s,0,1,0,s,0,-c)*pos.xyz;float tick=pos.w/1000.0;
    const float golden=1.6180339887498948;float weight=enchantmentLine(localPos,tick,1.1)*.77+enchantmentLine(localPos/golden,tick/golden,2.4)*.42;
    float offset=.15,shift=-log2(offset);weight=(log2(weight+offset)+shift)/(log2(.75*4.0+offset)+shift);
    vec3 hsv=hueRgb2hsv(enchant.rgb),difference=hsv-hueRgb2hsv(base);float distance=length(difference);
    if(distance<.18)hsv.x=mod(hsv.x+sign(difference.x)*(.18-distance),1.0);
    return mix(color,hueHsv2rgb(hsv),weight);
}
vec3 heldLighting(){
    float maximum=max(sourceHeldColor.r,max(sourceHeldColor.g,sourceHeldColor.b));if(maximum<=0.0)return vec3(0);
    float distanceToLight,rangeFactor=1.0;
    if(sourceHeldPosition.w>0.0){vec3 delta=vWorldPosition-cameraPosition;distanceToLight=length(delta);
        if(distanceToLight>.001){float axis=dot(delta/distanceToLight,sourceHeldPosition.xyz);float t=clamp((1.0-axis)/max(1.0-sourceHeldPosition.w,1e-6),0.0,1.0);rangeFactor=1.0-.5*(smoothstep(.12,.65,t)+smoothstep(.62,.95,t));}distanceToLight=pow(distanceToLight,.75);}
    else distanceToLight=distance(vWorldPosition,sourceHeldPosition.xyz);
    float range=(sourceHeldColor.w>0.0?sourceHeldColor.w:maximum)*rangeFactor;if(distanceToLight>=range)return vec3(0);
    vec3 channels;float maxLight;if(sourceHeldColor.w>0.0){float atten=(range-distanceToLight)/range;channels=sourceHeldColor.rgb*atten;maxLight=maximum*atten;}else{channels=sourceHeldColor.rgb-distanceToLight;maxLight=maximum-distanceToLight;}
    vec3 levels=max(channels,vec3(maxLight*.35))/15.0;return sourceAmbient+lightCurve(vec4(levels,0)).rgb*(1.0-sourceAmbient);
}
void main(){
    surfaceMotion=backwardMotion();
    vec4 texel=vec4(1.0);
    if(textureKind==1){texel=texture(plainTexture,vUV,(appearanceFlags&4096)!=0?sourceSpecial.y:0.0);if((appearanceFlags&4096)!=0)texel.rgb=clamp(texel.rgb/max(texel.a,1.0/255.0),0.0,1.0);}
    if(textureKind==2){int layer=int(round(vLayer));
        if(layer>=0&&layer<textureLayers&&texelFetch(layerReadiness,ivec2(layer,0),0).r>0.5){
            texel=texture(arrayTexture,vec3(vUV,float(layer)));
        }
        else texel=vec4(0.65,0.65,0.65,1.0);
    }
    if(textureKind==3){vec3 direction=vWorldPosition-cameraPosition;texel=texture(skyCube,length(direction)>0.000001?normalize(direction):vec3(0.0,1.0,0.0));}
    float particleSourceAlpha=texel.a*vTint.a;
    if((appearanceFlags&16384)!=0)texel=texel*particleMask+(vec4(1)-particleMask);
    if((appearanceFlags&1)!=0){vec4 outCol=vec4(0);for(int i=lifeformLayers-1;i>=0;--i){float index=i<4?vAtlas1[i]:vAtlas2[i-4];ivec2 tile=ivec2(int(round(index))%lifeformGrid.x,int(floor((index+.5)/float(lifeformGrid.x))));
            vec4 layer=texture(plainTexture,(vUV+vec2(tile))/vec2(lifeformGrid));
            if(i==lifeformLayers-1)outCol=vec4(layer.rgb*layer.a,layer.a);else outCol=vec4(mix(outCol.rgb,layer.rgb,layer.a),layer.a+outCol.a*(1.0-layer.a));}
        texel=vec4(outCol.rgb/max(outCol.a,.001),outCol.a);}
    if((appearanceFlags&2)!=0)texel.rgb=mix(texel.rgb,vOverlay.rgb,vOverlay.a);
    if((appearanceFlags&512)!=0)texel.rgb=hueTint(texel.rgb,vHue);
    float threshold=bayerDither(gl_FragCoord.xy);
    if((appearanceFlags&4)!=0&&(vOpacity<=0.0||(vOpacity<255.0/256.0&&vOpacity<threshold)))discard;
    if((appearanceFlags&8)!=0&&sourceFadeAlpha<255.0/256.0&&sourceFadeAlpha<threshold)discard;
    if(textureAlpha!=0&&texel.a<alphaCutoff)discard;
    float alpha=(textureAlpha!=0?texel.a:1.0)*vTint.a;
    if((appearanceFlags&16384)!=0&&particleRampEnabled!=0){float index=clamp((alpha-vParticleRemap.x)/vParticleRemap.y,0.0,1.0);vec4 ramp=texture(particleRamp,vec2(1.0-index,0));texel.rgb*=ramp.rgb;alpha=clamp((alpha*ramp.a-vParticleRemap.z)/vParticleRemap.w,0.0,1.0);}
    if(alpha<=0.0&&(appearanceFlags&16384)==0)discard;
    if((appearanceFlags&8)!=0)alpha*=sourceVisibility;
    if((appearanceFlags&4)!=0&&(appearanceFlags&128)==0){float finalOpacity=texel.a*vTint.a*vOpacity;if(finalOpacity<=0.0||(finalOpacity<255.0/256.0&&finalOpacity<threshold))discard;}
    if(renderShadow!=0){if(renderShadow==1&&vBlockData.y==2.0)discard;color=renderShadow==2?vec4(texel.rgb*vTint.rgb*textureLevel,alpha):vec4(0.0);surfaceAlbedo=renderShadow==2?vec4((length(vNormal)>.000001?normalize(vNormal):vec3(0,1,0))*.5+.5,1):vec4(0.0);surfaceNormal=vec4(0.0);surfaceLight=vec4(0.0);surfaceMaterial=vec4(0.0);return;}
    vec3 n=length(vNormal)>0.000001?normalize(vNormal):vec3(0.0,1.0,0.0);
    if(twoSidedLighting!=0&&!gl_FrontFacing)n=-n;
    float visibility=shadowVisibility(n);
    vec3 skyLighting=vLight.www*0.80;
    if(shadowEnabled!=0)skyLighting*=clamp(sunColor,vec3(0.0),vec3(4.0))*(0.35+0.65*visibility);
    vec3 lighting=unlit!=0||textureKind==3?vec3(1.0):(hasLight!=0?vec3(0.20)+max(vLight.rgb*0.80,skyLighting):vec3(0.8));
    if(unlit==0&&(appearanceFlags&64)!=0){lighting=vSourceLighting;
        if((appearanceFlags&32)!=0){vec4 levels=lightCurve(vLight);lighting=max(sourceAmbient+levels.rgb*(1.0-sourceAmbient),mix(sourceAmbient,sourceSky,levels.w));}
        lighting=max(lighting,heldLighting());}
    vec3 albedo=texel.rgb*vTint.rgb*textureLevel;
    if((appearanceFlags&16384)!=0&&particleMultiply!=0)albedo=albedo*particleSourceAlpha+vec3(1.0)*(1.0-particleSourceAlpha);
    color=vec4(albedo*lighting+emission,alpha);
    if((appearanceFlags&16)!=0&&unlit!=0)color.rgb=albedo*emission;
    if((appearanceFlags&32)!=0)color.rgb+=albedo*vLambert*lighting;
    if((appearanceFlags&2048)!=0)color.rgb=enchantmentColor(color.rgb,albedo,vEnchant,vEnchantPosition);
    float distanceToEye=length(vWorldPosition-cameraPosition),fogFactor=1.0;
    if(fogMode==1)fogFactor=exp(-fogDensity*distanceToEye);
    if(fogMode==2)fogFactor=exp(-pow(fogDensity*distanceToEye,2.0));
    if(fogMode==3)fogFactor=(fogEnd-distanceToEye)/max(fogEnd-fogStart,0.000001);
    if(textureKind!=3&&materialFog!=0)color.rgb=mix(fogColor,color.rgb,clamp(fogFactor,0.0,1.0));
    if(premultipliedOutput!=0)color.rgb*=color.a;
    surfaceAlbedo=vec4(albedo,alpha);
    surfaceNormal=vec4(n*0.5+0.5,1.0);
    surfaceLight=hasLight!=0||(appearanceFlags&16)!=0?vRawLight:vec4(0.0);
    surfaceMaterial=vec4(vBlockData,0.0,1.0);
}
)GLSL";
struct ImportedMesh {
    GLuint vao=0,vbo=0,ebo=0,instances=0,surfaces=0;uint32_t texture=0,flags=0;GLsizei indexCount=0,instanceCount=0;
    uint32_t meshSequence=0,instanceSequence=0,ownSerial=0,ownEntry=0;
    std::vector<float> surfaceData;
    glm::mat4 world{1};std::vector<float> vertices,instanceData;
    float alphaCutoff=0.05f;glm::vec3 emission{0};bool unlit=false;
    MaterialDrawState drawState;
    glm::vec4 special{0};uint32_t particleOrder=0;SourceDrawState renderState;
    uint32_t particleMode=0,rampTexture=0,particleBlend=0,rampWrapU=1,rampWrapV=1;bool particleSourceBlend=false;glm::vec4 particleMask{1};
    GLuint irisBuffer=0,irisLightBuffer=0;IrisGeometry iris;std::vector<uint32_t> indices;bool irisTerrain=false;
    // Explicit internal source classification, never inferred from arbitrary IDs.
    GeometryRole geometryRole=GeometryRole::Generic;
    MeshMotion motion;GLuint previousPoseBuffer=0;uint64_t uploadedPoseGeneration=0;
    void updateIrisLight(){
        std::vector<glm::ivec2> light(vertices.size()/14);for(size_t v=0;v<light.size();++v)light[v]=irisLightmap(vertices[v*14+13]);
        if(!irisLightBuffer)nativegl::glGenBuffers(1,&irisLightBuffer);nativegl::glBindVertexArray(vao);nativegl::glBindBuffer(GL_ARRAY_BUFFER,irisLightBuffer);nativegl::glBufferData(GL_ARRAY_BUFFER,static_cast<GLsizeiptr>(light.size()*sizeof(glm::ivec2)),light.data(),GL_DYNAMIC_DRAW);
        nativegl::glEnableVertexAttribArray(15);nativegl::glVertexAttribIPointer(15,2,GL_INT,sizeof(glm::ivec2),nullptr);
    }
    void updateIris(){
        bool terrain=!surfaceData.empty();for(size_t i=1;i<surfaceData.size();i+=2)terrain&=surfaceData[i]>=1&&surfaceData[i]<=3;terrain|=(flags&8)!=0;irisTerrain=terrain;
        iris=IrisGeometry::build(vertices,indices,terrain);
        if(!irisBuffer)nativegl::glGenBuffers(1,&irisBuffer);nativegl::glBindVertexArray(vao);nativegl::glBindBuffer(GL_ARRAY_BUFFER,irisBuffer);nativegl::glBufferData(GL_ARRAY_BUFFER,static_cast<GLsizeiptr>(iris.vertices.size()*sizeof(IrisVertex)),iris.vertices.data(),GL_DYNAMIC_DRAW);
        const int sizes[3]={4,2,4};const size_t offsets[3]={offsetof(IrisVertex,tangent),offsetof(IrisVertex,midpoint),offsetof(IrisVertex,midBlock)};
        for(GLuint i=0;i<3;++i){nativegl::glEnableVertexAttribArray(12+i);nativegl::glVertexAttribPointer(12+i,sizes[i],GL_FLOAT,GL_FALSE,sizeof(IrisVertex),reinterpret_cast<void*>(offsets[i]));}
        updateIrisLight();
    }
    SourceAppearance appearance;GLuint appearanceBuffer=0;std::vector<float> vertexAppearance,instanceAppearance;uint32_t vertexAppearanceReceived=0,instanceAppearanceReceived=0;
    void uploadAppearance(){
        if(!appearanceBuffer)nativegl::glGenBuffers(1,&appearanceBuffer);
        std::vector<float> combined=vertexAppearance;combined.insert(combined.end(),instanceAppearance.begin(),instanceAppearance.end());
        nativegl::glBindBuffer(GL_SHADER_STORAGE_BUFFER,appearanceBuffer);nativegl::glBufferData(GL_SHADER_STORAGE_BUFFER,static_cast<GLsizeiptr>(combined.size()*4),combined.data(),GL_DYNAMIC_DRAW);
    }
    void uploadInstances(){
        if(!instances)nativegl::glGenBuffers(1,&instances);nativegl::glBindVertexArray(vao);nativegl::glBindBuffer(GL_ARRAY_BUFFER,instances);
        nativegl::glBufferData(GL_ARRAY_BUFFER,static_cast<GLsizeiptr>(instanceData.size()*4),instanceData.data(),GL_DYNAMIC_DRAW);
        for(GLuint i=0;i<4;++i){nativegl::glEnableVertexAttribArray(6+i);nativegl::glVertexAttribPointer(6+i,4,GL_FLOAT,GL_FALSE,72,reinterpret_cast<void*>(i*16ull));nativegl::glVertexAttribDivisor(6+i,1);}
        nativegl::glEnableVertexAttribArray(10);nativegl::glVertexAttribPointer(10,2,GL_FLOAT,GL_FALSE,72,reinterpret_cast<void*>(64ull));nativegl::glVertexAttribDivisor(10,1);updateBounds();
    }
    glm::vec3 localMin{0},localMax{0},boundsMin{0},boundsMax{0};bool boundsValid=false;
    std::vector<uint32_t> baseLayers,usedLayers;
    void measure(){
        if(vertices.empty()){boundsValid=false;return;}
        localMin=glm::vec3(std::numeric_limits<float>::max());localMax=-localMin;
        std::array<bool,2048> layers{};baseLayers.clear();
        for(size_t i=0;i<vertices.size();i+=14){const glm::vec3 p(vertices[i],vertices[i+1],vertices[i+2]);localMin=glm::min(localMin,p);localMax=glm::max(localMax,p);const float layer=std::round(vertices[i+12]);if(layer>=0&&layer<2048)layers[static_cast<size_t>(layer)]=true;}
        for(uint32_t i=0;i<layers.size();++i)if(layers[i])baseLayers.push_back(i);
        updateBounds();
    }
    void updateBounds(){
        boundsValid=!vertices.empty();boundsMin=glm::vec3(std::numeric_limits<float>::max());boundsMax=-boundsMin;
        const auto center=(localMin+localMax)*0.5f,extent=(localMax-localMin)*0.5f;usedLayers=baseLayers;
        auto append=[&](const glm::mat4& transform){const auto p=glm::vec3(transform*glm::vec4(center,1));const auto radius=glm::abs(glm::vec3(transform[0]))*extent.x+glm::abs(glm::vec3(transform[1]))*extent.y+glm::abs(glm::vec3(transform[2]))*extent.z;boundsMin=glm::min(boundsMin,p-radius);boundsMax=glm::max(boundsMax,p+radius);};
        if(instances){if(instanceCount==0){boundsValid=false;return;}for(GLsizei i=0;i<instanceCount;++i){const size_t at=static_cast<size_t>(i)*18;const auto matrix=glm::make_mat4(instanceData.data()+at);
            if(flags&16){const auto particleCenter=glm::vec3(world*glm::vec4(glm::vec3(matrix[3]),1));const float sx=glm::length(glm::vec3(matrix[0])),sy=glm::length(glm::vec3(matrix[1]));const auto radius=glm::vec3(.5f*(sx+sy)+(std::abs(special.z)+std::abs(special.w))*(std::max(sx,sy)+1));boundsMin=glm::min(boundsMin,particleCenter-radius);boundsMax=glm::max(boundsMax,particleCenter+radius);}
            else append(world*matrix);const auto layer=std::round(instanceData[at+16]);if(layer>=0&&layer<2048)usedLayers.push_back(static_cast<uint32_t>(layer));}}
        else append(world);
        std::sort(usedLayers.begin(),usedLayers.end());usedLayers.erase(std::unique(usedLayers.begin(),usedLayers.end()),usedLayers.end());
    }
    bool visible(const glm::mat4& clip,bool halfDepth)const{
        if(!boundsValid)return false;
        unsigned outside=63;
        for(int corner=0;corner<8&&outside;++corner){
            const glm::vec3 p((corner&1)?boundsMax.x:boundsMin.x,(corner&2)?boundsMax.y:boundsMin.y,(corner&4)?boundsMax.z:boundsMin.z);
            const auto c=clip*glm::vec4(p,1);unsigned mask=0;
            if(c.x < -c.w)mask|=1;if(c.x > c.w)mask|=2;if(c.y < -c.w)mask|=4;if(c.y > c.w)mask|=8;
            if(c.z < (halfDepth?0.0f:-c.w))mask|=16;if(c.z > c.w)mask|=32;outside&=mask;
        }
        return outside==0;
    }
    void release(){if(vao)nativegl::glDeleteVertexArrays(1,&vao);if(vbo)nativegl::glDeleteBuffers(1,&vbo);if(ebo)nativegl::glDeleteBuffers(1,&ebo);if(instances)nativegl::glDeleteBuffers(1,&instances);if(surfaces)nativegl::glDeleteBuffers(1,&surfaces);for(auto buffer:{appearanceBuffer,irisBuffer,irisLightBuffer,previousPoseBuffer})if(buffer)nativegl::glDeleteBuffers(1,&buffer);vao=vbo=ebo=instances=surfaces=appearanceBuffer=irisBuffer=irisLightBuffer=previousPoseBuffer=0;uploadedPoseGeneration=0;motion.release();surfaceData.clear();vertexAppearance.clear();instanceAppearance.clear();indices.clear();iris=IrisGeometry{};vertexAppearanceReceived=instanceAppearanceReceived=0;appearance=SourceAppearance{};instanceCount=0;}
};
struct ImportedTexture {GLuint handle=0,readiness=0,atlas=0,animationBuffer=0;AtlasLayout atlasLayout;uint32_t width=0,height=0,layers=0,flags=0;int wrapU=-1,wrapV=-1;std::vector<uint8_t> received;TextureSampler sampler;TextureAnimation animation;bool mipDirty=false;};
struct Renderer {
    uint32_t epoch=0;uint64_t packets=0,cameraFrames=0,meshUploads=0,textureUploads=0,removals=0;
    GLuint programId=0,compositeProgram=0,compositeVAO=0,fallbackPlain=0,fallbackArray=0,fallbackReadiness=0,fallbackCube=0,fallbackAppearance=0;
    bool hasCamera=false,reverseDepth=false,halfZ=false,presentationReady=false;uint32_t presentationRevision=1;
    FrameTargets targets;
    PostProcess postprocess;
    IrisGraph irisGraph;
    std::unique_ptr<IrisPlan> irisPlan; // installed linked engine recipe; loader remains separate
    GeometryBinding geometryBinding;
    uint32_t emissionSerial=0;std::vector<SourceEmissionEntry> currentEmission;std::unordered_map<uint32_t,SourceBlockMaterial> currentDefinitions;IrisGeometryFrame geometryFrame,completedGeometryFrame;bool sourceLightUsed=false,sourceRenderSeen=false;uint32_t sourceRenderHigh=0;
    std::shared_ptr<const shaderloader::BlockIdMap> frameBlockIds;std::unordered_map<uint32_t,PackBlockId> frameMaterialIds;
    uint32_t lastSourceSerial=0;
    GpuParticleResources gpuParticles;
    std::set<uint32_t> gpuTextureIds;
    uint64_t completedGeometryCounter=~uint64_t{0};
    std::vector<ColorBufferSpec> postBufferSpecs;
    std::vector<FullscreenPass> postPasses;
    FullscreenPass finalPass;
    int finalBuffer=-1;
    bool temporalHistoryRequired=false;
    HistorySample previousWorld;
    MotionBudget motionBudget;
    CameraHistory cameraHistory;CameraFrame cameraFrame;glm::dvec3 sourceOrigin{0};bool originKnown=false;
    const std::chrono::steady_clock::time_point clockStart=std::chrono::steady_clock::now();
    ShadowTarget shadows;EnvironmentState environment;
    uint64_t environmentUpdates=0,surfaceUpdates=0;uint32_t shadowMeshes=0;
    uint64_t poseUpdates=0,materialUpdates=0;
    glm::mat4 view{1},projection{1};glm::vec3 camera{0};glm::vec4 clear{0.10f,0.14f,0.19f,1};
    uint32_t sourceWidth=1280,sourceHeight=800;
    struct {GLint view=-1,projection=-1,world=-1,halfZ=-1,textureKind=-1,hasLight=-1,instanced=-1,textureLayers=-1,alphaCutoff=-1,emission=-1,unlit=-1;} uniforms;
    struct {GLint textureMatrix=-1,textureAlpha=-1,twoSided=-1,fog=-1,textureLevel=-1;} materialUniforms;
    struct {GLint flags=-1,vertex=-1,instance=-1,offset=-1,grid=-1,layers=-1,ambient=-1,sky=-1,heldColor=-1,heldPosition=-1,directions=-1,dirLights=-1,visibility=-1,fadeAlpha=-1;} appearanceUniforms;
    struct {GLint values=-1,premultiplied=-1,inverseView=-1;} specialUniforms;
    struct {GLint mode=-1,mask=-1,ramp=-1,multiply=-1;} particleUniforms;
    struct {GLint world=-1,viewProjection=-1,valid=-1,posed=-1;} motionUniforms;
    struct {GLint count=-1,tick=-1,stride=-1;} animationUniforms;
    struct {GLint shadowViewProjection=-1,renderShadow=-1,shadowEnabled=-1,camera=-1,sun=-1,sunColor=-1,fogMode=-1,fogColor=-1,fogStart=-1,fogEnd=-1,fogDensity=-1,atlasGrid=-1,atlasTile=-1;} sceneUniforms;
    double fps=0,frameMs=0,receiveMs=0;size_t bufferedBytes=0;
    uint32_t visibleMeshes=0,pendingTextureMeshes=0,motionValidMeshes=0,motionInvalidMeshes=0;uint64_t drawnTriangles=0;
    std::unordered_map<uint32_t,ImportedMesh> meshes;
    std::unordered_map<uint32_t,ImportedTexture> textures;
    std::vector<uint32_t> snapshots;
    uint64_t gpuTextureBytes(const std::set<uint32_t>* ids=nullptr)const{
        uint64_t n=0;for(auto id:ids?*ids:gpuTextureIds){const auto found=textures.find(id);if(found==textures.end())continue;const auto& t=found->second;
            uint32_t w=t.width,h=t.height;n+=uint64_t(w)*h*4;while(t.sampler.mipmaps&&(w>1||h>1)){w=std::max(1u,w/2);h=std::max(1u,h/2);n+=uint64_t(w)*h*4;}}
        return n;
    }
    void initialize(){
        programId=program({{GL_VERTEX_SHADER,vertexSource},{GL_FRAGMENT_SHADER,fragmentSource}});
        auto location=[&](const char* name){return nativegl::glGetUniformLocation(programId,name);};
        uniforms.view=location("view");uniforms.projection=location("projection");uniforms.world=location("world");uniforms.halfZ=location("halfZ");uniforms.textureKind=location("textureKind");uniforms.hasLight=location("hasLight");uniforms.instanced=location("instanced");uniforms.textureLayers=location("textureLayers");
        uniforms.alphaCutoff=location("alphaCutoff");uniforms.emission=location("emission");uniforms.unlit=location("unlit");
        materialUniforms={location("textureMatrix"),location("textureAlpha"),location("twoSidedLighting"),location("materialFog"),location("textureLevel")};
        appearanceUniforms={location("appearanceFlags"),location("vertexAppearance"),location("instanceAppearance"),location("instanceAppearanceOffset"),location("lifeformGrid"),location("lifeformLayers"),location("sourceAmbient"),location("sourceSky"),location("sourceHeldColor"),location("sourceHeldPosition"),location("sourceDirections"),location("sourceDirLights"),location("sourceVisibility"),location("sourceFadeAlpha")};
        animationUniforms={location("atlasAnimationCount"),location("atlasAnimationTick"),location("atlasAnimationStride")};
        specialUniforms={location("sourceSpecial"),location("premultipliedOutput"),location("inverseView")};
        particleUniforms={location("particleMode"),location("particleMask"),location("particleRampEnabled"),location("particleMultiply")};
        motionUniforms={location("motionPreviousWorld"),location("motionPreviousViewProjection"),location("motionValid"),location("motionPosed")};
        sceneUniforms={location("shadowViewProjection"),location("renderShadow"),location("shadowEnabled"),location("cameraPosition"),location("sunDirection"),location("sunColor"),location("fogMode"),location("fogColor"),location("fogStart"),location("fogEnd"),location("fogDensity"),location("atlasGrid"),location("atlasTile")};
        nativegl::glUseProgram(programId);nativegl::glUniform1i(location("plainTexture"),0);nativegl::glUniform1i(location("arrayTexture"),1);nativegl::glUniform1i(location("layerReadiness"),2);
        nativegl::glUniform1i(location("skyCube"),4);nativegl::glUniform1i(location("shadowDepth"),5);nativegl::glUniform1i(location("blockAtlas"),6);nativegl::glUniform1i(location("particleRamp"),7);
        compositeProgram=program({{GL_VERTEX_SHADER,compositeVertexSource},{GL_FRAGMENT_SHADER,compositeFragmentSource}});
        nativegl::glUseProgram(compositeProgram);nativegl::glUniform1i(nativegl::glGetUniformLocation(compositeProgram,"sceneColor"),3);
        nativegl::glGenVertexArrays(1,&compositeVAO);
        finalPass={compositeProgram,compositeVAO,{{nativegl::glGetUniformLocation(compositeProgram,"sceneColor"),3,-1,0,false}}, {}};
        const float appearanceDefaults[36]={0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,1};
        nativegl::glGenBuffers(1,&fallbackAppearance);nativegl::glBindBuffer(GL_SHADER_STORAGE_BUFFER,fallbackAppearance);nativegl::glBufferData(GL_SHADER_STORAGE_BUFFER,sizeof(appearanceDefaults),appearanceDefaults,GL_STATIC_DRAW);
        // All declared sampler types stay complete, including unused branches.
        const uint8_t white[4]={255,255,255,255},ready=255;
        auto parameters=[](GLenum kind){nativegl::glTexParameteri(kind,GL_TEXTURE_MIN_FILTER,GL_NEAREST);nativegl::glTexParameteri(kind,GL_TEXTURE_MAG_FILTER,GL_NEAREST);nativegl::glTexParameteri(kind,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);nativegl::glTexParameteri(kind,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);};
        nativegl::glActiveTexture(GL_TEXTURE0);nativegl::glGenTextures(1,&fallbackPlain);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackPlain);
        nativegl::glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA8,1,1,0,GL_RGBA,GL_UNSIGNED_BYTE,white);parameters(GL_TEXTURE_2D);
        nativegl::glActiveTexture(GL_TEXTURE7);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackPlain);
        nativegl::glActiveTexture(GL_TEXTURE1);nativegl::glGenTextures(1,&fallbackArray);nativegl::glBindTexture(GL_TEXTURE_2D_ARRAY,fallbackArray);
        nativegl::glTexImage3D(GL_TEXTURE_2D_ARRAY,0,GL_RGBA8,1,1,1,0,GL_RGBA,GL_UNSIGNED_BYTE,white);parameters(GL_TEXTURE_2D_ARRAY);
        nativegl::glActiveTexture(GL_TEXTURE2);nativegl::glGenTextures(1,&fallbackReadiness);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackReadiness);
        nativegl::glTexImage2D(GL_TEXTURE_2D,0,GL_R8,1,1,0,GL_RED,GL_UNSIGNED_BYTE,&ready);parameters(GL_TEXTURE_2D);
        nativegl::glActiveTexture(GL_TEXTURE4);nativegl::glGenTextures(1,&fallbackCube);nativegl::glBindTexture(GL_TEXTURE_CUBE_MAP,fallbackCube);
        for(int face=0;face<6;++face)nativegl::glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X+face,0,GL_RGBA8,1,1,0,GL_RGBA,GL_UNSIGNED_BYTE,white);parameters(GL_TEXTURE_CUBE_MAP);
    }
    void reset(){frameMaterialIds.clear();frameBlockIds.reset();emissionSerial=0;currentEmission.clear();currentDefinitions.clear();sourceRenderSeen=false;sourceRenderHigh=0;gpuParticles.release();gpuTextureIds.clear();lastSourceSerial=0;geometryFrame=IrisGeometryFrame{};completedGeometryFrame=IrisGeometryFrame{};completedGeometryCounter=~uint64_t{0};for(auto& [id,mesh]:meshes)mesh.release();meshes.clear();for(auto& [id,texture]:textures){nativegl::glDeleteTextures(1,&texture.handle);if(texture.readiness)nativegl::glDeleteTextures(1,&texture.readiness);if(texture.atlas)nativegl::glDeleteTextures(1,&texture.atlas);if(texture.animationBuffer)nativegl::glDeleteBuffers(1,&texture.animationBuffer);}textures.clear();hasCamera=false;presentationReady=false;presentationRevision=1;environment=EnvironmentState{};cameraHistory=CameraHistory{};cameraFrame=CameraFrame{};targets.history.invalidate();previousWorld={};postprocess.invalidate();irisGraph.invalidate();sourceOrigin=glm::dvec3(0);originKnown=false;}
    ~Renderer(){reset();if(programId)nativegl::glDeleteProgram(programId);if(compositeProgram)nativegl::glDeleteProgram(compositeProgram);if(compositeVAO)nativegl::glDeleteVertexArrays(1,&compositeVAO);if(fallbackAppearance)nativegl::glDeleteBuffers(1,&fallbackAppearance);for(auto texture:{fallbackPlain,fallbackArray,fallbackReadiness,fallbackCube})if(texture)nativegl::glDeleteTextures(1,&texture);}
    glm::mat4 readMatrix(Reader& r){glm::mat4 out;for(int i=0;i<16;++i)glm::value_ptr(out)[i]=r.f32();return out;}
    void forgetOwnEmission(ImportedMesh& mesh){
        if(mesh.ownSerial==emissionSerial&&mesh.ownEntry<currentEmission.size()){
            auto& e=currentEmission[mesh.ownEntry];e.mesh=0;std::vector<SourceEmissionRun>().swap(e.runs);}
        mesh.ownSerial=0;
    }
    void receive(uint32_t type,uint32_t sequence,const std::vector<uint8_t>& payload){
        Reader r{payload};const uint32_t incoming=r.u32();++packets;
        if(type==Reset){r.finish();reset();lastSourceSerial=0;epoch=incoming;return;}
        if(incoming!=epoch)return;
        if(type==SourceFrame||type==GpuParticles||type==SourceLight||type==SourceEmission){
            emissionSerial=0;currentEmission.clear();currentDefinitions.clear();std::vector<SourceEmissionEntry> emissionEntries;std::unordered_map<uint32_t,SourceBlockMaterial> definitions;
            if(type==SourceEmission)gpuParticles.invalidate();
            if(type==SourceLight||type==SourceEmission)geometryFrame.light={};
            GpuParticleSnapshot batch;bool hasGpu=type==GpuParticles;
            try{if(type==SourceEmission){auto emission=SourceEmissionSnapshot::read(r,epoch);hasGpu=emission.hasGpu;batch=std::move(emission.batch);emissionEntries=std::move(emission.entries);definitions=std::move(emission.definitions);}
                else if(type==SourceLight){auto light=SourceLightSnapshot::read(r,epoch);hasGpu=light.hasGpu;batch=std::move(light.batch);}
                else if(hasGpu)batch=GpuParticleSnapshot::read(r,epoch);else batch.source=SourceFrameData::read(r);
            }catch(...){if(type==SourceLight||type==SourceEmission)geometryFrame.light={};if(hasGpu||type==SourceLight||type==SourceEmission)gpuParticles.invalidate();throw;}
            auto& next=batch.source;auto& g=next.geometry;
            if(g.serial<=lastSourceSerial){if(type==SourceLight||type==SourceEmission)geometryFrame.light={};if(hasGpu||type==SourceLight||type==SourceEmission)gpuParticles.invalidate();throw std::runtime_error("Reordered source frame transaction.");}
            const bool originMatches=originKnown&&glm::all(glm::lessThanEqual(glm::abs(sourceOrigin-g.origin),glm::dvec3(.00001)));
            if((type==SourceLight||type==SourceEmission)&&(!originMatches||!next.fresh||(sourceRenderSeen&&g.renderFrame<=sourceRenderHigh)||(geometryFrame.serial&&g.rootIdentity==geometryFrame.rootIdentity&&g.cameraIdentity==geometryFrame.cameraIdentity&&g.renderFrame<=geometryFrame.renderFrame))){geometryFrame.light={};gpuParticles.invalidate();throw std::runtime_error("Stale, repeated or mismatched source light frame.");}
            for(const auto& e:emissionEntries){auto found=meshes.find(e.mesh);
                if(found==meshes.end()||found->second.meshSequence!=e.sequence||
                    (e.kind?(!found->second.instances||found->second.instanceSequence!=e.instanceSequence||found->second.flags&16):(!(found->second.flags&8)||found->second.instances))||
                    found->second.renderState.group!=0||(found->second.renderState.flags&SourceDrawState::Camera)||
                    (!e.runs.empty()&&e.runs.back().end!=static_cast<uint32_t>(e.kind?found->second.instanceCount:found->second.indexCount)))
                    throw std::runtime_error("Source emission does not match imported geometry generation.");}
            if(hasGpu){
                if(!originMatches||!next.fresh||(geometryFrame.serial&&g.rootIdentity==geometryFrame.rootIdentity&&g.cameraIdentity==geometryFrame.cameraIdentity&&g.renderFrame<=geometryFrame.renderFrame)){
                    gpuParticles.invalidate();throw std::runtime_error("Stale, repeated or mismatched source GPU frame.");}
                GraphState saved;
                auto ids=gpuTextureIds;for(const auto& d:batch.draws){ids.insert(d.texture);ids.insert(d.ramp);}const auto textureBytes=gpuTextureBytes(&ids);
                if(textureBytes>16*1024*1024){gpuParticles.invalidate();throw std::runtime_error("Source GPU texture generations exceed 16 MiB.");}
                const uint64_t occupied=uint64_t(targets.width)*targets.height*(FrameTargets::bytesPerPixel+(targets.history.allocated()?FrameHistory::bytesPerPixel:0))+irisGraph.bytes()+postprocess.bytes+uint64_t(shadows.depth?shadows.size:0)*(shadows.depth?shadows.size:0)*4+textureBytes;
                try{gpuParticles.accept(batch,occupied,FrameTargets::budget);saved.restore();nativegl::check("Source GPU transaction restore");gpuTextureIds=std::move(ids);}catch(...){gpuParticles.invalidate();throw;}
            }else gpuParticles.release();
            if((next.flags&8)&&!originMatches){g.feetKnown=g.eyeKnown=g.observedHand.known=false;}
            if(hasCamera&&(halfZ!=((next.flags&1)!=0)||reverseDepth!=((next.flags&2)!=0)||sourceWidth!=next.width||sourceHeight!=next.height||
                !geometryFrame.serial||!g.samePlayer(geometryFrame)||g.renderFrame<geometryFrame.renderFrame))invalidateHistory();
            if(g.renderFrame<geometryFrame.renderFrame&&g.samePlayer(geometryFrame)){g.feetKnown=g.eyeKnown=g.observedHand.known=false;}
            if(originMatches&&(next.flags&8))sourceOrigin=g.origin;else if(!(next.flags&8))g.origin=sourceOrigin;
            view=next.view;projection=next.projection;camera=next.camera;clear=next.clear;sourceWidth=next.width;sourceHeight=next.height;
            halfZ=(next.flags&1)!=0;reverseDepth=(next.flags&2)!=0;hasCamera=true;++cameraFrames;
            if(next.fresh&&(next.flags&32)){sourceRenderHigh=sourceRenderSeen?std::max(sourceRenderHigh,g.renderFrame):g.renderFrame;sourceRenderSeen=true;}
            g.epoch=epoch;g.sourceFrame=cameraFrames;geometryFrame=std::move(g);lastSourceSerial=geometryFrame.serial;
            if(type==SourceEmission){emissionSerial=geometryFrame.serial;currentEmission=std::move(emissionEntries);currentDefinitions=std::move(definitions);for(uint32_t i=0;i<currentEmission.size();++i){const auto& e=currentEmission[i];auto& mesh=meshes.at(e.mesh);
                mesh.ownSerial=emissionSerial;mesh.ownEntry=i;}}

        }else if(type==Camera){
            const uint32_t flags=r.u32(),w=r.u32(),h=r.u32();
            if(flags>3||!w||!h||w>32768||h>32768)throw std::runtime_error("Invalid source viewport.");
            const auto nextView=readMatrix(r),nextProjection=readMatrix(r);glm::vec3 nextCamera;glm::vec4 nextClear;
            for(int i=0;i<3;++i)nextCamera[i]=r.f32();for(int i=0;i<4;++i)nextClear[i]=r.f32();r.finish();
            CameraHistory::checkedInverse(nextView);CameraHistory::checkedInverse(nextProjection);
            if(hasCamera&&(halfZ!=((flags&1)!=0)||reverseDepth!=((flags&2)!=0)))invalidateHistory();
            view=nextView;projection=nextProjection;camera=nextCamera;clear=nextClear;sourceWidth=w;sourceHeight=h;
            halfZ=(flags&1)!=0;reverseDepth=(flags&2)!=0;hasCamera=true;++cameraFrames;geometryFrame=IrisGeometryFrame{};
        }else if(type==Origin){
            const auto known=r.u32();glm::dvec3 origin;glm::vec3 low;for(int i=0;i<3;++i)origin[i]=r.f32();for(int i=0;i<3;++i)low[i]=r.f32();r.finish();origin+=glm::dvec3(low);
            if(known>1||glm::any(glm::greaterThan(glm::abs(origin),glm::dvec3(4503599627370496.0))))throw std::runtime_error("Invalid source origin.");
            if(originKnown!=(known==1))invalidateHistory();
            if(geometryFrame.serial&&(sourceOrigin!=origin||originKnown!=(known==1)))geometryFrame.sourceFrame=~uint64_t{0};
            sourceOrigin=origin;originKnown=known==1;
        }else if(type==Mesh){
            const uint32_t id=r.u32(),texture=r.u32(),flags=r.u32(),vertexCount=r.u32(),indexCount=r.u32();
            if(!id||vertexCount>1000000||indexCount>6000000||indexCount%3)throw std::runtime_error("Invalid bridge mesh limits.");
            const auto world=readMatrix(r);auto vertices=r.floats(static_cast<size_t>(vertexCount)*14);auto indices=r.indices(indexCount);r.finish();
            for(auto index:indices)if(index>=vertexCount)throw std::runtime_error("Bridge index outside vertex buffer.");
            if(!meshes.contains(id)&&meshes.size()>=8192)throw std::runtime_error("Too many imported meshes.");
            auto& mesh=meshes[id];forgetOwnEmission(mesh);mesh.release();mesh.meshSequence=sequence;mesh.ownSerial=0;mesh.geometryRole=GeometryRole::Generic;mesh.texture=texture;mesh.flags=flags;mesh.world=world;mesh.vertices=std::move(vertices);mesh.indexCount=static_cast<GLsizei>(indexCount);
            mesh.alphaCutoff=0.05f;mesh.emission=glm::vec3(0);mesh.unlit=false;mesh.special=glm::vec4(0);mesh.renderState=SourceDrawState{};mesh.particleMode=mesh.rampTexture=mesh.particleBlend=0;mesh.particleSourceBlend=false;mesh.rampWrapU=mesh.rampWrapV=1;mesh.particleMask=glm::vec4(1);
            mesh.drawState=MaterialDrawState{};mesh.drawState.blendMode=flags&2?2:0;if(flags&6)mesh.drawState.flags&=~MaterialDrawState::DepthWrite;
            nativegl::glGenVertexArrays(1,&mesh.vao);nativegl::glBindVertexArray(mesh.vao);
            nativegl::glGenBuffers(1,&mesh.vbo);nativegl::glBindBuffer(GL_ARRAY_BUFFER,mesh.vbo);
            nativegl::glBufferData(GL_ARRAY_BUFFER,static_cast<GLsizeiptr>(mesh.vertices.size()*4),mesh.vertices.data(),GL_DYNAMIC_DRAW);
            const int sizes[6]={3,3,2,4,1,1};const size_t offsets[6]={0,3,6,8,12,13};
            for(GLuint i=0;i<6;++i){nativegl::glEnableVertexAttribArray(i);nativegl::glVertexAttribPointer(i,sizes[i],GL_FLOAT,GL_FALSE,56,reinterpret_cast<void*>(offsets[i]*4));}
            nativegl::glGenBuffers(1,&mesh.ebo);nativegl::glBindBuffer(GL_ELEMENT_ARRAY_BUFFER,mesh.ebo);
            nativegl::glBufferData(GL_ELEMENT_ARRAY_BUFFER,static_cast<GLsizeiptr>(indices.size()*4),indices.data(),GL_STATIC_DRAW);++meshUploads;
            mesh.indices=std::move(indices);mesh.updateIris();mesh.instanceData.clear();mesh.measure();
        }else if(type==AtlasAnimation){
            const auto id=r.u32();auto animation=TextureAnimation::read(r);if(!id||(!textures.contains(id)&&textures.size()>=2048))throw std::runtime_error("Invalid atlas animation ID.");
            if(textures.contains(id))animation.validate(textures.at(id).layers);auto& texture=textures[id];const bool changed=texture.animation.parameters!=animation.parameters;texture.animation=std::move(animation);
            if(changed&&!texture.animation.parameters.empty()){if(!texture.animationBuffer)nativegl::glGenBuffers(1,&texture.animationBuffer);nativegl::glBindBuffer(GL_SHADER_STORAGE_BUFFER,texture.animationBuffer);
                nativegl::glBufferData(GL_SHADER_STORAGE_BUFFER,static_cast<GLsizeiptr>(texture.animation.parameters.size()*4),texture.animation.parameters.data(),GL_DYNAMIC_DRAW);}
        }else if(type==TextureSampling){
            const auto id=r.u32();const auto sampler=TextureSampler::read(r);if(!id||(!textures.contains(id)&&textures.size()>=2048))throw std::runtime_error("Invalid texture sampling ID.");
            const auto found=textures.find(id);if(found!=textures.end())TextureSampler::validateBudget(found->second.width,found->second.height,found->second.layers,sampler.mipmaps);
            auto& texture=textures[id];texture.sampler=sampler;texture.mipDirty=true;
            if(texture.handle){const GLenum target=texture.flags&1?GL_TEXTURE_2D_ARRAY:texture.flags&8?GL_TEXTURE_CUBE_MAP:GL_TEXTURE_2D;nativegl::glActiveTexture(GL_TEXTURE0);nativegl::glBindTexture(target,texture.handle);sampler.apply(target);}
        }else if(type==Texture){
            const uint32_t id=r.u32(),w=r.u32(),h=r.u32(),layers=r.u32(),first=r.u32(),count=r.u32(),flags=r.u32();
            const bool array=(flags&1)!=0,cube=(flags&8)!=0;
            if(!id||flags>31||!w||!h||w>8192||h>8192||!layers||layers>2048||!count||first>=layers||count>layers-first||(array&&cube)||(cube&&(layers!=6||w!=h))||(!array&&!cube&&(layers!=1||first)))throw std::runtime_error("Invalid imported texture dimensions.");
            const uint64_t allocation=static_cast<uint64_t>(w)*h*layers*4;
            if(gpuTextureIds.contains(id)){
                uint64_t added=allocation;uint32_t mw=w,mh=h;const bool mip=textures.contains(id)&&textures.at(id).sampler.mipmaps;
                while(mip&&(mw>1||mh>1)){mw=std::max(1u,mw/2);mh=std::max(1u,mh/2);added+=uint64_t(mw)*mh*4;}
                const auto occupied=uint64_t(targets.width)*targets.height*(FrameTargets::bytesPerPixel+(targets.history.allocated()?FrameHistory::bytesPerPixel:0))+irisGraph.bytes()+postprocess.bytes+gpuParticles.bytes()+uint64_t(shadows.depth?shadows.size:0)*(shadows.depth?shadows.size:0)*4;
                if(array||cube||allocation>8*1024*1024||gpuTextureBytes()+added>16*1024*1024||occupied+gpuTextureBytes()+added>FrameTargets::budget||
                    (textures.contains(id)&&std::any_of(textures.at(id).received.begin(),textures.at(id).received.end(),[](auto v){return v!=0;})))
                    throw std::runtime_error("Source GPU texture generation is mutable, invalid or over budget.");
            }
            if(allocation>256ull*1024*1024)throw std::runtime_error("Imported texture exceeds native limit.");
            TextureSampler::validateBudget(w,h,layers,textures.contains(id)&&textures.at(id).sampler.mipmaps);
            if(textures.contains(id))textures.at(id).animation.validate(layers);
            const auto* pixels=r.data(static_cast<size_t>(w)*h*count*4);r.finish();
            for(const auto& [meshId,mesh]:meshes)if(mesh.rampTexture==id&&(array||cube||h!=1||mesh.texture==id))throw std::runtime_error("Texture update violates a live particle ramp contract.");
            if(!textures.contains(id)&&textures.size()>=2048)throw std::runtime_error("Too many imported textures.");
            AtlasLayout atlasLayout;if(array){GLint limit=0;nativegl::glGetIntegerv(GL_MAX_TEXTURE_SIZE,&limit);atlasLayout=AtlasLayout::plan(w,h,layers,limit);}
            auto& texture=textures[id];const GLenum target=array?GL_TEXTURE_2D_ARRAY:cube?GL_TEXTURE_CUBE_MAP:GL_TEXTURE_2D;
            nativegl::glActiveTexture(GL_TEXTURE0);
            if(!texture.handle||texture.width!=w||texture.height!=h||texture.layers!=layers||texture.flags!=flags){
                if(texture.handle)nativegl::glDeleteTextures(1,&texture.handle);if(texture.readiness)nativegl::glDeleteTextures(1,&texture.readiness);if(texture.atlas)nativegl::glDeleteTextures(1,&texture.atlas);texture.readiness=texture.atlas=0;nativegl::glGenTextures(1,&texture.handle);
                texture.width=w;texture.height=h;texture.layers=layers;texture.flags=flags;texture.received.assign(layers,0);
                texture.wrapU=texture.wrapV=-1;
                nativegl::glBindTexture(target,texture.handle);nativegl::glPixelStorei(GL_UNPACK_ALIGNMENT,1);
                const GLint format=flags&16?GL_SRGB8_ALPHA8:GL_RGBA8;
                if(array)nativegl::glTexImage3D(target,0,format,w,h,layers,0,GL_RGBA,GL_UNSIGNED_BYTE,nullptr);
                else if(cube)for(int face=0;face<6;++face)nativegl::glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X+face,0,format,w,h,0,GL_RGBA,GL_UNSIGNED_BYTE,nullptr);
                else nativegl::glTexImage2D(target,0,format,w,h,0,GL_RGBA,GL_UNSIGNED_BYTE,nullptr);
                texture.sampler.apply(target);
                nativegl::glTexParameteri(target,GL_TEXTURE_WRAP_S,(flags&2)?GL_REPEAT:GL_CLAMP_TO_EDGE);nativegl::glTexParameteri(target,GL_TEXTURE_WRAP_T,(flags&2)?GL_REPEAT:GL_CLAMP_TO_EDGE);
                if(array){nativegl::glGenTextures(1,&texture.readiness);nativegl::glActiveTexture(GL_TEXTURE2);nativegl::glBindTexture(GL_TEXTURE_2D,texture.readiness);
                    nativegl::glTexImage2D(GL_TEXTURE_2D,0,GL_R8,layers,1,0,GL_RED,GL_UNSIGNED_BYTE,texture.received.data());
                    nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
                    nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);}
                if(array){texture.atlasLayout=atlasLayout;nativegl::glGenTextures(1,&texture.atlas);nativegl::glActiveTexture(GL_TEXTURE6);nativegl::glBindTexture(GL_TEXTURE_2D,texture.atlas);
                    nativegl::glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA8,atlasLayout.width,atlasLayout.height,0,GL_RGBA,GL_UNSIGNED_BYTE,nullptr);
                    nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);}
            }
            nativegl::glActiveTexture(GL_TEXTURE0);
            nativegl::glActiveTexture(GL_TEXTURE0);
            nativegl::glBindTexture(target,texture.handle);nativegl::glPixelStorei(GL_UNPACK_ALIGNMENT,1);
            if(first==0&&!(flags&4)){std::fill(texture.received.begin(),texture.received.end(),uint8_t{0});if(array){nativegl::glActiveTexture(GL_TEXTURE2);nativegl::glBindTexture(GL_TEXTURE_2D,texture.readiness);nativegl::glTexSubImage2D(GL_TEXTURE_2D,0,0,0,layers,1,GL_RED,GL_UNSIGNED_BYTE,texture.received.data());nativegl::glActiveTexture(GL_TEXTURE0);}}
            if(array)nativegl::glTexSubImage3D(target,0,0,0,first,w,h,count,GL_RGBA,GL_UNSIGNED_BYTE,pixels);
            else if(cube)for(uint32_t face=0;face<count;++face)nativegl::glTexSubImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X+first+face,0,0,0,w,h,GL_RGBA,GL_UNSIGNED_BYTE,pixels+static_cast<size_t>(face)*w*h*4);
            else nativegl::glTexSubImage2D(target,0,0,0,w,h,GL_RGBA,GL_UNSIGNED_BYTE,pixels);
            if(array){nativegl::glActiveTexture(GL_TEXTURE6);nativegl::glBindTexture(GL_TEXTURE_2D,texture.atlas);
                for(uint32_t layer=0;layer<count;++layer){const auto tile=atlasLayout.padded(pixels+static_cast<size_t>(layer)*w*h*4);const auto index=first+layer;
                    nativegl::glTexSubImage2D(GL_TEXTURE_2D,0,(index%atlasLayout.columns)*(w+2),(index/atlasLayout.columns)*(h+2),w+2,h+2,GL_RGBA,GL_UNSIGNED_BYTE,tile.data());}}
            for(uint32_t i=first;i<first+count;++i)texture.received[i]=255;
            texture.mipDirty=true;
            if(array){nativegl::glActiveTexture(GL_TEXTURE2);nativegl::glBindTexture(GL_TEXTURE_2D,texture.readiness);nativegl::glTexSubImage2D(GL_TEXTURE_2D,0,first,0,count,1,GL_RED,GL_UNSIGNED_BYTE,texture.received.data()+first);}++textureUploads;
        }else if(type==Rebase){glm::vec3 shift;for(int i=0;i<3;++i)shift[i]=r.f32();r.finish();for(auto& [id,mesh]:meshes){mesh.world[3]+=glm::vec4(shift,0);mesh.boundsMin+=shift;mesh.boundsMax+=shift;mesh.renderState.rebase(shift);}camera+=shift;view=view*glm::translate(glm::mat4(1),-shift);sourceOrigin-=glm::dvec3(shift);if(geometryFrame.serial)geometryFrame.sourceFrame=~uint64_t{0};if(!originKnown)invalidateHistory();
        }else if(type==Transform){const uint32_t id=r.u32();const auto world=readMatrix(r);r.finish();if(meshes.contains(id)){meshes[id].world=world;meshes[id].updateBounds();}
        }else if(type==Light){
            const uint32_t id=r.u32(),count=r.u32();const auto values=r.floats(count);r.finish();
            if(meshes.contains(id)){auto& mesh=meshes[id];if(count!=mesh.vertices.size()/14)throw std::runtime_error("Light update vertex count differs.");
                for(size_t i=0;i<count;++i)mesh.vertices[i*14+13]=values[i];nativegl::glBindBuffer(GL_ARRAY_BUFFER,mesh.vbo);nativegl::glBufferSubData(GL_ARRAY_BUFFER,0,static_cast<GLsizeiptr>(mesh.vertices.size()*4),mesh.vertices.data());mesh.updateIrisLight();}
        }else if(type==Surface){
            const auto id=r.u32(),count=r.u32();if(count>1000000)throw std::runtime_error("Surface vertex limit exceeded.");auto values=r.floats(static_cast<size_t>(count)*2);r.finish();
            for(size_t i=0;i<values.size();i+=2)if(values[i]<-1||values[i]>65535||std::floor(values[i])!=values[i]||values[i+1]<0||values[i+1]>7||std::floor(values[i+1])!=values[i+1])throw std::runtime_error("Invalid native block/material ID.");
            if(meshes.contains(id)){auto& mesh=meshes[id];if(count!=mesh.vertices.size()/14)throw std::runtime_error("Surface vertex count differs.");
                if(!mesh.surfaces)nativegl::glGenBuffers(1,&mesh.surfaces);nativegl::glBindVertexArray(mesh.vao);nativegl::glBindBuffer(GL_ARRAY_BUFFER,mesh.surfaces);
                nativegl::glBufferData(GL_ARRAY_BUFFER,static_cast<GLsizeiptr>(values.size()*4),values.data(),GL_DYNAMIC_DRAW);nativegl::glEnableVertexAttribArray(11);nativegl::glVertexAttribPointer(11,2,GL_FLOAT,GL_FALSE,8,nullptr);mesh.surfaceData=std::move(values);
                bool terrain=!mesh.surfaceData.empty();for(size_t i=1;i<mesh.surfaceData.size();i+=2)terrain&=mesh.surfaceData[i]>=1&&mesh.surfaceData[i]<=3;terrain|=(mesh.flags&8)!=0;if(terrain!=mesh.irisTerrain)mesh.updateIris();++surfaceUpdates;}
        }else if(type==Environment){environment=EnvironmentState::read(r);++environmentUpdates;
        }else if(type==Pose){
            const uint32_t id=r.u32(),count=r.u32();if(count>1000000)throw std::runtime_error("Pose update exceeds vertex limit.");
            const auto values=r.floats(static_cast<size_t>(count)*6);r.finish();
            if(meshes.contains(id)){auto& mesh=meshes[id];forgetOwnEmission(mesh);mesh.meshSequence=0;if(count!=mesh.vertices.size()/14)throw std::runtime_error("Pose update vertex count differs.");
                bool moved=false;for(size_t i=0;i<count&&!moved;++i)for(size_t c=0;c<3;++c)moved|=values[i*6+c]!=mesh.vertices[i*14+c];
                if(moved)mesh.motion.beforePose(mesh.vertices,motionBudget);
                for(size_t i=0;i<count;++i)std::copy_n(values.data()+i*6,6,mesh.vertices.data()+i*14);
                nativegl::glBindBuffer(GL_ARRAY_BUFFER,mesh.vbo);nativegl::glBufferSubData(GL_ARRAY_BUFFER,0,static_cast<GLsizeiptr>(mesh.vertices.size()*4),mesh.vertices.data());
                mesh.measure();mesh.updateIris();++poseUpdates;}
        }else if(type==Material){
            const uint32_t id=r.u32(),flags=r.u32();const float cutoff=r.f32();glm::vec3 emissive;for(int i=0;i<3;++i)emissive[i]=r.f32();r.finish();
            if(flags>1||cutoff<0||cutoff>1||glm::any(glm::lessThan(emissive,glm::vec3(0))))throw std::runtime_error("Invalid bridge material properties.");
            if(meshes.contains(id)){auto& mesh=meshes[id];mesh.unlit=(flags&1)!=0;mesh.alphaCutoff=cutoff;mesh.emission=emissive;++materialUpdates;}
        }else if(type==MaterialState){
            const auto id=r.u32();const auto values=MaterialDrawState::read(r);
            if(meshes.contains(id)){meshes[id].drawState=values;++materialUpdates;}
        }else if(type==DrawState){
            const auto id=r.u32();const auto values=SourceDrawState::read(r);if(meshes.contains(id)){meshes[id].renderState=values;++materialUpdates;}
        }else if(type==AppearanceMaterial){const auto id=r.u32();const auto values=SourceAppearance::read(r);if(meshes.contains(id)){auto& mesh=meshes[id];
            if(values.flags!=mesh.appearance.flags||values.columns!=mesh.appearance.columns||values.rows!=mesh.appearance.rows||values.layers!=mesh.appearance.layers){mesh.vertexAppearance.clear();mesh.instanceAppearance.clear();mesh.vertexAppearanceReceived=mesh.instanceAppearanceReceived=0;}
            mesh.appearance=values;++materialUpdates;}
        }else if(type==SpecialMaterial){
            const auto id=r.u32();glm::vec4 values;for(int i=0;i<4;++i)values[i]=r.f32();r.finish();if(std::abs(values.x)>1e12f||std::abs(values.y)>16||std::abs(values.z)>16||std::abs(values.w)>16)throw std::runtime_error("Invalid source special material state.");
            if(meshes.contains(id)){meshes[id].special=values;meshes[id].updateBounds();}
        }else if(type==AppearanceData||type==AppearanceDataV2||type==AppearanceDataV3){
            const auto id=r.u32(),mode=r.u32(),total=r.u32(),offset=r.u32(),count=r.u32();
            if(mode>1||total>(mode?65536u:1000000u)||offset>total||count>total-offset||(total&&!count))throw std::runtime_error("Invalid source appearance data range.");
            const size_t stride=type==AppearanceDataV3?36:type==AppearanceDataV2?24:20;const auto input=r.floats(static_cast<size_t>(count)*stride);r.finish();std::vector<float> values(static_cast<size_t>(count)*36,0);
            for(size_t i=0;i<count;++i)std::copy_n(input.data()+i*stride,stride,values.data()+i*36);
            if(meshes.contains(id)){auto& mesh=meshes[id];if(!mode&&total!=mesh.vertices.size()/14)throw std::runtime_error("Appearance vertex count differs.");mesh.appearance.validate(values);
                auto& data=mode?mesh.instanceAppearance:mesh.vertexAppearance;auto& received=mode?mesh.instanceAppearanceReceived:mesh.vertexAppearanceReceived;
                if(stride==20&&(mesh.appearance.flags&~255u))throw std::runtime_error("Extended appearance requires v2 records.");
                if(stride<36&&(mesh.appearance.flags&2048))throw std::runtime_error("Enchantment requires v3 records.");
                if(offset==0){data.assign(static_cast<size_t>(total)*36,0);received=0;}else if(offset!=received||data.size()!=static_cast<size_t>(total)*36)throw std::runtime_error("Nonsequential appearance data.");
                std::copy(values.begin(),values.end(),data.begin()+static_cast<size_t>(offset)*36);received=offset+count;if(received==total)mesh.uploadAppearance();}
        }else if(type==Snapshot){snapshots.push_back(r.u32());r.finish();
        }else if(type==Remove){const uint32_t count=r.u32();if(count>8192)throw std::runtime_error("Invalid removal count.");for(uint32_t i=0;i<count;++i){auto it=meshes.find(r.u32());if(it!=meshes.end()){forgetOwnEmission(it->second);it->second.release();meshes.erase(it);++removals;}}r.finish();
        }else if(type==RenderControl){
            const auto revision=r.u32(),flags=r.u32();r.finish();if(!revision||flags>1)throw std::runtime_error("Invalid native presentation control.");
            presentationRevision=revision;presentationReady=(flags&1)!=0;
            if(!presentationReady){emissionSerial=0;currentEmission.clear();currentDefinitions.clear();invalidateHistory();gpuParticles.invalidate();if(geometryFrame.serial)geometryFrame.sourceFrame=~uint64_t{0};}
        }else if(type==ReleaseTextures){
            const auto count=r.u32();if(count>8192)throw std::runtime_error("Invalid texture release count.");const auto ids=r.indices(count);r.finish();
            for(auto id:ids)for(const auto& [meshId,mesh]:meshes)if(mesh.texture==id||mesh.rampTexture==id)throw std::runtime_error("Cannot release a referenced native texture.");
            for(auto id:ids){gpuTextureIds.erase(id);auto it=textures.find(id);if(it==textures.end())continue;auto& texture=it->second;
                nativegl::glDeleteTextures(1,&texture.handle);if(texture.readiness)nativegl::glDeleteTextures(1,&texture.readiness);if(texture.atlas)nativegl::glDeleteTextures(1,&texture.atlas);if(texture.animationBuffer)nativegl::glDeleteBuffers(1,&texture.animationBuffer);textures.erase(it);}
        }else if(type==Instances){
            const uint32_t id=r.u32(),count=r.u32();if(count>65536)throw std::runtime_error("Too many imported instances.");const auto values=r.floats(static_cast<size_t>(count)*18);r.finish();
            if(meshes.contains(id)){auto& mesh=meshes[id];forgetOwnEmission(mesh);mesh.instanceSequence=sequence;bool moved=mesh.instanceCount!=static_cast<GLsizei>(count)||!mesh.instances;
                if(!moved)for(size_t i=0;i<count&&!moved;++i)for(size_t c=0;c<16;++c)moved|=mesh.instanceData[i*18+c]!=values[i*18+c];
                mesh.motion.instancesDirty|=moved;mesh.instanceCount=static_cast<GLsizei>(count);
                mesh.instanceData=values;mesh.uploadInstances();
            }
        }else if(type==ParticleBatch||type==ParticleBatchV2||type==ParticleBatchV3){
            const auto id=r.u32();auto batch=SourceParticleBatch::read(r,type==ParticleBatchV3?3:type==ParticleBatchV2?2:1);
            if(meshes.contains(id)){auto& mesh=meshes[id];if(!(mesh.flags&16)||mesh.appearance.flags!=16384)throw std::runtime_error("Particle batch has no matching source contract.");
                if(batch.rampTexture&&textures.contains(batch.rampTexture)){const auto& ramp=textures.at(batch.rampTexture);if((ramp.flags&9)||ramp.height!=1||batch.rampTexture==mesh.texture)throw std::runtime_error("Invalid source particle ramp texture.");}
                const bool transformsChanged=!mesh.instances||mesh.instanceData!=batch.transforms,appearanceChanged=!mesh.appearanceBuffer||!mesh.vertexAppearance.empty()||mesh.instanceAppearance!=batch.appearance;
                const bool boundsChanged=mesh.world!=glm::mat4(1)||(type!=ParticleBatch&&glm::vec2(mesh.special.z,mesh.special.w)!=batch.pivot);
                if(type!=ParticleBatch){mesh.special.z=batch.pivot.x;mesh.special.w=batch.pivot.y;}mesh.particleMode=batch.mode;mesh.particleMask=batch.mask;
                mesh.rampTexture=batch.rampTexture;mesh.particleBlend=batch.blend;mesh.particleSourceBlend=batch.sourceBlend;mesh.rampWrapU=batch.wrapU;mesh.rampWrapV=batch.wrapV;
                mesh.world=glm::mat4(1);mesh.particleOrder=batch.order;mesh.instanceCount=batch.count;mesh.instanceData=std::move(batch.transforms);mesh.vertexAppearance.clear();mesh.vertexAppearanceReceived=0;mesh.instanceAppearance=std::move(batch.appearance);mesh.instanceAppearanceReceived=batch.count;
                if(transformsChanged)mesh.uploadInstances();else if(boundsChanged)mesh.updateBounds();if(appearanceChanged)mesh.uploadAppearance();}
        }
    }
    void invalidateHistory(){cameraHistory.reset();targets.history.invalidate();previousWorld={};postprocess.invalidate();irisGraph.invalidate();}
    bool postHistoryRequired()const{
        for(const auto& pass:postPasses)for(const auto& input:pass.inputs)if(input.native==PassTexture::PreviousColor||input.native==PassTexture::PreviousDepth)return true;
        return false;
    }
    void drawIrisGeometry(ImportedMesh& mesh,IrisDraw phase,int width,int height){
        const bool shadow=phase==IrisDraw::ShadowOpaque||phase==IrisDraw::ShadowTranslucent;
        const bool hand=phase==IrisDraw::HandOpaque||phase==IrisDraw::HandTranslucent;
        const bool transparent=phase==IrisDraw::ShadowTranslucent||phase==IrisDraw::WorldTranslucent||phase==IrisDraw::HandTranslucent;
        if(!mesh.indexCount||mesh.instances&&!mesh.instanceCount)return;
        const bool frameKnown=geometryFrame.matches(cameraFrames,epoch,sourceOrigin)&&geometryFrame.current(width,height);
        const auto role=mesh.geometryRole!=GeometryRole::Generic?mesh.geometryRole:mesh.irisTerrain?GeometryRole::Terrain:GeometryRole::Generic;
        const auto slot=geometrySlot(role,hand,shadow,transparent,mesh.alphaCutoff>0,mesh.texture!=0,(mesh.flags&1)!=0);
        const auto& binding=irisPlan->programs->select(slot);
        const bool consumesOwn=std::any_of(binding.uniforms.begin(),binding.uniforms.end(),[](const auto& u){return u.value==GeometryUniform::SourceOwnEmissionRgb;});
        const bool consumesBlock=std::any_of(binding.uniforms.begin(),binding.uniforms.end(),[](const auto& u){return u.value==GeometryUniform::SourceBlockId;});
        const bool consumesPack=std::any_of(binding.uniforms.begin(),binding.uniforms.end(),[](const auto& u){return u.value==GeometryUniform::PackBlockId;});
        unsigned materialInputs=0;for(const auto& u:binding.uniforms){if(u.value==GeometryUniform::SourceBlockRootId)materialInputs|=1;if(u.value==GeometryUniform::SourceBlockProperties)materialInputs|=2;if(u.value==GeometryUniform::SourceBlockState)materialInputs|=4;}const bool consumesMaterial=materialInputs!=0;
        const auto material=[&](uint32_t token)->const SourceBlockMaterial*{const auto found=currentDefinitions.find(token);return found==currentDefinitions.end()?nullptr:&found->second;};
        const auto packId=[&](uint32_t token)->PackBlockId{
            if(!consumesPack||!frameBlockIds||role!=GeometryRole::Terrain)return {};
            const auto* m=material(token);if(!m)return {};const auto found=frameMaterialIds.find(token);if(found!=frameMaterialIds.end())return found->second;
            const auto value=frameBlockIds->resolve(m->minecraft);frameMaterialIds.emplace(token,value);return value;};
        const auto sameMaterialInput=[&](uint32_t a,uint32_t b){const auto* x=material(a);const auto* y=material(b);if(!x||!y)return x==y;
            return (!(materialInputs&1)||x->rootId==y->rootId)&&(!(materialInputs&2)||x->flags==y->flags)&&(!(materialInputs&4)||(x->rotation==y->rotation&&x->open==y->open&&x->half==y->half));};
        const SourceEmissionEntry* own=nullptr;
        GeometryMatrices matrices;matrices.gbufferProjection=cameraFrame.projection;
        if(frameKnown&&originKnown){matrices.light=geometryFrame.light;
            if(!hand&&emissionSerial&&emissionSerial==geometryFrame.serial&&mesh.ownSerial==emissionSerial&&mesh.ownEntry<currentEmission.size())own=&currentEmission[mesh.ownEntry];
            if(own&&own->kind&&!binding.sourceInstanceRanges)own=nullptr;
            if(own){const auto value=own->runs.empty()?4096|own->rgb:own->runs.front().value;
                matrices.sourceOwnKnown=(value&4096)!=0;if(matrices.sourceOwnKnown)matrices.sourceOwnRgb={value&15,(value>>4)&15,(value>>8)&15};
                if(!own->runs.empty()){matrices.sourceBlock=own->runs.front().sourceBlock;matrices.sourceBlockKnown=own->runs.front().blockKnown;matrices.sourceMaterial=material(own->runs.front().definition);matrices.packBlockId=packId(own->runs.front().definition);}}}
        if(hand&&!frameKnown)throw std::runtime_error("Stale or missing hand source frame.");
        if(hand&&binding.handProjection==HandProjectionMode::ObservedSource){
            const auto& observed=geometryFrame.observedHand;
            if(!observed.known||observed.group!=mesh.renderState.group||observed.view!=mesh.renderState.view||observed.canonicalProjection()!=mesh.renderState.projection||observed.camera!=mesh.renderState.camera||observed.halfZ!=((mesh.renderState.flags&SourceDrawState::HalfZ)!=0))
                throw std::runtime_error("Hand draw and observed source frame disagree.");
            matrices.projection=observed.projection(width,height);
        }else matrices.projection=shadow?shadows.projection:hand?geometryFrame.hand.projection(width,height,reverseDepth):cameraFrame.projection;
        const auto& drawView=shadow?shadows.view:hand?mesh.renderState.view:cameraFrame.view;
        if(!mesh.visible(matrices.projection*drawView,false))return;
        if(!hand&&(mesh.renderState.flags&SourceDrawState::Camera))throw std::runtime_error("Unclassified custom world camera in Iris geometry.");
        matrices.modelView=drawView*mesh.world;CameraHistory::checkedInverse(matrices.modelView);
        matrices.texture=geometryTextureMatrix(mesh.drawState.uv);
        matrices.feetKnown=frameKnown&&geometryFrame.feetKnown&&originKnown;
        if(matrices.feetKnown){
            const auto feet=glm::vec3(geometryFrame.feet-sourceOrigin);
            for(int i=0;i<3;++i)if(!std::isfinite(feet[i]))throw std::runtime_error("Invalid authoritative player coordinates.");
            const auto translation=glm::translate(glm::mat4(1),feet);
            matrices.gbufferModelView=cameraFrame.view*translation;matrices.shadowView=shadows.view*translation;
        }
        matrices.shadowKnown=environment.sunKnown;matrices.shadowProjection=shadows.projection;
        matrices.historyKnown=cameraFrame.historyValid&&completedGeometryCounter!=~uint64_t{0}&&completedGeometryCounter+1==cameraFrame.counter&&matrices.feetKnown&&completedGeometryFrame.feetKnown&&completedGeometryFrame.epoch==epoch&&geometryFrame.samePlayer(completedGeometryFrame);
        if(matrices.historyKnown){
            // previousView is already compensated into the CURRENT origin.
            matrices.previousModelView=cameraFrame.previousView*glm::translate(glm::mat4(1),glm::vec3(completedGeometryFrame.feet-sourceOrigin));
            matrices.previousProjection=cameraFrame.previousProjection;
        }
        auto found=textures.find(mesh.texture);ImportedTexture* texture=found==textures.end()?nullptr:&found->second;
        if(mesh.texture){
            if(!texture||!texture->handle||texture->received.empty())throw std::runtime_error("Missing Iris source texture.");
            const bool ready=texture->flags&1?std::all_of(mesh.usedLayers.begin(),mesh.usedLayers.end(),[&](auto i){return i<texture->received.size()&&texture->received[i];}):std::all_of(texture->received.begin(),texture->received.end(),[](auto v){return v!=0;});
            if(!ready||!texture->animation.parameters.empty())throw std::runtime_error("Incomplete or animated source texture needs an Iris adapter.");
        }
        irisGraph.bindGeometry(binding.program,phase);
        mesh.drawState.apply(shadow,false,reverseDepth,transparent);
        geometryBinding.bind(binding,mesh,texture,fallbackPlain,matrices,&irisGraph);
        if((matrices.light.flags||matrices.sourceOwnKnown||matrices.sourceBlockKnown||matrices.sourceMaterial)&&std::any_of(binding.uniforms.begin(),binding.uniforms.end(),[](const auto& u){return u.value>=GeometryUniform::SourceLightingEnabled&&u.value<=GeometryUniform::SourceBlockState;}))sourceLightUsed=true;
        if(consumesPack&&matrices.packBlockId.known)sourceLightUsed=true;
        if((consumesOwn||consumesBlock||consumesMaterial||consumesPack)&&own&&!own->runs.empty()){
            uint32_t start=0;for(size_t i=0;i<own->runs.size();++i){const auto& run=own->runs[i];auto end=run.end;
                // Only split on data this program actually consumes. Equal RGB
                // does not require extra draws merely because raw IDs differ.
                while(i+1<own->runs.size()){const auto& next=own->runs[i+1];
                    if(consumesOwn&&next.value!=run.value||consumesBlock&&(next.blockKnown!=run.blockKnown||next.sourceBlock!=run.sourceBlock)||consumesMaterial&&!sameMaterialInput(next.definition,run.definition)||consumesPack&&packId(next.definition)!=packId(run.definition))break;
                    end=next.end;++i;}
                geometryBinding.bindOwnEmission(binding,run.value);
                geometryBinding.bindSourceBlock(binding,run.sourceBlock,run.blockKnown);
                geometryBinding.bindSourceMaterial(binding,material(run.definition));
                const auto pack=packId(run.definition);geometryBinding.bindPackBlock(binding,pack);if(consumesPack&&pack.known)sourceLightUsed=true;
                if(consumesOwn&&run.value||consumesBlock&&run.blockKnown||consumesMaterial&&run.definition)sourceLightUsed=true;
                if(own->kind){geometryBinding.instanceOffset(binding,mesh,start);
                    nativegl::glDrawElementsInstanced(GL_TRIANGLES,mesh.indexCount,GL_UNSIGNED_INT,nullptr,static_cast<GLsizei>(end-start));}
                else nativegl::glDrawElements(GL_TRIANGLES,static_cast<GLsizei>(end-start),GL_UNSIGNED_INT,reinterpret_cast<void*>(static_cast<uintptr_t>(start)*4));
                nativegl::check("Iris source identity/emission draw run");start=end;}
        }else if(mesh.instances)nativegl::glDrawElementsInstanced(GL_TRIANGLES,mesh.indexCount,GL_UNSIGNED_INT,nullptr,mesh.instanceCount);
        else nativegl::glDrawElements(GL_TRIANGLES,mesh.indexCount,GL_UNSIGNED_INT,nullptr);
        nativegl::check("Iris geometry draw");
        if(shadow)++shadowMeshes;else {++visibleMeshes;drawnTriangles+=static_cast<uint64_t>(mesh.indexCount/3)*(mesh.instances?mesh.instanceCount:1);}
    }
    void render(GLuint target,int width,int height,bool present=true,const std::vector<GLuint>& outputAttachments={}){
        visibleMeshes=pendingTextureMeshes=shadowMeshes=motionValidMeshes=motionInvalidMeshes=0;drawnTriangles=0;
        previousWorld={};sourceLightUsed=false;
        frameBlockIds=irisPlan?irisPlan->blockIds:nullptr;frameMaterialIds.clear();
        if(!present&&(!presentationReady||!hasCamera)){invalidateHistory();return;}
        if(width<1||height<1){invalidateHistory();return;}
        std::unique_ptr<GraphState> graphState;if(irisPlan)graphState=std::make_unique<GraphState>();
        IrisGraphFrame graphFrame{irisPlan?&irisGraph:nullptr};
        if(present&&target&&(outputAttachments.empty()||target==targets.framebuffer||target==targets.opaqueFramebuffer||target==postprocess.targetFramebuffer()))throw std::runtime_error("Native final output needs a separate framebuffer with declared attachments.");
        if(present){nativegl::glBindFramebuffer(GL_FRAMEBUFFER,target);nativegl::glViewport(0,0,width,height);nativegl::glClearColor(clear.r,clear.g,clear.b,1);nativegl::glClearDepth(reverseDepth?0.0:1.0);}
        nativegl::glDepthFunc(reverseDepth?GL_GREATER:GL_LESS);nativegl::glDepthMask(GL_TRUE);
        nativegl::glDisable(GL_BLEND);nativegl::glEnable(GL_DEPTH_TEST);nativegl::glDisable(GL_CULL_FACE);
        if(present)nativegl::glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);if(!hasCamera){invalidateHistory();return;}
        const float aspect=static_cast<float>(sourceWidth)/sourceHeight;
        int viewportW=width,viewportH=static_cast<int>(width/aspect);if(viewportH>height){viewportH=height;viewportW=static_cast<int>(height*aspect);}
        viewportW=std::max(1,viewportW);viewportH=std::max(1,viewportH);
        auto gpuCurrent=[&](){if(!gpuParticles.draws.empty()&&(!gpuParticles.valid||gpuParticles.serial!=geometryFrame.serial||!geometryFrame.matches(cameraFrames,epoch,sourceOrigin)||!geometryFrame.current(viewportW,viewportH)))throw std::runtime_error("Source GPU frame expired or changed camera/origin/viewport.");};
        gpuCurrent();
        if(postPasses.size()>256||finalBuffer< -1||finalBuffer>=32)throw std::runtime_error("Invalid native postprocess plan.");
        const bool useHistory=temporalHistoryRequired||postHistoryRequired();
        if(irisPlan&&(useHistory||!postPasses.empty()||!postBufferSpecs.empty()||finalBuffer>=0))throw std::runtime_error("Iris graph cannot share the legacy post chain or pre-hand world archive.");
        // Only the opted-in experimental graph pays for state capture/resources.
        if(!irisPlan){if(irisGraph.bytes())irisGraph.release();geometryBinding.release();completedGeometryFrame=IrisGeometryFrame{};completedGeometryCounter=~uint64_t{0};}
        const auto gpuBytes=gpuParticles.bytes()+gpuTextureBytes();
        const auto graphBytes=irisPlan?IrisGraph::estimate(*irisPlan,viewportW,viewportH):0;
        const auto postBytes=PostProcess::estimate(postBufferSpecs,viewportW,viewportH);
        const auto retainedShadowBytes=irisPlan&&shadows.depth?static_cast<uint64_t>(shadows.size)*shadows.size*4:0;
        if(irisPlan){
            const uint64_t newBase=static_cast<uint64_t>(viewportW)*viewportH*FrameTargets::bytesPerPixel;
            const bool resizeBase=targets.width!=viewportW||targets.height!=viewportH;
            const uint64_t oldBase=resizeBase?static_cast<uint64_t>(targets.width)*targets.height*(FrameTargets::bytesPerPixel+(targets.history.allocated()?FrameHistory::bytesPerPixel:0)):0;
            const uint64_t oldGraph=irisGraph.matches(*irisPlan,viewportW,viewportH)?0:irisGraph.bytes();
            if(newBase+oldBase+graphBytes+oldGraph+retainedShadowBytes+gpuBytes>FrameTargets::budget)throw std::runtime_error("Graph resize peak exceeds 512 MiB; old resources retained.");
        }
        targets.resize(viewportW,viewportH,useHistory,postBytes+graphBytes+gpuBytes);
        if(irisPlan)irisGraph.configure(*irisPlan,viewportW,viewportH,static_cast<uint64_t>(viewportW)*viewportH*FrameTargets::bytesPerPixel+retainedShadowBytes+gpuBytes);
        postprocess.configure(postBufferSpecs,viewportW,viewportH,static_cast<uint64_t>(viewportW)*viewportH*(FrameTargets::bytesPerPixel+(useHistory?FrameHistory::bytesPerPixel:0))+gpuBytes);
        if(finalBuffer>=0&&ColorFormat::get(postprocess.format(static_cast<uint32_t>(finalBuffer))).kind!=ColorFormat::Floating)throw std::runtime_error("Native final color resolve requires a floating-point sampler type.");
        postprocess.begin(glm::vec4(environment.fog,1));PostProcessFrame postFrame{postprocess};
        const double seconds=std::chrono::duration<double>(std::chrono::steady_clock::now()-clockStart).count();
        cameraFrame=cameraHistory.prepare(view,projection,camera,sourceOrigin,originKnown,halfZ,viewportW,viewportH,seconds);
        targets.history.begin(cameraFrame,reverseDepth);previousWorld=targets.history.previous(cameraFrame,reverseDepth);
        for(auto& [id,mesh]:meshes)mesh.motion.drawn=false;
        for(auto& [id,texture]:textures)if(texture.handle&&texture.sampler.mipmaps&&texture.mipDirty&&std::any_of(texture.received.begin(),texture.received.end(),[](auto ready){return ready!=0;})){
            nativegl::glActiveTexture(GL_TEXTURE0);const GLenum textureTarget=texture.flags&1?GL_TEXTURE_2D_ARRAY:texture.flags&8?GL_TEXTURE_CUBE_MAP:GL_TEXTURE_2D;
            nativegl::glBindTexture(textureTarget,texture.handle);nativegl::glGenerateMipmap(textureTarget);texture.mipDirty=false;
        }
        nativegl::glActiveTexture(GL_TEXTURE0);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackPlain);
        nativegl::glActiveTexture(GL_TEXTURE1);nativegl::glBindTexture(GL_TEXTURE_2D_ARRAY,fallbackArray);
        nativegl::glActiveTexture(GL_TEXTURE2);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackReadiness);
        nativegl::glActiveTexture(GL_TEXTURE4);nativegl::glBindTexture(GL_TEXTURE_CUBE_MAP,fallbackCube);
        nativegl::glActiveTexture(GL_TEXTURE5);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackPlain);
        nativegl::glActiveTexture(GL_TEXTURE6);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackPlain);
        nativegl::glUseProgram(programId);nativegl::glUniformMatrix4fv(uniforms.view,1,GL_FALSE,glm::value_ptr(cameraFrame.view));nativegl::glUniformMatrix4fv(uniforms.projection,1,GL_FALSE,glm::value_ptr(cameraFrame.projection));
        nativegl::glUniform1i(uniforms.halfZ,0);
        const auto previousViewProjection=cameraFrame.previousProjection*cameraFrame.previousView;
        nativegl::glUniformMatrix4fv(motionUniforms.viewProjection,1,GL_FALSE,glm::value_ptr(previousViewProjection));
        nativegl::glUniformMatrix4fv(specialUniforms.inverseView,1,GL_FALSE,glm::value_ptr(cameraFrame.viewInverse));
        nativegl::glUniform3fv(sceneUniforms.camera,1,glm::value_ptr(camera));nativegl::glUniform3fv(sceneUniforms.sun,1,glm::value_ptr(environment.sun));nativegl::glUniform3fv(sceneUniforms.sunColor,1,glm::value_ptr(environment.sunColor));
        nativegl::glUniform1i(sceneUniforms.fogMode,environment.fogEnabled?environment.fogMode:0);nativegl::glUniform3fv(sceneUniforms.fogColor,1,glm::value_ptr(environment.fog));
        nativegl::glUniform1f(sceneUniforms.fogStart,environment.fogStart);nativegl::glUniform1f(sceneUniforms.fogEnd,environment.fogEnd);nativegl::glUniform1f(sceneUniforms.fogDensity,environment.fogDensity);
        const auto cameraClip=projection*view;auto clip=cameraClip;bool activeHalfZ=halfZ,shadowPass=false;
        const int surfaceTargets=static_cast<int>(FrameTargets::attachments.size());
        bool surfacePass=false,cameraSelected=false;int colorTargets=surfaceTargets,lastMotionValid=-1,lastMotionPosed=-1;GLuint lastMotionBuffer=std::numeric_limits<GLuint>::max();const SourceDrawState* lastCamera=nullptr;
        uint32_t lastTexture=std::numeric_limits<uint32_t>::max(),lastRamp=std::numeric_limits<uint32_t>::max();int lastKind=-1,lastLight=-1,lastInstanced=-1,lastParticleMode=-1,lastRampEnabled=-1,lastMultiply=-1;glm::vec4 lastParticleMask(-1);
        auto draw=[&](ImportedMesh& mesh,int particlePass=0){
            const auto& render=mesh.renderState;const bool custom=(render.flags&SourceDrawState::Camera)!=0;
            const auto drawClip=!shadowPass&&custom?render.projection*render.view:clip;const bool drawHalfZ=!shadowPass&&custom?false:activeHalfZ;
            if(!mesh.indexCount||(!(mesh.flags&4)&&!mesh.visible(drawClip,drawHalfZ))||(mesh.instances&&mesh.instanceCount==0))return;
            if(!shadowPass){
                const auto* selected=custom?&render:nullptr;
                if(!cameraSelected||lastCamera!=selected){
                    nativegl::glUniformMatrix4fv(uniforms.view,1,GL_FALSE,glm::value_ptr(custom?render.view:cameraFrame.view));
                    nativegl::glUniformMatrix4fv(uniforms.projection,1,GL_FALSE,glm::value_ptr(custom?render.projection:cameraFrame.projection));
                    nativegl::glUniformMatrix4fv(specialUniforms.inverseView,1,GL_FALSE,glm::value_ptr(custom?render.inverseView:cameraFrame.viewInverse));
                    nativegl::glUniform3fv(sceneUniforms.camera,1,glm::value_ptr(custom?render.camera:camera));lastCamera=selected;cameraSelected=true;
                }
                const int desired=surfacePass&&!(render.flags&SourceDrawState::Hand)?surfaceTargets:1;
                if(desired!=colorTargets){if(desired==surfaceTargets)nativegl::glDrawBuffers(static_cast<GLsizei>(FrameTargets::attachments.size()),FrameTargets::attachments.data());else targets.translucent();colorTargets=desired;}
                nativegl::glUniform1i(sceneUniforms.shadowEnabled,environment.sunKnown&&!(render.flags&SourceDrawState::Hand)?1:0);
            }
            int textureKind=0;bool sourceTextureReady=true;auto it=textures.find(mesh.texture);
            if(mesh.texture){
                if(it==textures.end()){sourceTextureReady=false;if(!shadowPass)++pendingTextureMeshes;}
                else {const bool array=(it->second.flags&1)!=0,cube=(it->second.flags&8)!=0;
                    const bool pending=array?std::any_of(mesh.usedLayers.begin(),mesh.usedLayers.end(),[&](auto layer){return layer>=it->second.layers||!it->second.received[layer];}):std::any_of(it->second.received.begin(),it->second.received.end(),[](auto ready){return ready==0;});
                    sourceTextureReady=!pending;if(pending&&!shadowPass)++pendingTextureMeshes;textureKind=array?2:(pending?0:cube?3:1);
                    if(lastTexture!=mesh.texture){nativegl::glActiveTexture(array?GL_TEXTURE1:cube?GL_TEXTURE4:GL_TEXTURE0);nativegl::glBindTexture(array?GL_TEXTURE_2D_ARRAY:cube?GL_TEXTURE_CUBE_MAP:GL_TEXTURE_2D,it->second.handle);
                        if(array){nativegl::glActiveTexture(GL_TEXTURE2);nativegl::glBindTexture(GL_TEXTURE_2D,it->second.readiness);nativegl::glUniform1i(uniforms.textureLayers,static_cast<int>(it->second.layers));
                            nativegl::glActiveTexture(GL_TEXTURE6);nativegl::glBindTexture(GL_TEXTURE_2D,it->second.atlas);nativegl::glUniform2i(sceneUniforms.atlasGrid,it->second.atlasLayout.columns,it->second.atlasLayout.rows);nativegl::glUniform2i(sceneUniforms.atlasTile,it->second.width,it->second.height);}lastTexture=mesh.texture;}}
            }
            if(textureKind!=lastKind){nativegl::glUniform1i(uniforms.textureKind,textureKind);lastKind=textureKind;}
            const auto* animation=textureKind==2?&it->second:nullptr;
            nativegl::glBindBufferBase(GL_SHADER_STORAGE_BUFFER,6,animation&&animation->animationBuffer?animation->animationBuffer:fallbackAppearance);
            nativegl::glUniform1i(animationUniforms.count,animation?static_cast<GLint>(animation->animation.parameters.size()/4):0);
            nativegl::glUniform1f(animationUniforms.tick,animation?animation->animation.tick:0);nativegl::glUniform1f(animationUniforms.stride,animation?animation->animation.stride:1);
            const int light=(mesh.flags&1)?1:0,instanced=mesh.instances?1:0;
            if(light!=lastLight){nativegl::glUniform1i(uniforms.hasLight,light);lastLight=light;}
            if(instanced!=lastInstanced){nativegl::glUniform1i(uniforms.instanced,instanced);lastInstanced=instanced;}
            auto state=mesh.drawState;if(mesh.particleSourceBlend){constexpr uint32_t modes[6]={3,6,2,1,4,4};state.blendMode=mesh.particleBlend==5&&particlePass==1?1:modes[mesh.particleBlend];}
            state.apply(shadowPass,(mesh.flags&4)!=0,reverseDepth,(mesh.flags&2)!=0);
            const bool multiply=mesh.particleSourceBlend&&mesh.particleBlend>=4&&particlePass==0;
            if(lastMultiply!=static_cast<int>(multiply)){nativegl::glUniform1i(particleUniforms.multiply,multiply?1:0);lastMultiply=multiply;}
            const int rampEnabled=mesh.rampTexture?1:0;if(lastRampEnabled!=rampEnabled){nativegl::glUniform1i(particleUniforms.ramp,rampEnabled);lastRampEnabled=rampEnabled;}
            GLuint rampHandle=fallbackPlain;
            if(mesh.rampTexture){const auto ramp=textures.find(mesh.rampTexture);if(ramp==textures.end()||ramp->second.received.empty()||ramp->second.received[0]==0){if(!shadowPass)++pendingTextureMeshes;return;}
                auto& texture=ramp->second;if((texture.flags&9)||texture.height!=1||mesh.rampTexture==mesh.texture)throw std::runtime_error("Incompatible live particle ramp texture.");rampHandle=texture.handle;
                if(lastRamp!=rampHandle){nativegl::glActiveTexture(GL_TEXTURE7);nativegl::glBindTexture(GL_TEXTURE_2D,rampHandle);lastRamp=rampHandle;}
                if(texture.wrapU!=static_cast<int>(mesh.rampWrapU)||texture.wrapV!=static_cast<int>(mesh.rampWrapV)){nativegl::glActiveTexture(GL_TEXTURE7);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,MaterialDrawState::wrap(mesh.rampWrapU));nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,MaterialDrawState::wrap(mesh.rampWrapV));texture.wrapU=mesh.rampWrapU;texture.wrapV=mesh.rampWrapV;}
            }else if(lastRamp!=rampHandle){nativegl::glActiveTexture(GL_TEXTURE7);nativegl::glBindTexture(GL_TEXTURE_2D,rampHandle);lastRamp=rampHandle;}
            const auto& source=mesh.appearance;
            if((source.flags&(23|256|512|1024|2048|16384))&&mesh.vertexAppearance.empty()&&mesh.instanceAppearance.empty())return;
            if(mesh.vertexAppearanceReceived!=mesh.vertexAppearance.size()/36||mesh.instanceAppearanceReceived!=mesh.instanceAppearance.size()/36||!mesh.instanceAppearance.empty()&&mesh.instanceAppearance.size()/36!=static_cast<size_t>(mesh.instanceCount))return;
            nativegl::glBindBufferBase(GL_SHADER_STORAGE_BUFFER,7,mesh.appearanceBuffer?mesh.appearanceBuffer:fallbackAppearance);
            nativegl::glUniform1i(appearanceUniforms.flags,source.flags);nativegl::glUniform1i(appearanceUniforms.vertex,mesh.vertexAppearance.empty()?0:1);nativegl::glUniform1i(appearanceUniforms.instance,mesh.instanceAppearance.empty()?0:1);nativegl::glUniform1i(appearanceUniforms.offset,static_cast<GLint>(mesh.vertexAppearance.size()/36));
            nativegl::glUniform4fv(specialUniforms.values,1,glm::value_ptr(mesh.special));
            if(lastParticleMode!=static_cast<int>(mesh.particleMode)){nativegl::glUniform1i(particleUniforms.mode,mesh.particleMode);lastParticleMode=mesh.particleMode;}
            if(lastParticleMask!=mesh.particleMask){nativegl::glUniform4fv(particleUniforms.mask,1,glm::value_ptr(mesh.particleMask));lastParticleMask=mesh.particleMask;}
            nativegl::glUniform1i(specialUniforms.premultiplied,!shadowPass&&(state.blendMode==7||state.blendMode==8)?1:0);
            nativegl::glUniform2i(appearanceUniforms.grid,source.columns,source.rows);nativegl::glUniform1i(appearanceUniforms.layers,source.layers);
            nativegl::glUniform3fv(appearanceUniforms.ambient,1,source.uniforms.data());nativegl::glUniform3fv(appearanceUniforms.sky,1,source.uniforms.data()+3);
            nativegl::glUniform4fv(appearanceUniforms.heldColor,1,source.uniforms.data()+6);nativegl::glUniform4fv(appearanceUniforms.heldPosition,1,source.uniforms.data()+10);
            nativegl::glUniform1i(appearanceUniforms.directions,source.directions);nativegl::glUniform4fv(appearanceUniforms.dirLights,4,source.uniforms.data()+16);
            nativegl::glUniform1f(appearanceUniforms.visibility,source.uniforms[14]);nativegl::glUniform1f(appearanceUniforms.fadeAlpha,source.uniforms[15]);
            nativegl::glUniformMatrix4fv(materialUniforms.textureMatrix,1,GL_FALSE,glm::value_ptr(state.uv));
            nativegl::glUniform1i(materialUniforms.textureAlpha,(state.flags&MaterialDrawState::TextureAlpha)?1:0);
            nativegl::glUniform1i(materialUniforms.twoSided,(state.flags&MaterialDrawState::TwoSided)?1:0);
            nativegl::glUniform1i(materialUniforms.fog,(state.flags&MaterialDrawState::Fog)?1:0);nativegl::glUniform1f(materialUniforms.textureLevel,state.textureLevel);
            if(textureKind==1){auto& texture=it->second;
                if(texture.wrapU!=static_cast<int>(state.wrapU)||texture.wrapV!=static_cast<int>(state.wrapV)){
                    nativegl::glActiveTexture(GL_TEXTURE0);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,MaterialDrawState::wrap(state.wrapU));nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,MaterialDrawState::wrap(state.wrapV));texture.wrapU=state.wrapU;texture.wrapV=state.wrapV;}}
            const bool motionSurface=!shadowPass&&surfacePass&&render.group==0&&!(render.flags&SourceDrawState::Camera)&&!(mesh.flags&22)&&sourceTextureReady;
            const auto motion=motionSurface?mesh.motion.prepare(cameraFrame,mesh.instances!=0,mesh.vertices.size()/14):MotionSample{};
            if(lastMotionValid!=static_cast<int>(motion.valid)){nativegl::glUniform1i(motionUniforms.valid,motion.valid?1:0);lastMotionValid=motion.valid;}
            if(lastMotionPosed!=static_cast<int>(motion.posed)){nativegl::glUniform1i(motionUniforms.posed,motion.posed?1:0);lastMotionPosed=motion.posed;}
            if(motion.valid)nativegl::glUniformMatrix4fv(motionUniforms.world,1,GL_FALSE,glm::value_ptr(motion.previousWorld));
            if(motion.posed&&mesh.uploadedPoseGeneration!=mesh.motion.poseGeneration){
                if(!mesh.previousPoseBuffer)nativegl::glGenBuffers(1,&mesh.previousPoseBuffer);nativegl::glBindBuffer(GL_SHADER_STORAGE_BUFFER,mesh.previousPoseBuffer);
                nativegl::glBufferData(GL_SHADER_STORAGE_BUFFER,static_cast<GLsizeiptr>(mesh.motion.previousPose.size()*sizeof(glm::vec4)),mesh.motion.previousPose.data(),GL_DYNAMIC_DRAW);mesh.uploadedPoseGeneration=mesh.motion.poseGeneration;
            }
            const auto poseBuffer=motion.posed?mesh.previousPoseBuffer:fallbackAppearance;
            if(lastMotionBuffer!=poseBuffer){nativegl::glBindBufferBase(GL_SHADER_STORAGE_BUFFER,4,poseBuffer);lastMotionBuffer=poseBuffer;}
            nativegl::glUniformMatrix4fv(uniforms.world,1,GL_FALSE,glm::value_ptr(mesh.world));nativegl::glBindVertexArray(mesh.vao);
            nativegl::glUniform1f(uniforms.alphaCutoff,mesh.alphaCutoff);nativegl::glUniform3fv(uniforms.emission,1,glm::value_ptr(mesh.emission));nativegl::glUniform1i(uniforms.unlit,mesh.unlit?1:0);
            if(mesh.instances)nativegl::glDrawElementsInstanced(GL_TRIANGLES,mesh.indexCount,GL_UNSIGNED_INT,nullptr,mesh.instanceCount);
            else nativegl::glDrawElements(GL_TRIANGLES,mesh.indexCount,GL_UNSIGNED_INT,nullptr);
            if(motionSurface){mesh.motion.drawn=true;if(motion.valid)++motionValidMeshes;else ++motionInvalidMeshes;}
            if(shadowPass)++shadowMeshes;else {++visibleMeshes;drawnTriangles+=static_cast<uint64_t>(mesh.indexCount/3)*(mesh.instances?mesh.instanceCount:1);}
        };
        size_t gpuCursor=0;
        auto gpuUntil=[&](uint32_t order){
            while(gpuCursor<gpuParticles.draws.size()&&gpuParticles.draws[gpuCursor].order<order){
                gpuCurrent();const auto& d=gpuParticles.draws[gpuCursor++];
                if(!textures.contains(d.texture)||!textures.contains(d.ramp))throw std::runtime_error("Source GPU texture is missing.");
                auto& t=textures.at(d.texture);auto& ramp=textures.at(d.ramp);
                for(const auto* tex:{&t,&ramp})if(!tex->handle||(tex->flags&9)||tex->received.size()!=1||!tex->received[0])throw std::runtime_error("Source GPU texture is incomplete.");
                if(ramp.height!=1)throw std::runtime_error("Source GPU ramp is not one-dimensional.");
                GraphState saved;
                if(irisPlan){if(!irisPlan->sourceGpuParticleColor)throw std::runtime_error("Iris recipe has no explicit source GPU color adapter.");
                    IrisProgram p;p.handle=gpuParticles.shader();p.outputs={{*irisPlan->sourceGpuParticleColor,false}};
                    irisGraph.bindGeometry(p,IrisDraw::WorldTranslucent);irisGraph.validateGeometrySample(t.handle);irisGraph.validateGeometrySample(ramp.handle);
                }
                gpuParticles.draw(d,t.handle,ramp.handle,halfZ);
                t.wrapU=t.wrapV=ramp.wrapU=ramp.wrapV=-1;
                saved.restore();nativegl::check("Source GPU draw state restore");
                ++visibleMeshes;drawnTriangles+=uint64_t(d.count)*2;
            }
        };
        if(irisPlan){
            if(irisPlan->programs)for(const auto& p:irisPlan->programs->slots)if(p)GeometryBinding::validate(*p);
            int handGroup=-1;
            for(const auto& [id,mesh]:meshes)if(mesh.renderState.group>0){
                if(!(mesh.renderState.flags&SourceDrawState::Hand)||!(mesh.renderState.flags&SourceDrawState::Camera)||(!irisPlan->programs&&(mesh.renderState.flags&SourceDrawState::ClearDepth))||(handGroup!=-1&&handGroup!=mesh.renderState.group))throw std::runtime_error("Iris graph requires one isolated observed hand group and a reference projection for depth-reset hands.");handGroup=mesh.renderState.group;
            }
            shadows.orient(camera,environment,irisPlan->shadowSize);
            auto graphDraw=[&](IrisDraw phase,GLuint){
                const bool shadow=phase==IrisDraw::ShadowOpaque||phase==IrisDraw::ShadowTranslucent;
                const bool hand=phase==IrisDraw::HandOpaque||phase==IrisDraw::HandTranslucent;
                const bool translucent=phase==IrisDraw::WorldTranslucent||phase==IrisDraw::HandTranslucent||phase==IrisDraw::ShadowTranslucent;
                shadowPass=shadow;clip=shadow?shadows.projection*shadows.view:cameraClip;activeHalfZ=shadow?false:halfZ;
                surfacePass=!translucent;colorTargets=shadow?2:surfaceTargets;cameraSelected=false;lastCamera=nullptr;
                lastTexture=lastRamp=std::numeric_limits<uint32_t>::max();lastMotionBuffer=std::numeric_limits<GLuint>::max();
                lastKind=lastLight=lastInstanced=lastParticleMode=lastRampEnabled=lastMultiply=lastMotionValid=lastMotionPosed=-1;lastParticleMask=glm::vec4(-1);
                nativegl::glUseProgram(programId);nativegl::glEnable(GL_DEPTH_TEST);nativegl::glDepthMask(GL_TRUE);
                nativegl::glUniform1i(sceneUniforms.renderShadow,shadow?2:0);nativegl::glUniform1i(sceneUniforms.shadowEnabled,!shadow&&environment.sunKnown&&!hand?1:0);
                nativegl::glUniformMatrix4fv(sceneUniforms.shadowViewProjection,1,GL_FALSE,glm::value_ptr(shadows.projection*shadows.view));
                nativegl::glActiveTexture(GL_TEXTURE0);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackPlain);
                nativegl::glActiveTexture(GL_TEXTURE1);nativegl::glBindTexture(GL_TEXTURE_2D_ARRAY,fallbackArray);
                nativegl::glActiveTexture(GL_TEXTURE2);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackReadiness);
                nativegl::glActiveTexture(GL_TEXTURE4);nativegl::glBindTexture(GL_TEXTURE_CUBE_MAP,fallbackCube);
                nativegl::glActiveTexture(GL_TEXTURE5);nativegl::glBindTexture(GL_TEXTURE_2D,shadow?fallbackPlain:irisGraph.depth(3));
                nativegl::glActiveTexture(GL_TEXTURE6);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackPlain);
                std::vector<ImportedMesh*> selected;
                for(auto& [id,mesh]:meshes){const bool isHand=(mesh.renderState.flags&SourceDrawState::Hand)!=0;
                    if(shadow){if(isHand||(mesh.flags&20)||!environment.sunKnown)continue;}
                    else if(isHand!=hand)continue;
                    const bool isTrans=(mesh.flags&18)!=0;if(isTrans!=translucent)continue;selected.push_back(&mesh);
                }
                const auto order=[](auto a,auto b){if(a->renderState.group!=b->renderState.group)return a->renderState.group<b->renderState.group;return a->renderState.order!=b->renderState.order?a->renderState.order<b->renderState.order:a->renderState.part<b->renderState.part;};
                std::stable_sort(selected.begin(),selected.end(),[&](auto a,auto b){
                    if(a->renderState.group!=b->renderState.group)return order(a,b);
                    if(!translucent){if(bool(a->flags&4)!=bool(b->flags&4))return bool(a->flags&4);if((a->alphaCutoff>0)!=(b->alphaCutoff>0))return a->alphaCutoff<=0;}
                    else {if(bool(a->flags&16)!=bool(b->flags&16))return bool(a->flags&16);if(a->flags&16)return a->particleOrder<b->particleOrder;
                        const auto flags=a->renderState.flags;
                        if(!(flags&SourceDrawState::MaterialSort)){
                            if(!(flags&(SourceDrawState::DistanceSort|SourceDrawState::FrontSort))&&a->renderState.alpha!=b->renderState.alpha)return a->renderState.alpha<b->renderState.alpha;
                            const auto distance=[&](auto m){const auto center=m->renderState.flags&SourceDrawState::Center?glm::dvec3(m->renderState.center):(glm::dvec3(m->boundsMin)+glm::dvec3(m->boundsMax))*.5;const auto d=center-glm::dvec3(camera);return glm::dot(d,d);};
                            const auto da=distance(a),db=distance(b);if(da!=db)return flags&SourceDrawState::FrontSort?da<db:da>db;
                        }
                    }
                    if(a->renderState.sort!=b->renderState.sort)return a->renderState.sort<b->renderState.sort;return order(a,b);
                });
                int previousGroup=-999;uint32_t groupPolicy=0;
                for(auto mesh:selected){if(phase==IrisDraw::WorldTranslucent&&mesh->renderState.group>=0)gpuUntil(mesh->flags&16?mesh->particleOrder*2:UINT32_MAX);const auto policy=mesh->renderState.flags&(SourceDrawState::ClearDepth|SourceDrawState::MaterialSort|SourceDrawState::DistanceSort|SourceDrawState::FrontSort);
                    if(previousGroup==mesh->renderState.group&&groupPolicy!=policy)throw std::runtime_error("Graph source group policies disagree.");
                    if(previousGroup!=mesh->renderState.group){previousGroup=mesh->renderState.group;groupPolicy=policy;
                        if(!shadow&&!hand&&!translucent&&previousGroup>=0&&(policy&SourceDrawState::ClearDepth)){nativegl::glDepthMask(GL_TRUE);const GLfloat farValue=reverseDepth?0.f:1.f;nativegl::glClearBufferfv(GL_DEPTH,0,&farValue);}}
                    if(irisPlan->programs)drawIrisGeometry(*mesh,phase,viewportW,viewportH);
                    else {surfacePass=!translucent&&!(mesh->flags&4);draw(*mesh);if(mesh->particleSourceBlend&&mesh->particleBlend==5)draw(*mesh,1);}
                }
                if(phase==IrisDraw::WorldTranslucent)gpuUntil(UINT32_MAX);
            };
            std::array<GLuint,7> attachments{};std::copy(targets.colors.begin(),targets.colors.end(),attachments.begin());attachments[6]=targets.depth;
            PassDestination destination{targets.framebuffer,0,0,viewportW,viewportH,attachments};
            irisGraph.execute(*irisPlan,compositeVAO,glm::vec4(environment.fog,1),reverseDepth,destination,graphDraw);
        }else{
        if(environment.sunKnown){
            shadows.initialize();shadows.orient(camera,environment);shadows.begin();clip=shadows.projection*shadows.view;activeHalfZ=false;shadowPass=true;
            nativegl::glActiveTexture(GL_TEXTURE5);nativegl::glBindTexture(GL_TEXTURE_2D,fallbackPlain);
            nativegl::glUniformMatrix4fv(sceneUniforms.shadowViewProjection,1,GL_FALSE,glm::value_ptr(clip));nativegl::glUniform1i(sceneUniforms.renderShadow,1);nativegl::glUniform1i(sceneUniforms.shadowEnabled,0);
            for(auto& [id,mesh]:meshes)if(!(mesh.flags&22)&&!(mesh.renderState.flags&SourceDrawState::Hand))draw(mesh);
        }
        clip=cameraClip;activeHalfZ=halfZ;shadowPass=false;lastTexture=std::numeric_limits<uint32_t>::max();lastKind=lastLight=lastInstanced=-1;
        targets.begin(clear,reverseDepth);nativegl::glDepthFunc(reverseDepth?GL_GREATER:GL_LESS);nativegl::glDepthMask(GL_TRUE);
        nativegl::glUniform1i(sceneUniforms.renderShadow,0);nativegl::glUniform1i(sceneUniforms.shadowEnabled,environment.sunKnown?1:0);
        nativegl::glActiveTexture(GL_TEXTURE5);nativegl::glBindTexture(GL_TEXTURE_2D,environment.sunKnown?shadows.depth:fallbackPlain);
        const auto sourceOrder=[](auto a,auto b){return a->renderState.order!=b->renderState.order?a->renderState.order<b->renderState.order:a->renderState.part<b->renderState.part;};
        for(int group=-1;group<4;++group){
            std::vector<ImportedMesh*> members;for(auto& [id,mesh]:meshes)if(mesh.renderState.group==group)members.push_back(&mesh);
            if(!members.empty()){
                const bool clearDepth=(members.front()->renderState.flags&SourceDrawState::ClearDepth)!=0;
                const auto policy=members.front()->renderState.flags&(SourceDrawState::ClearDepth|SourceDrawState::MaterialSort|SourceDrawState::DistanceSort|SourceDrawState::FrontSort);
                if(std::any_of(members.begin(),members.end(),[&](auto mesh){return (mesh->renderState.flags&(SourceDrawState::ClearDepth|SourceDrawState::MaterialSort|SourceDrawState::DistanceSort|SourceDrawState::FrontSort))!=policy;}))throw std::runtime_error("Source group depth/sort policies disagree.");
                if(group>=0&&clearDepth){nativegl::glDepthMask(GL_TRUE);const GLfloat farDepth=reverseDepth?0.0f:1.0f;nativegl::glClearBufferfv(GL_DEPTH,0,&farDepth);}
            }
            std::stable_sort(members.begin(),members.end(),sourceOrder);surfacePass=false;nativegl::glDisable(GL_DEPTH_TEST);nativegl::glDepthMask(GL_FALSE);
            for(auto mesh:members)if(mesh->flags&4)draw(*mesh);
            nativegl::glEnable(GL_DEPTH_TEST);nativegl::glDepthMask(GL_TRUE);surfacePass=true;
            std::vector<ImportedMesh*> opaque;for(auto mesh:members)if(!(mesh->flags&22))opaque.push_back(mesh);
            std::stable_sort(opaque.begin(),opaque.end(),[&](auto a,auto b){const bool ac=a->alphaCutoff>0,bc=b->alphaCutoff>0;if(ac!=bc)return !ac;if(a->renderState.sort!=b->renderState.sort)return a->renderState.sort<b->renderState.sort;return sourceOrder(a,b);});
            for(auto mesh:opaque)draw(*mesh);
            if(group==0)targets.retainOpaqueDepth();surfacePass=false;if(colorTargets!=1){targets.translucent();colorTargets=1;}
            std::vector<ImportedMesh*> particles;for(auto mesh:members)if(mesh->flags&16)particles.push_back(mesh);
            std::stable_sort(particles.begin(),particles.end(),[](auto a,auto b){return a->particleOrder<b->particleOrder;});for(auto mesh:particles){if(group==0)gpuUntil(mesh->particleOrder*2);draw(*mesh);if(mesh->particleSourceBlend&&mesh->particleBlend==5)draw(*mesh,1);}
            if(group==0)gpuUntil(UINT32_MAX);
            std::vector<ImportedMesh*> translucent;for(auto mesh:members)if((mesh->flags&22)==2)translucent.push_back(mesh);
            const auto distanceToCamera=[&](auto mesh){const auto& state=mesh->renderState;const glm::dvec3 center=state.flags&SourceDrawState::Center?glm::dvec3(state.center):(glm::dvec3(mesh->boundsMin)+glm::dvec3(mesh->boundsMax))*.5;
                const auto delta=center-glm::dvec3(camera);return glm::dot(delta,delta);};
            std::stable_sort(translucent.begin(),translucent.end(),[&](auto a,auto b){const auto flags=a->renderState.flags;
                if(flags&SourceDrawState::MaterialSort){if(a->renderState.sort!=b->renderState.sort)return a->renderState.sort<b->renderState.sort;return sourceOrder(a,b);}
                if(!(flags&(SourceDrawState::DistanceSort|SourceDrawState::FrontSort))&&a->renderState.alpha!=b->renderState.alpha)return a->renderState.alpha<b->renderState.alpha;
                const auto da=distanceToCamera(a),db=distanceToCamera(b);return da!=db?(flags&SourceDrawState::FrontSort?da<db:da>db):sourceOrder(a,b);});
            for(auto mesh:translucent)draw(*mesh);
            if(group==0)targets.history.stageWorld(targets.framebuffer,targets.opaqueFramebuffer,cameraFrame,reverseDepth);
        }
        nativegl::glDepthMask(GL_TRUE);nativegl::glDisable(GL_BLEND);
        }
        for(auto& pass:postPasses){
            if(pass.historyValid<0&&std::any_of(pass.inputs.begin(),pass.inputs.end(),[](const auto& input){return input.native==PassTexture::PreviousColor||input.native==PassTexture::PreviousDepth;}))throw std::runtime_error("Temporal postprocess inputs require an explicit validity uniform.");
            for(auto& input:pass.inputs)if(input.native!=PassTexture::None){
                if(input.logical>=0)throw std::runtime_error("Native and logical postprocess input identities overlap.");
                if(input.native>=PassTexture::Scene&&input.native<=PassTexture::Motion)input.external=targets.colors[static_cast<size_t>(input.native-PassTexture::Scene)];
                else if(input.native==PassTexture::Depth)input.external=targets.depth;
                else if(input.native==PassTexture::OpaqueDepth)input.external=targets.opaqueDepth;
                else if(input.native==PassTexture::PreviousColor)input.external=previousWorld.valid?previousWorld.color:fallbackPlain;
                else if(input.native==PassTexture::PreviousDepth)input.external=previousWorld.valid?previousWorld.opaqueDepth:fallbackPlain;
                else throw std::runtime_error("Invalid native postprocess texture binding.");
            }
            nativegl::glUseProgram(pass.program);if(pass.historyValid>=0)nativegl::glUniform1i(pass.historyValid,previousWorld.valid?1:0);
            postprocess.run(pass);
        }
        // A configured chain resolves back to scene color for the same embedded
        // readback path. The final copy never samples its destination texture.
        if(finalBuffer>=0){
            finalPass.inputs[0].logical=finalBuffer;
            std::array<GLuint,7> attachments{};std::copy(targets.colors.begin(),targets.colors.end(),attachments.begin());attachments[6]=targets.depth;
            PassDestination destination{targets.framebuffer,0,0,viewportW,viewportH,attachments};postprocess.run(finalPass,&destination);
        }
        if(present){
            finalPass.inputs[0].logical=-1;finalPass.inputs[0].external=targets.colors[FrameTargets::Scene];
            PassDestination destination{target,(width-viewportW)/2,(height-viewportH)/2,viewportW,viewportH,outputAttachments};
            postprocess.run(finalPass,&destination);
        }
        nativegl::glDepthMask(GL_TRUE);
        nativegl::check("Native completed frame");gpuCurrent();
        if(graphState){graphState->restore();nativegl::check("Graph state restoration");}
        gpuCurrent();if(sourceLightUsed&&(!geometryFrame.matches(cameraFrames,epoch,sourceOrigin)||!geometryFrame.current(viewportW,viewportH)))throw std::runtime_error("Source light expired before frame commit.");
        if(irisPlan&&irisPlan->blockIds!=frameBlockIds)throw std::runtime_error("Pack material map changed before frame commit.");
        graphFrame.complete();
        postFrame.complete();
        targets.history.commit(cameraFrame);
        for(auto& [id,mesh]:meshes)if(mesh.motion.drawn)mesh.motion.commit(cameraFrame,mesh.world,mesh.instances!=0);
        cameraHistory.commit(cameraFrame);
        if(irisPlan&&irisPlan->programs){completedGeometryFrame=geometryFrame.matches(cameraFrames,epoch,sourceOrigin)&&geometryFrame.current(viewportW,viewportH)?geometryFrame:IrisGeometryFrame{};completedGeometryCounter=cameraFrame.counter;}
    }
    std::string status(int snapshot=-1,const std::vector<unsigned char>* pixels=nullptr,int width=0,int height=0)const {
        std::ostringstream s;s<<"{\"epoch\":"<<epoch<<",\"meshes\":"<<meshes.size()<<",\"textures\":"<<textures.size()<<",\"cameraFrames\":"<<cameraFrames<<",\"packets\":"<<packets<<",\"meshUploads\":"<<meshUploads<<",\"textureUploads\":"<<textureUploads<<",\"removals\":"<<removals<<",\"hasCamera\":"<<(hasCamera?"true":"false")<<",\"snapshot\":"<<snapshot;
        s<<",\"fps\":"<<fps<<",\"frameCpuMs\":"<<frameMs<<",\"receiveMs\":"<<receiveMs<<",\"bufferedBytes\":"<<bufferedBytes<<",\"visibleMeshes\":"<<visibleMeshes<<",\"pendingTextureMeshes\":"<<pendingTextureMeshes<<",\"drawnTriangles\":"<<drawnTriangles;
        s<<",\"rendererPipeline\":\"native-gbuffer-v3\",\"colorBuffers\":6,\"framebufferWidth\":"<<targets.width<<",\"framebufferHeight\":"<<targets.height<<",\"framebufferAllocations\":"<<targets.allocations<<",\"poseUpdates\":"<<poseUpdates<<",\"materialUpdates\":"<<materialUpdates<<",\"surfaceUpdates\":"<<surfaceUpdates<<",\"minecraftShaderpackLoaded\":false";
        s<<",\"motionContract\":1,\"motionValidMeshes\":"<<motionValidMeshes<<",\"motionInvalidMeshes\":"<<motionInvalidMeshes<<",\"motionPoseReservedBytes\":"<<motionBudget.used;
        s<<",\"worldHistoryContract\":1,\"worldHistoryRequired\":"<<(temporalHistoryRequired||postHistoryRequired()?"true":"false")<<",\"worldHistoryAllocated\":"<<(targets.history.allocated()?"true":"false")<<",\"previousWorldHistoryValid\":"<<(previousWorld.valid?"true":"false")<<",\"worldHistoryCommits\":"<<targets.history.commits;
        s<<",\"postprocessContract\":1,\"postprocessBytes\":"<<postprocess.bytes<<",\"postprocessPasses\":"<<postprocess.passes<<",\"postprocessHistoryRequired\":"<<(postHistoryRequired()?"true":"false");
        s<<",\"irisGraphContract\":1,\"irisGraphEnabled\":"<<(irisPlan?"true":"false")<<",\"irisGraphBytes\":"<<irisGraph.bytes()<<",\"irisGraphFrames\":"<<irisGraph.frames<<",\"irisGraphFailures\":"<<irisGraph.failures;
        s<<",\"environmentUpdates\":"<<environmentUpdates<<",\"sunKnown\":"<<(environment.sunKnown?"true":"false")<<",\"shadowMeshes\":"<<shadowMeshes<<",\"blockAtlas2D\":true,\"presentationReady\":"<<(presentationReady?"true":"false")<<",\"presentationRevision\":"<<presentationRevision;
        const bool sourceCurrent=geometryFrame.serial&&geometryFrame.matches(cameraFrames,epoch,sourceOrigin)&&geometryFrame.current(sourceWidth,sourceHeight);
        s<<",\"sourceGpuParticleContract\":1,\"sourceGpuParticleDraws\":"<<gpuParticles.drawCalls<<",\"sourceGpuParticleBytes\":"<<gpuParticles.bytes();
        s<<",\"sourceFrameContract\":1,\"sourceFeetKnown\":"<<(sourceCurrent&&geometryFrame.feetKnown?"true":"false")<<",\"sourceEyeKnown\":"<<(sourceCurrent&&geometryFrame.eyeKnown?"true":"false")<<",\"sourceHandKnown\":"<<(sourceCurrent&&geometryFrame.observedHand.known?"true":"false");
        s<<",\"irisGeometryContract\":1,\"irisGeometryEnabled\":"<<(irisPlan&&irisPlan->programs?"true":"false");
        s<<",\"irisVertexContract\":1,\"irisContractComplete\":false,\"sourceAppearanceContract\":3,\"sourceDrawContract\":1,\"sourceParticleContract\":3,\"cameraHistoryValid\":"<<(cameraFrame.historyValid?"true":"false")<<",\"cameraOriginKnown\":"<<(originKnown?"true":"false");
        if(pixels&&width&&height){const size_t center=(static_cast<size_t>(height/2)*width+width/2)*4;size_t foreground=0;uint32_t hash=2166136261u;
            for(size_t i=0;i<pixels->size();i+=4){bool different=false;for(size_t c=0;c<3;++c){different|=(*pixels)[i+c]!=(*pixels)[c];hash=(hash^(*pixels)[i+c])*16777619u;}if(different)++foreground;}
            s<<",\"foregroundPixels\":"<<foreground<<",\"pixelHash\":"<<hash<<",\"centerRGBA\":[";for(size_t i=0;i<4;++i){if(i)s<<',';s<<static_cast<int>((*pixels)[center+i]);}s<<']';}
        s<<'}';return s.str();
    }
};
inline void run(GLFWwindow* window,const fs::path& output,const std::string& frameEndpoint={}){
    Renderer renderer;renderer.initialize();Pipe pipe;double reported=glfwGetTime();unsigned frames=0;
    FramePipe framePipe(frameEndpoint);FrameReadback readback;const bool embedded=!frameEndpoint.empty();
    glfwSetWindowTitle(window,"Bloxdy Client | Native preview | waiting for a Bloxd world");
    std::cout<<"BRIDGE_READY"<<std::endl;
    while(!glfwWindowShouldClose(window)&&!pipe.eof){
        const auto started=std::chrono::steady_clock::now();
        glfwPollEvents();const double receiveStart=glfwGetTime();pipe.poll([&](auto type,auto sequence,const auto& bytes){renderer.receive(type,sequence,bytes);});
        renderer.receiveMs=(glfwGetTime()-receiveStart)*1000;renderer.bufferedBytes=pipe.bufferedBytes();
        if(pipe.appliedPackets)nativegl::check("BND1 packet batch application");
        if(glfwGetKey(window,GLFW_KEY_ESCAPE)==GLFW_PRESS)break;
        int width=0,height=0;if(!embedded)glfwGetFramebufferSize(window,&width,&height);
        if(embedded){width=static_cast<int>(renderer.sourceWidth);height=static_cast<int>(renderer.sourceHeight);if(renderer.presentationReady)readback.poll(framePipe,renderer.epoch,renderer.presentationRevision);else readback.clear();}
        if(width<1||height<1){glfwWaitEventsTimeout(0.05);continue;}
        if(!embedded||renderer.presentationReady&&renderer.hasCamera){
            const double frameStart=glfwGetTime();renderer.render(0,width,height,!embedded);nativegl::check("Imported scene frame");renderer.frameMs=(glfwGetTime()-frameStart)*1000;
        }else {renderer.frameMs=0;renderer.visibleMeshes=renderer.pendingTextureMeshes=renderer.shadowMeshes=0;renderer.drawnTriangles=0;}
        if(embedded&&renderer.hasCamera&&renderer.presentationReady)readback.capture(renderer.targets.framebuffer,renderer.epoch,renderer.targets.width,renderer.targets.height,glfwGetTime(),renderer.presentationRevision);
        for(auto stage:renderer.snapshots){
            nativegl::glReadBuffer(GL_BACK);std::vector<unsigned char> pixels(static_cast<size_t>(width)*height*4);
            nativegl::glReadPixels(0,0,width,height,GL_RGBA,GL_UNSIGNED_BYTE,pixels.data());
            writePNG(output/("bridge-stage-"+std::to_string(stage)+".png"),width,height,pixels);
            std::cout<<"BRIDGE_STATUS "<<renderer.status(static_cast<int>(stage),&pixels,width,height)<<std::endl;
        }
        renderer.snapshots.clear();if(!embedded)glfwSwapBuffers(window);if(!embedded||renderer.presentationReady&&renderer.hasCamera)++frames;
        if(glfwGetTime()-reported>0.5){
            renderer.fps=frames/(glfwGetTime()-reported);frames=0;
            const auto status=renderer.status();std::ofstream(output/"bridge-status.json")<<status;
            std::cout<<"BRIDGE_STATUS "<<status<<std::endl;reported=glfwGetTime();
            const std::string title="Bloxdy Client | Native preview | "+std::to_string(static_cast<int>(renderer.fps))+" FPS | "+std::to_string(renderer.visibleMeshes)+" visible / "+std::to_string(renderer.meshes.size())+" meshes | "+std::to_string(renderer.pendingTextureMeshes)+" awaiting textures";
            glfwSetWindowTitle(window,title.c_str());
        }
        if(embedded)std::this_thread::sleep_until(started+std::chrono::milliseconds(17));
    }
}
}
