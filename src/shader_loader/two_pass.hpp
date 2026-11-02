#pragma once
#include "test_pass.hpp"

namespace bridge::shaderloader {
struct PackPassCall {
    std::vector<PackUniformValue> values;
    std::vector<PackVertexInput> vertices;
    std::vector<PackTextureInput> textures;
    PackArrayDraw command;
};
struct PackPassLink {GLenum attachment=GL_NONE;std::string sampler;};

// Exactly two synchronous, explicit passes in one already-current context.
// Links name physical producer attachments and reflected consumer samplers;
// no filename routing, semantic producers, ping-pong or history is inferred.
class PackTwoPass {
    std::unique_ptr<PackTestPass> first_,second_;std::vector<PackPassLink> links_;
    bool running_=false,ready_=false,closed_=false;
    PackTwoPass(std::unique_ptr<PackTestPass>&& first,std::unique_ptr<PackTestPass>&& second,std::vector<PackPassLink> links):first_(std::move(first)),second_(std::move(second)),links_(std::move(links)){}
    static void need(bool yes,const char* text){if(!yes)throw std::runtime_error(text);}
    void ensure()const{need(!closed_,"Closed pack two-pass chain.");first_->ensure();second_->ensure();}
    void drain(){second_->collect();first_->collect();}
public:
    PackTwoPass(const PackTwoPass&)=delete;PackTwoPass& operator=(const PackTwoPass&)=delete;
    static std::unique_ptr<PackTwoPass> create(std::unique_ptr<PackTestPass>&& first,std::unique_ptr<PackTestPass>&& second,const std::vector<PackPassLink>& links){
        need(first&&second&&first.get()!=second.get(),"Two distinct pack passes are required.");first->ensure();second->ensure();
        need(!first->running_&&!second->running_&&!first->pendingRestore()&&!second->pendingRestore(),"Collect both passes before chain construction.");
        need(!links.empty()&&links.size()<=9&&first->logicalImageBytes()+second->logicalImageBytes()<=128ull*1024*1024,"Two-pass links or logical image budget exceed bounds.");
        std::set<std::string> names;
        for(const auto& link:links){
            need(!link.sampler.empty()&&link.sampler.size()<=127&&names.insert(link.sampler).second,"Duplicate or invalid two-pass sampler route.");
            need(std::any_of(first->storage_->images.begin(),first->storage_->images.end(),[&](const auto& image){return image.spec.attachment==link.attachment;}),"Missing two-pass producer attachment.");
            const auto& uniforms=second->outputs_->uniforms().plan().uniforms();
            need(std::any_of(uniforms.begin(),uniforms.end(),[&](const auto& uniform){return uniform.name==link.sampler&&uniform.type==GL_SAMPLER_2D;}),"Two-pass link must target a reflected sampler2D.");
        }
        return std::unique_ptr<PackTwoPass>(new PackTwoPass(std::move(first),std::move(second),links));
    }
    bool pendingRestore()const{return first_->pendingRestore()||second_->pendingRestore();}
    std::array<PackTestPass::ImageCollection,2> imageCollections()const{return {first_->imageCollection(),second_->imageCollection()};}
    void collect(){ensure();need(!running_,"Reentrant two-pass collection.");drain();}
    void close(){if(closed_)return;need(!running_,"Reentrant two-pass close.");ready_=false;second_->close();first_->close();closed_=true;}
    PackTextureInput output(GLenum attachment,std::string sampler)const{ensure();need(!running_&&ready_,"Two-pass output is not published.");return second_->output(attachment,std::move(sampler));}
    void draw(const PackPassCall& first,const PackPassCall& second){
        ensure();need(!running_,"Reentrant two-pass draw.");drain();first_->storage_->writable();second_->storage_->writable();
        need(first.values.size()<=256&&second.values.size()<=256&&first.vertices.size()<=16&&second.vertices.size()<=16&&first.textures.size()<=512&&second.textures.size()<=512-links_.size(),"Two-pass invocation exceeds descriptor bounds.");
        for(const auto& link:links_)need(std::none_of(second.textures.begin(),second.textures.end(),[&](const auto& input){return input.name==link.sampler;}),"External texture conflicts with a two-pass link.");
        ready_=false;running_=true;
        try{
            first_->draw(first.values,first.vertices,first.textures,first.command);
            auto textures=second.textures;for(const auto& link:links_)textures.push_back(first_->output(link.attachment,link.sampler));
            second_->draw(second.values,second.vertices,textures,second.command);
            drain();ready_=true;running_=false;
        }catch(...){auto failure=std::current_exception();try{drain();}catch(...){}running_=false;std::rethrow_exception(failure);}
    }
};
}
