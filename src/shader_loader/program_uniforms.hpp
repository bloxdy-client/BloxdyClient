#pragma once
#include "program_bindings.hpp"
#include <optional>

namespace bridge::shaderloader {
struct PackSamplerUnit {std::string name;GLenum type;uint32_t unit;};
struct ProgramUniformApi {
#define PACK_UNIFORM_APIS(X) \
 X(ProgramUniform1fv,PFNGLPROGRAMUNIFORM1FVPROC) X(ProgramUniform2fv,PFNGLPROGRAMUNIFORM2FVPROC) \
 X(ProgramUniform3fv,PFNGLPROGRAMUNIFORM3FVPROC) X(ProgramUniform4fv,PFNGLPROGRAMUNIFORM4FVPROC) \
 X(ProgramUniform1iv,PFNGLPROGRAMUNIFORM1IVPROC) X(ProgramUniform2iv,PFNGLPROGRAMUNIFORM2IVPROC) \
 X(ProgramUniform3iv,PFNGLPROGRAMUNIFORM3IVPROC) X(ProgramUniform4iv,PFNGLPROGRAMUNIFORM4IVPROC) \
 X(ProgramUniformMatrix2fv,PFNGLPROGRAMUNIFORMMATRIX2FVPROC) X(ProgramUniformMatrix3fv,PFNGLPROGRAMUNIFORMMATRIX3FVPROC) \
 X(ProgramUniformMatrix4fv,PFNGLPROGRAMUNIFORMMATRIX4FVPROC) X(GetIntegerv,PFNGLGETINTEGERVPROC) X(GetError,PFNGLGETERRORPROC)
#define PACK_DECLARE_UNIFORM(name,type) type name=nullptr;
    PACK_UNIFORM_APIS(PACK_DECLARE_UNIFORM)
#undef PACK_DECLARE_UNIFORM
    void validate()const{
#define PACK_REQUIRE_UNIFORM(name,type) if(!name)throw std::runtime_error("Missing pack uniform entry point: " #name);
        PACK_UNIFORM_APIS(PACK_REQUIRE_UNIFORM)
#undef PACK_REQUIRE_UNIFORM
    }
    static ProgramUniformApi native(const ProgramDomain::Lease& lease){
        ProgramUniformApi api;
        // Resolve only on the lease's already-current owner context. This does
        // not initialize GLFW, make a context current or alter global loaders.
#define PACK_LOAD_UNIFORM(name,type) lease.handle();api.name=reinterpret_cast<type>(glfwGetProcAddress("gl" #name));
        PACK_UNIFORM_APIS(PACK_LOAD_UNIFORM)
#undef PACK_LOAD_UNIFORM
        lease.handle();api.validate();return api;
    }
};
#undef PACK_UNIFORM_APIS

// Owns its exact linked program lease and its immutable reflected routes.
// Explicit values only: no semantic producers, texture binding or draw calls.
class PackUniformWriter {
    friend class PackTextureBinder;
    friend class PackVertexBinder;
    ProgramDomain::Lease lease_;
    PackBindingPlan plan_;
    ProgramUniformApi api_;
    uint32_t textureUnits_=0;
    bool ready_=false;
    std::vector<PackSamplerUnit> samplers_;
    PackUniformWriter(ProgramDomain::Lease&& lease,PackBindingPlan&& plan,ProgramUniformApi api,uint32_t units)
        :lease_(std::move(lease)),plan_(std::move(plan)),api_(api),textureUnits_(units){}
    void error()const{lease_.handle();const auto error=api_.GetError();if(error!=GL_NO_ERROR)throw std::runtime_error("Pack uniform OpenGL error "+std::to_string(error));}
    template<class F,class... A>void call(F fn,A... args){lease_.handle();fn(args...);error();}
public:
    PackUniformWriter(const PackUniformWriter&)=delete;PackUniformWriter& operator=(const PackUniformWriter&)=delete;
    PackUniformWriter(PackUniformWriter&&)noexcept=default;PackUniformWriter& operator=(PackUniformWriter&&)noexcept=default;
    static PackUniformWriter create(ProgramDomain::Lease&& lease,const PackBindingRequest& request,ProgramUniformApi api){
        lease.handle();api.validate();auto plan=PackBindingPlan::create(lease.reflection(),request);
        auto check=[&]{lease.handle();const auto error=api.GetError();if(error!=GL_NO_ERROR)throw std::runtime_error("Pack uniform OpenGL error "+std::to_string(error));};
        check();GLint units=0;lease.handle();api.GetIntegerv(GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS,&units);check();
        if(units<=0)throw std::runtime_error("Invalid pack uniform texture unit limit.");
        // Ownership transfers only after all construction gates succeed.
        return PackUniformWriter(std::move(lease),std::move(plan),api,static_cast<uint32_t>(units));
    }
    static PackUniformWriter native(ProgramDomain::Lease&& lease,const PackBindingRequest& request){auto api=ProgramUniformApi::native(lease);return create(std::move(lease),request,api);}
    const PackBindingPlan& plan()const{return plan_;}
    const LinkedProgramInfo& reflection()const{return lease_.reflection();}
    uint32_t textureUnitLimit()const{return textureUnits_;}
    GLuint programForDraw()const{const auto program=lease_.handle();if(!ready_)throw std::runtime_error("Pack uniforms are not ready for drawing.");return program;}
    void write(const std::vector<PackUniformValue>& values){
        const auto program=lease_.handle();ready_=false;samplers_.clear();
        // Own a complete validated snapshot before the first GL call. A CPU
        // rejection preserves driver values; it does not validate this frame.
        const auto checked=plan_.checkValues(values,textureUnits_);std::vector<PackSamplerUnit> samplers;
        for(const auto& value:checked)if(value.type==GL_SAMPLER_2D||value.type==GL_SAMPLER_3D||value.type==GL_SAMPLER_CUBE)samplers.push_back({value.name,value.type,static_cast<uint32_t>(std::get<std::vector<int32_t>>(value.components)[0])});
        error();
        for(const auto& value:checked){
            if(const auto* f=std::get_if<std::vector<float>>(&value.components)){
                switch(value.type){
                case GL_FLOAT:call(api_.ProgramUniform1fv,program,value.location,1,f->data());break;
                case GL_FLOAT_VEC2:call(api_.ProgramUniform2fv,program,value.location,1,f->data());break;
                case GL_FLOAT_VEC3:call(api_.ProgramUniform3fv,program,value.location,1,f->data());break;
                case GL_FLOAT_VEC4:call(api_.ProgramUniform4fv,program,value.location,1,f->data());break;
                case GL_FLOAT_MAT2:call(api_.ProgramUniformMatrix2fv,program,value.location,1,static_cast<GLboolean>(GL_FALSE),f->data());break;
                case GL_FLOAT_MAT3:call(api_.ProgramUniformMatrix3fv,program,value.location,1,static_cast<GLboolean>(GL_FALSE),f->data());break;
                case GL_FLOAT_MAT4:call(api_.ProgramUniformMatrix4fv,program,value.location,1,static_cast<GLboolean>(GL_FALSE),f->data());break;
                default:throw std::runtime_error("Unsupported pack float uniform upload.");
                }
            }else{
                static_assert(std::is_same_v<int32_t,GLint>);const auto& v=std::get<std::vector<int32_t>>(value.components);
                switch(value.type){
                case GL_INT:case GL_BOOL:case GL_SAMPLER_2D:case GL_SAMPLER_3D:case GL_SAMPLER_CUBE:call(api_.ProgramUniform1iv,program,value.location,1,v.data());break;
                case GL_INT_VEC2:case GL_BOOL_VEC2:call(api_.ProgramUniform2iv,program,value.location,1,v.data());break;
                case GL_INT_VEC3:case GL_BOOL_VEC3:call(api_.ProgramUniform3iv,program,value.location,1,v.data());break;
                case GL_INT_VEC4:case GL_BOOL_VEC4:call(api_.ProgramUniform4iv,program,value.location,1,v.data());break;
                default:throw std::runtime_error("Unsupported pack integer uniform upload.");
                }
            }
        }
        lease_.handle();samplers_=std::move(samplers);ready_=true;
    }
};
// A candidate may replace the installed program only after a full successful
// upload. Failures retain the preceding lease and its existing uniform values.
class PackUniformSlot {
    std::optional<PackUniformWriter> active_;
public:
    void replace(PackUniformWriter&& next){next.programForDraw();active_=std::move(next);}
    const PackUniformWriter& get()const{if(!active_)throw std::runtime_error("Empty pack uniform slot.");return *active_;}
    void write(const std::vector<PackUniformValue>& values){if(!active_)throw std::runtime_error("Empty pack uniform slot.");active_->write(values);}
    void clear()noexcept{active_.reset();}
};
}
