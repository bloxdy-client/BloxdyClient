'use strict';
const {installGrassGpu}=require('./grassify-gpu.cjs');
// Serialized into the mod. Let Bloxd's WebGL2 scene submit ordinary meshes and
// native material shaders. Never request a second device,
// canvas, render pass or GL context. All mesh/material instances here are owned.
function createSceneGrass(c,getSettings,{scan,hash,limit,onError,gpuFactory}){
  const own=o=>Object.values(Object.getOwnPropertyDescriptors(o||{})).filter(d=>'value'in d).map(d=>d.value);
  const candidates=[...own(c.noa),...own(c.layout?.renderer)];
  const babylon=candidates.map(v=>v?.babylon||v?.meshBuilder?.babylon).find(v=>typeof v?.Mesh==='function');
  const meshSource=(c.scene.meshes||[]).find(m=>typeof m?.setVerticesData==='function'&&typeof m?.setIndices==='function'&&typeof m?.updateVerticesData==='function'&&typeof m?.dispose==='function'&&typeof m.constructor==='function');
  const Mesh=babylon?.Mesh||meshSource?.constructor;
  const materials=[...(c.scene.materials||[]),...(c.scene.meshes||[]).map(m=>m?.material)];
  const color=o=>o&&['r','g','b'].every(k=>Number.isFinite(o[k]));
  const source=materials.find(m=>color(m?.diffuseColor)&&color(m?.emissiveColor)&&typeof m.constructor==='function'&&typeof m.dispose==='function');
  if(typeof c.layout?.registerMesh!=='function')throw Error('Waiting for Bloxd mesh registration API');
  if(!Mesh)throw Error('Waiting for Bloxd mesh API');
  if(!source)throw Error('Waiting for Bloxd material API');
  const Material=source.constructor,tiles=new Map(),cells=new Map();
  let material=null,token=null,disposed=false,iterator=null,center=null,audit=null,nextScan=0,actors=[],lastColor='',lastHeight=0,count=0,cursor=0,cullKey='',lastOrigin=[NaN,NaN,NaN],windPhase=0,lastFrame=0,actorHistory=new Map(),gpu=null;
  const finite=p=>p?.length===3&&Array.from(p).every(Number.isFinite),span=()=>gpu&&(getSettings().density<=200||getSettings().style==='flat')?4:2,tileKey=p=>[Math.floor(p[0]/span()),p[1],Math.floor(p[2]/span())].join(',');
  function dispose(){if(disposed)return;disposed=true;if(token!==null)c.scene.onBeforeRenderObservable.remove(token);token=null;gpu?.dispose();gpu=null;for(const t of tiles.values())t.mesh?.dispose(false,false);tiles.clear();cells.clear();material?.dispose(false,false);material=null;iterator=center=audit=null;actors=[];count=0;}
  function remove(key,p){cells.delete(key);const t=tiles.get(tileKey(p));if(t){t.cells.delete(key);t.dirty=true;if(!t.cells.size){t.mesh?.dispose(false,false);tiles.delete(t.key);}}count-=getSettings().density;}
  function valid(p){const id=c.read(...p);return id!==null&&c.grass(id)&&(c.cover?c.cover(c.read(p[0],p[1]+1,p[2])):c.read(p[0],p[1]+1,p[2])===0);}
  function build(t){
    const settings=getSettings(),n=t.cells.size*settings.density;let at=0;
    const style=settings.style||'flat',sides=style==='round'?8:style==='realistic'?3:2,rings=style==='realistic'?7:style==='round'?5:4,vpb=sides*rings,ipb=(rings-1)*(style==='round'?sides:sides-1)*6+(style==='round'?(sides-2)*6:0);
    t.sides=sides;t.rings=rings;t.vpb=vpb;t.blocks=[];t.positions=new Float32Array((n*vpb+(gpu?2:0))*3);t.base=gpu?t.positions.subarray(0,n*vpb*3):new Float32Array(n*vpb*3);const roots=gpu?new Float32Array((n*vpb+2)*4):null,shapes=gpu?new Float32Array((n*vpb+2)*2):null;t.roots=gpu?null:new Float64Array(n*4);t.bend=gpu?null:new Float32Array(n*2);
    const normals=new Float32Array(t.positions.length),colors=new Float32Array(t.positions.length/3*4),indices=n*vpb>65535?new Uint32Array(n*ipb):new Uint16Array(n*ipb);
    let index=0,minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(const p of t.cells.values()){
      const order=Uint16Array.from({length:settings.density},(_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(hash(...p,20000+i)*(i+1)),value=order[i];order[i]=order[j];order[j]=value;}
      const first=at;for(let i=0;i<settings.density;i++,at++){
        // Independently jittered, shuffled strata cover both axes with no grid row.
        const a=(i+hash(...p,i*4))/settings.density,b=(order[i]+hash(...p,i*4+1))/settings.density,v=hash(...p,i*4+2),angle=v*Math.PI*2;
        const x=p[0]+a,z=p[2]+b,h=settings.height*(style==='realistic'?.6+v*.4:.85+v*.15),radius=settings.width*.5,shade=.82+hash(...p,i*4+3)*.35;
        t.roots?.set([x,z,h,v],at*4);
        const ux=Math.cos(angle),uz=Math.sin(angle),vx=-uz,vz=ux;
        for(let ring=0;ring<rings;ring++)for(let side=0;side<sides;side++){
          const f=ring/(rings-1),taper=style==='realistic'?Math.max(.015,Math.pow(1-f, .65)):style==='round'?1-.35*f:1;
          let lateral,depth,light;
          if(style==='round'){const theta=side/sides*Math.PI*2;lateral=Math.cos(theta)*radius*taper;depth=Math.sin(theta)*radius*taper;light=.65+.35*Math.cos(theta-.6);}
          else {lateral=(side/(sides-1)*2-1)*radius*taper;depth=style==='realistic'&&side===1?radius*.35*taper:0;light=style==='realistic'?(side===1?1.12:.8):1;}
          const curve=style==='realistic'?h*(.12+v*.25)*f*f:0,k=(at*vpb+ring*sides+side)*3;
          t.base[k]=x-t.x+ux*lateral+vx*(depth+curve);t.base[k+1]=.005+h*f;t.base[k+2]=z-t.z+uz*lateral+vz*(depth+curve);if(gpu){minX=Math.min(minX,t.base[k]);maxX=Math.max(maxX,t.base[k]);minZ=Math.min(minZ,t.base[k+2]);maxZ=Math.max(maxZ,t.base[k+2]);}
          const ny=style==='realistic'?-2*(.12+v*.25)*f:0,length=Math.hypot(1,ny);normals[k]=vx/length;normals[k+1]=ny/length;normals[k+2]=vz/length;if(gpu){const vertex=k/3;roots.set([x-t.x,.005,z-t.z,h],vertex*4);shapes.set([f,.8+v*.4],vertex*2);}
          const q=(at*vpb+ring*sides+side)*4,c=Math.min(1,(.34+.66*f)*shade*light);
          colors[q]=colors[q+1]=colors[q+2]=c;colors[q+3]=1;
        }
        for(let ring=0;ring<rings-1;ring++)for(let side=0;side<(style==='round'?sides:sides-1);side++){
          const next=(side+1)%sides,k=at*vpb+ring*sides,A=k+side,B=k+next,C=A+sides,D=B+sides;indices.set([A,B,C,B,D,C],index);index+=6;
        }
        if(style==='round')for(let side=1;side<sides-1;side++){const k=at*vpb,top=k+(rings-1)*sides;indices.set([k,k+side+1,k+side,top,top+side,top+side+1],index);index+=6;}
      }if(!gpu)t.blocks.push({p,first,end:at});
    }
    if(!t.mesh){t.mesh=new Mesh('Grassify '+t.key,c.scene);if(typeof t.mesh.setVerticesData!=='function'||typeof t.mesh.setIndices!=='function'||typeof t.mesh.updateVerticesData!=='function'||typeof t.mesh.dispose!=='function')throw Error('Bloxd mesh API changed');t.mesh.material=material;t.mesh.isPickable=false;t.mesh.checkCollisions=false;t.mesh.useVertexColors=true;}
    t.updated=performance.now()-16;
    if(gpu){const pad=Math.max(1.5,settings.height*1.1);t.positions.set([minX-pad,-.1,minZ-pad,maxX+pad,settings.height+.1,maxZ+pad],t.base.length);}else deform(t,performance.now(),c.camera());
    t.mesh.setVerticesData('position',t.positions,!gpu,3);t.mesh.setVerticesData('normal',normals,false,3);t.mesh.setVerticesData('color',colors,false,4);
    if(gpu){t.mesh.setVerticesData('grassRoot',roots,false,4);t.mesh.setVerticesData('grassShape',shapes,false,2);gpu.register(t.mesh,t);}
    t.mesh.setIndices(indices);if(!t.registered){c.layout.registerMesh(t.mesh,[t.x,t.y,t.z]);t.registered=true;}t.dirty=false;t.height=settings.height;t.width=settings.width;t.style=settings.style;t.builtCells=t.cells.size;
  }
  function deform(t,now,eye){
    if(!eye)return;const settings=getSettings(),origin=c.origin(),dt=Math.min(.1,Math.max(.001,(now-t.updated)/1000)),ease=1-Math.exp(-dt*12);
    t.mesh.position.x=t.x-origin[0];t.mesh.position.y=t.y-origin[1];t.mesh.position.z=t.z-origin[2];
    for(const block of t.blocks){const [x,y,z]=block.p,wind=settings.wind??30;
      // Adjacent blocks share the same corner values: no wind step at edges.
      const field=(a,b)=>wind?[Math.sin(windPhase*1.8+a*.5+b*.4)*.10+Math.sin(windPhase*.7+a*.13)*.035,Math.cos(windPhase*1.3+b*.6)*.10]:[0,0];
      const w00=field(x,z),w10=field(x+1,z),w01=field(x,z+1),w11=field(x+1,z+1);
      const nearby=actors.filter(a=>Math.hypot(x+.5-a.position[0],z+.5-a.position[2])<2.5+Math.hypot(a.position[0]-a.previous[0],a.position[2]-a.previous[2])&&y+1>=a.position[1]-.4&&y+1<=a.position[1]+a.height);
      for(let i=block.first;i<block.end;i++){
        const root=i*4,rx=t.roots[root],rz=t.roots[root+1],h=t.roots[root+2],variation=.8+t.roots[root+3]*.4,u=rx-x,v=rz-z;let bx=((w00[0]*(1-u)+w10[0]*u)*(1-v)+(w01[0]*(1-u)+w11[0]*u)*v)*variation,bz=((w00[1]*(1-u)+w10[1]*u)*(1-v)+(w01[1]*(1-u)+w11[1]*u)*v)*variation;
        for(const a of nearby){const ax=a.previous[0],az=a.previous[2],mx=a.position[0]-ax,mz=a.position[2]-az,move2=mx*mx+mz*mz;
          const along=move2>1e-8?Math.max(0,Math.min(1,((rx-ax)*mx+(rz-az)*mz)/move2)):1,dx=rx-ax-along*mx,dz=rz-az-along*mz,d=Math.hypot(dx,dz),radius=Math.max(.35,(a.width||.7)*.5)+.4;
          const influence=Math.max(0,1-d/radius),force=influence*influence*Math.min(h*.85,.85);
          const length=Math.max(.04,d),speed=Math.sqrt(move2),direction=speed>.001?1/speed:0;
          bx+=(dx/length*.8+mx*direction*.35)*force;bz+=(dz/length*.8+mz*direction*.35)*force;
        }
        const k=i*2;t.bend[k]+=(bx-t.bend[k])*ease;t.bend[k+1]+=(bz-t.bend[k+1])*ease;
        bx=t.bend[k];bz=t.bend[k+1];const drop=Math.min(Math.hypot(bx,bz)*.45,h*.65);
        for(let ring=0;ring<t.rings;ring++){const f=ring/(t.rings-1),q=f*f;
          for(let side=0;side<t.sides;side++){const v=(i*t.vpb+ring*t.sides+side)*3;t.positions[v]=t.base[v]+bx*q;t.positions[v+1]=t.base[v+1]-drop*q;t.positions[v+2]=t.base[v+2]+bz*q;}
        }
      }
    }
  }
  function frame(){
    if(disposed||document.hidden)return;const eye=c.camera();if(!finite(eye))return;const settings=getSettings(),now=performance.now();const elapsed=lastFrame?Math.min(.1,(now-lastFrame)/1000):0;lastFrame=now;windPhase+=elapsed*Math.pow((settings.wind??30)/30,2);
    const color=settings.color;if(color!==lastColor){for(const [i,k]of ['r','g','b'].entries()){const value=parseInt(color.slice(1+i*2,3+i*2),16)/255;material.emissiveColor[k]=value;material.diffuseColor[k]=0;}lastColor=color;}
    const target=eye.map(Math.floor);if(!center||Math.hypot(...target.map((v,i)=>v-center[i]))>=3||!iterator&&now>=nextScan){center=target;iterator=scan(center,settings.distance,c.read,c.grass,c.cover);nextScan=now+2000;}
    const ck=target.join(',');if(ck!==cullKey){cullKey=ck;for(const [key,p]of cells)if(Math.hypot(p[0]+.5-eye[0],p[2]+.5-eye[2])>settings.distance+1||Math.abs(p[1]-eye[1])>settings.distance+3)remove(key,p);}
    const start=performance.now();for(let n=0;iterator&&(cells.size+1)*settings.density<=limit&&n<4096&&performance.now()-start<3;n++){
      const item=iterator.next();if(item.done){iterator=null;break;}const p=item.value,key=p.join(',');if(cells.has(key)||!valid(p))continue;cells.set(key,p);count+=settings.density;const tk=tileKey(p);let t=tiles.get(tk);if(!t){t={key:tk,span:span(),x:Math.floor(p[0]/span())*span(),y:p[1]+1,z:Math.floor(p[2]/span())*span(),cells:new Map(),mesh:null,dirty:true,updated:-Infinity};tiles.set(tk,t);}t.cells.set(key,p);t.dirty=true;
    }
    audit??=cells.entries();for(let i=0;i<16;i++){const item=audit.next();if(item.done){audit=null;break;}if(!valid(item.value[1]))remove(...item.value);}
    // Read interpolated feet every render frame; one persistent contact per entity.
    {const history=new Map();actors=c.actors().filter(a=>finite(a?.position)&&Number.isFinite(a.height)&&a.height>=.6).sort((a,b)=>Math.hypot(a.position[0]-eye[0],a.position[2]-eye[2])-Math.hypot(b.position[0]-eye[0],b.position[2]-eye[2])).slice(0,32).map((a,i)=>{const id=a.grassActorId??a.GP??i,position=Array.from(a.position),previous=actorHistory.get(id)||position;history.set(id,position);return {id,position,previous:Math.hypot(...position.map((v,j)=>v-previous[j]))<4?previous:position,height:a.height,width:a.width};});actorHistory=history;}
    gpu?.frame({phase:windPhase,wind:settings.wind,now,actors});
    const list=[...tiles.values()],origin=c.origin();if(origin.some((v,i)=>v!==lastOrigin[i])){lastOrigin=Array.from(origin);for(const t of list)if(t.mesh){t.mesh.position.x=t.x-origin[0];t.mesh.position.y=t.y-origin[1];t.mesh.position.z=t.z-origin[2];}}
    // Static geometry builds have their own budget; animation never waits for them.
    const updates=performance.now();for(let n=0;n<list.length&&performance.now()-updates<7;n++){
      const t=list[cursor++%list.length];if(t.dirty||t.height!==settings.height||t.width!==settings.width||t.style!==settings.style){build(t);t.updated=now;}
    }
    // Compatibility fallback also updates the whole field, with one timestamp.
    if(!gpu)for(const t of list)if(t.mesh&&now-t.updated>=16){deform(t,now,eye);t.mesh.updateVerticesData('position',t.positions,true);t.updated=now;}
  }
  try{
    material=new Material('Grassify',c.scene);if(!material.diffuseColor||!material.emissiveColor||typeof material.dispose!=='function')throw Error('Bloxd material API changed');material.disableLighting=true;if(material.specularColor){material.specularColor.r=material.specularColor.g=material.specularColor.b=0;}material.backFaceCulling=false;material.alpha=1;gpu=gpuFactory?.(material,onError)||null;
    token=c.scene.onBeforeRenderObservable.add(()=>{try{frame();}catch(error){onError(error);}});
    return {scene:c.scene,dispose,reset(){for(const t of tiles.values())t.mesh?.dispose(false,false);tiles.clear();cells.clear();count=0;iterator=center=audit=null;cullKey='';},stats:()=>({backend:'scene-webgl',...gpu?.stats(),blades:[...tiles.values()].reduce((n,t)=>n+(t.mesh?(t.builtCells||0)*getSettings().density:0),0),pendingBlades:count,cells:cells.size,actorCount:actors.length,budget:limit,limited:(cells.size+1)*getSettings().density>limit,meshes:tiles.size,renderedBlocks:[...tiles.values()].reduce((n,t)=>n+(t.mesh?t.builtCells||0:0),0)})};
  }catch(error){dispose();throw error;}
}
function adaptGrassifyScene(name,source){
  if(name!=='grassify.js')return source;
  const marker='  function createRenderer(c){';if(!source.includes(marker))throw Error('Grassify renderer adapter does not match this mod version.');
  return source.replace(marker,()=>marker+'\n    if(settings.style!=="flat"||Array.isArray(c.scene.meshes)||!c.gl?.createVertexArray)return ('+createSceneGrass.toString()+')(c,()=>settings,{scan,hash,limit:LIMIT,gpuFactory:('+installGrassGpu.toString()+'),onError:error=>{stop();status="Grassify stopped: "+error.message;sync();}});');
}
module.exports={createSceneGrass,adaptGrassifyScene};
