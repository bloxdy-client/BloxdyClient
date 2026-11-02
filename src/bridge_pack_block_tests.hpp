#pragma once
namespace packMock {
bridge::Renderer* expire=nullptr;bridge::Renderer* replace=nullptr;
PFNGLDRAWELEMENTSPROC draw;PFNGLDRAWELEMENTSINSTANCEDPROC instanced;
void after(){if(expire){expire->geometryFrame.expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);expire=nullptr;}if(replace){replace->irisPlan->blockIds.reset();replace=nullptr;}}
}
void testPackBlockIds(){
    using namespace bridge;using Map=shaderloader::BlockIdMap;
    const auto rejects=[](auto fn){try{fn();}catch(const std::exception&){return true;}return false;};
    const MinecraftBlockState stone{"minecraft:stone",{},true},glass{"minecraft:glass",{},true},bottom{"minecraft:stone_slab","bottom",false},top{"minecraft:stone_slab","top",false};
    const auto known=[](const auto& map,const auto& state,int id){requireCPU(map->resolve(state)==PackBlockId{id,true},"Pack material ID/known state mismatch.");};
    known(Map::parsePreprocessed(""),stone,-1);known(Map::parsePreprocessed("block.0=stone"),stone,0);known(Map::parsePreprocessed("block.-1=stone"),stone,-1);
    known(Map::parsePreprocessed("block.16777217=stone"),stone,16777217);known(Map::parsePreprocessed("block.2147483646=stone"),stone,2147483646);
    auto lines=Map::parsePreprocessed(" # comment\r\n!comment\nblock.17: minecraft:stone \\\n\tglass\nblock.18=stone\n");known(lines,stone,17);known(lines,glass,17);
    known(Map::parsePreprocessed("block.1=stone\nblock.2=glass\nblock.1=glass\n"),glass,1);
    auto aliases=Map::parsePreprocessed("block.01=stone\nblock.2=glass\nblock.+1=glass\n");known(aliases,stone,-1);known(aliases,glass,1);
    known(Map::parsePreprocessed("block.\\u0037=sto\\u006ee\n"),stone,7);
    known(Map::parsePreprocessed("block.4=stone:unknown=true"),stone,4); // pinned Iris ignores absent properties
    auto variants=Map::parsePreprocessed("block.9=stone_slab:type=top\nblock.10=minecraft:stone_slab:type=bottom\n");known(variants,bottom,10);known(variants,top,9);
    auto ambiguous=Map::parsePreprocessed("block.3=stone_slab:waterlogged=true\nblock.4=stone_slab\n");requireCPU(!ambiguous->resolve(bottom).known,"Earlier possible water predicate was skipped.");
    known(Map::parsePreprocessed("block.3=stone_slab:waterlogged=true stone_slab:waterlogged=false"),bottom,3);
    known(Map::parsePreprocessed("block.4=stone_slab\nblock.3=stone_slab:waterlogged=true"),bottom,4);
    known(Map::parsePreprocessed("block.4=stone_slab:waterlogged=invalid"),bottom,-1);
    const MinecraftBlockState dry{"minecraft:stone_slab","bottom",true,false},wet{"minecraft:stone_slab","bottom",true,true};known(ambiguous,dry,4);known(ambiguous,wet,3);
    SourceBlockMaterial stair;stair.token=1;stair.id=2;stair.rootId=1;stair.flags=9;stair.rotation=1;stair.half=2;stair.rootName="Stone Stairs";stair.state="meta|rot1|top|innerLeft";stair.name=stair.rootName+"|"+stair.state;
    const auto stairState=mapMinecraftBlock(stair);known(Map::parsePreprocessed("block.11=stone_stairs:facing=north:half=top:shape=inner_right:waterlogged=false\nblock.12=stone_stairs"),stairState,11);
    known(Map::parsePreprocessed("block.11=stone_stairs:shape=inner_left\nblock.12=stone_stairs:powered=true"),stairState,12); // power is absent on stairs
    SourceBlockMaterial door;door.token=2;door.id=door.rootId=10;door.flags=9;door.rotation=1;door.open=1;door.rootName=door.name="Jungle Door";door.state="meta|rot1|closed";
    const auto doorState=mapMinecraftBlock(door);known(Map::parsePreprocessed("block.21=jungle_door:facing=north:half=lower:hinge=right:open=false"),doorState,21);
    const auto power=Map::parsePreprocessed("block.22=jungle_door:powered=true\nblock.23=jungle_door:powered=false");requireCPU(!power->resolve(doorState).known,"Unknown door power was ignored or inferred from closed state.");
    known(Map::parsePreprocessed("block.22=jungle_door:powered=true jungle_door:powered=false"),doorState,22);
    known(Map::parsePreprocessed("block.0=jungle_door\nblock.22=jungle_door:powered=true"),doorState,0);
    known(Map::parsePreprocessed("block.22=jungle_door:powered=invalid"),doorState,-1);
    auto powered=doorState;powered.powered=true;powered.complete=true;known(power,powered,22);powered.powered=false;known(power,powered,23);
    for(const auto& rule:minecraftBlockRules){
        if(rule.kind!=MinecraftBlockKind::log&&rule.kind!=MinecraftBlockKind::grass)continue;
        SourceBlockMaterial m;m.token=12;m.id=m.rootId=50;m.flags=3;m.name=m.rootName=rule.source;auto state=mapMinecraftBlock(m);
        const std::string name(rule.name);known(Map::parsePreprocessed("block.0="+name),state,0);known(Map::parsePreprocessed(""),state,-1);
        const bool log=rule.kind==MinecraftBlockKind::log;const auto split=Map::parsePreprocessed(log?"block.10="+name+":axis=x\nblock.11="+name+":axis=y\nblock.12="+name+":axis=z":"block.10="+name+":snowy=false\nblock.11="+name+":snowy=true");
        requireCPU(!split->resolve(state).known,"Unknown axis/snowy took a reference default or skipped a possible first match.");
        if(log){
            requireCPU(!Map::parsePreprocessed("block.10="+name+":axis=x "+name+":axis=y\nblock.11="+name+":axis=z")->resolve(state).known,"Third log axis was omitted from material consensus.");
            requireCPU(!Map::parsePreprocessed("block.10="+name+":axis=x "+name+":axis=z\nblock.11="+name+":axis=y")->resolve(state).known,"Middle log axis was omitted from material consensus.");
        }
        requireCPU(!Map::parsePreprocessed("block.0="+name+(log?":axis=z":":snowy=true"))->resolve(state).known,"Assigned zero and unassigned completion were conflated.");
        known(Map::parsePreprocessed(log?"block.14="+name+":axis=x "+name+":axis=y "+name+":axis=z":"block.14="+name+":snowy=false "+name+":snowy=true"),state,14);
        known(Map::parsePreprocessed("block.15="+name+"\nblock.16="+name+(log?":axis=y":":snowy=true")),state,15);
        known(Map::parsePreprocessed("block.17="+name+(log?":axis=invalid":":snowy=invalid")),state,-1);
        known(Map::parsePreprocessed("block.18="+name+(log?":snowy=true":":axis=y")),state,18); // nonexistent property is ignored by the pinned Iris contract
        if(log){for(const auto axis:{"x","y","z"}){auto complete=state;complete.axis=axis;complete.complete=true;known(split,complete,axis==std::string_view("x")?10:axis==std::string_view("y")?11:12);}}
        else for(const bool snowy:{false,true}){auto complete=state;complete.snowy=snowy;complete.complete=true;known(split,complete,snowy?11:10);}
        for(int change=0;change<8;++change){auto bad=state;switch(change){case 0:bad.complete=true;break;case 1:bad.axis="up";break;case 2:bad.waterlogged=false;break;case 3:bad.powered=false;break;case 4:bad.type="bottom";break;case 5:bad.facing="north";break;case 6:if(log)bad.snowy=false;else bad.axis="y";break;case 7:if(log)bad.axis="y";else bad.snowy=false;break;}requireCPU(!split->resolve(bad).known,"Malformed wood/grass state acquired a pack ID.");}
    }
    for(int i=0;i<2;++i){auto bad=stone;if(i)bad.axis="y";else bad.snowy=false;requireCPU(!lines->resolve(bad).known,"A cube gained a foreign reference property.");}
    for(const auto name:{"minecraft:water","minecraft:lava"}){
        MinecraftBlockState fluid;fluid.name=name;const std::string key(name);
        known(Map::parsePreprocessed(""),fluid,-1);known(Map::parsePreprocessed("block.0="+key),fluid,0);
        known(Map::parsePreprocessed("block.-1="+key+":level=15"),fluid,-1);
        known(Map::parsePreprocessed("block.17="+key+":falling=true:axis=y:snowy=true:waterlogged=true"),fluid,17);
        for(const auto invalid:{"16","-1","00","01","-0","1.0","invalid","9999999999999999999999999"})known(Map::parsePreprocessed("block.1="+key+":level="+invalid),fluid,-1);
        std::string all="block.21=";for(uint32_t n=0;n<16;++n)all+=key+":level="+std::string(MinecraftBlockState::fluidLevel(n))+" ";known(Map::parsePreprocessed(all),fluid,21);
        for(uint32_t special=0;special<16;++special){
            const auto text=key+":level="+std::string(MinecraftBlockState::fluidLevel(special));
            const auto split=Map::parsePreprocessed("block.0="+text+"\nblock.22="+key);
            requireCPU(!split->resolve(fluid).known,"Fluid consensus omitted a level or borrowed level zero.");
            requireCPU(!Map::parsePreprocessed("block.0="+text)->resolve(fluid).known,"Fluid assigned zero was confused with unassigned reference levels.");
            known(Map::parsePreprocessed("block.22="+key+"\nblock.0="+text),fluid,22);
            for(uint32_t level=0;level<16;++level){auto complete=fluid;complete.level=level;complete.complete=true;known(split,complete,level==special?0:22);requireCPU(complete.property("level")==MinecraftBlockState::fluidLevel(level),"Fluid level property string is wrong.");}
        }
        // Compare the single-pass resolver with the full concrete state set for
        // ordered overlapping, duplicate-ID and invalid selectors.
        for(uint32_t seed=0;seed<64;++seed){
            std::string text;for(uint32_t i=0;i<16;++i){text+="block."+std::to_string(int((seed+i*3)%7)-1)+"="+key+":level="+std::to_string((seed*7+i*5)%19)+"\n";}
            if(seed%3==0)text+="block.40="+key+"\n";if(seed%5==0)text="block.41="+key+"\n"+text;
            const auto map=Map::parsePreprocessed(text);PackBlockId expected;bool same=true;
            for(uint32_t level=0;level<16;++level){auto complete=fluid;complete.level=level;complete.complete=true;const auto id=map->resolve(complete);if(!level)expected=id;else same&=expected==id;}
            requireCPU(map->resolve(fluid)==(same?expected:PackBlockId{}),"Single-pass fluid resolution disagrees with the complete reference state set.");
        }
        for(int change=0;change<14;++change){auto bad=fluid;switch(change){case 0:bad.complete=true;break;case 1:bad.level=0;break;case 2:bad.level=16;bad.complete=true;break;case 3:bad.level=~0u;bad.complete=true;break;case 4:bad.type="bottom";break;case 5:bad.waterlogged=false;break;case 6:bad.facing="north";break;case 7:bad.half="top";break;case 8:bad.shape="straight";break;case 9:bad.hinge="right";break;case 10:bad.opened=false;break;case 11:bad.powered=false;break;case 12:bad.axis="y";break;case 13:bad.snowy=false;break;}requireCPU(!lines->resolve(bad).known,"Malformed fluid reference state acquired a pack ID.");}
    }
    for(const auto name:{"minecraft:stone","minecraft:stone_slab","minecraft:stone_stairs","minecraft:jungle_door","minecraft:jungle_log","minecraft:grass_block"}){MinecraftBlockState bad;bad.name=name;bad.level=0;bad.complete=true;requireCPU(!lines->resolve(bad).known,"A nonfluid material accepted a fluid level.");}
    for(int i=0;i<8;++i){auto bad=i<4?stairState:doorState;switch(i){case 0:bad.facing="up";break;case 1:bad.shape="innerLeft";break;case 2:bad.type="bottom";break;case 3:bad.complete=false;break;case 4:bad.complete=true;break;case 5:bad.half="top";break;case 6:bad.opened.reset();break;case 7:bad.waterlogged=false;break;}requireCPU(!power->resolve(bad).known,"Malformed shaped reference state was accepted.");}
    for(const auto state:{MinecraftBlockState{},MinecraftBlockState{"minecraft:unknown",{},true},MinecraftBlockState{"minecraft:stone",{},false},MinecraftBlockState{"minecraft:stone_slab","side",false},MinecraftBlockState{"minecraft:stone_slab","bottom",true}})requireCPU(!lines->resolve(state).known,"Unknown/inconsistent canonical state gained a pack ID.");
    for(const auto text:{"#if FOO\nblock.1=stone\n#endif","# include \"x\"","block.1=%minecraft:logs","layer.solid=glass","block.2147483647=stone","block.-2=stone","block.999999999999=stone","block.+-1=stone","block.no=stone","block.1=stone:type=top,bottom","block.1=stone::x=y","block.1=Stone","block.1=stone:type=","block.1=stone:type=a=b","block.1=stone\\","block.\\uZZZZ=stone"})requireCPU(rejects([&]{Map::parsePreprocessed(text);}),"Unsupported or malformed map was partially accepted.");
    requireCPU(rejects([&]{Map::parsePreprocessed(std::string(256*1024+1,' '));}),"Material text budget was not enforced.");
    std::string huge="block.1=";for(int i=0;i<8193;++i)huge+="stone ";requireCPU(rejects([&]{Map::parsePreprocessed(huge);}),"Material selector budget was not enforced.");
    huge="block.1=";for(int i=0;i<5000;++i)huge+="stone:a=b:c=d ";requireCPU(rejects([&]{Map::parsePreprocessed(huge);}),"Material storage budget was not enforced.");
    // Actual Capture frames through fragmented pipe ingress, not hand-built IDs.
    const auto word=[](const auto& b,size_t at){uint32_t v;std::memcpy(&v,b.data()+at,4);return v;};
    const auto put=[](auto& b,size_t at,auto v){std::memcpy(b.data()+at,&v,sizeof(v));};
    const auto read=[](const std::string& name){std::ifstream f("outputs/native-renderer-verification/"+name,std::ios::binary);requireCPU(f.good(),"Missing pack material Capture fixture.");return std::vector<uint8_t>((std::istreambuf_iterator<char>(f)),{});};
    uint32_t serial=60000,frame=60000;
    packMock::draw=nativegl::glDrawElements;packMock::instanced=nativegl::glDrawElementsInstanced;
    const auto packSources=shaderloader::PackSources::decode(read("pack-source-fixture.bin"));
    nativegl::glDrawElements=[](GLenum m,GLsizei n,GLenum t,const void* p){packMock::draw(m,n,t,p);packMock::after();};
    nativegl::glDrawElementsInstanced=[](GLenum m,GLsizei n,GLenum t,const void* p,GLsizei c){packMock::instanced(m,n,t,p,c);packMock::after();};
    for(const int scenario:{0,1,2,3,4,5,6,7,8,9,10}){
        const bool instances=scenario!=0&&scenario!=10,slabs=scenario==2,stairs=scenario==3,doors=scenario==4,shaped=slabs||stairs||doors,namedRoots=scenario>=5,mappedRoots=shaped||namedRoots,fluids=scenario>=9;
        const auto name=scenario==9?"minecraft-material-fluids":scenario==10?"minecraft-material-fluid-terrain":scenario==5?"minecraft-material-logs":scenario==6?"minecraft-material-cherrylogs":scenario==7?"minecraft-material-planks":scenario==8?"minecraft-material-grass":doors?"minecraft-material-doors":stairs?"minecraft-material-stairs":slabs?"minecraft-material-slabs":instances?"source-material-instances":"source-material-faces";
        const auto wire=read(std::string(name)+".bin"),mesh=read(std::string(name)+"-mesh.bin");size_t at=36;
        for(uint32_t i=0;i<word(wire,32);++i)at+=40+((word(wire,at+28)+word(wire,at+32)+word(wire,at+36)+3)&~3u);
        const auto entriesAt=at;for(uint32_t i=0;i<word(wire,28);++i){const auto kind=word(wire,at+12),n=word(wire,at+20);at+=24+size_t(n)*(kind?24:16);}if(word(wire,at+4)==SourceLight)at+=104;
        const auto fresh=[&](){auto b=wire;const double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();put(b,at+224,now);put(b,at+232,0.0);put(b,at+36,++serial);put(b,at+60,++frame);return b;};
        Renderer r;r.initialize();r.epoch=word(wire,16);r.originKnown=true;r.sourceOrigin=glm::dvec3(0);r.presentationReady=true;
        auto first=fresh();std::vector<uint8_t> payload(first.begin()+16,first.end());Reader rr{payload};const auto epoch=rr.u32();r.sourceOrigin=SourceEmissionSnapshot::read(rr,epoch).batch.source.geometry.origin;
        const auto accept=[&](const auto& b){receiveCpuWire(b,[&](auto type,auto seq,const auto& data){r.receive(type,seq,data);});};accept(mesh);for(auto& [id,m]:r.meshes){m.texture=0;m.irisTerrain=true;}
        const GLuint handle=48400+scenario;auto p=geometryMock::fixture(handle);p.sourceInstanceRanges=true;
        p.uniforms.push_back({"packBlockId",290,GeometryUniform::PackBlockId,"packBlockKnown",291});p.uniforms.push_back({"semanticIds",292,GeometryUniform::SemanticIds,"semanticKnown",293});
        auto& reflect=geometryMock::programs[handle].uniforms;reflect.insert(reflect.end(),{{"packBlockId",290,GL_INT},{"packBlockKnown",291,GL_BOOL},{"semanticIds",292,GL_FLOAT_VEC4},{"semanticKnown",293,GL_BOOL}});
        {auto wrong=p;wrong.uniforms[10].name="worldTime";requireCPU(rejects([&]{GeometryBinding::validate(wrong);}),"Pack material data impersonated a world/reference input.");}
        r.irisPlan=std::make_unique<IrisPlan>(graphPlan());r.irisPlan->programs=std::make_shared<IrisGeometryPrograms>();
        const auto install=[&](const auto& program){r.irisPlan->programs->slots[static_cast<size_t>(GeometrySlot::Terrain)]=program;r.irisPlan->programs->slots[static_cast<size_t>(GeometrySlot::Shadow)]=program;r.irisPlan->programs->slots[static_cast<size_t>(GeometrySlot::Basic)]=program;};install(p);
        r.irisPlan->blockIds=shaderloader::preparePackMaterials(*packSources,{{"UNAVAILABLE_OPTION",std::nullopt}}).blockIds;
        r.environment.sunKnown=true;r.environment.sun=glm::normalize(glm::vec3(.3f,1.f,.2f));const auto draw=[&](){r.render(0,640,360,false);};
        accept(first);auto begin=geometryMock::draws.size();draw();const auto runs=3u; // unknown adjacent terrain runs coalesce
        requireCPU(geometryMock::draws.size()==begin+runs*2,"Pack-only consumers split unused source ID/property boundaries.");
        for(size_t pass=0;pass<2;++pass)for(size_t i=0;i<runs;++i){const auto& d=geometryMock::draws[begin+pass*runs+i];const bool valid=mappedRoots?i<2:instances?i!=1:i<2;const int id=mappedRoots?(i==0?31:32):instances?(i==0?16777217:0):(i==0?0:16777217);
            requireCPU(d.integers.at(291)==valid&&d.integers.at(290)==(valid?id:0)&&d.integers.at(293)==0&&d.integers.at(112)==0,"Pack integer ID or independent unknown reference data changed in world/shadow draw.");}
        requireCPU(r.frameMaterialIds.size()==3,"Pack resolver did not cache exactly the referenced definitions.");
        const auto buffers=mock::next;accept(fresh());draw();requireCPU(mock::next==buffers,"Repeated pack binding allocated new GPU resources.");
        if(doors){r.irisPlan->blockIds=Map::parsePreprocessed("block.1=jungle_door:powered=true\nblock.2=jungle_door:powered=false");accept(fresh());begin=geometryMock::draws.size();draw();requireCPU(geometryMock::draws.size()==begin+2,"Unknown power did not merge the unavailable ranges.");for(size_t i=begin;i<geometryMock::draws.size();++i)requireCPU(geometryMock::draws[i].integers.at(291)==0&&geometryMock::draws[i].integers.at(290)==0,"Power-dependent doors acquired a pack ID.");}
        if(scenario==5||scenario==6){r.irisPlan->blockIds=Map::parsePreprocessed("block.1=jungle_log:axis=x stripped_jungle_log:axis=x cherry_log:axis=x stripped_cherry_log:axis=x\nblock.2=jungle_log:axis=y stripped_jungle_log:axis=y cherry_log:axis=y stripped_cherry_log:axis=y\nblock.3=jungle_log:axis=z stripped_jungle_log:axis=z cherry_log:axis=z stripped_cherry_log:axis=z");accept(fresh());begin=geometryMock::draws.size();draw();requireCPU(geometryMock::draws.size()==begin+2,"Axis-dependent log IDs did not remain unknown and merge.");for(size_t i=begin;i<geometryMock::draws.size();++i)requireCPU(geometryMock::draws[i].integers.at(291)==0,"Reference axis default leaked into a world/shadow pack ID.");}
        if(scenario==8){r.irisPlan->blockIds=Map::parsePreprocessed("block.1=grass_block:snowy=false\nblock.2=grass_block:snowy=true\nblock.32=cherry_planks");accept(fresh());begin=geometryMock::draws.size();draw();requireCPU(geometryMock::draws.size()==begin+6,"Snowy consensus changed unrelated material boundaries.");for(size_t pass=0;pass<2;++pass)requireCPU(geometryMock::draws[begin+pass*3].integers.at(291)==0,"Unknown snowy state was treated as false in a native draw.");}
        if(fluids){
            for(uint32_t level=0;level<16;++level){const auto value=std::string(MinecraftBlockState::fluidLevel(level));r.irisPlan->blockIds=Map::parsePreprocessed("block.0=water:level="+value+" lava:level="+value+"\nblock.2=water lava");accept(fresh());begin=geometryMock::draws.size();draw();requireCPU(geometryMock::draws.size()==begin+2,"Level-dependent fluids did not coalesce their unknown pack ranges.");for(size_t i=begin;i<geometryMock::draws.size();++i)requireCPU(geometryMock::draws[i].integers.at(291)==0&&geometryMock::draws[i].integers.at(290)==0,"A reference level leaked into fluid world/shadow draw bindings.");}
            std::string all="block.7=";for(uint32_t level=0;level<16;++level)for(const auto name:{"water","lava"})all+=std::string(name)+":level="+std::string(MinecraftBlockState::fluidLevel(level))+" ";r.irisPlan->blockIds=Map::parsePreprocessed(all);accept(fresh());begin=geometryMock::draws.size();draw();requireCPU(geometryMock::draws.size()==begin+4,"Equal fluid IDs failed to merge without promoting Toxic Waste.");for(size_t pass=0;pass<2;++pass){const auto& d=geometryMock::draws[begin+pass*2];requireCPU(d.integers.at(291)==1&&d.integers.at(290)==7,"Common fluid pack ID did not reach a world/shadow draw.");requireCPU(geometryMock::draws[begin+pass*2+1].integers.at(291)==0,"Unsupported fluid was aliased by shared fluid flags.");}
        }
        r.irisPlan->blockIds=shaderloader::prepareBlockMaterials("#if PACK_TEST_MODE == 1\nblock.8=stone glass stone_slab stone_stairs jungle_door jungle_log stripped_jungle_log cherry_log stripped_cherry_log jungle_planks cherry_planks grass_block water lava\n#else\n#error wrong context\n#endif",{{"PACK_TEST_MODE","1"}}).blockIds;accept(fresh());begin=geometryMock::draws.size();draw();requireCPU(geometryMock::draws.size()==begin+(instances&&!mappedRoots?6:4),"Equal resolved IDs did not merge independently of raw source identity.");
        requireCPU(geometryMock::draws[begin].integers.at(290)==8,"Pack replacement reused previous IDs.");
        const auto old=r.irisPlan->blockIds;requireCPU(rejects([&]{r.irisPlan->blockIds=Map::parsePreprocessed("block.9=%logs");})&&r.irisPlan->blockIds==old,"Failed pack parse replaced the installed table.");
        r.irisPlan->blockIds=Map::parsePreprocessed("");accept(fresh());draw();requireCPU(geometryMock::draws[geometryMock::draws.size()-(instances&&!mappedRoots?3:2)].integers.at(290)==-1,"Unassigned known block was confused with unavailable data.");
        r.irisPlan->blockIds.reset();accept(fresh());draw();requireCPU(geometryMock::draws.back().integers.at(291)==0&&geometryMock::draws.back().integers.at(290)==0,"Removed pack table retained stale ID/validity.");
        r.irisPlan->blockIds=old;accept(fresh());r.geometryFrame.expires=std::chrono::steady_clock::now()-std::chrono::seconds(1);draw();requireCPU(geometryMock::draws.back().integers.at(291)==0,"Expired source retained a pack ID.");
        accept(fresh());r.render(0,800,450,false);requireCPU(geometryMock::draws.back().integers.at(291)==0,"Resized source retained a pack ID.");
        accept(fresh());draw();auto beforeChange=r.irisGraph.frames;accept(fresh());packMock::expire=&r;requireCPU(rejects(draw)&&r.irisGraph.frames==beforeChange,"Pack-only source expired during drawing but committed history.");
        accept(fresh());draw();beforeChange=r.irisGraph.frames;accept(fresh());packMock::replace=&r;requireCPU(rejects(draw)&&r.irisGraph.frames==beforeChange,"Pack map replaced during drawing but committed history.");r.irisPlan->blockIds=old;
        if(instances){auto noRanges=p;noRanges.sourceInstanceRanges=false;install(noRanges);accept(fresh());draw();requireCPU(geometryMock::draws.back().integers.at(291)==0,"Unapproved instance ranges acquired pack identity.");install(p);}
        for(auto& [id,m]:r.meshes)m.irisTerrain=false;accept(fresh());draw();requireCPU(geometryMock::draws.back().integers.at(291)==0,"Generic geometry impersonated terrain pack identity.");for(auto& [id,m]:r.meshes)m.irisTerrain=true;
        accept(fresh());draw();const auto commits=r.irisGraph.frames;geometryMock::failProgram=handle;accept(fresh());requireCPU(rejects(draw)&&r.irisGraph.frames==commits,"Failed pack material draw committed history.");
        accept(fresh());auto bad=fresh();put(bad,entriesAt+24+(instances?20:12),0xffffffffu);requireCPU(rejects([&]{accept(bad);}),"Foreign material token was accepted.");draw();requireCPU(geometryMock::draws.back().integers.at(291)==0,"Rejected transaction retained pack authorization.");
        auto required=p;required.uniforms[10].validity=-1;required.uniforms[10].validityName.clear();const auto saved=reflect;reflect.erase(std::remove_if(reflect.begin(),reflect.end(),[](const auto& u){return u.location==291;}),reflect.end());install(required);accept(fresh());const auto before=r.irisGraph.frames;requireCPU(rejects(draw)&&r.irisGraph.frames==before,"Required unknown pack block ID committed history.");reflect=saved;install(p);
        accept(fresh());draw();accept(mesh);for(auto& [id,m]:r.meshes){m.texture=0;m.irisTerrain=true;}draw();requireCPU(geometryMock::draws.back().integers.at(291)==0,"Replacement mesh upload inherited pack identity.");
        r.reset();requireCPU(r.frameMaterialIds.empty()&&!r.frameBlockIds,"Reset retained pack material frame cache.");
    }
    nativegl::glDrawElements=packMock::draw;nativegl::glDrawElementsInstanced=packMock::instanced;
}
