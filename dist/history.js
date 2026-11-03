import {bounds,offset} from './core.js';
const DAY=86400000;
// A date-only source applies its retail price to that Bangkok calendar day.
export function summarizeHistory(rows,fuels,kind,now=new Date()){
 const ordered=rows.map(r=>({...r,time:Date.parse(r.date+'T00:00:00+07:00')})).sort((a,b)=>a.time-b.time);
 const todayEnd=Math.floor((+now+offset)/DAY)*DAY-offset+DAY;
 return Array.from({length:6},(_,i)=>{
  const [start,end]=bounds(kind,now,i-5),cutoff=Math.min(end,todayEnd);
  const values={},coverage={};
  for(let col=0;col<fuels.length;col++){
   let sum=0,covered=0;
   for(let j=0;j<ordered.length;j++){
    const row=ordered[j],a=Math.max(start,row.time),b=Math.min(cutoff,ordered[j+1]?.time??cutoff),price=row.values[col];
    if(b>a&&Number.isFinite(price)&&price>0){sum+=price*(b-a);covered+=b-a;}
   }
   coverage[fuels[col]]=covered/DAY;
   values[fuels[col]]=covered===cutoff-start&&covered>0?sum/covered:null;
  }
  return {start,end,through:cutoff,values,coverage};
 });
}
export function marketPriceTrend(records,fuel,snapshot,kind,now=new Date()){
 const start=bounds(kind,now,-5)[0],end=bounds(kind,now)[1],periodStarts=Array.from({length:6},(_,i)=>bounds(kind,now,i-5)[0]);
 const rows=records.filter(r=>r.fuel===fuel&&Date.parse(r.instant)>=start&&Date.parse(r.instant)<end&&Date.parse(r.instant)<=+now),liters=rows.reduce((s,r)=>s+r.liters,0),baseline=liters>0?rows.reduce((s,r)=>s+r.total,0)/liters:null;
 let previousMissing=true;
 const points=[];
 periodStarts.forEach((t,i)=>{
  const intervalEnd=periodStarts[i+1]||end,period=snapshot?.periods?.[kind]?.find(p=>p.start===t),price=period?.values?.[fuel];
  if(!Number.isFinite(price)||price<=0){previousMissing=true;return;}
  points.push({time:t+(intervalEnd-t)/2,price,current:i===5,gap:previousMissing,through:period.through});previousMissing=false;
 });
 return {start,end,baseline,points,periodStarts};
}
