#pragma once
#include <map>
namespace packTextureMock {
using namespace bridge::shaderloader;
struct Level {GLint width,height,depth,format;};
struct Texture {GLenum target;PackTextureSampling sampling;GLint compare=GL_NONE,base=0,maximum=1000,depthMode=GL_DEPTH_COMPONENT;std::map<std::pair<GLenum,GLint>,Level> levels;};
struct Sampler {PackTextureSampling sampling;GLint compare=GL_NONE;};
std::unordered_map<GLuint,Texture> textures;std::unordered_map<GLuint,Sampler> samplers;
std::map<std::pair<uint32_t,GLenum>,GLuint> bound;std::map<uint32_t,GLuint> boundSamplers;
std::map<GLenum,GLuint> attachments;GLenum active=GL_TEXTURE0+6;GLuint framebuffer=0;size_t mutations=0;bool failSampler=false,persistentSamplerFailure=false;
GLenum baseTarget(GLenum target){return target>=GL_TEXTURE_CUBE_MAP_POSITIVE_X&&target<=GL_TEXTURE_CUBE_MAP_NEGATIVE_Z?GL_TEXTURE_CUBE_MAP:target;}
uint32_t unit(){return active-GL_TEXTURE0;}
GLint parameter(const PackTextureSampling& s,GLint compare,GLenum key){switch(key){case GL_TEXTURE_MIN_FILTER:return s.min;case GL_TEXTURE_MAG_FILTER:return s.mag;case GL_TEXTURE_WRAP_S:return s.wrapS;case GL_TEXTURE_WRAP_T:return s.wrapT;case GL_TEXTURE_WRAP_R:return s.wrapR;case GL_TEXTURE_COMPARE_MODE:return compare;default:throw std::runtime_error("Unexpected mock sampler integer query.");}}
GLfloat real(const PackTextureSampling& s,GLenum key){switch(key){case GL_TEXTURE_MIN_LOD:return s.minLod;case GL_TEXTURE_MAX_LOD:return s.maxLod;case GL_TEXTURE_LOD_BIAS:return s.lodBias;default:throw std::runtime_error("Unexpected mock sampler float query.");}}
void add(GLuint id,GLenum target,std::initializer_list<Level> levels){Texture t;t.target=target;GLint n=0;for(const auto& level:levels){for(unsigned f=0;f<(target==GL_TEXTURE_CUBE_MAP?6u:1u);++f)t.levels[{target==GL_TEXTURE_CUBE_MAP?GL_TEXTURE_CUBE_MAP_POSITIVE_X+f:target,n}]=level;++n;}textures[id]=std::move(t);}
void reset(){textures.clear();samplers.clear();bound.clear();boundSamplers.clear();attachments.clear();active=GL_TEXTURE0+6;framebuffer=0;mutations=0;failSampler=persistentSamplerFailure=false;
    add(50,GL_TEXTURE_2D,{{1,1,1,GL_RGBA8}});add(51,GL_TEXTURE_CUBE_MAP,{{1,1,1,GL_RGBA8}});samplers[900]={};bound[{3,GL_TEXTURE_2D}]=50;bound[{3,GL_TEXTURE_CUBE_MAP}]=51;boundSamplers[3]=900;
    add(5000,GL_TEXTURE_2D,{{8,4,1,GL_RGBA8},{4,2,1,GL_RGBA8},{2,1,1,GL_RGBA8},{1,1,1,GL_RGBA8}});
    add(6000,GL_TEXTURE_2D,{{8,4,1,GL_DEPTH_COMPONENT24}});
    add(7000,GL_TEXTURE_3D,{{4,4,4,GL_R16F},{2,2,2,GL_R16F},{1,1,1,GL_R16F}});
    add(8000,GL_TEXTURE_CUBE_MAP,{{4,4,1,GL_RGBA16F},{2,2,1,GL_RGBA16F},{1,1,1,GL_RGBA16F}});samplers[1000]={};samplers[1000].sampling.min=samplers[1000].sampling.mag=GL_LINEAR;
}
PackTextureApi api(){PackTextureApi a;
    a.GetError=[]()->GLenum{packProgramMock::guard();const auto e=packProgramMock::pending;packProgramMock::pending=GL_NO_ERROR;return e;};
    a.GetIntegerv=[](GLenum key,GLint* v){packProgramMock::guard();if(key==GL_ACTIVE_TEXTURE)*v=static_cast<GLint>(active);else if(key==GL_MAX_COLOR_ATTACHMENTS)*v=8;else if(key==GL_DRAW_FRAMEBUFFER_BINDING)*v=framebuffer;else{const GLenum target=key==GL_TEXTURE_BINDING_2D?GL_TEXTURE_2D:key==GL_TEXTURE_BINDING_3D?GL_TEXTURE_3D:key==GL_TEXTURE_BINDING_CUBE_MAP?GL_TEXTURE_CUBE_MAP:0;requireCPU(target!=0,"Unknown texture binding query.");*v=static_cast<GLint>(bound[{unit(),target}]);}};
    a.GetIntegeri_v=[](GLenum key,GLuint unit,GLint* v){packProgramMock::guard();requireCPU(key==GL_SAMPLER_BINDING,"Unknown indexed sampler query.");*v=static_cast<GLint>(boundSamplers[unit]);};
    a.ActiveTexture=[](GLenum value){packProgramMock::guard();++mutations;active=value;};
    a.BindTexture=[](GLenum target,GLuint texture){packProgramMock::guard();++mutations;if(texture&&(!textures.contains(texture)||textures.at(texture).target!=target)){packProgramMock::pending=GL_INVALID_OPERATION;return;}bound[{unit(),target}]=texture;};
    a.BindSampler=[](GLuint unit,GLuint sampler){packProgramMock::guard();++mutations;if(failSampler||persistentSamplerFailure){failSampler=false;packProgramMock::pending=GL_INVALID_OPERATION;return;}requireCPU(!sampler||samplers.contains(sampler),"Unknown sampler was rebound.");boundSamplers[unit]=sampler;};
    a.IsTexture=[](GLuint texture)->GLboolean{packProgramMock::guard();return textures.contains(texture)?GL_TRUE:GL_FALSE;};
    a.IsSampler=[](GLuint sampler)->GLboolean{packProgramMock::guard();return samplers.contains(sampler)?GL_TRUE:GL_FALSE;};
    a.GetTexParameteriv=[](GLenum target,GLenum key,GLint* v){packProgramMock::guard();const auto& t=textures.at(bound.at({unit(),target}));*v=key==GL_TEXTURE_BASE_LEVEL?t.base:key==GL_TEXTURE_MAX_LEVEL?t.maximum:key==GL_DEPTH_STENCIL_TEXTURE_MODE?t.depthMode:parameter(t.sampling,t.compare,key);};
    a.GetTexParameterfv=[](GLenum target,GLenum key,GLfloat* v){packProgramMock::guard();*v=real(textures.at(bound.at({unit(),target})).sampling,key);};
    a.GetSamplerParameteriv=[](GLuint sampler,GLenum key,GLint* v){packProgramMock::guard();const auto& s=samplers.at(sampler);*v=parameter(s.sampling,s.compare,key);};
    a.GetSamplerParameterfv=[](GLuint sampler,GLenum key,GLfloat* v){packProgramMock::guard();*v=real(samplers.at(sampler).sampling,key);};
    a.GetTexLevelParameteriv=[](GLenum target,GLint n,GLenum key,GLint* v){packProgramMock::guard();const auto& t=textures.at(bound.at({unit(),baseTarget(target)}));const auto at=t.levels.find({target,n});const auto level=at==t.levels.end()?Level{}:at->second;*v=key==GL_TEXTURE_WIDTH?level.width:key==GL_TEXTURE_HEIGHT?level.height:key==GL_TEXTURE_DEPTH?level.depth:key==GL_TEXTURE_INTERNAL_FORMAT?level.format:0;};
    a.GetFramebufferAttachmentParameteriv=[](GLenum target,GLenum point,GLenum key,GLint* v){packProgramMock::guard();requireCPU(target==GL_DRAW_FRAMEBUFFER,"Wrong feedback query target.");const auto at=attachments.find(point);*v=key==GL_FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE?(at==attachments.end()?GL_NONE:GL_TEXTURE):at==attachments.end()?0:static_cast<GLint>(at->second);};return a;
}
struct Owner {uint64_t generation=1;};
PackTextureInput input(std::string name,GLuint texture,GLenum target,GLenum format,GLint w,GLint h,GLint d=1){
    auto owner=std::make_shared<Owner>();PackTextureInput input;input.name=std::move(name);input.texture=texture;input.target=target;input.format=format;input.width=w;input.height=h;input.depth=d;input.owner=owner;input.generation=1;input.current=[weak=std::weak_ptr<Owner>(owner)](uint64_t generation){const auto live=weak.lock();return live&&live->generation==generation;};return input;
}
}

