let account=null,properties=[],businessId='';
const permissionLabels={register_cameras:'Register and edit cameras',inspect:'Submit camera and DVR inspections',observations:'Add observations',manage_actions:'Create and update action points',manage_properties:'Manage business name and properties',view_reports:'View full reports, remarks and history',manage_incidents:'Record and review incidents'};
const can=p=>account?.role==='super_admin'||account?.permissions?.includes(p);
const permissionForKind={register:'register_cameras',camera:'inspect',recorder:'inspect',round:'inspect',note:'observations',action:'manage_actions',incident:'manage_incidents'};
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
function authField(label,name,type='text',current=false){
  const input = '<input name="'+name+'" type="'+type+'" required '+(type==='password'?(current?'autocomplete="current-password"':'minlength="10" autocomplete="new-password"'):'')+'>';
  if(type!=='password')return '<label>'+label+input+'</label>';
  return '<div class="password-field"><label>'+label+input+'</label><button type="button" data-password-toggle aria-label="Show password" aria-pressed="false">'+icon('eye')+'</button></div>';
}
document.addEventListener('click',event=>{
  const toggle=event.target.closest('[data-password-toggle]');
  if(!toggle)return;
  const input=toggle.parentElement.querySelector('input');
  const show=input.type==='password';
  input.type=show?'text':'password';
  toggle.setAttribute('aria-label',show?'Hide password':'Show password');
  toggle.setAttribute('aria-pressed',String(show));
  toggle.innerHTML=icon(show?'eyeOff':'eye');
});
function showAuth(mode='login',message=''){
  document.querySelector('.layout').hidden=true;byId('businessBar').innerHTML='';document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  const screen=byId('accountScreen');screen.hidden=false;
  const title={login:'Sign in',signup:'Create your account',verify:'Verify your email',recover:'Reset your password',recovery:'Enter your recovery code'}[mode];
  screen.innerHTML='<h2>'+title+'</h2><p>Manage your CCTV properties with Xposure Hub.</p><form id="authForm" class="fields">'+authField('Email address','email','email')+(['login','signup'].includes(mode)?authField('Password','password','password',mode==='login'):'')+(['verify','recovery'].includes(mode)?authField('Email verification code','token'):'')+'<button class="primary wide">'+title+'</button></form><p role="status" id="authMessage">'+safe(message)+'</p><div class="buttons"><button type="button" data-auth="login">Sign in</button><button type="button" data-auth="signup">Register</button><button type="button" data-auth="recover">Forgot password</button></div>';
  screen.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>showAuth(b.dataset.auth));
  byId('authForm').onsubmit=async event=>{
    event.preventDefault();const button=event.target.querySelector('button.primary');button.disabled=true;
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
    if(account.platform_owner){businessId=account.business_id||'';await showOwnerConsole();if(fragment.get('type')==='recovery')showSettings('password');return}
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
  data=[];page='overview';Object.keys(filter).forEach(k=>filter[k]='');filter.date=day();
  const r=await apiFetch('/api/properties');if(!r.ok)throw Error(await r.text());properties=await r.json();
  const catalog=await apiFetch('/api/recorders');if(!catalog.ok)throw Error(await catalog.text());recorders=await catalog.json();
  byId('accountScreen').hidden=true;document.querySelector('.layout').hidden=false;
  const business=account.businesses.find(b=>b.id===businessId);
  document.querySelector('.workspace').textContent=business.name;
  document.querySelector('.kicker').textContent=business.name;
  document.querySelector('.secure').textContent=account.role.replace('_',' ');
  byId('businessBar').innerHTML='<div class="account-bar"><span>'+safe(account.email)+'</span>'+(account.platform_owner?'<button id="ownerButton">Owner Console</button>':'')+(hasDateRequests()?'<button id="dateRequestsButton">Date permissions</button>':'')+'<button id="recordersButton">DVR/NVR register</button><button id="settingsButton">Settings</button><button id="logoutButton">Sign out</button></div>';
  if(byId('ownerButton'))byId('ownerButton').onclick=()=>showOwnerConsole();
  if(byId('dateRequestsButton'))byId('dateRequestsButton').onclick=()=>showDateRequests();
  byId('recordersButton').onclick=()=>showRecorderRegister(filter.school);
  byId('settingsButton').onclick=()=>showSettings();
  byId('logoutButton').onclick=async()=>{await send('/api/auth/logout',{});account=null;data=[];showAuth()};
  await loadDateRequests();
  await refresh();
}
function settingsDialog(title,content){
  const d=document.createElement('dialog');d.innerHTML='<div class="dialogHead"><h2>'+title+'</h2><button type="button" data-close>×</button></div>'+content+'<p class="settingsError" role="status"></p>';
  document.body.append(d);d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.showModal();return d;
}
function showSettings(mode){
  if(!mode){
    const d=settingsDialog('Settings','<p>Manage your account and '+safe(account.businesses[0].name)+'.</p><div class="settings-menu">'+(account.role==='super_admin'?'<button data-setting="users">Users & permissions</button>':'')+(can('manage_properties')?'<button data-setting="properties">Business & properties</button>':'')+'<button data-setting="password">Change password</button></div>');
    d.querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>{d.close();b.dataset.setting==='users'?showUsers():showSettings(b.dataset.setting)});return;
  }
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
function accessControls(user={role:'technician',permissions:Object.keys(permissionLabels),active:1}){
  return '<label>Role<select name="role"><option value="technician" '+(user.role==='technician'?'selected':'')+'>Technician</option><option value="viewer" '+(user.role==='viewer'?'selected':'')+'>Viewer</option></select></label><fieldset><legend>Permissions</legend><p>All users can view camera status. Choose additional access below.</p>'+Object.entries(permissionLabels).map(([key,label])=>'<label class="permission-option"><input type="checkbox" name="permissions" value="'+key+'" '+(user.permissions.includes(key)?'checked':'')+'>'+label+'</label>').join('')+'</fieldset><label>Account status<select name="active"><option value="1" '+(user.active?'selected':'')+'>Active</option><option value="0" '+(!user.active?'selected':'')+'>Suspended</option></select></label>';
}
async function showUsers(){
  try{
    const response=await apiFetch('/api/admin/users');if(!response.ok)throw Error(await response.text());const users=await response.json();
    const d=settingsDialog('Users & permissions','<p>You manage users only within '+safe(account.businesses[0].name)+'. Your business owner retains Super Admin access.</p><section><h3>Add user</h3><p>Enter their email and choose access. Share this site address with them. They must register and verify that same email, or sign in if already registered. No invitation email is sent.</p><form id="addUserForm">'+authField('User email','email','email')+accessControls()+'<button class="primary">Add user</button></form></section><hr><h3>Your team</h3>'+users.map(u=>'<form class="userForm" data-id="'+safe(u.id||'')+'" data-email="'+safe(u.email)+'"><strong>'+safe(u.email)+'</strong>'+(u.role==='super_admin'?'<p>Super Admin · Business owner</p>':'<p>'+(u.pending?'Pending registration / sign-in':'Registered')+'</p>'+accessControls(u)+'<button>Save permissions</button>')+'</form>').join(''));
    d.querySelectorAll('form').forEach(f=>{
      const role=f.querySelector('[name="role"]');if(!role)return;
      role.onchange=()=>f.querySelectorAll('[name="permissions"]').forEach(c=>c.checked=role.value==='technician');
      f.onsubmit=async e=>{
        e.preventDefault();const button=f.querySelector('button');button.disabled=true;
        try{const values=new FormData(f);const body={role:values.get('role'),permissions:values.getAll('permissions'),active:Number(values.get('active'))};
          if(f.dataset.id)body.id=f.dataset.id;else body.email=values.get('email')||f.dataset.email;
          await send('/api/admin/users',body);d.close();await showUsers();
        }catch(error){d.querySelector('.settingsError').textContent=error.message}finally{button.disabled=false}
      };
    });
  }catch(error){byId('notice').textContent=error.message}
}

