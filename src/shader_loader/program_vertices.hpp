#pragma once
#include "program_textures.hpp"

namespace bridge::shaderloader {
struct PackVertexApi {
#define PACK_VERTEX_APIS(X) \
 X(GenVertexArrays,PFNGLGENVERTEXARRAYSPROC) X(DeleteVertexArrays,PFNGLDELETEVERTEXARRAYSPROC) X(BindVertexArray,PFNGLBINDVERTEXARRAYPROC) X(IsVertexArray,PFNGLISVERTEXARRAYPROC) \
 X(BindBuffer,PFNGLBINDBUFFERPROC) X(IsBuffer,PFNGLISBUFFERPROC) X(GetBufferParameteri64v,PFNGLGETBUFFERPARAMETERI64VPROC) X(GetBufferParameteriv,PFNGLGETBUFFERPARAMETERIVPROC) \
 X(VertexAttribPointer,PFNGLVERTEXATTRIBPOINTERPROC) X(VertexAttribIPointer,PFNGLVERTEXATTRIBIPOINTERPROC) X(EnableVertexAttribArray,PFNGLENABLEVERTEXATTRIBARRAYPROC) X(VertexAttribDivisor,PFNGLVERTEXATTRIBDIVISORPROC) \
 X(UseProgram,PFNGLUSEPROGRAMPROC) X(IsProgram,PFNGLISPROGRAMPROC) X(DrawArraysInstanced,PFNGLDRAWARRAYSINSTANCEDPROC) X(GetIntegerv,PFNGLGETINTEGERVPROC) X(GetError,PFNGLGETERRORPROC)
#define PACK_VERTEX_DECLARE(name,type) type name=nullptr;
    PACK_VERTEX_APIS(PACK_VERTEX_DECLARE)
#undef PACK_VERTEX_DECLARE
    void validate()const{
#define PACK_VERTEX_CHECK(name,type) if(!name)throw std::runtime_error("Missing pack vertex entry point: " #name);
        PACK_VERTEX_APIS(PACK_VERTEX_CHECK)
#undef PACK_VERTEX_CHECK
    }
    static PackVertexApi native(const PackTextureBinder& textures){PackVertexApi api;
#define PACK_VERTEX_LOAD(name,type) textures.uniforms().programForDraw();api.name=reinterpret_cast<type>(glfwGetProcAddress("gl" #name));
        PACK_VERTEX_APIS(PACK_VERTEX_LOAD)
#undef PACK_VERTEX_LOAD
        textures.uniforms().programForDraw();api.validate();return api;
    }
};
#undef PACK_VERTEX_APIS

// Explicit native buffers from the same context. The producer pins storage,
// contents and identity for the whole synchronous scope; no source GL import.
struct PackVertexInput {
    std::string name,source;
    GLuint buffer=0;GLenum storage=GL_FLOAT;bool normalized=false;
    uint64_t bytes=0,offset=0;GLsizei stride=0;GLuint divisor=0;
    // Matrices use consecutive column locations and explicit column spacing.
    uint32_t columnStride=0;
    std::shared_ptr<const void> owner;uint64_t generation=0;
    std::function<bool(uint64_t)> current;
};
struct PackArrayDraw {GLenum mode=GL_TRIANGLES;GLint first=0;GLsizei count=0,instances=1;};

class PackVertexBinder {
    friend class PackFramebufferBinder;
    struct Shape {GLint rows,columns;bool integer;};
    struct Column {GLuint location;GLint rows;bool integer;size_t input;uint64_t offset;};
    std::unique_ptr<PackTextureBinder> textures_;PackVertexApi api_;GLint limit_=0;
    GLuint vao_=0,oldVao_=0,oldBuffer_=0,oldProgram_=0;
    bool pending_=false,vaoPending_=false,bufferPending_=false,programPending_=false,running_=false;
    std::vector<PackVertexInput> owners_;
    static inline std::atomic<size_t> unrestored_{0};
    PackVertexBinder(std::unique_ptr<PackTextureBinder>&& textures,PackVertexApi api,GLint limit):textures_(std::move(textures)),api_(api),limit_(limit){}
    static void need(bool b,const char* message){if(!b)throw std::runtime_error(message);}
    void ensure()const{textures_->uniforms().lease_.handle();}
    void error()const{ensure();need(api_.GetError()==GL_NO_ERROR,"Pack vertex OpenGL error.");}
    template<class F,class... A>auto call(F fn,A... args)const{ensure();if constexpr(std::is_void_v<std::invoke_result_t<F,A...>>){fn(args...);error();}else{auto result=fn(args...);error();return result;}}
    GLint integer(GLenum key)const{GLint result=0;call(api_.GetIntegerv,key,&result);return result;}
    static Shape shape(GLenum t){switch(t){
        case GL_FLOAT:return {1,1,false};case GL_FLOAT_VEC2:return {2,1,false};case GL_FLOAT_VEC3:return {3,1,false};case GL_FLOAT_VEC4:return {4,1,false};
        case GL_FLOAT_MAT2:return {2,2,false};case GL_FLOAT_MAT3:return {3,3,false};case GL_FLOAT_MAT4:return {4,4,false};
        case GL_INT:return {1,1,true};case GL_INT_VEC2:return {2,1,true};case GL_INT_VEC3:return {3,1,true};case GL_INT_VEC4:return {4,1,true};
        default:throw std::runtime_error("Unsupported pack vertex attribute type.");
    }}
    static uint32_t scalar(GLenum t){switch(t){case GL_BYTE:case GL_UNSIGNED_BYTE:return 1;case GL_SHORT:case GL_UNSIGNED_SHORT:return 2;case GL_FLOAT:case GL_INT:return 4;default:throw std::runtime_error("Unsupported pack vertex storage type.");}}
    static void live(const PackVertexInput& input){need(input.owner&&input.generation&&input.current&&input.current(input.generation),"Stale or unowned pack vertex buffer.");}
    std::vector<Column> check(const std::vector<PackVertexInput>& inputs,const PackArrayDraw& draw)const{
        need((draw.mode==GL_POINTS||draw.mode==GL_LINES||draw.mode==GL_TRIANGLES)&&draw.first>=0&&draw.count>0&&draw.instances>0,"Invalid pack array draw.");
        need(static_cast<uint64_t>(draw.count)*draw.instances<=4194304&&static_cast<uint64_t>(draw.first)+draw.count<=INT_MAX,"Pack array draw exceeds bounded work range.");
        const auto& routes=textures_->uniforms().plan().attributes();need(inputs.size()==routes.size()&&inputs.size()<=16,"Incomplete or extra pack vertex inputs.");
        std::vector<Column> columns;std::set<GLuint> locations;std::set<std::string> names;
        for(const auto& route:routes){
            auto it=std::find_if(inputs.begin(),inputs.end(),[&](const auto& input){return input.name==route.name;});need(it!=inputs.end()&&names.insert(it->name).second&&it->source==route.source,"Invalid explicit pack vertex route.");
            const auto& input=*it;live(input);const auto s=shape(route.type);const auto size=scalar(input.storage);const uint64_t width=static_cast<uint64_t>(s.rows)*size;
            need(input.buffer&&input.bytes>0&&input.bytes<=64ull*1024*1024&&input.stride>0&&input.stride<=2048&&input.offset%size==0&&input.stride%size==0,"Invalid pack vertex buffer layout.");
            need(!s.integer||(!input.normalized&&(input.storage==GL_INT||input.storage==GL_SHORT||input.storage==GL_BYTE)),"Integer pack attributes require signed integer storage without normalization.");
            need(s.integer||input.storage!=GL_INT,"Integer-to-float pack storage is unsupported.");
            need(input.storage!=GL_FLOAT||!input.normalized,"Float pack storage cannot request normalization.");
            need(s.columns==1?input.columnStride==0:input.columnStride>=width&&input.columnStride%size==0,"Invalid pack matrix column layout.");
            need(route.location>=0&&route.location<=limit_-s.columns,"Pack vertex locations exceed context limit.");
            const uint64_t index=input.divisor?(static_cast<uint64_t>(draw.instances)-1)/input.divisor:static_cast<uint64_t>(draw.first)+draw.count-1;
            for(GLint column=0;column<s.columns;++column){
                const uint64_t relative=static_cast<uint64_t>(column)*input.columnStride;
                need(relative+width<=static_cast<uint64_t>(input.stride)&&input.offset<=input.bytes&&relative<=input.bytes-input.offset,"Pack vertex column exceeds record or buffer.");
                const uint64_t offset=input.offset+relative;
                need(width<=input.bytes-offset&&index<=(input.bytes-offset-width)/static_cast<uint64_t>(input.stride),"Pack vertex draw would fetch beyond buffer storage.");
                const auto location=static_cast<GLuint>(route.location+column);need(locations.insert(location).second,"Overlapping pack vertex locations.");
                columns.push_back({location,s.rows,s.integer,static_cast<size_t>(it-inputs.begin()),offset});
            }
        }
        return columns;
    }
    void restore(){
        if(!pending_)return;ensure();std::exception_ptr failure;
        auto attempt=[&](auto fn){try{fn();}catch(...){if(!failure)failure=std::current_exception();}};
        if(programPending_)attempt([&]{need(!oldProgram_||call(api_.IsProgram,oldProgram_)==GL_TRUE,"Previous pack program was deleted.");call(api_.UseProgram,oldProgram_);programPending_=false;});
        if(vaoPending_)attempt([&]{need(!oldVao_||call(api_.IsVertexArray,oldVao_)==GL_TRUE,"Previous pack VAO was deleted.");call(api_.BindVertexArray,oldVao_);vaoPending_=false;});
        if(bufferPending_)attempt([&]{need(!oldBuffer_||call(api_.IsBuffer,oldBuffer_)==GL_TRUE,"Previous pack array buffer was deleted.");call(api_.BindBuffer,GL_ARRAY_BUFFER,oldBuffer_);bufferPending_=false;});
        if(vao_&&!vaoPending_)attempt([&]{call(api_.DeleteVertexArrays,1,&vao_);vao_=0;});
        if(failure)std::rethrow_exception(failure);pending_=false;owners_.clear();
    }
public:
    PackVertexBinder(const PackVertexBinder&)=delete;PackVertexBinder& operator=(const PackVertexBinder&)=delete;
    ~PackVertexBinder()noexcept{try{restore();}catch(...){if(pending_)++unrestored_;}}
    static std::unique_ptr<PackVertexBinder> create(std::unique_ptr<PackTextureBinder>&& textures,PackVertexApi api){
        need(bool(textures),"Missing pack texture binder.");textures->uniforms().programForDraw();need(!textures->pendingRestore(),"Collect pack texture state before vertex binder construction.");api.validate();
        auto check=[&]{textures->uniforms().programForDraw();need(api.GetError()==GL_NO_ERROR,"Pack vertex OpenGL error.");};check();GLint limit=0;textures->uniforms().programForDraw();api.GetIntegerv(GL_MAX_VERTEX_ATTRIBS,&limit);check();need(limit>0,"Invalid pack vertex attribute limit.");
        return std::unique_ptr<PackVertexBinder>(new PackVertexBinder(std::move(textures),api,std::min(limit,16)));
    }
    static std::unique_ptr<PackVertexBinder> native(std::unique_ptr<PackTextureBinder>&& textures){need(bool(textures),"Missing pack texture binder.");auto api=PackVertexApi::native(*textures);return create(std::move(textures),api);}
    static size_t unrestoredOnDestruction(){return unrestored_.load();}
    bool pendingRestore()const{return pending_||textures_->pendingRestore();}
    void collect(){ensure();need(!running_,"Reentrant pack vertex collection.");restore();textures_->collect();}
    void write(const std::vector<PackUniformValue>& values){ensure();need(!running_,"Reentrant pack vertex uniform write.");collect();textures_->write(values);}
    void draw(const std::vector<PackVertexInput>& inputs,const std::vector<PackTextureInput>& textures,const PackArrayDraw& draw){
        ensure();need(!running_,"Reentrant pack vertex draw.");collect();textures_->uniforms().programForDraw();running_=true;
        try{
            need(inputs.size()<=16,"Pack vertex input count exceeds scope limit.");
            for(const auto& input:inputs)need(input.name.size()<=255&&input.source.size()<=127,"Pack vertex input key exceeds limit.");
            const PackArrayDraw command=draw;owners_=inputs;const auto columns=check(owners_,command);
            error();need(integer(GL_TRANSFORM_FEEDBACK_ACTIVE)==GL_FALSE,"Pack vertex scope rejects active transform feedback.");
            oldVao_=static_cast<GLuint>(integer(GL_VERTEX_ARRAY_BINDING));oldBuffer_=static_cast<GLuint>(integer(GL_ARRAY_BUFFER_BINDING));oldProgram_=static_cast<GLuint>(integer(GL_CURRENT_PROGRAM));
            pending_=vaoPending_=bufferPending_=programPending_=true;
            // Keep generated names even if a subsequent context/error check fails.
            ensure();api_.GenVertexArrays(1,&vao_);error();need(vao_!=0,"Cannot allocate pack vertex array.");call(api_.BindVertexArray,vao_);
            for(const auto& input:owners_){live(input);need(call(api_.IsBuffer,input.buffer)==GL_TRUE,"Pack vertex buffer is unavailable.");call(api_.BindBuffer,GL_ARRAY_BUFFER,input.buffer);
                GLint64 bytes=0;call(api_.GetBufferParameteri64v,GL_ARRAY_BUFFER,GL_BUFFER_SIZE,&bytes);GLint mapped=0;call(api_.GetBufferParameteriv,GL_ARRAY_BUFFER,GL_BUFFER_MAPPED,&mapped);
                need(bytes>0&&static_cast<uint64_t>(bytes)==input.bytes&&mapped==GL_FALSE,"Pack vertex buffer storage is changed or mapped.");
            }
            for(const auto& c:columns){const auto& input=owners_[c.input];call(api_.BindBuffer,GL_ARRAY_BUFFER,input.buffer);const auto offset=reinterpret_cast<const void*>(static_cast<uintptr_t>(c.offset));
                if(c.integer)call(api_.VertexAttribIPointer,c.location,c.rows,input.storage,input.stride,offset);
                else call(api_.VertexAttribPointer,c.location,c.rows,input.storage,static_cast<GLboolean>(input.normalized?GL_TRUE:GL_FALSE),input.stride,offset);
                call(api_.EnableVertexAttribArray,c.location);call(api_.VertexAttribDivisor,c.location,input.divisor);
            }
            textures_->run(textures,[&](GLuint program){for(const auto& input:owners_)live(input);call(api_.UseProgram,program);call(api_.DrawArraysInstanced,command.mode,command.first,command.count,command.instances);for(const auto& input:owners_)live(input);});
            restore();running_=false;
        }catch(...){auto failure=std::current_exception();try{restore();}catch(...){}if(!pending_)owners_.clear();running_=false;std::rethrow_exception(failure);}
    }
};
}
