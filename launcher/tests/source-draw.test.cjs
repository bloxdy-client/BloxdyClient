'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const contracts=require('./fixtures/render-groups-2026-10-15.json').contracts;
function source(kind){const item=contracts.find(item=>item.kind===kind);assert.equal(crypto.createHash('sha256').update(item.code).digest('hex'),item.sha256);return item.code;}

test('actual source group comparators distinguish alpha/distance from Bloxd material-ID sorting',()=>{
  const code=source('sorts').replaceAll('}static ','},').replace(/^static /,''),context=vm.createContext({});
  const group=vm.runInContext('es=({'+code+'})',context,{timeout:1000});
  const a={_alphaIndex:-Number.MAX_VALUE,_distanceToCamera:1,getMesh:()=>({material:{uniqueId:Number.MAX_SAFE_INTEGER},uniqueId:1})};
  const b={_alphaIndex:Number.MAX_VALUE,_distanceToCamera:20,getMesh:()=>({material:{uniqueId:3},uniqueId:2})};
  assert.ok(group.defaultTransparentSortCompare(a,b)<0);assert.ok(group.backToFrontSortCompare(a,b)>0);assert.ok(group.frontToBackSortCompare(a,b)<0);assert.ok(group.oY(a,b)>0);
  const setup=source('bloxdGroups');assert.match(setup,/VY=-1/);assert.match(setup,/xY\(es,Sy.b.oY,Sy.b.oY,Sy.b.oY\)/);assert.match(setup,/im\(0,!1\)/);
});

test('actual isolated mesh draw hook observes after geometry checks and before the source draw',()=>{
  const draw=vm.runInNewContext('({'+source('drawHook')+'})._draw',{gs:{c:{WireFrameFillMode:1,PointFillMode:2}}},{timeout:1000}),events=[];
  const engine={drawElementsType(){events.push('draw');}},mesh={_geometry:{getVertexBuffers:()=>({}),getIndexBuffer:()=>({})},_internalMeshDataInfo:{_onBeforeDrawObservable:{notifyObservers(value){assert.equal(value,mesh);events.push('observe');}}},fO:()=>({getEngine:()=>engine})};
  assert.equal(draw.call(mesh,{indexStart:0,indexCount:3},0,1),mesh);assert.deepEqual(events,['observe','draw']);
  events.length=0;mesh._geometry=null;draw.call(mesh,{},0,1);assert.deepEqual(events,[]);
});
