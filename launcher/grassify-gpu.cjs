'use strict';
// Serialized into MAIN. Only the mod's own material, attributes and uniforms.
function installGrassGpu(material,onError){
  const nativeFactory=globalThis.__BVFX_NATIVE_GRASS_FACTORY__;
  if(!(nativeFactory&&material?.model)&&(!('customShaderNameResolve' in material)||!material.onBindObservable?.add||!material.onBindObservable?.remove))return null;
  const previousError=material.onError;material.onError=(_effect,message)=>{if(!disposed)onError(Error('Grass shader failed: '+String(message).slice(0,300)));};
  const tiles=new WeakMap(),current=new Float32Array(128),previous=new Float32Array(128),weights=new Float32Array(128);
  const tracks=new Map();let frameTime=null;
  let phase=0,wind=0,now=0,contacts=[],disposed=false,patched=false,binds=0,contactUploads=0,uploadedContacts=0;
  const declarations=`
attribute vec4 grassRoot;
attribute vec2 grassShape;
uniform vec4 grassWindPhase;
uniform float grassContactCount;
uniform vec4 grassContacts[32];
uniform vec4 grassPrevious[32];
uniform vec4 grassWeights[32];
`;
  const movement=`
vec2 gRoot=grassRoot.xz;
float gWindX=(sin(grassWindPhase.x+gRoot.x*.5+gRoot.y*.4)*.10+sin(grassWindPhase.y+gRoot.x*.13)*.035)*grassWindPhase.w*grassShape.y;
float gWindZ=cos(grassWindPhase.z+gRoot.y*.6)*.10*grassWindPhase.w*grassShape.y;
float gContactX=0.0;float gContactZ=0.0;float gWeight=0.0;
for(int g=0;g<32;g++){
  if(float(g)>=grassContactCount)break;
  if(grassRoot.y<grassContacts[g].y-.4||grassRoot.y>grassContacts[g].y+grassPrevious[g].w)continue;
  float gMoveX=grassContacts[g].x-grassPrevious[g].x;float gMoveZ=grassContacts[g].z-grassPrevious[g].z;
  float gMove2=gMoveX*gMoveX+gMoveZ*gMoveZ;
  float gAlong=gMove2>0.000001?clamp(((gRoot.x-grassPrevious[g].x)*gMoveX+(gRoot.y-grassPrevious[g].z)*gMoveZ)/gMove2,0.0,1.0):1.0;
  float gDX=gRoot.x-grassPrevious[g].x-gAlong*gMoveX;float gDZ=gRoot.y-grassPrevious[g].z-gAlong*gMoveZ;
  float gDistance=sqrt(gDX*gDX+gDZ*gDZ);
  float gForce=(1.0-smoothstep(grassContacts[g].w*.35,grassContacts[g].w,gDistance))*grassWeights[g].x;
  gForce*=smoothstep(-.4,-.05,grassRoot.y-grassContacts[g].y)*(1.0-smoothstep(grassPrevious[g].w-.1,grassPrevious[g].w,grassRoot.y-grassContacts[g].y));
  gContactX+=(gDX/max(gDistance,.08)*.8+grassWeights[g].y*.65)*gForce;
  gContactZ+=(gDZ/max(gDistance,.08)*.8+grassWeights[g].z*.65)*gForce;gWeight+=gForce;
}
// Body contact takes precedence over wind, including short blades and still actors.
float gPressure=gWeight/(.2+gWeight);
float gNorm=max(gWeight,sqrt(gContactX*gContactX+gContactZ*gContactZ));
float gContactScale=gPressure*min(grassRoot.w*.95,1.2)/max(gNorm,.0001);
float gBendX=gWindX*(1.0-.95*gPressure)+gContactX*gContactScale;
float gBendZ=gWindZ*(1.0-.95*gPressure)+gContactZ*gContactScale;
float gDrop=max(min(sqrt(gBendX*gBendX+gBendZ*gBendZ)*.45,grassRoot.w*.65),grassRoot.w*.6*gPressure);
vec2 gBend=vec2(gBendX,gBendZ);float gFlex=grassShape.x*grassShape.x;
// Blend into a constant-curvature centreline. The root stays fixed and the
// blade bends down through its length instead of translating its tip down.
float gBendLength=length(gBend);
float gAngle=gPressure*2.5;
float gF=grassShape.x;
float gArcX=grassRoot.w*(1.0-cos(gAngle*gF))/max(gAngle,.0001);
float gArcY=grassRoot.w*sin(gAngle*gF)/max(gAngle,.0001);
float gArcMix=smoothstep(0.0,.2,gPressure);
vec2 gDirection=mix(vec2(cos(grassShape.y*31.4),sin(grassShape.y*31.4)),gBend/max(gBendLength,.0001),smoothstep(0.0,.18,gBendLength));
positionUpdated.xz+=mix(gBend*gFlex,gDirection*gArcX,gArcMix);
positionUpdated.y+=mix(-gDrop*gFlex,gArcY-grassRoot.w*gF,gArcMix);
`;
  if(nativeFactory&&material.model){const native=nativeFactory(material,{frame,contacts:()=>contacts,snapshot:()=>({phase,wind,now})},onError);
    if(native){const release=native.dispose;native.dispose=()=>{if(disposed)return;disposed=true;release();material.onError=previousError;contacts=[];tracks.clear();};}return native;
  }
  material.customShaderNameResolve=(name,uniforms,_buffers,_samplers,defines,attributes,options)=>{
    if(disposed)return name;
    // Defines participate in native effect caching; never reuse another material's shader.
    if(!Array.isArray(defines?._keys)||!options){onError(Error('Bloxd grass shader hook changed'));return name;}
    defines.BLOXDY_GRASSIFY_CONTACT_V4=true;if(!defines._keys.includes('BLOXDY_GRASSIFY_CONTACT_V4'))defines._keys.push('BLOXDY_GRASSIFY_CONTACT_V4');
    for(const a of ['grassRoot','grassShape'])if(!attributes.includes(a))attributes.push(a);
    for(const u of ['grassWindPhase','grassContactCount','grassContacts','grassPrevious','grassWeights'])if(!uniforms.includes(u))uniforms.push(u);
    options.processFinalCode=(type,source)=>{
      if(disposed)return source;
      if(type!=='vertex')return source;
      const marker=/vec4\s+worldPos\s*=\s*finalWorld\s*\*\s*vec4\s*\(\s*positionUpdated\s*,\s*1\.0\s*\)\s*;/,declaration=/\b(attribute|in)\s+(?:highp\s+)?vec3\s+position\b/.exec(source);
      if(!marker.test(source)||!declaration||!source.includes('positionUpdated')){onError(Error('Bloxd grass vertex shader changed'));return source;}
      patched=true;
      return source.replace(/void\s+main\s*\(/,declarations.replaceAll('attribute ',declaration[1]+' ')+'\nvoid main(').replace(marker,match=>movement+'\n'+match);
    };
    return name;
  };
  const token=material.onBindObservable.add(mesh=>{
    if(disposed)return;const tile=tiles.get(mesh),effect=material._activeEffect||material.getEffect?.();if(!tile||!effect)return;
    try{
      if(!['setFloat4','setFloat','setArray4'].every(k=>typeof effect[k]==='function'))throw Error('Bloxd grass uniform API changed');
      const tau=Math.PI*2;effect.setFloat4('grassWindPhase',(phase*1.8+tile.x*.5+tile.z*.4)%tau,(phase*.7+tile.x*.13)%tau,(phase*1.3+tile.z*.6)%tau,wind?1:0);
      let n=0;const extent=tile.span||2,rootY=tile.y+.005;
      // A distant tile needs no contact arrays or per-vertex history loop.
      for(const a of contacts){
        const radius=Math.max(.35,(a.width||.7)*.5)+.4;
        if(a.weight<=.0001||rootY<a.position[1]-.4||rootY>a.position[1]+a.height||Math.max(a.position[0],a.previous[0])+radius<tile.x||Math.min(a.position[0],a.previous[0])-radius>tile.x+extent||Math.max(a.position[2],a.previous[2])+radius<tile.z||Math.min(a.position[2],a.previous[2])-radius>tile.z+extent)continue;
        const k=n*4;current[k]=a.position[0]-tile.x;current[k+1]=a.position[1]-tile.y;current[k+2]=a.position[2]-tile.z;current[k+3]=radius;
        previous[k]=a.previous[0]-tile.x;previous[k+1]=a.previous[1]-tile.y;previous[k+2]=a.previous[2]-tile.z;previous[k+3]=a.height;
        weights[k]=a.weight;weights[k+1]=a.directionX;weights[k+2]=a.directionZ;weights[k+3]=0;if(++n===32)break;
      }
      effect.setFloat('grassContactCount',n);
      if(n){effect.setArray4('grassContacts',current.subarray(0,n*4));effect.setArray4('grassPrevious',previous.subarray(0,n*4));effect.setArray4('grassWeights',weights.subarray(0,n*4));contactUploads+=3;uploadedContacts+=n;}
      binds++;
    }catch(error){onError(error);}
  });
  function frame(state){
    ({phase,wind,now}=state);
    if(!state.actors){contacts=(state.contacts||[]).map(a=>{const age=Math.max(0,(now-a.at)/1000),birth=Math.max(0,(now-(a.born??a.at))/1000),f=Math.max(0,Math.min(1,(age-.55)/.2)),fade=1-f*f*(3-2*f),dx=a.position[0]-a.previous[0],dz=a.position[2]-a.previous[2],length=Math.hypot(dx,dz);return {...a,weight:(1-Math.exp(-birth*35))*Math.exp(-age*4)*fade,directionX:length>.001?dx/length:0,directionZ:length>.001?dz/length:0};});return;}
    const dt=frameTime===null?1/60:Math.max(0,Math.min(.1,(now-frameTime)/1000));frameTime=now;
    const live=new Set();
    for(const a of state.actors){
      live.add(a.id);let t=tracks.get(a.id);
      if(!t||Math.hypot(...a.position.map((v,i)=>v-t.position[i]))>=4){t={...a,position:Array.from(a.position),previous:Array.from(a.position),velocity:[0,0,0],weight:0,directionX:0,directionZ:0};tracks.set(a.id,t);}
      // Exact critically damped response: independent of refresh rate, no overshoot.
      const omega=32,decay=Math.exp(-omega*dt),trail=1-Math.exp(-dt*14);
      for(let i=0;i<3;i++){const error=t.position[i]-a.position[i],j=t.velocity[i]+omega*error;t.position[i]=a.position[i]+(error+j*dt)*decay;t.velocity[i]=(t.velocity[i]-omega*j*dt)*decay;t.previous[i]+=(t.position[i]-t.previous[i])*trail;}
      const speed=Math.hypot(t.velocity[0],t.velocity[2]),directionEase=1-Math.exp(-dt*12);
      t.directionX+=(t.velocity[0]/Math.max(speed,1)-t.directionX)*directionEase;t.directionZ+=(t.velocity[2]/Math.max(speed,1)-t.directionZ)*directionEase;
      t.weight+=(1-t.weight)*(1-Math.exp(-dt*22));t.height=a.height;t.width=a.width;t.at=now;
    }
    for(const [id,t]of tracks)if(!live.has(id)){t.weight*=Math.exp(-dt*7);if(now-t.at>=1000||t.weight<.0001)tracks.delete(id);}
    contacts=[...tracks.values()].sort((a,b)=>b.weight-a.weight).slice(0,32);
  }
  return {register(mesh,tile){tiles.set(mesh,tile);},frame,dispose(){disposed=true;material.onBindObservable.remove(token);material.customShaderNameResolve=null;material.onError=previousError;contacts=[];tracks.clear();},stats:()=>({gpuWind:true,shaderPatched:patched,shaderBinds:binds,contactArrayUploads:contactUploads,uploadedContacts})};
}
module.exports={installGrassGpu};
