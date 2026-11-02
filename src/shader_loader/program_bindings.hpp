#pragma once
#include "linked_program.hpp"
#include <cmath>
#include <span>
#include <variant>

namespace bridge::shaderloader {
// A CPU-only, explicit contract for one reflected linked program. It records
// caller-owned producer keys and physical attachment choices, but does not
// infer their game semantics or issue any GL state-changing calls.
struct PackAttributeRoute {std::string name,source;GLenum type=0;GLint location=-1;};
struct PackUniformRoute {std::string name,producer;GLenum type=0;GLint location=-1;};
struct PackOutputRoute {uint32_t location=0;GLenum attachment=GL_NONE;};
struct PackBindingRequest {
    std::vector<PackAttributeRoute> attributes;
    std::vector<PackUniformRoute> uniforms;
    std::vector<PackOutputRoute> outputs;
};
struct PackUniformValue {std::string name;std::variant<std::vector<float>,std::vector<int32_t>> components;};
struct CheckedPackUniform {std::string name;GLenum type;GLint location;std::variant<std::vector<float>,std::vector<int32_t>> components;};

class PackBindingPlan {
    std::vector<PackAttributeRoute> attributes_;
    std::vector<PackUniformRoute> uniforms_;
    std::array<GLenum,8> drawBuffers_{};
    size_t drawBufferCount_=0;
    static void need(bool valid,const char* error){if(!valid)throw std::runtime_error(error);}
    static bool validKey(const std::string& key){return !key.empty()&&key.size()<=127&&std::all_of(key.begin(),key.end(),[](unsigned char c){return c>=33&&c<=126;});}
    static int components(GLenum type){
        switch(type){
        case GL_FLOAT:case GL_INT:case GL_BOOL:case GL_SAMPLER_2D:case GL_SAMPLER_3D:case GL_SAMPLER_CUBE:return 1;
        case GL_FLOAT_VEC2:case GL_INT_VEC2:case GL_BOOL_VEC2:return 2;
        case GL_FLOAT_VEC3:case GL_INT_VEC3:case GL_BOOL_VEC3:return 3;
        case GL_FLOAT_VEC4:case GL_INT_VEC4:case GL_BOOL_VEC4:case GL_FLOAT_MAT2:return 4;
        case GL_FLOAT_MAT3:return 9;case GL_FLOAT_MAT4:return 16;
        default:throw std::runtime_error("Unsupported pack runtime uniform type.");
        }
    }
    static bool integral(GLenum type){return type==GL_INT||type==GL_INT_VEC2||type==GL_INT_VEC3||type==GL_INT_VEC4||type==GL_BOOL||type==GL_BOOL_VEC2||type==GL_BOOL_VEC3||type==GL_BOOL_VEC4||type==GL_SAMPLER_2D||type==GL_SAMPLER_3D||type==GL_SAMPLER_CUBE;}
    static bool boolean(GLenum type){return type==GL_BOOL||type==GL_BOOL_VEC2||type==GL_BOOL_VEC3||type==GL_BOOL_VEC4;}
    static bool sampler(GLenum type){return type==GL_SAMPLER_2D||type==GL_SAMPLER_3D||type==GL_SAMPLER_CUBE;}
public:
    static PackBindingPlan create(const LinkedProgramInfo& reflected,const PackBindingRequest& request){
        PackBindingPlan plan;plan.drawBuffers_.fill(GL_NONE);
        need(request.attributes.size()==reflected.attributes.size()&&request.uniforms.size()==reflected.uniforms.size()&&request.outputs.size()==reflected.outputLocations.size(),"Incomplete or extra pack binding route.");
        std::unordered_set<std::string> names;
        for(const auto& actual:reflected.attributes){
            const auto it=std::find_if(request.attributes.begin(),request.attributes.end(),[&](const auto& route){return route.name==actual.name;});
            need(it!=request.attributes.end()&&it->type==actual.type&&it->location==actual.location&&validKey(it->source)&&names.insert(it->name).second,"Invalid pack attribute route.");
            plan.attributes_.push_back(*it);
        }
        names.clear();
        for(const auto& actual:reflected.uniforms){
            const auto it=std::find_if(request.uniforms.begin(),request.uniforms.end(),[&](const auto& route){return route.name==actual.name;});
            need(it!=request.uniforms.end()&&it->type==actual.type&&it->location==actual.location&&validKey(it->producer)&&names.insert(it->name).second,"Invalid pack uniform route.");
            components(actual.type);plan.uniforms_.push_back(*it);
        }
        std::set<GLenum> attachments;
        for(const auto location:reflected.outputLocations){
            const auto it=std::find_if(request.outputs.begin(),request.outputs.end(),[&](const auto& route){return route.location==location;});
            need(it!=request.outputs.end()&&location<8&&it->attachment>=GL_COLOR_ATTACHMENT0&&it->attachment<GL_COLOR_ATTACHMENT0+8&&attachments.insert(it->attachment).second,"Invalid pack output attachment route.");
            plan.drawBuffers_[location]=it->attachment;plan.drawBufferCount_=std::max(plan.drawBufferCount_,static_cast<size_t>(location)+1);
        }
        return plan;
    }
    const std::vector<PackAttributeRoute>& attributes()const{return attributes_;}
    const std::vector<PackUniformRoute>& uniforms()const{return uniforms_;}
    std::span<const GLenum> drawBuffers()const{return {drawBuffers_.data(),drawBufferCount_};}
    std::vector<CheckedPackUniform> checkValues(const std::vector<PackUniformValue>& values,uint32_t maxTextureUnits)const{
        need(values.size()==uniforms_.size(),"Incomplete or extra pack runtime uniform values.");
        std::vector<CheckedPackUniform> checked;checked.reserve(values.size());std::unordered_set<std::string> used;std::unordered_map<int32_t,GLenum> samplerTypes;
        for(const auto& route:uniforms_){
            const auto it=std::find_if(values.begin(),values.end(),[&](const auto& value){return value.name==route.name;});
            need(it!=values.end()&&used.insert(it->name).second,"Missing or duplicate pack runtime uniform.");
            const auto count=components(route.type);
            if(integral(route.type)){
                need(std::holds_alternative<std::vector<int32_t>>(it->components),"Pack uniform needs integer components.");
                const auto& v=std::get<std::vector<int32_t>>(it->components);need(v.size()==static_cast<size_t>(count),"Pack integer uniform component count mismatch.");
                if(boolean(route.type))need(std::all_of(v.begin(),v.end(),[](int32_t n){return n==0||n==1;}),"Pack boolean uniform must be zero or one.");
                if(sampler(route.type)){
                    need(v[0]>=0&&static_cast<uint32_t>(v[0])<maxTextureUnits,"Pack sampler unit exceeds caller limit.");
                    const auto [at,added]=samplerTypes.emplace(v[0],route.type);need(added||at->second==route.type,"Different pack sampler types alias one texture unit.");
                }
            }else{
                need(std::holds_alternative<std::vector<float>>(it->components),"Pack uniform needs float components.");
                const auto& v=std::get<std::vector<float>>(it->components);need(v.size()==static_cast<size_t>(count)&&std::all_of(v.begin(),v.end(),[](float n){return std::isfinite(n);}),"Invalid pack float uniform components.");
            }
            checked.push_back({route.name,route.type,route.location,it->components});
        }
        return checked;
    }
};
}
