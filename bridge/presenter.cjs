'use strict';
module.exports=function installNativePresenter(){
  if(globalThis.__BLOXD_NATIVE_PRESENTER__||typeof globalThis.bloxdNative?.frame!=='function')return;
  let source=null,canvas=null,gl=null,program=null,vao=null,texture=null,frameUniform=null,textureWidth=0,textureHeight=0,layoutKey='',busy=false,stopped=false,sequence=null,opacity='',opacityPriority='',lastFrameAt=0;
  const state={phase:'waiting-frame',frames:0,error:null,reason:null};
  function restore(){
    globalThis.__BLOXD_NATIVE_CAPTURE__?.setPresentation?.(false);
    if(source){if(opacity)source.style.setProperty('opacity',opacity,opacityPriority);else source.style.removeProperty('opacity');}
    if(gl){if(texture)gl.deleteTexture(texture);if(vao)gl.deleteVertexArray(vao);if(program)gl.deleteProgram(program);}
    canvas?.remove();source=canvas=gl=program=vao=texture=frameUniform=null;textureWidth=textureHeight=0;layoutKey='';
  }
  function initialize(target){
    restore();source=target;opacity=source.style.getPropertyValue('opacity');opacityPriority=source.style.getPropertyPriority('opacity');
    canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.dataset.bloxdyNative='';
    Object.assign(canvas.style,{position:'absolute',pointerEvents:'none',margin:'0',padding:'0',border:'0',zIndex:getComputedStyle(source).zIndex});
    source.parentElement.insertBefore(canvas,source.nextSibling);gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
    if(!gl)throw Error('Native presentation requires WebGL2.');
    const shader=(kind,text)=>{const handle=gl.createShader(kind);gl.shaderSource(handle,text);gl.compileShader(handle);if(!gl.getShaderParameter(handle,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(handle);gl.deleteShader(handle);throw Error(message||'Native presentation shader failed.');}return handle;};
    let vertex=null,fragment=null;
    try{vertex=shader(gl.VERTEX_SHADER,'#version 300 es\nout vec2 screenUV;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);screenUV=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}');
      fragment=shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;in vec2 screenUV;uniform sampler2D nativeFrame;out vec4 color;void main(){color=texture(nativeFrame,screenUV);}');
      program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Native presentation program failed.');
    }finally{if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);}
    frameUniform=gl.getUniformLocation(program,'nativeFrame');vao=gl.createVertexArray();texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    for(const [key,value] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,value);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();restore();state.phase='fallback';state.error='Native presentation context was lost.';},{once:true});
  }
  async function tick(){
    if(busy||stopped)return;busy=true;
    try{
      const capture=globalThis.__BLOXD_NATIVE_CAPTURE__,status=capture?.presentation?.(),target=capture?.canvas?.();
      if(status?.ready!==true||!target?.isConnected){restore();state.phase='source-fallback';state.reason=status?.reason||'Native scene is not ready.';return;}
      const frame=await globalThis.bloxdNative.frame(sequence);
      if(stopped)return;
      const current=capture?.presentation?.();
      if(!current?.ready||current.epoch!==status.epoch||current.revision!==status.revision||capture.canvas()!==target){restore();state.phase='source-fallback';state.reason=current?.reason||'Source scene changed during frame transfer.';return;}
      if(!frame){if(canvas&&performance.now()-lastFrameAt>1500){capture.rejectPresentation?.('Native presentation frame timed out.');restore();state.phase='fallback';}return;}
      if(frame.epoch!==status.epoch||frame.revision!==status.revision){restore();state.phase='waiting-world';return;}
      if(!Number.isInteger(frame.width)||!Number.isInteger(frame.height)||frame.width<1||frame.height<1||frame.width>8192||frame.height>8192||frame.width*frame.height>16*1024*1024||frame.flags!==1||!ArrayBuffer.isView(frame.pixels)||frame.pixels.byteLength!==frame.width*frame.height*4)throw Error('Invalid native presentation frame.');
      if(frame.width!==target.width||frame.height!==target.height){restore();state.phase='waiting-world';state.reason='Native viewport is not current.';return;}
      if(source!==target||!canvas?.isConnected)initialize(target);
      if(canvas.width!==frame.width||canvas.height!==frame.height){canvas.width=frame.width;canvas.height=frame.height;}
      const left=source.offsetLeft,top=source.offsetTop,width=source.clientWidth,height=source.clientHeight,key=[left,top,width,height].join(':');
      if(key!==layoutKey){Object.assign(canvas.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});layoutKey=key;}
      gl.useProgram(program);gl.bindVertexArray(vao);gl.viewport(0,0,canvas.width,canvas.height);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
      const pixels=new Uint8Array(frame.pixels.buffer,frame.pixels.byteOffset,frame.pixels.byteLength);
      if(textureWidth!==frame.width||textureHeight!==frame.height){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,frame.width,frame.height,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);textureWidth=frame.width;textureHeight=frame.height;}
      else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,frame.width,frame.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      gl.uniform1i(frameUniform,0);gl.drawArrays(gl.TRIANGLES,0,3);
      if(gl.getError()!==gl.NO_ERROR)throw Error('Native frame presentation failed.');
      if(capture.setPresentation?.(true,frame.epoch,frame.revision)!==true){restore();state.phase='source-fallback';return;}
      source.style.setProperty('opacity','0','important');sequence=frame.sequence;lastFrameAt=performance.now();++state.frames;state.phase='presenting';state.error=null;state.reason=null;
    }catch(error){globalThis.__BLOXD_NATIVE_CAPTURE__?.rejectPresentation?.(String(error.message||error));restore();state.phase='fallback';state.error=String(error.message||error);}finally{busy=false;}
  }
  const timer=setInterval(()=>void tick(),16);
  const api={status:()=>({...state}),release(reason){restore();state.phase='source-fallback';state.reason=reason||'Native handover was released.';},stop(){stopped=true;clearInterval(timer);restore();}};
  globalThis.__BLOXD_NATIVE_PRESENTER__=api;addEventListener('pagehide',()=>api.stop(),{once:true});
};
