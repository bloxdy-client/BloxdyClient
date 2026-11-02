#pragma once
#include "include_resolver.hpp"
#include "properties_preprocessor.hpp"
#include <bitset>
#include <iterator>
#include <unordered_set>

namespace bridge::shaderloader {
struct GlslExtension {std::string name,behavior;size_t source,line;};
struct PreprocessedGlsl {std::string text;std::vector<std::string> sourcePaths;std::vector<GlslExtension> extensions;uint32_t version=0;std::string profile;size_t expansions=0;};

// Bounded native GLSL preprocessing. No file access, Java/JCPP execution,
// hardware discovery, shader translation or program/graph activation.
class GlslPreprocessor {
    static constexpr size_t byteLimit=8*1024*1024,workLimit=32*1024*1024,tokenLimit=8192,macroLimit=512,macroTextLimit=128*1024,macroPoolLimit=16384;
    enum class Kind {Identifier,Number,Literal,Symbol};
    struct Token {std::string text;Kind kind;bool spaced=false,generated=false;std::bitset<macroLimit> disabled;};
    using Tokens=std::vector<Token>;
    struct Macro {size_t id;bool defined;std::optional<std::vector<std::string>> parameters;Tokens body;};
    std::unordered_map<std::string,Macro> macros;
    PreprocessedGlsl result;std::string body,versionLine;bool blockComment=false,versionSeen=false;size_t sourceId=0,line=1,work=0,stored=0,pooled=0;
    [[noreturn]] void fail(std::string_view message)const{throw std::runtime_error("pack:"+(sourceId<result.sourcePaths.size()?result.sourcePaths[sourceId]:"?")+":"+std::to_string(line)+": "+std::string(message));}
    void require(bool yes,std::string_view message)const{if(!yes)fail(message);}
    void charge(size_t count){require(count<=workLimit-work,"GLSL preprocessing work limit.");work+=count;}
    static bool first(char c){return c>='A'&&c<='Z'||c>='a'&&c<='z'||c=='_';}
    static bool rest(char c){return first(c)||c>='0'&&c<='9';}
    static bool identifier(std::string_view s){return !s.empty()&&first(s.front())&&std::all_of(s.begin(),s.end(),rest);}
    static bool intrinsic(std::string_view s){return s=="__VERSION__"||s=="__LINE__"||s=="__FILE__"||s=="GL_ES";}
    static bool reserved(std::string_view s){return intrinsic(s)||s=="defined"||s.find("__")!=s.npos||s.starts_with("IRIS_JCPP_");}
    static Token number(int64_t n){return {std::to_string(n),Kind::Number};}
    void append(std::string_view text){require(text.size()<=byteLimit-body.size(),"Preprocessed GLSL exceeds 8 MiB.");body.append(text);}
    Tokens lex(std::string_view text){
        require(text.size()<=64*1024,"GLSL logical line exceeds 64 KiB.");charge(text.size());Tokens out;bool spaced=false;
        for(size_t i=0;i<text.size();){
            if(blockComment){const auto end=text.find("*/",i);if(end==text.npos)break;i=end+2;blockComment=false;spaced=true;continue;}
            const char c=text[i];if(c==' '||c=='\t'||c=='\f'){++i;spaced=true;continue;}
            if(text.substr(i,2)=="//")break;if(text.substr(i,2)=="/*"){blockComment=true;i+=2;spaced=true;continue;}
            const size_t begin=i++;Kind kind=Kind::Symbol;
            if(first(c)){kind=Kind::Identifier;while(i<text.size()&&rest(text[i]))++i;}
            else if(c>='0'&&c<='9'||c=='.'&&i<text.size()&&text[i]>='0'&&text[i]<='9'){
                kind=Kind::Number;while(i<text.size()&&(rest(text[i])||text[i]=='.'||(text[i]=='+'||text[i]=='-')&&std::string_view("eEpP").find(text[i-1])!=std::string_view::npos))++i;
            }else if(c=='\"'||c=='\''){
                kind=Kind::Literal;bool closed=false;while(i<text.size()){if(text[i]=='\\'){i+=2;continue;}if(text[i++]==c){closed=true;break;}}require(closed&&i<=text.size(),"Unterminated GLSL literal.");
            }else {
                require(static_cast<unsigned char>(c)>=32&&static_cast<unsigned char>(c)<127&&c!='\\',"Unsupported GLSL token/control byte.");
                for(const auto op:{"<<=",">>=","##","++","--","<<",">>","<=",">=","==","!=","&&","||","^^","+=","-=","*=","/=","%=","&=","|=","^="})if(text.substr(begin,std::string_view(op).size())==op){i=begin+std::string_view(op).size();break;}
            }
            require(out.size()<tokenLimit,"GLSL token count limit.");out.push_back({std::string(text.substr(begin,i-begin)),kind,spaced});spaced=false;
        }return out;
    }
    static std::string render(const Tokens& tokens){std::string text;for(const auto& t:tokens){if(!text.empty())text+=' ';text+=t.text;}return text;}
    static size_t characters(const Tokens& tokens){size_t size=0;for(const auto& t:tokens)size+=t.text.size()+1;return size;}
    size_t storage(std::string_view key,const Macro& m)const{size_t n=key.size();for(const auto& t:m.body)n+=t.text.size();if(m.parameters)for(const auto& p:*m.parameters)n+=p.size();return n;}
    void set(std::string key,bool defined,std::optional<std::vector<std::string>> parameters,Tokens replacement,bool external=false){
        require(identifier(key)&&key.size()<=128&&!reserved(key)&&(external||!key.starts_with("GL_")),"Reserved or invalid GLSL macro name.");
        for(const auto& t:replacement)require(t.text!="#"&&t.text!="##","Macro stringification/token pasting is unsupported.");
        const auto old=macros.find(key);require(old!=macros.end()||macros.size()<macroLimit,"GLSL macro count limit.");
        Macro value{old==macros.end()?macros.size():old->second.id,defined,std::move(parameters),std::move(replacement)};
        const auto next=stored-(old==macros.end()?0:storage(old->first,old->second))+storage(key,value),nextPool=pooled-(old==macros.end()?0:old->second.body.size())+value.body.size();
        require(next<=macroTextLimit&&nextPool<=macroPoolLimit,"GLSL macro storage limit.");stored=next;pooled=nextPool;macros.insert_or_assign(std::move(key),std::move(value));
    }
    bool isDefined(std::string_view name)const{
        if(intrinsic(name))return name!="GL_ES"||result.profile=="es"||result.version==100;
        const auto found=macros.find(std::string(name));require(found!=macros.end(),"Unknown GLSL conditional context: "+std::string(name));return found->second.defined;
    }
    Tokens expand(Tokens tokens,bool condition,unsigned depth=0){
        require(depth<=32,"GLSL argument expansion depth limit.");
        for(size_t i=0;i<tokens.size();){charge(1);auto token=tokens[i];if(token.kind!=Kind::Identifier){++i;continue;}
            if(condition&&token.text=="defined"){
                require(!token.generated,"Macro-generated defined is unsupported.");size_t end=i+1;require(end<tokens.size(),"Missing defined operand.");const bool paren=tokens[end].text=="(";if(paren)++end;require(end<tokens.size()&&tokens[end].kind==Kind::Identifier,"Invalid defined operand.");const bool exists=isDefined(tokens[end++].text);if(paren)require(end<tokens.size()&&tokens[end++].text==")","Missing defined closing parenthesis.");
                tokens.erase(tokens.begin()+i,tokens.begin()+end);tokens.insert(tokens.begin()+i,number(exists));++i;continue;
            }
            if(intrinsic(token.text)){
                if(token.text=="GL_ES"&&!isDefined("GL_ES")){if(condition)tokens[i]=number(0);++i;continue;}
                tokens[i]=number(token.text=="__LINE__"?static_cast<int64_t>(line):token.text=="__FILE__"?static_cast<int64_t>(sourceId):token.text=="__VERSION__"?result.version:1);++i;continue;
            }
            const auto found=macros.find(token.text);
            if(found==macros.end()||!found->second.defined){if(condition){require(found!=macros.end(),"Unknown GLSL conditional context: "+token.text);tokens[i]=number(0);}++i;continue;}
            const auto& macro=found->second;size_t end=i+1;std::vector<Tokens> arguments;
            if(macro.parameters){
                if(end==tokens.size()||tokens[end].text!="("){if(condition)tokens[i]=number(0);++i;continue;}
                ++end;unsigned nesting=1;Tokens argument;bool comma=false;
                for(;end<tokens.size();++end){const auto& t=tokens[end];if(t.text=="("){require(++nesting<=32,"GLSL macro argument nesting limit.");argument.push_back(t);}else if(t.text==")"){
                        if(!--nesting){if(!argument.empty()||comma||!macro.parameters->empty())arguments.push_back(std::move(argument));++end;break;}argument.push_back(t);
                    }else if(t.text==","&&nesting==1){arguments.push_back(std::move(argument));argument={};comma=true;}else argument.push_back(t);
                    require(arguments.size()<=16,"GLSL macro argument count limit.");
                }
                require(!nesting&&arguments.size()==macro.parameters->size(),"Unterminated macro call or argument count mismatch.");
                for(auto& arg:arguments)arg=expand(std::move(arg),condition,depth+1);
            }
            require(!token.disabled.test(macro.id)&&token.disabled.count()<32,"Recursive GLSL macro expansion is unsupported.");Tokens replacement;size_t replacementBytes=0;
            for(const auto& part:macro.body){
                const auto param=macro.parameters?std::find(macro.parameters->begin(),macro.parameters->end(),part.text):std::vector<std::string>::const_iterator{};
                if(macro.parameters&&param!=macro.parameters->end()){const auto& arg=arguments[size_t(param-macro.parameters->begin())];require(arg.size()<=tokenLimit-replacement.size(),"GLSL substituted token limit.");replacementBytes+=characters(arg);require(replacementBytes<=256*1024,"GLSL substituted character limit.");replacement.insert(replacement.end(),arg.begin(),arg.end());}
                else {require(replacement.size()<tokenLimit,"GLSL replacement token limit.");replacementBytes+=part.text.size()+1;require(replacementBytes<=256*1024,"GLSL replacement character limit.");replacement.push_back(part);}
            }
            for(auto& part:replacement){part.disabled|=token.disabled;part.disabled.set(macro.id);part.generated=true;}
            size_t removedBytes=0;for(size_t k=i;k<end;++k)removedBytes+=tokens[k].text.size()+1;
            require(tokens.size()-(end-i)+replacement.size()<=tokenLimit&&characters(tokens)-removedBytes+replacementBytes<=256*1024,"GLSL expanded token/character limit.");charge(tokens.size()+replacement.size()+replacementBytes);++result.expansions;
            tokens.erase(tokens.begin()+i,tokens.begin()+end);tokens.insert(tokens.begin()+i,std::make_move_iterator(replacement.begin()),std::make_move_iterator(replacement.end()));
        }return tokens;
    }
    struct Expression {
        GlslPreprocessor& p;const Tokens& tokens;size_t at=0,depth=0;
        bool take(std::string_view text){if(at<tokens.size()&&tokens[at].text==text){++at;return true;}return false;}
        int64_t primary(bool run){p.require(++depth<=32,"GLSL expression depth limit.");int64_t n=0;
            if(take("(")){n=conditional(run);p.require(take(")"),"Missing expression closing parenthesis.");}
            else if(take("!"))n=!primary(run);else if(take("~"))n=~primary(run);else if(take("-")){n=primary(run);p.require(!run||n!=INT64_MIN,"Integer negation overflow.");if(run)n=-n;}
            else {p.require(at<tokens.size()&&tokens[at].kind==Kind::Number,"Missing/incompatible GLSL expression operand.");auto text=std::string_view(tokens[at++].text);int base=10;if(text.starts_with("0x")||text.starts_with("0X")){text.remove_prefix(2);base=16;}else if(text.size()>1&&text[0]=='0')base=8;
                uint64_t value=0;const auto [end,error]=std::from_chars(text.data(),text.data()+text.size(),value,base);p.require(!text.empty()&&error==std::errc{}&&end==text.data()+text.size()&&value<=uint64_t(INT64_MAX),"Unsupported integer literal/range in GLSL condition.");n=static_cast<int64_t>(value);}
            --depth;return run?n:0;
        }
        int64_t add(int64_t a,int64_t b){p.require(!(b>0&&a>INT64_MAX-b)&&!(b<0&&a<INT64_MIN-b),"GLSL conditional addition overflow.");return a+b;}
        int64_t mul(int64_t a,int64_t b){if(!a||!b)return 0;p.require(!(a==INT64_MIN&&b==-1)&&!(b==INT64_MIN&&a==-1),"GLSL conditional multiplication overflow.");p.require(a>0?(b>0?a<=INT64_MAX/b:b>=INT64_MIN/a):(b>0?a>=INT64_MIN/b:a>=INT64_MAX/b),"GLSL conditional multiplication overflow.");return a*b;}
        int64_t product(bool run){auto a=primary(run);for(;;){if(take("*")){const auto b=primary(run);if(run)a=mul(a,b);}else if(take("/")){const auto b=primary(run);if(run){p.require(b&&!(a==INT64_MIN&&b==-1),"Invalid conditional division.");a/=b;}}else if(take("%")){const auto b=primary(run);if(run){p.require(b&&!(a==INT64_MIN&&b==-1),"Invalid conditional remainder.");a%=b;}}else return a;}}
        int64_t sum(bool run){auto a=product(run);for(;;){if(take("+")){const auto b=product(run);if(run)a=add(a,b);}else if(take("-")){const auto b=product(run);if(run){p.require(!(b>0&&a<INT64_MIN+b)&&!(b<0&&a>INT64_MAX+b),"GLSL conditional subtraction overflow.");a-=b;}}else return a;}}
        int64_t shift(bool run){auto a=sum(run);for(;;){const bool left=take("<<");if(!left&&!take(">>"))return a;const auto b=sum(run);if(run){p.require(b>=0&&b<64&&a>=0,"Invalid or negative conditional shift.");if(left){p.require(a<=(INT64_MAX>>b),"Conditional left shift overflow.");a<<=b;}else a>>=b;}}}
        int64_t relational(bool run){auto a=shift(run);for(;;){if(take("<")){const auto b=shift(run);a=a<b;}else if(take("<=")){const auto b=shift(run);a=a<=b;}else if(take(">")){const auto b=shift(run);a=a>b;}else if(take(">=")){const auto b=shift(run);a=a>=b;}else return a;}}
        int64_t equality(bool run){auto a=relational(run);for(;;){if(take("==")){const auto b=relational(run);a=a==b;}else if(take("!=")){const auto b=relational(run);a=a!=b;}else return a;}}
        int64_t bitAnd(bool run){auto a=equality(run);while(take("&"))a&=equality(run);return a;}
        int64_t bitXor(bool run){auto a=bitAnd(run);while(take("^"))a^=bitAnd(run);return a;}
        int64_t bitOr(bool run){auto a=bitXor(run);while(take("|"))a|=bitXor(run);return a;}
        // Pinned JCPP evaluates both operands/branches before selecting a
        // result. An unselected division by zero must still reject the pack.
        int64_t logicalAnd(bool run){auto a=bitOr(run);while(take("&&")){const auto b=bitOr(run);a=bool(a)&&bool(b);}return a;}
        int64_t logicalOr(bool run){auto a=logicalAnd(run);while(take("||")){const auto b=logicalAnd(run);a=bool(a)||bool(b);}return a;}
        int64_t conditional(bool run){p.require(++depth<=32,"GLSL conditional expression depth limit.");const auto a=logicalOr(run);int64_t out=a;if(take("?")){const auto yes=conditional(run);p.require(take(":"),"Missing ternary separator.");const auto no=conditional(run);out=a?yes:no;}--depth;return run?out:0;}
    };
    bool condition(Tokens tokens){tokens=expand(std::move(tokens),true);Expression e{*this,tokens};const auto value=e.conditional(true);require(e.at==tokens.size(),"Unsupported/trailing GLSL expression tokens.");return value!=0;}
    uint32_t unsignedNumber(const Token& token)const{uint32_t n=0;const auto [end,error]=std::from_chars(token.text.data(),token.text.data()+token.text.size(),n);require(error==std::errc{}&&end==token.text.data()+token.text.size()&&token.kind==Kind::Number&&token.text==std::to_string(n),"Expected canonical unsigned GLSL directive integer.");return n;}
    void version(const Tokens& tokens){
        require(!versionSeen&&tokens.size()>=3&&tokens.size()<=4,"Missing/duplicate/malformed #version.");const auto v=unsignedNumber(tokens[2]);const std::string profile=tokens.size()==4?tokens[3].text:"";
        const bool es=profile=="es"||v==100;const std::vector<uint32_t> allowed=es?std::vector<uint32_t>{100,300,310,320}:std::vector<uint32_t>{110,120,130,140,150,330,400,410,420,430,440,450,460};
        require(std::find(allowed.begin(),allowed.end(),v)!=allowed.end()&&(es?(v==100?profile.empty():profile=="es"):(profile.empty()||profile=="core"||profile=="compatibility"))&&(profile.empty()||v>=150),"Unsupported GLSL version/profile combination.");
        result.version=v;result.profile=profile;versionLine="#version "+std::to_string(v)+(profile.empty()?"":" "+profile)+"\n";versionSeen=true;
    }
public:
    static PreprocessedGlsl prepare(const ExpandedShader& source,const std::vector<PropertyMacro>& context){
        GlslPreprocessor pp;pp.require(source.text.size()<=byteLimit&&!source.sourcePaths.empty()&&source.sourcePaths.size()<=4096,"Invalid GLSL source/map size.");pp.result.sourcePaths=source.sourcePaths;std::unordered_set<std::string> names;for(const auto& name:source.sourcePaths){PackSources::path(name);pp.require(names.insert(name).second,"Duplicate GLSL source map path.");}
        pp.require(source.text.find("IRIS_JCPP_")==std::string::npos,"Reserved Iris GLSL marker.");pp.require(context.size()<=macroLimit,"GLSL macro context count limit.");pp.charge(source.text.size());
        for(const auto& m:context){pp.require(!pp.macros.contains(m.name),"Duplicate GLSL macro context.");Tokens replacement;if(m.value){pp.require(m.value->find_first_of("\r\n\\#")==m.value->npos,"Unsupported GLSL macro context text.");replacement=pp.lex(*m.value);pp.require(!pp.blockComment,"Unterminated context comment.");}pp.set(m.name,m.value.has_value(),std::nullopt,std::move(replacement),true);}
        struct Branch {bool parent,taken,active,otherwise=false;};std::vector<Branch> branches;const auto active=[&](){return branches.empty()||branches.back().active;};
        for(size_t at=0;at<source.text.size();){std::string logical;size_t physical=0;bool more;
            do{++physical;const auto end=source.text.find_first_of("\r\n",at),until=end==source.text.npos?source.text.size():end;auto part=std::string_view(source.text).substr(at,until-at);at=until;if(end!=source.text.npos){at=end+1;if(source.text[end]=='\r'&&at<source.text.size()&&source.text[at]=='\n')++at;}more=!part.empty()&&part.back()=='\\';if(more)part.remove_suffix(1);pp.require(part.size()<=64*1024-logical.size(),"Spliced GLSL line limit.");logical.append(part);pp.require(!more||at<source.text.size(),"Unterminated GLSL line splice.");}while(more);
            auto tokens=pp.lex(logical);size_t nextLine=pp.line+physical,nextSource=pp.sourceId;bool emitted=false;
            if(!tokens.empty()&&tokens[0].text=="#"){
                pp.require(tokens.size()>1&&tokens[1].kind==Kind::Identifier,"Malformed GLSL directive.");const auto cmd=tokens[1].text;Tokens tail(tokens.begin()+2,tokens.end());
                if(cmd=="version"){pp.require(branches.empty(),"Conditional #version is unsupported.");pp.version(tokens);}
                else {
                    pp.require(pp.versionSeen,"An explicit leading GLSL #version is required.");
                    if(cmd=="if"||cmd=="ifdef"||cmd=="ifndef"){
                        pp.require(branches.size()<32&&!tail.empty(),"Conditional depth limit/missing operand.");const bool parent=active();bool selected=false;if(parent){if(cmd=="if")selected=pp.condition(std::move(tail));else {pp.require(tail.size()==1&&tail[0].kind==Kind::Identifier,"Invalid ifdef/ifndef operand.");selected=pp.isDefined(tail[0].text);if(cmd=="ifndef")selected=!selected;}}branches.push_back({parent,selected,parent&&selected});
                    }else if(cmd=="elif"){
                        pp.require(!branches.empty()&&!branches.back().otherwise&&!tail.empty(),"Invalid #elif.");auto& b=branches.back();const bool selected=b.parent&&!b.taken&&pp.condition(std::move(tail));b.active=selected;b.taken|=selected;
                    }else if(cmd=="else"){
                        pp.require(tail.empty()&&!branches.empty()&&!branches.back().otherwise,"Invalid/duplicate #else.");auto& b=branches.back();b.active=b.parent&&!b.taken;b.taken=true;b.otherwise=true;
                    }else if(cmd=="endif"){pp.require(tail.empty()&&!branches.empty(),"Unmatched/malformed #endif.");branches.pop_back();}
                    else if(cmd=="line"){
                        // Resolver-generated locations are structural even if
                        // the containing shader branch is inactive.
                        pp.require(tail.size()==2,"Malformed source-map #line.");nextLine=pp.unsignedNumber(tail[0]);nextSource=pp.unsignedNumber(tail[1]);pp.require(nextLine>0&&nextLine<=byteLimit+1&&nextSource<source.sourcePaths.size(),"Unknown/invalid source-map location.");pp.append("#line "+std::to_string(nextLine)+" "+std::to_string(nextSource)+"\n");emitted=true;
                    }else if(active()){
                        if(cmd=="define"){
                            pp.require(!tail.empty()&&tail[0].kind==Kind::Identifier,"Missing macro name.");const auto key=tail[0].text;size_t begin=1;std::optional<std::vector<std::string>> parameters;
                            if(begin<tail.size()&&tail[begin].text=="("&&!tail[begin].spaced){parameters=std::vector<std::string>{};++begin;if(begin<tail.size()&&tail[begin].text!=")")for(;;){pp.require(begin<tail.size()&&tail[begin].kind==Kind::Identifier&&parameters->size()<16,"Invalid formal macro parameter.");const auto name=tail[begin++].text;pp.require(name.size()<=128&&!reserved(name)&&!name.starts_with("GL_"),"Reserved formal macro parameter.");pp.require(std::find(parameters->begin(),parameters->end(),name)==parameters->end(),"Duplicate formal macro parameter.");parameters->push_back(name);if(begin<tail.size()&&tail[begin].text==","){++begin;continue;}break;}pp.require(begin<tail.size()&&tail[begin++].text==")","Missing formal macro closing parenthesis.");}
                            pp.set(key,true,std::move(parameters),Tokens(tail.begin()+begin,tail.end()));
                        }else if(cmd=="undef"){pp.require(tail.size()==1&&tail[0].kind==Kind::Identifier,"Invalid undef operand.");pp.set(tail[0].text,false,std::nullopt,{});}
                        else if(cmd=="extension"){
                            pp.require(tail.size()==3&&tail[0].kind==Kind::Identifier&&tail[0].text.size()<=128&&pp.result.extensions.size()<256&&tail[1].text==":"&&(tail[2].text=="enable"||tail[2].text=="require"||tail[2].text=="disable"||tail[2].text=="warn"),"Invalid extension directive/count limit.");pp.require(tail[0].text!="all"||tail[2].text=="disable"||tail[2].text=="warn","Invalid all-extension behavior.");pp.result.extensions.push_back({tail[0].text,tail[2].text,pp.sourceId,pp.line});
                        }else if(cmd=="pragma"){
                            const auto request=render(tail);pp.require(request=="optimize ( on )"||request=="optimize ( off )"||request=="debug ( on )"||request=="debug ( off )"||request=="STDGL invariant ( all )","Unsupported GLSL pragma.");pp.append("#pragma "+request+"\n");emitted=true;
                        }else if(cmd=="error")pp.fail("Active shader #error: "+render(tail));
                        else pp.fail("Unsupported/unresolved GLSL directive: #"+cmd);
                    }
                }
            }else if(active()&&!tokens.empty()){
                pp.require(pp.versionSeen,"An explicit GLSL #version is required before code.");tokens=pp.expand(std::move(tokens),false);
                if(!tokens.empty()&&tokens.back().kind==Kind::Identifier){const auto pending=pp.macros.find(tokens.back().text);pp.require(pending==pp.macros.end()||!pending->second.defined||!pending->second.parameters,"Function macro at logical-line boundary is unsupported.");}
                pp.append(render(tokens));pp.append("\n");emitted=true;
            }
            for(size_t blank=emitted?1:0;blank<physical;++blank)pp.append("\n");pp.line=nextLine;pp.sourceId=nextSource;
        }
        pp.require(pp.versionSeen&&branches.empty()&&!pp.blockComment,"Missing version/unterminated conditional or comment.");std::string header=pp.versionLine;for(const auto& e:pp.result.extensions)header+="#extension "+e.name+" : "+e.behavior+"\n";header+="#line 1 0\n";pp.require(header.size()<=byteLimit-pp.body.size(),"GLSL output/header limit.");pp.result.text=header+pp.body;return std::move(pp.result);
    }
};
struct PreparedShaderSource {ExpandedShader expanded;PreprocessedGlsl glsl;};
inline PreparedShaderSource preparePackShader(const PackSources& sources,std::string_view root,const std::vector<PropertyMacro>& context){auto expanded=IncludeResolver::expand(sources,root);auto glsl=GlslPreprocessor::prepare(expanded,context);return {std::move(expanded),std::move(glsl)};}
}
