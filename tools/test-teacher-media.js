'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const esbuild=require('./auth-build/node_modules/esbuild');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const jobs=new Map(),tasks=[];let handler,paidImages=0,paidVideos=0,downloadFailures=0,quota=false,timeout=false,providerState='completed',lastImageRequest;
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
  lastImageRequest=body;paidImages++;assert.equal(body.model,'openai/gpt-image-2.5-sunburst');assert.equal(body.n,1);assert.equal(body.quality,'medium');
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
 providerState='completed';
 const portrait=id;assert.equal((await call({...image,id:crypto.randomUUID(),purpose:'patient'})).data.error,'invalid_action');
 const scene=crypto.randomUUID(),sceneRequest={...image,id:scene,purpose:'scene',patient_key:'asthma-eszhanova',finding_id:id,reviewed:true};
 user.id=other;assert.equal((await call(sceneRequest)).status,404);user.id=owner;
 assert.equal((await call({...sceneRequest,reviewed:false})).data.error,'review_required');
 await call(sceneRequest);await finish();assert.equal(lastImageRequest.input_references.length,2);assert.equal(jobs.get(scene).context.detail_image,jobs.get(id).image_url);
 const sceneVideo=crypto.randomUUID();await call({action:'video',id:sceneVideo,parent_id:scene,reviewed:true,motion:'Пациент показывает руку'});await finish();
 const sceneResult=(await call({action:'status',id:sceneVideo})).data.job;assert.equal(sceneResult.cost,0.48);assert.equal(sceneResult.detail_image,jobs.get(id).image_url);assert.equal(sceneResult.purpose,'scene');
 assert.equal((await call({...sceneRequest,id:crypto.randomUUID(),patient_key:'http://127.0.0.1'})).data.error,'patient_required');
 const noDetail=crypto.randomUUID();await call({...sceneRequest,id:noDetail,finding_id:null});await finish();assert.equal(lastImageRequest.input_references.length,1);
 const ccContext={window:{},URL,localStorage:{setItem(){},getItem(){return null},removeItem(){}},console};vm.createContext(ccContext);vm.runInContext(fs.readFileSync('site/custom-cases.js','utf8'),ccContext);const CC=ccContext.window.CustomCases;
 const media={image:jobs.get(id).image_url,video:jobs.get(vid).video_url,synthetic:true,jobId:vid};
 const draft={id:'custom-skin',disease:'Учебный случай',title:'Осмотр кожи',patient:{name:'Тест'},auscultation:{enabled:false},exams:[{id:'e.skin',kind:'throat',label:'Осмотреть кожу',media}]};
 const imported=CC.importText(CC.exportText(draft)).draft;assert.equal(imported.exams[0].media.video,media.video);assert.equal(CC.inflate(imported).exams[0].media.video,media.video);
 assert.equal(CC.normalizeMedia({image:'javascript:alert(1)',video:media.video}),null);
 assert.equal(CC.normalizeMedia({image:'https://user:pass@host/a.png'}),null);
 assert.equal(CC.normalizeMedia({image:media.image,video:'data:text/html,x'}).video,'');
 const sceneMedia={...media,description:'Пациент показывает сухую кожу на кисти',detail:jobs.get(id).image_url};
 draft.patient.appearance={image:jobs.get(portrait).image_url};draft.questions=[{id:'q.complaint',label:'Что беспокоит?',text:'Болит рука',media:sceneMedia}];draft.exams=[];
 const round=CC.importText(CC.exportText(draft)).draft,runtime=CC.inflate(round);assert.equal(runtime.questions[0].media.detail,sceneMedia.detail);assert.equal(runtime.patient.portrait,draft.patient.appearance.image);assert.equal(runtime.patient.idleVideo,'');assert.equal(runtime.patient.throatVideo,'');assert.equal(CC.hasAnimation(round),true);
 round.questions=[];assert.equal(CC.hasAnimation(round),false);round.questions=[{media:{image:media.image}}];assert.equal(CC.hasAnimation(round),false);
 round.complaintMedia=sceneMedia;assert.equal(CC.hasAnimation(round),true);
 const automatic=CC.inflate(CC.importText(CC.exportText(round)).draft);assert.equal(automatic.complaintMedia.video,media.video);
 for(const q of ['Что вас беспокоит?','Какие у вас жалобы?','С чем вы пришли?','What brings you in today?','Сізді не мазалайды?'])assert(CC.complaintMediaFor(automatic,q),q);
 for(const q of ['Какие лекарства принимаете?','Какие жалобы были раньше?','Ничего не беспокоит?','Где работаете?','Осмотреть кожу'])assert.equal(CC.complaintMediaFor(automatic,q),null,q);
 assert.equal(CC.complaintMediaFor({complaintMedia:null},'Что беспокоит?'),null);
 const html=CC.mediaHtml(media);assert(html.includes('controls muted playsinline'));assert(!html.includes('autoplay'));assert(html.includes('Синтетический'));assert(html.includes('Открыть изображение'));
 // Exercise the real exam branch: custom throat media must not play the generic throat.
 const app=fs.readFileSync('site/app.js','utf8'),start=app.indexOf('  function performExam('),end=app.indexOf('\n  function ',start+10);
 const runContext={window:{CustomCases:CC},CustomCases:CC,independent:true,CASE:{system:{},patient:{}},addNote(){},switchVideo(){throw new Error('Generic throat must not play');},say(){}};
 vm.createContext(runContext);vm.runInContext(app.slice(start,end),runContext);const row={};runContext.performExam({id:'e.skin',kind:'throat',media,result:'Осмотр',findAbnormal:true},row,{silent:true});assert.equal(row.media.video,media.video);
 var opened=0;CC.openScene=function(){opened++;};
 for(const q of ['Покажите руки','Покажите кисть пожалуйста','Show your hands','Покажите где болит'])assert(CC.demonstrationMediaFor(automatic,q),q);
 for(const q of ['Покажите горло','Покажите список инструкций','Не показывайте руки','Покажите руки и ноги','Какие лекарства?'])assert.equal(CC.demonstrationMediaFor(automatic,q),null,q);
 const logStart=app.indexOf('  function logRow('),logEnd=app.indexOf('\n  function ',logStart+10),rendered=[];
 const logContext={window:{CustomCases:CC},CustomCases:CC,CASE:automatic,LearningMode:{row:r=>r},BYID:{},MODE:'independent',state:{t0:Date.now(),log:[]},Date,Score:{mmss:()=>''},CAT_NAME:{ask:'Расспрос'},esc:String,updateCounters(){},document:{createElement:()=>({})},$:()=>({querySelector:()=>null,appendChild:x=>rendered.push(x.innerHTML)})};
 vm.createContext(logContext);vm.runInContext(app.slice(logStart,logEnd),logContext);
 logContext.logRow({cat:'ask',kind:'patient',act:'Что вас беспокоит?',res:'Болит рука',ai:true});assert(rendered[0].includes(media.video),'AI response renders the available complaint scene');
 logContext.logRow({cat:'ask',kind:'question',act:'Основная жалоба',raw:'Какие у вас жалобы?',res:'Болит рука'});assert(rendered[1].includes(media.video),'template question uses original wording');
 logContext.logRow({cat:'ask',kind:'question',act:'Какие лекарства принимаете?',res:'Нет'});assert(!rendered[2].includes(media.video),'unrelated question has no animation');
 assert.equal(opened,2,'relevant questions start the player automatically');
 logContext.logRow({cat:'ask',kind:'question',act:'Что вас беспокоит?',res:'Болит рука',silent:true});assert.equal(opened,2,'silent demo must not open a player');
 logContext.logRow({cat:'exam',kind:'exam',act:'Покажите руки',res:'Показывает'});assert.equal(opened,3,'demonstration starts the available scene');
 console.log('OK: teacher auth, provider configuration, image/video contracts, idempotency, ownership, review gate, quotas, uncertain submission, download-only retry, failure status, case round-trip, URL validation and exam playback. No paid requests.');
})().catch(e=>{console.error(e);process.exit(1)});
