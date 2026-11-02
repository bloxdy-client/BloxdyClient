#pragma once
#include "bridge_appearance.hpp"

namespace bridge {
struct SourceParticleBatch {
    uint32_t count=0,order=0,mode=0,rampTexture=0,blend=0,wrapU=1,wrapV=1;bool sourceBlend=false;glm::vec2 pivot{0};glm::vec4 mask{1};
    std::vector<float> transforms,appearance;
    static SourceParticleBatch read(Reader& r,int version){
        const bool extended=version>=2;
        SourceParticleBatch out;out.count=r.u32();out.order=r.u32();if(extended)out.mode=r.u32();
        if(version==3){out.rampTexture=r.u32();out.blend=r.u32();out.wrapU=r.u32();out.wrapV=r.u32();out.sourceBlend=true;if(out.blend>5||out.wrapU>2||out.wrapV>2)throw std::runtime_error("Invalid source particle blend/wrap contract.");}
        if(out.count>8192||out.order>1000000||out.mode>4)throw std::runtime_error("Particle batch exceeds its source contract.");
        if(extended){for(int i=0;i<2;++i)out.pivot[i]=r.f32();for(int i=0;i<4;++i)out.mask[i]=r.f32();
            if(glm::any(glm::greaterThan(glm::abs(out.pivot),glm::vec2(16)))||glm::any(glm::lessThan(out.mask,glm::vec4(0)))||glm::any(glm::greaterThan(out.mask,glm::vec4(1))))throw std::runtime_error("Invalid source particle pivot/mask.");}
        const size_t stride=version==3?32:extended?28:20;const auto values=r.floats(static_cast<size_t>(out.count)*stride);r.finish();
        out.transforms.assign(static_cast<size_t>(out.count)*18,-1);out.appearance.assign(static_cast<size_t>(out.count)*36,0);
        for(size_t i=0;i<out.count;++i){const auto p=values.data()+i*stride;auto a=out.appearance.data()+i*36;
            if(p[3]!=0||p[7]!=0||p[11]!=0||p[15]!=1)throw std::runtime_error("Particle transform is not affine.");
            if(extended&&(p[2]!=0||p[6]!=0||p[8]!=0||p[9]!=0||p[10]!=1))throw std::runtime_error("Invalid source particle corner basis.");
            std::copy_n(p,16,out.transforms.data()+i*18);std::copy_n(p+16,4,a+8);std::fill_n(a+12,4,-1.0f);a[16]=1;a[22]=a[23]=a[27]=1;
            if(extended){
                const auto u=p+20;const float uEnd=u[0]+u[2],vEnd=u[1]+u[3];
                if(u[0]<0||u[0]>1||u[1]<0||u[1]>1||u[2]<=0||u[2]>1||u[3]==0||std::abs(u[3])>1||uEnd< -1e-5f||uEnd>1.00001f||vEnd< -1e-5f||vEnd>1.00001f||p[27]<=0||p[27]>1)throw std::runtime_error("Invalid source particle UV/inset.");
                if(out.mode>=2){const glm::vec3 direction(p[24],p[25],p[26]);if(glm::any(glm::greaterThan(glm::abs(direction),glm::vec3(1e16f)))||glm::length(direction)<1e-8f||(out.mode==4&&glm::length(glm::vec2(direction.x,direction.z))<1e-8f))throw std::runtime_error("Invalid source particle direction.");}
                std::copy_n(p+20,8,a+20);
            }
            a[29]=a[31]=1;
            if(version==3){if(out.rampTexture)for(size_t c=0;c<4;++c)if(std::abs(p[28+c])>64||((c==1||c==3)&&p[28+c]<=1e-8f))throw std::runtime_error("Invalid source particle remap range.");std::copy_n(p+28,4,a+28);}
        }
        SourceAppearance contract;contract.flags=16384;contract.validate(out.appearance);return out;
    }
};
inline glm::vec4 particleRampColor(glm::vec4 base,glm::vec4 ramp,glm::vec4 remap){const float alpha=base.a;return glm::vec4(glm::vec3(base)*glm::vec3(ramp),std::clamp((alpha*ramp.a-remap.z)/remap.w,0.f,1.f));}
inline float particleRampCoordinate(float alpha,glm::vec4 remap){return 1.f-std::clamp((alpha-remap.x)/remap.y,0.f,1.f);}
}
