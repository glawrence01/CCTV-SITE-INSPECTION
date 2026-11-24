import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',lastElementChild:{},querySelectorAll:()=>[],addEventListener(){}});return elements.get(id)}
const context=vm.createContext({document:{getElementById:el,querySelectorAll:()=>[]},crypto,Date,console,startAccount(){},can:()=>true,permissionForKind:{},account:{},window:{}});
vm.runInContext(readFileSync('ui/app.js','utf8'),context);
vm.runInContext(`data=[{kind:'camera',date:day(-1),time:'10:00',school:'School A',recorder:'DVR 1',camera:'old',location:'YESTERDAY_ONLY',live:'Working',playback:'Working',power:'On'}];render()`,context);
assert.equal(vm.runInContext('filter.date',context),vm.runInContext('day()',context));
assert.ok(el('view').innerHTML.includes('No inspections recorded for this date'));
assert.ok(!el('view').innerHTML.includes('YESTERDAY_ONLY'));
vm.runInContext('filter.date=day(-1);render()',context);
assert.ok(el('view').innerHTML.includes('YESTERDAY_ONLY'));
vm.runInContext(`page='incident';filter.date='';data=[{id:'one',kind:'incident',date:'2026-01-01',time:'12:00',incidentTitle:'Gate incident',description:'Visitor entry'},{id:'two',kind:'incident',date:'2026-02-01',time:'13:00',incidentTitle:'Store incident',description:'Broken glass'}];incidentQuery='visitor';render()`,context);
assert.ok(el('view').innerHTML.includes('Gate incident'));
assert.ok(!el('view').innerHTML.includes('Store incident'));
console.log('PASS today default, no stale daily status, historical day selection and incident search across dates');
