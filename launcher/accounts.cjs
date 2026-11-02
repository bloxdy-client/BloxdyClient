'use strict';
const {ID}=require('./model.cjs');
const PROVIDERS=['google','apple','microsoft','discord','crazygames'];
function partition(account){if(!account||!ID.test(account.id))throw Error('Invalid account.');return account.legacySession&&account.provider!=='crazygames'?undefined:'persist:bloxd-'+account.id;}
function publicMetadata(value){if(!value||typeof value.loggedIn!=='boolean')throw Error('Invalid account status.');const username=typeof value.username==='string'?value.username.slice(0,80):'';const cosmetics={};for(const key of ['skin','hat','head','eyebrows','eyes','back','body','legs','shoes','cape','nameColour','profileEffect','emote'])if(typeof value.cosmetics?.[key]==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value.cosmetics[key]))cosmetics[key]=value.cosmetics[key];return {loggedIn:value.loggedIn,username,cosmetics};}
module.exports={PROVIDERS,partition,publicMetadata};