let dateRequests=[];
function hasDateRequests(){
  return account?.role==='super_admin'||(account?.role==='technician'&&['inspect','observations','manage_actions','manage_incidents'].some(can));
}
async function loadDateRequests(){
  dateRequests=[];
  if(!hasDateRequests())return;
  const response=await apiFetch('/api/date-requests');
  if(!response.ok)throw Error(await response.text());
  dateRequests=await response.json();
}
async function showDateRequests(selectedDate=''){
  const admin=account.role==='super_admin';
  const d=settingsDialog('Date permissions','<div class="date-requests"></div>');
  const content=d.querySelector('.date-requests');
  const error=d.querySelector('.settingsError');
  function paint(){
    content.innerHTML=(admin?'':'<p>You can save inspections for today and the previous three days. For an older date, send a request to your administrator.</p><form><label>Inspection date<input name="date" type="date" max="'+day(-4)+'" value="'+safe(selectedDate)+'" required></label><label>Reason<textarea name="reason" maxlength="1000" required></textarea></label><button class="primary">Request permission</button></form>')+
      '<h3>'+ (admin?'Team requests':'Your requests')+'</h3>'+ (dateRequests.length?dateRequests.map((r,index)=>'<article class="date-request"><strong>'+safe(r.inspection_date)+(admin?' · '+safe(r.email):'')+'</strong><p>'+safe(r.reason)+'</p><p>Status: '+safe(r.status)+'</p>'+(admin&&r.status==='pending'?'<div class="buttons"><button data-index="'+index+'" data-decision="approved">Approve</button><button data-index="'+index+'" data-decision="denied">Deny</button></div>':'')+'</article>').join(''):'<p>No date permission requests.</p>');
    const form=content.querySelector('form');
    if(form)form.onsubmit=event=>{
      event.preventDefault();
      save(Object.fromEntries(new FormData(form)));
    };
    content.querySelectorAll('[data-decision]').forEach(button=>button.onclick=()=>{
      const row=dateRequests[Number(button.dataset.index)];
      save({date:row.inspection_date,userId:row.user_id,decision:button.dataset.decision});
    });
  }
  async function save(body){
    error.textContent='';
    content.querySelectorAll('button').forEach(button=>button.disabled=true);
    try{
      await send('/api/date-requests',body);
      selectedDate='';
      await loadDateRequests();
      paint();
      if(byId('modal').open)updateDateControls();
      error.textContent=admin?'Decision saved.':'Request sent to your administrator.';
    }catch(err){
      error.textContent=err.message;
      content.querySelectorAll('button').forEach(button=>button.disabled=false);
    }
  }
  try{await loadDateRequests();paint()}catch(err){error.textContent=err.message}
}

