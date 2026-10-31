import {localTime} from './core.js';
// Check the Bangkok calendar even when the page stays open across midnight.
export function createCalendarClock(onChange,{now=()=>new Date(),schedule=setInterval,cancel=clearInterval}={}){
 let day=localTime(now()).slice(0,10);
 const check=()=>{const next=localTime(now()).slice(0,10);if(next!==day){day=next;onChange()}};
 const timer=schedule(check,1000);
 return {check,stop:()=>cancel(timer)};
}
