'use strict';
const {validateSourceFrame}=require('./source-frame.cjs');
const {validateGpuParticles}=require('./gpu-particles.cjs');
const {validateSourceLight}=require('./source-light.cjs');
// Atomic frame authorization of already-uploaded immutable mesh packet sequences.
// Missing entries are UNKNOWN, including on legacy source frame packets.
function validateSourceEmission(b){
  const fail=()=>{throw Error('Invalid source own RGB emission transaction.');};
  if(b.length<32+236||b.length>1024*1024)fail();
  const version=b.readUInt32LE(20),size=b.readUInt32LE(24),count=b.readUInt32LE(28);
  if(![1,2,3,4,5].includes(version)||count>8192||size<236)fail();
  let offset=32,total=0;const definitions=new Map(),definitionIds=new Set(),usedDefinitions=new Set();
  if(version===5){if(offset+4>b.length-size)fail();const n=b.readUInt32LE(offset);offset+=4;if(!n||n>256)fail();
    for(let i=0;i<n;++i){if(offset+40>b.length-size)fail();const words=Array.from({length:10},(_,j)=>b.readUInt32LE(offset+j*4));offset+=40;
      const [token,id,root,flags,rot,open,half,nameLength,rootLength,stateLength]=words,length=nameLength+rootLength+stateLength,padded=(length+3)&~3;
      if(!token||definitions.has(token)||!id||id>65535||definitionIds.has(id)||!root||root>65535||flags>15||rot>4||open>2||half>3||!nameLength||!rootLength||nameLength>128||rootLength>128||stateLength>128||offset+padded>b.length-size)fail();
      if(b.subarray(offset,offset+length).some(v=>v<32||v>126)||b.subarray(offset+length,offset+padded).some(v=>v!==0))fail();
      offset+=padded;definitions.set(token,id);definitionIds.add(id);}}
  const ids=new Set();for(let i=0;i<count;++i){const at=offset;if(at+(version>=3?24:16)>b.length-size)fail();const id=b.readUInt32LE(at);let value=b.readUInt32LE(at+12),kind=0;offset+=16;
    if(!id||ids.has(id)||!b.readUInt32LE(at+4)||!b.readUInt32LE(at+8))fail();ids.add(id);
    if(version>=3){kind=value;const sequence=b.readUInt32LE(offset);value=b.readUInt32LE(offset+4);offset+=8;if(kind>1||(kind===1?!sequence:sequence!==0))fail();}
    if(version===1){if(value>4095)fail();continue;}
    if(!value||(total+=value)>8192||offset+value*((kind?20:version>=4?12:8)+(version===5?4:0))>b.length-size)fail();
    let end=0;const lifetimes=new Set();for(let j=0;j<value;++j){const next=b.readUInt32LE(offset),rgb=b.readUInt32LE(offset+4);offset+=8;
      if(next<=end||next>(kind?65536:6000000)||!kind&&next%3||rgb!==0&&(rgb<4096||rgb>8191))fail();
      let blockValue=0,blockKnown=false;
      if(kind){const block=b.readUInt32LE(offset),generation=b.readUInt32LE(offset+4),life=b.readUInt32LE(offset+8);offset+=12;
        if(next!==end+1||!block||block>65535||!generation||!life||lifetimes.has(life))fail();lifetimes.add(life);}
      if(kind){blockValue=b.readUInt32LE(offset-12);blockKnown=true;}
      else if(version>=4){const block=b.readUInt32LE(offset);offset+=4;if(block!==0&&(block<65536||block>131071))fail();blockValue=block&65535;blockKnown=block!==0;}
      if(version===5){const token=b.readUInt32LE(offset);offset+=4;if(token){if(!blockKnown||definitions.get(token)!==blockValue)fail();usedDefinitions.add(token);}}
      end=next;}
  }
  if(offset+size!==b.length||usedDefinitions.size!==definitions.size)fail();
  const inner=b.subarray(offset),type=inner.readUInt32LE(4);
  if(inner.readUInt32LE(0)!==0x31444e42||inner.readUInt32LE(8)!==size-16||inner.readUInt32LE(16)!==b.readUInt32LE(16))fail();
  if(type===30)validateSourceFrame(inner);else if(type===31)validateGpuParticles(inner);else if(type===32)validateSourceLight(inner);else fail();
  let frame=inner;if(type===32)frame=frame.subarray(104);if(frame.readUInt32LE(4)===31)frame=frame.subarray(32);
  if((frame.readUInt32LE(24)&44)!==44)fail();
  return b;
}
module.exports={validateSourceEmission};
