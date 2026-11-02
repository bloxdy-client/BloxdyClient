#pragma once
void testMinecraftBlockMapping(){
    using namespace bridge;
    for(const auto& rule:minecraftBlockRules){
        if(rule.kind!=MinecraftBlockKind::cube&&rule.kind!=MinecraftBlockKind::slab)continue;
        const bool slab=rule.kind==MinecraftBlockKind::slab;
        SourceBlockMaterial m;m.token=8;m.id=m.rootId=381;m.name=m.rootName=rule.source;m.flags=rule.flags;
        if(slab){m.state="meta|rot1|bot";m.rotation=1;m.half=1;}
        const auto mapped=mapMinecraftBlock(m);requireCPU(mapped.known()&&mapped.name==rule.name&&mapped.complete,"Explicit reference mapping failed.");
        requireCPU((slab?mapped.property("waterlogged")==std::optional<std::string_view>("false"):!mapped.property("waterlogged"))&&!mapped.property("facing")&&!mapped.property("unknown"),"Reference properties were fabricated.");
        if(slab){requireCPU(mapped.property("type")==std::optional<std::string_view>("bottom"),"Root slab lost bottom state.");
            auto top=m;top.id=382;top.name+="|meta|rot1|top";top.state="meta|rot1|top";top.half=2;const auto t=mapMinecraftBlock(top);
            requireCPU(t.name==rule.name&&t.property("type")==std::optional<std::string_view>("top")&&t.complete&&t.property("waterlogged")==std::optional<std::string_view>("false"),"Top slab state is wrong.");
            for(const auto half:{1u,2u,3u}){auto bad=top;bad.half=half;bad.rotation=2;requireCPU(!mapMinecraftBlock(bad).known(),"Unsupported rotation acquired a reference state.");}
            auto side=m;side.name+="|meta|rot1|side";side.state="meta|rot1|side";side.half=3;side.id=382;requireCPU(!mapMinecraftBlock(side).known(),"Side slab is not a horizontal reference slab.");
        }else requireCPU(!mapped.property("type"),"Cube acquired a slab type.");
        for(const auto change:{0,1,2,3,4,5,6,7,8,9,10,11}){auto bad=m;
            switch(change){case 0:bad.token=0;break;case 1:bad.id=0;break;case 2:bad.rootId=65536;break;case 3:bad.name+=" ";break;case 4:bad.rootName+=" ";break;case 5:bad.flags^=1;break;case 6:bad.flags^=2;break;case 7:bad.flags^=4;break;case 8:bad.flags^=8;break;case 9:bad.open=1;break;case 10:bad.state+="|unknown";break;case 11:bad.id=400;break;}
            requireCPU(!mapMinecraftBlock(bad).known(),"Invalid/changed source metadata acquired a reference identity.");}
        // Source IDs are not a mapping table index and may change per registry.
        m.id=m.rootId=65535;requireCPU(mapMinecraftBlock(m).name==rule.name,"Mapping depends on a numeric source ID.");
    }
    for(const auto& rule:minecraftBlockRules){
        const bool stairs=rule.kind==MinecraftBlockKind::stairs,door=rule.kind==MinecraftBlockKind::door_lower||rule.kind==MinecraftBlockKind::door_upper;
        if(!stairs&&!door)continue;
        constexpr std::string_view facing[]={"north","west","south","east"},corners[]={"","innerLeft","innerRight","outerLeft","outerRight"},shapes[]={"straight","inner_right","inner_left","outer_right","outer_left"};
        for(uint32_t rotation=1;rotation<=4;++rotation)for(uint32_t half=1;half<=2;++half)for(size_t shape=0;shape<(stairs?5u:1u);++shape){
            SourceBlockMaterial m;m.token=9;m.rootId=123;m.flags=9;m.rootName=rule.source;m.rotation=rotation;
            m.state="meta|rot"+std::to_string(rotation)+(stairs?(half==1?"|bot":"|top"):(half==1?"|closed":"|open"));
            if(shape)m.state+="|"+std::string(corners[shape]);m.half=stairs?half:0;m.open=door?half:0;
            const bool root=rotation==1&&half==1&&!shape;m.id=root?m.rootId:400;m.name=root?m.rootName:m.rootName+"|"+m.state;
            const auto b=mapMinecraftBlock(m);requireCPU(b.known()&&b.name==rule.name&&b.facing==facing[rotation-1],"Shaped family identity/facing changed.");
            if(stairs)requireCPU(b.complete&&b.half==(half==1?"bottom":"top")&&b.shape==shapes[shape]&&b.waterlogged==false&&!b.property("powered")&&!b.property("open")&&!b.property("type"),"Stair half/corner/dry state is incorrect.");
            else requireCPU(!b.complete&&b.half==(rule.kind==MinecraftBlockKind::door_lower?"lower":"upper")&&b.hinge=="right"&&b.opened==(half==2)&&!b.property("powered")&&!b.property("waterlogged")&&!b.property("shape"),"Door mapping fabricated power or lost a proven property.");
            for(int change=0;change<12;++change){auto bad=m;switch(change){case 0:bad.token=0;break;case 1:bad.rotation=0;break;case 2:bad.rotation=5;break;case 3:bad.flags^=4;break;case 4:bad.state+="|custom";break;case 5:bad.name+="|custom";break;case 6:bad.id=root?400:123;break;case 7:bad.half=3;break;case 8:bad.open=stairs?1:0;break;case 9:bad.rootName+=" ";break;case 10:bad.flags^=8;break;case 11:bad.state="meta|rot1|closed";bad.name="foreign";break;}
                requireCPU(!mapMinecraftBlock(bad).known(),"Contradictory shaped definition acquired a canonical identity.");}
        }
    }
    for(const auto& rule:minecraftBlockRules){
        if(rule.kind!=MinecraftBlockKind::log&&rule.kind!=MinecraftBlockKind::grass)continue;
        SourceBlockMaterial m;m.token=11;m.id=m.rootId=60000;m.flags=3;m.name=m.rootName=rule.source;
        const auto mapped=mapMinecraftBlock(m);requireCPU(mapped.known()&&mapped.name==rule.name&&!mapped.complete,"Wood/grass family identity was lost.");
        requireCPU(!mapped.property("axis")&&!mapped.property("snowy")&&!mapped.property("waterlogged")&&!mapped.property("facing"),"Unobserved wood/grass properties were invented.");
        for(int change=0;change<14;++change){auto bad=m;switch(change){case 0:bad.token=0;break;case 1:bad.id=0;break;case 2:bad.id=3;break;case 3:bad.flags=1;break;case 4:bad.flags=7;break;case 5:bad.flags=11;break;case 6:bad.rotation=1;break;case 7:bad.half=1;break;case 8:bad.open=1;break;case 9:bad.state="TreeBase|Jungle";break;case 10:bad.name+="|TreeBase|Jungle";break;case 11:bad.rootName+=" ";break;case 12:bad.state="meta|axis=y";break;case 13:bad.state="meta|snowy=false";break;}
            requireCPU(!mapMinecraftBlock(bad).known(),"Unsupported wood/grass metadata gained a reference state.");}
    }
    for(const auto& rule:minecraftBlockRules)if(rule.kind==MinecraftBlockKind::fluid){
        SourceBlockMaterial m;m.token=17;m.id=m.rootId=65535;m.flags=4;m.name=m.rootName=rule.source;
        const auto state=mapMinecraftBlock(m);requireCPU(state.known()&&state.name==rule.name&&!state.complete&&!state.level.has_value()&&!state.property("level"),"Static fluid gained a fabricated Minecraft level.");
        for(int change=0;change<15;++change){auto bad=m;switch(change){case 0:bad.token=0;break;case 1:bad.id=0;break;case 2:bad.rootId=65536;break;case 3:bad.id=7;break;case 4:bad.flags=0;break;case 5:bad.flags=5;break;case 6:bad.flags=6;break;case 7:bad.flags=12;break;case 8:bad.name+="|level0";break;case 9:bad.rootName+=" ";break;case 10:bad.rotation=1;break;case 11:bad.open=1;break;case 12:bad.half=1;break;case 13:bad.state="level=0";break;case 14:bad.state="meta|flowing";break;}requireCPU(!mapMinecraftBlock(bad).known(),"Changed fluid metadata retained its canonical identity.");}
    }
    SourceBlockMaterial custom;custom.token=1;custom.id=custom.rootId=1;custom.flags=3;
    for(const auto name:{"stone","minecraft:stone","Jungle Grass Block","Toxic Waste","Water","Lava","Maple Log","Pine Log","Maple Wood Planks","Moonstone","Snow|meta|top"}){custom.name=custom.rootName=name;requireCPU(!mapMinecraftBlock(custom).known(),"Unlisted family or wrong flags acquired a reference identity.");}
}
