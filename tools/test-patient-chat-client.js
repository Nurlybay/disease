const fs=require('fs'),vm=require('vm'),assert=require('assert');
let xhr,answer,busy,error;const store={};
class X {constructor(){xhr=this;this.headers={};}open(m,u){this.url=u;}setRequestHeader(k,v){this.headers[k]=v;}send(s){this.body=JSON.parse(s);}abort(){this.aborted=true;} }
const box={window:{},XMLHttpRequest:X,Date,localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]}};
vm.runInNewContext(fs.readFileSync('site/patient-chat.js','utf8'),box);
const options={baseUrl:'https://example.test',caseId:'pericarditis-alimov',anonKey:'public',busy:b=>busy=b,reply:(q,a)=>answer=a,error:e=>error=e};
const client=box.window.PatientChat.create(options);
function respond(data,status=200){const x=xhr;x.status=status;x.responseText=JSON.stringify(data);x.onload();}
client.send('Сколько дней температура?');assert(xhr.url.endsWith('/signup'));assert(!xhr.headers['x-patient-access']);assert.equal(client.send('duplicate'),false);
respond({access_token:'guest-jwt',refresh_token:'refresh',expires_in:3600});assert(xhr.url.endsWith('/patient-chat'));assert.equal(xhr.headers.Authorization,'Bearer guest-jwt');assert.equal(xhr.body.caseId,'pericarditis-alimov');
respond({reply:'Не помню точно',caseId:'pericarditis-alimov'});assert.equal(answer,'Не помню точно');assert(!busy);
client.send('А боль?');assert.equal(xhr.body.history.length,2);const late=xhr.onload;client.cancel();answer=null;late();assert.equal(answer,null);
client.reset();client.send('Сначала');assert.equal(xhr.body.history.length,0);respond({error:'guest_daily_limit'},429);assert.equal(error,'guest_daily_limit');
const restored=box.window.PatientChat.create(options);restored.send('Привет');assert(xhr.url.endsWith('/patient-chat'));restored.cancel();
const key=Object.keys(store)[0];store[key]=JSON.stringify({access_token:'expired',refresh_token:'refresh',expires_at:0});
const expired=box.window.PatientChat.create(options);expired.send('Вопрос');assert(xhr.url.includes('grant_type=refresh_token'));respond({access_token:'renewed',refresh_token:'next',expires_in:3600});assert.equal(xhr.headers.Authorization,'Bearer renewed');expired.cancel();
for(const k of Object.keys(store))delete store[k];
const disabled=box.window.PatientChat.create(options);disabled.send('Вопрос');respond({error_code:'anonymous_provider_disabled'},422);assert.equal(error,'guest_disabled');assert(!busy);
const canceled=box.window.PatientChat.create(options);canceled.send('Вопрос');const signup=xhr;canceled.cancel();signup.status=200;signup.responseText=JSON.stringify({access_token:'ignored',refresh_token:'ignored',expires_in:3600});signup.onload();assert.equal(xhr,signup);
console.log('OK guest signup, reuse, refresh, history, limits, auth failures, cancellation, no password headers.');

options.language=()=> 'kk';const kkClient=box.window.PatientChat.create(options);kkClient.send('Қанша күн?');respond({access_token:'kk-token',refresh_token:'kk-refresh',expires_in:3600});assert.equal(xhr.body.language,'kk');kkClient.cancel();

options.language=()=> 'en';const enClient=box.window.PatientChat.create(options);enClient.send('How many days?');assert.equal(xhr.body.language,'en');enClient.cancel();

const marathon=box.window.PatientChat.create(options);
for(let i=0;i<35;i++) { marathon.send('Вопрос '+i); assert(xhr.body.history.length<=20); respond({reply:'Ответ '+i,caseId:options.caseId}); assert(!busy); }
assert.equal(answer,'Ответ 34');
console.log('OK 35 consecutive questions without a ten-question cutoff.');
