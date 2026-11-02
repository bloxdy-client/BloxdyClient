#pragma once
#include "bridge_protocol.hpp"
#include "bridge_camera.hpp"
#include <limits>

namespace bridge {
struct SourceDrawState {
    enum Flag : uint32_t { Camera=1, ClearDepth=2, HalfZ=4, Hand=8, Center=16, MaterialSort=32, DistanceSort=64, FrontSort=128 };
    int group=0;uint32_t flags=0,order=0,part=0;
    double alpha=std::numeric_limits<double>::max(),sort=0;
    glm::mat4 view{1},projection{1},inverseView{1};glm::vec3 camera{0},center{0};
    static SourceDrawState read(Reader& r){
        SourceDrawState out;const auto encodedGroup=r.u32();out.flags=r.u32();out.order=r.u32();out.part=r.u32();
        const auto sorting=out.flags&(MaterialSort|DistanceSort|FrontSort);
        if(encodedGroup>4||out.flags>255||(sorting&&(sorting&(sorting-1)))||out.order>1000000||out.part>1000000||((out.flags&(HalfZ|Hand))&&!(out.flags&Camera)))throw std::runtime_error("Invalid source draw group/camera flags.");
        out.group=static_cast<int>(encodedGroup)-1;
        if(((out.flags&Hand)&&out.group<=0)||(out.group<0&&(out.flags&ClearDepth)))throw std::runtime_error("Source hand/depth reset needs an isolated render group.");
        if(out.flags&Camera){
            for(int i=0;i<16;++i)glm::value_ptr(out.view)[i]=r.f32();
            for(int i=0;i<16;++i)glm::value_ptr(out.projection)[i]=r.f32();
            for(int i=0;i<3;++i)out.camera[i]=r.f32();
            if(out.flags&HalfZ)for(int c=0;c<4;++c)out.projection[c][2]=2*out.projection[c][2]-out.projection[c][3];
            out.inverseView=CameraHistory::checkedInverse(out.view);CameraHistory::checkedInverse(out.projection);
        }
        if(out.flags&Center)for(int i=0;i<3;++i)out.center[i]=r.f32();
        out.alpha=r.f64();out.sort=r.f64();r.finish();if(out.sort<0||out.sort>9007199254740991.0||std::floor(out.sort)!=out.sort)throw std::runtime_error("Invalid source material sort ID.");return out;
    }
    void rebase(const glm::vec3& shift){
        if(flags&Camera){view=view*glm::translate(glm::mat4(1),-shift);inverseView=glm::translate(glm::mat4(1),shift)*inverseView;camera+=shift;}
        if(flags&Center)center+=shift;
    }
};
}