function canRegisterRecorder(){
  return can('manage_properties')||can('register_cameras');
}
function showRecorderRegister(school='',onSaved){
  const property=properties.find(p=>p.name===school);
  const list=properties.map(p=>{
    const devices=recordersFor(p.name);
    return '<section class="date-request"><strong>'+safe(p.name)+'</strong><p>'+
      (devices.length?devices.map(d=>safe(d.name)+' ('+safe(d.type)+')').join(' · '):'No DVR/NVR registered.')+'</p></section>';
  }).join('');
  const propertyOptions='<option value="">Select…</option>'+properties.map(p=>
    '<option value="'+safe(p.id)+'" '+(p.id===property?.id?'selected':'')+'>'+safe(p.name)+'</option>').join('');
  const form=canRegisterRecorder()&&properties.length
    ?'<form><label>Property<select name="property_id" required>'+propertyOptions+'</select></label><label>Recorder name<input name="name" maxlength="200" required placeholder="e.g. Main entrance NVR"></label><label>Type<select name="type"><option>DVR</option><option>NVR</option></select></label><button class="primary">Register DVR/NVR</button></form>'
    :'';
  const message=properties.length?'':'<p>Add a property in <strong>Settings → Business & properties</strong> before registering a recorder.</p>';
  const d=settingsDialog('DVR/NVR register',message+form+list);
  const registration=d.querySelector('form');
  if(!registration)return;
  const select=registration.elements.property_id;
  if(property&&onSaved)select.disabled=true;
  registration.onsubmit=async event=>{
    event.preventDefault();
    const button=registration.querySelector('button');
    button.disabled=true;
    try{
      const values=Object.fromEntries(new FormData(registration));
      values.property_id=select.value;
      const device=await send('/api/recorders',values);
      recorders.push(device);
      d.close();
      render();
      if(onSaved)onSaved(device);
      else showRecorderRegister(device.school);
    }catch(error){
      d.querySelector('.settingsError').textContent=error.message;
      button.disabled=false;
    }
  };
}
