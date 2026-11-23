const assets=__ASSETS__;
const common=['school','date','time','officer','shift'];
const required={register:['school','camera','location','installation'],camera:[...common,'camera','location','recorder','live','playback','power','fault'],recorder:[...common,'recorder','power','storage','playback','monitor'],note:[...common,'observation'],action:[...common,'action','state']};
const allowed={register:['recorder','remarks'],camera:['remarks'],recorder:['earliest','remarks'],note:['remarks'],action:['camera','recorder','owner','due','remarks']};
const reply=(body,status=200)=>new Response(body,{status,headers:{'Cache-Control':'no-store'}});
async function registerCameras(db,payload){
  const clean=v=>typeof v==='string'?v.trim():'';
  const school=clean(payload?.school), recorder=clean(payload?.recorder), rows=payload?.rows;
  if(!school||!recorder||school.length>200||recorder.length>200||!Array.isArray(rows)||rows.length<1||rows.length>128)return reply('Choose a school and recorder and enter 1–128 cameras.',400);
  const records=[], numbers=new Set(), ids=new Set();
  for(const [index,row] of rows.entries()){
    const camera=clean(row?.camera),location=clean(row?.location),installation=row?.installation,remarks=clean(row?.remarks);
    if(!camera||!location||camera.length>200||location.length>200||remarks.length>3000||!['Installed','Not installed'].includes(installation)||!/^[a-f0-9-]{36}$/i.test(row?.id)||ids.has(row.id))return reply('Check the entries in row '+(index+1)+'.',400);
    if(numbers.has(camera.toLowerCase()))return reply('Row '+(index+1)+' repeats '+camera+' on this recorder.',409);
    numbers.add(camera.toLowerCase());ids.add(row.id);
    records.push({id:row.id,body:{school,recorder,camera,location,installation,remarks,version:1}});
  }
  const encoded=JSON.stringify(records);
  const existing=await db.prepare("SELECT id,payload FROM records WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?))").bind(encoded).all();
  if(existing.results.length){
    const prior=new Map(existing.results.map(r=>[r.id,r.payload]));
    if(records.every(r=>prior.get(r.id)===JSON.stringify(r.body)))return reply('Saved');
    return reply('A previous save contains some of these rows. Refresh the register to check them.',409);
  }
  await db.prepare("INSERT INTO records(id,kind,payload) SELECT json_extract(value,'$.id'),'register',json_extract(value,'$.body') FROM json_each(?)").bind(encoded).run();
  return reply('Saved');
}
export default {async fetch(req,env){let u=new URL(req.url);if(u.pathname!='/api/records'){let item=assets[u.pathname];if(!item)return reply('Page not found',404);return new Response(Uint8Array.from(atob(item[1]),c=>c.charCodeAt(0)),{headers:{'Content-Type':item[0],'Content-Security-Policy':"frame-ancestors 'self' https://sites.google.com https://*.googleusercontent.com https://*.chatgpt.com"}})}
try{if(req.method==='GET'){let {results}=await env.DB.prepare('SELECT id,kind,payload,rowid FROM records ORDER BY rowid DESC').all();return Response.json(results.map(r=>{let p=JSON.parse(r.payload);return {...p,id:r.id,kind:r.kind,version:p.version||1}}),{headers:{'Cache-Control':'no-store'}})}
if(req.method!=='POST')return reply('Unsupported method',405);if(req.headers.get('Origin')!==u.origin||!req.headers.get('Content-Type')?.startsWith('application/json'))return reply('Invalid request origin',403);
let {id,kind,payload,update,version}=await req.json();if(kind==='registerBatch')return await registerCameras(env.DB,payload);if(kind==='round'){
  if(update||!/^[a-f0-9-]{36}$/i.test(id)||!payload||!Array.isArray(payload.channels))return reply('Invalid inspection.',400);
  const statuses=['Unchecked','Working','No view','Faulty camera','Faulty cable','Empty port'];
  const channels=payload.channels;
  if(!channels.length||channels.length>128||channels.some(c=>!c||!statuses.includes(c.status)||typeof c.camera!=='string'||typeof c.location!=='string'||c.camera.length>200||c.location.length>200)||channels.every(c=>c.status==='Unchecked'))return reply('Mark at least one channel and check the channel list.',400);
  const record={channels:channels.map(({status,camera,location})=>({status,camera,location}))};
  for(const field of [...common,'recorder','remarks']){
    const value=payload[field];
    if(typeof value!=='string'||value.length>3000||(field!=='remarks'&&!value.trim()))return reply('Complete the inspection details.',400);
    record[field]=value.trim();
  }
  await env.DB.prepare('INSERT INTO records(id,kind,payload) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,kind,JSON.stringify(record)).run();
  return reply('Saved');
}
if(!Object.hasOwn(required,kind)||!payload||typeof payload!=='object'||!/^[0-9a-f-]{36}$/i.test(id))return reply('Invalid record.',400);
let body={};for(let k of [...required[kind],...allowed[kind]]){if(typeof payload[k]==='string')body[k]=payload[k].trim();if((body[k]?.length||0)>3000)return reply('Entry too long.',400)}
if(required[kind].some(k=>!body[k])||(kind==='register'&&body.installation==='Installed'&&!body.recorder))return reply('Complete the required fields.',400);
if(body.earliest&&body.earliest>body.date)return reply('Earliest recording must be on or before the inspection date.',400);
if(update){if(!['action','register'].includes(kind))return reply('Inspection history is read only.',400);body.version=Number(version)+1;let result=await env.DB.prepare("UPDATE records SET payload=? WHERE id=? AND kind=? AND coalesce(json_extract(payload,'$.version'),1)=?").bind(JSON.stringify(body),id,kind,version).run();if(!result.meta.changes)return reply('This record changed. Close the form and refresh before editing.',409)}
else{body.version=1;await env.DB.prepare('INSERT INTO records(id,kind,payload) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,kind,JSON.stringify(body)).run()}return reply('Saved')}catch(e){if(String(e).includes('UNIQUE'))return reply('That camera number is already registered on this DVR/NVR at this school.',409);return reply('Records are unavailable. Please try again.',503)}}}

