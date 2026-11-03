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
export function marketPriceTrend(records,fuel,snapshot,kind,now=new Date(),observations=[]){
 snapshot=extendMarketHistory(snapshot,observations,now);
 const start=bounds(kind,now,-5)[0],end=bounds(kind,now)[1],periodStarts=Array.from({length:6},(_,i)=>bounds(kind,now,i-5)[0]);
 let weightedTotal=0,coveredTime=0;
 let previousMissing=true;
 const points=[];
 periodStarts.forEach((t,i)=>{
  const intervalEnd=periodStarts[i+1]||end,period=snapshot?.periods?.[kind]?.find(p=>p.start===t),price=period?.values?.[fuel];
  if(!Number.isFinite(price)||price<=0){previousMissing=true;return;}
  const duration=Number.isFinite(period.coverage?.[fuel])?period.coverage[fuel]*DAY:period.through-period.start;
  if(duration>0){weightedTotal+=price*duration;coveredTime+=duration;}
  points.push({time:t+(intervalEnd-t)/2,price,current:i===5,gap:previousMissing,through:period.through,coverage:period.coverage?.[fuel],expectedDays:(period.through-period.start)/DAY});previousMissing=false;
 });
 const baseline=coveredTime>0?weightedTotal/coveredTime:null;
 return {start,end,baseline,points,periodStarts,asOf:snapshot?.asOf};
}

export function rememberQuote(observations,quote,now=new Date()){
 const today=new Date(+now+offset).toISOString().slice(0,10),checked=Date.parse(quote?.fetchedAt);
 if(quote?.date!==today||!Number.isFinite(checked)||checked>+now||+now-checked>15*60000)return observations;
 const prices=Object.fromEntries((quote.prices||[]).filter(p=>p.fuel&&Number.isFinite(p.today)&&p.today>0&&p.today<1000).map(p=>[p.fuel,p.today]));
 if(!Object.keys(prices).length)return observations;
 const previous=observations.find(o=>o.date===today);
 if(previous&&JSON.stringify(previous.prices)===JSON.stringify(prices))return observations;
 const earliest=new Date(bounds('year',now,-5)[0]+offset).toISOString().slice(0,10);
 return [...observations.filter(o=>o.date!==today&&o.date>=earliest),{date:today,prices,checkedAt:quote.fetchedAt}].sort((a,b)=>a.date.localeCompare(b.date));
}
export function extendMarketHistory(seed,observations=[],now=new Date()){
 if(!seed)return null;
 const todayEnd=Math.floor((+now+offset)/DAY)*DAY-offset+DAY;
 const byDay=new Map();
 for(const o of observations){if(/^\d{4}-\d{2}-\d{2}$/.test(o?.date||'')&&o.date<=new Date(+now+offset).toISOString().slice(0,10))byDay.set(o.date,o);}
 const days=[...byDay.values()],fuels=new Set([...Object.keys(seed.lastPrices||{}),...Object.values(seed.periods||{}).flatMap(ps=>ps.flatMap(p=>Object.keys(p.values||{}))),...days.flatMap(o=>Object.keys(o.prices||{}))]);
 const periods=Object.fromEntries(['week','month','year'].map(kind=>[kind,Array.from({length:6},(_,i)=>{
  const [start,end]=bounds(kind,now,i-5),cutoff=Math.min(end,todayEnd),original=seed.periods?.[kind]?.find(p=>p.start===start),values={},coverage={};
  for(const fuel of fuels){
   const oldPrice=original?.values?.[fuel],hasSeed=Number.isFinite(oldPrice)&&oldPrice>0;
   let duration=hasSeed?original.through-start:0,sum=hasSeed?oldPrice*duration:0;
   for(const o of days){const t=Date.parse(o.date+'T00:00:00+07:00'),price=o.prices?.[fuel];if(t<start||t>=cutoff||!Number.isFinite(price)||price<=0)continue;
    if(hasSeed&&t<original.through){
     const oldDaily=seed.lastPrices?.[fuel];
     if(o.date===seed.asOf&&Number.isFinite(oldDaily))sum+=(price-oldDaily)*DAY;
     continue;
    }
    sum+=price*DAY;duration+=DAY;
   }
   values[fuel]=duration>0?sum/duration:null;coverage[fuel]=duration/DAY;
  }
  return {start,end,through:cutoff,values,coverage};
 })]));
 const asOf=[seed.asOf,...days.map(o=>o.date)].filter(Boolean).sort().at(-1);
 return {...seed,asOf,periods};
}
