'use strict';
// BND1/30 v1: one camera + render-sampled player/observed-hand transaction.
// No world clock, weather, semantic IDs or reference bob fields exist here.
function validateSourceFrame(bytes){
  const fail=()=>{throw Error('Invalid authoritative source frame.');};
  if(bytes.length<240||bytes.readUInt32LE(20)!==1)fail();
  const u=at=>bytes.readUInt32LE(16+at*4),flags=u(2),w=u(3),h=u(4);
  if(flags>63||!w||!h||w>32768||h>32768||!u(5)||!u(6)||!u(7))fail();
  const player=(flags&8)!==0,hand=(flags&16)!==0,sampled=(flags&32)!==0;
  if(!!(flags&4)!==player||player&&!sampled||hand&&!player||(!player&&(u(8)||u(9)||u(10)))||player&&(!u(8)||!u(9)||!u(10))||
    (hand?(u(12)<2||u(12)>4):u(12)!==0)||!sampled&&u(11))fail();
  const expected=240+(player?72:0)+(hand?140:0);if(bytes.length!==expected)fail();
  const floats=(at,n)=>Array.from({length:n},(_,i)=>{const v=bytes.readFloatLE(at+i*4);if(!Number.isFinite(v))fail();return v;});
  const matrix=m=>{const a=m[0]*m[5]-m[1]*m[4],b=m[0]*m[6]-m[2]*m[4],c=m[0]*m[7]-m[3]*m[4],d=m[1]*m[6]-m[2]*m[5],e=m[1]*m[7]-m[3]*m[5],f=m[2]*m[7]-m[3]*m[6];
    const det=a*(m[10]*m[15]-m[11]*m[14])-b*(m[9]*m[15]-m[11]*m[13])+c*(m[9]*m[14]-m[10]*m[13])+d*(m[8]*m[15]-m[11]*m[12])-e*(m[8]*m[14]-m[10]*m[12])+f*(m[8]*m[13]-m[9]*m[12]);
    if(!Number.isFinite(det)||Math.abs(det)<1e-12)fail();};
  const checkEye=(view,eye)=>{if(Math.abs(view[3])+Math.abs(view[7])+Math.abs(view[11])+Math.abs(view[15]-1)>=1e-5)fail();
    const transformed=[0,1,2].map(i=>view[i]*eye[0]+view[4+i]*eye[1]+view[8+i]*eye[2]+view[12+i]);if(Math.hypot(...transformed)>.05)fail();};
  const view=floats(68,16);matrix(view);matrix(floats(132,16));const camera=floats(196,7);if(sampled)checkEye(view,camera);
  const utc=bytes.readDoubleLE(224),age=bytes.readDoubleLE(232);
  if(!Number.isFinite(utc)||utc<0||!Number.isFinite(age)||age<0)fail();
  if(player){const values=[];for(let at=240;at<312;at+=8){const v=bytes.readDoubleLE(at);if(!Number.isFinite(v)||Math.abs(v)>2**52)fail();values.push(v);}
    for(let i=3;i<9;++i)if(Math.abs(values[i]-values[i%3])>16777216)fail();}
  if(hand){const v=floats(312,16);matrix(v);matrix(floats(376,16));checkEye(v,floats(440,3));}
  return bytes;
}
module.exports={validateSourceFrame};
