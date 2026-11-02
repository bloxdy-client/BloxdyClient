#pragma once
#include <windows.h>
#include <psapi.h>
#include <string>
#include <vector>
#include <stdexcept>
#include <cstdint>
namespace memory_budget {
inline STARTUPINFOW visibleStartup() { STARTUPINFOW info{};info.cb=sizeof(info);info.dwFlags=STARTF_USESHOWWINDOW;info.wShowWindow=SW_SHOWNORMAL;return info; }
inline std::uint64_t bytes(unsigned gb) { if(gb<1||gb>32)throw std::runtime_error("Memory budget must be 1..32 GiB.");return static_cast<std::uint64_t>(gb)*1024*1024*1024; }
inline std::wstring quote(const std::wstring& value) {std::wstring out=L"\"";unsigned slashes=0;for(wchar_t c:value){if(c==L'\\'){++slashes;continue;}if(c==L'"'){out.append(slashes*2+1,L'\\');out+=c;}else{out.append(slashes,L'\\');out+=c;}slashes=0;}out.append(slashes*2,L'\\');return out+L'"';}
inline HANDLE create(unsigned gb) {HANDLE job=CreateJobObjectW(nullptr,nullptr);if(!job)throw std::runtime_error("CreateJobObject failed.");JOBOBJECT_EXTENDED_LIMIT_INFORMATION info{};info.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_JOB_MEMORY|JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;info.JobMemoryLimit=static_cast<SIZE_T>(bytes(gb));if(!SetInformationJobObject(job,JobObjectExtendedLimitInformation,&info,sizeof(info))){CloseHandle(job);throw std::runtime_error("Windows memory limit could not be enabled.");}return job;}
struct Usage {std::uint64_t committed=0,working=0,peak=0;unsigned processes=0;};
inline Usage usage(HANDLE job){Usage u;JOBOBJECT_EXTENDED_LIMIT_INFORMATION info{};if(QueryInformationJobObject(job,JobObjectExtendedLimitInformation,&info,sizeof(info),nullptr))u.peak=info.PeakJobMemoryUsed;
 std::vector<unsigned char> buffer(sizeof(JOBOBJECT_BASIC_PROCESS_ID_LIST)+sizeof(ULONG_PTR)*128);auto* ids=reinterpret_cast<JOBOBJECT_BASIC_PROCESS_ID_LIST*>(buffer.data());
 if(!QueryInformationJobObject(job,JobObjectBasicProcessIdList,ids,static_cast<DWORD>(buffer.size()),nullptr))return u;
 for(DWORD i=0;i<ids->NumberOfProcessIdsInList;++i){HANDLE process=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|PROCESS_VM_READ,FALSE,static_cast<DWORD>(ids->ProcessIdList[i]));if(!process)continue;PROCESS_MEMORY_COUNTERS_EX counters{};if(GetProcessMemoryInfo(process,reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(&counters),sizeof(counters))){u.committed+=counters.PrivateUsage;u.working+=counters.WorkingSetSize;++u.processes;}CloseHandle(process);}return u;}
}
