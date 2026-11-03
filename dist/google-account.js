const APP_URL='https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js',AUTH_URL='https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
export function createGoogleAccount(config,{onUser=()=>{},onError=()=>{},load=()=>Promise.all([import(APP_URL),import(AUTH_URL)])}={}){
 let sdk,auth,loading;
 function start(){if(loading)return loading;loading=(async()=>{const [app,api]=await load();sdk=api;auth=api.getAuth(app.getApps().length?app.getApp():app.initializeApp(config));auth.languageCode='th';api.onAuthStateChanged(auth,user=>Promise.resolve(onUser(user)).catch(onError),onError);await auth.authStateReady();return auth;})().catch(error=>{loading=null;throw error});return loading;}
 function signIn(){if(!auth||!sdk)throw Error('กำลังเตรียมการเข้าสู่ระบบ');const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return sdk.signInWithPopup(auth,provider);}
 return {start,signIn,signOut:()=>sdk.signOut(auth),current:()=>auth?.currentUser||null,session:async()=>{const user=auth?.currentUser;return user?{uid:user.uid,idToken:await user.getIdToken()}:null}};
}
