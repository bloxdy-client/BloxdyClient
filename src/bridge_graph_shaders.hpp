#pragma once
namespace bridge {
// Controlled, linked engine-program fixtures for the graph contract. These are
// not installed effects or a pack loader. CPU mocks test resource transitions;
// the GLSL compiler independently checks their sampler/image/SSBO interfaces.
inline constexpr const char* graphComputeSource=R"GLSL(#version 430 core
layout(local_size_x=8,local_size_y=4,local_size_z=1) in;
layout(rgba16f,binding=0) writeonly uniform image2D resultImage;
layout(std430,binding=0) buffer Statistics { uint pixelCount; uint dispatchX; uint dispatchY; uint dispatchZ; };
void main(){
    ivec2 point=ivec2(gl_GlobalInvocationID.xy),size=imageSize(resultImage);
    if(any(greaterThanEqual(point,size)))return;
    imageStore(resultImage,point,vec4((vec2(point)+.5)/vec2(size),0,1));
    atomicAdd(pixelCount,1u);
    if(all(equal(point,ivec2(0)))){dispatchX=1u;dispatchY=1u;dispatchZ=1u;}
}
)GLSL";
inline constexpr const char* graphFragmentSource=R"GLSL(#version 430 core
in vec2 screenUV;
uniform sampler2D colorInput,opaqueDepth,worldDepth;
layout(location=0) out vec4 color;
void main(){
    vec4 source=texture(colorInput,screenUV);
    float handCoverage=step(texture(opaqueDepth,screenUV).r,texture(worldDepth,screenUV).r);
    color=vec4(source.rgb,source.a*handCoverage);
}
)GLSL";
inline constexpr const char* graphIntegerFragmentSource=R"GLSL(#version 430 core
in vec2 screenUV;
uniform usampler2D integerInput;
layout(r32ui,binding=0) uniform uimage2D counterImage;
layout(std430,binding=0) buffer Statistics { uint writes; };
layout(location=0) out uvec4 color;
void main(){
    color=texture(integerInput,screenUV);
    imageAtomicAdd(counterImage,ivec2(0),1u);atomicAdd(writes,1u);
}
)GLSL";
}
