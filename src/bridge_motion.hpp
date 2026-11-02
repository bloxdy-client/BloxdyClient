#pragma once
#include "bridge_camera.hpp"
#include <algorithm>
#include <new>
#include <vector>

namespace bridge {
static_assert(sizeof(glm::vec4)==16);
struct MotionBudget {
    static constexpr size_t limit=64ull*1024*1024;
    size_t used=0;
    bool reserve(size_t bytes){if(bytes>limit-used)return false;used+=bytes;return true;}
    void release(size_t bytes){used-=std::min(used,bytes);}
};
struct MotionSample {bool valid=false,posed=false;glm::mat4 previousWorld{1};};
struct MeshMotion {
    bool completed=false,poseDirty=false,poseAvailable=false,instancesDirty=false,wasInstanced=false,drawn=false;
    uint64_t lastFrame=0,poseGeneration=0;
    glm::mat4 completedWorld{1};glm::dvec3 completedOrigin{0};
    std::vector<glm::vec4> previousPose;
    MotionBudget* budget=nullptr;size_t reserved=0;
    MeshMotion()=default;
    MeshMotion(const MeshMotion&)=delete;MeshMotion& operator=(const MeshMotion&)=delete;
    ~MeshMotion(){release();}
    void release(){if(budget)budget->release(reserved);budget=nullptr;reserved=0;std::vector<glm::vec4>().swap(previousPose);completed=poseDirty=poseAvailable=instancesDirty=wasInstanced=drawn=false;poseGeneration=0;}
    void beforePose(const std::vector<float>& vertices,MotionBudget& owner){
        if(poseDirty)return;poseDirty=true;poseAvailable=false;if(!completed)return;
        const size_t count=vertices.size()/14,bytes=count*sizeof(glm::vec4)*2;
        if(!reserved){if(!owner.reserve(bytes))return;budget=&owner;reserved=bytes;}
        if(reserved!=bytes)return;
        try{previousPose.resize(count);}catch(const std::bad_alloc&){budget->release(reserved);budget=nullptr;reserved=0;return;}
        for(size_t i=0;i<count;++i)previousPose[i]=glm::vec4(vertices[i*14],vertices[i*14+1],vertices[i*14+2],1);
        poseAvailable=true;++poseGeneration;
    }
    MotionSample prepare(const CameraFrame& frame,bool instanced,size_t vertices)const{
        MotionSample out;
        if(!frame.historyValid||!completed||lastFrame+1!=frame.counter||instancesDirty||wasInstanced!=instanced||(poseDirty&&(!poseAvailable||previousPose.size()!=vertices)))return out;
        // Camera history is already expressed in the current floating origin.
        out.previousWorld=glm::translate(glm::mat4(1),glm::vec3(completedOrigin-frame.origin))*completedWorld;
        for(int i=0;i<16;++i)if(!std::isfinite(glm::value_ptr(out.previousWorld)[i]))return MotionSample{};
        out.valid=true;out.posed=poseDirty;return out;
    }
    void commit(const CameraFrame& frame,const glm::mat4& world,bool instanced){
        completed=true;lastFrame=frame.counter;completedWorld=world;completedOrigin=frame.origin;wasInstanced=instanced;
        poseDirty=poseAvailable=instancesDirty=drawn=false;
    }
};
inline glm::vec4 backwardMotion(glm::vec4 current,glm::vec4 previous,bool valid){
    if(!valid||current.w<=1e-8f||previous.w<=1e-8f)return glm::vec4(0);
    const auto a=glm::vec3(current)/current.w,b=glm::vec3(previous)/previous.w;
    if(!std::isfinite(a.x)||!std::isfinite(a.y)||!std::isfinite(a.z)||!std::isfinite(b.x)||!std::isfinite(b.y)||!std::isfinite(b.z))return glm::vec4(0);
    if(glm::any(glm::lessThan(b,glm::vec3(-1)))||glm::any(glm::greaterThan(b,glm::vec3(1))))return glm::vec4(0);
    return glm::vec4((b.x-a.x)*.5f,(b.y-a.y)*.5f,b.z*.5f+.5f,1);
}
}
