#pragma once
namespace packVertexMock {
using namespace bridge::shaderloader;
struct Attribute {GLuint buffer=0;GLint rows=0;GLenum storage=0;GLboolean normalized=GL_FALSE;GLsizei stride=0;uintptr_t offset=0;GLuint divisor=0;bool integer=false,enabled=false;};
struct Vao {std::map<GLuint,Attribute> attributes;GLuint element=0;};
struct Buffer {GLint64 bytes;GLint mapped=GL_FALSE;};
std::map<GLuint,Vao> vaos;std::map<GLuint,Buffer> buffers;
GLuint vao=70,array=10,next=100;size_t draws=0,allocations=0,deletions=0;Vao lastDraw;
uint32_t expectedSamplerUnit=3;GLuint expectedSamplerTexture=5000;
PackArrayDraw lastCommand;bool failPointer=false,failDraw=false,loseDraw=false,loseGen=false,failRestore=false,failDelete=false,transformFeedback=false;
void reset(){vaos={{70,{{{15,{10,4,GL_FLOAT,GL_FALSE,16,0,9,false,true}}},777}}};buffers={{10,{16}},{20,{60}},{30,{192}},{40,{40}},{50,{20}}};vao=70;array=10;next=100;draws=allocations=deletions=0;expectedSamplerUnit=3;expectedSamplerTexture=5000;lastDraw={};failPointer=failDraw=loseDraw=loseGen=failRestore=failDelete=transformFeedback=false;packProgramMock::boundProgram=700000;}
void pointer(GLuint location,GLint rows,GLenum type,GLboolean normalized,GLsizei stride,const void* offset,bool integer){packProgramMock::guard();requireCPU(vao!=70&&vaos.contains(vao)&&buffers.contains(array),"Pack vertex setup changed external VAO or used client memory.");auto& a=vaos.at(vao).attributes[location];a.buffer=array;a.rows=rows;a.storage=type;a.normalized=normalized;a.stride=stride;a.offset=reinterpret_cast<uintptr_t>(offset);a.integer=integer;if(failPointer){failPointer=false;packProgramMock::pending=GL_INVALID_OPERATION;}}
PackVertexApi api(){PackVertexApi a;
    a.GetError=packUniformMock::api().GetError;
    a.GetIntegerv=[](GLenum key,GLint* value){packProgramMock::guard();switch(key){case GL_MAX_VERTEX_ATTRIBS:*value=16;break;case GL_VERTEX_ARRAY_BINDING:*value=vao;break;case GL_ARRAY_BUFFER_BINDING:*value=array;break;case GL_CURRENT_PROGRAM:*value=packProgramMock::boundProgram;break;case GL_TRANSFORM_FEEDBACK_ACTIVE:*value=transformFeedback?GL_TRUE:GL_FALSE;break;default:throw std::runtime_error("Unknown vertex state query.");}};
    a.GenVertexArrays=[](GLsizei n,GLuint* value){packProgramMock::guard();requireCPU(n==1,"Unbounded pack VAO allocation.");*value=next++;vaos.emplace(*value,Vao{});++allocations;if(loseGen)packProgramMock::context=88;};
    a.DeleteVertexArrays=[](GLsizei n,const GLuint* value){packProgramMock::guard();requireCPU(n==1&&*value!=70&&vao!=*value,"Deleted external or bound pack VAO.");if(failDelete){packProgramMock::pending=GL_INVALID_OPERATION;return;}deletions+=vaos.erase(*value);};
    a.BindVertexArray=[](GLuint value){packProgramMock::guard();if(failRestore&&value==70){packProgramMock::pending=GL_INVALID_OPERATION;return;}requireCPU(!value||vaos.contains(value),"Recreated missing VAO.");vao=value;};
    a.IsVertexArray=[](GLuint value)->GLboolean{packProgramMock::guard();return vaos.contains(value)?GL_TRUE:GL_FALSE;};
    a.BindBuffer=[](GLenum target,GLuint value){packProgramMock::guard();requireCPU(target==GL_ARRAY_BUFFER&&(!value||buffers.contains(value)),"Changed element buffer or recreated missing buffer.");array=value;};
    a.IsBuffer=[](GLuint value)->GLboolean{packProgramMock::guard();return buffers.contains(value)?GL_TRUE:GL_FALSE;};
    a.GetBufferParameteri64v=[](GLenum target,GLenum key,GLint64* value){packProgramMock::guard();requireCPU(target==GL_ARRAY_BUFFER&&key==GL_BUFFER_SIZE,"Wrong buffer size query.");*value=buffers.at(array).bytes;};
    a.GetBufferParameteriv=[](GLenum target,GLenum key,GLint* value){packProgramMock::guard();requireCPU(target==GL_ARRAY_BUFFER&&key==GL_BUFFER_MAPPED,"Wrong buffer mapping query.");*value=buffers.at(array).mapped;};
    a.VertexAttribPointer=[](GLuint l,GLint r,GLenum t,GLboolean n,GLsizei s,const void* o){pointer(l,r,t,n,s,o,false);};
    a.VertexAttribIPointer=[](GLuint l,GLint r,GLenum t,GLsizei s,const void* o){pointer(l,r,t,GL_FALSE,s,o,true);};
    a.EnableVertexAttribArray=[](GLuint location){packProgramMock::guard();requireCPU(vao!=70,"Enabled external vertex attribute.");vaos.at(vao).attributes[location].enabled=true;};
    a.VertexAttribDivisor=[](GLuint location,GLuint divisor){packProgramMock::guard();requireCPU(vao!=70,"Changed external instance divisor.");vaos.at(vao).attributes[location].divisor=divisor;};
    a.IsProgram=[](GLuint value)->GLboolean{packProgramMock::guard();return value==700000||packProgramMock::programs.contains(value)?GL_TRUE:GL_FALSE;};
    a.UseProgram=[](GLuint value){packProgramMock::guard();requireCPU(!value||value==700000||packProgramMock::programs.contains(value),"Used missing program.");packProgramMock::boundProgram=value;};
    a.DrawArraysInstanced=[](GLenum mode,GLint first,GLsizei count,GLsizei instances){packProgramMock::guard();requireCPU(vao!=70&&packProgramMock::programs.contains(packProgramMock::boundProgram)&&packTextureMock::bound[{expectedSamplerUnit,GL_TEXTURE_2D}]==expectedSamplerTexture,"Draw lacked own VAO, linked program or sampler texture.");++draws;lastDraw=vaos.at(vao);lastCommand={mode,first,count,instances};if(failDraw)packProgramMock::pending=GL_INVALID_OPERATION;if(loseDraw)packProgramMock::context=88;};return a;
}
PackVertexInput input(std::string name,std::string source,GLuint buffer,uint64_t bytes,GLsizei stride,GLuint divisor=0){auto owner=std::make_shared<packTextureMock::Owner>();PackVertexInput i;i.name=std::move(name);i.source=std::move(source);i.buffer=buffer;i.bytes=bytes;i.stride=stride;i.divisor=divisor;i.owner=owner;i.generation=1;i.current=[weak=std::weak_ptr<packTextureMock::Owner>(owner)](uint64_t generation){auto live=weak.lock();return live&&live->generation==generation;};return i;}
}

