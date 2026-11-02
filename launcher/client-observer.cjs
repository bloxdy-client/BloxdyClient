'use strict';
// Serialized into a user-started game. Reads public metadata and the user's
// in-world character; never opens a menu, creates a preview or changes a player.
module.exports=function observeClient(options,captureFactory,encode){
 let api=null,app=null,menus=null,last='',capturing=false,saved='',candidate='',retryAt=0,status='',joined=null,epoch=0,stopped=false,signatureAt=0;const host=globalThis.__BLOXD_MOD_HOST__,capture=options.action==='game'?captureFactory?.(encode):null;
 const routeAccount=options.action==='account'&&options.platform!=='crazygames';
 function releaseReady(){if(api&&(!routeAccount||app&&menus))release();}
 const release=host.observeDefinitions('launcher-account-observer',(target,key,descriptor)=>{
  if(stopped)return;
  if(key==='singletons'&&typeof target?.getBloxd==='function'){api=target;releaseReady();}
  if(routeAccount&&!(app&&menus)&&descriptor?.get&&/^\(\)=>[\w$]+$/.test(String(descriptor.get)))queueMicrotask(()=>{if(stopped||app&&menus)return;try{const v=descriptor.get();if(typeof v?.get==='function'&&typeof v?.set==='function'&&typeof v?.setClientEscMenuOptions==='function')app=v;if(v&&v.SETTINGS!==undefined&&v.CUSTOMISATION!==undefined&&v.SHOP!==undefined)menus=v;releaseReady();}catch{}});
 });
 let navigated=false;
 function metadata(context){const value={loggedIn:context.isLoggedIn()===true,username:String(context.getPlayerName()||'').slice(0,80),cosmetics:{}};const c=context.getPlayerCosmetics?.()||{};for(const key of ['skin','hat','head','eyebrows','eyes','back','body','legs','shoes','cape','nameColour','profileEffect','emote'])if(typeof c[key]==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(c[key]))value.cosmetics[key]=c[key];return value;}
 function report(value){const text=JSON.stringify(value);if(text!==status){status=text;globalThis.bloxdLauncherClient.characterStatus?.(value);}}
 function resetJoined(){if(joined||saved||candidate){joined=null;saved='';candidate='';epoch++;}}
 function scan(){try{
  if(stopped)return;
  if(!api)api=host.engine();const context=api?.singletons?.clientSidePartyStateManager?.userContext;
  if(context&&typeof context.isLoggedIn==='function'&&typeof context.getPlayerName==='function'){const value=metadata(context),text=JSON.stringify(value);if(text!==last){last=text;status='';retryAt=0;globalThis.bloxdLauncherClient.account(value);}}
  if(!navigated&&app&&menus&&routeAccount){app.set({openEverythingMenuName:menus.SETTINGS,openSettingsCategory:'account'});navigated=true;}
  releaseReady();
  if(options.action!=='game'||!capture)return;
  if(!api){resetJoined();report({phase:'waiting',message:'Waiting for Bloxd to initialize.'});return;}
  if(context?.isLoggedIn()!==true){resetJoined();report({phase:'waiting',message:'Waiting for your signed-in Bloxd account.'});return;}
  if(!capturing&&Date.now()>=retryAt){
   let source;try{source=capture.world(api);}catch(error){resetJoined();report({phase:'waiting',message:String(error.message).slice(0,200)});return;}
   const same=(a,b)=>a.engine===b.engine&&a.thinInstMgr===b.thinInstMgr&&a.component===b.component&&a.player===b.player&&a.rw===b.rw&&a.connection===b.connection;
   if(!joined||!same(joined,source)){joined=source;saved='';candidate='';signatureAt=0;epoch++;}
   // A saved, unchanged account needs a slow asset audit, not a traversal of
   // every worn mesh every two seconds. Joins and public outfit changes bypass
   // this delay; initial capture and its final ownership check remain unchanged.
   if(saved.startsWith(last+'|')&&Date.now()<signatureAt)return;
   const signature=capture.signature(source),key=last+'|'+signature;if(key===saved){signatureAt=Date.now()+10000;return;}if(candidate!==key){candidate=key;report({phase:'waiting',message:'Waiting for character assets to settle.'});return;}const identity=last,currentEpoch=epoch;capturing=true;report({phase:'reading',message:'Reading joined player model.'});
   capture.exportWorld(api).then(async bytes=>{
    const current=capture.world(api),currentContext=api?.singletons?.clientSidePartyStateManager?.userContext;if(!currentContext||currentEpoch!==epoch||identity!==JSON.stringify(metadata(currentContext))||!same(current,source)||capture.signature(current)!==signature)return;
    if(await globalThis.bloxdLauncherClient.character({metadata:JSON.parse(identity),bytes:new Uint8Array(bytes)})){saved=key;report({phase:'ready',message:'3D character saved.'});}
   }).catch(error=>{retryAt=Date.now()+10000;report({phase:'waiting',message:String(error.message).slice(0,200)});}).finally(()=>{capturing=false;});
  }
 }catch(error){report({phase:'waiting',message:String(error.message).slice(0,200)});} }
 // Account-only windows do no model capture. Publish completed official sign-in
 // promptly; keep the game's existing two-second character cadence.
 const timer=setInterval(scan,options.action==='account'?250:2000);scan();addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);release();joined=null;epoch++;},{once:true});
};
