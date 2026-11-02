'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {isGoogleAuthURL,installGoogleAuthPopups}=require('../google-auth-popup.cjs');
test('Auth popups keep their opener responsive and restore throttling after the last popup closes',()=>{
 const {EventEmitter}=require('node:events'),contents=new EventEmitter(),changes=[];
 contents.setWindowOpenHandler=()=>{};contents.getBackgroundThrottling=()=>true;contents.setBackgroundThrottling=value=>changes.push(value);
 installGoogleAuthPopups(contents);
 function child(){const w=new EventEmitter();w.setMenu=()=>{};w.webContents=new EventEmitter();w.webContents.setWindowOpenHandler=()=>{};contents.emit('did-create-window',w);return w;}
 const first=child(),second=child();assert.deepEqual(changes,[false]);first.emit('closed');assert.deepEqual(changes,[false]);second.emit('closed');assert.deepEqual(changes,[false,true]);
});

test('Google auth endpoints work while lookalike hosts and other protocols are rejected',()=>{
  for(const url of ['https://accounts.google.com/o/oauth2/auth','https://bloxd-ee1aa.firebaseapp.com/__/auth/handler?providerId=google.com','https://bloxd-ee1aa.firebaseapp.com/__/auth/handler','https://bloxd.io/auth-callback/google'])assert.equal(isGoogleAuthURL(url),true,url);
  for(const url of ['about:blank','javascript:alert(1)','file:///C:/test','http://accounts.google.com/','https://accounts.google.com.evil.example/','https://accounts.google.com@evil.example/','https://user@accounts.google.com/','https://accounts.google.com:1234/','https://another-project.firebaseapp.com/__/auth/handler','https://bloxd-ee1aa.firebaseapp.com/other','https://bloxd-ee1aa.firebaseapp.com/__/auth/handler?providerId=facebook.com','https://bloxd.io/game/survival'])assert.equal(isGoogleAuthURL(url),false,url);
});

test('login popup has no bridge preload; offline mode denies all popups',()=>{
  const contents={setWindowOpenHandler(fn){this.handler=fn;},on(){}};
  installGoogleAuthPopups(contents);
  const allowed=contents.handler({url:'https://bloxd-ee1aa.firebaseapp.com/__/auth/handler?providerId=google.com'});
  assert.equal(allowed.action,'allow');assert.equal(allowed.outlivesOpener,false);
  assert.deepEqual(allowed.overrideBrowserWindowOptions.webPreferences,{preload:'',nodeIntegration:false,nodeIntegrationInSubFrames:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false});
  assert.equal(contents.handler({url:'https://ad.example/'}).action,'deny');
  installGoogleAuthPopups(contents,{offline:true});assert.equal(contents.handler({url:'https://accounts.google.com/'}).action,'deny');
});

test('child redirects retain Google/Firebase callback and deny unrelated navigation and nested popups',()=>{
  const callbacks={};let nested,menu;
  const contents={setWindowOpenHandler(){},on(name,fn){callbacks[name]=fn;}};
  installGoogleAuthPopups(contents);
  const events={};callbacks['did-create-window']({setMenu(value){menu=value;},webContents:{setWindowOpenHandler(fn){nested=fn;},on(name,fn){events[name]=fn;}}});
  assert.equal(menu,null);assert.equal(nested({url:'https://accounts.google.com/'}).action,'deny');
  for(const name of ['will-navigate','will-redirect']){
    let prevented=false;const event={preventDefault(){prevented=true;}};
    events[name](event,'https://accounts.google.com/signin/v2');assert.equal(prevented,false);
    events[name](event,'https://bloxd-ee1aa.firebaseapp.com/__/auth/handler');assert.equal(prevented,false);
    events[name](event,'https://evil.example/');assert.equal(prevented,true);
  }
});
