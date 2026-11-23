const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const paths={overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',register:'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5',camera:'M3 6h13v12H3z M16 10l5-3v10l-5-3',recorder:'M3 4h18v7H3z M3 14h18v7H3z M6 8h1 M6 18h1',note:'M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h5',action:'M3 6l2 2 4-5 M11 6h10 M3 14l2 2 4-5 M11 14h10',lock:'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3',shield:'M12 2l8 4v6q0 6-8 10-8-4-8-10V6z',plus:'M12 5v14 M5 12h14',school:'M2 10l10-7 10 7 M4 10h16v11H4z M10 21v-6h4v6',date:'M3 6h18v15H3z M7 3v6 M17 3v6 M3 11h18',check:'M3 12l6 6L21 5',alert:'M12 3l10 18H2z M12 9v5 M12 17v1',display:'M2 4h20v13H2z M12 17v4 M7 21h10',cable:'M5 3v5 M9 3v5 M3 8h8v3a4 4 0 0 1-8 0z M7 15v3a3 3 0 0 0 6 0v-3h6',history:'M4 8a9 9 0 1 1-1 7 M3 3v6h6 M12 7v6l4 2'};
const icon=k=>'<svg aria-hidden="true" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[k]+'"/></svg>';
document.querySelectorAll('[data-icon]').forEach(e=>e.outerHTML=icon(e.dataset.icon));
const pages={overview:'Overview',register:'Camera Register',camera:'Daily Camera Checks',recorder:'DVR/NVR Checks',note:'Observations',action:'Action Points',history:'Inspection History'};
const intro={overview:'Monitor property CCTV inspections, equipment health and follow-up work.',register:'Track installed cameras and planned coverage by property.',camera:'Record live view, playback and camera faults for each shift.',recorder:'Review power, storage, playback and connected displays.',note:'Keep shift observations and handover notes.',action:'Track follow-up work through to completion.',history:'Review previous inspections and print filtered reports.'};
const titles={register:'Register cameras',camera:'New camera check',recorder:'New recorder check',note:'Add observation',action:'Add action point'};
const names={school:'Property',date:'Inspection date',time:'Inspection time',officer:'Officer',shift:'Shift',camera:'Camera number',location:'Camera title / location',recorder:'Assigned DVR/NVR',installation:'Installation status',live:'Live view',playback:'Recording / playback',power:'Power status',fault:'Replacement required',storage:'HDD / storage health',earliest:'Earliest available recording',monitor:'TV / monitor',remarks:'Remarks',observation:'Overall observation',action:'Action point',owner:'Assigned to',due:'Due date',state:'Action status',channelSummary:'Channels inspected'};
const common=['school','date','time','officer','shift'];
const fields={register:['school','recorder','camera','location','installation','remarks'],camera:[...common,'recorder','camera','location','live','playback','power','fault','remarks'],recorder:[...common,'recorder','power','storage','earliest','playback','monitor','remarks'],note:[...common,'observation','remarks'],action:[...common,'camera','recorder','action','owner','due','state','remarks']};
const choices={shift:['Morning','Afternoon','Night','Day'],installation:['Installed','Not installed'],live:['Working','No view','Intermittent','Not checked','Empty port','Unchecked'],playback:['Working','Failed','Not checked'],power:['On','Off','Unstable','Not checked'],fault:['None identified','Camera','Cable','Camera and cable','Under investigation'],storage:['Healthy','Warning','Failed','Not checked'],monitor:['Working','Faulty','Not installed','Not checked'],state:['Open','In progress','Completed']};
fields.round=[...common,'recorder','remarks'];
titles.round='Inspect DVR channels';
pages.round='DVR channel inspection';
const optional=['earliest','remarks','due','owner'];let data=[],page='overview',filter={school:'',date:'',camera:'',recorder:''},kind='camera',edit=null,saving=false;
const key=(...v)=>JSON.stringify(v.map(x=>(x||'').trim().toLowerCase()));
const day=(offset=0)=>{let d=new Date();d.setDate(d.getDate()+offset);return localDate(d)};
function localDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function matches(r,withDate=true){return Object.entries(filter).every(([k,v])=>!v||(!withDate&&k==='date')||r[k]===v)}
function latest(list,keys){let m=new Map();for(let r of list){let k=key(...keys.map(f=>r[f]));if(!m.has(k))m.set(k,r)}return [...m.values()]}
function renderFilters(){let items=['school','recorder','camera'];$('filters').innerHTML=items.map(k=>'<label>'+icon(k==='school'?'school':k)+'<select aria-label="Filter by '+k+'" data-filter="'+k+'"><option value="">All '+({school:'properties',camera:'cameras',recorder:'recorders'}[k])+'</option>'+[...new Set(data.filter(r=>(k==='school'||!filter.school||r.school===filter.school)&&(k!=='camera'||!filter.recorder||r.recorder===filter.recorder)).map(r=>r[k]).filter(Boolean))].sort().map(v=>'<option '+(filter[k]===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>').join('')+(page==='register'?'':'<label>'+icon('date')+'<input aria-label="Filter inspection date" type="date" data-filter="date" value="'+filter.date+'"></label>')+(Object.values(filter).some(Boolean)?'<button id="reset">Clear filters</button>':'');$('filters').querySelectorAll('[data-filter]').forEach(e=>e.onchange=()=>{filter[e.dataset.filter]=e.value;if(e.dataset.filter==='school'){filter.camera='';filter.recorder=''}if(e.dataset.filter==='recorder')filter.camera='';render()});if($('reset'))$('reset').onclick=()=>{for(let k in filter)filter[k]='';render()}}
const blueprint='<div class="drawing" aria-hidden="true"><svg viewBox="0 0 300 160" fill="none"><g stroke="#a8cbe9" stroke-width="2" stroke-linejoin="round"><path fill="#285786" d="m75 58 84-33 67 22-83 36z"/><path fill="#204973" d="m75 58 68 25-6 32-63-25z"/><path fill="#37658e" d="m143 83 83-36-8 32-81 36z"/><path d="m82 64 51 20-4 23-49-20z"/><ellipse cx="105" cy="85" rx="12" ry="9" transform="rotate(24 105 85)"/><ellipse cx="105" cy="85" rx="6" ry="5" transform="rotate(24 105 85)"/><path d="m168 104 2 11 28 12 29-13 M175 100l2 10 23 10 25-12 M225 100l13-5v25l-13 5z M165 76l34-15 M162 82l36-16"/></g><g stroke="#91bbdf" opacity=".6" stroke-dasharray="3 4"><path d="M53 43v60 M43 53h20 M217 30h42 M246 22v16 M44 120l70 25"/></g></svg></div>';
function panel(title,body,extra=''){return '<section class="panel"><div class="sect"><h2>'+title+'</h2>'+extra+'</div>'+body+'</section>'}
function overview(rows){let cams=latest(rows.filter(r=>r.kind==='camera'),['school','recorder','camera']),rec=latest(rows.filter(r=>r.kind==='recorder'&&!r.channels),['school','recorder']);let working=cams.filter(r=>r.channelStatus==='Working'||(r.live==='Working'&&r.playback==='Working'&&r.power==='On')).length,failed=cams.filter(r=>['No view','Intermittent'].includes(r.live)||r.playback==='Failed'||['Off','Unstable'].includes(r.power)).length;let actions=rows.filter(r=>r.kind==='action'&&r.state!=='Completed'),checks=rows.filter(r=>['camera','recorder'].includes(r.kind)&&(!r.channelStatus||!['Unchecked','Empty port'].includes(r.channelStatus)));
let exceptions=[['camera','Locations with no view',cams.filter(r=>r.live==='No view')],['cable','Camera or cable replacements',cams.filter(r=>['Camera','Cable','Camera and cable'].includes(r.fault))],['register','Cameras not installed',data.filter(r=>r.kind==='register'&&matches(r,false)&&r.installation==='Not installed')],['display','Faulty TVs / monitors',rec.filter(r=>r.monitor==='Faulty')]];
let end=filter.date||day(),dates=Array.from({length:7},(_,i)=>{let d=new Date(end+'T12:00:00');d.setDate(d.getDate()-6+i);return localDate(d)}),counts=dates.map(d=>data.filter(r=>matches(r,false)&&r.date===d&&['camera','recorder'].includes(r.kind)&&(!r.channelStatus||!['Unchecked','Empty port'].includes(r.channelStatus))).length),max=Math.max(1,...counts);
let trend='<div class="chart" role="img" aria-label="'+dates.map((d,i)=>d+' '+counts[i]+' checks').join(', ')+'">'+counts.map((n,i)=>'<div class="bar" style="height:'+100*n/max+'%" title="'+dates[i]+': '+n+' checks"></div>').join('')+'</div><div class="axis">'+dates.map(d=>'<span>'+d.slice(8)+'</span>').join('')+'</div><div class="legend">Completed checks · '+esc(dates[0])+' to '+esc(end)+'</div>';
return '<section class="hero"><div><div class="tag">INSPECTION SUMMARY</div><h2>System status</h2><p>'+esc(filter.school||'All properties')+' · '+esc(filter.date||'Latest recorded checks')+'</p></div>'+blueprint+'</section><div class="cards">'+[['check','Working cameras',working,'#167156','#e4f6ee'],['alert','Cameras with faults',failed,'#b23e49','#fcebef'],['recorder','Checks recorded',checks.length,'#245da2','#e8f1ff'],['action','Open action points',actions.length,'#9a6516','#fff3d9']].map(([i,t,n,c,b])=>'<div class="card"><span class="tile" style="--ink:'+c+';--tint:'+b+'">'+icon(i)+'</span><b>'+n+'</b><label>'+t+'</label></div>').join('')+'</div><div class="grid">'+panel('Inspection activity',trend,'<small>7 days</small>')+panel('Equipment exceptions',exceptions.map(([i,t,rs])=>'<details><summary class="row"><span>'+icon(i)+t+'</span><b>'+rs.length+'</b></summary>'+ (rs.length?rs.map(r=>'<p>'+esc([r.school,r.recorder,r.camera,r.location,r.fault].filter(Boolean).join(' · '))+'</p>').join(''):'<p>No matching records.</p>')+'</details>').join(''))+'</div>'+panel('Recent inspections',table(checks.slice(0,5),['date','school','kind','officer','detail']),account.role==='viewer'?'':'<button class="link" data-go="history">View history</button>')}
function table(rows,cols){return '<div class="scroll"><table><thead><tr>'+cols.map(c=>'<th>'+esc(names[c]||({kind:'Record type',detail:'Equipment',open:'Review'}[c]))+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>'<td>'+(c==='open'?'<button class="link" data-open="'+esc(r.id)+'">Open</button>':esc(c==='detail'?[r.recorder,r.camera,r.location].filter(Boolean).join(' · ')||'—':c==='kind'?pages[r.kind]:r[c]||'—'))+'</td>').join('')+'</tr>').join('')+'</tbody></table>'+(rows.length?'':'<div class="empty">No records for this selection.</div>')+'</div>'}
function render(){renderFilters();$('nav').innerHTML=Object.entries(pages).filter(([k])=>k!=="round"&&(account.role!=='viewer'||['overview','register','camera','recorder'].includes(k))).map(([k,v])=>'<button data-go="'+k+'" class="'+(k===page?'active':'')+'">'+icon(k)+v+'</button>').join('');$('new').hidden=account.role==='viewer';$('title').textContent=page==='overview'?'Inspection overview':pages[page];$('subtitle').textContent=intro[page];$('new').lastElementChild.textContent=(['camera','recorder'].includes(page)?'Inspect DVR channels':titles[page])||'New inspection';let rows=data.filter(r=>matches(r,page!=='register'));let cols={register:['school','recorder','camera','location','installation'],camera:['date','school','recorder','camera','location','live','playback'],recorder:['date','school','recorder','power','storage','monitor','channelSummary'],note:['date','school','officer','observation'],action:['date','school','action','owner','due','state'],history:['date','time','school','kind','detail','officer']};$('view').innerHTML=page==='overview'?overview(rows):panel(page==='history'?'Inspection records':pages[page],table(rows.filter(r=>page==='history'?r.kind!=='register':r.kind===page),account.role==='viewer'?cols[page]:[...cols[page],'open']),'<button class="link" id="print">Print report</button>');document.querySelectorAll('[data-go]').forEach(e=>e.onclick=()=>{page=e.dataset.go;render()});document.querySelectorAll('[data-open]').forEach(e=>e.onclick=()=>openForm(data.find(r=>r.id===e.dataset.open)));if($('print'))$('print').onclick=()=>window.print()}
function options(a,value){return '<option value="">Select…</option>'+a.map(v=>'<option '+(v===value?'selected':'')+'>'+esc(v)+'</option>').join('')}
function registerRows(base){
  const container=$('fields'), form=$('form').elements;
  container.insertAdjacentHTML('beforeend','<div id="cameraRows"></div><div class="bulk-tools"><button type="button" id="addCamera">＋ Add camera</button><button type="button" id="fill32">Fill to 32 rows</button></div>');
  const list=$('cameraRows');
  function sync(){
    $('save').textContent='Save '+list.children.length+(list.children.length===1?' camera':' cameras');
    $('fill32').disabled=list.children.length>=32;
    $('addCamera').disabled=list.children.length>=128;
  }
  function add(focus){
    const last=list.lastElementChild?.querySelector('[data-number]').value||'CAM 0';
    const next=last.replace(/(\d+)$/,digits=>String(Number(digits)+1).padStart(digits.length,'0'));
    const row=document.createElement('div');
    row.className='camera-entry';row.dataset.id=crypto.randomUUID();
    row.innerHTML='<label>Camera number<input data-number maxlength="200" required></label><label>Camera name / location<input data-location maxlength="200" required></label><button type="button" aria-label="Remove camera row">×</button><details><summary>Installation and remarks</summary><label>Installation status<select data-status><option>Installed</option><option>Not installed</option></select></label><label>Remarks<input data-remarks maxlength="3000"></label></details>';
    row.querySelector('[data-number]').value=last===next?'':next;
    row.querySelector('button').onclick=()=>{row.remove();if(!list.children.length)add(true);sync()};
    list.append(row);sync();if(focus)row.querySelector('[data-location]').focus();
  }
  form.school.oninput=()=>{
    const names=[...new Set(data.filter(r=>key(r.school)===key(form.school.value)).map(r=>r.recorder).filter(Boolean))];
    $('list-recorder').innerHTML=names.map(v=>'<option value="'+esc(v)+'">').join('');
  };
  form.school.oninput();$('addCamera').onclick=()=>add(true);
  $('fill32').onclick=()=>{while(list.children.length<32)add(false)};
  add(false);
}
function readRegisterRows(payload){
  const existing=new Set(data.filter(r=>r.kind==='register'&&key(r.school,r.recorder)===key(payload.school,payload.recorder)).map(r=>key(r.camera)));
  return [...$('cameraRows').children].map((row,i)=>{
    const camera=row.querySelector('[data-number]').value.trim(),location=row.querySelector('[data-location]').value.trim();
    if(existing.has(key(camera)))throw Error('Row '+(i+1)+': '+camera+' is already listed on this recorder.');
    existing.add(key(camera));return {id:row.dataset.id,camera,location,installation:row.querySelector('[data-status]').value,remarks:row.querySelector('[data-remarks]').value};
  });
}
function drawFields(r={}){let read=!!edit&&kind!=='action'&&kind!=='register';let base={school:filter.school,date:filter.date||day(),time:new Date().toTimeString().slice(0,5),state:'Open',...r};const bulk=kind==='register'&&!edit;$('save').textContent='Save record';let html=(bulk?['school','recorder']:fields[kind]).map(f=>{let v=base[f]||'',req=!optional.includes(f)&&!(kind==='action'&&['camera','recorder'].includes(f))&&!(kind==='register'&&f==='recorder'&&base.installation==='Not installed');let attr=' name="'+f+'" '+(req?'required ':'')+(read?'disabled ':'');let input=f==='school'?'<select'+attr+'>'+options(properties.map(p=>p.name),v)+'</select>':choices[f]?'<select'+attr+'>'+options(choices[f],v)+'</select>':['remarks','observation','action'].includes(f)?'<textarea maxlength="3000"'+attr+'>'+esc(v)+'</textarea>':'<input'+attr+' maxlength="200" list="list-'+f+'" type="'+(['earliest','due','date'].includes(f)?'date':f==='time'?'time':'text')+'" value="'+esc(v)+'">';let hints=[...new Set(data.filter(x=>f==='school'||!base.school||x.school===base.school).map(x=>x[f]).filter(Boolean))];return '<label class="'+(['remarks','observation','action'].includes(f)?'wide':'')+'">'+names[f]+input+(choices[f]?'':'<datalist id="list-'+f+'">'+hints.map(v=>'<option value="'+esc(v)+'">').join('')+'</datalist>')+'</label>'}).join('');$('fields').innerHTML=(!edit?'<label style="margin-bottom:16px">Record type<select id="type">'+['round',...Object.keys(fields).filter(k=>k!=='round')].map(k=>'<option value="'+k+'" '+(k===kind?'selected':'')+'>'+pages[k]+'</option>').join('')+'</select></label>':'')+'<div class="fields">'+html+'</div>';$('save').hidden=read;$('save').style.display=read?'none':'';$('cancel').textContent=read?'Close':'Cancel';if($('type'))$('type').onchange=e=>{let prev=Object.fromEntries(new FormData($('form')));kind=e.target.value;$('formTitle').textContent=titles[kind];drawFields(prev)};let f=$('form').elements;if(kind==='round')drawChannels(base,read);if(bulk)registerRows(base);else if(kind==='register')f.installation.onchange=()=>f.recorder.required=f.installation.value!=='Not installed';if(kind==='camera'&&!read){const fill=()=>{
  const registered=data.filter(x=>x.kind==='register'&&key(x.school,x.recorder)===key(f.school.value,f.recorder.value));
  $('list-camera').innerHTML=registered.map(x=>'<option value="'+esc(x.camera)+'">'+esc(x.location)+'</option>').join('');
  const match=registered.find(x=>key(x.camera)===key(f.camera.value));
  f.location.value=match?.location||'';
};f.camera.onchange=fill;f.school.onchange=fill;f.recorder.onchange=fill;fill()}}
function openForm(r){if(account.role==='viewer')return;edit=r||null;kind=r?.channels?'round':r?.kind||(['overview','camera','history','recorder'].includes(page)?'round':page);if(!r)channelDraft=null;$('formTitle').textContent=r?pages[kind]:titles[kind];$('error').textContent='';drawFields(r||{recorder:filter.recorder});$('modal').showModal()}
$('new').onclick=()=>openForm();$('close').onclick=$('cancel').onclick=()=>$('modal').close();
async function refresh(){let res=await apiFetch('/api/records',{cache:'no-store'});if(!res.ok)throw Error('Could not load the inspection records. Refresh to retry.');data=(await res.json()).flatMap(expandRound);data.sort((a,b)=>((b.date||'')+(b.time||'')).localeCompare((a.date||'')+(a.time||'')));render()}
$('form').onsubmit=async e=>{e.preventDefault();if(saving)return;saving=true;$('save').disabled=true;try{let payload=Object.fromEntries(new FormData($('form')));if(kind==='register'&&!edit)payload.rows=readRegisterRows(payload);if(kind==='round'){
payload.channels=snapshotChannels(payload);
if(payload.channels.every(c=>c.status==='Unchecked'))throw Error('Mark at least one channel before saving.');
}let res=await apiFetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:edit?.id||draftId,kind:payload.rows?'registerBatch':kind,payload,update:!!edit,version:edit?.version})});if(!res.ok)throw Error(await res.text());$('modal').close();$('notice').textContent=payload.rows?payload.rows.length+' camera entries saved.':'Record saved.';await refresh()}catch(err){($('modal').open?$('error'):$('notice')).textContent=err.message}finally{saving=false;$('save').disabled=false}};
const statuses=['Working','No view','Faulty camera','Faulty cable','Empty port','Unchecked'];
let channelDraft=null;
function expandRound(record){
  if(record.kind!=='round')return [record];
  const {channels,...shared}=record;
  const counts=statuses.map(s=>[s,channels.filter(c=>c.status===s).length]).filter(([,n])=>n);
  const summary=counts.map(([s,n])=>n+' '+s.toLowerCase()).join(', ');
  const parent={...shared,kind:'recorder',channels,channelSummary:summary};
  return [parent,...channels.map((c,i)=>({...shared,id:record.id+'-'+(i+1),kind:'camera',camera:c.camera,location:c.location,
    live:c.status==='Faulty camera'||c.status==='Faulty cable'?'No view':c.status,channelStatus:c.status,
    power:'Not checked',playback:'Not checked',fault:c.status==='Faulty camera'?'Camera':c.status==='Faulty cable'?'Cable':'None identified'}))];
}
function snapshotChannels(form){
  return channelDraft.values.slice(0,channelDraft.count).map((status,index)=>{
    const channel=index+1;
    const matches=data.filter(r=>r.kind==='register'&&key(r.school,r.recorder)===key(form.school,form.recorder)&&/^(?:(?:cam(?:era)?|ch(?:annel)?)[ -]*)?0*\d+$/i.test(r.camera)&&Number(r.camera.match(/\d+$/)[0])===channel);
    const match=matches.length===1?matches[0]:null;
    return {status,camera:match?.camera||'CH '+channel,location:match?.location||''};
  });
}
function drawChannels(base,read){
  if(read||!channelDraft)channelDraft={count:base.channels?.length||32,mode:'Working',values:Array.from({length:128},(_,i)=>base.channels?.[i]?.status||'Unchecked')};
  const draft=channelDraft, area=document.createElement('section');
  area.className='channel-panel';$('fields').append(area);
  function paint(){
    const counts=statuses.map(s=>[s,draft.values.slice(0,draft.count).filter(v=>v===s).length]).filter(([,n])=>n);
    const form=$('form').elements;
    const channels=read?base.channels:snapshotChannels({school:form.school.value,recorder:form.recorder.value});
    const badge=s=>'<span class="dot st'+statuses.indexOf(s)+'"></span>'+esc(s);
    area.innerHTML='<h3>DVR channels</h3>'+(read?'':'<p>Choose a status, then tap each matching channel. Use “Mark all working” when every channel or most channels have a picture.</p><div class="channel-tools"><label>Number of channels<input id="capacity" type="number" min="1" max="128" required value="'+draft.count+'"></label><button type="button" id="allWorking">Mark all working</button></div><div class="palette">'+statuses.map(s=>'<button type="button" data-mode="'+s+'" aria-pressed="'+(s===draft.mode)+'">'+badge(s)+'</button>').join('')+'</div>')+'<div class="channels">'+draft.values.slice(0,draft.count).map((s,i)=>'<button type="button" class="ch st'+statuses.indexOf(s)+'" '+(read?'disabled':'')+' data-channel="'+i+'" aria-label="Channel '+(i+1)+', '+s+'" title="'+s+'">'+String(i+1).padStart(2,'0')+(channels[i]?.location?'<small>'+esc(channels[i].location)+'</small>':'')+'</button>').join('')+'</div><div class="channel-summary">'+counts.map(([s,n])=>'<span>'+badge(s)+' <b>'+n+'</b></span>').join('')+'</div>';
    if(read)return;
    area.querySelector('#capacity').onchange=e=>{if(!e.target.reportValidity())return;draft.count=Number(e.target.value);paint()};
    area.querySelector('#allWorking').onclick=()=>{draft.values.fill('Working',0,draft.count);paint()};
    area.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{draft.mode=b.dataset.mode;paint()});
    area.querySelectorAll('[data-channel]').forEach(b=>b.onclick=()=>{draft.values[Number(b.dataset.channel)]=draft.mode;paint()});
  }
  if(!read){
    const f=$('form').elements;
    f.school.onchange=paint;
    f.recorder.onchange=paint;
  }
  paint();
}
let draftId=crypto.randomUUID();$('modal').addEventListener('close',()=>draftId=crypto.randomUUID());startAccount();

