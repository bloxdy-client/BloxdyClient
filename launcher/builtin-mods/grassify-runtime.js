// Discover renderer/ECS/world structure once per client instance. Minified
// property names can change between two requests during a Bloxd deployment.
(() => {
  const cache=new WeakMap();
  const own=o=>Object.entries(Object.getOwnPropertyDescriptors(o||{})).filter(([,d])=>'value' in d).map(([k,d])=>[k,d.value]);
  const isScene=o=>Array.isArray(o?.meshes)&&Array.isArray(o?.materials)&&typeof o?.onBeforeRenderObservable?.add==='function';
  globalThis.__GRASSIFY_LAYOUT__=noa=>{
    if(!noa || typeof noa!=='object')return null;
    const saved=cache.get(noa),now=Date.now();
    if(saved) {
      const r=saved.result;
      // A world switch can replace the renderer without replacing Noa.
      const valid=noa[r.rendererKey]===r.renderer && r.renderer?.[r.sceneKey]===r.scene
        && noa.entities===r.entities && (!r.world || noa[r.worldKey]===r.world.owner);
      if(valid && (saved.complete || now<saved.retryAt))return r;
    }
    const fields=own(noa),ctor=String(noa.constructor);
    const originKey=ctor.match(/this\.([\w$]+)=\[0,0,0\]/)?.[1];
    const result={originKey,entities:noa.entities};
    const listReader=own(result.entities).find(([,fn])=>typeof fn==='function' && String(fn).includes('Unknown component:') && /return\s+[\w$]+\(\),[\w$]+\.list\s*;?\}/.test(String(fn)))?.[0];
    if(!listReader&&typeof result.entities?.ZQ==='function'&&result.entities.names?.position)result.positions=()=>result.entities.ZQ(result.entities.names.position);
    if(listReader)result.positions=()=>result.entities[listReader](result.entities.names?.position || 'position');
    for(const [key,value] of fields) {
      if(!value || typeof value!=='object' || Array.isArray(value) || ArrayBuffer.isView(value))continue;
      if(value.metadatas && !result.registry)result.registry=value;
      const sceneEntry=own(value).find(([,v])=>isScene(v));
      if(sceneEntry){result.renderer=value;result.rendererKey=key;result.sceneKey=sceneEntry[0];result.scene=sceneEntry[1];
        // Verified native addMeshToScene shape: convert the supplied world
        // position, register with the renderer selection, remove on dispose.
        const methods=new Map([...own(value),...own(Object.getPrototypeOf(value))]);
        const registration=[...methods].filter(([,fn])=>{if(typeof fn!=='function')return false;const text=String(fn);return text.includes('.metadata')&&text.includes('.parent')&&text.includes('.position.')&&/this\.[\w$]+\.[\w$]+\([\w$]+,[\w$]+,[\w$]+\)/.test(text)&&/\.add\(\(\(\)=>/.test(text);});
        if(registration.length===1){const method=registration[0][0];result.registerMesh=(mesh,position)=>value[method](mesh,false,position,false);}
      }
      // Verified block-reader shape: coordinate conversion, chunk lookup,
      // missing chunk => air, then a read-only ndarray.get(x,y,z).
      for(const [method,fn] of own(Object.getPrototypeOf(value))) {
        if(typeof fn!=='function' || method==='constructor')continue;
        const source=String(fn);
        if(!/return 0;/.test(source) || !/return [\w$]+\.[\w$]+\.get\([\w$]+,[\w$]+,[\w$]+\)/.test(source))continue;
        const lookup=source.match(/\]=this\.([\w$]+)\([^)]*\),[\w$]+=this\.([\w$]+)\.([\w$]+)\(/);
        if(!lookup)continue;
        result.worldKey=key;result.world={owner:value,method,loaded(x,y,z){
          const coords=value[lookup[1]](x,y,z);return Boolean(value[lookup[2]][lookup[3]](...coords));
        }};break;
      }
    }
    // Missing optional client structures must not trigger descriptor/prototype
    // scans on every draw. Retry partial discovery once a second, while scene
    // replacement above remains visible immediately.
    if(result.scene)cache.set(noa,{result,retryAt:now+1000,
      complete:Boolean(result.world && result.scene && result.positions && result.registerMesh)});
    return result;
  };
})();

