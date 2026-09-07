/* Integration checks: manifest, case schema, clinical queries, scoring. */
'use strict';
var fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
var root=path.join(__dirname,'..'), box={window:{},console:console};vm.createContext(box);
function load(p){vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),box,{filename:p});}
load('site/characters/manifest.js');load('site/nlu.js');load('site/score.js');
var tests={
 'hypertension-saparov':[['смад','order','o.abpm'],['как измеряли давление дома','ask','q.home'],['нарушения зрения','ask','q.redflags'],['диагноз гипертония','dx','dx.target']],
 'angina-iskakov':[['бывает боль в покое','ask','q.rest'],['принимали силденафил','ask','q.pde5'],['нитроглицерин','treat','t.nitrate'],['кт коронарография','order','o.coronary'],['диагноз стенокардия','dx','dx.target']],
 'af-nurgaliev':[['когда начались перебои','ask','q.duration'],['были кровотечения','ask','q.bleed'],['экг','order','o.ecg'],['апиксабан','treat','t.anticoag'],['диагноз мерцательная аритмия','dx','dx.target']],
 'pericarditis-alimov':[['хуже лежа','ask','q.position'],['колхицин','treat','t.colchicine'],['эхокг','order','o.echo'],['диагноз перикардит','dx','dx.target']],
 'chf-baizhanov':[['вызвать скорую','treat','t.urgent'],['сакубитрил','treat','t.acei']]
};
var count=0;
box.window.CHARACTER_MANIFEST.forEach(function(m){
 box.window.CASES=[];load('site/characters/'+m.file);var c=box.window.CASES[0];
 assert.equal(c.id,m.file.replace(/\.js$/,''));
 var items=[].concat(c.passport,c.questions,c.vitals,c.exams,c.orders,c.treatment,c.diagnosis.options), ids={};
 items.forEach(function(it){assert(!ids[it.id],'duplicate '+it.id);ids[it.id]=true;assert(it.need.length);});
 assert(ids[c.diagnosis.correct]);
 function checkAssets(o){if(!o||typeof o!=='object')return;Object.keys(o).forEach(function(k){var v=o[k];if(typeof v==='string'&&/^media\//.test(v))assert(fs.existsSync(path.join(root,'site',v)),c.id+': missing '+v);else checkAssets(v);});}checkAssets(c);
 (tests[c.id]||[]).forEach(function(t){var r=box.window.NLU.match(t[0],items,{cat:t[1],label:function(id){return id;}});assert(r.ok&&r.id===t[2],c.id+' '+t[0]+' => '+JSON.stringify(r));count++;});
 if(tests[c.id]){
  ['чего вы боитесь','объяснить план'].forEach(function(input,i){if(c.id==='chf-baizhanov'&&i===0)return;var r=box.window.NLU.match(input,items,{cat:i?'treat':'ask'});assert(r.ok&&r.id===(i?'t.education':'q.concerns'),c.id+': '+input);count++;});
 }
 var empty=box.window.Score.compute(c,{log:[],done:{},heard:{}});assert(Number.isFinite(empty.total));
 var done={},log=[];items.forEach(function(it){if(it.cat==='dx'||it.role==='harm'||it.role==='waste')return;done[it.id]=true;log.push({id:it.id,cat:it.cat});});
 done.__dx=true;log.push({id:'__dx',cat:'dx'});var heard={};(c.auscultation.points||[]).forEach(function(p){heard[p.id]=p.finding;});
 var full=box.window.Score.compute(c,{done:done,log:log,heard:heard,dx:c.diagnosis.correct});assert(full.total>empty.total,c.id+' scoring');
 console.log('OK '+c.id+' ('+items.length+' действий)');
});
console.log('OK '+count+' клинических формулировок; 8 сценариев: загрузка, медиа, оценка.');
