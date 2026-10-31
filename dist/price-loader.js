// One request per open/resume; no polling or scheduled retries.
export function createPriceLoader(attempt,{onStateChange=()=>{}}={}){
 let pending=null;
 function check(){if(pending)return pending;pending=Promise.resolve().then(attempt).then(Boolean,()=>false).finally(()=>{pending=null;onStateChange()});onStateChange();return pending}
 return {check,get pending(){return pending}};
}
