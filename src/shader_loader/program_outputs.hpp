#pragma once
#include "program_vertices.hpp"

namespace bridge::shaderloader {
struct PackOutputApi {
#define PACK_OUTPUT_APIS(X) \
 X(GenFramebuffers,PFNGLGENFRAMEBUFFERSPROC) X(DeleteFramebuffers,PFNGLDELETEFRAMEBUFFERSPROC) X(BindFramebuffer,PFNGLBINDFRAMEBUFFERPROC) X(IsFramebuffer,PFNGLISFRAMEBUFFERPROC) \
 X(FramebufferTexture2D,PFNGLFRAMEBUFFERTEXTURE2DPROC) X(CheckFramebufferStatus,PFNGLCHECKFRAMEBUFFERSTATUSPROC) X(DrawBuffers,PFNGLDRAWBUFFERSPROC) X(ReadBuffer,PFNGLREADBUFFERPROC) \
 X(ActiveTexture,PFNGLACTIVETEXTUREPROC) X(BindTexture,PFNGLBINDTEXTUREPROC) X(IsTexture,PFNGLISTEXTUREPROC) X(GetTexLevelParameteriv,PFNGLGETTEXLEVELPARAMETERIVPROC) \
 X(ViewportIndexedf,PFNGLVIEWPORTINDEXEDFPROC) X(GetFloati_v,PFNGLGETFLOATI_VPROC) X(GetIntegerv,PFNGLGETINTEGERVPROC) X(GetError,PFNGLGETERRORPROC)
#define PACK_OUTPUT_DECLARE(name,type) type name=nullptr;
    PACK_OUTPUT_APIS(PACK_OUTPUT_DECLARE)
#undef PACK_OUTPUT_DECLARE
    void validate()const{
#define PACK_OUTPUT_CHECK(name,type) if(!name)throw std::runtime_error("Missing pack output entry point: " #name);
        PACK_OUTPUT_APIS(PACK_OUTPUT_CHECK)
#undef PACK_OUTPUT_CHECK
    }
};

// Borrowed native images: the producer pins identity/storage for this scope.
// Releasing owner must retire resources without calling GL on a foreign thread.
// No source/WebGL names or colortex semantics are inferred.
struct PackOutputImage {
    GLenum attachment=GL_NONE,target=GL_TEXTURE_2D,format=0;GLuint texture=0;
    GLint level=0,width=0,height=0;
    std::shared_ptr<const void> owner;uint64_t generation=0;
    std::function<bool(uint64_t)> current;
};

class PackFramebufferBinder {
    friend class PackTestPass;
    std::unique_ptr<PackVertexBinder> vertices_;PackOutputApi api_;
    GLint attachmentLimit_=0,drawLimit_=0,maxWidth_=0,maxHeight_=0;
    GLuint framebuffer_=0,oldDraw_=0,oldRead_=0,oldTexture_=0;
    GLenum oldActive_=GL_TEXTURE0;std::array<GLfloat,4> oldViewport_{};
    bool pending_=false,drawPending_=false,readPending_=false,texturePending_=false,viewportPending_=false,activePending_=false,running_=false;
    std::vector<PackOutputImage> owners_;
    static inline std::atomic<size_t> unrestored_{0};
    PackFramebufferBinder(std::unique_ptr<PackVertexBinder>&& vertices,PackOutputApi api,GLint attachments,GLint draws,GLint width,GLint height)
        :vertices_(std::move(vertices)),api_(api),attachmentLimit_(attachments),drawLimit_(draws),maxWidth_(width),maxHeight_(height){}
    static void need(bool b,const char* message){if(!b)throw std::runtime_error(message);}
    void ensure()const{vertices_->ensure();}
    void error()const{ensure();need(api_.GetError()==GL_NO_ERROR,"Pack framebuffer OpenGL error.");}
    template<class F,class... A>auto call(F fn,A... args)const{ensure();if constexpr(std::is_void_v<std::invoke_result_t<F,A...>>){fn(args...);error();}else{auto result=fn(args...);error();return result;}}
    GLint integer(GLenum key)const{GLint value=0;call(api_.GetIntegerv,key,&value);return value;}
    static bool color(GLenum format){switch(format){
        case GL_R8:case GL_RG8:case GL_RGB8:case GL_RGBA8:case GL_R16:case GL_RG16:case GL_RGBA16:
        case GL_R16F:case GL_RG16F:case GL_RGB16F:case GL_RGBA16F:case GL_R32F:case GL_RG32F:case GL_RGB32F:case GL_RGBA32F:return true;
        default:return false;
    }}
    static bool depth(GLenum format){return format==GL_DEPTH_COMPONENT16||format==GL_DEPTH_COMPONENT24||format==GL_DEPTH_COMPONENT32F;}
    static bool packed(GLenum format){return format==GL_DEPTH24_STENCIL8||format==GL_DEPTH32F_STENCIL8;}
    static void live(const PackOutputImage& image){need(image.owner&&image.generation&&image.current&&image.current(image.generation),"Stale or unowned pack output image.");}
    void check(const std::vector<PackTextureInput>& textures)const{
        const auto buffers=vertices_->textures_->uniforms().plan().drawBuffers();need(buffers.size()<=static_cast<size_t>(drawLimit_),"Pack output locations exceed draw buffer limit.");
        std::set<GLenum> expected;for(const auto point:buffers)if(point!=GL_NONE){need(point>=GL_COLOR_ATTACHMENT0&&point<GL_COLOR_ATTACHMENT0+attachmentLimit_,"Pack output attachment exceeds context limit.");expected.insert(point);}
        need(!owners_.empty()&&owners_.size()<=9,"Pack output scope needs bounded attachments.");
        std::set<GLenum> points;std::set<GLuint> names;size_t colors=0,depths=0;
        for(const auto& image:owners_){
            live(image);need(image.texture&&image.target==GL_TEXTURE_2D&&image.level==0&&image.width>0&&image.height>0&&image.width<=maxWidth_&&image.height<=maxHeight_,"Unsupported pack output image layout.");
            need(image.width==owners_.front().width&&image.height==owners_.front().height,"Pack output image dimensions differ.");
            need(points.insert(image.attachment).second&&names.insert(image.texture).second,"Duplicate pack output attachment or aliased image.");
            if(expected.contains(image.attachment)){need(color(image.format),"Pack vec4 output needs normalized or float color storage.");++colors;}
            else if(image.attachment==GL_DEPTH_ATTACHMENT){need(depth(image.format),"Pack depth output needs depth storage.");++depths;}
            else if(image.attachment==GL_DEPTH_STENCIL_ATTACHMENT){need(packed(image.format),"Pack depth/stencil output needs packed storage.");++depths;}
            else throw std::runtime_error("Unrouted pack output attachment.");
            for(const auto& texture:textures)need(texture.texture!=image.texture,"Pack sampled texture aliases an output image.");
        }
        need(colors==expected.size()&&depths<=1,"Incomplete pack color routes or conflicting depth outputs.");
    }
    void attach(const PackOutputImage& image){
        live(image);need(call(api_.IsTexture,image.texture)==GL_TRUE,"Pack output texture is unavailable.");call(api_.BindTexture,GL_TEXTURE_2D,image.texture);
        const auto level=[&](GLenum key){GLint value=0;call(api_.GetTexLevelParameteriv,GL_TEXTURE_2D,0,key,&value);return value;};
        need(level(GL_TEXTURE_WIDTH)==image.width&&level(GL_TEXTURE_HEIGHT)==image.height&&level(GL_TEXTURE_DEPTH)==1&&level(GL_TEXTURE_INTERNAL_FORMAT)==static_cast<GLint>(image.format),"Pack output texture storage differs from descriptor.");
        call(api_.FramebufferTexture2D,GL_DRAW_FRAMEBUFFER,image.attachment,GL_TEXTURE_2D,image.texture,0);
    }
    void restore(){
        if(!pending_)return;ensure();need(!vertices_->pendingRestore(),"Collect nested pack bindings before restoring outputs.");std::exception_ptr failure;
        auto attempt=[&](auto fn){try{fn();}catch(...){if(!failure)failure=std::current_exception();}};
        if(drawPending_)attempt([&]{need(!oldDraw_||call(api_.IsFramebuffer,oldDraw_)==GL_TRUE,"Previous draw framebuffer was deleted.");call(api_.BindFramebuffer,GL_DRAW_FRAMEBUFFER,oldDraw_);drawPending_=false;});
        if(readPending_)attempt([&]{need(!oldRead_||call(api_.IsFramebuffer,oldRead_)==GL_TRUE,"Previous read framebuffer was deleted.");call(api_.BindFramebuffer,GL_READ_FRAMEBUFFER,oldRead_);readPending_=false;});
        if(texturePending_)attempt([&]{need(!oldTexture_||call(api_.IsTexture,oldTexture_)==GL_TRUE,"Previous output-scope texture was deleted.");call(api_.ActiveTexture,oldActive_);call(api_.BindTexture,GL_TEXTURE_2D,oldTexture_);texturePending_=false;});
        if(viewportPending_)attempt([&]{call(api_.ViewportIndexedf,0,oldViewport_[0],oldViewport_[1],oldViewport_[2],oldViewport_[3]);viewportPending_=false;});
        if(activePending_)attempt([&]{call(api_.ActiveTexture,oldActive_);activePending_=false;});
        if(framebuffer_&&!drawPending_&&!readPending_)attempt([&]{call(api_.DeleteFramebuffers,1,&framebuffer_);framebuffer_=0;});
        if(failure)std::rethrow_exception(failure);pending_=false;owners_.clear();
    }
    void drain(){vertices_->collect();restore();}
public:
    PackFramebufferBinder(const PackFramebufferBinder&)=delete;PackFramebufferBinder& operator=(const PackFramebufferBinder&)=delete;
    ~PackFramebufferBinder()noexcept{try{drain();}catch(...){if(pending_)++unrestored_;}}
    static std::unique_ptr<PackFramebufferBinder> create(std::unique_ptr<PackVertexBinder>&& vertices,PackOutputApi api){
        need(bool(vertices),"Missing pack vertex binder.");vertices->ensure();vertices->textures_->uniforms().programForDraw();need(!vertices->pendingRestore(),"Collect pack vertex state before output construction.");api.validate();
        auto check=[&]{vertices->ensure();need(api.GetError()==GL_NO_ERROR,"Pack framebuffer OpenGL error.");};check();
        auto query=[&](GLenum key,GLint* out){vertices->ensure();api.GetIntegerv(key,out);check();};
        GLint attachments=0,draws=0,size=0,viewport[2]{};query(GL_MAX_COLOR_ATTACHMENTS,&attachments);query(GL_MAX_DRAW_BUFFERS,&draws);query(GL_MAX_TEXTURE_SIZE,&size);query(GL_MAX_VIEWPORT_DIMS,viewport);
        need(attachments>0&&attachments<=32&&draws>0&&size>0&&viewport[0]>0&&viewport[1]>0,"Invalid pack framebuffer context limits.");
        return std::unique_ptr<PackFramebufferBinder>(new PackFramebufferBinder(std::move(vertices),api,attachments,std::min(draws,8),std::min({size,viewport[0],16384}),std::min({size,viewport[1],16384})));
    }
    static std::unique_ptr<PackFramebufferBinder> native(std::unique_ptr<PackVertexBinder>&& vertices){
        need(bool(vertices),"Missing pack vertex binder.");PackOutputApi api;
#define PACK_OUTPUT_LOAD(name,type) vertices->ensure();api.name=reinterpret_cast<type>(glfwGetProcAddress("gl" #name));
        PACK_OUTPUT_APIS(PACK_OUTPUT_LOAD)
#undef PACK_OUTPUT_LOAD
        vertices->ensure();return create(std::move(vertices),api);
    }
    static size_t unrestoredOnDestruction(){return unrestored_.load();}
    bool pendingRestore()const{return pending_||vertices_->pendingRestore();}
    void collect(){ensure();need(!running_,"Reentrant pack output collection.");drain();}
    void write(const std::vector<PackUniformValue>& values){ensure();need(!running_,"Reentrant pack output uniform write.");drain();vertices_->write(values);}
    void draw(const std::vector<PackOutputImage>& outputs,const std::vector<PackVertexInput>& inputs,const std::vector<PackTextureInput>& textures,const PackArrayDraw& draw){drawPrepared(outputs,inputs,textures,draw,[]{});}
private:
    const PackUniformWriter& uniforms()const{return vertices_->textures_->uniforms();}
    friend class PackTwoPass;
    // Only the owning test pass may initialize its own targets inside the FBO.
    template<class Prepare>void drawPrepared(const std::vector<PackOutputImage>& outputs,const std::vector<PackVertexInput>& inputs,const std::vector<PackTextureInput>& textures,const PackArrayDraw& draw,Prepare prepare){
        ensure();need(!running_,"Reentrant pack output draw.");drain();vertices_->textures_->uniforms().programForDraw();running_=true;
        try{
            need(outputs.size()<=9&&textures.size()<=512,"Pack output descriptor count exceeds scope limit.");const PackArrayDraw command=draw;owners_=outputs;check(textures);error();
            oldDraw_=static_cast<GLuint>(integer(GL_DRAW_FRAMEBUFFER_BINDING));oldRead_=static_cast<GLuint>(integer(GL_READ_FRAMEBUFFER_BINDING));oldActive_=static_cast<GLenum>(integer(GL_ACTIVE_TEXTURE));oldTexture_=static_cast<GLuint>(integer(GL_TEXTURE_BINDING_2D));call(api_.GetFloati_v,GL_VIEWPORT,0,oldViewport_.data());
            pending_=drawPending_=readPending_=texturePending_=viewportPending_=activePending_=true;
            ensure();api_.GenFramebuffers(1,&framebuffer_);error();need(framebuffer_!=0,"Cannot allocate pack framebuffer.");call(api_.BindFramebuffer,GL_FRAMEBUFFER,framebuffer_);
            for(const auto& image:owners_)attach(image);
            const auto buffers=vertices_->textures_->uniforms().plan().drawBuffers();call(api_.DrawBuffers,static_cast<GLsizei>(buffers.size()),buffers.data());call(api_.ReadBuffer,GL_NONE);
            need(call(api_.CheckFramebufferStatus,GL_DRAW_FRAMEBUFFER)==GL_FRAMEBUFFER_COMPLETE&&call(api_.CheckFramebufferStatus,GL_READ_FRAMEBUFFER)==GL_FRAMEBUFFER_COMPLETE,"Pack framebuffer is incomplete.");
            call(api_.ViewportIndexedf,0,0.f,0.f,static_cast<GLfloat>(owners_.front().width),static_cast<GLfloat>(owners_.front().height));for(const auto& image:owners_)live(image);
            prepare();for(const auto& image:owners_)live(image);
            vertices_->draw(inputs,textures,command);for(const auto& image:owners_)live(image);
            drain();running_=false;
        }catch(...){auto failure=std::current_exception();try{drain();}catch(...){}if(!pending_)owners_.clear();running_=false;std::rethrow_exception(failure);}
    }
};
#undef PACK_OUTPUT_APIS
}
