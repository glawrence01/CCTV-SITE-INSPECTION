import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const sql=new DatabaseSync(':memory:');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function prepare(q){let args=[];return {bind(...a){args=a;return this},async all(){return {results:sql.prepare(q).all(...args)}},async first(){return sql.prepare(q).get(...args)||null},async run(){const r=sql.prepare(q).run(...args);return {meta:{changes:Number(r.changes)}}}}}
const env={DB:{prepare,async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}},SUPER_ADMIN_EMAIL:'owner@example.test',SUPABASE_PUBLISHABLE_KEY:'test'};
globalThis.fetch=async(url,options)=>{const id=options.headers.Authorization?.replace('Bearer ','');return Response.json(id&&id!=='bad'?{id,email:id+'@example.test',email_confirmed_at:id==='unverified'?null:'2026-01-01'}:{},{status:id&&id!=='bad'?200:401})};
async function call(user,path,body,business,origin='https://site.test'){return worker.fetch(new Request('https://site.test'+path,{method:body?'POST':'GET',headers:{...(user?{Cookie:'xh_access='+user}:{}),Origin:origin,'Content-Type':'application/json',...(business?{'X-Business-ID':business}:{})},...(body?{body:JSON.stringify(body)}:{})}),env)}
async function status(response,expected){assert.equal(response.status,expected,await response.text())}
await status(await call(null,'/api/records'),401);
await status(await call('unverified','/api/me'),401);
for(const id of ['owner','alice','bob'])await status(await call(id,'/api/me'),200);
for(const id of ['alice','bob'])await status(await call(id,'/api/onboard',{name:id+' business'}),200);
for(const id of ['owner','alice','bob']){
 const me=await (await call(id,'/api/me')).json();assert.equal(me.role,'super_admin');assert.equal(me.businesses.length,1);
}
await status(await call('alice','/api/records',null,'business-bob'),403);
await status(await call('owner','/api/records',null,'business-alice'),403);
await status(await call('alice','/api/admin/users',{id:'bob',role:'viewer',active:0,permissions:[]}),404);
await status(await call('alice','/api/admin/users',{id:'alice',role:'viewer',active:0,permissions:[]}),400);
await status(await call('alice','/api/admin/users',{email:'bob@example.test',role:'viewer',active:1,permissions:[]}),409);
await status(await call('alice','/api/admin/users',{email:'staff@example.test',role:'technician',active:1,permissions:['register_cameras']}),200);
assert.ok((await (await call('alice','/api/admin/users')).json()).some(u=>u.email==='staff@example.test'&&u.pending));
assert.ok(!(await (await call('bob','/api/admin/users')).json()).some(u=>u.email==='staff@example.test'));
const staff=await (await call('staff','/api/me')).json();assert.equal(staff.business_id,'business-alice');assert.deepEqual(staff.permissions,['register_cameras']);
await status(await call('staff','/api/onboard',{name:'Hijack'}),409);
await status(await call('staff','/api/admin/users'),403);
await status(await call('staff','/api/properties',{name:'Denied',type:'School'}),403);
await status(await call('alice','/api/properties',{name:'School A',type:'School'}),200);
await status(await call('alice','/api/properties',{name:'No',type:'School'},null,'https://evil.test'),403);
const row={id:crypto.randomUUID(),camera:'1',location:'Entrance',installation:'Installed',remarks:'private'};
const batch={kind:'registerBatch',payload:{school:'School A',recorder:'DVR 1',rows:[row]}};
await status(await call('staff','/api/records',batch),200);
await status(await call('staff','/api/records',batch),200);
await status(await call('staff','/api/records',{kind:'round',payload:{school:'School A'}}),403);
await status(await call('alice','/api/admin/users',{id:'staff',role:'viewer',active:1,permissions:[]}),200);
await status(await call('staff','/api/records',batch),403);
const visible=await (await call('staff','/api/records')).json();assert.equal(visible.length,1);assert.ok(!('remarks' in visible[0]));
assert.equal((await (await call('bob','/api/records')).json()).length,0);
await status(await call('bob','/api/properties',{name:'School A',type:'School'}),200);
await status(await call('bob','/api/records',{id:row.id,kind:'register',update:true,version:1,payload:{...row,school:'School A',recorder:'DVR 1'}}),409);
await status(await call('alice','/api/admin/users',{id:'staff',role:'technician',active:0,permissions:['register_cameras']}),200);
await status(await call('staff','/api/me'),403);
await status(await call('alice','/api/admin/users',{id:'staff',role:'technician',active:1,permissions:['register_cameras']}),200);
await status(await call('staff','/api/me'),200);
await status(await call('alice','/api/admin/users',{email:'pending@example.test',role:'viewer',active:0,permissions:[]}),200);
await status(await call('pending','/api/me'),403);
await status(await call('alice','/api/admin/users',{id:'staff',role:'technician',active:1,permissions:['manage_users']}),400);
console.log('PASS business ownership, legacy-owner isolation, scoped team lists, pending user binding, granular write/read permissions, anti-escalation, suspension/reactivation, CSRF, batch saves and cross-business record protection');
