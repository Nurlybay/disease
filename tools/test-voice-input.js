const assert = require('assert');
require('../site/voice-input.js');
let engine, texts=[], sent=[], statuses=[], listening=false;
class Fake { constructor(){engine=this;} start(){} abort(){this.aborted=true;} stop(){this.onend();} }
const input=globalThis.VoiceInput.create({Engine:Fake,beforeStart(){},listening(x){listening=x;},text(x){texts.push(x);},result(x){sent.push(x);},status(x){statuses.push(x);}});
function result(text,final){const r=[{transcript:text}];r.isFinal=final;engine.onresult({results:[r]});}
input.start();assert.equal(engine.lang,'ru-RU');assert(listening);
result('Как вас',false);assert.equal(sent.length,0);
result('Как вас зовут?',true);assert.equal(sent.length,0);
engine.onend();assert.deepEqual(sent,['Как вас зовут?']);assert(!listening);
input.start();result('Отменённый вопрос',true);const lateEnd=engine.onend;input.cancel();lateEnd();assert.equal(sent.length,1);assert(engine.aborted);
input.start();result('Не отправлять при ошибке',true);engine.onerror({error:'not-allowed'});assert(!listening);assert.equal(sent.length,1);assert(statuses.at(-1).includes('Нет доступа'));
input.start();result('Промежуточный',false);input.stop();assert.equal(sent.length,1);assert(statuses.at(-1).includes('Речь не распознана'));
input.start();result('Где болит?',true);input.stop();assert.equal(sent.at(-1),'Где болит?');
console.log('OK: voice final-only delivery, cancellation, stale events, permission errors, no-speech and manual stop.');
const fs=require('fs'),vm=require('vm'),ctx={window:{CASES:[]}};vm.createContext(ctx);
for(const f of fs.readdirSync('site/characters').filter(f=>f.endsWith('.js')&&!['manifest.js','loader.js'].includes(f)))vm.runInContext(fs.readFileSync('site/characters/'+f,'utf8'),ctx);
for(const c of ctx.window.CASES)assert.equal(c.patient.gender,c.id==='asthma-eszhanova'?'female':'male');
const a=ctx.window.CASES.find(c=>c.id==='asthma-eszhanova');assert(fs.existsSync('site/'+a.patient.portrait));assert(!a.patient.idleVideo);assert(!a.patient.throatVideo);assert(a.patient.greeting.text.includes('простыла'));
console.log('OK: gender metadata for 8 cases; female portrait, greeting and no shared male videos.');
vm.runInContext(fs.readFileSync('site/custom-cases.js','utf8'),ctx);
const CC=ctx.window.CustomCases;
const customFemale=CC.inflate({patient:{name:'Айгерим',gender:'female'}});
const customMale=CC.inflate({patient:{name:'Марат',gender:'male'}});
assert.equal(customFemale.patient.gender,'female');assert(customFemale.system.unknown.text.includes('поняла'));assert(customFemale.system.cough.text.includes('покашляла'));
assert(customMale.system.unknown.text.includes('понял вопроса'));assert(!customMale.patient.portrait);assert.equal(CC.normalize(CC.normalize({patient:{gender:'female'}})).patient.gender,'female');
console.log('OK: custom gender round trip and isolated gendered replies.');

input.start();result("Не отправлять после сетевой ошибки",true);const beforeNetwork=sent.length;engine.onerror({error:"network"});assert(!listening);assert.equal(sent.length,beforeNetwork);assert(statuses.at(-1).includes("встроенном браузере"));
console.log("OK: network error stops microphone, does not submit and offers recovery.");
