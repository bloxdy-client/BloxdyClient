#pragma once
#include "bridge_geometry_contract.hpp"

namespace bridge {
enum class MinecraftBlockKind {cube,slab,stairs,door_lower,door_upper,log,grass,fluid};
struct MinecraftBlockRule {std::string_view source,name;MinecraftBlockKind kind;uint32_t flags;};
// Generated from docs/bloxd-minecraft-block-map.json by the read-only audit tool.
inline constexpr MinecraftBlockRule minecraftBlockRules[]={
#include "bridge_minecraft_block_rules.inc"
};
inline MinecraftBlockState mapMinecraftBlock(const SourceBlockMaterial& m){
    // Numeric source IDs are identity evidence only, never Minecraft IDs.
    if(!m.token||!m.id||m.id>65535||!m.rootId||m.rootId>65535)return {};
    for(const auto& rule:minecraftBlockRules){
        if(m.rootName!=rule.source||m.flags!=rule.flags)continue;
        if(rule.kind==MinecraftBlockKind::log||rule.kind==MinecraftBlockKind::grass||rule.kind==MinecraftBlockKind::fluid){
            // These exact plain cube registrations prove the family, but carry
            // no reference axis/snowy/level producer. Never borrow Minecraft defaults
            // or infer a cell state from an atlas, transform or texture name.
            if(m.name!=m.rootName||m.id!=m.rootId||!m.state.empty()||m.rotation||m.half||m.open)return {};
            MinecraftBlockState result;result.name=rule.name;return result;
        }
        if(rule.kind==MinecraftBlockKind::cube){
            if(m.open)return {};
            if(m.name==m.rootName&&m.id==m.rootId&&m.state.empty()&&!m.rotation&&!m.half)return {rule.name,{},true};
            return {};
        }
        if(rule.kind==MinecraftBlockKind::stairs||rule.kind==MinecraftBlockKind::door_lower||rule.kind==MinecraftBlockKind::door_upper){
            if(m.rotation<1||m.rotation>4)return {};
            constexpr std::string_view facing[]={"north","west","south","east"};
            MinecraftBlockState result;result.name=rule.name;result.facing=facing[m.rotation-1];
            std::string state="meta|rot"+std::to_string(m.rotation);
            if(rule.kind==MinecraftBlockKind::stairs){
                if(m.open||m.half<1||m.half>2)return {};
                state+=m.half==1?"|bot":"|top";result.half=m.half==1?"bottom":"top";
                constexpr std::string_view sourceShapes[]={"","innerLeft","innerRight","outerLeft","outerRight"};
                constexpr std::string_view shapes[]={"straight","inner_right","inner_left","outer_right","outer_left"};
                bool matched=false;for(size_t i=0;i<5;++i){const auto candidate=state+(i?"|"+std::string(sourceShapes[i]):"");
                    if(m.state==candidate){result.shape=shapes[i];matched=true;break;}}
                if(!matched)return {};
                state=m.state;result.waterlogged=false;result.complete=true;
            }else{
                // Separate exact source roots identify the two door halves.
                // Power has no observed producer; it is deliberately unknown.
                if(m.half||m.open<1||m.open>2)return {};
                state+=m.open==1?"|closed":"|open";
                if(m.state!=state)return {};
                result.half=rule.kind==MinecraftBlockKind::door_lower?"lower":"upper";
                result.hinge="right";result.opened=m.open==2;
            }
            const bool root=m.rotation==1&&(rule.kind==MinecraftBlockKind::stairs?m.half==1&&result.shape=="straight":m.open==1);
            if(root?(m.id!=m.rootId||m.name!=m.rootName):(m.id==m.rootId||m.name!=m.rootName+"|"+state))return {};
            return result;
        }
        if(m.open)return {};
        // The pinned slab generator emits a bottom root and exactly one top.
        // Vertical sides have no Minecraft slab equivalent. These exact source
        // slab registrations are nonfluid (flags=9); the pinned physics adapter
        // queries registry.Xz[cell block ID], with no second fluid at that cell.
        if(m.rotation!=1)return {};
        if(m.half==1&&m.id==m.rootId&&m.name==m.rootName&&m.state=="meta|rot1|bot")return {rule.name,"bottom",true,false};
        if(m.half==2&&m.id!=m.rootId&&m.name==m.rootName+"|meta|rot1|top"&&m.state=="meta|rot1|top")return {rule.name,"top",true,false};
        return {};
    }
    return {};
}
}
