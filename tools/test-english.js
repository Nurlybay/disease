'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const box={window:{}};vm.createContext(box);for(const f of ['nlu-en.js','nlu-kk.js','nlu.js'])vm.runInContext(fs.readFileSync('site/'+f,'utf8'),box);
let count=0;
for(const id of ['copd-tulegenov','chronic-bronchitis-bekova','acs-serikbayev','myocarditis-omarova','pericarditis-alimov']){
 box.window.CASES=[];vm.runInContext(fs.readFileSync('site/characters/'+id+'.js','utf8'),box);const c=box.window.CASES[0],items=[].concat(c.passport,c.questions,c.vitals,c.exams,c.orders,c.treatment,c.diagnosis.options);
 for(const [text,cat,want]of [['listen to your lungs','exam','e.lungs'],['examine the heart','exam','e.heart'],['examine your throat','exam','e.throat'],['measure blood pressure','measure','v.bp']]){const r=box.window.NLU.match(text,items,{cat});assert(r.ok&&r.id===want,id+' '+text+': '+JSON.stringify(r));count++;}
 if(id==='chronic-bronchitis-bekova')assert.equal(box.window.NLU.match('cough please',items,{cat:'exam'}).id,'e.cough');
 if(id==='acs-serikbayev'){assert.equal(box.window.NLU.match('call an ambulance',items,{cat:'treat'}).id,'t.urgent');assert.equal(box.window.NLU.match("don't give aspirin",items,{cat:'treat'}).kind,'refused');}
}
const source=JSON.parse(fs.readFileSync('site/locales/ru-source.json')),en=JSON.parse(fs.readFileSync('site/locales/en.json'));
function numbers(s,english){s=s.replace(/(\d)\s+(?=\d{3}(?:\D|$))/g,'$1');if(english)s=s.replace(/(\d),(?=\d{3}(?:\D|$))/g,'$1');return(s.match(/\d+(?:[.,]\d+)?/g)||[]).map(x=>x.replace(',','.')).sort().join('|');}
for(const s of source){assert(en[s],'Missing: '+s);assert.equal(numbers(en[s],true),numbers(s,false),'Numeric facts: '+s);}
const store={},iBox={window:{KK_MESSAGES:JSON.parse(fs.readFileSync('site/locales/kk.json')),EN_MESSAGES:en,alert(){},confirm(){},dispatchEvent(){}},URLSearchParams,URL,WeakMap,Map,location:{search:'?lang=en',href:'https://example.test/?lang=en'},localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v},document:{title:'Свободный приём',body:null,addEventListener(){}},history:{replaceState(){}},CustomEvent:function(){}};
vm.createContext(iBox);vm.runInContext(fs.readFileSync('site/i18n.js','utf8'),iBox);const i=iBox.window.I18n;assert.equal(i.locale(),'en-US');assert.equal(i.t('Осмотреть'),'Examine');assert.equal(store['vp.language.v1'],'en');i.setLanguage('kk');assert.equal(i.t('Осмотреть'),'Қарап тексеру');i.setLanguage('ru');assert.equal(i.t('Осмотреть'),'Осмотреть');i.setLanguage('en');assert.equal(i.t('Осмотреть'),'Examine');
if(process.argv.includes('--voices')){const voices=JSON.parse(fs.readFileSync('site/locales/voice-map.json')),rows=JSON.parse(fs.readFileSync('site/locales/spoken-source.json'));for(const r of rows){const voice=r.gender==='female'?'en-US-JennyNeural':'en-US-GuyNeural',text=en[r.text.replace(/\s+/g,' ').trim()],key=crypto.createHash('sha256').update(voice+text).digest('hex').slice(0,20);assert.equal(voices.en[r.source],'media/voice/en/'+key+'.mp3','Stale English audio: '+r.text);assert(fs.existsSync('site/'+voices.en[r.source]));}console.log('OK '+rows.length+' current English audio mappings.');}
console.log('OK '+count+' English commands, cough, urgent referral, negation, catalog coverage, clinical numbers and RU/KK/EN round trip.');
