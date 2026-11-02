#pragma once
#include <windows.h>
#include <algorithm>
#include <cstdint>
#include <cstring>
#include <functional>
#include <stdexcept>
#include <vector>
#include <chrono>
#include <thread>
#include <cmath>

namespace bridge {
constexpr uint32_t magic=0x31444e42; // BND1, little endian
constexpr uint32_t maxPacket=64u*1024u*1024u;
enum Type : uint32_t { Reset=1, Camera=2, Mesh=3, Texture=4, Transform=5, Light=6, Snapshot=7, Remove=8, Instances=9, Rebase=10, Pose=11, Material=12, Environment=13, Surface=14, RenderControl=15, ReleaseTextures=16, MaterialState=17, AppearanceMaterial=18, AppearanceData=19, AppearanceDataV2=20, TextureSampling=21, Origin=22, AtlasAnimation=23, SpecialMaterial=24, AppearanceDataV3=25, ParticleBatch=26, DrawState=27, ParticleBatchV2=28, ParticleBatchV3=29, SourceFrame=30, GpuParticles=31, SourceLight=32, SourceEmission=33 };
struct Reader {
    const std::vector<uint8_t>& bytes;size_t position=0;
    template<class T> T scalar(){if(position+sizeof(T)>bytes.size())throw std::runtime_error("Truncated bridge payload.");T value;std::memcpy(&value,bytes.data()+position,sizeof(T));position+=sizeof(T);return value;}
    uint32_t u32(){return scalar<uint32_t>();}
    float f32(){const auto x=scalar<float>();if(!std::isfinite(x))throw std::runtime_error("Non-finite bridge value.");return x;}
    double f64(){const auto x=scalar<double>();if(!std::isfinite(x))throw std::runtime_error("Non-finite bridge double.");return x;}
    std::vector<float> floats(size_t count){
        if(count>(bytes.size()-position)/4)throw std::runtime_error("Truncated vertex payload.");
        std::vector<float> out(count);if(count)std::memcpy(out.data(),bytes.data()+position,count*4);
        if(std::any_of(out.begin(),out.end(),[](float x){return !std::isfinite(x);}))throw std::runtime_error("Non-finite bridge value.");
        position+=count*4;return out;
    }
    std::vector<uint32_t> indices(size_t count){
        if(count>(bytes.size()-position)/4)throw std::runtime_error("Truncated index payload.");
        std::vector<uint32_t> out(count);if(count)std::memcpy(out.data(),bytes.data()+position,count*4);position+=count*4;return out;
    }
    const uint8_t* data(size_t count){if(count>bytes.size()-position)throw std::runtime_error("Truncated texture payload.");const auto* result=bytes.data()+position;position+=count;return result;}
    void finish(){if(position!=bytes.size())throw std::runtime_error("Unexpected trailing bridge data.");}
};
class Pipe {
    HANDLE input;
    std::vector<uint8_t> pending;
public:
    // Non-owning handle; permits CPU tests of the actual fragmented pipe ingress.
    explicit Pipe(HANDLE source=GetStdHandle(STD_INPUT_HANDLE)):input(source){}
    bool eof=false;
    unsigned appliedPackets=0;
    size_t bufferedBytes()const{return pending.size();}
    void poll(const std::function<void(uint32_t,uint32_t,const std::vector<uint8_t>&)>& receive) {
        // A Windows pipe may expose only a small piece of a large packet at a
        // time. Drain several pieces before presenting another vsynced frame.
        // Bound both packet application and waiting so rendering remains live.
        appliedPackets=0;const auto deadline=std::chrono::steady_clock::now()+std::chrono::milliseconds(4);
        size_t consumed=0;unsigned applied=0;bool readAny=false;
        do {
            if(pending.size()-consumed>=16){
                uint32_t header[4];std::memcpy(header,pending.data()+consumed,16);
                if(header[0]!=magic||header[2]>maxPacket||header[1]<Reset||header[1]>SourceEmission)throw std::runtime_error("Invalid BND1 packet header.");
                if(pending.size()-consumed>=16ull+header[2]){
                    std::vector<uint8_t> payload(pending.begin()+static_cast<ptrdiff_t>(consumed+16),pending.begin()+static_cast<ptrdiff_t>(consumed+16+header[2]));
                    receive(header[1],header[3],payload);consumed+=16+header[2];++applied;
                    continue;
                }
            }
            DWORD available=0;
            if(!PeekNamedPipe(input,nullptr,0,nullptr,&available,nullptr)){
                const DWORD error=GetLastError();
                if(error==ERROR_BROKEN_PIPE||error==ERROR_PIPE_NOT_CONNECTED){eof=true;break;}
                throw std::runtime_error("Bridge mode requires a connected local input pipe.");
            }
            if(!available){
                if(!readAny||pending.size()==consumed)break;
                std::this_thread::yield();continue;
            }
            const size_t start=pending.size();const DWORD amount=std::min<DWORD>(available,1024u*1024u);
            if(start+amount>maxPacket+16ull+4ull*1024*1024)throw std::runtime_error("Bridge receive limit exceeded.");
            pending.resize(start+amount);DWORD read=0;
            if(!ReadFile(input,pending.data()+start,amount,&read,nullptr))throw std::runtime_error("Cannot read native bridge pipe.");
            pending.resize(start+read);readAny=true;
        }while(applied<96&&std::chrono::steady_clock::now()<deadline);
        appliedPackets=applied;if(consumed)pending.erase(pending.begin(),pending.begin()+static_cast<ptrdiff_t>(consumed));
    }
};
}
