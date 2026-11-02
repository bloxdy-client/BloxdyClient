// Pure CPU contract tests. No GLFW initialization, window, graphics context,
// client process, network connection or account access occurs in this program.
#include "gl_api.hpp"
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <algorithm>
#include <array>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <initializer_list>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <unordered_map>
namespace fs=std::filesystem;
GLuint program(std::initializer_list<std::pair<GLenum,const char*>>){static GLuint id=10000;return id++;}
void writePNG(const fs::path&,int,int,const std::vector<unsigned char>&){}
#include "bridge_renderer.hpp"

namespace mock {
GLuint next=1,active=GL_TEXTURE0;unsigned draws=0;GLint textureKind=-1;
GLuint drawFramebuffer=0,readFramebuffer=0,currentProgram=0,currentVao=0;
unsigned composites=0,depthCopies=0;GLenum framebufferStatus=GL_FRAMEBUFFER_COMPLETE;
std::unordered_map<GLuint,std::vector<GLenum>> drawAttachments;
std::unordered_map<GLuint,std::unordered_map<GLenum,GLuint>> framebufferTextures;
std::vector<GLuint> geometryFramebuffers,compositeFramebuffers;
glm::mat4 currentView{1},currentProjection{1},currentInverseView{1};glm::vec3 currentCamera{0};
glm::mat4 currentWorld{1},motionWorld{1},motionViewProjection{1};int motionValid=0,motionPosed=0;
GLenum pendingError=GL_NO_ERROR;bool failComposite=false;
bool failHistoryCopy=false;int framebufferChecksBeforeFailure=-1;
int fullscreenDrawsBeforeFailure=-1;
struct Image {GLint format;int width,height;uint64_t stamp=0;};
struct Blit {GLuint source,target;GLbitfield mask;size_t draws;};
std::unordered_map<GLuint,Image> images;std::unordered_map<GLuint,GLenum> readAttachments;
std::vector<Blit> blits;std::vector<GLuint> deletedTextures,deletedFramebuffers;
unsigned textureAllocations=0,integerQueries=0;
std::unordered_map<GLuint,GLuint> storageBindings;std::vector<GLuint> deletedBuffers;
int currentParticleMode=0,currentRampEnabled=0,currentMultiply=0;glm::vec4 currentParticleMask{1};std::vector<GLuint> uploadedBuffers;
struct Draw {GLuint framebuffer;size_t attachments;bool depthWrite,cull,blend;GLenum winding,cullFace,depthFunction;GLuint vao;glm::mat4 view,projection,inverseView;glm::vec3 camera;int shadow,particleMode;glm::vec4 particleMask;int rampEnabled,multiply;GLuint ramp;std::array<GLenum,4> factors;int motionValid,motionPosed;glm::mat4 world,previousWorld,previousViewProjection;GLuint previousPose;};
std::vector<Draw> geometryDraws;bool depthWrite=true;
std::vector<size_t> depthClearDraws,depthCopyDraws;
std::vector<GLuint> depthClearTargets;
bool cull=false,blend=false;GLenum winding=GL_CCW,cullFace=GL_BACK,depthFunction=GL_LESS;
std::array<GLenum,4> blendFactors{};
std::unordered_map<GLuint,std::unordered_map<GLenum,GLint>> textureParameters;
int shadowPass=0;
std::unordered_map<GLuint,GLuint> bound;
std::unordered_map<GLuint,std::vector<uint8_t>> masks;
std::unordered_map<GLenum,GLuint> bufferBindings;
std::unordered_map<GLuint,std::vector<uint8_t>> bufferBytes;
std::unordered_map<GLsync,bool> fences;unsigned gpuCopies=0;
struct Upload {GLuint texture;GLint x,y;GLsizei width,height;std::vector<uint8_t> pixels;};
std::vector<Upload> atlasUploads;
std::vector<GLuint> mipmapTextures;
struct ColorClear {GLuint texture;GLenum kind;glm::dvec4 value;};
std::vector<ColorClear> colorClears;
struct FullscreenDraw {GLuint framebuffer,program;std::vector<GLuint> outputs;GLuint input;int width,height;};
std::vector<FullscreenDraw> fullscreenDraws;int viewportWidth=0,viewportHeight=0;
void geometryDraw(){if(shadowPass)for(const auto& [attachment,texture]:framebufferTextures[drawFramebuffer])if(texture==bound[GL_TEXTURE5])throw std::runtime_error("Shadow pass samples its target depth texture.");++draws;geometryFramebuffers.push_back(drawFramebuffer);geometryDraws.push_back({drawFramebuffer,drawAttachments[drawFramebuffer].size(),depthWrite,cull,blend,winding,cullFace,depthFunction,currentVao,currentView,currentProjection,currentInverseView,currentCamera,shadowPass,currentParticleMode,currentParticleMask,currentRampEnabled,currentMultiply,bound[GL_TEXTURE7],blendFactors,motionValid,motionPosed,currentWorld,motionWorld,motionViewProjection,storageBindings[4]});for(auto attachment:drawAttachments[drawFramebuffer])if(attachment!=GL_NONE)images[framebufferTextures[drawFramebuffer][attachment]].stamp=geometryDraws.size();if(depthWrite)images[framebufferTextures[drawFramebuffer][GL_DEPTH_ATTACHMENT]].stamp=geometryDraws.size();}
void initialize(){
    auto gen=[](GLsizei count,GLuint* ids){for(int i=0;i<count;++i)ids[i]=next++;};
    auto remove=[](GLsizei,const GLuint*){};
    nativegl::glGenTextures=gen;nativegl::glGenBuffers=gen;nativegl::glGenVertexArrays=gen;nativegl::glGenFramebuffers=gen;
    nativegl::glDeleteTextures=remove;nativegl::glDeleteBuffers=remove;nativegl::glDeleteVertexArrays=remove;nativegl::glDeleteFramebuffers=remove;
    nativegl::glDeleteBuffers=[](GLsizei count,const GLuint* ids){deletedBuffers.insert(deletedBuffers.end(),ids,ids+count);};
    nativegl::glDeleteTextures=[](GLsizei count,const GLuint* ids){deletedTextures.insert(deletedTextures.end(),ids,ids+count);};
    nativegl::glDeleteFramebuffers=[](GLsizei count,const GLuint* ids){deletedFramebuffers.insert(deletedFramebuffers.end(),ids,ids+count);};
    nativegl::glDeleteProgram=[](GLuint){};nativegl::glUseProgram=[](GLuint p){currentProgram=p;};
    nativegl::glGetUniformLocation=[](GLuint,const GLchar* name)->GLint{const std::string key=name;return key=="textureKind"?7:key=="renderShadow"?8:key=="view"?10:key=="projection"?11:key=="inverseView"?12:key=="cameraPosition"?13:key=="particleMode"?14:key=="particleMask"?15:key=="particleRampEnabled"?16:key=="particleMultiply"?17:key=="motionPreviousWorld"?18:key=="motionPreviousViewProjection"?19:key=="motionValid"?20:key=="motionPosed"?21:key=="world"?22:1;};
    nativegl::glUniform1i=[](GLint location,GLint value){if(location==7)textureKind=value;if(location==8)shadowPass=value;if(location==14)currentParticleMode=value;if(location==16)currentRampEnabled=value;if(location==17)currentMultiply=value;if(location==20)motionValid=value;if(location==21)motionPosed=value;};
    nativegl::glUniformMatrix4fv=[](GLint location,GLsizei,GLboolean,const GLfloat* data){if(location==10)currentView=glm::make_mat4(data);if(location==11)currentProjection=glm::make_mat4(data);if(location==12)currentInverseView=glm::make_mat4(data);if(location==18)motionWorld=glm::make_mat4(data);if(location==19)motionViewProjection=glm::make_mat4(data);if(location==22)currentWorld=glm::make_mat4(data);};
    nativegl::glUniform1f=[](GLint,GLfloat){};nativegl::glUniform3fv=[](GLint location,GLsizei,const GLfloat* data){if(location==13)currentCamera=glm::make_vec3(data);};
    nativegl::glUniform4fv=[](GLint location,GLsizei,const GLfloat* data){if(location==15)currentParticleMask=glm::make_vec4(data);};nativegl::glBindBufferBase=[](GLenum kind,GLuint slot,GLuint buffer){if(kind==GL_SHADER_STORAGE_BUFFER)storageBindings[slot]=buffer;};
    nativegl::glUniform2i=[](GLint,GLint,GLint){};
    nativegl::glUniformMatrix3fv=[](GLint,GLsizei,GLboolean,const GLfloat*){};
    nativegl::glDisableVertexAttribArray=[](GLuint){};
    nativegl::glActiveTexture=[](GLenum unit){active=unit;};nativegl::glBindTexture=[](GLenum,GLuint texture){bound[active]=texture;};
    nativegl::glTexImage2D=[](GLenum,GLint,GLint internal,GLsizei w,GLsizei h,GLint,GLenum format,GLenum,const void* data){++textureAllocations;images[bound[active]]={internal,w,h};if(data&&format==GL_RED){const auto* bytes=static_cast<const uint8_t*>(data);masks[bound[active]]=std::vector<uint8_t>(bytes,bytes+w*h);}};
    nativegl::glTexSubImage2D=[](GLenum kind,GLint,GLint x,GLint y,GLsizei w,GLsizei h,GLenum format,GLenum,const void* data){const auto* bytes=static_cast<const uint8_t*>(data);if(format==GL_RED){auto& mask=masks.at(bound[active]);if(x<0||static_cast<size_t>(x+w)>mask.size())throw std::runtime_error("Mask upload outside texture.");std::copy(bytes,bytes+w,mask.begin()+x);}else if(kind==GL_TEXTURE_2D&&format==GL_RGBA)atlasUploads.push_back({bound[active],x,y,w,h,std::vector<uint8_t>(bytes,bytes+static_cast<size_t>(w)*h*4)});};
    nativegl::glTexImage3D=[](GLenum,GLint,GLint,GLsizei,GLsizei,GLsizei,GLint,GLenum,GLenum,const void*){};
    nativegl::glTexSubImage3D=[](GLenum,GLint,GLint,GLint,GLint,GLsizei,GLsizei,GLsizei,GLenum,GLenum,const void*){};
    nativegl::glTexParameteri=[](GLenum,GLenum parameter,GLint value){textureParameters[bound[active]][parameter]=value;};nativegl::glPixelStorei=[](GLenum,GLint){};
    nativegl::glGenerateMipmap=[](GLenum){mipmapTextures.push_back(bound[active]);};
    nativegl::glBindVertexArray=[](GLuint vao){currentVao=vao;};nativegl::glBindBuffer=[](GLenum target,GLuint id){bufferBindings[target]=id;};
    nativegl::glBufferData=[](GLenum kind,GLsizeiptr size,const void* data,GLenum){uploadedBuffers.push_back(bufferBindings[kind]);if(kind==GL_PIXEL_PACK_BUFFER||kind==GL_SHADER_STORAGE_BUFFER){auto& bytes=bufferBytes[bufferBindings[kind]];bytes.resize(static_cast<size_t>(size));if(data&&size)std::memcpy(bytes.data(),data,static_cast<size_t>(size));}};nativegl::glBufferSubData=[](GLenum,GLintptr,GLsizeiptr,const void*){};
    nativegl::glGetBufferSubData=[](GLenum kind,GLintptr,GLsizeiptr size,void* data){++gpuCopies;const auto& bytes=bufferBytes.at(bufferBindings[kind]);if(size>static_cast<GLsizeiptr>(bytes.size()))throw std::runtime_error("Readback outside PBO.");std::memcpy(data,bytes.data(),static_cast<size_t>(size));};
    nativegl::glReadPixels=[](GLint,GLint,GLsizei w,GLsizei h,GLenum,GLenum,void* data){if(data||!bufferBindings[GL_PIXEL_PACK_BUFFER])throw std::runtime_error("Frame readback did not use a PBO.");auto& bytes=bufferBytes.at(bufferBindings[GL_PIXEL_PACK_BUFFER]);if(bytes.size()!=static_cast<size_t>(w)*h*4)throw std::runtime_error("Frame PBO size differs.");std::fill(bytes.begin(),bytes.end(),static_cast<uint8_t>(127));};
    nativegl::glFenceSync=[](GLenum,GLbitfield)->GLsync{auto fence=reinterpret_cast<GLsync>(static_cast<uintptr_t>(next++));fences[fence]=false;return fence;};
    nativegl::glClientWaitSync=[](GLsync fence,GLbitfield,GLuint64 timeout)->GLenum{if(timeout)throw std::runtime_error("Frame fence wait blocks.");return fences.at(fence)?GL_ALREADY_SIGNALED:GL_TIMEOUT_EXPIRED;};
    nativegl::glDeleteSync=[](GLsync fence){fences.erase(fence);};nativegl::glFlush=[](){};
    nativegl::glEnableVertexAttribArray=[](GLuint){};nativegl::glVertexAttribPointer=[](GLuint,GLint,GLenum,GLboolean,GLsizei,const void*){};nativegl::glVertexAttribIPointer=[](GLuint,GLint,GLenum,GLsizei,const void*){};nativegl::glVertexAttribDivisor=[](GLuint,GLuint){};
    nativegl::glDrawElements=[](GLenum,GLsizei,GLenum,const void*){geometryDraw();};nativegl::glDrawElementsInstanced=[](GLenum,GLsizei,GLenum,const void*,GLsizei count){if(count)geometryDraw();};
    nativegl::glDrawArrays=[](GLenum,GLint,GLsizei count){if(count!=3||cull||blend)throw std::runtime_error("Composite inherited geometry culling/blending.");for(const auto& [attachment,texture]:framebufferTextures[drawFramebuffer])if(texture&&texture==bound[GL_TEXTURE3])throw std::runtime_error("Composite framebuffer feedback.");++composites;compositeFramebuffers.push_back(drawFramebuffer);FullscreenDraw draw{drawFramebuffer,currentProgram,{},bound[GL_TEXTURE3],viewportWidth,viewportHeight};for(auto attachment:drawAttachments[drawFramebuffer])if(attachment!=GL_NONE){const auto texture=framebufferTextures[drawFramebuffer][attachment];draw.outputs.push_back(texture);if(texture)images[texture].stamp=100000+composites;}fullscreenDraws.push_back(draw);if(failComposite||fullscreenDrawsBeforeFailure==0){pendingError=GL_INVALID_OPERATION;failComposite=false;fullscreenDrawsBeforeFailure=-1;}else if(fullscreenDrawsBeforeFailure>0)--fullscreenDrawsBeforeFailure;};
    nativegl::glBindFramebuffer=[](GLenum kind,GLuint handle){if(kind!=GL_READ_FRAMEBUFFER)drawFramebuffer=handle;if(kind!=GL_DRAW_FRAMEBUFFER)readFramebuffer=handle;};nativegl::glViewport=[](GLint,GLint,GLsizei w,GLsizei h){viewportWidth=w;viewportHeight=h;};
    nativegl::glFramebufferTexture2D=[](GLenum,GLenum attachment,GLenum,GLuint texture,GLint){framebufferTextures[drawFramebuffer][attachment]=texture;};
    nativegl::glCheckFramebufferStatus=[](GLenum)->GLenum{if(framebufferChecksBeforeFailure==0){framebufferChecksBeforeFailure=-1;return GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT;}if(framebufferChecksBeforeFailure>0)--framebufferChecksBeforeFailure;return framebufferStatus;};
    nativegl::glDrawBuffers=[](GLsizei count,const GLenum* buffers){drawAttachments[drawFramebuffer]=std::vector<GLenum>(buffers,buffers+count);};
    nativegl::glDrawBuffer=[](GLenum buffer){drawAttachments[drawFramebuffer]={buffer};};nativegl::glReadBuffer=[](GLenum buffer){readAttachments[readFramebuffer]=buffer;};
    nativegl::glClearBufferfv=[](GLenum buffer,GLint index,const GLfloat* value){if(buffer==GL_DEPTH){depthClearDraws.push_back(geometryDraws.size());depthClearTargets.push_back(drawFramebuffer);images[framebufferTextures[drawFramebuffer][GL_DEPTH_ATTACHMENT]].stamp=0;}else if(buffer==GL_COLOR){const auto texture=framebufferTextures[drawFramebuffer][drawAttachments[drawFramebuffer].at(index)];images[texture].stamp=0;colorClears.push_back({texture,GL_FLOAT,glm::dvec4(glm::make_vec4(value))});}};
    nativegl::glClearBufferiv=[](GLenum,GLint index,const GLint* value){const auto texture=framebufferTextures[drawFramebuffer][drawAttachments[drawFramebuffer].at(index)];images[texture].stamp=0;colorClears.push_back({texture,GL_INT,glm::dvec4(glm::make_vec4(value))});};
    nativegl::glClearBufferuiv=[](GLenum,GLint index,const GLuint* value){const auto texture=framebufferTextures[drawFramebuffer][drawAttachments[drawFramebuffer].at(index)];images[texture].stamp=0;colorClears.push_back({texture,GL_UNSIGNED_INT,glm::dvec4(glm::make_vec4(value))});};
    nativegl::glBlitFramebuffer=[](GLint,GLint,GLint w,GLint h,GLint,GLint,GLint dw,GLint dh,GLbitfield mask,GLenum filter){
        if((mask!=GL_DEPTH_BUFFER_BIT&&mask!=GL_COLOR_BUFFER_BIT)||filter!=GL_NEAREST||readFramebuffer==drawFramebuffer||w!=dw||h!=dh)throw std::runtime_error("Invalid native framebuffer copy.");
        const bool color=mask==GL_COLOR_BUFFER_BIT;const auto sourceAttachment=color?readAttachments.at(readFramebuffer):GL_DEPTH_ATTACHMENT;
        const auto targetAttachment=color?drawAttachments.at(drawFramebuffer).at(0):GL_DEPTH_ATTACHMENT;
        const auto source=framebufferTextures.at(readFramebuffer).at(sourceAttachment),target=framebufferTextures.at(drawFramebuffer).at(targetAttachment);
        const auto& from=images.at(source);auto& to=images.at(target);
        if(!source||!target||source==target||from.format!=to.format||from.width!=w||from.height!=h||to.width!=w||to.height!=h)throw std::runtime_error("Framebuffer copy has incompatible images or feedback.");
        to.stamp=from.stamp;blits.push_back({readFramebuffer,drawFramebuffer,mask,geometryDraws.size()});
        if(!color){++depthCopies;depthCopyDraws.push_back(geometryDraws.size());}
        if(failHistoryCopy&&color){pendingError=GL_INVALID_OPERATION;failHistoryCopy=false;}
    };
    nativegl::glGetIntegerv=[](GLenum name,GLint* value){++integerQueries;*value=name==GL_MAX_DRAW_BUFFERS||name==GL_MAX_COLOR_ATTACHMENTS?8:name==GL_MAX_TEXTURE_IMAGE_UNITS?16:16384;};
    nativegl::glClearColor=[](GLfloat,GLfloat,GLfloat,GLfloat){};nativegl::glClearDepth=[](GLdouble){};nativegl::glClear=[](GLbitfield){};
    nativegl::glDepthFunc=[](GLenum value){depthFunction=value;};nativegl::glDepthMask=[](GLboolean value){depthWrite=value!=0;};
    nativegl::glEnable=[](GLenum state){if(state==GL_CULL_FACE)cull=true;if(state==GL_BLEND)blend=true;};nativegl::glDisable=[](GLenum state){if(state==GL_CULL_FACE)cull=false;if(state==GL_BLEND)blend=false;};nativegl::glBlendFunc=[](GLenum,GLenum){};
    nativegl::glFrontFace=[](GLenum value){winding=value;};nativegl::glCullFace=[](GLenum value){cullFace=value;};
    nativegl::glBlendFuncSeparate=[](GLenum a,GLenum b,GLenum c,GLenum d){blendFactors={a,b,c,d};};
    nativegl::glGetError=[]()->GLenum{const auto error=pendingError;pendingError=GL_NO_ERROR;return error;};
}
}
void requireCPU(bool condition,const char* message){if(!condition)throw std::runtime_error(message);}
struct Payload {
    std::vector<uint8_t> bytes;
    template<class T>void add(T value){const auto* p=reinterpret_cast<const uint8_t*>(&value);bytes.insert(bytes.end(),p,p+sizeof(value));}
    void words(std::initializer_list<uint32_t> values){for(auto value:values)add(value);}
    void floats(std::initializer_list<float> values){for(auto value:values)add(value);}
    void matrix(const glm::mat4& value){for(int i=0;i<16;++i)add(glm::value_ptr(value)[i]);}
};
#include "bridge_postprocess_tests.hpp"
#include "bridge_render_graph_tests.hpp"
#include "bridge_geometry_tests.hpp"
#include "bridge_source_frame_tests.hpp"
#include "bridge_gpu_particle_tests.hpp"
#include "bridge_pipe_tests.hpp"
#include "bridge_source_light_tests.hpp"
#include "bridge_source_emission_tests.hpp"
#include "bridge_source_block_tests.hpp"
#include "bridge_source_material_tests.hpp"
#include "bridge_minecraft_block_tests.hpp"
#include "bridge_pack_block_tests.hpp"
#include "bridge_properties_tests.hpp"
#include "bridge_pack_sources_tests.hpp"
#include "bridge_glsl_preprocessor_tests.hpp"
#include "bridge_glsl_translation_tests.hpp"
#include "bridge_linked_program_tests.hpp"
#include "bridge_program_uniform_tests.hpp"
#include "bridge_program_texture_tests.hpp"
#include "bridge_program_vertex_tests.hpp"
#include "bridge_program_output_tests.hpp"
#include "bridge_test_pass_tests.hpp"
#include "bridge_two_pass_tests.hpp"
int main(){try{
    testPacketPipe();
    mock::initialize();bridge::Renderer r;r.initialize();
    bridge::CameraHistory history;const glm::vec3 eye(10,2,3);const auto eyeView=glm::translate(glm::mat4(1),-eye);
    const auto firstFrame=history.prepare(eyeView,glm::mat4(1),eye,{16777217.25,0,0},true,true,640,360,1);
    requireCPU(!firstFrame.historyValid&&firstFrame.projection[2][2]==2&&firstFrame.projection[3][2]==-1&&firstFrame.eyeRelativeView==glm::mat4(1),"Canonical camera projection or eye-relative matrix differs.");
    requireCPU(firstFrame.projection*firstFrame.projectionInverse==glm::mat4(1),"Camera inverse does not match the converted half-Z projection.");history.commit(firstFrame);
    const auto nextEye=eye-glm::vec3(32,0,0);const auto secondFrame=history.prepare(glm::translate(glm::mat4(1),-nextEye),glm::mat4(1),nextEye,{16777249.25,0,0},true,true,640,360,1.02);
    requireCPU(secondFrame.historyValid&&secondFrame.absoluteCamera==firstFrame.absoluteCamera&&secondFrame.previousCamera==nextEye&&secondFrame.previousView==secondFrame.view,"Origin rebasing introduced false camera motion or lost double precision.");
    requireCPU(std::abs(secondFrame.delta-.02f)<1e-6f&&secondFrame.counter==1,"Frame history advances per committed render, not capture packet.");
    requireCPU(!history.prepare(eyeView,glm::mat4(1),eye,{0,0,0},false,false,640,360,2).historyValid,"Unknown absolute coordinates reused known-origin history.");
    requireCPU(!history.prepare(eyeView,glm::mat4(1),eye,{0,0,0},true,false,800,450,2).historyValid,"Resize retained incompatible history.");history.reset();
    requireCPU(!history.prepare(eyeView,glm::mat4(1),eye,{0,0,0},true,false,640,360,2).historyValid,"Fallback did not invalidate camera history.");
    bool singular=false;try{bridge::CameraHistory::checkedInverse(glm::mat4(0));}catch(const std::runtime_error&){singular=true;}requireCPU(singular,"Singular camera matrix was accepted.");
    const auto composite=bridge::compositeLifeform({glm::vec4(1,0,0,.5f),glm::vec4(0,0,1,1)});
    requireCPU(composite==glm::vec4(.5f,0,.5f,1),"Lifeform layer order or premultiplied compositing differs from the source.");
    requireCPU(bridge::compositeLifeform({glm::vec4(0,0,1,.5f)}).b==1,"Single transparent Lifeform layer was darkened.");
    requireCPU(bridge::bayerThreshold(0,0)==1.0f/16&&bridge::bayerThreshold(3,3)==6.0f/16&&bridge::bayerThreshold(4,4)==1.0f/16,"Source Bayer pattern differs.");
    std::vector<float> quad(4*14,0);const glm::vec2 corners[4]={{0,0},{1,0},{1,1},{0,1}};
    for(size_t i=0;i<4;++i){quad[i*14]=corners[i].x;quad[i*14+1]=corners[i].y;quad[i*14+5]=1;quad[i*14+6]=.25f+corners[i].x*.5f;quad[i*14+7]=.25f+corners[i].y*.5f;quad[i*14+13]=61440;}
    const std::vector<uint32_t> quadIndices={0,1,2,0,2,3};const auto iris=bridge::IrisGeometry::build(quad,quadIndices,true);
    requireCPU(iris.quadMidpointsComplete&&iris.blockCentersComplete&&iris.vertices[0].midpoint==glm::vec2(.5f),"Quad UV midpoint was replaced by a triangle average.");
    requireCPU(iris.vertices[0].tangent==glm::vec4(1,0,0,1)&&iris.vertices[0].midBlock==glm::vec4(32,32,-32,-1),"Iris tangent or 1/64-block offset differs; unknown emission must remain unknown.");
    auto mirrored=quad;for(size_t i=0;i<4;++i)mirrored[i*14+6]=1-mirrored[i*14+6];const auto flipped=bridge::IrisGeometry::build(mirrored,quadIndices,true);
    requireCPU(flipped.vertices[0].tangent.x==-1&&flipped.vertices[0].tangent.w==-1,"Mirrored UV tangent handedness was lost.");
    auto greedy=quad;for(size_t i=0;i<4;++i)greedy[i*14]*=2;requireCPU(!bridge::IrisGeometry::build(greedy,quadIndices,true).blockCentersComplete,"Greedy faces invented individual block centers.");
    requireCPU(!bridge::IrisGeometry::build(quad,{0,1,2},true).quadMidpointsComplete,"A triangle was falsely labelled an original quad.");
    for(size_t i=0;i<4;++i)mirrored[i*14+6]=mirrored[i*14+7]=0;const auto degenerate=bridge::IrisGeometry::build(mirrored,quadIndices,false);
    requireCPU(std::isfinite(degenerate.vertices[0].tangent.x)&&glm::length(glm::vec3(degenerate.vertices[0].tangent))>.99f,"Degenerate UVs produced an invalid tangent.");
    requireCPU(bridge::irisLightmap(0xf71e)==glm::ivec2(224,240)&&bridge::normalizedIrisLightmap({0,240})==glm::vec2(.03125f,.96875f),"Iris raw/normalized lightmap coordinates differ.");
    Payload bulk;bulk.floats({0,.25f,-12.5f,65535});
    bridge::Reader bulkReader{bulk.bytes};const auto decoded=bulkReader.floats(4);bulkReader.finish();
    requireCPU(decoded==std::vector<float>({0,.25f,-12.5f,65535}),"Bulk float import changed values.");
    Payload indexBlock;indexBlock.words({0,1,70000,0xffffffff});bridge::Reader indexReader{indexBlock.bytes};const auto decodedIndices=indexReader.indices(4);indexReader.finish();
    requireCPU(decodedIndices==std::vector<uint32_t>({0,1,70000,0xffffffff}),"Bulk index import changed unsigned values.");
    for(const auto value:{std::numeric_limits<float>::quiet_NaN(),std::numeric_limits<float>::infinity(),-std::numeric_limits<float>::infinity()}){
        auto invalid=bulk;std::memcpy(invalid.bytes.data()+8,&value,4);bridge::Reader invalidReader{invalid.bytes};bool rejectedBulk=false;
        try{invalidReader.floats(4);}catch(const std::runtime_error&){rejectedBulk=true;}
        requireCPU(rejectedBulk&&invalidReader.position==0,"Bulk float validation accepted a non-finite value or advanced partial data.");
    }
    bridge::Reader truncatedFloats{bulk.bytes};bool rejectedBulk=false;try{truncatedFloats.floats(5);}catch(const std::runtime_error&){rejectedBulk=true;}
    requireCPU(rejectedBulk&&truncatedFloats.position==0,"Truncated bulk float data was accepted.");
    bridge::Reader truncatedIndices{indexBlock.bytes};rejectedBulk=false;try{truncatedIndices.indices(5);}catch(const std::runtime_error&){rejectedBulk=true;}
    requireCPU(rejectedBulk&&truncatedIndices.position==0,"Truncated bulk index data was accepted.");
    Payload reset;reset.words({1});r.receive(bridge::Reset,1,reset.bytes);
    Payload texture;texture.words({1,11,1,1,4,2,1,7});texture.bytes.insert(texture.bytes.end(),{40,190,100,255});r.receive(bridge::Texture,2,texture.bytes);
    requireCPU(r.textures.at(11).received==std::vector<uint8_t>({0,0,255,0}),"Sparse readiness differs.");
    requireCPU(mock::masks.at(r.textures.at(11).readiness)==r.textures.at(11).received,"GPU mask upload differs from CPU readiness.");
    const auto& atlasUpload=mock::atlasUploads.back();requireCPU(atlasUpload.texture==r.textures.at(11).atlas&&atlasUpload.x==0&&atlasUpload.y==3&&atlasUpload.width==3&&atlasUpload.height==3,"Sparse native atlas tile mapping differs.");
    for(size_t pixel=0;pixel<9;++pixel)requireCPU(atlasUpload.pixels[pixel*4]==40&&atlasUpload.pixels[pixel*4+1]==190&&atlasUpload.pixels[pixel*4+3]==255,"Atlas gutter damaged source pixels.");
    Payload mesh;mesh.words({1,2,11,1,3,3});mesh.matrix(glm::mat4(1));
    for(auto position:std::array<glm::vec3,3>{{{0,0,0},{.5f,0,0},{0,.5f,0}}})mesh.floats({position.x,position.y,position.z,0,0,1,0,0,1,1,1,1,2,61440});mesh.words({0,1,2});r.receive(bridge::Mesh,3,mesh.bytes);
    auto camera=[&](float x){Payload p;p.words({1,0,640,360});auto view=glm::mat4(1);view[3][0]=-x;p.matrix(view);p.matrix(glm::mat4(1));p.floats({x,0,0,.1f,.14f,.19f,1});r.receive(bridge::Camera,4,p.bytes);};camera(0);
    Payload badCamera;badCamera.words({1,0,800,450});badCamera.matrix(glm::mat4(1));badCamera.matrix(glm::mat4(0));badCamera.floats({9,8,7,1,1,1,1});bool rejectedCamera=false;
    try{r.receive(bridge::Camera,99,badCamera.bytes);}catch(const std::runtime_error&){rejectedCamera=true;}
    requireCPU(rejectedCamera&&r.camera==glm::vec3(0)&&r.sourceWidth==640&&r.projection==glm::mat4(1),"Singular camera payload partially changed active state.");
    Payload origin;origin.words({1,1});origin.floats({16777216,0,0,1.25f,0,0});r.receive(bridge::Origin,99,origin.bytes);
    requireCPU(r.originKnown&&r.sourceOrigin.x==16777217.25,"Split source origin lost its low part.");
    r.render(0,640,360);requireCPU(mock::draws==1&&mock::textureKind==2&&r.pendingTextureMeshes==0,"A ready layer did not draw before the entire atlas.");
    Payload sampler;sampler.words({1,11,GL_NEAREST_MIPMAP_LINEAR,GL_NEAREST,1});r.receive(bridge::TextureSampling,100,sampler.bytes);
    requireCPU(r.textures.at(11).sampler.mipmaps&&mock::textureParameters[r.textures.at(11).handle][GL_TEXTURE_MIN_FILTER]==GL_NEAREST_MIPMAP_LINEAR,"Actual texture filters were not applied.");
    const auto mipmaps=mock::mipmapTextures.size();r.render(0,640,360);requireCPU(mock::mipmapTextures.size()==mipmaps+1&&!r.textures.at(11).mipDirty,"Dirty mip chains were not generated once per render batch.");
    r.render(0,640,360);requireCPU(mock::mipmapTextures.size()==mipmaps+1,"Unchanged texture rebuilt mipmaps.");
    auto badSampler=sampler;uint32_t invalidMag=GL_NEAREST_MIPMAP_LINEAR;std::memcpy(badSampler.bytes.data()+12,&invalidMag,4);bool rejectedSampler=false;
    try{r.receive(bridge::TextureSampling,101,badSampler.bytes);}catch(const std::runtime_error&){rejectedSampler=true;}
    requireCPU(rejectedSampler&&r.textures.at(11).sampler.mag==GL_NEAREST,"Malformed sampler damaged the active state.");
    Payload anim;anim.words({1,11,2});anim.floats({0,50,2,1,100,0,0,0});r.receive(bridge::AtlasAnimation,102,anim.bytes);
    requireCPU(r.textures.at(11).animation.layer(0)==0&&r.textures.at(11).animation.layer(3)==3,"Atlas base frame/nonanimated fallback differs.");
    anim.bytes.clear();anim.words({1,11,2});anim.floats({3,50,2,1,100,0,0,0});r.receive(bridge::AtlasAnimation,103,anim.bytes);
    requireCPU(r.textures.at(11).animation.layer(0)==1,"Atlas animation interval/stride differs.");
    const auto animationBuffer=r.textures.at(11).animationBuffer;anim.bytes.clear();anim.words({1,11,2});anim.floats({4,50,2,1,100,0,0,0});r.receive(bridge::AtlasAnimation,104,anim.bytes);
    requireCPU(r.textures.at(11).animation.layer(0)==2&&r.textures.at(11).animationBuffer==animationBuffer,"Atlas clock update reallocated parameter storage or selected the wrong frame.");
    auto invalidAnimation=anim;float badStart=4;std::memcpy(invalidAnimation.bytes.data()+24,&badStart,4);bool rejectedAnimation=false;try{r.receive(bridge::AtlasAnimation,105,invalidAnimation.bytes);}catch(const std::runtime_error&){rejectedAnimation=true;}
    requireCPU(rejectedAnimation&&r.textures.at(11).animation.layer(0)==2,"Invalid animation range damaged the active table.");
    texture.bytes.clear();texture.words({1,11,1,1,4,0,1,7});texture.bytes.insert(texture.bytes.end(),{220,80,40,255});r.receive(bridge::Texture,5,texture.bytes);
    requireCPU(r.textures.at(11).received[2]==255,"Layer zero erased an earlier sparse upload.");
    const auto meshUploads=r.meshUploads,textureUploads=r.textureUploads;
    Payload rebase;rebase.words({1});rebase.floats({10,0,0});r.receive(bridge::Rebase,6,rebase.bytes);
    mock::draws=0;r.render(0,640,360);requireCPU(mock::draws==1,"Rebase flickered before the next camera packet.");camera(10);
    requireCPU(r.meshes.at(2).world[3].x==10&&r.meshes.at(2).boundsMin.x==10,"Rebase did not move world and bounds together.");
    requireCPU(r.meshUploads==meshUploads&&r.textureUploads==textureUploads&&r.textures.size()==1,"Rebase reuploaded resources.");
    mock::draws=0;r.render(0,640,360);requireCPU(mock::draws==1,"Rebased mesh was incorrectly culled.");
    Payload instances;instances.words({1,2,1});instances.matrix(glm::mat4(1));instances.floats({3,-1});r.receive(bridge::Instances,7,instances.bytes);
    mock::draws=0;r.render(0,640,360);requireCPU(mock::draws==1&&r.pendingTextureMeshes==1,"Unloaded instance layer must retain drawable placeholder geometry.");
    instances.bytes.clear();instances.words({1,2,0});r.receive(bridge::Instances,8,instances.bytes);mock::draws=0;r.render(0,640,360);requireCPU(mock::draws==0,"Zero instances still drew geometry.");
    Payload pose;pose.words({1,2,3});pose.floats({0,0,0,0,0,1, .75f,0,0,0,0,1, 0,.75f,0,0,0,1});
    const auto oldVAO=r.meshes.at(2).vao,oldEBO=r.meshes.at(2).ebo;
    r.receive(bridge::Pose,9,pose.bytes);
    requireCPU(r.poseUpdates==1&&r.meshes.at(2).localMax.x==.75f,"Pose did not update CPU vertices/bounds.");
    requireCPU(r.meshes.at(2).vao==oldVAO&&r.meshes.at(2).ebo==oldEBO&&r.meshUploads==meshUploads,"Pose reallocated static geometry.");
    requireCPU(r.meshes.at(2).vertices[12]==2&&r.meshes.at(2).vertices[13]==61440,"Pose damaged atlas/light attributes.");
    requireCPU(r.meshes.at(2).irisBuffer&&r.meshes.at(2).irisLightBuffer&&r.meshes.at(2).iris.vertices.size()==3,"Iris vertex buffers were not maintained across pose updates.");
    auto badPose=pose;uint32_t wrong=4;std::memcpy(badPose.bytes.data()+8,&wrong,4);bool rejected=false;
    try{r.receive(bridge::Pose,10,badPose.bytes);}catch(const std::runtime_error&){rejected=true;}
    requireCPU(rejected&&r.poseUpdates==1,"Malformed pose modified the mesh.");
    Payload material;material.words({1,2,1});material.floats({.4f,.1f,.2f,.3f});r.receive(bridge::Material,11,material.bytes);
    requireCPU(r.meshes.at(2).unlit&&r.meshes.at(2).alphaCutoff==.4f&&r.meshes.at(2).emission.z==.3f,"Material properties differ.");
    auto badMaterial=material;float invalid=-1;std::memcpy(badMaterial.bytes.data()+12,&invalid,4);rejected=false;
    try{r.receive(bridge::Material,12,badMaterial.bytes);}catch(const std::runtime_error&){rejected=true;}
    requireCPU(rejected&&r.materialUpdates==1,"Invalid material modified the mesh.");
    const auto allocationCount=r.targets.allocations;const auto oldFramebuffer=r.targets.framebuffer;
    r.render(0,640,360);requireCPU(r.targets.allocations==allocationCount,"Stable viewport reallocated framebuffers.");
    mock::framebufferStatus=GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT;rejected=false;
    try{r.targets.resize(800,450);}catch(const std::runtime_error&){rejected=true;}
    mock::framebufferStatus=GL_FRAMEBUFFER_COMPLETE;
    requireCPU(rejected&&r.targets.framebuffer==oldFramebuffer&&r.targets.width==640,"Failed resize discarded working targets.");
    r.render(0,800,450);requireCPU(r.targets.allocations==allocationCount+1&&r.targets.width==800&&r.targets.height==450,"Viewport resize did not replace targets.");
    requireCPU(r.targets.depth!=r.targets.opaqueDepth&&r.targets.depth&&r.targets.opaqueDepth,"Depth buffers alias.");
    requireCPU(std::all_of(r.targets.colors.begin(),r.targets.colors.end(),[](auto handle){return handle!=0;}),"Missing native color targets.");
    requireCPU(mock::depthCopies>0&&mock::composites>0&&mock::compositeFramebuffers.back()==0,"Native scene was not composed to the target framebuffer.");
    requireCPU(mock::geometryFramebuffers.front()!=0,"Geometry bypassed the native buffers.");
    requireCPU(mock::bound[GL_TEXTURE0]&&mock::bound[GL_TEXTURE1]&&mock::bound[GL_TEXTURE2],"Inactive source samplers lack fallback textures.");
    requireCPU(mock::bound[GL_TEXTURE3]==r.targets.colors[bridge::FrameTargets::Scene],"Composite reads the wrong scene texture.");
    requireCPU(mock::drawAttachments[r.targets.framebuffer]==std::vector<GLenum>{GL_COLOR_ATTACHMENT0},"Translucency overwrites opaque normal/light/albedo buffers.");
    camera(0);auto opaque=mesh;uint32_t opaqueId=30;std::memcpy(opaque.bytes.data()+4,&opaqueId,4);r.receive(bridge::Mesh,13,opaque.bytes);
    auto translucent=opaque;uint32_t translucentId=31,transparentFlags=3;std::memcpy(translucent.bytes.data()+4,&translucentId,4);std::memcpy(translucent.bytes.data()+12,&transparentFlags,4);r.receive(bridge::Mesh,14,translucent.bytes);
    const auto firstDraw=mock::geometryDraws.size();r.render(0,800,450);
    requireCPU(mock::geometryDraws.size()==firstDraw+2,"Opaque/translucent test geometry was not drawn.");
    const auto opaqueDraw=mock::geometryDraws[firstDraw],transparentDraw=mock::geometryDraws[firstDraw+1];
    requireCPU(opaqueDraw.attachments==6&&opaqueDraw.depthWrite,"Opaque pass did not populate all surface buffers and depth.");
    requireCPU(transparentDraw.attachments==1&&!transparentDraw.depthWrite,"Transparent pass damaged opaque surface data/depth.");
    requireCPU(transparentDraw.blend&&mock::blendFactors==std::array<GLenum,4>{GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA,GL_ONE,GL_ONE},"Translucent output does not preserve source alpha accumulation.");
    Payload drawState;drawState.words({1,30,bridge::MaterialDrawState::Cull|bridge::MaterialDrawState::Clockwise|bridge::MaterialDrawState::CullFront|bridge::MaterialDrawState::Fog,GL_LEQUAL,0,0,2});
    auto uvMatrix=glm::mat4(1);uvMatrix[0][0]=2;uvMatrix[1][1]=3;uvMatrix[2][0]=.25f;uvMatrix[2][1]=.5f;drawState.matrix(uvMatrix);drawState.floats({.5f});
    r.receive(bridge::MaterialState,27,drawState.bytes);const auto& state=r.meshes.at(30).drawState;
    requireCPU(state.textureCoordinates(glm::vec2(.25f,.5f))==glm::vec2(.75f,2)&&state.textureLevel==.5f,"Source UV matrix uses the wrong homogeneous translation column.");
    const auto stateDraws=mock::geometryDraws.size();r.render(0,800,450);const auto actualState=mock::geometryDraws.at(stateDraws);
    requireCPU(actualState.cull&&actualState.winding==GL_CW&&actualState.cullFace==GL_FRONT&&!actualState.depthWrite&&actualState.depthFunction==GL_LEQUAL,"Per-material raster state was not applied.");
    requireCPU(bridge::MaterialDrawState{}.depth(true)==GL_GEQUAL,"Reverse-depth default comparison differs.");
    for(const auto& [offset,value]:std::vector<std::pair<size_t,uint32_t>>{{8,128},{12,999},{16,9},{20,3}}){auto malformed=drawState;std::memcpy(malformed.bytes.data()+offset,&value,4);rejected=false;
        try{r.receive(bridge::MaterialState,28,malformed.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&r.meshes.at(30).drawState.textureLevel==.5f,"Malformed draw state modified live material.");}
    auto shortState=drawState;shortState.bytes.pop_back();rejected=false;try{r.receive(bridge::MaterialState,29,shortState.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected,"Truncated material draw state was accepted.");
    for(float invalidValue:{-1.0f,std::numeric_limits<float>::quiet_NaN(),std::numeric_limits<float>::infinity()}){auto malformed=drawState;std::memcpy(malformed.bytes.data()+92,&invalidValue,4);rejected=false;
        try{r.receive(bridge::MaterialState,30,malformed.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&r.meshes.at(30).drawState.textureLevel==.5f,"Invalid texture level modified a live material.");}
    requireCPU(bridge::MaterialDrawState::wrap(0)==GL_CLAMP_TO_EDGE&&bridge::MaterialDrawState::wrap(1)==GL_REPEAT&&bridge::MaterialDrawState::wrap(2)==GL_MIRRORED_REPEAT,"Per-axis texture wrap mapping differs.");
    r.meshes.at(30).drawState=bridge::MaterialDrawState{};
    requireCPU(mock::framebufferTextures[r.targets.framebuffer][GL_COLOR_ATTACHMENT2]==r.targets.colors[bridge::FrameTargets::Normal],"Normal attachment is not the declared normal buffer.");
    Payload surface;surface.words({1,30,3});surface.floats({65535,3,65535,3,65535,3});r.receive(bridge::Surface,15,surface.bytes);
    requireCPU(r.meshes.at(30).surfaceData[0]==65535&&r.meshes.at(30).surfaceData[1]==3,"Native block IDs lost precision or material class.");
    auto invalidSurface=surface;float invalidID=65536;std::memcpy(invalidSurface.bytes.data()+12,&invalidID,4);rejected=false;
    try{r.receive(bridge::Surface,16,invalidSurface.bytes);}catch(const std::runtime_error&){rejected=true;}
    requireCPU(rejected&&r.surfaceUpdates==1,"Invalid block ID modified the mesh.");
    Payload environment;environment.words({1,3,3});environment.floats({0,1,0,1,1,1,.1f,.2f,.3f,16,96,.04f,.1f,256,12});r.receive(bridge::Environment,17,environment.bytes);
    r.render(0,800,450);requireCPU(r.shadowMeshes==1&&r.shadows.depth&&r.environment.fogEnabled,"Actual environment did not enable scene shadow/fog handling.");
    requireCPU(mock::bound[GL_TEXTURE5]==r.shadows.depth,"Scene lighting reads the wrong shadow texture.");
    auto badEnvironment=environment;float badFog=-1;std::memcpy(badEnvironment.bytes.data()+56,&badFog,4);rejected=false;
    try{r.receive(bridge::Environment,18,badEnvironment.bytes);}catch(const std::runtime_error&){rejected=true;}
    requireCPU(rejected&&r.environmentUpdates==1,"Invalid environment modified the active state.");
    Payload cube;cube.words({1,50,1,1,6,0,6,12});cube.bytes.insert(cube.bytes.end(),24,255);r.receive(bridge::Texture,19,cube.bytes);
    requireCPU(r.textures.at(50).received==std::vector<uint8_t>(6,255),"Cubemap faces were not retained.");
    auto sky=mesh;uint32_t skyId=32,skyTexture=50,skyFlags=4;std::memcpy(sky.bytes.data()+4,&skyId,4);std::memcpy(sky.bytes.data()+8,&skyTexture,4);std::memcpy(sky.bytes.data()+12,&skyFlags,4);r.receive(bridge::Mesh,20,sky.bytes);
    const auto drawsBefore=mock::draws,compositesBefore=mock::composites;r.render(0,800,450,false);
    requireCPU(mock::draws==drawsBefore&&mock::composites==compositesBefore&&r.visibleMeshes==0,"Incomplete embedded scene still performed GPU draws.");
    Payload control;control.words({1,7,1});r.receive(bridge::RenderControl,21,control.bytes);
    r.render(0,800,450,false);requireCPU(mock::composites==compositesBefore&&r.visibleMeshes==3&&r.shadowMeshes==1,"Embedded draw presented a second window or treated sky as a shadow caster.");
    auto invalidControl=control;uint32_t badFlags=2;std::memcpy(invalidControl.bytes.data()+8,&badFlags,4);rejected=false;
    try{r.receive(bridge::RenderControl,22,invalidControl.bytes);}catch(const std::runtime_error&){rejected=true;}
    requireCPU(rejected&&r.presentationReady&&r.presentationRevision==7,"Invalid presentation control modified active state.");
    Payload sourceAppearance;sourceAppearance.words({1,30,1|2|4|16|64,2,2,2,0});sourceAppearance.floats({.1f,.1f,.1f,1,1,1,0,0,0,0,0,0,0,0,1,1});r.receive(bridge::AppearanceMaterial,40,sourceAppearance.bytes);
    Payload appearanceRecords;appearanceRecords.words({1,30,0,3,0,3});for(int i=0;i<3;++i)appearanceRecords.floats({0,3,0,0,0,0,0,0,1,0,0,.5f,.2f,.4f,.6f,.8f,.75f,0,0,0});
    r.receive(bridge::AppearanceData,41,appearanceRecords.bytes);requireCPU(r.meshes.at(30).appearanceBuffer&&r.meshes.at(30).vertexAppearance[1]==3&&r.meshes.at(30).vertexAppearance[16]==.75f,"Native appearance data differs.");
    const auto goodAppearance=r.meshes.at(30).vertexAppearance;auto badAppearance=appearanceRecords;float outside=4;std::memcpy(badAppearance.bytes.data()+24,&outside,4);rejected=false;
    try{r.receive(bridge::AppearanceData,42,badAppearance.bytes);}catch(const std::runtime_error&){rejected=true;}
    requireCPU(rejected&&r.meshes.at(30).vertexAppearance==goodAppearance,"Invalid atlas tile damaged the active appearance.");
    auto badConfig=sourceAppearance;uint32_t badLayers=9;std::memcpy(badConfig.bytes.data()+20,&badLayers,4);rejected=false;
    try{r.receive(bridge::AppearanceMaterial,43,badConfig.bytes);}catch(const std::runtime_error&){rejected=true;}
    requireCPU(rejected&&r.meshes.at(30).appearance.layers==2,"Invalid appearance config modified the live contract.");
    auto missing=appearanceRecords;missing.bytes.pop_back();rejected=false;try{r.receive(bridge::AppearanceData,44,missing.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&r.meshes.at(30).vertexAppearance==goodAppearance,"Truncated appearance data replaced complete records.");
    Payload clearAppearance;clearAppearance.words({1,30,0,1,1,0,0});clearAppearance.floats({0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,1});r.receive(bridge::AppearanceMaterial,45,clearAppearance.bytes);
    requireCPU(r.meshes.at(30).vertexAppearance.empty()&&r.meshes.at(30).appearance.flags==0,"Removing plugins kept old clothing or damage overlay.");
    Payload extendedConfig;extendedConfig.words({1,30,256|512|2,2,1,1,0});extendedConfig.floats({0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,1});r.receive(bridge::AppearanceMaterial,110,extendedConfig.bytes);
    Payload extendedData;extendedData.words({1,30,0,3,0,3});for(int i=0;i<3;++i)extendedData.floats({1,0,0,0,0,0,0,0,0,1,0,.5f,-1,-1,-1,-1,1,.2f,.4f,.6f,1,0,0,1});r.receive(bridge::AppearanceDataV2,111,extendedData.bytes);
    requireCPU(r.meshes.at(30).vertexAppearance.size()==108&&r.meshes.at(30).vertexAppearance[20]==1&&r.meshes.at(30).vertexAppearance[53]==.2f,"V2 appearance stride damaged independent tint/hue records.");
    const auto validExtended=r.meshes.at(30).vertexAppearance;auto invalidHue=extendedData;float badHue=2;std::memcpy(invalidHue.bytes.data()+24+23*4,&badHue,4);rejected=false;try{r.receive(bridge::AppearanceDataV2,112,invalidHue.bytes);}catch(const std::runtime_error&){rejected=true;}
    requireCPU(rejected&&r.meshes.at(30).vertexAppearance==validExtended,"Invalid HueTint data damaged complete records.");
    rejected=false;try{r.receive(bridge::AppearanceData,113,appearanceRecords.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&r.meshes.at(30).vertexAppearance==validExtended,"Legacy records were accepted for extended appearance.");
    Payload enchantConfig;enchantConfig.words({1,30,2048|8192,1,1,0,0});enchantConfig.floats({0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,1});r.receive(bridge::AppearanceMaterial,114,enchantConfig.bytes);
    Payload enchantData;enchantData.words({1,30,0,3,0,3});for(int i=0;i<3;++i)enchantData.floats({0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,1,0,0,0,0,0,0,0,.2f,.4f,.6f,.25f,1,2,3,.5f,4,5,6,0});r.receive(bridge::AppearanceDataV3,115,enchantData.bytes);
    const auto validEnchant=r.meshes.at(30).vertexAppearance;requireCPU(validEnchant.size()==108&&validEnchant[24]==.2f&&validEnchant[67]==.5f,"V3 enchantment/node records lost their stride.");
    auto invalidEnchant=enchantData;float invalidSpeed=1025;std::memcpy(invalidEnchant.bytes.data()+24+27*4,&invalidSpeed,4);rejected=false;try{r.receive(bridge::AppearanceDataV3,116,invalidEnchant.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&r.meshes.at(30).vertexAppearance==validEnchant,"Invalid enchantment speed replaced complete records.");
    rejected=false;try{r.receive(bridge::AppearanceDataV2,117,extendedData.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&r.meshes.at(30).vertexAppearance==validEnchant,"V2 records were accepted for enchantment.");
    Payload special;special.words({1,30});special.floats({1234,-.5f,.2f,-.1f});r.receive(bridge::SpecialMaterial,118,special.bytes);requireCPU(r.meshes.at(30).special==glm::vec4(1234,-.5f,.2f,-.1f),"Source effect clock/text bias/pivot differ.");
    auto badSpecial=special;float invalidBias=17;std::memcpy(badSpecial.bytes.data()+12,&invalidBias,4);rejected=false;try{r.receive(bridge::SpecialMaterial,119,badSpecial.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&r.meshes.at(30).special.y==-.5f,"Invalid special state modified the active material.");
    auto truncatedSpecial=special;truncatedSpecial.bytes.pop_back();rejected=false;try{r.receive(bridge::SpecialMaterial,120,truncatedSpecial.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&r.meshes.at(30).special.x==1234,"Truncated special state was accepted.");
    for(const auto mode:{1u,6u,7u,8u}){bridge::MaterialDrawState blend;blend.blendMode=mode;blend.apply(false,false,false,true);const auto expected=mode==1?std::array<GLenum,4>{GL_SRC_ALPHA,GL_ONE,GL_ZERO,GL_ONE}:mode==6?std::array<GLenum,4>{GL_ONE,GL_ONE,GL_ZERO,GL_ONE}:std::array<GLenum,4>{GL_ONE,GL_ONE_MINUS_SRC_ALPHA,GL_ONE,static_cast<GLenum>(mode==7?GL_ONE:GL_ONE_MINUS_SRC_ALPHA)};requireCPU(mock::blendFactors==expected,"Source additive/premultiplied blending differs.");}
    auto particle=mesh;uint32_t particleId=60,particleFlags=16|2;std::memcpy(particle.bytes.data()+4,&particleId,4);std::memcpy(particle.bytes.data()+12,&particleFlags,4);r.receive(bridge::Mesh,121,particle.bytes);
    Payload particleConfig;particleConfig.words({1,60,16384,1,1,0,0});particleConfig.floats({0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,1});r.receive(bridge::AppearanceMaterial,122,particleConfig.bytes);
    Payload particleBatch;particleBatch.words({1,60,1,7});particleBatch.matrix(glm::translate(glm::mat4(1),glm::vec3(3,4,5)));particleBatch.floats({1,.5f,.25f,.75f});r.receive(bridge::ParticleBatch,123,particleBatch.bytes);
    auto& importedParticle=r.meshes.at(60);requireCPU(importedParticle.instanceCount==1&&importedParticle.instanceData[12]==3&&importedParticle.instanceAppearance[11]==.75f&&importedParticle.instanceAppearanceReceived==1,"Particle transforms/colors were not applied together.");
    const auto goodParticleTransforms=importedParticle.instanceData,goodParticleAppearance=importedParticle.instanceAppearance;
    for(const auto offset:{3u,19u}){auto badParticle=particleBatch;float invalidParticleValue=2;std::memcpy(badParticle.bytes.data()+16+offset*4,&invalidParticleValue,4);rejected=false;try{r.receive(bridge::ParticleBatch,124,badParticle.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&importedParticle.instanceData==goodParticleTransforms&&importedParticle.instanceAppearance==goodParticleAppearance,"Invalid particle batch partially modified active data.");}
    auto shortParticle=particleBatch;shortParticle.bytes.pop_back();rejected=false;try{r.receive(bridge::ParticleBatch,125,shortParticle.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&importedParticle.instanceCount==1,"Truncated particle batch replaced complete data.");
    particleBatch.bytes.clear();particleBatch.words({1,60,1,7});particleBatch.matrix(glm::mat4(1));particleBatch.floats({1,.5f,.25f,.75f});r.receive(bridge::ParticleBatch,127,particleBatch.bytes);
    importedParticle.drawState.flags&=~bridge::MaterialDrawState::DepthWrite;importedParticle.drawState.blendMode=1;
    auto secondParticle=particle;uint32_t secondParticleId=61;std::memcpy(secondParticle.bytes.data()+4,&secondParticleId,4);r.receive(bridge::Mesh,128,secondParticle.bytes);auto secondConfig=particleConfig;std::memcpy(secondConfig.bytes.data()+4,&secondParticleId,4);r.receive(bridge::AppearanceMaterial,129,secondConfig.bytes);
    auto secondBatch=particleBatch;uint32_t secondOrder=3;std::memcpy(secondBatch.bytes.data()+4,&secondParticleId,4);std::memcpy(secondBatch.bytes.data()+12,&secondOrder,4);r.receive(bridge::ParticleBatch,130,secondBatch.bytes);r.meshes.at(61).drawState=importedParticle.drawState;
    const auto particleDrawStart=mock::geometryDraws.size();r.render(0,800,450);requireCPU(r.shadowMeshes==1&&mock::geometryDraws.size()>particleDrawStart,"Particle test scene was not drawn.");
    const auto particleDraw=std::find_if(mock::geometryDraws.begin()+particleDrawStart,mock::geometryDraws.end(),[&](const auto& draw){return draw.vao==importedParticle.vao;});requireCPU(particleDraw!=mock::geometryDraws.end()&&particleDraw->attachments==1&&particleDraw->blend&&!particleDraw->depthWrite,"Particle output damaged opaque surface buffers/depth or was not blended.");
    requireCPU(particleDraw!=mock::geometryDraws.begin()&&(particleDraw-1)->vao==r.meshes.at(61).vao&&(particleDraw+1)!=mock::geometryDraws.end()&&(particleDraw+1)->vao==r.meshes.at(31).vao,"Particle source-system ordering or before-translucency stage differs.");
    importedParticle.drawState.flags|=bridge::MaterialDrawState::DepthWrite;const auto forcedDrawStart=mock::geometryDraws.size();r.render(0,800,450);const auto forcedDraw=std::find_if(mock::geometryDraws.begin()+forcedDrawStart,mock::geometryDraws.end(),[&](const auto& draw){return draw.vao==importedParticle.vao;});requireCPU(forcedDraw!=mock::geometryDraws.end()&&forcedDraw->depthWrite&&forcedDraw->attachments==1,"Source forceDepthWrite did not preserve scene-only particle output.");
    Payload emptyParticles;emptyParticles.words({1,60,0,7});r.receive(bridge::ParticleBatch,126,emptyParticles.bytes);requireCPU(importedParticle.instanceCount==0&&importedParticle.instanceData.empty()&&importedParticle.instanceAppearance.empty(),"Empty particle batch retained old billboards.");
    Payload extendedParticle;extendedParticle.words({1,60,1,9,2});extendedParticle.floats({.2f,-.1f,.5f,0,1,.25f});extendedParticle.matrix(glm::translate(glm::mat4(1),glm::vec3(.25f)));extendedParticle.floats({3,.5f,.25f,.75f,.5f,1,.5f,-.5f,1,1,0,.98f});
    r.receive(bridge::ParticleBatchV2,140,extendedParticle.bytes);requireCPU(importedParticle.particleMode==2&&importedParticle.particleMask==glm::vec4(.5f,0,1,.25f)&&importedParticle.special.z==.2f&&importedParticle.instanceAppearance[8]==3&&importedParticle.instanceAppearance[23]==-.5f&&importedParticle.instanceAppearance[27]==.98f,"Extended particle UV/direction/HDR/pivot/mask state differs.");
    const auto stableParticleData=importedParticle.instanceData,stableParticleAppearance=importedParticle.instanceAppearance;const auto stablePivot=importedParticle.special,stableMask=importedParticle.particleMask;
    for(const auto& [offset,value]:std::vector<std::pair<size_t,uint32_t>>{{8,8193},{12,1000001},{16,5}}){auto bad=extendedParticle;std::memcpy(bad.bytes.data()+offset,&value,4);bool failed=false;try{r.receive(bridge::ParticleBatchV2,141,bad.bytes);}catch(const std::runtime_error&){failed=true;}requireCPU(failed&&importedParticle.instanceData==stableParticleData&&importedParticle.particleMode==2,"Invalid particle V2 header modified live state.");}
    for(const auto& [offset,value]:std::vector<std::pair<size_t,float>>{{20,17.f},{28,-.1f},{32,2.f},{44+3*4,2.f},{44+10*4,2.f},{44+16*4,65.f},{44+19*4,1.1f},{44+20*4,-.1f},{44+22*4,0.f},{44+23*4,2.f},{44+27*4,0.f},{44+27*4,2.f},{44+24*4,std::numeric_limits<float>::quiet_NaN()}}){auto bad=extendedParticle;std::memcpy(bad.bytes.data()+offset,&value,4);bool failed=false;try{r.receive(bridge::ParticleBatchV2,141,bad.bytes);}catch(const std::runtime_error&){failed=true;}requireCPU(failed&&importedParticle.instanceData==stableParticleData&&importedParticle.instanceAppearance==stableParticleAppearance&&importedParticle.special==stablePivot&&importedParticle.particleMask==stableMask,"Invalid V2 particle fields partially modified live state.");}
    auto zeroDirection=extendedParticle;std::fill_n(zeroDirection.bytes.begin()+44+24*4,12,uint8_t{0});rejected=false;try{r.receive(bridge::ParticleBatchV2,141,zeroDirection.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&importedParticle.particleMode==2,"Zero stretched direction was accepted.");
    auto truncatedParticleV2=extendedParticle;truncatedParticleV2.bytes.pop_back();rejected=false;try{r.receive(bridge::ParticleBatchV2,141,truncatedParticleV2.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&importedParticle.special==stablePivot,"Truncated particle V2 state changed the live pivot.");
    const auto instanceBuffer=importedParticle.instances,appearanceBuffer=importedParticle.appearanceBuffer;const auto instanceWrites=std::count(mock::uploadedBuffers.begin(),mock::uploadedBuffers.end(),instanceBuffer),appearanceWrites=std::count(mock::uploadedBuffers.begin(),mock::uploadedBuffers.end(),appearanceBuffer);
    r.receive(bridge::ParticleBatchV2,142,extendedParticle.bytes);requireCPU(std::count(mock::uploadedBuffers.begin(),mock::uploadedBuffers.end(),instanceBuffer)==instanceWrites&&std::count(mock::uploadedBuffers.begin(),mock::uploadedBuffers.end(),appearanceBuffer)==appearanceWrites,"Unchanged extended particles reuploaded GPU buffers.");
    auto changedCell=extendedParticle;const float cellOffset=0;std::memcpy(changedCell.bytes.data()+44+20*4,&cellOffset,4);r.receive(bridge::ParticleBatchV2,143,changedCell.bytes);requireCPU(std::count(mock::uploadedBuffers.begin(),mock::uploadedBuffers.end(),instanceBuffer)==instanceWrites&&std::count(mock::uploadedBuffers.begin(),mock::uploadedBuffers.end(),appearanceBuffer)==appearanceWrites+1,"Sheet-only updates retransmitted transforms or failed to upload appearance.");
    for(uint32_t mode=0;mode<=4;++mode){auto batch=extendedParticle;std::memcpy(batch.bytes.data()+16,&mode,4);r.receive(bridge::ParticleBatchV2,144+mode,batch.bytes);const auto start=mock::geometryDraws.size();r.render(0,800,450);const auto draw=std::find_if(mock::geometryDraws.begin()+start,mock::geometryDraws.end(),[&](const auto& item){return item.vao==importedParticle.vao;});requireCPU(draw!=mock::geometryDraws.end()&&draw->particleMode==static_cast<int>(mode)&&draw->particleMask==stableMask&&draw->attachments==1&&!draw->shadow,"Particle mode/mask was not bound to its scene-only draw.");}
    r.receive(bridge::ParticleBatch,150,particleBatch.bytes);requireCPU(importedParticle.particleMode==0&&importedParticle.particleMask==glm::vec4(1)&&importedParticle.instanceAppearance[22]==1&&importedParticle.instanceAppearance[23]==1&&importedParticle.instanceAppearance[27]==1,"Legacy particles retained an extended direction/mask/UV state.");
    Payload emptyV2;emptyV2.words({1,60,0,9,0});emptyV2.floats({0,0,1,1,1,1});r.receive(bridge::ParticleBatchV2,151,emptyV2.bytes);requireCPU(importedParticle.instanceCount==0&&importedParticle.special.z==0&&importedParticle.special.w==0&&importedParticle.instanceAppearance.empty(),"Empty V2 particles retained previous pivot or color data.");
    Payload rampPixels;rampPixels.words({1,80,4,1,1,0,1,6});rampPixels.bytes.insert(rampPixels.bytes.end(),16,uint8_t{255});r.receive(bridge::Texture,152,rampPixels.bytes);
    const auto rampBatch=[&](uint32_t blend){Payload p;p.words({1,60,1,9,2,80,blend,0,2});p.floats({.2f,-.1f,.5f,0,1,.25f});p.matrix(glm::translate(glm::mat4(1),glm::vec3(.25f)));p.floats({3,.5f,.25f,.75f,.5f,1,.5f,-.5f,1,1,0,.98f,.1f,.8f,.2f,.6f});return p;};
    const auto goodRamp=rampBatch(5);r.receive(bridge::ParticleBatchV3,153,goodRamp.bytes);requireCPU(importedParticle.rampTexture==80&&importedParticle.particleSourceBlend&&importedParticle.particleBlend==5&&importedParticle.instanceAppearance[28]==.1f&&importedParticle.instanceAppearance[31]==.6f,"Particle V3 ramp/blend/remap state differs.");
    const auto beforeRampData=importedParticle.instanceAppearance;
    for(const auto& [offset,value]:std::vector<std::pair<size_t,uint32_t>>{{20,50},{24,6},{28,3},{32,3}}){auto bad=goodRamp;std::memcpy(bad.bytes.data()+offset,&value,4);bool failed=false;try{r.receive(bridge::ParticleBatchV3,154,bad.bytes);}catch(const std::runtime_error&){failed=true;}requireCPU(failed&&importedParticle.instanceAppearance==beforeRampData&&importedParticle.particleBlend==5,"Invalid particle V3 ramp/blend/wrap partially changed live state.");}
    for(const auto& [offset,value]:std::vector<std::pair<size_t,float>>{{60+28*4,65.f},{60+29*4,0.f},{60+31*4,-1.f},{60+30*4,std::numeric_limits<float>::infinity()}}){auto bad=goodRamp;std::memcpy(bad.bytes.data()+offset,&value,4);bool failed=false;try{r.receive(bridge::ParticleBatchV3,154,bad.bytes);}catch(const std::runtime_error&){failed=true;}requireCPU(failed&&importedParticle.instanceAppearance==beforeRampData,"Invalid particle V3 remap partially changed live data.");}
    auto shortRamp=goodRamp;shortRamp.bytes.pop_back();rejected=false;try{r.receive(bridge::ParticleBatchV3,154,shortRamp.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&importedParticle.rampTexture==80,"Truncated V3 packet changed live ramp data.");
    const auto expectedBlend=[](uint32_t source){return source==0?std::array<GLenum,4>{GL_ZERO,GL_ONE_MINUS_SRC_COLOR,GL_ONE,GL_ONE}:source==1?std::array<GLenum,4>{GL_ONE,GL_ONE,GL_ZERO,GL_ONE}:source==2?std::array<GLenum,4>{GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA,GL_ONE,GL_ONE}:source==3?std::array<GLenum,4>{GL_SRC_ALPHA,GL_ONE,GL_ZERO,GL_ONE}:std::array<GLenum,4>{GL_DST_COLOR,GL_ZERO,GL_ONE,GL_ONE};};
    for(uint32_t blend=0;blend<6;++blend){const auto batch=rampBatch(blend);r.receive(bridge::ParticleBatchV3,155+blend,batch.bytes);const auto start=mock::geometryDraws.size();r.render(0,800,450);std::vector<mock::Draw> draws;for(auto i=start;i<mock::geometryDraws.size();++i)if(mock::geometryDraws[i].vao==importedParticle.vao)draws.push_back(mock::geometryDraws[i]);
        requireCPU(draws.size()==(blend==5?2:1)&&draws[0].attachments==1&&draws[0].rampEnabled==1&&draws[0].ramp==r.textures.at(80).handle&&draws[0].multiply==(blend>=4?1:0)&&draws[0].factors==expectedBlend(blend),"Particle ramp binding/source blend/scene-only pass differs.");
        if(blend==5)requireCPU(draws[1].multiply==0&&draws[1].factors==expectedBlend(3)&&draws[1].rampEnabled==1,"MultiplyAdd second pass is not source ADD.");
        requireCPU(mock::textureParameters[r.textures.at(80).handle][GL_TEXTURE_WRAP_S]==GL_CLAMP_TO_EDGE&&mock::textureParameters[r.textures.at(80).handle][GL_TEXTURE_WRAP_T]==GL_MIRRORED_REPEAT,"Ramp sampler did not preserve source wraps.");}
    Payload releaseRamp;releaseRamp.words({1,1,80});rejected=false;try{r.receive(bridge::ReleaseTextures,161,releaseRamp.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&r.textures.contains(80),"Referenced particle ramp was released.");
    auto invalidRampTexture=rampPixels;const uint32_t invalidRampHeight=2;std::memcpy(invalidRampTexture.bytes.data()+12,&invalidRampHeight,4);invalidRampTexture.bytes.insert(invalidRampTexture.bytes.end(),16,uint8_t{255});rejected=false;try{r.receive(bridge::Texture,162,invalidRampTexture.bytes);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected&&r.textures.at(80).height==1,"Invalid ramp texture update damaged a live resource.");
    const auto rampHandle=r.textures.at(80).handle;r.textures.at(80).received[0]=0;const auto beforeMissingRamp=mock::geometryDraws.size();r.render(0,800,450);requireCPU(std::none_of(mock::geometryDraws.begin()+beforeMissingRamp,mock::geometryDraws.end(),[&](const auto& item){return item.vao==importedParticle.vao;}),"Incomplete ramp was drawn as an arbitrary white texture.");r.textures.at(80).received[0]=255;
    const glm::vec4 remap(.1f,.8f,.2f,.6f),base(3,.5f,.25f,.5f),rampColor(.2f,.4f,.8f,.75f);requireCPU(std::abs(bridge::particleRampCoordinate(.5f,remap)-.5f)<1e-6f&&glm::length(bridge::particleRampColor(base,rampColor,remap)-glm::vec4(.6f,.2f,.2f,(.375f-.2f)/.6f))<1e-6f,"Particle ramp formula differs from source remap semantics.");
    r.receive(bridge::ParticleBatchV2,163,extendedParticle.bytes);requireCPU(importedParticle.rampTexture==0&&!importedParticle.particleSourceBlend&&importedParticle.instanceAppearance[29]==1,"Legacy particle transition retained ramp/remap state.");const auto resetRampDraw=mock::geometryDraws.size();r.render(0,800,450);requireCPU(std::all_of(mock::geometryDraws.begin()+resetRampDraw,mock::geometryDraws.end(),[&](const auto& item){return item.rampEnabled==0&&item.multiply==0&&item.ramp!=rampHandle;}),"Ramp/multiply shader state leaked into subsequent draws.");r.receive(bridge::ReleaseTextures,164,releaseRamp.bytes);requireCPU(!r.textures.contains(80),"Released particle ramp remained allocated.");
    Payload referencedTexture;referencedTexture.words({1,1,50});rejected=false;
    try{r.receive(bridge::ReleaseTextures,23,referencedTexture.bytes);}catch(const std::runtime_error&){rejected=true;}
    requireCPU(rejected&&r.textures.contains(50),"Referenced native texture was released.");
    Payload removeSky;removeSky.words({1,1,32});r.receive(bridge::Remove,24,removeSky.bytes);r.receive(bridge::ReleaseTextures,25,referencedTexture.bytes);
    requireCPU(!r.meshes.contains(32)&&!r.textures.contains(50),"Obsolete geometry kept its orphaned native texture.");
    Payload pause;pause.words({1,8,0});r.receive(bridge::RenderControl,26,pause.bytes);const auto beforePaused=mock::draws;r.render(0,800,450,false);
    requireCPU(mock::draws==beforePaused&&!r.presentationReady&&r.presentationRevision==8,"Source fallback did not pause embedded GPU drawing.");
    const auto packed=bridge::frameHeader(5,2,2,3,7);requireCPU(packed[0]==0x31464e42&&packed[1]==2&&packed[6]==24&&packed[7]==1&&packed[8]==7,"Native frame wire format differs.");
    rejected=false;try{bridge::frameHeader(0,0,8192,8192);}catch(const std::runtime_error&){rejected=true;}requireCPU(rejected,"Oversized native frame was accepted.");
    bridge::FrameReadback readback;bridge::FramePipe noPipe("");readback.capture(r.targets.framebuffer,1,2,2,0);readback.capture(r.targets.framebuffer,1,2,2,.02);readback.capture(r.targets.framebuffer,1,2,2,.04);readback.capture(r.targets.framebuffer,1,2,2,.06);
    requireCPU(readback.jobs.size()==3&&readback.dropped==1,"Frame readback job limit was not retained.");
    readback.poll(noPipe,1);requireCPU(readback.jobs.size()==3&&mock::gpuCopies==0,"Unsignaled GPU frames were copied or removed.");
    readback.poll(noPipe,2);requireCPU(readback.jobs.empty()&&mock::fences.empty(),"Scene change kept stale GPU frame jobs.");
    readback.capture(r.targets.framebuffer,2,2,2,.08,7);readback.poll(noPipe,2,8);
    requireCPU(readback.jobs.empty()&&mock::fences.empty()&&mock::gpuCopies==0,"Old presentation revision retained a stale frame job.");
    rejected=false;try{r.targets.resize(16384,16384);}catch(const std::runtime_error&){rejected=true;}
    requireCPU(rejected&&r.targets.width==800,"Oversized frame targets damaged the working allocation.");
    const auto report=r.status();requireCPU(report.find("native-gbuffer-v3")!=std::string::npos&&report.find("\"minecraftShaderpackLoaded\":false")!=std::string::npos,"Pipeline status overstates pack support.");
    requireCPU(!r.targets.history.allocated()&&!r.previousWorld.valid&&std::none_of(mock::blits.begin(),mock::blits.end(),[](const auto& copy){return copy.mask==GL_COLOR_BUFFER_BIT;}),"Unused temporal history allocated textures or performed color copies.");
    const auto completedHistory=[](const bridge::Renderer& renderer){const auto next=renderer.cameraHistory.prepare(renderer.view,renderer.projection,renderer.camera,renderer.sourceOrigin,renderer.originKnown,renderer.halfZ,renderer.targets.width,renderer.targets.height,renderer.cameraFrame.seconds);return renderer.targets.history.previous(next,renderer.reverseDepth);};
    {
        bridge::Renderer grouped;grouped.initialize();Payload groupReset;groupReset.words({42});grouped.receive(bridge::Reset,1,groupReset.bytes);
        Payload groupCamera;groupCamera.words({42,0,640,360});groupCamera.matrix(glm::mat4(1));groupCamera.matrix(glm::mat4(1));groupCamera.floats({0,0,0,.1f,.2f,.3f,1});grouped.receive(bridge::Camera,2,groupCamera.bytes);grouped.environment=r.environment;
        for(const auto id:{100u,101u,102u,103u,104u,105u}){auto geometry=mesh;const uint32_t epoch=42,textureId=0,flags=id==105?4:id>=103?2:0;
            std::memcpy(geometry.bytes.data(),&epoch,4);std::memcpy(geometry.bytes.data()+4,&id,4);std::memcpy(geometry.bytes.data()+8,&textureId,4);std::memcpy(geometry.bytes.data()+12,&flags,4);
            if(id==101){float translated=5;std::memcpy(geometry.bytes.data()+24+12*4,&translated,4);}grouped.receive(bridge::Mesh,3,geometry.bytes);}
        auto sourceView=glm::translate(glm::mat4(1),glm::vec3(-5,0,0)),sourceProjection=glm::mat4(1);sourceProjection[0][0]=2;
        auto drawPayload=[&](uint32_t id,int group,uint32_t flags,uint32_t order,double alpha,double sort,glm::vec3 center=glm::vec3(0)){
            Payload p;p.words({42,id,static_cast<uint32_t>(group+1),flags,order,0});if(flags&1){p.matrix(sourceView);p.matrix(sourceProjection);p.floats({5,0,0});}if(flags&16)p.floats({center.x,center.y,center.z});p.add(alpha);p.add(sort);return p;
        };
        auto setDraw=[&](uint32_t id,int group,uint32_t flags,uint32_t order,double alpha,double sort,glm::vec3 center=glm::vec3(0)){const auto p=drawPayload(id,group,flags,order,alpha,sort,center);grouped.receive(bridge::DrawState,4,p.bytes);};
        const double maximum=std::numeric_limits<double>::max();
        setDraw(100,0,0,0,maximum,1);setDraw(101,1,1|2|4|8,1,maximum,9007199254740991.0);setDraw(102,2,2,2,maximum,1);setDraw(103,0,16,3,-maximum,123,{10,0,0});setDraw(104,0,16,4,maximum,12,{20,0,0});setDraw(105,-1,0,5,maximum,0);
        requireCPU(grouped.meshes.at(101).renderState.sort==9007199254740991.0&&grouped.meshes.at(103).renderState.alpha==-maximum,"Double draw ordering lost source precision.");
        const auto validHand=grouped.meshes.at(101).renderState;const auto validDraw=drawPayload(101,1,15,1,maximum,9007199254740991.0);
        for(const auto& [offset,value]:std::vector<std::pair<size_t,uint32_t>>{{8,5},{12,256},{12,64|128},{12,8},{16,1000001}}){auto bad=validDraw;std::memcpy(bad.bytes.data()+offset,&value,4);bool failed=false;try{grouped.receive(bridge::DrawState,5,bad.bytes);}catch(const std::runtime_error&){failed=true;}requireCPU(failed&&grouped.meshes.at(101).renderState.projection==validHand.projection,"Invalid group flags/order modified live draw state.");}
        auto mixedHand=validDraw;const uint32_t worldGroup=1;std::memcpy(mixedHand.bytes.data()+8,&worldGroup,4);bool mixedRejected=false;try{grouped.receive(bridge::DrawState,5,mixedHand.bytes);}catch(const std::runtime_error&){mixedRejected=true;}requireCPU(mixedRejected&&grouped.meshes.at(101).renderState.group==1,"Hand rendering in the world-depth group was accepted.");
        for(const auto offset:{24u,88u}){auto bad=validDraw;std::fill_n(bad.bytes.begin()+offset,64,uint8_t{0});bool failed=false;try{grouped.receive(bridge::DrawState,5,bad.bytes);}catch(const std::runtime_error&){failed=true;}requireCPU(failed&&grouped.meshes.at(101).renderState.view==validHand.view,"Singular per-draw camera modified live state.");}
        for(const auto offset:{validDraw.bytes.size()-16,validDraw.bytes.size()-8}){auto bad=validDraw;const double infinity=std::numeric_limits<double>::infinity();std::memcpy(bad.bytes.data()+offset,&infinity,8);bool failed=false;try{grouped.receive(bridge::DrawState,5,bad.bytes);}catch(const std::runtime_error&){failed=true;}requireCPU(failed&&grouped.meshes.at(101).renderState.alpha==maximum,"Nonfinite double ordering modified live state.");}
        auto shortDraw=validDraw;shortDraw.bytes.pop_back();bool shortRejected=false;try{grouped.receive(bridge::DrawState,5,shortDraw.bytes);}catch(const std::runtime_error&){shortRejected=true;}requireCPU(shortRejected,"Truncated per-draw contract was accepted.");
        const auto firstGroupDraw=mock::geometryDraws.size(),firstClear=mock::depthClearDraws.size(),firstCopy=mock::depthCopyDraws.size();grouped.render(0,640,360);
        const auto sceneDraw=[&](uint32_t id,size_t start){return std::find_if(mock::geometryDraws.begin()+start,mock::geometryDraws.end(),[&](const auto& draw){return draw.vao==grouped.meshes.at(id).vao&&!draw.shadow;});};
        const auto skyDraw=sceneDraw(105,firstGroupDraw),worldDraw=sceneDraw(100,firstGroupDraw),handDraw=sceneDraw(101,firstGroupDraw),afterHand=sceneDraw(102,firstGroupDraw);
        requireCPU(skyDraw!=mock::geometryDraws.end()&&worldDraw!=mock::geometryDraws.end()&&handDraw!=mock::geometryDraws.end()&&afterHand!=mock::geometryDraws.end(),"Group-specific frustum incorrectly culled observed hand geometry.");
        requireCPU(skyDraw<worldDraw&&worldDraw<handDraw&&handDraw<afterHand,"Negative sky/world/hand group order differs.");
        requireCPU(handDraw->attachments==1&&handDraw->view==sourceView&&handDraw->projection[2][2]==2&&handDraw->projection[3][2]==-1&&handDraw->inverseView[3][0]==5&&handDraw->camera==glm::vec3(5,0,0),"Observed hand camera/depth convention or scene-only targets differ.");
        requireCPU(afterHand->attachments==6&&afterHand->view==glm::mat4(1)&&afterHand->projection==glm::mat4(1)&&afterHand->inverseView==glm::mat4(1)&&afterHand->camera==glm::vec3(0),"Hand camera or scene-only targets leaked into the next group.");
        requireCPU(std::none_of(mock::geometryDraws.begin()+firstGroupDraw,mock::geometryDraws.end(),[&](const auto& draw){return draw.vao==grouped.meshes.at(101).vao&&draw.shadow;}),"Camera-attached hand became a world shadow caster.");
        requireCPU(std::count(mock::depthClearTargets.begin()+firstClear,mock::depthClearTargets.end(),grouped.targets.framebuffer)==3&&mock::depthCopyDraws.size()==firstCopy+1&&mock::depthCopyDraws.back()<static_cast<size_t>(handDraw-mock::geometryDraws.begin()),"Group clears overwrote retained world depth or copied hand depth.");
        requireCPU(sceneDraw(103,firstGroupDraw)<sceneDraw(104,firstGroupDraw),"Default alphaIndex sorting was replaced by distance sorting.");
        for(const auto policy:{0u,32u,128u}){
            setDraw(100,0,policy,0,0,1);setDraw(103,0,16|policy,3,0,123,{10,0,0});setDraw(104,0,16|policy,4,0,12,{20,0,0});const auto at=mock::geometryDraws.size();grouped.render(0,640,360);
            const bool early=sceneDraw(103,at)<sceneDraw(104,at);requireCPU(early==(policy==128),"Source distance/material/front sort policy differs.");
        }
        const auto originalTargets=grouped.targets.colors;grouped.temporalHistoryRequired=true;
        const auto historyStart=mock::geometryDraws.size();grouped.render(0,640,360);
        const auto worldSnapshot=completedHistory(grouped);const auto historyHand=sceneDraw(101,historyStart);
        const auto historyOpaque=sceneDraw(100,historyStart),historyTransparent=sceneDraw(104,historyStart);
        requireCPU(worldSnapshot.valid&&!grouped.previousWorld.valid&&grouped.targets.colors==originalTargets,"Lazy history replaced geometry targets or exposed uninitialized prior pixels.");
        requireCPU(worldSnapshot.color!=grouped.targets.colors[0]&&worldSnapshot.opaqueDepth!=grouped.targets.opaqueDepth&&worldSnapshot.color!=worldSnapshot.opaqueDepth,"History samples alias live scene/depth textures.");
        requireCPU(mock::images.at(worldSnapshot.color).format==GL_RGBA16F&&mock::images.at(worldSnapshot.opaqueDepth).format==GL_DEPTH_COMPONENT32F,"History did not preserve HDR color and exact 32F depth storage.");
        requireCPU(mock::images.at(worldSnapshot.color).stamp==static_cast<uint64_t>(historyTransparent-mock::geometryDraws.begin()+1),("World color history stamp differs: "+std::to_string(mock::images.at(worldSnapshot.color).stamp)+" instead of "+std::to_string(historyTransparent-mock::geometryDraws.begin()+1)).c_str());
        requireCPU(mock::images.at(worldSnapshot.opaqueDepth).stamp==static_cast<uint64_t>(historyOpaque-mock::geometryDraws.begin()+1),("Opaque depth history stamp differs: "+std::to_string(mock::images.at(worldSnapshot.opaqueDepth).stamp)+" instead of "+std::to_string(historyOpaque-mock::geometryDraws.begin()+1)).c_str());
        requireCPU(mock::blits.back().mask==GL_DEPTH_BUFFER_BIT&&mock::blits.back().source==grouped.targets.opaqueFramebuffer&&mock::blits.back().draws==static_cast<size_t>(historyHand-mock::geometryDraws.begin()),"History depth was captured after hand drawing or from mutable scene depth.");
        const auto texturesBeforeHistory=mock::textureAllocations,queriesBeforeHistory=mock::integerQueries;
        grouped.render(0,640,360);const auto secondSnapshot=completedHistory(grouped);
        requireCPU(grouped.previousWorld.valid&&grouped.previousWorld.color==worldSnapshot.color&&secondSnapshot.color!=worldSnapshot.color&&secondSnapshot.opaqueDepth!=worldSnapshot.opaqueDepth,"History slots do not separate previous sampling from current writes.");
        grouped.render(0,640,360);requireCPU(completedHistory(grouped).color==worldSnapshot.color&&grouped.previousWorld.color==secondSnapshot.color&&mock::textureAllocations==texturesBeforeHistory&&mock::integerQueries==queriesBeforeHistory,"Steady history reallocates resources, queries limits or does not ping-pong.");
        auto wrongFrame=grouped.cameraFrame;wrongFrame.historyValid=true;wrongFrame.counter+=2;requireCPU(!grouped.targets.history.previous(wrongFrame,grouped.reverseDepth).valid,"Nonconsecutive frame accepted stale history.");
        const auto colorBeforeRelease=completedHistory(grouped).color,depthBeforeRelease=completedHistory(grouped).opaqueDepth;
        const auto copiesBeforeDisable=mock::blits.size(),texturesBeforeDisable=mock::deletedTextures.size(),framebuffersBeforeDisable=mock::deletedFramebuffers.size();grouped.temporalHistoryRequired=false;grouped.render(0,640,360);
        requireCPU(!grouped.targets.history.allocated()&&!grouped.previousWorld.valid&&grouped.targets.colors==originalTargets&&mock::blits.size()==copiesBeforeDisable+1&&mock::deletedTextures.size()==texturesBeforeDisable+4&&mock::deletedFramebuffers.size()==framebuffersBeforeDisable+2&&std::find(mock::deletedTextures.begin(),mock::deletedTextures.end(),colorBeforeRelease)!=mock::deletedTextures.end()&&std::find(mock::deletedTextures.begin(),mock::deletedTextures.end(),depthBeforeRelease)!=mock::deletedTextures.end(),"Disabling history retained memory/copies or replaced live geometry targets.");
        const auto texturesBeforeFailedEnable=mock::deletedTextures.size();mock::framebufferChecksBeforeFailure=1;bool failedEnable=false;
        try{grouped.targets.resize(640,360,true);}catch(const std::runtime_error&){failedEnable=true;}
        requireCPU(failedEnable&&!grouped.targets.history.allocated()&&grouped.targets.colors==originalTargets&&mock::deletedTextures.size()==texturesBeforeFailedEnable+4,"Failed lazy history allocation damaged working targets or leaked partial slots.");
        const auto historyCounter=grouped.cameraFrame.counter;requireCPU(grouped.view==glm::mat4(1)&&grouped.camera==glm::vec3(0)&&historyCounter>0,"Per-draw camera overwrote world camera history.");
        Payload groupRebase;groupRebase.words({42});groupRebase.floats({10,0,0});grouped.receive(bridge::Rebase,6,groupRebase.bytes);const auto& rebased=grouped.meshes.at(101).renderState;
        requireCPU(rebased.view[3][0]==-15&&rebased.inverseView[3][0]==15&&rebased.camera.x==15&&grouped.meshes.at(103).renderState.center.x==20,"Origin rebase desynchronized per-draw cameras or source sort centers.");
    }
    {
        bridge::Renderer temporal;temporal.initialize();Payload start;start.words({77});temporal.receive(bridge::Reset,1,start.bytes);
        Payload known;known.words({77,1});known.floats({0,0,0,0,0,0});temporal.receive(bridge::Origin,2,known.bytes);
        auto setCamera=[&](float x,uint32_t flags=0){Payload p;p.words({77,flags,640,360});p.matrix(glm::translate(glm::mat4(1),glm::vec3(-x,0,0)));p.matrix(glm::mat4(1));p.floats({x,0,0,.1f,.2f,.3f,1});temporal.receive(bridge::Camera,3,p.bytes);};setCamera(0);
        auto body=mesh;const uint32_t temporalEpoch=77,bodyId=200,noTexture=0,noFlags=0;std::memcpy(body.bytes.data(),&temporalEpoch,4);std::memcpy(body.bytes.data()+4,&bodyId,4);std::memcpy(body.bytes.data()+8,&noTexture,4);std::memcpy(body.bytes.data()+12,&noFlags,4);temporal.receive(bridge::Mesh,4,body.bytes);
        auto& object=temporal.meshes.at(200);
        const auto drawObject=[&](int width=640,int height=360,bool present=true){const auto first=mock::geometryDraws.size();temporal.render(0,width,height,present);const auto found=std::find_if(mock::geometryDraws.begin()+first,mock::geometryDraws.end(),[&](const auto& d){return d.vao==object.vao&&!d.shadow;});if(found==mock::geometryDraws.end())throw std::runtime_error("Temporal fixture object was not drawn.");return *found;};
        const auto setWorld=[&](float x){Payload p;p.words({77,200});p.matrix(glm::translate(glm::mat4(1),glm::vec3(x,0,0)));temporal.receive(bridge::Transform,5,p.bytes);};
        temporal.temporalHistoryRequired=true;
        const auto first=drawObject();requireCPU(first.motionValid==0&&first.attachments==6&&temporal.targets.colors[bridge::FrameTargets::Motion]&&object.motion.completed&&temporal.motionBudget.used==0&&!temporal.previousWorld.valid&&completedHistory(temporal).valid,"First-frame motion/history was invented or static geometry allocated pose history.");
        setWorld(.2f);const auto moving=drawObject();requireCPU(moving.motionValid==1&&moving.motionPosed==0&&moving.previousWorld==glm::mat4(1)&&moving.world[3][0]==.2f&&temporal.previousWorld.valid&&temporal.previousWorld.frame+1==temporal.cameraFrame.counter,"World motion and color/depth history did not use the same prior successful frame.");
        const auto delta=bridge::backwardMotion(moving.projection*moving.view*moving.world*glm::vec4(0,0,0,1),moving.previousViewProjection*moving.previousWorld*glm::vec4(0,0,0,1),true);requireCPU(glm::length(delta-glm::vec4(-.1f,0,.5f,1))<1e-6f,"Backward UV motion sign/depth differs.");
        setCamera(.1f);const auto cameraMove=drawObject();requireCPU(cameraMove.motionValid==1&&cameraMove.previousViewProjection==glm::mat4(1)&&std::abs(cameraMove.previousWorld[3][0]-.2f)<1e-6f,"Camera motion lost object history.");
        Payload shift;shift.words({77});shift.floats({10,0,0});temporal.receive(bridge::Rebase,6,shift.bytes);const auto rebased=drawObject();const auto currentPoint=rebased.projection*rebased.view*rebased.world*glm::vec4(0,0,0,1),previousPoint=rebased.previousViewProjection*rebased.previousWorld*glm::vec4(0,0,0,1);
        requireCPU(rebased.motionValid==1&&glm::length(bridge::backwardMotion(currentPoint,previousPoint,true)-glm::vec4(0,0,.5f,1))<1e-5f&&temporal.previousWorld.valid,"Known floating origin rebase produced false motion or discarded compatible world history.");
        const auto poseAt=[&](float x,float normalZ=1){Payload p;p.words({77,200,3});p.floats({x,0,0,0,0,normalZ,.5f,0,0,0,0,normalZ,0,.5f,0,0,0,normalZ});return p;};
        auto p1=poseAt(.1f),p2=poseAt(.15f);temporal.receive(bridge::Pose,7,p1.bytes);temporal.receive(bridge::Pose,8,p2.bytes);
        requireCPU(object.motion.previousPose[0].x==0&&object.motion.poseGeneration==1,"Multiple pose packets overwrote the last drawn pose with an intermediate pose.");
        const auto posed=drawObject();requireCPU(posed.motionValid==1&&posed.motionPosed==1&&posed.previousPose==object.previousPoseBuffer&&object.previousPoseBuffer&&temporal.motionBudget.used==96,"Posed motion did not bind its bounded previous-position buffer.");
        requireCPU(mock::bufferBytes[posed.previousPose].size()==48,"Previous pose GPU layout is not std430 vec4 positions.");float uploadedX=99;std::memcpy(&uploadedX,mock::bufferBytes[posed.previousPose].data(),4);requireCPU(uploadedX==0,"GPU previous pose contains an intermediate or current position.");
        const auto previousBuffer=object.previousPoseBuffer;const auto writes=std::count(mock::uploadedBuffers.begin(),mock::uploadedBuffers.end(),previousBuffer);const auto stationary=drawObject();requireCPU(stationary.motionValid==1&&stationary.motionPosed==0&&std::count(mock::uploadedBuffers.begin(),mock::uploadedBuffers.end(),previousBuffer)==writes,"Unchanged pose reuploaded temporal data.");
        const auto normals=poseAt(.15f,.5f);temporal.receive(bridge::Pose,9,normals.bytes);const auto normalsOnly=drawObject();requireCPU(normalsOnly.motionPosed==0&&object.motion.poseGeneration==1,"Normal-only pose changes allocated false position history.");
        auto invalidTemporalPose=p2;const float nan=std::numeric_limits<float>::quiet_NaN();std::memcpy(invalidTemporalPose.bytes.data()+12,&nan,4);bool failed=false;try{temporal.receive(bridge::Pose,10,invalidTemporalPose.bytes);}catch(const std::runtime_error&){failed=true;}requireCPU(failed&&!object.motion.poseDirty&&object.vertices[0]==.15f,"Invalid pose modified temporal history before validation.");
        auto setInstances=[&](float y,float extra){Payload p;p.words({77,200,1});p.matrix(glm::translate(glm::mat4(1),glm::vec3(0,y,0)));p.floats({extra,-1});temporal.receive(bridge::Instances,11,p.bytes);};
        setInstances(0,-1);requireCPU(drawObject().motionValid==0&&drawObject().motionValid==1,"New instance layout did not invalidate and then recover history.");
        setInstances(0,2);requireCPU(drawObject().motionValid==1,"Instance light/atlas-only changes invalidated stable transforms.");
        setInstances(.1f,2);requireCPU(drawObject().motionValid==0&&drawObject().motionValid==1,"Unidentified moving instance slots fabricated motion history.");
        setWorld(100);temporal.render(0,640,360);setWorld(10.2f);requireCPU(drawObject().motionValid==0&&drawObject().motionValid==1,"An object absent from the prior frame retained valid motion.");
        const auto frameBeforePause=object.motion.lastFrame,commitsBeforePause=temporal.targets.history.commits;Payload pauseTemporal;pauseTemporal.words({77,10,0});temporal.receive(bridge::RenderControl,12,pauseTemporal.bytes);requireCPU(!temporal.previousWorld.valid&&!completedHistory(temporal).valid,"Fallback did not immediately invalidate prior images.");temporal.render(0,640,360,false);requireCPU(object.motion.lastFrame==frameBeforePause&&temporal.targets.history.commits==commitsBeforePause,"Paused native drawing committed history.");pauseTemporal.bytes.clear();pauseTemporal.words({77,10,1});temporal.receive(bridge::RenderControl,13,pauseTemporal.bytes);requireCPU(drawObject(640,360,false).motionValid==0&&!temporal.previousWorld.valid&&drawObject(640,360,false).motionValid==1&&temporal.previousWorld.valid,"Fallback resume reused stale history or did not recover.");
        requireCPU(drawObject(800,450).motionValid==0&&!temporal.previousWorld.valid&&drawObject(800,450).motionValid==1&&temporal.previousWorld.valid,"Resize did not invalidate temporal history.");setCamera(10.1f,2);requireCPU(!completedHistory(temporal).valid&&drawObject(800,450).motionValid==0&&!temporal.previousWorld.valid&&drawObject(800,450).motionValid==1&&temporal.previousWorld.valid&&temporal.previousWorld.reverseDepth,"Depth convention change reused stale history.");
        const auto completedFrame=object.motion.lastFrame;const auto completedWorld=object.motion.completedWorld;const auto savedHistory=completedHistory(temporal);const auto savedStamp=mock::images.at(savedHistory.color).stamp;const auto savedCommits=temporal.targets.history.commits;setWorld(10.3f);mock::failComposite=true;failed=false;try{temporal.render(0,800,450);}catch(const std::runtime_error&){failed=true;}
        requireCPU(failed&&object.motion.lastFrame==completedFrame&&object.motion.completedWorld==completedWorld&&completedHistory(temporal).color==savedHistory.color&&mock::images.at(savedHistory.color).stamp==savedStamp&&temporal.targets.history.commits==savedCommits,"Failed composite advanced or overwrote successful history.");
        mock::failHistoryCopy=true;failed=false;try{temporal.render(0,800,450);}catch(const std::runtime_error&){failed=true;}
        requireCPU(failed&&object.motion.lastFrame==completedFrame&&completedHistory(temporal).color==savedHistory.color&&mock::images.at(savedHistory.color).stamp==savedStamp&&temporal.targets.history.commits==savedCommits,"Failed world copy advanced or overwrote completed history.");
        const auto recovered=drawObject(800,450);requireCPU(recovered.motionValid==1&&recovered.previousWorld==completedWorld&&temporal.previousWorld.color==savedHistory.color&&temporal.targets.history.commits==savedCommits+1,"Failed frame replaced the previous successful transform or image.");
        const auto workingFramebuffer=temporal.targets.framebuffer;const auto workingHistory=completedHistory(temporal);const auto deletedBefore=mock::deletedTextures.size();mock::framebufferChecksBeforeFailure=3;
        failed=false;try{temporal.targets.resize(1024,576,true);}catch(const std::runtime_error&){failed=true;}
        requireCPU(failed&&temporal.targets.framebuffer==workingFramebuffer&&completedHistory(temporal).color==workingHistory.color&&mock::deletedTextures.size()==deletedBefore+12,"Partial history resize lost working resources or leaked new textures.");
        failed=false;try{temporal.targets.resize(3840,2160,true);}catch(const std::runtime_error&){failed=true;}
        requireCPU(failed&&temporal.targets.framebuffer==workingFramebuffer&&completedHistory(temporal).color==workingHistory.color,"Combined history/frame-target budget exceeded 512 MiB or destroyed working targets.");
        temporal.render(0,0,0);requireCPU(!temporal.previousWorld.valid&&!completedHistory(temporal).valid&&drawObject(800,450).motionValid==0&&!temporal.previousWorld.valid,"Zero-sized output retained temporal history across a skipped frame.");
        Payload remove;remove.words({77,1,200});temporal.receive(bridge::Remove,14,remove.bytes);requireCPU(temporal.motionBudget.used==0&&std::find(mock::deletedBuffers.begin(),mock::deletedBuffers.end(),previousBuffer)!=mock::deletedBuffers.end(),"Removed mesh leaked its temporal CPU/GPU reservation.");
        start.bytes.clear();start.words({78});temporal.receive(bridge::Reset,15,start.bytes);requireCPU(!temporal.previousWorld.valid&&!completedHistory(temporal).valid,"New scene epoch retained old world images.");
        requireCPU(bridge::backwardMotion({0,0,0,1},{0,0,0,-1},true)==glm::vec4(0)&&bridge::backwardMotion({0,0,0,1},{2,0,0,1},true)==glm::vec4(0)&&bridge::backwardMotion({0,0,0,1},{0,0,0,1},false)==glm::vec4(0),"Invalid/offscreen motion was not marked unknown.");
        bridge::MotionBudget budget;bridge::MeshMotion bounded;bridge::CameraFrame frame;frame.historyValid=true;frame.counter=0;bounded.commit(frame,glm::mat4(1),false);frame.counter=1;
        requireCPU(budget.reserve(bridge::MotionBudget::limit),"Temporal budget reservation failed unexpectedly.");std::vector<float> small(14,0);bounded.beforePose(small,budget);requireCPU(!bounded.prepare(frame,false,1).valid&&budget.used==bridge::MotionBudget::limit,"Exhausted pose budget allocated extra memory or invented motion.");budget.release(bridge::MotionBudget::limit);bounded.commit(frame,glm::mat4(1),false);frame.counter=2;bounded.beforePose(small,budget);requireCPU(bounded.prepare(frame,false,1).valid&&budget.used==32,"Temporal budget did not recover after released reservations.");bounded.release();requireCPU(budget.used==0,"Temporal reservation was not released.");
    }
    requireCPU(std::all_of(mock::geometryDraws.begin(),mock::geometryDraws.end(),[](const auto& d){return !d.shadow&&d.attachments!=1||d.motionValid==0&&d.motionPosed==0;}),"Shadow/hand/particle/translucent draws leaked world motion state.");
    const auto retainedTarget=r.targets.framebuffer;bool rejectedMotionSize=false;try{r.targets.resize(4096,2304);}catch(const std::runtime_error&){rejectedMotionSize=true;}requireCPU(rejectedMotionSize&&r.targets.framebuffer==retainedTarget,"Six-target memory budget did not include motion storage or lost the prior allocation.");
    {bridge::FrameTargets bounded;bounded.resize(3840,2160);const auto original=bounded.colors;bool failed=false;try{bounded.resize(3840,2160,true);}catch(const std::runtime_error&){failed=true;}requireCPU(failed&&bounded.colors==original&&!bounded.history.allocated(),"Optional history reduced the base viewport budget or exceeded its combined cap.");}
    testPostProcess();
    testRenderGraph();
    testGeometryBindings();
    testSourceFrames();
    testGpuParticles();
    testSourceLight();
    testSourceEmission();
    testSourceBlockIdentity();
    testSourceMaterialDefinitions();
    testMinecraftBlockMapping();
    testPackBlockIds();
    testMaterialProperties();
    testPackSources();
    testGlslPreprocessor();
    testGlslTranslation();
    testLinkedPackPrograms();
    testPackProgramUniforms();
    testPackProgramTextures();
    testPackProgramVertices();
    testPackProgramOutputs();
    testCompletePackPass();
    testPackImageLeasesAndTwoPass();
    std::cout<<"PASS: pure CPU bridge contracts including fullscreen target routing, typed clears, persistent ping-pong, mips, embedded effect resolve, successful-frame motion and HDR/32F world history, failure recovery and shared memory limits. No graphics context or client started.\n";return 0;
}catch(const std::exception& error){std::cerr<<error.what()<<'\n';return 1;}}
