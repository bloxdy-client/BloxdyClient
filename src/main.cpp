#include "gl_api.hpp"
#include "shaders.hpp"
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <windows.h>
#include <wincodec.h>
#include <wrl/client.h>
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using namespace nativegl;
namespace fs = std::filesystem;
using Microsoft::WRL::ComPtr;
constexpr int shadowSize = 2048;

void require(bool condition, const std::string& message) {
    if (!condition) throw std::runtime_error(message);
}
void hresult(HRESULT result, const char* stage) {
    require(SUCCEEDED(result), std::string(stage) + " failed: " + std::to_string(result));
}
std::string quoted(const std::string& value) {
    std::string out = "\"";
    for (unsigned char c : value) {
        if (c == '\\' || c == '"') { out += '\\'; out += static_cast<char>(c); }
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c < 32) out += ' ';
        else out += static_cast<char>(c);
    }
    return out + '"';
}
std::string glString(GLenum name) {
    const auto* value = glGetString(name);
    return value ? reinterpret_cast<const char*>(value) : "unavailable";
}

struct Window {
    GLFWwindow* handle = nullptr;
    explicit Window(bool hidden,bool compact=false) {
        glfwSetErrorCallback([](int code, const char* text) {
            std::cerr << "GLFW " << code << ": " << text << '\n';
        });
        require(glfwInit() == GLFW_TRUE, "Cannot initialize GLFW.");
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
        glfwWindowHint(GLFW_VISIBLE, hidden ? GLFW_FALSE : GLFW_TRUE);
        handle = glfwCreateWindow(compact?800:1280, compact?520:800, "Bloxdy Client | Native preview", nullptr, nullptr);
        if (!handle) { glfwTerminate(); throw std::runtime_error("Cannot create a desktop OpenGL 4.3 context. Check graphics driver support."); }
        glfwMakeContextCurrent(handle);
        glfwSwapInterval(hidden ? 0 : 1);
    }
    ~Window() { if (handle) glfwDestroyWindow(handle); glfwTerminate(); }
    Window(const Window&) = delete;
    Window& operator=(const Window&) = delete;
};

GLuint program(std::initializer_list<std::pair<GLenum,const char*>> stages) {
    GLuint result = glCreateProgram();
    std::vector<GLuint> handles;
    try {
        for (const auto& [kind, source] : stages) {
            GLuint shader = glCreateShader(kind);
            handles.push_back(shader);
            glShaderSource(shader, 1, &source, nullptr);
            glCompileShader(shader);
            GLint status = 0;
            glGetShaderiv(shader, GL_COMPILE_STATUS, &status);
            if (!status) {
                GLint length = 0; glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &length);
                std::string log(static_cast<size_t>(std::max(length,1)), '\0');
                glGetShaderInfoLog(shader, length, nullptr, log.data());
                throw std::runtime_error("Native shader compilation failed: " + log);
            }
            glAttachShader(result, shader);
        }
        glLinkProgram(result);
        GLint linked = 0; glGetProgramiv(result, GL_LINK_STATUS, &linked);
        if (!linked) {
            GLint length = 0; glGetProgramiv(result, GL_INFO_LOG_LENGTH, &length);
            std::string log(static_cast<size_t>(std::max(length,1)), '\0');
            glGetProgramInfoLog(result,length,nullptr,log.data());
            throw std::runtime_error("Native program linking failed: " + log);
        }
        for (auto handle : handles) glDeleteShader(handle);
        return result;
    } catch (...) {
        for (auto handle : handles) glDeleteShader(handle);
        glDeleteProgram(result);
        throw;
    }
}
void matrix(GLuint p, const char* name, const glm::mat4& value) {
    glUniformMatrix4fv(glGetUniformLocation(p,name),1,GL_FALSE,glm::value_ptr(value));
}

