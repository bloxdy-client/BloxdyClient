#pragma once
#include "pack_sources.hpp"
#include <optional>

namespace bridge::shaderloader {
struct IncludeDependency {std::string from,to;size_t line;};
struct ExpandedShader {std::string text;std::vector<std::string> sourcePaths;std::vector<IncludeDependency> dependencies;};

// Resolve a bounded virtual include graph before GLSL condition evaluation, as
// Iris does. No disk fallback, include guard elision, macro guessing or GL calls.
class IncludeResolver {
    const PackSources& sources;ExpandedShader result;std::vector<std::string> stack;size_t visits=0;
    static constexpr size_t outputLimit=8*1024*1024,visitLimit=8192;
    [[noreturn]] void fail(std::string_view file,size_t line,std::string_view message)const{throw std::runtime_error("pack:"+std::string(file)+":"+std::to_string(line)+": "+std::string(message));}
    static std::string_view trim(std::string_view text){while(!text.empty()&&(text.front()==' '||text.front()=='\t'))text.remove_prefix(1);while(!text.empty()&&(text.back()==' '||text.back()=='\t'))text.remove_suffix(1);return text;}
    void append(std::string_view text){if(text.size()>outputLimit-result.text.size())throw std::runtime_error("Expanded shader exceeds 8 MiB.");result.text.append(text);}
    size_t id(const std::string& name){const auto it=std::find(result.sourcePaths.begin(),result.sourcePaths.end(),name);if(it!=result.sourcePaths.end())return size_t(it-result.sourcePaths.begin());result.sourcePaths.push_back(name);return result.sourcePaths.size()-1;}
    void marker(size_t line,size_t file){append("#line "+std::to_string(line)+" "+std::to_string(file)+"\n");}
    static std::string visible(std::string_view line,bool& block){
        std::string out;char quote=0;for(size_t i=0;i<line.size();){
            if(block){const auto end=line.find("*/",i);if(end==line.npos)break;i=end+2;block=false;out+=' ';continue;}
            if(quote){const char c=line[i++];out+=c;if(c=='\\'&&i<line.size())out+=line[i++];else if(c==quote)quote=0;continue;}
            if(line.substr(i,2)=="//")break;if(line.substr(i,2)=="/*"){block=true;i+=2;out+=' ';continue;}
            const char c=line[i++];out+=c;if(c=='\"'||c=='\'')quote=c;
        }return out;
    }
    static bool directive(std::string_view line,std::string_view command){return line.starts_with(command)&&(line.size()==command.size()||line[command.size()]==' '||line[command.size()]=='\t');}
    std::string target(std::string_view parent,std::string_view value,size_t line){
        if(value.empty()||value.size()>512||value.find_first_of("\\:\"<>\r\n\t ")!=value.npos)fail(parent,line,"Invalid include path.");
        std::vector<std::string> parts;
        const auto consume=[&](std::string_view path){size_t at=0;while(at<path.size()){const auto end=path.find('/',at);const auto part=path.substr(at,end==path.npos?path.size()-at:end-at);if(part==".."){if(parts.empty())fail(parent,line,"Include escapes shaders root.");parts.pop_back();}else if(part!="."){if(part.empty())fail(parent,line,"Empty include path component.");parts.emplace_back(part);}if(end==path.npos)break;at=end+1;}};
        if(value.front()!='/'){const auto slash=parent.rfind('/');if(slash!=parent.npos)consume(parent.substr(0,slash));}else value.remove_prefix(1);
        if(value.empty()||value.back()=='/')fail(parent,line,"Include does not name a file.");consume(value);std::string name;for(const auto& part:parts){if(!name.empty())name+='/';name+=part;}PackSources::path(name);return name;
    }
    void visit(const std::string& name,bool root){
        if(++visits>visitLimit||stack.size()>=32)fail(name,0,"Include visit/depth limit.");
        if(std::find(stack.begin(),stack.end(),name)!=stack.end())fail(name,0,"Include cycle detected before conditional preprocessing.");
        if(!sources.contains(name))fail(name,0,"Missing include source.");const auto source=sources.read(name);const auto fileId=id(name);stack.push_back(name);
        bool block=false,sawCode=false,sawVersion=false,continued=false;size_t number=0;
        // A root #version must remain the first directive/code. Source mapping
        // starts after it; versionless fragments start with their own marker.
        bool mapped=!root;if(!root)marker(1,fileId);
        for(size_t at=0;at<source.size();){++number;const auto end=source.find_first_of("\r\n",at),until=end==source.npos?source.size():end;const auto raw=source.substr(at,until-at),physical=trim(raw);size_t next=until;if(end!=source.npos){next=end+1;if(source[end]=='\r'&&next<source.size()&&source[next]=='\n')++next;}at=next;
            const bool startedBlock=block;const auto content=visible(raw,block);const auto line=trim(content);
            if(physical.starts_with("#include")&&(startedBlock||!line.starts_with("#include")))fail(name,number,"Includes inside block comments are unsupported.");
            if(line.starts_with("#include")){
                if(!directive(physical,"#include")||block||continued)fail(name,number,"Malformed, continued or comment-spanning include directive.");
                auto path=trim(physical.substr(8));if(path.size()<2||path.front()!='\"'||path.back()!='\"'||path.substr(1,path.size()-2).find('\"')!=path.npos)fail(name,number,"Only a complete quoted include path is supported.");
                const auto child=target(name,path.substr(1,path.size()-2),number);if(!sources.contains(child))fail(name,number,"Missing include: "+child);
                if(std::find(stack.begin(),stack.end(),child)!=stack.end())fail(name,number,"Include cycle through "+child);
                if(!mapped){marker(number,fileId);mapped=true;}sawCode=true;result.dependencies.push_back({name,child,number});visit(child,false);marker(number+1,fileId);continue;
            }
            if(line.starts_with("#line"))fail(name,number,"Authored #line directives are unsupported.");
            if(line.starts_with("#version")){
                if(!root||sawCode||sawVersion||!directive(line,"#version"))fail(name,number,"Misplaced, duplicate or included #version.");
                sawVersion=true;sawCode=true;append(raw);append("\n");marker(number+1,fileId);mapped=true;continue;
            }
            if(!line.empty()){if(!mapped){marker(number,fileId);mapped=true;}sawCode=true;}
            size_t slashes=0;for(size_t i=raw.size();i&&raw[i-1]=='\\';--i)++slashes;continued=slashes%2!=0;append(raw);append("\n");
        }
        if(block||continued)fail(name,number,"Unterminated comment or line continuation.");stack.pop_back();
    }
    explicit IncludeResolver(const PackSources& source):sources(source){}
public:
    static ExpandedShader expand(const PackSources& sources,std::string_view root){PackSources::path(root);IncludeResolver resolver(sources);resolver.visit(std::string(root),true);return std::move(resolver.result);}
};
}
