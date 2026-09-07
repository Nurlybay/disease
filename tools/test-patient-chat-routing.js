'use strict';
var fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
var root=path.join(__dirname,'..'),elements={},calls=[];
var box={window:{},speechInput:null,aiBusy:false,state:{cat:'ask',finished:false},
  $:function(id){return elements[id]||(elements[id]={value:'',textContent:'',hidden:false});},
  sendToPatient:function(raw,id){calls.push(['ai',raw,id]);},
  perform:function(id){calls.push(['action',id]);},
  askClarify:function(raw,choices){calls.push(['clarify',choices]);},
  logRow:function(row){calls.push(['log',row.kind]);},labelOf:function(id){return id;}};
vm.createContext(box);
function load(p){vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),box);}
load('site/nlu.js');load('site/characters/pericarditis-alimov.js');
box.CASE=box.window.CASES[0];box.NLU=box.window.NLU;box.BYID={};
box.INTENTS=[].concat(box.CASE.passport,box.CASE.questions,box.CASE.vitals,box.CASE.exams,box.CASE.orders,box.CASE.treatment,box.CASE.diagnosis.options);
box.INTENTS.forEach(function(it){box.BYID[it.id]=it;});
var source=fs.readFileSync(path.join(root,'site/app.js'),'utf8');
vm.runInContext(source.slice(source.indexOf('  function submit(raw)'),source.indexOf('  function askClarify(raw')),box);
function send(raw,cat){calls.length=0;box.state.cat=cat;box.$('actInput').value=raw;box.submit(raw);return calls[0];}
assert.equal(send('Сколько дней у вас температура?','ask')[0],'ai');
assert.equal(send('хуже лежа','ask')[0],'ai');
assert.equal(send('Как вы спали прошлой ночью, доктору расскажите?','ask')[0],'ai');
assert.equal(send('давайте посмотрим горло','exam')[0],'action');
assert.equal(send('выслушать лёгкие','exam')[0],'action');
assert.equal(send('давайте послушаем вас','exam')[0],'clarify');
assert.equal(send('эхокг','order')[0],'action');
assert.equal(send('колхицин','treat')[0],'action');
box.aiBusy=true;assert.equal(send('хуже лежа','ask'),undefined);box.aiBusy=false;
box.state.finished=true;assert.equal(send('хуже лежа','ask'),undefined);
console.log('OK automatic fever/known/unknown dialogue routing; exams, investigations and treatment stay scripted; busy/finished guards.');