struct Vertex { glm::vec3 position, normal; glm::vec2 uv; };
struct Block { glm::vec3 position; float tile; };
std::vector<Vertex> cube() {
    std::vector<Vertex> out;
    const std::array<glm::vec2,4> uv{{{0,0},{1,0},{1,1},{0,1}}};
    auto face = [&](glm::vec3 n, std::array<glm::vec3,4> points) {
        for (int i : {0,1,2,0,2,3}) out.push_back({points[static_cast<size_t>(i)],n,uv[static_cast<size_t>(i)]});
    };
    face({0,0,1}, {{{0,0,1},{1,0,1},{1,1,1},{0,1,1}}});
    face({0,0,-1}, {{{1,0,0},{0,0,0},{0,1,0},{1,1,0}}});
    face({1,0,0}, {{{1,0,1},{1,0,0},{1,1,0},{1,1,1}}});
    face({-1,0,0}, {{{0,0,0},{0,0,1},{0,1,1},{0,1,0}}});
    face({0,1,0}, {{{0,1,1},{1,1,1},{1,1,0},{0,1,0}}});
    face({0,-1,0}, {{{0,0,0},{1,0,0},{1,0,1},{0,0,1}}});
    return out;
}
int groundHeight(int x, int z) {
    const float gentle = std::sin(static_cast<float>(x)*0.18f)+std::cos(static_cast<float>(z)*0.16f);
    const int hill = std::max(0, 8-(std::abs(x+5)+std::abs(z+7))/2);
    return 1 + std::max(static_cast<int>(std::floor(gentle)), z < -2 ? hill : 0);
}
std::vector<Block> demoWorld() {
    std::vector<Block> blocks;
    for (int z=-14; z<14; ++z) for (int x=-14; x<14; ++x) {
        const int height = groundHeight(x,z);
        for (int y=0; y<=height; ++y)
            blocks.push_back({{x,y,z},static_cast<float>(y==height ? (height>4 ? 3 : 0) : 2)});
    }
    for (auto [x,z] : std::array<std::pair<int,int>,4>{{{-9,3},{8,-7},{-4,9},{10,7}}}) {
        const int base = groundHeight(x,z)+1;
        for (int y=0;y<4;++y) blocks.push_back({{x,base+y,z},6});
        for (int dy=2;dy<5;++dy) for(int dz=-2;dz<=2;++dz) for(int dx=-2;dx<=2;++dx) {
            if ((dy==4 && std::abs(dx)+std::abs(dz)>2) || (dx==0&&dz==0&&dy<4)) continue;
            blocks.push_back({{x+dx,base+dy,z+dz},7});
        }
    }
    // Original synthetic geometry; these are not meshes or textures from Bloxd.
    const int platform = groundHeight(3,3)+1;
    for(int tier=0;tier<3;++tier) for(int z=2+tier;z<7-tier;++z) for(int x=1+tier;x<6-tier;++x)
        blocks.push_back({{x,platform+tier,z},tier==2?5.0f:4.0f});
    for(int i=0;i<4;++i) for(int y=0;y<i+1;++y)
        blocks.push_back({{-3+i*2,groundHeight(-3+i*2,4)+1+y,4},5});
    return blocks;
}

GLuint makeAtlas() {
    constexpr int size = 64;
    const std::array<glm::vec3,16> colors{{
        {73,144,49},{112,80,48},{114,76,49},{132,139,146},
        {237,187,54},{65,206,217},{109,80,44},{51,124,46},
        {70,123,170},{220,231,238},{165,102,70},{169,149,122},
        {116,155,98},{107,110,120},{163,74,73},{172,178,193}}};
    std::vector<unsigned char> pixels(size*size*3);
    uint32_t seed=5929;
    for(int y=0;y<size;++y) for(int x=0;x<size;++x) {
        const int tile=(y/16)*4+x/16, localX=x%16,localY=y%16;
        seed=1664525u*seed+1013904223u;
        float noise=0.82f+static_cast<float>((seed>>24)&255)/255.0f*0.30f;
        glm::vec3 base=colors[static_cast<size_t>(tile)];
        if(tile==1 && localY>11)base=colors[0];
        if((tile==4||tile==5) && (localX==0||localY==0||localX==15||localY==15))noise*=0.68f;
        if((tile==4||tile==5) && ((localX+localY)%13==0))noise*=1.2f;
        if(tile==6 && localX%5==0)noise*=0.68f;
        for(int channel=0;channel<3;++channel)
            pixels[static_cast<size_t>((y*size+x)*3+channel)]=static_cast<unsigned char>(std::clamp(base[channel]*noise,0.0f,255.0f));
    }
    GLuint texture=0;glGenTextures(1,&texture);glBindTexture(GL_TEXTURE_2D,texture);
    glPixelStorei(GL_UNPACK_ALIGNMENT,1);
    glTexImage2D(GL_TEXTURE_2D,0,GL_RGB8,size,size,0,GL_RGB,GL_UNSIGNED_BYTE,pixels.data());
    glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
    return texture;
}

