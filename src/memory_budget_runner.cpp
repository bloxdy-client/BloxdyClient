#include "memory_budget.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
int wmain(int argc,wchar_t** argv){HANDLE job=nullptr;PROCESS_INFORMATION child{};try{
 if(argc<7||std::wstring(argv[1])!=L"--limit-gb"||std::wstring(argv[3])!=L"--status-file"||std::wstring(argv[5])!=L"--")throw std::runtime_error("Invalid runner arguments.");
 std::wstring amount=argv[2];if(amount.empty()||amount.size()>2||amount.find_first_not_of(L"0123456789")!=std::wstring::npos)throw std::runtime_error("Invalid memory budget.");const unsigned gb=static_cast<unsigned>(std::stoul(amount));job=memory_budget::create(gb);
 std::wstring command;for(int i=6;i<argc;++i){if(i>6)command+=L' ';command+=memory_budget::quote(argv[i]);}
 // The runner console is hidden by Node. Its GUI child must be visible.
 STARTUPINFOW startup=memory_budget::visibleStartup();
 if(!CreateProcessW(argv[6],command.data(),nullptr,nullptr,FALSE,CREATE_SUSPENDED|CREATE_UNICODE_ENVIRONMENT,nullptr,nullptr,&startup,&child))throw std::runtime_error("The game process could not be created.");
 if(!AssignProcessToJobObject(job,child.hProcess)){TerminateProcess(child.hProcess,1);throw std::runtime_error("RAM budget assignment failed; game was not started.");}
 const std::filesystem::path status=argv[4],temp=status.wstring()+L".tmp";std::filesystem::create_directories(status.parent_path());
 const auto writeStatus=[&](){const auto u=memory_budget::usage(job);std::ofstream out(temp,std::ios::binary|std::ios::trunc);out<<"{\"enforced\":true,\"limitGB\":"<<gb<<",\"limitBytes\":"<<memory_budget::bytes(gb)<<",\"privateCommitBytes\":"<<u.committed<<",\"workingSetBytes\":"<<u.working<<",\"peakCommitBytes\":"<<u.peak<<",\"activeProcesses\":"<<u.processes<<",\"scope\":\"Windows job committed memory; VRAM excluded\"}";out.close();if(!MoveFileExW(temp.c_str(),status.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH))throw std::runtime_error("Memory status could not be written.");};
 writeStatus();if(ResumeThread(child.hThread)==static_cast<DWORD>(-1))throw std::runtime_error("Game process could not be resumed.");CloseHandle(child.hThread);child.hThread=nullptr;std::cout<<"BUDGET_READY "<<gb<<std::endl;
 while(WaitForSingleObject(child.hProcess,1000)==WAIT_TIMEOUT)writeStatus();writeStatus();DWORD code=1;GetExitCodeProcess(child.hProcess,&code);CloseHandle(child.hProcess);CloseHandle(job);return static_cast<int>(code);
 }catch(const std::exception& error){std::cerr<<"BUDGET_ERROR "<<error.what()<<" (Windows error "<<GetLastError()<<")"<<std::endl;if(job)CloseHandle(job);if(child.hThread)CloseHandle(child.hThread);if(child.hProcess)CloseHandle(child.hProcess);return 1;}}
