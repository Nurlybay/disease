/* Dynamic replies use a voice of the selected language only, never a Russian fallback for Kazakh. */
(function(root){
 'use strict';var synth=root.speechSynthesis,active=null;
 root.PatientSpeech={cancel:function(){active=null;if(synth)synth.cancel();},speak:function(text,gender,done,status){
  this.cancel();var locale=root.I18n?I18n.locale():'ru-RU',language=locale.slice(0,2);
  if(!synth||!root.SpeechSynthesisUtterance){status('Озвучка в этом браузере недоступна. Ответ остаётся в тексте.');done();return;}
  var voices=synth.getVoices().filter(function(v){return v.lang.toLowerCase().slice(0,2)===language;});
  if(!voices.length){status('Голос выбранного языка недоступен в этом браузере. Ответ остаётся в тексте.');done();return;}
  var u=new SpeechSynthesisUtterance(root.Pronunciation?Pronunciation.prepare(text,language):text);active=u;
  var preferred=gender==='female'?/Aigul|Svetlana|female|Irina/i:/Daulet|Dmitry|male|Pavel/i;
  u.voice=voices.filter(function(v){return preferred.test(v.name);})[0]||voices[0];u.lang=locale;u.rate=.95;
  u.onend=function(){if(active===u){active=null;done();}};u.onerror=function(){if(active===u){active=null;status('Озвучка недоступна. Ответ остаётся в тексте.');done();}};synth.speak(u);
 }};
})(window);