struct RenderTarget {
    GLuint fbo=0,color=0,depth=0;
    int width=0,height=0;
    ~RenderTarget(){ clear(); }
    void clear(){
        if(fbo)glDeleteFramebuffers(1,&fbo);
        if(color)glDeleteTextures(1,&color);
        if(depth)glDeleteTextures(1,&depth);
        fbo=color=depth=0;
    }
    void resize(int w,int h) {
        clear();width=w;height=h;
        glGenFramebuffers(1,&fbo);glBindFramebuffer(GL_FRAMEBUFFER,fbo);
        auto allocate=[&](GLuint& texture,GLint internal,GLenum format,GLenum type,GLenum attachment){
            glGenTextures(1,&texture);glBindTexture(GL_TEXTURE_2D,texture);
            glTexImage2D(GL_TEXTURE_2D,0,internal,w,h,0,format,type,nullptr);
            glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);
            glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
            glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);
            glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
            glFramebufferTexture2D(GL_FRAMEBUFFER,attachment,GL_TEXTURE_2D,texture,0);
        };
        allocate(color,GL_RGBA8,GL_RGBA,GL_UNSIGNED_BYTE,GL_COLOR_ATTACHMENT0);
        allocate(depth,GL_DEPTH_COMPONENT24,GL_DEPTH_COMPONENT,GL_FLOAT,GL_DEPTH_ATTACHMENT);
        glDrawBuffer(GL_COLOR_ATTACHMENT0);
        require(glCheckFramebufferStatus(GL_FRAMEBUFFER)==GL_FRAMEBUFFER_COMPLETE,"Incomplete native scene framebuffer.");
        glBindFramebuffer(GL_FRAMEBUFFER,0);
    }
    std::vector<unsigned char> pixels() const {
        glBindFramebuffer(GL_FRAMEBUFFER,fbo);glReadBuffer(GL_COLOR_ATTACHMENT0);
        std::vector<unsigned char> out(static_cast<size_t>(width)*height*4);
        glPixelStorei(GL_PACK_ALIGNMENT,1);
        glReadPixels(0,0,width,height,GL_RGBA,GL_UNSIGNED_BYTE,out.data());
        return out;
    }
};

