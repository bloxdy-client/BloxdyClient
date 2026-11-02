#pragma once
#include "bridge_gpu_particles.hpp"
#include "bridge_minecraft_blocks.hpp"
#include <unordered_set>
namespace bridge {
struct SourceEmissionRun {uint32_t end=0,value=0,sourceBlock=0,registration=0,lifetime=0;bool blockKnown=false;uint32_t definition=0;}; // raw source block; never a Minecraft semantic ID
struct SourceEmissionEntry {uint32_t mesh=0,sequence=0,job=0,rgb=0;std::vector<SourceEmissionRun> runs;uint32_t kind=0,instanceSequence=0;};
struct SourceEmissionSnapshot {
    GpuParticleSnapshot batch;bool hasGpu=false;
    std::vector<SourceEmissionEntry> entries;
    std::unordered_map<uint32_t,SourceBlockMaterial> definitions;
    static SourceEmissionSnapshot read(Reader& r,uint32_t epoch){
        const auto require=[](bool ok){if(!ok)throw std::runtime_error("Invalid source own RGB emission transaction.");};
        require(r.bytes.size()+16<=1024*1024);const auto version=r.u32(),size=r.u32(),count=r.u32();
        require((version>=1&&version<=5)&&count<=8192&&size>=236&&uint64_t(r.position)+uint64_t(count)*(version>=3?24:16)+size<=r.bytes.size());
        SourceEmissionSnapshot result;result.entries.reserve(count);std::unordered_set<uint32_t> ids;uint32_t total=0;
        if(version==5){const auto n=r.u32();require(n&&n<=256);std::unordered_set<uint32_t> blocks;
            for(uint32_t i=0;i<n;++i){SourceBlockMaterial m;m.token=r.u32();m.id=r.u32();m.rootId=r.u32();m.flags=r.u32();m.rotation=r.u32();m.open=r.u32();m.half=r.u32();const auto name=r.u32(),root=r.u32(),state=r.u32();
                require(m.token&&!result.definitions.contains(m.token)&&m.id&&m.id<=65535&&blocks.insert(m.id).second&&m.rootId&&m.rootId<=65535&&m.flags<=15&&m.rotation<=4&&m.open<=2&&m.half<=3&&name&&name<=128&&root&&root<=128&&state<=128);
                const auto length=name+root+state,padded=(length+3)&~3u;require(uint64_t(r.position)+padded+size<=r.bytes.size());const auto* text=r.data(padded);
                require(std::all_of(text,text+length,[](auto c){return c>=32&&c<=126;})&&std::all_of(text+length,text+padded,[](auto c){return c==0;}));
                m.name.assign(reinterpret_cast<const char*>(text),name);m.rootName.assign(reinterpret_cast<const char*>(text+name),root);m.state.assign(reinterpret_cast<const char*>(text+name+root),state);m.minecraft=mapMinecraftBlock(m);result.definitions.emplace(m.token,std::move(m));}}
        std::unordered_set<uint32_t> usedDefinitions;
        for(uint32_t i=0;i<count;++i){SourceEmissionEntry e{r.u32(),r.u32(),r.u32(),r.u32()};
            require(e.mesh&&e.sequence&&e.job&&ids.insert(e.mesh).second);
            if(version>=3){e.kind=e.rgb;e.instanceSequence=r.u32();e.rgb=r.u32();require(e.kind<=1&&(e.kind?e.instanceSequence!=0:e.instanceSequence==0));}
            if(version==1)require(e.rgb<=4095);
            else {const auto n=e.rgb;e.rgb=0;require(n&&n<=8192&&total+n<=8192&&uint64_t(r.position)+uint64_t(n)*((e.kind?20:version>=4?12:8)+(version==5?4:0))+size<=r.bytes.size());total+=n;
                std::unordered_set<uint32_t> lifetimes;
                e.runs.reserve(n);uint32_t end=0;for(uint32_t j=0;j<n;++j){SourceEmissionRun run{r.u32(),r.u32()};
                    require(run.end>end&&run.end<=(e.kind?65536u:6000000u)&&(e.kind||run.end%3==0)&&(!run.value||(run.value>=4096&&run.value<=8191)));
                    if(e.kind){run.sourceBlock=r.u32();run.registration=r.u32();run.lifetime=r.u32();require(run.end==end+1&&run.sourceBlock&&run.sourceBlock<=65535&&run.registration&&run.lifetime&&lifetimes.insert(run.lifetime).second);run.blockKnown=true;}
                    else if(version>=4){const auto block=r.u32();require(!block||(block>=65536&&block<=131071));run.blockKnown=(block&65536)!=0;run.sourceBlock=block&65535;}
                    if(version==5){run.definition=r.u32();if(run.definition){const auto d=result.definitions.find(run.definition);require(run.blockKnown&&d!=result.definitions.end()&&d->second.id==run.sourceBlock);usedDefinitions.insert(run.definition);}}
                    end=run.end;e.runs.push_back(run);}}
            result.entries.push_back(std::move(e));}
        require(uint64_t(r.position)+size==r.bytes.size()&&usedDefinitions.size()==result.definitions.size());
        require(r.u32()==magic);const auto type=r.u32();require(r.u32()==size-16);r.u32();
        const auto* data=r.data(size-16);std::vector<uint8_t> payload(data,data+size-16);r.finish();Reader nested{payload};require(nested.u32()==epoch);
        if(type==SourceLight){auto light=SourceLightSnapshot::read(nested,epoch);result.hasGpu=light.hasGpu;result.batch=std::move(light.batch);}
        else if(type==GpuParticles){result.hasGpu=true;result.batch=GpuParticleSnapshot::read(nested,epoch);}
        else {require(type==SourceFrame);result.batch.source=SourceFrameData::read(nested);}
        require((result.batch.source.flags&44)==44);return result;
    }
};
}
