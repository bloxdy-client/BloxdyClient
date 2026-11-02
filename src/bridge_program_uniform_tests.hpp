#pragma once
namespace packUniformMock {
using namespace bridge::shaderloader;
struct Write {GLuint program;GLint location;std::string kind;std::vector<double> values;};
std::vector<Write> writes;GLint units=8;size_t failAt=SIZE_MAX,loseAt=SIZE_MAX;
void record(GLuint program,GLint location,GLsizei count,std::string kind,std::vector<double> values){
    packProgramMock::guard();requireCPU(count==1&&packProgramMock::programs.contains(program),"Uniform upload used wrong program/count.");
    writes.push_back({program,location,std::move(kind),std::move(values)});
    if(writes.size()==failAt)packProgramMock::pending=GL_INVALID_OPERATION;
    if(writes.size()==loseAt)packProgramMock::context=88;
}
template<int N>void APIENTRY floats(GLuint p,GLint l,GLsizei count,const GLfloat* values){record(p,l,count,"f"+std::to_string(N),{values,values+N});}
template<int N>void APIENTRY ints(GLuint p,GLint l,GLsizei count,const GLint* values){record(p,l,count,"i"+std::to_string(N),{values,values+N});}
template<int N>void APIENTRY matrix(GLuint p,GLint l,GLsizei count,GLboolean transpose,const GLfloat* values){requireCPU(transpose==GL_FALSE,"Uniform matrix was transposed.");record(p,l,count,"m"+std::to_string(N),{values,values+N*N});}
ProgramUniformApi api(){
    ProgramUniformApi a;a.ProgramUniform1fv=floats<1>;a.ProgramUniform2fv=floats<2>;a.ProgramUniform3fv=floats<3>;a.ProgramUniform4fv=floats<4>;
    a.ProgramUniform1iv=ints<1>;a.ProgramUniform2iv=ints<2>;a.ProgramUniform3iv=ints<3>;a.ProgramUniform4iv=ints<4>;
    a.ProgramUniformMatrix2fv=matrix<2>;a.ProgramUniformMatrix3fv=matrix<3>;a.ProgramUniformMatrix4fv=matrix<4>;
    a.GetIntegerv=[](GLenum key,GLint* value){packProgramMock::guard();requireCPU(key==GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS,"Wrong sampler unit limit query.");*value=units;};
    a.GetError=[]()->GLenum{packProgramMock::guard();const auto error=packProgramMock::pending;packProgramMock::pending=GL_NO_ERROR;return error;};return a;
}
}

