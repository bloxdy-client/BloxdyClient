// CPU/Windows allocation contract only: no client, window, network or account.
#include "memory_budget.hpp"
#include <iostream>
int main(){try{const auto startup=memory_budget::visibleStartup();if(startup.cb!=sizeof(STARTUPINFOW)||!(startup.dwFlags&STARTF_USESHOWWINDOW)||startup.wShowWindow!=SW_SHOWNORMAL)return 8;if(memory_budget::bytes(32)!=34359738368ULL)return 1;for(unsigned bad:{0u,33u}){bool rejected=false;try{memory_budget::bytes(bad);}catch(...){rejected=true;}if(!rejected)return 2;}
 if(memory_budget::quote(L"C:\\path with spaces\\")!=L"\"C:\\path with spaces\\\\\"")return 3;
 HANDLE job=memory_budget::create(1);JOBOBJECT_EXTENDED_LIMIT_INFORMATION info{};if(!QueryInformationJobObject(job,JobObjectExtendedLimitInformation,&info,sizeof(info),nullptr)||info.JobMemoryLimit!=memory_budget::bytes(1))return 4;
 if(!AssignProcessToJobObject(job,GetCurrentProcess()))return 5;void* small=VirtualAlloc(nullptr,65536,MEM_RESERVE|MEM_COMMIT,PAGE_READWRITE);if(!small)return 6;
 void* excessive=VirtualAlloc(nullptr,static_cast<SIZE_T>(memory_budget::bytes(2)),MEM_RESERVE|MEM_COMMIT,PAGE_READWRITE);if(excessive){VirtualFree(excessive,0,MEM_RELEASE);return 7;}VirtualFree(small,0,MEM_RELEASE);
 // Clear kill-on-close before releasing this test's own job handle.
 info.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_JOB_MEMORY;SetInformationJobObject(job,JobObjectExtendedLimitInformation,&info,sizeof(info));CloseHandle(job);std::cout<<"PASS: visible GUI startup, range, quoting, kernel memory budget and rejected over-budget allocation; no client started.\n";return 0;
 }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
