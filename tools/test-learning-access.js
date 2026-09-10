const assert=require('assert'),fs=require('fs'),vm=require('vm'),esbuild=require('./auth-build/node_modules/esbuild');
let handler,user=null,authCalls=0;
const source=fs.readFileSync('supabase/functions/learning-content/index.ts','utf8').replace("import CONTENT from './content.json' with { type: 'json' };",()=> 'const CONTENT='+JSON.stringify(JSON.parse(fs.readFileSync('supabase/functions/learning-content/content.json')))+';');
vm.runInNewContext(esbuild.transformSync(source,{loader:'ts',format:'cjs'}).code,{Deno:{serve:f=>handler=f,env:{get:()=> 'test'}},Response,URL,AbortSignal,fetch:async()=>{authCalls++;return Response.json(user||{},{status:user?200:401})}});
function req(asset='access',section='student',token='test'){return new Request('https://test/?'+new URLSearchParams({asset,section}),{headers:token?{authorization:'Bearer '+token}:{}})}
(async()=>{
 assert.equal((await handler(req('access','student',''))).status,401);
 assert.equal((await handler(req())).status,401);
 const before=authCalls;assert.equal((await handler(req('characters/pericarditis-alimov.js','student',''))).status,200);assert.equal(authCalls,before);
 user={id:'guest',is_anonymous:true};assert.equal((await handler(req('characters/copd-tulegenov.js'))).status,403);
 user={id:'student',is_anonymous:false};assert.equal((await handler(req())).status,403);
 user.email_confirmed_at='2026-09-09';assert.equal((await handler(req())).status,200);
 user.user_metadata={role:'teacher'};assert.equal((await handler(req('teacher.js'))).status,403);assert.equal((await handler(req('media-studio.js'))).status,403);assert.equal((await handler(req('access','teacher'))).status,403);
 user.app_metadata={role:'teacher'};const r=await handler(req('teacher.js'));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal((await handler(req('../app.js'))).status,404);
 const manifest=fs.readFileSync('site/characters/manifest.js','utf8');const assets=JSON.parse(fs.readFileSync('supabase/functions/learning-content/content.json'));
 for(const m of manifest.matchAll(/file:\s*'([^']+)'/g)){assert(assets['characters/'+m[1]]);assert(!fs.existsSync('.public-site/characters/'+m[1]));}
 for(const page of ['priem.html','teacher.html','media-lab.html']){const s=fs.readFileSync('site/'+page,'utf8');assert(s.includes('class="access-pending"'));assert(s.includes('vendor/learning-access.js'));}
 console.log('OK server denies missing/forged/guest/unconfirmed auth; demo only; teacher role trusted only from app_metadata; protected scripts excluded from Pages.');
})().catch(e=>{console.error(e);process.exit(1)});
