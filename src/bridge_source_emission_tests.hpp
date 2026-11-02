#pragma once
namespace emissionMock {PFNGLUNIFORM3FVPROC old3;PFNGLDRAWELEMENTSPROC oldDraw;PFNGLDRAWELEMENTSINSTANCEDPROC oldInstanced;bridge::IrisGeometryFrame* expire=nullptr;
struct Run {GLuint program;GLsizei count;uintptr_t offset;};std::vector<Run> runs;std::vector<GLsizei> instanceCounts;}
void testSourceEmission(){
    using namespace bridge;
    const auto read=[](const char* file){std::ifstream in(file,std::ios::binary);requireCPU(in.good(),"Missing Capture emission fixture.");return std::vector<uint8_t>((std::istreambuf_iterator<char>(in)),{});};
    auto wire=read("outputs/native-renderer-verification/source-emission.bin"),meshWire=read("outputs/native-renderer-verification/source-emission-mesh.bin");
    const auto word=[](const auto& b,size_t at){uint32_t v;std::memcpy(&v,b.data()+at,4);return v;};
    const auto put=[](auto& b,size_t at,auto v){std::memcpy(b.data()+at,&v,sizeof(v));};
    const auto rejects=[](auto f){try{f();}catch(const std::exception&){return true;}return false;};
    const auto epoch=word(wire,16),id=word(wire,32);uint32_t serial=1000,frame=1000;
    const size_t nested=32+word(wire,28)*16,source=nested+104;
    requireCPU(word(wire,nested+4)==SourceLight&&word(wire,source+4)==SourceFrame,"Unexpected Capture emission nesting.");
    const auto stamp=[&](auto bytes){const double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();
        put(bytes,source+224,now);put(bytes,source+232,0.0);put(bytes,source+36,++serial);put(bytes,source+60,++frame);return bytes;};
    auto initial=stamp(wire);std::vector<uint8_t> payload(initial.begin()+16,initial.end());Reader input{payload};input.u32();
    const auto decoded=SourceEmissionSnapshot::read(input,epoch);requireCPU(decoded.entries.size()==1&&decoded.entries[0].rgb==0x123,"Own source RGB lost its packed channels.");
    Renderer r;r.initialize();r.epoch=epoch;r.originKnown=true;r.sourceOrigin=decoded.batch.source.geometry.origin;r.presentationReady=true;
    auto receive=[&](const auto& bytes){receiveCpuWire(bytes,[&](auto type,auto sequence,const auto& data){r.receive(type,sequence,data);});};
    receive(meshWire);auto& mesh=r.meshes.at(id);mesh.texture=0;mesh.irisTerrain=true;
    r.irisPlan=std::make_unique<IrisPlan>(graphPlan());r.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();
    auto program=geometryMock::fixture(48000);program.uniforms.push_back({"sourceOwnEmissionRgb",260,GeometryUniform::SourceOwnEmissionRgb,"sourceOwnEmissionKnown",261});
    auto& reflection=geometryMock::programs[48000].uniforms;reflection.push_back({"sourceOwnEmissionRgb",260,GL_FLOAT_VEC3});reflection.push_back({"sourceOwnEmissionKnown",261,GL_BOOL});
    auto& slots=r.irisPlan->programs->slots;slots[static_cast<size_t>(GeometrySlot::Terrain)]=program;slots[static_cast<size_t>(GeometrySlot::Shadow)]=program;
    emissionMock::old3=nativegl::glUniform3fv;
    emissionMock::oldDraw=nativegl::glDrawElements;
    emissionMock::oldInstanced=nativegl::glDrawElementsInstanced;
    nativegl::glDrawElementsInstanced=[](GLenum mode,GLsizei count,GLenum type,const void* offset,GLsizei instances){emissionMock::oldInstanced(mode,count,type,offset,instances);
        if(mock::currentProgram==48100)emissionMock::instanceCounts.push_back(instances);
        if(emissionMock::expire){emissionMock::expire->expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);emissionMock::expire=nullptr;}};
    nativegl::glDrawElements=[](GLenum m,GLsizei n,GLenum t,const void* p){emissionMock::oldDraw(m,n,t,p);if(geometryMock::programs.contains(mock::currentProgram))emissionMock::runs.push_back({mock::currentProgram,n,reinterpret_cast<uintptr_t>(p)});if(emissionMock::expire){emissionMock::expire->expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);emissionMock::expire=nullptr;}};
    nativegl::glUniform3fv=[](GLint l,GLsizei n,const GLfloat* values){emissionMock::old3(l,n,values);geometryMock::vectors[mock::currentProgram][l]=glm::vec4(glm::make_vec3(values),0);};
    r.environment.sunKnown=true;r.environment.sun=glm::normalize(glm::vec3(.3,.8,.2));
    auto draw=[&](){r.render(0,640,360,false);};
    const auto begin=geometryMock::draws.size();receive(initial);draw();
    requireCPU(geometryMock::draws.size()>=begin+2,"Own RGB did not reach world and shadow draws.");
    for(size_t i=begin;i<geometryMock::draws.size();++i)requireCPU(geometryMock::draws[i].vectors.at(260)==glm::vec4(3,2,1,0)&&geometryMock::draws[i].integers.at(261)==1,"Actual geometry binding changed RGB or validity.");
    const auto vao=mesh.vao,vbo=mesh.vbo;receive(stamp(wire));draw();requireCPU(mesh.vao==vao&&mesh.vbo==vbo,"Emission-only frame replaced stable geometry buffers.");
    auto zero=stamp(wire);put(zero,44,uint32_t(0));receive(zero);draw();requireCPU(geometryMock::draws.back().vectors.at(260)==glm::vec4(0)&&geometryMock::draws.back().integers.at(261)==1,"Known zero emission became unknown.");
    const auto committed=r.irisGraph.frames,oldCamera=r.cameraFrames;
    auto bad=stamp(wire);put(bad,36,word(bad,36)+1);requireCPU(rejects([&]{receive(bad);})&&r.cameraFrames==oldCamera&&r.irisGraph.frames==committed,"Mismatched mesh sequence committed a frame.");
    draw();requireCPU(geometryMock::draws.back().vectors.at(260)==glm::vec4(0)&&geometryMock::draws.back().integers.at(261)==0,"Failed transaction retained an old own RGB value.");
    auto invalid=stamp(wire);put(invalid,44,uint32_t(4096));requireCPU(rejects([&]{receive(invalid);}),"Invalid RGB packing reached renderer.");
    receive(stamp(wire));const auto success=r.irisGraph.frames;geometryMock::failProgram=48000;requireCPU(rejects(draw)&&r.irisGraph.frames==success,"Failed emission draw committed history.");
    receive(stamp(wire));draw();
    auto replay=stamp(wire);receive(replay);requireCPU(rejects([&]{receive(replay);}),"Emission replay renewed its source frame.");
    auto late=stamp(wire);put(late,source+232,251.0);requireCPU(rejects([&]{receive(late);}),"Expired emission frame was accepted.");
    // Replacing geometry after authorization immediately removes that authorization.
    receive(stamp(wire));receive(meshWire);mesh.texture=0;mesh.irisTerrain=true;draw();
    requireCPU(geometryMock::draws.back().integers.at(261)==0,"Geometry replacement retained old frame emission.");
    auto required=program;required.uniforms.back().validity=-1;required.uniforms.back().validityName.clear();reflection.pop_back();
    slots[static_cast<size_t>(GeometrySlot::Terrain)]=required;slots[static_cast<size_t>(GeometrySlot::Shadow)]=required;
    const auto before=r.irisGraph.frames;requireCPU(rejects(draw)&&r.irisGraph.frames==before,"Unknown required source emission did not block commit.");
    reflection.push_back({"sourceOwnEmissionKnown",261,GL_BOOL});slots[static_cast<size_t>(GeometrySlot::Terrain)]=program;slots[static_cast<size_t>(GeometrySlot::Shadow)]=program;
    receive(stamp(wire));draw();r.geometryFrame.expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);draw();
    requireCPU(geometryMock::draws.back().integers.at(261)==0,"Expired own RGB stayed known at draw.");
    receive(stamp(wire));const auto previous=r.irisGraph.frames;emissionMock::expire=&r.geometryFrame;
    requireCPU(rejects(draw)&&r.irisGraph.frames==previous,"Emission expired during draw but committed history.");
    receive(stamp(wire));r.render(0,800,450,false);requireCPU(geometryMock::draws.back().integers.at(261)==0,"Resize reused emission at the wrong viewport.");
    receive(stamp(wire));draw();Payload off;off.words({epoch,2,0});r.receive(RenderControl,1,off.bytes);Payload on;on.words({epoch,3,1});r.receive(RenderControl,1,on.bytes);draw();
    requireCPU(geometryMock::draws.back().integers.at(261)==0,"Fallback resumed old emission authorization.");receive(stamp(wire));draw();
    Payload rebase;rebase.words({epoch});rebase.floats({1,0,0});r.receive(Rebase,1,rebase.bytes);draw();requireCPU(geometryMock::draws.back().integers.at(261)==0,"Rebase retained old emission authorization.");
    Payload undo;undo.words({epoch});undo.floats({-1,0,0});r.receive(Rebase,1,undo.bytes);receive(stamp(wire));draw();
    // Decode and render the actual combined Capture envelope, not reconstructed GPU records.
    {
        auto combinedWire=read("outputs/native-renderer-verification/source-emission-gpu.bin"),combinedMesh=read("outputs/native-renderer-verification/source-emission-gpu-mesh.bin");
        const auto scene=word(combinedWire,16);size_t inner=32;for(uint32_t i=0;i<word(combinedWire,28);++i)inner+=16+size_t(word(combinedWire,inner+12))*8;const size_t sourceAt=inner+104+32;
        const auto fresh=[&](auto b){const double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();put(b,sourceAt+224,now);put(b,sourceAt+232,0.0);put(b,sourceAt+36,++serial);put(b,sourceAt+60,++frame);return b;};
        combinedWire=fresh(combinedWire);std::vector<uint8_t> data(combinedWire.begin()+16,combinedWire.end());Reader reader{data};reader.u32();auto snapshot=SourceEmissionSnapshot::read(reader,scene);
        requireCPU(snapshot.hasGpu&&snapshot.batch.draws.size()==2&&snapshot.entries.size()==1,"Combined emission envelope lost GPU or own RGB data.");
        Renderer combined;combined.initialize();combined.epoch=scene;combined.originKnown=true;combined.sourceOrigin=snapshot.batch.source.geometry.origin;combined.presentationReady=true;
        auto accept=[&](const auto& bytes){receiveCpuWire(bytes,[&](auto type,auto seq,const auto& p){combined.receive(type,seq,p);});};accept(combinedMesh);
        for(auto texture:{snapshot.batch.draws[0].texture,snapshot.batch.draws[0].ramp}){Payload p;p.words({scene,texture,1,1,1,0,1,6});p.bytes.insert(p.bytes.end(),{255,255,255,255});combined.receive(Texture,1,p.bytes);}
        combined.meshes.at(snapshot.entries[0].mesh).texture=0;
        combined.irisPlan=std::make_unique<IrisPlan>(graphPlan());combined.irisPlan->sourceGpuParticleColor=0;combined.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();combined.irisPlan->programs->slots[static_cast<size_t>(GeometrySlot::Terrain)]=program;
        accept(combinedWire);const auto start=gpuMock::draws.size(),geometryStart=geometryMock::draws.size();combined.render(0,640,360,false);
        requireCPU(gpuMock::draws.size()==start+2&&geometryMock::draws.size()==geometryStart+4&&geometryMock::draws[geometryStart].integers.at(261)==1&&geometryMock::draws.back().integers.at(261)==0,"Combined transaction lost actual GPU or per-face RGB/unknown draws.");
        auto changed=fresh(combinedWire);const auto sourceSerial=combined.lastSourceSerial;const auto sourceCamera=combined.cameraFrames;
        // Invalid geometry association is rejected before any GPU/frame acceptance.
        put(changed,36,word(changed,36)+1);requireCPU(rejects([&]{accept(changed);})&&combined.lastSourceSerial==sourceSerial&&combined.cameraFrames==sourceCamera&&!combined.gpuParticles.valid,"Mixed-generation combined frame committed or retained GPU readiness.");
        accept(fresh(combinedWire));combined.render(0,640,360,false);
    }
    // Exact Capture type33/v2 -> actual fragmented Pipe ingress -> decoder ->
    // real world/shadow callbacks, with GL replaced by inert CPU functions.
    for(const bool remap:{false,true}){
        auto bytes=read(remap?"outputs/native-renderer-verification/source-emission-remap.bin":"outputs/native-renderer-verification/source-emission-faces.bin");
        auto geometry=read(remap?"outputs/native-renderer-verification/source-emission-remap-mesh.bin":"outputs/native-renderer-verification/source-emission-faces-mesh.bin");
        size_t at=32;for(uint32_t i=0;i<word(bytes,28);++i)at+=16+size_t(word(bytes,at+12))*8;
        const auto scene=word(bytes,16),faceMeshId=word(bytes,32);requireCPU(word(bytes,at+4)==SourceLight,"Per-face fixture lost source light nesting.");
        const auto fresh=[&](auto b){size_t nestedAt=32;for(uint32_t i=0;i<word(b,28);++i)nestedAt+=16+size_t(word(b,nestedAt+12))*8;const auto sourceAt=nestedAt+104;
            const double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();put(b,sourceAt+224,now);put(b,sourceAt+232,0.0);put(b,sourceAt+36,++serial);put(b,sourceAt+60,++frame);return b;};
        auto inputBytes=fresh(bytes);std::vector<uint8_t> data(inputBytes.begin()+16,inputBytes.end());Reader reader{data};reader.u32();auto snapshot=SourceEmissionSnapshot::read(reader,scene);
        requireCPU(snapshot.entries.size()==(remap?2:1)&&!snapshot.entries[0].runs.empty(),"Capture per-face runs were not decoded.");
        Renderer faces;faces.initialize();faces.epoch=scene;faces.originKnown=true;faces.sourceOrigin=snapshot.batch.source.geometry.origin;faces.presentationReady=true;
        auto accept=[&](const auto& wireBytes){receiveCpuWire(wireBytes,[&](auto type,auto sequence,const auto& payload){faces.receive(type,sequence,payload);});};
        accept(geometry);for(auto& [faceId,m]:faces.meshes)m.texture=0;
        faces.environment.sunKnown=true;faces.environment.sun=glm::normalize(glm::vec3(.3,.8,.2));faces.irisPlan=std::make_unique<IrisPlan>(graphPlan());faces.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();
        auto& programs=faces.irisPlan->programs->slots;programs[static_cast<size_t>(GeometrySlot::Terrain)]=program;programs[static_cast<size_t>(GeometrySlot::Shadow)]=program;
        const auto start=geometryMock::draws.size(),ranges=emissionMock::runs.size();accept(inputBytes);faces.render(0,640,360,false);
        if(!remap){
            requireCPU(geometryMock::draws.size()==start+8&&emissionMock::runs.size()==ranges+8,"Per-face world/shadow draws were not split into exact runs.");
            const glm::vec4 rgb[]{glm::vec4(7,0,0,0),glm::vec4(3,2,1,0),glm::vec4(0),glm::vec4(0)};
            for(size_t i=0;i<8;++i){const auto& faceDraw=geometryMock::draws[start+i];const auto& run=emissionMock::runs[ranges+i];
                requireCPU(faceDraw.vectors.at(260)==rgb[i%4]&&faceDraw.integers.at(261)==(i%4==3?0:1)&&run.count==6&&run.offset==(i%4)*24,"Per-face RGB/zero/unknown or exact EBO byte range differs.");}
        }else {
            requireCPU(geometryMock::draws.size()==start+8,"Remapped world/shadow draws lost a triangle or homogeneous subset.");
            const auto end=geometryMock::draws.size();unsigned red=0,zeroRuns=0,unknown=0;
            for(size_t i=start;i<end;++i){const auto& d=geometryMock::draws[i];if(!d.integers.at(261))++unknown;else if(d.vectors.at(260)==glm::vec4(0))++zeroRuns;else ++red;}
            requireCPU(red==4&&zeroRuns==2&&unknown==2,"Remapped RGB and unknown face validity leaked between submeshes.");
        }
        const auto noEmission=geometryMock::fixture(48001);programs[static_cast<size_t>(GeometrySlot::Terrain)]=noEmission;programs[static_cast<size_t>(GeometrySlot::Shadow)]=noEmission;
        const auto plainStart=geometryMock::draws.size();accept(fresh(bytes));faces.render(0,640,360,false);
        requireCPU(geometryMock::draws.size()==plainStart+faces.meshes.size()*2,"Program without source emission incurred per-face draws.");
        programs[static_cast<size_t>(GeometrySlot::Terrain)]=program;programs[static_cast<size_t>(GeometrySlot::Shadow)]=program;
        const auto faceVao=faces.meshes.at(faceMeshId).vao,faceVbo=faces.meshes.at(faceMeshId).vbo;accept(fresh(bytes));faces.render(0,640,360,false);
        requireCPU(faces.meshes.at(faceMeshId).vao==faceVao&&faces.meshes.at(faceMeshId).vbo==faceVbo,"Per-face frame allocated replacement geometry.");
        const auto cameras=faces.cameraFrames,commits=faces.irisGraph.frames;
        auto badFaces=fresh(bytes);put(badFaces,36,word(badFaces,36)+1);requireCPU(rejects([&]{accept(badFaces);})&&faces.cameraFrames==cameras&&faces.irisGraph.frames==commits&&faces.currentEmission.empty(),"Stale per-face generation accepted camera or retained authorization.");
        if(!remap){
            badFaces=fresh(bytes);put(badFaces,72,uint32_t(21));requireCPU(rejects([&]{accept(badFaces);})&&faces.cameraFrames==cameras,"Incomplete index coverage reached draw.");
            badFaces=fresh(bytes);put(badFaces,52,uint32_t(1));requireCPU(rejects([&]{accept(badFaces);}),"Malformed explicit validity was accepted.");
        }
        accept(fresh(bytes));geometryMock::failProgram=48000;requireCPU(rejects([&]{faces.render(0,640,360,false);})&&faces.irisGraph.frames==commits,"Per-face GL failure committed history.");
        accept(fresh(bytes));faces.render(0,640,360,false);const auto completed=faces.irisGraph.frames;
        accept(fresh(bytes));emissionMock::expire=&faces.geometryFrame;requireCPU(rejects([&]{faces.render(0,640,360,false);})&&faces.irisGraph.frames==completed,"Per-face expiry during draw committed history.");
        accept(fresh(bytes));faces.render(0,640,360,false);
        if(!remap){
            const auto changed=read("outputs/native-renderer-verification/source-emission-block-change.bin"),changedMesh=read("outputs/native-renderer-verification/source-emission-block-change-mesh.bin");
            requireCPU(word(changed,40)==3&&word(changed,36)!=word(bytes,36),"Block edit did not export a new proven mesh job/upload.");
            accept(changedMesh);faces.meshes.at(faceMeshId).texture=0;
            const auto changedCamera=faces.cameraFrames,changedCommits=faces.irisGraph.frames;
            requireCPU(rejects([&]{accept(fresh(bytes));})&&faces.cameraFrames==changedCamera&&faces.irisGraph.frames==changedCommits,"Old block generation authorized replacement geometry.");
            accept(fresh(changed));const auto changedStart=geometryMock::draws.size(),changedRanges=emissionMock::runs.size();faces.render(0,640,360,false);
            requireCPU(geometryMock::draws.size()==changedStart+6,"Changed block did not update actual world/shadow run count.");
            for(size_t pass=0;pass<2;++pass){const auto& d=geometryMock::draws[changedStart+pass*3+1];const auto& range=emissionMock::runs[changedRanges+pass*3+1];
                requireCPU(d.integers.at(261)==1&&d.vectors.at(260)==glm::vec4(0)&&range.count==12&&range.offset==24,"Changed emitting block did not become known zero in actual draws.");}
            accept(geometry);faces.meshes.at(faceMeshId).texture=0;accept(fresh(bytes));faces.render(0,640,360,false);
        }
        auto requiredFaces=program;requiredFaces.uniforms.back().validity=-1;requiredFaces.uniforms.back().validityName.clear();reflection.pop_back();programs[static_cast<size_t>(GeometrySlot::Terrain)]=requiredFaces;programs[static_cast<size_t>(GeometrySlot::Shadow)]=requiredFaces;
        const auto saved=faces.irisGraph.frames;accept(fresh(bytes));requireCPU(rejects([&]{faces.render(0,640,360,false);})&&faces.irisGraph.frames==saved,"Unknown per-face required data committed history.");
        reflection.push_back({"sourceOwnEmissionKnown",261,GL_BOOL});programs[static_cast<size_t>(GeometrySlot::Terrain)]=program;programs[static_cast<size_t>(GeometrySlot::Shadow)]=program;
        accept(fresh(bytes));accept(geometry);for(auto& [faceId,m]:faces.meshes)m.texture=0;faces.render(0,640,360,false);
        requireCPU(std::all_of(faces.currentEmission.begin(),faces.currentEmission.end(),[](const auto& e){return e.runs.empty();}),"Replacing meshes retained per-face allocation.");
        accept(fresh(bytes));Payload remove;remove.words({scene,1,faceMeshId});faces.receive(Remove,1,remove.bytes);
        requireCPU(faces.currentEmission.front().runs.empty(),"Removed mesh retained its per-face allocation.");faces.reset();requireCPU(faces.currentEmission.empty(),"Reset retained per-face storage.");
    }
    {
        auto bytes=read("outputs/native-renderer-verification/source-emission-instances.bin"),geometry=read("outputs/native-renderer-verification/source-emission-instances-mesh.bin");
        const auto scene=word(bytes,16),meshId=word(bytes,32);const size_t sourceAt=56+size_t(word(bytes,52))*20;
        requireCPU(word(bytes,20)==3&&word(bytes,44)==1&&word(bytes,sourceAt+4)==SourceFrame,"Missing actual instance Capture envelope.");
        const auto fresh=[&](auto b){const double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();
            put(b,sourceAt+224,now);put(b,sourceAt+232,0.0);put(b,sourceAt+36,++serial);put(b,sourceAt+60,++frame);return b;};
        auto initialBytes=fresh(bytes);std::vector<uint8_t> data(initialBytes.begin()+16,initialBytes.end());Reader reader{data};reader.u32();auto parsed=SourceEmissionSnapshot::read(reader,scene);
        for(uint32_t i=0;i<3;++i){const auto& identity=parsed.entries.front().runs.at(i);requireCPU(identity.sourceBlock==i+1&&identity.registration&&identity.lifetime,"Native instance block/register/lifetime identity was lost.");}
        Renderer instances;instances.initialize();instances.epoch=scene;instances.originKnown=true;instances.sourceOrigin=parsed.batch.source.geometry.origin;instances.presentationReady=true;
        auto accept=[&](const auto& b){receiveCpuWire(b,[&](auto type,auto seq,const auto& p){instances.receive(type,seq,p);});};accept(geometry);
        auto& m=instances.meshes.at(meshId);m.texture=0;m.irisTerrain=true;
        auto instanced=geometryMock::fixture(48100);instanced.sourceInstanceRanges=true;
        instanced.attributes.push_back({"sourceInstanceExtras",10,GeometryAttribute::InstanceExtras});geometryMock::programs[48100].attributes.push_back({"sourceInstanceExtras",10,GL_FLOAT_VEC2});
        instanced.uniforms.push_back({"sourceOwnEmissionRgb",260,GeometryUniform::SourceOwnEmissionRgb,"sourceOwnEmissionKnown",261});
        auto& uniforms=geometryMock::programs[48100].uniforms;uniforms.push_back({"sourceOwnEmissionRgb",260,GL_FLOAT_VEC3});uniforms.push_back({"sourceOwnEmissionKnown",261,GL_BOOL});
        instances.irisPlan=std::make_unique<IrisPlan>(graphPlan());instances.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();
        auto& programs=instances.irisPlan->programs->slots;programs[static_cast<size_t>(GeometrySlot::Terrain)]=instanced;programs[static_cast<size_t>(GeometrySlot::Shadow)]=instanced;
        instances.environment.sunKnown=true;instances.environment.sun=glm::normalize(glm::vec3(.3f,1.f,.2f));
        accept(fresh(bytes));const auto start=geometryMock::draws.size();instances.render(0,640,360,false);
        requireCPU(geometryMock::draws.size()==start+6,"Instance RGB did not reach both world and shadow draws.");
        requireCPU(emissionMock::instanceCounts.size()==6&&std::all_of(emissionMock::instanceCounts.begin(),emissionMock::instanceCounts.end(),[](auto n){return n==1;}),"Instance identity records did not draw exactly one source slot each.");
        for(size_t pass=0;pass<2;++pass)for(size_t slot=0;slot<3;++slot){const auto& d=geometryMock::draws[start+pass*3+slot];
            const glm::vec4 rgb=slot==0?glm::vec4(3,2,1,0):slot==1?glm::vec4(0):glm::vec4(0,4,0,0);
            requireCPU(d.integers.at(261)==1&&d.vectors.at(260)==rgb,"Instance RGB/known zero changed at draw.");
            for(size_t col=0;col<4;++col)requireCPU(d.attributes[6+col].offset==slot*72+col*16&&d.attributes[6+col].buffer==m.instances&&d.attributes[6+col].divisor==1,"Instance matrix range offset differs.");
            requireCPU(d.attributes[10].offset==slot*72+64,"Instance extras did not follow the matrix range.");}
        const auto cameras=instances.cameraFrames,commits=instances.irisGraph.frames;
        for(const auto& change:std::vector<std::pair<size_t,uint32_t>>{{36,word(bytes,36)+1},{48,word(bytes,48)+1},{44,2},{96,4},{60,1},{64,0},{68,0},{72,0}}){auto invalidInstance=fresh(bytes);put(invalidInstance,change.first,change.second);
            requireCPU(rejects([&]{accept(invalidInstance);})&&instances.cameraFrames==cameras&&instances.irisGraph.frames==commits&&instances.currentEmission.empty(),"Invalid instance association accepted camera/history.");}
        accept(fresh(bytes));auto noRanges=instanced;noRanges.sourceInstanceRanges=false;programs[static_cast<size_t>(GeometrySlot::Terrain)]=noRanges;programs[static_cast<size_t>(GeometrySlot::Shadow)]=noRanges;
        const auto unsplit=geometryMock::draws.size();instances.render(0,640,360,false);requireCPU(geometryMock::draws.size()==unsplit+2&&geometryMock::draws.back().integers.at(261)==0,"Unapproved instance-ID program was split or got emission.");
        programs[static_cast<size_t>(GeometrySlot::Terrain)]=instanced;programs[static_cast<size_t>(GeometrySlot::Shadow)]=instanced;
        accept(fresh(bytes));geometryMock::failProgram=48100;const auto saved=instances.irisGraph.frames;requireCPU(rejects([&]{instances.render(0,640,360,false);})&&instances.irisGraph.frames==saved,"Instance draw failure committed history.");
        accept(fresh(bytes));emissionMock::expire=&instances.geometryFrame;requireCPU(rejects([&]{instances.render(0,640,360,false);})&&instances.irisGraph.frames==saved,"Instance expiry during draw committed history.");
        accept(fresh(bytes));instances.render(0,640,360,false);
        auto unknownInstance=fresh(bytes);put(unknownInstance,80,uint32_t(0));accept(unknownInstance);instances.render(0,640,360,false);
        requireCPU(geometryMock::draws[geometryMock::draws.size()-2].integers.at(261)==0,"Unknown instance slot inherited a known emission.");
        auto requiredInstance=instanced;requiredInstance.uniforms.back().validity=-1;requiredInstance.uniforms.back().validityName.clear();uniforms.pop_back();
        programs[static_cast<size_t>(GeometrySlot::Terrain)]=requiredInstance;programs[static_cast<size_t>(GeometrySlot::Shadow)]=requiredInstance;
        const auto requiredCommits=instances.irisGraph.frames;unknownInstance=fresh(unknownInstance);accept(unknownInstance);
        requireCPU(rejects([&]{instances.render(0,640,360,false);})&&instances.irisGraph.frames==requiredCommits,"Unknown required instance emission committed history.");
        uniforms.push_back({"sourceOwnEmissionKnown",261,GL_BOOL});programs[static_cast<size_t>(GeometrySlot::Terrain)]=instanced;programs[static_cast<size_t>(GeometrySlot::Shadow)]=instanced;
        accept(fresh(bytes));instances.render(0,640,360,false);
        // Replaying a type-9 upload must revoke frame authorization even if all
        // matrix bytes are identical; its sequence is an independent generation.
        const size_t next=16+word(geometry,8);std::vector<uint8_t> upload(geometry.begin()+next,geometry.end());put(upload,12,word(bytes,48)+100);
        accept(upload);requireCPU(instances.currentEmission.front().runs.empty(),"Instance upload retained old RGB runs.");
        requireCPU(rejects([&]{accept(fresh(bytes));}),"Old instance sequence authorized a newer upload.");
        accept(geometry);m.texture=0;m.irisTerrain=true;accept(fresh(bytes));instances.render(0,640,360,false);
        instances.geometryFrame.expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);instances.render(0,640,360,false);requireCPU(geometryMock::draws.back().integers.at(261)==0,"Expired instance RGB stayed known.");
        instances.reset();requireCPU(instances.currentEmission.empty(),"Reset retained instance authorization.");
    }
    nativegl::glUniform3fv=emissionMock::old3;
    nativegl::glDrawElements=emissionMock::oldDraw;
    nativegl::glDrawElementsInstanced=emissionMock::oldInstanced;
}
