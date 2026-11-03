import {validate,FUELS} from './core.js';
export function validateCloudData(data){
 if(!data||!Array.isArray(data.records)||data.records.length>100000)throw Error('ข้อมูลสำรองไม่ถูกต้อง');
 const records=data.records.map(validate),byDay=new Map();
 for(const o of data.marketObservations||[]){const t=Date.parse(o?.date+'T00:00:00+07:00');if(!Number.isFinite(t)||new Date(t+7*3600000).toISOString().slice(0,10)!==o.date)continue;const prices=Object.fromEntries(Object.entries(o.prices||{}).filter(([fuel,price])=>FUELS.includes(fuel)&&Number.isFinite(price)&&price>0&&price<1000));if(Object.keys(prices).length)byDay.set(o.date,{date:o.date,prices,checkedAt:o.checkedAt});}
 return {records,defaultFuel:FUELS.includes(data.defaultFuel)?data.defaultFuel:FUELS[0],marketObservations:[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date))};
}
export function accountData(local,remote,owner,uid){
 const cloud=remote?validateCloudData(remote):null;
 if(owner===uid)return local;
 if(owner)return cloud||{records:[],defaultFuel:FUELS[0],marketObservations:[]};
 if(!cloud)return local;
 const records=new Map(cloud.records.map(r=>[r.id,r]));for(const r of local.records)records.set(r.id,r);
 const days=new Map(cloud.marketObservations.map(o=>[o.date,o]));for(const o of local.marketObservations){const prev=days.get(o.date);if(!prev||String(o.checkedAt||'')>=String(prev.checkedAt||''))days.set(o.date,o);}
 return {records:[...records.values()],defaultFuel:local.records.length?local.defaultFuel:cloud.defaultFuel,marketObservations:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date))};
}
