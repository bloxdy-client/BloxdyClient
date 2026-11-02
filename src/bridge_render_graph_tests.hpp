#pragma once
// Only CPU mocks. Dispatch records resource identities; it does not execute GLSL.
namespace graphMock {
std::unordered_map<GLenum,bool> enables;
std::array<std::array<GLint,6>,8> imageBindings{};
std::unordered_map<GLuint,std::unordered_map<GLenum,GLuint>> textureBindings;
std::array<GLint,16> samplerBindings{};
std::vector<GLbitfield> barriers;
std::vector<glm::uvec3> dispatches;
std::vector<GLuint> dispatchPrograms;
std::vector<GLuint> storageClears;
bool failCompute=false,failRestore=false;int vx=0,vy=0;
std::array<GLint,4> colorMask{1,1,1,1};std::array<GLenum,2> equations{GL_FUNC_ADD,GL_FUNC_ADD};
std::array<GLint64,8> rangeOffsets{},rangeSizes{};unsigned indirectDispatches=0;
std::array<GLfloat,4> clearColor{0,0,0,0};GLdouble clearDepth=1;
std::map<GLenum,GLint> pixelStore{{GL_UNPACK_ALIGNMENT,4},{GL_UNPACK_ROW_LENGTH,0},{GL_UNPACK_SKIP_PIXELS,0},{GL_UNPACK_SKIP_ROWS,0}};
GLuint lastShadowImage=0;std::vector<uint64_t> shadowStampAtBegin;
void initialize(){
    nativegl::glPixelStorei=[](GLenum key,GLint value){pixelStore[key]=value;};
    nativegl::glBindSampler=[](GLuint unit,GLuint value){samplerBindings.at(unit)=value;};
    for(const auto& [unit,id]:mock::bound)textureBindings[unit][GL_TEXTURE_2D]=id;
    nativegl::glBindTexture=[](GLenum target,GLuint id){textureBindings[mock::active][target]=id;mock::bound[mock::active]=id;};
    nativegl::glViewport=[](GLint x,GLint y,GLsizei w,GLsizei h){vx=x;vy=y;mock::viewportWidth=w;mock::viewportHeight=h;};
    nativegl::glColorMask=[](GLboolean r,GLboolean g,GLboolean b,GLboolean a){colorMask={r,g,b,a};};
    nativegl::glClearColor=[](GLfloat r,GLfloat g,GLfloat b,GLfloat a){clearColor={r,g,b,a};};nativegl::glClearDepth=[](GLdouble value){clearDepth=value;};
    nativegl::glGetFloatv=[](GLenum,GLfloat* value){std::copy(clearColor.begin(),clearColor.end(),value);};nativegl::glGetDoublev=[](GLenum,GLdouble* value){*value=clearDepth;};
    nativegl::glBlendEquationSeparate=[](GLenum rgb,GLenum alpha){equations={rgb,alpha};};
    nativegl::glBindBufferBase=[](GLenum kind,GLuint index,GLuint id){requireCPU(kind==GL_SHADER_STORAGE_BUFFER,"Unexpected buffer base target.");mock::storageBindings[index]=id;mock::bufferBindings[kind]=id;rangeOffsets[index]=rangeSizes[index]=0;};
    nativegl::glBindBufferRange=[](GLenum kind,GLuint index,GLuint id,GLintptr offset,GLsizeiptr size){mock::storageBindings[index]=id;mock::bufferBindings[kind]=id;rangeOffsets[index]=offset;rangeSizes[index]=size;};
    nativegl::glIsEnabled=[](GLenum cap)->GLboolean{return enables[cap];};
    nativegl::glEnable=[](GLenum cap){enables[cap]=true;if(cap==GL_CULL_FACE)mock::cull=true;if(cap==GL_BLEND)mock::blend=true;};
    nativegl::glDisable=[](GLenum cap){enables[cap]=false;if(cap==GL_CULL_FACE)mock::cull=false;if(cap==GL_BLEND)mock::blend=false;};
    nativegl::glGetIntegerv=[](GLenum key,GLint* out){++mock::integerQueries;
        if(key>=GL_DRAW_BUFFER0&&key<GL_DRAW_BUFFER0+8){const auto& a=mock::drawAttachments[mock::drawFramebuffer];const auto i=key-GL_DRAW_BUFFER0;*out=i<a.size()?a[i]:GL_NONE;return;}
        switch(key){
        case GL_READ_BUFFER:*out=mock::readAttachments[mock::readFramebuffer];break;
        case GL_MAX_TEXTURE_SIZE:*out=16384;break;
        case GL_MAX_IMAGE_UNITS:case GL_MAX_SHADER_STORAGE_BUFFER_BINDINGS:case GL_MAX_DRAW_BUFFERS:case GL_MAX_COLOR_ATTACHMENTS:*out=8;break;
        case GL_MAX_TEXTURE_IMAGE_UNITS:case GL_MAX_COMPUTE_TEXTURE_IMAGE_UNITS:*out=16;break;
        case GL_MAX_SHADER_STORAGE_BLOCK_SIZE:*out=128*1024*1024;break;
        case GL_DRAW_FRAMEBUFFER_BINDING:*out=mock::drawFramebuffer;break;case GL_READ_FRAMEBUFFER_BINDING:*out=mock::readFramebuffer;break;
        case GL_CURRENT_PROGRAM:*out=mock::currentProgram;break;case GL_VERTEX_ARRAY_BINDING:*out=mock::currentVao;break;case GL_ACTIVE_TEXTURE:*out=mock::active;break;
        case GL_VIEWPORT:out[0]=vx;out[1]=vy;out[2]=mock::viewportWidth;out[3]=mock::viewportHeight;break;
        case GL_DEPTH_WRITEMASK:*out=mock::depthWrite;break;case GL_DEPTH_FUNC:*out=mock::depthFunction;break;case GL_FRONT_FACE:*out=mock::winding;break;case GL_CULL_FACE_MODE:*out=mock::cullFace;break;
        case GL_BLEND_SRC_RGB:*out=mock::blendFactors[0];break;case GL_BLEND_DST_RGB:*out=mock::blendFactors[1];break;case GL_BLEND_SRC_ALPHA:*out=mock::blendFactors[2];break;case GL_BLEND_DST_ALPHA:*out=mock::blendFactors[3];break;
        case GL_SHADER_STORAGE_BUFFER_BINDING:*out=mock::bufferBindings[GL_SHADER_STORAGE_BUFFER];break;
        case GL_ARRAY_BUFFER_BINDING:*out=mock::bufferBindings[GL_ARRAY_BUFFER];break;
        case GL_PIXEL_UNPACK_BUFFER_BINDING:*out=mock::bufferBindings[GL_PIXEL_UNPACK_BUFFER];break;
        case GL_UNPACK_ALIGNMENT:case GL_UNPACK_ROW_LENGTH:case GL_UNPACK_SKIP_PIXELS:case GL_UNPACK_SKIP_ROWS:*out=pixelStore[key];break;
        case GL_DISPATCH_INDIRECT_BUFFER_BINDING:*out=mock::bufferBindings[GL_DISPATCH_INDIRECT_BUFFER];break;
        case GL_COLOR_WRITEMASK:std::copy(colorMask.begin(),colorMask.end(),out);break;
        case GL_BLEND_EQUATION_RGB:*out=equations[0];break;case GL_BLEND_EQUATION_ALPHA:*out=equations[1];break;
        case GL_TEXTURE_BINDING_2D:*out=textureBindings[mock::active][GL_TEXTURE_2D];break;case GL_TEXTURE_BINDING_2D_ARRAY:*out=textureBindings[mock::active][GL_TEXTURE_2D_ARRAY];break;case GL_TEXTURE_BINDING_CUBE_MAP:*out=textureBindings[mock::active][GL_TEXTURE_CUBE_MAP];break;
        default:throw std::runtime_error("Unhandled graph GL integer query: "+std::to_string(key));}
    };
    nativegl::glGetIntegeri_v=[](GLenum key,GLuint index,GLint* out){
        if(key==GL_SAMPLER_BINDING){*out=samplerBindings.at(index);return;}
        if(key==GL_MAX_COMPUTE_WORK_GROUP_COUNT){*out=65535;return;}
        if(key==GL_SHADER_STORAGE_BUFFER_BINDING){*out=mock::storageBindings[index];return;}
        const std::array<GLenum,6> keys={GL_IMAGE_BINDING_NAME,GL_IMAGE_BINDING_LEVEL,GL_IMAGE_BINDING_LAYERED,GL_IMAGE_BINDING_LAYER,GL_IMAGE_BINDING_ACCESS,GL_IMAGE_BINDING_FORMAT};
        const auto found=std::find(keys.begin(),keys.end(),key);if(found==keys.end())throw std::runtime_error("Unhandled indexed query.");*out=imageBindings.at(index)[found-keys.begin()];
    };
    nativegl::glBindImageTexture=[](GLuint unit,GLuint texture,GLint level,GLboolean layered,GLint layer,GLenum access,GLenum format){imageBindings.at(unit)={static_cast<GLint>(texture),level,layered,layer,static_cast<GLint>(access),static_cast<GLint>(format)};if(texture==90005&&failRestore){mock::pendingError=GL_INVALID_OPERATION;failRestore=false;}};
    nativegl::glGetInteger64i_v=[](GLenum key,GLuint index,GLint64* out){*out=key==GL_SHADER_STORAGE_BUFFER_START?rangeOffsets[index]:rangeSizes[index];};
    nativegl::glClearBufferData=[](GLenum target,GLenum internal,GLenum format,GLenum type,const void* data){requireCPU(target==GL_SHADER_STORAGE_BUFFER&&internal==GL_R32UI&&format==GL_RED_INTEGER&&type==GL_UNSIGNED_INT&&*static_cast<const GLuint*>(data)==0,"Bad SSBO zero initialization.");const auto id=mock::bufferBindings[target];storageClears.push_back(id);std::fill(mock::bufferBytes.at(id).begin(),mock::bufferBytes.at(id).end(),uint8_t{0});};
    nativegl::glGetBufferSubData=[](GLenum target,GLintptr offset,GLsizeiptr size,void* out){const auto& bytes=mock::bufferBytes.at(mock::bufferBindings[target]);requireCPU(offset>=0&&static_cast<uint64_t>(offset+size)<=bytes.size(),"Mock buffer read outside bounds.");std::memcpy(out,bytes.data()+offset,static_cast<size_t>(size));};
    nativegl::glDispatchComputeIndirect=[](GLintptr offset){requireCPU(!barriers.empty()&&(barriers.back()&GL_COMMAND_BARRIER_BIT),"Missing indirect command barrier.");++indirectDispatches;glm::uvec3 count;const auto& bytes=mock::bufferBytes.at(mock::bufferBindings[GL_DISPATCH_INDIRECT_BUFFER]);std::memcpy(&count[0],bytes.data()+offset,12);dispatches.push_back(count);dispatchPrograms.push_back(mock::currentProgram);};
    nativegl::glMemoryBarrier=[](GLbitfield bits){barriers.push_back(bits);};
    nativegl::glGetProgramiv=[](GLuint id,GLenum key,GLint* out){if(key==GL_LINK_STATUS){*out=id!=99999;return;}if(key==GL_COMPUTE_WORK_GROUP_SIZE){out[0]=8;out[1]=4;out[2]=1;return;}throw std::runtime_error("Unexpected program query.");};
    nativegl::glDispatchCompute=[](GLuint x,GLuint y,GLuint z){dispatches.push_back({x,y,z});dispatchPrograms.push_back(mock::currentProgram);
        if(mock::currentProgram==30001)lastShadowImage=imageBindings[0][0];
        if(mock::currentProgram==30000&&lastShadowImage)shadowStampAtBegin.push_back(mock::images[lastShadowImage].stamp);
        requireCPU(!barriers.empty()&&(barriers.back()&GL_SHADER_STORAGE_BARRIER_BIT)&&(barriers.back()&GL_SHADER_IMAGE_ACCESS_BARRIER_BIT),"Missing pre-compute barrier.");
        for(const auto& im:imageBindings)if(im[0]&&im[4]!=GL_READ_ONLY){requireCPU(mock::images.at(im[0]).format==im[5],"Image format mismatch.");mock::images[im[0]].stamp=200000+dispatches.size();}
        if(failCompute){mock::pendingError=GL_INVALID_OPERATION;failCompute=false;}
    };
}
}

