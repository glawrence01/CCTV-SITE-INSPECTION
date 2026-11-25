const assets=__ASSETS__;
const common=['school','date','time','officer','shift'];
const required={incident:['school','date','time','officer','recorder','camera','location','incidentTitle','description'],register:['school','camera','location','installation'],camera:[...common,'camera','location','recorder','live','playback','power','fault'],recorder:[...common,'recorder','power','storage','playback','monitor'],note:[...common,'observation'],action:[...common,'action','state']};
const systemChoices={
  storage:['Healthy','Warning','Failed','Not checked'],
  dateAccuracy:['Accurate','Incorrect','Corrected during inspection','Not checked'],
  timeAccuracy:['Accurate','Incorrect','Corrected during inspection','Not checked'],
  power:['On','Off','Unstable','Not checked'],
  playback:['Working','Failed','Not checked'],
  monitor:['Working','Faulty','Not installed','Not checked']
};
const systemFields=[...Object.keys(systemChoices),'earliest','replacements'];
const allowed={incident:['endTime','recorderTime','remarks'],register:['recorder','remarks'],camera:['remarks'],recorder:[...systemFields,'remarks'],note:['remarks'],action:['camera','recorder','owner','due','remarks']};
const reply=(body,status=200)=>new Response(body,{status,headers:{'Cache-Control':'no-store'}});
async function registerCameras(db,payload,bid){
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
  const existing=await db.prepare("SELECT id,payload FROM records WHERE business_id=? AND id IN (SELECT json_extract(value,'$.id') FROM json_each(?))").bind(bid,encoded).all();
  if(existing.results.length){
    const prior=new Map(existing.results.map(r=>[r.id,r.payload]));
    if(records.every(r=>prior.get(r.id)===JSON.stringify(r.body)))return reply('Saved');
    return reply('A previous save contains some of these rows. Refresh the register to check them.',409);
  }
  await db.prepare("INSERT INTO records(id,kind,payload,business_id) SELECT json_extract(value,'$.id'),'register',json_extract(value,'$.body'),? FROM json_each(?)").bind(bid,encoded).run();
  return reply('Saved');
}
async function recordRoutes(req,env,user){const bid=user.business_id;try{if(req.method==='GET'){let {results}=await env.DB.prepare('SELECT id,kind,payload,rowid FROM records WHERE business_id=? ORDER BY rowid DESC').bind(bid).all();return Response.json(results.map(r=>{let p=JSON.parse(r.payload);return {...p,id:r.id,kind:r.kind,version:p.version||1}}),{headers:{'Cache-Control':'no-store'}})}
if(req.method!=='POST')return reply('Unsupported method',405);
let {id,kind,payload,update,version}=await req.json();
if(kind==='registerBatch'){
  if(update)return reply('Invalid camera registration.',400);
  return await registerCameras(env.DB,payload,bid);
}
if(update && user.role !== 'technician' && !['action','register'].includes(kind))return reply('Inspection history is read only.',400);
if(kind==='round'){
  if(!/^[a-f0-9-]{36}$/i.test(id)||!payload||!Array.isArray(payload.channels))return reply('Invalid inspection.',400);
  const statuses=['Unchecked','Working','No view','Faulty camera','Faulty cable','Empty port'];
  const channels=payload.channels;
  if(!channels.length||channels.length>128||channels.some(c=>!c||!statuses.includes(c.status)||typeof c.camera!=='string'||typeof c.location!=='string'||c.camera.length>200||c.location.length>200))return reply('Mark at least one channel and check the channel list.',400);
  const record={channels:channels.map(({status,camera,location})=>({status,camera,location}))};
  for(const field of [...common,'recorder','remarks']){
    const value=payload[field];
    if(typeof value!=='string'||value.length>3000||(field!=='remarks'&&!value.trim()))return reply('Complete the inspection details.',400);
    record[field]=value.trim();
  }
  for(const field of systemFields){
    if(payload[field]!==undefined&&typeof payload[field]!=='string')return reply('Invalid system check.',400);
    if(payload[field]?.trim())record[field]=payload[field].trim();
  }
  const invalid=validateSystemChecks(record);
  if(invalid)return invalid;
  if(channels.every(c=>c.status==='Unchecked')&&!systemFields.some(field=>record[field]&&record[field]!=='Not checked'))return reply('Record a system check or mark at least one channel before saving.',400);
  return await saveInspectionRecord(env,user,{id,kind,body:record,update,version});
}
if(!Object.hasOwn(required,kind)||!payload||typeof payload!=='object'||!/^[0-9a-f-]{36}$/i.test(id))return reply('Invalid record.',400);
let body={};for(let k of [...required[kind],...allowed[kind]]){if(typeof payload[k]==='string')body[k]=payload[k].trim();if((body[k]?.length||0)>3000)return reply('Entry too long.',400)}
if(required[kind].some(k=>!body[k])||(kind==='register'&&body.installation==='Installed'&&!body.recorder))return reply('Complete the required fields.',400);
if(kind==='incident'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!Number.isFinite(Date.parse(body.date))||new Date(body.date).toISOString().slice(0,10)!==body.date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time))return reply('Enter a valid incident date and time.',400);
  if(body.endTime&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.endTime)||body.endTime<body.time))return reply('End time must be on or after the start time on the same day.',400);
  if(!update)body.loggedAt=new Date().toISOString();
}
if(kind==='recorder'){const invalid=validateSystemChecks(body);if(invalid)return invalid;}
return await saveInspectionRecord(env,user,{id,kind,body,update,version});}catch(e){if(String(e).includes('UNIQUE'))return reply('That camera number is already registered on this DVR/NVR at this school.',409);return reply('Records are unavailable. Please try again.',503)}}
function validateSystemChecks(body){
  if(Object.entries(systemChoices).some(([field,options])=>body[field]&&!options.includes(body[field])))return reply('Choose a valid system status.',400);
  if(body.replacements){
    const parts=body.replacements.split(',').map(v=>v.trim());
    if(parts.some(part=>!['Camera','Power pack','HDD'].includes(part)))return reply('Choose a valid replacement part.',400);
    body.replacements=[...new Set(parts)].join(', ');
  }
  if(body.earliest&&(!validInspectionDate(body.earliest)||body.earliest>body.date))return reply('Earliest recording must be on or before the inspection date.',400);
}
function normalizeActionRecipients(body,previous){
  if(!body.owner||body.owner===previous?.owner)return;
  const emails=body.owner.split(',').map(v=>v.trim());
  if(body.owner.length>1000||emails.some(email=>email.length>254||!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*$/i.test(email)))return reply('Enter valid email addresses separated by commas.',400);
  body.owner=[...new Set(emails)].join(', ');
}
async function saveInspectionRecord(env,user,{id,kind,body,update,version}){
  const db=env.DB;
  const bid=user.business_id;
  let notify=kind==='action';
  if(kind!=='register'){
    const blocked=await checkInspectionDate(db,user,body.date);
    if(blocked)return blocked;
  }
  if(update){
    const prior=await db.prepare('SELECT payload FROM records WHERE id=? AND kind=? AND business_id=?').bind(id,kind,bid).first();
    if(!prior)return reply('This record is unavailable. Refresh to check.',409);
    const previous=JSON.parse(prior.payload);
    if(kind==='action'){
      const invalid=normalizeActionRecipients(body,previous);if(invalid)return invalid;
      notify=['action','owner','school','recorder','camera','date','due','state','remarks'].some(field=>(previous[field]||'')!==(body[field]||''));
    }
    if(user.role==='technician' && kind!=='register' && previous.date!==body.date)return reply('The original inspection date cannot be changed.',403);
    if(kind==='incident' && previous.loggedAt)body.loggedAt=previous.loggedAt;
    body.version=Number(version)+1;
    const result=await db.prepare("UPDATE records SET payload=? WHERE id=? AND kind=? AND business_id=? AND coalesce(json_extract(payload,'$.version'),1)=?")
      .bind(JSON.stringify(body),id,kind,bid,version).run();
    if(!result.meta.changes)return reply('This record changed. Close the form and refresh before editing.',409);
  }else{
    if(kind==='action'){const invalid=normalizeActionRecipients(body);if(invalid)return invalid;}
    body.version=1;
    const result=await db.prepare('INSERT INTO records(id,kind,payload,business_id) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,kind,JSON.stringify(body),bid).run();
    if(!result.meta.changes)notify=false;
  }
  if(kind==='action')return jsonResponse({saved:true,email:notify?await sendActionEmail(env,bid,id,body):'unchanged'});
  return reply('Saved');
}
async function sendActionEmail(env,bid,id,action){
  const recipients=(action.owner||'').split(',').map(value=>value.trim()).filter(Boolean);
  if(!recipients.length||recipients.some(email=>!email.includes('@')))return 'no_recipients';
  if(!env.RESEND_API_KEY||!env.ACTION_EMAIL_FROM)return 'unconfigured';
  const text=[action.action,'Property: '+action.school,action.recorder&&'Recorder: '+action.recorder,
    action.camera&&'Camera: '+action.camera,'Date: '+action.date,action.due&&'Due: '+action.due,
    'Status: '+action.state,action.remarks&&'Notes: '+action.remarks].filter(Boolean).join('\n');
  try{
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'cctv-action/'+bid+'/'+id+'/'+action.version},
      body:JSON.stringify({from:env.ACTION_EMAIL_FROM,to:recipients,subject:'CCTV action point · '+action.school.replace(/[\r\n]+/g,' '),text}),
      signal:AbortSignal.timeout(8000)
    });
    return response.ok?'sent':'failed';
  }catch{return 'failed'}
}
export default {async fetch(req,env){try{return await handleRequest(req,env)}catch(error){return reply('The request could not be completed. Please retry.',503)}}};
