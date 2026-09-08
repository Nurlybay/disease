'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const c=JSON.parse(fs.readFileSync('site/locales/kk.json')),source=JSON.parse(fs.readFileSync('site/locales/ru-source.json'));
for(const s of source)assert(c[s],'Missing: '+s);
function numbers(s){return (s.replace(/(\d)\s+(?=\d{3}(?:\D|$))/g,'$1').match(/\d+(?:[.,]\d+)?/g)||[]).sort().join('|');}
for(const s of source)assert.equal(numbers(c[s]),numbers(s),'Numeric facts: '+s);
const voices=JSON.parse(fs.readFileSync('site/locales/voice-map.json')),rows=JSON.parse(fs.readFileSync('site/locales/spoken-source.json'));
for(const r of rows){const voice=r.gender==='female'?'kk-KZ-AigulNeural':'kk-KZ-DauletNeural',text=c[r.text.replace(/\s+/g,' ').trim()],key=crypto.createHash('sha256').update(voice+text).digest('hex').slice(0,20);assert.equal(voices.kk[r.source],'media/voice/kk/'+key+'.mp3','Stale KK audio: '+r.text);assert(fs.existsSync('site/'+voices.kk[r.source]));}
const store={},box={window:{KK_MESSAGES:c,PATIENT_VOICES:voices,alert(){},confirm(){},dispatchEvent(){}},URLSearchParams,URL,WeakMap,Map,location:{search:'?lang=kk',href:'https://example.test/priem.html?lang=kk'},localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v},document:{title:'Свободный приём',body:null,addEventListener(){}},history:{replaceState(){}},CustomEvent:function(){}};
vm.createContext(box);vm.runInContext(fs.readFileSync('site/i18n.js','utf8'),box);const i=box.window.I18n;
assert.equal(i.locale(),'kk-KZ');assert.equal(store['vp.language.v1'],'kk');assert.equal(i.t('Осмотреть'),'Қарап тексеру');assert.equal(i.audio('media/clinical/heart-01.mp3'),'media/clinical/heart-01.mp3');assert.equal(i.audio(rows[0].source),voices.kk[rows[0].source]);i.setLanguage('ru');assert.equal(i.t('Осмотреть'),'Осмотреть');assert.equal(i.audio(rows[0].source),rows[0].source);i.setLanguage('kk');assert.equal(i.t('Осмотреть'),'Қарап тексеру');
console.log('OK catalog coverage, clinical numbers, '+rows.length+' current Kazakh audio mappings, language persistence and unchanged clinical recordings.');
