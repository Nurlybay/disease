import { AuthClient } from '../tools/auth-build/node_modules/@supabase/auth-js/dist/module/index.js';
const config = window.Sync.publicApi();
// Client-only email links may be opened on a different device. The SDK consumes
// and removes the fragment tokens; never copy them into links or logs.
const auth = new AuthClient({url:config.url+'/auth/v1',headers:{apikey:config.anonKey},storageKey:'vp.guest-auth.v1.'+config.url,flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true});
const el = id => document.getElementById('account'+id);
const dialog=el('Dialog'),form=el('Form'),email=el('Email'),password=el('Password');
let mode='login',busy=false,pendingNext=null;
const copy={login:['Вход','Войти','Используйте почту и пароль своего аккаунта.'],signup:['Регистрация','Создать аккаунт','Любая почта. Пароль — не менее 8 символов. Подтвердите адрес по ссылке в письме.'],reset:['Восстановление пароля','Отправить ссылку','Укажите почту, с которой зарегистрировались.'],update:['Новый пароль','Сохранить пароль','Придумайте новый пароль — не менее 8 символов.']};
function message(text){el('Message').textContent=text;}
function open(next){if(busy)return;mode=next;const c=copy[mode];el('Title').textContent=c[0];el('Submit').textContent=c[1];el('Hint').textContent=c[2];message('');password.value='';email.disabled=mode==='update';el('EmailLabel').hidden=mode==='update';password.disabled=mode==='reset';el('PasswordLabel').hidden=mode==='reset';password.minLength=mode==='login'?1:8;password.autocomplete=mode==='login'?'current-password':'new-password';el('Switch').textContent=mode==='login'?'Создать аккаунт':'Уже есть аккаунт';el('Switch').hidden=mode==='update';el('Forgot').hidden=mode!=='login';if(!dialog.open)dialog.showModal();(mode==='update'?password:email).focus();}
function show(user){const signed=!!user&&!user.is_anonymous;el('Login').hidden=signed;el('Register').hidden=signed;el('Logout').hidden=!signed;el('Name').hidden=!signed;el('Name').textContent=signed?(user.email||'Аккаунт'):'';document.body.classList.toggle('is-member',signed);window.accountSignedIn=signed;}
function callback(){const url=new URL('index.html',location.href);url.searchParams.set('lang',window.I18n?.language()||'ru');return url.href;}
function failure(error){if(error?.code==='invalid_credentials')return 'Неверная почта или пароль.';if(error?.code==='email_not_confirmed')return 'Подтвердите почту по ссылке в письме.';if(error?.status===429)return 'Слишком много попыток. Подождите и повторите.';if(error?.code==='email_address_not_authorized'||error?.code==='unexpected_failure')return 'Не удалось отправить письмо. Обратитесь к администратору сайта.';return 'Не удалось выполнить запрос. Проверьте соединение и повторите.';}
el('Login').addEventListener('click',()=>open('login'));
el('Register').addEventListener('click',()=>open('signup'));
el('Forgot').addEventListener('click',()=>open('reset'));
el('Switch').addEventListener('click',()=>open(mode==='login'?'signup':'login'));
el('Close').addEventListener('click',()=>{if(!busy)dialog.close();});
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
dialog.addEventListener('close',()=>{password.value='';});
form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!form.reportValidity())return;busy=true;el('Submit').disabled=true;message('Подождите…');const submitted=mode;try{let result;
 if(mode==='login')result=await auth.signInWithPassword({email:email.value.trim(),password:password.value});
 else if(mode==='signup')result=await auth.signUp({email:email.value.trim(),password:password.value,options:{emailRedirectTo:callback()}});
 else if(mode==='reset')result=await auth.resetPasswordForEmail(email.value.trim(),{redirectTo:callback()});
 else result=await auth.updateUser({password:password.value});
 if(result.error)throw result.error;
 if(submitted==='reset')message('Если аккаунт с такой почтой существует, письмо для восстановления будет отправлено. Проверьте также папку «Спам».');
 else if(submitted==='signup'&&!result.data?.session)message('Проверьте почту: для завершения регистрации откройте ссылку в письме. Если аккаунт уже существует, войдите или восстановите пароль.');
 else {show(result.data?.user||result.data?.session?.user);dialog.close();const status=document.getElementById('authStatus');status.hidden=false;status.textContent=submitted==='update'?'Пароль сохранён.':'Вы вошли в аккаунт.';const next=safeNext();if(next&&submitted!=='update')location.assign(next);}
 }catch(error){message(failure(error));}finally{password.value='';busy=false;el('Submit').disabled=false;}});
el('Logout').addEventListener('click',async()=>{el('Logout').disabled=true;try{const {error}=await auth.signOut({scope:'local'});if(error)throw error;show(null);document.getElementById('authStatus').hidden=true;}catch(error){const s=document.getElementById('authStatus');s.hidden=false;s.textContent=failure(error);}finally{el('Logout').disabled=false;}});
auth.onAuthStateChange((event,session)=>{show(session?.user);if(event==='PASSWORD_RECOVERY')open('update');});
auth.getSession().then(({data,error})=>{if(error){const s=document.getElementById('authStatus');s.hidden=false;s.textContent='Ссылка недействительна или устарела. Запросите новое письмо.';}else show(data.session?.user);}).catch(()=>show(null));

function safeNext(){const raw=pendingNext||new URLSearchParams(location.search).get('next');if(!raw)return null;try{const u=new URL(raw,location.href);if(u.origin!==location.origin||!['priem.html','media-lab.html','teacher.html'].includes(u.pathname.split('/').pop())||u.pathname.slice(0,u.pathname.lastIndexOf('/')+1)!==location.pathname.slice(0,location.pathname.lastIndexOf('/')+1))return null;return u.href;}catch{return null;}}
document.addEventListener('click',e=>{const a=e.target.closest?.('a');const button=e.target.closest?.('[data-register]');if(button){open('signup');return;}if(!a||window.accountSignedIn||a.dataset.demo!==undefined)return;const u=new URL(a.href,location.href);if(u.origin===location.origin&&['priem.html','teacher.html','media-lab.html'].includes(u.pathname.split('/').pop())){e.preventDefault();pendingNext=u.href;open('signup');}});
if(new URLSearchParams(location.search).get('auth')==='signup')open('signup');
