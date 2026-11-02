#pragma once
#include "bridge_camera.hpp"
#include <array>
#include <optional>
#include <string>
#include <string_view>
#include <vector>
#include <chrono>
#include <cstdint>

namespace bridge {
// ProgramId fallback edges from the pinned Iris artifact, not material IDs.
enum class GeometrySlot { Unknown, Basic, Textured, TexturedLit, SkyBasic, SkyTextured,
    Terrain, TerrainSolid, TerrainCutout, Water, Entities, EntitiesTrans, Block, BlockTrans,
    Item, Particles, ParticlesTrans, Hand, HandWater, Shadow, ShadowSolid, ShadowCutout,
    ShadowWater, ShadowEntities, ShadowBlock, Count };
enum class GeometryRole { Generic, Terrain, Entity, BlockEntity, Item };
inline GeometrySlot geometrySlot(GeometryRole role,bool hand,bool shadow,bool transparent,bool cutout,bool textured,bool lit){
    using S=GeometrySlot;
    if(shadow){
        if(hand)throw std::runtime_error("Hands cannot cast world shadows.");
        switch(role){case GeometryRole::Terrain:return transparent?S::ShadowWater:cutout?S::ShadowCutout:S::ShadowSolid;
        case GeometryRole::Entity:case GeometryRole::Item:return S::ShadowEntities;case GeometryRole::BlockEntity:return S::ShadowBlock;default:return S::Shadow;}
    }
    if(hand)return transparent?S::HandWater:S::Hand;
    switch(role){case GeometryRole::Terrain:return transparent?S::Water:cutout?S::TerrainCutout:S::TerrainSolid;
    case GeometryRole::Entity:return transparent?S::EntitiesTrans:S::Entities;case GeometryRole::BlockEntity:return transparent?S::BlockTrans:S::Block;
    case GeometryRole::Item:return S::Item;default:return textured?(lit?S::TexturedLit:S::Textured):S::Basic;}
}
inline GeometrySlot geometryFallback(GeometrySlot slot){
    using S=GeometrySlot;
    switch(slot){
    case S::Textured:case S::SkyBasic:return S::Basic;
    case S::TexturedLit:case S::SkyTextured:return S::Textured;
    case S::Terrain:case S::Entities:case S::Item:case S::Particles:case S::Hand:return S::TexturedLit;
    case S::TerrainSolid:case S::TerrainCutout:case S::Water:case S::Block:return S::Terrain;
    case S::EntitiesTrans:return S::Entities;case S::BlockTrans:return S::Block;
    case S::ParticlesTrans:return S::Particles;case S::HandWater:return S::Hand;
    case S::ShadowSolid:case S::ShadowCutout:case S::ShadowWater:case S::ShadowEntities:case S::ShadowBlock:return S::Shadow;
    default:return S::Unknown;
    }
}
// Raw source inputs are deliberately distinct from Minecraft semantics.
enum class GeometryAttribute { Position, Normal, UV, Color, Layer, PackedLight,
    InstanceMatrix, InstanceExtras, SourceSurface, Tangent, Midpoint, MidBlock, SourceLightmap };
struct GeometryAttributeBinding { std::string name;GLuint location=0;GeometryAttribute value=GeometryAttribute::Position; };
enum class GeometryUniform { ModelView, ModelViewInverse, Projection, ProjectionInverse, NormalMatrix,
    GbufferProjection, GbufferProjectionInverse, GbufferModelView, GbufferModelViewInverse,
    PreviousModelView, PreviousProjection, ShadowModelView, ShadowModelViewInverse, ShadowProjection, ShadowProjectionInverse,
    TextureMatrix, LightmapMatrix, Instanced, AlphaCutoff, AtlasGrid, AtlasTile,
    SourceLightingEnabled, SourceSkyLight, SourceAmbientLight, SourceHeldLight, SourceHeldVector, SourceSkySunDirection, SourceOwnEmissionRgb, SourceBlockId, SourceBlockRootId, SourceBlockProperties, SourceBlockState,
    PackBlockId, WorldTime, Weather, PlayerState, SemanticIds, OwnEmission, ReferenceLightmap };
struct GeometryUniformBinding {
    std::string name;GLint location=-1;GeometryUniform value=GeometryUniform::ModelView;
    // Unknown optional data is zeroed AND accompanied by this explicit bool.
    // Without a validity binding an unavailable value is a hard failure.
    std::string validityName;GLint validity=-1;
};
enum class GeometrySampler { Texture, Atlas, Array, Lightmap, Normals, Specular };
struct GeometrySamplerBinding { std::string name;GLint location=-1;uint32_t unit=0;GeometrySampler value=GeometrySampler::Texture; };
struct IrisHandProjection {
    float hudFovRadians=0,depthFar=0;
    glm::mat4 bob{1};bool known=false;
    glm::mat4 projection(int width,int height,bool reverse)const{
        if(!known||width<1||height<1||!std::isfinite(hudFovRadians)||hudFovRadians<=0||hudFovRadians>=3.13f||!std::isfinite(depthFar)||depthFar<=.05f)
            throw std::runtime_error("Reference HUD FOV/far/bobbing is unknown or invalid.");
        CameraHistory::checkedInverse(bob);
        // HandRenderer.setupGlState: C_zo * perspective(0.05, far, HUD FOV) * bob.
        // N * C_zo * inverse(N) = diag(1,1,.125,1). No glDepthRange trick.
        auto p=glm::perspectiveRH_NO(hudFovRadians,static_cast<float>(width)/height,.05f,depthFar)*bob;
        for(int c=0;c<4;++c)p[c][2]*=reverse?-.125f:.125f;
        CameraHistory::checkedInverse(p);return p;
    }
};
enum class HandProjectionMode { Reference, ObservedSource };
struct ObservedHandProjection {
    glm::mat4 view{1},sourceProjection{1};glm::vec3 camera{0};
    int width=0,height=0,group=0;bool halfZ=false,known=false;
    glm::mat4 canonicalProjection()const{
        auto result=sourceProjection;if(halfZ)for(int c=0;c<4;++c)result[c][2]=2*result[c][2]-result[c][3];return result;
    }
    glm::mat4 projection(int w,int h)const{
        if(!known||w!=width||h!=height)throw std::runtime_error("Observed source hand projection is unknown or resized.");
        auto result=canonicalProjection();
        // Preserve the actual source FOV/near/far and bob already in its view.
        // Only the explicit Iris depth compression is applied here.
        for(int c=0;c<4;++c)result[c][2]*=.125f;
        CameraHistory::checkedInverse(result);return result;
    }
};
struct SourceLightData {
    uint32_t flags=0;bool enabled=false;
    glm::vec3 sky{0},ambient{0},sun{0};glm::vec4 held{0},heldVector{0};
};
// Canonical reference strings, never a raw registry ordinal or shaderpack ID.
// Incomplete states expose only explicitly known properties; door power, for
// example, remains unknown even when its current opening is observed.
struct MinecraftBlockState {
    std::string_view name,type;bool complete=false;std::optional<bool> waterlogged;
    std::string_view facing,half,shape,hinge;std::optional<bool> opened,powered;
    std::string_view axis;std::optional<bool> snowy;
    std::optional<uint32_t> level;
    static std::string_view fluidLevel(uint32_t n){
        constexpr std::string_view values[]={"0","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15"};
        return n<16?values[n]:std::string_view{};
    }
    bool known()const{return !name.empty();}
    std::optional<std::string_view> property(std::string_view key)const{
        if(known()&&key=="type"&&!type.empty())return type;
        if(!known())return std::nullopt;
        if(key=="waterlogged"&&waterlogged.has_value())return *waterlogged?"true":"false";
        if(key=="facing"&&!facing.empty())return facing;
        if(key=="half"&&!half.empty())return half;
        if(key=="shape"&&!shape.empty())return shape;
        if(key=="hinge"&&!hinge.empty())return hinge;
        if(key=="open"&&opened.has_value())return *opened?"true":"false";
        if(key=="powered"&&powered.has_value())return *powered?"true":"false";
        if(key=="axis"&&!axis.empty())return axis;
        if(key=="snowy"&&snowy.has_value())return *snowy?"true":"false";
        if(key=="level"&&level.has_value()&&*level<16)return fluidLevel(*level);
        return std::nullopt;
    }
};
struct PackBlockId {int32_t value=0;bool known=false;bool operator==(const PackBlockId&)const=default;};
struct SourceBlockMaterial {
    uint32_t token=0,id=0,rootId=0,flags=0,rotation=0,open=0,half=0;
    std::string name,rootName,state;
    MinecraftBlockState minecraft;
};
// Frame-scoped provenance. Source observation NEVER asserts reference HUD/bob.
struct IrisGeometryFrame {
    uint64_t sourceFrame=~uint64_t{0};uint32_t epoch=0;
    glm::dvec3 origin{0},feet{0};bool feetKnown=false;
    SourceLightData light;
    IrisHandProjection hand;
    ObservedHandProjection observedHand;
    glm::dvec3 eye{0}; // render-interpolated player eye target, not third-person camera
    uint32_t serial=0,rootIdentity=0,cameraIdentity=0,playerEntity=0,playerIdentity=0,originIdentity=0,renderFrame=0;
    int width=0,height=0;bool eyeKnown=false;
    std::chrono::steady_clock::time_point expires{};
    bool matches(uint64_t frame,uint32_t scene,const glm::dvec3& currentOrigin)const{return sourceFrame==frame&&epoch==scene&&origin==currentOrigin;}
    bool current(int w,int h)const{return !serial||(width==w&&height==h&&std::chrono::steady_clock::now()<=expires);}
    bool samePlayer(const IrisGeometryFrame& previous)const{return !serial&&!previous.serial||
        serial&&previous.serial&&rootIdentity==previous.rootIdentity&&cameraIdentity==previous.cameraIdentity&&playerEntity==previous.playerEntity&&playerIdentity==previous.playerIdentity&&originIdentity==previous.originIdentity;}
};
struct GeometryMatrices {
    glm::mat4 modelView{1},projection{1},gbufferProjection{1},gbufferModelView{0};
    glm::mat4 previousModelView{0},previousProjection{0},shadowView{0},shadowProjection{0},texture{1};
    SourceLightData light;
    glm::vec3 sourceOwnRgb{0};bool sourceOwnKnown=false;
    uint32_t sourceBlock=0;bool sourceBlockKnown=false;
    const SourceBlockMaterial* sourceMaterial=nullptr;
    PackBlockId packBlockId;
    bool feetKnown=false,historyKnown=false,shadowKnown=false;
};
inline glm::mat4 geometryTextureMatrix(const glm::mat4& source){
    // Source uses (u,v,1,0); Iris uses (u,v,0,1).
    auto result=source;result[3]=source[2];result[2]=glm::vec4(0,0,1,0);result[3][3]=1;return result;
}
inline GLenum geometryUniformType(GeometryUniform u){
    using U=GeometryUniform;
    switch(u){case U::PackBlockId:case U::SourceLightingEnabled:case U::SourceBlockId:case U::SourceBlockRootId:case U::SourceBlockProperties:return GL_INT;
    case U::SourceBlockState:return GL_FLOAT_VEC3;
    case U::SourceSkyLight:case U::SourceAmbientLight:case U::SourceSkySunDirection:case U::SourceOwnEmissionRgb:return GL_FLOAT_VEC3;
    case U::SourceHeldLight:case U::SourceHeldVector:return GL_FLOAT_VEC4;
    case U::NormalMatrix:return GL_FLOAT_MAT3;case U::Instanced:case U::WorldTime:return GL_INT;
    case U::AlphaCutoff:case U::Weather:case U::OwnEmission:return GL_FLOAT;
    case U::AtlasGrid:case U::AtlasTile:return GL_INT_VEC2;
    case U::PlayerState:case U::SemanticIds:case U::ReferenceLightmap:return GL_FLOAT_VEC4;
    default:return GL_FLOAT_MAT4;}
}
inline GLenum geometryAttributeType(GeometryAttribute a){
    using A=GeometryAttribute;
    switch(a){case A::Position:case A::Normal:return GL_FLOAT_VEC3;
    case A::UV:case A::InstanceExtras:case A::SourceSurface:case A::Midpoint:return GL_FLOAT_VEC2;
    case A::Layer:case A::PackedLight:return GL_FLOAT;case A::InstanceMatrix:return GL_FLOAT_MAT4;
    case A::SourceLightmap:return GL_INT_VEC2;default:return GL_FLOAT_VEC4;}
}
}
