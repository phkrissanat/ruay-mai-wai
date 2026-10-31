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
 const labels=Array.from({length:size},(_,i)=>kind==='week'?['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'][i]:String(i+1));
 return {series,labels,ranges};
}
