// No client-supplied URLs or provider model overrides. All paid calls require a teacher role.
const env = (name: string) => Deno.env.get(name) || '';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const reply = (status: number, data: unknown) => Response.json(data,{status,headers:cors});
const ROUTER='https://openrouter.ai/api/v1';
const IMAGE_MODEL='openai/gpt-image-2.5-sunburst', VIDEO_MODEL='minimax/hailuo-3-max';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Job = {context?:{purpose?:string;detail_image?:string;references?:string[]};usage?:{cost?:number};id:string;owner_id:string;kind:string;status:string;description:string;motion:string;image_url?:string;video_url?:string;provider_task_id?:string;created_at:string;updated_at:string;error?:string};
class Fault extends Error { constructor(public code:string,public status=400){super(code);} }
const base = () => env('SUPABASE_URL');
const serviceHeaders = () => ({apikey:env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'});
async function db(path:string, method='GET', body?:unknown) {
 const r=await fetch(base()+'/rest/v1/'+path,{method,headers:serviceHeaders(),body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok){const detail=await r.text();if(detail.includes('daily_limit'))throw new Fault('daily_limit',429);if(detail.includes('image_required'))throw new Fault('image_required');throw new Fault('storage_unavailable',503);}
 return r.status===204?null:await r.json();
}
async function update(job:Job, values:Record<string,unknown>){await db('teacher_media_jobs?id=eq.'+job.id,'PATCH',{...values,updated_at:new Date().toISOString()});Object.assign(job,values);}
async function owned(id:unknown, owner:string):Promise<Job>{
 if(typeof id!=='string'||!UUID.test(id))throw new Fault('invalid_job');
 const rows=await db('teacher_media_jobs?id=eq.'+id+'&owner_id=eq.'+owner);
 if(!rows.length)throw new Fault('not_found',404);return rows[0];
}
function present(job:Job){return {id:job.id,kind:job.kind,status:job.status,description:job.description,motion:job.motion,image_url:job.image_url,video_url:job.video_url,created_at:job.created_at,error:job.error,purpose:job.context?.purpose||'finding',detail_image:job.context?.detail_image,cost:typeof job.usage?.cost==='number'?job.usage.cost:null};}
async function user(req:Request){
 const authorization=req.headers.get('authorization')||'';
 if(!/^Bearer [^\s]+$/.test(authorization))throw new Fault('signin_required',401);
 const r=await fetch(base()+'/auth/v1/user',{headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:authorization},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Fault('signin_required',401);
 const u=await r.json();
 if(!u.id||!UUID.test(u.id)||u.is_anonymous||!u.email_confirmed_at||!['teacher','admin'].includes(u.app_metadata?.role))throw new Fault('teacher_required',403);
 return u.id as string;
}
function description(value:unknown,max:number){if(typeof value!=='string'||value.trim().length<3||value.length>max)throw new Fault('invalid_description');return value.trim();}
function configured(){return {image:!!env('OPENROUTER_API_KEY'),video:!!env('OPENROUTER_API_KEY')};}
async function provider(url:string,key:string,body?:unknown,timeout=30000){
 const r=await fetch(url,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
 if(!r.ok)throw new Fault(r.status===429?'provider_busy':r.status===402?'provider_balance':r.status===401||r.status===403?'provider_access':r.status>=500?'provider_uncertain':'provider_rejected',502);
 return r.json();
}
async function upload(job:Job,bytes:Uint8Array,type:'image/png'|'video/mp4'){
 const path=job.owner_id+'/'+job.id+(type==='image/png'?'.png':'.mp4');
 const r=await fetch(base()+'/storage/v1/object/teaching-media/'+path,{method:'POST',headers:{...serviceHeaders(),'Content-Type':type,'x-upsert':'true'},body:bytes,signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw new Fault('save_failed',503);
 return base()+'/storage/v1/object/public/teaching-media/'+path;
}
// Fixed authenticated OpenRouter endpoint; ignore provider-returned URLs.
function videoPath(id:string){
 if(!/^[a-zA-Z0-9_-]{1,200}$/.test(id))throw new Fault('provider_status_failed',502);
 return ROUTER+'/videos/'+id;
}
async function download(id:string){
 const r=await fetch(videoPath(id)+'/content?index=0',{headers:{Authorization:'Bearer '+env('OPENROUTER_API_KEY')},redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!r.ok||!r.body)throw new Fault('download_failed',503);
 const max=50*1024*1024;
 if(Number(r.headers.get('content-length'))>max)throw new Fault('video_too_large');
 const reader=r.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Fault('video_too_large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
 if(new TextDecoder().decode(bytes.slice(4,8))!=='ftyp')throw new Fault('invalid_video');
 return bytes;
}
async function start(job:Job){
 try{
  await update(job,{status:'running'});
  if(job.kind==='image'){
   const r=await provider(ROUTER+'/images',env('OPENROUTER_API_KEY'),{
    model:IMAGE_MODEL,n:1,aspect_ratio:'16:9',quality:'medium',output_format:'png',
    input_references:(job.context?.references||[]).map(url=>({type:'image_url',image_url:{url}})),
    prompt:job.context?.purpose==='patient' ? 'Create a photorealistic fictional adult patient seated in a neutral medical office, waist-up, both hands visible, natural lighting, consistent face and clothing, no text. Character description: '+job.description : job.context?.purpose==='scene' ? 'Create a clinical teaching scene. Reference 1 is the exact fictional patient: preserve identity, age, skin tone and clothing. If reference 2 is supplied, it is the clinical finding to reproduce on this patient, not a second person. Show the patient demonstrating their complaint. Anatomically accurate, no text, no extra pathology. Scene: '+job.description : 'Create one realistic clinical education illustration of a fictional adult. Close-up examination view, neutral clinical lighting, accurate anatomy, plain background, no text or labels. Show only the requested finding; do not add other pathology, instruments or diagnostic conclusions. This is synthetic educational material. Requested finding: '+job.description
   },120000);
   const encoded=r.data?.[0]?.b64_json;
   if(typeof encoded!=='string'||encoded.length>28*1024*1024)throw new Fault('invalid_image');
   const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
   if(bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)throw new Fault('invalid_image');
   const image_url=await upload(job,bytes,'image/png');await update(job,{status:'ready',image_url,usage:r.usage||null});
  }else{
   const r=await provider(ROUTER+'/videos',env('OPENROUTER_API_KEY'),{
    model:VIDEO_MODEL,duration:6,resolution:'768p',aspect_ratio:'16:9',generate_audio:false,
    prompt:'Clinical teaching clip of a fictional adult. Preserve the exact anatomy, skin texture, lighting and visible findings of the first frame throughout. Fixed camera. No new pathology, no healing, no text, no speech. Subtle movement only: '+job.motion,
    frame_images:[{type:'image_url',image_url:{url:job.image_url},frame_type:'first_frame'}]
   });
   if(typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(r.id))throw new Fault('provider_uncertain',502);
   await update(job,{provider_task_id:r.id});
  }
 }catch(e){
  const code=e instanceof Fault?e.code:'provider_uncertain';
  // A network timeout may have incurred a charge: never automatically submit again.
  const uncertain=['provider_uncertain','save_failed','storage_unavailable'].includes(code);
  try{await update(job,{status:uncertain?'uncertain':'failed',error:code});}catch{console.error('teacher-media job needs reconciliation',job.id);}
 }
}
async function refresh(job:Job){
 if(job.status!=='running'&&job.status!=='queued')return;
 if(job.kind==='video'&&job.provider_task_id){
  const t=await provider(videoPath(job.provider_task_id),env('OPENROUTER_API_KEY'));
  if(!t||t.id!==job.provider_task_id)throw new Fault('provider_status_failed',502);
  if(t.status==='completed'){
   // On storage failure keep the provider task id and retry ONLY download on next refresh.
   const video_url=await upload(job,await download(job.provider_task_id),'video/mp4');
   await update(job,{status:'ready',video_url,usage:t.usage||null,error:null});
  }else if(['failed','cancelled','expired'].includes(t.status))await update(job,{status:'failed',error:'video_failed'});
 }else if(Date.now()-Date.parse(job.updated_at)>5*60*1000){
  await update(job,{status:'uncertain',error:'provider_uncertain'});
 }
}
export async function handle(req:Request){
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
 try{
  const owner=await user(req);
  const raw=await req.text();if(raw.length>8192)throw new Fault('request_too_large',413);
  let body;try{body=JSON.parse(raw);}catch{throw new Fault('invalid_request');}
  if(!body||typeof body!=='object')throw new Fault('invalid_request');
  if(body.action==='config')return reply(200,{...configured(),duration:6,resolution:'768p',image_model:IMAGE_MODEL,video_model:VIDEO_MODEL});
  if(body.action==='list'){
   const rows=await db('teacher_media_jobs?owner_id=eq.'+owner+'&order=created_at.desc&limit=50');
   return reply(200,{jobs:rows.map(present)});
  }
  if(body.action==='status'){const job=await owned(body.id,owner);await refresh(job);return reply(200,{job:present(job)});}
  if(!['image','video'].includes(body.action))throw new Fault('invalid_action');
  if(!UUID.test(body.id||''))throw new Fault('invalid_job');
  if(!configured()[body.action as 'image'|'video'])throw new Fault('not_configured',503);
  let desc='',motion='',parent=null,context:NonNullable<Job['context']>={purpose:'finding'};
  if(body.action==='image'){
   desc=description(body.description,1500);
   if(!['finding','patient','scene'].includes(body.purpose||'finding'))throw new Fault('invalid_action');
   context.purpose=body.purpose||'finding';
   if(context.purpose==='scene'){
    if(body.reviewed!==true)throw new Fault('review_required');
    const patient=await owned(body.patient_id,owner);
    if(patient.status!=='ready'||!patient.image_url)throw new Fault('image_required');
    context.references=[patient.image_url];
    if(body.finding_id){const finding=await owned(body.finding_id,owner);if(finding.status!=='ready'||!finding.image_url)throw new Fault('image_required');context.references.push(finding.image_url);context.detail_image=finding.image_url;}
   }
  }
  else{
   if(body.reviewed!==true)throw new Fault('review_required');
   const source=await owned(body.parent_id,owner);
   if(source.status!=='ready'||!source.image_url)throw new Fault('image_required');
   desc=source.description;parent=source.id;motion=description(body.motion,800);context=source.context||{purpose:'finding'};
  }
  const limit=(name:string,fallback:number)=>Math.max(1,Math.min(1000,Number(env(name))||fallback));
  const result=await db('rpc/reserve_teacher_media_job','POST',{
   p_id:body.id,p_owner:owner,p_kind:body.action,p_description:desc,p_motion:motion,p_parent:parent,
   p_user_limit:limit('MEDIA_USER_DAILY_LIMIT',20),p_global_limit:limit('MEDIA_GLOBAL_DAILY_LIMIT',100)
  });
  if(result.created){
   await update(result.job,{context});
   // Supabase keeps this promise alive after the short HTTP response.
   EdgeRuntime.waitUntil(start(result.job));
  }
  return reply(202,{job:present(result.job)});
 }catch(e){return reply(e instanceof Fault?e.status:503,{error:e instanceof Fault?e.code:'service_unavailable'});}
}
Deno.serve(handle);
