#pragma once
#include "program_uniforms.hpp"

namespace bridge::shaderloader {
struct PackTextureApi {
#define PACK_TEXTURE_APIS(X) \
 X(ActiveTexture,PFNGLACTIVETEXTUREPROC) X(BindTexture,PFNGLBINDTEXTUREPROC) X(BindSampler,PFNGLBINDSAMPLERPROC) \
 X(IsTexture,PFNGLISTEXTUREPROC) X(IsSampler,PFNGLISSAMPLERPROC) X(GetIntegerv,PFNGLGETINTEGERVPROC) X(GetIntegeri_v,PFNGLGETINTEGERI_VPROC) X(GetError,PFNGLGETERRORPROC) \
 X(GetTexParameteriv,PFNGLGETTEXPARAMETERIVPROC) X(GetTexParameterfv,PFNGLGETTEXPARAMETERFVPROC) X(GetSamplerParameteriv,PFNGLGETSAMPLERPARAMETERIVPROC) X(GetSamplerParameterfv,PFNGLGETSAMPLERPARAMETERFVPROC) \
 X(GetTexLevelParameteriv,PFNGLGETTEXLEVELPARAMETERIVPROC) X(GetFramebufferAttachmentParameteriv,PFNGLGETFRAMEBUFFERATTACHMENTPARAMETERIVPROC)
#define PACK_TEXTURE_DECLARE(name,type) type name=nullptr;
    PACK_TEXTURE_APIS(PACK_TEXTURE_DECLARE)
#undef PACK_TEXTURE_DECLARE
    void validate()const{
#define PACK_TEXTURE_CHECK(name,type) if(!name)throw std::runtime_error("Missing pack texture entry point: " #name);
        PACK_TEXTURE_APIS(PACK_TEXTURE_CHECK)
#undef PACK_TEXTURE_CHECK
    }
    static PackTextureApi native(const PackUniformWriter& writer){PackTextureApi api;
#define PACK_TEXTURE_LOAD(name,type) writer.programForDraw();api.name=reinterpret_cast<type>(glfwGetProcAddress("gl" #name));
        PACK_TEXTURE_APIS(PACK_TEXTURE_LOAD)
#undef PACK_TEXTURE_LOAD
        writer.programForDraw();api.validate();return api;
    }
};
#undef PACK_TEXTURE_APIS
struct PackTextureSampling {
    GLint min=GL_NEAREST,mag=GL_NEAREST,wrapS=GL_CLAMP_TO_EDGE,wrapT=GL_CLAMP_TO_EDGE,wrapR=GL_CLAMP_TO_EDGE;
    GLfloat minLod=-1000,maxLod=1000,lodBias=0;
    bool operator==(const PackTextureSampling&)const=default;
};
// The producer must hold the same-context resource immutable for this scope.
// owner pins its lifetime; current(generation) checks the producer's own epoch.
// No raw source GL name is imported or assigned a semantic meaning here.
struct PackTextureInput {
    std::string name;GLuint texture=0;GLenum target=0,format=0;GLuint sampler=0;
    GLint width=0,height=0,depth=1;PackTextureSampling sampling;
    std::shared_ptr<const void> owner;uint64_t generation=0;std::function<bool(uint64_t)> current;
private:
    friend class PackTestPass;friend class PackTextureBinder;
    // Owned pass outputs seal their storage identity independently of the
    // public producer callback. Copies retain the seal and cannot erase it.
    std::function<bool(const PackTextureInput&)> ownership_;
};
class PackTextureBinder {
    struct Saved {uint32_t unit;GLenum target;GLuint texture,sampler;bool texturePending=true,samplerPending=true;};
    struct Unit {uint32_t unit;PackTextureInput input;};
    PackUniformWriter writer_;PackTextureApi api_;GLint attachments_=0;
    std::array<Saved,32> saved_{};size_t savedCount_=0;GLenum active_=GL_TEXTURE0;
    bool pending_=false,running_=false;
    std::vector<PackTextureInput> owners_;
    static inline std::atomic<size_t> unrestored_{0};
    PackTextureBinder(PackUniformWriter&& writer,PackTextureApi api,GLint attachments):writer_(std::move(writer)),api_(api),attachments_(attachments){}
    static void need(bool valid,const char* error){if(!valid)throw std::runtime_error(error);}
    void ensure()const{writer_.lease_.handle();}
    void error()const{ensure();const auto e=api_.GetError();need(e==GL_NO_ERROR,"Pack texture OpenGL error.");}
    template<class F,class... A>auto call(F fn,A... args)const{ensure();if constexpr(std::is_void_v<std::invoke_result_t<F,A...>>){fn(args...);error();}else{const auto result=fn(args...);error();return result;}}
    GLint integer(GLenum key)const{GLint v=0;call(api_.GetIntegerv,key,&v);return v;}
    static GLenum binding(GLenum target){switch(target){case GL_TEXTURE_2D:return GL_TEXTURE_BINDING_2D;case GL_TEXTURE_3D:return GL_TEXTURE_BINDING_3D;case GL_TEXTURE_CUBE_MAP:return GL_TEXTURE_BINDING_CUBE_MAP;default:throw std::runtime_error("Unsupported pack texture target.");}}
    static GLenum target(GLenum type){switch(type){case GL_SAMPLER_2D:return GL_TEXTURE_2D;case GL_SAMPLER_3D:return GL_TEXTURE_3D;case GL_SAMPLER_CUBE:return GL_TEXTURE_CUBE_MAP;default:throw std::runtime_error("Unsupported pack sampler type.");}}
    static bool format(GLenum f){switch(f){
        case GL_R8:case GL_RG8:case GL_RGB8:case GL_RGBA8:case GL_SRGB8:case GL_SRGB8_ALPHA8:
        case GL_R16:case GL_RG16:case GL_RGBA16:case GL_R16F:case GL_RG16F:case GL_RGB16F:case GL_RGBA16F:case GL_R32F:case GL_RG32F:case GL_RGB32F:case GL_RGBA32F:
        case GL_DEPTH_COMPONENT16:case GL_DEPTH_COMPONENT24:case GL_DEPTH_COMPONENT32:case GL_DEPTH_COMPONENT32F:case GL_DEPTH24_STENCIL8:case GL_DEPTH32F_STENCIL8:return true;
        default:return false;
    }}
    static void live(const PackTextureInput& input){need(input.owner&&input.generation&&input.current&&input.current(input.generation)&&(!input.ownership_||input.ownership_(input)),"Stale or unowned pack texture.");}
    static void sampling(const PackTextureSampling& s){
        need((s.min==GL_NEAREST||s.min==GL_LINEAR||s.min>=GL_NEAREST_MIPMAP_NEAREST&&s.min<=GL_LINEAR_MIPMAP_LINEAR)&&(s.mag==GL_NEAREST||s.mag==GL_LINEAR),"Invalid pack sampling filter.");
        for(const auto wrap:{s.wrapS,s.wrapT,s.wrapR})need(wrap==GL_CLAMP_TO_EDGE||wrap==GL_REPEAT||wrap==GL_MIRRORED_REPEAT,"Unsupported pack texture wrap.");
        need(std::isfinite(s.minLod)&&std::isfinite(s.maxLod)&&std::isfinite(s.lodBias)&&s.minLod<=s.maxLod,"Invalid pack sampling LOD.");
    }
    GLint tex(GLenum target,GLenum key)const{GLint value=0;call(api_.GetTexParameteriv,target,key,&value);return value;}
    GLint level(GLenum target,GLint n,GLenum key)const{GLint value=0;call(api_.GetTexLevelParameteriv,target,n,key,&value);return value;}
    void validateTexture(const PackTextureInput& input)const{
        need(call(api_.IsTexture,input.texture)==GL_TRUE,"Pack texture object is unavailable.");
        need(!input.sampler||call(api_.IsSampler,input.sampler)==GL_TRUE,"Pack sampler object is unavailable.");
        call(api_.BindTexture,input.target,input.texture);
        auto parameter=[&](GLenum key){GLint v=0;if(input.sampler)call(api_.GetSamplerParameteriv,input.sampler,key,&v);else call(api_.GetTexParameteriv,input.target,key,&v);return v;};
        auto real=[&](GLenum key){GLfloat v=0;if(input.sampler)call(api_.GetSamplerParameterfv,input.sampler,key,&v);else call(api_.GetTexParameterfv,input.target,key,&v);return v;};
        const auto& s=input.sampling;
        need(parameter(GL_TEXTURE_MIN_FILTER)==s.min&&parameter(GL_TEXTURE_MAG_FILTER)==s.mag&&parameter(GL_TEXTURE_WRAP_S)==s.wrapS&&parameter(GL_TEXTURE_WRAP_T)==s.wrapT&&parameter(GL_TEXTURE_WRAP_R)==s.wrapR&&parameter(GL_TEXTURE_COMPARE_MODE)==GL_NONE,"Pack sampler state does not match its explicit route.");
        need(real(GL_TEXTURE_MIN_LOD)==s.minLod&&real(GL_TEXTURE_MAX_LOD)==s.maxLod&&real(GL_TEXTURE_LOD_BIAS)==s.lodBias,"Pack sampler LOD does not match its explicit route.");
        need(tex(input.target,GL_TEXTURE_BASE_LEVEL)==0,"Nonzero pack texture base level is unsupported.");const GLint maximum=tex(input.target,GL_TEXTURE_MAX_LEVEL);need(maximum>=0,"Invalid pack texture maximum level.");
        if(input.format==GL_DEPTH24_STENCIL8||input.format==GL_DEPTH32F_STENCIL8)need(tex(input.target,GL_DEPTH_STENCIL_TEXTURE_MODE)==GL_DEPTH_COMPONENT,"Pack depth texture selects stencil data.");
        const bool mip=s.min!=GL_NEAREST&&s.min!=GL_LINEAR;GLint last=0;for(GLint size=std::max({input.width,input.height,input.depth});mip&&size>1;size/=2)++last;last=std::min(last,maximum);
        GLint w=input.width,h=input.height,d=input.depth;
        for(GLint n=0;n<=last;++n){for(unsigned face=0;face<(input.target==GL_TEXTURE_CUBE_MAP?6u:1u);++face){const auto t=input.target==GL_TEXTURE_CUBE_MAP?GL_TEXTURE_CUBE_MAP_POSITIVE_X+face:input.target;
            need(level(t,n,GL_TEXTURE_WIDTH)==w&&level(t,n,GL_TEXTURE_HEIGHT)==h&&level(t,n,GL_TEXTURE_DEPTH)==d&&level(t,n,GL_TEXTURE_INTERNAL_FORMAT)==static_cast<GLint>(input.format),"Incomplete or mismatched pack texture storage.");
        }w=std::max(1,w/2);h=std::max(1,h/2);if(input.target==GL_TEXTURE_3D)d=std::max(1,d/2);}
    }
    void feedback(const std::vector<Unit>& units)const{
        if(integer(GL_DRAW_FRAMEBUFFER_BINDING)==0)return;
        auto attachment=[&](GLenum point){GLint type=0;call(api_.GetFramebufferAttachmentParameteriv,GL_DRAW_FRAMEBUFFER,point,GL_FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE,&type);if(type!=GL_TEXTURE)return;GLint name=0;call(api_.GetFramebufferAttachmentParameteriv,GL_DRAW_FRAMEBUFFER,point,GL_FRAMEBUFFER_ATTACHMENT_OBJECT_NAME,&name);for(const auto& unit:units)need(static_cast<GLuint>(name)!=unit.input.texture,"Pack texture is attached to the active draw framebuffer.");};
        for(GLint n=0;n<attachments_;++n)attachment(GL_COLOR_ATTACHMENT0+n);attachment(GL_DEPTH_ATTACHMENT);attachment(GL_STENCIL_ATTACHMENT);
    }
    void restore(){
        if(!pending_)return;ensure();std::exception_ptr failure;
        const auto attempt=[&](auto fn){try{fn();}catch(...){if(!failure)failure=std::current_exception();}};
        for(size_t n=savedCount_;n>0;--n){auto& s=saved_[n-1];
            if(s.texturePending)attempt([&]{need(!s.texture||call(api_.IsTexture,s.texture)==GL_TRUE,"Previous pack texture binding was deleted.");call(api_.ActiveTexture,GL_TEXTURE0+s.unit);call(api_.BindTexture,s.target,s.texture);s.texturePending=false;});
            if(s.samplerPending)attempt([&]{need(!s.sampler||call(api_.IsSampler,s.sampler)==GL_TRUE,"Previous pack sampler binding was deleted.");call(api_.BindSampler,s.unit,s.sampler);s.samplerPending=false;});
        }
        attempt([&]{call(api_.ActiveTexture,active_);});
        if(failure)std::rethrow_exception(failure);pending_=false;savedCount_=0;owners_.clear();
    }
public:
    PackTextureBinder(const PackTextureBinder&)=delete;PackTextureBinder& operator=(const PackTextureBinder&)=delete;
    ~PackTextureBinder()noexcept{try{restore();}catch(...){if(pending_)++unrestored_;}}
    static std::unique_ptr<PackTextureBinder> create(PackUniformWriter&& writer,PackTextureApi api){
        writer.programForDraw();api.validate();auto check=[&]{writer.programForDraw();need(api.GetError()==GL_NO_ERROR,"Pack texture OpenGL error.");};check();GLint attachments=0;writer.programForDraw();api.GetIntegerv(GL_MAX_COLOR_ATTACHMENTS,&attachments);check();need(attachments>0&&attachments<=32,"Pack framebuffer attachment limit is unsupported.");
        return std::unique_ptr<PackTextureBinder>(new PackTextureBinder(std::move(writer),api,attachments));
    }
    static std::unique_ptr<PackTextureBinder> native(PackUniformWriter&& writer){auto api=PackTextureApi::native(writer);return create(std::move(writer),api);}
    static size_t unrestoredOnDestruction(){return unrestored_.load();}
    bool pendingRestore()const noexcept{return pending_;}
    const PackUniformWriter& uniforms()const{return writer_;}
    void collect(){ensure();need(!running_,"Reentrant pack texture collection.");restore();}
    void write(const std::vector<PackUniformValue>& values){ensure();need(!running_,"Cannot change uniforms inside a pack texture scope.");restore();writer_.write(values);}
    void run(const std::vector<PackTextureInput>& inputs,const std::function<void(GLuint)>& draw){
        const auto program=writer_.programForDraw();need(!running_,"Reentrant pack texture scope.");restore();running_=true;
        try{
            need(bool(draw)&&inputs.size()==writer_.samplers_.size()&&inputs.size()<=512,"Incomplete or extra pack texture inputs.");
            std::vector<Unit> units;std::vector<PackTextureInput> owners;owners.reserve(inputs.size());
            for(const auto& s:writer_.samplers_){const auto it=std::find_if(inputs.begin(),inputs.end(),[&](const auto& input){return input.name==s.name;});need(it!=inputs.end(),"Missing pack sampler texture.");const auto input=*it;live(input);sampling(input.sampling);
                need(input.texture&&input.target==target(s.type)&&format(input.format)&&input.width>0&&input.height>0&&input.depth>0,"Invalid pack texture descriptor.");need(input.target==GL_TEXTURE_3D||input.depth==1,"Invalid pack texture depth.");need(input.target!=GL_TEXTURE_CUBE_MAP||input.width==input.height,"Pack cubemap must be square.");
                const auto prior=std::find_if(units.begin(),units.end(),[&](const auto& unit){return unit.unit==s.unit;});
                if(prior==units.end()){need(units.size()<32,"Pack texture unit scope exceeds 32 bindings.");units.push_back({s.unit,input});}
                else{const auto& p=prior->input;need(p.texture==input.texture&&p.target==input.target&&p.sampler==input.sampler&&p.format==input.format&&p.width==input.width&&p.height==input.height&&p.depth==input.depth&&p.sampling==input.sampling&&p.owner.get()==input.owner.get()&&p.generation==input.generation,"Conflicting pack texture routes share one unit.");}owners.push_back(input);
            }
            need(std::all_of(inputs.begin(),inputs.end(),[&](const auto& input){return std::count_if(inputs.begin(),inputs.end(),[&](const auto& other){return other.name==input.name;})==1;}),"Duplicate pack texture input.");
            error();feedback(units);const auto active=integer(GL_ACTIVE_TEXTURE);need(active>=GL_TEXTURE0&&static_cast<uint32_t>(active-GL_TEXTURE0)<writer_.textureUnits_,"Invalid active texture unit.");active_=static_cast<GLenum>(active);owners_=std::move(owners);savedCount_=0;pending_=true;
            for(const auto& unit:units){GLint sampler=0;call(api_.GetIntegeri_v,GL_SAMPLER_BINDING,unit.unit,&sampler);call(api_.ActiveTexture,GL_TEXTURE0+unit.unit);const auto old=integer(binding(unit.input.target));saved_[savedCount_++]={unit.unit,unit.input.target,static_cast<GLuint>(old),static_cast<GLuint>(sampler)};}
            for(const auto& unit:units){live(unit.input);call(api_.ActiveTexture,GL_TEXTURE0+unit.unit);validateTexture(unit.input);call(api_.BindSampler,unit.unit,unit.input.sampler);}
            for(const auto& input:owners_)live(input);writer_.programForDraw();draw(program);writer_.programForDraw();error();for(const auto& input:owners_)live(input);
            restore();running_=false;
        }catch(...){const auto failure=std::current_exception();try{restore();}catch(...){}running_=false;std::rethrow_exception(failure);}
    }
};
}
