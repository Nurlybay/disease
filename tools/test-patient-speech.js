const fs=require('fs'),vm=require('vm'),assert=require('assert');
function run(names,gender,locale='ru-RU') {
 let spoken=null,notice='',ended=0;
 const root={I18n:{locale:()=>locale},speechSynthesis:{cancel(){},getVoices:()=>names.map(name=>({name,lang:locale})),speak:u=>spoken=u},SpeechSynthesisUtterance:function(text){this.text=text;}};
 vm.runInNewContext(fs.readFileSync('site/patient-speech.js','utf8'),{window:root,I18n:root.I18n,SpeechSynthesisUtterance:root.SpeechSynthesisUtterance});
 root.PatientSpeech.speak('Ответ пациента',gender,()=>ended++,s=>notice=s);
 return {spoken,notice,ended};
}
assert.equal(run(['Milena','Yuri'],'male').spoken.voice.name,'Yuri');
assert.equal(run(['Yuri','Milena'],'female').spoken.voice.name,'Milena');
assert.equal(run(['Google русский','Milena'],'male').spoken,null);
assert(run(['Milena'],'male').notice);assert.equal(run(['Milena'],'male').ended,1);
assert.equal(run(['female'],'male','en-US').spoken,null);
assert.equal(run(['Jenny','Guy'],'male','en-US').spoken.voice.name,'Guy');
assert.equal(run(['Daulet','Aigul'],'female','kk-KZ').spoken.voice.name,'Aigul');
assert.equal(run(['Google русский'],'female').spoken,null);
console.log('OK gender-specific voices, macOS Yuri/Milena, RU/KK/EN and safe text fallback.');
