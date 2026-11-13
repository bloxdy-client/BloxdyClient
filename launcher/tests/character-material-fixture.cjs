'use strict';
// Original public Lite material/texture contracts, evaluated with CPU stubs.
module.exports={
  "sources": [
    {
      "url": "https://bloxd.io/static/js/op8uk.9.23520dfc.chunk.js",
      "sha256": "0f28b517b9b5ee9a6d843a5b9049288892a3188c3e2c4eea5e80e3b9cd894b18"
    },
    {
      "url": "https://bloxd.io/static/js/op8uk.56.05ac1264.chunk.js",
      "sha256": "b11e36741c05a64ec1c703b9c2a6e75712e3dd4f74f4f3285c8356250cbba4dd"
    }
  ],
  "materialClass": "class Hz{constructor(zz){this.name=zz,this.version=0,this.refs=1,this.gpu=[],this.mirror=null,this.uniqueId=-1,this.frozen=!1,this.features=[],this.item=!1,this.lifeform=!1,this.diffuseColor=Float64Array.of(1,1,1),this.ambientColor=Float64Array.of(0,0,0),this.specularColor=Float64Array.of(1,1,1),this.emissiveColor=Float64Array.of(0,0,0),this.specularPower=64,this.alpha=1,this.alphaCutOff=.4,this.roughness=0,this.useReflectionOverAlpha=!1,this.alphaMode=hz.combine,this.transparencyMode=null,this.useAlphaFromDiffuseTexture=!1,this.useEmissiveAsIllumination=!1,this.linkEmissiveWithDiffuse=!1,this.disableLighting=!1,this.maxSimultaneousLights=4,this.twoSidedLighting=!1,this.fogEnabled=!0,this.backFaceCulling=!0,this.cullBackFaces=!0,this.sideOrientation=null,this.disableDepthWrite=!1,this.forceDepthWrite=!1,this.depthFunction=0,this.zOffset=0,this.zOffsetUnits=0,this.disableColorWrite=!1,this.fillMode=0,this.diffuseTexture=null,this.opacityTexture=null,this.emissiveTexture=null,this.reflectionTexture=null,cT++}}",
  "mirrorClass": "class Pz{constructor(zz,Tz){this.name=zz,this.TW=Tz,this.uniqueId=void 0,this.checkReadyOnlyOnce=!1,this._blockDirtyMechanism=!1,this.disposers=[],this.hAz={addOnce:zz=>{this.disposers.push(zz)}},this.uniqueId=Tz.getUniqueId()}get isFrozen(){return this.checkReadyOnlyOnce}Xzz(){return this.TW}getClassName(){return\"LiteMaterial\"}freeze(){this.checkReadyOnlyOnce=!0}unfreeze(){this.checkReadyOnlyOnce=!1}markDirty(){}get fillMode(){return this.model.fillMode}needAlphaBlendingForMesh(zz){return(0,dz.J)(this.model,zz.visibility,zz.hasVertexAlpha)}needAlphaTestingForMesh(zz){return(0,dz.N)(this.model,zz.visibility,zz.hasVertexAlpha)}dispose(){(0,Rz.o)(this);for(const zz of this.disposers.splice(0))zz()}get model(){return(0,dz.X)(this)}}",
  "textureClass": "class nz{constructor(zz,Tz,jT){this.kind=zz,this.source=Tz,this.sampler=jT,this.version=0,this.refs=0,this.live=!1,this.released=!1,this.gpu=[],this.mirror=null,this.hasAlpha=!1,this.level=1,this.uvSet=0,this.getAlphaFromRGB=!1,this.optimizeUVAllocation=!0,this.invertZ=!1,this.matrix=Float32Array.from(Xz)}}",
  "link": "function az(zz,Tz){zz.mirror=Tz,zz.uniqueId=Tz.uniqueId,Xz.set(Tz,zz)}",
  "nullInvertYRule": "this.uploadImage(Tz,!0===Wz.invertY,jT.url)",
  "armourRgbRule": "aArmourTint is vec4; shader multiplies col1.rgb by vTintAndOpacity.xyz"
};
