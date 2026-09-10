/* Rebuild patient-visible facts without diagnoses, exam results or scoring keys. */
'use strict';
var fs=require('fs'),vm=require('vm'),path=require('path');
var root=path.join(__dirname,'..'),box={window:{}};
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(root,'site/characters/manifest.js'),'utf8'),box);
var cards={};
box.window.CHARACTER_MANIFEST.forEach(function(entry){
  box.window.CASES=[];
  vm.runInContext(fs.readFileSync(path.join(root,'site/characters',entry.file),'utf8'),box);
  var c=box.window.CASES[0];
  cards[c.id]={gender:c.patient.gender,statements:[{topic:'Жалоба при обращении',text:c.patient.greeting.text}].concat(c.passport,c.questions).map(function(s){return {id:s.id||'greeting',topic:s.topic||s.label,text:s.text};})};
});
var target=path.join(root,'supabase/functions/patient-chat/index.ts'),s=fs.readFileSync(target,'utf8');
var start=s.indexOf('const PATIENTS = '),end=s.indexOf('\n// END PATIENT CARDS',start);
if(start<0||end<0)throw new Error('Card markers missing');
fs.writeFileSync(target,s.slice(0,start)+'const PATIENTS = '+JSON.stringify(cards,null,2)+';'+s.slice(end));
console.log('Built '+Object.keys(cards).length+' patient cards with topic-labelled facts.');