bridge::IrisPlan graphPlan(GLuint vaoUnused=0){
    (void)vaoUnused;using namespace bridge;IrisPlan plan;plan.shadowSize=16;
    for(uint32_t i=0;i<6;++i){ColorBufferSpec spec;spec.index=i;spec.format=GL_RGBA16F;plan.colors.push_back(spec);}
    ColorBufferSpec persist;persist.index=31;persist.format=GL_RGBA16F;persist.clearEachFrame=false;persist.mipmaps=true;plan.colors.push_back(persist);
    for(uint32_t i=0;i<2;++i){ColorBufferSpec spec;spec.index=i;spec.format=GL_RGBA16F;plan.shadowColors.push_back(spec);}
    plan.storage={{0,64,false},{7,4,true}};
    IrisProgram compute;compute.handle=30000;compute.compute=true;compute.storage={0};compute.images={{1,0,IrisTexture::Color,31,GL_WRITE_ONLY,GL_RGBA16F}};
    plan.steps.push_back({IrisStage::Begin,0,{compute},{}});
    auto shadowCompute=compute;shadowCompute.handle=30001;shadowCompute.images={{1,0,IrisTexture::ShadowColor,0,GL_WRITE_ONLY,GL_RGBA16F}};shadowCompute.groups={2,1,1};
    plan.steps.push_back({IrisStage::Shadow,0,{shadowCompute},{}});
    auto fragment=[](GLuint id,IrisTexture input,uint32_t index,uint32_t output){IrisProgram p;p.handle=id;p.inputs={{1,3,input,index,false}};p.outputs={{output,true}};return p;};
    plan.steps.push_back({IrisStage::Shadowcomp,0,{},fragment(30002,IrisTexture::ShadowDepth1,0,0)});
    plan.steps.push_back({IrisStage::Prepare,0,{},fragment(30003,IrisTexture::ShadowColor,0,31)});
    auto deferred=fragment(30004,IrisTexture::Color,0,0);deferred.inputs.push_back({2,4,IrisTexture::Depth1,0,false});deferred.inputs.push_back({3,5,IrisTexture::Depth2,0,false});
    plan.steps.push_back({IrisStage::Deferred,0,{},deferred});
    auto composite=fragment(30005,IrisTexture::Color,0,31);composite.inputs.push_back({2,4,IrisTexture::Depth0,0,false});
    plan.steps.push_back({IrisStage::Composite,0,{},composite});
    auto final=fragment(30006,IrisTexture::Color,31,0);final.outputs.clear();plan.steps.push_back({IrisStage::Final,0,{},final});return plan;
}

