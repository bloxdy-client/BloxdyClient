#pragma once
#include <array>
#include <cstdint>
#include <utility>
#include "bridge_history.hpp"

namespace bridge {
inline constexpr const char* compositeVertexSource=R"GLSL(#version 430 core
out vec2 screenUV;
void main(){
    vec2 corner=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
    screenUV=corner;gl_Position=vec4(corner*2.0-1.0,0.0,1.0);
}
)GLSL";
inline constexpr const char* compositeFragmentSource=R"GLSL(#version 430 core
in vec2 screenUV;
uniform sampler2D sceneColor;
layout(location=0) out vec4 color;
void main(){color=texture(sceneColor,screenUV);}
)GLSL";

// Native buffer contract, not an assertion of any pack's colortex layout.
struct FrameTargets {
    enum Color : size_t { Scene=0, Albedo=1, Normal=2, Light=3, Surface=4, Motion=5 };
    inline static constexpr std::array<GLenum,6> attachments={GL_COLOR_ATTACHMENT0,GL_COLOR_ATTACHMENT1,GL_COLOR_ATTACHMENT2,GL_COLOR_ATTACHMENT3,GL_COLOR_ATTACHMENT4,GL_COLOR_ATTACHMENT5};
    GLuint framebuffer=0,opaqueFramebuffer=0,depth=0,opaqueDepth=0;
    std::array<GLuint,6> colors{};
    FrameHistory history;
    static constexpr uint64_t bytesPerPixel=60,budget=512ull*1024*1024;
    int width=0,height=0;
    uint64_t allocations=0;
    FrameTargets()=default;
    FrameTargets(const FrameTargets&)=delete;
    FrameTargets& operator=(const FrameTargets&)=delete;
    ~FrameTargets(){release();}
    void release(){
        history.release();
        if(framebuffer)nativegl::glDeleteFramebuffers(1,&framebuffer);
        if(opaqueFramebuffer)nativegl::glDeleteFramebuffers(1,&opaqueFramebuffer);
        for(auto texture:colors)if(texture)nativegl::glDeleteTextures(1,&texture);
        if(depth)nativegl::glDeleteTextures(1,&depth);
        if(opaqueDepth)nativegl::glDeleteTextures(1,&opaqueDepth);
        framebuffer=opaqueFramebuffer=depth=opaqueDepth=0;colors.fill(0);width=height=0;
    }
    void resize(int w,int h,bool temporal=false,uint64_t extraBytes=0){
        if(w<1||h<1||w>32768||h>32768||extraBytes>budget||static_cast<uint64_t>(w)*h*(bytesPerPixel+(temporal?FrameHistory::bytesPerPixel:0))>budget-extraBytes)
            throw std::runtime_error("Combined native frame targets exceed the 512 MiB budget.");
        if(w==width&&h==height&&framebuffer&&history.allocated()==temporal)return;
        GLint limit=0;nativegl::glGetIntegerv(GL_MAX_TEXTURE_SIZE,&limit);
        if(w>limit||h>limit)
            throw std::runtime_error("Native frame targets exceed the viewport or 512 MiB budget.");
        if(w==width&&h==height&&framebuffer){
            if(temporal)history.allocate(w,h);else history.release();
            return;
        }
        FrameTargets next;next.width=w;next.height=h;
        auto texture=[&](GLuint& handle,GLint format,GLenum layout){
            nativegl::glGenTextures(1,&handle);nativegl::glBindTexture(GL_TEXTURE_2D,handle);
            nativegl::glTexImage2D(GL_TEXTURE_2D,0,format,w,h,0,layout,GL_FLOAT,nullptr);
            nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);
            nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
            nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);
            nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
        };
        nativegl::glActiveTexture(GL_TEXTURE0);
        nativegl::glGenFramebuffers(1,&next.framebuffer);
        nativegl::glBindFramebuffer(GL_FRAMEBUFFER,next.framebuffer);
        for(size_t i=0;i<next.colors.size();++i){
            texture(next.colors[i],i==Albedo?GL_RGBA8:i==Surface?GL_RGBA32F:GL_RGBA16F,GL_RGBA);
            nativegl::glFramebufferTexture2D(GL_FRAMEBUFFER,attachments[i],GL_TEXTURE_2D,next.colors[i],0);
        }
        texture(next.depth,GL_DEPTH_COMPONENT32F,GL_DEPTH_COMPONENT);
        nativegl::glFramebufferTexture2D(GL_FRAMEBUFFER,GL_DEPTH_ATTACHMENT,GL_TEXTURE_2D,next.depth,0);
        nativegl::glDrawBuffers(static_cast<GLsizei>(attachments.size()),attachments.data());
        if(nativegl::glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)
            throw std::runtime_error("Native scene framebuffer is incomplete.");
        nativegl::glGenFramebuffers(1,&next.opaqueFramebuffer);
        nativegl::glBindFramebuffer(GL_FRAMEBUFFER,next.opaqueFramebuffer);
        texture(next.opaqueDepth,GL_DEPTH_COMPONENT32F,GL_DEPTH_COMPONENT);
        nativegl::glFramebufferTexture2D(GL_FRAMEBUFFER,GL_DEPTH_ATTACHMENT,GL_TEXTURE_2D,next.opaqueDepth,0);
        nativegl::glDrawBuffer(GL_NONE);nativegl::glReadBuffer(GL_NONE);
        if(nativegl::glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)
            throw std::runtime_error("Native opaque depth framebuffer is incomplete.");
        if(temporal)next.history.allocate(w,h);
        nativegl::check("Native frame target allocation");
        std::swap(framebuffer,next.framebuffer);std::swap(opaqueFramebuffer,next.opaqueFramebuffer);
        std::swap(depth,next.depth);std::swap(opaqueDepth,next.opaqueDepth);colors.swap(next.colors);
        history.swap(next.history);
        if(temporal)++history.allocations;
        std::swap(width,next.width);std::swap(height,next.height);++allocations;
    }
    void begin(const glm::vec4& background,bool reverse){
        nativegl::glBindFramebuffer(GL_FRAMEBUFFER,framebuffer);nativegl::glViewport(0,0,width,height);
        nativegl::glDrawBuffers(static_cast<GLsizei>(attachments.size()),attachments.data());
        const GLfloat empty[4]={0,0,0,0},sky[4]={background.r,background.g,background.b,1},farDepth=reverse?0.0f:1.0f;
        nativegl::glClearBufferfv(GL_COLOR,0,sky);
        for(GLint i=1;i<static_cast<GLint>(colors.size());++i)nativegl::glClearBufferfv(GL_COLOR,i,empty);
        nativegl::glClearBufferfv(GL_DEPTH,0,&farDepth);
    }
    void retainOpaqueDepth(){
        nativegl::glBindFramebuffer(GL_READ_FRAMEBUFFER,framebuffer);
        nativegl::glBindFramebuffer(GL_DRAW_FRAMEBUFFER,opaqueFramebuffer);
        nativegl::glBlitFramebuffer(0,0,width,height,0,0,width,height,GL_DEPTH_BUFFER_BIT,GL_NEAREST);
        nativegl::glBindFramebuffer(GL_FRAMEBUFFER,framebuffer);
    }
    void translucent(){nativegl::glDrawBuffer(GL_COLOR_ATTACHMENT0);}
};
}
