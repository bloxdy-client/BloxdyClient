#pragma once
#include "gl_api.hpp"
#include <glm/glm.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <limits>
#include <span>
#include <utility>
#include <vector>

namespace bridge {
// Logical color targets are independent of native geometry attachment numbers.
// Descriptors are engine input, not a shaderpack parser or a compatibility claim.
struct ColorFormat {
    GLenum layout=GL_RGBA,type=GL_FLOAT;
    uint32_t bytes=0;
    enum Kind { Floating, Signed, Unsigned } kind=Floating;
    static ColorFormat get(GLenum format){
        switch(format){
#define COLOR_FORMAT(name,layout,type,bytes,kind) case GL_##name:return {GL_##layout,GL_##type,bytes,kind};
            COLOR_FORMAT(R8,RED,UNSIGNED_BYTE,1,Floating)
            COLOR_FORMAT(RG8,RG,UNSIGNED_BYTE,2,Floating)
            COLOR_FORMAT(RGBA8,RGBA,UNSIGNED_BYTE,4,Floating)
            COLOR_FORMAT(R16,RED,UNSIGNED_SHORT,2,Floating)
            COLOR_FORMAT(RG16,RG,UNSIGNED_SHORT,4,Floating)
            COLOR_FORMAT(RGBA16,RGBA,UNSIGNED_SHORT,8,Floating)
            COLOR_FORMAT(R16F,RED,FLOAT,2,Floating)
            COLOR_FORMAT(RG16F,RG,FLOAT,4,Floating)
            COLOR_FORMAT(RGBA16F,RGBA,FLOAT,8,Floating)
            COLOR_FORMAT(R32F,RED,FLOAT,4,Floating)
            COLOR_FORMAT(RG32F,RG,FLOAT,8,Floating)
            COLOR_FORMAT(RGBA32F,RGBA,FLOAT,16,Floating)
            COLOR_FORMAT(R8I,RED_INTEGER,BYTE,1,Signed)
            COLOR_FORMAT(RG8I,RG_INTEGER,BYTE,2,Signed)
            COLOR_FORMAT(RGBA8I,RGBA_INTEGER,BYTE,4,Signed)
            COLOR_FORMAT(R16I,RED_INTEGER,SHORT,2,Signed)
            COLOR_FORMAT(RG16I,RG_INTEGER,SHORT,4,Signed)
            COLOR_FORMAT(RGBA16I,RGBA_INTEGER,SHORT,8,Signed)
            COLOR_FORMAT(R32I,RED_INTEGER,INT,4,Signed)
            COLOR_FORMAT(RG32I,RG_INTEGER,INT,8,Signed)
            COLOR_FORMAT(RGBA32I,RGBA_INTEGER,INT,16,Signed)
            COLOR_FORMAT(R8UI,RED_INTEGER,UNSIGNED_BYTE,1,Unsigned)
            COLOR_FORMAT(RG8UI,RG_INTEGER,UNSIGNED_BYTE,2,Unsigned)
            COLOR_FORMAT(RGBA8UI,RGBA_INTEGER,UNSIGNED_BYTE,4,Unsigned)
            COLOR_FORMAT(R16UI,RED_INTEGER,UNSIGNED_SHORT,2,Unsigned)
            COLOR_FORMAT(RG16UI,RG_INTEGER,UNSIGNED_SHORT,4,Unsigned)
            COLOR_FORMAT(RGBA16UI,RGBA_INTEGER,UNSIGNED_SHORT,8,Unsigned)
            COLOR_FORMAT(R32UI,RED_INTEGER,UNSIGNED_INT,4,Unsigned)
            COLOR_FORMAT(RG32UI,RG_INTEGER,UNSIGNED_INT,8,Unsigned)
            COLOR_FORMAT(RGBA32UI,RGBA_INTEGER,UNSIGNED_INT,16,Unsigned)
#undef COLOR_FORMAT
            default:throw std::runtime_error("Unsupported postprocess color format.");
        }
    }
};
struct ColorBufferSpec {
    uint32_t index=0;GLenum format=GL_RGBA8;
    // Zero fixed dimension selects the independently scaled viewport axis.
    int fixedWidth=0,fixedHeight=0;double scaleX=1,scaleY=1;
    bool clearEachFrame=true,mipmaps=false,linear=false;
    bool customClear=false;glm::vec4 clear{0};
    bool operator==(const ColorBufferSpec&)const=default;
};
struct PassTexture {
    enum Native { None, Scene, Albedo, Normal, Light, Surface, Motion, Depth, OpaqueDepth, PreviousColor, PreviousDepth };
    GLint uniform=-1;uint32_t unit=0;
    // A nonnegative logical index reads the current main side. Otherwise use
    // the supplied external native texture; no implicit colortex assignment.
    int logical=-1;GLuint external=0;bool mipmaps=false;
    Native native=None;
};
struct PassOutput {uint32_t logical=0;bool flip=true;};
struct FullscreenPass {
    GLuint program=0,vao=0;
    std::vector<PassTexture> inputs;
    // Output location N is attached to outputs[N], including sparse logical IDs.
    std::vector<PassOutput> outputs;
    GLint historyValid=-1;
};
struct PassDestination {
    GLuint framebuffer=0;int x=0,y=0,width=0,height=0;
    // Callers supply all attachments of an external non-default framebuffer.
    std::span<const GLuint> textures;
};

class PostProcess {
    struct Buffer {
        ColorBufferSpec spec;int width=0,height=0;
        std::array<GLuint,2> textures{};uint32_t main=0;
        std::array<bool,2> mipDirty{true,true};
    };
    std::array<Buffer,32> buffers{};
    std::vector<ColorBufferSpec> configured;
    GLuint framebuffer=0,persistentCopyFramebuffer=0;size_t attached=0;
    int viewportWidth=0,viewportHeight=0;
    bool resetRequired=true,frameOpen=false;
    GLint textureLimit=0,drawLimit=0,attachmentLimit=0,unitLimit=0;
    static constexpr uint64_t budget=512ull*1024*1024;
    void limits(){
        if(textureLimit)return;
        GLint texture=0,draw=0,attachment=0,units=0;
        nativegl::glGetIntegerv(GL_MAX_TEXTURE_SIZE,&texture);
        nativegl::glGetIntegerv(GL_MAX_DRAW_BUFFERS,&draw);
        nativegl::glGetIntegerv(GL_MAX_COLOR_ATTACHMENTS,&attachment);
        nativegl::glGetIntegerv(GL_MAX_TEXTURE_IMAGE_UNITS,&units);
        nativegl::check("Postprocess capability query");
        if(texture<1||draw<1||attachment<1||units<1)throw std::runtime_error("Invalid postprocess capabilities.");
        textureLimit=texture;drawLimit=draw;attachmentLimit=attachment;unitLimit=units;
    }
    static int dimension(int fixed,double scale,int viewport){
        if(fixed<0||!std::isfinite(scale)||scale<=0)throw std::runtime_error("Invalid postprocess buffer size.");
        const double value=fixed?fixed:std::floor(viewport*scale);
        if(value<1||value>32768)throw std::runtime_error("Postprocess buffer size is out of range.");
        return static_cast<int>(value);
    }
    Buffer& buffer(uint32_t index){
        if(index>=buffers.size()||!buffers[index].textures[0])throw std::runtime_error("Postprocess references an unallocated logical buffer.");
        return buffers[index];
    }
    void attach(std::span<const GLuint> textures){
        nativegl::glBindFramebuffer(GL_FRAMEBUFFER,framebuffer);
        nativegl::glFramebufferTexture2D(GL_FRAMEBUFFER,GL_DEPTH_ATTACHMENT,GL_TEXTURE_2D,0,0);
        for(size_t i=0;i<std::max(attached,textures.size());++i)
            nativegl::glFramebufferTexture2D(GL_FRAMEBUFFER,GL_COLOR_ATTACHMENT0+static_cast<GLenum>(i),GL_TEXTURE_2D,i<textures.size()?textures[i]:0,0);
        attached=textures.size();std::array<GLenum,32> targets{};
        for(size_t i=0;i<textures.size();++i)targets[i]=GL_COLOR_ATTACHMENT0+static_cast<GLenum>(i);
        nativegl::glDrawBuffers(static_cast<GLsizei>(textures.size()),targets.data());
        nativegl::glReadBuffer(textures.empty()?GL_NONE:GL_COLOR_ATTACHMENT0);
        if(nativegl::glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)
            throw std::runtime_error("Postprocess framebuffer is incomplete.");
    }
    static void clearColor(const Buffer& b,const glm::vec4& fog){
        const auto color=b.spec.customClear?b.spec.clear:b.spec.index==0?glm::vec4(glm::vec3(fog),1):b.spec.index==1?glm::vec4(1):glm::vec4(0);
        const auto kind=ColorFormat::get(b.spec.format).kind;
        if(kind==ColorFormat::Signed){const auto values=glm::ivec4(color);nativegl::glClearBufferiv(GL_COLOR,0,glm::value_ptr(values));}
        else if(kind==ColorFormat::Unsigned){const auto values=glm::uvec4(color);nativegl::glClearBufferuiv(GL_COLOR,0,glm::value_ptr(values));}
        else nativegl::glClearBufferfv(GL_COLOR,0,glm::value_ptr(color));
    }
    void swapStorage(PostProcess& other){
        buffers.swap(other.buffers);configured.swap(other.configured);std::swap(framebuffer,other.framebuffer);std::swap(persistentCopyFramebuffer,other.persistentCopyFramebuffer);std::swap(attached,other.attached);
        std::swap(viewportWidth,other.viewportWidth);std::swap(viewportHeight,other.viewportHeight);
        std::swap(bytes,other.bytes);std::swap(resetRequired,other.resetRequired);
    }
public:
    uint64_t bytes=0,allocations=0,passes=0;
    PostProcess()=default;
    PostProcess(const PostProcess&)=delete;
    PostProcess& operator=(const PostProcess&)=delete;
    ~PostProcess(){release();}
    void invalidate(){resetRequired=true;frameOpen=false;}
    void release(){
        for(auto& b:buffers){for(auto texture:b.textures)if(texture)nativegl::glDeleteTextures(1,&texture);b=Buffer{};}
        if(framebuffer)nativegl::glDeleteFramebuffers(1,&framebuffer);
        if(persistentCopyFramebuffer)nativegl::glDeleteFramebuffers(1,&persistentCopyFramebuffer);
        framebuffer=persistentCopyFramebuffer=0;attached=0;configured.clear();bytes=0;viewportWidth=viewportHeight=0;invalidate();
    }
    static uint64_t estimate(const std::vector<ColorBufferSpec>& specs,int w,int h){
        if(w<1||h<1||w>32768||h>32768||specs.size()>32)throw std::runtime_error("Invalid postprocess viewport or buffer count.");
        std::array<bool,32> used{};uint64_t total=0;
        for(const auto& spec:specs){
            if(spec.index>=used.size()||used[spec.index])throw std::runtime_error("Duplicate or invalid logical color buffer.");used[spec.index]=true;
            auto width=dimension(spec.fixedWidth,spec.scaleX,w),height=dimension(spec.fixedHeight,spec.scaleY,h);
            const auto format=ColorFormat::get(spec.format);
            if(format.kind!=ColorFormat::Floating&&spec.linear)throw std::runtime_error("Integer color buffers require nearest filtering.");
            for(int i=0;i<4;++i){const double value=spec.clear[i];
                if(!std::isfinite(value)||format.kind==ColorFormat::Signed&&(value<-2147483648.0||value>2147483647.0)||format.kind==ColorFormat::Unsigned&&(value<0||value>4294967295.0))
                    throw std::runtime_error("Invalid postprocess clear color.");}
            for(;;){total+=static_cast<uint64_t>(width)*height*format.bytes*2;
                if(total>budget)throw std::runtime_error("Postprocess color buffers exceed 512 MiB.");
                if(!spec.mipmaps||(width==1&&height==1))break;width=std::max(1,width/2);height=std::max(1,height/2);}
        }
        return total;
    }
    void configure(const std::vector<ColorBufferSpec>& specs,int w,int h,uint64_t otherTargetBytes){
        const auto required=estimate(specs,w,h);
        if(otherTargetBytes>budget||required>budget-otherTargetBytes)throw std::runtime_error("Combined frame/postprocess targets exceed 512 MiB.");
        if(configured==specs&&viewportWidth==w&&viewportHeight==h)return;
        if(frameOpen)throw std::runtime_error("Cannot replace postprocess targets during a frame.");
        if(specs.empty()){release();viewportWidth=w;viewportHeight=h;return;}
        limits();PostProcess next;next.viewportWidth=w;next.viewportHeight=h;next.configured=specs;next.bytes=required;
        nativegl::glGenFramebuffers(1,&next.framebuffer);nativegl::glActiveTexture(GL_TEXTURE0);
        for(const auto& spec:specs){auto& b=next.buffers[spec.index];b.spec=spec;
            b.width=dimension(spec.fixedWidth,spec.scaleX,w);b.height=dimension(spec.fixedHeight,spec.scaleY,h);
            if(b.width>textureLimit||b.height>textureLimit)throw std::runtime_error("Postprocess buffer exceeds the GPU texture limit.");
            const auto format=ColorFormat::get(spec.format);
            for(auto& texture:b.textures){
                nativegl::glGenTextures(1,&texture);nativegl::glBindTexture(GL_TEXTURE_2D,texture);
                nativegl::glTexImage2D(GL_TEXTURE_2D,0,spec.format,b.width,b.height,0,format.layout,format.type,nullptr);
                nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,spec.linear?GL_LINEAR:GL_NEAREST);
                nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,spec.linear?GL_LINEAR:GL_NEAREST);
                nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
                next.attach(std::array<GLuint,1>{texture});
            }
        }
        nativegl::check("Postprocess target allocation");swapStorage(next);++allocations;
    }
    GLuint current(uint32_t index){auto& b=buffer(index);return b.textures[b.main];}
    GLuint alternate(uint32_t index){auto& b=buffer(index);return b.textures[1-b.main];}
    GLenum format(uint32_t index){return buffer(index).spec.format;}
    glm::ivec2 size(uint32_t index){auto& b=buffer(index);return {b.width,b.height};}
    void dirty(uint32_t index){auto& b=buffer(index);b.mipDirty[b.main]=true;}
    void prepareSample(uint32_t index,bool mipmaps){
        auto& b=buffer(index);if(mipmaps&&!b.spec.mipmaps)throw std::runtime_error("Graph sample requests unreserved mips.");
        nativegl::glBindTexture(GL_TEXTURE_2D,b.textures[b.main]);
        if(mipmaps&&b.mipDirty[b.main]){nativegl::glGenerateMipmap(GL_TEXTURE_2D);b.mipDirty[b.main]=false;}
        nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,mipmaps?(b.spec.linear?GL_LINEAR_MIPMAP_LINEAR:GL_NEAREST_MIPMAP_NEAREST):(b.spec.linear?GL_LINEAR:GL_NEAREST));
    }
    void flip(uint32_t index){auto& b=buffer(index);b.main=1-b.main;}
    // Geometry writes the current sampler side, without a fullscreen flip.
    void geometry(std::span<const uint32_t> indices,GLuint depth,int w,int h){
        if(!frameOpen||!depth||indices.empty())throw std::runtime_error("Invalid graph geometry destination.");
        limits();if(indices.size()>static_cast<size_t>(std::min(drawLimit,attachmentLimit)))throw std::runtime_error("Graph geometry exceeds MRT limits.");
        std::array<GLuint,32> textures{};std::array<bool,32> used{};
        for(size_t i=0;i<indices.size();++i){auto& b=buffer(indices[i]);
            if(used[indices[i]]||b.width!=w||b.height!=h)throw std::runtime_error("Graph geometry target size/alias mismatch.");
            used[indices[i]]=true;textures[i]=current(indices[i]);dirty(indices[i]);}
        attach(std::span<const GLuint>(textures.data(),indices.size()));
        nativegl::glFramebufferTexture2D(GL_FRAMEBUFFER,GL_DEPTH_ATTACHMENT,GL_TEXTURE_2D,depth,0);
        if(nativegl::glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)throw std::runtime_error("Graph geometry framebuffer incomplete.");
        nativegl::glViewport(0,0,w,h);
    }
    void detachDepth(){if(framebuffer){nativegl::glBindFramebuffer(GL_FRAMEBUFFER,framebuffer);nativegl::glFramebufferTexture2D(GL_FRAMEBUFFER,GL_DEPTH_ATTACHMENT,GL_TEXTURE_2D,0,0);}}
    // Iris starts a new frame from physical main. Preserve persistent results
    // on BOTH sides before resetting parity (not just the logical main pointer).
    void normalizePersistent(){
        if(!frameOpen)throw std::runtime_error("No graph frame to normalize.");
        try{for(auto& b:buffers)if(b.textures[0]){
            if(b.main&&!b.spec.clearEachFrame){
                if(!persistentCopyFramebuffer)nativegl::glGenFramebuffers(1,&persistentCopyFramebuffer);
                attach(std::array<GLuint,1>{b.textures[1]});
                nativegl::glBindFramebuffer(GL_DRAW_FRAMEBUFFER,persistentCopyFramebuffer);
                nativegl::glFramebufferTexture2D(GL_DRAW_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,b.textures[0],0);
                nativegl::glDrawBuffer(GL_COLOR_ATTACHMENT0);
                if(nativegl::glCheckFramebufferStatus(GL_DRAW_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)throw std::runtime_error("Persistent graph copy framebuffer incomplete.");
                nativegl::glBlitFramebuffer(0,0,b.width,b.height,0,0,b.width,b.height,GL_COLOR_BUFFER_BIT,GL_NEAREST);
                nativegl::check("Graph persistent frame copy");b.mipDirty[0]=true;
            }
            b.main=0;
        }}catch(...){invalidate();throw;}
    }
    GLuint targetFramebuffer()const{return framebuffer;}
    void clearFrame(const glm::vec4& fog){
        if(!frameOpen)throw std::runtime_error("Cannot clear an unopened postprocess frame.");
        for(auto& b:buffers)if(b.textures[0]&&b.spec.clearEachFrame){for(auto texture:b.textures){attach(std::array<GLuint,1>{texture});clearColor(b,fog);}b.mipDirty={true,true};}
        if(framebuffer)nativegl::check("Postprocess scheduled frame clear");
    }
    void begin(const glm::vec4& fog,bool clearEachFrame=true){
        if(frameOpen)throw std::runtime_error("Postprocess frame is already open.");
        try{
            if(resetRequired)for(auto& b:buffers)b.main=0;
            for(auto& b:buffers)if(b.textures[0]&&(resetRequired||clearEachFrame&&b.spec.clearEachFrame)){
                for(auto texture:b.textures){attach(std::array<GLuint,1>{texture});clearColor(b,fog);}b.mipDirty={true,true};
            }
            if(framebuffer)nativegl::check("Postprocess frame clear");resetRequired=false;frameOpen=true;
        }catch(...){invalidate();throw;}
    }
    void complete(){if(!frameOpen)throw std::runtime_error("No postprocess frame to complete.");frameOpen=false;}
    void run(const FullscreenPass& pass,const PassDestination* destination=nullptr){
        if(!frameOpen||!pass.program||!pass.vao||pass.inputs.size()>32)throw std::runtime_error("Invalid fullscreen pass or frame state.");
        limits();std::array<bool,32> outputs{},units{};std::array<GLuint,32> targets{},sources{};size_t targetCount=0,sourceCount=0;
        int width=0,height=0;
        if(destination){
            if(!pass.outputs.empty()||(destination->framebuffer&&destination->textures.empty())||destination->textures.size()>targets.size()||destination->width<1||destination->height<1||destination->width>32768||destination->height>32768||destination->x<0||destination->y<0)
                throw std::runtime_error("Invalid external fullscreen destination.");
            if(destination->framebuffer&&destination->framebuffer==framebuffer)throw std::runtime_error("Internal fullscreen framebuffer cannot be an external destination.");
            targetCount=destination->textures.size();std::copy(destination->textures.begin(),destination->textures.end(),targets.begin());width=destination->width;height=destination->height;
        }else{
            if(pass.outputs.empty()||pass.outputs.size()>static_cast<size_t>(std::min(drawLimit,attachmentLimit)))throw std::runtime_error("Fullscreen output count exceeds GPU capabilities.");
            for(const auto& output:pass.outputs){auto& b=buffer(output.logical);
                if(outputs[output.logical]||width&&(width!=b.width||height!=b.height))throw std::runtime_error("Fullscreen outputs overlap or have different sizes.");
                outputs[output.logical]=true;width=b.width;height=b.height;targets[targetCount++]=b.textures[1-b.main];}
        }
        for(const auto& input:pass.inputs){
            if(input.unit>=units.size()||input.unit>=static_cast<uint32_t>(unitLimit)||units[input.unit]||input.logical< -1)throw std::runtime_error("Invalid or duplicate fullscreen texture unit.");units[input.unit]=true;
            const auto texture=input.logical>=0?current(static_cast<uint32_t>(input.logical)):input.external;
            if(!texture||std::find(targets.begin(),targets.begin()+targetCount,texture)!=targets.begin()+targetCount)throw std::runtime_error("Fullscreen pass has missing input or framebuffer feedback.");
            if(input.mipmaps&&(input.logical<0||!buffer(static_cast<uint32_t>(input.logical)).spec.mipmaps))throw std::runtime_error("Fullscreen mipmaps need reserved logical storage.");
            for(size_t i=0;i<sourceCount;++i)if(sources[i]==texture&&pass.inputs[i].mipmaps!=input.mipmaps)throw std::runtime_error("A texture cannot use conflicting mip filters in one fullscreen pass.");
            sources[sourceCount++]=texture;
        }
        try{
            if(destination){nativegl::glBindFramebuffer(GL_FRAMEBUFFER,destination->framebuffer);if(destination->framebuffer)nativegl::glDrawBuffer(GL_COLOR_ATTACHMENT0);nativegl::glViewport(destination->x,destination->y,width,height);}
            else {attach(std::span<const GLuint>(targets.data(),targetCount));nativegl::glViewport(0,0,width,height);}
            nativegl::glDisable(GL_DEPTH_TEST);nativegl::glDepthMask(GL_FALSE);nativegl::glDisable(GL_CULL_FACE);nativegl::glDisable(GL_BLEND);
            nativegl::glUseProgram(pass.program);nativegl::glBindVertexArray(pass.vao);
            for(size_t i=0;i<pass.inputs.size();++i){const auto& input=pass.inputs[i];nativegl::glActiveTexture(GL_TEXTURE0+input.unit);nativegl::glBindTexture(GL_TEXTURE_2D,sources[i]);
                if(input.logical>=0){auto& b=buffer(static_cast<uint32_t>(input.logical));
                    if(input.mipmaps&&b.mipDirty[b.main]){nativegl::glGenerateMipmap(GL_TEXTURE_2D);b.mipDirty[b.main]=false;}
                    nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,input.mipmaps?(b.spec.linear?GL_LINEAR_MIPMAP_LINEAR:GL_NEAREST_MIPMAP_NEAREST):(b.spec.linear?GL_LINEAR:GL_NEAREST));}
                if(input.uniform>=0)nativegl::glUniform1i(input.uniform,static_cast<GLint>(input.unit));
            }
            nativegl::glDrawArrays(GL_TRIANGLES,0,3);nativegl::check("Native fullscreen pass");
            for(const auto& output:pass.outputs){auto& b=buffer(output.logical);b.mipDirty[1-b.main]=true;if(output.flip)b.main=1-b.main;}++passes;
        }catch(...){invalidate();throw;}
    }
};
// Abort invalidates scratch/persistent color contents; two-sided scratch storage
// is not a transactional frame archive. FrameHistory owns that separate contract.
struct PostProcessFrame {
    PostProcess& owner;bool done=false;
    ~PostProcessFrame(){if(!done)owner.invalidate();}
    void complete(){owner.complete();done=true;}
};
}
