'use strict';
const {validateSourceFrame}=require('./source-frame.cjs');
const {validateGpuParticles}=require('./gpu-particles.cjs');
// Type 32/v1 wraps an UNCHANGED type 30 or 31 transaction. No reference semantics.
function validateSourceLight(b){
  const fail=()=>{throw Error('Invalid source light transaction.');};
  if(b.length<340||b.length>1024*1024||b.readUInt32LE(20)!==1)fail();
  const size=b.readUInt32LE(24),flags=b.readUInt32LE(28),enabled=b.readUInt32LE(32);
  if(flags>15||enabled>1||(!(flags&1)&&enabled)||((flags&6)&&(!(flags&1)||!enabled))||b.length!==104+size)fail();
  const nested=b.subarray(104),type=nested.readUInt32LE(4);
  if(nested.readUInt32LE(0)!==0x31444e42||nested.readUInt32LE(8)!==size-16||nested.readUInt32LE(16)!==b.readUInt32LE(16))fail();
  if(type===30)validateSourceFrame(nested);else if(type===31)validateGpuParticles(nested);else fail();
  const frame=type===30?nested:nested.subarray(32,32+nested.readUInt32LE(24));
  if(flags&&(frame.readUInt32LE(24)&44)!==44)fail();
  const v=Array.from({length:17},(_,i)=>b.readFloatLE(36+4*i));
  if(v.some(x=>!Number.isFinite(x)))fail();
  for(let i=0;i<17;++i){const mask=i<6?2:i<14?4:8;
    if(!(flags&mask)){if(v[i]!==0)fail();continue;}
    if(i<6&&(v[i]<0||v[i]>65504)||i>=6&&i<=8&&(v[i]<0||v[i]>15)||i===9&&(v[i]<0||v[i]>16777216)||i>=10&&i<=12&&Math.abs(v[i])>16777216||i===13&&(v[i]<0||v[i]>1))fail();
  }
  if(flags&8&&Math.abs(Math.hypot(...v.slice(14))-1)>1e-4)fail();
  if(flags&4&&v[13]>0&&Math.abs(Math.hypot(...v.slice(10,13))-1)>1e-4)fail();
  return b;
}
module.exports={validateSourceLight};