void writePNG(const fs::path& path,int width,int height,const std::vector<unsigned char>& rgba) {
    fs::create_directories(path.parent_path());
    std::vector<unsigned char> bgra(rgba.size());
    for(int y=0;y<height;++y) for(int x=0;x<width;++x) {
        const size_t src=(static_cast<size_t>(height-1-y)*width+x)*4;
        const size_t dst=(static_cast<size_t>(y)*width+x)*4;
        bgra[dst]=rgba[src+2];bgra[dst+1]=rgba[src+1];bgra[dst+2]=rgba[src];bgra[dst+3]=255;
    }
    ComPtr<IWICImagingFactory> factory;
    hresult(CoCreateInstance(CLSID_WICImagingFactory,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&factory)),"PNG factory");
    ComPtr<IWICStream> stream;hresult(factory->CreateStream(&stream),"PNG stream");
    hresult(stream->InitializeFromFilename(path.wstring().c_str(),GENERIC_WRITE),"PNG file");
    ComPtr<IWICBitmapEncoder> encoder;hresult(factory->CreateEncoder(GUID_ContainerFormatPng,nullptr,&encoder),"PNG encoder");
    hresult(encoder->Initialize(stream.Get(),WICBitmapEncoderNoCache),"PNG initialize");
    ComPtr<IWICBitmapFrameEncode> frame;hresult(encoder->CreateNewFrame(&frame,nullptr),"PNG frame");
    hresult(frame->Initialize(nullptr),"PNG frame initialize");
    hresult(frame->SetSize(static_cast<UINT>(width),static_cast<UINT>(height)),"PNG size");
    WICPixelFormatGUID format=GUID_WICPixelFormat32bppBGRA;
    hresult(frame->SetPixelFormat(&format),"PNG pixel format");
    require(IsEqualGUID(format,GUID_WICPixelFormat32bppBGRA),"PNG encoder changed the pixel format.");
    hresult(frame->WritePixels(static_cast<UINT>(height),static_cast<UINT>(width*4),static_cast<UINT>(bgra.size()),bgra.data()),"PNG pixels");
    hresult(frame->Commit(),"PNG frame commit");hresult(encoder->Commit(),"PNG commit");
}

