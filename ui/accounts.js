let account=null,properties=[],businessId='';
const byId=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function apiFetch(url,options={}){
  const response=await fetch(url,{...options,headers:{...options.headers,'X-Business-ID':businessId}});
  if(response.status===401){showAuth();throw Error('Please sign in again.')}
  return response;
}
async function send(url,body){
  const r=await apiFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw Error(await r.text());
  return r.json();
}
function authField(label,name,type='text'){
  return '<label>'+label+'<input name="'+name+'" type="'+type+'" required '+(type==='password'?'minlength="10" autocomplete="new-password"':'')+'></label>';
}
function showAuth(mode='login',message=''){
  document.querySelector('.layout').hidden=true;byId('businessBar').innerHTML='';document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  const screen=byId('accountScreen');screen.hidden=false;
  const title={login:'Sign in',signup:'Create your account',verify:'Verify your email',recover:'Reset your password',recovery:'Enter your recovery code'}[mode];
  screen.innerHTML='<h2>'+title+'</h2><p>Manage your CCTV properties with Xposure Hub.</p><form id="authForm" class="fields">'+authField('Email address','email','email')+(['login','signup'].includes(mode)?authField('Password','password','password'):'')+(['verify','recovery'].includes(mode)?authField('Email verification code','token'):'')+'<button class="primary wide">'+title+'</button></form><p role="status" id="authMessage">'+safe(message)+'</p><div class="buttons"><button type="button" data-auth="login">Sign in</button><button type="button" data-auth="signup">Register</button><button type="button" data-auth="recover">Forgot password</button></div>';
  screen.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>showAuth(b.dataset.auth));
  byId('authForm').onsubmit=async event=>{
    event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
    const body=Object.fromEntries(new FormData(event.target));
    try{
      const action=mode==='recovery'?'verify':mode;
      if(mode==='recovery')body.type='recovery';
      await send('/api/auth/'+action,body);
      if(['login','verify','recovery'].includes(mode)){await startAccount();if(mode==='recovery')showSettings('password');}
      else {showAuth(mode==='signup'?'verify':'recovery','Check your email for the verification link or code. You can sign in after confirming your email.');byId('authForm').elements.email.value=body.email;}
    }catch(error){byId('authMessage').textContent=error.message}finally{button.disabled=false}
  };
}
async function startAccount(){
  try{
    const fragment=new URLSearchParams(location.hash.slice(1));
    if(fragment.has('access_token')){
      history.replaceState(null,'',location.pathname);
      await send('/api/auth/session',{access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token')});
      
    }

    const r=await fetch('/api/me',{cache:'no-store'});
    if(r.status===401){showAuth();return}
    if(!r.ok)throw Error(await r.text());
    account=await r.json();
    if(!account.business_id){showOnboarding();return}
    if(!account.businesses.some(b=>b.id===businessId))businessId=account.business_id;
    await loadBusiness();
    if(fragment.get('type')==='recovery')showSettings('password');
  }catch(error){showAuth('login',error.message)}
}
function showOnboarding(){
  document.querySelector('.layout').hidden=true;
  const screen=byId('accountScreen');screen.hidden=false;
  screen.innerHTML='<h2>Name your business</h2><p>Your business name will appear on your dashboard.</p><form id="onboard">'+authField('Business name','name')+'<button class="primary">Create dashboard</button></form><p id="onboardError"></p>';
  byId('onboard').onsubmit=async e=>{e.preventDefault();try{await send('/api/onboard',Object.fromEntries(new FormData(e.target)));await startAccount()}catch(error){byId('onboardError').textContent=error.message}};
}
async function loadBusiness(){
  data=[];page='overview';Object.keys(filter).forEach(k=>filter[k]='');
  const r=await apiFetch('/api/properties');if(!r.ok)throw Error(await r.text());properties=await r.json();
  byId('accountScreen').hidden=true;document.querySelector('.layout').hidden=false;
  const business=account.businesses.find(b=>b.id===businessId);
  document.querySelector('.workspace').textContent=business.name;
  document.querySelector('.kicker').textContent=business.name;
  document.querySelector('.secure').textContent=account.role.replace('_',' ');
  byId('businessBar').innerHTML='<div class="account-bar"><span>'+safe(account.email)+'</span>'+(account.role==='super_admin'?'<select id="businessSelect" aria-label="Business">'+account.businesses.map(b=>'<option value="'+safe(b.id)+'" '+(b.id===businessId?'selected':'')+'>'+safe(b.name)+'</option>').join('')+'</select><button id="usersButton">Manage users</button>':'')+(account.role!=='viewer'?'<button id="propertiesButton">Properties & business</button>':'')+'<button id="passwordButton">Change password</button><button id="logoutButton">Sign out</button></div>';
  if(byId('businessSelect'))byId('businessSelect').onchange=async e=>{businessId=e.target.value;Object.keys(filter).forEach(k=>filter[k]='');try{await loadBusiness()}catch(error){byId('notice').textContent=error.message}};
  if(byId('propertiesButton'))byId('propertiesButton').onclick=()=>showSettings();
  if(byId('usersButton'))byId('usersButton').onclick=showUsers;
  byId('passwordButton').onclick=()=>showSettings('password');
  byId('logoutButton').onclick=async()=>{await send('/api/auth/logout',{});account=null;data=[];showAuth()};
  await refresh();
}
function settingsDialog(title,content){
  const d=document.createElement('dialog');d.innerHTML='<div class="dialogHead"><h2>'+title+'</h2><button type="button" data-close>×</button></div>'+content+'<p class="settingsError" role="status"></p>';
  document.body.append(d);d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.showModal();return d;
}
function showSettings(mode){
  if(mode==='password'){
    const d=settingsDialog('Change password','<form>'+authField('New password','password','password')+'<button class="primary">Save password</button></form>');
    d.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await send('/api/password',Object.fromEntries(new FormData(e.target)));d.close()}catch(error){d.querySelector('.settingsError').textContent=error.message}};return;
  }
  const b=account.businesses.find(b=>b.id===businessId);
  const d=settingsDialog('Properties & business','<form id="businessNameForm">'+authField('Business name','name')+'<button>Save business name</button></form><hr><h3>Locations</h3>'+properties.map(p=>'<p>'+safe(p.name)+' · '+safe(p.type)+'</p>').join('')+'<form id="propertyForm">'+authField('Location name','name')+'<label>Property type<select name="type">'+['Apartment','School','Estate','Store','Office','Other'].map(t=>'<option>'+t+'</option>').join('')+'</select></label><button class="primary">Add property</button></form>');
  d.querySelector('#businessNameForm').elements.name.value=b.name;
  for(const [form,url] of [['businessNameForm','/api/business'],['propertyForm','/api/properties']]){
    d.querySelector('#'+form).onsubmit=async e=>{e.preventDefault();try{await send(url,Object.fromEntries(new FormData(e.target)));d.close();await startAccount()}catch(error){d.querySelector('.settingsError').textContent=error.message}};
  }
}
async function showUsers(){
  try{
    const response=await apiFetch('/api/admin/users');if(!response.ok)throw Error(await response.text());const users=await response.json();
    const d=settingsDialog('Manage registered users','<p>Accounts shown here have verified their email and signed in. Assign each person to a business and role.</p>'+users.map(u=>'<form class="userForm" data-id="'+safe(u.id)+'"><strong>'+safe(u.email)+'</strong>'+(u.role==='super_admin'?'<p>Super Admin</p>':'<label>Business<select name="business_id">'+account.businesses.map(b=>'<option value="'+safe(b.id)+'" '+(b.id===u.business_id?'selected':'')+'>'+safe(b.name)+'</option>').join('')+'</select></label><label>Role<select name="role"><option '+(u.role==='viewer'?'selected':'')+' value="viewer">Viewer</option><option '+(u.role==='technician'?'selected':'')+' value="technician">Technician</option></select></label><label>Account status<select name="active"><option value="1" '+(u.active?'selected':'')+'>Active</option><option value="0" '+(!u.active?'selected':'')+'>Suspended</option></select></label><button>Save access</button>')+'</form>').join(''));
    d.querySelectorAll('.userForm').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{let body=Object.fromEntries(new FormData(f));body.id=f.dataset.id;body.active=Number(body.active);await send('/api/admin/users',body);d.querySelector('.settingsError').textContent='Access updated.'}catch(error){d.querySelector('.settingsError').textContent=error.message}});
  }catch(error){byId('notice').textContent=error.message}
}
