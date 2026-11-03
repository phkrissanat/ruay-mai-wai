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
 let weightedTotal=0,coveredTime=0;
 let previousMissing=true;
 const points=[];
 periodStarts.forEach((t,i)=>{
  const intervalEnd=periodStarts[i+1]||end,period=snapshot?.periods?.[kind]?.find(p=>p.start===t),price=period?.values?.[fuel];
  if(!Number.isFinite(price)||price<=0){previousMissing=true;return;}
  const duration=period.through-period.start;
  if(duration>0){weightedTotal+=price*duration;coveredTime+=duration;}
  points.push({time:t+(intervalEnd-t)/2,price,current:i===5,gap:previousMissing,through:period.through});previousMissing=false;
 });
 const baseline=coveredTime>0?weightedTotal/coveredTime:null;
 return {start,end,baseline,points,periodStarts};
}