struct Renderer {
    GLuint vao=0,vertexBuffer=0,instanceBuffer=0,atlas=0,scene=0,shadow=0,shadowFbo=0,shadowTexture=0;
    GLsizei count=0;
    glm::vec3 sun=glm::normalize(glm::vec3(-0.6f,1.0f,0.4f));
    glm::mat4 lightMatrix{};
    bool shadows=true;
    void initialize() {
        scene=program({{GL_VERTEX_SHADER,shaders::sceneVertex},{GL_FRAGMENT_SHADER,shaders::sceneFragment}});
        shadow=program({{GL_VERTEX_SHADER,shaders::shadowVertex},{GL_FRAGMENT_SHADER,shaders::shadowFragment}});
        const auto vertices=cube();const auto blocks=demoWorld();count=static_cast<GLsizei>(blocks.size());
        glGenVertexArrays(1,&vao);glBindVertexArray(vao);
        glGenBuffers(1,&vertexBuffer);glBindBuffer(GL_ARRAY_BUFFER,vertexBuffer);
        glBufferData(GL_ARRAY_BUFFER,static_cast<GLsizeiptr>(vertices.size()*sizeof(Vertex)),vertices.data(),GL_STATIC_DRAW);
        const std::array<size_t,3> offsets{offsetof(Vertex,position),offsetof(Vertex,normal),offsetof(Vertex,uv)};
        for(GLuint i=0;i<3;++i){glEnableVertexAttribArray(i);glVertexAttribPointer(i,i==2?2:3,GL_FLOAT,GL_FALSE,sizeof(Vertex),reinterpret_cast<void*>(offsets[i]));}
        glGenBuffers(1,&instanceBuffer);glBindBuffer(GL_ARRAY_BUFFER,instanceBuffer);
        glBufferData(GL_ARRAY_BUFFER,static_cast<GLsizeiptr>(blocks.size()*sizeof(Block)),blocks.data(),GL_STATIC_DRAW);
        glEnableVertexAttribArray(3);glVertexAttribPointer(3,3,GL_FLOAT,GL_FALSE,sizeof(Block),reinterpret_cast<void*>(offsetof(Block,position)));glVertexAttribDivisor(3,1);
        glEnableVertexAttribArray(4);glVertexAttribPointer(4,1,GL_FLOAT,GL_FALSE,sizeof(Block),reinterpret_cast<void*>(offsetof(Block,tile)));glVertexAttribDivisor(4,1);
        atlas=makeAtlas();
        glGenTextures(1,&shadowTexture);glBindTexture(GL_TEXTURE_2D,shadowTexture);
        glTexImage2D(GL_TEXTURE_2D,0,GL_DEPTH_COMPONENT24,shadowSize,shadowSize,0,GL_DEPTH_COMPONENT,GL_FLOAT,nullptr);
        glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
        glGenFramebuffers(1,&shadowFbo);glBindFramebuffer(GL_FRAMEBUFFER,shadowFbo);
        glFramebufferTexture2D(GL_FRAMEBUFFER,GL_DEPTH_ATTACHMENT,GL_TEXTURE_2D,shadowTexture,0);
        glDrawBuffer(GL_NONE);glReadBuffer(GL_NONE);
        require(glCheckFramebufferStatus(GL_FRAMEBUFFER)==GL_FRAMEBUFFER_COMPLETE,"Incomplete native shadow framebuffer.");
        lightMatrix=glm::ortho(-27.0f,27.0f,-27.0f,27.0f,0.1f,90.0f)*glm::lookAt(sun*45.0f+glm::vec3(0,3,0),glm::vec3(0,3,0),glm::vec3(0,1,0));
        glEnable(GL_DEPTH_TEST);glViewport(0,0,shadowSize,shadowSize);glClear(GL_DEPTH_BUFFER_BIT);
        glUseProgram(shadow);matrix(shadow,"lightViewProjection",lightMatrix);
        glDrawArraysInstanced(GL_TRIANGLES,0,36,count);
        glBindFramebuffer(GL_FRAMEBUFFER,0);
        check("Native renderer initialization");
    }
    ~Renderer(){
        if(scene)glDeleteProgram(scene);if(shadow)glDeleteProgram(shadow);
        if(vao)glDeleteVertexArrays(1,&vao);
        if(vertexBuffer)glDeleteBuffers(1,&vertexBuffer);if(instanceBuffer)glDeleteBuffers(1,&instanceBuffer);
        if(atlas)glDeleteTextures(1,&atlas);if(shadowTexture)glDeleteTextures(1,&shadowTexture);
        if(shadowFbo)glDeleteFramebuffers(1,&shadowFbo);
    }
    void render(GLuint target,int width,int height,glm::vec3 camera,glm::vec3 direction) const {
        glBindFramebuffer(GL_FRAMEBUFFER,target);glViewport(0,0,width,height);
        glEnable(GL_DEPTH_TEST);glClearColor(0.64f,0.76f,0.86f,1.0f);glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);
        glUseProgram(scene);glBindVertexArray(vao);
        const auto projection=glm::perspective(glm::radians(58.0f),static_cast<float>(width)/height,0.1f,150.0f);
        const auto view=glm::lookAt(camera,camera+direction,glm::vec3(0,1,0));
        matrix(scene,"viewProjection",projection*view);matrix(scene,"lightViewProjection",lightMatrix);
        glUniform3fv(glGetUniformLocation(scene,"sunDirection"),1,glm::value_ptr(sun));
        glUniform3fv(glGetUniformLocation(scene,"cameraPosition"),1,glm::value_ptr(camera));
        glUniform1i(glGetUniformLocation(scene,"shadowsEnabled"),shadows?1:0);
        glActiveTexture(GL_TEXTURE0);glBindTexture(GL_TEXTURE_2D,atlas);glUniform1i(glGetUniformLocation(scene,"albedoAtlas"),0);
        glActiveTexture(GL_TEXTURE1);glBindTexture(GL_TEXTURE_2D,shadowTexture);glUniform1i(glGetUniformLocation(scene,"shadowDepth"),1);
        glDrawArraysInstanced(GL_TRIANGLES,0,36,count);
    }
};

struct Camera {
    glm::vec3 position{24,19,29};
    float yaw=0,pitch=0;
    void reset(){
        position={24,19,29};const auto d=glm::normalize(glm::vec3(0,3,0)-position);
        yaw=std::atan2(d.z,d.x);pitch=std::asin(d.y);
    }
    glm::vec3 direction() const {return {std::cos(pitch)*std::cos(yaw),std::sin(pitch),std::cos(pitch)*std::sin(yaw)};}
};

