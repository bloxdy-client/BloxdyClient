#pragma once
#include "glsl_preprocessor.hpp"
#include <charconv>
#include <set>

namespace bridge::shaderloader {
enum class PackShaderStage {Vertex,Fragment};
struct ShaderVariable {std::string name,type;bool operator==(const ShaderVariable&)const=default;};
struct TranslatedShader {
    std::string text;std::vector<std::string> sourcePaths;PackShaderStage stage;
    std::vector<ShaderVariable> attributes,varyings,uniforms;
    // Shader output LOCATIONS, never inferred colortex/attachment/semantic IDs.
    std::vector<uint32_t> outputLocations;std::vector<GlslExtension> requestedExtensions;size_t textureCalls=0;
    uint32_t sourceVersion=120,targetVersion=330;
};
struct TranslatedShaderPair {TranslatedShader vertex,fragment;};

// A deliberately small structural translator, not a general GLSL AST/parser.
// Accepts explicit GLSL 120 interfaces only; unresolved fixed-function/Minecraft
// data, structs, interface arrays and ambiguous names fail closed. A literal
// ARB_shader_texture_lod enable/require request is retained, never a capability.
class GlslTranslation {
    static constexpr size_t bytesLimit=8*1024*1024,tokensLimit=131072;
    struct Token {std::string text;size_t begin,end,source,line;bool identifier;};
    struct Edit {size_t begin,end;std::string value;};
    std::vector<Token> tokens;std::vector<size_t> close;std::vector<bool> inBody;
    std::vector<Edit> edits;TranslatedShader out;const PreprocessedGlsl& input;
    static bool first(char c){return c>='a'&&c<='z'||c>='A'&&c<='Z'||c=='_';}
    static bool rest(char c){return first(c)||c>='0'&&c<='9';}
    [[noreturn]] void fail(size_t i,std::string_view message)const{
        const auto* t=i<tokens.size()?&tokens[i]:nullptr;
        throw std::runtime_error("pack:"+input.sourcePaths[t?t->source:0]+":"+std::to_string(t?t->line:1)+": "+std::string(message));
    }
    void require(bool value,size_t i,std::string_view message)const{if(!value)fail(i,message);}
    static bool type(std::string_view t){
        for(const auto name:{"float","vec2","vec3","vec4","mat2","mat3","mat4","int","ivec2","ivec3","ivec4","bool","bvec2","bvec3","bvec4","sampler2D","sampler3D","samplerCube"})if(t==name)return true;return false;
    }
    static bool interfaceType(std::string_view t){return t=="float"||t=="vec2"||t=="vec3"||t=="vec4"||t=="mat2"||t=="mat3"||t=="mat4";}
    static std::string_view texture(std::string_view name){
        if(name=="texture2D"||name=="texture3D")return "texture";
        if(name=="texture2DProj"||name=="texture3DProj")return "textureProj";
        if(name=="texture2DLod"||name=="texture3DLod")return "textureLod";
        return {};
    }
    uint32_t number(std::string_view s,size_t i)const{
        uint32_t n=0;const auto [end,error]=std::from_chars(s.data(),s.data()+s.size(),n);
        require(error==std::errc{}&&end==s.data()+s.size()&&s==std::to_string(n),i,"Expected canonical unsigned translation operand.");return n;
    }
    void tokenize(){
        size_t source=0,line=1,extensions=0;std::vector<size_t> stack;bool version=false;
        for(size_t at=0;at<input.text.size();){
            const auto end=input.text.find('\n',at),until=end==std::string::npos?input.text.size():end;
            const auto text=std::string_view(input.text).substr(at,until-at);
            if(text.starts_with("#")){
                if(text=="#version 120"){require(!version&&at==0,0,"Translation requires a leading literal GLSL 120 version.");version=true;}
                else if(text.starts_with("#extension ")){
                    require(version&&extensions<input.extensions.size(),0,"Unexpected translation extension directive.");const auto& e=input.extensions[extensions++];require(text=="#extension "+e.name+" : "+e.behavior,0,"Translation extension metadata differs from source.");
                }else if(text.starts_with("#line ")){
                    const auto tail=text.substr(6);const auto space=tail.find(' ');require(version&&space!=tail.npos,0,"Invalid translation source-map directive.");
                    const auto next=number(tail.substr(0,space),0),id=number(tail.substr(space+1),0);require(next>0&&next<=bytesLimit+1&&id<input.sourcePaths.size(),0,"Invalid translation source-map location.");source=id;line=next;
                    at=end==input.text.npos?until:end+1;continue;
                }else {bool pragma=false;for(const auto allowed:{"#pragma optimize ( on )","#pragma optimize ( off )","#pragma debug ( on )","#pragma debug ( off )","#pragma STDGL invariant ( all )"})pragma|=text==allowed;require(version&&pragma,0,"Unresolved/unsupported translation directive.");}
            }else for(size_t p=0;p<text.size();){
                const char c=text[p];if(c==' '||c=='\t'||c=='\r'){++p;continue;}
                const auto begin=p++;const bool id=first(c);
                if(id)while(p<text.size()&&rest(text[p]))++p;
                else if(c>='0'&&c<='9'||c=='.'&&p<text.size()&&text[p]>='0'&&text[p]<='9')while(p<text.size()&&(rest(text[p])||text[p]=='.'||(text[p]=='+'||text[p]=='-')&&std::string_view("eEpP").find(text[p-1])!=std::string_view::npos))++p;
                else require(c>=32&&c<127&&c!='#'&&c!='\\'&&c!='\''&&c!='"'&&!(c=='/'&&p<text.size()&&(text[p]=='/'||text[p]=='*')),tokens.size(),"Unsupported translation token/literal/comment.");
                require(tokens.size()<tokensLimit,tokens.size(),"Translation token count limit.");
                tokens.push_back({std::string(text.substr(begin,p-begin)),at+begin,at+p,source,line,id});close.push_back(SIZE_MAX);
                const auto i=tokens.size()-1;const auto& t=tokens.back().text;
                if(t=="("||t=="["||t=="{"){require(stack.size()<64,i,"Translation nesting limit.");stack.push_back(i);}
                else if(t==")"||t=="]"||t=="}"){
                    require(!stack.empty(),i,"Unmatched translation delimiter.");const auto open=stack.back();const auto& v=tokens[open].text;
                    require((v=="("&&t==")")||(v=="["&&t=="]")||(v=="{"&&t=="}"),i,"Mismatched translation delimiter.");close[open]=i;stack.pop_back();
                }
            }
            ++line;at=end==input.text.npos?until:end+1;
        }
        require(version&&stack.empty()&&extensions==input.extensions.size(),0,"Missing version/extension or unclosed translation delimiter.");inBody.resize(tokens.size(),false);
    }
    void declarations(){
        std::unordered_set<std::string> variables,functions;size_t mains=0,functionCount=0;
        for(size_t i=0;i<tokens.size();){
            const auto start=i;std::string storage;
            if(tokens[i].text=="attribute"||tokens[i].text=="varying"||tokens[i].text=="uniform"||tokens[i].text=="const")storage=tokens[i++].text;
            require(i+1<tokens.size()&&(type(tokens[i].text)||tokens[i].text=="void"),i,"Unsupported global declaration/type.");const auto valueType=tokens[i++].text;const auto nameAt=i;const auto name=tokens[i++].text;
            require(tokens[nameAt].identifier&&!name.starts_with("gl_")&&!type(name),nameAt,"Invalid/reserved declared name.");
            if(i<tokens.size()&&tokens[i].text=="("){
                require(storage.empty()&&texture(name).empty()&&!variables.contains(name)&&++functionCount<=1024,nameAt,"Unsupported/ambiguous function declaration.");functions.insert(name);
                const auto end=close[i];require(end!=SIZE_MAX,end,"Missing function parameter list.");
                // Parameters are simple typed scalars/vectors/matrices/samplers;
                // no arrays, user-defined types, structs or interface blocks.
                size_t p=i+1;bool empty=p==end||(p+1==end&&tokens[p].text=="void");
                if(!empty)for(;;){
                    if(p<end&&tokens[p].text=="const")++p;
                    if(p<end&&(tokens[p].text=="in"||tokens[p].text=="out"||tokens[p].text=="inout"))++p;
                    require(p<end&&type(tokens[p].text),p,"Unsupported function parameter type.");++p;
                    require(p<end&&tokens[p].identifier&&!tokens[p].text.starts_with("gl_")&&!type(tokens[p].text),p,"Unnamed/reserved function parameter.");++p;
                    if(p==end)break;require(tokens[p++].text==","&&p<end,p,"Unsupported function parameter syntax.");
                }
                i=end+1;require(i<tokens.size(),i,"Missing function body/prototype terminator.");
                if(tokens[i].text==";"){++i;continue;}
                require(tokens[i].text=="{"&&close[i]!=SIZE_MAX,i,"Unsupported function body.");const auto bodyEnd=close[i];
                std::fill(inBody.begin()+i+1,inBody.begin()+bodyEnd,true);
                if(name=="main"){require(valueType=="void"&&empty,i,"Invalid main signature.");++mains;}
                i=bodyEnd+1;continue;
            }
            require(valueType!="void"&&variables.size()<1024&&!functions.contains(name)&&variables.insert(name).second,nameAt,"Duplicate/invalid global variable.");
            if(storage=="attribute"||storage=="varying"||storage=="uniform"){
                require(i<tokens.size()&&tokens[i].text==";",i,"Only individual non-array interface declarations are supported.");
                auto& list=storage=="attribute"?out.attributes:storage=="varying"?out.varyings:out.uniforms;
                require(list.size()<256,i,"Shader interface declaration limit.");list.push_back({name,valueType});
                if(storage!="uniform"){
                    require(interfaceType(valueType)&&(storage!="attribute"||out.stage==PackShaderStage::Vertex),start,"Unsupported interface type/stage.");
                    edits.push_back({tokens[start].begin,tokens[start].end,storage=="attribute"||out.stage==PackShaderStage::Fragment?"in":"out"});
                }
                ++i;
            }else {
                require(i<tokens.size()&&(tokens[i].text==";"||tokens[i].text=="="),i,"Unsupported global variable syntax.");
                // Preserve an initializer verbatim. GLSL compilation remains a
                // separate mandatory gate; no expression type inference here.
                for(;i<tokens.size()&&tokens[i].text!=";";++i){require(tokens[i].text!="{"&&tokens[i].text!=","&&tokens[i].text!="[",i,"Unsupported global initializer/array.");if(tokens[i].text=="(")i=close[i];}
                require(i<tokens.size(),i,"Unterminated global declaration.");++i;
            }
        }
        require(mains==1,0,"Translation requires exactly one main definition.");
    }
    void references(){
        std::set<uint32_t> locations;bool fragColor=false,fragData=false;bool renamedTexture=false;
        for(size_t i=0;i<tokens.size();++i){const auto& t=tokens[i];if(!t.identifier)continue;
            require(!t.text.starts_with("bloxdy_legacy_"),i,"Reserved generated translation name.");
            for(const auto unknown:{"mc_Entity","vaUV1","vaUV2","mc_midTexCoord","at_tangent","at_midBlock"})require(t.text!=unknown,i,"Minecraft semantic input is outside this translation contract.");
            for(const auto unsupported:{"struct","layout","attribute","varying","invariant","centroid","flat","smooth","noperspective","precision","highp","mediump","lowp"})if(t.text==unsupported)require(!inBody[i]&&(t.text=="attribute"||t.text=="varying"),i,"Unsupported translation grammar/qualifier.");
            const auto renamed=texture(t.text);
            if(!renamed.empty()){
                require(inBody[i]&&i+1<tokens.size()&&tokens[i+1].text=="("&&(i==0||tokens[i-1].text!="."),i,"Ambiguous legacy texture function reference.");
                edits.push_back({t.begin,t.end,std::string(renamed)});++out.textureCalls;renamedTexture=true;
            }else if(t.text.starts_with("texture")&&inBody[i]&&i+1<tokens.size()&&tokens[i+1].text=="(")fail(i,"Unsupported texture function translation.");
            if(!t.text.starts_with("gl_"))continue;
            require(inBody[i]&&(i==0||tokens[i-1].text!="."&&!type(tokens[i-1].text)),i,"Reserved built-in outside an unambiguous function reference.");
            if(t.text=="gl_FragColor"||t.text=="gl_FragData"){
                require(out.stage==PackShaderStage::Fragment,i,"Fragment output used in vertex stage.");uint32_t location=0;auto until=t.end;
                if(t.text=="gl_FragData"){
                    fragData=true;require(i+3<tokens.size()&&tokens[i+1].text=="["&&tokens[i+3].text=="]"&&close[i+1]==i+3,i,"Fragment output requires a single literal index.");location=number(tokens[i+2].text,i+2);
                    require(location<8&&input.text.substr(t.end,tokens[i+3].end-t.end).find_first_of("\r\n#")==std::string::npos,i,"Unsupported output location/index span.");until=tokens[i+3].end;
                }else fragColor=true;
                require(!fragColor||!fragData,i,"Mixed gl_FragColor/gl_FragData is unsupported.");locations.insert(location);edits.push_back({t.begin,until,"bloxdy_legacy_out"+std::to_string(location)});if(t.text=="gl_FragData")i+=3;
            }else {
                const bool allowed=out.stage==PackShaderStage::Vertex?(t.text=="gl_Position"||t.text=="gl_PointSize"):(t.text=="gl_FragCoord"||t.text=="gl_FrontFacing"||t.text=="gl_FragDepth"||t.text=="gl_PointCoord");
                require(allowed,i,"Unresolved compatibility/Minecraft built-in; no source fallback is allowed.");
            }
        }
        if(renamedTexture)for(size_t i=0;i<tokens.size();++i)require(tokens[i].text!="texture"&&tokens[i].text!="textureProj"&&tokens[i].text!="textureLod",i,"Core texture name collides with source identifiers.");
        out.outputLocations.assign(locations.begin(),locations.end());
    }
    explicit GlslTranslation(const PreprocessedGlsl& value,PackShaderStage stage):input(value){out.stage=stage;out.sourcePaths=value.sourcePaths;out.requestedExtensions=value.extensions;}
public:
    static TranslatedShader translate(const PreprocessedGlsl& value,PackShaderStage stage){
        if(value.sourcePaths.empty())throw std::runtime_error("Missing translation source map.");GlslTranslation p(value,stage);
        p.require(stage==PackShaderStage::Vertex||stage==PackShaderStage::Fragment,0,"Unsupported translation stage.");
        p.require(value.version==120&&value.profile.empty()&&value.extensions.size()<=256&&value.text.size()<=bytesLimit&&value.sourcePaths.size()<=4096,0,"Translation requires explicit bounded GLSL 120.");
        std::string sourceHeader="#version 120\n";for(const auto& e:value.extensions){p.require(e.name=="GL_ARB_shader_texture_lod"&&(e.behavior=="enable"||e.behavior=="require"),0,"Unsupported translation extension request.");sourceHeader+="#extension "+e.name+" : "+e.behavior+"\n";}
        const auto declarationAt=sourceHeader.size();sourceHeader+="#line 1 0\n";p.require(value.text.starts_with(sourceHeader),0,"Translation requires the canonical prepared header/source map.");
        std::unordered_set<std::string> names;for(const auto& path:value.sourcePaths){PackSources::path(path);p.require(names.insert(path).second,0,"Duplicate translation source path.");}
        p.tokenize();p.declarations();p.references();
        std::string declarations;for(const auto n:p.out.outputLocations)declarations+="layout(location="+std::to_string(n)+") out vec4 bloxdy_legacy_out"+std::to_string(n)+";\n";
        p.edits.push_back({0,std::string_view("#version 120\n").size(),"#version 330 core\n"});p.edits.push_back({declarationAt,declarationAt,std::move(declarations)});std::sort(p.edits.begin(),p.edits.end(),[](const auto& a,const auto& b){return a.begin<b.begin;});
        size_t at=0;auto append=[&](std::string_view s){p.require(s.size()<=bytesLimit-p.out.text.size(),0,"Translated GLSL output limit.");p.out.text.append(s);};
        for(const auto& e:p.edits){p.require(e.begin>=at&&e.end>=e.begin&&e.end<=value.text.size(),0,"Overlapping translation edits.");append(std::string_view(value.text).substr(at,e.begin-at));append(e.value);at=e.end;}append(std::string_view(value.text).substr(at));return std::move(p.out);
    }
    static TranslatedShaderPair preparePair(const PackSources& files,std::string_view vertex,std::string_view fragment,const std::vector<PropertyMacro>& context){
        const auto v=preparePackShader(files,vertex,context),f=preparePackShader(files,fragment,context);
        auto tv=translate(v.glsl,PackShaderStage::Vertex),tf=translate(f.glsl,PackShaderStage::Fragment);
        for(const auto& in:tf.varyings){const auto it=std::find_if(tv.varyings.begin(),tv.varyings.end(),[&](const auto& x){return x.name==in.name;});if(it==tv.varyings.end()||it->type!=in.type)throw std::runtime_error("Missing/mistyped vertex-to-fragment varying: "+in.name);}
        for(const auto& u:tv.uniforms)for(const auto& other:tf.uniforms)if(u.name==other.name&&u.type!=other.type)throw std::runtime_error("Conflicting cross-stage uniform: "+u.name);
        return {std::move(tv),std::move(tf)};
    }
};
}
