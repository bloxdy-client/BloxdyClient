#pragma once
#include "bridge_render_graph.hpp"
#include "bridge_iris.hpp"
#include "bridge_material.hpp"
#include <map>

namespace bridge {
// Separate VAO: binding an Iris program never rewrites an imported/native VAO.
class GeometryBinding {
    GLuint vao=0;
    static void require(bool ok,const char* message){if(!ok)throw std::runtime_error(message);}
public:
    GeometryBinding()=default;GeometryBinding(const GeometryBinding&)=delete;GeometryBinding& operator=(const GeometryBinding&)=delete;
    void release(){if(vao)nativegl::glDeleteVertexArrays(1,&vao);if(identity)nativegl::glDeleteBuffers(1,&identity);vao=identity=0;}
    ~GeometryBinding(){release();}
    static void validate(const IrisGeometryProgram& p){
        require(p.handProjection==HandProjectionMode::Reference||p.handProjection==HandProjectionMode::ObservedSource,"Unknown hand projection provenance mode.");
        require(!p.program.compute&&!p.program.outputs.empty()&&(p.program.outputKinds.empty()||p.program.outputKinds.size()==p.program.outputs.size()),"Invalid geometry program/output descriptor.");
        const auto handle=p.program.handle;GLint linked=0,blocks=0,storage=0,atomic=0;
        nativegl::glGetProgramiv(handle,GL_LINK_STATUS,&linked);require(linked,"Unlinked Iris geometry program.");
        nativegl::glGetProgramiv(handle,GL_ACTIVE_UNIFORM_BLOCKS,&blocks);
        nativegl::glGetProgramInterfaceiv(handle,GL_SHADER_STORAGE_BLOCK,GL_ACTIVE_RESOURCES,&storage);
        nativegl::glGetProgramInterfaceiv(handle,GL_ATOMIC_COUNTER_BUFFER,GL_ACTIVE_RESOURCES,&atomic);
        require(!blocks&&!storage&&!atomic,"Geometry buffer blocks are not supported by this binding contract.");
        GLsizei count=0;GLuint shaders[6]{};nativegl::glGetAttachedShaders(handle,6,&count,shaders);
        bool vertex=false,fragment=false;
        for(int i=0;i<count;++i){GLint kind=0;nativegl::glGetShaderiv(shaders[i],GL_SHADER_TYPE,&kind);
            if(kind==GL_VERTEX_SHADER)vertex=true;else if(kind==GL_FRAGMENT_SHADER)fragment=true;else throw std::runtime_error("Unsupported geometry/tessellation/compute shader in geometry slot.");}
        require(vertex&&fragment,"Geometry requires attached vertex and fragment stages for validation.");
        std::map<GLint,GLenum> expectedUniforms,expectedAttributes;std::array<bool,16> used{},units{};
        auto uniform=[&](const std::string& name,GLint location,GLenum type){
            require(!name.empty()&&location>=0&&nativegl::glGetUniformLocation(handle,name.c_str())==location,"Geometry uniform name/location mismatch.");
            require(expectedUniforms.emplace(location,type).second,"Duplicate geometry uniform location.");};
        for(const auto& u:p.uniforms){if(u.value>=GeometryUniform::SourceLightingEnabled&&u.value<=GeometryUniform::SourceBlockState)require(u.name.rfind("source",0)==0,"Source data cannot impersonate reference uniforms.");
            if(u.value==GeometryUniform::PackBlockId)require(u.name=="packBlockId","Pack block ID requires its explicit internal integer binding.");uniform(u.name,u.location,geometryUniformType(u.value));
            if(u.validity>=0)uniform(u.validityName,u.validity,GL_BOOL);else require(u.validityName.empty(),"Missing geometry validity location.");}
        for(const auto& s:p.samplers){require(s.unit<16&&!units[s.unit],"Duplicate geometry texture unit.");units[s.unit]=true;
            uniform(s.name,s.location,s.value==GeometrySampler::Array?GL_SAMPLER_2D_ARRAY:GL_SAMPLER_2D);}
        for(const auto& in:p.program.inputs){require(in.unit<16&&!units[in.unit],"Geometry graph/source sampler unit collision.");units[in.unit]=true;
            const auto type=in.samplerKind==ColorFormat::Signed?GL_INT_SAMPLER_2D:in.samplerKind==ColorFormat::Unsigned?GL_UNSIGNED_INT_SAMPLER_2D:GL_SAMPLER_2D;
            require(in.uniform>=0&&expectedUniforms.emplace(in.uniform,type).second,"Duplicate graph uniform.");}
        for(const auto& a:p.attributes){const unsigned columns=a.value==GeometryAttribute::InstanceMatrix?4:1;
            require(a.name!="mc_Entity"&&a.name!="vaUV1","Minecraft semantic/overlay attribute is unknown.");
            require((a.name!="vaUV2"&&a.name!="gl_MultiTexCoord1")||a.value!=GeometryAttribute::SourceLightmap,"Source RGB light is not authoritative Minecraft lightmap data.");
            require(a.location+columns<=16&&!a.name.empty()&&nativegl::glGetAttribLocation(handle,a.name.c_str())==static_cast<GLint>(a.location),"Geometry attribute name/location mismatch.");
            for(unsigned i=0;i<columns;++i){require(!used[a.location+i],"Overlapping geometry attribute locations.");used[a.location+i]=true;}
            expectedAttributes.emplace(a.location,geometryAttributeType(a.value));}
        auto reflect=[&](bool attribute){GLint n=0;nativegl::glGetProgramiv(handle,attribute?GL_ACTIVE_ATTRIBUTES:GL_ACTIVE_UNIFORMS,&n);
            auto remaining=attribute?expectedAttributes:expectedUniforms;
            for(GLint i=0;i<n;++i){char name[256]{};GLsizei length=0;GLint size=0;GLenum type=0;
                if(attribute)nativegl::glGetActiveAttrib(handle,i,256,&length,&size,&type,name);else nativegl::glGetActiveUniform(handle,i,256,&length,&size,&type,name);
                require(length>0&&length<255&&size==1,"Unsupported geometry array/long resource name.");
                const auto location=attribute?nativegl::glGetAttribLocation(handle,name):nativegl::glGetUniformLocation(handle,name);
                auto found=remaining.find(location);require(found!=remaining.end()&&found->second==type,"Undeclared or mistyped active geometry resource.");remaining.erase(found);
            }
            require(remaining.empty(),"Declared geometry resource is not active.");
        };reflect(true);reflect(false);
        GLint outputs=0;nativegl::glGetProgramInterfaceiv(handle,GL_PROGRAM_OUTPUT,GL_ACTIVE_RESOURCES,&outputs);
        require(outputs==static_cast<GLint>(p.program.outputs.size()),"Geometry fragment output count differs from routing.");
        std::vector<bool> locations(outputs,false);
        for(GLint i=0;i<outputs;++i){const GLenum properties[3]={GL_LOCATION,GL_TYPE,GL_ARRAY_SIZE};GLint values[3]{};
            nativegl::glGetProgramResourceiv(handle,GL_PROGRAM_OUTPUT,i,3,properties,3,nullptr,values);
            require(values[0]>=0&&values[0]<outputs&&values[2]==1&&!locations[values[0]],"Unsupported geometry output array/location.");locations[values[0]]=true;
            const auto expected=p.program.outputKinds.empty()?ColorFormat::Floating:p.program.outputKinds.at(values[0]);const GLenum type=values[1];
            const bool floating=type==GL_FLOAT||type==GL_FLOAT_VEC2||type==GL_FLOAT_VEC3||type==GL_FLOAT_VEC4;
            const bool signedInt=type==GL_INT||type==GL_INT_VEC2||type==GL_INT_VEC3||type==GL_INT_VEC4;
            const bool unsignedInt=type==GL_UNSIGNED_INT||type==GL_UNSIGNED_INT_VEC2||type==GL_UNSIGNED_INT_VEC3||type==GL_UNSIGNED_INT_VEC4;
            require(expected==ColorFormat::Floating?floating:expected==ColorFormat::Signed?signedInt:unsignedInt,"Geometry fragment numeric output mismatch.");
        }
        nativegl::check("Iris geometry reflection");
    }
    template<class Mesh> void attributes(const IrisGeometryProgram& p,const Mesh& mesh){
        if(!vao)nativegl::glGenVertexArrays(1,&vao);nativegl::glBindVertexArray(vao);
        for(GLuint i=0;i<16;++i){nativegl::glDisableVertexAttribArray(i);nativegl::glVertexAttribDivisor(i,0);}
        nativegl::glBindBuffer(GL_ELEMENT_ARRAY_BUFFER,mesh.ebo);
        bool position=false,instance=false,instanceUniform=false;
        for(const auto& u:p.uniforms)instanceUniform|=u.value==GeometryUniform::Instanced;
        for(const auto& a:p.attributes){using A=GeometryAttribute;GLuint buffer=mesh.vbo,divisor=0;GLsizei stride=56;GLint size=0;size_t offset=0;bool integer=false;
            switch(a.value){
            case A::Position:size=3;position=true;break;case A::Normal:size=3;offset=12;break;
            case A::UV:size=2;offset=24;break;case A::Color:size=4;offset=32;break;
            case A::Layer:size=1;offset=48;break;case A::PackedLight:size=1;offset=52;break;
            case A::SourceSurface:buffer=mesh.surfaces;stride=8;size=2;break;
            case A::InstanceMatrix:case A::InstanceExtras:
                instance|=a.value==A::InstanceMatrix;
                // Non-instanced draws have an explicit identity instance buffer.
                buffer=mesh.instances?mesh.instances:identityInstance();stride=72;divisor=1;size=a.value==A::InstanceMatrix?4:2;offset=a.value==A::InstanceMatrix?0:64;break;
            case A::Tangent:buffer=mesh.irisBuffer;stride=sizeof(IrisVertex);size=4;break;
            case A::Midpoint:require(mesh.iris.quadMidpointsComplete,"Quad midpoint is unknown.");buffer=mesh.irisBuffer;stride=sizeof(IrisVertex);size=2;offset=16;break;
            case A::MidBlock:require(mesh.iris.blockCentersComplete,"Block center is unknown.");buffer=mesh.irisBuffer;stride=sizeof(IrisVertex);size=4;offset=24;break;
            case A::SourceLightmap:buffer=mesh.irisLightBuffer;stride=8;size=2;integer=true;break;
            default:throw std::runtime_error("Unknown geometry attribute semantic.");
            }
            require(buffer&&mesh.ebo,"Missing geometry vertex/index storage.");nativegl::glBindBuffer(GL_ARRAY_BUFFER,buffer);
            const unsigned columns=a.value==A::InstanceMatrix?4:1;
            for(unsigned i=0;i<columns;++i){const auto location=a.location+i;nativegl::glEnableVertexAttribArray(location);
                if(integer)nativegl::glVertexAttribIPointer(location,size,GL_INT,stride,reinterpret_cast<void*>(offset));
                else nativegl::glVertexAttribPointer(location,size,GL_FLOAT,GL_FALSE,stride,reinterpret_cast<void*>(offset+i*16));
                nativegl::glVertexAttribDivisor(location,divisor);}
        }
        require(position&&(!mesh.instances||instance&&instanceUniform),"Missing position or instancing contract.");
    }
    template<class Mesh> void instanceOffset(const IrisGeometryProgram& p,const Mesh& mesh,uint32_t first){
        require(mesh.instances&&first<static_cast<uint32_t>(mesh.instanceCount),"Invalid source emission instance range.");
        nativegl::glBindBuffer(GL_ARRAY_BUFFER,mesh.instances);
        for(const auto& a:p.attributes){const bool matrix=a.value==GeometryAttribute::InstanceMatrix;
            if(!matrix&&a.value!=GeometryAttribute::InstanceExtras)continue;
            for(unsigned i=0;i<(matrix?4u:1u);++i)nativegl::glVertexAttribPointer(a.location+i,matrix?4:2,GL_FLOAT,GL_FALSE,72,
                reinterpret_cast<void*>(static_cast<uintptr_t>(first)*72+(matrix?i*16:64)));}
    }
    // Draw-constant source data: validity never crosses the raster interpolator.
    // Subsequent index runs only change these uniforms, not VAOs or samplers.
    void bindOwnEmission(const IrisGeometryProgram& p,uint32_t value){
        const bool known=(value&4096)!=0;const glm::vec3 rgb=known?glm::vec3(value&15,(value>>4)&15,(value>>8)&15):glm::vec3(0);
        for(const auto& u:p.uniforms)if(u.value==GeometryUniform::SourceOwnEmissionRgb){
            require(known||u.validity>=0,"Required source emission is unknown for an index run.");
            if(u.validity>=0)nativegl::glUniform1i(u.validity,known?1:0);
            nativegl::glUniform3fv(u.location,1,glm::value_ptr(rgb));}
    }
    void bindSourceBlock(const IrisGeometryProgram& p,uint32_t block,bool known){
        require(!known||block<=65535,"Invalid raw source block ID.");
        for(const auto& u:p.uniforms)if(u.value==GeometryUniform::SourceBlockId){
            require(known||u.validity>=0,"Required source block identity is unknown for a draw run.");
            if(u.validity>=0)nativegl::glUniform1i(u.validity,known?1:0);
            nativegl::glUniform1i(u.location,known?static_cast<GLint>(block):0);}
    }
    void bindSourceMaterial(const IrisGeometryProgram& p,const SourceBlockMaterial* m){
        for(const auto& u:p.uniforms)if(u.value>=GeometryUniform::SourceBlockRootId&&u.value<=GeometryUniform::SourceBlockState){
            require(m||u.validity>=0,"Required source material definition is unknown for a draw run.");
            if(u.validity>=0)nativegl::glUniform1i(u.validity,m?1:0);
            if(u.value==GeometryUniform::SourceBlockState){const glm::vec3 state=m?glm::vec3(m->rotation,m->open,m->half):glm::vec3(0);nativegl::glUniform3fv(u.location,1,glm::value_ptr(state));}
            else nativegl::glUniform1i(u.location,m?static_cast<int>(u.value==GeometryUniform::SourceBlockRootId?m->rootId:m->flags):0);}
    }
    void bindPackBlock(const IrisGeometryProgram& p,PackBlockId id){
        for(const auto& u:p.uniforms)if(u.value==GeometryUniform::PackBlockId){
            require(id.known||u.validity>=0,"Required pack block material ID is unknown for a draw run.");
            if(u.validity>=0)nativegl::glUniform1i(u.validity,id.known?1:0);
            nativegl::glUniform1i(u.location,id.known?id.value:0);}
    }
    template<class Mesh,class Texture> void bind(const IrisGeometryProgram& p,const Mesh& mesh,Texture* texture,GLuint white,const GeometryMatrices& matrices,const IrisGraph* graph=nullptr){
        require(!(mesh.flags&20)&&!mesh.appearance.flags&&mesh.special==glm::vec4(0)&&!mesh.rampTexture,"Source appearance/sky/particle adapter is not implemented for Iris geometry.");
        for(const auto& u:p.uniforms){using U=GeometryUniform;glm::mat4 m(0);bool known=true;float scalar=0;glm::vec4 vector(0);glm::ivec2 pair(0);int integer=0;
            switch(u.value){
            case U::ModelView:m=matrices.modelView;break;case U::ModelViewInverse:m=CameraHistory::checkedInverse(matrices.modelView);break;
            case U::NormalMatrix:m=glm::transpose(CameraHistory::checkedInverse(matrices.modelView));break;
            case U::Projection:m=matrices.projection;break;case U::ProjectionInverse:m=CameraHistory::checkedInverse(matrices.projection);break;
            case U::GbufferProjection:m=matrices.gbufferProjection;break;case U::GbufferProjectionInverse:m=CameraHistory::checkedInverse(matrices.gbufferProjection);break;
            case U::GbufferModelView:case U::GbufferModelViewInverse:known=matrices.feetKnown;if(known)m=u.value==U::GbufferModelView?matrices.gbufferModelView:CameraHistory::checkedInverse(matrices.gbufferModelView);break;
            case U::PreviousModelView:known=matrices.historyKnown;if(known)m=matrices.previousModelView;break;
            case U::PreviousProjection:known=matrices.historyKnown;if(known)m=matrices.previousProjection;break;
            case U::ShadowModelView:case U::ShadowModelViewInverse:known=matrices.shadowKnown&&matrices.feetKnown;if(known)m=u.value==U::ShadowModelView?matrices.shadowView:CameraHistory::checkedInverse(matrices.shadowView);break;
            case U::ShadowProjection:case U::ShadowProjectionInverse:known=matrices.shadowKnown;if(known)m=u.value==U::ShadowProjection?matrices.shadowProjection:CameraHistory::checkedInverse(matrices.shadowProjection);break;
            case U::SourceLightingEnabled:known=matrices.light.flags&1;if(known)integer=matrices.light.enabled?1:0;break;
            case U::SourceSkyLight:case U::SourceAmbientLight:known=matrices.light.flags&2;if(known)vector=glm::vec4(u.value==U::SourceSkyLight?matrices.light.sky:matrices.light.ambient,0);break;
            case U::SourceHeldLight:case U::SourceHeldVector:known=matrices.light.flags&4;if(known)vector=u.value==U::SourceHeldLight?matrices.light.held:matrices.light.heldVector;break;
            case U::SourceSkySunDirection:known=matrices.light.flags&8;if(known)vector=glm::vec4(matrices.light.sun,0);break;
            case U::SourceOwnEmissionRgb:known=matrices.sourceOwnKnown;if(known)vector=glm::vec4(matrices.sourceOwnRgb,0);break;
            case U::SourceBlockId:known=matrices.sourceBlockKnown;if(known)integer=static_cast<int>(matrices.sourceBlock);break;
            case U::SourceBlockRootId:case U::SourceBlockProperties:known=matrices.sourceMaterial!=nullptr;if(known)integer=static_cast<int>(u.value==U::SourceBlockRootId?matrices.sourceMaterial->rootId:matrices.sourceMaterial->flags);break;
            case U::SourceBlockState:known=matrices.sourceMaterial!=nullptr;if(known)vector=glm::vec4(matrices.sourceMaterial->rotation,matrices.sourceMaterial->open,matrices.sourceMaterial->half,0);break;
            case U::PackBlockId:known=matrices.packBlockId.known;if(known)integer=matrices.packBlockId.value;break;
            case U::TextureMatrix:m=matrices.texture;break;
            case U::LightmapMatrix:m=glm::mat4(1);m[0][0]=m[1][1]=m[2][2]=1.f/256;m[3]=glm::vec4(8.f/256,8.f/256,8.f/256,1);break;
            case U::Instanced:integer=mesh.instances?1:0;break;case U::AlphaCutoff:scalar=mesh.alphaCutoff;break;
            case U::AtlasGrid:case U::AtlasTile:known=texture&&(texture->flags&1);if(known)pair=u.value==U::AtlasGrid?glm::ivec2(texture->atlasLayout.columns,texture->atlasLayout.rows):glm::ivec2(texture->width,texture->height);break;
            default:known=false;break; // world/player/weather/semantic/lightmap/own emission UNKNOWN
            }
            require(known||u.validity>=0,"Required Iris uniform is unknown.");if(u.validity>=0)nativegl::glUniform1i(u.validity,known?1:0);
            switch(geometryUniformType(u.value)){
            case GL_FLOAT_MAT4:nativegl::glUniformMatrix4fv(u.location,1,GL_FALSE,glm::value_ptr(m));break;
            case GL_FLOAT_MAT3:{const glm::mat3 normal(m);nativegl::glUniformMatrix3fv(u.location,1,GL_FALSE,glm::value_ptr(normal));break;}
            case GL_INT:nativegl::glUniform1i(u.location,integer);break;
            case GL_FLOAT:nativegl::glUniform1f(u.location,scalar);break;
            case GL_FLOAT_VEC3:nativegl::glUniform3fv(u.location,1,glm::value_ptr(vector));break;
            case GL_INT_VEC2:nativegl::glUniform2i(u.location,pair.x,pair.y);break;
            default:nativegl::glUniform4fv(u.location,1,glm::value_ptr(vector));break;
            }
        }
        bool materialSampler=false;
        for(const auto& s:p.samplers){GLuint id=0;GLenum target=GL_TEXTURE_2D;
            switch(s.value){
            case GeometrySampler::Texture:require(!texture||!(texture->flags&9),"Plain sampler cannot consume array/cube textures.");id=texture?texture->handle:white;materialSampler=true;break;
            case GeometrySampler::Atlas:
                require(texture&&(texture->flags&1),"Atlas sampler has no source atlas.");
                require(!(texture->flags&16)&&!texture->sampler.mipmaps,"Source sRGB/mip atlas needs a dedicated Iris atlas adapter.");
                for(size_t i=0;i<mesh.vertices.size();i+=14){const auto uv=mesh.drawState.textureCoordinates({mesh.vertices[i+6],mesh.vertices[i+7]});require(uv.x>=0&&uv.y>=0&&uv.x<=1&&uv.y<=1,"Tiled UVs need a repeating Iris atlas adapter.");}
                id=texture->atlas;materialSampler=true;break;
            case GeometrySampler::Array:require(texture&&(texture->flags&1),"Array sampler has no source array.");id=texture->handle;target=GL_TEXTURE_2D_ARRAY;materialSampler=true;break;
            default:throw std::runtime_error("Required lightmap/PBR texture is unknown.");
            }
            require(id!=0,"Missing Iris material texture.");if(graph)graph->validateGeometrySample(id);
            nativegl::glActiveTexture(GL_TEXTURE0+s.unit);nativegl::glBindSampler(s.unit,0);nativegl::glBindTexture(target,id);nativegl::glUniform1i(s.location,s.unit);
            if(texture&&s.value==GeometrySampler::Texture){
                nativegl::glTexParameteri(target,GL_TEXTURE_WRAP_S,MaterialDrawState::wrap(mesh.drawState.wrapU));
                nativegl::glTexParameteri(target,GL_TEXTURE_WRAP_T,MaterialDrawState::wrap(mesh.drawState.wrapV));
                texture->wrapU=static_cast<int>(mesh.drawState.wrapU);texture->wrapV=static_cast<int>(mesh.drawState.wrapV);
            }
        }
        require(!mesh.texture||materialSampler,"Textured source has no material sampler binding.");
        attributes(p,mesh);nativegl::check("Iris vertex/uniform/material bindings");
    }
private:
    GLuint identity=0;
    GLuint identityInstance(){
        if(!identity){std::array<float,18> data{};for(int i=0;i<4;++i)data[i*5]=1;data[16]=data[17]=-1;
            nativegl::glGenBuffers(1,&identity);nativegl::glBindBuffer(GL_ARRAY_BUFFER,identity);nativegl::glBufferData(GL_ARRAY_BUFFER,sizeof(data),data.data(),GL_STATIC_DRAW);}
        return identity;
    }
};
}