void capabilities(const fs::path& output) {
    GLint major=0,minor=0,texture=0,attachments=0,storage=0;
    glGetIntegerv(GL_MAJOR_VERSION,&major);glGetIntegerv(GL_MINOR_VERSION,&minor);
    glGetIntegerv(GL_MAX_TEXTURE_SIZE,&texture);glGetIntegerv(GL_MAX_COLOR_ATTACHMENTS,&attachments);
    glGetIntegerv(GL_MAX_SHADER_STORAGE_BUFFER_BINDINGS,&storage);
    require(major>4||(major==4&&minor>=3),"Desktop OpenGL 4.3 is required.");
    std::ofstream f(output/"capabilities.json");
    require(f.good(),"Cannot write native capability report.");
    f<<"{\n  \"prototypeVersion\": \"0.1.0\",\n  \"nativeDesktopOpenGL\": true,\n"
     <<"  \"vendor\": "<<quoted(glString(GL_VENDOR))<<",\n  \"renderer\": "<<quoted(glString(GL_RENDERER))
     <<",\n  \"openGLVersion\": "<<quoted(glString(GL_VERSION))<<",\n  \"glslVersion\": "<<quoted(glString(GL_SHADING_LANGUAGE_VERSION))
     <<",\n  \"maxTextureSize\": "<<texture<<",\n  \"maxColorAttachments\": "<<attachments
     <<",\n  \"maxShaderStorageBufferBindings\": "<<storage<<",\n  \"bloxdConnected\": false,\n  \"minecraftShaderpackLoaded\": false\n}\n";
    std::cout<<glString(GL_RENDERER)<<" | "<<glString(GL_VERSION)<<'\n';
}

void selfTest(Renderer& renderer,const fs::path& output) {
    Camera camera;camera.reset();RenderTarget target;target.resize(1280,800);
    renderer.render(target.fbo,target.width,target.height,camera.position,camera.direction());glFinish();
    auto first=target.pixels();
    std::vector<float> depth(static_cast<size_t>(target.width)*target.height);
    glReadPixels(0,0,target.width,target.height,GL_DEPTH_COMPONENT,GL_FLOAT,depth.data());
    size_t geometry=0;for(float d:depth){require(std::isfinite(d)&&d>=0.0f&&d<=1.0f,"Invalid depth output.");if(d<0.99999f)++geometry;}
    require(geometry>50000&&geometry<depth.size(),"Native geometry/sky coverage test failed.");
    writePNG(output/"native-demo.png",target.width,target.height,first);
    renderer.render(target.fbo,target.width,target.height,camera.position+glm::vec3(3,0,0),camera.direction());glFinish();
    const auto moved=target.pixels();size_t changed=0;
    for(size_t i=0;i<first.size();i+=4)if(first[i]!=moved[i]||first[i+1]!=moved[i+1]||first[i+2]!=moved[i+2])++changed;
    require(changed>10000,"Camera movement did not change the rendered scene.");
    renderer.shadows=false;renderer.render(target.fbo,target.width,target.height,camera.position,camera.direction());glFinish();
    const auto unshadowed=target.pixels();size_t shadowChanged=0;
    for(size_t i=0;i<first.size();i+=4)if(first[i]!=unshadowed[i]||first[i+1]!=unshadowed[i+1]||first[i+2]!=unshadowed[i+2])++shadowChanged;
    require(shadowChanged>500,"Native shadow pass did not change pixels.");renderer.shadows=true;
    target.resize(640,360);renderer.render(target.fbo,target.width,target.height,camera.position,camera.direction());glFinish();
    writePNG(output/"native-demo-resized.png",target.width,target.height,target.pixels());
    const GLuint compute=program({{GL_COMPUTE_SHADER,shaders::compute}});
    GLuint buffer=0;glGenBuffers(1,&buffer);glBindBuffer(GL_SHADER_STORAGE_BUFFER,buffer);
    uint32_t value=0;glBufferData(GL_SHADER_STORAGE_BUFFER,sizeof(value),&value,GL_DYNAMIC_READ);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER,0,buffer);glUseProgram(compute);glDispatchCompute(1,1,1);
    glMemoryBarrier(GL_BUFFER_UPDATE_BARRIER_BIT);glGetBufferSubData(GL_SHADER_STORAGE_BUFFER,0,sizeof(value),&value);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER,0,0);glDeleteBuffers(1,&buffer);glDeleteProgram(compute);
    require(value==42,"Native compute shader / SSBO execution failed.");
    std::vector<double> timings;
    for(int i=0;i<35;++i){const auto start=std::chrono::steady_clock::now();renderer.render(target.fbo,target.width,target.height,camera.position,camera.direction());glFinish();if(i>=5)timings.push_back(std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count());}
    std::sort(timings.begin(),timings.end());check("Native GPU smoke tests");
    std::ofstream f(output/"verification.json");require(f.good(),"Cannot write verification report.");
    f<<"{\n  \"passed\": true,\n  \"geometryPixels\": "<<geometry<<",\n  \"cameraChangedPixels\": "<<changed
     <<",\n  \"shadowChangedPixels\": "<<shadowChanged<<",\n  \"resizePassed\": true,\n  \"computeResult\": "<<value
     <<",\n  \"glErrors\": 0,\n  \"blockInstances\": "<<renderer.count
     <<",\n  \"renderWallMsMedian640x360WithFinish\": "<<timings[timings.size()/2]
     <<",\n  \"timingScope\": \"synthetic scene; includes CPU and GPU completion; excludes presentation and Bloxd\",\n"
     <<"  \"bloxdConnected\": false,\n  \"minecraftShaderpackLoaded\": false\n}\n";
    std::cout<<"PASS: geometry, depth, camera, shadows, resize, native compute/SSBO; zero OpenGL errors.\n";
}

