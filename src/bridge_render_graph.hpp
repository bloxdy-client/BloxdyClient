#pragma once
#include "bridge_postprocess.hpp"
#include "bridge_geometry_contract.hpp"
#include "shader_loader/material_loader.hpp"
#include <memory>
#include <string>
#include <unordered_map>

namespace bridge {
// Engine descriptors for linked programs. No filename discovery, translation,
// pack parsing or invented Minecraft semantic IDs are performed here.
enum class IrisStage { Begin, Shadow, Shadowcomp, Prepare, Gbuffers, Deferred, Composite, Final };
enum class IrisDraw { ShadowOpaque, ShadowTranslucent, WorldOpaque, HandOpaque, WorldTranslucent, HandTranslucent };
enum class IrisTexture { Color, ShadowColor, Depth0, Depth1, Depth2, ShadowDepth0, ShadowDepth1 };
struct IrisInput { GLint uniform=-1;uint32_t unit=0;IrisTexture kind=IrisTexture::Color;uint32_t index=0;bool mipmaps=false;ColorFormat::Kind samplerKind=ColorFormat::Floating; };
struct IrisImage { GLint uniform=-1;uint32_t unit=0;IrisTexture kind=IrisTexture::Color;uint32_t index=0;GLenum access=GL_READ_WRITE,format=GL_RGBA16F; };
struct IrisStorage { uint32_t index=0;uint64_t bytes=0;bool relative=false;bool operator==(const IrisStorage&)const=default; };
struct IrisProgram {
    // Borrowed linked objects must remain alive and immutable while installed.
    GLuint handle=0;bool compute=false;
    std::vector<IrisInput> inputs;
    std::vector<IrisImage> images;
    std::vector<uint32_t> storage;
    // Compute writes current image sides, never implicitly flips.
    // Direct groups or ceil(viewport * scale / linked local size).
    glm::uvec3 groups{0};glm::vec2 scale{1};
    std::vector<PassOutput> outputs;
    int indirectStorage=-1;uint64_t indirectOffset=0;
    std::vector<ColorFormat::Kind> outputKinds; // empty means floating outputs
};
struct IrisStep {
    IrisStage stage=IrisStage::Begin;uint32_t ordinal=0;
    std::vector<IrisProgram> computes; // base, _a .. _z; already resolved
    IrisProgram fragment;
    std::vector<uint32_t> preFlips,postFlips;
};
struct IrisGeometryProgram {
    // Explicit contract: the program uses divisor-one attributes for instance
    // identity and has no dependency on the unsplit gl_InstanceID value.
    bool sourceInstanceRanges=false;
    IrisProgram program;
    HandProjectionMode handProjection=HandProjectionMode::Reference;
    std::vector<GeometryAttributeBinding> attributes;
    std::vector<GeometryUniformBinding> uniforms;
    std::vector<GeometrySamplerBinding> samplers;
};
struct IrisGeometryPrograms {
    std::array<std::optional<IrisGeometryProgram>,static_cast<size_t>(GeometrySlot::Count)> slots;
    const IrisGeometryProgram& select(GeometrySlot slot)const{
        for(;slot!=GeometrySlot::Unknown;slot=geometryFallback(slot)){
            const auto i=static_cast<size_t>(slot);if(i>=slots.size())break;
            if(slots[i])return *slots[i];
        }
        throw std::runtime_error("No supported Iris geometry program/fallback.");
    }
};
struct IrisPlan {
    std::vector<ColorBufferSpec> colors,shadowColors;
    std::vector<IrisStorage> storage;
    std::vector<IrisStep> steps;
    // Six native geometry outputs are explicitly assigned, never aliased with
    // Iris semantic names. Future linked geometry adapters use the same routing.
    std::array<uint32_t,6> geometry{0,1,2,3,4,5};
    std::array<uint32_t,2> shadowGeometry{0,1};
    int shadowSize=1024;
    std::shared_ptr<IrisGeometryPrograms> programs; // optional, no production installation
    std::shared_ptr<const shaderloader::BlockIdMap> blockIds; // explicit preprocessed pack map; no default
    // Explicit source-color adapter only, never an implicit Iris particle program.
    std::optional<uint32_t> sourceGpuParticleColor;
};

// The graph owns no GL context. Restore every state it or its native geometry
// adapter touches, including indexed image/SSBO bindings on exception paths.
class GraphState {
    struct Texture { GLint two=0,array=0,cube=0; };
    struct Image { GLint name=0,level=0,layered=0,layer=0,access=0,format=0; };
    std::array<Texture,16> textures{};std::array<Image,8> images{};std::array<GLint,8> storage{};
    std::array<GLint,16> samplers{};
    std::array<GLint64,8> offsets{},sizes{};
    GLint draw=0,read=0,program=0,vao=0,active=0,buffer=0,arrayBuffer=0,indirect=0,viewport[4]{},depthMask=0,depthFunc=0,front=0,cullFace=0,blend[4]{},colorMask[4]{},equation[2]{};
    std::array<GLenum,8> drawBuffers{};GLint readBuffer=0;std::array<GLfloat,4> clearColor{};GLdouble clearDepth=1;
    std::array<GLboolean,5> enabled{};
    bool restored=false;
    static constexpr std::array<GLenum,5> caps={GL_DEPTH_TEST,GL_CULL_FACE,GL_BLEND,GL_SCISSOR_TEST,GL_STENCIL_TEST};
public:
    GraphState(){
        auto get=[](GLenum key,GLint& out){nativegl::glGetIntegerv(key,&out);};
        get(GL_DRAW_FRAMEBUFFER_BINDING,draw);get(GL_READ_FRAMEBUFFER_BINDING,read);get(GL_CURRENT_PROGRAM,program);get(GL_VERTEX_ARRAY_BINDING,vao);get(GL_ACTIVE_TEXTURE,active);
        get(GL_ARRAY_BUFFER_BINDING,arrayBuffer);
        for(size_t i=0;i<drawBuffers.size();++i){GLint value=0;get(GL_DRAW_BUFFER0+static_cast<GLenum>(i),value);drawBuffers[i]=value;}get(GL_READ_BUFFER,readBuffer);
        nativegl::glGetFloatv(GL_COLOR_CLEAR_VALUE,clearColor.data());nativegl::glGetDoublev(GL_DEPTH_CLEAR_VALUE,&clearDepth);
        get(GL_SHADER_STORAGE_BUFFER_BINDING,buffer);get(GL_DISPATCH_INDIRECT_BUFFER_BINDING,indirect);nativegl::glGetIntegerv(GL_VIEWPORT,viewport);nativegl::glGetIntegerv(GL_COLOR_WRITEMASK,colorMask);get(GL_BLEND_EQUATION_RGB,equation[0]);get(GL_BLEND_EQUATION_ALPHA,equation[1]);get(GL_DEPTH_WRITEMASK,depthMask);get(GL_DEPTH_FUNC,depthFunc);get(GL_FRONT_FACE,front);get(GL_CULL_FACE_MODE,cullFace);
        get(GL_BLEND_SRC_RGB,blend[0]);get(GL_BLEND_DST_RGB,blend[1]);get(GL_BLEND_SRC_ALPHA,blend[2]);get(GL_BLEND_DST_ALPHA,blend[3]);
        for(size_t i=0;i<caps.size();++i)enabled[i]=nativegl::glIsEnabled(caps[i]);
        for(uint32_t i=0;i<16;++i){nativegl::glActiveTexture(GL_TEXTURE0+i);get(GL_TEXTURE_BINDING_2D,textures[i].two);get(GL_TEXTURE_BINDING_2D_ARRAY,textures[i].array);get(GL_TEXTURE_BINDING_CUBE_MAP,textures[i].cube);nativegl::glGetIntegeri_v(GL_SAMPLER_BINDING,i,&samplers[i]);}
        for(uint32_t i=0;i<8;++i){auto& image=images[i];nativegl::glGetIntegeri_v(GL_SHADER_STORAGE_BUFFER_BINDING,i,&storage[i]);
            nativegl::glGetInteger64i_v(GL_SHADER_STORAGE_BUFFER_START,i,&offsets[i]);nativegl::glGetInteger64i_v(GL_SHADER_STORAGE_BUFFER_SIZE,i,&sizes[i]);
            nativegl::glGetIntegeri_v(GL_IMAGE_BINDING_NAME,i,&image.name);nativegl::glGetIntegeri_v(GL_IMAGE_BINDING_LEVEL,i,&image.level);nativegl::glGetIntegeri_v(GL_IMAGE_BINDING_LAYERED,i,&image.layered);
            nativegl::glGetIntegeri_v(GL_IMAGE_BINDING_LAYER,i,&image.layer);nativegl::glGetIntegeri_v(GL_IMAGE_BINDING_ACCESS,i,&image.access);nativegl::glGetIntegeri_v(GL_IMAGE_BINDING_FORMAT,i,&image.format);}
        nativegl::glActiveTexture(active);nativegl::check("Graph state capture");
    }
    ~GraphState(){restore();}
    void restore()noexcept{
        if(restored)return;restored=true;
        for(uint32_t i=0;i<16;++i){nativegl::glActiveTexture(GL_TEXTURE0+i);nativegl::glBindTexture(GL_TEXTURE_2D,textures[i].two);nativegl::glBindTexture(GL_TEXTURE_2D_ARRAY,textures[i].array);nativegl::glBindTexture(GL_TEXTURE_CUBE_MAP,textures[i].cube);nativegl::glBindSampler(i,samplers[i]);}
        for(uint32_t i=0;i<8;++i){const auto& im=images[i];nativegl::glBindImageTexture(i,im.name,im.level,static_cast<GLboolean>(im.layered),im.layer,im.access?im.access:GL_READ_ONLY,im.format?im.format:GL_R8);
            if(storage[i]&&sizes[i]>0)nativegl::glBindBufferRange(GL_SHADER_STORAGE_BUFFER,i,storage[i],static_cast<GLintptr>(offsets[i]),static_cast<GLsizeiptr>(sizes[i]));else nativegl::glBindBufferBase(GL_SHADER_STORAGE_BUFFER,i,storage[i]);}
        nativegl::glBindBuffer(GL_SHADER_STORAGE_BUFFER,buffer);nativegl::glBindBuffer(GL_DISPATCH_INDIRECT_BUFFER,indirect);nativegl::glActiveTexture(active);nativegl::glUseProgram(program);nativegl::glBindVertexArray(vao);
        nativegl::glBindBuffer(GL_ARRAY_BUFFER,arrayBuffer);
        nativegl::glBindFramebuffer(GL_DRAW_FRAMEBUFFER,draw);if(draw)nativegl::glDrawBuffers(static_cast<GLsizei>(drawBuffers.size()),drawBuffers.data());else nativegl::glDrawBuffer(drawBuffers[0]);
        nativegl::glBindFramebuffer(GL_READ_FRAMEBUFFER,read);nativegl::glReadBuffer(readBuffer);nativegl::glViewport(viewport[0],viewport[1],viewport[2],viewport[3]);
        nativegl::glClearColor(clearColor[0],clearColor[1],clearColor[2],clearColor[3]);nativegl::glClearDepth(clearDepth);
        nativegl::glDepthMask(static_cast<GLboolean>(depthMask));nativegl::glDepthFunc(depthFunc);nativegl::glFrontFace(front);nativegl::glCullFace(cullFace);nativegl::glBlendFuncSeparate(blend[0],blend[1],blend[2],blend[3]);
        nativegl::glColorMask(static_cast<GLboolean>(colorMask[0]),static_cast<GLboolean>(colorMask[1]),static_cast<GLboolean>(colorMask[2]),static_cast<GLboolean>(colorMask[3]));nativegl::glBlendEquationSeparate(equation[0],equation[1]);
        for(size_t i=0;i<caps.size();++i)if(enabled[i])nativegl::glEnable(caps[i]);else nativegl::glDisable(caps[i]);
    }
};

class IrisGraph {
    struct Resources {
        PostProcess color,shadow;
        std::array<GLuint,5> depth{},depthFbo{}; // depth0/1/2, shadowtex0/1
        std::array<GLuint,8> storage{};std::array<uint64_t,8> storageBytes{};
        std::vector<ColorBufferSpec> colors,shadows;std::vector<IrisStorage> specs;
        int width=0,height=0,shadowSize=0;uint64_t bytes=0;bool reset=true;
        ~Resources(){for(auto b:storage)if(b)nativegl::glDeleteBuffers(1,&b);for(auto f:depthFbo)if(f)nativegl::glDeleteFramebuffers(1,&f);for(auto t:depth)if(t)nativegl::glDeleteTextures(1,&t);}
    };
    std::unique_ptr<Resources> resources;
    struct ProgramInfo { bool compute;glm::ivec3 local{1}; };
    std::unordered_map<GLuint,ProgramInfo> checkedPrograms;
    GLint imagesLimit=0,storageLimit=0,computeUnits=0,fragmentUnits=0,drawLimit=0;
    glm::ivec3 maxGroups{0};GLint maxStorageBytes=0;
    bool open=false,pending=false;uint32_t available=0;IrisStage stage=IrisStage::Begin;
    std::vector<GLuint> geometryWrites;
    static constexpr GLbitfield barriers=GL_SHADER_IMAGE_ACCESS_BARRIER_BIT|GL_TEXTURE_FETCH_BARRIER_BIT|GL_SHADER_STORAGE_BARRIER_BIT|GL_FRAMEBUFFER_BARRIER_BIT|GL_TEXTURE_UPDATE_BARRIER_BIT|GL_BUFFER_UPDATE_BARRIER_BIT;
    void limits(){if(imagesLimit)return;
        nativegl::glGetIntegerv(GL_MAX_IMAGE_UNITS,&imagesLimit);nativegl::glGetIntegerv(GL_MAX_SHADER_STORAGE_BUFFER_BINDINGS,&storageLimit);
        nativegl::glGetIntegerv(GL_MAX_COMPUTE_TEXTURE_IMAGE_UNITS,&computeUnits);nativegl::glGetIntegerv(GL_MAX_TEXTURE_IMAGE_UNITS,&fragmentUnits);
        nativegl::glGetIntegerv(GL_MAX_DRAW_BUFFERS,&drawLimit);nativegl::glGetIntegerv(GL_MAX_SHADER_STORAGE_BLOCK_SIZE,&maxStorageBytes);
        for(uint32_t i=0;i<3;++i)nativegl::glGetIntegeri_v(GL_MAX_COMPUTE_WORK_GROUP_COUNT,i,&maxGroups[i]);
        nativegl::check("Graph capabilities");
        if(imagesLimit<8||storageLimit<8||computeUnits<16||fragmentUnits<16||drawLimit<6||maxStorageBytes<1||glm::any(glm::lessThan(maxGroups,glm::ivec3(1))))throw std::runtime_error("Graph requires OpenGL 4.3 capabilities.");
    }
    PostProcess& pool(IrisTexture kind){if(kind==IrisTexture::Color)return resources->color;if(kind==IrisTexture::ShadowColor)return resources->shadow;throw std::runtime_error("Image binding requires a color target.");}
    GLuint texture(IrisTexture kind,uint32_t index){
        if(kind==IrisTexture::Color||kind==IrisTexture::ShadowColor)return pool(kind).current(index);
        auto i=static_cast<unsigned>(kind)-static_cast<unsigned>(IrisTexture::Depth0);
        if(index||i>=5||!(available&(1u<<i)))throw std::runtime_error("Graph depth is not produced at this stage.");
        return resources->depth[i];
    }
    ProgramInfo info(const IrisProgram& p){
        auto found=checkedPrograms.find(p.handle);if(found!=checkedPrograms.end()){if(found->second.compute!=p.compute)throw std::runtime_error("Graph program kind changed.");return found->second;}
        GLint linked=0;nativegl::glGetProgramiv(p.handle,GL_LINK_STATUS,&linked);if(!linked)throw std::runtime_error("Graph program is not linked.");
        ProgramInfo out{p.compute};if(p.compute){nativegl::glGetProgramiv(p.handle,GL_COMPUTE_WORK_GROUP_SIZE,&out.local[0]);if(glm::any(glm::lessThan(out.local,glm::ivec3(1))))throw std::runtime_error("Graph program is not compute.");}
        nativegl::check("Graph linked program reflection");checkedPrograms.emplace(p.handle,out);return out;
    }
    void copyDepth(size_t from,size_t to){auto& r=*resources;const int w=from<3?r.width:r.shadowSize,h=from<3?r.height:r.shadowSize;
        nativegl::glBindFramebuffer(GL_READ_FRAMEBUFFER,r.depthFbo[from]);nativegl::glBindFramebuffer(GL_DRAW_FRAMEBUFFER,r.depthFbo[to]);
        nativegl::glBlitFramebuffer(0,0,w,h,0,0,w,h,GL_DEPTH_BUFFER_BIT,GL_NEAREST);nativegl::check("Graph depth boundary copy");available|=1u<<to;
    }
    static bool imageFormat(GLenum f){
        // All 30 currently supported sized R/RG/RGBA formats are also in the
        // OpenGL image-unit format table. Require exact storage format.
        return ColorFormat::get(f).bytes!=0;
    }
    void runProgram(const IrisProgram& p,PostProcess& output,GLuint vao,const PassDestination* destination){
        if(!p.handle)throw std::runtime_error("Empty graph program.");const auto reflected=info(p);
        FullscreenPass pass{p.handle,vao};std::array<bool,16> units{};std::array<bool,8> imageUnits{},storageUnits{};
        std::vector<GLuint> sampled,imageIds;pass.outputs=p.outputs;
        for(const auto& in:p.inputs){if(in.uniform<0||in.unit>=16||units[in.unit]||in.unit>=static_cast<uint32_t>(p.compute?computeUnits:fragmentUnits))throw std::runtime_error("Invalid graph sampler binding.");units[in.unit]=true;
            const auto id=texture(in.kind,in.index);sampled.push_back(id);
            const auto kind=in.kind==IrisTexture::Color||in.kind==IrisTexture::ShadowColor?ColorFormat::get(pool(in.kind).format(in.index)).kind:ColorFormat::Floating;
            if(kind!=in.samplerKind)throw std::runtime_error("Graph sampler numeric type differs from its storage.");
            if(in.mipmaps&&in.kind!=IrisTexture::Color&&in.kind!=IrisTexture::ShadowColor)throw std::runtime_error("Depth mip chains are not allocated.");
            for(size_t i=0;i+1<sampled.size();++i)if(sampled[i]==id&&p.inputs[i].mipmaps!=in.mipmaps)throw std::runtime_error("Conflicting graph texture sampling policies.");
            pass.inputs.push_back({in.uniform,in.unit,-1,id,false});}
        for(const auto& im:p.images){if(im.uniform<0||im.unit>=8||imageUnits[im.unit]||(im.access!=GL_READ_ONLY&&im.access!=GL_WRITE_ONLY&&im.access!=GL_READ_WRITE)||pool(im.kind).format(im.index)!=im.format||!imageFormat(im.format))throw std::runtime_error("Invalid graph image binding.");imageUnits[im.unit]=true;
            const auto id=texture(im.kind,im.index);
            if(std::find(imageIds.begin(),imageIds.end(),id)!=imageIds.end())throw std::runtime_error("Aliased graph images.");imageIds.push_back(id);
            if(im.access!=GL_READ_ONLY&&std::find(sampled.begin(),sampled.end(),id)!=sampled.end())throw std::runtime_error("Graph sampler/image write feedback.");
        }
        for(auto index:p.storage){if(index>=8||storageUnits[index]||!resources->storage[index])throw std::runtime_error("Missing or duplicate graph SSBO.");storageUnits[index]=true;}
        if(p.compute&&(!p.outputs.empty()||!p.outputKinds.empty()))throw std::runtime_error("Compute cannot declare fragment outputs.");
        if(!p.outputKinds.empty()&&p.outputKinds.size()!=p.outputs.size())throw std::runtime_error("Fragment output type count differs.");
        for(size_t i=0;i<p.outputs.size();++i)if(ColorFormat::get(output.format(p.outputs[i].logical)).kind!=(p.outputKinds.empty()?ColorFormat::Floating:p.outputKinds[i]))throw std::runtime_error("Graph fragment output numeric type differs from its storage.");
        if(!p.compute){for(const auto& o:p.outputs){const auto id=output.alternate(o.logical);for(const auto& im:p.images)if(texture(im.kind,im.index)==id)throw std::runtime_error("Graph image/framebuffer feedback.");}
            if(destination)for(auto id:destination->textures)for(const auto& im:p.images)if(texture(im.kind,im.index)==id)throw std::runtime_error("Final image/framebuffer feedback.");}
        if(p.indirectStorage< -1||p.indirectStorage>=8||!p.compute&&p.indirectStorage>=0)throw std::runtime_error("Invalid indirect graph dispatch.");
        if(p.indirectStorage>=0&&(!resources->storage[p.indirectStorage]||p.indirectOffset%4||resources->storageBytes[p.indirectStorage]<12||p.indirectOffset>resources->storageBytes[p.indirectStorage]-12||p.groups!=glm::uvec3(0)))throw std::runtime_error("Indirect dispatch pointer is outside its SSBO.");
        nativegl::glMemoryBarrier(barriers);nativegl::glUseProgram(p.handle);
        for(const auto& in:p.inputs)nativegl::glBindSampler(in.unit,0);
        for(GLuint i=0;i<8;++i){nativegl::glBindImageTexture(i,0,0,GL_FALSE,0,GL_READ_ONLY,GL_R8);nativegl::glBindBufferBase(GL_SHADER_STORAGE_BUFFER,i,0);}
        for(const auto& in:p.inputs)if(in.kind==IrisTexture::Color||in.kind==IrisTexture::ShadowColor){nativegl::glActiveTexture(GL_TEXTURE0+in.unit);pool(in.kind).prepareSample(in.index,in.mipmaps);}
        for(const auto& im:p.images){nativegl::glBindImageTexture(im.unit,texture(im.kind,im.index),0,GL_FALSE,0,im.access,im.format);nativegl::glUniform1i(im.uniform,im.unit);}
        for(auto index:p.storage)nativegl::glBindBufferBase(GL_SHADER_STORAGE_BUFFER,index,resources->storage[index]);
        if(p.compute){
            for(size_t i=0;i<p.inputs.size();++i){const auto& in=p.inputs[i];nativegl::glActiveTexture(GL_TEXTURE0+in.unit);nativegl::glBindTexture(GL_TEXTURE_2D,sampled[i]);nativegl::glUniform1i(in.uniform,in.unit);}
            glm::uvec3 groups=p.groups;
            if(p.indirectStorage>=0){
                nativegl::glMemoryBarrier(GL_COMMAND_BARRIER_BIT|GL_BUFFER_UPDATE_BARRIER_BIT);
                nativegl::glBindBuffer(GL_DISPATCH_INDIRECT_BUFFER,resources->storage[p.indirectStorage]);
                // GL skips count validation for indirect dispatch. Bounded 12-byte
                // inspection deliberately favors correctness over asynchronous
                // dispatch until GPU-side validated argument buffers exist.
                nativegl::glGetBufferSubData(GL_DISPATCH_INDIRECT_BUFFER,static_cast<GLintptr>(p.indirectOffset),12,&groups[0]);nativegl::check("Graph indirect argument read");
            }else if(groups==glm::uvec3(0)){for(int i=0;i<2;++i){const double scale=p.scale[i];if(!std::isfinite(scale)||scale<=0||scale>32768)throw std::runtime_error("Invalid compute scale.");const int extent=stage==IrisStage::Shadow?resources->shadowSize:(i?resources->height:resources->width);const double count=std::ceil(std::ceil(extent*scale)/reflected.local[i]);if(count<1||count>maxGroups[i])throw std::runtime_error("Compute dispatch limit exceeded.");groups[i]=static_cast<uint32_t>(count);}groups.z=1;}
            for(int i=0;i<3;++i)if(groups[i]>static_cast<uint32_t>(maxGroups[i]))throw std::runtime_error("Compute dispatch limit exceeded.");
            if(p.indirectStorage>=0)nativegl::glDispatchComputeIndirect(static_cast<GLintptr>(p.indirectOffset));else nativegl::glDispatchCompute(groups.x,groups.y,groups.z);
            nativegl::glMemoryBarrier(barriers);nativegl::check("Graph compute dispatch");++dispatches;
        }else{output.run(pass,destination);nativegl::glMemoryBarrier(barriers);nativegl::check("Graph fragment writes");}
        for(const auto& im:p.images){if(im.access!=GL_READ_ONLY)pool(im.kind).dirty(im.index);nativegl::glBindImageTexture(im.unit,0,0,GL_FALSE,0,GL_READ_ONLY,im.format);}
        for(auto index:p.storage)nativegl::glBindBufferBase(GL_SHADER_STORAGE_BUFFER,index,0);
    }
    void runStage(const IrisPlan& plan,IrisStage value,GLuint vao,const PassDestination* destination=nullptr){
        stage=value;auto& output=value==IrisStage::Shadowcomp?resources->shadow:resources->color;
        for(const auto& step:plan.steps)if(step.stage==value){
            for(auto index:step.preFlips)output.flip(index);
            for(const auto& c:step.computes)runProgram(c,output,vao,nullptr);
            if(step.fragment.handle)runProgram(step.fragment,output,vao,destination);
            for(auto index:step.postFlips)output.flip(index);
        }
        nativegl::check("Graph stage completion");
    }
public:
    uint64_t frames=0,failures=0,dispatches=0;std::string lastError;
    void validateGeometrySample(GLuint id)const{
        if(!open||!id||std::find(geometryWrites.begin(),geometryWrites.end(),id)!=geometryWrites.end())throw std::runtime_error("Geometry material/framebuffer feedback or missing resource.");
    }
    // Geometry writes CURRENT sides, with no implicit flip. Bind only declared
    // sampler inputs after checking both color and attached-depth feedback.
    void bindGeometry(const IrisProgram& p,IrisDraw phase){
        if(!open||p.compute||!p.handle||!p.images.empty()||!p.storage.empty()||p.indirectStorage!=-1)
            throw std::runtime_error("Unsupported geometry program descriptor.");
        info(p);const bool shadow=phase==IrisDraw::ShadowOpaque||phase==IrisDraw::ShadowTranslucent;
        auto& output=shadow?resources->shadow:resources->color;
        const auto d=resources->depth[shadow?3:0];const int w=shadow?resources->shadowSize:resources->width,h=shadow?resources->shadowSize:resources->height;
        if(p.outputs.empty()||p.outputs.size()>static_cast<size_t>(drawLimit)||!p.outputKinds.empty()&&p.outputKinds.size()!=p.outputs.size())throw std::runtime_error("Invalid geometry output count.");
        std::vector<uint32_t> indices;std::vector<GLuint> writes{d};std::array<bool,32> used{};std::array<bool,16> units{};
        for(size_t i=0;i<p.outputs.size();++i){const auto& o=p.outputs[i];
            if(o.logical>=32||used[o.logical]||o.flip||output.size(o.logical)!=glm::ivec2(w,h)||ColorFormat::get(output.format(o.logical)).kind!=(p.outputKinds.empty()?ColorFormat::Floating:p.outputKinds[i]))throw std::runtime_error("Invalid geometry target/type/flip.");
            used[o.logical]=true;indices.push_back(o.logical);writes.push_back(output.current(o.logical));
        }
        for(const auto& in:p.inputs){
            if(in.uniform<0||in.unit>=16||units[in.unit])throw std::runtime_error("Invalid geometry graph sampler.");units[in.unit]=true;
            const auto t=texture(in.kind,in.index);if(std::find(writes.begin(),writes.end(),t)!=writes.end())throw std::runtime_error("Geometry sampler/framebuffer feedback.");
            const bool color=in.kind==IrisTexture::Color||in.kind==IrisTexture::ShadowColor;
            if((color?ColorFormat::get(pool(in.kind).format(in.index)).kind:ColorFormat::Floating)!=in.samplerKind||!color&&in.mipmaps)throw std::runtime_error("Invalid geometry sampler type/mips.");
            for(const auto& other:p.inputs)if(other.kind==in.kind&&other.index==in.index&&other.mipmaps!=in.mipmaps)throw std::runtime_error("Conflicting geometry sampling policies.");
        }
        output.geometry(indices,d,w,h);geometryWrites=std::move(writes);nativegl::glUseProgram(p.handle);
        for(GLuint i=0;i<8;++i){nativegl::glBindBufferBase(GL_SHADER_STORAGE_BUFFER,i,0);nativegl::glBindImageTexture(i,0,0,GL_FALSE,0,GL_READ_ONLY,GL_R8);}
        for(const auto& in:p.inputs){nativegl::glActiveTexture(GL_TEXTURE0+in.unit);nativegl::glBindSampler(in.unit,0);
            if(in.kind==IrisTexture::Color||in.kind==IrisTexture::ShadowColor)pool(in.kind).prepareSample(in.index,in.mipmaps);
            nativegl::glBindTexture(GL_TEXTURE_2D,texture(in.kind,in.index));nativegl::glUniform1i(in.uniform,in.unit);}
        nativegl::check("Iris geometry graph bindings");
    }
    void invalidate(){if(resources){resources->reset=true;resources->color.invalidate();resources->shadow.invalidate();}open=pending=false;available=0;}
    void complete(){if(!open||!pending)throw std::runtime_error("No successful graph frame to commit.");resources->color.complete();resources->shadow.complete();open=pending=false;++frames;}
    void release(){if(open)throw std::runtime_error("Cannot release active graph.");resources.reset();checkedPrograms.clear();}
    uint64_t bytes()const{return resources?resources->bytes:0;}
    bool matches(const IrisPlan& plan,int w,int h)const{return resources&&resources->width==w&&resources->height==h&&resources->shadowSize==plan.shadowSize&&resources->colors==plan.colors&&resources->shadows==plan.shadowColors&&resources->specs==plan.storage;}
    GLuint color(uint32_t index){return resources->color.current(index);}
    GLuint depth(uint32_t index)const{return resources->depth.at(index);}
    GLuint storage(uint32_t index)const{return resources->storage.at(index);}
    static uint64_t estimate(const IrisPlan& plan,int w,int h){
        if(plan.shadowSize<1||plan.shadowSize>8192)throw std::runtime_error("Invalid graph shadow size.");
        uint64_t total=PostProcess::estimate(plan.colors,w,h)+PostProcess::estimate(plan.shadowColors,plan.shadowSize,plan.shadowSize)+static_cast<uint64_t>(w)*h*12+static_cast<uint64_t>(plan.shadowSize)*plan.shadowSize*8;
        std::array<bool,8> used{};for(const auto& s:plan.storage){if(s.index>=8||used[s.index]||!s.bytes||s.bytes%4||s.bytes>128ull*1024*1024)throw std::runtime_error("Invalid graph storage descriptor.");used[s.index]=true;
            const auto factor=s.relative?static_cast<uint64_t>(w)*h:1;if(s.bytes>128ull*1024*1024/factor)throw std::runtime_error("Graph SSBO exceeds 128 MiB.");total+=s.bytes*factor;}
        if(total>512ull*1024*1024)throw std::runtime_error("Graph exceeds 512 MiB.");return total;
    }
    void configure(const IrisPlan& plan,int w,int h,uint64_t otherBytes){
        if(open)throw std::runtime_error("Cannot configure active graph.");const auto total=estimate(plan,w,h);
        if(otherBytes>512ull*1024*1024||total>512ull*1024*1024-otherBytes)throw std::runtime_error("Combined graph/frame memory exceeds 512 MiB.");
        limits();
        if(matches(plan,w,h))return;
        if(resources&&resources->bytes>512ull*1024*1024-otherBytes-total)throw std::runtime_error("Graph replacement peak exceeds 512 MiB; existing resources retained.");
        auto next=std::make_unique<Resources>();next->width=w;next->height=h;next->shadowSize=plan.shadowSize;next->bytes=total;next->colors=plan.colors;next->shadows=plan.shadowColors;next->specs=plan.storage;
        next->color.configure(plan.colors,w,h,total-PostProcess::estimate(plan.colors,w,h)+otherBytes);
        auto shadowSpecs=plan.shadowColors;for(auto& spec:shadowSpecs)if(!spec.customClear){spec.customClear=true;spec.clear=glm::vec4(1);}
        next->shadow.configure(shadowSpecs,plan.shadowSize,plan.shadowSize,total-PostProcess::estimate(plan.shadowColors,plan.shadowSize,plan.shadowSize)+otherBytes);
        GLint limit=0;nativegl::glGetIntegerv(GL_MAX_TEXTURE_SIZE,&limit);if(w>limit||h>limit||plan.shadowSize>limit)throw std::runtime_error("Graph depth exceeds texture limits.");
        for(size_t i=0;i<5;++i){nativegl::glGenTextures(1,&next->depth[i]);nativegl::glActiveTexture(GL_TEXTURE0);nativegl::glBindTexture(GL_TEXTURE_2D,next->depth[i]);
            nativegl::glTexImage2D(GL_TEXTURE_2D,0,GL_DEPTH_COMPONENT32F,i<3?w:plan.shadowSize,i<3?h:plan.shadowSize,0,GL_DEPTH_COMPONENT,GL_FLOAT,nullptr);
            nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
            nativegl::glGenFramebuffers(1,&next->depthFbo[i]);nativegl::glBindFramebuffer(GL_FRAMEBUFFER,next->depthFbo[i]);nativegl::glFramebufferTexture2D(GL_FRAMEBUFFER,GL_DEPTH_ATTACHMENT,GL_TEXTURE_2D,next->depth[i],0);nativegl::glDrawBuffer(GL_NONE);nativegl::glReadBuffer(GL_NONE);
            if(nativegl::glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)throw std::runtime_error("Graph depth framebuffer incomplete.");}
        for(const auto& s:plan.storage){auto& count=next->storageBytes[s.index];count=s.bytes*(s.relative?static_cast<uint64_t>(w)*h:1);if(count>static_cast<uint64_t>(maxStorageBytes))throw std::runtime_error("Graph storage exceeds GPU block limit.");
            nativegl::glGenBuffers(1,&next->storage[s.index]);nativegl::glBindBuffer(GL_SHADER_STORAGE_BUFFER,next->storage[s.index]);nativegl::glBufferData(GL_SHADER_STORAGE_BUFFER,static_cast<GLsizeiptr>(count),nullptr,GL_DYNAMIC_DRAW);}
        nativegl::check("Graph resource allocation");resources.swap(next);checkedPrograms.clear();
    }
    void validate(const IrisPlan& plan){
        if(plan.steps.size()>701)throw std::runtime_error("Too many graph steps.");std::array<int,8> last;last.fill(-1);bool final=false;
        std::array<bool,32> geometryUsed{},shadowUsed{};
        if(!plan.programs){
        for(auto index:plan.geometry){resources->color.current(index);if(geometryUsed[index])throw std::runtime_error("Duplicate geometry target.");geometryUsed[index]=true;}
        for(auto index:plan.shadowGeometry){if(ColorFormat::get(resources->shadow.format(index)).kind!=ColorFormat::Floating||resources->shadow.size(index)!=glm::ivec2(plan.shadowSize)||shadowUsed[index])throw std::runtime_error("Invalid native shadow output.");shadowUsed[index]=true;}
        for(auto index:plan.geometry){if(ColorFormat::get(resources->color.format(index)).kind!=ColorFormat::Floating||resources->color.size(index)!=glm::ivec2(resources->width,resources->height))throw std::runtime_error("Native graph geometry output must be full-size floating/normalized.");}
        }
        for(const auto& step:plan.steps){const auto s=static_cast<unsigned>(step.stage);if(s>=8||step.stage==IrisStage::Gbuffers||step.ordinal>=100||static_cast<int>(step.ordinal)<=last[s]||step.computes.size()>27)throw std::runtime_error("Invalid graph stage/ordinal.");last[s]=step.ordinal;
            if(step.computes.empty()&&!step.fragment.handle)throw std::runtime_error("Empty graph steps are not programs.");
            for(const auto& c:step.computes)if(!c.handle||!c.compute)throw std::runtime_error("Invalid compute chain.");
            if(step.fragment.handle&&step.fragment.compute)throw std::runtime_error("Fragment slot contains compute.");
            if(step.stage==IrisStage::Shadow&&(step.fragment.handle||step.ordinal))throw std::runtime_error("Shadow fragment must be a geometry program; compute chain has no ordinal.");
            auto& targets=step.stage==IrisStage::Shadowcomp?resources->shadow:resources->color;
            for(const auto* flips:{&step.preFlips,&step.postFlips}){std::array<bool,32> used{};for(auto index:*flips){targets.current(index);if(used[index])throw std::runtime_error("Duplicate explicit graph flip.");used[index]=true;}}
            if(step.stage==IrisStage::Final){if(final||step.ordinal||!step.fragment.handle||!step.fragment.outputs.empty()||!step.preFlips.empty()||!step.postFlips.empty())throw std::runtime_error("Final must write only the external destination.");final=true;}
        }
        if(!final)throw std::runtime_error("Graph requires a concrete final program.");
    }
    template<class Draw> void execute(const IrisPlan& plan,GLuint vao,const glm::vec4& fog,bool reverse,const PassDestination& final,Draw draw){
        if(open||!resources)throw std::runtime_error("Invalid graph frame state.");validate(plan);open=true;available=0;lastError.clear();
        auto& r=*resources;
        auto geometryBoundary=[&](bool shadow){
            if(plan.programs){const auto fbo=r.depthFbo[shadow?3:0];nativegl::glBindFramebuffer(GL_FRAMEBUFFER,fbo);nativegl::glViewport(0,0,shadow?r.shadowSize:r.width,shadow?r.shadowSize:r.height);return fbo;}
            if(shadow){r.shadow.geometry(plan.shadowGeometry,r.depth[3],r.shadowSize,r.shadowSize);return r.shadow.targetFramebuffer();}
            r.color.geometry(plan.geometry,r.depth[0],r.width,r.height);return r.color.targetFramebuffer();
        };
        try{
            nativegl::glDisable(GL_SCISSOR_TEST);nativegl::glDisable(GL_STENCIL_TEST);nativegl::glDepthMask(GL_TRUE);nativegl::glColorMask(GL_TRUE,GL_TRUE,GL_TRUE,GL_TRUE);nativegl::glBlendEquationSeparate(GL_FUNC_ADD,GL_FUNC_ADD);
            // Initialize newly allocated/recovered storage deterministically,
            // then defer ordinary per-frame clears until after shadow compute.
            r.color.begin(fog,false);r.shadow.begin(glm::vec4(1),false);
            if(r.reset){const GLuint zero=0;for(auto b:r.storage)if(b){nativegl::glBindBuffer(GL_SHADER_STORAGE_BUFFER,b);nativegl::glClearBufferData(GL_SHADER_STORAGE_BUFFER,GL_R32UI,GL_RED_INTEGER,GL_UNSIGNED_INT,&zero);}nativegl::check("Graph storage initialization");r.reset=false;}
            for(size_t i=0;i<5;++i){nativegl::glBindFramebuffer(GL_FRAMEBUFFER,r.depthFbo[i]);const GLfloat farValue=i<3&&reverse?0.f:1.f;nativegl::glClearBufferfv(GL_DEPTH,0,&farValue);}
            available|=1u<<3; // cleared current shadow depth is defined
            runStage(plan,IrisStage::Shadow,vao);
            r.shadow.clearFrame(glm::vec4(1));r.color.clearFrame(fog);
            runStage(plan,IrisStage::Begin,vao);
            stage=IrisStage::Shadow;
            draw(IrisDraw::ShadowOpaque,geometryBoundary(true));nativegl::check("Graph shadow opaque");copyDepth(3,4);
            draw(IrisDraw::ShadowTranslucent,geometryBoundary(true));nativegl::check("Graph shadow translucent");available|=1u<<3;r.shadow.detachDepth();
            runStage(plan,IrisStage::Shadowcomp,vao);runStage(plan,IrisStage::Prepare,vao);
            stage=IrisStage::Gbuffers;
            draw(IrisDraw::WorldOpaque,geometryBoundary(false));nativegl::check("Graph opaque world");copyDepth(0,2);available|=1;
            draw(IrisDraw::HandOpaque,geometryBoundary(false));nativegl::check("Graph opaque hand");copyDepth(0,1);r.color.detachDepth();
            runStage(plan,IrisStage::Deferred,vao);
            stage=IrisStage::Gbuffers;
            draw(IrisDraw::WorldTranslucent,geometryBoundary(false));nativegl::check("Graph world translucency");
            draw(IrisDraw::HandTranslucent,geometryBoundary(false));nativegl::check("Graph hand translucency");r.color.detachDepth();
            runStage(plan,IrisStage::Composite,vao);runStage(plan,IrisStage::Final,vao,&final);
            r.color.normalizePersistent();r.shadow.normalizePersistent();nativegl::check("Graph complete frame");pending=true;
        }catch(const std::exception& error){lastError="Iris stage "+std::to_string(static_cast<int>(stage))+": "+error.what();++failures;invalidate();throw std::runtime_error(lastError);}
    }
};
struct IrisGraphFrame {
    IrisGraph* graph=nullptr;bool done=false;
    ~IrisGraphFrame(){if(graph&&!done)graph->invalidate();}
    void complete(){if(graph)graph->complete();done=true;}
};
}
