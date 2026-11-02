'use strict';
// Use the real portal and its existing Bloxd integration. Never copy tokens,
// imitate a parent SDK, forge a referrer or rewrite the game's platform flags.
const GAME_URL='https://www.crazygames.com/game/bloxdhop-io';
function url(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u:null;}catch{return null;}}
function portalOrigin(value){const u=url(value);return !!u&&u.hostname==='www.crazygames.com';}
function frameOrigin(value){const u=url(value);return !!u&&['www.crazygames.com','gameframe.crazygames.com','games.crazygames.com'].includes(u.hostname);}
function portalGame(value){const u=url(value);return !!u&&portalOrigin(value)&&/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?game\/bloxdhop-io\/?$/i.test(u.pathname);}
function authURL(value){const u=url(value);if(!u)return false;if(u.hostname==='auth.crazygames.com')return /^\/__\/auth\/(?:handler|iframe)$/.test(u.pathname);return portalOrigin(value)&&/^\/(?:[a-z]{2}\/)?(?:auth|login|register)(?:\/|$)/i.test(u.pathname);}
function portalNavigation(value){return portalOrigin(value)||authURL(value);}
function bloxd(value){const u=url(value);return !!u&&u.hostname==='bloxd.io';}
function gameFrame(contents,frame,embedded=false){
 try{
  if(!contents||!frame||frame.detached||!bloxd(frame.url))return false;
  const main=contents.mainFrame;
  if(!embedded)return frame===main;
  if(frame===main||!portalGame(main.url)||/^\/(?:auth-callback|pack-welcome)(?:\/|$)/.test(url(frame.url).pathname))return false;
  let current=frame.parent;const seen=new Set([frame]);
  for(let depth=0;current&&depth<8;depth++){
   if(current===main)return true;
   if(seen.has(current)||current.detached)return false;seen.add(current);
   if(!frameOrigin(current.url))return false;
   current=current.parent;
  }
 }catch{}return false;
}
module.exports={GAME_URL,portalOrigin,frameOrigin,portalGame,authURL,portalNavigation,bloxd,gameFrame};
