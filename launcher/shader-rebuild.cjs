'use strict';
// The pinned upstream package remains intact. This is the owned GPU revision
// for existing and newly installed copies, after source-compatibility fixes.
const fs=require('node:fs'),path=require('node:path');
const builtin=name=>fs.readFileSync(path.join(__dirname,'builtin-mods',name),'utf8');
const {configureShadowDepth,shadowBatchMesh,shadowBatchMatrices,movingShadowSize,shadowReceiverFocus,createShaderVariantCache,appendShadowAttachments}=require('./shader-kernel.cjs');
function rebuildShader(name,source){
 if(name==='bootstrap.js')source+='\n('+require('./shader-render-state.cjs').installRenderStateCache.toString()+')(globalThis);\n';
 if(name==='atmosphere.js')return builtin('shader-clouds.js').replace('/* BVFX_CLOUD_DATA */null',JSON.stringify(fs.readFileSync(path.join(__dirname,'assets/cloud-volume.bin')).toString('base64')))+'\n'+builtin('shader-atmosphere.js');
 if(name==='liquid-shaders.js')return builtin('shader-liquids.js');
 const edit=(from,to)=>{if(!source.includes(from))throw Error('Shader rebuild mismatch: '+name+' / '+from.slice(0,60));source=source.replace(from,()=>to);};
 if(name==='day-night.js'){
  // A manually selected custom sky also owns its celestial drawing. Keep
  // native opacity writes reversible without changing the clock or positions.
  const begin=source.indexOf('      const current=new Set([sky.sunMesh,sky.moonMesh,sky.starsMesh].filter(Boolean));');
  const end=source.indexOf('      return frame;',begin);
  if(begin<0||end<begin)throw Error('Celestial visibility contract missing');
  const visibility=source.slice(begin,end);
  edit(visibility,'      syncBodies(sky,scene);\n');
  edit('    function sample(noa,scene) {','    function syncBodies(sky,scene) {\n'+visibility+'    }\n    function sample(noa,scene) {');
  edit('      if(!enabled() || !sky?.earthSkyBox',`      if(!enabled()) {
        frame=null;phase=null;
        if(raw.enabled && raw.atmosphereEnabled && sky)syncBodies(sky,scene);else restore();
        return null;
      }
      if(!sky?.earthSkyBox`);
  const restoreVisibility="if(record.descriptor)Object.defineProperty(mesh,'visibility',{...record.descriptor,value:record.value});\n        else {delete mesh.visibility;mesh.visibility=record.value;}";
  edit(restoreVisibility,'restoreVisibility(mesh,record);');
  edit("if(record.descriptor)Object.defineProperty(mesh,'visibility',{...record.descriptor,value:record.value});\n          else {delete mesh.visibility;mesh.visibility=record.value;}",'restoreVisibility(mesh,record);');
  edit('    function restore() {',`    function restoreVisibility(mesh,record) {
      if(record.descriptor) {
        if('value' in record.descriptor)Object.defineProperty(mesh,'visibility',{...record.descriptor,value:record.value});
        else {Object.defineProperty(mesh,'visibility',record.descriptor);record.descriptor.set.call(mesh,record.value);}
      }else {delete mesh.visibility;mesh.visibility=record.value;}
    }
    function restore() {`);
  edit("      if(descriptor && (!descriptor.configurable || !('value' in descriptor)))return;",`      if(descriptor && !descriptor.configurable)return;
      let backing=descriptor,prototype=mesh;
      while(!backing && (prototype=Object.getPrototypeOf(prototype)))backing=Object.getOwnPropertyDescriptor(prototype,'visibility');
      if(backing && !('value' in backing) && typeof backing.set!=='function')return;
      const write=backing?.set?value=>backing.set.call(mesh,value):null;`);
  edit('      Object.defineProperty(mesh,\'visibility\',{configurable:true,enumerable:descriptor?.enumerable ?? true,',`      // Accessor-backed mesh mirrors read their row buffers directly when
      // rendering. A JS getter returning zero alone does not hide those rows.
      write?.(0);
      Object.defineProperty(mesh,'visibility',{configurable:true,enumerable:descriptor?.enumerable ?? true,`);
  edit('get:record.get,set:value=>{record.value=value;}});','get:record.get,set:value=>{record.value=value;write?.(0);}});');
 }
 if(name==='shader.js'){
  edit("${atmosphere?.common || ''}","${atmosphere?.terrainCommon || ''}");
  // The retired underwater shaft consumer must not keep traversing water
  // columns on every atmosphere update.
  const waterShaftStart=source.indexOf('  let waterShaftSample=');
  const waterShaftEnd=source.indexOf('  function syncAtmosphereWorldFrame(',waterShaftStart);
  if(waterShaftStart<0||waterShaftEnd<waterShaftStart)throw Error('Retired water shaft contract missing');
  source=source.slice(0,waterShaftStart)+source.slice(waterShaftEnd);
  edit('    syncWaterShaftFrame(camera,originX,originY,originZ);','');
  // Atmosphere.bind receives this captured method table, not the GL object.
  edit('      uniform4fv: prototype.uniform4fv,','      uniform4fv: prototype.uniform4fv,\n      uniformMatrix4fv: prototype.uniformMatrix4fv,');
  edit("['sunResolutionExponent', 'Shadow resolution', 5, 12,", "['sunResolutionExponent', 'Shadow resolution', 5, 13,");
  edit('Math.min(12,Math.round(Number(stored.sunResolutionExponent)))','Math.min(13,Math.round(Number(stored.sunResolutionExponent)))');
  // The atmosphere projects its selected body itself, using the same camera
  // as its sky rays. Retire the separate (occasionally divergent) flare path.
  const solarStart=source.indexOf('    const az=Number(state.sunAzimuth)*Math.PI/180,el=Number(state.sunElevation)*Math.PI/180;');
  const solarEnd=source.indexOf('    atmosphere?.setSunScreen?.(sx,sy,cw>0.0001 && el>0);',solarStart);
  if(solarStart<0||solarEnd<solarStart)throw Error('Solar projection contract missing');
  source=source.slice(0,solarStart)+`    atmosphere?.setViewProjection?.(view,projection);
    atmosphere?.setFog?.(scene.fogColor?.r,scene.fogColor?.g,scene.fogColor?.b);`+source.slice(solarEnd+'    atmosphere?.setSunScreen?.(sx,sy,cw>0.0001 && el>0);'.length);
  edit("    const active=Boolean(WATER_STYLES[state.waterStyle]?.mode>1\n      || WATER_STYLES[state.lavaStyle]?.mode>1);",
    "    const active=Boolean(state.waterEnabled && WATER_STYLES[state.waterStyle]?.mode>1\n      || state.lavaEnabled && WATER_STYLES[state.lavaStyle]?.mode>1);");
  // Native create/rewriteChunkBuffers uses a shared [0,1,2,0,2,3] index
  // buffer, not the supplied index values. Every tessellated cell therefore
  // needs four consecutive vertices; a shared grid crosses unrelated faces.
  edit('    const faces = positions.length/12, selected = new Set(), surfaces = new Map();', `    const faces = positions.length/12, selected = new Set(), surfaces = new Map();
    if(normals.length!==positions.length || !positions.every(Number.isFinite) || !normals.every(Number.isFinite))return null;
    for(const [key,stride]of [['colors',4],['uvs',2],['indicesAcrossAtlasArr',1],['quadEdgeData',4]])
      if(data[key] && data[key].length!==faces*4*stride)return null;
    for(let face=0;face<faces;face++)for(let i=0;i<6;i++){
      const corner=data.indices[face*6+i]-face*4;
      if(!Number.isInteger(corner) || corner<0 || corner>3)return null;
    }`);
  edit('      vertexCount += (nx+1)*(nz+1);', '      vertexCount += nx*nz*4;');
  edit("      const step=typeof spacing==='function'?spacing(face):spacing;", "      const step=typeof spacing==='function'?spacing(face):spacing;\n      if(!Number.isFinite(step)||step<=0)return null;");
  const emitStart=source.indexOf('    let vertex=0, index=0;',source.indexOf('  function subdivideWaterData('));
  const emitEnd=source.indexOf('    result.bvfxWaterEdge=edges;',emitStart);
  if(emitStart<0||emitEnd<0)throw Error('Liquid quad emission contract missing');
  source=source.slice(0,emitStart)+`    let vertex=0,index=0;
    const cellCorners=[[0,0],[1,0],[1,1],[0,1]];
    for(let face=0;face<faces;face++){
      const [nx,nz,top,order,orderCode]=plans[face],base=face*4;
      for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
        const first=vertex;
        for(let nativeCorner=0;nativeCorner<4;nativeCorner++,vertex++){
          const corner=cellCorners[order.indexOf(nativeCorner)];
          const u=(x+corner[0])/nx,v=(z+corner[1])/nz;
          const weights=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v];
          mapping.set([base,u,v,orderCode],vertex*4);
          packedSources[vertex]=base+nativeCorner;
          if(!top){
            // Solid faces keep their exact native attributes and avoid all
            // interpolation work, even inside a mixed lava/stone draw call.
            for(const [key,stride]of fields){
              const values=data[key];if(!values)continue;
              const at=(base+nativeCorner)*stride,to=vertex*stride;
              for(let c=0;c<stride;c++)result[key][to+c]=values[at+c];
            }
            if(data[lightKey])result[lightKey][vertex]=data[lightKey][base+nativeCorner];
            continue;
          }
          for(const [key,stride]of fields){
            if(!data[key])continue;
            for(let c=0;c<stride;c++){
              let value=0;
              for(let k=0;k<4;k++)value+=data[key][(base+order[k])*stride+c]*weights[k];
              result[key][vertex*stride+c]=value;
            }
          }
          if(data[lightKey])result[lightKey][vertex]=interpolateWaterLight(data[lightKey],base,u,v,orderCode);
          if(top)edges.set(edgeAt(...result.positions.subarray(vertex*3,vertex*3+3)),vertex*3);
        }
        for(let i=0;i<6;i++)result.indices[index++]=first+data.indices[face*6+i]-base;
      }
    }
`+source.slice(emitEnd);
  edit('    let vertex=0,index=0;','    const packedSources=new Uint32Array(vertexCount);result.bvfxPackedSources=packedSources;\n    let vertex=0,index=0;');
  edit('    result.bvfxWaterEdge=edges;', '    if(data.faceGroups)result.faceGroups=remapLiquidFaceGroups(data.faceGroups,plans);\n    result.bvfxWaterEdge=edges;');
  // Native normal.w is the upper material flag byte, not padding. Preserve
  // both flag bytes and exact untouched vertices in mixed lava/stone chunks.
  edit('    const count=data.positions.length/3,stride=data.usesAtlas?32:28;',
    '    const count=data.positions.length/3,stride=data.usesAtlas?32:28;\n    const originalBytes=ArrayBuffer.isView(data.vertices)?new Uint8Array(data.vertices.buffer,data.vertices.byteOffset,data.vertices.byteLength):new Uint8Array(data.vertices);');
  edit('      if(data.usesAtlas)view.setFloat32(b+28,data.indicesAcrossAtlasArr[i],true);',`      if(data.usesAtlas)view.setFloat32(b+28,data.indicesAcrossAtlasArr[i],true);
      const source=(data.bvfxPackedSources?.[i]??i)*stride;
      view.setUint8(b+15,originalBytes[source+15]);view.setUint8(b+19,originalBytes[source+19]);`);
  edit('record.active=Boolean(WATER_STYLES[state.waterStyle]?.mode>1\n      || WATER_STYLES[state.lavaStyle]?.mode>1);',
    'record.active=Boolean(state.waterEnabled && WATER_STYLES[state.waterStyle]?.mode>1\n      || state.lavaEnabled && WATER_STYLES[state.lavaStyle]?.mode>1);');
  edit("(state.waterStyle==='wavey' && nativeKinds[face*4]===1)", "(state.waterEnabled && state.waterStyle==='wavey' && nativeKinds[face*4]===1)");
  edit("(state.lavaStyle==='wavey' && nativeKinds[face*4]===2)", "(state.lavaEnabled && state.lavaStyle==='wavey' && nativeKinds[face*4]===2)");
  edit("+'|'+Boolean(state.enabled)+'|'+Boolean(state.waterStyle==='wavey')", "+'|'+Boolean(state.enabled)+'|'+Boolean(state.waterEnabled)+'|'+Boolean(state.lavaEnabled)+'|'+Boolean(state.waterStyle==='wavey')");
  // Instantiate before settings are used by the renderer. New settings are
  // normalized without replacing saved presets, accounts or profiles.
  source=builtin('shader-post.js')+'\n'+builtin('shader-surfaces.js')+'\n'+source;
  // Cache exact source variants per GL context. A failed optional patch must
  // not be compiled and synchronously retried for every new native material.
  edit('    const getState = (gl) => {', '    '+createShaderVariantCache.toString()+'\n    const getState = (gl) => {');
  edit('data = { patchedShaders:', 'data = { sourceCache:createShaderVariantCache(),patchedShaders:');
  edit('          data.patchedShaders=new WeakSet();', '          data.sourceCache=createShaderVariantCache();data.patchedShaders=new WeakSet();');
  edit('      let patched = source;\n      let entityPatched = false;\n      try {', `      const cacheState=getState(this),cachedSource=cacheState.sourceCache.get(source);
      if(cachedSource?.failed)return original.shaderSource.call(this,shader,source);
      let patched=cachedSource?.patched ?? source;
      let entityPatched=cachedSource?.entityPatched || false;
      if(!cachedSource)try {`);
  edit('      if(patched!==source) {\n        const glState=getState(this);', `      if(!cachedSource)cacheState.sourceCache.put(source,{patched,entityPatched,effectPatched});
      if(patched!==source) {
        const glState=getState(this);`);
  edit("          const error=original.getShaderInfoLog?.call(this,shader) || 'unknown compile error';", "          const error=original.getShaderInfoLog?.call(this,shader) || 'unknown compile error';\n          glState.sourceCache.reject(source);");
  edit('      const effectPatched=patched!==source;', '      const effectPatched=cachedSource?cachedSource.effectPatched:patched!==source;');
  edit('  const dayNightLockedSetting=', '  const surfaces=PAGE.__BVFX_CREATE_SURFACES__(state);PAGE.__BVFX_SURFACES__=surfaces;\n  const dayNightLockedSetting=');
  const from=source.indexOf('    const replacement = `'),to=source.indexOf('    let patched = source.replace(main,',from);
  if(from<0||to<0)throw Error('Terrain lighting insertion missing');
  source=source.slice(0,from)+`    const replacement = \`
        float bvfxSkyLevel=clamp(lightLevels.w,0.0,1.0);
        vec3 skyLightContrib=mix(uAmbientLightColour,uSkyLightColour,bvfxSkyLevel);
        float bvfxNativeLightScale=1.0-.85*clamp(uBvfxBloxdLightingDarkness,0.0,1.0);
        skyLightContrib*=bvfxNativeLightScale;
        vec3 bvfxAmbientComponent=uAmbientLightColour*bvfxNativeLightScale;
        if(uBvfxDisableNative>.5){
          skyLightContrib=vec3(1.0);
          bvfxAmbientComponent=vec3(.35);
        }else if(uBvfxShadowStrength>0.0){
          skyLightContrib*=mix(1.0,mix(uBvfxShadowFloor,1.0,smoothstep(0.0,1.0,bvfxSkyLevel)),uBvfxShadowStrength);
        }
        \${atmosphere?.groundLighting || ''}
        bvfxAmbientComponent=min(skyLightContrib,bvfxAmbientComponent);
        // BVFX sunlight receiver
        vec3 bvfxLocalLight=vec3(0.0);
        if(uBvfxEnchantHeldLight.a>0.0 || uBvfxEnchantArmorLight.a>0.0){
          float d=distance(vPositionW,uBvfxEnchantLightPos);
          float h=uBvfxEnchantHeldLight.a>0.0?pow(max(0.0,1.0-d/uBvfxEnchantHeldLight.a),2.0):0.0;
          float a=uBvfxEnchantArmorLight.a>0.0?pow(max(0.0,1.0-d/uBvfxEnchantArmorLight.a),2.0):0.0;
          bvfxLocalLight=min(vec3(1.5),uBvfxEnchantHeldLight.rgb*h+uBvfxEnchantArmorLight.rgb*a);
        }
        \${directLocalLight?'':'skyLightContrib+=bvfxLocalLight;'}\`;

`+source.slice(to);
  edit("'$&\\nblockLightContrib *= 1.0-0.85*clamp(uBvfxBloxdLightingDarkness,0.0,1.0);'", "'$&\\nblockLightContrib *= (1.0-uBvfxDisableNative)*(1.0-.85*clamp(uBvfxBloxdLightingDarkness,0.0,1.0));'");
  // Declarations must precede the rewritten light block even for direct
  // CPU/compiler users of patchTerrainShader, not only shaderSource hooks.
  edit('    if (typeof source !== \'string\')return source;', "    if (typeof source !== 'string')return source;\n    source=surfaces.patch(source);");
  edit('        patched = patchLiquidVertexShader(source);','        patched = surfaces.patch(patchLiquidVertexShader(source));');
  edit("      if(info) {\n        info.locations=null;", "      surfaces.invalidateProgram(program);\n      if(info) {\n        info.locations=null;");
  edit('      const locations = info?.locations;',`      const locations = info?.locations;
      if(info)surfaces.bind(gl,info.surfaceLocations || (info.surfaceLocations=surfaces.locations(gl,glState.currentProgram)),original,undefined,uniformRevision);`);
  edit('  function bindWaterClock(scene) {',`  const waterOrigin3=()=>{const noa=getNoaRuntime();return getRenderOrigin(noa) || [0,0,0];};
  function bindWaterClock(scene) {
    surfaces.attach(scene);`);
  edit('      waterFrameId++;','      waterFrameId++;\n      surfaces.tick(waterOrigin3());');
  edit('    rememberLocalPlayerMeshes(noa);','    surfaces.updateMetadata(getOreDefinitionRegistry()?.metadatas || runtime.api?.singletons?.itemsClient,meshingWorkers);\n    rememberLocalPlayerMeshes(noa);');
  const entityStart=source.indexOf('  function bindEntityLightMaterials(noa,scanMeshes=true) {');
  const entityRemember=source.indexOf('    rememberLocalPlayerMeshes(noa);',entityStart);
  if(entityStart<0||entityRemember<0)throw Error('Entity material discovery contract missing');
  source=source.slice(0,entityRemember)+source.slice(entityRemember).replace('    rememberLocalPlayerMeshes(noa);','    if(scanMeshes)rememberLocalPlayerMeshes(noa);');
  source=source.replaceAll('const wanted=state.enabled && (', 'const wanted=state.enabled && (state.bloxdLighting===false || state.wavyLeaves || ');
  edit("if (key === 'sunShadowEnabled' || key === 'entityShadows'", "if (key === 'bloxdLighting' || key === 'wavyLeaves' || key === 'sunShadowEnabled' || key === 'entityShadows'");
  edit('state.enabled && kind && !affected?1:0', 'state.enabled && (state.bloxdLighting===false || kind && !affected)?1:0');
  edit('    cpuWallMs:shaderBudget.cpuWall(),','    shaderVariants:PAGE.__BVFX_SHADER_CACHE_STATS__?.() || null,surfaces:surfaces.diagnostics(),gpuTiming:PAGE.__BVFX_GPU_TIMER__?.diagnostics() || null,\n    cpuWallMs:shaderBudget.cpuWall(),');
  edit('        contexts.set(gl, data);', '        contexts.set(gl, data);\n        PAGE.__BVFX_SHADER_CACHE_STATS__=()=>data.sourceCache.diagnostics();');
  edit('sun?.dispose(); atmosphere?.dispose();','sun?.dispose(); atmosphere?.dispose();surfaces.dispose();');
  // Clouds now render directly at native resolution. Remove CSS/SVG blur of
  // the complete canvas; colour controls remain cheap native CSS operations.
  edit('const bloomOn = state.enabled && state.bloomEnabled && state.bloom > .01;', 'const bloomOn = false; // Bloom is an owned nine-tap GPU pass, not a blurred canvas.');
  edit("const disabled = () => !state.enabled || Boolean(dependency && !state[dependency])", "const disabled = () => !state.enabled || (key==='bloxdLightingDarkness' && state.bloxdLighting===false) || Boolean(dependency && !state[dependency])");
  edit("Number((Math.round(clamp(value,min,max)*(1/step))/(1/step)).toFixed(2))", "Number((Math.round(clamp(value,min,max)*(1/step))/(1/step)).toFixed(3))");
  edit("roundSetting(state[key]) + (unit || '')", "(key==='leafStrength'?Number(state[key].toFixed(3)):roundSetting(state[key])) + (unit || '')");
  edit('versionText.textContent = `Shader Version: ${SHADER_VERSION}`;', 'versionText.textContent = `Bloxdy shader kernel 2 · Base package ${SHADER_VERSION}`;');
  // Only real shadow controls invalidate shadow resources. A leaf
  // slider must never cause a full shadow-map rebuild.
  edit("if(key!=='oreSurfaceBrightness')sun?.invalidateSettings?.();", "if(key.startsWith('sun')||key==='entityShadows'||key==='enabled')sun?.invalidateSettings?.();");
  edit("['bloxdLightingDarkness', 'Bloxd lighting darkness', 0, 1],", "['bloxdLightingDarkness', 'Bloxd lighting darkness', 0, 1],\n    ['leafSpeed','Wave speed',0,5,'wavyLeaves',.05,'x'],\n    ['leafStrength','Wave strength',0,.12,'wavyLeaves',.005,' blocks'],");
  edit("categories.dynamic.append(dynamicGroup);",`categories.dynamic.append(dynamicGroup);
      const leafGroup=document.createElement('div');leafGroup.className='SettingBoxGroup';leafGroup.append(makeNativeCheckbox('wavyLeaves','Wavy leaves'));
      for(const spec of sliderSpecs.filter(s=>s[4]==='wavyLeaves'))leafGroup.append(makeNativeSlider(spec));categories.leaves.append(leafGroup);`);
  edit("['shadows','Shadows'],", "['shadows','Shadows'],['leaves','Leaves'],");
  edit("dynamicGroup.append(makeNativeSlider(sliderSpecs.find(spec=>spec[0]==='bloxdLightingDarkness')));", "dynamicGroup.append(makeNativeCheckbox('bloxdLighting','Bloxd Lighting'));\n      dynamicGroup.append(makeNativeSlider(sliderSpecs.find(spec=>spec[0]==='bloxdLightingDarkness')));");
  edit('  const checkboxDescriptions = {',`  const checkboxDescriptions = {
    bloxdLighting:'Uses Bloxd sky, ambient and block lighting. Turn off for neutral base lighting while keeping Bloxdy cast shadows and custom emission. The darkness slider applies only while enabled.',
    wavyLeaves:'Moves recognized leaf vertices on the GPU. Textures stay attached. Unknown or shared atlas entries remain still.',`);
  edit("const disabled = !state.enabled || Boolean(dependency && !state[dependency])", "const disabled = !state.enabled || (key==='bloxdLightingDarkness' && state.bloxdLighting===false) || Boolean(dependency && !state[dependency])");
  edit("[liquid+'Reflection','Reflection',100,1,'%'],", '');
  source=source.replaceAll('waves and reflections','waves and opacity').replaceAll('below its sky reflections','below its surface');
  edit("const loaded = { ...DEFAULTS, ...stored };", "const loaded = { ...DEFAULTS, ...stored };\n      loaded.bloxdLighting=typeof stored.bloxdLighting==='boolean'?stored.bloxdLighting:stored.disableBloxdLighting!==true;\n      delete loaded.disableBloxdLighting;\n      for(const key of Object.keys(loaded))if(key==='blockReflections'||key.startsWith('reflection'))delete loaded[key];");

 }
 if(name==='sun-shadows.js'){
  edit('const safeAllocationCap = 4096;','const safeAllocationCap = 8192;');
  edit('const qualities = [32,64,128,256,512,1024,2048,4096];','const qualities = [32,64,128,256,512,1024,2048,4096,8192];');
  edit('Math.min(12,Math.round(settings.sunResolutionExponent))','Math.min(13,Math.round(settings.sunResolutionExponent))');
  edit("const factor='mix(1.0, bvfxSunVisibility(vPositionW, vNormalW), uBvfxSunStrength)';",`const factor='mix(1.0,mix(uBvfxSunFloor,1.0,bvfxSunVisibility(vPositionW,vNormalW)),uBvfxSunStrength)';
      const applyShadow=source.includes('vec3 bvfxAmbientComponent')?'skyLightContrib=bvfxAmbientComponent+(skyLightContrib-bvfxAmbientComponent)*'+factor+';':'skyLightContrib*='+factor+';';
      source=source.replace('// BVFX liquid sunlight','exposure*='+factor+';');`);
  edit('`skyLightContrib *= ${factor};\\n        // BVFX sunlight receiver`','`${applyShadow}\\n        // BVFX sunlight receiver`');
  // The old compare sampler combined driver comparison filtering, divergent
  // branches and gradient work. Own the depth comparisons explicitly instead.
  source=source.replaceAll('sampler2DShadow','sampler2D');
  edit('return textureGrad(shadowMap,vec3(p.xy+offset,p.z+dot(gradient,offset)-bias),vec2(0.0),vec2(0.0));',
   'return step(p.z+dot(gradient,offset)-bias,textureLod(shadowMap,p.xy+offset,0.0).r);');
  source=source.replaceAll('gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE','gl.TEXTURE_COMPARE_MODE,gl.NONE')
   .replaceAll('gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE','gl.TEXTURE_COMPARE_MODE, gl.NONE');
  const depthParameters=/(?:\s*gl\.texParameteri\(gl\.TEXTURE_2D,\s*gl\.TEXTURE_(?:MIN_FILTER|MAG_FILTER|COMPARE_MODE|COMPARE_FUNC|WRAP_S|WRAP_T),\s*gl\.\w+\);){3,6}/g;
  let depthAllocators=0;
  source=source.replace(depthParameters,()=>{depthAllocators++;return '\n      configureShadowDepth(gl);';});
  if(depthAllocators!==3)throw Error('Shadow depth allocator contract changed: '+depthAllocators);
  source=source.replaceAll('variation?.getMesh?.()','shadowBatchMesh(variation)');
  edit('const matrices=batch?.buffers?.matrix || thin?.matrixData;', 'const matrices=shadowBatchMatrices(batch,mesh);');
  edit('const kind=`aAtlasIdx${group+1}`,buffer=batch?.buffers?.[kind];',
    'const kind=`aAtlasIdx${group+1}`,interleaved=batch?.batch?.attributes,buffer=interleaved || batch?.buffers?.[kind];');
  edit('const stride=batch.bufferStrides?.[kind] ?? 4;', 'const stride=interleaved?batch.batch.rowStride:batch.bufferStrides?.[kind] ?? 4;');
  edit('        selectedSize, radius,', '        selectedSize, radius,movingSize:movingShadowSize(selectedSize,radius,detailRadius),');
  edit(':Math.min(q.selectedSize,2048,getSafeAllocationLimit()));', ':Math.min(q.movingSize,getSafeAllocationLimit()));');
  edit('          moving:resources?.nearSize || null,', '          moving:resources?.nearSize || null,movingRequested:q.movingSize,');
  edit('(resources?.nearSize && resources.nearSize<q.selectedSize)', '(resources?.nearSize && resources.nearSize<q.movingSize)');
  edit('const rawCenter = camera?.getAbsolutePosition?.() || camera?.globalPosition || camera?.position || { x: 0, y: 0, z: 0 };',
    'const rawCenter=shadowReceiverFocus(game,playerId(),scene,root.__BVFX_RUNTIME_LAYOUT__?.(game));');
  edit('const camera=scene.activeCamera?.getAbsolutePosition?.()\n        || scene.activeCamera?.globalPosition || scene.activeCamera?.position;',
    'const camera=shadowReceiverFocus(game,playerId(),scene,root.__BVFX_RUNTIME_LAYOUT__?.(game));');
  edit('let nativeSlots=0, visibleSlots=0;', 'let nativeSlots=0,visibleSlots=0,nativeDrawableSlots=0;');
  edit('          if(!mesh || !Number.isInteger(slot))return;', `          if(!mesh || !Number.isInteger(slot))return;
          const matrices=shadowBatchMatrices(variation,mesh);
          if(matrices && slot<(variation.numEnabled ?? mesh._thinInstanceDataStorage?.instancesCount ?? 0) && (slot+1)*16<=matrices.length)nativeDrawableSlots++;`);
  edit("      const compileState=(fragmentSource)=>{",`      const waveVertexSource=root.__BVFX_SURFACES__?vertexSource.replace('void main()',root.__BVFX_SURFACES__.leafUniforms+'\\nuniform float leafCaster;\\nvoid main()')
        .replace('gl_Position=lightMatrix*(instanced?instanceWorld:world)*vec4(position,1.0);','vec4 q=(instanced?instanceWorld:world)*vec4(position,1.0);if(leafCaster>.5)q.xyz+=bvfxLeafDisplacement(q.xyz,atlasIndex);gl_Position=lightMatrix*q;'):vertexSource;
      const compileState=(fragmentSource)=>{`);
  edit('shader(gl.VERTEX_SHADER,vertexSource)','shader(gl.VERTEX_SHADER,waveVertexSource)');
  edit("return {program,instanced:gl.getUniformLocation(program,'instanced')", "return {program,leafCaster:gl.getUniformLocation(program,'leafCaster'),instanced:gl.getUniformLocation(program,'instanced')");
  edit('gl.useProgram(state.program);gl.uniformMatrix4fv', "gl.useProgram(state.program);if(state.sampler!=null)gl.uniform1i(state.sampler,maskUnit);gl.uniform1f(state.leafCaster,mask?.kind==='array'?1:0);root.__BVFX_SURFACES__?.bind(gl,root.__BVFX_SURFACES__.locations(gl,state.program),gl);gl.uniformMatrix4fv");
  edit('          if(mask) {\n            gl.bindBuffer(gl.ARRAY_BUFFER,data.uvBuffer);', `          if(mask?.kind!=='array')gl.disableVertexAttribArray(6);
          if(!mask)gl.disableVertexAttribArray(5);
          if(mask) {
            gl.bindBuffer(gl.ARRAY_BUFFER,data.uvBuffer);`);
  edit('const rect=projectShadowBounds(data.bounds,frame.wm,passMatrix,size);', 'const rect=projectShadowBounds(data.bounds.map((v,i)=>v+(i<3?-.13:.13)),frame.wm,passMatrix,size);');
  edit('revision:terrainRevisions.get(mesh.sourceMesh || mesh)||0,', "revision:String(terrainRevisions.get(mesh.sourceMesh || mesh)||0)+':'+(root.__BVFX_SURFACES__?.leafGeometryRevision(data) || 0),");
  // Interpolate four comparison results, rather than interpolating depth or
  // averaging a footprint that jumps between texels as the camera moves.
  const from=source.indexOf('  // Symmetric tent weights'),to=source.indexOf('  #endif\n}',from);
  if(from<0||to<0)throw Error('Shadow receiver kernel missing');
  source=source.slice(0,from)+`  highp vec2 weights=fract(p.xy/texel-0.5);
  highp vec2 base=(floor(p.xy/texel-0.5)+0.5)*texel-p.xy;
  float a=bvfxSunCompare(shadowMap,p,base,gradient,bias);
  float b=bvfxSunCompare(shadowMap,p,base+vec2(texel,0.0),gradient,bias);
  float c=bvfxSunCompare(shadowMap,p,base+vec2(0.0,texel),gradient,bias);
  float d=bvfxSunCompare(shadowMap,p,base+vec2(texel),gradient,bias);
  return mix(mix(a,b,weights.x),mix(c,d,weights.x),weights.y);
`+source.slice(to);
  // Compare against the depth at the sampled texel centre, not the pixel's
  // unsnapped reference depth, so inclined planes cannot shadow themselves
  // simply because the two cascades have different texel sizes.
  edit('highp vec2 offset, highp vec2 gradient, highp float bias) {', 'highp vec2 offset, highp vec2 gradient, highp float bias, highp float texel) {');
  edit('return step(p.z+dot(gradient,offset)-bias,textureLod(shadowMap,p.xy+offset,0.0).r);',`highp vec2 uv=(floor((p.xy+offset)/texel)+0.5)*texel;
  highp float reference=p.z+dot(gradient,uv-p.xy)-bias;
  return step(reference,textureLod(shadowMap,uv,0.0).r);`);
  source=source.replaceAll('gradient,bias)', 'gradient,bias,texel)');
  edit('  float centre=bvfxSunCompare(shadowMap,p,vec2(0.0),gradient,bias,texel);\n','');
  source=source.replaceAll('return centre;','return bvfxSunCompare(shadowMap,p,vec2(0.0),gradient,bias,texel);');
  edit('highp float footprintBias=min(0.5*texel*(abs(gradient.x)+abs(gradient.y)),0.01*length(rowZ));', 'highp float footprintBias=0.000002;');
  edit("const nativeWalk=get('updateWalkingState'), animator=get('animator'), motion=get('movement') || entities.Nq?.(player) || {};", "const nativeWalk=get('updateWalkingState'), animator=get('animator'), motion=get(entities?.names?.moveState || 'moveState') || get('movement') || {}; ");
  edit("nativeWalk?.getCurrentSpeed?.() ?? motion.speed", "motion.speed ?? nativeWalk?.drawnSpeed");
  edit("nativeWalk?.overrideMaxWalkingAngle?.() ??", "get('humanoidMesh')?.maxWalkingAngleOverride ??");
  const thirdStart=source.indexOf('        if(!firstPerson && !nativeHidden) {'),thirdEnd=source.indexOf("        const meshRotation=stateFor('meshRotation');",thirdStart);
  if(thirdStart<0||thirdEnd<0)throw Error('Local body perspective contract missing');
  source=source.slice(0,thirdStart)+"        const posedNodes=nativeHidden?animatedBodyNodes(id,object,names):object.nodes;\n"+source.slice(thirdEnd);
  edit('const local=positionState?.PC', 'const local=positionState?.xQi || positionState?.PC');
  const filterStart=source.indexOf('          if(!/^(?:BodyMesh|TorsoNode|TorsoMesh|HeadMesh|ArmRightMesh|ArmLeftMesh|LegLeftMesh|LegRightMesh)$/.test(bodyName)');
  const filterEnd=source.indexOf('          const group=manager.thinMeshes[index];',filterStart);
  if(filterStart<0||filterEnd<filterStart)throw Error('Local body detail filter missing');
  source=source.slice(0,filterStart)+source.slice(filterEnd);
  edit('|| group?.idToMetadata?.[node.thinInstanceId]?.meshVariation?.getMesh?.();',
    '|| shadowBatchMesh(group?.idToMetadata?.[node.thinInstanceId]?.meshVariation);');
  edit('        if(!result.parts.length)result.excluded.clear();',`        for(let i=0;i<object.nodes.length;i++){
          const transform=transformFor(i);if(transform)appendShadowAttachments(manager,object.nodes[i].attachedThinObjectIds,transform,result,composeNode,multiply);
        }
        if(!result.parts.length)result.excluded.clear();`);
  edit('|| positionState?.WV || nativeVectors[0];', '|| positionState?.WV;');
  edit('let m=node && (i===0 ? composeNode(node,position,rotation) : composeNode(node));', 'let m=node && (i===0 && nativeHidden ? composeNode(node,position,rotation) : composeNode(node));');
  edit("result.parts.length=0;result.excluded.clear();result.reason='unavailable';", "result.parts.length=0;result.excluded.clear();result.reason='unavailable';result.focus=null;");
  edit('const rotation={x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)};', 'result.focus=position;\n        const rotation={x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)};');
  edit('result.focus=position;\n        const rotation=', `result.focus=position;
        // The current native batch already contains the visible body's exact
        // animated pose. Only hidden first-person bodies need the private clone.
        if(!nativeHidden && visibleSlots>0 && nativeDrawableSlots===visibleSlots){
          result.excluded.clear();result.reason='native visible';return result;
        }
        const rotation=`);
  // The visible player can be arbitrarily far from an orbit/third-person
  // camera. World-volume culling already validates all clone geometry.
  const rejectStart=source.indexOf('          if(bodyTransform && camera && Math.hypot('),rejectEnd=source.indexOf('          multiply(passMatrix,wm,passWorldScratch);',rejectStart);
  if(rejectStart<0||rejectEnd<0)throw Error('Body distance contract missing');
  source=source.slice(0,rejectStart)+source.slice(rejectEnd);
  edit('const fill = (target,radius,size) => {', 'const fill = (target,radius,size,focus=center) => {\n        const dot=a=>a[0]*focus.x+a[1]*focus.y+a[2]*focus.z;');
  edit('fill(nearMatrix,nearRadius,resources.nearSize);', 'const body=localBodyParts();\n        fill(nearMatrix,nearRadius,resources.nearSize,body.focus || center);');
  edit("const localBody=settings.entityShadows===false ? emptyLocalBody : localBodyParts();", "const localBody=settings.entityShadows===false ? emptyLocalBody : localBodyScratch;");
  // Insert helpers last so compatibility replacements cannot rewrite their
  // legacy fallbacks into calls to themselves.
  edit('    const qualities =', '    '+[configureShadowDepth,shadowBatchMesh,shadowBatchMatrices,movingShadowSize,shadowReceiverFocus,appendShadowAttachments].map(f=>f.toString()).join('\n    ')+'\n    const qualities =');
 }
 return require('./shader-native-adapter.cjs').adaptNativeShader(name,require('./shader-ray-adapter.cjs').adaptRayShadows(name,source));
}
module.exports={rebuildShader};
