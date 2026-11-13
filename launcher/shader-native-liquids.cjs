'use strict';
// Per-terrain-program extension. Original shader-pack compilation, shadow
// resources, native texture animation, depth layers and submission stay owned
// by Bloxd. Extra records are 40 bytes per quad, shared by its four vertices.
function patchNativeLiquidSource(source,kernel){
 if(!source.includes('struct TerrainChunk')||!source.includes('fn pack_bvfxWorld_controls')||source.includes('var<private> bvfxLiquidInfo'))return source;
 const edit=(before,after)=>{if(!source.includes(before))throw Error('Native liquid shader contract changed: '+before.slice(0,65));source=source.replace(before,()=>after);};
 const packed=source.includes('packedInputs: PackedVertexInputs'),textured=source.includes('vMainUV1: vec2f'),single=source.includes('fn packedFaceUvOffset');
 edit('faceCount: u32,','faceCount: u32,\n bvfxBaseVertex:u32, bvfxVertexCount:u32,');
 if(!packed){const inputs=/struct VertexInputs\s*\{[^}]*\}/;if(!inputs.test(source))throw Error('Native raw liquid vertex inputs changed');source=source.replace(inputs,body=>body.slice(0,-1)+'@builtin(vertex_index) bvfxVertexIndex:u32,\n}');}
 const varyings=/struct Varyings\s*\{[^}]*\}/;if(!varyings.test(source))throw Error('Native liquid varyings changed');
 source=source.replace(varyings,body=>body.slice(0,-1)+'@location(11) bvfxLiquidInfo:vec3f,\n@location(12) bvfxLiquidRest:vec3f,\n}');
 const vertex=`
 let bvfxIndex=${packed?'quad*4u+slot':'vertexInputs.bvfxVertexIndex'};
 let bvfxLocal=bvfxIndex-chunk.bvfxBaseVertex;let bvfxAt=(bvfxLocal>>2u)*10u;let bvfxSlot=bvfxLocal&3u;
 let bvfxActive=bvfxIndex>=chunk.bvfxBaseVertex&&bvfxLocal<chunk.bvfxVertexCount&&bvfxAt+9u<arrayLength(&bvfxLiquidRecords);
 var bvfxInfo=vec3f(0.0);var bvfxLocalRest=vertexInputs.position;var bvfxAo=0.0;${textured?'var bvfxUv=vertexInputs.uv;':''}
 if(bvfxActive){
  let params=bvfxLiquidRecords[bvfxAt+1u];let order=(params>>12u)&15u;let side=order>>2u;let opp=order&3u;let other=6u-side-opp;
  let grid=bvfxLiquidRecords[bvfxAt];let nx=max(1u,select((grid>>16u)&255u,256u,((grid>>16u)&255u)==0u));let nz=max(1u,select(grid>>24u,256u,(grid>>24u)==0u));
  let u=(f32(grid&255u)+select(0.0,1.0,bvfxSlot==side||bvfxSlot==opp))/f32(nx);let v=(f32((grid>>8u)&255u)+select(0.0,1.0,bvfxSlot==other||bvfxSlot==opp))/f32(nz);
  var weights=vec4f(0);weights[0]=(1.0-u)*(1.0-v);weights[side]=u*(1.0-v);weights[opp]=u*v;weights[other]=(1.0-u)*v;
  bvfxInfo=vec3f(f32((params>>10u)&3u),bitcast<f32>(bvfxLiquidRecords[bvfxAt+2u+bvfxSlot]),(f32((bvfxLiquidRecords[bvfxAt+6u]>>(bvfxSlot*3u))&7u)-2.0)*.5);
  ${packed?`bvfxLocalRest=bvfxLiquidCorner(quads[quad*3u],dir>>1u,corner,params);
  var epsilon=vec2f(0);for(var s=0u;s<4u;s++){
   bvfxAo+=uniforms.aoLevels[(r2>>(3u+2u*s))&3u]*weights[s];let c=slotCorner(dir,(r2>>11u)&1u,s);
   epsilon+=vec2f(select(-.0015,.0015,c==0u||c==3u),select(-.0015,.0015,c<2u))*weights[s];
  }
  ${textured?`bvfxUv=bvfxLiquidUv(bvfxLocalRest,dir,epsilon);${single?'bvfxUv+=bitcast<vec2f>(vec2u(bvfxLiquidRecords[bvfxAt+8u],bvfxLiquidRecords[bvfxAt+9u]));':''}`:''}`:''}
 }
`;
 edit('let chunk = chunks[vertexInputs.chunkSlot];','let chunk = chunks[vertexInputs.chunkSlot];'+vertex);
 const move=`
 vertexOutputs.bvfxLiquidInfo=bvfxInfo;vertexOutputs.bvfxLiquidRest=worldPos.xyz;
 if(bvfxInfo.y>0.0){
  if(bvfxInfo.x==1.0&&liquid_global.uBvfxWaterMode>1.5){worldPos.y+=liquid_bvfxVertexWaterHeight(worldPos.xz+liquid_global.uBvfxWaterOrigin,liquid_global.uBvfxWaterTime)*bvfxInfo.y;}
  if(bvfxInfo.x==2.0&&liquid_global.uBvfxLavaMode>1.5){worldPos.y+=liquid_bvfxVertexLavaHeight(worldPos.xz,liquid_global.uBvfxLavaTime)*bvfxInfo.y;}
 }
`;
 if(source.includes('let bvfxRestPosition = vertexInputs.position + chunk.translation;')){
  edit('let bvfxRestPosition = vertexInputs.position + chunk.translation;','let bvfxRestPosition = bvfxLocalRest + chunk.translation;');
  const position=/let worldPos = vec4f\(bvfxRestPosition[^;]+;/;if(!position.test(source))throw Error('Native leaf/liquid position contract changed');source=source.replace(position,body=>body.replace('let worldPos','var worldPos')+move);
 }else edit('let worldPos = vec4f(vertexInputs.position + chunk.translation, 1.0);','var worldPos = vec4f(bvfxLocalRest + chunk.translation, 1.0);'+move);
 if(textured)edit('vertexOutputs.vMainUV1 = vertexInputs.uv;','vertexOutputs.vMainUV1 = bvfxUv;');
 if(packed)edit('vertexOutputs.vColor = vertexInputs.color.rgb;','vertexOutputs.vColor = select(vertexInputs.color.rgb,vec3f(bvfxAo),bvfxActive);');
 const begin='fn mainFragment(fragmentInputs: Varyings) -> @location(0) vec4f {';
 const initialize='\n bvfxLiquidInfo=fragmentInputs.bvfxLiquidInfo;bvfxLiquidRest=fragmentInputs.bvfxLiquidRest;';
 edit(begin,begin+initialize);
 source=source.replaceAll('if (alpha < material.ambientAndCutoff.w) {','if (alpha < material.ambientAndCutoff.w && !bvfxLiquidOwnTexture()) {');
 edit('var diffuseBase = vec3f(0.0);',`if(bvfxLiquidInfo.x==1.0&&liquid_global.uBvfxWaterMode>.5){alpha=liquid_global.uBvfxWaterOpacity;}
 if(bvfxLiquidInfo.x==2.0&&liquid_global.uBvfxLavaMode>.5){alpha=liquid_global.uBvfxLavaOpacity;}
 bvfxLiquidDither(fragmentInputs.position.xy,uniforms.outputHeight);if(bvfxLiquidInfo.x==2.0&&liquid_global.uBvfxLavaMode>.5&&material.anim.w>.5){alpha=1.0;}var diffuseBase = vec3f(0.0);`);
 const prepass='fn prepassFragment(fragmentInputs: Varyings) -> @location(0) vec4f {';
 if(source.includes(prepass))edit(prepass,prepass+initialize+'\n bvfxLiquidDither(fragmentInputs.position.xy,uniforms.outputHeight);');
 const underwater=/fn\s+pack_bvfxWorld_underwater\s*\(\s*\)\s*->\s*vec2f\s*\{\s*return\s+vec2f\(0(?:\.0)?\);\s*\}/;
 if(!underwater.test(source))throw Error('Native underwater light helper changed');source=source.replace(underwater,`fn pack_bvfxWorld_underwater()->vec2f{return vec2f(bvfxLiquidInfo.z,select(liquid_global.uBvfxUnderwaterLight,liquid_global.uBvfxLavaUnderwaterLight,bvfxLiquidInfo.z<0.0));}`);
 const colour=/fn\s+pack_bvfxWorld_liquidColour\([^)]*\)\s*->\s*vec3f\s*\{\s*return\s+\w+;\s*\}/;
 if(!colour.test(source))throw Error('Native liquid colour helper changed');source=source.replace(colour,`fn pack_bvfxWorld_liquidColour(colour:vec3f,l:BloxdLightIn,visibility:f32)->vec3f {
  var result=colour;var fog=l;if(pack_bvfxWorld_entityRules().z>.5){let f=clamp(l.fogAlpha,0.0,1.0);fog.fogAlpha=f*f*(3.0-2.0*f)*.92;}
  if(bvfxLiquidInfo.x==1.0&&liquid_global.uBvfxWaterMode>.5){
   let exposure=clamp(dot(l.skyLightColour,vec3f(.2126,.7152,.0722)),.02,1.0);
   result=liquid_global.uBvfxWaterColor*(.55+.45*exposure)*visibility+liquid_global.uBvfxWaterColor*liquid_global.uBvfxWaterGlow*.3;
   return bloxdApplyFog(result,fog);
  }
  if(bvfxLiquidInfo.x==2.0&&liquid_global.uBvfxLavaMode>.5&&liquid_global.uBvfxLavaNativeTexture<.5){
   let p=bvfxLiquidRest+liquid_global.uBvfxLavaTextureOrigin;let t=select(0.0,liquid_global.uBvfxLavaTime*.12,liquid_global.uBvfxLavaMode>1.5);
   let field=sin(p.x*1.3+sin(p.z*1.1+t))*sin(p.z*1.5-p.y*.8-t);let hot=1.0-smoothstep(.05,.6,abs(field));
   result=mix(vec3f(.12,.018,.006),vec3f(1,.38,.035),hot)+vec3f(.35,.15,.025)*hot*liquid_global.uBvfxLavaGlow;
   return bloxdApplyFog(result,fog);
  }return result;
 }`);
 return source+'\n'+kernel+`
@group(3) @binding(19) var<storage,read> bvfxLiquidRecords:array<u32>;
var<private> bvfxLiquidInfo:vec3f;var<private> bvfxLiquidRest:vec3f;
fn bvfxLiquidOwnTexture()->bool{return (bvfxLiquidInfo.x==1.0&&liquid_global.uBvfxWaterMode>.5)||(bvfxLiquidInfo.x==2.0&&liquid_global.uBvfxLavaMode>.5&&liquid_global.uBvfxLavaNativeTexture<.5);}
fn bvfxLiquidDither(pixel:vec2f,height:f32){
 if(bvfxLiquidInfo.x!=2.0||liquid_global.uBvfxLavaMode<.5||material.anim.w<.5||liquid_global.uBvfxLavaOpacity>=1.0){return;}
 let p=vec2u(floor(vec2f(pixel.x,height-pixel.y)))%4u;let lo=vec2f(p%2u);let hi=vec2f(p/2u);
 let threshold=(4.0*(2.0*lo.x+3.0*lo.y-4.0*lo.x*lo.y)+2.0*hi.x+3.0*hi.y-4.0*hi.x*hi.y+.5)/16.0;
 if(liquid_global.uBvfxLavaOpacity<threshold){discard;}
}
fn bvfxLiquidCorner(r:u32,axis:u32,corner:u32,p:u32)->vec3f{
 let w=f32(((r>>18u)&63u)+1u)*exp2(-f32((p>>6u)&3u))*select(0.0,1.0,corner==1u||corner==2u);
 let h=f32(((r>>24u)&63u)+1u)*exp2(-f32((p>>8u)&3u))*select(0.0,1.0,corner>=2u);
 let fraction=vec3f(f32(p&3u),f32((p>>2u)&3u),f32((p>>4u)&3u))*.25;
 let base=vec3f(f32(r&63u),f32((r>>6u)&63u),f32((r>>12u)&63u))+fraction;
 return base+select(vec3f(0,0,w),vec3f(w,0,0),axis==2u)+select(vec3f(0,h,0),vec3f(h,0,0),axis==1u);
}
fn bvfxLiquidUv(p:vec3f,dir:u32,epsilon:vec2f)->vec2f{
 let axis=dir>>1u;let s=1.0-2.0*f32(dir&1u);
 if(axis==0u){return vec2f(s*(p.z+epsilon.x),-(p.y+epsilon.y));}
 if(axis==1u){return vec2f(s*(p.x+epsilon.y),-(p.z+epsilon.x));}
 return vec2f(-s*(p.x+epsilon.x),-(p.y+epsilon.y));
}
`;
}
module.exports={patchNativeLiquidSource};
