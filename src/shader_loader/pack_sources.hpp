#pragma once
#include <algorithm>
#include <cstdint>
#include <memory>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>

namespace bridge::shaderloader {
// Internal immutable text snapshot, NOT a BND1 packet or source-frame proof.
// ZIP/OS access belongs to the explicit Node pack reader, never this decoder.
class PackSources {
    std::unordered_map<std::string,std::string> files;
    std::vector<std::string> paths;
    static void check(bool yes,const char* message){if(!yes)throw std::runtime_error(message);}
    static std::string folded(std::string_view name){std::string out(name);for(auto& c:out)if(c>='A'&&c<='Z')c=char(c+32);return out;}
public:
    static constexpr size_t countLimit=4096,textLimit=1024*1024,totalLimit=16*1024*1024,snapshotLimit=20*1024*1024;
    static void path(std::string_view name){
        check(!name.empty()&&name.size()<=512&&name.front()!='/'&&name.back()!='/',"Invalid pack source path length.");
        check(std::all_of(name.begin(),name.end(),[](char c){return c>='a'&&c<='z'||c>='A'&&c<='Z'||c>='0'&&c<='9'||c=='_'||c=='-'||c=='.'||c=='/';}),"Unsupported pack source path character.");
        size_t at=0,depth=0;while(at<name.size()){const auto end=name.find('/',at);const auto part=name.substr(at,end==name.npos?name.size()-at:end-at);const auto low=folded(part),base=low.substr(0,low.find('.'));
            check(!part.empty()&&part!="."&&part!=".."&&part.back()!='.'&&++depth<=32,"Noncanonical pack source path.");
            check(base!="con"&&base!="prn"&&base!="aux"&&base!="nul"&&!(base.size()==4&&(base.starts_with("com")||base.starts_with("lpt"))&&base[3]>='1'&&base[3]<='9'),"Aliased device source path.");
            if(end==name.npos)break;at=end+1;
        }
    }
    static void text(std::string_view value){
        check(value.size()<=textLimit,"Pack source exceeds 1 MiB.");
        for(size_t i=0;i<value.size();){const auto c=static_cast<uint8_t>(value[i++]);if(c<128){check(c=='\n'||c=='\r'||c=='\t'||c>=32&&c!=127,"Invalid source control byte.");continue;}
            unsigned n=0;uint32_t code=0,min=0;if(c>=0xc2&&c<=0xdf){n=1;code=c&31;min=0x80;}else if(c>=0xe0&&c<=0xef){n=2;code=c&15;min=0x800;}else if(c>=0xf0&&c<=0xf4){n=3;code=c&7;min=0x10000;}else check(false,"Invalid UTF-8 pack source.");
            check(i+n<=value.size(),"Truncated UTF-8 pack source.");while(n--){const auto b=static_cast<uint8_t>(value[i++]);check((b&0xc0)==0x80,"Invalid UTF-8 continuation.");code=code*64+(b&63);}check(code>=min&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff),"Invalid UTF-8 scalar.");
        }
        check(!value.starts_with("\xef\xbb\xbf"),"Snapshot source BOM must be normalized by the reader.");
    }
    static std::shared_ptr<const PackSources> create(std::vector<std::pair<std::string,std::string>> values){
        check(values.size()<=countLimit,"Pack source count limit.");auto result=std::shared_ptr<PackSources>(new PackSources);size_t total=0;std::unordered_map<std::string,std::pair<std::string,bool>> tree;
        for(auto& [name,value]:values){path(name);text(value);total+=value.size();check(total<=totalLimit,"Pack text total exceeds 16 MiB.");
            for(size_t at=0;;){const auto end=name.find('/',at);const bool directory=end!=name.npos;const auto prefix=name.substr(0,directory?end:name.size()),key=folded(prefix);const auto [it,inserted]=tree.emplace(key,std::pair{prefix,directory});check(tree.size()<=16384,"Pack virtual directory limit.");check(inserted||directory&&it->second.second&&it->second.first==prefix,"Duplicate, case-aliased or file-parent pack source.");if(!directory)break;at=end+1;}
            check(!result->files.contains(name),"Duplicate pack source.");result->paths.push_back(name);result->files.emplace(std::move(name),std::move(value));
        }std::sort(result->paths.begin(),result->paths.end());return result;
    }
    static std::shared_ptr<const PackSources> decode(std::span<const uint8_t> bytes){
        check(bytes.size()>=8&&bytes.size()<=snapshotLimit,"Invalid pack text snapshot size.");size_t at=0;
        const auto word=[&](){check(at+4<=bytes.size(),"Truncated pack snapshot word.");uint32_t n=0;for(unsigned k=0;k<4;++k)n|=uint32_t(bytes[at++])<<(k*8);return n;};
        check(word()==0x314b5053,"Invalid pack snapshot magic.");const auto count=word();check(count<=countLimit,"Pack snapshot count limit.");std::vector<std::pair<std::string,std::string>> values;values.reserve(count);size_t total=0;
        for(uint32_t i=0;i<count;++i){const auto pathSize=word(),textSize=word();check(pathSize&&pathSize<=512&&textSize<=textLimit,"Pack snapshot field limit.");total+=textSize;check(total<=totalLimit&&pathSize+size_t(textSize)<=bytes.size()-at,"Truncated or oversized pack snapshot data.");std::string name(reinterpret_cast<const char*>(bytes.data()+at),pathSize);at+=pathSize;std::string value(reinterpret_cast<const char*>(bytes.data()+at),textSize);at+=textSize;values.emplace_back(std::move(name),std::move(value));}
        check(at==bytes.size(),"Trailing pack snapshot data.");return create(std::move(values));
    }
    bool contains(std::string_view name)const{return files.contains(std::string(name));}
    std::string_view read(std::string_view name)const{path(name);const auto it=files.find(std::string(name));if(it==files.end())throw std::runtime_error("Missing pack source: "+std::string(name));return it->second;}
    const std::vector<std::string>& names()const{return paths;}
};
}
