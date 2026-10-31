
import {localTime} from './core.js';
export const API='https://oil-price.bangchak.co.th/ApiOilPrice2/th';
export function thaiDate(s){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s||'');if(!m)throw Error('วันที่ประกาศไม่ถูกต้อง');const y=+m[3]-543;const d=y+'-'+m[2]+'-'+m[1];if(!Number.isFinite(Date.parse(d+'T00:00:00+07:00'))||localTime(new Date(d+'T00:00:00+07:00')).slice(0,10)!==d)throw Error('วันที่ผิด');return d}
export function mapFuel(n){if(/E20/i.test(n))return 'E20';if(/E85/i.test(n))return 'E85';if(/B20/i.test(n))return 'ดีเซล B20';if(/98/.test(n))return 'เบนซินพรีเมียม 98';if(/ดีเซล/.test(n))return /พรีเมียม/.test(n)?'ดีเซลพรีเมียม':'ดีเซล';if(/91/.test(n))return 'แก๊สโซฮอล์ 91';if(/95/.test(n))return /พรีเมียม/.test(n)?'แก๊สโซฮอล์ 95 พรีเมียม':'แก๊สโซฮอล์ 95';return null}
export function parseAnnouncement(raw,now=new Date()){
 const x=raw?.[0];if(!x)throw Error('ไม่มีประกาศ');const date=thaiDate(x.OilDateNow),issuedDate=thaiDate(x.OilPriceDate);
 if(date>localTime(now).slice(0,10))throw Error('วันที่ข้อมูลอยู่ในอนาคต');
 const list=typeof x.OilList==='string'?JSON.parse(x.OilList):x.OilList;
 if(!Array.isArray(list)||!list.length)throw Error('ไม่มีตารางราคา');
 const prices=list.map(p=>{if(typeof p.OilName!=='string'||!Number.isFinite(p.PriceToday)||p.PriceToday<=0||p.PriceToday>1000)throw Error('ราคาไม่ถูกต้อง');return {name:p.OilName,fuel:mapFuel(p.OilName),today:p.PriceToday,yesterday:Number.isFinite(p.PriceYesterday)&&p.PriceYesterday>0?p.PriceYesterday:null,tomorrow:Number.isFinite(p.PriceTomorrow)&&p.PriceTomorrow>0?p.PriceTomorrow:null}});
 return {date,issuedAt:issuedDate+' '+String(x.OilPriceTime||''),effectiveText:String(x.OilRemark2||'ไม่ระบุเวลาที่มีผล'),remark:String(x.OilRemark||''),prices,fetchedAt:now.toISOString(),source:API};
}
export function canUse(q,datetime,now=new Date()){return !!q&&q.date===localTime(now).slice(0,10)&&datetime.slice(0,10)===q.date&&+now-Date.parse(q.fetchedAt)>=0&&+now-Date.parse(q.fetchedAt)<15*60000}

export function selectedPrice(q,fuel){
 const p=q?.prices.find(p=>p.fuel===fuel);if(!p)return null;
 const upcoming=p.tomorrow!==null&&p.tomorrow!==p.today;
 const delta=upcoming?p.tomorrow-p.today:p.yesterday!=null?p.today-p.yesterday:0;
 const months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
 const match=q.effectiveText?.replace(/\s+/g,' ').match(/วันที่\s*(\d{1,2})\s*(\S+)\s*(\d{2,4})/);
 let futureDate=null;
 if(match&&months.includes(match[2])){let year=Number(match[3]);year=year<100?2500+year:year;futureDate=String(year-543)+'-'+String(months.indexOf(match[2])+1).padStart(2,'0')+'-'+match[1].padStart(2,'0')}
 return {...p,delta:Math.round(delta*100)/100,upcoming,effectiveText:upcoming&&!(futureDate>q.date)?'วันที่มีผล: ต้นทางยังไม่ระบุ':q.effectiveText};
}

export function priceImpact(price,amount){
 const money=Number(amount);if(!price||!Number.isFinite(money)||money<=0||!price.delta)return null;
 const before=price.upcoming?price.today:price.yesterday,after=price.upcoming?price.tomorrow:price.today;
 if(!(before>0&&after>0))return null;
 return {before,after,litersBefore:money/before,litersAfter:money/after,litersChange:money/after-money/before,amount:money,upcoming:price.upcoming};
}

export function parsePriceSnapshot(snapshot,now=new Date()){
 const fetched=Date.parse(snapshot?.fetchedAt);
 if(!Number.isFinite(fetched)||fetched>+now+60000)throw Error('เวลาอัปเดตไม่ถูกต้อง');
 return parseAnnouncement(snapshot.raw,new Date(fetched));
}
