'use strict';
const assert=require('node:assert/strict');
function fakeGl(){
  let id=0,active=1000,program=null,drawFbo=null,readFbo=null,vao=null,array=null,viewport=[0,0,800,600];
  const textures=new Map(),textureParameters=new Map(),samplers=new Map(),caps=new Set(),values=new Map(),events=new Map(),calls=[],allocations=new Map();
  const gl={calls,allocations,textureParameters,events,canvas:{addEventListener:(key,fn)=>{const previous=events.get(key);events.set(key,()=>{previous?.();fn();});}}};
  const constants=`ACTIVE_TEXTURE TEXTURE_2D TEXTURE_3D TEXTURE_2D_ARRAY TEXTURE_BINDING_2D TEXTURE_BINDING_3D TEXTURE_BINDING_2D_ARRAY
    TEXTURE_MIN_FILTER TEXTURE_MAG_FILTER TEXTURE_COMPARE_MODE TEXTURE_COMPARE_FUNC COMPARE_REF_TO_TEXTURE LEQUAL NEAREST LINEAR
    TEXTURE_WRAP_S TEXTURE_WRAP_T TEXTURE_WRAP_R REPEAT LINEAR_MIPMAP_LINEAR CLAMP_TO_EDGE DEPTH_COMPONENT24 DEPTH_COMPONENT UNSIGNED_INT UNSIGNED_BYTE RGBA8 RGBA RGB
    CURRENT_PROGRAM VERTEX_ARRAY_BINDING ARRAY_BUFFER ARRAY_BUFFER_BINDING ELEMENT_ARRAY_BUFFER ELEMENT_ARRAY_BUFFER_BINDING
    DRAW_FRAMEBUFFER DRAW_FRAMEBUFFER_BINDING READ_FRAMEBUFFER READ_FRAMEBUFFER_BINDING FRAMEBUFFER FRAMEBUFFER_COMPLETE DEPTH_ATTACHMENT
    COLOR_ATTACHMENT0 DEPTH_BUFFER_BIT COLOR_WRITEMASK DEPTH_WRITEMASK DEPTH_FUNC DEPTH_CLEAR_VALUE DEPTH_RANGE
    POLYGON_OFFSET_FACTOR POLYGON_OFFSET_UNITS POLYGON_OFFSET_FILL RASTERIZER_DISCARD STENCIL_TEST DEPTH_TEST CULL_FACE BLEND SCISSOR_TEST SCISSOR_BOX
    MAX_TEXTURE_SIZE MAX_VIEWPORT_DIMS MAX_TEXTURE_IMAGE_UNITS SAMPLER_BINDING VIEWPORT RENDERER NO_ERROR NONE
    VERTEX_SHADER FRAGMENT_SHADER COMPILE_STATUS LINK_STATUS ACTIVE_UNIFORMS ACTIVE_ATTRIBUTES ACTIVE_UNIFORM_BLOCKS
    PIXEL_UNPACK_BUFFER PIXEL_UNPACK_BUFFER_BINDING UNPACK_ALIGNMENT UNPACK_ROW_LENGTH UNPACK_IMAGE_HEIGHT UNPACK_SKIP_ROWS UNPACK_SKIP_PIXELS UNPACK_SKIP_IMAGES
    UNPACK_FLIP_Y_WEBGL UNPACK_PREMULTIPLY_ALPHA_WEBGL FLOAT STATIC_DRAW DYNAMIC_DRAW TRIANGLES LESS
    SAMPLER_2D SAMPLER_CUBE SAMPLER_3D SAMPLER_2D_ARRAY SAMPLER_2D_SHADOW SHADER_TYPE TEXTURE_CUBE_MAP TEXTURE_BINDING_CUBE_MAP
    FLOAT_VEC2 FLOAT_VEC3 FLOAT_VEC4 FLOAT_MAT4 TRANSFORM_FEEDBACK_ACTIVE TRANSFORM_FEEDBACK_PAUSED
    DEPTH_BITS STENCIL_BITS DEPTH24_STENCIL8 DEPTH_STENCIL_ATTACHMENT COLOR_BUFFER_BIT
    BLEND_SRC_RGB BLEND_DST_RGB BLEND_SRC_ALPHA BLEND_DST_ALPHA BLEND_EQUATION_RGB BLEND_EQUATION_ALPHA FUNC_ADD ONE ZERO`.split(/\s+/).filter(Boolean);
  constants.forEach((name,i)=>gl[name]=i+1);gl.TEXTURE0=1000;
  const key=target=>active+':'+target;
  gl.getParameter=p=>{
    if(p===gl.ACTIVE_TEXTURE)return active;if(p===gl.CURRENT_PROGRAM)return program;
    if(p===gl.TEXTURE_BINDING_2D)return textures.get(key(gl.TEXTURE_2D))||null;
    if(p===gl.TEXTURE_BINDING_3D)return textures.get(key(gl.TEXTURE_3D))||null;
    if(p===gl.TEXTURE_BINDING_2D_ARRAY)return textures.get(key(gl.TEXTURE_2D_ARRAY))||null;
    if(p===gl.TEXTURE_BINDING_CUBE_MAP)return textures.get(key(gl.TEXTURE_CUBE_MAP))||null;
    if(p===gl.SAMPLER_BINDING)return samplers.get(active-gl.TEXTURE0)||null;
    if(p===gl.DRAW_FRAMEBUFFER_BINDING)return drawFbo;if(p===gl.READ_FRAMEBUFFER_BINDING)return readFbo;
    if(p===gl.ARRAY_BUFFER_BINDING)return array;if(p===gl.VERTEX_ARRAY_BINDING)return vao;
    if(p===gl.VIEWPORT)return viewport;if(p===gl.MAX_TEXTURE_IMAGE_UNITS)return 16;
    if(p===gl.SCISSOR_BOX)return values.get(p)||[0,0,800,600];
    if(p===gl.MAX_TEXTURE_SIZE)return 4096;if(p===gl.MAX_VIEWPORT_DIMS)return [4096,4096];
    if(p===gl.COLOR_WRITEMASK)return [true,true,true,true];if(p===gl.DEPTH_RANGE)return [0,1];
    if(p===gl.BLEND_SRC_RGB||p===gl.BLEND_SRC_ALPHA)return values.get(p)??gl.ONE;
    if(p===gl.BLEND_DST_RGB||p===gl.BLEND_DST_ALPHA)return values.get(p)??gl.ZERO;
    if(p===gl.BLEND_EQUATION_RGB||p===gl.BLEND_EQUATION_ALPHA)return values.get(p)??gl.FUNC_ADD;
    if(p===gl.RENDERER)return 'CPU mock';return values.get(p)??0;
  };
  gl.activeTexture=v=>active=v;gl.bindTexture=(target,t)=>textures.set(key(target),t);
  gl.bindSampler=(unit,sampler)=>samplers.set(unit,sampler);
  gl.useProgram=p=>program=p;gl.bindVertexArray=v=>vao=v;
  gl.bindBuffer=(target,buffer)=>{if(target===gl.ARRAY_BUFFER)array=buffer;else if(target===gl.PIXEL_UNPACK_BUFFER)values.set(gl.PIXEL_UNPACK_BUFFER_BINDING,buffer);else values.set(target,buffer);};
  gl.bindFramebuffer=(target,f)=>{if(target!==gl.READ_FRAMEBUFFER)drawFbo=f;if(target!==gl.DRAW_FRAMEBUFFER)readFbo=f;};
  gl.viewport=(...v)=>viewport=v;gl.enable=cap=>caps.add(cap);gl.disable=cap=>caps.delete(cap);gl.isEnabled=cap=>caps.has(cap);
  gl.scissor=(...v)=>{values.set(gl.SCISSOR_BOX,v);calls.push(['scissor',...v]);};
  for(const type of ['Texture','Framebuffer','Buffer','VertexArray','Shader','Program'])gl['create'+type]=()=>({type,id:++id});
  for(const type of ['Texture','Framebuffer','Buffer','VertexArray','Shader','Program'])gl['delete'+type]=object=>calls.push(['delete'+type,object]);
  for(const name of ['texParameteri','framebufferTexture2D','drawBuffers','readBuffer','shaderSource','compileShader','attachShader','linkProgram',
    'enableVertexAttribArray','disableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','depthRange','polygonOffset','depthFunc','depthMask','colorMask','clearDepth',
    'bufferData','bindAttribLocation'])gl[name]=(...args)=>calls.push([name,...args]);
  gl.texImage2D=(...args)=>{const texture=textures.get(key(gl.TEXTURE_2D));allocations.set(texture,args);calls.push(['texImage2D',texture,...args]);};
  gl.copyTexImage2D=(target,level,format,x,y,w,h,border)=>{const texture=textures.get(key(target));allocations.set(texture,[target,level,format,w,h,border]);calls.push(['copyTexImage2D',texture,format,w,h]);};
  gl.texParameteri=(target,field,value)=>{const texture=textures.get(key(target));let parameters=textureParameters.get(texture);if(!parameters){parameters=new Map();textureParameters.set(texture,parameters);}parameters.set(field,value);calls.push(['texParameteri',target,field,value]);};
  gl.pixelStorei=(field,value)=>values.set(field,value);
  gl.texStorage2D=(...args)=>{const texture=textures.get(key(gl.TEXTURE_2D));allocations.set(texture,args);calls.push(['texStorage2D',texture,...args]);};
  for(const name of ['blitFramebuffer','copyTexSubImage2D','blendEquationSeparate','blendFuncSeparate','generateMipmap'])gl[name]=(...args)=>calls.push([name,...args]);
  gl.blendFuncSeparate=(...args)=>{[gl.BLEND_SRC_RGB,gl.BLEND_DST_RGB,gl.BLEND_SRC_ALPHA,gl.BLEND_DST_ALPHA].forEach((p,i)=>values.set(p,args[i]));calls.push(['blendFuncSeparate',...args]);};
  gl.blendEquationSeparate=(...args)=>{[gl.BLEND_EQUATION_RGB,gl.BLEND_EQUATION_ALPHA].forEach((p,i)=>values.set(p,args[i]));calls.push(['blendEquationSeparate',...args]);};
  gl.clear=()=>calls.push(['clear',drawFbo]);
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'])gl[name]=()=>calls.push(['draw',drawFbo,program]);
  gl.getError=()=>gl.NO_ERROR;gl.isContextLost=()=>false;gl.getExtension=()=>null;
  gl.checkFramebufferStatus=()=>gl.FRAMEBUFFER_COMPLETE;
  gl.getProgramParameter=(p,key)=>key===gl.LINK_STATUS?true:key===gl.ACTIVE_UNIFORMS?(p.uniforms?.length||0):0;
  gl.getShaderParameter=(shader,key)=>key===gl.SHADER_TYPE?shader.stage:true;
  gl.getActiveUniform=(p,index)=>p.uniforms[index];
  gl.getUniformLocation=(p,name)=>p.strict && !p.uniforms.some(u=>u.name===name)?null:{program:p,name};
  gl.getUniform=(p,loc)=>p.values?.get(loc.name)??0;
  for(const name of ['uniform1f','uniform1i','uniform1iv','uniform1fv','uniform2f','uniform3f','uniform4f','uniform2fv','uniform3fv','uniform4fv','uniformMatrix4fv'])
    gl[name]=(loc,...v)=>{if(loc){assert.equal(loc.program,program,'Uniform belongs to current program');let value=name==='uniformMatrix4fv'?Array.from(v[1]):v.length===1?v[0]:v;if((name==='uniform1iv'||name==='uniform1fv') && value.length===1)value=value[0];values.set(loc.name,value);loc.program.values??=new Map();loc.program.values.set(loc.name,value);}};
  gl.createShader=stage=>({stage,id:++id});gl.shaderSource=(shader,text)=>shader.source=text;
  gl.getShaderSource=shader=>shader.source;gl.attachShader=(p,shader)=>{p.shaders??=[];p.shaders.push(shader);};
  gl.getAttachedShaders=p=>p.shaders||[];
  const typeNames={float:gl.FLOAT,vec2:gl.FLOAT_VEC2,vec3:gl.FLOAT_VEC3,vec4:gl.FLOAT_VEC4,mat4:gl.FLOAT_MAT4,
    sampler2D:gl.SAMPLER_2D,samplerCube:gl.SAMPLER_CUBE,sampler3D:gl.SAMPLER_3D,sampler2DShadow:gl.SAMPLER_2D_SHADOW,sampler2DArray:gl.SAMPLER_2D_ARRAY};
  gl.linkProgram=p=>{p.uniforms=[];p.strict=true;const seen=new Set();for(const shader of p.shaders||[])
    for(const match of shader.source.matchAll(/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(\w+)\s*;/g)){
      if(seen.has(match[2]))continue;seen.add(match[2]);p.uniforms.push({name:match[2],type:typeNames[match[1]],size:1});}};
  gl.uniforms=(p,definitions)=>{p.uniforms=definitions.map(([name,type,size=1])=>({name,type:gl[type],size}));return p;};
  gl.sunProgram=()=>gl.uniforms(gl.createProgram(),['Map','NearMap','LocalMap','DetailMap'].map(key=>['uBvfxSun'+key,'SAMPLER_2D']));
  gl.skyProgram=()=>gl.uniforms(gl.createProgram(),[['uBvfxAtmoSkyCache','SAMPLER_2D']]);
  gl.texImage3D=(...args)=>{const texture=textures.get(key(args[0]));allocations.set(texture,args);calls.push(['texImage3D',texture,...args.slice(0,-1),args.at(-1)?.length||0]);};
  gl.framebufferTexture2D=(_target,attachment,_type,texture)=>{drawFbo.attachments??=new Map();drawFbo.attachments.set(attachment,texture);};
  const targets=new Map([[gl.SAMPLER_2D,gl.TEXTURE_2D],[gl.SAMPLER_CUBE,gl.TEXTURE_CUBE_MAP],
    [gl.SAMPLER_3D,gl.TEXTURE_3D],[gl.SAMPLER_2D_ARRAY,gl.TEXTURE_2D_ARRAY],[gl.SAMPLER_2D_SHADOW,gl.TEXTURE_2D]]);
  gl.validateDraw=()=>{
    const occupied=new Map();for(const uniform of program.uniforms||[]){
      const target=targets.get(uniform.type);if(target===undefined)continue;
      const unit=program.values?.get(uniform.name)??0;
      if(occupied.has(unit))assert.equal(occupied.get(unit),uniform.type,'Conflicting sampler types on unit '+unit);
      occupied.set(unit,uniform.type);
      const texture=textures.get((gl.TEXTURE0+unit)+':'+target);
      assert.ok(texture && allocations.has(texture),'Complete sampler '+uniform.name);
      // ES 3.0.6 sections 3.8.13 and 3.9.2: framebuffer completeness alone
      // does not establish that a raw depth texture is valid for sampling.
      if(allocations.get(texture)?.[2]===gl.DEPTH_COMPONENT24){
        const parameters=textureParameters.get(texture);
        if(uniform.type===gl.SAMPLER_2D){
          assert.equal(parameters?.get(gl.TEXTURE_COMPARE_MODE),gl.NONE,'Raw depth compare mode: '+uniform.name);
          assert.equal(parameters?.get(gl.TEXTURE_MIN_FILTER),gl.NEAREST,'Raw depth min filter: '+uniform.name);
          assert.equal(parameters?.get(gl.TEXTURE_MAG_FILTER),gl.NEAREST,'Raw depth mag filter: '+uniform.name);
        }else if(uniform.type===gl.SAMPLER_2D_SHADOW)assert.equal(parameters?.get(gl.TEXTURE_COMPARE_MODE),gl.COMPARE_REF_TO_TEXTURE,'Comparison sampler mode: '+uniform.name);
      }
      for(const attachment of drawFbo?.attachments?.values()||[])assert.notEqual(texture,attachment,'Read/write framebuffer feedback: '+uniform.name);
    }
  };
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'])gl[name]=()=>{gl.validateDraw();calls.push(['draw',drawFbo,program]);};
  gl.uniformValues=values;gl.boundTextures=textures;return gl;
}

module.exports={fakeGl};