void interactive(Renderer& renderer,GLFWwindow* window,const fs::path& output) {
    Camera camera;camera.reset();double last=glfwGetTime(),titleAt=last,lastX=0,lastY=0;int frames=0;bool dragging=false,f9Was=false,tWas=false;
    while(!glfwWindowShouldClose(window)) {
        glfwPollEvents();const double now=glfwGetTime();const float delta=static_cast<float>(std::min(now-last,0.05));last=now;
        if(glfwGetKey(window,GLFW_KEY_ESCAPE)==GLFW_PRESS)glfwSetWindowShouldClose(window,GLFW_TRUE);
        if(glfwGetKey(window,GLFW_KEY_R)==GLFW_PRESS)camera.reset();
        const bool mouse=glfwGetMouseButton(window,GLFW_MOUSE_BUTTON_RIGHT)==GLFW_PRESS&&glfwGetWindowAttrib(window,GLFW_FOCUSED);
        if(mouse!=dragging){dragging=mouse;glfwSetInputMode(window,GLFW_CURSOR,mouse?GLFW_CURSOR_DISABLED:GLFW_CURSOR_NORMAL);glfwGetCursorPos(window,&lastX,&lastY);}
        double x=0,y=0;glfwGetCursorPos(window,&x,&y);
        if(dragging){camera.yaw+=static_cast<float>(x-lastX)*0.003f;camera.pitch=std::clamp(camera.pitch-static_cast<float>(y-lastY)*0.003f,-1.5f,1.5f);}lastX=x;lastY=y;
        const bool focused=glfwGetWindowAttrib(window,GLFW_FOCUSED)!=0;
        if(focused){
            const auto forward=camera.direction(),right=glm::normalize(glm::cross(forward,glm::vec3(0,1,0)));glm::vec3 move(0);
            if(glfwGetKey(window,GLFW_KEY_W)==GLFW_PRESS)move+=forward;if(glfwGetKey(window,GLFW_KEY_S)==GLFW_PRESS)move-=forward;
            if(glfwGetKey(window,GLFW_KEY_D)==GLFW_PRESS)move+=right;if(glfwGetKey(window,GLFW_KEY_A)==GLFW_PRESS)move-=right;
            if(glfwGetKey(window,GLFW_KEY_SPACE)==GLFW_PRESS)move.y+=1;if(glfwGetKey(window,GLFW_KEY_LEFT_CONTROL)==GLFW_PRESS)move.y-=1;
            if(glm::dot(move,move)>0)camera.position+=glm::normalize(move)*delta*(glfwGetKey(window,GLFW_KEY_LEFT_SHIFT)==GLFW_PRESS?20.0f:8.0f);
        }
        const bool t=glfwGetKey(window,GLFW_KEY_T)==GLFW_PRESS;if(t&&!tWas)renderer.shadows=!renderer.shadows;tWas=t;
        int width=0,height=0;glfwGetFramebufferSize(window,&width,&height);
        if(width<1||height<1){glfwWaitEventsTimeout(0.1);last=glfwGetTime();continue;}
        renderer.render(0,width,height,camera.position,camera.direction());
        const bool f9=glfwGetKey(window,GLFW_KEY_F9)==GLFW_PRESS;
        if(f9&&!f9Was){std::vector<unsigned char> pixels(static_cast<size_t>(width)*height*4);glReadBuffer(GL_BACK);glReadPixels(0,0,width,height,GL_RGBA,GL_UNSIGNED_BYTE,pixels.data());writePNG(output/"screenshot.png",width,height,pixels);}f9Was=f9;
        check("Interactive frame");glfwSwapBuffers(window);++frames;
        if(now-titleAt>=0.5){
            std::ostringstream title;title<<"Bloxdy Client | TEST SCENE | "<<static_cast<int>(frames/(now-titleAt))<<" FPS | WASD + rechte Maus | Space/Ctrl | R Reset | T Schatten | F9 PNG | Esc";
            glfwSetWindowTitle(window,title.str().c_str());frames=0;titleAt=now;
        }
    }
}

