#pragma once
#include "../bridge_minecraft_blocks.hpp"
#include <charconv>
#include <memory>
#include <unordered_map>

namespace bridge::shaderloader {
// Isolated loader component. Input is the explicit result of pack preprocessing;
// it never discovers files, expands tags, executes code or installs a recipe.
class BlockIdMap {
    struct Predicate {std::string key,value;};
    struct Selector {std::string name;std::vector<Predicate> predicates;};
    struct Group {int32_t id;std::vector<Selector> selectors;};
    std::vector<Group> groups;
    static constexpr size_t textLimit=256*1024,storageLimit=1024*1024,selectorLimit=8192;
    static bool white(char c){return c==' '||c=='\t'||c=='\f';}
    static bool ident(std::string_view s,bool name){return !s.empty()&&std::all_of(s.begin(),s.end(),[=](char c){return c>='a'&&c<='z'||c>='0'&&c<='9'||c=='_'||c=='-'||c=='.'||name&&c=='/';});}
    static void require(bool yes,const char* message){if(!yes)throw std::runtime_error(message);}
    static std::string unescape(std::string_view s){
        std::string out;for(size_t i=0;i<s.size();++i){char c=s[i];if(c=='\\'){
            require(++i<s.size(),"Incomplete block.properties escape.");c=s[i];
            if(c=='t')c='\t';else if(c=='n')c='\n';else if(c=='r')c='\r';else if(c=='f')c='\f';
            else if(c=='u'){require(i+4<s.size(),"Invalid properties Unicode escape.");unsigned value=0;
                for(int k=0;k<4;++k){const char h=s[++i];require(h>='0'&&h<='9'||h>='a'&&h<='f'||h>='A'&&h<='F',"Invalid properties Unicode digit.");value=value*16+(h<='9'?h-'0':(h|32)-'a'+10);}require(value<=127,"Non-ASCII material identifier is unsupported.");c=static_cast<char>(value);}
        }require(static_cast<unsigned char>(c)<=127&&c!=0,"Invalid material properties text.");out+=c;}return out;
    }
    static Selector selector(std::string_view token){
        require(token.size()<=512&&token.front()!='%',"Tag expansion is not available for this material map.");
        std::vector<std::string_view> parts;size_t start=0;for(size_t i=0;i<=token.size();++i)if(i==token.size()||token[i]==':'){require(i>start,"Empty material selector component.");parts.push_back(token.substr(start,i-start));start=i+1;}
        size_t state=1;std::string_view ns="minecraft",name=parts[0];if(parts.size()>1&&parts[1].find('=')==std::string_view::npos){ns=parts[0];name=parts[1];state=2;}
        require(ident(ns,false)&&ident(name,true),"Invalid material namespace/name.");Selector result;result.name=std::string(ns)+":"+std::string(name);
        for(size_t i=state;i<parts.size();++i){const auto eq=parts[i].find('=');require(eq!=std::string_view::npos&&eq&&eq+1<parts[i].size()&&parts[i].find('=',eq+1)==std::string_view::npos,"Invalid material property predicate.");
            const auto key=parts[i].substr(0,eq),value=parts[i].substr(eq+1);require(ident(key,false)&&ident(value,false),"Unsupported material property value (including comma lists).");
            auto prior=std::find_if(result.predicates.begin(),result.predicates.end(),[&](const auto& p){return p.key==key;});if(prior!=result.predicates.end())prior->value=value;else {require(result.predicates.size()<16,"Too many material predicates.");result.predicates.push_back({std::string(key),std::string(value)});}}
        return result;
    }
    int32_t concrete(const MinecraftBlockState& state,bool waterlogged,bool powered,bool snowy,std::string_view axis,MinecraftBlockKind kind)const{
        for(const auto& group:groups)for(const auto& s:group.selectors){if(s.name!=state.name)continue;bool match=true;
            for(const auto& p:s.predicates){
                // Pinned Iris ignores nonexistent reference properties. This is
                // different from an existing property whose VALUE is unknown.
                if(const auto value=state.property(p.key))match&=p.value==*value;
                else if(p.key=="waterlogged"&&(!state.type.empty()||!state.shape.empty()))match&=p.value==(waterlogged?"true":"false");
                else if(p.key=="powered"&&!state.hinge.empty())match&=p.value==(powered?"true":"false");
                else if(p.key=="axis"&&kind==MinecraftBlockKind::log)match&=p.value==axis;
                else if(p.key=="snowy"&&kind==MinecraftBlockKind::grass)match&=p.value==(snowy?"true":"false");
            }
            if(match)return group.id;
        }return -1;
    }
    PackBlockId partialFluid(const MinecraftBlockState& state)const{
        // Resolve all sixteen reference levels in one ordered pass, without
        // rescanning the selector table sixteen times or allocating a state list.
        uint32_t pending=0xffff;int32_t result=-1;bool assigned=false;
        for(const auto& group:groups)for(const auto& s:group.selectors){
            if(s.name!=state.name)continue;uint32_t matching=pending;
            for(const auto& p:s.predicates)if(p.key=="level"){
                uint32_t n=16;const auto [end,error]=std::from_chars(p.value.data(),p.value.data()+p.value.size(),n);
                matching&=error==std::errc{}&&end==p.value.data()+p.value.size()&&n<16&&MinecraftBlockState::fluidLevel(n)==p.value?1u<<n:0u;
            }
            if(!matching)continue;
            if(assigned&&result!=group.id)return {};
            assigned=true;result=group.id;pending&=~matching;if(!pending)return {result,true};
        }
        // Any still unmatched level resolves to known unassigned (-1).
        return assigned&&result!=-1?PackBlockId{}:PackBlockId{-1,true};
    }
public:
    BlockIdMap(const BlockIdMap&)=delete;BlockIdMap& operator=(const BlockIdMap&)=delete;
    static std::shared_ptr<const BlockIdMap> parsePreprocessed(std::string_view text){
        require(text.size()<=textLimit,"Material properties exceed 256 KiB.");
        auto result=std::shared_ptr<BlockIdMap>(new BlockIdMap);std::vector<std::pair<std::string,std::string>> properties;std::unordered_map<std::string,size_t> positions;
        std::string line;bool continued=false;size_t at=0;
        while(at<text.size()||continued){const auto end=text.find_first_of("\r\n",at),until=end==std::string_view::npos?text.size():end;auto part=text.substr(at,until-at);
            size_t trim=0;while(trim<part.size()&&white(part[trim]))++trim;part.remove_prefix(trim);
            if(!continued&&!part.empty()&&(part[0]=='#'||part[0]=='!')){
                if(part[0]=='#'){auto directive=part.substr(1);while(!directive.empty()&&white(directive[0]))directive.remove_prefix(1);const auto stop=directive.find_first_of(" \t(");const auto word=directive.substr(0,stop);
                    require(word!="if"&&word!="ifdef"&&word!="ifndef"&&word!="else"&&word!="elif"&&word!="endif"&&word!="define"&&word!="undef"&&word!="include"&&word!="error"&&word!="pragma","Material input still contains preprocessing directives.");}
                part={};
            }
            line.append(part);size_t slashes=0;for(size_t i=line.size();i&&line[i-1]=='\\';--i)++slashes;
            continued=slashes%2!=0;if(continued){line.pop_back();require(end!=std::string_view::npos,"Unterminated properties continuation.");}
            if(!continued&&!line.empty()){
                size_t split=0;bool escaped=false;for(;split<line.size();++split){const char c=line[split];if(!escaped&&(white(c)||c=='='||c==':'))break;if(c=='\\')escaped=!escaped;else escaped=false;}
                size_t value=split;while(value<line.size()&&white(line[value]))++value;if(value<line.size()&&(line[value]=='='||line[value]==':'))++value;while(value<line.size()&&white(line[value]))++value;
                const auto key=unescape(std::string_view(line).substr(0,split)),v=unescape(std::string_view(line).substr(value));
                const auto [it,inserted]=positions.emplace(key,properties.size());if(inserted){require(properties.size()<4096,"Too many material property keys.");properties.emplace_back(key,v);}else properties[it->second].second=v;line.clear();
            }
            if(end==std::string_view::npos)break;at=end+1;if(text[end]=='\r'&&at<text.size()&&text[at]=='\n')++at;
        }
        size_t storage=sizeof(BlockIdMap),selectors=0;std::unordered_map<int32_t,size_t> ids;
        for(const auto& [key,value]:properties){require(!key.starts_with("layer."),"Material render-layer overrides are not implemented.");if(!key.starts_with("block."))continue;
            auto number=std::string_view(key).substr(6);if(!number.empty()&&number.front()=='+'){number.remove_prefix(1);require(!number.empty()&&number.front()!='-',"Invalid signed material ID.");}int32_t id=0;const auto parsed=std::from_chars(number.data(),number.data()+number.size(),id);
            require(!number.empty()&&parsed.ec==std::errc{}&&parsed.ptr==number.data()+number.size()&&id>=-1&&id<=2147483646,"Unsupported material ID (expected -1..2147483646).");
            Group group{id,{}};size_t i=0;while(i<value.size()){while(i<value.size()&&(white(value[i])||value[i]=='\r'||value[i]=='\n'))++i;if(i==value.size())break;const auto start=i;while(i<value.size()&&!white(value[i])&&value[i]!='\r'&&value[i]!='\n')++i;
                require(++selectors<=selectorLimit,"Too many material selectors.");auto s=selector(std::string_view(value).substr(start,i-start));storage+=2*sizeof(Selector)+s.name.capacity()+1;
                for(const auto& p:s.predicates)storage+=2*sizeof(Predicate)+p.key.capacity()+p.value.capacity()+2;
                require(storage<=storageLimit,"Material map exceeds its 1 MiB storage budget.");group.selectors.push_back(std::move(s));}
            const auto [it,inserted]=ids.emplace(id,result->groups.size());if(inserted){storage+=2*sizeof(Group);require(storage<=storageLimit,"Material map exceeds its storage budget.");result->groups.push_back(std::move(group));}else result->groups[it->second]=std::move(group);
        }
        return result;
    }
    PackBlockId resolve(const MinecraftBlockState& state)const{
        if(!state.known())return {};
        const auto rule=std::find_if(std::begin(minecraftBlockRules),std::end(minecraftBlockRules),[&](const auto& r){return r.name==state.name;});
        if(rule==std::end(minecraftBlockRules))return {};
        const bool facing=state.facing=="north"||state.facing=="west"||state.facing=="south"||state.facing=="east";
        const bool door=rule->kind==MinecraftBlockKind::door_lower||rule->kind==MinecraftBlockKind::door_upper;
        const bool stairs=rule->kind==MinecraftBlockKind::stairs,slab=rule->kind==MinecraftBlockKind::slab;
        const bool log=rule->kind==MinecraftBlockKind::log,grass=rule->kind==MinecraftBlockKind::grass;
        if(rule->kind==MinecraftBlockKind::fluid){
            if(!state.type.empty()||state.waterlogged.has_value()||!state.facing.empty()||!state.half.empty()||!state.shape.empty()||!state.hinge.empty()||state.opened.has_value()||state.powered.has_value()||!state.axis.empty()||state.snowy.has_value()||state.complete!=state.level.has_value()||(state.level.has_value()&&*state.level>=16))return {};
            if(state.complete)return {concrete(state,false,false,false,{},rule->kind),true};
            // Bloxd's static cell does not prove Minecraft level=0. Every one
            // of the reference's sixteen block levels must agree in order.
            return partialFluid(state);
        }
        if(state.level.has_value())return {};
        if(log||grass){
            if(!state.type.empty()||state.waterlogged.has_value()||!state.facing.empty()||!state.half.empty()||!state.shape.empty()||!state.hinge.empty()||state.opened.has_value()||state.powered.has_value())return {};
            if(log){if(state.snowy.has_value()||(!state.axis.empty()&&state.axis!="x"&&state.axis!="y"&&state.axis!="z")||state.complete!=!state.axis.empty())return {};}
            else if(!state.axis.empty()||state.complete!=state.snowy.has_value())return {};
        }else{
            if(!state.axis.empty()||state.snowy.has_value())return {};
            if(door){
                if(!facing||(state.half!="lower"&&state.half!="upper")||(state.hinge!="left"&&state.hinge!="right")||!state.opened.has_value()||
                    state.complete!=state.powered.has_value()||!state.type.empty()||!state.shape.empty()||state.waterlogged.has_value())return {};
            }else{
                if(!state.hinge.empty()||state.opened.has_value()||state.powered.has_value())return {};
                if(stairs){if(!facing||(state.half!="bottom"&&state.half!="top")||!state.type.empty()||
                    (state.shape!="straight"&&state.shape!="inner_left"&&state.shape!="inner_right"&&state.shape!="outer_left"&&state.shape!="outer_right"))return {};
                }else if(!state.facing.empty()||!state.half.empty()||!state.shape.empty())return {};
                if(slab||stairs){if(state.complete!=state.waterlogged.has_value()||(slab&&state.type!="bottom"&&state.type!="top"))return {};
                }else if(!state.complete||!state.type.empty()||state.waterlogged.has_value())return {};
            }
        }
        // One missing reference property per supported partial kind. First-match
        // resolution must agree over all three axes or both boolean values.
        const auto a=concrete(state,false,false,false,"x",rule->kind);if(state.complete)return {a,true};
        const auto b=concrete(state,(slab||stairs)&&!state.waterlogged.has_value(),door&&!state.powered.has_value(),grass,"y",rule->kind);
        if(log&&a!=concrete(state,false,false,false,"z",rule->kind))return {};
        return a==b?PackBlockId{a,true}:PackBlockId{};
    }
private:
    BlockIdMap()=default;
};
}
