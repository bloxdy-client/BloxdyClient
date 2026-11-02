#pragma once
#include "glsl_translation.hpp"
#include "../gl_api.hpp"
#include <atomic>
#include <array>
#include <initializer_list>
#include <memory>
#include <functional>
#include <mutex>
#include <thread>
#include <type_traits>

namespace bridge::shaderloader {
// Frozen entry points for ONE caller-owned, already existing context. Injection
// allows CPU lifecycle tests; native() uses the real current GLFW context.
struct ProgramApi {
    PFNGLGETPROGRAMRESOURCENAMEPROC GetProgramResourceName=nullptr;
#define PACK_PROGRAM_APIS(X) \
 X(CreateShader) X(ShaderSource) X(CompileShader) X(GetShaderiv) X(GetShaderInfoLog) X(DeleteShader) \
 X(CreateProgram) X(AttachShader) X(LinkProgram) X(GetProgramiv) X(GetProgramInfoLog) X(DeleteProgram) \
 X(GetActiveAttrib) X(GetActiveUniform) X(GetAttribLocation) X(GetUniformLocation) X(GetAttachedShaders) \
 X(GetProgramInterfaceiv) X(GetProgramResourceiv) X(GetIntegerv) X(GetError)
#define PACK_DECLARE(name) decltype(nativegl::gl##name) name=nullptr;
    PACK_PROGRAM_APIS(PACK_DECLARE)
#undef PACK_DECLARE
    static ProgramApi current(){ProgramApi a;
#define PACK_COPY(name) a.name=nativegl::gl##name;
        PACK_PROGRAM_APIS(PACK_COPY)
#undef PACK_COPY
        a.GetProgramResourceName=reinterpret_cast<PFNGLGETPROGRAMRESOURCENAMEPROC>(glfwGetProcAddress("glGetProgramResourceName"));
        return a;
    }
    void validate()const{
        if(!GetProgramResourceName)throw std::runtime_error("Missing pack program entry point: GetProgramResourceName");
#define PACK_CHECK(name) if(!name)throw std::runtime_error("Missing pack program entry point: " #name);
        PACK_PROGRAM_APIS(PACK_CHECK)
#undef PACK_CHECK
    }
};
#undef PACK_PROGRAM_APIS
struct ActiveProgramVariable {std::string name;GLenum type;GLint location;};
struct LinkedProgramInfo {
    std::vector<ActiveProgramVariable> attributes,uniforms;
    std::vector<uint32_t> outputLocations;
    bool writesFragmentDepth=false;
    std::vector<std::string> vertexSources,fragmentSources;
    std::string vertexLog,fragmentLog,linkLog;
};

class ProgramDomain {
    struct Slot {uint64_t generation=0;GLuint program=0,vertex=0,fragment=0;bool occupied=false,retired=false;};
    struct State {
        ProgramApi api;std::function<uintptr_t()> identity;uintptr_t context;std::thread::id thread;
        std::array<Slot,8> slots{};mutable std::mutex mutex;bool closed=false;GLint attributeLimit=0,outputLimit=0;
        static inline std::atomic<size_t> uncollected{0};
        State(ProgramApi a,std::function<uintptr_t()> current):api(a),identity(std::move(current)),context(0),thread(std::this_thread::get_id()){
            api.validate();if(!identity||(context=identity())==0)throw std::runtime_error("Pack program needs an existing context identity.");
            error();GLint major=0,minor=0;query(GL_MAJOR_VERSION,major);query(GL_MINOR_VERSION,minor);
            require(major>4||major==4&&minor>=3,"Pack reflection requires desktop OpenGL 4.3 or later.");query(GL_MAX_VERTEX_ATTRIBS,attributeLimit);query(GL_MAX_DRAW_BUFFERS,outputLimit);
            require(attributeLimit>0&&outputLimit>0,"Invalid pack program context limits.");attributeLimit=std::min(attributeLimit,16);outputLimit=std::min(outputLimit,8);
        }
        static void require(bool yes,const std::string& text){if(!yes)throw std::runtime_error(text);}
        bool current()const{return thread==std::this_thread::get_id()&&identity&&identity()==context;}
        void ensure()const{require(current()&&!closed,"Pack program context/thread is not current.");}
        template<class F,class... A>auto raw(F fn,A... args){ensure();return fn(args...);}
        void error(){const auto e=raw(api.GetError);require(e==GL_NO_ERROR,"Pack program OpenGL error "+std::to_string(e));}
        template<class F,class... A>auto call(F fn,A... args){
            if constexpr(std::is_void_v<std::invoke_result_t<F,A...>>){raw(fn,args...);error();}
            else {auto value=raw(fn,args...);error();return value;}
        }
        void query(GLenum key,GLint& value){call(api.GetIntegerv,key,&value);}
        size_t reserve(){ensure();std::lock_guard lock(mutex);for(size_t i=0;i<slots.size();++i)if(!slots[i].occupied){auto& s=slots[i];require(s.generation!=UINT64_MAX,"Program generation exhausted.");++s.generation;s.occupied=true;s.retired=false;return i;}throw std::runtime_error("Pack program domain capacity (8) exceeded.");}
        void retire(size_t i,uint64_t generation)noexcept{try{std::lock_guard lock(mutex);if(slots[i].occupied&&slots[i].generation==generation)slots[i].retired=true;}catch(...){++uncollected;}}
        void collect(){
            ensure();GLint bound=0;query(GL_CURRENT_PROGRAM,bound);std::lock_guard lock(mutex);
            for(auto& s:slots)if(s.occupied&&s.retired){
                // Preserve a still-bound program without changing the caller's
                // binding. It continues to count against domain capacity.
                if(s.program&&s.program==static_cast<GLuint>(bound))continue;
                // Deleting the program first also releases attached shaders
                // that were already marked for deletion after successful link.
                if(s.program){raw(api.DeleteProgram,s.program);s.program=0;error();}
                if(s.vertex){raw(api.DeleteShader,s.vertex);s.vertex=0;error();}
                if(s.fragment){raw(api.DeleteShader,s.fragment);s.fragment=0;error();}
                s.occupied=false;s.retired=false;
            }
        }
        ~State()noexcept{
            // Normal shutdown is explicit, on the owning current context.
            // Never call a driver through an unrelated context/thread. A caller
            // violating domain lifetime must handle its context teardown; record
            // uncollected object names instead of silently claiming deletion.
            try{if(!closed&&current()){for(auto& s:slots)if(s.occupied)s.retired=true;collect();}}catch(...){}
            for(const auto& s:slots)uncollected+=(s.program!=0)+(s.vertex!=0)+(s.fragment!=0);
        }
        std::string log(GLuint id,bool shader){
            GLint size=0;if(shader)call(api.GetShaderiv,id,GL_INFO_LOG_LENGTH,&size);else call(api.GetProgramiv,id,GL_INFO_LOG_LENGTH,&size);
            require(size>=0,"Invalid program diagnostic length.");if(size<=1)return {};
            const auto capacity=std::min(size,16384);std::string text(capacity,'\0');GLsizei used=0;
            if(shader)call(api.GetShaderInfoLog,id,capacity,&used,text.data());else call(api.GetProgramInfoLog,id,capacity,&used,text.data());
            require(used>=0&&used<capacity,"Invalid returned program diagnostic length.");text.resize(used);if(size>capacity)text+="\n[diagnostic truncated]";return text;
        }
        static std::string legend(const std::vector<std::string>& paths){std::string out;for(size_t i=0;i<paths.size();++i){const auto line="\n"+std::to_string(i)+"="+paths[i];if(out.size()+line.size()>16384){out+="\n[source legend truncated]";break;}out+=line;}return out;}
        GLuint shader(Slot& slot,GLenum kind,const TranslatedShader& source,std::string& diagnostics){
            auto& handle=kind==GL_VERTEX_SHADER?slot.vertex:slot.fragment;handle=raw(api.CreateShader,kind);error();require(handle!=0,"Cannot create pack shader.");
            const GLchar* code=source.text.data();const GLint length=static_cast<GLint>(source.text.size());call(api.ShaderSource,handle,1,&code,&length);call(api.CompileShader,handle);
            GLint compiled=0;call(api.GetShaderiv,handle,GL_COMPILE_STATUS,&compiled);diagnostics=log(handle,true);
            require(compiled!=0,std::string(kind==GL_VERTEX_SHADER?"Vertex":"Fragment")+" pack compile failed:\n"+diagnostics+legend(source.sourcePaths));return handle;
        }
        static GLenum type(std::string_view name){
            for(const auto& pair:std::initializer_list<std::pair<std::string_view,GLenum>>{{"float",GL_FLOAT},{"vec2",GL_FLOAT_VEC2},{"vec3",GL_FLOAT_VEC3},{"vec4",GL_FLOAT_VEC4},{"mat2",GL_FLOAT_MAT2},{"mat3",GL_FLOAT_MAT3},{"mat4",GL_FLOAT_MAT4},{"int",GL_INT},{"ivec2",GL_INT_VEC2},{"ivec3",GL_INT_VEC3},{"ivec4",GL_INT_VEC4},{"bool",GL_BOOL},{"bvec2",GL_BOOL_VEC2},{"bvec3",GL_BOOL_VEC3},{"bvec4",GL_BOOL_VEC4},{"sampler2D",GL_SAMPLER_2D},{"sampler3D",GL_SAMPLER_3D},{"samplerCube",GL_SAMPLER_CUBE}})if(pair.first==name)return pair.second;
            throw std::runtime_error("Unsupported linked pack resource type.");
        }
        using Expected=std::unordered_map<std::string,GLenum>;
        static void declarations(Expected& expected,const std::vector<ShaderVariable>& list){
            require(list.size()<=256,"Pack interface count limit.");std::unordered_set<std::string> unique;
            for(const auto& v:list){require(!v.name.empty()&&v.name.size()<128&&unique.insert(v.name).second,"Duplicate/long pack interface name.");const auto t=type(v.type);const auto [at,added]=expected.emplace(v.name,t);require(added||at->second==t,"Conflicting pack interface type.");}
        }
        void reflect(GLuint program,const TranslatedShaderPair& pair,LinkedProgramInfo& info){
            GLint blocks=0,storage=0,atomic=0;call(api.GetProgramiv,program,GL_ACTIVE_UNIFORM_BLOCKS,&blocks);call(api.GetProgramiv,program,GL_ACTIVE_ATOMIC_COUNTER_BUFFERS,&atomic);call(api.GetProgramInterfaceiv,program,GL_SHADER_STORAGE_BLOCK,GL_ACTIVE_RESOURCES,&storage);require(!blocks&&!storage&&!atomic,"Unsupported pack program buffer resources.");
            Expected attributes,uniforms;declarations(attributes,pair.vertex.attributes);declarations(uniforms,pair.vertex.uniforms);declarations(uniforms,pair.fragment.uniforms);
            auto resources=[&](bool attribute){
                GLint count=0,maxName=0;call(api.GetProgramiv,program,attribute?GL_ACTIVE_ATTRIBUTES:GL_ACTIVE_UNIFORMS,&count);call(api.GetProgramiv,program,attribute?GL_ACTIVE_ATTRIBUTE_MAX_LENGTH:GL_ACTIVE_UNIFORM_MAX_LENGTH,&maxName);
                require(count>=0&&count<=(attribute?attributeLimit:512)&&maxName>=0&&maxName<=256&&(count==0||maxName>0),"Pack active resource/name count limit.");
                std::set<GLint> used;std::unordered_set<std::string> names;auto& result=attribute?info.attributes:info.uniforms;const auto& expected=attribute?attributes:uniforms;
                for(GLint i=0;i<count;++i){char name[256]{};GLsizei length=0;GLint size=0;GLenum t=0;
                    if(attribute)call(api.GetActiveAttrib,program,static_cast<GLuint>(i),256,&length,&size,&t,name);else call(api.GetActiveUniform,program,static_cast<GLuint>(i),256,&length,&size,&t,name);
                    require(length>0&&length<128&&name[length]==0&&size==1,"Unsupported active pack array/name.");std::string key(name,length);require(key.find('\0')==std::string::npos&&names.insert(key).second,"Duplicate/invalid reflected pack name.");
                    const auto it=expected.find(key);require(it!=expected.end()&&it->second==t,"Unexpected/mistyped active pack resource: "+key);
                    const auto location=attribute?call(api.GetAttribLocation,program,key.c_str()):call(api.GetUniformLocation,program,key.c_str());require(location>=0,"Active pack resource has no location.");
                    const GLint columns=attribute?(t==GL_FLOAT_MAT2?2:t==GL_FLOAT_MAT3?3:t==GL_FLOAT_MAT4?4:1):1;
                    require(!attribute||location<=attributeLimit-columns,"Pack attribute location exceeds available slots.");for(GLint c=0;c<columns;++c)require(used.insert(location+c).second,"Overlapping active pack resource location.");result.push_back({std::move(key),t,location});
                }
                // Unused declarations may be optimized away. Only the driver-
                // reflected active interface needs later runtime producers.
            };resources(true);resources(false);
            GLint count=0;call(api.GetProgramInterfaceiv,program,GL_PROGRAM_OUTPUT,GL_ACTIVE_RESOURCES,&count);require(count>=0&&count<=outputLimit+1&&static_cast<size_t>(count)<=pair.fragment.outputLocations.size()+1,"Invalid active pack output count.");std::set<uint32_t> locations;std::set<std::string> outputNames;
            for(GLint i=0;i<count;++i){const GLenum props[]={GL_LOCATION,GL_TYPE,GL_ARRAY_SIZE};GLint values[3]{};GLsizei written=0;call(api.GetProgramResourceiv,program,GL_PROGRAM_OUTPUT,static_cast<GLuint>(i),3,props,3,&written,values);
                require(written==3,"Incomplete active pack output reflection.");char name[256]{};GLsizei length=0;call(api.GetProgramResourceName,program,GL_PROGRAM_OUTPUT,static_cast<GLuint>(i),256,&length,name);
                require(length>0&&length<128&&name[length]==0,"Unsupported pack output name.");const std::string key(name,length);require(key.find('\0')==std::string::npos&&outputNames.insert(key).second,"Duplicate/invalid pack output name.");
                if(key=="gl_FragDepth"){require(values[0]==-1&&values[1]==GL_FLOAT&&values[2]==1&&!info.writesFragmentDepth,"Invalid built-in fragment depth output.");info.writesFragmentDepth=true;continue;}
                require(!key.starts_with("gl_"),"Unsupported built-in pack output.");
                require(written==3&&values[0]>=0&&values[0]<outputLimit&&values[1]==GL_FLOAT_VEC4&&values[2]==1,"Unsupported active pack output.");const auto location=static_cast<uint32_t>(values[0]);require(std::find(pair.fragment.outputLocations.begin(),pair.fragment.outputLocations.end(),location)!=pair.fragment.outputLocations.end()&&locations.insert(location).second,"Unexpected/duplicate pack output location.");}
            info.outputLocations.assign(locations.begin(),locations.end());
        }
    };
    std::shared_ptr<State> state;
public:
    class Lease {
        friend class ProgramDomain;std::shared_ptr<State> state;std::shared_ptr<const LinkedProgramInfo> info;size_t index=0;uint64_t generation=0;
        Lease(std::shared_ptr<State> s,size_t i,std::shared_ptr<const LinkedProgramInfo> metadata):state(std::move(s)),info(std::move(metadata)),index(i),generation(state->slots[i].generation){}
    public:
        Lease()=default;Lease(const Lease&)=delete;Lease& operator=(const Lease&)=delete;
        Lease(Lease&& other)noexcept{*this=std::move(other);}Lease& operator=(Lease&& other)noexcept{if(this!=&other){reset();state=std::move(other.state);info=std::move(other.info);index=other.index;generation=other.generation;}return *this;}
        ~Lease(){reset();}void reset()noexcept{if(state)state->retire(index,generation);state.reset();info.reset();}
        GLuint handle()const{if(!state)throw std::runtime_error("Empty pack program lease.");state->ensure();std::lock_guard lock(state->mutex);const auto& s=state->slots[index];State::require(s.occupied&&!s.retired&&s.generation==generation&&s.program,"Expired pack program lease.");return s.program;}
        const LinkedProgramInfo& reflection()const{if(!info)throw std::runtime_error("Empty pack reflection.");return *info;}
        explicit operator bool()const noexcept{return bool(state);}
    };
    ProgramDomain(ProgramApi api,std::function<uintptr_t()> current):state(std::make_shared<State>(api,std::move(current))){}
    ProgramDomain(const ProgramDomain&)=delete;ProgramDomain& operator=(const ProgramDomain&)=delete;ProgramDomain(ProgramDomain&&)=default;ProgramDomain& operator=(ProgramDomain&&)=default;
    static ProgramDomain native(){return ProgramDomain(ProgramApi::current(),[]{return reinterpret_cast<uintptr_t>(glfwGetCurrentContext());});}
    void collect(){state->collect();}
    void close(){state->collect();std::lock_guard lock(state->mutex);for(const auto& s:state->slots)State::require(!s.occupied,"Release pack program leases before closing their domain.");state->closed=true;}
    size_t outstanding()const{std::lock_guard lock(state->mutex);return std::count_if(state->slots.begin(),state->slots.end(),[](const auto& s){return s.occupied;});}
    static size_t uncollectedOnDestruction(){return State::uncollected.load();}
    Lease compile(const TranslatedShaderPair& pair){
        state->ensure();auto validate=[](const TranslatedShader& s,PackShaderStage stage){State::require(s.stage==stage&&s.sourceVersion==120&&s.targetVersion==330&&s.text.starts_with("#version 330 core\n")&&s.text.size()<=8*1024*1024&&!s.sourcePaths.empty()&&s.sourcePaths.size()<=4096,"Invalid translated pack program input.");for(const auto& p:s.sourcePaths)PackSources::path(p);};validate(pair.vertex,PackShaderStage::Vertex);validate(pair.fragment,PackShaderStage::Fragment);
        State::require(pair.fragment.attributes.empty()&&pair.vertex.outputLocations.empty()&&pair.fragment.outputLocations.size()<=8,"Invalid pack stage interface metadata.");std::set<uint32_t> outputs;for(const auto n:pair.fragment.outputLocations)State::require(n<8&&outputs.insert(n).second,"Invalid declared pack output location.");
        state->collect();state->error();const auto index=state->reserve();auto& slot=state->slots[index];const auto generation=slot.generation;
        try{
            auto info=std::make_shared<LinkedProgramInfo>();info->vertexSources=pair.vertex.sourcePaths;info->fragmentSources=pair.fragment.sourcePaths;
            const auto v=state->shader(slot,GL_VERTEX_SHADER,pair.vertex,info->vertexLog),f=state->shader(slot,GL_FRAGMENT_SHADER,pair.fragment,info->fragmentLog);
            slot.program=state->raw(state->api.CreateProgram);state->error();State::require(slot.program!=0,"Cannot create pack program.");state->call(state->api.AttachShader,slot.program,v);state->call(state->api.AttachShader,slot.program,f);state->call(state->api.LinkProgram,slot.program);
            GLint linked=0;state->call(state->api.GetProgramiv,slot.program,GL_LINK_STATUS,&linked);info->linkLog=state->log(slot.program,false);State::require(linked!=0,"Pack link failed:\n"+info->linkLog+"\nVertex sources:"+State::legend(info->vertexSources)+"\nFragment sources:"+State::legend(info->fragmentSources));
            GLuint attached[3]{};GLsizei count=0;state->call(state->api.GetAttachedShaders,slot.program,3,&count,attached);State::require(count==2&&((attached[0]==v&&attached[1]==f)||(attached[0]==f&&attached[1]==v)),"Unexpected linked pack shader attachment.");
            state->reflect(slot.program,pair,*info);
            state->raw(state->api.DeleteShader,slot.vertex);slot.vertex=0;state->error();state->raw(state->api.DeleteShader,slot.fragment);slot.fragment=0;state->error();return Lease(state,index,std::move(info));
        }catch(...){state->retire(index,generation);try{state->collect();}catch(...){}throw;}
    }
    Lease compilePack(const PackSources& files,std::string_view vertex,std::string_view fragment,const std::vector<PropertyMacro>& context){return compile(GlslTranslation::preparePair(files,vertex,fragment,context));}
};
// Commit only after compilation, link and reflection all succeed. Retiring the
// preceding lease is CPU-only and cannot turn a completed commit into failure.
class ProgramSlot {
    ProgramDomain::Lease active;
public:
    void replace(ProgramDomain& domain,const PackSources& sources,std::string_view vertex,std::string_view fragment,const std::vector<PropertyMacro>& context){auto next=domain.compilePack(sources,vertex,fragment,context);active=std::move(next);}
    const ProgramDomain::Lease& get()const{return active;}void clear()noexcept{active.reset();}
};
}
