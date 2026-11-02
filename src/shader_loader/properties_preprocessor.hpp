#pragma once
#include <charconv>
#include <cstdint>
#include <limits>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

namespace bridge::shaderloader {
// Explicit replacement facts only: nullopt means KNOWN undefined, empty text
// means an empty object macro. Boolean options use literal 1 or known undefined.
struct PropertyMacro {
    std::string name;std::optional<std::string> value;
    static PropertyMacro boolean(std::string name,bool enabled){return {std::move(name),enabled?std::optional<std::string>("1"):std::nullopt};}
};
struct PreparedProperties {std::string text;size_t directives=0,propertyLines=0;};

// Bounded properties preprocessing, not a GLSL preprocessor or filesystem loader.
// Explicit object macros expand in directives AND ordinary property tokens.
// Literal property identifiers which are not defined macros remain unchanged.
class PropertiesPreprocessor {
    static constexpr size_t textLimit=256*1024,macroLimit=256,macroBytes=64*1024;
    static constexpr size_t lineLimit=16*1024,expressionLimit=4096,tokenLimit=4096;
    std::unordered_map<std::string,std::optional<std::string>> macros;
    size_t stored=0,line=0,work=0;
    [[noreturn]] void fail(std::string_view message)const{throw std::runtime_error("block.properties line "+std::to_string(line)+": "+std::string(message));}
    void require(bool condition,std::string_view message)const{if(!condition)fail(message);}
    void charge(size_t n){require(n<=1024*1024-work,"Preprocessing work budget exceeded.");work+=n;}
    static bool space(char c){return c==' '||c=='\t'||c=='\f';}
    static std::string_view trim(std::string_view s){while(!s.empty()&&space(s.front()))s.remove_prefix(1);while(!s.empty()&&space(s.back()))s.remove_suffix(1);return s;}
    static bool first(char c){return c>='A'&&c<='Z'||c>='a'&&c<='z'||c=='_';}
    static bool rest(char c){return first(c)||c>='0'&&c<='9';}
    static bool name(std::string_view s){return !s.empty()&&first(s.front())&&s.find_first_not_of("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_0123456789")==s.npos;}
    static bool reserved(std::string_view s){return s=="defined"||s=="__FILE__"||s=="__LINE__"||s=="__COUNTER__"||s=="__DATE__"||s=="__TIME__"||s.starts_with("IRIS_PASSTHROUGH");}
    void set(std::string_view key,std::optional<std::string_view> value){
        require(name(key)&&!reserved(key),"Invalid or unsupported macro name.");
        require(key.size()<=128&&(!value||value->size()<=expressionLimit),"Macro text limit exceeded.");
        const auto found=macros.find(std::string(key));size_t previous=0;
        if(found!=macros.end())previous=found->first.size()+(found->second?found->second->size():0);
        else require(macros.size()<macroLimit,"Macro count limit exceeded.");
        const size_t next=stored-previous+key.size()+(value?value->size():0);require(next<=macroBytes,"Macro storage limit exceeded.");
        std::optional<std::string> copy;if(value)copy=std::string(*value);macros[std::string(key)]=std::move(copy);stored=next;
    }
    const std::optional<std::string>& lookup(std::string_view key)const{
        const auto it=macros.find(std::string(key));require(it!=macros.end(),"Unknown macro context: "+std::string(key));return it->second;
    }
    std::string uncomment(std::string_view s){
        std::string out;for(size_t i=0;i<s.size();){
            if(s.substr(i,2)=="//")break;
            if(s.substr(i,2)=="/*"){const auto end=s.find("*/",i+2);require(end!=s.npos,"Multiline directive comments are unsupported.");out+=' ';i=end+2;}
            else {require(s[i]!='\''&&s[i]!='\"'&&s[i]!='\\',"Quoted or continued directives are unsupported.");out+=s[i++];}
        }return out;
    }
    using Tokens=std::vector<std::string_view>;
    Tokens lex(std::string_view text){
        require(text.size()<=expressionLimit,"Expression text limit exceeded.");charge(text.size());Tokens result;
        for(size_t i=0;i<text.size();){
            if(space(text[i])){++i;continue;}const size_t begin=i++;
            if(first(text[begin])||text[begin]>='0'&&text[begin]<='9'){while(i<text.size()&&rest(text[i]))++i;}
            else if(text.substr(begin,2)=="&&"||text.substr(begin,2)=="||"||text.substr(begin,2)=="=="||text.substr(begin,2)=="!="||text.substr(begin,2)=="<="||text.substr(begin,2)==">=")++i;
            else require(std::string_view("()!<>+-").find(text[begin])!=std::string_view::npos,"Unsupported expression token/operator.");
            require(result.size()<tokenLimit,"Expression token limit exceeded.");result.push_back(text.substr(begin,i-begin));
        }return result;
    }
    void expand(std::string_view text,Tokens& out,std::vector<std::string_view>& stack){
        const auto tokens=lex(text);for(size_t i=0;i<tokens.size();++i){const auto token=tokens[i];charge(1);
            if(token=="defined"){
                require(stack.empty(),"Macro-generated defined operator is unsupported.");
                require(++i<tokens.size(),"Missing defined operand.");const bool paren=tokens[i]=="(";if(paren)require(++i<tokens.size(),"Missing defined operand.");
                const auto key=tokens[i];require(name(key),"Invalid defined operand.");const bool defined=lookup(key).has_value();
                if(paren)require(++i<tokens.size()&&tokens[i]==")","Missing defined closing parenthesis.");
                require(out.size()<tokenLimit,"Expanded token limit exceeded.");out.push_back(defined?"1":"0");
            }else if(first(token.front())){
                const auto& value=lookup(token);
                if(!value){require(out.size()<tokenLimit,"Expanded token limit exceeded.");out.push_back("0");}
                else {require(stack.size()<16,"Macro expansion depth exceeded.");for(const auto prior:stack)require(prior!=token,"Recursive macro expansion is unsupported.");stack.push_back(token);expand(*value,out,stack);stack.pop_back();}
            }else{require(out.size()<tokenLimit,"Expanded token limit exceeded.");out.push_back(token);}
        }
    }
    void expandProperty(std::string_view text,std::string& out,std::vector<std::string_view>& stack){
        charge(text.size());
        const auto append=[&](std::string_view part){require(part.size()<=textLimit-out.size(),"Preprocessed properties exceed 256 KiB.");out.append(part);};
        for(size_t i=0;i<text.size();){const size_t begin=i++;
            if(first(text[begin])){
                while(i<text.size()&&rest(text[i]))++i;
                if(i<text.size()&&text[i]=='\\'){while(i<text.size()&&(rest(text[i])||text[i]=='\\'))++i;append(text.substr(begin,i-begin));continue;}
                const auto token=text.substr(begin,i-begin);const auto found=macros.find(std::string(token));
                if(found==macros.end()||!found->second)append(token);
                else {require(stack.size()<16,"Property macro expansion depth exceeded.");for(const auto prior:stack)require(prior!=token,"Recursive property macro expansion is unsupported.");stack.push_back(token);expandProperty(*found->second,out,stack);stack.pop_back();}
            }else if(text[begin]=='\\'){
                // Iris protects every backslash before CPP lexing. Preserve the
                // following identifier too: a Unicode/property escape is not a
                // macro reference (even if its spelling happens to be defined).
                while(i<text.size()&&(rest(text[i])||text[i]=='\\'))++i;
                append(text.substr(begin,i-begin));
            }else if(text[begin]>='0'&&text[begin]<='9'||text[begin]=='.'&&i<text.size()&&text[i]>='0'&&text[i]<='9'){
                while(i<text.size()&&(rest(text[i])||text[i]=='.'||(text[i]=='+'||text[i]=='-')&&std::string_view("eEpP").find(text[i-1])!=std::string_view::npos))++i;
                append(text.substr(begin,i-begin));
            }else if(text[begin]=='\"'||text[begin]=='\''){
                const char quote=text[begin];bool closed=false;while(i<text.size()){require(text[i]!='\\',"Escaped property string literals are unsupported.");if(text[i++]==quote){closed=true;break;}}
                require(closed&&i<=text.size(),"Unterminated property string literal.");append(text.substr(begin,i-begin));
            }else if(text.substr(begin,2)=="//"){append(text.substr(begin));break;}
            else if(text.substr(begin,2)=="/*"){
                const auto end=text.find("*/",begin+2);require(end!=text.npos,"Multiline property comments are unsupported.");i=end+2;append(text.substr(begin,i-begin));
            }else {require(text[begin]!='#',"Hash/token-pasting inside a property is unsupported.");append(text.substr(begin,1));}
        }
    }
    struct Expression {
        PropertiesPreprocessor& owner;const Tokens& tokens;size_t at=0,depth=0;
        bool take(std::string_view s){if(at<tokens.size()&&tokens[at]==s){++at;return true;}return false;}
        int64_t primary(){
            owner.require(++depth<=32,"Expression nesting limit exceeded.");int64_t value;
            if(take("(")){value=logicalOr();owner.require(take(")"),"Missing expression closing parenthesis.");}
            else if(take("!"))value=!primary();
            else if(take("+"))value=primary();
            else if(take("-")){value=primary();owner.require(value!=std::numeric_limits<int64_t>::min(),"Integer negation overflow.");value=-value;}
            else {owner.require(at<tokens.size(),"Missing expression operand.");auto token=tokens[at++];int base=10;if(token.starts_with("0x")||token.starts_with("0X")){base=16;token.remove_prefix(2);}else if(token.size()>1&&token[0]=='0')base=8;
                uint64_t number=0;const auto [end,error]=std::from_chars(token.data(),token.data()+token.size(),number,base);
                owner.require(!token.empty()&&error==std::errc{}&&end==token.data()+token.size()&&number<=uint64_t(std::numeric_limits<int64_t>::max()),"Invalid or unsupported integer literal.");value=static_cast<int64_t>(number);
            }--depth;return value;
        }
        int64_t relational(){auto a=primary();for(;;){if(take("<")){const auto b=primary();a=a<b;}else if(take("<=")){const auto b=primary();a=a<=b;}else if(take(">")){const auto b=primary();a=a>b;}else if(take(">=")){const auto b=primary();a=a>=b;}else return a;}}
        int64_t equality(){auto a=relational();for(;;){if(take("==")){const auto b=relational();a=a==b;}else if(take("!=")){const auto b=relational();a=a!=b;}else return a;}}
        int64_t logicalAnd(){auto a=equality();while(take("&&")){const auto b=equality();a=bool(a)&&bool(b);}return a;}
        int64_t logicalOr(){auto a=logicalAnd();while(take("||")){const auto b=logicalAnd();a=bool(a)||bool(b);}return a;}
    };
    bool evaluate(std::string_view text){Tokens tokens;std::vector<std::string_view> stack;expand(text,tokens,stack);Expression e{*this,tokens};const auto value=e.logicalOr();require(e.at==tokens.size(),"Unsupported or trailing expression tokens.");return value!=0;}
public:
    static PreparedProperties prepare(std::string_view source,const std::vector<PropertyMacro>& context){
        PropertiesPreprocessor pp;pp.require(source.size()<=textLimit,"Property source exceeds 256 KiB.");
        pp.require(source.find("IRIS_PASSTHROUGH")==source.npos,"Reserved Iris implementation marker in source.");
        for(const auto c:source)pp.require(c=='\n'||c=='\r'||c=='\t'||c=='\f'||c>=32&&c<=126,"Unsupported property source encoding/control character.");
        pp.require(context.size()<=macroLimit,"Macro context count exceeded.");
        for(const auto& m:context){pp.require(!pp.macros.contains(m.name),"Duplicate macro context name.");if(m.value)for(const auto c:*m.value)pp.require((c=='\t'||c>=32&&c<=126)&&c!='\\'&&c!='\"'&&c!='\''&&c!='#',"Invalid or unsupported macro context text.");pp.set(m.name,m.value?std::optional<std::string_view>(*m.value):std::nullopt);}
        struct Branch {bool parent,taken,active,otherwise=false;};std::vector<Branch> branches;PreparedProperties result;bool continuation=false;
        const auto active=[&](){return branches.empty()||branches.back().active;};
        for(size_t at=0;at<source.size();){++pp.line;const auto end=source.find_first_of("\r\n",at),until=end==source.npos?source.size():end;const auto text=trim(source.substr(at,until-at));
            pp.require(text.size()<=lineLimit,"Property line limit exceeded.");if(end==source.npos)at=source.size();else{at=end+1;if(source[end]=='\r'&&at<source.size()&&source[at]=='\n')++at;}
            if(text.empty())continue;
            if(text.front()!='#'){
                if(active()){const auto begin=result.text.size();std::vector<std::string_view> stack;pp.expandProperty(text,result.text,stack);pp.require(result.text.size()<textLimit,"Preprocessed properties exceed 256 KiB.");size_t slashes=0;for(size_t i=result.text.size();i>begin&&result.text[i-1]=='\\';--i)++slashes;continuation=slashes%2!=0;result.text+='\n';++result.propertyLines;}
                continue;
            }
            pp.require(!continuation,"Directive/comment inside a continued property is unsupported.");
            auto directive=text.substr(1);if(directive.empty()||space(directive.front()))continue;
            size_t i=0;while(i<directive.size()&&rest(directive[i]))++i;const auto command=directive.substr(0,i);auto tail=directive.substr(i);
            const bool condition=command=="if"||command=="ifdef"||command=="ifndef"||command=="elif"||command=="else"||command=="endif";
            const bool known=condition||command=="define"||command=="undef"||command=="include"||command=="include_next"||command=="import"||command=="error"||command=="warning"||command=="pragma"||command=="line";
            if(!known){for(const auto prefix:{"if","elif","else","endif","define","undef","include","pragma","warning","error","line"})pp.require(!command.starts_with(prefix),"Malformed or unsupported directive.");continue;}
            ++result.directives;if(!condition&&!active())continue;
            const bool skippedCondition=(command=="if"||command=="ifdef"||command=="ifndef")&&!active()||command=="elif"&&!branches.empty()&&(!branches.back().parent||branches.back().taken);
            const auto cleaned=skippedCondition?std::string(tail):pp.uncomment(tail);tail=trim(cleaned);
            if(command=="if"||command=="ifdef"||command=="ifndef"){
                pp.require(branches.size()<32,"Conditional nesting limit exceeded.");pp.require(!tail.empty(),"Missing conditional expression.");const bool parent=active();bool selected=false;
                if(parent){if(command=="if")selected=pp.evaluate(tail);else {pp.require(name(tail),"Invalid conditional macro name.");selected=pp.lookup(tail).has_value();if(command=="ifndef")selected=!selected;}}
                branches.push_back({parent,selected,parent&&selected});
            }else if(command=="elif"){
                pp.require(!branches.empty()&&!branches.back().otherwise,"Unmatched #elif or #elif after #else.");pp.require(!tail.empty(),"Missing #elif expression.");auto& b=branches.back();const bool selected=b.parent&&!b.taken&&pp.evaluate(tail);b.active=selected;b.taken|=selected;
            }else if(command=="else"){
                pp.require(tail.empty()&&!branches.empty()&&!branches.back().otherwise,"Unmatched, duplicate or malformed #else.");auto& b=branches.back();b.otherwise=true;b.active=b.parent&&!b.taken;b.taken=true;
            }else if(command=="endif"){
                pp.require(tail.empty()&&!branches.empty(),"Unmatched or malformed #endif.");branches.pop_back();
            }else if(active()){
                if(command=="define"){
                    size_t endName=0;while(endName<tail.size()&&rest(tail[endName]))++endName;const auto key=tail.substr(0,endName);pp.require(endName==tail.size()||space(tail[endName]),"Function-like macros are unsupported.");pp.set(key,trim(tail.substr(endName)));
                }else if(command=="undef"){pp.require(name(tail),"Invalid #undef operand.");pp.set(tail,std::nullopt);}
                else pp.fail("Unsupported active directive: #"+std::string(command));
            }
        }
        pp.require(branches.empty(),"Unterminated conditional block.");pp.require(!continuation,"Unterminated property continuation.");return result;
    }
};
}
