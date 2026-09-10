'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const esbuild=require('./auth-build/node_modules/esbuild');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const jobs=new Map(),tasks=[];let handler,paidImages=0,paidVideos=0,downloadFailures=0,quota=false,timeout=false,providerState='completed';
let user={id:owner,is_anonymous:false,email_confirmed_at:'2026-09-10',app_metadata:{role:'teacher'}};
const keys={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',OPENROUTER_API_KEY:'router-test'};
const json=x=>Response.json(x);
async function fakeFetch(url,init={}){
 const u=new URL(url),body=init.body&&typeof init.body==='string'?JSON.parse(init.body):null;
 if(u.pathname==='/auth/v1/user')return user?json(user):new Response('',{status:401});
 if(u.pathname==='/rest/v1/rpc/reserve_teacher_media_job'){
  if(jobs.has(body.p_id))return json({created:false,job:jobs.get(body.p_id)});
  if(quota)return new Response('daily_limit',{status:400});
  const source=jobs.get(body.p_parent),now=new Date().toISOString();
  const j={id:body.p_id,owner_id:body.p_owner,kind:body.p_kind,description:body.p_description,motion:body.p_motion,status:'queued',image_url:source?.image_url,created_at:now,updated_at:now};jobs.set(j.id,j);return json({created:true,job:j});
 }
 if(u.pathname==='/rest/v1/teacher_media_jobs'){
  const id=u.searchParams.get('id')?.slice(3),own=u.searchParams.get('owner_id')?.slice(3);
  if(init.method==='PATCH'){Object.assign(jobs.get(id),body);return new Response(null,{status:204});}
  return json([...jobs.values()].filter(j=>(!id||j.id===id)&&(!own||j.owner_id===own)));
 }
 if(u.pathname.startsWith('/storage/v1/object/')){
  assert.equal(init.headers.Authorization,'Bearer service');assert(init.body instanceof Uint8Array);return json({Key:u.pathname});
 }
 if(u.pathname==='/api/v1/images'){
  assert.equal(u.hostname,'openrouter.ai');assert.equal(init.headers.Authorization,'Bearer router-test');
  paidImages++;assert.equal(body.model,'openai/gpt-image-2.5-sunburst');assert.equal(body.n,1);assert.equal(body.quality,'medium');
  if(timeout)throw new Error('network timeout');
  return json({data:[{b64_json:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')}],usage:{output_tokens:123}});
 }
 if(u.pathname==='/api/v1/videos'){
  paidVideos++;assert.equal(body.model,'minimax/hailuo-3-max');assert.equal(body.duration,6);assert.equal(body.frame_images[0].frame_type,'first_frame');
  assert(body.frame_images[0].image_url.url.startsWith('https://project.supabase.co/storage/'));
  assert.equal(body.resolution,'768p');assert.equal(body.generate_audio,false);
  return json({id:'job-abc123',status:'pending'});
 }
 if(u.pathname==='/api/v1/videos/job-abc123')return json({id:'job-abc123',status:providerState,unsigned_urls:['http://127.0.0.1/ignored'],usage:{cost:0.48}});
 if(u.pathname==='/api/v1/videos/job-abc123/content'){
  assert.equal(u.hostname,'openrouter.ai');assert.equal(init.headers.Authorization,'Bearer router-test');assert.equal(init.redirect,'error');
  if(downloadFailures-->0)return new Response('',{status:503});
  return new Response(new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109]));
 }
 throw new Error('Unexpected request: '+url);
}
const context={module:{exports:{}},exports:{},Deno:{env:{get:k=>keys[k]},serve:f=>handler=f},EdgeRuntime:{waitUntil:p=>tasks.push(p)},fetch:fakeFetch,Response,Request,URL,AbortSignal,Uint8Array,TextDecoder,atob,console};
vm.createContext(context);vm.runInContext(esbuild.transformSync(fs.readFileSync('supabase/functions/teacher-media/index.ts','utf8'),{loader:'ts',format:'cjs'}).code,context);
async function call(body,token=true){const r=await handler(new Request('https://project.supabase.co/functions/v1/teacher-media',{method:'POST',headers:token?{authorization:'Bearer user','content-type':'application/json'}:{},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()};}
async function finish(){while(tasks.length)await tasks.shift();}
(async()=>{
 assert.equal((await call({action:'image'},false)).status,401);
 user.app_metadata={};user.user_metadata={role:'teacher'};assert.equal((await call({action:'config'})).status,403);
 user.app_metadata={role:'teacher'};user.is_anonymous=true;assert.equal((await call({action:'config'})).status,403);user.is_anonymous=false;
 delete keys.OPENROUTER_API_KEY;assert.equal((await call({action:'config'})).data.image,false);assert.equal((await call({action:'image',id:crypto.randomUUID(),description:'Сухая кожа'})).data.error,'not_configured');keys.OPENROUTER_API_KEY='router-test';
 const id=crypto.randomUUID(),image={action:'image',id,description:'Сухая кожа кисти'};
 assert.equal((await call(image)).status,202);await finish();assert.equal(jobs.get(id).status,'ready');assert(jobs.get(id).image_url);assert.equal(paidImages,1);
 await call(image);await finish();assert.equal(paidImages,1,'retry with same UUID must not charge twice');
 user.id=other;assert.equal((await call({action:'status',id})).status,404);assert.equal((await call({action:'video',id:crypto.randomUUID(),parent_id:id,reviewed:true,motion:'Поворот кисти'})).status,404);user.id=owner;
 assert.equal((await call({action:'video',id:crypto.randomUUID(),parent_id:id,motion:'Поворот кисти'})).data.error,'review_required');
 const vid=crypto.randomUUID();await call({action:'video',id:vid,parent_id:id,reviewed:true,motion:'Небольшой поворот кисти',image_url:'http://127.0.0.1/secret'});await finish();assert.equal(paidVideos,1);
 downloadFailures=1;assert.equal((await call({action:'status',id:vid})).data.error,'download_failed');assert.equal(jobs.get(vid).status,'running');
 const result=await call({action:'status',id:vid});assert.equal(result.data.job.status,'ready');assert(result.data.job.video_url.startsWith('https://project.supabase.co/storage/'));assert.equal(paidVideos,1,'download retry must not create another paid video');
 quota=true;assert.equal((await call({...image,id:crypto.randomUUID()})).status,429);quota=false;
 timeout=true;const uncertain=crypto.randomUUID();await call({...image,id:uncertain});await finish();assert.equal(jobs.get(uncertain).status,'uncertain');const before=paidImages;await call({...image,id:uncertain});await finish();assert.equal(paidImages,before);timeout=false;
 const failed=crypto.randomUUID();await call({action:'video',id:failed,parent_id:id,reviewed:true,motion:'Поворот кисти'});await finish();providerState='failed';assert.equal((await call({action:'status',id:failed})).data.job.status,'failed');
 const ccContext={window:{},URL,localStorage:{setItem(){},getItem(){return null},removeItem(){}},console};vm.createContext(ccContext);vm.runInContext(fs.readFileSync('site/custom-cases.js','utf8'),ccContext);const CC=ccContext.window.CustomCases;
 const media={image:jobs.get(id).image_url,video:jobs.get(vid).video_url,synthetic:true,jobId:vid};
 const draft={id:'custom-skin',disease:'Учебный случай',title:'Осмотр кожи',patient:{name:'Тест'},auscultation:{enabled:false},exams:[{id:'e.skin',kind:'throat',label:'Осмотреть кожу',media}]};
 const imported=CC.importText(CC.exportText(draft)).draft;assert.equal(imported.exams[0].media.video,media.video);assert.equal(CC.inflate(imported).exams[0].media.video,media.video);
 assert.equal(CC.normalizeMedia({image:'javascript:alert(1)',video:media.video}),null);
 assert.equal(CC.normalizeMedia({image:'https://user:pass@host/a.png'}),null);
 assert.equal(CC.normalizeMedia({image:media.image,video:'data:text/html,x'}).video,'');
 const html=CC.mediaHtml(media);assert(html.includes('controls muted playsinline'));assert(!html.includes('autoplay'));assert(html.includes('Синтетический'));assert(html.includes('Открыть изображение'));
 // Exercise the real exam branch: custom throat media must not play the generic throat.
 const app=fs.readFileSync('site/app.js','utf8'),start=app.indexOf('  function performExam('),end=app.indexOf('\n  function ',start+10);
 const runContext={window:{CustomCases:CC},CustomCases:CC,independent:true,CASE:{system:{},patient:{}},addNote(){},switchVideo(){throw new Error('Generic throat must not play');},say(){}};
 vm.createContext(runContext);vm.runInContext(app.slice(start,end),runContext);const row={};runContext.performExam({id:'e.skin',kind:'throat',media,result:'Осмотр',findAbnormal:true},row,{silent:true});assert.equal(row.media.video,media.video);
 console.log('OK: teacher auth, provider configuration, image/video contracts, idempotency, ownership, review gate, quotas, uncertain submission, download-only retry, failure status, case round-trip, URL validation and exam playback. No paid requests.');
})().catch(e=>{console.error(e);process.exit(1)});
