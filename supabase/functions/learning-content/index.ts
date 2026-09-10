import CONTENT from './content.json' with { type: 'json' };
const DEMO = 'characters/pericarditis-alimov.js';
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Cache-Control':'no-store','Vary':'Authorization'};
const reply = (status:number, data:unknown) => new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}});
Deno.serve(async req => {
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='GET')return reply(405,{error:'method_not_allowed'});
 const url=new URL(req.url),asset=url.searchParams.get('asset')||'access',section=url.searchParams.get('section')||'student';
 if(asset!=='access'&&!Object.prototype.hasOwnProperty.call(CONTENT,asset))return reply(404,{error:'not_found'});
 if(asset!==DEMO){
  const authorization=req.headers.get('authorization')||'';
  if(!/^Bearer [^\s]+$/.test(authorization))return reply(401,{error:'signin_required'});
  try{
   const r=await fetch(Deno.env.get('SUPABASE_URL')+'/auth/v1/user',{headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')||'',Authorization:authorization},signal:AbortSignal.timeout(10000)});
   if(!r.ok)return reply(r.status===401||r.status===403?401:503,{error:'auth_unavailable'});
   const user=await r.json();
   if(!user.id||user.is_anonymous||!user.email_confirmed_at)return reply(403,{error:'confirmed_account_required'});
   if((section==='teacher'||asset==='teacher.js'||asset==='constructor.js'||asset==='media-studio.js')&&!['teacher','admin'].includes(user.app_metadata?.role))return reply(403,{error:'teacher_required'});
  }catch{return reply(503,{error:'auth_unavailable'});}
 }
 if(asset==='access')return reply(200,{allowed:true});
 return new Response(CONTENT[asset as keyof typeof CONTENT],{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8'}});
});