void testPackProgramTextures(){
    using namespace bridge::shaderloader;namespace pm=packProgramMock;namespace um=packUniformMock;namespace tm=packTextureMock;
    const auto fails=[](auto fn){try{fn();}catch(const std::exception&){return true;}return false;};
    pm::reset();tm::reset();um::units=8;um::failAt=um::loseAt=SIZE_MAX;
    ProgramDomain domain(pm::api(),[]{return pm::context;});std::ifstream file("outputs/native-renderer-verification/translation-source-fixture.bin",std::ios::binary);const std::vector<uint8_t> bytes(std::istreambuf_iterator<char>(file),{});const auto sources=PackSources::decode(bytes);
    PackBindingRequest request{{{"position","explicit:position",GL_FLOAT_VEC3,2},{"coord","explicit:uv",GL_FLOAT_VEC2,7}},{{"transform","explicit:matrix",GL_FLOAT_MAT4,11},{"sourceTex","explicit:unit",GL_SAMPLER_2D,4}},{{0,GL_COLOR_ATTACHMENT0},{2,GL_COLOR_ATTACHMENT3}}};
    std::vector<PackUniformValue> values={{"transform",std::vector<float>(16,1)},{"sourceTex",std::vector<int32_t>{3}}};
    auto lease=domain.compilePack(*sources,"legacy.vsh","legacy.fsh",{{"MRT","1"}});const auto id=lease.handle();auto writer=PackUniformWriter::create(std::move(lease),request,um::api());
    requireCPU(fails([&]{PackTextureBinder::create(std::move(writer),tm::api());}),"Texture binder accepted uniforms without successful upload.");writer.write(values);
    auto api=tm::api();api.BindTexture=nullptr;const auto calls=pm::calls;requireCPU(fails([&]{PackTextureBinder::create(std::move(writer),api);})&&writer.programForDraw()==id&&pm::calls==calls,"Incomplete texture API consumed the writer or touched GL.");
    auto binder=PackTextureBinder::create(std::move(writer),tm::api());auto input=tm::input("sourceTex",5000,GL_TEXTURE_2D,GL_RGBA8,8,4);input.sampler=1000;input.sampling.min=input.sampling.mag=GL_LINEAR;
    const auto original=tm::bound;const auto originalSamplers=tm::boundSamplers;const auto originalActive=tm::active;unsigned draws=0;
    const auto restored=[&]{requireCPU(tm::bound[{3,GL_TEXTURE_2D}]==50&&tm::bound[{3,GL_TEXTURE_CUBE_MAP}]==51&&tm::boundSamplers[3]==900&&tm::active==originalActive&&!binder->pendingRestore(),"Texture scope did not restore previous texture/sampler/active unit.");};
    binder->run({input},[&](GLuint program){++draws;requireCPU(program==id&&tm::bound[{3,GL_TEXTURE_2D}]==5000&&tm::boundSamplers[3]==1000,"Texture scope did not bind the successfully uploaded sampler unit.");requireCPU(fails([&]{binder->write(values);}),"Reentrant uniform change was accepted inside texture scope.");});restored();requireCPU(draws==1&&tm::textures.at(5000).sampling.min==GL_NEAREST,"Texture scope mutated source sampling state.");
    auto invalid=[&](auto change){auto bad=input;change(bad);const auto before=draws;requireCPU(fails([&]{binder->run({bad},[&](GLuint){++draws;});})&&draws==before,"Invalid texture reached draw callback.");restored();};
    invalid([](auto& i){i.width=7;});invalid([](auto& i){i.target=GL_TEXTURE_3D;});invalid([](auto& i){i.format=GL_RGBA8UI;});invalid([](auto& i){i.texture=99999;});invalid([](auto& i){i.sampler=99999;});invalid([](auto& i){i.sampling.min=GL_NEAREST;});invalid([](auto& i){i.generation=2;});invalid([](auto& i){i.owner.reset();});invalid([](auto& i){i.name="notActive";});
    for(const auto attachment:{GL_COLOR_ATTACHMENT0,GL_DEPTH_ATTACHMENT,GL_STENCIL_ATTACHMENT}){tm::framebuffer=123;tm::attachments[attachment]=5000;const auto mutations=tm::mutations;requireCPU(fails([&]{binder->run({input},[&](GLuint){++draws;});})&&tm::mutations==mutations,"Framebuffer texture feedback mutated bindings or reached draw.");tm::attachments.clear();}tm::framebuffer=0;
    auto savedSampling=tm::samplers.at(1000);tm::samplers.at(1000).compare=GL_COMPARE_REF_TO_TEXTURE;requireCPU(fails([&]{binder->run({input},[](GLuint){});}),"Shadow compare sampler passed a non-shadow uniform.");tm::samplers.at(1000)=savedSampling;restored();
    tm::failSampler=true;requireCPU(fails([&]{binder->run({input},[](GLuint){});}),"Injected binding error was ignored.");restored();
    requireCPU(fails([&]{binder->run({input},[](GLuint){throw std::runtime_error("draw failed");});}),"Draw callback exception was swallowed.");restored();
    requireCPU(fails([&]{binder->run({input},[&](GLuint){tm::persistentSamplerFailure=true;});})&&binder->pendingRestore(),"Restoration failure was claimed successful.");tm::persistentSamplerFailure=false;binder->collect();restored();
    size_t foreignCalls=0;requireCPU(fails([&]{binder->run({input},[&](GLuint){pm::context=88;foreignCalls=pm::calls;});})&&pm::calls==foreignCalls&&binder->pendingRestore(),"Changed context received restoration calls or lost pending cleanup.");pm::context=77;binder->collect();restored();
    const auto beforeThread=pm::calls;std::thread foreign([&]{requireCPU(fails([&]{binder->run({input},[](GLuint){});}),"Foreign thread entered a texture scope.");});foreign.join();requireCPU(pm::calls==beforeThread,"Foreign thread reached texture GL API.");
    auto owner=std::static_pointer_cast<const tm::Owner>(input.owner);requireCPU(fails([&]{binder->run({input},[&](GLuint){const_cast<tm::Owner&>(*owner).generation=2;});}),"Changed texture generation was accepted at scope completion.");restored();const_cast<tm::Owner&>(*owner).generation=1;
    binder.reset();domain.collect();requireCPU(domain.outstanding()==0,"Texture binder failed to retire its program lease.");

    auto make=[&](const std::vector<pm::Resource>& resources,const std::vector<PackUniformValue>& uniforms){
        pm::attributes={{"position",GL_FLOAT_VEC3,2}};pm::uniforms=resources;pm::outputs={{0}};
        TranslatedShaderPair pair;pair.vertex.stage=PackShaderStage::Vertex;pair.fragment.stage=PackShaderStage::Fragment;for(auto* stage:{&pair.vertex,&pair.fragment}){stage->sourceVersion=120;stage->targetVersion=330;stage->sourcePaths={"texture-bindings.glsl"};}
        pair.vertex.text="#version 330 core\nin vec3 position;void main(){gl_Position=vec4(position,1.0);}\n";pair.vertex.attributes={{"position","vec3"}};pair.fragment.text="#version 330 core\nlayout(location=0) out vec4 result;\n";pair.fragment.outputLocations={0};
        PackBindingRequest routes;routes.attributes={{"position","explicit:position",GL_FLOAT_VEC3,2}};routes.outputs={{0,GL_COLOR_ATTACHMENT0}};std::string expression="vec4(0.0)";
        for(const auto& r:resources){const std::string type=r.type==GL_SAMPLER_2D?"sampler2D":r.type==GL_SAMPLER_3D?"sampler3D":"samplerCube";pair.fragment.uniforms.push_back({r.name,type});pair.fragment.text+="uniform "+type+" "+r.name+";\n";expression+="+texture("+r.name+","+(r.type==GL_SAMPLER_2D?"vec2(0.25)":"vec3(0.25)")+")";routes.uniforms.push_back({r.name,"explicit:unit",r.type,r.location});}pair.fragment.text+="void main(){result="+expression+";}\n";
        if(resources.size()==3){for(const auto& [name,text]:std::initializer_list<std::pair<const char*,std::string>>{{"pack-texture-bindings.vert",pair.vertex.text},{"pack-texture-bindings.frag",pair.fragment.text}}){std::ofstream out(std::string("outputs/native-renderer-verification/")+name,std::ios::binary);out<<text;requireCPU(bool(out),"Cannot write texture binding compiler fixture.");}}
        auto lease=domain.compile(pair);auto writer=PackUniformWriter::create(std::move(lease),routes,um::api());writer.write(uniforms);return PackTextureBinder::create(std::move(writer),tm::api());
    };
    binder=make({{"colorTex",GL_SAMPLER_2D,4},{"volumeTex",GL_SAMPLER_3D,12},{"cubeTex",GL_SAMPLER_CUBE,20}},{{"colorTex",std::vector<int32_t>{1}},{"volumeTex",std::vector<int32_t>{2}},{"cubeTex",std::vector<int32_t>{4}}});
    auto color=tm::input("colorTex",6000,GL_TEXTURE_2D,GL_DEPTH_COMPONENT24,8,4);auto volume=tm::input("volumeTex",7000,GL_TEXTURE_3D,GL_R16F,4,4,4);auto cube=tm::input("cubeTex",8000,GL_TEXTURE_CUBE_MAP,GL_RGBA16F,4,4);
    volume.sampling.min=cube.sampling.min=GL_LINEAR_MIPMAP_LINEAR;tm::textures.at(7000).sampling.min=tm::textures.at(8000).sampling.min=GL_LINEAR_MIPMAP_LINEAR;
    binder->run({color,volume,cube},[&](GLuint){requireCPU(tm::bound[{1,GL_TEXTURE_2D}]==6000&&tm::bound[{2,GL_TEXTURE_3D}]==7000&&tm::bound[{4,GL_TEXTURE_CUBE_MAP}]==8000,"2D depth/3D/cube routes did not bind exact units/targets.");});
    requireCPU(tm::active==originalActive&&tm::bound[{1,GL_TEXTURE_2D}]==0&&tm::bound[{2,GL_TEXTURE_3D}]==0&&tm::bound[{4,GL_TEXTURE_CUBE_MAP}]==0,"Multi-target scope leaked bindings.");
    auto missing=tm::textures.at(7000).levels.extract({GL_TEXTURE_3D,1});requireCPU(fails([&]{binder->run({color,volume,cube},[](GLuint){});}),"Incomplete 3D mip chain was accepted.");tm::textures.at(7000).levels.insert(std::move(missing));
    tm::textures.at(8000).levels.at({GL_TEXTURE_CUBE_MAP_NEGATIVE_Z,2}).width=2;requireCPU(fails([&]{binder->run({color,volume,cube},[](GLuint){});}),"Wrong cube-face mip dimensions were accepted.");tm::textures.at(8000).levels.at({GL_TEXTURE_CUBE_MAP_NEGATIVE_Z,2}).width=1;
    binder.reset();domain.collect();
    binder=make({{"first",GL_SAMPLER_2D,3},{"second",GL_SAMPLER_2D,8}},{{"first",std::vector<int32_t>{3}},{"second",std::vector<int32_t>{3}}});auto first=input;first.name="first";auto second=first;second.name="second";binder->run({first,second},[](GLuint){});second.texture=6000;second.format=GL_DEPTH_COMPONENT24;requireCPU(fails([&]{binder->run({first,second},[](GLuint){});}),"Conflicting textures shared the same sampler unit.");
    const auto unrestored=PackTextureBinder::unrestoredOnDestruction();requireCPU(fails([&]{binder->run({first,PackTextureInput{first}},[](GLuint){});}),"Duplicate sampler names were accepted.");
    requireCPU(fails([&]{binder->run({first,PackTextureInput{input}},[](GLuint){});}),"Missing sampler route was accepted.");
    second=first;second.name="second";requireCPU(fails([&]{binder->run({first,second},[&](GLuint){pm::context=88;});}),"Final context change was ignored.");const auto destructionCalls=pm::calls;binder.reset();requireCPU(pm::calls==destructionCalls&&PackTextureBinder::unrestoredOnDestruction()==unrestored+1,"Foreign-context destruction called GL or claimed restoration.");pm::context=77;domain.collect();domain.close();requireCPU(pm::programs.empty()&&pm::shaders.empty(),"Texture tests leaked program ownership.");
}