#include "bridge_renderer.hpp"

int main(int argc,char** argv) {
    bool test=false,bridgeMode=false,hidden=false;fs::path output="outputs";std::string frameEndpoint;
    try {
        for(int i=1;i<argc;++i){const std::string arg=argv[i];if(arg=="--self-test")test=true;else if(arg=="--bridge")bridgeMode=true;else if(arg=="--hidden")hidden=true;else if(arg=="--frame-pipe"&&i+1<argc)frameEndpoint=argv[++i];else if(arg=="--output"&&i+1<argc)output=argv[++i];else throw std::runtime_error("Usage: BloxdNative [--self-test | --bridge] [--hidden] [--frame-pipe endpoint] [--output directory]");}
        if(!frameEndpoint.empty()){require(bridgeMode&&!test&&frameEndpoint.starts_with(R"(\\.\pipe\bloxdy-frame-)"),"Invalid native presentation endpoint.");hidden=true;}
        fs::create_directories(output);
        std::ofstream startup(output/"startup.log");
        auto stage=[&](const char* message){startup<<message<<std::endl;std::cout<<message<<std::endl;};
        stage("Native process entered main");
        hresult(CoInitializeEx(nullptr,COINIT_MULTITHREADED),"COM initialization");
        stage("COM initialized");
        {
            Window window(test||hidden,bridgeMode&&!hidden);stage("Desktop OpenGL context created");
            nativegl::load();capabilities(output);stage("OpenGL capabilities recorded");
            if(bridgeMode)bridge::run(window.handle,output,frameEndpoint);
            else {Renderer renderer;renderer.initialize();stage("Synthetic scene and shadow programs initialized");
                if(test)selfTest(renderer,output);else interactive(renderer,window.handle,output);}
        }
        CoUninitialize();return 0;
    }catch(const std::exception& error){
        std::cerr<<error.what()<<'\n';
        std::error_code ignored;fs::create_directories(output,ignored);
        std::ofstream(output/"last-error.txt")<<error.what()<<'\n';
        if(test)std::ofstream(output/"verification.json")<<"{\"passed\":false,\"error\":"<<quoted(error.what())<<"}\n";
        else if(!hidden) MessageBoxA(nullptr,error.what(),"Bloxdy Client: Startup error",MB_OK|MB_ICONERROR);
        return 1;
    }
}
