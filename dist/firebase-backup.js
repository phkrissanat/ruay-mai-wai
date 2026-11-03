export function createFirebaseBackup(config,{storage=localStorage,request=fetch,schedule=setTimeout,cancel=clearTimeout,onStatus=()=>{}}={}){
 const queueKey='ruay-firebase-pending-v1',sessionKey='ruay-firebase-session-v1';
 let timer=null,running=false,again=false,delay=2000;
 const enabled=!!config?.apiKey&&!!config?.projectId;
 async function json(url,options){const r=await request(url,{...options,signal:AbortSignal.timeout(15000)});if(!r.ok){let data;try{data=await r.json()}catch{}const error=Error(data?.error?.message||'Firebase HTTP '+r.status);error.code=data?.error?.status||data?.error?.message||String(r.status);throw error}return r.json()}
 async function auth(){
  let session=JSON.parse(storage.getItem(sessionKey)||'null');
  if(session?.expiresAt>Date.now()+60000)return session;
  let data;
  if(session?.refreshToken){
   data=await json('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(config.apiKey),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:session.refreshToken}).toString()});
   session={uid:data.user_id,idToken:data.id_token,refreshToken:data.refresh_token,expiresAt:Date.now()+Number(data.expires_in)*1000};
  }else{
   data=await json('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(config.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
   session={uid:data.localId,idToken:data.idToken,refreshToken:data.refreshToken,expiresAt:Date.now()+Number(data.expiresIn)*1000};
  }
  if(!session.uid||!session.idToken||!session.refreshToken)throw Error('Firebase authentication failed');
  storage.setItem(sessionKey,JSON.stringify(session));return session;
 }
 function plan(ms){if(timer!==null)cancel(timer);timer=schedule(()=>{timer=null;flush()},ms)}
 async function flush(){
  if(!enabled)return false;
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
  }catch(error){onStatus('pending',error.code||error.cause?.code||error.message);plan(delay);delay=Math.min(delay*2,30000);return false}
  finally{running=false;if(again){again=false;plan(2000)}}
 }
 function enqueue(records,defaultFuel,marketObservations=[]){
  if(!enabled){onStatus('unconfigured');return false}
  const payload=JSON.stringify({records,defaultFuel,marketObservations});
  if(new TextEncoder().encode(payload).length>850000){onStatus('too-large');return false}
  storage.setItem(queueKey,JSON.stringify({payload,savedAt:new Date().toISOString()}));onStatus('pending');plan(2000);return true;
 }
 if(enabled&&storage.getItem(queueKey))plan(2000);
 return {enabled,enqueue,flush};
}
