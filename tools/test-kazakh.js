'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');const box={window:{}};vm.createContext(box);
for(const f of ['nlu-kk.js','nlu.js','pronunciation.js'])vm.runInContext(fs.readFileSync('site/'+f,'utf8'),box);
let count=0;
for(const id of ['copd-tulegenov','chronic-bronchitis-bekova','acs-serikbayev','myocarditis-omarova','pericarditis-alimov']){
 box.window.CASES=[];vm.runInContext(fs.readFileSync('site/characters/'+id+'.js','utf8'),box);const c=box.window.CASES[0],items=[].concat(c.passport,c.questions,c.vitals,c.exams,c.orders,c.treatment,c.diagnosis.options);
 for(const [text,cat,want]of [['өкпені тыңдау','exam','e.lungs'],['жүректі тыңдау','exam','e.heart'],['тамақты қарау','exam','e.throat'],['қан қысымын өлшеу','measure','v.bp']]){
  const r=box.window.NLU.match(text,items,{cat});assert(r.ok&&r.id===want,id+' '+text+': '+JSON.stringify(r));count++;
 }
 if(id==='chronic-bronchitis-bekova'){const r=box.window.NLU.match('жөтеліңізші',items,{cat:'exam'});assert.equal(r.id,'e.cough');}
 if(id==='acs-serikbayev'){assert.equal(box.window.NLU.match('жедел жәрдем шақыру',items,{cat:'treat'}).id,'t.urgent');assert.equal(box.window.NLU.match('аспирин бермеңіз',items,{cat:'treat'}).kind,'refused');}
}
assert.equal(box.window.Pronunciation.prepare('Прокашляйте, пожалуйста.','ru'),'Прока́шляйте, пожалуйста.');assert.equal(box.window.Pronunciation.prepare('Сейчас покашляю.','ru'),'Сейчас пока́шляю.');assert.equal(box.window.Pronunciation.prepare('Жөтеліңізші.','kk'),'Жөтеліңізші.');
console.log('OK '+count+' Kazakh exams/vitals, cough, emergency referral, negation and pronunciation.');
