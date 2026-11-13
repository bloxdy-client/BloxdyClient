'use strict';
// Network failure UI only. Retries happen through a user click or reload key.
function failurePage(url,code){
 const target=new URL(url),dns=code==='ERR_NAME_NOT_RESOLVED';
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const message=dns?`Your DNS server could not resolve ${target.hostname}. Check your internet connection or DNS settings, then try again.`:'The game page could not be reached. Check your internet connection, then try again.';
 return 'data:text/html;charset=utf-8,'+encodeURIComponent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Bloxd connection problem</title><style>body{margin:0;background:#111318;color:#edf0f5;font:16px/1.6 system-ui;display:grid;min-height:100vh;place-items:center}main{max-width:32rem;padding:2rem}h1{font-size:1.8rem;line-height:1.2}p{color:#b9c1cd}a{display:inline-block;padding:.6rem 1.2rem;background:#eabf54;color:#17140b;border-radius:.4rem;text-decoration:none;font-weight:600}small{display:block;margin:1.5rem 0;color:#b9c1cd}</style></head><body><main><h1>Bloxd could not connect</h1><p>${escape(message)}</p><small>${escape(code)}</small><a href="${escape(target.href)}">Try again</a><p>You can also press F5 to retry, or close this window to return to the launcher.</p></main></body></html>`);
}
function installGameLoadRecovery(window,{url,report=()=>{}}){
 let failed=false,closed=false;
 const record=value=>{try{report(value);}catch{/* Diagnostic writes cannot hide the error page. */}};
 function fail(code){
  if(closed||window.isDestroyed()||failed||code==='ERR_ABORTED'||code===-3)return;
  code=/^ERR_[A-Z_]+$/.test(String(code))?String(code):'ERR_CONNECTION_FAILED';
  failed=true;record({phase:'failed',code});
  window.loadURL(failurePage(url,code)).then(()=>{if(!closed&&!window.isDestroyed())window.show();}).catch(()=>{record({phase:'error-page-failed',code});});
 }
 function load(){
  if(closed||window.isDestroyed())return;
  failed=false;
  return window.loadURL(url).catch(error=>fail(error?.code===-3?'ERR_ABORTED':String(error?.code).match(/^ERR_[A-Z_]+$/)?.[0]||String(error?.message).match(/ERR_[A-Z_]+/)?.[0]));
 }
 window.webContents.on('did-start-navigation',(_event,destination,_inPlace,isMainFrame)=>{if(isMainFrame&&/^https:/.test(destination))failed=false;});
 window.webContents.on('did-fail-load',(_event,code,description,failedURL,isMainFrame)=>{
  if(!isMainFrame||!/^https:/.test(failedURL))return;
  fail(code===-3?code:description);
 });
 window.webContents.on('did-finish-load',()=>{if(!failed)record({phase:'loaded'});});
 window.on('closed',()=>{closed=true;});
 return {load,reload(){if(failed)return load();window.webContents.reload();}};
}
module.exports={failurePage,installGameLoadRecovery};
