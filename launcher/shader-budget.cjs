'use strict';
// Diagnostics only. Frame timing must never change image quality or canvas size.
function createShaderBudget(){
  const costs=new Map(),limits=Object.freeze({adaptive:false,tier:0,shadowExponent:12,shadowRate:60,renderFactor:1,skyFactor:1});
  return {
    limits:()=>limits,settings:authored=>authored,
    sample(){for(const e of costs.values()){e.history[e.next]=e.current;e.current=0;e.next=(e.next+1)%120;e.count=Math.min(120,e.count+1);}return false;},
    recordCpu(name,ms){if(!(ms>=0 && Number.isFinite(ms)))return;let e=costs.get(name);if(!e){e={current:0,history:new Float64Array(120),next:0,count:0};costs.set(name,e);}e.current+=ms;},
    cpuWall(){const result={};for(const [name,e]of costs){const values=e.history.subarray(0,e.count);result[name]={frames:e.count,averageMs:e.count?values.reduce((a,b)=>a+b,0)/e.count:0,maxMs:e.count?Math.max(...values):0};}return result;}
  };
}
function adaptShaderBudget(name,source){
  const edit=(from,to)=>{if(!source.includes(from))throw Error('Shader measurement adapter mismatch: '+name+' / '+from.slice(0,70));source=source.replace(from,()=>to);};
  if(name==='shader.js'){
    edit('  const sun = PAGE.__BVFX_CREATE_SUN__?.(state,',`  const shaderBudget=(${createShaderBudget.toString()})();
  PAGE.__BVFX_FRAME_BUDGET__=shaderBudget;
  let shaderObservedContext=null;
  const sun = PAGE.__BVFX_CREATE_SUN__?.(state,`);
    edit('if(effectPatched){glState.patchedShaders.add(shader);','if(effectPatched){shaderObservedContext=this;glState.patchedShaders.add(shader);');
    edit('  function applyWaterGeometry(record) {',`  function applyWaterGeometry(record){const start=PAGE.performance.now();try{return applyWaterGeometryMeasured(record);}finally{shaderBudget.recordCpu('liquidGeometry',PAGE.performance.now()-start);}}
  function applyWaterGeometryMeasured(record) {`);
    edit('  function periodicMaintenance() {',`  function periodicMaintenance(){const start=PAGE.performance.now();try{return periodicMaintenanceMeasured();}finally{shaderBudget.recordCpu('maintenance',PAGE.performance.now()-start);}}
  function periodicMaintenanceMeasured() {`);
  }
  if(name==='sun-shadows.js'){
    edit('    function render() {',`    function render(){const start=performance.now();try{return renderMeasured();}finally{root.__BVFX_FRAME_BUDGET__?.recordCpu('shadows',performance.now()-start);}}
    function renderMeasured() {`);
    edit('const movingInterval=resources?.selfActive?Math.min(q.interval,1000/30):q.interval;','const movingInterval=q.interval;');
    source=source.replaceAll('now-resources.selfGeometryMissingSince<1000?25:100','now-resources.selfGeometryMissingSince<1000?Math.max(q.interval,25):Math.max(q.interval,100)');
  }
  if(name==='atmosphere.js'){
    edit('    function drawSky(gl,loc,draw,args) {',`    function drawSky(gl,loc,draw,args){
      if(!loc || loc.skyCache==null)return drawSkyMeasured(gl,loc,draw,args);
      const start=performance.now();try{return drawSkyMeasured(gl,loc,draw,args);}finally{root.__BVFX_FRAME_BUDGET__?.recordCpu('sky',performance.now()-start);}
    }
    function drawSkyMeasured(gl,loc,draw,args) {`);
  }
  return source;
}
module.exports={createShaderBudget,adaptShaderBudget};
