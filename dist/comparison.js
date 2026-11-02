import {bounds,offset} from './core.js';
export function comparisonSeries(records,kind,now=new Date()){
 const ranges=[bounds(kind,now),bounds(kind,now,-1)],day=86400000;
 const series=ranges.map(([start,end],index)=>{
  const count=kind==='year'?12:(end-start)/day;
  return Array.from({length:count},(_,i)=>{
   const y=new Date(start+offset).getUTCFullYear();
   const a=kind==='year'?Date.UTC(y,i,1)-offset:start+i*day;
   const b=kind==='year'?Date.UTC(y,i+1,1)-offset:a+day;
   if(index===0&&a>+now)return null;
   return records.reduce((sum,r)=>{const t=Date.parse(r.instant);return sum+(t>=a&&t<b&&t<=+now?r.total:0)},0);
  });
 });
 const size=Math.max(...series.map(s=>s.length));
 series.forEach(s=>{while(s.length<size)s.push(null)});
 const labels=Array.from({length:size},(_,i)=>kind==='week'?['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'][i]:String(i+1));
 return {series,labels,ranges};
}

export function fuelPriceComparison(records,fuels,quote,range){
 return fuels.map(fuel=>{const rows=records.filter(r=>r.fuel===fuel&&(!range||(Date.parse(r.instant)>=range[0]&&Date.parse(r.instant)<range[1]))),liters=rows.reduce((s,r)=>s+r.liters,0),total=rows.reduce((s,r)=>s+r.total,0),price=quote?.prices?.find(r=>r.fuel===fuel)?.today;
 return {fuel,current:Number.isFinite(price)&&price>0?price:null,average:liters>0?total/liters:null};});
}

export function fuelPriceSeries(records,fuel,quote,kind,now=new Date()){
 const [start,end]=bounds(kind,now),day=86400000,count=kind==='year'?12:Math.round((end-start)/day),year=new Date(start+offset).getUTCFullYear();
 const current=quote?.prices?.find(r=>r.fuel===fuel)?.today;
 const average=Array.from({length:count},(_,i)=>{const a=kind==='year'?Date.UTC(year,i,1)-offset:start+i*day,b=kind==='year'?Date.UTC(year,i+1,1)-offset:a+day;const rows=records.filter(r=>r.fuel===fuel&&Date.parse(r.instant)>=a&&Date.parse(r.instant)<b&&Date.parse(r.instant)<=+now),liters=rows.reduce((s,r)=>s+r.liters,0);return liters>0?rows.reduce((s,r)=>s+r.total,0)/liters:null;});
 const labels=Array.from({length:count},(_,i)=>kind==='week'?['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'][i]:String(i+1));
 return {current:Number.isFinite(current)&&current>0?current:null,average,labels};
}

export function priceTrend(records,fuel,quote,kind,now=new Date()){
 const currentRange=bounds(kind,now),start=bounds(kind,now,-5)[0],end=currentRange[1],rows=records.filter(r=>r.fuel===fuel&&Date.parse(r.instant)>=start&&Date.parse(r.instant)<end&&Date.parse(r.instant)<=+now).sort((a,b)=>Date.parse(a.instant)-Date.parse(b.instant));
 const liters=rows.reduce((s,r)=>s+r.liters,0),baseline=liters>0?rows.reduce((s,r)=>s+r.total,0)/liters:null;
 const points=rows.map(r=>({time:Date.parse(r.instant),price:r.price,current:false}));const current=quote?.prices?.find(r=>r.fuel===fuel)?.today;
 if(Number.isFinite(current)&&current>0)points.push({time:+now,price:current,current:true});
 return {start,end,baseline,points,periodStarts:Array.from({length:6},(_,i)=>bounds(kind,now,i-5)[0])};
}
export function priceColor(price,baseline){return baseline==null||price===baseline?'#88988d':price>baseline?'#c53232':'#218347'}
