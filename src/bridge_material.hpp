#pragma once
#include "bridge_protocol.hpp"
#include <glm/glm.hpp>
#include <glm/gtc/type_ptr.hpp>

namespace bridge {
struct MaterialDrawState {
    enum Flag : uint32_t { Cull=1, Clockwise=2, CullFront=4, DepthWrite=8, TextureAlpha=16, TwoSided=32, Fog=64 };
    uint32_t flags=DepthWrite|TextureAlpha|Fog,depthFunction=0,blendMode=0,wrapU=1,wrapV=1;
    glm::mat4 uv{1};float textureLevel=1;
    static MaterialDrawState read(Reader& r){
        MaterialDrawState out;out.flags=r.u32();out.depthFunction=r.u32();out.blendMode=r.u32();out.wrapU=r.u32();out.wrapV=r.u32();
        for(int i=0;i<16;++i)glm::value_ptr(out.uv)[i]=r.f32();out.textureLevel=r.f32();r.finish();
        if(out.flags>127||(out.depthFunction&&(out.depthFunction<GL_NEVER||out.depthFunction>GL_ALWAYS))||(out.blendMode>8||out.blendMode==5)||out.wrapU>2||out.wrapV>2||out.textureLevel<0)
            throw std::runtime_error("Invalid native material draw state.");
        return out;
    }
    glm::vec2 textureCoordinates(const glm::vec2& input)const{return glm::vec2(uv*glm::vec4(input,1,0));}
    GLenum depth(bool reverse)const{return depthFunction?depthFunction:reverse?GL_GEQUAL:GL_LEQUAL;}
    static GLenum wrap(uint32_t value){return value==0?GL_CLAMP_TO_EDGE:value==2?GL_MIRRORED_REPEAT:GL_REPEAT;}
    void apply(bool shadow,bool sky,bool reverse,bool blended)const{
        if(flags&Cull)nativegl::glEnable(GL_CULL_FACE);else nativegl::glDisable(GL_CULL_FACE);
        nativegl::glFrontFace(flags&Clockwise?GL_CW:GL_CCW);nativegl::glCullFace(flags&CullFront?GL_FRONT:GL_BACK);
        nativegl::glDepthFunc(shadow?GL_LESS:depth(reverse));nativegl::glDepthMask(shadow||!sky&&(flags&DepthWrite)?GL_TRUE:GL_FALSE);
        if(!shadow&&!sky&&blended&&blendMode){nativegl::glEnable(GL_BLEND);const bool additive=blendMode==1||blendMode==6;
            nativegl::glBlendFuncSeparate(blendMode==3?GL_ZERO:blendMode==4?GL_DST_COLOR:blendMode==1||blendMode==2?GL_SRC_ALPHA:GL_ONE,blendMode==3?GL_ONE_MINUS_SRC_COLOR:blendMode==4?GL_ZERO:additive?GL_ONE:GL_ONE_MINUS_SRC_ALPHA,additive?GL_ZERO:GL_ONE,blendMode==8?GL_ONE_MINUS_SRC_ALPHA:GL_ONE);}
        else nativegl::glDisable(GL_BLEND);
    }
};
}
