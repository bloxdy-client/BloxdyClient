// Mouse drag rotates at a fixed distance. No wheel, pinch, pan or keyboard zoom.
export function dragRotation(canvas,onChange){
 let pointer=null,lastX=0,lastY=0,yaw=0,pitch=0;
 const down=e=>{if(e.pointerType!=='mouse'||e.button!==0)return;pointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture?.(pointer);e.preventDefault();};
 const move=e=>{if(e.pointerId!==pointer)return;yaw+=(e.clientX-lastX)*.009;pitch=Math.max(-.45,Math.min(.45,pitch+(e.clientY-lastY)*.006));lastX=e.clientX;lastY=e.clientY;onChange(yaw,pitch);};
 const up=e=>{if(e.pointerId!==pointer)return;if(canvas.hasPointerCapture?.(pointer))canvas.releasePointerCapture(pointer);pointer=null;};
 const context=e=>e.preventDefault();canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',up);canvas.addEventListener('contextmenu',context);
 return {dispose(){for(const [type,fn]of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['contextmenu',context]])canvas.removeEventListener(type,fn);}};
}
