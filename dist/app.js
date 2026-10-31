import {PRICE_ENDPOINT} from './price-config.js';
import {firebaseConfig} from './firebase-config.js';
import {createFirebaseBackup} from './firebase-backup.js';
import {saveBackup,latestBackup} from './backup.js';
import {comparisonSeries} from './comparison.js';
import {createCalendarClock} from './calendar-clock.js';
import {createPriceLoader} from './price-loader.js';

import {FUELS,validate,localTime,bounds,stats,change,toCSV,importData,litersFromAmount} from './core.js';
import {API,parseAnnouncement,canUse,selectedPrice,priceImpact} from './prices.js';
const $=s=>document.querySelector(s),num=(v,d=2)=>v==null?'—':Number(v).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d}),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records=[],db,quote=null,editing=null,defaultFuel=FUELS[0],priceReference=null,savedPriceRecord=null,pricePoller=null,lastPriceError=false,summaryPeriod='month',installEvent;const f=$('#form');
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',5000)};
function openDB(){return new Promise((ok,no)=>{const r=indexedDB.open('temdee-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('records',{keyPath:'id'});r.result.createObjectStore('settings')};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function tx(store,mode,action){return new Promise((ok,no)=>{const t=db.transaction(store,mode);let r;try{r=action(t.objectStore(store))}catch(e){no(e);return}t.oncomplete=()=>ok(r?.result);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error||Error('บันทึกไม่สำเร็จ'))})}
async function load(){records=await tx('records','readonly',s=>s.getAll());render();backup()}
const cloudBackup=createFirebaseBackup(firebaseConfig,{onStatus:(state,detail)=>{const el=$('#backupStatus');el.dataset.state=state;el.textContent=({synced:'สำรองแล้ว',pending:'รอสำรอง','too-large':'ข้อมูลสำรองเกินขนาด'})[state]||'';el.title=detail||''}});
let backupWarning=false;
function backup(){try{saveBackup(records,defaultFuel);cloudBackup.enqueue(records,defaultFuel)}catch{if(!backupWarning){backupWarning=true;toast('สำรองข้อมูลอัตโนมัติไม่สำเร็จ พื้นที่จัดเก็บอาจเต็ม')}}}
function delta(c,p,unit){const d=change(c,p);return d.amount==null?'—':(d.amount>0?'+':'')+num(d.amount)+' '+unit+' · '+(d.percent==null?'% —':(d.percent>0?'+':'')+num(d.percent)+'%')}
const metric=(title,value,unit,c,p)=>'<div class="card"><small>'+title+'</small><strong>'+num(value)+'</strong><small>'+unit+'</small><p>'+delta(c,p,unit)+'</p></div>';
function render(){
 $('#count').textContent=records.length+' รายการ';$('#heroTotal').textContent='฿'+num(stats(records).total);
 const kind=summaryPeriod,date=new Date(),range=bounds(kind,date),previous=bounds(kind,date,-1),a=stats(records,range),b=stats(records,previous);
 const df=n=>new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium'}).format(n);
 const compact=n=>new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'}).format(n);const rangeLabel=kind==='year'?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',year:'numeric'}).format(range[0]):kind==='month'?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',month:'short',year:'2-digit'}).format(range[0]):compact(range[0])+'–'+compact(range[1]-1);$('#range').textContent=rangeLabel;$('#range').title=df(range[0])+' – '+df(range[1]-1)+' · เทียบ '+df(previous[0])+' – '+df(previous[1]-1);
 $('#metrics').innerHTML=metric('ค่าใช้จ่าย',a.total,'บาท',a.total,b.total)+metric('ราคาน้ำมันเฉลี่ย',a.price,'บาท/ลิตร',a.price,b.price)+(a.efficiency!==null?metric('ประสิทธิภาพ',a.efficiency,'km/L',a.efficiency,b.efficiency):'');

 renderComparison();
 renderRecords();
}
function renderComparison(){
 const {series,labels}=comparisonSeries(records,summaryPeriod),w=360,h=200,left=40,right=12,top=12,bottom=28,max=Math.max(1,...series.flat().filter(v=>v!==null)),ceiling=Math.ceil(max/4)*4;
 const x=i=>left+i*(w-left-right)/(labels.length-1),y=v=>h-bottom-v/ceiling*(h-top-bottom);
 const grid=Array.from({length:5},(_,i)=>{const v=ceiling*i/4;return '<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#edf0eb"/><text x="'+(left-6)+'" y="'+(y(v)+3)+'" text-anchor="end">'+num(v,0)+'</text>'}).join('');
 const step=summaryPeriod==='month'?5:summaryPeriod==='year'?2:1;
 const ticks=labels.map((l,i)=>i%step===0||i===labels.length-1?'<text x="'+x(i)+'" y="'+(h-8)+'" text-anchor="middle">'+l+'</text>':'').join('');
 const lines=series.map((values,j)=>{const points=values.map((v,i)=>v===null?null:[x(i),y(v),v,i]).filter(Boolean),color=j?'#a0aaa4':'#285b45';return '<polyline fill="none" stroke="'+color+'" stroke-width="2.5" '+(j?'stroke-dasharray="5 4"':'')+' points="'+points.map(p=>p[0]+','+p[1]).join(' ')+'"/>'+points.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3" fill="'+color+'"><title>'+(j?'ก่อนหน้า':'ปัจจุบัน')+' · '+labels[p[3]]+': '+num(p[2])+' บาท</title></circle>').join('')}).reverse().join('');
 $('#chart').innerHTML='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="กราฟเส้นค่าใช้จ่าย เปรียบเทียบช่วงปัจจุบันกับช่วงก่อนหน้า"><title>ค่าใช้จ่าย (บาท) · '+({week:'รายสัปดาห์',month:'รายเดือน',year:'รายปี'}[summaryPeriod])+'</title>'+grid+ticks+lines+'</svg>';
}
function renderRecords(){const rows=[...records].sort((a,b)=>b.instant.localeCompare(a.instant));
 $('#recordList').innerHTML=rows.length?'<div class="history-scroll"><table class="history-table"><thead><tr><th>วันที่/เวลา</th><th>ชนิดน้ำมัน</th><th>ยอดเงิน</th><th>ปริมาณน้ำมัน</th><th><span class="history-actions-label">แก้ไข/ลบ</span></th></tr></thead><tbody>'+rows.map(r=>'<tr><td><time datetime="'+esc(r.instant)+'">'+esc(new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(r.instant)))+'</time></td><td>'+esc(r.fuel)+'</td><td>฿'+num(r.total)+'</td><td>'+num(r.liters,3)+' ลิตร</td><td><div class="history-actions"><button data-edit="'+esc(r.id)+'" aria-label="แก้ไขรายการ '+esc(r.datetime.replace('T',' '))+'">แก้ไข</button><button data-delete="'+esc(r.id)+'" aria-label="ลบรายการ '+esc(r.datetime.replace('T',' '))+'">ลบ</button></div></td></tr>').join('')+'</tbody></table></div>':'<div class="panel empty">ไม่พบรายการ</div>';
}
function updateDefaultUI(){

 document.querySelectorAll('[data-fuel]').forEach(button=>{const selected=button.dataset.fuel===f.elements.fuel.value;button.classList.toggle('selected',selected);button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1});
}
function usesSavedPrice(){return !!savedPriceRecord&&f.elements.fuel.value===savedPriceRecord.fuel&&f.elements.datetime.value===savedPriceRecord.datetime&&f.elements.station.value===savedPriceRecord.station}
function recalculate(){const liters=litersFromAmount(f.elements.total.value,f.elements.price.value);f.elements.liters.value=liters??'';$('#form button[type=submit]').disabled=liters===null||!priceReference||(!usesSavedPrice()&&!!pricePoller?.pending);}
function applyPrice(){
 showQuote();
 if(!editing)f.elements.datetime.value=localTime();

 if(usesSavedPrice()){const r=savedPriceRecord;f.elements.price.value=r.price;priceReference={calculationMode:r.calculationMode||'amount-manual',...(r.priceSource?{priceSource:r.priceSource,priceDate:r.priceDate,priceFetchedAt:r.priceFetchedAt}:{})};recalculate();return}
 const p=quote?.prices.find(p=>p.fuel===f.elements.fuel.value);
 const available=!lastPriceError&&navigator.onLine&&canUse(quote,f.elements.datetime.value)&&/บางจาก|bangchak/i.test(f.elements.station.value)&&p;
 if(!available){f.elements.price.value='';priceReference=null;recalculate();return}
 f.elements.price.value=p.today;priceReference={calculationMode:'amount-live',priceSource:quote.source,priceDate:quote.date,priceFetchedAt:quote.fetchedAt};
recalculate();
}
function editor(r){
 editing=r?.id||null;savedPriceRecord=r||null;f.reset();priceReference=null;$('#formError').textContent='';$('#formTitle').textContent=r?'แก้ไขรายการ':'';$('#formTitle').hidden=!r;f.elements.datetime.value=localTime();f.elements.fuel.value=defaultFuel;f.elements.station.value='บางจาก';
 if(r)for(const k of Object.keys(r)){const e=f.elements.namedItem(k);if(e){if(e.type==='checkbox')e.checked=r[k];else e.value=r[k]??''}}
 $('#cancelEdit').hidden=!r;selectTab('dashboard');updateDefaultUI();applyPrice();
}
$('#cancelEdit').onclick=()=>editor();const fuelOrder=['แก๊สโซฮอล์ 95','แก๊สโซฮอล์ 91','E20','E85','เบนซิน 95','แก๊สโซฮอล์ 95 พรีเมียม','เบนซินพรีเมียม 98','ดีเซล','ดีเซล B7','ดีเซล B20','ดีเซลพรีเมียม'];
$('#fuelButtons').innerHTML=fuelOrder.map(v=>'<button type="button" role="radio" aria-checked="false" tabindex="-1" data-fuel="'+esc(v)+'">'+esc(v)+'</button>').join('');
function chooseFuel(button){if(!button)return;f.elements.fuel.value=button.dataset.fuel;f.elements.fuel.dispatchEvent(new Event('change',{bubbles:true}));button.scrollIntoView({block:'nearest',inline:'nearest'})}
$('#fuelButtons').onclick=e=>chooseFuel(e.target.closest('[data-fuel]'));
$('#fuelButtons').onkeydown=e=>{const buttons=[...document.querySelectorAll('[data-fuel]')],i=buttons.indexOf(e.target);if(i<0)return;let n;if(e.key==='ArrowRight')n=(i+1)%buttons.length;else if(e.key==='ArrowLeft')n=(i-1+buttons.length)%buttons.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=buttons.length-1;else return;e.preventDefault();buttons[n].focus();chooseFuel(buttons[n])};
f.elements.total.oninput=()=>{recalculate();showQuote()};
let defaultWrite=Promise.resolve();
f.elements.fuel.onchange=()=>{
 const chosen=f.elements.fuel.value;defaultFuel=chosen;
 defaultWrite=defaultWrite.catch(()=>{}).then(()=>tx('settings','readwrite',s=>s.put(chosen,'defaultFuel'))).catch(()=>{});
 backup();updateDefaultUI();applyPrice();
};
f.elements.datetime.onchange=applyPrice;f.elements.station.oninput=applyPrice;
f.onsubmit=async e=>{e.preventDefault();try{
 if(!editing)f.elements.datetime.value=localTime();
 if(!usesSavedPrice()){
  if(pricePoller.pending)await pricePoller.pending;
  applyPrice();if(!priceReference)return
 }
 if(!priceReference){refresh();return}
 const raw={...Object.fromEntries(new FormData(f)),...priceReference};raw.full=f.elements.full.checked;raw.gap=f.elements.gap.checked;if(editing)raw.id=editing;const r=validate(raw);
 if(r.instant>new Date().toISOString())throw Error('วันเวลาเติมต้องไม่อยู่ในอนาคต');await tx('records','readwrite',s=>s.put(r));await load();editor();toast('บันทึกแล้ว')
 }catch(e){$('#formError').textContent=e.message}
};
$('#recordList').onclick=async e=>{const edit=e.target.dataset.edit,del=e.target.dataset.delete;if(edit)editor(records.find(r=>r.id===edit));if(del&&confirm('ลบรายการนี้?'))try{await tx('records','readwrite',s=>s.delete(del));await load();toast('ลบแล้ว')}catch(e){toast('ลบไม่สำเร็จ: '+e.message)}};
function selectTab(id){document.querySelectorAll('.tab').forEach(x=>x.hidden=x.id!==id);document.querySelectorAll('[data-tab]').forEach(x=>{const selected=x.dataset.tab===id;x.classList.toggle('active',selected);if(selected)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});window.scrollTo({top:0,behavior:'instant'})}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
document.querySelectorAll('[data-period]').forEach(button=>button.onclick=()=>{summaryPeriod=button.dataset.period;document.querySelectorAll('[data-period]').forEach(item=>{const selected=item===button;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',String(selected))});render()});
function showQuote(){
 const p=selectedPrice(quote,f.elements.fuel.value||defaultFuel),target=$('#selectedPrice');
 if(!p){target.innerHTML='<span class="selected-price-value">— <small>บาท/ลิตร</small></span>';return}
 const fresh=canUse(quote,localTime())&&!lastPriceError;
 const impact=priceImpact(p,f.elements.total.value);
 const impactText=impact?'<p class="price-impact">'+(impact.upcoming?'หลังปรับราคา':'เทียบก่อนปรับราคา')+' · '+num(impact.amount,0)+' บาท '+(impact.litersChange>0?'ได้เพิ่ม ':'ได้น้อยลง ')+num(Math.abs(impact.litersChange),3)+' ลิตร</p>':'';
 const change=p.delta?'<span class="price-change">'+(p.delta>0?'+':'')+num(p.delta)+' บาท/ลิตร'+(p.upcoming?' → '+num(p.tomorrow):'')+'<small>'+esc(p.effectiveText)+'</small></span>':'';
 target.innerHTML='<div class="selected-price-row"><span class="selected-price-value">'+num(p.today)+' <small>บาท/ลิตร'+(fresh?'':' · ข้อมูลล่าสุดที่เก็บไว้')+'</small></span>'+change+'</div><div class="selected-price-meta"><a href="https://www.bangchak.co.th/th/oilprice" target="_blank" rel="noopener">บางจาก ↗</a><span>'+esc(quote.effectiveText)+'</span><span>อัปเดต '+esc(localTime(new Date(quote.fetchedAt)).replace('T',' '))+'</span></div>'+impactText;
}
async function fetchQuote(){
 if(!navigator.onLine){lastPriceError=true;return false}
 try{
  const r=await fetch(PRICE_ENDPOINT,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);
  const next=parseAnnouncement(await r.json());await tx('settings','readwrite',s=>s.put(next,'quote'));quote=next;lastPriceError=false;showQuote();
  if(!usesSavedPrice())return canUse(quote,f.elements.datetime.value)&&!!quote.prices.find(p=>p.fuel===f.elements.fuel.value)&&/บางจาก|bangchak/i.test(f.elements.station.value);
  return canUse(quote,localTime());
 }catch{lastPriceError=true;return false}
}
function refresh(){return pricePoller.check()}
pricePoller=createPriceLoader(fetchQuote,{onStateChange:applyPrice});
function network(){$('#network').textContent=navigator.onLine?'● ออนไลน์':'○ ออฟไลน์'}window.addEventListener('online',()=>{network();cloudBackup.flush()});window.addEventListener('offline',()=>{network();applyPrice()});network();
const calendarClock=createCalendarClock(()=>{if(db){render();applyPrice();showQuote()}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&db){calendarClock.check();render();applyPrice();refresh()}});
window.addEventListener('focus',()=>{if(db)calendarClock.check()});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;$('#install').hidden=false});$('#install').onclick=async()=>{if(installEvent){await installEvent.prompt();installEvent=null;$('#install').hidden=true}};
try{db=await openDB();quote=await tx('settings','readonly',s=>s.get('quote'));const savedDefault=await tx('settings','readonly',s=>s.get('defaultFuel'));if(FUELS.includes(savedDefault))defaultFuel=savedDefault;const current=await tx('records','readonly',s=>s.getAll());if(!current.length){let restored;try{restored=latestBackup()}catch{}if(restored?.records?.length){const rows=restored.records.map(validate);await tx('records','readwrite',s=>{for(const row of rows)s.put(row)});if(FUELS.includes(restored.defaultFuel))defaultFuel=restored.defaultFuel;toast('กู้คืนข้อมูลสำรองแล้ว')}}await load();showQuote();editor();refresh();navigator.storage?.persist?.().catch(()=>{});}catch(e){toast('เปิดพื้นที่จัดเก็บไม่ได้: '+e.message);$('#form button[type=submit]').disabled=true;}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
