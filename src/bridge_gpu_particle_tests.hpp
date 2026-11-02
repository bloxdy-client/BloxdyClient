#pragma once
namespace gpuMock {
PFNGLGETUNIFORMLOCATIONPROC oldLocation;PFNGLUNIFORMMATRIX4FVPROC oldMatrix;PFNGLUNIFORM4FVPROC oldVector;PFNGLUNIFORM1IPROC oldInt;PFNGLUNIFORM1FPROC oldFloat;PFNGLTEXSUBIMAGE2DPROC oldUpload;
std::map<GLuint,std::vector<uint32_t>> records;
glm::mat4 view{1},projection{1};glm::vec4 frame{0};std::array<float,284> system{};glm::ivec2 range{0};int multiply=0,half=0;float ramp=0;
bool failDraw=false;int failUpload=-1;
struct Draw {GLuint records,texture,ramp,color,depth;glm::ivec2 range;glm::vec4 frame;glm::mat4 view,projection;std::array<float,284> system;std::array<GLenum,4> factors;bool depthWrite;int multiply,half;size_t depthCopies,fullscreens;};
std::vector<Draw> draws;
void initialize(){
    oldLocation=nativegl::glGetUniformLocation;oldMatrix=nativegl::glUniformMatrix4fv;oldVector=nativegl::glUniform4fv;oldInt=nativegl::glUniform1i;oldFloat=nativegl::glUniform1f;oldUpload=nativegl::glTexSubImage2D;
    nativegl::glGetUniformLocation=[](GLuint id,const char* name)->GLint{
        const std::array<std::string,11> keys={"gpuParticleView","gpuParticleProjection","gpuParticleFrame","gpuParticleRange","gpuParticleSystem","gpuParticleRamp","gpuParticleHalfZ","gpuParticleMultiply","gpuParticleTexture","gpuParticleRampTexture","gpuParticleRecords"};
        const auto i=std::find(keys.begin(),keys.end(),name);return i==keys.end()?oldLocation(id,name):900+static_cast<GLint>(i-keys.begin());};
    nativegl::glUniformMatrix4fv=[](GLint l,GLsizei n,GLboolean t,const GLfloat* v){if(l==900)view=glm::make_mat4(v);else if(l==901)projection=glm::make_mat4(v);else oldMatrix(l,n,t,v);};
    nativegl::glUniform4fv=[](GLint l,GLsizei n,const GLfloat* v){if(l==902)frame=glm::make_vec4(v);else if(l==904){requireCPU(n==71,"GPU system array count differs.");std::copy_n(v,284,system.begin());}else oldVector(l,n,v);};
    nativegl::glUniform2i=[](GLint l,GLint a,GLint b){if(l==903)range={a,b};};
    nativegl::glUniform1i=[](GLint l,GLint v){if(l==906)half=v;else if(l==907)multiply=v;else if(l<900)oldInt(l,v);};
    nativegl::glUniform1f=[](GLint l,GLfloat v){if(l==905)ramp=v;else oldFloat(l,v);};
    nativegl::glTexSubImage2D=[](GLenum target,GLint level,GLint x,GLint y,GLsizei w,GLsizei h,GLenum format,GLenum type,const void* data){
        if(format!=GL_RGBA_INTEGER){oldUpload(target,level,x,y,w,h,format,type,data);return;}
        requireCPU(type==GL_UNSIGNED_INT&&target==GL_TEXTURE_2D&&!mock::bufferBindings[GL_PIXEL_UNPACK_BUFFER],"GPU records lost integer or unpack ownership.");
        const auto* p=static_cast<const uint32_t*>(data);records[graphMock::textureBindings[mock::active][GL_TEXTURE_2D]]=std::vector<uint32_t>(p,p+w*h*4);
        if(failUpload==0){mock::pendingError=GL_OUT_OF_MEMORY;failUpload=-1;}else if(failUpload>0)--failUpload;
    };
    nativegl::glDrawArraysInstanced=[](GLenum mode,GLint first,GLsizei vertices,GLsizei count){
        requireCPU(mode==GL_TRIANGLE_STRIP&&first==0&&vertices==4&&count==range.y&&std::count_if(mock::drawAttachments[mock::drawFramebuffer].begin(),mock::drawAttachments[mock::drawFramebuffer].end(),[](auto a){return a!=GL_NONE;})==1,"GPU geometry/count/color routing differs.");
        const auto rec=graphMock::textureBindings[GL_TEXTURE2][GL_TEXTURE_2D],tex=graphMock::textureBindings[GL_TEXTURE0][GL_TEXTURE_2D],rampTex=graphMock::textureBindings[GL_TEXTURE1][GL_TEXTURE_2D];
        requireCPU(records.contains(rec)&&records[rec].size()>=size_t(count)*16,"GPU draw has no complete owned record texture.");
        const auto color=mock::framebufferTextures[mock::drawFramebuffer][GL_COLOR_ATTACHMENT0],depth=mock::framebufferTextures[mock::drawFramebuffer][GL_DEPTH_ATTACHMENT];
        requireCPU(color!=rec&&color!=tex&&color!=rampTex&&!mock::cull&&mock::blend,"GPU draw inherited culling/feedback.");
        draws.push_back({rec,tex,rampTex,color,depth,range,frame,view,projection,system,mock::blendFactors,mock::depthWrite,multiply,half,mock::depthCopies,mock::fullscreenDraws.size()});
        mock::images[color].stamp=700000+draws.size();if(mock::depthWrite)mock::images[depth].stamp=700000+draws.size();
        if(failDraw){mock::pendingError=GL_INVALID_OPERATION;failDraw=false;}
    };
}
}
#ifdef _MSC_VER
#pragma optimize("", off)
__declspec(noinline)
#endif
void testGpuParticles(){
    using namespace bridge;gpuMock::initialize();
    const auto rejects=[](auto f){try{f();}catch(const std::exception&){return true;}return false;};
    std::ifstream in("outputs/native-renderer-verification/gpu-particles.bin",std::ios::binary);requireCPU(in.good(),"Run actual GPU capture CPU fixture first.");
    const std::vector<uint8_t> wire((std::istreambuf_iterator<char>(in)),{});std::vector<uint8_t> base(wire.begin()+16,wire.end());
    uint32_t epoch;std::memcpy(&epoch,base.data(),4);uint32_t frameSize;std::memcpy(&frameSize,base.data()+8,4);const size_t first=16+frameSize;
    uint32_t serial=1,frame=1;
    const auto stamp=[&](std::vector<uint8_t> p){const double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count(),age=0;
        std::memcpy(p.data()+16+224,&now,8);std::memcpy(p.data()+16+232,&age,8);const auto seq=serial++,f=frame++;
        std::memcpy(p.data()+16+36,&seq,4);std::memcpy(p.data()+16+60,&f,4);return p;};
    auto decode=[&](const std::vector<uint8_t>& p){Reader reader{p};reader.u32();return GpuParticleSnapshot::read(reader,epoch);};
    auto initial=stamp(base);const auto decoded=decode(initial);
    requireCPU(decoded.draws.size()==2&&decoded.draws[0].count==3&&decoded.draws[0].start==1&&decoded.draws[0].records[9]==0xffc12345&&decoded.draws[0].records[25]==0xffffffff&&decoded.draws[0].records[41]==0x80000001,"Cross-language GPU seed/ring bits differ.");
    Renderer r;r.initialize();r.epoch=epoch;r.originKnown=true;r.sourceOrigin=decoded.source.geometry.origin;r.presentationReady=true;
    for(auto id:{decoded.draws[0].texture,decoded.draws[0].ramp}){Payload t;t.words({epoch,id,1,1,1,0,1,6});t.bytes.insert(t.bytes.end(),{255,255,255,255});r.receive(Texture,1,t.bytes);}
    auto receive=[&](std::vector<uint8_t> p){r.receive(GpuParticles,1,p);};
    nativegl::glBindBuffer(GL_PIXEL_UNPACK_BUFFER,91001);nativegl::glPixelStorei(GL_UNPACK_ROW_LENGTH,7);
    receive(initial);requireCPU(mock::bufferBindings[GL_PIXEL_UNPACK_BUFFER]==91001&&graphMock::pixelStore[GL_UNPACK_ROW_LENGTH]==7,"GPU transaction leaked unpack state.");
    const auto firstUploads=r.gpuParticles.uploads;r.render(0,640,360,false);
    requireCPU(gpuMock::draws.size()==2&&gpuMock::draws[0].range==glm::ivec2(1,3)&&gpuMock::draws[0].multiply==1&&gpuMock::draws[1].multiply==0&&!gpuMock::draws[0].depthWrite,"GPU source multiply/add order or depth differs.");
    requireCPU(gpuMock::draws[0].system==decoded.draws[0].system&&gpuMock::draws[0].frame==decoded.draws[0].frame&&gpuMock::draws[0].view==decoded.source.view,"GPU uniforms did not reach the actual native draw.");
    const auto handle=gpuMock::draws[0].records,allocations=mock::textureAllocations;
    receive(stamp(base));r.render(0,640,360,false);requireCPU(r.gpuParticles.uploads==firstUploads&&mock::textureAllocations==allocations&&gpuMock::draws.back().records!=0,"Stable GPU record resources were reuploaded/reallocated.");
    // Records are never advanced using the native clock; exact input frame remains.
    requireCPU(gpuMock::draws.back().frame.w==2,"Native GPU source time was extrapolated.");
    const auto committed=r.cameraFrame.counter;
    for(const auto [offset,value]:std::vector<std::pair<size_t,uint32_t>>{{first+8,8193},{first+12,3},{first+24,16},{first+28,0},{first+56,0},{first+72+36*4+3*4,0x7fc00000}}){auto bad=stamp(base);std::memcpy(bad.data()+offset,&value,4);const auto before=r.lastSourceSerial;requireCPU(rejects([&]{receive(bad);})&&r.lastSourceSerial==before&&!r.gpuParticles.valid,"Bad GPU packet committed partial ready data.");}
    auto shortPacket=stamp(base);shortPacket.pop_back();requireCPU(rejects([&]{receive(shortPacket);}),"Truncated GPU transaction accepted.");
    auto replay=stamp(base);receive(replay);requireCPU(rejects([&]{receive(replay);})&&!r.gpuParticles.valid,"GPU source replay remained ready.");
    receive(stamp(base));r.irisPlan=std::make_unique<IrisPlan>(graphPlan());
    requireCPU(rejects([&]{r.render(0,640,360,false);})&&r.irisGraph.frames==0,"GPU adapter bypassed explicit graph output gate.");
    r.irisPlan->sourceGpuParticleColor=0;r.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();
    const auto graphDraws=gpuMock::draws.size();receive(stamp(base));r.render(0,640,360,false);
    requireCPU(gpuMock::draws.size()==graphDraws+2&&r.irisGraph.frames==1&&gpuMock::draws[graphDraws].depthCopies>=3&&gpuMock::draws[graphDraws].fullscreens>=4,"GPU particles were not drawn after graph depth/deferred boundaries.");
    requireCPU(mock::images[r.irisGraph.depth(1)].stamp==0&&mock::images[r.irisGraph.depth(2)].stamp==0&&mock::images[r.irisGraph.depth(3)].stamp==0,"GPU source particles altered retained opaque/hand/shadow depth.");
    const auto success=r.irisGraph.frames;const auto feetSerial=r.completedGeometryFrame.serial;
    receive(stamp(base));gpuMock::failDraw=true;requireCPU(rejects([&]{r.render(0,640,360,false);})&&r.irisGraph.frames==success&&r.completedGeometryFrame.serial==feetSerial,"Failed GPU draw committed graph/reference history.");
    receive(stamp(base));mock::fullscreenDrawsBeforeFailure=4;requireCPU(rejects([&]{r.render(0,640,360,false);})&&r.irisGraph.frames==success,"Final failure after GPU draw committed history.");
    receive(stamp(base));r.geometryFrame.expires=std::chrono::steady_clock::now()-std::chrono::milliseconds(1);requireCPU(rejects([&]{r.render(0,640,360,false);}),"Expired GPU snapshot drew.");
    auto stale=stamp(base);const double age=251;std::memcpy(stale.data()+16+232,&age,8);requireCPU(rejects([&]{receive(stale);}),"Transport-aged GPU snapshot accepted.");
    receive(stamp(base));requireCPU(rejects([&]{r.render(0,800,450,false);}),"Resize reused old GPU source matrices.");
    {auto resized=base;const uint32_t w=800,h=450;std::memcpy(resized.data()+16+28,&w,4);std::memcpy(resized.data()+16+32,&h,4);receive(stamp(resized));r.render(0,800,450,false);requireCPU(r.targets.width==800&&r.targets.height==450,"Fresh GPU viewport did not recover after resize.");}
    for(uint32_t convention:{1u,2u,3u}){auto depth=base;const uint32_t flags=44|convention;std::memcpy(depth.data()+16+24,&flags,4);for(int pass=0;pass<2;++pass){const auto offset=first+pass*(1352+3*64);const uint32_t function=convention&2?GL_GEQUAL:GL_LEQUAL;std::memcpy(depth.data()+offset+28,&function,4);}receive(stamp(depth));r.render(0,640,360,false);requireCPU(gpuMock::draws.back().half==int(convention&1),"GPU canonical half-Z uniform differs from observed convention.");}
    Payload rebase;rebase.words({epoch});rebase.floats({-32,0,0});r.receive(Rebase,1,rebase.bytes);requireCPU(rejects([&]{r.render(0,640,360,false);})&&rejects([&]{receive(stamp(base));}),"Rebase mixed GPU source coordinates.");
    {auto moved=base;const double origin=r.sourceOrigin.x;const float eye=-30,translation=30,offset=-22;std::memcpy(moved.data()+16+240,&origin,8);std::memcpy(moved.data()+16+196,&eye,4);std::memcpy(moved.data()+16+68+12*4,&translation,4);
        for(int pass=0;pass<2;++pass){const auto at=first+pass*(1352+3*64)+72;std::memcpy(moved.data()+at+12*4,&translation,4);std::memcpy(moved.data()+at+32*4,&offset,4);}receive(stamp(moved));r.render(0,640,360,false);requireCPU(gpuMock::draws.back().frame.x==-22&&r.geometryFrame.feet==decoded.source.geometry.feet,"Fresh GPU rebase altered absolute coordinates or double-applied shift.");}
    r.sourceOrigin=decoded.source.geometry.origin;receive(stamp(base));
    Payload pause;pause.words({epoch,2,0});r.receive(RenderControl,1,pause.bytes);requireCPU(!r.gpuParticles.valid,"Fallback retained GPU readiness.");receive(stamp(base));r.presentationReady=true;r.render(0,640,360,false);
    // Failure on the second resource upload cannot expose the first new resource.
    auto changed=base;const uint32_t changedSeed=0xfedcba98;const size_t stride=1352+3*64;for(int i=0;i<2;++i)std::memcpy(changed.data()+first+i*stride+1352+36,&changedSeed,4);
    gpuMock::failUpload=1;const auto sourceSerial=r.lastSourceSerial;requireCPU(rejects([&]{receive(stamp(changed));})&&!r.gpuParticles.valid&&r.lastSourceSerial==sourceSerial,"Partial GPU upload became ready or changed source camera.");
    receive(stamp(changed));r.render(0,640,360,false);requireCPU(gpuMock::records.at(gpuMock::draws.back().records)[9]==changedSeed,"GPU upload recovery lost seed bits.");
    {auto snapshot=decode(stamp(base));GpuParticleResources limited;requireCPU(rejects([&]{limited.accept(snapshot,FrameTargets::budget-1,FrameTargets::budget);})&&limited.bytes()==0,"GPU replacement exceeded shared budget.");}
    const auto beforeDelete=mock::deletedTextures.size();auto empty=stamp(base);empty.resize(first);const uint32_t zero=0;std::memcpy(empty.data()+12,&zero,4);receive(empty);requireCPU(r.gpuParticles.draws.empty()&&r.gpuParticles.bytes()==0&&mock::deletedTextures.size()>beforeDelete,"Removed GPU resources were retained.");
    requireCPU(std::find(mock::deletedTextures.begin(),mock::deletedTextures.end(),handle)!=mock::deletedTextures.end(),"Original GPU records were not released.");
    (void)committed;
}
#ifdef _MSC_VER
#pragma optimize("", on)
#endif
