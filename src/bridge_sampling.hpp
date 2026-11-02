#pragma once
#include "bridge_protocol.hpp"

namespace bridge {
struct TextureSampler {
    uint32_t min=GL_NEAREST,mag=GL_NEAREST;bool mipmaps=false;
    static TextureSampler read(Reader& r){
        TextureSampler out;out.min=r.u32();out.mag=r.u32();const auto flags=r.u32();r.finish();
        const bool mip=out.min>=GL_NEAREST_MIPMAP_NEAREST&&out.min<=GL_LINEAR_MIPMAP_LINEAR;
        if(flags>1||(!mip&&out.min!=GL_NEAREST&&out.min!=GL_LINEAR)||(out.mag!=GL_NEAREST&&out.mag!=GL_LINEAR)||mip!=(flags==1))throw std::runtime_error("Invalid texture sampler contract.");
        out.mipmaps=mip;return out;
    }
    void apply(GLenum target)const{
        nativegl::glTexParameteri(target,GL_TEXTURE_MIN_FILTER,min);nativegl::glTexParameteri(target,GL_TEXTURE_MAG_FILTER,mag);
    }
    static void validateBudget(uint32_t w,uint32_t h,uint32_t layers,bool mips){
        uint64_t bytes=static_cast<uint64_t>(w)*h*layers*4;
        while(mips&&(w>1||h>1)){w=std::max(1u,w/2);h=std::max(1u,h/2);bytes+=static_cast<uint64_t>(w)*h*layers*4;}
        if(bytes>256ull*1024*1024)throw std::runtime_error("Texture mip chain exceeds 256 MiB budget.");
    }
};
struct TextureAnimation {
    float tick=0,stride=1;std::vector<float> parameters;
    static TextureAnimation read(Reader& r){
        TextureAnimation out;const auto count=r.u32();if(count>2049)throw std::runtime_error("Atlas animation table exceeds its limit.");
        out.tick=r.f32();out.stride=r.f32();const auto input=r.floats(static_cast<size_t>(count)*3);r.finish();
        if(out.tick<0||out.stride<=0)throw std::runtime_error("Invalid atlas animation clock.");out.parameters.resize(static_cast<size_t>(count)*4,0);
        for(size_t i=0;i<count;++i){const auto mask=input[i*3],start=input[i*3+1],interval=input[i*3+2];
            if(mask<0||mask>2048||std::floor(mask)!=mask||start<0||start>2048||std::floor(start)!=start||interval<0)throw std::runtime_error("Invalid atlas animation parameters.");
            std::copy_n(input.data()+i*3,3,out.parameters.data()+i*4);}
        return out;
    }
    void validate(uint32_t layers)const{if(!layers)return;for(size_t i=0;i<parameters.size();i+=4)if(parameters[i]>0&&parameters[i]+parameters[i+1]>layers)throw std::runtime_error("Animated layer exceeds texture storage.");}
    float layer(float base)const{
        if(parameters.empty())return base;const auto at=4*std::min(parameters.size()/4-1,static_cast<size_t>(std::max(0.0f,std::floor(base))));
        const float state=std::fmod(std::floor((stride/std::max(stride,parameters[at+2]))*tick),parameters[at]+1);
        return state<1?base:parameters[at+1]+state-1;
    }
};
}
