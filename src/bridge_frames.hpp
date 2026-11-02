#pragma once
#include <deque>

namespace bridge {
inline std::array<uint32_t,9> frameHeader(uint32_t sequence,uint32_t epoch,uint32_t width,uint32_t height,uint32_t revision=1){
    if(!width||!height||width>8192||height>8192||static_cast<uint64_t>(width)*height>16ull*1024*1024)throw std::runtime_error("Native presentation frame exceeds its limit.");
    if(!revision)throw std::runtime_error("Native presentation revision is zero.");
    return {0x31464e42,2,sequence,epoch,width,height,width*height*4,1,revision};
}
class FramePipe {
    std::string name;HANDLE handle=INVALID_HANDLE_VALUE,event=nullptr;OVERLAPPED operation{};
    std::vector<uint8_t> pending;bool writing=false;
public:
    uint64_t sent=0,dropped=0;
    explicit FramePipe(std::string endpoint):name(std::move(endpoint)){}
    ~FramePipe(){if(handle!=INVALID_HANDLE_VALUE){CancelIoEx(handle,nullptr);if(writing)GetOverlappedResult(handle,&operation,&completedBytes,TRUE);CloseHandle(handle);}if(event)CloseHandle(event);}
    DWORD completedBytes=0;
    bool ready(){
        if(name.empty())return false;
        if(writing){DWORD done=0;if(!GetOverlappedResult(handle,&operation,&done,FALSE)){if(GetLastError()==ERROR_IO_INCOMPLETE)return false;throw std::runtime_error("Native frame pipe write failed.");}
            if(done!=pending.size())throw std::runtime_error("Native frame pipe write was truncated.");writing=false;pending.clear();++sent;}
        if(handle==INVALID_HANDLE_VALUE){
            handle=CreateFileA(name.c_str(),GENERIC_WRITE,0,nullptr,OPEN_EXISTING,FILE_FLAG_OVERLAPPED,nullptr);
            if(handle==INVALID_HANDLE_VALUE){if(GetLastError()==ERROR_PIPE_BUSY||GetLastError()==ERROR_FILE_NOT_FOUND)return false;throw std::runtime_error("Cannot open native frame pipe.");}
            event=CreateEventW(nullptr,TRUE,FALSE,nullptr);if(!event)throw std::runtime_error("Cannot create native frame completion event.");
        }return true;
    }
    void write(uint32_t sequence,uint32_t epoch,uint32_t width,uint32_t height,const std::vector<uint8_t>& pixels,uint32_t revision=1){
        if(!ready()){++dropped;return;}const auto header=frameHeader(sequence,epoch,width,height,revision);
        if(pixels.size()!=header[6])throw std::runtime_error("Native frame byte count differs.");
        pending.resize(sizeof(header)+pixels.size());std::memcpy(pending.data(),header.data(),sizeof(header));std::memcpy(pending.data()+sizeof(header),pixels.data(),pixels.size());
        operation={};operation.hEvent=event;ResetEvent(event);DWORD done=0;
        if(WriteFile(handle,pending.data(),static_cast<DWORD>(pending.size()),&done,&operation)){if(done!=pending.size())throw std::runtime_error("Native frame pipe write was truncated.");pending.clear();++sent;}
        else if(GetLastError()==ERROR_IO_PENDING)writing=true;else throw std::runtime_error("Native frame pipe write failed.");
    }
};
struct FrameReadback {
    struct Job {GLuint buffer=0;GLsync fence=nullptr;uint32_t sequence=0,epoch=0,width=0,height=0,revision=1;};
    std::deque<Job> jobs;uint32_t sequence=0;double capturedAt=-1;uint64_t dropped=0;
    ~FrameReadback(){clear();}
    void release(Job& job){if(job.fence)nativegl::glDeleteSync(job.fence);if(job.buffer)nativegl::glDeleteBuffers(1,&job.buffer);}
    void clear(){for(auto& job:jobs)release(job);jobs.clear();}
    void poll(FramePipe& pipe,uint32_t epoch,uint32_t revision=1){
        while(!jobs.empty()){
            auto job=jobs.front();if(job.epoch!=epoch||job.revision!=revision){release(job);jobs.pop_front();continue;}
            const auto ready=nativegl::glClientWaitSync(job.fence,0,0);if(ready==GL_TIMEOUT_EXPIRED)return;
            jobs.pop_front();
            if(ready==GL_WAIT_FAILED){release(job);throw std::runtime_error("Native frame readback fence failed.");}
            try{if(pipe.ready()){
                std::vector<uint8_t> pixels(static_cast<size_t>(job.width)*job.height*4);
                nativegl::glBindBuffer(GL_PIXEL_PACK_BUFFER,job.buffer);nativegl::glGetBufferSubData(GL_PIXEL_PACK_BUFFER,0,static_cast<GLsizeiptr>(pixels.size()),pixels.data());nativegl::glBindBuffer(GL_PIXEL_PACK_BUFFER,0);
                pipe.write(job.sequence,job.epoch,job.width,job.height,pixels,job.revision);
            }else ++dropped;}catch(...){release(job);throw;}release(job);
        }
    }
    void capture(GLuint framebuffer,uint32_t epoch,uint32_t width,uint32_t height,double seconds,uint32_t revision=1){
        if(seconds-capturedAt<1.0/60)return;capturedAt=seconds;
        if(jobs.size()>=3){++dropped;return;}const auto header=frameHeader(++sequence,epoch,width,height,revision);Job job;job.sequence=sequence;job.epoch=epoch;job.width=width;job.height=height;job.revision=revision;
        nativegl::glGenBuffers(1,&job.buffer);nativegl::glBindBuffer(GL_PIXEL_PACK_BUFFER,job.buffer);nativegl::glBufferData(GL_PIXEL_PACK_BUFFER,header[6],nullptr,GL_STREAM_READ);
        nativegl::glBindFramebuffer(GL_READ_FRAMEBUFFER,framebuffer);nativegl::glReadBuffer(GL_COLOR_ATTACHMENT0);nativegl::glPixelStorei(GL_PACK_ALIGNMENT,1);
        nativegl::glReadPixels(0,0,width,height,GL_RGBA,GL_UNSIGNED_BYTE,nullptr);
        job.fence=nativegl::glFenceSync(GL_SYNC_GPU_COMMANDS_COMPLETE,0);nativegl::glBindBuffer(GL_PIXEL_PACK_BUFFER,0);
        if(!job.fence){release(job);throw std::runtime_error("Cannot create native frame readback fence.");}nativegl::glFlush();jobs.push_back(job);
    }
};
}
