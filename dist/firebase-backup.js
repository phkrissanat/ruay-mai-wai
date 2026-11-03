export function createFirebaseBackup(config,{storage=localStorage,request=fetch,schedule=setTimeout,cancel=clearTimeout,onStatus=()=>{},sessionProvider=null,startPaused=false}={}){
 const queueKey='ruay-firebase-pending-v1';
 storage.removeItem('ruay-firebase-session-v1');
 let timer=null,running=false,again=false,delay=2000,paused=startPaused;const idleWaiters=[];
 const enabled=!!config?.apiKey&&!!config?.projectId;
 async function json(url,options){const r=await request(url,{...options,signal:AbortSignal.timeout(15000)});if(!r.ok){let data;try{data=await r.json()}catch{}const error=Error(data?.error?.message||'Firebase HTTP '+r.status);error.code=data?.error?.status||data?.error?.message||String(r.status);error.httpStatus=r.status;throw error}return r.json()}
 async function auth(){
  const session=await sessionProvider?.();
  if(!session?.uid||!session?.idToken||session.provider!=='google.com'){const error=Error('Google sign-in required');error.code='auth-required';throw error;}
  return session;
 }
 function plan(ms){if(paused)return;if(timer!==null)cancel(timer);timer=schedule(()=>{timer=null;flush()},ms)}
 async function flush(){
  if(!enabled||paused)return false;
  if(running){again=true;return false}running=true;
  try{
   const pending=storage.getItem(queueKey);if(!pending)return true;
   const payload=JSON.parse(pending),session=await auth();
   const url='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(config.projectId)+'/databases/(default)/documents/users/'+encodeURIComponent(session.uid)+'/backups/latest';
   await json(url,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.idToken},body:JSON.stringify({fields:{schemaVersion:{integerValue:'1'},payload:{stringValue:payload.payload},savedAt:{timestampValue:payload.savedAt}}})});
   // Read back before declaring success.
   const verified=await json(url,{headers:{Authorization:'Bearer '+session.idToken}});
   if(verified.fields?.payload?.stringValue!==payload.payload)throw Error('Backup verification failed');
   if(storage.getItem(queueKey)===pending)storage.removeItem(queueKey);else again=true;
   delay=2000;onStatus('synced');return true;
  }catch(error){if(error.code==='auth-required'){onStatus('signed-out');return false;}onStatus('pending',error.code||error.cause?.code||error.message);plan(delay);delay=Math.min(delay*2,30000);return false}
  finally{running=false;idleWaiters.splice(0).forEach(resolve=>resolve());if(again){again=false;plan(2000)}}
 }
 function enqueue(records,defaultFuel,marketObservations=[]){
  if(!enabled){onStatus('unconfigured');return false}
  const payload=JSON.stringify({records,defaultFuel,marketObservations});
  if(new TextEncoder().encode(payload).length>850000){onStatus('too-large');return false}
  storage.setItem(queueKey,JSON.stringify({payload,savedAt:new Date().toISOString()}));onStatus('pending');plan(2000);return true;
 }
 if(enabled&&storage.getItem(queueKey))plan(2000);
 function pause(){paused=true;if(timer!==null){cancel(timer);timer=null;}return running?new Promise(resolve=>idleWaiters.push(resolve)):Promise.resolve();}
 function resume(){paused=false;if(storage.getItem(queueKey))plan(0);}
 async function restore(){const session=await auth(),url='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(config.projectId)+'/databases/(default)/documents/users/'+encodeURIComponent(session.uid)+'/backups/latest';let document;try{document=await json(url,{headers:{Authorization:'Bearer '+session.idToken}})}catch(error){if(error.httpStatus===404)return null;throw error;}const text=document.fields?.payload?.stringValue;if(typeof text!=='string'||text.length>900000)throw Error('ข้อมูลสำรองไม่ถูกต้อง');return {data:JSON.parse(text),savedAt:document.fields?.savedAt?.timestampValue};}
 return {enabled,enqueue,flush,pause,resume,restore};
}
