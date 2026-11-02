#pragma once
#include "bridge_camera.hpp"
#include <array>
#include <utility>

namespace bridge {
struct HistorySample {
    GLuint color=0,opaqueDepth=0;
    int width=0,height=0;
    uint64_t frame=0;
    bool valid=false,reverseDepth=false;
};

// Two slots keep a failed in-progress frame from replacing completed history.
// These are native world buffers, not an Iris colortex/depthtex assignment.
class FrameHistory {
    struct Slot {GLuint framebuffer=0,color=0,depth=0;};
    std::array<Slot,2> slots{};
    size_t completed=0;
    bool valid=false,staged=false,stagedReverse=false,completedReverse=false;
    uint64_t stagedFrame=0,completedFrame=0;
    int width=0,height=0;
public:
    static constexpr uint64_t bytesPerPixel=24;
    uint64_t allocations=0,commits=0;
    FrameHistory()=default;
    FrameHistory(const FrameHistory&)=delete;
    FrameHistory& operator=(const FrameHistory&)=delete;
    ~FrameHistory(){release();}
    bool allocated()const{return slots[0].framebuffer!=0;}
    void invalidate(){valid=false;staged=false;}
    void release(){
        for(auto& slot:slots){
            if(slot.framebuffer)nativegl::glDeleteFramebuffers(1,&slot.framebuffer);
            if(slot.color)nativegl::glDeleteTextures(1,&slot.color);
            if(slot.depth)nativegl::glDeleteTextures(1,&slot.depth);
            slot={};
        }
        width=height=0;completed=0;invalidate();
    }
    void swap(FrameHistory& other){
        slots.swap(other.slots);std::swap(completed,other.completed);std::swap(valid,other.valid);std::swap(staged,other.staged);
        std::swap(stagedReverse,other.stagedReverse);std::swap(completedReverse,other.completedReverse);
        std::swap(stagedFrame,other.stagedFrame);std::swap(completedFrame,other.completedFrame);
        std::swap(width,other.width);std::swap(height,other.height);
    }
    void allocate(int w,int h){
        if(allocated()&&width==w&&height==h)return;
        GLint limit=0;nativegl::glGetIntegerv(GL_MAX_TEXTURE_SIZE,&limit);
        if(w<1||h<1||w>limit||h>limit||static_cast<uint64_t>(w)*h*bytesPerPixel>512ull*1024*1024)
            throw std::runtime_error("Native frame history exceeds its texture or memory budget.");
        FrameHistory next;next.width=w;next.height=h;
        nativegl::glActiveTexture(GL_TEXTURE0);
        for(auto& slot:next.slots){
            nativegl::glGenFramebuffers(1,&slot.framebuffer);nativegl::glBindFramebuffer(GL_FRAMEBUFFER,slot.framebuffer);
            auto texture=[&](GLuint& handle,GLint format,GLenum layout,GLenum attachment){
                nativegl::glGenTextures(1,&handle);nativegl::glBindTexture(GL_TEXTURE_2D,handle);
                nativegl::glTexImage2D(GL_TEXTURE_2D,0,format,w,h,0,layout,GL_FLOAT,nullptr);
                nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);
                nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
                nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);
                nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
                nativegl::glFramebufferTexture2D(GL_FRAMEBUFFER,attachment,GL_TEXTURE_2D,handle,0);
            };
            texture(slot.color,GL_RGBA16F,GL_RGBA,GL_COLOR_ATTACHMENT0);
            texture(slot.depth,GL_DEPTH_COMPONENT32F,GL_DEPTH_COMPONENT,GL_DEPTH_ATTACHMENT);
            nativegl::glDrawBuffer(GL_COLOR_ATTACHMENT0);nativegl::glReadBuffer(GL_COLOR_ATTACHMENT0);
            if(nativegl::glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)
                throw std::runtime_error("Native history framebuffer is incomplete.");
        }
        nativegl::check("Native frame history allocation");swap(next);++allocations;
    }
    HistorySample previous(const CameraFrame& frame,bool reverse)const{
        if(!allocated()||!valid||!frame.historyValid||width!=frame.width||height!=frame.height||
            completedFrame+1!=frame.counter||completedReverse!=reverse)return {};
        const auto& slot=slots[completed];return {slot.color,slot.depth,width,height,completedFrame,true,completedReverse};
    }
    void begin(const CameraFrame& frame,bool reverse){
        staged=false;
        if(!previous(frame,reverse).valid)valid=false;
    }
    void stageWorld(GLuint scene,GLuint opaque,const CameraFrame& frame,bool reverse){
        if(!allocated())return;
        if(width!=frame.width||height!=frame.height||!scene||!opaque)
            throw std::runtime_error("Native history source dimensions or framebuffers disagree.");
        staged=false;const auto& slot=slots[1-completed];
        if(scene==slot.framebuffer||opaque==slot.framebuffer)
            throw std::runtime_error("Native history cannot copy into its source framebuffer.");
        nativegl::glBindFramebuffer(GL_DRAW_FRAMEBUFFER,slot.framebuffer);
        nativegl::glDrawBuffer(GL_COLOR_ATTACHMENT0);
        nativegl::glBindFramebuffer(GL_READ_FRAMEBUFFER,scene);nativegl::glReadBuffer(GL_COLOR_ATTACHMENT0);
        nativegl::glBlitFramebuffer(0,0,width,height,0,0,width,height,GL_COLOR_BUFFER_BIT,GL_NEAREST);
        nativegl::glBindFramebuffer(GL_READ_FRAMEBUFFER,opaque);
        nativegl::glBlitFramebuffer(0,0,width,height,0,0,width,height,GL_DEPTH_BUFFER_BIT,GL_NEAREST);
        nativegl::glBindFramebuffer(GL_FRAMEBUFFER,scene);
        nativegl::check("Native world history copy");
        stagedFrame=frame.counter;stagedReverse=reverse;staged=true;
    }
    void commit(const CameraFrame& frame){
        if(!staged)return;
        if(stagedFrame!=frame.counter)throw std::runtime_error("Native history commit does not match its staged frame.");
        completed=1-completed;completedFrame=stagedFrame;completedReverse=stagedReverse;valid=true;staged=false;++commits;
    }
};
}
