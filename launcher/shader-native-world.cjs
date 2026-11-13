'use strict';

// Compile neutral helpers with the public compiler, then bind our own small
// parameter block after compilation. The original shadow ABI stays intact.
const fields=['controls','held','armour','lightPosition','leafMotion','groundTint','groundFrame','cloudSun','cloudOrigin','entityRules'];
const uniformBytes=fields.length*16;
function nativeWorldSource(shadowSource){
 const helpers=fields.map(name=>`fn bvfxWorld_${name}() -> vec4f { return vec4f(0.0); }`).join('\n');
 const source=`${helpers}
fn bvfxWorld_metadata() -> vec4f { return vec4f(0.0); }
fn bvfxWorld_cloud(position: vec3f) -> vec3f { return vec3f(1.0); }
fn bvfxWorld_receiver() -> f32 { return 0.0; }
fn bvfxWorld_underwater() -> vec2f { return vec2f(0.0); }
fn bvfxWorld_liquidColour(colour:vec3f,l:BloxdLightIn,visibility:f32)->vec3f { return colour; }
fn bvfxDefaultWorldLight(s: BloxdSurface, l: BloxdLightIn, visibility:f32) -> BloxdLight {
    let control = bvfxWorld_controls();
    if (control.x < 0.5) { return bloxdDefaultLight(s,l); }
    var adjusted = l;
    let receiver = bvfxWorld_receiver();
    let entity = l.flags.lifeform || receiver > 0.5;
    let affected = (receiver > 0.5 && receiver < 1.5 && bvfxWorld_entityRules().x > 0.5)
        || (receiver > 1.5 && bvfxWorld_entityRules().y > 0.5);
    let scale = 1.0 - 0.85 * clamp(control.z,0.0,1.0);
    if (!entity) {
        adjusted.ambientLightColour *= scale;
        adjusted.skyLightColour *= scale;
        adjusted.blockLight *= scale;
        let wet=bvfxWorld_underwater();adjusted.skyLight=mix(adjusted.skyLight,1.0,clamp(abs(wet.x)*wet.y,0.0,1.0));
    }
    let fullBright = control.y > 0.5 || (entity && receiver > 0.5 && !affected);
    if (fullBright) {
        if (!entity) {
        adjusted.directional = 1.0;
        }
        adjusted.ambientLightColour = vec3f(1.0);
        adjusted.skyLightColour = vec3f(1.0);
        adjusted.blockLight = vec3f(0.0);
        adjusted.heldLight = vec3f(0.0);
    }
    let held = bvfxWorld_held();
    let armour = bvfxWorld_armour();
    var nearby = vec3f(0.0);
    if ((!entity || affected) && (held.w > 0.0 || armour.w > 0.0)) {
        let d = distance(l.position,bvfxWorld_lightPosition().xyz);
        let exponent = select(2.0,1.6,entity);
        if (held.w > 0.0) { nearby += held.rgb * pow(max(0.0,1.0-d/held.w),exponent); }
        if (armour.w > 0.0) { nearby += armour.rgb * pow(max(0.0,1.0-d/armour.w),exponent); }
        nearby = min(nearby,vec3f(1.5));
    }
    var result = bloxdLitColour(s,adjusted);
    if (!entity && bvfxWorld_groundTint().w > 0.5) {
        let ambient = adjusted.ambientLightColour;
        let block = ambient + adjusted.blockLight * (1.0-ambient);
        let sky = mix(ambient,adjusted.skyLightColour,adjusted.skyLight) * bvfxWorld_cloud(l.position);
        let nativeHeld = ambient + adjusted.heldLight * (1.0-ambient);
        let worldLight = max(max(block,sky),nativeHeld);
        result *= worldLight / max(bloxdWorldLight(adjusted),vec3f(0.000001));
    }
    // Match the existing terrain path: equipment lights textured surfaces
    // independently of directional face shading, before emission and fog.
    if (entity) {
        var neutral = adjusted;
        neutral.ambientLightColour=vec3f(1.0);neutral.skyLightColour=vec3f(1.0);
        neutral.blockLight=vec3f(0.0);neutral.heldLight=vec3f(0.0);
        result += bloxdLitColour(s,neutral) * nearby;
    } else {
        result += s.colour * l.diffuse * nearby;
        if (bvfxWorld_entityRules().z > 0.5) {
            let fog = clamp(adjusted.fogAlpha,0.0,1.0);
            adjusted.fogAlpha = fog*fog*(3.0-2.0*fog)*0.92;
        }
    }
    if (fullBright) { result *= visibility; }
    var output = bloxdDefaultLight(s,adjusted);
    output.colour = bloxdApplyFog(result+s.emission,adjusted) + bvfxWorld_metadata().rgb * control.w;
    output.colour = bvfxWorld_liquidColour(output.colour,l,visibility);
    return output;
}
`;
 return source+shadowSource.replace(/bloxdDefaultLight\(s,\s*l\)/g,'bvfxDefaultWorldLight(s,l,1.0)').replace(/bloxdDefaultLight\(s,\s*shaded\)/g,'bvfxDefaultWorldLight(s,shaded,mix(1.0,visibility,strength*fade))');
}
function patchNativeWorldSource(source,fields=['controls','held','armour','lightPosition','leafMotion','groundTint','groundFrame','cloudSun','cloudOrigin','entityRules']){
 if(typeof source!=='string'||!source.includes('fn pack_bvfxWorld_controls'))return source;
 if(source.includes('var<uniform> bvfxWorld: BvfxWorldParameters'))return source;
 for(const name of fields){
  const expression=new RegExp('fn\\s+pack_bvfxWorld_'+name+'\\s*\\(\\s*\\)\\s*->\\s*vec4f\\s*\\{\\s*return\\s+vec4f\\(0(?:\\.0)?\\);\\s*\\}');
  // The compiler's runtime module omits unreachable neutral helpers, unlike
  // its standalone validation module. Fields used only by our post-compile
  // cloud/leaf extension need no helper there; both use bvfxWorld directly.
  // Still reject a retained helper whose signature/body changed.
  if(!new RegExp('\\bpack_bvfxWorld_'+name+'\\b').test(source))continue;
  if(!expression.test(source))throw Error('Native world parameter contract changed: '+name);
  source=source.replace(expression,`fn pack_bvfxWorld_${name}() -> vec4f { return bvfxWorld.${name}; }`);
 }
 const receiver=/fn\s+pack_bvfxWorld_receiver\s*\(\s*\)\s*->\s*f32\s*\{\s*return\s+0(?:\.0)?;\s*\}/;
 if(!receiver.test(source))throw Error('Native entity receiver contract changed');
 const mesh=/struct Mesh\s*\{\s*world:\s*mat4x4f,\s*visibility:\s*f32,?\s*\}/;
 if(source.includes('var<uniform> mesh: Mesh;')){
  if(!mesh.test(source))throw Error('Native per-draw input layout changed');
  source=source.replace(mesh,body=>body.replace(/visibility:\s*f32,?/,'visibility:f32, bvfxReceiver:f32,'));
  source=source.replace(receiver,'fn pack_bvfxWorld_receiver() -> f32 { return mesh.bvfxReceiver; }');
 }else source=source.replace(receiver,'fn pack_bvfxWorld_receiver() -> f32 { return 0.0; }');
 const metadata=/fn\s+pack_bvfxWorld_metadata\s*\(\s*\)\s*->\s*vec4f\s*\{\s*return\s+vec4f\(0(?:\.0)?\);\s*\}/;
 if(!metadata.test(source))throw Error('Native world metadata contract changed');
 source=source.replace(metadata,'fn pack_bvfxWorld_metadata() -> vec4f { return bvfxWorldMetadata[min(bvfxWorldAtlas,65535u)]; }');
 const cloud=/fn\s+pack_bvfxWorld_cloud\s*\(\s*\w+:\s*vec3f\s*\)\s*->\s*vec3f\s*\{\s*return\s+vec3f\(1(?:\.0)?\);\s*\}/;
 if(!cloud.test(source))throw Error('Native ground light contract changed');
 source=source.replace(cloud,`fn pack_bvfxWorld_cloud(pack_position:vec3f)->vec3f {
  if(bvfxWorld.groundTint.w<0.5){return vec3f(1.0);}
  let sun=bvfxWorld.cloudSun.xyz;let position=pack_position+bvfxWorld.cloudOrigin.xyz;
  var cloud=0.0;
  if(bvfxWorld.cloudOrigin.w>0.0&&bvfxWorld.groundFrame.w>0.5&&sun.y>.025&&position.y<bvfxWorld.cloudSun.w){
   let point=position.xz+sun.xz*((bvfxWorld.cloudSun.w-position.y)/sun.y);
   let uv=(point-bvfxWorld.groundFrame.xy)/bvfxWorld.groundFrame.z+.5;
   let edge=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
   if(edge>0.0){cloud=textureSampleLevel(bvfxWorldGround,bvfxWorldSampler,vec2f(uv.x,1.0-uv.y),0.0).r*smoothstep(0.0,.04,edge);}
  }
  return bvfxWorld.groundTint.xyz*(1.0-cloud*bvfxWorld.cloudOrigin.w*.35);
 }`);
 // This extension uses the same atlas index as the native terrain shader.
 // Models keep metadata index zero; no guessed block or entity identifiers.
 if(source.includes('fn mainFragment(fragmentInputs: Varyings)')&&source.includes('texAtlasIndex: f32')){
  source=source.replace('fn mainFragment(fragmentInputs: Varyings) -> @location(0) vec4f {', '$&\n bvfxWorldAtlas = min(u32(max(0.0,round(fragmentInputs.texAtlasIndex))),65535u);');
 }
 const position='let worldPos = vec4f(vertexInputs.position + chunk.translation, 1.0);';
 if(source.includes(position)&&source.includes('vertexInputs.texAtlasIndices')){
  source=source.replace(position,'let bvfxRestPosition = vertexInputs.position + chunk.translation;\n let worldPos = vec4f(bvfxRestPosition + bvfxWorldLeafMove(bvfxRestPosition,u32(vertexInputs.texAtlasIndices)),1.0);');
 }
 return source+`\nstruct BvfxWorldParameters {${fields.map(name=>name+':vec4f,').join('\n')}}
@group(3) @binding(11) var<uniform> bvfxWorld: BvfxWorldParameters;
@group(3) @binding(12) var<storage,read> bvfxWorldMetadata: array<vec4f>;
@group(3) @binding(13) var bvfxWorldGround: texture_2d<f32>;
@group(3) @binding(14) var bvfxWorldSampler: sampler;
var<private> bvfxWorldAtlas: u32;
fn bvfxWorldLeafMove(p:vec3f,index:u32)->vec3f {
 let motion = bvfxWorld.leafMotion;
 if(motion.x<=0.0 || index==0u || index>=65536u){return vec3f(0.0);}
 let leaf = bvfxWorldMetadata[index].a;
 let phase = dot(p.xz,vec2f(.37,.23))+motion.y+motion.z;
 return vec3f(sin(phase),sin(phase+1.7)*.16,cos(phase+.6)*.55)*motion.x*leaf;
}\n`;
}
module.exports={nativeWorldSource,patchNativeWorldSource,worldParameterFields:fields,worldUniformBytes:uniformBytes};
