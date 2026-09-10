import {auth} from './auth-session.js';
const config=window.Sync.publicApi(),query=new URLSearchParams(location.search);
const demo=location.pathname.endsWith('/priem.html')&&query.get('char')==='pericarditis-alimov';
const section=location.pathname.endsWith('/teacher.html')?'teacher':'student';
let signed=false;
function loginUrl(){const u=new URL('index.html',location.href);u.searchParams.set('lang',window.I18n?.language()||'ru');u.searchParams.set('auth','signup');u.searchParams.set('next',location.pathname.split('/').pop()+location.search);return u.href;}
function block(error){document.body.innerHTML='';document.documentElement.classList.remove('access-pending');const main=document.createElement('main');main.style.cssText='max-width:560px;margin:12vh auto;padding:28px;line-height:1.6';const h=document.createElement('h1');h.textContent=error==='teacher_required'?'Раздел для преподавателей':error==='auth_unavailable'?'Не удалось проверить доступ':'Продолжите обучение после входа';const p=document.createElement('p');p.textContent=error==='teacher_required'?'Для этого раздела администратор должен выдать аккаунту роль преподавателя.':'Все учебные случаи и практикум доступны с подтверждённым аккаунтом. Один демонстрационный приём открыт без регистрации.';const a=document.createElement('a');a.href=loginUrl();a.textContent='На главную';main.append(h,p,a);document.body.append(main);window.I18n?.render();}
async function request(asset){const {data,error}=await auth.getSession();if(error)throw new Error('auth_unavailable');const u=new URL(config.url+'/functions/v1/learning-content');u.searchParams.set('asset',asset);u.searchParams.set('section',section);const h={apikey:config.anonKey};if(data.session?.access_token)h.Authorization='Bearer '+data.session.access_token;const r=await fetch(u,{headers:h,cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'auth_unavailable');}return r;}
function remote(src){return /^characters\/(?!manifest\.js|loader\.js)[^/]+\.js$/.test(src)||['teacher.js','constructor.js','media-studio.js','clinical-media.js','media-lab.js'].includes(src);}
async function loadScript(src){const plain=src.split('?')[0];let blob;try{let url=src;if(remote(plain)){const r=await request(plain);blob=URL.createObjectURL(new Blob([await r.text()],{type:'text/javascript'}));url=blob;}await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(new Error('load_failed'));document.head.append(s);});}finally{if(blob)URL.revokeObjectURL(blob);}}
async function mediaRequest(body){
 const {data,error}=await auth.getSession();
 if(error||!data.session?.access_token)throw new Error('signin_required');
 const r=await fetch(config.url+'/functions/v1/teacher-media',{method:'POST',headers:{apikey:config.anonKey,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
 const result=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(result.error||'service_unavailable');return result;
}
window.LearningAccess={loadScript,mediaRequest,isDemo:()=>demo&&!signed};
async function boot(){try{
 if(!demo)await request('access');
 const {data}=await auth.getSession();signed=!!data.session?.user&&!data.session.user.is_anonymous;
 // A fresh guest demo must never inherit imported/shared cases from a previous session.
 if(demo&&!signed){window.SHARED_CASES=[];window.Sync.init=cb=>cb?.();}
 for(const script of document.querySelectorAll('script[data-training-src]'))await loadScript(script.dataset.trainingSrc);
 document.documentElement.classList.remove('access-pending');
 if(demo&&!signed){const bar=document.createElement('aside');bar.className='demo-banner';bar.innerHTML='<span>Демонстрационный приём · 1 из 12 случаев</span><a>Открыть все случаи</a>';bar.querySelector('a').href=loginUrl();document.body.prepend(bar);window.I18n?.render();}
}catch(error){block(error.message);}}
auth.onAuthStateChange((event,session)=>{if(signed&&(event==='SIGNED_OUT'||!session)){location.replace(loginUrl());}});
boot();