void testPackProgramUniforms(){
    using namespace bridge::shaderloader;namespace pm=packProgramMock;namespace um=packUniformMock;
    const auto fails=[](auto fn){try{fn();}catch(const std::exception&){return true;}return false;};
    pm::reset();um::writes.clear();um::units=8;um::failAt=um::loseAt=SIZE_MAX;
    ProgramDomain domain(pm::api(),[]{return pm::context;});
    std::ifstream file("outputs/native-renderer-verification/translation-source-fixture.bin",std::ios::binary);const std::vector<uint8_t> bytes(std::istreambuf_iterator<char>(file),{});const auto sources=PackSources::decode(bytes);
    auto lease=domain.compilePack(*sources,"legacy.vsh","legacy.fsh",{{"MRT","1"}});const auto id=lease.handle();
    PackBindingRequest request{{{"position","explicit:position",GL_FLOAT_VEC3,2},{"coord","explicit:uv",GL_FLOAT_VEC2,7}},{{"transform","explicit:matrix",GL_FLOAT_MAT4,11},{"sourceTex","explicit:texture-unit",GL_SAMPLER_2D,4}},{{0,GL_COLOR_ATTACHMENT0},{2,GL_COLOR_ATTACHMENT3}}};
    std::vector<PackUniformValue> values={{"sourceTex",std::vector<int32_t>{3}},{"transform",std::vector<float>{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16}}};
    auto incomplete=um::api();incomplete.ProgramUniform2fv=nullptr;const auto before=pm::calls;
    requireCPU(fails([&]{PackUniformWriter::create(std::move(lease),request,incomplete);})&&lease.handle()==id&&pm::calls==before,"Failed writer creation consumed lease or called a driver.");
    auto wrong=request;wrong.uniforms[0].location=9;requireCPU(fails([&]{PackUniformWriter::create(std::move(lease),wrong,um::api());})&&lease.handle()==id&&pm::calls==before,"Writer accepted routes from another reflected interface.");
    um::units=0;requireCPU(fails([&]{PackUniformWriter::create(std::move(lease),request,um::api());})&&lease.handle()==id,"Invalid context unit limit consumed the candidate.");um::units=8;
    auto writer=PackUniformWriter::create(std::move(lease),request,um::api());requireCPU(!lease&&writer.textureUnitLimit()==8&&fails([&]{writer.programForDraw();}),"Writer is ready without complete values or failed to own its lease.");
    pm::boundProgram=123456;writer.write(values);requireCPU(writer.programForDraw()==id&&pm::boundProgram==123456&&um::writes.size()==2&&um::writes[0].program==id&&um::writes[0].location==11&&um::writes[0].kind=="m4"&&um::writes[0].values==std::vector<double>({1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16})&&um::writes[1].location==4&&um::writes[1].kind=="i1"&&um::writes[1].values==std::vector<double>{3},"Uniform uploads changed current program or lost matrix layout/reflected locations.");
    const auto foreignReadyCalls=pm::calls;std::thread rejectedOwner([&]{requireCPU(fails([&]{writer.write(values);}),"Foreign thread reached ready writer.");});rejectedOwner.join();requireCPU(pm::calls==foreignReadyCalls&&writer.programForDraw()==id,"Foreign thread mutated writer readiness or reached driver.");
    const auto writes=um::writes.size(),calls=pm::calls;auto badValues=values;badValues[0].components=std::vector<int32_t>{8};
    requireCPU(fails([&]{writer.write(badValues);})&&pm::calls==calls&&um::writes.size()==writes&&fails([&]{writer.programForDraw();}),"CPU value rejection wrote partial data or left draw readiness set.");writer.write(values);
    PackUniformSlot slot;slot.replace(std::move(writer));requireCPU(slot.get().programForDraw()==id&&fails([&]{writer.programForDraw();}),"Uniform writer move retained a usable old lease.");
    auto nextLease=domain.compilePack(*sources,"legacy.vsh","legacy.fsh",{{"MRT","1"}});const auto nextId=nextLease.handle();auto candidate=PackUniformWriter::create(std::move(nextLease),request,um::api());
    requireCPU(fails([&]{slot.replace(std::move(candidate));})&&slot.get().programForDraw()==id,"Uninitialized candidate replaced valid uniform program.");
    um::failAt=um::writes.size()+1;requireCPU(fails([&]{candidate.write(values);})&&fails([&]{candidate.programForDraw();})&&fails([&]{slot.replace(std::move(candidate));})&&slot.get().programForDraw()==id&&um::writes.back().program==nextId,"Driver error committed partial candidate or damaged old slot.");um::failAt=SIZE_MAX;
    pm::pending=GL_INVALID_OPERATION;const auto prior=um::writes.size();requireCPU(fails([&]{candidate.write(values);})&&um::writes.size()==prior,"Pre-existing GL error allowed uniform mutation.");
    um::loseAt=um::writes.size()+1;requireCPU(fails([&]{candidate.write(values);})&&pm::context==88,"Uniform context loss was ignored.");const auto foreignCalls=pm::calls;requireCPU(fails([&]{candidate.write(values);})&&pm::calls==foreignCalls,"Foreign context accessed a uniform entry point.");pm::context=77;um::loseAt=SIZE_MAX;
    std::thread foreign([&]{requireCPU(fails([&]{candidate.write(values);}),"Foreign thread wrote uniform data.");});foreign.join();requireCPU(pm::calls==foreignCalls,"Foreign thread reached uniform GL calls.");
    candidate.write(values);slot.replace(std::move(candidate));requireCPU(slot.get().programForDraw()==nextId&&pm::programs.contains(id),"Successful candidate did not preserve separate retirement.");
    pm::boundProgram=id;domain.collect();requireCPU(domain.outstanding()==2,"Uniform replacement deleted a still-bound retired program.");pm::boundProgram=0;domain.collect();requireCPU(domain.outstanding()==1&&!pm::programs.contains(id),"Uniform writer did not release the old lease.");
    slot.write(values);slot.clear();domain.collect();requireCPU(domain.outstanding()==0,"Cleared uniform slot leaked its lease.");

    // Hand-prepared core ABI fixture, independent of the legacy translator's
    // narrower texture-call subset. All supported uniform types are active.
    struct Spec {const char* name;const char* glsl;GLenum type;int count;bool integer;const char* expression;};
    const std::vector<Spec> specs={
        {"uf","float",GL_FLOAT,1,false,"uf"},{"uv2","vec2",GL_FLOAT_VEC2,2,false,"uv2.x"},{"uv3","vec3",GL_FLOAT_VEC3,3,false,"uv3.y"},{"uv4","vec4",GL_FLOAT_VEC4,4,false,"uv4.z"},
        {"um2","mat2",GL_FLOAT_MAT2,4,false,"um2[0][1]"},{"um3","mat3",GL_FLOAT_MAT3,9,false,"um3[1][2]"},{"um4","mat4",GL_FLOAT_MAT4,16,false,"um4[2][3]"},
        {"ui","int",GL_INT,1,true,"float(ui)"},{"ui2","ivec2",GL_INT_VEC2,2,true,"float(ui2.x)"},{"ui3","ivec3",GL_INT_VEC3,3,true,"float(ui3.y)"},{"ui4","ivec4",GL_INT_VEC4,4,true,"float(ui4.z)"},
        {"ub","bool",GL_BOOL,1,true,"float(ub)"},{"ub2","bvec2",GL_BOOL_VEC2,2,true,"float(ub2.x)"},{"ub3","bvec3",GL_BOOL_VEC3,3,true,"float(ub3.y)"},{"ub4","bvec4",GL_BOOL_VEC4,4,true,"float(ub4.z)"},
        {"ut2","sampler2D",GL_SAMPLER_2D,1,true,"texture(ut2,vec2(0.25)).x"},{"ut3","sampler3D",GL_SAMPLER_3D,1,true,"texture(ut3,vec3(0.25)).y"},{"utc","samplerCube",GL_SAMPLER_CUBE,1,true,"texture(utc,vec3(1,0,0)).z"}
    };
    TranslatedShaderPair pair;pair.vertex.stage=PackShaderStage::Vertex;pair.fragment.stage=PackShaderStage::Fragment;
    for(auto* stage:{&pair.vertex,&pair.fragment}){stage->sourceVersion=120;stage->targetVersion=330;stage->sourcePaths={"uniform-abi.glsl"};}
    pair.vertex.text="#version 330 core\nin vec3 position;void main(){gl_Position=vec4(position,1.0);}\n";pair.vertex.attributes={{"position","vec3"}};
    pair.fragment.text="#version 330 core\nlayout(location=0) out vec4 result;\n";pair.fragment.outputLocations={0};
    PackBindingRequest all;all.attributes={{"position","explicit:position",GL_FLOAT_VEC3,2}};all.outputs={{0,GL_COLOR_ATTACHMENT0}};std::vector<PackUniformValue> allValues;pm::attributes={{"position",GL_FLOAT_VEC3,2}};pm::uniforms.clear();pm::outputs={{0}};
    std::string expression="0.0";int samplerUnit=1;
    for(size_t i=0;i<specs.size();++i){const auto& s=specs[i];const GLint location=static_cast<GLint>(3+i*5);pair.fragment.text+="uniform "+std::string(s.glsl)+" "+s.name+";\n";pair.fragment.uniforms.push_back({s.name,s.glsl});pm::uniforms.push_back({s.name,s.type,location});all.uniforms.push_back({s.name,"explicit:value",s.type,location});expression+="+"+std::string(s.expression);
        if(s.integer){std::vector<int32_t> v(s.count);for(int j=0;j<s.count;++j)v[j]=s.type==GL_BOOL||s.type==GL_BOOL_VEC2||s.type==GL_BOOL_VEC3||s.type==GL_BOOL_VEC4?j%2:-(j+1);if(i>=15)v[0]=samplerUnit++;allValues.push_back({s.name,v});}
        else{std::vector<float> v(s.count);for(int j=0;j<s.count;++j)v[j]=static_cast<float>(i*16+j+.25);allValues.push_back({s.name,v});}
    }
    pair.fragment.text+="void main(){result=vec4("+expression+");}\n";
    for(const auto& [name,text]:std::initializer_list<std::pair<const char*,std::string>>{{"pack-uniform-types.vert",pair.vertex.text},{"pack-uniform-types.frag",pair.fragment.text}}){std::ofstream out(std::string("outputs/native-renderer-verification/")+name,std::ios::binary);out<<text;requireCPU(bool(out),"Cannot write uniform ABI fixture.");}
    auto fullLease=domain.compile(pair);auto full=PackUniformWriter::create(std::move(fullLease),all,um::api());const auto start=um::writes.size();full.write(allValues);requireCPU(um::writes.size()==start+specs.size(),"Uniform type set was not fully uploaded.");
    for(size_t i=0;i<specs.size();++i){const auto& got=um::writes[start+i];const auto& spec=specs[i];const auto expectedKind=spec.type==GL_FLOAT_MAT2?"m2":spec.type==GL_FLOAT_MAT3?"m3":spec.type==GL_FLOAT_MAT4?"m4":(spec.integer?"i":"f")+std::to_string(spec.count);requireCPU(got.kind==expectedKind&&got.location==static_cast<GLint>(3+i*5),"Wrong typed uniform dispatch/location.");std::visit([&](const auto& v){requireCPU(got.values==std::vector<double>(v.begin(),v.end()),"Uniform values were converted or reordered.");},allValues[i].components);}
    auto invalid=allValues;invalid[11].components=std::vector<int32_t>{2};const auto safeCalls=pm::calls;requireCPU(fails([&]{full.write(invalid);})&&pm::calls==safeCalls,"Invalid boolean reached uniform driver.");
    invalid=allValues;invalid[16].components=std::vector<int32_t>{1};requireCPU(fails([&]{full.write(invalid);})&&pm::calls==safeCalls,"Different sampler types aliased one unit before mutation.");
    full.write(allValues);{PackUniformSlot final;final.replace(std::move(full));final.clear();}domain.collect();domain.close();requireCPU(pm::programs.empty()&&pm::shaders.empty(),"Uniform ownership tests leaked GL names.");
}
