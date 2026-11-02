#pragma once
namespace materialMock {bridge::IrisGeometryFrame* expire=nullptr;PFNGLDRAWELEMENTSPROC draw;PFNGLDRAWELEMENTSINSTANCEDPROC instanced;}
void testSourceMaterialDefinitions(){
    using namespace bridge;using U=GeometryUniform;
    const auto word=[](const auto& b,size_t at){uint32_t v;std::memcpy(&v,b.data()+at,4);return v;};
    const auto put=[](auto& b,size_t at,auto v){std::memcpy(b.data()+at,&v,sizeof(v));};
    const auto read=[](const std::string& name){std::ifstream in("outputs/native-renderer-verification/"+name,std::ios::binary);requireCPU(in.good(),"Missing material Capture fixture.");return std::vector<uint8_t>((std::istreambuf_iterator<char>(in)),{});};
    const auto rejects=[](auto fn){try{fn();}catch(const std::exception&){return true;}return false;};
    uint32_t serial=40000,frame=40000;
    materialMock::draw=nativegl::glDrawElements;materialMock::instanced=nativegl::glDrawElementsInstanced;
    nativegl::glDrawElements=[](GLenum m,GLsizei n,GLenum t,const void* p){materialMock::draw(m,n,t,p);if(materialMock::expire){materialMock::expire->expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);materialMock::expire=nullptr;}};
    nativegl::glDrawElementsInstanced=[](GLenum m,GLsizei n,GLenum t,const void* p,GLsizei c){materialMock::instanced(m,n,t,p,c);if(materialMock::expire){materialMock::expire->expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);materialMock::expire=nullptr;}};
    for(const int scenario:{0,1,2}){
        const bool instanced=scenario!=0,slabs=scenario==2;
        const std::string name=slabs?"minecraft-material-slabs":instanced?"source-material-instances":"source-material-faces";
        const auto wire=read(name+".bin"),meshWire=read(name+"-mesh.bin");size_t entriesAt=36;
        requireCPU(word(wire,20)==5,"Material fixture did not use v5.");
        for(uint32_t i=0;i<word(wire,32);++i){const auto length=word(wire,entriesAt+28)+word(wire,entriesAt+32)+word(wire,entriesAt+36);entriesAt+=40+((length+3)&~3u);}
        size_t sourceAt=entriesAt;for(uint32_t i=0;i<word(wire,28);++i){const auto kind=word(wire,sourceAt+12),n=word(wire,sourceAt+20);sourceAt+=24+size_t(n)*(kind?24:16);}
        if(word(wire,sourceAt+4)==SourceLight)sourceAt+=104;requireCPU(word(wire,sourceAt+4)==SourceFrame,"Material nesting changed.");
        const auto fresh=[&](auto b){const double utc=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();put(b,sourceAt+224,utc);put(b,sourceAt+232,0.0);put(b,sourceAt+36,++serial);put(b,sourceAt+60,++frame);return b;};
        auto first=fresh(wire);std::vector<uint8_t> payload(first.begin()+16,first.end());Reader reader{payload};const auto scene=reader.u32();auto parsed=SourceEmissionSnapshot::read(reader,scene);
        requireCPU(parsed.definitions.size()==3,"Material dictionary lost names.");
        for(const auto& [token,m]:parsed.definitions){requireCPU(m.token==token&&m.name.size()&&m.rootName.size(),"Material identity/name mismatch.");
            if(slabs){requireCPU(m.minecraft.known()==(m.id!=3),"Side slab acquired a Minecraft identity.");if(m.id!=3)requireCPU(m.minecraft.name=="minecraft:stone_slab"&&m.minecraft.property("type")==std::optional<std::string_view>(m.id==1?"bottom":"top")&&m.minecraft.complete&&m.minecraft.property("waterlogged")==std::optional<std::string_view>("false"),"Slab reference type or proven dry state changed.");}
            else {requireCPU(m.minecraft.known()==(m.id!=2),"Unsupported Stone variant acquired a Minecraft identity.");if(m.id!=2)requireCPU(m.minecraft.complete&&m.minecraft.name==(m.id==1?"minecraft:stone":"minecraft:glass"),"Canonical cube identity was not retained.");}
            if(m.id==2&&!slabs)requireCPU(m.name=="Stone|meta|rot2|top"&&m.rootName=="Stone"&&m.state=="rot2|top"&&m.rootId==1&&m.flags==3&&m.rotation==2&&m.open==1&&m.half==2,"Actual source state/family changed during decoding.");}
        Renderer r;r.initialize();r.epoch=scene;r.originKnown=true;r.sourceOrigin=parsed.batch.source.geometry.origin;r.presentationReady=true;
        const auto accept=[&](const auto& bytes){receiveCpuWire(bytes,[&](auto type,auto seq,const auto& data){r.receive(type,seq,data);});};accept(meshWire);for(auto& [id,m]:r.meshes){m.texture=0;m.irisTerrain=true;}
        auto p=geometryMock::fixture(48300);p.sourceInstanceRanges=true;
        const std::vector<GeometryUniformBinding> bindings={{"sourceBlockRootId",280,U::SourceBlockRootId,"sourceRootKnown",281},{"sourceBlockProperties",282,U::SourceBlockProperties,"sourcePropertiesKnown",283},{"sourceBlockState",284,U::SourceBlockState,"sourceStateKnown",285},{"semanticIds",286,U::SemanticIds,"semanticKnown",287}};
        for(const auto& u:bindings){p.uniforms.push_back(u);geometryMock::programs[48300].uniforms.push_back({u.name,u.location,geometryUniformType(u.value)});geometryMock::programs[48300].uniforms.push_back({u.validityName,u.validity,GL_BOOL});}
        auto old3=nativegl::glUniform3fv;nativegl::glUniform3fv=[](GLint l,GLsizei n,const GLfloat* v){geometryMock::vectors[mock::currentProgram][l]=glm::vec4(glm::make_vec3(v),0);};
        r.irisPlan=std::make_unique<IrisPlan>(graphPlan());r.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();auto& slots=r.irisPlan->programs->slots;
        const auto install=[&](const auto& program){slots[static_cast<size_t>(GeometrySlot::Terrain)]=program;slots[static_cast<size_t>(GeometrySlot::Shadow)]=program;};install(p);
        r.environment.sunKnown=true;r.environment.sun=glm::normalize(glm::vec3(.3f,1.f,.2f));const auto draw=[&](){r.render(0,640,360,false);};
        const auto start=geometryMock::draws.size();accept(first);draw();const size_t runs=instanced?3:4;requireCPU(geometryMock::draws.size()==start+runs*2,"Material-only consumers did not split world/shadow runs.");
        for(size_t pass=0;pass<2;++pass)for(size_t i=0;i<runs;++i){const auto& d=geometryMock::draws[start+pass*runs+i];const bool variant=instanced?i==1:i==2,unknown=!instanced&&i==3,glass=instanced?i==2:i==0;
            requireCPU(d.integers.at(281)==!unknown&&d.integers.at(283)==!unknown&&d.integers.at(285)==!unknown&&d.integers.at(287)==0&&d.integers.at(112)==0,"Source properties fabricated reference semantics or validity.");
            if(slabs)requireCPU(d.integers.at(280)==1&&d.integers.at(282)==9&&d.vectors.at(284)==glm::vec4(1,0,i+1,0),"Slab metadata changed in world/shadow binds.");
            else requireCPU(d.integers.at(280)==(unknown?0:glass?3:1)&&d.integers.at(282)==(unknown?0:glass?1:3)&&d.vectors.at(284)==(variant?glm::vec4(2,1,2,0):glm::vec4(0)),"Material state changed in real world/shadow binds.");}
        if(!instanced){auto flagsOnly=p;flagsOnly.uniforms.erase(std::remove_if(flagsOnly.uniforms.begin(),flagsOnly.uniforms.end(),[](const auto& u){return u.value==U::SourceBlockRootId||u.value==U::SourceBlockState;}),flagsOnly.uniforms.end());
            auto& reflect=geometryMock::programs[48300].uniforms;const auto saved=reflect;reflect.erase(std::remove_if(reflect.begin(),reflect.end(),[](const auto& u){return u.location==280||u.location==281||u.location==284||u.location==285;}),reflect.end());
            install(flagsOnly);accept(fresh(wire));const auto before=geometryMock::draws.size();draw();requireCPU(geometryMock::draws.size()==before+6,"Unused material state/identity boundaries added draws to a properties-only program.");reflect=saved;install(p);}
        const auto commits=r.irisGraph.frames,cameras=r.cameraFrames;
        for(const auto& [offset,value]:std::vector<std::pair<size_t,uint32_t>>{{32,257},{36,0},{40,65536},{48,16},{52,5},{56,3},{60,4},{64,129},{entriesAt+24+(instanced?20:12),0xffffffffu}}){auto bad=fresh(wire);put(bad,offset,value);
            requireCPU(rejects([&]{accept(bad);})&&r.cameraFrames==cameras&&r.irisGraph.frames==commits&&r.currentDefinitions.empty(),"Malformed source definition partially accepted a frame.");}
        draw();requireCPU(geometryMock::draws.back().integers.at(283)==0&&geometryMock::draws.back().vectors.at(284)==glm::vec4(0),"Rejected material transaction retained stale properties.");
        const auto beforeFailure=r.irisGraph.frames;accept(fresh(wire));geometryMock::failProgram=48300;requireCPU(rejects(draw)&&r.irisGraph.frames==beforeFailure,"Material draw failure committed history.");accept(fresh(wire));draw();
        const auto beforeExpiry=r.irisGraph.frames;accept(fresh(wire));materialMock::expire=&r.geometryFrame;requireCPU(rejects(draw)&&r.irisGraph.frames==beforeExpiry,"Source material expired during drawing but committed history.");accept(fresh(wire));draw();
        r.geometryFrame.expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);draw();requireCPU(geometryMock::draws.back().integers.at(283)==0,"Expired source material remained valid.");
        accept(fresh(wire));r.render(0,800,450,false);requireCPU(geometryMock::draws.back().integers.at(283)==0,"Resized source material remained valid.");accept(fresh(wire));draw();
        if(!instanced){auto required=p;required.uniforms[11].validity=-1;required.uniforms[11].validityName.clear();auto& reflection=geometryMock::programs[48300].uniforms;const auto saved=reflection;
            reflection.erase(std::remove_if(reflection.begin(),reflection.end(),[](const auto& u){return u.location==283;}),reflection.end());install(required);const auto previous=r.irisGraph.frames;accept(fresh(wire));requireCPU(rejects(draw)&&r.irisGraph.frames==previous,"Unknown required source properties committed history.");reflection=saved;install(p);}
        accept(fresh(wire));draw();accept(meshWire);for(auto& [id,m]:r.meshes){m.texture=0;m.irisTerrain=true;}draw();requireCPU(geometryMock::draws.back().integers.at(283)==0,"New upload inherited material authorization.");
        r.reset();requireCPU(r.currentDefinitions.empty(),"Scene reset retained material names.");nativegl::glUniform3fv=old3;
    }
    {
        const auto bytes=read("source-material-gpu.bin");std::vector<uint8_t> payload(bytes.begin()+16,bytes.end());Reader r{payload};const auto epoch=r.u32();auto combined=SourceEmissionSnapshot::read(r,epoch);
        requireCPU(combined.hasGpu&&combined.batch.draws.size()==2&&combined.definitions.size()==3&&!combined.entries.empty(),"V5 dictionary altered the complete nested source light/GPU frame.");
    }
    nativegl::glDrawElements=materialMock::draw;nativegl::glDrawElementsInstanced=materialMock::instanced;
}
