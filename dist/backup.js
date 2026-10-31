const KEY='temdee-auto-backup-v1';
export function readBackup(storage=localStorage){
 const data=JSON.parse(storage.getItem(KEY)||'[]');
 if(!Array.isArray(data))throw Error('ข้อมูลสำรองไม่ถูกต้อง');
 return data;
}
export function saveBackup(records,defaultFuel,storage=localStorage){
 let snapshots=readBackup(storage);
 const payload=JSON.stringify({records,defaultFuel});
 if(snapshots[0]?.payload===payload)return;
 snapshots=[{savedAt:new Date().toISOString(),payload},...snapshots].slice(0,5);
 for(;;){try{storage.setItem(KEY,JSON.stringify(snapshots));return}catch(e){if(snapshots.length===1)throw e;snapshots.pop()}}
}
export function latestBackup(storage=localStorage){const latest=readBackup(storage)[0];return latest?JSON.parse(latest.payload):null}
