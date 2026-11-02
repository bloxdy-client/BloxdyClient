'use strict';
const {validateSourceFrame}=require('./source-frame.cjs');
// Type 31/v1: atomic source frame (complete type-30 wire frame), then ordered draws.
function validateGpuParticles(b){
  const fail=()=>{throw Error('Invalid source GPU particle snapshot.');};
  if(b.length<32||b.length>1024*1024||b.readUInt32LE(20)!==1)fail();
  const frameBytes=b.readUInt32LE(24),count=b.readUInt32LE(28);
  if(![240,312,452].includes(frameBytes)||count>32||32+frameBytes>b.length)fail();
  const frame=b.subarray(32,32+frameBytes);if(frame.readUInt32LE(0)!==0x31444e42||frame.readUInt32LE(4)!==30||frame.readUInt32LE(8)!==frameBytes-16||frame.readUInt32LE(16)!==b.readUInt32LE(16))fail();validateSourceFrame(frame);
  if((frame.readUInt32LE(24)&44)!==44)fail(); // observed + exact origin/player tuple
  let at=32+frameBytes,slots=0,previous=-1;const identities=new Map(),repeated=new Set();
  for(let draw=0;draw<count;++draw){
    if(at+1352>b.length)fail();const u=i=>b.readUInt32LE(at+4*i);
    const id=u(0),order=u(1),n=u(2),start=u(3),flags=u(6);slots+=n;
    if(!id||order>65535||order<=previous||!n||n>8192||slots>8192||start>=n||!u(4)||!u(5)||flags>15||u(7)<512||u(7)>519||u(12)!==32774||u(13)!==32774)fail();
    const factors=[u(8),u(9),u(10),u(11)].join(',');
    if(!(flags&4)||!['1,1,0,1','770,771,1,1','770,1,0,1','774,0,1,1','0,769,1,1'].includes(factors)||!!(flags&8)!==(factors==='774,0,1,1'))fail();
    for(let i=14;i<18;++i)if(![10497,33071,33648].includes(u(i)))fail();
    const floats=at+72,params=floats+36*4,f=i=>b.readFloatLE(params+i*4);
    for(let i=0;i<320;++i){const x=b.readFloatLE(floats+i*4);if(!Number.isFinite(x)||Math.abs(x)>1e12)fail();}
    for(let i=0;i<32;++i)if(b.readFloatLE(floats+i*4)!==frame.readFloatLE(68+i*4))fail();
    for(const i of [3,8,9])if(!Number.isInteger(f(i))||f(i)<0||f(i)>16)fail();if(![0,1].includes(f(10)))fail();
    for(const [n,base,stride] of [[f(3),12,1],[f(8),156,4],[f(9),220,4]])for(let i=0;i<n;++i){const x=f(base+i*stride);if(x<0||x>1||i&&x<f(base+(i-1)*stride))fail();}
    if(f(10))for(let i=0;i<f(9);++i)if(f(222+i*4)-f(221+i*4)<=1e-8)fail();
    const end=at+1352+n*64;if(end>b.length)fail();
    for(let i=0;i<n*16;++i)if(![9,10,11].includes(i%16)){const x=b.readFloatLE(at+1352+i*4);if(!Number.isFinite(x)||Math.abs(x)>1e12)fail();}
    // A repeated identity is only the second, additive pass of the same batch.
    if(repeated.has(id))fail();
    if(identities.has(id)){const p=identities.get(id);if(order!==p.order+1||!(p.flags&8)||(flags&8)||factors!=='770,1,0,1'||!b.subarray(p.at+72,p.end).equals(b.subarray(at+72,end))||u(4)!==b.readUInt32LE(p.at+16)||u(5)!==b.readUInt32LE(p.at+20)||start!==b.readUInt32LE(p.at+12))fail();repeated.add(id);}
    else {if(order%2)fail();identities.set(id,{at,end,order,flags});}
    previous=order;at=end;
  }
  if(at!==b.length)fail();return b;
}
module.exports={validateGpuParticles};
