
export const FUELS=['แก๊สโซฮอล์ 95','แก๊สโซฮอล์ 91','E20','E85','เบนซิน 95','ดีเซล','ดีเซล B7','ดีเซลพรีเมียม','ดีเซล B20','เบนซินพรีเมียม 98','แก๊สโซฮอล์ 95 พรีเมียม'];
export const offset=7*3600000;
export function localTime(d=new Date()){return new Date(+d+offset).toISOString().slice(0,16)}
export function parseLocal(v){
 if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))v+='T00:00';
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) throw Error('วันเวลาไม่ถูกต้อง');
 const d=new Date(v+':00+07:00');
 if(!Number.isFinite(+d)||localTime(d)!==v) throw Error('วันเวลาไม่มีอยู่จริง');
 return d.toISOString();
}
export function validate(x){
 if(!x||typeof x!=='object')throw Error('รูปแบบรายการไม่ถูกต้อง');
 const datetime=parseLocal(x.datetime);
 const positive=(v,name)=>{if(v===''||v==null||typeof v==='boolean'||!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>1e9)throw Error(name+' ต้องมากกว่า 0 และไม่เกิน 1,000,000,000');return Number(v)};
 const liters=positive(x.liters,'ปริมาณ'),price=positive(x.price,'ราคา'),total=positive(x.total,'ยอดรวม');
 if(Math.abs(liters*price-total)>Math.max(2,total*.01))throw Error('ยอดรวมไม่สอดคล้องกับลิตร × ราคา (คลาดเคลื่อนได้ไม่เกิน 1% หรือ 2 บาท)');
 const odometer=x.odometer===''||x.odometer==null?null:Number(x.odometer);
 if(odometer!==null&&(!Number.isFinite(odometer)||odometer<0||odometer>1e9))throw Error('เลขไมล์ไม่ถูกต้อง');
 if(!FUELS.includes(x.fuel))throw Error('ชนิดน้ำมันไม่ถูกต้อง');
 if(typeof x.station!=='string'||!x.station.trim()||x.station.length>200)throw Error('กรุณาระบุสถานีไม่เกิน 200 ตัวอักษร');
 if(x.notes!=null&&(typeof x.notes!=='string'||x.notes.length>2000))throw Error('หมายเหตุยาวเกิน 2,000 ตัวอักษร');
 const bool=v=>{if(v===true||v==='true')return true;if(v===false||v==='false'||v==null||v==='')return false;throw Error('ค่าตัวเลือกต้องเป็น true หรือ false')};
 if(x.id!=null&&(typeof x.id!=='string'||!x.id||x.id.length>100))throw Error('รหัสรายการไม่ถูกต้อง');
 const reference={};
 for(const k of ['calculationMode','priceSource','priceDate','priceFetchedAt']){if(x[k]){if(typeof x[k]!=='string'||x[k].length>500)throw Error('ข้อมูลแหล่งราคาไม่ถูกต้อง');reference[k]=x[k]}}
 if(reference.calculationMode&&!['amount-live','amount-manual'].includes(reference.calculationMode))throw Error('วิธีคำนวณไม่ถูกต้อง');
 if(reference.priceSource&&new URL(reference.priceSource).protocol!=='https:')throw Error('แหล่งราคาต้องเป็น HTTPS');
 if(reference.priceDate&&!/^\d{4}-\d{2}-\d{2}$/.test(reference.priceDate))throw Error('วันที่ราคาไม่ถูกต้อง');
 if(reference.priceFetchedAt&&!Number.isFinite(Date.parse(reference.priceFetchedAt)))throw Error('เวลาอัปเดตราคาไม่ถูกต้อง');
 return {...reference,id:x.id||crypto.randomUUID(),datetime:x.datetime,instant:datetime,fuel:x.fuel,station:x.station.trim(),liters,price,total,odometer,notes:x.notes||'',full:bool(x.full),gap:bool(x.gap)};
}
export function bounds(kind,date=new Date(),shift=0){
 const d=new Date(+date+offset);let y=d.getUTCFullYear(),m=d.getUTCMonth(),day=d.getUTCDate();
 let a,b;
 if(kind==='week'){const sunday=day-d.getUTCDay()+shift*7;a=Date.UTC(y,m,sunday);b=a+7*86400000}
 else if(kind==='month'){a=Date.UTC(y,m+shift,1);b=Date.UTC(y,m+shift+1,1)}
 else {a=Date.UTC(y+shift,0,1);b=Date.UTC(y+shift+1,0,1)}
 return [a-offset,b-offset];
}
export function efficiencySegments(records){
 const rows=[...records].sort((a,b)=>+new Date(a.instant)-+new Date(b.instant));let anchor=null,liters=0,lastOdo=null;const out=[];
 for(const r of rows){
  const reversed=r.odometer!==null&&lastOdo!==null&&r.odometer<=lastOdo;
  if(r.gap||reversed){anchor=null;liters=0}
  if(r.odometer!==null)lastOdo=r.odometer;
  if(anchor)liters+=r.liters;
  if(r.full){
   if(anchor&&r.odometer!==null&&r.odometer>anchor.odometer)out.push({end:+new Date(r.instant),km:r.odometer-anchor.odometer,liters});
   anchor=r.odometer!==null?r:null;liters=0;
  }
 }
 return out;
}
export function stats(records,range){
 const rows=records.filter(r=>!range||(+new Date(r.instant)>=range[0]&&+new Date(r.instant)<range[1]));
 const liters=rows.reduce((s,r)=>s+r.liters,0),total=rows.reduce((s,r)=>s+r.total,0);
 const segments=efficiencySegments(records).filter(s=>!range||(s.end>=range[0]&&s.end<range[1]));
 const km=segments.reduce((s,r)=>s+r.km,0),used=segments.reduce((s,r)=>s+r.liters,0);
 return {count:rows.length,liters,total,price:liters?total/liters:null,efficiency:used?km/used:null,segments:segments.length};
}
export function change(current,previous){return {amount:current==null||previous==null?null:current-previous,percent:current==null||previous==null||previous===0?null:(current-previous)/previous*100}}
export const columns=['id','datetime','fuel','station','liters','price','total','odometer','notes','full','gap','calculationMode','priceSource','priceDate','priceFetchedAt'];
// Prefix every textual cell with an apostrophe to prevent spreadsheet formula execution; importer reverses it.
export function toCSV(rows){return '\uFEFF'+columns.join(',')+'\r\n'+rows.map(r=>columns.map(k=>{let v=r[k]??'';if(typeof v==='string'&&v!=='')v="'"+v;return '"'+String(v).replaceAll('"','""')+'"'}).join(',')).join('\r\n')}
export function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){let c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c}
  else if(c==='"'){if(cell||closed)throw Error('CSV: เครื่องหมายคำพูดไม่ถูกต้อง');quoted=true}
  else if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(Boolean))rows.push(row);row=[]}}
  else {if(closed)throw Error('CSV: มีข้อความหลังปิดคำพูด');cell+=c}
 }
 if(quoted)throw Error('CSV: ปิดเครื่องหมายคำพูดไม่ครบ');
 if(cell||row.length){row.push(cell);rows.push(row)}
 const header=rows.shift();if(!header||(header.join(',')!==columns.join(',')&&header.join(',')!==columns.slice(0,11).join(',')))throw Error('หัวตาราง CSV ไม่ตรงกับไฟล์ที่แอปส่งออก');
 return rows.map(r=>{if(r.length!==header.length)throw Error('จำนวนช่อง CSV ไม่ครบ');return Object.fromEntries(header.map((k,i)=>[k,r[i].startsWith("'")?r[i].slice(1):r[i]]))});
}
export function importData(text,type){
 const raw=type==='csv'?parseCSV(text):JSON.parse(text);
 const rows=type==='csv'?raw:(raw.schemaVersion===1&&Array.isArray(raw.records)?raw.records:null);
 if(!rows||rows.length>50000)throw Error('ไฟล์ต้องเป็นรูปแบบของแอป และมีไม่เกิน 50,000 รายการ');
 const records=rows.map((r,i)=>{try{return validate(r)}catch(e){throw Error('แถว '+(i+1)+': '+e.message)}});
 if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('มีรหัสรายการซ้ำในไฟล์');
 return records;
}
export function validateQuote(data,now=Date.now()){
 if(!data||data.currency!=='THB'||data.unit!=='L'||typeof data.sourceName!=='string'||!data.sourceName.trim())throw Error('API ไม่ระบุหน่วยหรือแหล่งที่มา');
 const source=new URL(data.sourceUrl);if(source.protocol!=='https:')throw Error('ลิงก์แหล่งที่มาต้องเป็น HTTPS');
 const ts=v=>{if(typeof v!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('API ต้องระบุเวลาพร้อม timezone');return Date.parse(v)};
 if(ts(data.updatedAt)>now+300000||ts(data.effectiveAt)>now)throw Error('API ส่งราคาที่ยังไม่มีผลหรือเวลาอนาคต');
 if(!Array.isArray(data.prices)||!data.prices.length)throw Error('API ไม่มีราคา');
 const seen=new Set();
 for(const p of data.prices){if(!FUELS.includes(p.fuel)||typeof p.station!=='string'||!p.station.trim()||!Number.isFinite(p.price)||p.price<=0||p.price>1000)throw Error('ข้อมูลราคา API ไม่ถูกต้อง');const key=p.fuel+'|'+p.station;if(seen.has(key))throw Error('ราคา API ซ้ำ');seen.add(key)}
 return {...data,fetchedAt:new Date(now).toISOString()};
}

export function litersFromAmount(amount,price){const a=Number(amount),p=Number(price);if(!Number.isFinite(a)||!Number.isFinite(p)||a<=0||p<=0) return null;return Math.round(a/p*1e6)/1e6}
