#pragma once
namespace geometryMock {
struct Resource {std::string name;GLint location;GLenum type;};
struct Program {std::vector<Resource> attributes,uniforms;std::vector<GLenum> outputs;};
std::unordered_map<GLuint,Program> programs;
std::unordered_map<GLuint,std::map<GLint,glm::mat4>> matrices;
std::unordered_map<GLuint,std::map<GLint,int>> integers;
std::unordered_map<GLuint,std::map<GLint,glm::vec4>> vectors;
struct Attribute {GLuint buffer=0,divisor=0;GLint size=0;GLsizei stride=0;uintptr_t offset=0;bool integer=false,enabled=false;};
std::unordered_map<GLuint,std::array<Attribute,16>> attributes;
struct Draw {GLuint program,vao,depth;std::map<GLint,glm::mat4> matrices;std::map<GLint,int> integers;std::array<Attribute,16> attributes;size_t stamp;GLuint depthSample,colorOutput;std::map<GLint,glm::vec4> vectors;};
std::vector<Draw> draws;GLuint failProgram=0;
PFNGLGETPROGRAMIVPROC oldProgram;PFNGLGETUNIFORMLOCATIONPROC oldLocation;PFNGLUNIFORMMATRIX4FVPROC oldMatrix;PFNGLUNIFORM1IPROC oldInteger;
PFNGLDRAWELEMENTSPROC oldDraw;PFNGLDRAWELEMENTSINSTANCEDPROC oldInstanced;
void record(){if(!programs.contains(mock::currentProgram))return;
    draws.push_back({mock::currentProgram,mock::currentVao,mock::framebufferTextures[mock::drawFramebuffer][GL_DEPTH_ATTACHMENT],matrices[mock::currentProgram],integers[mock::currentProgram],attributes[mock::currentVao],mock::geometryDraws.size(),graphMock::textureBindings[GL_TEXTURE3][GL_TEXTURE_2D],mock::framebufferTextures[mock::drawFramebuffer][GL_COLOR_ATTACHMENT0],vectors[mock::currentProgram]});
    if(failProgram==mock::currentProgram){mock::pendingError=GL_INVALID_OPERATION;failProgram=0;}
}
void initialize(){
    oldProgram=nativegl::glGetProgramiv;oldLocation=nativegl::glGetUniformLocation;oldMatrix=nativegl::glUniformMatrix4fv;oldInteger=nativegl::glUniform1i;oldDraw=nativegl::glDrawElements;oldInstanced=nativegl::glDrawElementsInstanced;
    nativegl::glGetProgramiv=[](GLuint id,GLenum key,GLint* out){if(!programs.contains(id)){oldProgram(id,key,out);return;}const auto& p=programs.at(id);
        switch(key){case GL_LINK_STATUS:*out=1;break;case GL_ACTIVE_UNIFORM_BLOCKS:*out=0;break;case GL_ACTIVE_UNIFORMS:*out=static_cast<GLint>(p.uniforms.size());break;case GL_ACTIVE_ATTRIBUTES:*out=static_cast<GLint>(p.attributes.size());break;default:throw std::runtime_error("Unexpected geometry reflection query.");}};
    nativegl::glGetProgramInterfaceiv=[](GLuint id,GLenum interface,GLenum,GLint* out){*out=interface==GL_PROGRAM_OUTPUT?static_cast<GLint>(programs.at(id).outputs.size()):0;};
    nativegl::glGetProgramResourceiv=[](GLuint id,GLenum,GLuint index,GLsizei,const GLenum*,GLsizei,GLsizei*,GLint* out){out[0]=index;out[1]=programs.at(id).outputs.at(index);out[2]=1;};
    nativegl::glGetAttachedShaders=[](GLuint,GLsizei,GLsizei* count,GLuint* ids){*count=2;ids[0]=1;ids[1]=2;};
    nativegl::glGetShaderiv=[](GLuint id,GLenum,GLint* out){*out=id==1?GL_VERTEX_SHADER:GL_FRAGMENT_SHADER;};
    nativegl::glGetUniformLocation=[](GLuint id,const char* name)->GLint{if(!programs.contains(id))return oldLocation(id,name);for(const auto& u:programs.at(id).uniforms)if(u.name==name)return u.location;return -1;};
    nativegl::glGetAttribLocation=[](GLuint id,const char* name)->GLint{for(const auto& a:programs.at(id).attributes)if(a.name==name)return a.location;return -1;};
    nativegl::glGetActiveUniform=[](GLuint id,GLuint index,GLsizei,GLsizei* length,GLint* size,GLenum* type,char* name){const auto& r=programs.at(id).uniforms.at(index);*length=static_cast<GLsizei>(r.name.size());*size=1;*type=r.type;std::copy(r.name.begin(),r.name.end(),name);name[r.name.size()]=0;};
    nativegl::glGetActiveAttrib=[](GLuint id,GLuint index,GLsizei,GLsizei* length,GLint* size,GLenum* type,char* name){const auto& r=programs.at(id).attributes.at(index);*length=static_cast<GLsizei>(r.name.size());*size=1;*type=r.type;std::copy(r.name.begin(),r.name.end(),name);name[r.name.size()]=0;};
    nativegl::glUniformMatrix4fv=[](GLint loc,GLsizei count,GLboolean transpose,const GLfloat* value){oldMatrix(loc,count,transpose,value);matrices[mock::currentProgram][loc]=glm::make_mat4(value);};
    nativegl::glUniform1i=[](GLint loc,GLint value){oldInteger(loc,value);integers[mock::currentProgram][loc]=value;};
    nativegl::glEnableVertexAttribArray=[](GLuint loc){attributes[mock::currentVao][loc].enabled=true;};
    nativegl::glDisableVertexAttribArray=[](GLuint loc){attributes[mock::currentVao][loc].enabled=false;};
    nativegl::glVertexAttribDivisor=[](GLuint loc,GLuint d){attributes[mock::currentVao][loc].divisor=d;};
    nativegl::glVertexAttribPointer=[](GLuint loc,GLint size,GLenum,GLboolean,GLsizei stride,const void* offset){auto& a=attributes[mock::currentVao][loc];a.buffer=mock::bufferBindings[GL_ARRAY_BUFFER];a.size=size;a.stride=stride;a.offset=reinterpret_cast<uintptr_t>(offset);a.integer=false;};
    nativegl::glVertexAttribIPointer=[](GLuint loc,GLint size,GLenum,GLsizei stride,const void* offset){auto& a=attributes[mock::currentVao][loc];a.buffer=mock::bufferBindings[GL_ARRAY_BUFFER];a.size=size;a.stride=stride;a.offset=reinterpret_cast<uintptr_t>(offset);a.integer=true;};
    nativegl::glDrawElements=[](GLenum mode,GLsizei count,GLenum type,const void* ptr){oldDraw(mode,count,type,ptr);record();};
    nativegl::glDrawElementsInstanced=[](GLenum mode,GLsizei count,GLenum type,const void* ptr,GLsizei n){oldInstanced(mode,count,type,ptr,n);record();};
}
bridge::IrisGeometryProgram fixture(GLuint id){
    using namespace bridge;using A=GeometryAttribute;using U=GeometryUniform;IrisGeometryProgram p;p.program.handle=id;p.program.outputs={{0,false},{1,false}};
    p.attributes={{"vaPosition",0,A::Position},{"vaNormal",1,A::Normal},{"vaUV0",2,A::UV},{"vaColor",3,A::Color},{"sourceInstanceMatrix",6,A::InstanceMatrix}};
    p.uniforms={{"modelViewMatrix",100,U::ModelView},{"projectionMatrix",101,U::Projection},{"textureMatrix",102,U::TextureMatrix},{"normalMatrix",103,U::NormalMatrix},{"sourceInstanced",104,U::Instanced},{"alphaTestRef",105,U::AlphaCutoff},
        {"gbufferProjection",106,U::GbufferProjection},{"gbufferModelView",107,U::GbufferModelView,"feetKnown",108},
        {"gbufferPreviousModelView",109,U::PreviousModelView,"historyKnown",110},{"worldTime",111,U::WorldTime,"worldTimeKnown",112}};
    p.samplers={{"gtexture",120,0,GeometrySampler::Texture}};
    // Independent reflected shader interface, including test-only temporal probes.
    programs[id]={{{"vaPosition",0,GL_FLOAT_VEC3},{"vaNormal",1,GL_FLOAT_VEC3},{"vaUV0",2,GL_FLOAT_VEC2},{"vaColor",3,GL_FLOAT_VEC4},{"sourceInstanceMatrix",6,GL_FLOAT_MAT4}},
        {{"modelViewMatrix",100,GL_FLOAT_MAT4},{"projectionMatrix",101,GL_FLOAT_MAT4},{"textureMatrix",102,GL_FLOAT_MAT4},{"normalMatrix",103,GL_FLOAT_MAT3},{"sourceInstanced",104,GL_INT},{"alphaTestRef",105,GL_FLOAT},
        {"gbufferProjection",106,GL_FLOAT_MAT4},{"gbufferModelView",107,GL_FLOAT_MAT4},{"feetKnown",108,GL_BOOL},{"gbufferPreviousModelView",109,GL_FLOAT_MAT4},{"historyKnown",110,GL_BOOL},{"worldTime",111,GL_INT},{"worldTimeKnown",112,GL_BOOL},{"gtexture",120,GL_SAMPLER_2D}},
        {GL_FLOAT_VEC4,GL_FLOAT_VEC4}};return p;
}
}
void testGeometryBindings(){
    using namespace bridge;using S=GeometrySlot;geometryMock::initialize();
    const auto rejects=[](auto fn){try{fn();}catch(const std::exception&){return true;}return false;};
    const auto matrixNear=[](const glm::mat4& a,const glm::mat4& b){for(int i=0;i<16;++i)if(std::abs(glm::value_ptr(a)[i]-glm::value_ptr(b)[i])>1e-4f)return false;return true;};
    IrisHandProjection hand;hand.known=true;hand.hudFovRadians=1.1f;hand.depthFar=128;hand.bob=glm::rotate(glm::mat4(1),.1f,glm::vec3(0,0,1));
    const auto p=hand.projection(64,32,false);auto zo=glm::perspectiveRH_ZO(1.1f,2.f,.05f,128.f);glm::mat4 compression(1),canonical(1);compression[2][2]=.125f;compression[3][2]=.4375f;canonical[2][2]=2;canonical[3][2]=-1;
    requireCPU(matrixNear(p,canonical*compression*zo*hand.bob),"Hand projection differs from pinned ZO compression/bob order.");
    for(float z:{-.05f,-1.f,-128.f}){const auto q=p*glm::vec4(0,0,z,1);requireCPU(q.z/q.w>=-.12501f&&q.z/q.w<=.12501f,"Hand depth escaped reference compressed range.");}
    auto reversed=p;for(int c=0;c<4;++c)reversed[c][2]*=-1;
    requireCPU(matrixNear(reversed,hand.projection(64,32,true))&&!matrixNear(p,hand.projection(32,32,false)),"Reverse-Z/resize hand projection was not updated.");
    auto invalidHand=hand;invalidHand.known=false;requireCPU(rejects([&]{invalidHand.projection(64,32,false);}),"Unknown hand values were fabricated.");
    invalidHand=hand;invalidHand.bob=glm::mat4(0);requireCPU(rejects([&]{invalidHand.projection(64,32,false);}),"Singular bob matrix accepted.");
    auto uv=glm::mat4(1);uv[2]={.2,.3,0,0};const auto mapped=geometryTextureMatrix(uv);requireCPU(glm::vec2(mapped*glm::vec4(.4,.5,0,1))==glm::vec2(uv*glm::vec4(.4,.5,1,0)),"Source-to-Iris UV matrix translation differs.");
    Renderer r;r.initialize();r.hasCamera=r.presentationReady=true;r.sourceWidth=64;r.sourceHeight=32;r.projection=glm::perspectiveRH_NO(1.f,2.f,.1f,128.f);r.environment.sunKnown=true;r.originKnown=true;
    r.irisPlan=std::make_unique<IrisPlan>(graphPlan());r.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();
    auto& slots=r.irisPlan->programs->slots;auto install=[&](S slot,GLuint id){slots[static_cast<size_t>(slot)]=geometryMock::fixture(id);};
    install(S::Terrain,41000);install(S::Water,41001);install(S::Hand,41002);install(S::HandWater,41003);install(S::Shadow,41004);install(S::ShadowWater,41005);
    requireCPU(r.irisPlan->programs->select(S::TerrainCutout).program.handle==41000&&r.irisPlan->programs->select(S::ShadowCutout).program.handle==41004,"Reference fallback tree differs.");
    requireCPU(rejects([&]{r.irisPlan->programs->select(S::Entities);}),"Missing entity fallback silently used terrain.");
    requireCPU(geometrySlot(GeometryRole::Entity,false,false,true,false,true,true)==S::EntitiesTrans&&geometrySlot(GeometryRole::BlockEntity,false,true,false,false,true,true)==S::ShadowBlock&&geometrySlot(GeometryRole::Generic,false,false,false,false,true,true)==S::TexturedLit,"Explicit roles or generic geometry are misclassified.");
    requireCPU(rejects([&]{geometrySlot(GeometryRole::Entity,true,true,false,false,true,true);}),"Hand was accepted as a world shadow caster.");
    auto& handProgram=*slots[static_cast<size_t>(S::Hand)];handProgram.program.inputs={{130,3,IrisTexture::Depth2,0,false}};
    geometryMock::programs[41002].uniforms.push_back({"depthtex2",130,GL_SAMPLER_2D});
    auto& attributesProgram=*slots[static_cast<size_t>(S::Terrain)];
    for(auto value:{GeometryAttribute::Tangent,GeometryAttribute::Midpoint,GeometryAttribute::MidBlock,GeometryAttribute::SourceLightmap}){
        const auto loc=static_cast<GLuint>(12+static_cast<int>(value)-static_cast<int>(GeometryAttribute::Tangent));
        const auto name="sourceAttribute"+std::to_string(loc);attributesProgram.attributes.push_back({name,loc,value});geometryMock::programs[41000].attributes.push_back({name,static_cast<GLint>(loc),geometryAttributeType(value)});
    }
    for(uint32_t id=0;id<4;++id){auto& mesh=r.meshes[id];mesh.vao=81000+id;mesh.vbo=82000+id;mesh.ebo=83000+id;mesh.indexCount=3;mesh.boundsValid=true;mesh.boundsMin={-.1f,-.1f,-2.1f};mesh.boundsMax={.1f,.1f,-1.9f};mesh.irisTerrain=true;
        mesh.renderState.group=id%2?1:0;if(id%2)mesh.renderState.flags=SourceDrawState::Camera|SourceDrawState::Hand|SourceDrawState::ClearDepth;
        if(id>=2){mesh.flags=2;mesh.drawState.blendMode=2;mesh.drawState.flags&=~MaterialDrawState::DepthWrite;}}
    r.meshes[0].instances=84000;r.meshes[0].instanceCount=2;
    r.meshes[0].irisBuffer=85000;r.meshes[0].irisLightBuffer=86000;
    r.geometryFrame.sourceFrame=r.cameraFrames;r.geometryFrame.epoch=r.epoch;r.geometryFrame.origin=r.sourceOrigin;r.geometryFrame.hand=hand;r.geometryFrame.feetKnown=true;r.geometryFrame.feet={0,-1,0};
    nativegl::glBindBuffer(GL_ARRAY_BUFFER,91001);nativegl::glBindSampler(0,91002);nativegl::glBindVertexArray(91003);nativegl::glUseProgram(91004);
    const auto start=geometryMock::draws.size();r.render(0,64,32,false);
    std::vector<GLuint> selected;for(size_t i=start;i<geometryMock::draws.size();++i)selected.push_back(geometryMock::draws[i].program);
    requireCPU(selected==std::vector<GLuint>{41004,41005,41000,41002,41001,41003},"Actual Iris geometry selection/order differs.");
    const auto world=geometryMock::draws[start+2];const auto opaqueHand=geometryMock::draws[start+3];
    requireCPU(world.attributes[0].buffer==82000&&world.attributes[6].buffer==84000&&world.attributes[9].offset==48&&world.attributes[9].divisor==1&&world.integers.at(104)==1,"Vertex/instance streams were not bound.");
    requireCPU(world.attributes[15].integer&&world.attributes[15].buffer==86000&&world.attributes[15].stride==8&&world.attributes[12].buffer==85000&&world.attributes[14].offset==24&&!opaqueHand.attributes[15].enabled,"Integer/extended inputs or per-program attribute reset differ.");
    requireCPU(world.vao!=81000&&geometryMock::attributes[81000][0].buffer==0,"Iris binding mutated the native VAO.");
    requireCPU(matrixNear(opaqueHand.matrices.at(101),p)&&matrixNear(opaqueHand.matrices.at(106),r.projection)&&!matrixNear(p,r.projection),"Hand projection overwrote gbufferProjection.");
    requireCPU(mock::images[r.irisGraph.depth(2)].stamp==world.stamp&&mock::images[r.irisGraph.depth(1)].stamp==opaqueHand.stamp&&mock::images[r.irisGraph.depth(0)].stamp==opaqueHand.stamp,"World/opaque-hand/final depth boundaries were cleared or mixed.");
    requireCPU(opaqueHand.depthSample==r.irisGraph.depth(2)&&opaqueHand.depthSample!=opaqueHand.depth,"Hand sampler bound the attached depth instead of world depth.");
    requireCPU(world.integers.at(112)==0&&world.integers.at(110)==0&&world.integers.at(108)==1,"Unknown world/history values were invented.");
    requireCPU(mock::bufferBindings[GL_ARRAY_BUFFER]==91001&&graphMock::samplerBindings[0]==91002&&mock::currentVao==91003&&mock::currentProgram==91004,"Geometry leaked ARRAY_BUFFER/sampler/VAO/program state.");
    // Known rebase: both actual model/view products and reference feet matrices stay invariant.
    r.sourceOrigin={1000,0,0};r.camera={-1000,0,0};r.view=glm::translate(glm::mat4(1),glm::vec3(1000,0,0));
    for(auto& [id,m]:r.meshes){m.world=glm::translate(glm::mat4(1),glm::vec3(-1000,0,0));m.boundsMin.x-=1000;m.boundsMax.x-=1000;if(id%2)m.renderState.rebase({-1000,0,0});}
    r.geometryFrame.origin=r.sourceOrigin;r.render(0,64,32,false);const auto& rebased=geometryMock::draws[geometryMock::draws.size()-4];
    requireCPU(matrixNear(rebased.matrices.at(100),world.matrices.at(100))&&matrixNear(rebased.matrices.at(107),world.matrices.at(107))&&matrixNear(rebased.matrices.at(109),world.matrices.at(107))&&rebased.integers.at(110)==1,"Rebase changed geometry/reference player-space history.");
    const auto successful=r.irisGraph.frames;const auto committed=r.completedGeometryFrame.origin;
    for(GLuint failure:{41004u,41005u,41000u,41002u,41001u,41003u}){geometryMock::failProgram=failure;requireCPU(rejects([&]{r.render(0,64,32,false);})&&r.irisGraph.frames==successful&&r.completedGeometryFrame.origin==committed,"Failed geometry draw committed history.");
        requireCPU(mock::bufferBindings[GL_ARRAY_BUFFER]==91001&&graphMock::samplerBindings[0]==91002&&mock::currentVao==91003,"Failed geometry draw leaked state.");}
    r.render(0,80,40,false);requireCPU(mock::images[r.irisGraph.depth(2)].width==80&&geometryMock::draws[geometryMock::draws.size()-4].integers.at(110)==0,"Resize retained old depth/history.");
    ++r.cameraFrames;requireCPU(rejects([&]{r.render(0,80,40,false);}),"Stale hand frame accepted.");r.geometryFrame.sourceFrame=r.cameraFrames;
    r.geometryFrame.hand.known=false;requireCPU(rejects([&]{r.render(0,80,40,false);}),"Missing reference hand projection silently used the source camera.");r.geometryFrame.hand=hand;
    handProgram.program.inputs[0].kind=IrisTexture::Depth0;requireCPU(rejects([&]{r.render(0,80,40,false);}),"Geometry sampled its attached depth.");handProgram.program.inputs[0].kind=IrisTexture::Depth2;
    r.meshes[0].iris.quadMidpointsComplete=false;requireCPU(rejects([&]{r.render(0,80,40,false);}),"Unknown quad midpoint was bound as complete.");r.meshes[0].iris.quadMidpointsComplete=true;
    r.invalidateHistory();r.halfZ=true;r.projection=glm::perspectiveRH_ZO(1.f,2.f,.1f,128.f);r.render(0,80,40,false);
    requireCPU(matrixNear(geometryMock::draws[geometryMock::draws.size()-4].matrices.at(106),glm::perspectiveRH_NO(1.f,2.f,.1f,128.f)),"World half-Z projection was not canonicalized exactly once.");
    r.invalidateHistory();r.halfZ=false;r.projection=glm::perspectiveRH_NO(1.f,2.f,.1f,128.f);r.reverseDepth=true;for(int c=0;c<4;++c)r.projection[c][2]*=-1;r.render(0,80,40,false);
    requireCPU(matrixNear(geometryMock::draws[geometryMock::draws.size()-3].matrices.at(101),hand.projection(80,40,true)),"Real hand draw ignored reverse depth.");
    r.invalidateHistory();r.reverseDepth=false;r.projection=glm::perspectiveRH_NO(1.f,2.f,.1f,128.f);
    auto& terrain=*slots[static_cast<size_t>(S::Terrain)];const auto saved=terrain;
    terrain.program.inputs={{120,0,IrisTexture::Color,0,false}};requireCPU(rejects([&]{r.render(0,80,40,false);}),"Sampler unit/uniform conflict accepted.");terrain=saved;
    geometryMock::programs[41000].uniforms.push_back({"unknownActive",150,GL_FLOAT});requireCPU(rejects([&]{r.render(0,80,40,false);}),"Undeclared active uniform accepted.");geometryMock::programs[41000].uniforms.pop_back();
    geometryMock::programs[41000].outputs[0]=GL_UNSIGNED_INT_VEC4;requireCPU(rejects([&]{r.render(0,80,40,false);}),"Reflected output mismatch accepted.");geometryMock::programs[41000].outputs[0]=GL_FLOAT_VEC4;
    terrain.uniforms[8].validity=-1;terrain.uniforms[8].validityName.clear();requireCPU(rejects([&]{GeometryBinding::validate(terrain);}),"Undeclared validity uniform accepted.");terrain=saved;
    // Actual missing value with a reflection-complete required declaration.
    terrain.uniforms.back().validity=-1;terrain.uniforms.back().validityName.clear();auto& reflected=geometryMock::programs[41000].uniforms;
    reflected.erase(std::remove_if(reflected.begin(),reflected.end(),[](auto& u){return u.name=="worldTimeKnown";}),reflected.end());
    requireCPU(rejects([&]{r.render(0,80,40,false);}),"Unknown required world time was synthesized.");terrain=geometryMock::fixture(41000);
    r.render(0,80,40,false);
    const auto fullColors=r.irisPlan->colors;r.irisPlan->colors.erase(std::remove_if(r.irisPlan->colors.begin(),r.irisPlan->colors.end(),[](auto& s){return s.index>=2&&s.index<6;}),r.irisPlan->colors.end());
    terrain.program.outputs[0].logical=31;r.render(0,80,40,false);
    const auto prepared=std::find_if(mock::fullscreenDraws.rbegin(),mock::fullscreenDraws.rend(),[](auto& draw){return draw.program==30003;});
    requireCPU(prepared!=mock::fullscreenDraws.rend()&&geometryMock::draws[geometryMock::draws.size()-4].colorOutput==prepared->outputs.at(0),"Sparse geometry output did not follow the current logical side.");
    terrain.program.outputs[0].logical=0;r.irisPlan->colors=fullColors;
    r.geometryFrame.feetKnown=false;r.render(0,80,40,false);const auto& unknownFeet=geometryMock::draws[geometryMock::draws.size()-4];
    requireCPU(unknownFeet.integers.at(108)==0&&unknownFeet.integers.at(110)==0&&unknownFeet.matrices.at(107)==glm::mat4(0),"Unknown feet retained stale reference matrices.");r.geometryFrame.feetKnown=true;
    r.meshes[0].texture=55;r.textures[55].handle=r.irisGraph.color(0);r.textures[55].received={1};
    const bool aliasRejected=rejects([&]{r.render(0,80,40,false);});r.textures.erase(55);r.meshes[0].texture=0;
    requireCPU(aliasRejected,"Material sampler aliased a geometry output.");
    {GraphState state;GeometryBinding binder;auto atlas=geometryMock::fixture(42000);atlas.samplers[0].value=GeometrySampler::Atlas;ImportedTexture texture;texture.flags=1;texture.handle=92001;texture.atlas=92002;texture.width=16;texture.height=16;texture.atlasLayout=AtlasLayout::plan(16,16,4,16384);
        GeometryMatrices m;m.modelView=glm::mat4(1);m.projection=r.projection;m.gbufferProjection=r.projection;
        nativegl::glUseProgram(atlas.program.handle);binder.bind(atlas,r.meshes[0],&texture,r.fallbackPlain,m);requireCPU(graphMock::textureBindings[GL_TEXTURE0][GL_TEXTURE_2D]==92002,"Atlas sampler used the array resource.");
        atlas.samplers[0].value=GeometrySampler::Array;binder.bind(atlas,r.meshes[0],&texture,r.fallbackPlain,m);requireCPU(graphMock::textureBindings[GL_TEXTURE0][GL_TEXTURE_2D_ARRAY]==92001,"Array sampler used the atlas resource.");
        atlas.samplers[0].value=GeometrySampler::Lightmap;requireCPU(rejects([&]{binder.bind(atlas,r.meshes[0],&texture,r.fallbackPlain,m);}),"Unknown lightmap texture fabricated.");
    }
    r.meshes[1].renderState.flags&=~SourceDrawState::Hand;requireCPU(rejects([&]{r.render(0,80,40,false);}),"Mixed positive world/hand group accepted.");
}

