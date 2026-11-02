'use strict';
// Client-only fixes for the verified 5.6.14.2 snapshot, including existing
// installations. Keep the original catalog and external shader project intact.
const crypto=require('node:crypto');
const {adaptWorldShader}=require('./shader-world-adapter.cjs');
const {adaptShaderPerformance}=require('./shader-performance.cjs');
const {adaptShaderLifecycle}=require('./shader-lifecycle.cjs');
const {adaptShaderBudget}=require('./shader-budget.cjs');
const {adaptChunkShadows}=require('./shader-chunk-cache.cjs');
const originals={
  'bootstrap.js':'0330ee87a8605390031c48d6cdfe14df3e30a71ea5dbf14bf02a2563897026f9',
  'runtime.js':'4ed84a1d415de43cbc74548139c7a6a2c02f9aee8c54f62be39ca9921df820c1',
  'ore-lighting.js':'700a0ff8af8d269de8b9b1d1e50b8995968880027a74fce514dd1d46226b0dd4',
  'shader.js':'918218a4e71f9e235f17c43e1780b743f280e4c63ad538ecc2f471d28164df22',
  'atmosphere.js':'a5ab14188c5cd4b90539f06d772f231a8f80bcd54354736803a84497712c1aae',
  'sun-shadows.js':'97780a398dcb5e549ef516fda9dc1ada527c0535cdc2262939876834bde98a85'
};
// Serialized at document start. All shader effects share one allocation per
// program; independent allocators otherwise cache conflicting sampler units.
function installShaderSamplers(root){
  let layouts=new WeakMap();
  const neutral=new WeakMap(),observed=new WeakSet(),limits=new WeakMap();
  const observe=gl=>{if(observed.has(gl))return;observed.add(gl);gl.canvas?.addEventListener?.('webglcontextlost',()=>{neutral.delete(gl);limits.delete(gl);layouts=new WeakMap();});};
  root.__BVFX_SAMPLER_UNITS__=(gl,program)=>{
    observe(gl);
    const tracker=root.__BVFX_GL_STATE__?.(gl);
    const revision=tracker?.programRevisions?.get(program) ?? 0;
    const link=tracker?.linkRevisions?.get(program) ?? 0;
    const cached=layouts.get(program);
    if(cached?.gl===gl && cached.revision===revision && cached.link===link)return cached.units;
    const types=new Set(['SAMPLER_2D','SAMPLER_CUBE','SAMPLER_3D','SAMPLER_2D_ARRAY','SAMPLER_2D_SHADOW',
      'SAMPLER_CUBE_SHADOW','SAMPLER_2D_ARRAY_SHADOW','INT_SAMPLER_2D','INT_SAMPLER_3D','INT_SAMPLER_CUBE',
      'INT_SAMPLER_2D_ARRAY','UNSIGNED_INT_SAMPLER_2D','UNSIGNED_INT_SAMPLER_3D',
      'UNSIGNED_INT_SAMPLER_CUBE','UNSIGNED_INT_SAMPLER_2D_ARRAY'].map(key=>gl[key]).filter(value=>value!==undefined));
    // Reflection changes only on relink. Native sampler assignments can change
    // between chunk draws; they must not re-query every ordinary uniform.
    let own,native;
    if(cached?.gl===gl && cached.link===link){({own,native}=cached);}
    else{
      own=[];native=[];
      for(let i=0,count=gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i<count;i++){
        const uniform=gl.getActiveUniform(program,i);if(!uniform || !types.has(uniform.type))continue;
        const location=gl.getUniformLocation(program,uniform.name);if(location===null)continue;
        const name=uniform.name.replace(/\[0\]$/,'');
        if(name.startsWith('uBvfx'))own.push({name,location,size:uniform.size});
        else{
          tracker?.markSampler?.(program,uniform.name,location);
          if(tracker?.samplerValues){
            if(!limits.has(gl))limits.set(gl,gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS??gl.MAX_TEXTURE_IMAGE_UNITS));
            tracker.samplerValues.mark(program,uniform.name,uniform.size,limits.get(gl));
          }
          native.push({name:uniform.name,location});
        }
      }
    }
    const occupied=new Set();
    for(const {name,location} of native){
      let value=tracker?.samplerValues?.read(program,name);
      if(value===undefined){value=gl.getUniform(program,location);tracker?.samplerValues?.seed(program,name,value);}
      if(typeof value==='number')occupied.add(value);else if(value)for(const unit of value)occupied.add(unit);
    }
    const units=new Map();let unit=gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)-1;
    for(const uniform of own){
      const assigned=[];
      for(let element=0;element<uniform.size;element++){
        while(unit>=0 && occupied.has(unit))unit--;
        assigned.push(unit);if(unit>=0)occupied.add(unit);unit--;
      }
      units.set(uniform.name,assigned[0]);
      if(assigned.every(value=>value>=0)){
        if(assigned.length===1)gl.uniform1i(uniform.location,assigned[0]);
        else gl.uniform1iv(uniform.location,new Int32Array(assigned));
      }
    }
    layouts.set(program,{gl,revision,link,units,own,native});return units;
  };
  root.__BVFX_BIND_NEUTRAL__=(gl,unit,target,persistent=false)=>{
    if(!(unit>=0))return;
    let textures=neutral.get(gl);if(!textures){textures=new Map();neutral.set(gl,textures);}
    observe(gl);
    let texture=textures.get(target);
    const tracker=root.__BVFX_GL_STATE__?.(gl),key=(gl.TEXTURE0+unit)+':'+target;
    if(texture && tracker?.bindings?.get(key)===texture && tracker.samplers?.get(unit)===null)return;
    const active=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0+unit);
    const previous=gl.getParameter(target===gl.TEXTURE_3D?gl.TEXTURE_BINDING_3D:gl.TEXTURE_BINDING_2D);
    const sampler=gl.getParameter(gl.SAMPLER_BINDING);
    if(!texture){
      texture=gl.createTexture();gl.bindTexture(target,texture);
      gl.texParameteri(target,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(target,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(target,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(target,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      if(target===gl.TEXTURE_3D)gl.texParameteri(target,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
      const fields=[gl.UNPACK_ALIGNMENT,gl.UNPACK_FLIP_Y_WEBGL,gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
        gl.UNPACK_ROW_LENGTH,gl.UNPACK_IMAGE_HEIGHT,gl.UNPACK_SKIP_ROWS,gl.UNPACK_SKIP_PIXELS,gl.UNPACK_SKIP_IMAGES].filter(value=>value!==undefined);
      const saved=fields.map(field=>gl.getParameter(field));const pbo=gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING);
      try{
        fields.forEach(field=>gl.pixelStorei(field,field===gl.UNPACK_ALIGNMENT?4:0));if(pbo)gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,null);
        const bytes=new Uint8Array([0,0,0,255]);
        if(target===gl.TEXTURE_3D)gl.texImage3D(target,0,gl.RGBA8,1,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        else gl.texImage2D(target,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        textures.set(target,texture);
      }finally{
        fields.forEach((field,i)=>gl.pixelStorei(field,saved[i]));if(pbo)gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,pbo);
      }
    }
    gl.bindTexture(target,texture);gl.bindSampler(unit,null);gl.activeTexture(active);
    if(persistent)return;
    return ()=>{const now=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0+unit);
      gl.bindTexture(target,previous);gl.bindSampler(unit,sampler);gl.activeTexture(now);};
  };
}
function adaptShader(name,source){
  if(!Object.hasOwn(originals,name))return source;
  if(crypto.createHash('sha256').update(source).digest('hex')!==originals[name])
    throw Error('Launcher shader adapter does not match '+name+'. Check the mod version.');
  const edit=(from,to)=>{
    if(!source.includes(from))throw Error('Launcher shader fix does not match '+name+': '+from.slice(0,60));
    source=source.replace(from,()=>to);
  };
  const section=(start,end,replacement)=>{
    const a=source.indexOf(start),b=source.indexOf(end,a);
    if(a<0 || b<0)throw Error('Shader section missing: '+name);
    source=source.slice(0,a)+replacement+source.slice(b);
  };
  if(name==='bootstrap.js')source+='\n('+installShaderSamplers.toString()+')(globalThis);\n';
  if(name==='shader.js'){
    // Use the game's current button chrome. YellowButton no longer exists;
    // the old inset backgrounds also covered the native border elements.
    source=source.replaceAll('YellowButton','GoldButton');
    section("      style.textContent = '.bvfx-custom-actions{--h:",
      '      document.documentElement.append(style);',`      style.textContent = '.bvfx-custom-actions{--h:3.2rem;gap:.7rem;align-items:stretch}.bvfx-custom-actions>.Dropdown-root{position:relative;flex:1 1 0;width:0;min-width:0}.bvfx-custom-actions .Dropdown-control,.bvfx-custom-actions>.bvfx-custom-name{box-sizing:border-box;min-height:var(--h)}.bvfx-custom-actions .Dropdown-control{display:flex;align-items:center;width:100%;padding-right:2rem}.bvfx-custom-actions .Dropdown-placeholder{flex:1;min-width:0;white-space:normal;overflow-wrap:anywhere}.bvfx-custom-actions .Dropdown-menu{z-index:20}.bvfx-custom-actions>.bvfx-custom-button{flex:0 0 calc(var(--h)*2);height:var(--h);min-width:0}.bvfx-custom-dialog .bvfx-custom-actions>.bvfx-custom-button{flex:1 1 0;width:0}.bvfx-custom-dialog-title{white-space:normal;overflow-wrap:anywhere}.bvfx-custom-button:disabled{opacity:.5;cursor:default}';
      style.textContent += '#'+shaderSettingsId+' button.NewButton,.bvfx-custom-dialog button.NewButton{appearance:none;font-family:inherit;font-size:inherit;color:inherit;padding:0;line-height:normal}.bvfx-custom-button:focus-visible,.bvfx-color-reset:focus-visible{outline:2px solid white;outline-offset:2px}';
`);
    // A flex menu row must keep the full slider track, rather than shrink to
    // its label/handle. Scope this to our page so native settings keep theirs.
    edit("style.textContent += '.bvfx-version", "style.textContent += '#'+shaderSettingsId+' .SettingsSliderDiv{min-width:0}#'+shaderSettingsId+' .SliderDiv{width:100%;min-width:0}#'+shaderSettingsId+' .rangeslider{width:100%}';\n    style.textContent += '.bvfx-version");
    edit("['golden','amethyst','#ffbd8c']","['golden','current','#ffbd8c']");
    edit('bloomEnabled:true,bloom:.20,oreGlowEnabled:true,oreGlowStrength:.5,',
      'atmosphereEnabled:true,bloomEnabled:true,bloom:.20,oreGlowEnabled:true,oreGlowStrength:.5,');
    section('    if(loc.oreUnit===undefined || loc.oreSamplerRevision!==revision) {',
      '    if(loc.oreUnit<0)',`    const units=PAGE.__BVFX_SAMPLER_UNITS__(gl,program);
    loc.oreUnit=units.get('uBvfxOreAtlasLookup') ?? -1;
    loc.oreSamplerRevision=revision;
`);
    edit('if(oreSurfaceStrength()<=0)return;',
      'if(oreSurfaceStrength()<=0)return PAGE.__BVFX_BIND_NEUTRAL__(gl,loc.oreUnit,gl.TEXTURE_2D,persistent);');
    // Liquid/native shader variants can declare block lighting after sky
    // lighting. Modify it after its declaration, not at the sky insertion.
    edit("${hasBlockLightContrib?'blockLightContrib *= bvfxNativeLightScale;':''}", '');
    const terrainPatchStart='let patched = source.replace(main, `${uniforms}\\n$&`).replace(skyMix, replacement);';
    edit(terrainPatchStart,terrainPatchStart+`
    if(hasBlockLightContrib)patched=patched.replace(/\\bvec3\\s+blockLightContrib\\s*=\\s*[^;]+;/,
      '$&\\nblockLightContrib *= 1.0-0.85*clamp(uBvfxBloxdLightingDarkness,0.0,1.0);');`);
  }
  if(name==='atmosphere.js'){
    edit('const skyCaches=new WeakMap();','const skyCaches=new WeakMap();\n    const skyFallbacks=new WeakMap();');
    edit('if(volumeContext)failedVolumes.delete(volumeContext);',
      'if(volumeContext){const fallback=skyFallbacks.get(volumeContext);if(fallback)volumeContext.deleteTexture(fallback);skyFallbacks.delete(volumeContext);failedVolumes.delete(volumeContext);}');
    edit('volumeTextures.delete(gl);failedVolumes.delete(gl);skyCaches.delete(gl);',
      'volumeTextures.delete(gl);failedVolumes.delete(gl);skyCaches.delete(gl);skyFallbacks.delete(gl);');
    edit('function bindVolume(gl,loc,program,persistent=false) {',`function bindVolume(gl,loc,program,persistent=false) {
      const restoreCloud=bindCloudVolume(gl,loc,program,persistent);
      if(!loc || loc.skyCache==null || !(loc.skyUnit>=0))return restoreCloud;
      // WebGL validates every active sampler, including branches disabled by
      // a uniform. An unbound sky-cache sampler rejects the native sky draw.
      const active=gl.getParameter(gl.ACTIVE_TEXTURE);
      gl.activeTexture(gl.TEXTURE0+loc.skyUnit);
      const previous=gl.getParameter(gl.TEXTURE_BINDING_2D);
      const sampler=gl.getParameter(gl.SAMPLER_BINDING);
      // Never bind the render target here. The full variant and cached native
      // program can assign their cache sampler to different texture units.
      let texture=skyFallbacks.get(gl);
      if(!texture){
        observeContext(gl);texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        withUnpackState(gl,()=>gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,
          gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255])));
        skyFallbacks.set(gl,texture);
      }
      gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindSampler(loc.skyUnit,null);gl.activeTexture(active);
      if(persistent)return;
      return ()=>{const unit=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0+loc.skyUnit);
        gl.bindTexture(gl.TEXTURE_2D,previous);gl.bindSampler(loc.skyUnit,sampler);gl.activeTexture(unit);restoreCloud?.();};
    }
    function bindCloudVolume(gl,loc,program,persistent=false) {`);
    section('      if(loc.volumeUnit===undefined || loc.samplerRevision!==revision) {',
      '      if(loc.volumeUnit<0)',`      const units=root.__BVFX_SAMPLER_UNITS__(gl,program);
      loc.volumeUnit=units.get('uBvfxAtmoCloudVolume') ?? -1;
      loc.skyUnit=units.get('uBvfxAtmoSkyCache') ?? -1;
      loc.samplerRevision=revision;
`);
    // A cache-only sky has no volume sampler. Do not return before assigning
    // its cache sampler just because the optional volume is absent.
    edit('if(loc.volumeUnit<0) {','if(loc.volume!==null && loc.volumeUnit<0) {');
    edit('cloudReady(0);return;',
      'cloudReady(0);return root.__BVFX_BIND_NEUTRAL__(gl,loc.volumeUnit,gl.TEXTURE_3D,persistent);');
    edit("        cloudReady(0);\n        return;\n      }\n      const tracker=", "        cloudReady(0);\n        return root.__BVFX_BIND_NEUTRAL__(gl,loc.volumeUnit,gl.TEXTURE_3D,persistent);\n      }\n      const tracker=");
    // Cache rendering must use a complete neutral sampler, never null or the
    // framebuffer's own colour texture, even while CacheReady is zero.
    edit('gl.bindTexture(gl.TEXTURE_2D,null);gl.bindSampler(loc.skyUnit,null);',
      'root.__BVFX_BIND_NEUTRAL__(gl,variant.loc.skyUnit,gl.TEXTURE_2D,true);');
    edit("if(!active)return;\n      const style=palette();",`if(!active){
        // Clear cache/cycle state explicitly before returning to native sky.
        if(loc.cacheReady!==null)original.uniform1f.call(gl,loc.cacheReady,0);
        if(loc.cycle!==null)original.uniform1f.call(gl,loc.cycle,0);
        if(loc.appliedValues)delete loc.appliedValues.cycle;
        return;
      }
      const style=palette();`);
  }
  if(name==='sun-shadows.js'){
    // Depth maps have one mip level. Explicit zero gradients select that
    // level without undefined implicit derivatives inside cascade/cutout
    // branches. Hard shadows compile without the optional multi-tap path.
    edit('return texture(shadowMap,vec3(p.xy+offset,p.z+dot(gradient,offset)-bias));',
      'return textureGrad(shadowMap,vec3(p.xy+offset,p.z+dot(gradient,offset)-bias),vec2(0.0),vec2(0.0));');
    edit('  if (softStep <= 0.0 || uBvfxSunPcf < 0.5) {',
      '  #ifndef BVFX_SUN_SMOOTHING\n  return centre;\n  #else\n  if (softStep <= 0.0 || uBvfxSunPcf < 0.5) {');
    edit('  return coverage/16.0;', '  return coverage/16.0;\n  #endif');
    const derivatives=/\bdFd[xy]\((?:farP|nearP|detailP|localP)\)/g;
    if([...source.matchAll(derivatives)].length!==8)throw Error('Shadow derivative adapter mismatch.');
    source=source.replace(derivatives,'vec3(0.0)');
    // Ordinary hit effects and menu previews change scene.meshes too. Check
    // membership cheaply before rebuilding model registries/terrain tokens.
    edit('    function casterRegistry() {',`    function sameSceneCasters(registry) {
      let retained=0;
      for(const mesh of scene?.meshes || []) {
        if(registry.sceneCasters.has(mesh)){retained++;continue;}
        if(registry.knownSceneMeshes.has(mesh))continue;
        if(!mesh.isDisposed?.() && registeredCaster(mesh,registry)
            && !casterRejection(mesh,registry.batches.has(mesh)))return false;
        registry.knownSceneMeshes.add(mesh);
      }
      if(retained!==registry.sceneCasters.size)return false;
      registry.meshCount=scene?.meshes?.length;
      return true;
    }
    function casterRegistry() {`);
    // One shared sampler allocator owns reflection. These legacy fields are
    // unused after allocation was unified and doubled first-use discovery.
    section('      if(loc.Active!==null) {','      return loc;', '');
    edit('const observedContexts=new WeakSet();','const observedContexts=new WeakSet();\n    const fallbackDepths=new WeakMap();');
    edit('function bind(gl,loc,frameStamp) {',`function fallbackDepth(gl){
      let texture=fallbackDepths.get(gl);if(texture)return texture;
      // An inactive shadow sampler also needs a complete comparison texture.
      const active=gl.getParameter(gl.ACTIVE_TEXTURE),previous=gl.getParameter(gl.TEXTURE_BINDING_2D);
      const pbo=gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING);
      const fields=[gl.UNPACK_ALIGNMENT,gl.UNPACK_ROW_LENGTH,gl.UNPACK_IMAGE_HEIGHT,
        gl.UNPACK_SKIP_ROWS,gl.UNPACK_SKIP_PIXELS,gl.UNPACK_SKIP_IMAGES,
        gl.UNPACK_FLIP_Y_WEBGL,gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL];
      const values=fields.map(field=>gl.getParameter(field));
      try{
        if(pbo)gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,null);
        fields.forEach(field=>gl.pixelStorei(field,field===gl.UNPACK_ALIGNMENT?4:0));
        texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,1,1,0,
          gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,new Uint32Array([0xffffffff]));
        fallbackDepths.set(gl,texture);return texture;
      }finally{
        gl.bindTexture(gl.TEXTURE_2D,previous);gl.activeTexture(active);
        fields.forEach((field,i)=>gl.pixelStorei(field,values[i]));if(pbo)gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,pbo);
      }
    }
    function bind(gl,loc,frameStamp) {`);
    edit('if (!active && loc.inactive && loc.unit >= 0 && loc.samplerRevision===samplerRevision) return;',
      '// Inactive uniforms are cheap; their sampler bindings still need validation.');
    edit('const reuseUniforms=active && Number.isFinite(frameStamp)',
      'const reuseUniforms=(!active && loc.inactive && loc.samplerRevision===samplerRevision && loc.appliedSettingsRevision===settingsRevision) || active && Number.isFinite(frameStamp)');
    edit('loc.samplerRevision=samplerRevision;',
      'loc.samplerRevision=samplerRevision;if(!active)loc.appliedSettingsRevision=settingsRevision;');
    edit('if(!active) return;\n      const hasSamplerObjects=', 'const hasSamplerObjects=');
    section('      if (loc.samplerRevision !== samplerRevision || loc.unit === undefined) {',
      '      const unit = loc.unit;',`      const units=root.__BVFX_SAMPLER_UNITS__(gl,loc.program);
      loc.unit=units.get('uBvfxSunMap') ?? -1;
      loc.nearUnit=units.get('uBvfxSunNearMap') ?? loc.unit;
      loc.detailUnit=units.get('uBvfxSunDetailMap') ?? loc.unit;
      loc.localUnit=units.get('uBvfxSunLocalMap') ?? loc.unit;
`);
    edit('bindDepth(unit,resources.depth);','const depth=active?resources.depth:fallbackDepth(gl);');
    edit('const nearActive=Boolean(settings.entityShadows!==false && resources.nearDepth',
      'const nearActive=Boolean(active && settings.entityShadows!==false && resources.nearDepth');
    edit('const detailActive=Boolean(resources.detailDepth && resources.detailReady',
      'const detailActive=Boolean(active && resources.detailDepth && resources.detailReady');
    edit('const localActive=Boolean(resources.localDepth && resources.localReady',
      'const localActive=Boolean(active && resources.localDepth && resources.localReady');
    edit(`      if(localActive)bindDepth(loc.localUnit,resources.localDepth);
      if(detailActive)bindDepth(loc.detailUnit,resources.detailDepth);
      if(nearActive) bindDepth(loc.nearUnit,resources.nearDepth);`, `      const textures=new Map([[unit,depth]]);
      for(const [key,target,valid,texture] of [
          ['NearMap',loc.nearUnit,nearActive,resources?.nearDepth],
          ['DetailMap',loc.detailUnit,detailActive,resources?.detailDepth],
          ['LocalMap',loc.localUnit,localActive,resources?.localDepth]]){
        if(loc[key]===null || !(target>=0))continue;
        if(valid || !textures.has(target))textures.set(target,valid?texture:depth);
      }
      for(const [target,texture] of textures)bindDepth(target,texture);`);
    edit('if(resources.detailReady && !detailActive)', 'if(active && resources.detailReady && !detailActive)');
    edit('if(resources.localReady && !localActive)', 'if(active && resources.localReady && !localActive)');
    edit('if(!reuseUniforms) {\n        gl.uniformMatrix4fv(loc.Matrix', 'if(active && !reuseUniforms) {\n        gl.uniformMatrix4fv(loc.Matrix');
    edit("gl.canvas?.addEventListener?.('webglcontextlost',()=>{if(context===gl){release();shadowFrame++;}});",
      "gl.canvas?.addEventListener?.('webglcontextlost',()=>{fallbackDepths.delete(gl);if(context===gl){release();shadowFrame++;}});");
    edit('dispose(){attach(null,null);release();restoreLights();context=null;},',
      'dispose(){attach(null,null);release();restoreLights();if(context){const texture=fallbackDepths.get(context);if(texture)context.deleteTexture(texture);fallbackDepths.delete(context);}context=null;},');
    // Native sky values belong to the atmosphere adapter/game. The shadow
    // renderer must not save a custom-night sun and restore it as native sky.
    const skyStart=source.indexOf('      for (const material of settings.atmosphereEnabled ? [] : (scene?.materials || [])) {');
    const skyEnd=source.indexOf('      return center;',skyStart);
    if(skyStart<0 || skyEnd<0)throw Error('Native sky ownership fix does not match.');
    source=source.slice(0,skyStart)+source.slice(skyEnd);
    edit('function world(mesh) { return values(mesh.getWorldMatrix?.() || mesh.computeWorldMatrix?.(false)',
      'function world(mesh) { return values(mesh.computeWorldMatrix?.(false) || mesh.getWorldMatrix?.()');
    // A grazing receiver can have an arbitrarily steep light-space gradient.
    // Limit texel bias in world units so it cannot detach from block edges.
    edit('highp float footprintBias=0.5*texel*(abs(gradient.x)+abs(gradient.y));',
      'highp float footprintBias=min(0.5*texel*(abs(gradient.x)+abs(gradient.y)),0.01*length(rowZ));');
    edit(`        if(changed) {
          resources.farReady=false;
          resources.localReady=false;
          resources.detailReady=false;
          resources.nearReady=false;
          resources.nearBaseReady=false;
          ready=false;
        }`,`        // Keep each complete texture with its rendered projection until its
        // replacement is drawable. Allocation already invalidates new maps.
        if(changed)resources.nearBaseReady=false;`);
    edit('const rejected=Object.create(null);','const rejected=Object.create(null);let pendingReads=false;');
    // A changed chunk set/projection must not bypass the complete-map guard.
    edit('if(ready && !changed && clearDepth) {','if(ready && clearDepth) {');
    edit('if(data?.bounds?.every(Number.isFinite)) {incompleteTerrain.delete(mesh);continue;}',
      'if(data?.bounds?.every(Number.isFinite) && cutoutSource(gl,mesh)!==false) {incompleteTerrain.delete(mesh);continue;}');
    edit("if(mask===false) {reject(cutoutFailure);continue;}","if(mask===false) {pendingReads=true;reject(cutoutFailure);continue;}");
    edit("if (!data) {reject(geometryFailure);continue;}","if (!data) {pendingReads=true;reject(geometryFailure);continue;}");
    edit('return {count,drawCalls,updated:started,input:items.length,rejected};',
      'return {count,drawCalls,updated:started,input:items.length,rejected,pending:pendingReads};');
    edit("rejected:{'terrain-pending':1}};","rejected:{'terrain-pending':1},pending:true};");
    // A partial/empty map is not a completed geometry revision. Accepting it
    // as complete stopped retries until a camera move or later world edit.
    for(const kind of ['far','local','detail']){
      const revisionKey=kind==='far'?'staticRevision':kind+'StaticRevision';
      const from='resources.'+revisionKey+'=registry.staticRevision;';
      if(!source.includes(from))throw Error('Shadow revision assignment missing.');
      source=source.replaceAll(from,'resources.'+revisionKey+'=stats.pending?-1:registry.staticRevision;');
      edit('resources.'+kind+'RetryAt=0;', 'resources.'+kind+'RetryAt=stats.pending?now+100:0;');
    }
    // Real new/removed casters still invalidate immediately, including pending
    // chunks. Unrelated helper churn keeps the ordinary 250-ms discovery rate.
    edit('now-registryAt<250)', 'now-registryAt<250 && (registryCache.meshCount===scene?.meshes?.length || sameSceneCasters(registryCache)))');
    edit('result.staticRevision=staticRevision;',`result.staticRevision=staticRevision;result.meshCount=scene?.meshes?.length;
      result.knownSceneMeshes=new WeakSet(scene?.meshes || []);
      result.sceneCasters=new Set([...result.staticItems,...result.movingItems].map(entry=>entry.mesh).filter(mesh=>seen.has(mesh)));`);
    // No entity remains in range: clear immediately instead of displaying the
    // old silhouette for a grace period. Only failed reads get that grace.
    edit('if(!resources.nearReady || now-resources.nearMissingSince>350)\n                resources.nearReady=false;',
      'if(!resources.nearReady || stats.input===0 || now-resources.nearMissingSince>350)\n                resources.nearReady=false;');
    // Defend CPU skinning against incomplete/zero-weight vertices on model
    // transitions. A malformed pose must never fill the map with NaNs.
    edit('const influencers=Math.max(0,Math.min(8,sourceInfluencers(mesh,extraWeights)));',
      'const influencers=Math.max(0,Math.min(extraIndices && extraWeights?8:4,sourceInfluencers(mesh,extraWeights)));');
    edit('const x=positions[v*3], y=positions[v*3+1], z=positions[v*3+2];',
      'const x=positions[v*3], y=positions[v*3+1], z=positions[v*3+2];let totalWeight=0;');
    edit('const offset=(j<4 ? indices : extraIndices)[v*4+j%4]*16;',`const bone=(j<4 ? indices : extraIndices)[v*4+j%4];
          const offset=bone*16;
          if(!Number.isFinite(w) || !Number.isInteger(bone) || bone<0 || offset+15>=boneMatrices.length)continue;
          totalWeight+=w;`);
    edit('      }\n      return result;\n    }\n    function geometry(',`        if(totalWeight>0)for(let c=0;c<3;c++)result[v*3+c]/=totalWeight;
        else {result[v*3]=x;result[v*3+1]=y;result[v*3+2]=z;}
      }
      return result;
    }
    function geometry(`);
    // Deformation exceptions are local to a caster. Do not release every
    // shadow texture when one mob's buffers/skeleton are being replaced.
    edit('function geometry(gl, mesh, maskKind=null) {',`function geometry(gl,mesh,maskKind=null){
      try{return readGeometry(gl,mesh,maskKind);}catch{geometryFailure='geometry-pending';return null;}
    }
    function readGeometry(gl, mesh, maskKind=null) {`);
  }
  return adaptChunkShadows(name,adaptShaderBudget(name,adaptShaderLifecycle(name,adaptShaderPerformance(name,adaptWorldShader(name,source)))));
}
module.exports={adaptShader,installShaderSamplers};
