const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const paths={eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',eyeOff:'M3 3l18 18 M10 5c7-2 12 7 12 7s-1 2-3 4 M6 6c-2 2-4 6-4 6s4 7 10 7c1 0 3 0 4-1',incident:'M4 3h16v18H4z M12 7v6 M12 16h.01',overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',register:'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5',camera:'M3 6h13v12H3z M16 10l5-3v10l-5-3',recorder:'M3 4h18v7H3z M3 14h18v7H3z M6 8h1 M6 18h1',note:'M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h5',action:'M3 6l2 2 4-5 M11 6h10 M3 14l2 2 4-5 M11 14h10',lock:'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3',shield:'M12 2l8 4v6q0 6-8 10-8-4-8-10V6z',plus:'M12 5v14 M5 12h14',school:'M2 10l10-7 10 7 M4 10h16v11H4z M10 21v-6h4v6',date:'M3 6h18v15H3z M7 3v6 M17 3v6 M3 11h18',check:'M3 12l6 6L21 5',alert:'M12 3l10 18H2z M12 9v5 M12 17v1',display:'M2 4h20v13H2z M12 17v4 M7 21h10',cable:'M5 3v5 M9 3v5 M3 8h8v3a4 4 0 0 1-8 0z M7 15v3a3 3 0 0 0 6 0v-3h6',history:'M4 8a9 9 0 1 1-1 7 M3 3v6h6 M12 7v6l4 2'};
const icon=k=>'<svg aria-hidden="true" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[k]+'"/></svg>';
document.querySelectorAll('[data-icon]').forEach(e=>e.outerHTML=icon(e.dataset.icon));
const pages={overview:'Daily Status',register:'Camera Register',camera:'Daily Camera Checks',recorder:'DVR/NVR Checks',note:'Observations',incident:'Incident Log',action:'Action Points',history:'Inspection History'};
const intro={incident:'Find incidents by date, property, recorder or camera. Times refer to the incident, not when this entry was saved.',overview:'The dashboard shows the latest update for each DVR or NVR through the selected date.',register:'Track installed cameras and planned coverage by property.',camera:'Record live view, playback and camera faults for each shift.',recorder:'Review power, storage, playback and connected displays.',note:'Keep shift observations and handover notes.',action:'Track follow-up work through to completion.',history:'Review previous inspections and print filtered reports.'};
const titles={incident:'Record incident',register:'Register cameras',camera:'New camera check',recorder:'New recorder check',note:'Add observation',action:'Add action point'};
const names={incidentTitle:'Incident title',description:'What happened',endTime:'End time (same day, optional)',recorderTime:'DVR clock / playback time notes',loggedAt:'Logged at (UTC)',school:'Property',date:'Inspection date',time:'Inspection time',officer:'Officer',shift:'Shift',camera:'Camera number',location:'Camera title / location',recorder:'Assigned DVR/NVR',installation:'Installation status',live:'Live view',playback:'Recording / playback',power:'Power status',fault:'Replacement required',storage:'HDD / storage health',earliest:'Earliest available recording',monitor:'TV / monitor',remarks:'Remarks',observation:'Overall observation',action:'Action point',owner:'Assign to (email addresses)',dateAccuracy:'Recorder date accuracy',timeAccuracy:'Recorder time accuracy',replacements:'Replacement required',due:'Due date',state:'Action status',channelSummary:'Channels inspected'};
const common=['school','date','time','officer','shift'];
const systemFields=['storage','dateAccuracy','timeAccuracy','power','playback','monitor','earliest','replacements'];
const fields={incident:['school','recorder','camera','location','date','time','endTime','officer','incidentTitle','description','recorderTime','remarks'],register:['school','recorder','camera','location','installation','remarks'],camera:[...common,'recorder','camera','location','live','playback','power','fault','remarks'],recorder:[...common,'recorder',...systemFields,'remarks'],note:[...common,'observation','remarks'],action:[...common,'camera','recorder','action','owner','due','state','remarks']};
const choices={shift:['Morning','Afternoon','Night','Day'],installation:['Installed','Not installed'],live:['Working','No view','Intermittent','Not checked','Empty port','Unchecked'],playback:['Working','Failed','Not checked'],power:['On','Off','Unstable','Not checked'],fault:['None identified','Camera','Cable','Camera and cable','Under investigation'],storage:['Healthy','Warning','Failed','Not checked'],dateAccuracy:['Accurate','Incorrect','Corrected during inspection','Not checked'],timeAccuracy:['Accurate','Incorrect','Corrected during inspection','Not checked'],monitor:['Working','Faulty','Not installed','Not checked'],state:['Open','In progress','Completed']};
fields.round=[...common,'recorder',...systemFields,'remarks'];
titles.round='Inspect CCTV system';
pages.round='CCTV system inspection';
const optional=['dateAccuracy','timeAccuracy','replacements','earliest','remarks','due','owner','endTime','recorderTime'];let data=[],page='overview',filter={school:'',date:'',camera:'',recorder:''},kind='camera',edit=null,saving=false;
const key=(...v)=>JSON.stringify(v.map(x=>(x||'').trim().toLowerCase()));
const day=(offset=0)=>{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=type=>parts.find(entry=>entry.type===type).value;
  const date=new Date(part('year')+'-'+part('month')+'-'+part('day'));
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
};
function localDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function matches(r,withDate=true){return Object.entries(filter).every(([k,v])=>!v||(!withDate&&k==='date')||r[k]===v)}
function latest(list,keys){let m=new Map();for(let r of list){let k=key(...keys.map(f=>r[f]));if(!m.has(k))m.set(k,r)}return [...m.values()]}
let recorders=[];
function recordersFor(school){
  return recorders.filter(device=>!school||device.school===school);
}
function filterValues(field){
  if(field==='school')return typeof properties==='undefined'?[]:properties.map(p=>p.name);
  if(field==='recorder')return [...new Set(recordersFor(filter.school).map(device=>device.name))].sort();
  return [...new Set(data.filter(row=>(!filter.school||row.school===filter.school)&&(!filter.recorder||row.recorder===filter.recorder)).map(row=>row.camera).filter(Boolean))].sort();
}
function scopedRecorderCatalog(){
  return recordersFor(filter.school).filter(device=>!filter.recorder||device.name===filter.recorder)
    .map(device=>({school:device.school,recorder:device.name}));
}
function renderFilters(){if(page==='overview'&&!filter.date)filter.date=day();let items=['school','recorder','camera'];$('filters').innerHTML=items.map(k=>'<label>'+icon(k==='school'?'school':k)+'<select aria-label="Filter by '+k+'" data-filter="'+k+'"><option value="">All '+({school:'properties',camera:'cameras',recorder:'recorders'}[k])+'</option>'+filterValues(k).map(v=>'<option '+(filter[k]===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>').join('')+(page==='register'?'':'<label>'+icon('date')+'<input aria-label="Filter record date" type="date" data-filter="date" value="'+filter.date+'"></label>')+(page==='incident'?incidentSearchForm('incidentSearchForm','Search within selected filters'):'')+((Object.values(filter).some(Boolean)||incidentQuery)?'<button id="reset">Clear filters</button>':'');$('filters').querySelectorAll('[data-filter]').forEach(e=>e.onchange=()=>{filter[e.dataset.filter]=e.value;if(e.dataset.filter==='school'){filter.camera='';filter.recorder=''}if(e.dataset.filter==='recorder')filter.camera='';render()});if(page==='incident')bindIncidentSearch('incidentSearchForm',false);if($('reset'))$('reset').onclick=()=>{for(let k in filter)filter[k]='';incidentQuery='';render()}}
let incidentQuery='';
function incidentSearchForm(id,label){return '<form id="'+id+'" class="incident-search"><label>'+label+'<input name="query" aria-label="Search incidents" type="search" placeholder="Title, date, property, DVR, camera or details" value="'+esc(incidentQuery)+'"></label><button type="submit" class="primary">Search</button></form>'}
function bindIncidentSearch(id,allDates){const form=$(id);if(form)form.onsubmit=e=>{e.preventDefault();incidentQuery=form.elements.query.value.trim();if(allDates)filter.date='';page='incident';render()}}
function incidentDashboard(rows){
  if(!can('manage_incidents')&&!can('view_reports'))return '';
  const incidents=rows.filter(r=>r.kind==='incident');
  return panel('Incident reports · '+incidents.length,'<p>Incidents on '+esc(filter.date)+'. Open a report for the event details and DVR playback notes.</p>'+table(incidents,['time','school','recorder','camera','location','incidentTitle','open'])+incidentSearchForm('dashboardIncidentSearch','Search incidents across all dates'),'<button class="link" data-go="incident">View all incidents</button>');
}
const blueprint='<div class="drawing" aria-hidden="true"><svg viewBox="0 0 300 160" fill="none"><g stroke="#a8cbe9" stroke-width="2" stroke-linejoin="round"><path fill="#285786" d="m75 58 84-33 67 22-83 36z"/><path fill="#204973" d="m75 58 68 25-6 32-63-25z"/><path fill="#37658e" d="m143 83 83-36-8 32-81 36z"/><path d="m82 64 51 20-4 23-49-20z"/><ellipse cx="105" cy="85" rx="12" ry="9" transform="rotate(24 105 85)"/><ellipse cx="105" cy="85" rx="6" ry="5" transform="rotate(24 105 85)"/><path d="m168 104 2 11 28 12 29-13 M175 100l2 10 23 10 25-12 M225 100l13-5v25l-13 5z M165 76l34-15 M162 82l36-16"/></g><g stroke="#91bbdf" opacity=".6" stroke-dasharray="3 4"><path d="M53 43v60 M43 53h20 M217 30h42 M246 22v16 M44 120l70 25"/></g></svg></div>';
function panel(title,body,extra=''){return '<section class="panel"><div class="sect"><h2>'+title+'</h2>'+extra+'</div>'+body+'</section>'}
function cameraIdentifier(row){
  const camera=String(row.camera||'').trim();
  const numeric=camera.match(/^(?:(?:cam(?:era)?|ch(?:annel)?)[ -]*)?0*(\d+)$/i);
  return key(row.school,row.recorder,numeric?String(Number(numeric[1])):camera);
}
function summarizeCameras(rows,register){
  const inventory=new Map(register.filter(r=>r.installation==='Installed').map(r=>[cameraIdentifier(r),r]));
  const checks=new Map();
  const ids=new Set(inventory.keys());
  for(const row of rows){
    if(row.kind!=='camera'||!row.camera)continue;
    const live=row.channelStatus||row.live;
    if(!live||['Unchecked','Not checked'].includes(live))continue;
    const id=cameraIdentifier(row);
    if(live!=='Empty port')ids.add(id);
    if(!checks.has(id))checks.set(id,row);
  }
  let notLive=0,working=0,unchecked=0;
  const faults=[];
  for(const id of ids){
    const row=checks.get(id);
    const live=row?.channelStatus||row?.live;
    const issues=[];
    if(['No view','Intermittent','Faulty camera','Faulty cable','Empty port'].includes(live)){
      notLive++;
      issues.push(live==='Empty port'?'No feed on registered channel':live);
    }
    if(row?.playback==='Failed')issues.push('Playback failed');
    if(['Off','Unstable'].includes(row?.power))issues.push('Power '+row.power.toLowerCase());
    if(['Camera','Cable','Camera and cable'].includes(row?.fault)&&!issues.some(issue=>issue===live&&live?.startsWith('Faulty')))issues.push(row.fault+' replacement required');
    if(!live)unchecked++;
    if(issues.length)faults.push({...inventory.get(id),...row,issues});
    else if(live==='Working')working++;
  }
  const total=ids.size;
  const offlineRate=total?notLive/total*100:0;
  const exposure=total?faults.length/total*100:0;
  const recommendation=offlineRate>=50?'Escalate immediately for emergency technical servicing and arrange temporary monitoring for affected areas.'
    :offlineRate>=25?'Arrange urgent technical servicing and prioritise high-traffic or sensitive areas.'
    :offlineRate>10?'Call for technical servicing to restore the affected cameras.'
    :faults.length?'Log the affected cameras for follow-up and recheck after repair.':'';
  return {total,notLive,working,unchecked,faults,offlineRate,exposure,recommendation};
}
function reportPercent(value){
  return new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(value)+'%';
}
function actionPointsForDay(records,filters){
  return records.filter(r=>r.kind==='action'&&(!filters.school||r.school===filters.school)
    &&(!filters.recorder||!r.recorder||r.recorder===filters.recorder)
    &&(!filters.camera||!r.camera||r.camera===filters.camera)
    &&(r.date===filters.date||(r.date<filters.date&&r.state!=='Completed')));
}
function actionRecipients(value=''){
  const emails=String(value).split(',').map(email=>email.trim()).filter(Boolean);
  return emails.every(email=>/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*$/i.test(email))?[...new Set(emails)]:[];
}
function latestDeviceChecks(records, filters){
  const scope=records.filter(row=>row.date&&row.date<=filters.date&&(!filters.school||row.school===filters.school)&&(!filters.recorder||row.recorder===filters.recorder));
  const roundByDevice=new Map();
  const recorderByDevice=new Map();
  const positions=new Map();
  scope.forEach((row,index)=>{
    if(row.kind!=='recorder')return;
    const device=key(row.school,row.recorder);
    positions.set(row.id,index);
    if(!recorderByDevice.has(device))recorderByDevice.set(device,row);
    if(row.channels&&!roundByDevice.has(device))roundByDevice.set(device,row);
  });
  const cameras=new Map();
  scope.forEach((row,index)=>{
    if(row.kind!=='camera')return;
    const id=cameraIdentifier(row);
    if((filters.camera&&row.camera!==filters.camera)||cameras.has(id))return;
    const round=roundByDevice.get(key(row.school,row.recorder));
    if(row.parentId ? row.parentId!==round?.id : round&&index>positions.get(round.id))return;
    cameras.set(id,row);
  });
  return [...recorderByDevice.values(),...cameras.values()];
}
function latestSummaryDevices(checks,inventory){
  const devices=new Map();
  for(const row of [...checks,...inventory]){
    if(!row.recorder)continue;
    const id=key(row.school,row.recorder);
    const prior=devices.get(id);
    if(!prior||(row.date||'')+(row.time||'')>(prior.date||'')+(prior.time||''))devices.set(id,row);
  }
  return [...devices.values()];
}

function overview(rows){
const snapshots=latestDeviceChecks(data,filter),inventory=data.filter(r=>r.kind==='register'&&matches(r,false));
const cams=snapshots.filter(r=>r.kind==='camera'),rec=snapshots.filter(r=>r.kind==='recorder');
const {working,faults}=summarizeCameras(cams,inventory),failed=faults.length;
const actions=actionPointsForDay(data,filter),checks=snapshots.filter(r=>!['Unchecked','Empty port','Not checked'].includes(r.channelStatus||r.live));
const devices=latestSummaryDevices(snapshots,[...inventory,...scopedRecorderCatalog()]);
let exceptions=[['camera','Locations with no view',cams.filter(r=>r.live==='No view')],['cable','Camera or cable replacements',cams.filter(r=>['Camera','Cable','Camera and cable'].includes(r.fault))],['register','Cameras not installed',data.filter(r=>r.kind==='register'&&matches(r,false)&&r.installation==='Not installed')],['display','Faulty TVs / monitors',rec.filter(r=>r.monitor==='Faulty')]];
let end=filter.date||day(),dates=Array.from({length:7},(_,i)=>{let d=new Date(end+'T12:00:00');d.setDate(d.getDate()-6+i);return localDate(d)}),counts=dates.map(d=>data.filter(r=>matches(r,false)&&r.date===d&&['camera','recorder'].includes(r.kind)&&(!r.channelStatus||!['Unchecked','Empty port'].includes(r.channelStatus))).length),max=Math.max(1,...counts);
let trend='<div class="chart" role="img" aria-label="'+dates.map((d,i)=>d+' '+counts[i]+' checks').join(', ')+'">'+counts.map((n,i)=>'<div class="bar" style="height:'+100*n/max+'%" title="'+dates[i]+': '+n+' checks"></div>').join('')+'</div><div class="axis">'+dates.map(d=>'<span>'+d.slice(8)+'</span>').join('')+'</div><div class="legend">Completed checks · '+esc(dates[0])+' to '+esc(end)+'</div>';
return '<section class="hero"><div><div class="tag">INSPECTION SUMMARY</div><h2>Daily status report</h2><p>'+esc(filter.school||'All properties')+' · '+esc(filter.date||day())+'</p>'+(can('view_reports')?'<button id="shareDailyReport" type="button">Share daily PDF</button>':'')+'</div>'+blueprint+'</section><div class="cards">'+[['check','Working cameras',working,'#167156','#e4f6ee'],['alert','Cameras with faults',failed,'#b23e49','#fcebef'],['recorder','Checks in latest updates',checks.length,'#245da2','#e8f1ff'],['action','Outstanding action points',actions.filter(r=>r.state!=='Completed').length,'#9a6516','#fff3d9']].map(([i,t,n,c,b])=>'<div class="card"><span class="tile" style="--ink:'+c+';--tint:'+b+'">'+icon(i)+'</span><b>'+n+'</b><label>'+t+'</label></div>').join('')+'</div>'+(!checks.length?'<div class="empty">No inspection updates through this date.</div>':'')+(devices.length?panel('Latest DVR/NVR updates',table(devices,['school','recorder','date','time']),can('view_reports')?'<button class="link" data-go="history">View history</button>':''):'')+(can('manage_actions')||can('view_reports')?panel('Action points',table(actions,['date','school','action','owner','due','state']),'<button class="link" data-go="action">View all action points</button>'):'')+incidentDashboard(rows)+'<div class="grid">'+panel('Inspection activity',trend,'<small>7 days</small>')+panel('Equipment exceptions',exceptions.map(([i,t,rs])=>'<details><summary class="row"><span>'+icon(i)+t+'</span><b>'+rs.length+'</b></summary>'+ (rs.length?rs.map(r=>'<p>'+esc([r.school,r.recorder,r.camera,r.location,r.fault].filter(Boolean).join(' · '))+'</p>').join(''):'<p>No matching records.</p>')+'</details>').join(''))+'</div>'}
function table(rows,cols){return '<div class="scroll"><table><thead><tr>'+cols.map(c=>'<th>'+esc(names[c]||({kind:'Record type',detail:'Equipment',open:'Review'}[c]))+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>'<td>'+(c==='open'?'<button class="link" data-open="'+esc(r.id)+'">Open</button>':esc(c==='detail'?[r.recorder,r.camera,r.location].filter(Boolean).join(' · ')||'—':c==='kind'?pages[r.kind]:r[c]||'—'))+'</td>').join('')+'</tr>').join('')+'</tbody></table>'+(rows.length?'':'<div class="empty">No records for this selection.</div>')+'</div>'}
function render(){renderFilters();$('nav').innerHTML=Object.entries(pages).filter(([k])=>k!=="round"&&(['overview','register','camera','recorder'].includes(k)||can('view_reports')||can(permissionForKind[k]))).map(([k,v])=>'<button data-go="'+k+'" class="'+(k===page?'active':'')+'">'+icon(k)+v+'</button>').join('');$('new').hidden=!can(permissionForKind[['overview','history','camera','recorder'].includes(page)?'round':page]);$('title').textContent=page==='overview'?'Daily status report':pages[page];$('subtitle').textContent=intro[page];$('new').lastElementChild.textContent=(['camera','recorder'].includes(page)?'Inspect CCTV system':titles[page])||'New inspection';let rows=data.filter(r=>matches(r,page!=='register'));let cols={incident:['date','time','school','recorder','camera','location','incidentTitle'],register:['school','recorder','camera','location','installation'],camera:['date','school','recorder','camera','location','live','playback'],recorder:['date','school','recorder','power','storage','monitor','channelSummary'],note:['date','school','officer','observation'],action:['date','school','action','owner','due','state'],history:['date','time','school','kind','detail','officer']};$('view').innerHTML=page==='overview'?overview(rows):panel(page==='history'?'Inspection records':pages[page],table(rows.filter(r=>page==='history'?r.kind!=='register':r.kind===page).filter(r=>page!=='incident'||!incidentQuery||[r.incidentTitle,r.description,r.location,r.remarks,r.recorderTime,r.school,r.recorder,r.camera,r.date,r.time,r.officer].some(v=>String(v||'').toLowerCase().includes(incidentQuery.toLowerCase()))),!(can(permissionForKind[page])||(['incident','history'].includes(page)&&can('view_reports')))?cols[page]:[...cols[page],'open']),'<button class="link" id="print">Print report</button>');document.querySelectorAll('[data-go]').forEach(e=>e.onclick=()=>{const next=e.dataset.go;if(next==='overview')filter.date=day();else if(page==='overview')filter.date='';page=next;render()});document.querySelectorAll('[data-open]').forEach(e=>e.onclick=()=>openForm(data.find(r=>r.id===e.dataset.open)));if(page==='overview')bindIncidentSearch('dashboardIncidentSearch',true);if($('shareDailyReport'))$('shareDailyReport').onclick=()=>showDailyReport(rows);if($('print'))$('print').onclick=()=>window.print()}
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
  $('addCamera').onclick=()=>add(true);
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
function inspectionFormValues(){
  const form=new FormData($('form'));
  const values=Object.fromEntries(form);
  if(['round','recorder'].includes(kind))values.replacements=form.getAll('replacements').join(', ');
  return values;
}
function drawFields(r={}){let read=!!edit&&(!can(permissionForKind[kind])||(account?.role!=='technician'&&!['action','register'].includes(kind)));let base={school:filter.school||(properties.length===1?properties[0].name:''),date:filter.date||day(),time:new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit'}).format(new Date()),state:'Open',...r};const bulk=kind==='register'&&!edit;$('save').textContent='Save record';$('save').disabled=false;let html=(bulk?['school','recorder']:fields[kind]).map(f=>{if(f==='replacements')return '<fieldset class="wide replacement-options"><legend>Replacement required</legend>'+['Camera','Power pack','HDD'].map(part=>'<label class="permission-option"><input type="checkbox" name="replacements" value="'+part+'" '+(String(base.replacements||'').split(', ').includes(part)?'checked ':'')+(read?'disabled ':'')+'>'+part+'</label>').join('')+'</fieldset>';
if(f==='recorder')return '<label>'+names.recorder+'<select name="recorder" '+(read?'disabled':'')+'></select><span id="recorderPrompt"></span></label>';
if(f==='owner'){
  const legacy=base.owner&&!actionRecipients(base.owner).length;
  return '<label class="wide">'+names.owner+'<input type="email" multiple name="owner" maxlength="1000" placeholder="name@example.com, another@example.com" value="'+esc(legacy?'':base.owner||'')+'" '+(read?'disabled':'')+'><small>'+(legacy?'Previous assignee: '+esc(base.owner)+'. ':'')+'Separate multiple addresses with commas.</small></label>';
}
let v=base[f]||'',req=!(kind==='round'&&systemFields.includes(f))&&!optional.includes(f)&&!(kind==='action'&&['camera','recorder'].includes(f))&&!(kind==='register'&&f==='recorder'&&base.installation==='Not installed');let attr=' name="'+f+'" '+(req?'required ':'')+(read?'disabled ':'')+(f==='date'&&account?.role==='technician'?'max="'+day()+'" '+(edit?'readonly ':''):'');let input=f==='school'?'<select'+attr+'>'+options(properties.map(p=>p.name),v)+'</select>':choices[f]?'<select'+attr+'>'+options(choices[f],v)+'</select>':['remarks','observation','action','description','recorderTime'].includes(f)?'<textarea maxlength="3000"'+attr+'>'+esc(v)+'</textarea>':'<input'+attr+' maxlength="200" list="list-'+f+'" type="'+(['earliest','due','date'].includes(f)?'date':['time','endTime'].includes(f)?'time':'text')+'" value="'+esc(v)+'">';let hints=[...new Set(data.filter(x=>f==='school'||!base.school||x.school===base.school).map(x=>x[f]).filter(Boolean))];return '<label class="'+(['remarks','observation','action','description','recorderTime'].includes(f)?'wide':'')+'">'+(kind==='incident'&&f==='date'?'Incident date':kind==='incident'&&f==='time'?'Incident start time (local)':names[f])+input+(choices[f]?'':'<datalist id="list-'+f+'">'+hints.map(v=>'<option value="'+esc(v)+'">').join('')+'</datalist>')+'</label>'}).join('');$('fields').innerHTML=(kind==='incident'?'<p>Use the incident’s local time. If the DVR clock differs, enter the displayed playback time in DVR clock notes. This log does not save video footage.</p>':'')+(!edit?'<label style="margin-bottom:16px">Record type<select id="type">'+['round',...Object.keys(fields).filter(k=>k!=='round')].filter(k=>can(permissionForKind[k])).map(k=>'<option value="'+k+'" '+(k===kind?'selected':'')+'>'+pages[k]+'</option>').join('')+'</select></label>':'')+'<div class="fields">'+html+'</div>';$('save').hidden=read;$('save').style.display=read?'none':'';$('cancel').textContent=read?'Close':'Cancel';if($('type'))$('type').onchange=e=>{let prev=inspectionFormValues();kind=e.target.value;$('formTitle').textContent=titles[kind];drawFields(prev)};let f=$('form').elements;
const paintChannels=kind==='round'?drawChannels(base,read):null;
if(bulk)registerRows(base);
if(f.recorder)bindRecorderPicker(base,read,paintChannels);
if(f.date&&!read&&account?.role==='technician'){
  f.date.addEventListener('input',updateDateControls);
  updateDateControls();
}
}
function bindRecorderPicker(base,read,paintChannels){
  const form=$('form').elements;
  const select=form.recorder;
  const prompt=$('recorderPrompt');
  function fillCamera(clear){
    if(!['camera','incident'].includes(kind)||read)return;
    const registered=data.filter(row=>row.kind==='register'&&key(row.school,row.recorder)===key(form.school.value,select.value));
    $('list-camera').innerHTML=registered.map(row=>'<option value="'+esc(row.camera)+'">'+esc(row.location)+'</option>').join('');
    if(clear){form.camera.value='';form.location.value='';}
  }
  function picker(value,clear){
    const school=form.school.value;
    const devices=school?recordersFor(school):[];
    const names=devices.map(device=>device.name);
    const desired=names.find(name=>key(name)===key(value))||(read?value:'')||(names.length===1?names[0]:'');
    if(read&&desired&&!names.includes(desired))names.push(desired);
    select.innerHTML=options(names,desired);
    select.required=kind!=='action'&&!(kind==='register'&&form.installation?.value==='Not installed');
    prompt.replaceChildren();
    if(!read&&!school)prompt.textContent='Choose a property to see its registered recorders.';
    if(!read&&school&&!devices.length){
      if(canRegisterRecorder()){
        const button=document.createElement('button');
        button.type='button';
        button.textContent='Register a DVR/NVR for this property';
        button.onclick=()=>showRecorderRegister(school,device=>{picker(device.name,true);select.focus()});
        prompt.append(button);
      }else{
        prompt.textContent='No DVR/NVR is registered. Ask your administrator or camera registrar to add one for this property.';
      }
    }
    if(paintChannels)paintChannels(clear);
    fillCamera(clear);
  }
  select.addEventListener('change',()=>{if(paintChannels)paintChannels(true);fillCamera(true)});
  form.school.addEventListener('change',()=>picker('',true));
  if(form.installation)form.installation.addEventListener('change',()=>picker(select.value,false));
  if(form.camera&&['camera','incident'].includes(kind))form.camera.addEventListener('change',()=>{
    const match=data.find(row=>row.kind==='register'&&key(row.school,row.recorder,row.camera)===key(form.school.value,select.value,form.camera.value));
    if(match)form.location.value=match.location;
  });
  picker(base.recorder,false);
}
function updateDateControls(){
  const date=$('form').elements.date?.value;
  const previous=$('dateRestriction');
  if(previous)previous.remove();
  const request=dateRequests.find(row=>row.inspection_date===date);
  const future=date>day(), old=date&&date<day(-3)&&request?.status!=='approved';
  $('save').disabled=Boolean(future||old||saving);
  if(!future&&!old)return;
  const prompt=document.createElement('div');
  prompt.id='dateRestriction';
  prompt.innerHTML=future?'<p>Technicians cannot save future inspections.</p>':request?.status==='pending'
    ?'<p>This date is awaiting administrator approval.</p>'
    :'<p>Administrator approval is required for this date.</p><button type="button">Request permission</button>';
  const button=prompt.querySelector('button');
  if(button)button.onclick=()=>showDateRequests(date);
  $('fields').append(prompt);
}
function openForm(r){
  if(r?.parentId)r=data.find(row=>row.id===r.parentId);
  const selected=r?.channels?'round':r?.kind||(['overview','camera','history','recorder'].includes(page)?'round':page);
  if(!can(permissionForKind[selected])&&!(r&&can('view_reports')))return;
  edit=r||null;kind=selected;channelDraft=null;
  $('formTitle').textContent=r?pages[kind]:titles[kind];
  $('error').textContent='';$('save').disabled=false;
  drawFields(r||{recorder:filter.recorder});
  $('modal').showModal();
}
$('new').onclick=()=>openForm();$('close').onclick=$('cancel').onclick=()=>$('modal').close();
async function refresh(){let res=await apiFetch('/api/records',{cache:'no-store'});if(!res.ok)throw Error('Could not load the inspection records. Refresh to retry.');data=(await res.json()).flatMap(row=>{
  const owner=recordersFor(row.school).find(device=>key(device.name)===key(row.recorder));
  return expandRound(owner?{...row,recorder:owner.name}:row);
});data.sort((a,b)=>((b.date||'')+(b.time||'')).localeCompare((a.date||'')+(a.time||'')));render()}
$('form').onsubmit=async e=>{e.preventDefault();if(saving)return;saving=true;$('save').disabled=true;try{const recordId=edit?.id||draftId;let payload=inspectionFormValues();if(kind==='register'&&!edit)payload.rows=readRegisterRows(payload);if(kind==='round'){
payload.channels=snapshotChannels(payload);
if(payload.channels.every(c=>c.status==='Unchecked')&&!systemFields.some(field=>payload[field]&&payload[field]!=='Not checked'))throw Error('Record a system check or mark at least one channel before saving.');
}if(kind==='action'&&!payload.owner&&edit?.owner&&!actionRecipients(edit.owner).length)payload.owner=edit.owner;let res=await apiFetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:recordId,kind:payload.rows?'registerBatch':kind,payload,update:!!edit,version:edit?.version})});if(!res.ok)throw Error(await res.text());$('modal').close();$('notice').textContent=payload.rows?payload.rows.length+' camera entries saved.':'Record saved.';if(kind==='action'){
  const {email}=await res.json();
  const message={sent:'Email accepted for delivery.',unconfigured:'Email not sent. An email sender has not been configured.',failed:'Email not sent. The email provider did not accept the request.'}[email];
  if(message)$('notice').textContent+=' '+message;
}await refresh()}catch(err){($('modal').open?$('error'):$('notice')).textContent=err.message}finally{saving=false;$('save').disabled=false}};
const statuses=['Working','No view','Faulty camera','Faulty cable','Empty port','Unchecked'];
let channelDraft=null;
function expandRound(record){
  if(record.kind!=='round')return [record];
  const {channels,...shared}=record;
  const counts=statuses.map(s=>[s,channels.filter(c=>c.status===s).length]).filter(([,n])=>n);
  const summary=counts.map(([s,n])=>n+' '+s.toLowerCase()).join(', ');
  const parent={...shared,kind:'recorder',channels,channelSummary:summary};
  return [parent,...channels.map((c,i)=>({...shared,id:record.id+'-'+(i+1),kind:'camera',parentId:record.id,camera:c.camera,location:c.location,
    live:c.status==='Faulty camera'||c.status==='Faulty cable'?'No view':c.status,channelStatus:c.status,
    power:'Not checked',playback:'Not checked',fault:c.status==='Faulty camera'?'Camera':c.status==='Faulty cable'?'Cable':'None identified'}))];
}
function snapshotChannels(form){
  return channelDraft.values.slice(0,channelDraft.count).map((status,index)=>{
    const channel=index+1;
    const matches=data.filter(r=>r.kind==='register'&&key(r.school,r.recorder)===key(form.school,form.recorder)&&/^(?:(?:cam(?:era)?|ch(?:annel)?)[ -]*)?0*\d+$/i.test(r.camera)&&Number(r.camera.match(/\d+$/)[0])===channel);
    const match=matches.length===1?matches[0]:null;
    const previous=edit&&key(edit.school,edit.recorder)===key(form.school,form.recorder)?edit.channels?.[index]:null;
    return {status,camera:previous?.camera||match?.camera||'CH '+channel,location:previous?.location??match?.location??''};
  });
}
function drawChannels(base,read){
  if(read||!channelDraft)channelDraft={count:base.channels?.length||32,mode:'Working',values:Array.from({length:128},(_,i)=>base.channels?.[i]?.status||'Unchecked')};
  const draft=channelDraft, area=document.createElement('section');
  area.className='channel-panel';$('fields').append(area);
  function paint(reset=false){
    const form=$('form').elements;
    if(reset){draft.count=32;draft.values.fill('Unchecked');}
    if(!read&&!form.recorder.value){area.hidden=true;return;}
    area.hidden=false;
    const counts=statuses.map(s=>[s,draft.values.slice(0,draft.count).filter(v=>v===s).length]).filter(([,n])=>n);
    const channels=read?base.channels:snapshotChannels({school:form.school.value,recorder:form.recorder.value});
    const badge=s=>'<span class="dot st'+statuses.indexOf(s)+'"></span>'+esc(s);
    area.innerHTML='<h3>DVR channels</h3>'+(read?'':'<p>Choose a status, then tap each matching channel. Use “Mark all working” when every channel or most channels have a picture.</p><div class="channel-tools"><label>Number of channels<input id="capacity" type="number" min="1" max="128" required value="'+draft.count+'"></label><button type="button" id="allWorking">Mark all working</button></div><div class="palette">'+statuses.map(s=>'<button type="button" data-mode="'+s+'" aria-pressed="'+(s===draft.mode)+'">'+badge(s)+'</button>').join('')+'</div>')+'<div class="channels">'+draft.values.slice(0,draft.count).map((s,i)=>'<button type="button" class="ch st'+statuses.indexOf(s)+'" '+(read?'disabled':'')+' data-channel="'+i+'" aria-label="Channel '+(i+1)+', '+s+'" title="'+s+'">'+String(i+1).padStart(2,'0')+(channels[i]?.location?'<small>'+esc(channels[i].location)+'</small>':'')+'</button>').join('')+'</div><div class="channel-summary">'+counts.map(([s,n])=>'<span>'+badge(s)+' <b>'+n+'</b></span>').join('')+'</div>';
    if(read)return;
    area.querySelector('#capacity').onchange=e=>{if(!e.target.reportValidity())return;draft.count=Number(e.target.value);paint()};
    area.querySelector('#allWorking').onclick=()=>{draft.values.fill('Working',0,draft.count);paint()};
    area.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{draft.mode=b.dataset.mode;paint()});
    area.querySelectorAll('[data-channel]').forEach(b=>b.onclick=()=>{draft.values[Number(b.dataset.channel)]=draft.mode;paint()});
  }
  return paint;
}
let draftId=crypto.randomUUID();$('modal').addEventListener('close',()=>draftId=crypto.randomUUID());startAccount();

