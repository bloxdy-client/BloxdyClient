'use strict';
// CPU raster-state acceptance, not a graphics context or a pixel renderer.
function visibility(h,{scissor=true,cull=true,colour=true}={}){const gl=h.gl,get=gl.getParameter,draw=gl.drawArrays,world=gl.drawElements;let box=[0,0,0,0],buffers=[colour?gl.NONE:gl.BACK],face=cull?gl.FRONT_AND_BACK:gl.BACK,fragments=0;
 gl.getParameter=function(key){if(key===gl.SCISSOR_BOX)return box.slice();if(key===gl.CULL_FACE_MODE)return face;if(key===gl.DRAW_BUFFER0)return buffers[0];return get.call(this,key);};
 gl.scissor=(...v)=>{box=v;};gl.drawBuffers=v=>{buffers=Array.from(v);};gl.cullFace=v=>{face=v;};
 if(scissor)gl.enable(gl.SCISSOR_TEST);else gl.disable(gl.SCISSOR_TEST);gl.enable(gl.CULL_FACE);
 gl.drawElements=function(...args){box=[0,0,0,0];buffers=[colour?gl.NONE:gl.BACK];face=cull?gl.FRONT_AND_BACK:gl.BACK;if(scissor)gl.enable(gl.SCISSOR_TEST);else gl.disable(gl.SCISSOR_TEST);gl.enable(gl.CULL_FACE);return world.apply(this,args);};
 gl.drawArrays=function(...args){if((!gl.isEnabled(gl.SCISSOR_TEST)||box[2]>0&&box[3]>0)&&buffers.some(b=>b!==gl.NONE)&&(!gl.isEnabled(gl.CULL_FACE)||face!==gl.FRONT_AND_BACK))fragments++;return draw.apply(this,args);};
 return {get fragments(){return fragments;},get scissor(){return box;},get cull(){return face;},get drawBuffers(){return buffers;}};
}
module.exports={visibility};
