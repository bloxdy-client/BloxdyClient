#pragma once
namespace packChainMock {
using namespace bridge::shaderloader;
struct Draw {GLuint sampled;std::map<GLenum,GLuint> outputs;};
std::vector<Draw> draws;std::map<GLuint,uint64_t> stamps;uint64_t serial=0;
PackPassApi api(){auto a=packPassMock::api();a.ClearBufferfv=[](GLenum buffer,GLint index,const GLfloat* value){packPassMock::api().ClearBufferfv(buffer,index,value);const auto& f=packOutputMock::framebuffers.at(packOutputMock::draw);stamps[f.attachments.at(buffer==GL_DEPTH?GL_DEPTH_ATTACHMENT:f.buffers.at(index))]=0;};return a;}
PackVertexApi vertices(){auto a=packOutputMock::vertexApi();a.DrawArraysInstanced=[](GLenum mode,GLint first,GLsizei count,GLsizei instances){
    if(packOutputMock::probe)packOutputMock::probe();const auto sampled=packTextureMock::bound.at({3,GL_TEXTURE_2D});const auto outputs=packOutputMock::framebuffers.at(packOutputMock::draw).attachments;
    requireCPU(sampled==5000||(packPassMock::owned.contains(sampled)&&stamps[sampled]>0),"Consumer sampled an uninitialized pass image.");
    for(const auto& [_,texture]:outputs)requireCPU(texture!=sampled&&stamps[texture]==0,"Pass sampled its own output or skipped target initialization.");
    packVertexMock::expectedSamplerTexture=sampled;packVertexMock::api().DrawArraysInstanced(mode,first,count,instances);draws.push_back({sampled,outputs});for(const auto& [_,texture]:outputs)stamps[texture]=++serial;
};return a;}
}

