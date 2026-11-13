'use strict';
const toggle=document.querySelector('.menu-toggle'),nav=document.getElementById('navigation');toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}});
const search=document.getElementById('version-search'),rows=[...document.querySelectorAll('[data-version]')],count=document.getElementById('version-count');function filter(){let n=0;for(const row of rows){row.hidden=!row.dataset.version.includes(search.value.trim());if(!row.hidden)n++;}count.textContent=n+' versions';document.getElementById('no-versions').hidden=n!==0;}if(search){search.addEventListener('input',filter);filter();}
const form=document.getElementById('support-form'),result=document.getElementById('support-result');
if(form)form.addEventListener('submit',async e=>{
 e.preventDefault();if(!form.reportValidity())return;
 const button=form.querySelector('button');button.disabled=true;result.className='';result.textContent='Sending…';
 try{
  const data=Object.fromEntries(new FormData(form));
  if(data.website)throw Error('Your request could not be sent.');
  const response=await fetch('https://api.web3forms.com/submit',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({access_key:'68c38ffc-847b-4202-a1ae-e43e1ca09784',email:data.email,topic:data.topic,message:data.message,subject:'Bloxdy Client support: '+data.topic,from_name:'Bloxdy Client Support',botcheck:false})});
  const delivery=await response.json();
  if(!response.ok||delivery.success!==true)throw Error(response.status===429?'Please wait before sending another request.':'Your request could not be sent. Please try again.');
  result.className='form-success';result.textContent='Request sent. Thank you — we’ll reply to your email.';form.reset();
 }catch(error){result.className='form-error';result.textContent=error instanceof TypeError?'Connection failed. Please check your connection and try again.':error.message;}finally{button.disabled=false;}
});
