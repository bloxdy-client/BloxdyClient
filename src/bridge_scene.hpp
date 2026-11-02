#pragma once
#include <glm/gtc/matrix_transform.hpp>

namespace bridge {
struct AtlasLayout {
    uint32_t tileWidth=0,tileHeight=0,columns=0,rows=0,width=0,height=0;
    static AtlasLayout plan(uint32_t w,uint32_t h,uint32_t layers,uint32_t limit){
        if(!w||!h||!layers||w>limit||h>limit||w+2>limit||h+2>limit)throw std::runtime_error("Invalid native atlas dimensions.");
        const uint32_t maxColumns=limit/(w+2),maxRows=limit/(h+2);
        const uint32_t minimumColumns=(layers+maxRows-1)/maxRows;
        if(minimumColumns>maxColumns)throw std::runtime_error("Native block atlas exceeds GPU dimensions.");
        const auto square=static_cast<uint32_t>(std::ceil(std::sqrt(static_cast<double>(layers))));
        AtlasLayout out;out.tileWidth=w;out.tileHeight=h;out.columns=std::clamp(square,minimumColumns,maxColumns);
        out.rows=(layers+out.columns-1)/out.columns;out.width=out.columns*(w+2);out.height=out.rows*(h+2);
        if(static_cast<uint64_t>(out.width)*out.height*4>256ull*1024*1024)throw std::runtime_error("Native block atlas exceeds 256 MiB.");
        return out;
    }
    std::vector<uint8_t> padded(const uint8_t* pixels)const{
        std::vector<uint8_t> out(static_cast<size_t>(tileWidth+2)*(tileHeight+2)*4);
        for(uint32_t y=0;y<tileHeight+2;++y)for(uint32_t x=0;x<tileWidth+2;++x){
            const auto sx=std::clamp<int64_t>(static_cast<int64_t>(x)-1,0,tileWidth-1),sy=std::clamp<int64_t>(static_cast<int64_t>(y)-1,0,tileHeight-1);
            std::copy_n(pixels+(sy*tileWidth+sx)*4,4,out.data()+(static_cast<size_t>(y)*(tileWidth+2)+x)*4);
        }
        return out;
    }
};
struct EnvironmentState {
    bool sunKnown=false,fogEnabled=false;
    uint32_t fogMode=0;glm::vec3 sun{0,1,0},sunColor{1},fog{0};
    float fogStart=0,fogEnd=256,fogDensity=0,nearPlane=.1f,farPlane=256,seconds=0;
    static EnvironmentState read(Reader& r){
        EnvironmentState out;const auto flags=r.u32();out.fogMode=r.u32();
        for(int i=0;i<3;++i)out.sun[i]=r.f32();for(int i=0;i<3;++i)out.sunColor[i]=r.f32();for(int i=0;i<3;++i)out.fog[i]=r.f32();
        out.fogStart=r.f32();out.fogEnd=r.f32();out.fogDensity=r.f32();out.nearPlane=r.f32();out.farPlane=r.f32();out.seconds=r.f32();r.finish();
        if(flags>3||out.fogMode>3||out.fogDensity<0||out.nearPlane<=0||out.farPlane<=out.nearPlane||out.seconds<0||glm::any(glm::lessThan(out.sunColor,glm::vec3(0)))||glm::any(glm::lessThan(out.fog,glm::vec3(0))))throw std::runtime_error("Invalid native environment values.");
        out.sunKnown=(flags&1)!=0;out.fogEnabled=(flags&2)!=0&&out.fogMode!=0;
        if(out.sunKnown){if(glm::length(out.sun)<.000001f)throw std::runtime_error("Invalid native sun direction.");out.sun=glm::normalize(out.sun);}
        if(out.fogEnabled&&out.fogMode==3&&out.fogEnd<=out.fogStart)throw std::runtime_error("Invalid linear fog range.");return out;
    }
};
struct ShadowTarget {
    GLuint framebuffer=0,depth=0;int size=2048;
    glm::mat4 view{1},projection{1};float radius=64;
    ~ShadowTarget(){if(framebuffer)nativegl::glDeleteFramebuffers(1,&framebuffer);if(depth)nativegl::glDeleteTextures(1,&depth);}
    void initialize(){
        if(framebuffer)return;
        nativegl::glGenTextures(1,&depth);nativegl::glActiveTexture(GL_TEXTURE5);nativegl::glBindTexture(GL_TEXTURE_2D,depth);
        nativegl::glTexImage2D(GL_TEXTURE_2D,0,GL_DEPTH_COMPONENT32F,size,size,0,GL_DEPTH_COMPONENT,GL_FLOAT,nullptr);
        nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
        nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
        nativegl::glGenFramebuffers(1,&framebuffer);nativegl::glBindFramebuffer(GL_FRAMEBUFFER,framebuffer);
        nativegl::glFramebufferTexture2D(GL_FRAMEBUFFER,GL_DEPTH_ATTACHMENT,GL_TEXTURE_2D,depth,0);nativegl::glDrawBuffer(GL_NONE);nativegl::glReadBuffer(GL_NONE);
        if(nativegl::glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)throw std::runtime_error("Native shadow framebuffer is incomplete.");
    }
    void orient(const glm::vec3& camera,const EnvironmentState& environment,int graphResolution=0){
        radius=std::clamp(environment.farPlane*.5f,32.0f,128.0f);
        const auto sun=environment.sun,up=std::abs(sun.y)>.98f?glm::vec3(0,0,1):glm::vec3(0,1,0);
        const auto right=glm::normalize(glm::cross(up,sun)),vertical=glm::normalize(glm::cross(sun,right));
        const float step=2*radius/(graphResolution>0?graphResolution:size);
        auto center=camera;
        center+=right*(std::round(glm::dot(center,right)/step)*step-glm::dot(center,right));
        center+=vertical*(std::round(glm::dot(center,vertical)/step)*step-glm::dot(center,vertical));
        view=glm::lookAtRH(center+sun*radius*2.0f,center,up);projection=glm::orthoRH_NO(-radius,radius,-radius,radius,.1f,radius*4.0f);
    }
    void begin(){nativegl::glBindFramebuffer(GL_FRAMEBUFFER,framebuffer);nativegl::glViewport(0,0,size,size);nativegl::glDepthFunc(GL_LESS);nativegl::glDepthMask(GL_TRUE);nativegl::glDisable(GL_BLEND);nativegl::glEnable(GL_DEPTH_TEST);const GLfloat farDepth=1;nativegl::glClearBufferfv(GL_DEPTH,0,&farDepth);}
};
}
