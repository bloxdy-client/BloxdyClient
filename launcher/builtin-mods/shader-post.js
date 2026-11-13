// Optional bounded bloom and asynchronous scene GPU timing. No DOM canvas filters.
(() => {
 'use strict';const root=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
 const vertex=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.0-1.0,0,1);}`;
 const fragment=`#version 300 es
precision highp float;
uniform sampler2D image;uniform vec2 texel;uniform float strength;
in vec2 uv;out vec4 colour;
vec3 bright(vec2 p){vec3 c=texture(image,p).rgb;float l=max(max(c.r,c.g),c.b);return c*max(0.0,l-.65)/max(l,.001);}
void main(){vec2 d=texel*3.0;vec3 b=bright(uv)*.20;
b+=(bright(uv+vec2(d.x,0))+bright(uv-vec2(d.x,0))+bright(uv+vec2(0,d.y))+bright(uv-vec2(0,d.y)))*.12;
b+=(bright(uv+d)+bright(uv-d)+bright(uv+vec2(d.x,-d.y))+bright(uv+vec2(-d.x,d.y)))*.08;
colour=vec4(b*strength*.45,0);}`;
 root.__BVFX_CREATE_POST__=function(state){
  let resource=null,timer=null,gpuStatus='Not sampled',bloomStatus='Not sampled',nextSample=0,failedGl=null;
  const observed=new WeakSet(),results=[];
  function freeBloom(){if(resource&&!resource.gl.isContextLost?.()){const {gl}=resource;gl.deleteTexture(resource.texture);gl.deleteProgram(resource.program);gl.deleteVertexArray(resource.vao);}resource=null;}
  function dispose(){freeBloom();
   if(timer){if(timer.active)timer.gl.endQuery(timer.ext.TIME_ELAPSED_EXT);for(const q of timer.pending)timer.gl.deleteQuery(q);timer=null;}}
  function observe(gl){if(observed.has(gl))return;observed.add(gl);gl.canvas?.addEventListener?.('webglcontextlost',()=>{resource=null;timer=null;failedGl=null;gpuStatus='Context lost';bloomStatus='Context lost';results.length=0;});}
  function begin(gl){
   if(!gl?.createQuery||!state.enabled||gl.isContextLost?.())return;observe(gl);
   if(timer?.gl!==gl){if(timer)dispose();const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');timer={gl,ext,pending:[],active:false};}
   if(!timer.ext){gpuStatus='GPU timer unavailable';return;}
   const t=timer,ext=t.ext;
   if(gl.getParameter(ext.GPU_DISJOINT_EXT)){for(const q of t.pending)gl.deleteQuery(q);t.pending.length=0;results.length=0;gpuStatus='GPU clock disjoint';return;}
   while(t.pending.length&&gl.getQueryParameter(t.pending[0],gl.QUERY_RESULT_AVAILABLE)){
    const q=t.pending.shift(),ns=gl.getQueryParameter(q,gl.QUERY_RESULT);gl.deleteQuery(q);
    if(Number.isFinite(ns)&&ns>=0){results.push(ns/1e6);if(results.length>120)results.shift();gpuStatus='Scene GPU time';}
   }
   if(t.active||t.pending.length>=4||performance.now()<nextSample||gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return;
   nextSample=performance.now()+500;const q=gl.createQuery();if(!q)return;
   gl.beginQuery(ext.TIME_ELAPSED_EXT,q);t.pending.push(q);t.active=true;
  }
  function end(){if(timer?.active){timer.gl.endQuery(timer.ext.TIME_ELAPSED_EXT);timer.active=false;}}
  function draw(gl){
   if(!state.enabled||!state.bloomEnabled||!(state.bloom>0)){if(resource)freeBloom();bloomStatus='Off';return;}
   if(!gl?.createVertexArray||gl.isContextLost?.()||failedGl===gl)return;observe(gl);
   // Only native, full-size presentation targets have a known copy contract.
   const get=p=>gl.getParameter(p),view=get(gl.VIEWPORT),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
   if(get(gl.DRAW_FRAMEBUFFER_BINDING)!==null||view[0]||view[1]||view[2]!==width||view[3]!==height||width*height>8294400)return;
   const saved={program:get(gl.CURRENT_PROGRAM),vao:get(gl.VERTEX_ARRAY_BINDING),active:get(gl.ACTIVE_TEXTURE),read:get(gl.READ_FRAMEBUFFER_BINDING),mask:get(gl.COLOR_WRITEMASK),blend:[get(gl.BLEND_SRC_RGB),get(gl.BLEND_DST_RGB),get(gl.BLEND_SRC_ALPHA),get(gl.BLEND_DST_ALPHA)],equation:[get(gl.BLEND_EQUATION_RGB),get(gl.BLEND_EQUATION_ALPHA)]};
   const caps=[gl.DEPTH_TEST,gl.CULL_FACE,gl.STENCIL_TEST,gl.SCISSOR_TEST,gl.RASTERIZER_DISCARD,gl.BLEND];const enabled=caps.map(c=>gl.isEnabled(c));
   const unit=gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)-1;gl.activeTexture(gl.TEXTURE0+unit);
   saved.texture=get(gl.TEXTURE_BINDING_2D);saved.sampler=get(gl.SAMPLER_BINDING);
   try{
    if(resource&&(resource.gl!==gl||resource.width!==width||resource.height!==height)){if(saved.texture===resource.texture)saved.texture=null;freeBloom();}
    if(!resource){
     const program=gl.createProgram(),shaders=[];let texture=null,vao=null;
     try{
      for(const [type,text]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Bloom compile failed');gl.attachShader(program,shader);}
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Bloom link failed');
      texture=gl.createTexture();vao=gl.createVertexArray();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      resource={gl,program,texture,vao,width,height,captured:false,image:gl.getUniformLocation(program,'image'),texel:gl.getUniformLocation(program,'texel'),strength:gl.getUniformLocation(program,'strength')};
     }catch(error){if(texture)gl.deleteTexture(texture);if(vao)gl.deleteVertexArray(vao);gl.deleteProgram(program);throw error;}finally{for(const shader of shaders)gl.deleteShader(shader);}
    }
    const texture=resource.texture;gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);
    // Bloom uses RGB only. Infer a compatible effective format from the
    // actual backbuffer; an opaque RGB buffer cannot copy into fixed RGBA8.
    // Storage is inferred once and reused by subimage copies thereafter.
    if(!resource.captured){
      gl.copyTexImage2D(gl.TEXTURE_2D,0,gl.RGB,0,0,width,height,0);
      if(gl.getError()!==gl.NO_ERROR)throw Error('Bloom unavailable: scene copy rejected');
      resource.captured=true;bloomStatus='On';
    }else gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,width,height);
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindSampler(unit,null);gl.useProgram(resource.program);gl.bindVertexArray(resource.vao);
    for(const cap of caps)gl.disable(cap);gl.enable(gl.BLEND);gl.blendEquationSeparate(gl.FUNC_ADD,gl.FUNC_ADD);gl.blendFuncSeparate(gl.ONE,gl.ONE,gl.ZERO,gl.ONE);gl.colorMask(true,true,true,true);
    gl.uniform1i(resource.image,unit);gl.uniform2f(resource.texel,1/width,1/height);gl.uniform1f(resource.strength,Math.max(0,Math.min(1,state.bloom)));gl.drawArrays(gl.TRIANGLES,0,3);
   }catch(error){bloomStatus=String(error.message);failedGl=gl;freeBloom();}
   finally{
    gl.useProgram(saved.program);gl.bindVertexArray(saved.vao);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.read);
    gl.blendEquationSeparate(...saved.equation);gl.blendFuncSeparate(...saved.blend);gl.colorMask(...saved.mask);caps.forEach((cap,i)=>enabled[i]?gl.enable(cap):gl.disable(cap));
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,saved.texture);gl.bindSampler(unit,saved.sampler);gl.activeTexture(saved.active);
   }
  }
  return {begin,end,draw,dispose,vertex,fragment,diagnostics:()=>({status:gpuStatus,bloom:bloomStatus,samples:results.length,sceneAverageMs:results.length?results.reduce((a,b)=>a+b,0)/results.length:null,sceneMaxMs:results.length?Math.max(...results):null,scope:'Between Bloxdy scene callbacks, including capture/bloom; not incremental shader cost.'})};
 };
})();
