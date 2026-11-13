'use strict';
module.exports=function installModHost(profile){
  'use strict';if(globalThis.__BLOXD_MOD_HOST__)return;
  const original=Object.defineProperty,observers=new Map(),engineListeners=new Set(),errors=[];let engine=null,stopped=false,definitionObservers=[];
  function restore(){if(!observers.size&&(engine||!engineListeners.size)&&Object.defineProperty===dispatch)Object.defineProperty=original;}
  function publishEngine(value){if(stopped||engine===value)return;engine=value;for(const fn of engineListeners){try{fn(engine);}catch(error){errors.push(String(error.message).slice(0,200));}}restore();}
  function dispatch(target,key,descriptor){const result=original.call(this,target,key,descriptor);
    if(key==='singletons')queueMicrotask(()=>{if(typeof target?.getBloxd==='function')publishEngine(target);});
    // Current Bloxd minifies the export names too. Inspect only its simple
    // webpack value getters, after module initialization. The facade aliases
    // the actual singleton object; it never changes the game or its exports.
    else if(!engine&&descriptor?.get&&/^\(\)=>[\w$]+$/.test(String(descriptor.get)))queueMicrotask(()=>{
      if(stopped||engine)return;
      try{const value=descriptor.get();
        if(!value || typeof value!=='object' || Array.isArray(value))return;
        // Public builds split network/pointer state out of the singleton.
        // Match either observed schema using own data fields only. Do not
        // enumerate unrelated exported arrays, typed arrays or huge tables.
        const owns=name=>{const field=Object.getOwnPropertyDescriptor(value,name);return field&&'value'in field;};
        if(!['itemsClient','blocksClient','bloxd'].every(owns))return;
        const legacy=['connectedWebsocketUrl','pointerLockWrapper'].every(owns);
        const split=['nonBlocksClient','localPlayerPickActionHelper','drawCallDebugEntries'].every(owns);
        if(!legacy&&!split)return;
        publishEngine(Object.freeze({singletons:value,getBloxd:()=>value.bloxd}));
      }catch{/* TDZ and unrelated exports are not an engine. */}
    });
    // Change the snapshot only when subscriptions change. Each dispatch keeps
    // its original snapshot, including across nested definitions/unsubscribes.
    for(const [id,fn] of definitionObservers)try{fn(target,key,descriptor);}catch(error){errors.push(`${id}: ${String(error.message).slice(0,160)}`);}
    if(errors.length>16)errors.splice(0,errors.length-16);return result;
  }
  const api=Object.freeze({version:'0.1.0',profile:Object.freeze({...profile}),
    observeDefinitions(id,fn){if(stopped||typeof fn!=='function')throw Error('Mod host is unavailable.');if(observers.has(id))throw Error('Duplicate runtime observer: '+id);observers.set(id,fn);definitionObservers=[...observers];if(Object.defineProperty===original)Object.defineProperty=dispatch;
      let released=false;return ()=>{if(released)return;released=true;observers.delete(id);definitionObservers=[...observers];restore();};},
    onEngine(fn){if(stopped||typeof fn!=='function')throw Error('Mod host is unavailable.');engineListeners.add(fn);if(engine)fn(engine);else if(Object.defineProperty===original)Object.defineProperty=dispatch;return ()=>{engineListeners.delete(fn);restore();};},
    engine:()=>engine,status:()=>({version:'0.1.0',observers:[...observers.keys()],engineReady:!!engine,errors:[...errors]}),
    stop(){stopped=true;observers.clear();definitionObservers=[];engineListeners.clear();if(Object.defineProperty===dispatch)Object.defineProperty=original;}
  });
  original(globalThis,'__BLOXD_MOD_HOST__',{value:api,configurable:true});Object.defineProperty=dispatch;
  addEventListener('pagehide',api.stop,{once:true});
};
