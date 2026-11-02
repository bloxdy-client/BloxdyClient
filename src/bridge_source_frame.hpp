#pragma once
#include "bridge_protocol.hpp"
#include "bridge_geometry_contract.hpp"

namespace bridge {
struct SourceFrameData {
    uint32_t flags=0,width=0,height=0;
    glm::mat4 view{1},projection{1};glm::vec3 camera{0};glm::vec4 clear{0};
    IrisGeometryFrame geometry;
    bool fresh=false;
    static SourceFrameData read(Reader& r){
        SourceFrameData n;auto& g=n.geometry;
        const auto require=[](bool ok){if(!ok)throw std::runtime_error("Invalid authoritative source frame.");};
        require(r.u32()==1);n.flags=r.u32();n.width=r.u32();n.height=r.u32();g.serial=r.u32();g.cameraIdentity=r.u32();g.rootIdentity=r.u32();
        g.playerEntity=r.u32();g.playerIdentity=r.u32();g.originIdentity=r.u32();g.renderFrame=r.u32();const auto group=r.u32();
        const bool player=(n.flags&8)!=0,hand=(n.flags&16)!=0,sampled=(n.flags&32)!=0;
        require(n.flags<=63&&n.width&&n.height&&n.width<=32768&&n.height<=32768&&g.serial&&g.cameraIdentity&&g.rootIdentity);
        require(((n.flags&4)!=0)==player&&(!player||sampled)&&(!hand||player)&&
            (player?(g.playerEntity&&g.playerIdentity&&g.originIdentity):(!g.playerEntity&&!g.playerIdentity&&!g.originIdentity))&&
            (hand?(group>=2&&group<=4):group==0)&&(sampled||g.renderFrame==0));
        const auto matrix=[&](){glm::mat4 m;for(int i=0;i<16;++i)glm::value_ptr(m)[i]=r.f32();CameraHistory::checkedInverse(m);return m;};
        n.view=matrix();n.projection=matrix();for(int i=0;i<3;++i)n.camera[i]=r.f32();for(int i=0;i<4;++i)n.clear[i]=r.f32();
        const auto utc=r.f64(),age=r.f64();require(utc>=0&&age>=0);
        const double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();
        const double elapsed=std::max(age,now-utc);n.fresh=sampled&&utc<=now+10&&elapsed<=250;
        g.expires=std::chrono::steady_clock::now()+std::chrono::duration_cast<std::chrono::steady_clock::duration>(std::chrono::duration<double,std::milli>(n.fresh?250-elapsed:0));
        if(player){for(auto* v:{&g.origin,&g.feet,&g.eye})for(int i=0;i<3;++i){(*v)[i]=r.f64();require(std::abs((*v)[i])<=4503599627370496.0);}
            for(const auto v:{g.feet-g.origin,g.eye-g.origin})require(glm::all(glm::lessThanEqual(glm::abs(v),glm::dvec3(16777216.0))));
            g.feetKnown=g.eyeKnown=n.fresh;
        }
        const auto checkEye=[&](const glm::mat4& v,const glm::vec3& eye){
            require(std::abs(v[0][3])+std::abs(v[1][3])+std::abs(v[2][3])+std::abs(v[3][3]-1)<1e-5f);
            require(glm::length(glm::vec3(v*glm::vec4(eye,1)))<=.05f);
        };
        if(sampled)checkEye(n.view,n.camera);
        if(hand){auto& h=g.observedHand;h.view=matrix();h.sourceProjection=matrix();for(int i=0;i<3;++i)h.camera[i]=r.f32();
            checkEye(h.view,h.camera);h.width=n.width;h.height=n.height;h.group=static_cast<int>(group)-1;h.halfZ=(n.flags&1)!=0;h.known=n.fresh;
        }
        r.finish();g.width=n.width;g.height=n.height;return n;
    }
};
}
