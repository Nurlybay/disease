const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),esbuild=require('./auth-build/node_modules/esbuild');
let handler,role='teacher',allowed=true,paid=0,bad=false;
const keys={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon',OPENROUTER_API_KEY:'fake'};
const row={label:'Item',answer:'Fictional answer',why:'Reason',result:'Finding',value:'12',unit:'unit',abnormal:false,aliases:['item','other']};
const draft={title:'Teaching case',name:'Fictional Name',age:'58',greeting:'Hello',allergies:'None known',occupation:'Teacher',imageIdea:'Neutral consultation',motionIdea:'Subtle breathing',questions:Array(6).fill(row),exams:Array(3).fill(row),vitals:Array(3).fill(row),orders:Array(2).fill(row),treatment:[row],diagnoses:Array(2).fill(row),teachingPoints:['Review']};
vm.runInNewContext(esbuild.transformSync(fs.readFileSync('supabase/functions/teacher-case/index.ts','utf8'),{loader:'ts',format:'cjs'}).code,{Deno:{env:{get:k=>keys[k]},serve:fn=>handler=fn},Response,Request,AbortSignal,fetch:async(url,init)=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'teacher',email_confirmed_at:'yes',app_metadata:{role}});
 if(url.endsWith('/reserve_patient_chat_request'))return Response.json({allowed});
 assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');paid++;const b=JSON.parse(init.body);assert.equal(b.model,'google/gemini-2.5-flash-lite');assert.equal(b.response_format.type,'json_schema');return Response.json({choices:[{message:{content:bad?'bad JSON':JSON.stringify(draft)}}]});
}});
const body={disease:'Test disease',description:'Fictional teaching situation',gender:'male',patientLabel:'Male, 58',language:'ru'};
const call=(b=body,token=true)=>handler(new Request('https://local/',{method:'POST',headers:token?{authorization:'Bearer token'}:{},body:JSON.stringify(b)}));
(async()=>{
 assert.equal((await call(body,false)).status,401);role='student';assert.equal((await call()).status,403);assert.equal(paid,0);role='teacher';allowed=false;assert.equal((await call()).status,429);assert.equal(paid,0);allowed=true;
 assert.equal((await call({...body,description:''})).status,400);const r=await call();assert.equal(r.status,200);assert.equal((await r.json()).reviewRequired,true);
 bad=true;assert.equal((await call()).status,502);assert.equal(paid,2);
 console.log('OK teacher-only drafting, validation, durable quota before provider, structured output, malformed response rejection. No paid calls.');
})().catch(e=>{console.error(e);process.exit(1);});