void testPackProgramVertices(){
    using namespace bridge::shaderloader;namespace pm=packProgramMock;namespace um=packUniformMock;namespace tm=packTextureMock;namespace vm=packVertexMock;
    auto fails=[](auto fn){try{fn();}catch(const std::exception&){return true;}return false;};pm::reset();tm::reset();vm::reset();um::units=8;um::failAt=um::loseAt=SIZE_MAX;
    pm::attributes={{"position",GL_FLOAT_VEC3,2},{"instanceMatrix",GL_FLOAT_MAT4,7},{"metadata",GL_INT_VEC2,1},{"color",GL_FLOAT_VEC4,14}};pm::uniforms={{"sourceTex",GL_SAMPLER_2D,4}};pm::outputs={{0}};
    // Hand-prepared translated ABI fixture; not a broader legacy translator claim.
    TranslatedShaderPair pair;pair.vertex.stage=PackShaderStage::Vertex;pair.fragment.stage=PackShaderStage::Fragment;for(auto* stage:{&pair.vertex,&pair.fragment}){stage->sourceVersion=120;stage->targetVersion=330;stage->sourcePaths={"vertex-bindings.glsl"};}
    pair.vertex.text="#version 330 core\nlayout(location=2) in vec3 position;layout(location=7) in mat4 instanceMatrix;layout(location=1) in ivec2 metadata;layout(location=14) in vec4 color;out vec4 tint;void main(){gl_Position=instanceMatrix*vec4(position,1.0);tint=color+vec4(vec2(metadata),0.0,0.0);}\n";
    pair.vertex.attributes={{"position","vec3"},{"instanceMatrix","mat4"},{"metadata","ivec2"},{"color","vec4"}};
    pair.vertex.varyings={{"tint","vec4"}};pair.fragment.varyings={{"tint","vec4"}};
    pair.fragment.text="#version 330 core\nin vec4 tint;uniform sampler2D sourceTex;layout(location=0) out vec4 result;void main(){result=tint*texture(sourceTex,vec2(0.5));}\n";pair.fragment.uniforms={{"sourceTex","sampler2D"}};pair.fragment.outputLocations={0};
    for(const auto& [name,text]:std::initializer_list<std::pair<const char*,std::string>>{{"pack-vertex-bindings.vert",pair.vertex.text},{"pack-vertex-bindings.frag",pair.fragment.text}}){std::ofstream out(std::string("outputs/native-renderer-verification/")+name,std::ios::binary);out<<text;requireCPU(bool(out),"Cannot write vertex binding compiler fixture.");}
    ProgramDomain domain(pm::api(),[]{return pm::context;});
    PackBindingRequest request;for(const auto& a:pm::attributes)request.attributes.push_back({a.name,"explicit:"+a.name,a.type,a.location});request.uniforms={{"sourceTex","explicit:unit",GL_SAMPLER_2D,4}};request.outputs={{0,GL_COLOR_ATTACHMENT0}};
    const std::vector<PackUniformValue> values={{"sourceTex",std::vector<int32_t>{3}}};
    auto make=[&]{auto lease=domain.compile(pair);auto w=PackUniformWriter::create(std::move(lease),request,um::api());w.write(values);return PackTextureBinder::create(std::move(w),tm::api());};
    auto textures=make();auto incomplete=vm::api();incomplete.VertexAttribDivisor=nullptr;const auto beforeApi=pm::calls;requireCPU(fails([&]{PackVertexBinder::create(std::move(textures),incomplete);})&&textures&&pm::calls==beforeApi,"Missing vertex API consumed ownership or called GL.");
    auto binder=PackVertexBinder::create(std::move(textures),vm::api());
    std::vector<PackVertexInput> inputs={vm::input("position","explicit:position",20,60,12),vm::input("instanceMatrix","explicit:instanceMatrix",30,192,64,2),vm::input("metadata","explicit:metadata",40,40,8,1),vm::input("color","explicit:color",50,20,4)};
    inputs[1].columnStride=16;inputs[2].storage=GL_INT;inputs[3].storage=GL_UNSIGNED_BYTE;inputs[3].normalized=true;
    const std::vector<PackTextureInput> images={tm::input("sourceTex",5000,GL_TEXTURE_2D,GL_RGBA8,8,4)};const PackArrayDraw draw={GL_TRIANGLES,2,3,5};
    auto restored=[&]{requireCPU(vm::vao==70&&vm::array==10&&pm::boundProgram==700000&&vm::vaos.size()==1&&vm::vaos.at(70).element==777&&vm::vaos.at(70).attributes.size()==1&&vm::vaos.at(70).attributes.at(15).divisor==9&&!binder->pendingRestore()&&tm::active==GL_TEXTURE0+6&&tm::bound[{3,GL_TEXTURE_2D}]==50,"Vertex scope leaked state/resources or modified external VAO/element binding.");};
    binder->draw(inputs,images,draw);restored();requireCPU(vm::draws==1&&vm::lastCommand.first==2&&vm::lastCommand.count==3&&vm::lastCommand.instances==5&&vm::lastDraw.attributes.size()==7,"Array/instance draw lost exact command or matrix columns.");
    const auto& a=vm::lastDraw.attributes;requireCPU(a.at(2).buffer==20&&a.at(2).rows==3&&a.at(2).stride==12&&!a.at(2).integer&&a.at(1).integer&&a.at(1).buffer==40&&a.at(14).normalized==GL_TRUE&&a.at(14).storage==GL_UNSIGNED_BYTE,"Float/integer/normalized vertex pointer routes are wrong.");
    for(GLuint column=0;column<4;++column)requireCPU(a.at(7+column).buffer==30&&a.at(7+column).offset==column*16&&a.at(7+column).divisor==2&&a.at(7+column).enabled,"Matrix column location/offset/divisor is wrong.");
    auto invalid=[&](auto change){auto bad=inputs;change(bad);const auto draws=vm::draws;requireCPU(fails([&]{binder->draw(bad,images,draw);})&&vm::draws==draws,"Invalid buffer reached native draw.");restored();};
    invalid([](auto& v){v.pop_back();});invalid([](auto& v){v[0].name="missing";});invalid([](auto& v){v[1]=v[0];});invalid([](auto& v){v[0].source="guessed:position";});invalid([](auto& v){v[0].buffer=999;});invalid([](auto& v){v[0].generation=2;});invalid([](auto& v){v[0].owner.reset();});
    invalid([](auto& v){v[0].bytes=59;});invalid([](auto& v){v[0].offset=UINT64_MAX;});invalid([](auto& v){v[0].offset=1;});invalid([](auto& v){v[0].stride=0;});invalid([](auto& v){v[0].stride=4096;});invalid([](auto& v){v[1].columnStride=12;});invalid([](auto& v){v[1].divisor=1;});invalid([](auto& v){v[2].normalized=true;});invalid([](auto& v){v[2].storage=GL_FLOAT;});invalid([](auto& v){v[3].storage=GL_UNSIGNED_INT;});
    invalid([](auto& v){v.resize(17);});invalid([](auto& v){v[0].name=std::string(256,'x');});invalid([](auto& v){v[0].source=std::string(128,'x');});
    auto badDraw=[&](PackArrayDraw command){const auto allocations=vm::allocations;requireCPU(fails([&]{binder->draw(inputs,images,command);})&&vm::allocations==allocations,"Invalid draw allocated a VAO.");restored();};
    badDraw({GL_TRIANGLES,-1,3,5});badDraw({GL_TRIANGLES,2,0,5});badDraw({GL_TRIANGLES,2,3,0});badDraw({GL_PATCHES,2,3,5});badDraw({GL_TRIANGLES,INT_MAX,3,5});badDraw({GL_TRIANGLES,0,4194304,2});badDraw({GL_TRIANGLES,3,3,5});
    vm::buffers.at(20).mapped=GL_TRUE;invalid([](auto&){});vm::buffers.at(20).mapped=GL_FALSE;vm::buffers.at(20).bytes=61;invalid([](auto&){});vm::buffers.at(20).bytes=60;
    vm::transformFeedback=true;const auto beforeFeedback=vm::allocations;requireCPU(fails([&]{binder->draw(inputs,images,draw);})&&vm::allocations==beforeFeedback,"Active transform feedback was accepted.");vm::transformFeedback=false;restored();
    vm::failPointer=true;requireCPU(fails([&]{binder->draw(inputs,images,draw);}),"Pointer API error was ignored.");restored();
    vm::failDraw=true;requireCPU(fails([&]{binder->draw(inputs,images,draw);}),"Native draw error was ignored.");vm::failDraw=false;restored();
    auto badImage=images;badImage[0].width=7;const auto beforeImage=vm::draws;requireCPU(fails([&]{binder->draw(inputs,badImage,draw);})&&vm::draws==beforeImage,"Texture validation failure reached vertex draw.");restored();
    const auto beforeThread=pm::calls;std::thread foreign([&]{requireCPU(fails([&]{binder->draw(inputs,images,draw);}),"Foreign thread entered vertex scope.");});foreign.join();requireCPU(pm::calls==beforeThread,"Foreign thread called vertex GL API.");
    auto reentry=inputs;reentry[0].current=[&](uint64_t){requireCPU(fails([&]{binder->collect();})&&fails([&]{binder->draw(inputs,images,draw);}),"Reentrant vertex mutation was accepted.");return true;};binder->draw(reentry,images,draw);restored();
    // Invalid uniform uploads must remain recoverable through the owned writer.
    requireCPU(fails([&]{binder->write({});})&&fails([&]{binder->draw(inputs,images,draw);}),"Unready uniforms reached vertex draw.");binder->write(values);restored();
    vm::failRestore=true;requireCPU(fails([&]{binder->draw(inputs,images,draw);})&&binder->pendingRestore()&&vm::vaos.size()==2,"Failed VAO restoration lost pending ownership.");vm::failRestore=false;binder->collect();restored();
    vm::failDelete=true;requireCPU(fails([&]{binder->draw(inputs,images,draw);})&&binder->pendingRestore()&&vm::vaos.size()==2,"Failed VAO deletion was claimed complete.");vm::failDelete=false;binder->collect();restored();
    vm::loseGen=true;requireCPU(fails([&]{binder->draw(inputs,images,draw);})&&binder->pendingRestore()&&vm::vaos.size()==2,"Context loss after allocation lost the candidate VAO.");auto foreignCalls=pm::calls;requireCPU(fails([&]{binder->collect();})&&pm::calls==foreignCalls,"Foreign context received VAO cleanup.");pm::context=77;vm::loseGen=false;binder->collect();restored();
    vm::loseDraw=true;requireCPU(fails([&]{binder->draw(inputs,images,draw);})&&binder->pendingRestore(),"Context loss during draw lost pending state.");foreignCalls=pm::calls;requireCPU(fails([&]{binder->collect();})&&pm::calls==foreignCalls,"Foreign context received draw cleanup.");pm::context=77;vm::loseDraw=false;binder->collect();restored();
    const auto diagnostic=PackVertexBinder::unrestoredOnDestruction();binder.reset();domain.collect();requireCPU(vm::allocations==vm::deletions&&PackVertexBinder::unrestoredOnDestruction()==diagnostic,"Normal vertex lifecycle leaked VAOs.");
    // Deliberate mock contract violation: final destruction on a foreign context.
    binder=PackVertexBinder::create(make(),vm::api());vm::loseGen=true;requireCPU(fails([&]{binder->draw(inputs,images,draw);}),"Final context loss was ignored.");foreignCalls=pm::calls;binder.reset();requireCPU(pm::calls==foreignCalls&&PackVertexBinder::unrestoredOnDestruction()==diagnostic+1,"Foreign destructor touched GL or claimed cleanup.");pm::context=77;vm::loseGen=false;domain.collect();domain.close();requireCPU(pm::programs.empty()&&pm::shaders.empty(),"Vertex tests leaked program leases.");vm::vaos.clear();
}
