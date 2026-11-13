'use strict';
// Read-only adapter for the game's CPU shadow contracts. No renderer, scene,
// account, worker, GPU device or application is constructed here.
function createNativeRayCpu(source, now) {
  const ranges=[[17836,23584],[248021,260211],[260228,263656]];
  if(source.length!==296647 || !source.startsWith('const Gp=32',ranges[0][0])
      || !source.startsWith('const mn=Math.ceil(102)',ranges[1][0])
      || !source.startsWith('class Dn{',ranges[2][0]))throw Error('Native shadow source contract changed');
  const body=ranges.map(([a,b])=>source.slice(a,b)).join('\n').replace('var Wi=DF(32340);','const Wi={e:65535};');
  if(/\bDF\(\d+\)/.test(body))throw Error('Unexpected dependency in native shadow CPU contracts');
  // Only the three verified CPU sections are evaluated, never the engine
  // module/factory, its exports, shaders, renderer or dependencies.
  return Function('performance','GPUBufferUsage','pn',body+'\nreturn {Casters:Ei,Window:Fn,Entities:Dn,project:hD,triangleBox:UD,worldWords:sp,specialWords:2392064,entityWords:147457,gridWords:4194304};')(
    {now}, {STORAGE:0,COPY_DST:0}, {m:attribute=>attribute.values});
}
function installNativeRayCpu(root, build) {
  let pending=null;
  root.__BVFX_LOAD_RAY_CPU__=()=>pending??=(async()=>{
    const response=await fetch('https://bloxd.io/static/js/7rp1w.226.48e7a1f4.chunk.js',{credentials:'omit',cache:'force-cache'});
    if(!response.ok)throw Error('Native shadow contracts unavailable ('+response.status+')');
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength!==296647)throw Error('Native shadow contracts have an unexpected size');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!=='c63cb24bfd3a9aecdcf709accac04c60320396b64890b4e08a575e7b5799093e')throw Error('Native shadow contracts failed source verification');
    return build(new TextDecoder().decode(bytes),()=>performance.now());
  })().catch(error=>{pending=null;throw error;});
}
module.exports={createNativeRayCpu,installNativeRayCpu};
