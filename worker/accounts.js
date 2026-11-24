const authUrl='https://mujuugqrovfgtcnogswn.supabase.co/auth/v1';
const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function cookie(req,name){
  const part=(req.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));
  return part?decodeURIComponent(part.slice(name.length+1)):'';
}
function setSession(response,session){
  const entries=[['xh_access',session?.access_token,3600],['xh_refresh',session?.refresh_token,604800]];
  for(const [name,value,age] of entries)response.headers.append('Set-Cookie',name+'='+encodeURIComponent(value||'')+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+(value?age:0));
  return response;
}
async function authCall(env,path,body,token){
  const response=await fetch(authUrl+path,{method:body?'POST':'GET',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  return {ok:response.ok,data};
}
const permissionKeys=['register_cameras','inspect','observations','manage_actions','manage_properties','view_reports','manage_incidents'];
function permissionsFor(user){return user.role==='super_admin'?permissionKeys:user.permissions===null||user.permissions===undefined?(user.role==='technician'?permissionKeys:[]):JSON.parse(user.permissions)}
function permitted(user,key){return permissionsFor(user).includes(key)}
const recordPermission={register:'register_cameras',registerBatch:'register_cameras',camera:'inspect',recorder:'inspect',round:'inspect',note:'observations',action:'manage_actions',incident:'manage_incidents'};
async function identity(req,env){
  let token=cookie(req,'xh_access'),session;
  let result=token?await authCall(env,'/user',null,token):{ok:false};
  if(!result.ok&&cookie(req,'xh_refresh')){
    const refreshed=await authCall(env,'/token?grant_type=refresh_token',{refresh_token:cookie(req,'xh_refresh')});
    if(refreshed.ok){session=refreshed.data;result=await authCall(env,'/user',null,session.access_token)}
  }
  if(!result.ok||!result.data.email_confirmed_at)return null;
  const user=result.data,email=user.email.toLowerCase();
  await env.DB.prepare("INSERT INTO businesses(id,name) VALUES('xposure','Xposure Hub Limited') ON CONFLICT(id) DO NOTHING").run();
  await env.DB.prepare("INSERT INTO accounts(id,email,business_id,role) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email").bind(user.id,email,email===env.SUPER_ADMIN_EMAIL?'xposure':null,email===env.SUPER_ADMIN_EMAIL?'super_admin':'viewer').run();
  // Older self-created businesses have a deterministic creator ID. Upgrade only that creator.
  await env.DB.prepare("UPDATE accounts SET role='super_admin' WHERE id=? AND business_id=?").bind(user.id,'business-'+user.id).run();
  await env.DB.prepare("UPDATE accounts SET business_id=(SELECT business_id FROM access_invites WHERE email=?),role=(SELECT role FROM access_invites WHERE email=?),permissions=(SELECT permissions FROM access_invites WHERE email=?),active=(SELECT active FROM access_invites WHERE email=?) WHERE id=? AND business_id IS NULL AND EXISTS(SELECT 1 FROM access_invites WHERE email=?)").bind(email,email,email,email,user.id,email).run();
  const account=await env.DB.prepare('SELECT * FROM accounts WHERE id=?').bind(user.id).first();
  if(account.business_id)await env.DB.prepare('DELETE FROM access_invites WHERE email=? AND business_id=?').bind(email,account.business_id).run();
  return {...account,session};
}
async function accountRoutes(req,env,user,url){
  const path=url.pathname;
  if(path==='/api/me'){
    const businesses=(await env.DB.prepare('SELECT * FROM businesses WHERE id=?').bind(user.business_id).all()).results;
    return jsonResponse({id:user.id,email:user.email,role:user.role,business_id:user.business_id,permissions:permissionsFor(user),platform_owner:isPlatformOwner(user,env),active:user.active,businesses});
  }
  if(path==='/api/onboard'&&req.method==='POST'){
    const {name}=await req.json();
    if(user.business_id)return reply('A business is already assigned.',409);
    if(typeof name!=='string'||!name.trim()||name.length>150)return reply('Enter a business name.',400);
    const bid='business-'+user.id;
    await env.DB.batch([
      env.DB.prepare('INSERT INTO businesses(id,name) VALUES(?,?) ON CONFLICT(id) DO NOTHING').bind(bid,name.trim()),
      env.DB.prepare("UPDATE accounts SET business_id=?,role='super_admin' WHERE id=? AND business_id IS NULL").bind(bid,user.id)
    ]);
    return jsonResponse({saved:true});
  }
  const bid=user.business_id;
  if(req.headers.get('X-Business-ID')&&req.headers.get('X-Business-ID')!==bid)return reply('Business access denied.',403);
  if(path==='/api/admin/users'){
    if(user.role!=='super_admin'||!bid)return reply('Business Super Admin access required.',403);
    if(req.method==='GET'){
      const members=(await env.DB.prepare('SELECT id,email,role,permissions,active FROM accounts WHERE business_id=? ORDER BY email').bind(bid).all()).results;
      const pending=(await env.DB.prepare('SELECT email,role,permissions,active FROM access_invites WHERE business_id=? ORDER BY email').bind(bid).all()).results;
      return jsonResponse([...members.map(u=>({...u,permissions:permissionsFor(u)})),...pending.map(u=>({...u,pending:true,permissions:permissionsFor(u)}))]);
    }
    const body=await req.json();
    if(!['viewer','technician'].includes(body.role)||![0,1].includes(body.active)||!Array.isArray(body.permissions)||body.permissions.some(p=>!permissionKeys.includes(p)))return reply('Choose a valid role and permissions.',400);
    if(body.business_id&&body.business_id!==bid)return reply('Business access denied.',403);
    const permissions=JSON.stringify([...new Set(body.permissions)]);
    if(body.id){
      const target=await env.DB.prepare('SELECT id,role FROM accounts WHERE id=? AND business_id=?').bind(body.id,bid).first();
      if(!target)return reply('User not found in your business.',404);
      if(target.role==='super_admin')return reply('The business owner keeps Super Admin access.',400);
      await env.DB.prepare('UPDATE accounts SET role=?,permissions=?,active=? WHERE id=? AND business_id=?').bind(body.role,permissions,body.active,body.id,bid).run();
    }else{
      const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply('Enter a valid email address.',400);
      const target=await env.DB.prepare('SELECT id,business_id,role FROM accounts WHERE email=?').bind(email).first();
      const pending=await env.DB.prepare('SELECT business_id FROM access_invites WHERE email=?').bind(email).first();
      if((target?.business_id&&target.business_id!==bid)||(pending&&pending.business_id!==bid))return reply('This email cannot be added to this business. Use a different email.',409);
      if(target?.role==='super_admin')return reply('The business owner keeps Super Admin access.',400);
      if(target?.business_id===bid){
        await env.DB.prepare('UPDATE accounts SET role=?,permissions=?,active=? WHERE id=? AND business_id=?').bind(body.role,permissions,body.active,target.id,bid).run();
      }else{
        await env.DB.prepare('INSERT INTO access_invites(email,business_id,role,permissions,active) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,permissions=excluded.permissions,active=excluded.active WHERE access_invites.business_id=excluded.business_id').bind(email,bid,body.role,permissions,body.active).run();
      }
    }
    return jsonResponse({saved:true});
  }
  if(!bid)return reply('Create your business first.',403);
  if(req.headers.get('X-Business-ID')&&req.headers.get('X-Business-ID')!==bid)return reply('Business access denied.',403);
  const business=await env.DB.prepare('SELECT * FROM businesses WHERE id=?').bind(bid).first();
  if(!business)return reply('Business not found.',404);
  if(path==='/api/business'&&req.method==='POST'){
    if(!permitted(user,'manage_properties'))return reply('Property management permission required.',403);
    const {name}=await req.json();
    if(typeof name!=='string'||!name.trim()||name.length>150)return reply('Enter a business name.',400);
    await env.DB.prepare('UPDATE businesses SET name=? WHERE id=?').bind(name.trim(),bid).run();
    return jsonResponse({saved:true});
  }
  if(path==='/api/properties'){
    // Existing installations become named school properties within their original business.
    await env.DB.prepare("INSERT OR IGNORE INTO properties(id,business_id,name,type) SELECT lower(hex(randomblob(16))),business_id,json_extract(payload,'$.school'),'School' FROM records WHERE business_id=? AND json_extract(payload,'$.school') IS NOT NULL GROUP BY business_id,json_extract(payload,'$.school')").bind(bid).run();
    if(req.method==='GET')return jsonResponse((await env.DB.prepare('SELECT * FROM properties WHERE business_id=? ORDER BY name').bind(bid).all()).results);
    if(!permitted(user,'manage_properties'))return reply('Property management permission required.',403);
    const body=await req.json();
    if(typeof body.name!=='string'||!body.name.trim()||body.name.length>200||!['Apartment','School','Estate','Store','Office','Other'].includes(body.type))return reply('Enter a location and property type.',400);
    await env.DB.prepare('INSERT INTO properties(id,business_id,name,type) VALUES(?,?,?,?)').bind(crypto.randomUUID(),bid,body.name.trim(),body.type).run();
    return jsonResponse({saved:true});
  }
  if(path==='/api/records'){
    
    if(req.method==='POST'){
      const body=await req.clone().json();
      if(!permitted(user,recordPermission[body.kind]))return reply('You do not have permission for this action.',403);
      const property=await env.DB.prepare('SELECT id FROM properties WHERE business_id=? AND name=?').bind(bid,body.payload?.school||'').first();
      if(!property)return reply('Create or select a property first.',400);
    }
    const response=await recordRoutes(req,env,bid);
    if(req.method==='GET'&&!permitted(user,'view_reports')&&response.ok){
      const rows=await response.json();
      const fields=['id','kind','school','date','time','camera','location','recorder','installation','live','playback','power','storage','monitor','fault','channels'];
      return jsonResponse(rows.filter(r=>['register','camera','round','recorder'].includes(r.kind)||permitted(user,recordPermission[r.kind])).map(r=>permitted(user,recordPermission[r.kind])?r:Object.fromEntries(fields.filter(k=>k in r).map(k=>[k,r[k]]))));
    }
    return response;
  }
  return reply('Not found',404);
}
async function handleRequest(req,env){
  const url=new URL(req.url),path=url.pathname;
  if(!path.startsWith('/api/')){
    const asset=assets[path];
    if(!asset)return reply('Page not found',404);
    return new Response(Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset[0],'Cache-Control':'no-store','Content-Security-Policy':"frame-ancestors 'self' https://sites.google.com https://*.googleusercontent.com https://*.chatgpt.com"}});
  }
  if(!['GET','POST'].includes(req.method))return reply('Unsupported method',405);
  if(req.method==='POST'&&(req.headers.get('Origin')!==url.origin||!req.headers.get('Content-Type')?.startsWith('application/json')))return reply('Invalid request origin',403);
  if(path.startsWith('/api/auth/')){
    if(req.method!=='POST')return reply('POST required',405);
    const action=path.split('/').pop(),body=await req.json();
    if(action==='logout')return setSession(jsonResponse({saved:true}),null);
    let result;
    if(action==='session'){
      const verified=await authCall(env,'/user',null,body.access_token);
      if(!verified.ok||!verified.data.email_confirmed_at)return reply('Invalid confirmation link.',400);
      return setSession(jsonResponse({signedIn:true}),{access_token:body.access_token,refresh_token:body.refresh_token});
    }
    if(action==='login')result=await authCall(env,'/token?grant_type=password',{email:body.email,password:body.password});
    else if(action==='signup'){
      if(typeof body.password!=='string'||body.password.length<10)return reply('Use a password with at least 10 characters.',400);
      result=await authCall(env,'/signup?redirect_to='+encodeURIComponent(url.origin),{email:body.email,password:body.password});
    }else if(action==='recover')result=await authCall(env,'/recover?redirect_to='+encodeURIComponent(url.origin),{email:body.email});
    else if(action==='verify')result=await authCall(env,'/verify',{email:body.email,token:body.token,type:body.type==='recovery'?'recovery':'signup'});
    else if(action==='resend')result=await authCall(env,'/resend',{email:body.email,type:'signup'});
    else return reply('Unknown action',404);
    if(['signup','recover','resend'].includes(action))await logEmailEvent(env,body.email,action,result.ok?'Accepted by authentication provider (delivery unconfirmed)':'Rejected by authentication provider');
    if(!result.ok)return reply(result.data.msg||result.data.error_description||result.data.message||'Authentication failed.',400);
    return result.data.access_token?setSession(jsonResponse({signedIn:true}),result.data):jsonResponse({sent:true});
  }
  const user=await identity(req,env);
  if(!user)return reply('Please sign in with a verified email.',401);
  if(user.platform_blocked)return reply('This account has been suspended by the software owner.',403);
  if(!user.active&&!(isPlatformOwner(user,env)&&(path.startsWith('/api/owner/')||path==='/api/me'||path==='/api/password')))return reply('This account has been suspended. Contact your business administrator.',403);
  if(path.startsWith('/api/owner/'))return ownerRoutes(req,env,user,url);
  if(user.business_id&&!(isPlatformOwner(user,env)&&(path==='/api/me'||path==='/api/password'))){const tenant=await env.DB.prepare('SELECT suspended FROM businesses WHERE id=?').bind(user.business_id).first();if(tenant?.suspended)return reply('This business account is suspended. Contact support.',403)}
  if(path==='/api/password'&&req.method==='POST'){
    const {password}=await req.json();
    if(typeof password!=='string'||password.length<10)return reply('Use at least 10 characters.',400);
    const result=await fetch(authUrl+'/user',{method:'PUT',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+(user.session?.access_token||cookie(req,'xh_access')),'Content-Type':'application/json'},body:JSON.stringify({password})});
    return result.ok?jsonResponse({saved:true}):reply('Password update failed.',400);
  }
  const response=await accountRoutes(req,env,user,url);
  return user.session?setSession(response,user.session):response;
}