void testPackImageLeasesAndTwoPass(){
    using namespace bridge::shaderloader;namespace pm=packProgramMock;namespace um=packUniformMock;namespace tm=packTextureMock;namespace vm=packVertexMock;namespace om=packOutputMock;namespace sm=packPassMock;namespace cm=packChainMock;
    const auto fails=[](auto fn){try{fn();}catch(const std::exception&){return true;}return false;};pm::reset();tm::reset();vm::reset();om::reset();sm::reset();cm::draws.clear();cm::stamps.clear();cm::serial=0;um::units=8;um::failAt=um::loseAt=SIZE_MAX;
    ProgramDomain domain(pm::api(),[]{return pm::context;});std::ifstream file("outputs/native-renderer-verification/translation-source-fixture.bin",std::ios::binary);const std::vector<uint8_t> bytes(std::istreambuf_iterator<char>(file),{});const auto sources=PackSources::decode(bytes);
    const std::vector<PackUniformValue> values={{"transform",std::vector<float>(16,1)},{"sourceTex",std::vector<int32_t>{3}}};
    const std::vector<PackVertexInput> vertices={vm::input("position","explicit:position",20,60,12),vm::input("coord","explicit:uv",40,40,8)};
    const auto source=tm::input("sourceTex",5000,GL_TEXTURE_2D,GL_RGBA8,8,4);const PackArrayDraw command={GL_TRIANGLES,2,3,2};
    auto make=[&](bool producer){
        pm::outputs=producer?std::vector<pm::Output>{{0},{2}}:std::vector<pm::Output>{{0}};
        const std::vector<PropertyMacro> macros={{"MRT",producer?"1":"0"}};
        const auto pair=GlslTranslation::preparePair(*sources,"legacy.vsh","legacy.fsh",macros);
        const std::string prefix=producer?"pack-chain-producer":"pack-chain-consumer";
        for(const auto& [extension,text]:std::initializer_list<std::pair<const char*,std::string>>{{".vert",pair.vertex.text},{".frag",pair.fragment.text}}){std::ofstream out("outputs/native-renderer-verification/"+prefix+extension,std::ios::binary);out<<text;requireCPU(bool(out),"Cannot write two-pass compiler fixture.");}
        PackBindingRequest request{{{"position","explicit:position",GL_FLOAT_VEC3,2},{"coord","explicit:uv",GL_FLOAT_VEC2,7}},{{"transform","explicit:matrix",GL_FLOAT_MAT4,11},{"sourceTex","explicit:unit",GL_SAMPLER_2D,4}},producer?std::vector<PackOutputRoute>{{0,GL_COLOR_ATTACHMENT1},{2,GL_COLOR_ATTACHMENT3}}:std::vector<PackOutputRoute>{{0,GL_COLOR_ATTACHMENT3}}};
        auto writer=PackUniformWriter::create(domain.compilePack(*sources,"legacy.vsh","legacy.fsh",macros),request,um::api());writer.write(values);
        auto output=PackFramebufferBinder::create(PackVertexBinder::create(PackTextureBinder::create(std::move(writer),tm::api()),cm::vertices()),om::api());
        const std::vector<PackPassImageSpec> specs=producer?std::vector<PackPassImageSpec>{{GL_COLOR_ATTACHMENT1,GL_RGBA8,{0.125f,0,0,1}},{GL_COLOR_ATTACHMENT3,GL_RGBA16F,{0.5f,0,0,1}}}:std::vector<PackPassImageSpec>{{GL_COLOR_ATTACHMENT3,GL_RGBA32F,{0.5f,0,0,1}}};
        return PackTestPass::create(std::move(output),cm::api(),specs,8,4,{});
    };
    auto producer=make(true),consumer=make(false);auto retired=producer->imageCollection();
    const auto restored=[&]{requireCPU(sm::state==sm::original&&om::draw==90&&om::read==91&&om::framebuffers.size()==2&&om::viewport==std::array<GLfloat,4>{17.25f,19.5f,800.75f,600.5f}&&tm::active==GL_TEXTURE0+6&&tm::bound[{6,GL_TEXTURE_2D}]==52&&tm::bound[{3,GL_TEXTURE_2D}]==50&&tm::boundSamplers[3]==900&&vm::vao==70&&vm::array==10&&pm::boundProgram==700000,"Leased passes changed caller GL state.");};
    requireCPU(fails([&]{producer->output(GL_COLOR_ATTACHMENT1,"sourceTex");})&&fails([&]{retired.close();}),"Unpublished images were exported or active image store was closed.");
    producer->draw(values,vertices,{source},command);restored();
    auto image=producer->output(GL_COLOR_ATTACHMENT1,"sourceTex");auto copy=image;requireCPU(retired.readers()==1&&image.current(image.generation),"Copied image descriptors did not pin one immutable generation.");
    const auto beforePinned=cm::draws.size(),beforeClears=sm::clears;
    requireCPU(fails([&]{producer->draw(values,vertices,{source},command);})&&fails([&]{producer->draw(values,vertices,{image},command);})&&sm::clears==beforeClears&&cm::draws.size()==beforePinned,"Pinned producer was overwritten or accepted feedback.");
    auto invalid=[&](auto change){auto bad=image;change(bad);const auto count=cm::draws.size();requireCPU(fails([&]{consumer->draw(values,vertices,{bad},command);})&&cm::draws.size()==count,"Tampered output ownership reached a consumer draw.");requireCPU(fails([&]{consumer->output(GL_COLOR_ATTACHMENT3,"sourceTex");}),"Failed consumer published a result.");restored();};
    invalid([](auto& i){++i.generation;});invalid([](auto& i){i.texture=5000;});invalid([](auto& i){i.width=7;});invalid([](auto& i){i.format=GL_RGBA8UI;});invalid([](auto& i){i.sampler=1000;});invalid([](auto& i){i.sampling.min=GL_LINEAR;});invalid([](auto& i){i.owner=std::make_shared<int>(1);i.current=[](uint64_t){return true;};});invalid([](auto& i){i.texture=5000;i.current=[](uint64_t){return true;};});
    consumer->draw(values,vertices,{image},command);restored();requireCPU(cm::draws.back().sampled==image.texture&&cm::draws.back().outputs.at(GL_COLOR_ATTACHMENT3)!=image.texture,"Consumer did not read the producer's separate physical image.");
    // Reader retirement is CPU-only; the explicit collector survives producer destruction.
    producer->close();producer.reset();requireCPU(image.current(image.generation)&&retired.readers()==1&&domain.outstanding()==2&&fails([&]{domain.close();}),"Producer retirement invalidated pinned pixels or released the context lease.");
    consumer->draw(values,vertices,{copy},command);restored();requireCPU(fails([&]{retired.close();}),"Collector deleted images with live readers.");
    auto stale=image.current;const auto oldGeneration=image.generation;image={};size_t calls=pm::calls;
    std::thread release([held=std::move(copy),&fails]()mutable{requireCPU(fails([&]{held.current(held.generation);}),"Foreign thread validated an image generation.");held={};});release.join();
    requireCPU(pm::calls==calls&&retired.readers()==0&&!stale(oldGeneration),"Foreign read release called GL or a stale weak lease survived.");
    std::thread foreignCollect([&]{requireCPU(fails([&]{retired.collect();}),"Foreign thread collected pass images.");});foreignCollect.join();requireCPU(pm::calls==calls,"Foreign collector called GL.");
    retired.collect();retired.close();domain.collect();requireCPU(domain.outstanding()==1&&sm::owned.size()==1,"Deferred owner collection failed to release producer images/program.");consumer.reset();domain.collect();requireCPU(sm::owned.empty(),"Consumer destructor leaked an image.");
    // Failed nested sampler restoration keeps its source pin until collection.
    producer=make(true);consumer=make(false);retired=producer->imageCollection();producer->draw(values,vertices,{source},command);image=producer->output(GL_COLOR_ATTACHMENT1,"sourceTex");
    om::probe=[] {tm::persistentSamplerFailure=true;};requireCPU(fails([&]{consumer->draw(values,vertices,{image},command);})&&consumer->pendingRestore(),"Sampler cleanup failure was hidden.");om::probe={};image={};requireCPU(retired.readers()==1&&fails([&]{producer->draw(values,vertices,{source},command);}),"Pending consumer released or overwrote its source pin.");
    tm::persistentSamplerFailure=false;consumer->collect();restored();requireCPU(retired.readers()==0&&fails([&]{consumer->output(GL_COLOR_ATTACHMENT3,"sourceTex");}),"Cleanup alone published a failed consumer.");
    producer->draw(values,vertices,{source},command);image=producer->output(GL_COLOR_ATTACHMENT1,"sourceTex");requireCPU(image.generation>oldGeneration,"Producer did not advance its content generation.");image={};
    std::vector<PackTextureInput> pins;for(unsigned i=0;i<32;++i)pins.push_back(producer->output(GL_COLOR_ATTACHMENT1,"sourceTex"));requireCPU(retired.readers()==32&&fails([&]{producer->output(GL_COLOR_ATTACHMENT1,"sourceTex");}),"Output read leases exceeded their bound.");pins.clear();requireCPU(retired.readers()==0,"Released output pins remained frozen.");
    producer.reset();consumer.reset();retired.close();domain.collect();requireCPU(sm::owned.empty(),"Image pin tests leaked storage.");
    // Explicit, bounded two-pass orchestration; no source graph activation.
    producer=make(true);consumer=make(false);
    for(const auto& bad:std::vector<std::vector<PackPassLink>>{{},{ {GL_COLOR_ATTACHMENT0,"sourceTex"} },{ {GL_COLOR_ATTACHMENT1,"missing"} },{ {GL_COLOR_ATTACHMENT1,"transform"} },{ {GL_COLOR_ATTACHMENT1,"sourceTex"},{GL_COLOR_ATTACHMENT3,"sourceTex"} }})requireCPU(fails([&]{PackTwoPass::create(std::move(producer),std::move(consumer),bad);})&&producer&&consumer,"Invalid two-pass routes consumed ownership.");
    auto chain=PackTwoPass::create(std::move(producer),std::move(consumer),{{GL_COLOR_ATTACHMENT1,"sourceTex"}});auto collectors=chain->imageCollections();
    const PackPassCall first={values,vertices,{source},command},second={values,vertices,{},command};
    requireCPU(fails([&]{chain->output(GL_COLOR_ATTACHMENT3,"sourceTex");}),"Unexecuted chain published an image.");
    auto conflict=second;conflict.textures={source};const auto beforeConflict=cm::draws.size();requireCPU(fails([&]{chain->draw(first,conflict);})&&cm::draws.size()==beforeConflict,"Conflicting link ran the producer.");
    om::probe=[&]{requireCPU(fails([&]{chain->collect();})&&fails([&]{chain->close();})&&fails([&]{chain->draw(first,second);})&&fails([&]{chain->output(GL_COLOR_ATTACHMENT3,"sourceTex");}),"Two-pass chain permitted reentrancy.");};
    const auto start=cm::draws.size();chain->draw(first,second);restored();om::probe={};requireCPU(cm::draws.size()==start+2&&cm::draws[start].sampled==5000&&cm::draws[start+1].sampled==cm::draws[start].outputs.at(GL_COLOR_ATTACHMENT1),"Two-pass ordering or explicit source route was incorrect.");
    auto result=chain->output(GL_COLOR_ATTACHMENT3,"sourceTex");const auto published=result.generation;const auto resultTexture=result.texture;const auto beforeFrozen=cm::draws.size();requireCPU(fails([&]{chain->draw(first,second);})&&cm::draws.size()==beforeFrozen,"Frozen final output allowed partial producer work.");result={};
    const auto allocationCount=sm::allocations;chain->draw(first,second);restored();requireCPU(sm::allocations==allocationCount,"Repeated chain reallocated immutable storage.");result=chain->output(GL_COLOR_ATTACHMENT3,"sourceTex");requireCPU(result.generation>published&&result.texture==resultTexture,"Repeated chain lost resource identity or content generation.");result={};
    // Failure in either pass prevents chain publication and consumer work after producer failure.
    vm::failDraw=true;const auto beforeFailure=cm::draws.size();requireCPU(fails([&]{chain->draw(first,second);})&&cm::draws.size()==beforeFailure+1&&fails([&]{chain->output(GL_COLOR_ATTACHMENT3,"sourceTex");}),"Failed producer ran the consumer or published a chain result.");vm::failDraw=false;restored();
    unsigned phase=0;om::probe=[&]{if(++phase==2)vm::failDraw=true;};requireCPU(fails([&]{chain->draw(first,second);})&&phase==2&&fails([&]{chain->output(GL_COLOR_ATTACHMENT3,"sourceTex");}),"Failed consumer published stale chain output.");vm::failDraw=false;om::probe={};restored();
    phase=0;om::probe=[&]{if(++phase==2)vm::loseDraw=true;};requireCPU(fails([&]{chain->draw(first,second);})&&chain->pendingRestore(),"Two-pass context loss lost pending state.");calls=pm::calls;requireCPU(fails([&]{chain->collect();})&&pm::calls==calls,"Chain restoration used a foreign context.");pm::context=77;vm::loseDraw=false;om::probe={};chain->collect();restored();requireCPU(collectors[0].readers()==0,"Chain recovery retained the failed consumer's source pin.");
    chain->draw(first,second);result=chain->output(GL_COLOR_ATTACHMENT3,"sourceTex");chain->close();chain.reset();requireCPU(result.current(result.generation)&&fails([&]{collectors[1].close();}),"Retired chain lost its externally pinned final output.");result={};for(auto& collector:collectors)collector.close();domain.collect();domain.close();restored();
    requireCPU(sm::owned.empty()&&sm::allocations==sm::deletions&&om::allocations==om::deletions&&vm::allocations==vm::deletions,"Two-pass lifecycle leaked image/FBO/VAO resources.");
    std::ofstream report("outputs/native-renderer-verification/two-pass.json");report<<"{\"passed\":true,\"scope\":\"CPU mock image leases and explicit two-pass chain\",\"graphicsContextsCreated\":0,\"livePixelsVerified\":false,\"productionActivation\":false,\"maxPasses\":2,\"maxReadPinsPerPass\":32,\"logicalByteLimitPerPass\":67108864,\"sealedDescriptors\":true,\"deferredOwnerCollection\":true}";requireCPU(bool(report),"Cannot write two-pass evidence.");
    vm::expectedSamplerTexture=5000;
}