void testRenderGraph(){
    using namespace bridge;graphMock::initialize();const auto rejects=[](auto fn){try{fn();}catch(const std::runtime_error&){return true;}return false;};
    IrisGraph graph;auto plan=graphPlan();PassDestination output{0,0,0,64,32,{}};
    std::vector<IrisDraw> phases;std::vector<GLuint> worldSides;uint64_t worldDepth=0,handDepth=0,shadowDepth=0;
    auto draw=[&](IrisDraw phase,GLuint fbo){phases.push_back(phase);requireCPU(mock::drawFramebuffer==fbo,"Graph callback framebuffer is not bound.");
        const auto attached=mock::framebufferTextures[fbo][GL_COLOR_ATTACHMENT0];worldSides.push_back(attached);
        const auto d=mock::framebufferTextures[fbo][GL_DEPTH_ATTACHMENT];mock::images[d].stamp=400000+static_cast<unsigned>(phase);mock::images[attached].stamp=500000+static_cast<unsigned>(phase);
        if(phase==IrisDraw::WorldOpaque)worldDepth=mock::images[d].stamp;if(phase==IrisDraw::HandOpaque)handDepth=mock::images[d].stamp;if(phase==IrisDraw::ShadowOpaque)shadowDepth=mock::images[d].stamp;
        nativegl::glEnable(GL_BLEND);nativegl::glEnable(GL_CULL_FACE); // each fullscreen must reset these
    };
    {
        GraphState state;graph.configure(plan,64,32,64*32*60);const auto start=mock::fullscreenDraws.size();graph.execute(plan,50000,{.2,.3,.4,1},false,output,draw);graph.complete();
        requireCPU(phases==std::vector<IrisDraw>{IrisDraw::ShadowOpaque,IrisDraw::ShadowTranslucent,IrisDraw::WorldOpaque,IrisDraw::HandOpaque,IrisDraw::WorldTranslucent,IrisDraw::HandTranslucent},"Graph depth/hand/stage order differs.");
        std::vector<GLuint> programs;for(size_t i=start;i<mock::fullscreenDraws.size();++i)programs.push_back(mock::fullscreenDraws[i].program);
        requireCPU(programs==std::vector<GLuint>{30002,30003,30004,30005,30006},"Graph skipped or reordered actual fullscreen programs.");
        requireCPU(graphMock::dispatches.back()==glm::uvec3(8,8,1)&&graphMock::dispatches[graphMock::dispatches.size()-2]==glm::uvec3(2,1,1)&&graphMock::dispatchPrograms[graphMock::dispatchPrograms.size()-2]==30001&&graphMock::dispatchPrograms.back()==30000,"Shadow-before-Begin order or absolute/relative compute rounding differs.");
        requireCPU(mock::images[graph.depth(2)].stamp==worldDepth&&mock::images[graph.depth(1)].stamp==handDepth&&mock::images[graph.depth(4)].stamp==shadowDepth,"Graph depth snapshots include the wrong phase.");
        requireCPU(worldSides[2]==worldSides[3]&&worldSides[3]!=worldSides[4],"Gbuffers do not follow the deferred flip, or hand implicitly flips.");
        requireCPU(graph.frames==1&&graph.dispatches==2,"Graph committed before successful completion.");
        requireCPU(!graphMock::shadowStampAtBegin.empty()&&graphMock::shadowStampAtBegin.back()==0,"Shadow compute was not followed by the scheduled shadow-color clear before Begin.");
    }
    const auto storage=graph.storage(0),color=graph.color(31);const auto bytes=graph.bytes();const auto allocations=mock::textureAllocations;
    {GraphState state;graph.configure(plan,64,32,64*32*60);requireCPU(graph.color(31)==color&&graph.storage(0)==storage&&mock::textureAllocations==allocations,"Stable graph reallocated storage.");}
    auto relativeShadow=plan;relativeShadow.steps[1].computes[0].groups=glm::uvec3(0);
    {GraphState state;graph.execute(relativeShadow,50000,{0,0,0,1},false,output,draw);graph.complete();}
    requireCPU(graphMock::dispatches[graphMock::dispatches.size()-2]==glm::uvec3(2,4,1),"Relative Shadow compute used window size instead of shadow resolution.");
    auto explicitFlip=plan;explicitFlip.steps[4].postFlips={0};const auto phaseStart=worldSides.size();
    {GraphState state;graph.execute(explicitFlip,50000,{0,0,0,1},false,output,draw);graph.complete();}
    requireCPU(worldSides[phaseStart+2]==worldSides[phaseStart+4],"Explicit post-flip was not applied separately after the output flip.");
    const auto oldFrames=graph.frames;const auto cleared=graphMock::storageClears.size();graphMock::failCompute=true;
    {GraphState state;requireCPU(rejects([&]{graph.execute(plan,50000,{0,0,0,1},false,output,draw);}),"Failed compute was ignored.");}
    requireCPU(graph.frames==oldFrames&&graph.failures==1&&!graph.lastError.empty(),"Failed graph frame committed or lost its error.");
    {GraphState state;graph.execute(plan,50000,{0,0,0,1},false,output,draw);graph.complete();}
    requireCPU(graphMock::storageClears.size()==cleared+2,"Failed frame did not reset persistent SSBOs.");
    auto indirect=plan;indirect.steps[0].computes[0].indirectStorage=0;indirect.steps[0].computes[0].indirectOffset=4;
    const glm::uvec3 counts{3,2,1};std::memcpy(mock::bufferBytes[storage].data()+4,&counts[0],12);
    {GraphState state;graph.execute(indirect,50000,{0,0,0,1},false,output,draw);graph.complete();}
    requireCPU(graphMock::indirectDispatches==1,"Indirect compute never dispatched.");
    auto indirectBad=indirect;indirectBad.steps[0].computes[0].indirectOffset=60;
    {GraphState state;requireCPU(rejects([&]{graph.execute(indirectBad,50000,{0,0,0,1},false,output,draw);}),"Out-of-range indirect arguments were read.");}
    {GraphState state;graph.execute(plan,50000,{0,0,0,1},false,output,draw);graph.complete();}
    const glm::uvec3 tooMany{65536,1,1};std::memcpy(mock::bufferBytes[storage].data()+4,&tooMany[0],12);
    {GraphState state;requireCPU(rejects([&]{graph.execute(indirect,50000,{0,0,0,1},false,output,draw);}),"Oversized indirect count reached the GPU.");}
    requireCPU(graphMock::indirectDispatches==1,"Invalid indirect dispatch was executed.");
    auto mipPlan=plan;mipPlan.steps[0].computes[0].images={{1,0,IrisTexture::Color,1,GL_WRITE_ONLY,GL_RGBA16F}};mipPlan.steps[0].computes[0].inputs={{2,3,IrisTexture::Color,31,true}};
    const auto mipCount=mock::mipmapTextures.size();
    {GraphState state;graph.execute(mipPlan,50000,{0,0,0,1},false,output,draw);graph.complete();}
    requireCPU(mock::mipmapTextures.size()>mipCount,"Compute sampler did not prepare its reserved mip chain.");
    auto persistentPlan=plan;auto extra=persistentPlan.steps[persistentPlan.steps.size()-2];extra.ordinal=1;extra.fragment.handle=30007;extra.fragment.inputs={{1,3,IrisTexture::Color,31,false}};persistentPlan.steps.insert(persistentPlan.steps.end()-1,extra);
    const auto copiesBefore=mock::blits.size();
    {GraphState state;graph.execute(persistentPlan,50000,{0,0,0,1},false,output,draw);graph.complete();}
    const auto finalSource=mock::fullscreenDraws.back().input;
    requireCPU(mock::blits.size()>copiesBefore+3&&graph.color(31)==color&&finalSource!=color&&mock::images[finalSource].stamp==mock::images[color].stamp,"Persistent odd parity was not copied to physical main for the next frame.");
    const auto beforeCopyFailure=graph.frames;mock::failHistoryCopy=true;
    {GraphState state;requireCPU(rejects([&]{graph.execute(persistentPlan,50000,{0,0,0,1},false,output,draw);}),"Failed persistent normalization was ignored.");}
    requireCPU(graph.frames==beforeCopyFailure,"Failed persistent copy committed the frame.");
    for(const auto phase:{IrisDraw::ShadowOpaque,IrisDraw::ShadowTranslucent,IrisDraw::WorldOpaque,IrisDraw::HandOpaque,IrisDraw::WorldTranslucent,IrisDraw::HandTranslucent}){
        const auto committed=graph.frames;GraphState state;
        requireCPU(rejects([&]{graph.execute(plan,50000,{0,0,0,1},false,output,[&](IrisDraw current,GLuint fbo){draw(current,fbo);if(current==phase)mock::pendingError=GL_INVALID_OPERATION;});})&&graph.frames==committed,"Geometry-stage GL failure was swallowed or committed.");
    }
    for(int i=0;i<5;++i){const auto committed=graph.frames;mock::fullscreenDrawsBeforeFailure=i;GraphState state;
        requireCPU(rejects([&]{graph.execute(plan,50000,{0,0,0,1},false,output,draw);})&&graph.frames==committed,"Fullscreen-stage failure was swallowed or committed.");}
    auto bad=plan;bad.steps[0].computes[0].inputs={{1,3,IrisTexture::Color,31,false}};
    {GraphState state;requireCPU(rejects([&]{graph.execute(bad,50000,{0,0,0,1},false,output,draw);}),"Writable image/sampler feedback was accepted.");}
    bad=plan;bad.steps[0].computes[0].inputs={{1,3,IrisTexture::Depth1,0,false}};
    {GraphState state;requireCPU(rejects([&]{graph.execute(bad,50000,{0,0,0,1},false,output,draw);}),"Begin sampled depth1 before its producer.");}
    bad=plan;bad.steps[0].computes[0].groups={65536,1,1};
    {GraphState state;requireCPU(rejects([&]{graph.execute(bad,50000,{0,0,0,1},false,output,draw);}),"Compute group limit ignored.");}
    bad=plan;bad.steps[0].computes[0].images[0].format=GL_RGBA32F;
    {GraphState state;requireCPU(rejects([&]{graph.execute(bad,50000,{0,0,0,1},false,output,draw);}),"Incompatible image format accepted.");}
    bad=plan;bad.steps[0].computes[0].storage={1};
    {GraphState state;requireCPU(rejects([&]{graph.execute(bad,50000,{0,0,0,1},false,output,draw);}),"Missing storage silently bound.");}
    bad=plan;bad.steps.back().fragment.handle=99999;
    {GraphState state;requireCPU(rejects([&]{graph.execute(bad,50000,{0,0,0,1},false,output,draw);}),"Unlinked final program accepted.");}
    bad=plan;bad.steps.back().fragment.outputs={{0,true}};
    requireCPU(rejects([&]{graph.validate(bad);}),"Final wrote a logical target instead of its destination.");
    bad=plan;bad.steps[0].computes.clear();requireCPU(rejects([&]{graph.validate(bad);}),"An empty named stage passed validation.");
    bad=plan;bad.storage[0].bytes=128ull*1024*1024+1;requireCPU(rejects([&]{IrisGraph::estimate(bad,64,32);}),"Oversized SSBO escaped the budget.");
    {GraphState state;requireCPU(rejects([&]{graph.configure(plan,3840,2160,3840ull*2160*60);})&&graph.bytes()==bytes&&graph.storage(0)==storage,"Combined frame/graph budget lost working resources.");}
    {GraphState state;const auto peakOther=512ull*1024*1024-IrisGraph::estimate(plan,128,64)-graph.bytes()/2;const auto allocs=mock::textureAllocations;
        requireCPU(rejects([&]{graph.configure(plan,128,64,peakOther);})&&mock::textureAllocations==allocs&&graph.storage(0)==storage,"Replacement peak exceeded the shared budget before allocation.");}
    const auto deleted=mock::deletedTextures.size();mock::framebufferChecksBeforeFailure=2;
    {GraphState state;requireCPU(rejects([&]{graph.configure(plan,128,64,128ull*64*60);}),"Partial graph allocation failure ignored.");}
    requireCPU(graph.color(31)==color&&mock::deletedTextures.size()==deleted+3,"Partial graph allocation leaked or discarded working resources.");
    // Sentinels are caller-owned GL state, including nonzero indexed bindings.
    nativegl::glBindFramebuffer(GL_DRAW_FRAMEBUFFER,90001);nativegl::glBindFramebuffer(GL_READ_FRAMEBUFFER,90002);nativegl::glUseProgram(90003);nativegl::glBindVertexArray(90004);nativegl::glViewport(7,9,111,113);nativegl::glDepthMask(GL_FALSE);nativegl::glDepthFunc(GL_GREATER);nativegl::glEnable(GL_SCISSOR_TEST);nativegl::glEnable(GL_STENCIL_TEST);nativegl::glEnable(GL_BLEND);nativegl::glEnable(GL_CULL_FACE);
    nativegl::glBindImageTexture(0,90005,2,GL_TRUE,3,GL_READ_ONLY,GL_R32UI);nativegl::glBindBufferRange(GL_SHADER_STORAGE_BUFFER,0,90006,256,512);nativegl::glBindBuffer(GL_DISPATCH_INDIRECT_BUFFER,90008);nativegl::glActiveTexture(GL_TEXTURE3);nativegl::glBindTexture(GL_TEXTURE_2D,90007);nativegl::glColorMask(GL_FALSE,GL_TRUE,GL_FALSE,GL_TRUE);nativegl::glBlendEquationSeparate(GL_FUNC_REVERSE_SUBTRACT,GL_FUNC_SUBTRACT);
    const auto savedImage=graphMock::imageBindings[0];graphMock::failCompute=true;
    {GraphState state;requireCPU(rejects([&]{graph.execute(plan,50000,{0,0,0,1},false,output,draw);}),"State restoration test did not fail.");}
    requireCPU(mock::drawFramebuffer==90001&&mock::readFramebuffer==90002&&mock::currentProgram==90003&&mock::currentVao==90004&&mock::viewportWidth==111&&graphMock::vx==7&&!mock::depthWrite&&mock::depthFunction==GL_GREATER&&mock::cull&&mock::blend&&graphMock::enables[GL_SCISSOR_TEST]&&graphMock::enables[GL_STENCIL_TEST]&&graphMock::imageBindings[0]==savedImage&&mock::storageBindings[0]==90006&&graphMock::textureBindings[GL_TEXTURE3][GL_TEXTURE_2D]==90007&&mock::active==GL_TEXTURE3,"Failed graph leaked GL bindings or raster state.");
    requireCPU(graphMock::rangeOffsets[0]==256&&graphMock::rangeSizes[0]==512&&mock::bufferBindings[GL_DISPATCH_INDIRECT_BUFFER]==90008&&graphMock::colorMask==std::array<GLint,4>{0,1,0,1}&&graphMock::equations==std::array<GLenum,2>{GL_FUNC_REVERSE_SUBTRACT,GL_FUNC_SUBTRACT},"Graph lost SSBO ranges, indirect buffer or output masks/equations.");
    nativegl::glBindImageTexture(0,0,0,GL_FALSE,0,GL_READ_ONLY,GL_R8);
    graph.release();requireCPU(!graph.bytes()&&std::find(mock::deletedBuffers.begin(),mock::deletedBuffers.end(),storage)!=mock::deletedBuffers.end(),"Graph release retained owned storage.");
    // Run the real Renderer integration with actual imported meshes and a final
    // destination in the native frame, rather than only callback scheduling.
    Renderer renderer;renderer.initialize();renderer.hasCamera=renderer.presentationReady=true;renderer.sourceWidth=64;renderer.sourceHeight=32;renderer.environment.sunKnown=true;
    for(uint32_t id=0;id<4;++id){auto& mesh=renderer.meshes[id];mesh.vao=80000+id;mesh.indexCount=3;mesh.boundsValid=true;mesh.boundsMin={-.1,-.1,-.1};mesh.boundsMax={.1,.1,.1};mesh.renderState.group=id%2?1:0;
        if(id%2)mesh.renderState.flags=SourceDrawState::Camera|SourceDrawState::Hand;if(id>=2)mesh.flags=2;}
    renderer.irisPlan=std::make_unique<IrisPlan>(graphPlan());const auto drawStart=mock::geometryDraws.size();renderer.render(0,64,32,false);
    std::vector<GLuint> actual;for(size_t i=drawStart;i<mock::geometryDraws.size();++i)if(!mock::geometryDraws[i].shadow)actual.push_back(mock::geometryDraws[i].vao);
    requireCPU(actual==std::vector<GLuint>{80000,80001,80002,80003}&&renderer.irisGraph.frames==1&&mock::fullscreenDraws.back().framebuffer==renderer.targets.framebuffer,"Native renderer bypassed the graph or drew hand/translucency in the wrong order.");
    const auto completed=renderer.cameraHistory.prepare(renderer.view,renderer.projection,renderer.camera,{},false,false,64,32,0).counter;
    mock::fullscreenDrawsBeforeFailure=4;
    requireCPU(rejects([&]{renderer.render(0,64,32,false);})&&renderer.irisGraph.frames==1&&renderer.cameraHistory.prepare(renderer.view,renderer.projection,renderer.camera,{},false,false,64,32,0).counter==completed,"Failed final committed graph/camera history.");
    renderer.render(0,64,32,false);requireCPU(renderer.irisGraph.frames==2,"Graph failed to recover through the renderer.");
    nativegl::glBindImageTexture(2,90005,0,GL_FALSE,0,GL_READ_ONLY,GL_R32UI);graphMock::failRestore=true;
    requireCPU(rejects([&]{renderer.render(0,64,32,false);})&&renderer.irisGraph.frames==2,"State restoration error committed the graph.");
    nativegl::glBindImageTexture(2,0,0,GL_FALSE,0,GL_READ_ONLY,GL_R8);
    renderer.meshes.at(1).renderState.flags|=SourceDrawState::ClearDepth;
    requireCPU(rejects([&]{renderer.render(0,64,32,false);})&&renderer.irisGraph.frames==2,"Destructive hand-depth clear silently corrupted depthtex1.");
    renderer.meshes.at(1).renderState.flags&=~SourceDrawState::ClearDepth;
    const auto beforePresentFailure=renderer.irisGraph.frames;mock::fullscreenDrawsBeforeFailure=5;
    requireCPU(rejects([&]{renderer.render(0,64,32,true);})&&renderer.irisGraph.frames==beforePresentFailure,"Failed external presentation committed the internal graph.");
    renderer.render(0,80,40,false);requireCPU(mock::images[renderer.irisGraph.depth(2)].width==80&&renderer.irisGraph.frames==beforePresentFailure+1,"Graph resize retained stale depth targets.");
    const auto oldStorage=renderer.irisGraph.storage(0);renderer.irisPlan.reset();renderer.render(0,80,40,false);
    requireCPU(renderer.irisGraph.bytes()==0&&std::find(mock::deletedBuffers.begin(),mock::deletedBuffers.end(),oldStorage)!=mock::deletedBuffers.end(),"Removing the recipe retained graph resources.");
}
