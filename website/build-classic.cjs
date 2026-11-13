'use strict';
const fs=require('node:fs'),path=require('node:path');
const log=JSON.parse(fs.readFileSync(path.join(__dirname,'dev-log.json'),'utf8'));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
function entry(item){return `<article class="entry"><div class="entry-meta"><time datetime="${escape(item.date)}">${date(item.date)}</time>${item.version?`<span>${escape(item.version)}</span>`:''}</div><h3>${escape(item.title)}</h3>${item.note?`<p class="note">${escape(item.note)}</p>`:''}<ul>${item.items.map(text=>`<li>${escape(text)}</li>`).join('')}</ul></article>`;}
function section(key,title){
  const latest=log[key].filter(item=>!item.historical).slice(0,2),earlier=log[key].filter(item=>!latest.includes(item));
  return `<section id="${key}" aria-labelledby="${key}-heading"><h2 id="${key}-heading">${title}</h2>${latest.map(entry).join('')}${earlier.length?`<details><summary>Earlier ${key==='fixed'?'fixes':'additions'}</summary>${earlier.map(entry).join('')}</details>`:''}</section>`;
}
const screenshot=(name,alt)=>{const bytes=fs.readFileSync(path.join(__dirname,'assets',name));return `<img class="install-image" ${name==='downloads.png'?'style="width:100%;aspect-ratio:664/34;object-fit:cover"':''} src="data:image/png;base64,${bytes.toString('base64')}" width="${bytes.readUInt32BE(16)}" height="${bytes.readUInt32BE(20)}" alt="${escape(alt)}" loading="lazy">`;};
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Download Bloxdy Client. Fixes, new features, and known bugs."><meta name="theme-color" content="#101216"><title>Bloxdy Client</title><style>
:root{color-scheme:dark;--bg:#101216;--text:#f7f8fa;--muted:#a7afbd;--line:#2b3039}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;line-height:1.65}
main{max-width:840px;padding:0 24px 96px;margin:auto}.hero{text-align:center;padding:80px 0 12px}
h1{font-size:clamp(2.8rem,8vw,4.5rem);line-height:1.1;letter-spacing:-.05em;margin:0 0 28px}
.download{display:inline-block;padding:13px 28px;background:#fff;color:#101216;border-radius:7px;text-decoration:none;font-weight:700}.download:hover{background:#dce5ff}
.release{margin:13px 0 0;color:var(--muted);font-size:.85rem}
section{margin-top:88px;padding-top:28px;border-top:1px solid var(--line)}h2{font-size:clamp(2.2rem,5vw,2.8rem);line-height:1.2;letter-spacing:-.03em;margin:0 0 32px}
.entry{margin-top:28px}.entry-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:.78rem;color:var(--muted)}h3{font-size:1.05rem;font-weight:650;margin:5px 0 8px}
ul{margin:0;padding-left:20px}li{margin:5px 0;color:#d7dce5;font-size:.95rem}.note{font-size:.82rem;color:var(--muted);margin:5px 0 10px}
details{margin-top:28px}summary{cursor:pointer;color:var(--muted);font-size:.9rem;width:fit-content}summary:hover{color:var(--text)}
a:focus-visible,summary:focus-visible{outline:3px solid #84aaff;outline-offset:4px}
@media(max-width:560px){main{padding:0 20px 72px}.hero{padding-top:56px}section{margin-top:72px;padding-top:24px}h2{margin-bottom:26px}}
.hero{position:relative}.hero:before{content:'';position:absolute;inset:0 -24px -30px;background:radial-gradient(ellipse at top,#86a7ff12,transparent 70%);pointer-events:none}.download{position:relative;box-shadow:0 4px 20px #0003;transition:background .15s,transform .15s}.download:hover{transform:translateY(-2px)}.install-note{color:#d8b870;border-left:2px solid #d8b870;padding-left:12px;font-size:.9rem;margin-bottom:28px}.install-steps{list-style:none;padding:0;counter-reset:steps}.install-steps>li{counter-increment:steps;position:relative;padding:0 0 28px 42px;margin:0 0 24px;border-bottom:1px solid var(--line)}.install-steps>li:before{content:counter(steps);position:absolute;left:0;top:0;width:27px;height:27px;display:grid;place-items:center;border:1px solid #47516b;border-radius:50%;color:#b7caff;font-size:.8rem}.install-steps h3{margin-top:0}.install-steps p{margin:8px 0;font-size:.9rem;color:var(--muted)}.install-steps a{color:#b7caff}.install-download{display:inline-block;padding:8px 14px;border:1px solid #47516b;border-radius:6px;text-decoration:none}.install-download:hover{background:#86a7ff12}.install-image{display:block;max-width:100%;width:auto;height:auto;margin-top:18px;border-radius:8px;border:1px solid var(--line)}html{scroll-behavior:smooth;scroll-padding-top:20px}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.download{transition:none}}
</style></head><body><main>
<header class="hero" id="download"><h1>Bloxdy Client</h1><a class="download" href="${escape(log.release.url)}" download="${escape(log.release.file)}">Download</a><p class="release">Windows x64 · ${escape(log.release.version)}</p></header>
${section('fixed','Fixed')}${section('added','Added')}
<section id="bugs" aria-labelledby="bugs-heading"><h2 id="bugs-heading">Bugs</h2>${log.bugs.map(entry).join('')}</section>
<section id="how-to-install" aria-labelledby="install-heading"><h2 id="install-heading">How to install</h2><p class="install-note">Windows only. Install once; future updates download automatically and install when you close the launcher.</p><ol class="install-steps"><li><h3>Download the file</h3><a class="install-download" href="#download">Go to download ↑</a></li><li><h3>Open your Downloads folder</h3><p>Open File Explorer and select Downloads.</p></li><li><h3>Double-click the downloaded file</h3>${screenshot('downloads.png','The Bloxdy Client installer in File Explorer')}</li><li><h3>If Windows SmartScreen appears</h3><p>For the file downloaded from this website, click <strong>More info</strong>, then <strong>Run anyway</strong>.</p>${screenshot('smartscreen-pair.png','Two equally sized SmartScreen views: More info and Run anyway circled in red')}</li><li><h3>Click Install</h3><p>In the Bloxdy Client installer, click <strong>Install</strong>.</p>${screenshot('install.png','Bloxdy Client installer with the Install button')}</li></ol></section>
</main></body></html>`;
fs.mkdirSync(path.join(__dirname,'dist'),{recursive:true});fs.writeFileSync(path.join(__dirname,'dist/index.html'),html);
console.log('Built download page for '+log.release.version);
