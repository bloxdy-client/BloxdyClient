'use strict';
// The user explicitly restored official, user-operated Bloxd windows. No native
// OAuth impersonation: all sign-in and account edits use Bloxd's own interface.
const MESSAGE='Sign in and sync through an official Bloxd window. You complete login and account changes yourself; the launcher saves your public username, cosmetics and 3D character locally.';
function capabilities(){return {available:true,status:'official-window',directAPI:false,message:MESSAGE,crazyGames:{available:true,route:'official-portal',liveVerified:false}};}
function requireConnection(){return true;}
module.exports={capabilities,requireConnection};
