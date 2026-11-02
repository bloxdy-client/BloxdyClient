#pragma once
#include <glm/glm.hpp>
#include <algorithm>
#include <cmath>
#include <cstddef>
#include <vector>

namespace bridge {
struct IrisVertex {glm::vec4 tangent{1,0,0,1};glm::vec2 midpoint{0};glm::vec4 midBlock{0,0,0,-1};};
static_assert(sizeof(IrisVertex)==40);
struct IrisGeometry {
    std::vector<IrisVertex> vertices;bool quadMidpointsComplete=true,blockCentersComplete=true;
    static IrisGeometry build(const std::vector<float>& source,const std::vector<uint32_t>& indices,bool terrain){
        IrisGeometry out;const auto count=source.size()/14;out.vertices.resize(count);out.blockCentersComplete=terrain;
        std::vector<glm::vec3> tangents(count,glm::vec3(0)),bitangents(count,glm::vec3(0));std::vector<bool> assigned(count,false);
        auto position=[&](uint32_t i){return glm::vec3(source[i*14],source[i*14+1],source[i*14+2]);};
        auto normal=[&](uint32_t i){auto n=glm::vec3(source[i*14+3],source[i*14+4],source[i*14+5]);return glm::length(n)>.000001f?glm::normalize(n):glm::vec3(0,1,0);};
        auto uv=[&](uint32_t i){return glm::vec2(source[i*14+6],source[i*14+7]);};
        for(size_t at=0;at<indices.size();at+=3){const auto a=indices[at],b=indices[at+1],c=indices[at+2];const auto e1=position(b)-position(a),e2=position(c)-position(a);const auto u1=uv(b)-uv(a),u2=uv(c)-uv(a);const auto determinant=u1.x*u2.y-u1.y*u2.x;
            if(std::abs(determinant)>.000001f){const auto t=(e1*u2.y-e2*u1.y)/determinant,bt=(e2*u1.x-e1*u2.x)/determinant;for(auto v:{a,b,c}){tangents[v]+=t;bitangents[v]+=bt;}}
        }
        // Only adjacent, coplanar triangles with four unique corners qualify
        // as an original quad. Never invent a block center for a greedy face.
        std::vector<uint32_t> corners;corners.reserve(6);
        for(size_t at=0;at<indices.size();){
            corners.clear();const size_t used=std::min<size_t>(6,indices.size()-at);
            for(size_t i=0;i<used;++i)if(std::find(corners.begin(),corners.end(),indices[at+i])==corners.end())corners.push_back(indices[at+i]);
            bool quad=used==6&&corners.size()==4;glm::vec3 center(0),lo(0),hi(0),n(0);glm::vec2 middle(0);
            if(quad){const auto a=glm::cross(position(indices[at+1])-position(indices[at]),position(indices[at+2])-position(indices[at]));const auto b=glm::cross(position(indices[at+4])-position(indices[at+3]),position(indices[at+5])-position(indices[at+3]));quad=glm::length(a)>.000001f&&glm::length(b)>.000001f&&glm::dot(a,b)>0;}
            if(quad){lo=hi=position(corners[0]);n=normal(corners[0]);for(auto v:corners){const auto p=position(v);center+=p;middle+=uv(v);lo=glm::min(lo,p);hi=glm::max(hi,p);if(std::abs(glm::dot(p-position(corners[0]),n))>.0001f||glm::dot(normal(v),n)<.999f)quad=false;}center*=.25f;middle*=.25f;}
            if(quad){const auto size=hi-lo;int unitAxes=0,zeroAxes=0;for(int axis=0;axis<3;++axis){unitAxes+=std::abs(size[axis]-1)<.0001f;zeroAxes+=std::abs(size[axis])<.0001f;}
                const bool block=terrain&&unitAxes==2&&zeroAxes==1;out.blockCentersComplete&=block;
                for(auto v:corners){if(assigned[v]&&glm::length(out.vertices[v].midpoint-middle)>.0001f)out.quadMidpointsComplete=false;out.vertices[v].midpoint=middle;assigned[v]=true;if(block)out.vertices[v].midBlock=glm::vec4((center-n*.5f-position(v))*64.0f,-1);}
                at+=6;
            }else{out.quadMidpointsComplete=false;out.blockCentersComplete=false;at+=3;}
        }
        for(size_t v=0;v<count;++v){const auto n=normal(static_cast<uint32_t>(v));auto t=tangents[v]-n*glm::dot(n,tangents[v]);if(glm::length(t)<.000001f)t=glm::cross(std::abs(n.y)<.9f?glm::vec3(0,1,0):glm::vec3(1,0,0),n);t=glm::normalize(t);const float sign=glm::dot(glm::cross(n,t),bitangents[v])<0?-1.0f:1.0f;out.vertices[v].tangent=glm::vec4(t,sign);}
        return out;
    }
};
inline glm::ivec2 irisLightmap(float packed){const auto bits=static_cast<uint32_t>(std::clamp(std::round(packed),0.0f,65535.0f));return {static_cast<int>(std::max({bits&15,(bits>>4)&15,(bits>>8)&15})*16),static_cast<int>((bits>>12)*16)};}
inline glm::vec2 normalizedIrisLightmap(glm::ivec2 raw){return (glm::vec2(raw)+glm::vec2(8))/256.0f;}
}
