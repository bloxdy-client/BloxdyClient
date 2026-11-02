#pragma once
namespace lightMock {
PFNGLUNIFORM1FPROC old1;PFNGLUNIFORM3FVPROC old3;PFNGLUNIFORM4FVPROC old4;PFNGLDRAWELEMENTSPROC oldDraw;
bridge::IrisGeometryFrame* expire=nullptr;
}
#ifdef _MSC_VER
#pragma optimize("", off)
__declspec(noinline)
#endif
void testSourceLight(){
    using namespace bridge;using U=GeometryUniform;
    const auto rejects=[](auto f){try{f();}catch(const std::exception&){return true;}return false;};
    lightMock::old3=nativegl::glUniform3fv;lightMock::old4=nativegl::glUniform4fv;lightMock::oldDraw=nativegl::glDrawElements;
    lightMock::old1=nativegl::glUniform1f;
    nativegl::glUniform1f=[](GLint l,GLfloat v){lightMock::old1(l,v);geometryMock::vectors[mock::currentProgram][l]=glm::vec4(v,0,0,0);};
    nativegl::glUniform3fv=[](GLint l,GLsizei n,const GLfloat* v){lightMock::old3(l,n,v);geometryMock::vectors[mock::currentProgram][l]=glm::vec4(glm::make_vec3(v),0);};
    nativegl::glUniform4fv=[](GLint l,GLsizei n,const GLfloat* v){lightMock::old4(l,n,v);geometryMock::vectors[mock::currentProgram][l]=glm::make_vec4(v);};
    nativegl::glDrawElements=[](GLenum m,GLsizei n,GLenum t,const void* p){lightMock::oldDraw(m,n,t,p);if(lightMock::expire){lightMock::expire->expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);lightMock::expire=nullptr;}};
    std::ifstream in("outputs/native-renderer-verification/source-light.bin",std::ios::binary);requireCPU(in.good(),"Missing actual source light capture fixture.");
    std::vector<uint8_t> wire((std::istreambuf_iterator<char>(in)),{}),base(wire.begin()+16,wire.end());
    uint32_t epoch;std::memcpy(&epoch,base.data(),4);uint32_t serial=100,frame=100;
    const auto stamp=[&](std::vector<uint8_t> p,double age=0){const double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();
        std::memcpy(p.data()+88+224,&now,8);std::memcpy(p.data()+88+232,&age,8);++serial;++frame;
        std::memcpy(p.data()+88+36,&serial,4);std::memcpy(p.data()+88+60,&frame,4);return p;};
    auto initial=stamp(base);Reader reader{initial};reader.u32();auto decoded=SourceLightSnapshot::read(reader,epoch);
    requireCPU(!decoded.hasGpu&&decoded.batch.source.geometry.light.flags==15&&decoded.batch.source.geometry.light.heldVector==glm::vec4(2,3,4,0),"Native decoder changed source light units/provenance.");
    Renderer r;r.initialize();r.epoch=epoch;r.originKnown=true;r.sourceOrigin=decoded.batch.source.geometry.origin;r.presentationReady=true;
    r.irisPlan=std::make_unique<IrisPlan>(graphPlan());r.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();
    auto p=geometryMock::fixture(47000);
    const std::array<U,6> values{U::SourceLightingEnabled,U::SourceSkyLight,U::SourceAmbientLight,U::SourceHeldLight,U::SourceHeldVector,U::SourceSkySunDirection};
    for(int i=0;i<6;++i){const auto name="sourceLight"+std::to_string(i),valid=name+"Known";p.uniforms.push_back({name,200+2*i,values[i],valid,201+2*i});
        geometryMock::programs[47000].uniforms.push_back({name,200+2*i,geometryUniformType(values[i])});geometryMock::programs[47000].uniforms.push_back({valid,201+2*i,GL_BOOL});}
    auto& slot=r.irisPlan->programs->slots[static_cast<size_t>(GeometrySlot::Terrain)];slot=p;
    r.irisPlan->programs->slots[static_cast<size_t>(GeometrySlot::Shadow)]=p;
    auto& m=r.meshes[1];m.vao=97100;m.vbo=97200;m.ebo=97300;m.indexCount=3;m.boundsValid=true;m.irisTerrain=true;m.boundsMin={1.9f,4.5f,3.9f};m.boundsMax={2.1f,4.7f,4.1f};
    auto receive=[&](const auto& data){
        auto framed=wire;framed.resize(16+data.size());std::copy(data.begin(),data.end(),framed.begin()+16);
        const uint32_t size=static_cast<uint32_t>(data.size());std::memcpy(framed.data()+8,&size,4);
        receiveCpuWire(framed,[&](auto type,auto sequence,const auto& payload){r.receive(type,sequence,payload);});
    };auto draw=[&](){r.render(0,640,360,false);};
    receive(initial);draw();auto d=geometryMock::draws.back();
    requireCPU(d.integers.at(201)==1&&d.integers.at(200)==1&&d.integers.at(203)==1&&d.vectors.at(202)==glm::vec4(.8f,.9f,1,0)&&d.vectors.at(204)==glm::vec4(.2f,.2f,.2f,0)&&d.vectors.at(206)==glm::vec4(12,3,1,20)&&d.vectors.at(208)==glm::vec4(2,3,4,0)&&d.vectors.at(210)==glm::vec4(0,.6f,.8f,0)&&d.integers.at(112)==0,"Actual Iris draw lost source lights or invented reference time.");
    r.environment.sunKnown=true;r.environment.sun=glm::normalize(glm::vec3(.3f,.8f,.2f));receive(stamp(base));const auto shadowStart=geometryMock::draws.size();draw();
    requireCPU(geometryMock::draws.size()>=shadowStart+2&&geometryMock::draws[shadowStart].vectors.at(206)==glm::vec4(12,3,1,20),"Source light did not reach an actual shadow geometry draw.");r.environment.sunKnown=false;
    // Own emission must not be inferred from the actual captured held/global RGB,
    // imported material emissive tint, source surface buffer, or an instance slot.
    // These exercise the real decoder -> graph -> geometry draw path, not a fake provider.
    {
        auto probe=p;probe.uniforms.push_back({"ownEmission",242,U::OwnEmission,"ownEmissionKnown",243});
        auto& reflection=geometryMock::programs[47000].uniforms;
        reflection.push_back({"ownEmission",242,GL_FLOAT});reflection.push_back({"ownEmissionKnown",243,GL_BOOL});
        slot=probe;r.irisPlan->programs->slots[static_cast<size_t>(GeometrySlot::Shadow)]=probe;
        m.emission={15,2,7};m.surfaces=97400;
        r.environment.sunKnown=true;
        for(bool instanced:{false,true}){
            m.instances=instanced?97500:0;m.instanceCount=instanced?2:0;
            geometryMock::vectors[47000][242]=glm::vec4(15);geometryMock::integers[47000][243]=1;
            receive(stamp(base));const auto begin=geometryMock::draws.size();draw();
            requireCPU(geometryMock::draws.size()>=begin+2,"Missing actual emission-gate world/shadow draws.");
            for(size_t i=begin;i<geometryMock::draws.size();++i){const auto& actual=geometryMock::draws[i];
                requireCPU(actual.vectors.at(242)==glm::vec4(0)&&actual.integers.at(243)==0,"Unknown own emission became known zero or retained stale emissive data.");}
        }
        const auto framesBefore=r.irisGraph.frames;const auto serialBefore=r.completedGeometryFrame.serial;
        probe.uniforms.back().validity=-1;probe.uniforms.back().validityName.clear();reflection.pop_back();
        slot=probe;r.irisPlan->programs->slots[static_cast<size_t>(GeometrySlot::Shadow)]=probe;
        receive(stamp(base));requireCPU(rejects(draw)&&r.irisGraph.frames==framesBefore&&r.completedGeometryFrame.serial==serialBefore,"Required own emission was fabricated or failed draw committed history.");
        reflection.pop_back();slot=p;r.irisPlan->programs->slots[static_cast<size_t>(GeometrySlot::Shadow)]=p;
        m.instances=0;m.instanceCount=0;m.emission=glm::vec3(0);m.surfaces=0;r.environment.sunKnown=false;
        receive(stamp(base));draw();
    }
    const auto success=r.irisGraph.frames;const auto committed=r.completedGeometryFrame.serial;
    receive(stamp(base));geometryMock::failProgram=47000;requireCPU(rejects(draw)&&r.irisGraph.frames==success&&r.completedGeometryFrame.serial==committed,"Failed light-bound draw committed history.");
    receive(stamp(base));mock::fullscreenDrawsBeforeFailure=4;requireCPU(rejects(draw)&&r.irisGraph.frames==success,"Failed final committed light frame.");
    receive(stamp(base));lightMock::expire=&r.geometryFrame;requireCPU(rejects(draw)&&r.irisGraph.frames==success,"Light expiry between geometry and commit was ignored.");
    auto unknown=base;uint32_t flags=1;std::memcpy(unknown.data()+12,&flags,4);std::fill(unknown.begin()+20,unknown.begin()+88,0);
    receive(stamp(unknown));draw();d=geometryMock::draws.back();requireCPU(d.integers.at(203)==0&&d.vectors.at(202)==glm::vec4(0)&&d.integers.at(207)==0&&d.vectors.at(206)==glm::vec4(0)&&d.integers.at(211)==0&&d.vectors.at(210)==glm::vec4(0),"Optional unknown source lights kept old uniform values.");
    // Remove both reflected validity and descriptor: required unknown must fail.
    auto& required=slot->uniforms[11];requireCPU(required.value==U::SourceSkyLight,"Fixture binding index changed.");
    required.validity=-1;required.validityName.clear();auto& reflected=geometryMock::programs[47000].uniforms;
    reflected.erase(std::remove_if(reflected.begin(),reflected.end(),[](const auto& v){return v.location==203;}),reflected.end());
    requireCPU(rejects(draw),"Required unknown source light was accepted.");slot=p;reflected.push_back({"sourceLight1Known",203,GL_BOOL});
    for(const auto offset:{4u,8u,12u,16u,20u,88u,108u}){auto bad=stamp(base);uint32_t v=0xffffffff;std::memcpy(bad.data()+offset,&v,4);const auto before=r.lastSourceSerial;
        requireCPU(rejects([&]{receive(bad);})&&r.lastSourceSerial==before&&!r.geometryFrame.light.flags,"Malformed light transaction changed camera or retained lights.");}
    auto shortPacket=stamp(base);shortPacket.pop_back();requireCPU(rejects([&]{receive(shortPacket);}),"Truncated light transaction accepted.");
    auto replay=stamp(base);receive(replay);requireCPU(rejects([&]{receive(replay);})&&!r.geometryFrame.light.flags,"Replay retained light validity.");
    auto accepted=stamp(base);receive(accepted);const auto acceptedFrame=r.geometryFrame.renderFrame;
    {std::vector<uint8_t> legacy(accepted.begin()+88+16,accepted.end());uint32_t seq=++serial,flags=0,zero=0;std::memcpy(legacy.data()+20,&seq,4);std::memcpy(legacy.data()+8,&flags,4);for(auto at:{32u,36u,40u,44u,48u})std::memcpy(legacy.data()+at,&zero,4);legacy.resize(224);r.receive(SourceFrame,1,legacy);}
    auto repeated=stamp(base);const auto repeatedFrame=acceptedFrame;std::memcpy(repeated.data()+88+60,&repeatedFrame,4);requireCPU(rejects([&]{receive(repeated);}),"Fresh serial renewed an old source render.");
    requireCPU(rejects([&]{receive(stamp(base,251));})&&!r.geometryFrame.light.flags,"Expired wire lights accepted.");
    receive(stamp(base));r.geometryFrame.expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);draw();requireCPU(geometryMock::draws.back().integers.at(203)==0,"Expired optional lights stayed known.");
    receive(stamp(base));r.render(0,1280,720,false);requireCPU(geometryMock::draws.back().integers.at(203)==0,"Resized frame reused light bindings.");
    receive(stamp(base));Payload rebase;rebase.words({epoch});rebase.floats({-32,0,0});r.receive(Rebase,1,rebase.bytes);draw();requireCPU(geometryMock::draws.back().integers.at(203)==0&&rejects([&]{receive(stamp(base));}),"Old-origin lights survived rebase.");
    // Fresh rebase snapshot retains local position rather than relabelling it absolute.
    auto rebased=base;const double origin=r.sourceOrigin.x;const float camera=-30,view=30,held=-30;
    std::memcpy(rebased.data()+88+240,&origin,8);std::memcpy(rebased.data()+88+196,&camera,4);std::memcpy(rebased.data()+88+116,&view,4);std::memcpy(rebased.data()+60,&held,4);
    receive(stamp(rebased));draw();requireCPU(geometryMock::draws.back().vectors.at(208).x==-30,"Fresh held-light local origin was lost.");
    r.sourceOrigin=decoded.batch.source.geometry.origin;
    for(uint32_t convention:{1u,2u,3u}){auto q=base;uint32_t f=44|convention;std::memcpy(q.data()+88+24,&f,4);receive(stamp(q));draw();requireCPU(geometryMock::draws.back().vectors.at(202).x==.8f,"Depth convention altered source RGB.");}
    receive(stamp(base));Payload pause;pause.words({epoch,2,0});r.receive(RenderControl,1,pause.bytes);const auto count=r.irisGraph.frames;draw();requireCPU(r.irisGraph.frames==count,"Fallback committed a light frame.");receive(stamp(base));r.presentationReady=true;draw();requireCPU(geometryMock::draws.back().integers.at(203)==1,"Source light did not recover.");
    // Every unsupported reference request remains unknown even with proven source light.
    for(auto value:{U::WorldTime,U::Weather,U::PlayerState,U::SemanticIds,U::OwnEmission,U::ReferenceLightmap}){auto q=p;q.uniforms.push_back({"referenceProbe",240,value});geometryMock::programs[47000].uniforms.push_back({"referenceProbe",240,geometryUniformType(value)});slot=q;requireCPU(rejects(draw),"Source light unlocked an unproven reference binding.");geometryMock::programs[47000].uniforms.pop_back();}slot=p;
    Payload reset;reset.words({epoch+1});r.receive(Reset,1,reset.bytes);receive(stamp(base));requireCPU(!r.hasCamera&&!r.geometryFrame.light.flags,"Old scene light crossed reset.");
    // Actual capture-generated envelope contains unchanged GPU packet 31 plus the light group.
    {std::ifstream gpuInput("outputs/native-renderer-verification/source-light-gpu.bin",std::ios::binary);requireCPU(gpuInput.good(),"Missing combined light/GPU capture fixture.");
        std::vector<uint8_t> gpuWire((std::istreambuf_iterator<char>(gpuInput)),{}),payload(gpuWire.begin()+16,gpuWire.end());
        uint32_t scene;std::memcpy(&scene,payload.data(),4);const double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count(),age=0;
        std::memcpy(payload.data()+88+32+224,&now,8);std::memcpy(payload.data()+88+32+232,&age,8);
        Reader input{payload};input.u32();const auto both=SourceLightSnapshot::read(input,scene);
        requireCPU(both.hasGpu&&both.batch.draws.size()==2&&both.batch.source.geometry.light.flags==15&&both.batch.draws[0].records[9]==0xffc12345,"Combined decoder changed q9aot records or source light.");
        Renderer combined;combined.initialize();combined.epoch=scene;combined.originKnown=true;combined.sourceOrigin=both.batch.source.geometry.origin;combined.presentationReady=true;
        for(auto id:{both.batch.draws[0].texture,both.batch.draws[0].ramp}){Payload t;t.words({scene,id,1,1,1,0,1,6});t.bytes.insert(t.bytes.end(),{255,255,255,255});combined.receive(Texture,1,t.bytes);}
        combined.irisPlan=std::make_unique<IrisPlan>(graphPlan());combined.irisPlan->sourceGpuParticleColor=0;
        auto receiveCombined=[&](const auto& data){auto framed=gpuWire;std::copy(data.begin(),data.end(),framed.begin()+16);
            receiveCpuWire(framed,[&](auto type,auto sequence,const auto& bytes){combined.receive(type,sequence,bytes);});};
        receiveCombined(payload);const auto before=gpuMock::draws.size();combined.render(0,640,360,false);
        requireCPU(gpuMock::draws.size()==before+2&&gpuMock::draws.back().frame==both.batch.draws.back().frame&&combined.geometryFrame.light.held.x==12,"Combined renderer lost analytical GPU draw or light frame.");
        auto changed=payload;uint32_t seq=both.batch.source.geometry.serial+1,render=both.batch.source.geometry.renderFrame+1;std::memcpy(changed.data()+88+32+36,&seq,4);std::memcpy(changed.data()+88+32+60,&render,4);
        const size_t first=88+32+312;for(int i=0;i<2;++i){const uint32_t seed=123;std::memcpy(changed.data()+first+i*(1352+3*64)+1352+36,&seed,4);}
        const auto oldSerial=combined.lastSourceSerial;const auto oldCamera=combined.cameraFrames;gpuMock::failUpload=1;
        requireCPU(rejects([&]{receiveCombined(changed);})&&!combined.geometryFrame.light.flags&&!combined.gpuParticles.valid&&combined.lastSourceSerial==oldSerial&&combined.cameraFrames==oldCamera,"Partial combined upload committed light/camera or retained readiness.");
        receiveCombined(changed);combined.render(0,640,360,false);requireCPU(combined.geometryFrame.light.flags==15&&combined.gpuParticles.valid,"Combined source snapshot did not recover after partial upload.");
    }
    nativegl::glUniform1f=lightMock::old1;nativegl::glUniform3fv=lightMock::old3;nativegl::glUniform4fv=lightMock::old4;nativegl::glDrawElements=lightMock::oldDraw;
}
#ifdef _MSC_VER
#pragma optimize("", on)
#endif
