'use strict';
// Serialized at document start. Reuse observed GL state instead of synchronously
// round-tripping to the driver for every shadow/cloud/bloom guard.
function installRenderStateCache(root){
 if(root.__BVFX_RENDER_STATE__)return;
 const contexts=new WeakMap();root.__BVFX_RENDER_STATE__=gl=>contexts.get(gl);
 for(const proto of new Set([root.WebGLRenderingContext?.prototype,root.WebGL2RenderingContext?.prototype])){
  if(!proto?.getParameter||Object.hasOwn(proto,'__bvfxRenderState'))continue;
  Object.defineProperty(proto,'__bvfxRenderState',{value:true});
  const get=proto.getParameter,enabled=proto.isEnabled;
  const clone=v=>ArrayBuffer.isView(v)?new v.constructor(v):Array.isArray(v)?v.slice():v;
  const state=gl=>{let s=contexts.get(gl);if(s)return s;
   s={parameters:new Map(),caps:new Map(),reads:0,hits:0,lost:false,allowedCaps:caps(gl),allowedParameters:parameters(gl),framebuffers:new WeakSet()};contexts.set(gl,s);
   s.diagnostics=()=>({driverReads:s.reads,cacheHits:s.hits,knownParameters:s.parameters.size,knownCapabilities:s.caps.size});
   gl.canvas?.addEventListener?.('webglcontextlost',()=>{s.lost=true;s.parameters.clear();s.caps.clear();});
   gl.canvas?.addEventListener?.('webglcontextrestored',()=>{s.lost=false;s.parameters.clear();s.caps.clear();s.framebuffers=new WeakSet();});return s;
  };
  const numbers=(args,n)=>args.length>=n&&args.slice(0,n).every(v=>typeof v==='number'&&Number.isFinite(v));
  const integer=v=>Number.isInteger(v)&&v>=-2147483648&&v<=2147483647;
  const list=(gl,names)=>new Set(names.map(n=>gl[n]).filter(v=>v!==undefined));
  const caps=gl=>list(gl,['DEPTH_TEST','CULL_FACE','BLEND','SCISSOR_TEST','STENCIL_TEST','POLYGON_OFFSET_FILL','RASTERIZER_DISCARD','DITHER','SAMPLE_ALPHA_TO_COVERAGE','SAMPLE_COVERAGE']);
  const parameters=gl=>list(gl,['VIEWPORT','SCISSOR_BOX','COLOR_WRITEMASK','DEPTH_WRITEMASK','DEPTH_FUNC','DEPTH_CLEAR_VALUE','DEPTH_RANGE','POLYGON_OFFSET_FACTOR','POLYGON_OFFSET_UNITS','DRAW_FRAMEBUFFER_BINDING','READ_FRAMEBUFFER_BINDING','FRAMEBUFFER_BINDING','BLEND_SRC_RGB','BLEND_DST_RGB','BLEND_SRC_ALPHA','BLEND_DST_ALPHA','BLEND_EQUATION_RGB','BLEND_EQUATION_ALPHA','TRANSFORM_FEEDBACK_ACTIVE','TRANSFORM_FEEDBACK_PAUSED','MAX_VIEWPORT_DIMS','MAX_TEXTURE_IMAGE_UNITS','MAX_COMBINED_TEXTURE_IMAGE_UNITS','MAX_TEXTURE_SIZE']);
  const set=(s,p,v)=>{if(p!==undefined&&!s.lost)s.parameters.set(p,v);};
  const wrap=(name,after)=>{const native=proto[name];if(typeof native!=='function')return;proto[name]=function(...args){const result=native.apply(this,args);after(this,state(this),args,result);return result;};};
  const invalid=(s,keys)=>keys.forEach(p=>s.parameters.delete(p));
  for(const name of ['enable','disable'])wrap(name,(gl,s,[cap])=>{if(!s.lost&&s.allowedCaps.has(cap))s.caps.set(cap,name==='enable');});
  if(enabled)proto.isEnabled=function(cap){const s=state(this);if(s.lost||!s.allowedCaps.has(cap))return enabled.call(this,cap);if(s.caps.has(cap)){s.hits++;return s.caps.get(cap);}s.reads++;const value=enabled.call(this,cap);s.caps.set(cap,value);return value;};
  wrap('createFramebuffer',(_gl,s,_args,fbo)=>{if(fbo)s.framebuffers.add(fbo);});
  wrap('bindFramebuffer',(gl,s,[target,fbo])=>{
   if(fbo!==null&&(!fbo||typeof fbo!=='object'||!s.framebuffers.has(fbo))){invalid(s,[gl.DRAW_FRAMEBUFFER_BINDING,gl.FRAMEBUFFER_BINDING,gl.READ_FRAMEBUFFER_BINDING]);return;}
   if(target===gl.FRAMEBUFFER||target===gl.DRAW_FRAMEBUFFER)set(s,gl.DRAW_FRAMEBUFFER_BINDING??gl.FRAMEBUFFER_BINDING,fbo);
   if(target===gl.FRAMEBUFFER||target===gl.READ_FRAMEBUFFER)set(s,gl.READ_FRAMEBUFFER_BINDING,fbo);
  });
  wrap('deleteFramebuffer',(gl,s,[fbo])=>{if(fbo)s.framebuffers.delete(fbo);for(const p of [gl.DRAW_FRAMEBUFFER_BINDING,gl.READ_FRAMEBUFFER_BINDING,gl.FRAMEBUFFER_BINDING])if(s.parameters.get(p)===fbo)set(s,p,null);});
  wrap('deleteVertexArray',(gl,_s,[vao])=>{const t=root.__BVFX_GL_STATE__?.(gl);if(t?.vertexArrayKnown&&t.vertexArray===vao)t.vertexArray=null;});
  wrap('viewport',(gl,s,a)=>{
   if(!numbers(a,4)||!a.every(integer)||a[2]<0||a[3]<0){invalid(s,[gl.VIEWPORT]);return;}
   let max=s.parameters.get(gl.MAX_VIEWPORT_DIMS);if(!max&&!s.lost){s.reads++;max=get.call(gl,gl.MAX_VIEWPORT_DIMS);set(s,gl.MAX_VIEWPORT_DIMS,clone(max));}
   if(max?.length===2)set(s,gl.VIEWPORT,new Int32Array([a[0],a[1],Math.min(a[2],max[0]),Math.min(a[3],max[1])]));else invalid(s,[gl.VIEWPORT]);
  });
  wrap('scissor',(gl,s,a)=>{if(numbers(a,4)&&a.every(integer)&&a[2]>=0&&a[3]>=0)set(s,gl.SCISSOR_BOX,new Int32Array(a.slice(0,4)));else invalid(s,[gl.SCISSOR_BOX]);});
  wrap('colorMask',(gl,s,a)=>{if(a.length>=4)set(s,gl.COLOR_WRITEMASK,a.slice(0,4).map(Boolean));else invalid(s,[gl.COLOR_WRITEMASK]);});
  wrap('depthMask',(gl,s,a)=>{if(a.length)set(s,gl.DEPTH_WRITEMASK,Boolean(a[0]));else invalid(s,[gl.DEPTH_WRITEMASK]);});
  wrap('depthFunc',(gl,s,[v])=>{if(list(gl,['NEVER','LESS','EQUAL','LEQUAL','GREATER','NOTEQUAL','GEQUAL','ALWAYS']).has(v))set(s,gl.DEPTH_FUNC,v);else invalid(s,[gl.DEPTH_FUNC]);});
  wrap('clearDepth',(gl,s,a)=>{if(numbers(a,1))set(s,gl.DEPTH_CLEAR_VALUE,Math.fround(Math.max(0,Math.min(1,a[0]))));else invalid(s,[gl.DEPTH_CLEAR_VALUE]);});
  wrap('depthRange',(gl,s,a)=>{if(numbers(a,2))set(s,gl.DEPTH_RANGE,new Float32Array(a.slice(0,2).map(v=>Math.max(0,Math.min(1,v)))));else invalid(s,[gl.DEPTH_RANGE]);});
  wrap('polygonOffset',(gl,s,a)=>{const keys=[gl.POLYGON_OFFSET_FACTOR,gl.POLYGON_OFFSET_UNITS];if(numbers(a,2))a.slice(0,2).forEach((v,i)=>set(s,keys[i],Math.fround(v)));else invalid(s,keys);});
  const equations=(gl,s,a)=>{const keys=[gl.BLEND_EQUATION_RGB,gl.BLEND_EQUATION_ALPHA],valid=list(gl,['FUNC_ADD','FUNC_SUBTRACT','FUNC_REVERSE_SUBTRACT','MIN','MAX']);if(a.length>=2&&a.slice(0,2).every(v=>valid.has(v)))a.slice(0,2).forEach((v,i)=>set(s,keys[i],v));else invalid(s,keys);};
  wrap('blendEquationSeparate',equations);wrap('blendEquation',(gl,s,[v])=>equations(gl,s,[v,v]));
  const blend=(gl,s,a)=>{const keys=[gl.BLEND_SRC_RGB,gl.BLEND_DST_RGB,gl.BLEND_SRC_ALPHA,gl.BLEND_DST_ALPHA],valid=list(gl,['ZERO','ONE','SRC_COLOR','ONE_MINUS_SRC_COLOR','DST_COLOR','ONE_MINUS_DST_COLOR','SRC_ALPHA','ONE_MINUS_SRC_ALPHA','DST_ALPHA','ONE_MINUS_DST_ALPHA','CONSTANT_COLOR','ONE_MINUS_CONSTANT_COLOR','CONSTANT_ALPHA','ONE_MINUS_CONSTANT_ALPHA','SRC_ALPHA_SATURATE']);
   const color=list(gl,['CONSTANT_COLOR','ONE_MINUS_CONSTANT_COLOR']),alpha=list(gl,['CONSTANT_ALPHA','ONE_MINUS_CONSTANT_ALPHA']);
   if(a.length>=4&&a.every(v=>valid.has(v))&&!(color.has(a[0])&&alpha.has(a[1])||alpha.has(a[0])&&color.has(a[1]))&&a[1]!==gl.SRC_ALPHA_SATURATE&&a[2]!==gl.SRC_ALPHA_SATURATE&&a[3]!==gl.SRC_ALPHA_SATURATE)a.slice(0,4).forEach((v,i)=>set(s,keys[i],v));else invalid(s,keys);
  };
  wrap('blendFuncSeparate',blend);wrap('blendFunc',(gl,s,[a,b])=>blend(gl,s,[a,b,a,b]));
  for(const name of ['beginTransformFeedback','endTransformFeedback','pauseTransformFeedback','resumeTransformFeedback','bindTransformFeedback','deleteTransformFeedback'])wrap(name,(gl,s)=>invalid(s,[gl.TRANSFORM_FEEDBACK_ACTIVE,gl.TRANSFORM_FEEDBACK_PAUSED]));
  proto.getParameter=function(p){const s=state(this);if(s.lost)return get.call(this,p);const t=root.__BVFX_GL_STATE__?.(this);
   if(t){
    if(this.CURRENT_PROGRAM!==undefined&&p===this.CURRENT_PROGRAM){if(!t.programKnown){s.reads++;t.currentProgram=get.call(this,p);t.programKnown=true;}else s.hits++;return t.currentProgram;}
    if(this.VERTEX_ARRAY_BINDING!==undefined&&p===this.VERTEX_ARRAY_BINDING){if(!t.vertexArrayKnown){s.reads++;t.vertexArray=get.call(this,p);t.vertexArrayKnown=true;}else s.hits++;return t.vertexArray;}
    if(this.ARRAY_BUFFER_BINDING!==undefined&&p===this.ARRAY_BUFFER_BINDING){if(!t.buffers.has(this.ARRAY_BUFFER)){s.reads++;t.buffers.set(this.ARRAY_BUFFER,get.call(this,p));}else s.hits++;return t.buffers.get(this.ARRAY_BUFFER);}
   }
   if(s.allowedCaps.has(p))return this.isEnabled(p);
   if(!s.allowedParameters.has(p))return get.call(this,p);
   if(s.parameters.has(p)){s.hits++;return clone(s.parameters.get(p));}
   s.reads++;const value=get.call(this,p);s.parameters.set(p,clone(value));return value;
  };
 }
}
module.exports={installRenderStateCache};
