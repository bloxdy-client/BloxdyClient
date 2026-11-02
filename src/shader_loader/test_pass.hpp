#pragma once
#include "program_outputs.hpp"

namespace bridge::shaderloader {
struct PackPassApi {
#define PACK_PASS_APIS(X) \
 X(CreateTextures,PFNGLCREATETEXTURESPROC) X(TextureStorage2D,PFNGLTEXTURESTORAGE2DPROC) X(TextureParameteri,PFNGLTEXTUREPARAMETERIPROC) X(DeleteTextures,PFNGLDELETETEXTURESPROC) X(IsTexture,PFNGLISTEXTUREPROC) \
 X(GetIntegerv,PFNGLGETINTEGERVPROC) X(GetIntegeri_v,PFNGLGETINTEGERI_VPROC) X(GetDoublei_v,PFNGLGETDOUBLEI_VPROC) X(GetError,PFNGLGETERRORPROC) X(IsEnabled,PFNGLISENABLEDPROC) X(IsEnabledi,PFNGLISENABLEDIPROC) \
 X(Enable,PFNGLENABLEPROC) X(Disable,PFNGLDISABLEPROC) X(Enablei,PFNGLENABLEIPROC) X(Disablei,PFNGLDISABLEIPROC) X(ColorMaski,PFNGLCOLORMASKIPROC) \
 X(DepthMask,PFNGLDEPTHMASKPROC) X(DepthFunc,PFNGLDEPTHFUNCPROC) X(DepthRangeIndexed,PFNGLDEPTHRANGEINDEXEDPROC) X(FrontFace,PFNGLFRONTFACEPROC) X(CullFace,PFNGLCULLFACEPROC) X(PolygonMode,PFNGLPOLYGONMODEPROC) X(ClipControl,PFNGLCLIPCONTROLPROC) \
 X(ClearBufferfv,PFNGLCLEARBUFFERFVPROC)
#define PACK_PASS_DECLARE(name,type) type name=nullptr;
    PACK_PASS_APIS(PACK_PASS_DECLARE)
#undef PACK_PASS_DECLARE
    void validate()const{
#define PACK_PASS_CHECK(name,type) if(!name)throw std::runtime_error("Missing pack pass entry point: " #name);
        PACK_PASS_APIS(PACK_PASS_CHECK)
#undef PACK_PASS_CHECK
    }
};

struct PackPassImageSpec {
    GLenum attachment=GL_NONE,format=GL_RGBA8;
    std::array<GLfloat,4> clear{}; // depth uses clear[0]
};
struct PackPassState {
    bool depthTest=false,depthWrite=false,cull=false;
    GLenum depthFunction=GL_LESS,front=GL_CCW,cullFace=GL_BACK;
};

// One explicit, non-production triangle pass. Own immutable single-level 2D
// targets, clear every invocation, no history/load operation or implicit scene
// producers. Published output descriptors pin immutable image generations.
// Uses an existing desktop 4.5 context, never creates or switches one. Caller
// must not have active queries/conditional rendering or mutate native objects
// during the synchronous scope. Logical storage bounds are not VRAM guarantees.
class PackTestPass {
    friend class PackTwoPass;
    struct Image {PackPassImageSpec spec;GLuint name=0;};
    static inline std::atomic<size_t> uncollected_{0};
    // This store also pins the exact program/context lease. No borrowed image
    // can outlive its context guard or let ProgramDomain::close succeed early.
    struct ImageStore {
        std::shared_ptr<PackFramebufferBinder> outputs;PackPassApi api;
        std::shared_ptr<const void> writeOwner=std::make_shared<int>(0);
        std::vector<Image> images;GLint width,height;
        std::atomic<size_t> readers{0};uint64_t generation=0;
        bool allocated=false,ready=false,busy=false;std::atomic<bool> retired{false};
        ImageStore(std::shared_ptr<PackFramebufferBinder> output,PackPassApi a,std::vector<Image> i,GLint w,GLint h):outputs(std::move(output)),api(a),images(std::move(i)),width(w),height(h){}
        void ensure()const{outputs->ensure();}
        template<class F,class... A>auto call(F fn,A... args)const{ensure();if constexpr(std::is_void_v<std::invoke_result_t<F,A...>>){fn(args...);ensure();need(api.GetError()==GL_NO_ERROR,"Pack image lifetime OpenGL error.");}else{auto result=fn(args...);ensure();need(api.GetError()==GL_NO_ERROR,"Pack image lifetime OpenGL error.");return result;}}
        void writable()const{ensure();need(!retired&&readers.load()==0,"Pack images are retired or pinned by readers.");need(generation!=UINT64_MAX,"Pack image generation exhausted.");}
        void begin(){writable();ready=false;++generation;}
        void release(){
            need(readers.load()==0&&!outputs->pendingRestore(),"Restore bindings and release image readers before deletion.");allocated=false;ready=false;
            for(auto& image:images)if(image.name){if(call(api.IsTexture,image.name)==GL_TRUE)call(api.DeleteTextures,1,&image.name);image.name=0;}
        }
        void collect(){ensure();need(!busy,"Cannot collect images during a pass.");outputs->collect();if(retired&&readers.load()==0)release();}
        bool empty()const{return std::none_of(images.begin(),images.end(),[](const auto& image){return image.name!=0;});}
        ~ImageStore()noexcept{retired=true;try{collect();}catch(...){}if(!empty())++uncollected_;}
    };
    struct ReadPin {
        std::shared_ptr<ImageStore> store;uint64_t generation;size_t index;
        ReadPin(std::shared_ptr<ImageStore> s,size_t i):store(std::move(s)),generation(store->generation),index(i){need(store->readers.load()<32,"Pack image read lease limit (32) exceeded.");++store->readers;}
        ~ReadPin(){--store->readers;} // CPU-only, including on foreign threads.
        bool live(uint64_t value)const{store->ensure();return store->ready&&store->generation==generation&&value==generation&&store->images[index].name!=0;}
    };
    std::shared_ptr<PackFramebufferBinder> outputs_;PackPassApi api_;
    std::shared_ptr<ImageStore> storage_;
    GLint width_=0,height_=0;uint64_t bytes_=0;PackPassState state_;
    bool pending_=false,running_=false,closed_=false;
    // Blending is deliberately disabled, preserving each indexed enable/mask.
    // The other caps cannot affect this bounded triangle pass implicitly.
    static constexpr std::array<GLenum,23> caps_={GL_DEPTH_TEST,GL_CULL_FACE,GL_STENCIL_TEST,
        GL_RASTERIZER_DISCARD,GL_COLOR_LOGIC_OP,GL_FRAMEBUFFER_SRGB,GL_DITHER,
        GL_POLYGON_OFFSET_FILL,GL_POLYGON_OFFSET_LINE,GL_POLYGON_OFFSET_POINT,GL_DEPTH_CLAMP,
        GL_PRIMITIVE_RESTART,GL_PRIMITIVE_RESTART_FIXED_INDEX,GL_SAMPLE_ALPHA_TO_COVERAGE,GL_SAMPLE_ALPHA_TO_ONE,
        GL_SAMPLE_COVERAGE,GL_SAMPLE_MASK,GL_SAMPLE_SHADING,GL_MULTISAMPLE,GL_POLYGON_SMOOTH,GL_LINE_SMOOTH,GL_PROGRAM_POINT_SIZE,GL_TEXTURE_CUBE_MAP_SEAMLESS};
    std::array<GLboolean,caps_.size()> enabled_{};std::array<GLboolean,8> clips_{},blend_{};GLboolean scissor_=GL_FALSE;
    std::array<std::array<GLint,4>,8> masks_{};GLint slots_=0,clipCount_=0;
    GLint depthMask_=0,depthFunc_=0,front_=0,cull_=0,polygon_[2]{},origin_=0,clipDepth_=0;
    std::array<GLdouble,2> depthRange_{};
    PackTestPass(std::unique_ptr<PackFramebufferBinder>&& outputs,PackPassApi api,std::vector<Image> images,GLint width,GLint height,uint64_t bytes,PackPassState state,GLint slots,GLint clips)
        :outputs_(std::move(outputs)),api_(api),storage_(std::make_shared<ImageStore>(outputs_,api,std::move(images),width,height)),width_(width),height_(height),bytes_(bytes),state_(state),slots_(slots),clipCount_(clips){}
    static void need(bool valid,const char* message){if(!valid)throw std::runtime_error(message);}
    void ensure()const{need(!closed_,"Closed pack test pass.");outputs_->ensure();}
    void error()const{ensure();need(api_.GetError()==GL_NO_ERROR,"Pack test pass OpenGL error.");}
    template<class F,class... A>auto call(F fn,A... args)const{ensure();if constexpr(std::is_void_v<std::invoke_result_t<F,A...>>){fn(args...);error();}else{auto result=fn(args...);error();return result;}}
    GLint integer(GLenum key)const{GLint value=0;call(api_.GetIntegerv,key,&value);return value;}
    void toggle(GLenum cap,bool value)const{if(value)call(api_.Enable,cap);else call(api_.Disable,cap);}
    void indexed(GLenum cap,GLuint index,bool value)const{if(value)call(api_.Enablei,cap,index);else call(api_.Disablei,cap,index);}
    static uint32_t pixelBytes(GLenum format){switch(format){case GL_RGBA8:case GL_DEPTH_COMPONENT24:case GL_DEPTH_COMPONENT32F:return 4;case GL_RGBA16F:return 8;case GL_RGBA32F:return 16;default:throw std::runtime_error("Unsupported test pass image format.");}}
    void releaseImages(){
        need(!pending_&&!outputs_->pendingRestore(),"Restore pack state before releasing images.");storage_->release();
    }
    void allocate(){
        if(storage_->allocated)return;releaseImages();
        for(auto& image:storage_->images){
            ensure();api_.CreateTextures(GL_TEXTURE_2D,1,&image.name);error();need(image.name!=0,"Cannot create pack pass image.");
            call(api_.TextureStorage2D,image.name,1,image.spec.format,width_,height_);
            call(api_.TextureParameteri,image.name,GL_TEXTURE_MIN_FILTER,GL_NEAREST);call(api_.TextureParameteri,image.name,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
            call(api_.TextureParameteri,image.name,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);call(api_.TextureParameteri,image.name,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
            call(api_.TextureParameteri,image.name,GL_TEXTURE_WRAP_R,GL_CLAMP_TO_EDGE);
            call(api_.TextureParameteri,image.name,GL_TEXTURE_BASE_LEVEL,0);call(api_.TextureParameteri,image.name,GL_TEXTURE_MAX_LEVEL,0);
        }
        storage_->allocated=true;
    }
    void capture(){
        for(size_t i=0;i<caps_.size();++i)enabled_[i]=call(api_.IsEnabled,caps_[i]);
        for(GLint i=0;i<clipCount_;++i)clips_[i]=call(api_.IsEnabled,GL_CLIP_DISTANCE0+i);
        for(GLint i=0;i<slots_;++i){blend_[i]=call(api_.IsEnabledi,GL_BLEND,i);call(api_.GetIntegeri_v,GL_COLOR_WRITEMASK,i,masks_[i].data());}
        scissor_=call(api_.IsEnabledi,GL_SCISSOR_TEST,0);
        depthMask_=integer(GL_DEPTH_WRITEMASK);depthFunc_=integer(GL_DEPTH_FUNC);front_=integer(GL_FRONT_FACE);cull_=integer(GL_CULL_FACE_MODE);
        call(api_.GetIntegerv,GL_POLYGON_MODE,polygon_);need(polygon_[0]==polygon_[1],"Unsupported asymmetric core polygon mode.");
        origin_=integer(GL_CLIP_ORIGIN);clipDepth_=integer(GL_CLIP_DEPTH_MODE);call(api_.GetDoublei_v,GL_DEPTH_RANGE,0,depthRange_.data());
        pending_=true; // No state mutation occurs until the entire snapshot exists.
    }
    void apply(){
        for(const auto cap:caps_)toggle(cap,false);
        for(GLint i=0;i<clipCount_;++i)toggle(GL_CLIP_DISTANCE0+i,false);
        for(GLint i=0;i<slots_;++i){indexed(GL_BLEND,i,false);call(api_.ColorMaski,i,GLboolean{GL_TRUE},GLboolean{GL_TRUE},GLboolean{GL_TRUE},GLboolean{GL_TRUE});}
        indexed(GL_SCISSOR_TEST,0,false);
        toggle(GL_DEPTH_TEST,state_.depthTest);toggle(GL_CULL_FACE,state_.cull);
        // Clears must initialize the full depth image, even for read-only draws.
        call(api_.DepthMask,GLboolean{GL_TRUE});call(api_.DepthFunc,state_.depthFunction);call(api_.DepthRangeIndexed,0,0.0,1.0);
        call(api_.FrontFace,state_.front);call(api_.CullFace,state_.cullFace);call(api_.PolygonMode,GL_FRONT_AND_BACK,GL_FILL);call(api_.ClipControl,GL_LOWER_LEFT,GL_NEGATIVE_ONE_TO_ONE);
    }
    void restore(){
        if(!pending_)return;ensure();need(!outputs_->pendingRestore(),"Collect nested output bindings before restoring pass state.");std::exception_ptr failure;
        auto attempt=[&](auto fn){try{fn();}catch(...){if(!failure)failure=std::current_exception();}};
        for(size_t i=0;i<caps_.size();++i)attempt([&]{toggle(caps_[i],enabled_[i]!=0);});
        for(GLint i=0;i<clipCount_;++i)attempt([&]{toggle(GL_CLIP_DISTANCE0+i,clips_[i]!=0);});
        for(GLint i=0;i<slots_;++i){attempt([&]{indexed(GL_BLEND,i,blend_[i]!=0);});attempt([&]{const auto& m=masks_[i];call(api_.ColorMaski,i,static_cast<GLboolean>(m[0]),static_cast<GLboolean>(m[1]),static_cast<GLboolean>(m[2]),static_cast<GLboolean>(m[3]));});}
        attempt([&]{indexed(GL_SCISSOR_TEST,0,scissor_!=0);});
        attempt([&]{call(api_.DepthMask,static_cast<GLboolean>(depthMask_));});attempt([&]{call(api_.DepthFunc,depthFunc_);});attempt([&]{call(api_.DepthRangeIndexed,0,depthRange_[0],depthRange_[1]);});
        attempt([&]{call(api_.FrontFace,front_);});attempt([&]{call(api_.CullFace,cull_);});attempt([&]{call(api_.PolygonMode,GL_FRONT_AND_BACK,polygon_[0]);});attempt([&]{call(api_.ClipControl,origin_,clipDepth_);});
        if(failure)std::rethrow_exception(failure);pending_=false;
    }
    void drain(){outputs_->collect();restore();}
public:
    // Keep this handle for deferred owner-context collection after destroying
    // the producer. Read-pin retirement is CPU-only; the retained collector
    // keeps final image deletion on the explicit owner-context path.
    class ImageCollection {
        friend class PackTestPass;std::shared_ptr<ImageStore> storage_;
        explicit ImageCollection(std::shared_ptr<ImageStore> store):storage_(std::move(store)){}
    public:
        ImageCollection()=default;
        void collect(){need(bool(storage_),"Empty pack image collector.");storage_->collect();}
        void close(){if(!storage_)return;storage_->collect();need(storage_->retired&&storage_->empty(),"Retire the pass and release its image readers before closing the collector.");storage_.reset();}
        size_t readers()const{return storage_?storage_->readers.load():0;}
    };
    PackTestPass(const PackTestPass&)=delete;PackTestPass& operator=(const PackTestPass&)=delete;
    ~PackTestPass()noexcept{if(closed_)return;try{close();}catch(...){if(pending_)++uncollected_;storage_->retired=true;}}
    static size_t uncollectedOnDestruction(){return uncollected_.load();}
    static std::unique_ptr<PackTestPass> create(std::unique_ptr<PackFramebufferBinder>&& outputs,PackPassApi api,const std::vector<PackPassImageSpec>& specs,GLint width,GLint height,PackPassState state){
        need(bool(outputs),"Missing pack framebuffer binder.");outputs->ensure();api.validate();need(!outputs->pendingRestore(),"Collect pack framebuffer state before pass construction.");
        need(width>0&&height>0&&width<=4096&&height<=4096&&width<=outputs->maxWidth_&&height<=outputs->maxHeight_&&!specs.empty()&&specs.size()<=9,"Test pass image layout exceeds bounds.");
        need(state.depthFunction>=GL_NEVER&&state.depthFunction<=GL_ALWAYS&&(state.front==GL_CW||state.front==GL_CCW)&&(state.cullFace==GL_FRONT||state.cullFace==GL_BACK||state.cullFace==GL_FRONT_AND_BACK),"Invalid explicit test pass state.");
        const auto routes=outputs->uniforms().plan().drawBuffers();std::set<GLenum> expected,seen;for(const auto point:routes)if(point!=GL_NONE)expected.insert(point);
        uint64_t bytes=0;bool depth=false;std::vector<Image> images;
        for(const auto& spec:specs){
            need(seen.insert(spec.attachment).second,"Duplicate test pass attachment.");
            const bool isDepth=spec.attachment==GL_DEPTH_ATTACHMENT;
            need(isDepth?(spec.format==GL_DEPTH_COMPONENT24||spec.format==GL_DEPTH_COMPONENT32F):expected.contains(spec.attachment)&&(spec.format==GL_RGBA8||spec.format==GL_RGBA16F||spec.format==GL_RGBA32F),"Test pass attachment is not explicitly routed or has incompatible storage.");
            for(const auto value:spec.clear)need(std::isfinite(value),"Non-finite test pass clear value.");
            if(isDepth){depth=true;need(spec.clear[0]>=0&&spec.clear[0]<=1,"Invalid test pass depth clear.");}else expected.erase(spec.attachment);
            bytes+=static_cast<uint64_t>(width)*height*pixelBytes(spec.format);images.push_back({spec,0});
        }
        need(expected.empty()&&(!(state.depthTest||state.depthWrite||outputs->uniforms().reflection().writesFragmentDepth)||depth),"Test pass is missing a required output image.");need(bytes<=64ull*1024*1024,"Test pass exceeds 64 MiB logical image budget.");
        auto query=[&](GLenum key){outputs->ensure();need(api.GetError()==GL_NO_ERROR,"Pack pass context error.");GLint value=0;outputs->ensure();api.GetIntegerv(key,&value);outputs->ensure();need(api.GetError()==GL_NO_ERROR,"Pack pass context error.");return value;};
        const auto major=query(GL_MAJOR_VERSION),minor=query(GL_MINOR_VERSION),slots=query(GL_MAX_DRAW_BUFFERS),clips=query(GL_MAX_CLIP_DISTANCES);
        need((major>4||major==4&&minor>=5)&&slots>0&&clips>=0&&clips<=8,"Test pass requires desktop GL 4.5 and bounded clip distances.");
        return std::unique_ptr<PackTestPass>(new PackTestPass(std::move(outputs),api,std::move(images),width,height,bytes,state,std::min(slots,8),clips));
    }
    static std::unique_ptr<PackTestPass> native(std::unique_ptr<PackFramebufferBinder>&& outputs,const std::vector<PackPassImageSpec>& specs,GLint width,GLint height,PackPassState state){
        need(bool(outputs),"Missing pack framebuffer binder.");PackPassApi api;
#define PACK_PASS_LOAD(name,type) outputs->ensure();api.name=reinterpret_cast<type>(glfwGetProcAddress("gl" #name));
        PACK_PASS_APIS(PACK_PASS_LOAD)
#undef PACK_PASS_LOAD
        return create(std::move(outputs),api,specs,width,height,state);
    }
    bool pendingRestore()const{return pending_||outputs_->pendingRestore();}
    uint64_t logicalImageBytes()const{return bytes_;}
    ImageCollection imageCollection()const{return ImageCollection(storage_);}
    PackTextureInput output(GLenum attachment,std::string sampler)const{
        ensure();need(!running_&&!pendingRestore()&&storage_->ready,"Pack output is not published.");
        need(!sampler.empty()&&sampler.size()<=127,"Invalid output sampler name.");
        const auto found=std::find_if(storage_->images.begin(),storage_->images.end(),[&](const auto& image){return image.spec.attachment==attachment;});need(found!=storage_->images.end(),"Unrouted pack output lease.");
        const auto pin=std::make_shared<ReadPin>(storage_,static_cast<size_t>(found-storage_->images.begin()));const std::weak_ptr<ReadPin> weak=pin;
        PackTextureInput input;input.name=std::move(sampler);input.texture=found->name;input.target=GL_TEXTURE_2D;input.format=found->spec.format;input.width=width_;input.height=height_;input.owner=pin;input.generation=pin->generation;
        input.current=[weak](uint64_t generation){auto live=weak.lock();return live&&live->live(generation);};
        input.ownership_=[weak](const PackTextureInput& value){auto pin=weak.lock();if(!pin||!pin->live(value.generation))return false;const auto& s=*pin->store;const auto& image=s.images[pin->index];return value.owner.get()==pin.get()&&value.texture==image.name&&value.target==GL_TEXTURE_2D&&value.format==image.spec.format&&value.width==s.width&&value.height==s.height&&value.depth==1&&value.sampler==0&&value.sampling==PackTextureSampling{};};
        return input;
    }
    void collect(){ensure();need(!running_,"Reentrant pack test pass collection.");drain();}
    void close(){if(closed_)return;ensure();need(!running_,"Reentrant pack test pass close.");drain();storage_->retired=true;storage_->collect();closed_=true;}
    void draw(const std::vector<PackUniformValue>& values,const std::vector<PackVertexInput>& inputs,const std::vector<PackTextureInput>& textures,const PackArrayDraw& command){
        ensure();need(!running_,"Reentrant pack test pass draw.");need(command.mode==GL_TRIANGLES,"Test pass supports triangles only.");drain();storage_->writable();running_=storage_->busy=true;
        try{
            storage_->begin();outputs_->write(values);allocate();capture();
            std::vector<PackOutputImage> images;for(const auto& image:storage_->images){PackOutputImage out;out.attachment=image.spec.attachment;out.format=image.spec.format;out.texture=image.name;out.width=width_;out.height=height_;out.owner=storage_->writeOwner;out.generation=storage_->generation;out.current=[weak=std::weak_ptr<ImageStore>(storage_)](uint64_t generation){auto store=weak.lock();return store&&!store->retired&&generation==store->generation;};images.push_back(std::move(out));}
            outputs_->drawPrepared(images,inputs,textures,command,[&]{
                apply();const auto routes=outputs_->uniforms().plan().drawBuffers();
                for(const auto& image:storage_->images)if(image.spec.attachment==GL_DEPTH_ATTACHMENT)call(api_.ClearBufferfv,GL_DEPTH,0,image.spec.clear.data());
                else{const auto found=std::find(routes.begin(),routes.end(),image.spec.attachment);need(found!=routes.end(),"Missing test pass clear route.");call(api_.ClearBufferfv,GL_COLOR,static_cast<GLint>(found-routes.begin()),image.spec.clear.data());}
                call(api_.DepthMask,static_cast<GLboolean>(state_.depthWrite?GL_TRUE:GL_FALSE));
            });
            drain();storage_->ready=true;running_=storage_->busy=false;
        }catch(...){auto failure=std::current_exception();try{drain();}catch(...){}running_=storage_->busy=false;std::rethrow_exception(failure);}
    }
};
#undef PACK_PASS_APIS
}
