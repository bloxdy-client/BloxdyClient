#pragma once
namespace bridge {
// Internal linked-program validation fixtures. Never installed as a production
// recipe. Core-profile equivalent of the reference model/view/projection ABI.
inline constexpr const char* geometryVertexSource=R"GLSL(#version 430 core
layout(location=0) in vec3 vaPosition;
layout(location=1) in vec3 vaNormal;
layout(location=2) in vec2 vaUV0;
layout(location=3) in vec4 vaColor;
layout(location=6) in mat4 sourceInstanceMatrix;
uniform mat4 modelViewMatrix,projectionMatrix,textureMatrix;
uniform mat3 normalMatrix;
uniform int sourceInstanced;
out vec2 texcoord;out vec4 tint;out vec3 normal;
void main(){
    mat4 instance=sourceInstanced!=0?sourceInstanceMatrix:mat4(1.0);
    gl_Position=projectionMatrix*modelViewMatrix*instance*vec4(vaPosition,1.0);
    normal=normalize(normalMatrix*transpose(inverse(mat3(instance)))*vaNormal);
    texcoord=(textureMatrix*vec4(vaUV0,0.0,1.0)).xy;tint=vaColor;
}
)GLSL";
inline constexpr const char* geometryFragmentSource=R"GLSL(#version 430 core
in vec2 texcoord;in vec4 tint;in vec3 normal;
uniform sampler2D gtexture;uniform float alphaTestRef;
layout(location=0) out vec4 outColor;layout(location=1) out vec4 outNormal;
void main(){vec4 color=texture(gtexture,texcoord)*tint;if(color.a<alphaTestRef)discard;
    outColor=color;outNormal=vec4(normalize(normal)*.5+.5,1.0);}
)GLSL";
// Explicit source-atlas adapter. A partial quad midpoint uses the same affine
// tile transform as UV0. No Bloxd surface number is exposed as mc_Entity.
inline constexpr const char* geometryAtlasVertexSource=R"GLSL(#version 430 core
layout(location=0) in vec3 vaPosition;
layout(location=1) in vec3 vaNormal;
layout(location=2) in vec2 sourceUV;
layout(location=3) in vec4 vaColor;
layout(location=4) in float sourceLayer;
layout(location=6) in mat4 sourceInstanceMatrix;
layout(location=10) in vec2 sourceInstanceExtras;
layout(location=12) in vec4 at_tangent;
layout(location=13) in vec2 sourceMidTexCoord;
layout(location=14) in vec4 sourceMidBlock;
layout(location=15) in ivec2 sourceLightmap;
uniform mat4 modelViewMatrix,projectionMatrix,textureMatrix;
uniform mat3 normalMatrix;uniform int sourceInstanced;
uniform ivec2 atlasGrid,atlasTile;
out vec2 texcoord;out vec4 tint;out vec3 normal;
out vec4 adapterTangent;out vec2 adapterMidpoint;out vec4 adapterMidBlock;out vec2 adapterLightmap;
vec2 atlas(vec2 uv,float layer){vec2 tile=vec2(mod(layer,float(atlasGrid.x)),floor(layer/float(atlasGrid.x)));
    return (tile*(vec2(atlasTile)+2.0)+1.0+uv*vec2(atlasTile))/(vec2(atlasGrid)*(vec2(atlasTile)+2.0));}
void main(){
    mat4 instance=sourceInstanced!=0?sourceInstanceMatrix:mat4(1.0);
    mat3 n=normalMatrix*transpose(inverse(mat3(instance)));
    float layer=sourceInstanced!=0&&sourceInstanceExtras.x>=0.0?sourceInstanceExtras.x:sourceLayer;
    gl_Position=projectionMatrix*modelViewMatrix*instance*vec4(vaPosition,1.0);
    normal=normalize(n*vaNormal);tint=vaColor;
    texcoord=atlas((textureMatrix*vec4(sourceUV,0,1)).xy,layer);
    adapterMidpoint=atlas((textureMatrix*vec4(sourceMidTexCoord,0,1)).xy,layer);
    vec3 tangent=mat3(modelViewMatrix*instance)*at_tangent.xyz;
    tangent=normalize(tangent-normal*dot(tangent,normal));
    adapterTangent=vec4(tangent,at_tangent.w*sign(determinant(mat3(modelViewMatrix*instance))));
    adapterMidBlock=vec4(mat3(instance)*sourceMidBlock.xyz,sourceMidBlock.w);
    ivec2 raw=sourceLightmap;
    if(sourceInstanced!=0&&sourceInstanceExtras.y>=0.0){uint bits=uint(round(sourceInstanceExtras.y));
        raw=ivec2(max(max(bits&15u,(bits>>4u)&15u),(bits>>8u)&15u)*16u,(bits>>12u)*16u);}
    adapterLightmap=(vec2(raw)+8.0)/256.0;
}
)GLSL";
inline constexpr const char* geometryAtlasFragmentSource=R"GLSL(#version 430 core
in vec2 texcoord;in vec4 tint;in vec3 normal;
in vec4 adapterTangent;in vec2 adapterMidpoint;in vec4 adapterMidBlock;in vec2 adapterLightmap;
uniform sampler2D gtexture;uniform float alphaTestRef;
layout(location=0) out vec4 outColor;layout(location=1) out vec4 outNormal;
layout(location=2) out vec4 outTangent;layout(location=3) out vec4 outAdapter;layout(location=4) out vec4 outMidBlock;
void main(){vec4 color=texture(gtexture,texcoord)*tint;if(color.a<alphaTestRef)discard;
    outColor=color;outNormal=vec4(normalize(normal)*.5+.5,1);
    outTangent=adapterTangent;outAdapter=vec4(adapterMidpoint,adapterLightmap);outMidBlock=adapterMidBlock;}
)GLSL";
}

