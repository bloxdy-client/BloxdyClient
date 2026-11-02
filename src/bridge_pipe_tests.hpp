#pragma once
// Anonymous, in-process CPU pipe only: no client, child process or graphics.
struct CpuPacketPipe {
    HANDLE read=INVALID_HANDLE_VALUE,write=INVALID_HANDLE_VALUE;
    CpuPacketPipe(){requireCPU(CreatePipe(&read,&write,nullptr,4096)!=0,"Cannot create CPU test pipe.");}
    ~CpuPacketPipe(){if(read!=INVALID_HANDLE_VALUE)CloseHandle(read);if(write!=INVALID_HANDLE_VALUE)CloseHandle(write);}
    CpuPacketPipe(const CpuPacketPipe&)=delete;
    void put(const uint8_t* data,size_t size){DWORD written=0;requireCPU(size<=4096&&WriteFile(write,data,static_cast<DWORD>(size),&written,nullptr)&&written==size,"CPU test pipe write failed.");}
};
template<class Receive> void receiveCpuWire(const std::vector<uint8_t>& wire,Receive receive){
    CpuPacketPipe handles;bridge::Pipe pipe(handles.read);size_t sent=0;
    // Production poll deliberately yields after 4 ms/96 packets. A CPU test
    // transaction may therefore need more than one poll, even after its final
    // write. Drain bounded progress; an incomplete packet still fails below.
    const auto drain=[&](){
        for(unsigned attempt=0;attempt<16;++attempt){const auto before=pipe.bufferedBytes();pipe.poll(receive);DWORD available=0;
            requireCPU(PeekNamedPipe(handles.read,nullptr,0,nullptr,&available,nullptr)!=0,"Cannot inspect CPU test pipe.");
            if(!available&&(!pipe.bufferedBytes()||before==pipe.bufferedBytes()&&!pipe.appliedPackets))return;
        }requireCPU(false,"CPU test pipe did not drain within its bounded polls.");
    };
    // Split both the header and payload; poll after every bounded write.
    for(const size_t fragment:{size_t(7),size_t(9),size_t(31),size_t(4096)}){
        do {const size_t count=std::min(fragment,wire.size()-sent);if(!count)break;
            handles.put(wire.data()+sent,count);sent+=count;drain();
        }while(fragment==4096&&sent<wire.size());
    }
    requireCPU(sent==wire.size()&&pipe.bufferedBytes()==0,"Native pipe did not finish the complete transaction.");
}
void testPacketPipe(){
    using namespace bridge;
    // All existing packet layouts still pass the actual framing gate, in order.
    std::vector<uint8_t> stream;
    for(uint32_t type=Reset;type<=SourceEmission;++type){const uint32_t words[]{magic,type,4,type+100,71};
        const auto* bytes=reinterpret_cast<const uint8_t*>(words);stream.insert(stream.end(),bytes,bytes+sizeof(words));}
    uint32_t next=Reset;
    receiveCpuWire(stream,[&](uint32_t type,uint32_t sequence,const std::vector<uint8_t>& payload){
        requireCPU(type==next++&&sequence==type+100&&payload.size()==4,"Native ingress reordered or changed a packet.");
        Reader reader{payload};requireCPU(reader.u32()==71,"Native ingress changed epoch.");reader.finish();});
    requireCPU(next==SourceEmission+1,"Native ingress lost a supported packet type.");
    unsigned delayed=0;receiveCpuWire(std::vector<uint8_t>(stream.begin(),stream.begin()+60),[&](auto type,auto sequence,const auto& payload){
        requireCPU(type==Reset+delayed&&sequence==type+100&&payload.size()==4,"Budget-yielded CPU pipe reordered or truncated a packet.");++delayed;std::this_thread::sleep_for(std::chrono::milliseconds(5));
    });requireCPU(delayed==3,"Budget-yielded CPU pipe lost or replayed a complete packet.");
    for(const std::array<uint32_t,4> header:{std::array<uint32_t,4>{magic,0,4,1},
        {magic,SourceEmission+1,4,1},{magic,SourceLight,maxPacket+1,1},{magic^1,SourceLight,4,1}}){
        CpuPacketPipe handles;Pipe pipe(handles.read);handles.put(reinterpret_cast<const uint8_t*>(header.data()),16);
        bool rejected=false,called=false;try{pipe.poll([&](auto,auto,const auto&){called=true;});}catch(const std::runtime_error&){rejected=true;}
        requireCPU(rejected&&!called,"Invalid native framing reached the renderer.");
    }
    // A truncated type 32 must never call receive; completing it commits once.
    CpuPacketPipe handles;Pipe pipe(handles.read);uint32_t header[]{magic,SourceLight,4,17};unsigned calls=0;
    handles.put(reinterpret_cast<const uint8_t*>(header),16);
    auto callback=[&](auto type,auto sequence,const auto& payload){++calls;requireCPU(type==SourceLight&&sequence==17&&payload.size()==4,"Type 32 framing changed.");};
    pipe.poll(callback);requireCPU(calls==0&&pipe.bufferedBytes()==16,"Incomplete packet was applied.");
    const uint32_t epoch=71;handles.put(reinterpret_cast<const uint8_t*>(&epoch),4);pipe.poll(callback);pipe.poll(callback);
    requireCPU(calls==1&&pipe.bufferedBytes()==0,"Completed packet was dropped or replayed.");
}
