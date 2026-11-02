'use strict';

// Bloxd's cached client configuration uses this Firebase auth domain.
// Keep normal window.open/opener semantics so Firebase can finish the login.
function isGoogleAuthURL(value){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.port)return false;
    if(url.hostname==='accounts.google.com')return true;
    if(url.hostname==='bloxd-ee1aa.firebaseapp.com'&&url.pathname==='/__/auth/handler'){
      const provider=url.searchParams.get('providerId');
      return !provider||provider==='google.com';
    }
    return url.hostname==='bloxd.io'&&url.pathname==='/auth-callback/google';
  }catch{return false;}
}

function isBloxdAuthURL(value){if(isGoogleAuthURL(value))return true;try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return false;if(u.hostname==='appleid.apple.com')return true;if(['login.microsoftonline.com','login.live.com','account.live.com'].includes(u.hostname))return true;if(u.hostname==='discord.com')return /^\/(?:oauth2\/authorize|api\/oauth2\/authorize|login|register)(?:\/|$)/.test(u.pathname);if(u.hostname==='bloxd-ee1aa.firebaseapp.com'&&u.pathname==='/__/auth/handler')return ['apple.com','microsoft.com'].includes(u.searchParams.get('providerId'));return u.hostname==='bloxd.io'&&/^\/auth-callback\/(apple|microsoft|discord)$/.test(u.pathname);}catch{return false;}}
function installBloxdAuthPopups(contents,{offline=false,googleOnly=false,additionalAuthURL=null}={}){
  const base=googleOnly?isGoogleAuthURL:isBloxdAuthURL;
  const allowed=value=>base(value)||typeof additionalAuthURL==='function'&&additionalAuthURL(value);
  let authWindows=0,previousThrottling;
  contents.setWindowOpenHandler(({url})=>{
    if(offline||!allowed(url))return {action:'deny'};
    return {action:'allow',outlivesOpener:false,overrideBrowserWindowOptions:{
      width:520,height:700,show:true,title:'Bloxd sign in',autoHideMenuBar:true,
      webPreferences:{...(contents.session?{session:contents.session}:{}),preload:'',nodeIntegration:false,nodeIntegrationInSubFrames:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false}
    }};
  });
  contents.on('did-create-window',child=>{
    // Keep the opener's official auth callbacks responsive while the popup has
    // focus. Restore its original policy after the last sign-in window closes.
    if(authWindows++===0){previousThrottling=contents.getBackgroundThrottling?.();contents.setBackgroundThrottling?.(false);}
    child.once?.('closed',()=>{if(--authWindows===0&&typeof previousThrottling==='boolean'&&!contents.isDestroyed?.())contents.setBackgroundThrottling?.(previousThrottling);});
    child.setMenu(null);
    child.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    const guard=(event,url)=>{if(!allowed(url))event.preventDefault();};
    child.webContents.on('will-navigate',guard);
    child.webContents.on('will-redirect',guard);
    // The login window deliberately has no capture preload and no login logging.
  });
}

function installGoogleAuthPopups(contents,options={}){return installBloxdAuthPopups(contents,{...options,googleOnly:true});}
module.exports={isGoogleAuthURL,isBloxdAuthURL,installGoogleAuthPopups,installBloxdAuthPopups};