namespace bridge {
// Internal binding probe, never a production lighting recipe. Every source
// value contributes to an output; no source RGB is named a reference lightmap.
inline constexpr const char* geometryLightFragmentSource=R"GLSL(#version 430 core
in vec2 texcoord;in vec4 tint;in vec3 normal;
uniform sampler2D gtexture;uniform float alphaTestRef;
uniform int sourceLightingEnabled;
uniform bool sourceEnabledKnown,sourceColorsKnown,sourceHeldKnown,sourceSunKnown;
uniform vec3 sourceSkyLight,sourceAmbientLight,sourceSkySunDirection;
uniform vec4 sourceHeldLight,sourceHeldVector;
layout(location=0) out vec4 outColor;layout(location=1) out vec4 outProbe;
void main(){vec4 color=texture(gtexture,texcoord)*tint;if(color.a<alphaTestRef)discard;
    outColor=color;
    vec3 probe=sourceColorsKnown?sourceSkyLight+sourceAmbientLight:vec3(0);
    if(sourceHeldKnown)probe+=sourceHeldLight.rgb+sourceHeldVector.xyz+vec3(sourceHeldLight.w+sourceHeldVector.w);
    if(sourceSunKnown)probe+=sourceSkySunDirection*dot(normal,sourceSkySunDirection);
    outProbe=vec4(probe,sourceEnabledKnown?float(sourceLightingEnabled):0.0);}
)GLSL";
// Explicit source-data output for an internal geometry program. RGB stays in
// source 0..15 units; alpha is validity, not a Minecraft scalar conversion.
inline constexpr const char* geometryOwnEmissionFragmentSource=R"GLSL(#version 430 core
in vec2 texcoord;in vec4 tint;in vec3 normal;
uniform sampler2D gtexture;uniform float alphaTestRef;
uniform vec3 sourceOwnEmissionRgb;uniform bool sourceOwnEmissionKnown;
layout(location=0) out vec4 outColor;
layout(location=1) out vec4 outSourceOwnEmission;
void main(){vec4 color=texture(gtexture,texcoord)*tint;if(color.a<alphaTestRef)discard;
    outColor=color;
    outSourceOwnEmission=sourceOwnEmissionKnown?vec4(sourceOwnEmissionRgb,1):vec4(0);}
)GLSL";
// Raw source identity probe. The integer is a draw constant, not mc_Entity.
inline constexpr const char* geometrySourceBlockFragmentSource=R"GLSL(#version 430 core
in vec2 texcoord;in vec4 tint;in vec3 normal;
uniform sampler2D gtexture;uniform float alphaTestRef;
uniform int sourceBlockId;uniform bool sourceBlockKnown;
layout(location=0) out vec4 outColor;
layout(location=1) out vec4 outSourceBlock;
void main(){vec4 color=texture(gtexture,texcoord)*tint;if(color.a<alphaTestRef)discard;
    outColor=color;outSourceBlock=sourceBlockKnown?vec4(float(sourceBlockId),0,0,1):vec4(0);}
)GLSL";
inline constexpr const char* geometrySourceMaterialFragmentSource=R"GLSL(#version 430 core
in vec2 texcoord;in vec4 tint;in vec3 normal;
uniform sampler2D gtexture;uniform float alphaTestRef;
uniform int sourceBlockRootId,sourceBlockProperties;
uniform vec3 sourceBlockState;uniform bool sourceMaterialKnown;
layout(location=0) out vec4 outColor;layout(location=1) out vec4 outSourceMaterial;
void main(){vec4 color=texture(gtexture,texcoord)*tint;if(color.a<alphaTestRef)discard;outColor=color;
    outSourceMaterial=sourceMaterialKnown?vec4(float(sourceBlockRootId),float(sourceBlockProperties),dot(sourceBlockState,vec3(1,8,32)),1):vec4(0);}
)GLSL";
// Exact integer pack ID probe; split into 16-bit words only for float output.
inline constexpr const char* geometryPackBlockFragmentSource=R"GLSL(#version 430 core
in vec2 texcoord;in vec4 tint;in vec3 normal;
uniform sampler2D gtexture;uniform float alphaTestRef;
uniform int packBlockId;uniform bool packBlockKnown;
layout(location=0) out vec4 outColor;layout(location=1) out vec4 outPackBlock;
void main(){vec4 color=texture(gtexture,texcoord)*tint;if(color.a<alphaTestRef)discard;outColor=color;
    uint bits=uint(packBlockId);outPackBlock=packBlockKnown?vec4(float(bits&65535u),float(bits>>16u),0,1):vec4(0);}
)GLSL";
}
