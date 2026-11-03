import {createGoogleAccount} from './google-account.js?v=50';
import {accountData} from './account-data.js?v=50';
import {PRICE_ENDPOINT} from './price-config.js';
import {firebaseConfig} from './firebase-config.js';
import {createFirebaseBackup} from './firebase-backup.js?v=50';
import {saveBackup,latestBackup} from './backup.js?v=50';
import {priceColor} from './comparison.js';
import {marketPriceTrend,rememberQuote} from './history.js?v=50';
import {createCalendarClock} from './calendar-clock.js';
import {createPriceLoader} from './price-loader.js';

import {FUELS,validate,localTime,bounds,stats,change,toCSV,importData,litersFromAmount} from './core.js';
import {API,parseAnnouncement,canUse,selectedPrice,priceImpact} from './prices.js';
const $=s=>document.querySelector(s),num=(v,d=2)=>v==null?'—':Number(v).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d}),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let marketSnapshot=null,marketObservations=[];
async function loadMarketHistory(){try{const r=await fetch('./history.json?v=50');if(!r.ok)throw Error('History unavailable');const data=await r.json();if(data.schemaVersion!==1||!['week','month','year'].every(k=>Array.isArray(data.periods?.[k])&&data.periods[k].length===6))throw Error('Invalid history');marketSnapshot=data;renderComparison();}catch{}}
let records=[],db,quote=null,editing=null,defaultFuel=FUELS[0],priceReference=null,savedPriceRecord=null,pricePoller=null,lastPriceError=false,summaryPeriod='month',installEvent;const f=$('#form');
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',5000)};
function openDB(){return new Promise((ok,no)=>{const r=indexedDB.open('temdee-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('records',{keyPath:'id'});r.result.createObjectStore('settings')};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function tx(store,mode,action){return new Promise((ok,no)=>{const t=db.transaction(store,mode);let r;try{r=action(t.objectStore(store))}catch(e){no(e);return}t.oncomplete=()=>ok(r?.result);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error||Error('บันทึกไม่สำเร็จ'))})}
async function load(){records=await tx('records','readonly',s=>s.getAll());render();backup()}
const googleAccount=createGoogleAccount(firebaseConfig,{onUser:handleGoogleUser,onError:accountError});
let accountBusy=false,accountFailed=false;
const cloudBackup=createFirebaseBackup(firebaseConfig,{startPaused:true,sessionProvider:()=>googleAccount.session(),onStatus:(state,detail)=>{const el=$('#backupStatus');el.dataset.state=state;el.textContent=({synced:'สำรองแล้ว',pending:'รอสำรอง','too-large':'ข้อมูลสำรองเกินขนาด'})[state]||'';el.title=detail||''}});

const accountButton=$('#accountButton'),accountDialog=$('#accountDialog');
function accountError(error){accountBusy=false;accountFailed=true;accountButton.disabled=false;accountButton.title='เชื่อมบัญชีไม่สำเร็จ';if(accountDialog.open)$('#accountMessage').textContent=accountErrorText(error);}
function accountErrorText(error){return error?.code==='auth/unauthorized-domain'?'ต้องเพิ่ม phkrissanat.github.io ใน Authorized domains ของ Firebase':error?.code==='auth/popup-blocked'?'เบราว์เซอร์ปิดกั้นหน้าต่างเข้าสู่ระบบ':error?.code==='auth/popup-closed-by-user'?'ยกเลิกการเข้าสู่ระบบ':'เชื่อมบัญชีหรือกู้คืนไม่สำเร็จ กรุณาลองอีกครั้ง';}
async function storeAccountData(data,uid){await new Promise((resolve,reject)=>{const t=db.transaction(['records','settings'],'readwrite'),store=t.objectStore('records'),settings=t.objectStore('settings');store.clear();for(const r of data.records)store.put(r);settings.put(data.defaultFuel,'defaultFuel');settings.put(data.marketObservations,'marketObservations');settings.put(uid,'cloudOwner');t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)});records=data.records;defaultFuel=data.defaultFuel;marketObservations=data.marketObservations;render();editor();showQuote();}
async function handleGoogleUser(user){
 await cloudBackup.pause();accountBusy=true;accountButton.disabled=true;accountButton.dataset.signedIn=String(!!user);
 if(!user){const owner=await tx('settings','readonly',s=>s.get('cloudOwner'));accountBusy=false;accountFailed=false;accountButton.disabled=false;accountButton.setAttribute('aria-label','เข้าสู่ระบบด้วย Google');accountButton.title='เข้าสู่ระบบด้วย Google';if(!owner){backup();cloudBackup.resume();}return;}
 try{const owner=await tx('settings','readonly',s=>s.get('cloudOwner')),remote=await cloudBackup.restore(),local={records,defaultFuel,marketObservations},next=accountData(local,remote?.data,owner,user.uid);await storeAccountData(next,user.uid);backup();cloudBackup.resume();accountFailed=false;accountButton.title=user.email||'บัญชี Google';accountButton.setAttribute('aria-label','บัญชี Google '+(user.email||''));$('#accountEmail').textContent=user.email||'';$('#accountMessage').textContent=remote&&owner!==user.uid?'กู้คืนข้อมูลแล้ว':'สำรองข้อมูลอัตโนมัติ';if(remote&&owner!==user.uid)toast('กู้คืนข้อมูลจากบัญชี Google แล้ว');}
 finally{accountBusy=false;accountButton.disabled=false;}
}
async function bootAccount(){try{await googleAccount.start();}catch(error){accountError(error);}}
accountButton.onclick=async()=>{
 if(accountBusy)return;
 if(googleAccount.current()&&!accountFailed){$('#accountEmail').textContent=googleAccount.current().email||'';$('#accountMessage').textContent=$('#backupStatus').dataset.state==='synced'?'สำรองแล้ว':'กำลังสำรองข้อมูล';accountDialog.showModal();return;}
 try{const paused=cloudBackup.pause();if(googleAccount.current()){await paused;await handleGoogleUser(googleAccount.current());return;}await googleAccount.signIn();await paused;}
 catch(error){accountError(error);if(error?.code==='auth/popup-closed-by-user'||error?.code==='auth/cancelled-popup-request'){if(!await tx('settings','readonly',s=>s.get('cloudOwner')))cloudBackup.resume();return;}toast(accountErrorText(error));bootAccount();}
};
$('#accountClose').onclick=()=>accountDialog.close();
$('#accountSignOut').onclick=async()=>{try{await cloudBackup.flush();await cloudBackup.pause();await googleAccount.signOut();accountDialog.close();}catch(error){$('#accountMessage').textContent=accountErrorText(error)}};

let backupWarning=false;
function backup(){try{saveBackup(records,defaultFuel,localStorage,marketObservations);cloudBackup.enqueue(records,defaultFuel,marketObservations)}catch{if(!backupWarning){backupWarning=true;toast('สำรองข้อมูลอัตโนมัติไม่สำเร็จ พื้นที่จัดเก็บอาจเต็ม')}}}
function delta(c,p,unit){const d=change(c,p),signed=v=>v==null?'—':(v>0?'+':'')+num(v),tone=v=>v>0?'delta-up':v<0?'delta-down':'delta-neutral';return '<span class="metric-difference '+tone(d.amount)+'">'+signed(d.amount)+' '+unit+'</span><span class="metric-difference '+tone(d.percent)+'">'+signed(d.percent)+'%</span>'}
const metric=(title,value,unit,c,p)=>'<div class="card"><small>'+title+'</small><strong>'+num(value)+'</strong><small>'+unit+'</small><p>'+delta(c,p,unit)+'</p></div>';
function render(){
 $('#count').textContent=records.length+' รายการ';$('#heroTotal').textContent='฿'+num(stats(records).total);
 const kind=summaryPeriod,date=new Date(),range=bounds(kind,date),previous=bounds(kind,date,-1),a=stats(records,range),b=stats(records,previous);
 const df=n=>new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium'}).format(n);
 const rangePart=n=>{const parts=new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'long',year:'numeric'}).formatToParts(n);return Object.fromEntries(parts.filter(x=>['day','month','year'].includes(x.type)).map(x=>[x.type,x.value]));};const from=rangePart(range[0]),to=rangePart(range[1]-1);const rangeLabel=from.month===to.month&&from.year===to.year?from.day+'–'+to.day+' '+to.month+' '+to.year:from.day+' '+from.month+(from.year!==to.year?' '+from.year:'')+'–'+to.day+' '+to.month+' '+to.year;$('#range').textContent=rangeLabel;$('#range').title=df(range[0])+' – '+df(range[1]-1)+' · เทียบ '+df(previous[0])+' – '+df(previous[1]-1);
 $('#metrics').innerHTML=metric('ค่าใช้จ่าย',a.total,'บาท',a.total,b.total)+metric('ราคาน้ำมันเฉลี่ย',a.price,'บาท/ลิตร',a.price,b.price)+(a.efficiency!==null?metric('ประสิทธิภาพ',a.efficiency,'km/L',a.efficiency,b.efficiency):'');

 renderComparison();
 renderRecords();
}
function renderComparison(){
 const fuel=f.elements.fuel.value||defaultFuel,{start,end,baseline,points,periodStarts,asOf}=marketPriceTrend(records,fuel,marketSnapshot,summaryPeriod,new Date(),marketObservations),w=360,h=270,left=54,right=12,top=24,bottom=58,values=[baseline,...points.map(p=>p.price)].filter(v=>v!==null),low=Math.floor((Math.min(...values,values.length?Infinity:0)-2)/2)*2,high=Math.max(low+4,Math.ceil((Math.max(...values,0)+2)/2)*2);
 const x=t=>left+(t-start)/(end-start)*(w-left-right),y=v=>h-bottom-(v-low)/(high-low)*(h-top-bottom);
 const grid=Array.from({length:5},(_,i)=>{const v=low+(high-low)*i/4;return '<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#edf0eb"/><text x="'+(left-6)+'" y="'+(y(v)+3)+'" text-anchor="end">'+num(v,1)+'</text>'}).join('');
 const ticks=periodStarts.map((t,i)=>{const parts=new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',...(summaryPeriod==='year'?{year:'numeric'}:summaryPeriod==='month'?{month:'short',year:'2-digit'}:{day:'numeric',month:'short'})}).formatToParts(t),part=k=>parts.find(p=>p.type===k)?.value||'',labels=summaryPeriod==='year'?[part('year')]:summaryPeriod==='month'?[part('month'),part('year')]:[part('day'),part('month')],next=periodStarts[i+1]||end,position=x(t+(next-t)/2);return '<text x="'+position+'" y="'+(h-bottom+24)+'" text-anchor="middle">'+labels.map((label,j)=>'<tspan x="'+position+'" dy="'+(j?18:0)+'">'+esc(label)+'</tspan>').join('')+'</text>';}).join('');
 let path='';points.forEach((p,i)=>{if(!i||p.gap){path+='M'+x(p.time)+','+y(p.price);return}const prev=points[i-1],mid=(x(prev.time)+x(p.time))/2;path+=' C'+mid+','+y(prev.price)+' '+mid+','+y(p.price)+' '+x(p.time)+','+y(p.price);});
 const baseY=baseline===null?null:y(baseline),reference=baseline===null?'':'<line x1="'+left+'" x2="'+(w-right)+'" y1="'+baseY+'" y2="'+baseY+'" stroke="#88988d" stroke-dasharray="5 4"/>';
 const line=baseline===null?'<path d="'+path+'" fill="none" stroke="#88988d" stroke-width="2.5"/>':'<defs><clipPath id="above-average"><rect x="0" y="0" width="'+w+'" height="'+baseY+'"/></clipPath><clipPath id="below-average"><rect x="0" y="'+baseY+'" width="'+w+'" height="'+h+'"/></clipPath></defs><path d="'+path+'" fill="none" stroke="#c53232" stroke-width="2.5" clip-path="url(#above-average)"/><path d="'+path+'" fill="none" stroke="#218347" stroke-width="2.5" clip-path="url(#below-average)"/>';
 const dots=points.map(p=>'<circle cx="'+x(p.time)+'" cy="'+y(p.price)+'" r="3" fill="'+priceColor(p.price,baseline)+'"><title>'+'ราคาเฉลี่ยของช่วง'+': '+num(p.price)+' บาท/ลิตร'+(p.coverage<p.expectedDays?' · มีข้อมูล '+p.coverage+' จาก '+p.expectedDays+' วัน':'')+'</title></circle>').join('');

 const current=points.find(p=>p.current),plotRight=w-right,averageX=plotRight-4,currentX=current?Math.max(left+54,Math.min(plotRight-4,x(current.time)+48)):null,labelMin=top+12,labelMax=h-bottom-4;
 let averageLabelY=baseline===null?null:Math.max(labelMin,Math.min(labelMax,baseY-8)),currentLabelY=current?Math.max(labelMin,Math.min(labelMax,y(current.price)-8)):null;
 if(averageLabelY!==null&&currentLabelY!==null&&Math.abs(averageX-currentX)<60&&Math.abs(averageLabelY-currentLabelY)<24){const middle=(averageLabelY+currentLabelY)/2,upper=Math.max(labelMin,Math.min(labelMax-24,middle-12)),averageAbove=baseY<=y(current.price);averageLabelY=averageAbove?upper:upper+24;currentLabelY=averageAbove?upper+24:upper;}
 const callout=(title,price,labelX,labelY,color)=>'<g class="price-callout"><title>'+title+'</title><text x="'+labelX+'" y="'+labelY+'" text-anchor="end" font-weight="600" fill="'+color+'">'+num(price)+'</text></g>';
 const labels=(baseline===null?'':callout('ราคาเฉลี่ย',baseline,averageX,averageLabelY,'#88988d'))+(current?callout('ราคาเฉลี่ยช่วงล่าสุด',current.price,currentX,currentLabelY,priceColor(current.price,baseline)):'');
 $('#chart').dataset.observedDays=String(marketObservations.length);
 $('#chart').innerHTML='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(fuel)+' ราคาเฉลี่ยย้อนหลัง 6 ช่วง"><title>'+esc(fuel)+' · ราคาเฉลี่ยบางจากตามช่วงปฏิทิน · ข้อมูลถึง '+esc(asOf||'—')+' · ราคาเฉลี่ยย้อนหลัง '+num(baseline)+' บาท/ลิตร</title>'+grid+ticks+reference+line+dots+labels+'</svg>';
}

function renderRecords(){const rows=[...records].sort((a,b)=>b.instant.localeCompare(a.instant));
 $('#recordList').innerHTML=rows.length?'<div class="history-scroll"><table class="history-table"><thead><tr><th>วันที่</th><th>ชนิดน้ำมัน</th><th>ยอดเงิน</th><th>ปริมาณน้ำมัน</th><th aria-label="จัดการรายการ"></th></tr></thead><tbody>'+rows.map(r=>'<tr><td><time datetime="'+esc(r.datetime.slice(0,10))+'">'+esc(new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date(r.instant)))+'</time></td><td>'+esc(r.fuel)+'</td><td>'+num(r.total)+'</td><td>'+num(r.liters,1)+'</td><td><details class="record-menu"><summary aria-label="จัดการรายการ '+esc(r.datetime.slice(0,10))+'">⋮</summary><div class="history-actions"><button data-edit="'+esc(r.id)+'" aria-label="แก้ไขรายการ '+esc(r.datetime.slice(0,10))+'">✎</button><button data-delete="'+esc(r.id)+'" aria-label="ลบรายการ '+esc(r.datetime.slice(0,10))+'">⌫</button></div></details></td></tr>').join('')+'</tbody></table></div>':'<div class="panel empty">ไม่พบรายการ</div>';
}
function updateDefaultUI(){

 document.querySelectorAll('[data-fuel]').forEach(button=>{const selected=button.dataset.fuel===f.elements.fuel.value;button.classList.toggle('selected',selected);button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1});
}
function usesSavedPrice(){return !!savedPriceRecord&&f.elements.fuel.value===savedPriceRecord.fuel&&f.elements.datetime.value===savedPriceRecord.datetime&&f.elements.station.value===savedPriceRecord.station}
function recalculate(){const liters=litersFromAmount(f.elements.total.value,f.elements.price.value);f.elements.liters.value=liters??'';$('#form button[type=submit]').disabled=pricePreview||liters===null||!priceReference||(!usesSavedPrice()&&!!pricePoller?.pending);}
function applyPrice(){
 showQuote();
 if(db)renderComparison();
 if(!editing)f.elements.datetime.value=localTime().slice(0,10);

 if(usesSavedPrice()){const r=savedPriceRecord;f.elements.price.value=r.price;priceReference={calculationMode:r.calculationMode||'amount-manual',...(r.priceSource?{priceSource:r.priceSource,priceDate:r.priceDate,priceFetchedAt:r.priceFetchedAt}:{})};recalculate();return}
 const p=quote?.prices.find(p=>p.fuel===f.elements.fuel.value);
 const available=!lastPriceError&&navigator.onLine&&canUse(quote,f.elements.datetime.value)&&/บางจาก|bangchak/i.test(f.elements.station.value)&&p;
 if(!available){f.elements.price.value='';priceReference=null;recalculate();return}
 f.elements.price.value=p.today;priceReference={calculationMode:'amount-live',priceSource:quote.source,priceDate:quote.date,priceFetchedAt:quote.fetchedAt};
recalculate();
}
function editor(r){
 editing=r?.id||null;savedPriceRecord=r||null;f.reset();priceReference=null;$('#formError').textContent='';$('#formTitle').textContent=r?'แก้ไขรายการ':'';$('#formTitle').hidden=!r;f.elements.datetime.value=localTime().slice(0,10);f.elements.fuel.value=defaultFuel;f.elements.station.value='บางจาก';
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
f.onsubmit=async e=>{e.preventDefault();if(pricePreview)return;try{
 if(!editing)f.elements.datetime.value=localTime().slice(0,10);
 if(!usesSavedPrice()){
  if(pricePoller.pending)await pricePoller.pending;
  applyPrice();if(!priceReference)return
 }
 if(!priceReference){refresh();return}
 const raw={...Object.fromEntries(new FormData(f)),...priceReference};raw.datetime=raw.datetime.slice(0,10);raw.full=f.elements.full.checked;raw.gap=f.elements.gap.checked;if(editing)raw.id=editing;const r=validate(raw);
 if(r.instant>new Date().toISOString())throw Error('วันเวลาเติมต้องไม่อยู่ในอนาคต');await tx('records','readwrite',s=>s.put(r));await load();editor();toast('บันทึกแล้ว')
 }catch(e){$('#formError').textContent=e.message}
};
$('#recordList').onclick=async e=>{const edit=e.target.dataset.edit,del=e.target.dataset.delete;if(edit)editor(records.find(r=>r.id===edit));if(del&&confirm('ลบรายการนี้?'))try{await tx('records','readwrite',s=>s.delete(del));await load();toast('ลบแล้ว')}catch(e){toast('ลบไม่สำเร็จ: '+e.message)}};
function selectTab(id){document.querySelectorAll('.tab').forEach(x=>x.hidden=x.id!==id);document.querySelectorAll('[data-tab]').forEach(x=>{const selected=x.dataset.tab===id;x.classList.toggle('active',selected);if(selected)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});window.scrollTo({top:0,behavior:'instant'})}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
document.querySelectorAll('[data-period]').forEach(button=>button.onclick=()=>{summaryPeriod=button.dataset.period;document.querySelectorAll('[data-period]').forEach(item=>{const selected=item===button;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',String(selected))});render()});
const pricePreview=location.hostname==='127.0.0.1'&&location.hash==='#preview-price';
function shownQuote(){
 if(!pricePreview)return quote;
 const currentFuel=f.elements.fuel.value||defaultFuel,current=quote?.prices.find(x=>x.fuel===currentFuel),now=new Date();
 const date=localTime(now).slice(0,10),next=localTime(new Date(+now+86400000)).slice(0,10).split('-').map(Number),months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
 const today=current?.today||33.50;
 return {date,fetchedAt:now.toISOString(),effectiveText:'ราคามีผล ณ วันที่ '+next[2]+' '+months[next[1]-1]+' '+String(next[0]+543).slice(-2)+' เวลา 05.00 น.',prices:[{fuel:currentFuel,today,yesterday:today,tomorrow:Math.round((today+1)*100)/100}]};
}
function showQuote(){
 const displayed=shownQuote(),p=selectedPrice(displayed,f.elements.fuel.value||defaultFuel),target=$('#selectedPrice');
 if(!p){target.innerHTML='<span class="selected-price-value">— <small>บาท/ลิตร</small></span>';return}
 const fresh=pricePreview||canUse(quote,localTime())&&!lastPriceError;
 const fullDate=text=>{const short=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'],full=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];return String(text||'').replace(/^ราคามีผล\s*ณ\s*วันที่\s*/,'').replace(/(\d{1,2})\s+(\S+)\s+(\d{2,4})/,(_,day,month,year)=>day+' '+(full[short.indexOf(month)]||month)+' '+(year.length===2?'25'+year:year));};
 const impact=p.upcoming?priceImpact(p,f.elements.total.value):null;
 const impactText=impact?'<div class="announcement-impact '+(p.delta>0?'price-up':'price-down')+'">ส่วนต่างปริมาณน้ำมัน <span>'+(impact.litersChange>0?'+':'')+num(impact.litersChange,3)+' ลิตร</span></div>':'';
 const announcement=p.upcoming?'<div class="price-announcement"><span class="announcement-label">ประกาศปรับราคาใหม่'+(pricePreview?' <small>จำลอง</small>':'')+'</span><div class="price-effective">'+esc(fullDate(p.effectiveText))+'</div><div class="announcement-price"><strong>'+num(p.tomorrow)+'</strong> <span class="price-change '+(p.delta>0?'price-up':'price-down')+'">('+(p.delta>0?'+':'')+num(p.delta)+')</span> <small>บาท/ลิตร</small></div>'+impactText+'</div>':'<div class="no-announcement">ยังไม่มีราคาใหม่</div>';
 const checkedAt=Date.parse(displayed.fetchedAt);
 const checkedDate=Number.isFinite(checkedAt)?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'long',year:'numeric'}).format(new Date(checkedAt)):'—';
 const checkedTime=Number.isFinite(checkedAt)?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(checkedAt)):null;
 const checked='<div class="price-effective price-checked"><div>ตรวจสอบล่าสุด</div><div>'+esc(checkedDate)+'</div>'+(checkedTime?'<div>เวลา '+esc(checkedTime)+' น.</div>':'')+'</div>';

 target.innerHTML='<div class="price-overview"><div class="price-current"><span class="selected-price-value">'+num(p.today)+' <small>บาท/ลิตร'+(fresh?'':' · ข้อมูลล่าสุดที่เก็บไว้')+'</small></span></div><div class="price-adjustment">'+announcement+checked+'</div></div>';

}
async function fetchQuote(){
 if(!navigator.onLine){lastPriceError=true;return false}
 try{
  const r=await fetch(PRICE_ENDPOINT,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);
  const next=parseAnnouncement(await r.json());const nextObservations=rememberQuote(marketObservations,next),changed=nextObservations!==marketObservations;await tx('settings','readwrite',s=>{s.put(next,'quote');s.put(nextObservations,'marketObservations')});quote=next;marketObservations=nextObservations;if(changed)backup();lastPriceError=false;showQuote();renderComparison();
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
try{db=await openDB();const savedObservations=await tx('settings','readonly',s=>s.get('marketObservations'));let restoredObservations;try{restoredObservations=latestBackup()?.marketObservations}catch{}marketObservations=(Array.isArray(savedObservations)?savedObservations:Array.isArray(restoredObservations)?restoredObservations:[]).filter(o=>/^\d{4}-\d{2}-\d{2}$/.test(o?.date||'')&&o.prices&&typeof o.prices==='object');quote=await tx('settings','readonly',s=>s.get('quote'));const savedDefault=await tx('settings','readonly',s=>s.get('defaultFuel'));if(FUELS.includes(savedDefault))defaultFuel=savedDefault;const current=await tx('records','readonly',s=>s.getAll());if(!current.length){let restored;try{restored=latestBackup()}catch{}if(restored?.records?.length){const rows=restored.records.map(validate);await tx('records','readwrite',s=>{for(const row of rows)s.put(row)});if(FUELS.includes(restored.defaultFuel))defaultFuel=restored.defaultFuel;toast('กู้คืนข้อมูลสำรองแล้ว')}}await load();showQuote();editor();loadMarketHistory();bootAccount();if(pricePreview){f.elements.total.value=500;showQuote();recalculate()}refresh();navigator.storage?.persist?.().catch(()=>{});}catch(e){toast('เปิดพื้นที่จัดเก็บไม่ได้: '+e.message);$('#form button[type=submit]').disabled=true;}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

const themeButton=document.querySelector('#themeToggle');
function setTheme(mode){document.documentElement.dataset.theme=mode;try{localStorage.setItem('ruay-theme',mode)}catch{}const dark=mode==='dark';themeButton.setAttribute('aria-label',dark?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด');themeButton.setAttribute('aria-pressed',String(dark));themeButton.innerHTML=dark?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A9 9 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2Z"/></svg>';}
themeButton.onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
setTheme(document.documentElement.dataset.theme||'light');
