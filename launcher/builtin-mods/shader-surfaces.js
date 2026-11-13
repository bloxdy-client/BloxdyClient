// Source-backed leaf motion and neutral/native lighting. Reflection code is retired.
(() => {
 'use strict';const root=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
 root.__BVFX_CREATE_SURFACES__=function(state){
  if(typeof state.bloxdLighting!=='boolean')state.bloxdLighting=state.disableBloxdLighting!==true;
  delete state.disableBloxdLighting;
  for(const key of Object.keys(state))if(key==='blockReflections'||key.startsWith('reflection'))delete state[key];
  state.wavyLeaves=state.wavyLeaves===true;
  state.leafSpeed=Number.isFinite(Number(state.leafSpeed))?Math.max(0,Math.min(5,Number(state.leafSpeed))):1;
  state.leafStrength=Number.isFinite(Number(state.leafStrength))?Math.max(0,Math.min(.12,Number(state.leafStrength))):.06;
  let leaves=[],revision=0,scene=null,after=null,frame=0,nowSeconds=0,currentOrigin=[0,0,0],previousNow=performance.now();
  let atlasBytes=new Uint8Array(4),atlasWidth=1,atlasHeight=1,atlasContext=null,nextMetadata=0,metadataOwner=null,lastSelection='';
  const atlasTextures=new WeakMap(),locationsCache=new WeakMap(),leafGeometry=new WeakMap();
  const post=root.__BVFX_CREATE_POST__?.(state);root.__BVFX_GPU_TIMER__=post;
  const leafUniforms=`
uniform highp sampler2D uBvfxSurfaceAtlas;
uniform highp vec2 uBvfxSurfaceAtlasSize;
uniform highp vec4 uBvfxLeafMotion;
vec3 bvfxLeafDisplacement(vec3 p,float atlas){
 if(uBvfxLeafMotion.x<=0.0)return vec3(0);
 float index=floor(atlas+.5);
 if(index<1.0||index>=uBvfxSurfaceAtlasSize.x*uBvfxSurfaceAtlasSize.y)return vec3(0);
 vec2 uv=(vec2(mod(index,uBvfxSurfaceAtlasSize.x),floor(index/uBvfxSurfaceAtlasSize.x))+.5)/uBvfxSurfaceAtlasSize;
 float leaf=textureLod(uBvfxSurfaceAtlas,uv,0.0).r;
 float phase=dot(p.xz,vec2(.37,.23))+uBvfxLeafMotion.y+uBvfxLeafMotion.z;
 return vec3(sin(phase),sin(phase+1.7)*.16,cos(phase+.6)*.55)*uBvfxLeafMotion.x*leaf;
}
`;
  const common=`uniform float uBvfxDisableNative;uniform vec3 uBvfxSurfaceSun;`;
  function patch(source){
   if(typeof source!=='string'||!source.includes('#define BVFX_TERRAIN_UNDERWATER')||source.includes('bvfxLeafDisplacement')||source.includes('uBvfxDisableNative'))return source;
   const main=/void\s+main\s*\(\s*(?:void)?\s*\)\s*\{/;
   if(/\bgl_Position\b/.test(source)){
    const world=/vec4\s+worldPos\s*=\s*(?:finalWorld|world)\s*\*\s*vec4\(\s*(?:positionUpdated|position)\s*,\s*1(?:\.0)?\s*\)\s*;/;
    if(!world.test(source)||!/\bin\s+(?:(?:lowp|mediump|highp)\s+)?float\s+texAtlasIndices\b/.test(source))return source;
    source=source.replace(/gl_Position\s*=\s*viewProjection\s*\*\s*(?:finalWorld|world)\s*\*\s*vec4\([^;]+;/,'/* Projection follows leaf displacement. */');
    return source.replace(main,leafUniforms+'\n$&').replace(world,'$&\nworldPos.xyz+=bvfxLeafDisplacement(worldPos.xyz,texAtlasIndices);\ngl_Position=viewProjection*worldPos;');
   }
   if(!source.includes('uAmbientLightColour')||!source.includes('vNormalW'))return source;
   return source.replace(main,common+'\n$&').replace(/diffuseBase\s*\+=\s*vec3\(vTerrainLambert\)\s*;/g,'diffuseBase += vec3(mix(vTerrainLambert,1.0,uBvfxDisableNative));');
  }
  function updateMetadata(definitions,workers){
   if(!state.enabled||!state.wavyLeaves)return;
   const now=performance.now(),selection='leaves';
   if(now<nextMetadata&&metadataOwner===definitions&&lastSelection===selection)return;
   nextMetadata=now+1500;metadataOwner=definitions;lastSelection=selection;
   const atlasOwners=new Map();
   for(const [key,item]of Object.entries(definitions||{})){
    if(!item||typeof item!=='object')continue;
    const name=String(item.name||item.displayName||key),id=Number(item.id??item.blockId??key);
    const leaf=/\bleaves\b/i.test(name);
    const values=new Set();const atlas=item.atlasIdx??item.atlasIndex;
    for(const value of Array.isArray(atlas)||ArrayBuffer.isView(atlas)?atlas:[atlas])if(Number.isInteger(value)&&value>0)values.add(value);
    if(Number.isInteger(id))for(const worker of workers?.values?.()||[]){const o=worker.original;for(let face=0;face<6;face++){const mat=o?.blockFaceToMatId?.[id*6+face],a=o?.atlasIndexLookup?.[mat];if(Number.isInteger(a)&&a>0)values.add(a);}}
    for(const a of values){if(a>65535)continue;const before=atlasOwners.get(a);const mask=leaf?1:0;atlasOwners.set(a,before===undefined?mask:before&mask);}
   }
   const nextLeaves=[];
   for(const [a,mask]of atlasOwners){if(mask&1)nextLeaves.push(a);}
   nextLeaves.sort((a,b)=>a-b);
   const l=nextLeaves;
   if(l.join()!==leaves.join()){
    leaves=l;revision++;
    let largest=0;for(const a of l)largest=Math.max(largest,a);
    atlasWidth=Math.min(256,largest+1);atlasHeight=Math.max(1,Math.ceil((largest+1)/atlasWidth));atlasBytes=new Uint8Array(atlasWidth*atlasHeight*4);
    for(const a of l)atlasBytes[a*4]=255;
   }
  }
  function locations(gl,program){let loc=locationsCache.get(program);if(loc)return loc;
   loc={program};for(const name of ['DisableNative','SurfaceSun','SurfaceAtlas','SurfaceAtlasSize','LeafMotion'])loc[name]=gl.getUniformLocation(program,'uBvfx'+name);
   locationsCache.set(program,loc);return loc;
  }
  function bindAtlas(gl,loc,original){
   if(loc.SurfaceAtlas==null)return;
   const unit=root.__BVFX_SAMPLER_UNITS__(gl,loc.program).get('uBvfxSurfaceAtlas');if(!(unit>=0))return;
   const tracker=root.__BVFX_GL_STATE__?.(gl),active=tracker?.active??gl.getParameter(gl.ACTIVE_TEXTURE);
   if(atlasContext&&atlasContext!==gl){const old=atlasTextures.get(atlasContext);if(old)atlasContext.deleteTexture(old.texture);atlasTextures.delete(atlasContext);}atlasContext=gl;
   let cache=atlasTextures.get(gl);
   if(!cache){cache={texture:gl.createTexture(),revision:-1};atlasTextures.set(gl,cache);gl.canvas?.addEventListener?.('webglcontextlost',()=>{atlasTextures.delete(gl);});}
   if(cache.revision!==revision||tracker?.bindings?.get((gl.TEXTURE0+unit)+':'+gl.TEXTURE_2D)!==cache.texture||tracker?.samplers?.get(unit)!==null){
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,cache.texture);gl.bindSampler(unit,null);
    if(cache.revision!==revision){
     const fields=[gl.UNPACK_ALIGNMENT,gl.UNPACK_FLIP_Y_WEBGL,gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,gl.UNPACK_ROW_LENGTH,gl.UNPACK_IMAGE_HEIGHT,gl.UNPACK_SKIP_ROWS,gl.UNPACK_SKIP_PIXELS,gl.UNPACK_SKIP_IMAGES].filter(v=>v!==undefined);
     const saved=fields.map(v=>gl.getParameter(v)),pbo=gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING);
     try{fields.forEach(v=>gl.pixelStorei(v,v===gl.UNPACK_ALIGNMENT?1:0));gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,atlasWidth,atlasHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,atlasBytes);cache.revision=revision;
     }finally{fields.forEach((v,i)=>gl.pixelStorei(v,saved[i]));gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,pbo);}
    }
    gl.activeTexture(active);
   }
   if(loc.atlasRevision!==revision){if(loc.SurfaceAtlasSize!=null)original.uniform2f.call(gl,loc.SurfaceAtlasSize,atlasWidth,atlasHeight);loc.atlasRevision=revision;}
  }
  function bind(gl,loc,original,origin=currentOrigin,settingsRevision=0){
   if(!loc)return;
   if(loc.frame!==frame||loc.revision!==revision||loc.settings!==settingsRevision){
    loc.frame=frame;loc.revision=revision;loc.settings=settingsRevision;
    if(loc.DisableNative!=null)original.uniform1f.call(gl,loc.DisableNative,state.enabled&&state.bloxdLighting===false?1:0);
    const az=state.sunAzimuth*Math.PI/180,el=state.sunElevation*Math.PI/180;
    if(loc.SurfaceSun!=null)original.uniform3f.call(gl,loc.SurfaceSun,...(state.dayNightFrame?.body||[Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)]));
    if(loc.LeafMotion!=null)original.uniform4f.call(gl,loc.LeafMotion,state.enabled&&state.wavyLeaves?state.leafStrength:0,nowSeconds,((origin[0]*.37+origin[2]*.23)%(Math.PI*2)+Math.PI*2)%(Math.PI*2),0);
   }
   bindAtlas(gl,loc,original);
  }
  function finish(){try{post?.draw(scene?.getEngine?.()?._gl||scene?._engine?._gl);}finally{post?.end();}}
  function attach(next){if(scene===next)return;if(scene&&after!=null)scene.onAfterRenderObservable?.remove?.(after);post?.dispose();scene=next;after=scene?.onAfterRenderObservable?.add?.(finish);}
  function tick(origin){const now=performance.now();nowSeconds+=Math.max(0,Math.min(.1,(now-previousNow)*.001))*state.leafSpeed;previousNow=now;currentOrigin=origin.slice();frame++;if(after!=null)post?.begin(scene?.getEngine?.()?._gl||scene?._engine?._gl);}
  return {patch,bind,locations,attach,tick,updateMetadata,leafUniforms,
   nativeFrame:()=>({revision,bytes:atlasBytes,motion:[state.enabled&&state.wavyLeaves?state.leafStrength:0,nowSeconds,((currentOrigin[0]*.37+currentOrigin[2]*.23)%(Math.PI*2)+Math.PI*2)%(Math.PI*2),0]}),
   leafGeometryRevision(data){
    if(!data?.atlasSource)return 0;let known=leafGeometry.get(data);
    if(!known||known.atlas!==data.atlasSource||known.revision!==revision||known.terrain!==data.terrainRevision){const ids=new Set(leaves);known={atlas:data.atlasSource,revision,terrain:data.terrainRevision,leaf:data.atlasSource.some(a=>ids.has(a))};leafGeometry.set(data,known);}
    return known.leaf&&state.enabled&&state.wavyLeaves?String(state.leafStrength)+':'+Math.floor(nowSeconds*10):0;
   },
   diagnostics:()=>({implementation:'surface-v3',bloxdLighting:state.bloxdLighting,leafAtlasCount:leaves.length}),
   dispose(){attach(null);if(atlasContext){const c=atlasTextures.get(atlasContext);if(c&&!atlasContext.isContextLost?.())atlasContext.deleteTexture(c.texture);atlasTextures.delete(atlasContext);atlasContext=null;}},invalidateProgram(program){locationsCache.delete(program);}};
 };
})();
