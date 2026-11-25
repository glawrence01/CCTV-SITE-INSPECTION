let ownerStatus='all';
let ownerTab='summary',ownerQuery='',ownerRows=[],ownerBusinesses=[];
const ownerTabs={summary:'Overview',businesses:'Businesses',users:'Users',pending:'Pending users',invoices:'Billing',support:'Support cases',email:'Email issues',audit:'Audit history'};
async function ownerGet(path){const r=await apiFetch('/api/owner/'+path);if(!r.ok)throw Error(await r.text());return r.json()}
const money=(minor,currency)=>new Intl.NumberFormat('en-NG',{style:'currency',currency}).format(minor/100);
async function showOwnerConsole(){
 if(!account?.platform_owner)return;
 document.querySelector('.layout').hidden=true;byId('accountScreen').hidden=false;
 byId('accountScreen').style.maxWidth='1200px';
 byId('businessBar').innerHTML='<div class="account-bar"><strong>Software Owner Console</strong><span>'+safe(account.email)+'</span>'+(account.business_id?'<button id="ownerBack">My business dashboard</button>':'')+'<button id="ownerPassword">Change password</button><button id="ownerLogout">Sign out</button></div>';
 if(byId('ownerBack'))byId('ownerBack').onclick=async()=>{byId('accountScreen').style.maxWidth='520px';try{await loadBusiness()}catch(e){await showOwnerConsole();byId('ownerError').textContent=e.message}};
 byId('ownerPassword').onclick=()=>showSettings('password');
 byId('ownerLogout').onclick=async()=>{await send('/api/auth/logout',{});account=null;byId('accountScreen').style.maxWidth='520px';showAuth()};
 byId('accountScreen').innerHTML='<h2>Platform administration</h2><p>Manage customer accounts, billing records and support. CCTV reports and incident details stay within each business.</p><div class="owner-tabs">'+Object.entries(ownerTabs).map(([key,label])=>'<button data-owner-tab="'+key+'" class="'+(key===ownerTab?'primary':'')+'">'+label+'</button>').join('')+'</div><div id="ownerBody">Loading…</div><p id="ownerError" role="status"></p>';
 document.querySelectorAll('[data-owner-tab]').forEach(b=>b.onclick=()=>{ownerTab=b.dataset.ownerTab;ownerQuery='';showOwnerConsole()});
 try{
  if(ownerTab==='summary'){
   const r=await ownerGet('summary');
   byId('ownerBody').innerHTML='<div class="cards">'+Object.entries(r.counts).map(([k,v])=>'<div class="card"><b>'+v+'</b><label>'+safe({businesses:'Businesses',accounts:'Registered app users',access_invites:'Pending team users',support_cases:'Support cases',deleted_accounts:'Deleted accounts',suspended_accounts:'Suspended accounts'}[k])+'</label></div>').join('')+'</div><h3>Outstanding invoices</h3>'+(r.unpaid.length?r.unpaid.map(x=>'<p>'+safe(money(x.amount_minor,x.currency))+' · '+x.count+' unpaid invoice(s)</p>').join(''):'<p>No unpaid invoices recorded.</p>')+'<p>'+safe(r.billing_mode)+'.</p><p>'+safe(r.email_status)+'.</p><p>Registered users appear after their first verified sign-in. Unverified signups are visible only as email requests until they sign in.</p>';return;
  }
  const result=await ownerGet(ownerTab+'?q='+encodeURIComponent(ownerQuery)+(ownerTab==='users'?'&status='+ownerStatus:''));ownerRows=result.rows;
  const cols={businesses:['name','users','cameras','suspended','plan','status','renewal'],users:['email','business','role','access','deleted_at'],pending:['email','business','role','active'],invoices:['id','business','description','amount','due','status','payment_reference'],support:['email','business','subject','details','status','resolution','created'],email:['email','action','outcome','created'],audit:['actor','action','target','details','created']}[ownerTab];
  const actions={businesses:'Manage',users:'Manage access',invoices:'Update payment',support:'Update case',email:'Email support'};
  byId('ownerBody').innerHTML='<form id="ownerSearch" class="incident-search"><label>Search '+safe(ownerTabs[ownerTab])+'<input name="query" value="'+safe(ownerQuery)+'"></label>'+(ownerTab==='users'?ownerSelect('Account status','status',['all','active','suspended','deleted'],ownerStatus):'')+'<button>Search</button></form>'+(ownerTab==='invoices'?'<p>Manual billing records. Mark a payment as paid only after checking your bank or payment provider. Nothing is charged automatically.</p><button id="newInvoice" class="primary">Create invoice record</button>':'')+(ownerTab==='support'?'<button id="newSupport" class="primary">Log support case</button>':'')+(ownerTab==='email'?'<p>History begins with this update. “Accepted” does not confirm delivery. Bounces and spam placement are not tracked. Confirmation and reset emails can be requested again below.</p>':'')+'<div class="scroll"><table><thead><tr>'+cols.map(c=>'<th>'+safe(c.replaceAll('_',' '))+'</th>').join('')+(actions[ownerTab]?'<th>Action</th>':'')+'</tr></thead><tbody>'+ownerRows.map((row,i)=>'<tr>'+cols.map(c=>'<td>'+safe(c==='access'?ownerAccessLabel(row):c==='amount'?money(row.amount_minor,row.currency):['suspended','platform_blocked'].includes(c)?(row[c]?'Yes':'No'):c==='active'?(row[c]?'Active':'Suspended'):row[c]??'—')+'</td>').join('')+(actions[ownerTab]?'<td><button data-owner-row="'+i+'">'+actions[ownerTab]+'</button></td>':'')+'</tr>').join('')+'</tbody></table></div>'+(ownerRows.length?'':'<p>No matching records.</p>')+(result.more?'<p>Showing 500 results. Narrow your search for additional records.</p>':'');
  byId('ownerSearch').onsubmit=e=>{e.preventDefault();ownerQuery=e.target.elements.query.value;if(ownerTab==='users')ownerStatus=e.target.elements.status.value;showOwnerConsole()};
  document.querySelectorAll('[data-owner-row]').forEach(b=>b.onclick=()=>ownerEdit(ownerRows[Number(b.dataset.ownerRow)]));
  if(byId('newInvoice'))byId('newInvoice').onclick=()=>ownerCreate('invoice');
  if(byId('newSupport'))byId('newSupport').onclick=()=>ownerCreate('support');
 }catch(e){byId('ownerError').textContent=e.message}
}
function ownerInput(label,name,value='',type='text',required=true){return '<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+safe(value)+'" '+(required?'required':'')+(type==='number'?' min="0.01" step="0.01"':'')+'></label>'}
function ownerSelect(label,name,options,value){return '<label>'+label+'<select name="'+name+'">'+options.map(v=>'<option value="'+safe(v)+'" '+(v===value?'selected':'')+'>'+safe(v)+'</option>').join('')+'</select></label>'}
function ownerForm(title,html,endpoint,extra={},transform=x=>x){
 const d=settingsDialog(title,'<form class="fields">'+html+'<button class="primary">Save changes</button></form>');
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const body=transform({...Object.fromEntries(new FormData(e.target)),...extra});await send('/api/owner/'+endpoint,body);d.close();await showOwnerConsole()}catch(error){d.querySelector('.settingsError').textContent=error.message}finally{button.disabled=false}};return d;
}
function ownerEdit(row){
 if(ownerTab==='businesses'){
  const d=settingsDialog('Manage '+safe(row.name),'<div class="settings-menu"><button id="editSubscription">Plan & subscription</button><button id="editBusinessStatus">'+(row.suspended?'Reactivate business':'Suspend business')+'</button></div>');
  d.querySelector('#editSubscription').onclick=()=>{d.close();ownerForm('Subscription record',ownerInput('Plan name','plan',row.plan||'Free')+ownerSelect('Subscription status','status',['Trial','Active','Past due','Cancelled'],row.status||'Trial')+ownerInput('Renewal date','renewal',row.renewal||'','date',false)+ownerInput('Internal notes','notes',row.notes||'','text',false),'subscription',{business_id:row.id})};
  d.querySelector('#editBusinessStatus').onclick=()=>{d.close();ownerForm(row.suspended?'Reactivate business':'Suspend business','<p>This affects every member’s access to this business. Subscription records alone do not change access.</p>'+ownerInput('Reason','reason'),'business-status',{id:row.id,suspended:row.suspended?0:1})};
 }else if(ownerTab==='users')ownerAccountAccess(row);
 else if(ownerTab==='invoices')ownerForm('Update invoice record','<p>'+safe(row.business)+' · '+safe(money(row.amount_minor,row.currency))+'</p>'+ownerSelect('Status','status',['Unpaid','Paid','Void'],row.status)+ownerInput('Payment reference or reason','reference'),'invoice-status',{id:row.id});
 else if(ownerTab==='support')ownerForm('Update support case',ownerSelect('Status','status',['Open','In progress','Resolved'],row.status)+ownerInput('Update / resolution note','resolution',row.resolution||''),'support-status',{id:row.id});
 else if(ownerTab==='email'){
  const d=settingsDialog('Email support','<p>'+safe(row.email)+'</p><p>Choose the email to send to this address. The recipient sets their own password.</p><button data-email-action="resend">Resend confirmation email</button><button data-email-action="recover">Send password reset email</button>');
  d.querySelectorAll('[data-email-action]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await send('/api/owner/email-send',{email:row.email,action:b.dataset.emailAction});d.querySelector('.settingsError').textContent='Request accepted. Ask the user to check their inbox and spam folder.'}catch(e){d.querySelector('.settingsError').textContent=e.message}finally{b.disabled=false}});
 }
}
function ownerAccessLabel(row){
 if(row.deleted_at)return 'Deleted';
 if(row.platform_blocked)return 'Platform suspended';
 if(!row.active)return 'Business user suspended';
 if(row.business_suspended)return 'Business suspended';
 return 'Active';
}
function ownerAccountAccess(row){
 if(row.email===account.email){
  settingsDialog('Account access','<p>The software-owner account is protected.</p>');
  return;
 }
 const actions=row.deleted_at?{restore:'Restore account'}:{
  ...(row.platform_blocked||!row.active?{activate:'Make account active'}:{suspend:'Suspend account'}),
  delete:'Delete account'
 };
 const dialog=settingsDialog('Account access','<p>'+safe(row.email)+' · '+safe(ownerAccessLabel(row))+'</p>'+
  (row.business_suspended?'<p>This business is suspended. Reactivate it from Businesses to restore workspace access.</p>':'')+
  '<div class="settings-menu">'+Object.entries(actions).map(([key,label])=>'<button type="button" data-access-action="'+key+'">'+label+'</button>').join('')+'</div>');
 const descriptions={
  activate:'This clears both user-level suspensions. Business-wide suspensions are managed separately.',
  suspend:'The user loses app access immediately. You can make the account active again.',
  delete:'This blocks app access and keeps the account’s role, permissions, and history available for restoration.',
  restore:'This restores the previous access status. If the account was suspended before deletion, you can make it active after restoring it.'
 };
 dialog.querySelectorAll('[data-access-action]').forEach(button=>button.onclick=()=>{
  const action=button.dataset.accessAction;
  dialog.close();
  ownerForm(actions[action],'<p class="wide">'+safe(row.email)+' · '+safe(descriptions[action])+'</p>'+ownerInput('Reason','reason'),'user-status',{id:row.id,action});
 });
}
async function ownerCreate(type){
 try{const result=await ownerGet('businesses');ownerBusinesses=result.rows;
 const business='<label>Business<select name="business_id" '+(type==='invoice'?'required':'')+'><option value="">Select business</option>'+ownerBusinesses.map(b=>'<option value="'+safe(b.id)+'">'+safe(b.name)+'</option>').join('')+'</select></label>';
 if(type==='invoice')ownerForm('Create invoice record',business+ownerInput('Description','description')+ownerInput('Amount','amount','','number')+ownerSelect('Currency','currency',['NGN','USD','GBP','EUR'],'NGN')+ownerInput('Due date','due','','date'),'invoice',{},b=>({...b,amount_minor:Math.round(Number(b.amount)*100)}));
 else ownerForm('Log support case',business+ownerInput('Contact email','email','','email')+ownerInput('Subject','subject')+'<label class="wide">Issue details<textarea name="details" maxlength="3000" required></textarea></label>','support');
 }catch(e){byId('ownerError').textContent=e.message}
}
