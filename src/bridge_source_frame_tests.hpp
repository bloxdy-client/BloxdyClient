#pragma once
// CPU-only wire-to-renderer regression tests, with the same GL mocks as geometry.
#ifdef _MSC_VER
#pragma optimize("", off)
__declspec(noinline)
#endif
void testSourceFrames(){
    using namespace bridge;using S=GeometrySlot;
    const auto rejects=[](auto fn){try{fn();}catch(const std::exception&){return true;}return false;};
    const auto matrixNear=[](const glm::mat4& a,const glm::mat4& b){for(int i=0;i<16;++i)if(std::abs(glm::value_ptr(a)[i]-glm::value_ptr(b)[i])>1e-4f)return false;return true;};
    const auto utc=[](){return std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();};
    // Optional cross-language fixture is emitted by the actual capture VM test.
    {std::ifstream input("outputs/native-renderer-verification/source-frame.bin",std::ios::binary);
        requireCPU(input.good(),"Run the source capture VM tests to generate the wire fixture first.");
        std::vector<uint8_t> wire((std::istreambuf_iterator<char>(input)),{});requireCPU(wire.size()==452,"Unexpected capture wire layout.");
        const auto now=utc();std::memcpy(wire.data()+224,&now,8);const double age=0;std::memcpy(wire.data()+232,&age,8);
        std::vector<uint8_t> payload(wire.begin()+16,wire.end());Reader r{payload};r.u32();const auto decoded=SourceFrameData::read(r);
        requireCPU(decoded.geometry.feetKnown&&decoded.geometry.eyeKnown&&decoded.geometry.feet.x==1000000002.25&&decoded.geometry.observedHand.known&&!decoded.geometry.hand.known,"Actual capture wire lost doubles/provenance or invented reference hand values.");
    }
    Renderer r;r.initialize();r.epoch=81;r.presentationReady=true;r.originKnown=true;r.sourceOrigin={1000000000.25,64,-100};
    r.irisPlan=std::make_unique<IrisPlan>(graphPlan());r.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();
    auto& slots=r.irisPlan->programs->slots;
    slots[static_cast<size_t>(S::Terrain)]=geometryMock::fixture(43000);
    slots[static_cast<size_t>(S::Hand)]=geometryMock::fixture(43001);
    auto& hand=*slots[static_cast<size_t>(S::Hand)];hand.handProjection=HandProjectionMode::ObservedSource;
    for(uint32_t id=0;id<2;++id){auto& m=r.meshes[id];m.vao=93100+id;m.vbo=93200+id;m.ebo=93300+id;m.indexCount=3;m.boundsValid=true;
        m.boundsMin={1.9f,4.5f,1.9f};m.boundsMax={2.1f,4.7f,2.1f};m.irisTerrain=true;
        if(id)m.renderState.flags=SourceDrawState::Camera|SourceDrawState::Hand|SourceDrawState::ClearDepth;m.renderState.group=id?1:0;}
    uint32_t serial=0,playerToken=20,cameraToken=10,rootToken=11,originToken=30;glm::vec3 localCamera{2,4.6f,4},localFeet{2,3,4};bool half=false,reverse=false;uint32_t width=64,height=32;
    auto packet=[&](double age=0,bool known=true){Payload p;p.words({81,1,(half?1u:0u)|(reverse?2u:0u)|(known?60u:0u),width,height,++serial,cameraToken,rootToken,known?7u:0u,known?playerToken:0u,known?originToken:0u,known?serial:0u,known?2u:0u});
        const auto view=glm::translate(glm::mat4(1),-localCamera);auto world=half?glm::perspectiveRH_ZO(1.f,static_cast<float>(width)/height,.1f,128.f):glm::perspectiveRH_NO(1.f,static_cast<float>(width)/height,.1f,128.f);
        auto observed=half?glm::perspectiveRH_ZO(1.2f,static_cast<float>(width)/height,.03125f,256.f):glm::perspectiveRH_NO(1.2f,static_cast<float>(width)/height,.03125f,256.f);
        if(reverse)for(int c=0;c<4;++c){world[c][2]=half?world[c][3]-world[c][2]:-world[c][2];observed[c][2]=half?observed[c][3]-observed[c][2]:-observed[c][2];}
        p.matrix(view);p.matrix(world);for(int i=0;i<3;++i)p.add(localCamera[i]);p.floats({0,0,0,1});p.add(utc());p.add(age);
        if(known){for(const auto v:{r.sourceOrigin,r.sourceOrigin+glm::dvec3(localFeet),r.sourceOrigin+glm::dvec3(localCamera)})for(int i=0;i<3;++i)p.add(v[i]);p.matrix(view);p.matrix(observed);for(int i=0;i<3;++i)p.add(localCamera[i]);}
        return p;
    };
    auto receive=[&](double age=0,bool known=true){auto p=packet(age,known);r.receive(SourceFrame,1,p.bytes);
        if(known){auto& draw=r.meshes[1].renderState;draw.view=r.geometryFrame.observedHand.view;draw.projection=r.geometryFrame.observedHand.canonicalProjection();draw.camera=localCamera;draw.flags=1|2|8|(half?4:0);draw.inverseView=CameraHistory::checkedInverse(draw.view);}
    };
    receive();requireCPU(r.geometryFrame.feetKnown&&r.geometryFrame.eyeKnown&&!r.geometryFrame.hand.known,"Source feet/eye are missing or source observation became reference bob.");
    const auto firstDraw=geometryMock::draws.size();r.render(0,width,height,false);
    const auto world=geometryMock::draws.at(firstDraw);const auto observed=geometryMock::draws.at(firstDraw+1);
    requireCPU(world.integers.at(108)==1&&matrixNear(world.matrices.at(107),r.view*glm::translate(glm::mat4(1),localFeet)),"Transported feet did not reach gbufferModelView.");
    requireCPU(matrixNear(observed.matrices.at(101),r.geometryFrame.observedHand.projection(width,height))&&!matrixNear(observed.matrices.at(101),r.cameraFrame.projection),"Actual observed hand projection did not reach the draw.");
    requireCPU(world.integers.at(112)==0,"Source packet invented Minecraft world time.");
    // Every structural failure must preserve camera, geometry and completed history.
    const auto saved=r.geometryFrame;const auto view=r.view;const auto successful=r.irisGraph.frames;
    for(const auto offset:{4u,8u,12u,24u,36u,52u,248u}){auto bad=packet();uint32_t invalid=offset==24||offset==36?0:0xffffffff;std::memcpy(bad.bytes.data()+offset,&invalid,4);if(offset==248){const double nan=std::numeric_limits<double>::quiet_NaN();std::memcpy(bad.bytes.data()+offset,&nan,8);}
        requireCPU(rejects([&]{r.receive(SourceFrame,2,bad.bytes);})&&r.geometryFrame.serial==saved.serial&&r.view==view&&r.irisGraph.frames==successful,"Malformed source transaction mutated live state.");}
    auto truncated=packet();truncated.bytes.pop_back();requireCPU(rejects([&]{r.receive(SourceFrame,3,truncated.bytes);}),"Truncated source transaction accepted.");
    auto duplicate=packet();r.receive(SourceFrame,4,duplicate.bytes);requireCPU(rejects([&]{r.receive(SourceFrame,4,duplicate.bytes);}),"Replayed source serial accepted.");
    receive();hand.handProjection=HandProjectionMode::Reference;requireCPU(rejects([&]{r.render(0,width,height,false);})&&r.irisGraph.frames==successful,"Source hand silently supplied reference HUD/hurt/bob data.");hand.handProjection=HandProjectionMode::ObservedSource;
    r.render(0,width,height,false);const auto committed=r.completedGeometryFrame.serial;const auto commits=r.irisGraph.frames;
    receive();geometryMock::failProgram=43001;requireCPU(rejects([&]{r.render(0,width,height,false);})&&r.completedGeometryFrame.serial==committed&&r.irisGraph.frames==commits,"Failed source hand draw committed history.");
    receive();mock::fullscreenDrawsBeforeFailure=4;requireCPU(rejects([&]{r.render(0,width,height,false);})&&r.completedGeometryFrame.serial==committed&&r.irisGraph.frames==commits,"Failed final after source-bound geometry committed history.");
    r.geometryFrame.expires=std::chrono::steady_clock::now()-std::chrono::milliseconds(1);
    requireCPU(rejects([&]{r.render(0,width,height,false);})&&r.completedGeometryFrame.serial==committed,"Expired source data committed history.");
    receive(251);requireCPU(!r.geometryFrame.feetKnown&&!r.geometryFrame.observedHand.known&&rejects([&]{r.render(0,width,height,false);}),"Old source observation remained known.");
    {auto future=packet();const double later=utc()+1000;std::memcpy(future.bytes.data()+208,&later,8);r.receive(SourceFrame,1,future.bytes);requireCPU(!r.geometryFrame.feetKnown&&!r.geometryFrame.observedHand.known,"Future-clock source observation remained known.");}
    {auto mismatch=packet();for(const auto offset:{224u,248u,272u}){double v;std::memcpy(&v,mismatch.bytes.data()+offset,8);v+=64;std::memcpy(mismatch.bytes.data()+offset,&v,8);}const auto origin=r.sourceOrigin;r.receive(SourceFrame,1,mismatch.bytes);requireCPU(!r.geometryFrame.feetKnown&&!r.geometryFrame.observedHand.known&&r.sourceOrigin==origin,"Mismatching source origin altered the render origin or retained known data.");}
    receive();{auto backward=packet();uint32_t oldFrame=0;std::memcpy(backward.bytes.data()+44,&oldFrame,4);r.receive(SourceFrame,1,backward.bytes);requireCPU(!r.geometryFrame.feetKnown&&!r.geometryFrame.observedHand.known,"Backwards source frame reused player data.");}
    receive();r.meshes[1].renderState.camera.x+=1;requireCPU(rejects([&]{r.render(0,width,height,false);}),"Contradictory mesh hand camera accepted.");receive();
    r.render(0,width,height,false);requireCPU(geometryMock::draws[geometryMock::draws.size()-2].integers.at(110)==0,"Backwards frame retained previous source history.");
    receive();r.render(0,width,height,false);requireCPU(geometryMock::draws[geometryMock::draws.size()-2].integers.at(110)==1,"Source history did not recover after failed frame.");
    // Known rebase retains absolute feet and successful reference history.
    const auto before=r.completedGeometryFrame.feet;Payload rebase;rebase.words({81});rebase.floats({-32,0,0});r.receive(Rebase,1,rebase.bytes);localCamera.x-=32;localFeet.x-=32;
    requireCPU(rejects([&]{r.render(0,width,height,false);}),"Rebase reused a snapshot from the old origin.");receive();r.render(0,width,height,false);
    requireCPU(r.completedGeometryFrame.feet==before&&geometryMock::draws[geometryMock::draws.size()-2].integers.at(110)==1&&matrixNear(geometryMock::draws[geometryMock::draws.size()-2].matrices.at(109),world.matrices.at(107)),"Known rebase lost feet-space history.");
    for(auto* token:{&playerToken,&cameraToken,&rootToken,&originToken}){++*token;receive();r.render(0,width,height,false);requireCPU(geometryMock::draws[geometryMock::draws.size()-2].integers.at(110)==0,"Identity change reused source player history.");}
    width=80;height=40;requireCPU(rejects([&]{r.render(0,width,height,false);}),"Resized output reused the old source projection.");receive();r.render(0,width,height,false);requireCPU(geometryMock::draws[geometryMock::draws.size()-2].integers.at(110)==0,"Resize reused previous source history.");
    for(bool halfDepth:{false,true})for(bool reverseDepth:{false,true}){half=halfDepth;reverse=reverseDepth;receive();r.render(0,width,height,false);
        requireCPU(matrixNear(geometryMock::draws.back().matrices.at(101),r.geometryFrame.observedHand.projection(width,height)),"Observed hand half/reverse-Z was transformed twice.");}
    receive(0,false);requireCPU(!r.geometryFrame.feetKnown&&!r.geometryFrame.observedHand.known&&rejects([&]{r.render(0,width,height,false);}),"Unknown source data retained old hand/feet.");
    Payload pause;pause.words({81,2,0});r.receive(RenderControl,1,pause.bytes);const auto count=r.irisGraph.frames;r.render(0,width,height,false);requireCPU(r.irisGraph.frames==count,"Fallback committed source history.");
    Payload reset;reset.words({82});r.receive(Reset,1,reset.bytes);const auto old=packet();r.receive(SourceFrame,1,old.bytes);requireCPU(!r.geometryFrame.serial&&!r.hasCamera,"Old-scene source transaction crossed reset.");
}
#ifdef _MSC_VER
#pragma optimize("", on)
#endif
