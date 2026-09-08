'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{}};vm.createContext(ctx);
for(const f of ['nlu.js','score.js','characters/manifest.js'])vm.runInContext(fs.readFileSync('site/'+f,'utf8'),ctx);
const tests={
 'copd-tulegenov':[['спирометрия','order','o.spiro'],['шкала CAT','order','o.cat'],['отказ от курения','treat','t.quit'],['двойная бронходилатация','treat','t.bronchodilator'],['хобл','dx','dx.target']],
 'chronic-bronchitis-bekova':[['спирометрия','order','o.spiro'],['рентген грудной клетки','order','o.xray'],['антибиотик','treat','t.antibiotic'],['хронический бронхит','dx','dx.target']],
 'acs-serikbayev':[['экг','order','o.ecg'],['правые отведения','order','o.right'],['тропонин','order','o.troponin'],['вызвать скорую','treat','t.urgent'],['аспирин','treat','t.aspirin'],['отпустить домой','treat','t.home'],['окс','dx','dx.target']],
 'myocarditis-omarova':[['мрт сердца','order','o.cmr'],['тропонин','order','o.troponin'],['госпитализация','treat','t.urgent'],['прекратить тренировки','treat','t.rest'],['миокардит','dx','dx.target']]
};
let cases={};for(const id of Object.keys(tests)){
 ctx.window.CASES=[];vm.runInContext(fs.readFileSync('site/characters/'+id+'.js','utf8'),ctx);const c=ctx.window.CASES[0];cases[id]=c;
 const items=[].concat(c.passport,c.questions,c.vitals,c.exams,c.orders,c.treatment,c.diagnosis.options);
 for(const [query,cat,want] of tests[id]){const r=ctx.window.NLU.match(query,items,{cat});assert(r.ok&&r.id===want,query+': '+JSON.stringify(r));}
 assert(c.patient.idleVideo.includes(id+'-idle.mp4')&&!c.patient.throatVideo,'Only own patient video');
 assert(fs.existsSync('site/'+c.patient.idleVideo));
 assert(c.debrief.sources.length);assert(c.debrief.trap);assert.equal(c.passport.find(p=>p.id==='p.name').text.includes('Искаков'),false);
 for(const item of items)assert(!JSON.stringify(item).includes('media/voice/angina-iskakov'));
}
const S=ctx.window.Score;
function violations(c,ids){return S.violations(c,S.timeline(ids.map(id=>({id})))).map(v=>v.id);}
assert(violations(cases['acs-serikbayev'],['o.troponin','o.ecg','o.echo','t.urgent']).includes('a.no-delay'));
assert(!violations(cases['acs-serikbayev'],['o.ecg','t.urgent','o.troponin','o.echo']).length);
assert(violations(cases['myocarditis-omarova'],['o.cmr','t.urgent','t.rest']).includes('a.admit-before-mri'));
assert(!violations(cases['myocarditis-omarova'],['t.urgent','t.rest','o.cmr']).length);
assert(cases['chronic-bronchitis-bekova'].orders.find(o=>o.id==='o.spiro').result.includes('0,81'));
assert(cases['copd-tulegenov'].orders.find(o=>o.id==='o.spiro').result.includes('0,55'));
assert(cases['acs-serikbayev'].orders.find(o=>o.id==='o.troponin').hint.includes('не должен задерживать'));
console.log('OK 22 new-case clinical actions, emergency sequencing, COPD/bronchitis distinction and media isolation.');
