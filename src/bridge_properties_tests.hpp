#pragma once
void testMaterialProperties(){
    using namespace bridge;using namespace bridge::shaderloader;
    const auto fails=[](auto fn){try{fn();}catch(const std::exception&){return true;}return false;};
    const MinecraftBlockState stone{"minecraft:stone",{},true},glass{"minecraft:glass",{},true};MinecraftBlockState water;water.name="minecraft:water";
    const std::vector<PropertyMacro> context={{"MC_VERSION","260300"},{"FEATURE",std::string{}},{"OFF",std::nullopt},{"ZERO","0"}};
    const auto source="# comment\n! preserved property comment\n#define stone water\n#define CHECK MC_VERSION >= 260300\n#if CHECK && defined(FEATURE) && !defined(OFF)\nblock.7=stone\n#elif UNKNOWN\nblock.9=glass\n#else\nblock.10=water\n#endif\n";
    const auto prepared=prepareBlockMaterials(source,context);
    requireCPU(prepared.properties.text=="! preserved property comment\nblock.7=water\n"&&prepared.properties.propertyLines==2,"Property macro replacement or skipped branch selection failed.");
    requireCPU(prepared.blockIds->resolve(water)==PackBlockId{7,true}&&prepared.blockIds->resolve(stone)==PackBlockId{-1,true}&&prepared.blockIds->resolve(glass)==PackBlockId{-1,true},"Prepared property IDs did not reach canonical resolution.");
    requireCPU(context[0].value=="260300"&&context[1].value==""&&!context[2].value,"Preparation mutated caller macro context.");
    const auto pp=[&](std::string_view text){return PropertiesPreprocessor::prepare(text,context).text;};
    requireCPU(pp("#define A 1 || 0\n#if A && 0\nblock.1=stone\n#else\nblock.2=glass\n#endif\n")=="block.1=stone\n","Object macro expansion inserted implicit parentheses.");
    requireCPU(pp("#ifdef FEATURE\n#ifndef OFF\n#if defined FEATURE && !ZERO\nblock.0=stone\n#endif\n#endif\n#endif\n")=="block.0=stone\n","Known undefined, empty defined and numeric zero macros were conflated.");
    requireCPU(pp("#if 0\n#include \"../never-read\"\n#define FUNCTION(x) x\n#if UNAVAILABLE + \"ignored\"\nblock.1=glass\n#endif\n#elif MC_VERSION < 260300\nblock.2=glass\n#elif MC_VERSION == 260300 /* literal check */\nblock.3=stone\n#else\nblock.4=glass\n#endif\n")=="block.3=stone\n","Inactive directives were executed or elif/else selection changed.");
    requireCPU(pp("#define X 1\n#undef X\n#ifndef X\nblock.1=stone\n#endif\n#define X 2\n#if X != 1 && X > 0 && X <= 2 && X >= 2\nblock.2=glass\n#endif\n")=="block.1=stone\nblock.2=glass\n","Macro redefine/undef or comparison precedence failed.");
    requireCPU(pp("#if -2 < -1 && +1 == 1 && 0x10 == 16 && 010 == 8 && !(0 || 0) // comment\nblock.1=stone\n#endif\n")=="block.1=stone\n","Signed/hex/octal literals, comments or logical expression precedence failed.");
    const auto continued=prepareBlockMaterials("  block.1=stone \\\r\n  glass\r\nblock.\\u0030=minecraft\\:stone\r\n",{});
    requireCPU(continued.blockIds->resolve(stone)==PackBlockId{1,true}&&continued.blockIds->resolve(glass)==PackBlockId{1,true},"Property escapes/continuation/first match changed during preprocessing.");
    auto installed=prepared.blockIds;const auto before=installed;
    for(const auto bad:{"#define MATERIAL %minecraft:logs\nblock.3=MATERIAL", "#define A A\nblock.1=A"}){
        requireCPU(fails([&]{installed=prepareBlockMaterials(bad,context).blockIds;})&&installed==before,"Property expansion/material parse failure replaced the installed table.");
    }
    try{prepareBlockMaterials("# comment\r\n#if UNKNOWN\r\n#endif",{});requireCPU(false,"Unknown macro was accepted.");}catch(const std::runtime_error& error){requireCPU(std::string(error.what()).find("line 2:")!=std::string::npos,"Property error lost its physical CRLF line number.");}
    for(const auto bad:{"#if UNKNOWN\nblock.1=glass\n#endif","#ifdef UNKNOWN\n#endif","#ifndef UNKNOWN\n#endif","#if 0\n#elif UNKNOWN\n#endif","#if 1 + 1\n#endif","#if 1 & 1\n#endif","#if 1 ? 2 : 3\n#endif","#if 09\n#endif","#if 0xffffffffffffffff\n#endif","#if 1 2\n#endif","#if ()\n#endif","#if defined()\n#endif","#if defined(MC_VERSION\n#endif","#if 1\n","#else","#endif","#if 1\n#else\n#else\n#endif","#if 1\n#else\n#elif 1\n#endif","#endif extra","#ifdefOFF\nblock.2=glass","#define F(x) x","#include \"/pack/lib\"","#pragma once","#error wrong","#warning ignored","#line 1","#define A A\n#if A\n#endif","#define A B\n#define B A\n#if A\n#endif","#define A defined(FEATURE)\n#if A\n#endif","#define __LINE__ 1","block.1=IRIS_PASSTHROUGHBACKSLASH",R"PROP(block.1=stone \)PROP","block.1=stone \\\n#if 1\nglass\n#endif"}){
        requireCPU(fails([&]{installed=prepareBlockMaterials(bad,context).blockIds;}),"Unsupported/unknown properties preprocessing silently installed a partial table.");
        requireCPU(installed==before&&installed->resolve(water)==PackBlockId{7,true},"Failed material load replaced the previous immutable table.");
    }
    requireCPU(fails([&]{PropertiesPreprocessor::prepare("#if FEATURE\n#endif",context);}),"An empty macro was fabricated into integer one.");
    requireCPU(PropertiesPreprocessor::prepare("#if FEATURE\nblock.1=stone\n#endif",{PropertyMacro::boolean("FEATURE",true)}).text=="block.1=stone\n","Iris/JCPP boolean option was not supplied as literal one.");
    const auto replaced=prepareBlockMaterials("#define ID 23\n#define MATERIAL glass\nblock.ID=stone MATERIAL\n",{});
    requireCPU(replaced.blockIds->resolve(stone)==PackBlockId{23,true}&&replaced.blockIds->resolve(glass)==PackBlockId{23,true},"Key/value object macros or literal material tokens changed.");
    requireCPU(pp("#define u0030 broken\nblock.\\u0030=stone\n")=="block.\\u0030=stone\n","Property escape identifier was expanded as a macro.");
    requireCPU(pp("#define sto broken\n#define stone water\nblock.0=sto\\u006ee \\\\stone\n")=="block.0=sto\\u006ee \\\\stone\n","Protected backslashes failed to keep joined identifier tokens literal.");
    requireCPU(pp("#define A 2\nblock.1A=stone\n")=="block.1A=stone\n","A pp-number suffix was expanded into a different block ID.");
    requireCPU(pp("#define A changed\nkey=\"A\" // A\nother=/* A */ A\n")=="key=\"A\" // A\nother=/* A */ changed\n","Macros expanded inside strings/comments or failed outside them.");
    requireCPU(fails([&]{PropertiesPreprocessor::prepare("",{{"A","1"},{"A",std::nullopt}});}),"Duplicate explicit macro facts were accepted.");
    requireCPU(fails([&]{PropertiesPreprocessor::prepare("",{{"A","1\n#define B 2"}});}),"Macro context injected an extra directive.");
    requireCPU(fails([&]{PropertiesPreprocessor::prepare(std::string(256*1024+1,' '),{});}),"Property input budget was exceeded.");
    requireCPU(fails([&]{PropertiesPreprocessor::prepare(std::string(16*1024+1,'x'),{});}),"Physical property line budget was exceeded.");
    std::string expandedOutput;for(int i=0;i<70;++i)expandedOutput+="key=EXPAND\n";requireCPU(fails([&]{PropertiesPreprocessor::prepare(expandedOutput,{{"EXPAND",std::string(4096,'a')}});}),"Property macro expansion exceeded the output budget.");
    requireCPU(fails([&]{PropertiesPreprocessor::prepare(std::string("block.1=stone\0",14),{});}),"NUL/control byte was accepted.");
    std::string nested;for(int i=0;i<33;++i)nested+="#if 1\n";requireCPU(fails([&]{pp(nested);}),"Conditional nesting budget was exceeded.");
    nested="#if "+std::string(33,'(')+"1"+std::string(33,')')+"\n#endif\n";requireCPU(fails([&]{pp(nested);}),"Expression nesting budget was exceeded.");
    std::vector<PropertyMacro> many;for(int i=0;i<257;++i)many.push_back({"X"+std::to_string(i),"1"});requireCPU(fails([&]{PropertiesPreprocessor::prepare("",many);}),"Macro count budget was exceeded.");
    many.clear();for(int i=0;i<20;++i)many.push_back({"X"+std::to_string(i),std::string(4096,'1')});requireCPU(fails([&]{PropertiesPreprocessor::prepare("",many);}),"Macro text storage budget was exceeded.");
    std::string chain;for(int i=0;i<18;++i)chain+="#define X"+std::to_string(i)+" X"+std::to_string(i+1)+"\n";chain+="#define X18 1\n#if X0\n#endif\n";requireCPU(fails([&]{pp(chain);}),"Macro depth budget was exceeded.");
    std::string value="1";for(int i=0;i<800;++i)value+="||1";const auto expansion="#define A "+value+"\n#if A || A || A\n#endif";requireCPU(fails([&]{pp(expansion);}),"Macro expanded token budget was exceeded.");
    std::string busy="#define A "+value+"\n";for(int i=0;i<400;++i)busy+="#if A\n#endif\n";requireCPU(fails([&]{pp(busy);}),"Global preprocessing work budget was exceeded.");
    // Changing only explicit option facts changes the new table; the old one
    // remains immutable. No native/GPU handle or installed context is touched.
    const auto options="#ifdef FEATURE\nblock.4=stone\n#else\nblock.5=stone\n#endif";
    const auto on=prepareBlockMaterials(options,{{"FEATURE",std::string{}}}),off=prepareBlockMaterials(options,{{"FEATURE",std::nullopt}});
    requireCPU(on.blockIds->resolve(stone)==PackBlockId{4,true}&&off.blockIds->resolve(stone)==PackBlockId{5,true}&&on.blockIds->resolve(stone)==PackBlockId{4,true},"Reload reused a macro context or modified an old material table.");
}
