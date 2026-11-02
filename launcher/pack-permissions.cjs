'use strict';
// Chromium's picker supplies a user-selected path. Only grant reads in the
// owned Bloxd contents; never grant writes, other origins or account popups.
function canReadPack(contents,owned,origin,details={},embedded=false){
 try{const top=owned.getURL?.()||owned.mainFrame?.url;return contents===owned&&(embedded?require('./crazygames.cjs').portalGame(top):new URL(top).origin==='https://bloxd.io')&&new URL(origin).origin==='https://bloxd.io'&&details.fileAccessType==='readable'&&typeof details.filePath==='string'&&details.filePath.length>0&&(!details.embeddingOrigin||embedded&&require('./crazygames.cjs').frameOrigin(details.embeddingOrigin));}catch{return false;}
}
module.exports={canReadPack};
