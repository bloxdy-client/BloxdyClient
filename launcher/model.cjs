'use strict';
const ID=/^(?!(?:constructor|prototype)$)[a-z][a-z0-9-]{1,63}$/;
const VERSION=/^\d+(?:\.\d+){1,3}$/;
const CORE={id:'bloxd-mod-host',version:'0.1.0',builtin:true};
const RENDERERS=process.platform==='linux'?['standard']:['standard','native-preview'];
function clone(value){return JSON.parse(JSON.stringify(value));}
function compare(a,b){if(!VERSION.test(a)||!VERSION.test(b))throw Error('Invalid version number.');const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<4;++i){const d=(x[i]||0)-(y[i]||0);if(d)return Math.sign(d);}return 0;}
function satisfies(version,range){const match=/^(>=|<=|>|<|=)?(\d+(?:\.\d+){1,3})$/.exec(range);if(!match)throw Error('Unsupported version requirement.');const d=compare(version,match[2]);return ({'>=':d>=0,'<=':d<=0,'>':d>0,'<':d<0,'=':d===0})[match[1]||'='];}
function validateManifest(m){
  if(!m||!ID.test(m.id)||!VERSION.test(m.version)||typeof m.name!=='string'||m.name.length>100)throw Error('Invalid mod manifest.');
  if(m.kind!=='bloxd-mod'||!Array.isArray(m.scripts)||m.scripts.length>40)throw Error('This package is not a supported Bloxd mod.');
  for(const s of m.scripts)if(!['MAIN','ISOLATED'].includes(s.world)||!Array.isArray(s.js)||!Array.isArray(s.css))throw Error('Invalid mod scripts.');
  for(const d of m.requires||[]){if(!ID.test(d.id))throw Error('Invalid mod dependency.');satisfies('0.1.0',d.version);}
  if((m.conflicts||[]).some(id=>!ID.test(id)))throw Error('Invalid conflict list.');
  return m;
}
function validateProfile(p){
  if(!p||!ID.test(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>60||!RENDERERS.includes(p.renderer)||!Array.isArray(p.enabledMods)||p.enabledMods.length>40||p.enabledMods.some(id=>!ID.test(id)))throw Error('Invalid profile.');
  if(new Set(p.enabledMods).size!==p.enabledMods.length)throw Error('A mod is enabled more than once.');
  if(!['economy','balanced','quality'].includes(p.performance))throw Error('Invalid performance preset.');
  if(!Number.isInteger(p.ramGB)||p.ramGB<1||p.ramGB>32)throw Error('The memory budget must be between 1 and 32 GB.');
  if(p.icon!==undefined&&(typeof p.icon!=='string'||! /^[a-z]{2,20}$/.test(p.icon)))throw Error('Invalid profile icon.');
  if(p.iconColor!==undefined&&(typeof p.iconColor!=='string'||!/^#[0-9a-f]{6}$/i.test(p.iconColor)))throw Error('Invalid profile icon color.');
  return clone(p);
}
function plan(profile,installed){
  validateProfile(profile);const index=new Map([[CORE.id,CORE],...installed.map(m=>[m.id,m])]),done=new Set(),visiting=new Set(),ordered=[],errors=[];
  function visit(id){if(done.has(id))return;if(visiting.has(id)){errors.push(`Dependency cycle at ${id}.`);return;}const m=index.get(id);if(!m){errors.push(`${id} is not installed.`);return;}visiting.add(id);
    for(const d of m.requires||[]){const dep=index.get(d.id);if(!dep||!satisfies(dep.version,d.version))errors.push(`${m.name} requires ${d.id} ${d.version}.`);else visit(d.id);}
    if(profile.renderer==='native-preview'&&(m.conflicts||[]).includes('native-preview'))errors.push(`${m.name} does not support native preview yet.`);
    visiting.delete(id);done.add(id);if(!m.builtin)ordered.push(m);
  }
  for(const id of profile.enabledMods)visit(id);
  for(const m of ordered)for(const other of ordered)if((m.conflicts||[]).includes(other.id))errors.push(`${m.name} conflicts with ${other.name}.`);
  return {ok:errors.length===0,errors:[...new Set(errors)],modules:ordered};
}
function defaultSettings(){return {defaultMemoryGB:4,theme:'black',startWithDevice:false,minimizeOnPlay:false};}
function validateSettings(value){const s={...defaultSettings(),...value};if(!Number.isInteger(s.defaultMemoryGB)||s.defaultMemoryGB<1||s.defaultMemoryGB>32||!['white','gray','black'].includes(s.theme)||typeof s.startWithDevice!=='boolean'||typeof s.minimizeOnPlay!=='boolean')throw Error('Invalid launcher settings.');return {defaultMemoryGB:s.defaultMemoryGB,theme:s.theme,startWithDevice:s.startWithDevice,minimizeOnPlay:s.minimizeOnPlay};}
function defaultState(){return {schema:3,selectedAccount:'account-existing',accounts:[{id:'account-existing',label:'Existing Bloxd session',provider:null,legacySession:true,loggedIn:false,username:'',cosmetics:{},selectedProfile:'balanced'}],settings:defaultSettings(),selected:'balanced',profiles:[
  {id:'economy',name:'Low Memory',performance:'economy',renderer:'standard',enabledMods:[],ramGB:2},
  {id:'balanced',name:'Balanced',performance:'balanced',renderer:'standard',enabledMods:[],ramGB:4},
  {id:'quality',name:'Quality',performance:'quality',renderer:'standard',enabledMods:[],ramGB:8}
].map(p=>({...p,accountId:'account-existing',texture:'default2'})),installed:[],packs:[],moduleStorage:{},benchmarks:[]};}
module.exports={ID,VERSION,CORE,RENDERERS,clone,compare,satisfies,validateManifest,validateProfile,plan,defaultState,defaultSettings,validateSettings};
