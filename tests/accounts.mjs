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
for(const user of ['owner','tech','viewer'])await status(await call(user,'/api/me'),200);
await status(await call('tech','/api/onboard',{name:'Business A'}),200);
sql.exec("UPDATE accounts SET business_id='business-tech' WHERE id='viewer'");
await status(await call('tech','/api/properties',{name:'School A',type:'School'}),200);
await status(await call('tech','/api/properties',{name:'No',type:'School'},null,'https://evil.test'),403);
const row={id:crypto.randomUUID(),camera:'1',location:'Entrance',installation:'Installed',remarks:'internal note'};
const batch={kind:'registerBatch',payload:{school:'School A',recorder:'DVR 1',rows:[row]}};
await status(await call('viewer','/api/records',batch),403);
await status(await call('tech','/api/records',batch),200);
await status(await call('tech','/api/records',batch),200);
const visible=await (await call('viewer','/api/records')).json();assert.equal(visible.length,1);assert.ok(!('remarks' in visible[0]));
assert.equal((await (await call('owner','/api/records')).json()).length,0);
await status(await call('tech','/api/records',null,'xposure'),403);
await status(await call('tech','/api/admin/users'),403);
await status(await call('owner','/api/admin/users'),200);
await status(await call('owner','/api/properties',{name:'School A',type:'School'}),200);
await status(await call('owner','/api/records',{id:row.id,kind:'register',update:true,version:1,payload:{...row,school:'School A',recorder:'DVR 1'}}),409);
await status(await call('owner','/api/records',{...batch,payload:{...batch.payload,rows:[{...row,id:crypto.randomUUID()}]}}),200);
assert.equal((await (await call('tech','/api/records')).json()).length,1);
await status(await call('owner','/api/admin/users',{id:'tech',business_id:'business-tech',role:'technician',active:0}),200);
await status(await call('tech','/api/me'),403);
console.log('PASS authentication, confirmation, tenant isolation, viewer permissions, admin access, suspension, cross-tenant update protection, batch replay and per-business numbering');
