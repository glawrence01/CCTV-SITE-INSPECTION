function isPlatformOwner(user,env){return !!env.PLATFORM_OWNER_EMAIL&&user.email===env.PLATFORM_OWNER_EMAIL.trim().toLowerCase()}
function auditStatement(env,user,action,target,details){return env.DB.prepare('INSERT INTO admin_audit(id,actor,action,target,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.email,action,target,JSON.stringify(details))}
async function ownerRoutes(req,env,user,url){
 if(!isPlatformOwner(user,env))return reply('Software-owner access required.',403);
 const endpoint=url.pathname.slice('/api/owner/'.length);
 if(req.method==='GET'){
  const search=(url.searchParams.get('q')||'').slice(0,200),pattern='%'+search+'%';
  if(endpoint==='summary'){
   const counts={};for(const table of ['businesses','accounts','access_invites','support_cases'])counts[table]=(await env.DB.prepare('SELECT count(*) AS n FROM '+table).first()).n;
   const unpaid=(await env.DB.prepare("SELECT currency,sum(amount_minor) AS amount_minor,count(*) AS count FROM invoices WHERE status='Unpaid' GROUP BY currency").all()).results;
   return jsonResponse({counts,unpaid,billing_mode:'Manual records; no automatic charges or payment verification',email_status:'Provider acceptance only; delivery and bounce tracking are not connected'});
  }
  const queries={
   businesses:[`SELECT b.*,s.plan,s.status,s.renewal,s.notes,(SELECT count(*) FROM accounts a WHERE a.business_id=b.id) AS users,(SELECT count(*) FROM records r WHERE r.business_id=b.id AND kind='register') AS cameras FROM businesses b LEFT JOIN subscriptions s ON s.business_id=b.id WHERE b.name LIKE ? ORDER BY b.name LIMIT 501`,[pattern]],
   users:[`SELECT a.id,a.email,a.role,a.active,a.platform_blocked,b.name AS business FROM accounts a LEFT JOIN businesses b ON b.id=a.business_id WHERE a.email LIKE ? OR b.name LIKE ? ORDER BY a.email LIMIT 501`,[pattern,pattern]],
   pending:[`SELECT i.email,i.role,i.active,b.name AS business FROM access_invites i JOIN businesses b ON b.id=i.business_id WHERE i.email LIKE ? OR b.name LIKE ? ORDER BY i.email LIMIT 501`,[pattern,pattern]],
   invoices:[`SELECT i.*,b.name AS business FROM invoices i JOIN businesses b ON b.id=i.business_id WHERE b.name LIKE ? OR i.description LIKE ? OR i.id LIKE ? ORDER BY i.created DESC,i.id DESC LIMIT 501`,[pattern,pattern,pattern]],
   support:[`SELECT s.*,b.name AS business FROM support_cases s LEFT JOIN businesses b ON b.id=s.business_id WHERE s.email LIKE ? OR s.subject LIKE ? ORDER BY s.created DESC LIMIT 501`,[pattern,pattern]],
   email:[`SELECT * FROM email_events WHERE email LIKE ? ORDER BY created DESC LIMIT 501`,[pattern]],
   audit:[`SELECT * FROM admin_audit WHERE actor LIKE ? OR action LIKE ? OR target LIKE ? ORDER BY created DESC LIMIT 501`,[pattern,pattern,pattern]]
  };
  if(!queries[endpoint])return reply('Not found',404);
  const [sql,args]=queries[endpoint],rows=(await env.DB.prepare(sql).bind(...args).all()).results;
  return jsonResponse({rows:rows.slice(0,500),more:rows.length>500});
 }
 const body=await req.json(),short=v=>typeof v==='string'?v.trim():'';
 let statement,target,details;
 if(endpoint==='email-send'){
  if(!['recover','resend'].includes(body.action)||!/^\S+@\S+\.\S+$/.test(short(body.email)))return reply('Choose a valid email action.',400);
  const result=await authCall(env,body.action==='recover'?'/recover?redirect_to='+encodeURIComponent(url.origin):'/resend',{email:short(body.email),...(body.action==='resend'?{type:'signup'}:{})});
  await logEmailEvent(env,body.email,body.action,result.ok?'Accepted by authentication provider (delivery unconfirmed)':'Rejected by authentication provider');
  await auditStatement(env,user,'email-'+body.action,short(body.email),{accepted:result.ok}).run();
  return result.ok?jsonResponse({saved:true}):reply('Email request rejected. Check rate limits and email provider settings.',400);
 }
 if(endpoint==='user-status'){
  target=short(body.id);if(![0,1].includes(body.blocked))return reply('Choose a valid account status.',400);
  const member=await env.DB.prepare('SELECT id,email FROM accounts WHERE id=?').bind(target).first();
  if(!member)return reply('Account not found.',404);
  if(isPlatformOwner(member,env))return reply('The software-owner account cannot be suspended here.',400);
  if(!short(body.reason))return reply('Enter a reason for this change.',400);
  statement=env.DB.prepare('UPDATE accounts SET platform_blocked=? WHERE id=?').bind(body.blocked,target);details={blocked:body.blocked,reason:short(body.reason).slice(0,1000)};
 }else if(endpoint==='business-status'){
  target=short(body.id);if(![0,1].includes(body.suspended)||!short(body.reason))return reply('Choose status and enter a reason.',400);
  if(!await env.DB.prepare('SELECT id FROM businesses WHERE id=?').bind(target).first())return reply('Business not found.',404);
  statement=env.DB.prepare('UPDATE businesses SET suspended=? WHERE id=?').bind(body.suspended,target);details={suspended:body.suspended,reason:short(body.reason).slice(0,1000)};
 }else if(endpoint==='subscription'){
  target=short(body.business_id);
  if(!await env.DB.prepare('SELECT id FROM businesses WHERE id=?').bind(target).first())return reply('Select a business.',400);
  if(!short(body.plan)||short(body.plan).length>100||!['Trial','Active','Past due','Cancelled'].includes(body.status)||body.renewal&&!validDate(body.renewal))return reply('Enter a plan, status and valid renewal date.',400);
  details={plan:short(body.plan),status:body.status,renewal:body.renewal||'',notes:short(body.notes).slice(0,3000)};
  statement=env.DB.prepare('INSERT INTO subscriptions(business_id,plan,status,renewal,notes) VALUES(?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,renewal=excluded.renewal,notes=excluded.notes').bind(target,details.plan,details.status,details.renewal,details.notes);
 }else if(endpoint==='invoice'){
  target=crypto.randomUUID();
  if(!await env.DB.prepare('SELECT id FROM businesses WHERE id=?').bind(body.business_id).first())return reply('Select a business.',400);
  if(!short(body.description)||body.description.length>500||!Number.isSafeInteger(body.amount_minor)||body.amount_minor<=0||!['NGN','USD','GBP','EUR'].includes(body.currency)||!validDate(body.due))return reply('Enter a description, positive amount, currency and due date.',400);
  details={business_id:body.business_id,description:short(body.description),amount_minor:body.amount_minor,currency:body.currency,due:body.due};
  statement=env.DB.prepare('INSERT INTO invoices(id,business_id,description,amount_minor,currency,due) VALUES(?,?,?,?,?,?)').bind(target,details.business_id,details.description,details.amount_minor,details.currency,details.due);
 }else if(endpoint==='invoice-status'){
  target=short(body.id);const invoice=await env.DB.prepare('SELECT * FROM invoices WHERE id=?').bind(target).first();
  if(!invoice)return reply('Invoice not found.',404);
  if(!['Unpaid','Paid','Void'].includes(body.status)||!short(body.reference))return reply('Choose a status and enter a payment reference or reason.',400);
  details={previous:invoice.status,status:body.status,reference:short(body.reference).slice(0,500)};
  statement=env.DB.prepare('UPDATE invoices SET status=?,payment_reference=? WHERE id=?').bind(body.status,details.reference,target);
 }else if(endpoint==='support'){
  target=crypto.randomUUID();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(short(body.email))||!short(body.subject)||!short(body.details))return reply('Enter email, subject and issue details.',400);
  const bid=short(body.business_id)||null;
  if(bid&&!await env.DB.prepare('SELECT id FROM businesses WHERE id=?').bind(bid).first())return reply('Select a valid business.',400);
  statement=env.DB.prepare('INSERT INTO support_cases(id,business_id,email,subject,details) VALUES(?,?,?,?,?)').bind(target,bid,short(body.email).slice(0,254),short(body.subject).slice(0,200),short(body.details).slice(0,3000));details={email:short(body.email),subject:short(body.subject)};
 }else if(endpoint==='support-status'){
  target=short(body.id);if(!['Open','In progress','Resolved'].includes(body.status)||!short(body.resolution))return reply('Enter a status and update note.',400);
  if(!await env.DB.prepare('SELECT id FROM support_cases WHERE id=?').bind(target).first())return reply('Case not found.',404);
  statement=env.DB.prepare('UPDATE support_cases SET status=?,resolution=? WHERE id=?').bind(body.status,short(body.resolution).slice(0,3000),target);details={status:body.status,note:short(body.resolution).slice(0,3000)};
 }else return reply('Not found',404);
 await env.DB.batch([statement,auditStatement(env,user,endpoint,target,details)]);
 return jsonResponse({saved:true,id:target});
}
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
async function logEmailEvent(env,email,action,outcome){
 try{await env.DB.prepare('INSERT INTO email_events(id,email,action,outcome) VALUES(?,?,?,?)').bind(crypto.randomUUID(),String(email||'').trim().toLowerCase().slice(0,254),action,outcome).run()}catch{}
}
