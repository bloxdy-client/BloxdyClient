#pragma once
#include "bridge_protocol.hpp"
#include <glm/glm.hpp>

namespace bridge {
struct SourceAppearance {
    uint32_t flags=0,columns=1,rows=1,layers=0,directions=0;
    std::vector<float> uniforms=std::vector<float>(32,0);
    static SourceAppearance read(Reader& r){
        SourceAppearance out;out.flags=r.u32();out.columns=r.u32();out.rows=r.u32();out.layers=r.u32();out.directions=r.u32();
        if(out.flags>32767||((out.flags&8192)&&!(out.flags&2048))||!out.columns||out.columns>256||!out.rows||out.rows>256||out.layers>8||((out.flags&1)&&!out.layers)||((out.flags&256)&&(out.layers!=1||out.rows!=1||(out.flags&1)))||out.directions>4)throw std::runtime_error("Invalid source appearance contract.");
        const auto values=r.floats(16+out.directions*4);r.finish();
        for(size_t i=0;i<10;++i)if(values[i]<0)throw std::runtime_error("Negative source lighting uniform.");
        if(values[14]<0||values[14]>1||values[15]<0||values[15]>1)throw std::runtime_error("Invalid source fade opacity.");
        for(size_t i=19;i<values.size();i+=4)if(values[i]<0)throw std::runtime_error("Negative source directional intensity.");
        std::copy(values.begin(),values.end(),out.uniforms.begin());return out;
    }
    void validate(const std::vector<float>& records)const{
        if(records.size()%36)throw std::runtime_error("Invalid source appearance record size.");
        for(size_t at=0;at<records.size();at+=36){
            if(flags&(1|256))for(uint32_t i=0;i<layers;++i)if(records[at+i]<0||records[at+i]>=columns*rows||std::floor(records[at+i])!=records[at+i])throw std::runtime_error("Source cosmetic atlas index outside its grid.");
            if(flags&1024)for(size_t i=0;i<6;++i)if(records[at+i]<0||records[at+i]>2047||std::floor(records[at+i])!=records[at+i])throw std::runtime_error("Invalid per-face atlas index.");
            if(flags&256)for(size_t i=17;i<20;++i)if(records[at+i]<0||records[at+i]>1)throw std::runtime_error("Invalid armour tint.");
            if(flags&512)for(size_t i=20;i<24;++i)if(records[at+i]<0||records[at+i]>1)throw std::runtime_error("Invalid hue colour.");
            if(flags&2048){for(size_t i=24;i<27;++i)if(records[at+i]<0||records[at+i]>1)throw std::runtime_error("Invalid enchantment colour.");if(std::abs(records[at+27])>1024)throw std::runtime_error("Invalid enchantment speed.");}
            for(size_t i=8;i<12;++i)if(records[at+i]<0||records[at+i]>((flags&16384)&&i<11?64:1))throw std::runtime_error("Invalid source overlay/particle colour.");
            if(flags&16)for(size_t i=12;i<16;++i)if(records[at+i]<0||records[at+i]>1)throw std::runtime_error("Invalid source entity light.");
            if(records[at+16]<0||records[at+16]>1)throw std::runtime_error("Invalid source opacity.");
        }
    }
};
inline float bayerThreshold(int x,int y){constexpr int pattern[16]={1,9,3,11,13,5,15,7,4,12,2,10,16,8,14,6};return pattern[((y%4+4)%4)*4+(x%4+4)%4]/16.0f;}
inline glm::vec4 compositeLifeform(const std::vector<glm::vec4>& layers){
    if(layers.empty())return glm::vec4(0);auto result=layers.back();result.r*=result.a;result.g*=result.a;result.b*=result.a;
    for(size_t i=layers.size()-1;i>0;--i){const auto color=layers[i-1];result=glm::vec4(glm::mix(glm::vec3(result),glm::vec3(color),color.a),color.a+result.a*(1-color.a));}
    return glm::vec4(glm::vec3(result)/std::max(result.a,.001f),result.a);
}
}
