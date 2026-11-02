(() => {
  'use strict';
  const gl=document.getElementById('source').getContext('webgl2');if(!gl)throw Error('Fixture requires WebGL2.');
  const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const nativeTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,nativeTexture);
  const bytes=new Uint8Array(16*16*2*4);
  function fill(r,g,b){for(let i=0;i<bytes.length;i+=4){bytes[i]=r;bytes[i+1]=g;bytes[i+2]=b;bytes[i+3]=255;}}
  fill(40,190,100);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.RGBA8,16,16,2,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  const texture={getInternalTexture:()=>({width:16,height:16,depth:2,is2DArray:true,_hardwareTexture:{underlyingResource:nativeTexture}})};
  const material={alpha:1,pluginManager:{_plugins:[{textureAtlases:[texture]}]},needAlphaBlendingForMesh:()=>false};
  const view=identity();view[14]=-4;
  const f=1/Math.tan(Math.PI/6),aspect=640/360,near=.1,far=100;
  const projection=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
  const camera={position:{x:0,y:0,z:4},getViewMatrix:()=>({m:view}),getProjectionMatrix:()=>({m:projection})};
  function mesh(){
    const world=identity();
    const data={position:new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]),normal:new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]),uv:new Float32Array([0,0,1,0,1,1,0,1]),color:new Float32Array(16).fill(1),texAtlasIndices:new Float32Array(4),aPackedLightLevels:new Float32Array(4).fill(61440)};
    const buffers={};for(const name of Object.keys(data)){const gpu=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,gpu);gl.bufferData(gl.ARRAY_BUFFER,data[name],gl.STATIC_DRAW);buffers[name]={getBuffer:()=>({getBuffer:()=>gpu})};}
    return {name:'synthetic-quad',isVisible:true,material,_geometry:{_vertexBuffers:buffers,_indices:new Uint32Array([0,1,2,0,2,3])},getVerticesData:kind=>data[kind],getVerticesDataKinds:()=>Object.keys(data),getWorldMatrix:()=>({m:world}),getTotalIndices:()=>6,getTotalVertices:()=>4,data,world};
  }
  const engine={_gl:gl,isNDCHalfZRange:false,_useReverseDepthBuffer:false};
  function scene(){return {meshes:[mesh()],materials:[material],activeCamera:camera,clearColor:{r:.1,g:.14,b:.19,a:1},getEngine:()=>engine,onAfterRenderObservable:{}};}
  const renderer={scene:scene()},noa={container:{},inputs:{},renderer};
  const api={getBloxd:()=>({})};Object.defineProperty(api,'singletons',{value:{noa}});
  const savedFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.READ_FRAMEBUFFER,savedFbo);
  gl.readBuffer(gl.NONE);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
  const packBuffer=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,packBuffer);gl.bufferData(gl.PIXEL_PACK_BUFFER,1024,gl.STREAM_READ);
  gl.pixelStorei(gl.PACK_ALIGNMENT,8);gl.pixelStorei(gl.PACK_ROW_LENGTH,3);gl.pixelStorei(gl.PACK_SKIP_ROWS,2);gl.pixelStorei(gl.PACK_SKIP_PIXELS,1);
  globalThis.fixture={
    changeGeometryAndTexture(){const old=renderer.scene.meshes[0];old.data.position[0]=-.3;const gpu=old._geometry._vertexBuffers.position.getBuffer().getBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,gpu);gl.bufferSubData(gl.ARRAY_BUFFER,0,old.data.position);fill(220,80,40);gl.bindTexture(gl.TEXTURE_2D_ARRAY,nativeTexture);gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,0,16,16,2,gl.RGBA,gl.UNSIGNED_BYTE,bytes);},
    moveCamera(){view[12]=-.5;camera.position.x=.5;},
    changeLight(){const current=renderer.scene.meshes[0];current.data.aPackedLightLevels.fill(0);gl.bindBuffer(gl.ARRAY_BUFFER,current._geometry._vertexBuffers.aPackedLightLevels.getBuffer().getBuffer());gl.bufferSubData(gl.ARRAY_BUFFER,0,current.data.aPackedLightLevels);},
    moveObject(){renderer.scene.meshes[0].world[12]=.4;},
    addInstances(){const matrices=new Float32Array(32);matrices.set(identity());matrices.set(identity(),16);matrices[12]=-.6;matrices[28]=.6;renderer.scene.meshes[0]._thinInstanceDataStorage={matrixData:matrices,instancesCount:2};},
    moveInstance(){renderer.scene.meshes[0]._thinInstanceDataStorage.matrixData[12]=-1.5;},
    removeMesh(){renderer.scene.meshes.length=0;},
    replaceWorld(){renderer.scene=scene();},
    validateSourceState(){const checks=[gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)===savedFbo,gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,gl.getParameter(gl.READ_BUFFER)===gl.NONE,gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING)===packBuffer,gl.getParameter(gl.PACK_ALIGNMENT)===8,gl.getParameter(gl.PACK_ROW_LENGTH)===3,gl.getParameter(gl.PACK_SKIP_ROWS)===2,gl.getParameter(gl.PACK_SKIP_PIXELS)===1,gl.getError()===gl.NO_ERROR];return {passed:checks.every(Boolean),checks};}
  };
})();
