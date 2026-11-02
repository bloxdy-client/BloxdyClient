#pragma once
// Capture bytes -> fragmented native pipe -> renderer -> actual draw callbacks.
// GL calls are inert CPU mocks; no window, game, Java or graphics context runs.
namespace blockMock {
PFNGLDRAWELEMENTSPROC oldDraw;PFNGLDRAWELEMENTSINSTANCEDPROC oldInstanced;
bridge::IrisGeometryFrame* expire=nullptr;
}
void testSourceBlockIdentity(){
    using namespace bridge;using U=GeometryUniform;
    const auto word=[](const auto& b,size_t at){uint32_t v;std::memcpy(&v,b.data()+at,4);return v;};
    const auto put=[](auto& b,size_t at,auto v){std::memcpy(b.data()+at,&v,sizeof(v));};
    const auto read=[](const std::string& file){std::ifstream in("outputs/native-renderer-verification/"+file,std::ios::binary);requireCPU(in.good(),"Missing source block Capture fixture.");return std::vector<uint8_t>((std::istreambuf_iterator<char>(in)),{});};
    const auto rejects=[](auto fn){try{fn();}catch(const std::exception&){return true;}return false;};
    uint32_t serial=20000,frame=20000;
    const auto sourceAt=[&](const auto& b){size_t at=32;const auto version=word(b,20);
        for(uint32_t i=0;i<word(b,28);++i){const auto kind=version>=3?word(b,at+12):0,n=version>=3?word(b,at+20):word(b,at+12);
            at+=version==1?16:(version>=3?24:16)+size_t(n)*(kind?20:version==4?12:8);}
        if(word(b,at+4)==SourceLight)at+=104;if(word(b,at+4)==GpuParticles)at+=32;requireCPU(word(b,at+4)==SourceFrame,"Block fixture lacks source frame.");return at;};
    const auto fresh=[&](auto b){const auto at=sourceAt(b);const double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();
        put(b,at+224,now);put(b,at+232,0.0);put(b,at+36,++serial);put(b,at+60,++frame);return b;};
    blockMock::oldDraw=nativegl::glDrawElements;blockMock::oldInstanced=nativegl::glDrawElementsInstanced;
    nativegl::glDrawElements=[](GLenum mode,GLsizei count,GLenum type,const void* offset){blockMock::oldDraw(mode,count,type,offset);
        if(blockMock::expire){blockMock::expire->expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);blockMock::expire=nullptr;}};
    nativegl::glDrawElementsInstanced=[](GLenum mode,GLsizei count,GLenum type,const void* offset,GLsizei n){blockMock::oldInstanced(mode,count,type,offset,n);
        if(blockMock::expire){blockMock::expire->expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);blockMock::expire=nullptr;}};
    struct Case {const char* name;std::vector<std::pair<int,int>> expected;};
    for(const auto& c:std::vector<Case>{{"source-block-faces",{{3,1},{1,1},{2,1},{0,0}}},
        {"source-block-equal-rgb",{{3,1},{1,1},{2,1},{0,0}}},{"source-block-unknown-rgb",{{1,1}}},
        {"source-block-zero",{{0,1}}},{"source-block-remap",{{1,1},{2,1},{3,1},{0,0}}},
        {"source-block-instances",{{1,1},{2,1},{3,1}}},
        {"source-block-hybrid",{{3,1},{1,1},{2,1},{0,0},{1,1},{2,1},{3,1}}},
        {"source-block-gpu",{{3,1},{1,1},{2,1},{0,0}}},
        {"source-emission",{{0,0}}},{"source-emission-faces",{{0,0}}},
        {"source-emission-instances",{{1,1},{2,1},{3,1}}}}){
        const auto bytes=read(std::string(c.name)+".bin"),geometry=read(std::string(c.name)+"-mesh.bin");const auto scene=word(bytes,16);
        auto transaction=fresh(bytes);std::vector<uint8_t> data(transaction.begin()+16,transaction.end());Reader reader{data};reader.u32();auto parsed=SourceEmissionSnapshot::read(reader,scene);
        Renderer r;r.initialize();r.epoch=scene;r.originKnown=true;r.sourceOrigin=parsed.batch.source.geometry.origin;r.presentationReady=true;
        const auto accept=[&](const auto& b){receiveCpuWire(b,[&](auto type,auto sequence,const auto& p){r.receive(type,sequence,p);});};
        accept(geometry);for(auto& [id,m]:r.meshes){m.texture=0;m.irisTerrain=true;}
        if(parsed.hasGpu)for(const auto& d:parsed.batch.draws)for(auto texture:{d.texture,d.ramp}){Payload p;p.words({scene,texture,1,1,1,0,1,6});p.bytes.insert(p.bytes.end(),{255,255,255,255});r.receive(Texture,1,p.bytes);}
        auto program=geometryMock::fixture(48200);program.sourceInstanceRanges=true;
        // Deliberately no RGB consumer: block identity alone must split ranges.
        program.uniforms.push_back({"sourceBlockId",266,U::SourceBlockId,"sourceBlockKnown",267});
        auto& reflected=geometryMock::programs[48200].uniforms;reflected.push_back({"sourceBlockId",266,GL_INT});reflected.push_back({"sourceBlockKnown",267,GL_BOOL});
        for(const auto& u:std::vector<GeometryUniformBinding>{{"semanticIds",268,U::SemanticIds,"semanticsKnown",269},{"weather",270,U::Weather,"weatherKnown",271},
            {"ownEmission",272,U::OwnEmission,"emissionKnown",273},{"referenceLightmap",274,U::ReferenceLightmap,"lightmapKnown",275}}){
            program.uniforms.push_back(u);reflected.push_back({u.name,u.location,geometryUniformType(u.value)});reflected.push_back({u.validityName,u.validity,GL_BOOL});}
        r.irisPlan=std::make_unique<IrisPlan>(graphPlan());r.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();
        if(parsed.hasGpu)r.irisPlan->sourceGpuParticleColor=0;
        auto& slots=r.irisPlan->programs->slots;const auto install=[&](const auto& p){slots[static_cast<size_t>(GeometrySlot::Terrain)]=p;slots[static_cast<size_t>(GeometrySlot::Shadow)]=p;};install(program);
        r.environment.sunKnown=true;r.environment.sun=glm::normalize(glm::vec3(.3f,1.f,.2f));
        const auto draw=[&](){r.render(0,640,360,false);};
        const auto start=geometryMock::draws.size();accept(transaction);draw();
        requireCPU(geometryMock::draws.size()==start+2*c.expected.size(),"Block-only binding did not preserve actual world/shadow ranges.");
        for(size_t pass=0;pass<2;++pass){std::vector<std::pair<int,int>> actual;for(size_t i=0;i<c.expected.size();++i){const auto& d=geometryMock::draws[start+pass*c.expected.size()+i];actual.emplace_back(d.integers.at(266),d.integers.at(267));
                for(auto location:{112,269,271,273,275})requireCPU(d.integers.at(location)==0,"Raw source identity fabricated reference world/material semantics.");}
            auto expected=c.expected;if(std::string(c.name)=="source-block-hybrid"){std::sort(actual.begin(),actual.end());std::sort(expected.begin(),expected.end());}
            requireCPU(actual==expected,"Raw block ID/validity changed at a real draw.");}
        const bool legacy=word(bytes,20)<3;
        if(!legacy){
            const auto commits=r.irisGraph.frames,cameras=r.cameraFrames;auto malformed=fresh(bytes);put(malformed,36,word(bytes,36)+1);
            requireCPU(rejects([&]{accept(malformed);})&&r.cameraFrames==cameras&&r.irisGraph.frames==commits&&r.currentEmission.empty(),"Stale block geometry authorized a partial source frame.");
            if(parsed.hasGpu)requireCPU(rejects(draw)&&!r.gpuParticles.valid,"Rejected combined block transaction retained GPU readiness.");
            else {draw();requireCPU(geometryMock::draws.back().integers.at(266)==0&&geometryMock::draws.back().integers.at(267)==0,"Rejected block transaction retained old ID/validity.");}
            accept(fresh(bytes));geometryMock::failProgram=48200;const auto saved=r.irisGraph.frames;
            requireCPU(rejects(draw)&&r.irisGraph.frames==saved,"Failed block-only draw committed history.");
            accept(fresh(bytes));blockMock::expire=&r.geometryFrame;requireCPU(rejects(draw)&&r.irisGraph.frames==saved,"Block-only frame expired during drawing but committed.");
            accept(fresh(bytes));draw();const auto retained=r.meshes.begin()->second.vbo;accept(fresh(bytes));draw();requireCPU(r.meshes.begin()->second.vbo==retained,"Block snapshot replaced stable geometry storage.");
            auto required=program;required.uniforms[10].validity=-1;required.uniforms[10].validityName.clear();
            auto savedReflection=reflected;reflected.erase(std::remove_if(reflected.begin(),reflected.end(),[](const auto& u){return u.location==267;}),reflected.end());install(required);
            // Any unknown range, including one late in the draw, blocks commit.
            if(std::any_of(c.expected.begin(),c.expected.end(),[](auto p){return !p.second;})){accept(fresh(bytes));const auto committed=r.irisGraph.frames;requireCPU(rejects(draw)&&r.irisGraph.frames==committed,"Unknown required block ID committed history.");}
            reflected=savedReflection;install(program);accept(fresh(bytes));draw();
            r.geometryFrame.expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);
            if(parsed.hasGpu)requireCPU(rejects(draw),"Expired combined GPU/block frame rendered.");else {draw();requireCPU(geometryMock::draws.back().integers.at(267)==0,"Expired block-only frame retained identity.");}
            accept(fresh(bytes));if(parsed.hasGpu)requireCPU(rejects([&]{r.render(0,800,450,false);}),"Resized combined GPU/block frame rendered.");
            else {r.render(0,800,450,false);requireCPU(geometryMock::draws.back().integers.at(267)==0,"Resized block-only frame retained identity.");}
            accept(fresh(bytes));draw();auto alias=program;alias.uniforms[10].name="mc_Entity";install(alias);requireCPU(rejects(draw),"Source block identity impersonated a reference semantic input.");install(program);
            if(parsed.entries.front().kind){auto noRanges=program;noRanges.sourceInstanceRanges=false;install(noRanges);accept(fresh(bytes));const auto before=geometryMock::draws.size();draw();
                requireCPU(geometryMock::draws.size()==before+2&&geometryMock::draws.back().integers.at(267)==0,"Unapproved instance range program received block identity.");install(program);}
            accept(fresh(bytes));draw();accept(geometry);for(auto& [id,m]:r.meshes){m.texture=0;m.irisTerrain=true;}draw();requireCPU(geometryMock::draws.back().integers.at(267)==0,"New mesh upload inherited block identity.");
            if(std::string(c.name)=="source-block-equal-rgb"){
                auto rgbOnly=program;rgbOnly.uniforms.erase(rgbOnly.uniforms.begin()+10);rgbOnly.uniforms.push_back({"sourceOwnEmissionRgb",276,U::SourceOwnEmissionRgb,"sourceOwnKnown",277});
                auto reflectedBlock=reflected;reflected.erase(std::remove_if(reflected.begin(),reflected.end(),[](const auto& u){return u.location==266||u.location==267;}),reflected.end());
                reflected.push_back({"sourceOwnEmissionRgb",276,GL_FLOAT_VEC3});reflected.push_back({"sourceOwnKnown",277,GL_BOOL});install(rgbOnly);accept(fresh(bytes));const auto before=geometryMock::draws.size();draw();
                requireCPU(geometryMock::draws.size()==before+2,"Equal RGB gained extra draws from unused distinct source IDs.");reflected=reflectedBlock;install(program);
            }
            accept(fresh(bytes));draw();Payload rebase;rebase.words({scene});rebase.floats({1,0,0});r.receive(Rebase,1,rebase.bytes);
            if(parsed.hasGpu)requireCPU(rejects(draw),"Rebase retained a stale combined GPU/block frame.");else {draw();requireCPU(geometryMock::draws.back().integers.at(267)==0,"Rebase retained stale block identity.");}
        }
        // V4 decoder must reject malformed identity words, even with valid RGB.
        if(word(bytes,20)==4&&!parsed.entries.front().kind)for(uint32_t invalid:{1u,65535u,131072u,0xffffffffu}){auto b=fresh(bytes);put(b,64,invalid);
            const auto previous=r.cameraFrames;requireCPU(rejects([&]{accept(b);})&&r.cameraFrames==previous&&r.currentEmission.empty(),"Malformed v4 block ID accepted a camera transaction.");}
        r.reset();requireCPU(r.currentEmission.empty(),"Reset retained block identity proofs.");
    }
    nativegl::glDrawElements=blockMock::oldDraw;nativegl::glDrawElementsInstanced=blockMock::oldInstanced;
}
