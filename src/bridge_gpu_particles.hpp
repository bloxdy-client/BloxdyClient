#pragma once
#include "bridge_source_frame.hpp"
#include "bridge_gpu_particle_shaders.hpp"
#include <map>
#include <set>

namespace bridge {
struct GpuParticleDraw {
    uint32_t id=0,order=0,count=0,start=0,texture=0,ramp=0,flags=0;
    std::array<uint32_t,7> raster{};std::array<uint32_t,4> wrap{};
    glm::mat4 view{1},projection{1};glm::vec4 frame{0};std::array<float,284> system{};
    std::vector<uint32_t> records;
    uint64_t key()const{return (uint64_t(id)<<32)|order;}
    int width()const{return int(std::min(count,256u))*4;}
    int height()const{return int((count+std::min(count,256u)-1)/std::min(count,256u));}
    uint64_t storage()const{return uint64_t(width())*height()*16;}
};
struct GpuParticleSnapshot {
    SourceFrameData source;std::vector<GpuParticleDraw> draws;
    static GpuParticleSnapshot read(Reader& r,uint32_t epoch){
        const auto require=[](bool v){if(!v)throw std::runtime_error("Invalid source GPU particle snapshot.");};
        require(r.bytes.size()<=1024*1024&&r.u32()==1);const auto size=r.u32(),count=r.u32();
        require((size==240||size==312||size==452)&&count<=32);
        const auto* bytes=r.data(size);std::vector<uint8_t> frame(bytes,bytes+size);Reader f{frame};
        require(f.u32()==magic&&f.u32()==SourceFrame&&f.u32()==size-16);f.u32();require(f.u32()==epoch);
        GpuParticleSnapshot result;result.source=SourceFrameData::read(f);require((result.source.flags&44)==44);
        uint32_t slots=0,previous=0;std::map<uint32_t,size_t> identities;std::set<uint32_t> repeated;
        for(uint32_t i=0;i<count;++i){
            GpuParticleDraw d;d.id=r.u32();d.order=r.u32();d.count=r.u32();d.start=r.u32();d.texture=r.u32();d.ramp=r.u32();d.flags=r.u32();
            for(auto& v:d.raster)v=r.u32();for(auto& v:d.wrap)v=r.u32();slots+=d.count;
            require(d.id&&d.order<=65535&&(!i||d.order>previous)&&d.count&&d.count<=8192&&slots<=8192&&d.start<d.count&&d.texture&&d.ramp&&d.flags<=15);
            require(d.raster[0]>=GL_NEVER&&d.raster[0]<=GL_ALWAYS&&d.raster[5]==GL_FUNC_ADD&&d.raster[6]==GL_FUNC_ADD);
            const std::array<uint32_t,4> factors{d.raster[1],d.raster[2],d.raster[3],d.raster[4]};
            constexpr std::array<std::array<uint32_t,4>,5> allowed{{{GL_ONE,GL_ONE,GL_ZERO,GL_ONE},{GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA,GL_ONE,GL_ONE},{GL_SRC_ALPHA,GL_ONE,GL_ZERO,GL_ONE},{GL_DST_COLOR,GL_ZERO,GL_ONE,GL_ONE},{GL_ZERO,GL_ONE_MINUS_SRC_COLOR,GL_ONE,GL_ONE}}};
            require((d.flags&4)&&std::find(allowed.begin(),allowed.end(),factors)!=allowed.end()&&bool(d.flags&8)==(factors==allowed[3]));
            for(auto v:d.wrap)require(v==GL_REPEAT||v==GL_CLAMP_TO_EDGE||v==GL_MIRRORED_REPEAT);
            for(auto* m:{&d.view,&d.projection})for(int k=0;k<16;++k){glm::value_ptr(*m)[k]=r.f32();require(std::abs(glm::value_ptr(*m)[k])<=1e12f);}
            require(d.view==result.source.view&&d.projection==result.source.projection);
            for(int k=0;k<4;++k)d.frame[k]=r.f32();for(auto& v:d.system){v=r.f32();require(std::abs(v)<=1e12f);}
            for(int k=0;k<4;++k)require(std::abs(d.frame[k])<=1e12f);
            for(auto k:{3,8,9})require(d.system[k]>=0&&d.system[k]<=16&&std::floor(d.system[k])==d.system[k]);
            require(d.system[10]==0||d.system[10]==1);
            for(const auto stops:std::array<std::array<int,3>,3>{{{3,12,1},{8,156,4},{9,220,4}}})for(int k=0;k<int(d.system[stops[0]]);++k){const int at=stops[1]+k*stops[2];require(d.system[at]>=0&&d.system[at]<=1&&(!k||d.system[at]>=d.system[at-stops[2]]));}
            if(d.system[10])for(int k=0;k<int(d.system[9]);++k)require(d.system[222+k*4]-d.system[221+k*4]>1e-8f);
            d.records=r.indices(size_t(d.count)*16);for(size_t k=0;k<d.records.size();++k)if(k%16<9||k%16>11){float v;std::memcpy(&v,&d.records[k],4);require(std::isfinite(v)&&std::abs(v)<=1e12f);}
            require(!repeated.contains(d.id));if(const auto found=identities.find(d.id);found!=identities.end()){
                const auto& p=result.draws[found->second];require(d.order==p.order+1&&(p.flags&8)&&!(d.flags&8)&&factors==allowed[2]&&d.start==p.start&&d.texture==p.texture&&d.ramp==p.ramp&&d.view==p.view&&d.projection==p.projection&&d.frame==p.frame&&d.system==p.system&&d.records==p.records);repeated.insert(d.id);
            }else {require(d.order%2==0);identities.emplace(d.id,result.draws.size());}
            previous=d.order;result.draws.push_back(std::move(d));
        }
        r.finish();return result;
    }
};
// Parse the complete envelope before any camera, light or GPU state changes.
struct SourceLightSnapshot {
    GpuParticleSnapshot batch;bool hasGpu=false;
    static SourceLightSnapshot read(Reader& r,uint32_t epoch){
        const auto require=[](bool v){if(!v)throw std::runtime_error("Invalid source light transaction.");};
        require(r.bytes.size()+16<=1024*1024&&r.u32()==1);
        const auto size=r.u32(),flags=r.u32(),enabled=r.u32();
        require(flags<=15&&enabled<=1&&((flags&1)||!enabled)&&(!(flags&6)||((flags&1)&&enabled)));
        std::array<float,17> v;for(auto& x:v)x=r.f32();
        for(int i=0;i<17;++i){const auto mask=i<6?2:i<14?4:8;if(!(flags&mask)){require(v[i]==0);continue;}
            if(i<6)require(v[i]>=0&&v[i]<=65504);else if(i<=8)require(v[i]>=0&&v[i]<=15);
            else if(i==9)require(v[i]>=0&&v[i]<=16777216);else if(i<=12)require(std::abs(v[i])<=16777216);else if(i==13)require(v[i]>=0&&v[i]<=1);
        }
        if(flags&8)require(std::abs(glm::length(glm::vec3(v[14],v[15],v[16]))-1)<=1e-4f);
        if((flags&4)&&v[13]>0)require(std::abs(glm::length(glm::vec3(v[10],v[11],v[12]))-1)<=1e-4f);
        require(size>=240&&size<=1024*1024-104);const auto* data=r.data(size);r.finish();
        std::vector<uint8_t> bytes(data,data+size);Reader nested{bytes};
        require(nested.u32()==magic);const auto type=nested.u32();require(type==SourceFrame||type==GpuParticles);
        require(nested.u32()==size-16);nested.u32();require(nested.u32()==epoch);
        SourceLightSnapshot result;result.hasGpu=type==GpuParticles;
        if(result.hasGpu)result.batch=GpuParticleSnapshot::read(nested,epoch);else result.batch.source=SourceFrameData::read(nested);
        require(!flags||(result.batch.source.flags&44)==44);
        auto& l=result.batch.source.geometry.light;l.flags=flags;l.enabled=enabled!=0;
        l.sky={v[0],v[1],v[2]};l.ambient={v[3],v[4],v[5]};l.held={v[6],v[7],v[8],v[9]};l.heldVector={v[10],v[11],v[12],v[13]};l.sun={v[14],v[15],v[16]};
        return result;
    }
};
class GpuParticleResources {
    struct Image {GLuint current=0,scratch=0;int width=0,height=0;std::vector<uint32_t> bits;
        uint64_t bytes()const{return uint64_t(width)*height*16*((current?1:0)+(scratch?1:0))+bits.size()*4;}
        void release(){for(auto id:{current,scratch})if(id)nativegl::glDeleteTextures(1,&id);current=scratch=0;bits.clear();}
    };
    std::map<uint64_t,Image> images;
    GLuint programId=0,vao=0;
    struct {GLint view,projection,frame,range,system,ramp,halfZ,multiply;} uniform{};
public:
    std::vector<GpuParticleDraw> draws;bool valid=false;uint32_t serial=0;
    uint64_t uploads=0,drawCalls=0;
    ~GpuParticleResources(){release();}
    uint64_t bytes()const{uint64_t n=0;for(const auto& [k,v]:images)n+=v.bytes();for(const auto& d:draws)n+=d.records.size()*4+sizeof(GpuParticleDraw);return n;}
    void invalidate(){valid=false;}
    void release(){for(auto& [k,v]:images)v.release();images.clear();draws.clear();valid=false;serial=0;if(programId)nativegl::glDeleteProgram(programId);if(vao)nativegl::glDeleteVertexArrays(1,&vao);programId=vao=0;}
    void accept(GpuParticleSnapshot& next,uint64_t occupied,uint64_t budget){
        valid=false;uint64_t peak=bytes();for(const auto& d:next.draws)peak+=d.storage()*2+d.records.size()*8+sizeof(GpuParticleDraw);
        if(peak>4*1024*1024||occupied>budget||peak>budget-occupied)throw std::runtime_error("Source GPU particle replacement exceeds shared memory budget.");
        struct UnpackState {
            GLint buffer=0;std::array<GLint,4> values{};
            const std::array<GLenum,4> keys={GL_UNPACK_ALIGNMENT,GL_UNPACK_ROW_LENGTH,GL_UNPACK_SKIP_PIXELS,GL_UNPACK_SKIP_ROWS};
            UnpackState(){nativegl::glGetIntegerv(GL_PIXEL_UNPACK_BUFFER_BINDING,&buffer);for(size_t i=0;i<keys.size();++i)nativegl::glGetIntegerv(keys[i],&values[i]);}
            ~UnpackState(){nativegl::glBindBuffer(GL_PIXEL_UNPACK_BUFFER,buffer);for(size_t i=0;i<keys.size();++i)nativegl::glPixelStorei(keys[i],values[i]);}
        } unpack;
        // Whole wire snapshot is validated first. A failed upload leaves no ready set.
        std::map<uint64_t,Image> replacements;std::set<uint64_t> changed;
        try{
            nativegl::glActiveTexture(GL_TEXTURE0);nativegl::glBindBuffer(GL_PIXEL_UNPACK_BUFFER,0);
            nativegl::glPixelStorei(GL_UNPACK_ALIGNMENT,4);nativegl::glPixelStorei(GL_UNPACK_ROW_LENGTH,0);nativegl::glPixelStorei(GL_UNPACK_SKIP_PIXELS,0);nativegl::glPixelStorei(GL_UNPACK_SKIP_ROWS,0);
            GLint limit=0;if(!next.draws.empty())nativegl::glGetIntegerv(GL_MAX_TEXTURE_SIZE,&limit);
            for(const auto& d:next.draws){
                if(d.width()>limit||d.height()>limit)throw std::runtime_error("Source GPU record texture exceeds hardware limits.");
                auto found=images.find(d.key());const bool resize=found==images.end()||found->second.width!=d.width()||found->second.height!=d.height();
                if(!resize&&found->second.bits==d.records)continue;
                auto& image=resize?replacements[d.key()]:found->second;
                image.width=d.width();image.height=d.height();
                if(!image.scratch){nativegl::glGenTextures(1,&image.scratch);if(!image.scratch)throw std::runtime_error("Source GPU record texture allocation failed.");nativegl::glBindTexture(GL_TEXTURE_2D,image.scratch);nativegl::glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA32UI,image.width,image.height,0,GL_RGBA_INTEGER,GL_UNSIGNED_INT,nullptr);}
                else nativegl::glBindTexture(GL_TEXTURE_2D,image.scratch);
                nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
                nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
                std::vector<uint32_t> padded(size_t(image.width)*image.height*4);std::copy(d.records.begin(),d.records.end(),padded.begin());
                nativegl::glTexSubImage2D(GL_TEXTURE_2D,0,0,0,image.width,image.height,GL_RGBA_INTEGER,GL_UNSIGNED_INT,padded.data());nativegl::check("Source GPU records upload");changed.insert(d.key());++uploads;
            }
            for(const auto& d:next.draws)if(changed.contains(d.key())){
                if(auto replacement=replacements.find(d.key());replacement!=replacements.end()){images[d.key()].release();images[d.key()]=std::move(replacement->second);replacement->second.current=replacement->second.scratch=0;}
                auto& image=images.at(d.key());std::swap(image.current,image.scratch);image.bits=d.records;
            }
            for(auto it=images.begin();it!=images.end();)if(std::none_of(next.draws.begin(),next.draws.end(),[&](const auto& d){return d.key()==it->first;})){it->second.release();it=images.erase(it);}else ++it;
            draws=std::move(next.draws);serial=next.source.geometry.serial;valid=next.source.fresh;
        }catch(...){for(auto& [k,v]:replacements)v.release();throw;}
    }
    GLuint shader(){
        if(!programId){
            programId=program({{GL_VERTEX_SHADER,gpuParticleVertex},{GL_FRAGMENT_SHADER,gpuParticleFragment}});
            const auto l=[&](const char* n){return nativegl::glGetUniformLocation(programId,n);};
            uniform={l("gpuParticleView"),l("gpuParticleProjection"),l("gpuParticleFrame"),l("gpuParticleRange"),l("gpuParticleSystem"),l("gpuParticleRamp"),l("gpuParticleHalfZ"),l("gpuParticleMultiply")};
            nativegl::glUseProgram(programId);nativegl::glUniform1i(l("gpuParticleTexture"),0);nativegl::glUniform1i(l("gpuParticleRampTexture"),1);nativegl::glUniform1i(l("gpuParticleRecords"),2);nativegl::glGenVertexArrays(1,&vao);nativegl::check("Source GPU program");
        }
        return programId;
    }
    void draw(const GpuParticleDraw& d,GLuint texture,GLuint ramp,bool halfZ){
        if(!valid)throw std::runtime_error("Source GPU particle snapshot is not ready.");
        shader();
        nativegl::glUseProgram(programId);nativegl::glBindVertexArray(vao);
        for(int unit=0;unit<3;++unit){nativegl::glActiveTexture(GL_TEXTURE0+unit);nativegl::glBindSampler(unit,0);nativegl::glBindTexture(GL_TEXTURE_2D,unit==0?texture:unit==1?ramp:images.at(d.key()).current);
            if(unit<2){nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,d.wrap[unit*2]);nativegl::glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,d.wrap[unit*2+1]);}}
        nativegl::glUniformMatrix4fv(uniform.view,1,GL_FALSE,glm::value_ptr(d.view));nativegl::glUniformMatrix4fv(uniform.projection,1,GL_FALSE,glm::value_ptr(d.projection));
        nativegl::glUniform4fv(uniform.frame,1,glm::value_ptr(d.frame));nativegl::glUniform2i(uniform.range,d.start,d.count);nativegl::glUniform4fv(uniform.system,71,d.system.data());
        nativegl::glUniform1f(uniform.ramp,d.system[10]);nativegl::glUniform1i(uniform.halfZ,halfZ?1:0);nativegl::glUniform1i(uniform.multiply,(d.flags&8)?1:0);
        nativegl::glDisable(GL_CULL_FACE);if(d.flags&1)nativegl::glEnable(GL_DEPTH_TEST);else nativegl::glDisable(GL_DEPTH_TEST);nativegl::glDepthMask((d.flags&2)?GL_TRUE:GL_FALSE);nativegl::glDepthFunc(d.raster[0]);
        nativegl::glEnable(GL_BLEND);nativegl::glBlendFuncSeparate(d.raster[1],d.raster[2],d.raster[3],d.raster[4]);nativegl::glBlendEquationSeparate(d.raster[5],d.raster[6]);
        nativegl::glDrawArraysInstanced(GL_TRIANGLE_STRIP,0,4,d.count);nativegl::check("Source analytic GPU particle draw");++drawCalls;
    }
};
}
