/* Explicit identity questions only: symptom duration and test orders are not passport fields. */
(function(root){
 'use strict';
 root.PassportQuestions={direct:function(q){
  q=String(q).toLowerCase().trim().replace(/[?!.,]+$/g,'').trim();
  if (/^(фио|имя|фамилия|имя и фамилия|аты-жөні|аты жөні|атыңыз|есіміңіз|full name|name)$/.test(q))return 'p.name';
  if (/^(возраст|жасы|жасыңыз|age)$/.test(q))return 'p.age';
  return null;
 },ids:function(question,answer,passport){
  if(!answer)return [];
  var refused=/не (знаю|помню|скажу)|не хочу|don't (know|remember)|do not (know|remember)|білмеймін|есімде жоқ/i.test(answer);
  var q=String(question).toLowerCase().replace(/ё/g,'е'),ids=[];
  if(/как (вас|тебя) (зовут|звать)|как(ое)? (у вас )?(ваше )?имя|назовите (свое |ваше )?(имя|фио|фамилию)|^фио[?! .]*$|ваш[еи]? (имя|фио|фамил)|представьтесь|давайте познакомимся|\b(your (full )?name|introduce yourself)\b|аты[ңн]ыз|есіміңіз|аты жөніңіз/.test(q))ids.push('p.name');
  if(/сколько (вам|тебе) (лет|год)|ваш возраст|возраст[?! .]*$|сколько (полных )?лет вам|\b(how old are you|your age)\b|жасыңыз|неше жастасыз/.test(q))ids.push('p.age');
  if(!/аллерго(тест|проб|панел)|\ballergy test|талдау/.test(q) && /аллерги|непереносимость лекарств|\ballerg(y|ies|ic)\b/.test(q))ids.push('p.allergy');
  if(/(где|кем|кто вы по профессии|какая у вас профессия).*(работ|професс)|кем вы (были|работали)|чем (вы )?занимаетесь|ваша (профессия|специальность)|\b(your (job|occupation|profession)|what do you do for (a )?living|where do you work|what (is|was) your job)\b|қайда.*жұмыс|кім болып.*(жұмыс|істе)|мамандығыңыз/.test(q))ids.push('p.job');
  function norm(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-яәіңғүұқөһ0-9]+/g,' ').trim();}
  var a=' '+norm(answer)+' ';
  var confirmed=(passport||[]).filter(function(p){
    var v=norm(p.value);
    return v.length>=3 && a.indexOf(' '+v+' ')>=0 && (p.id!=='p.allergy'||ids.indexOf(p.id)>=0);
  }).map(function(p){return p.id;});
  if(refused)ids=ids.filter(function(id){return confirmed.indexOf(id)>=0;});
  confirmed.forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});
  return ids;
 }};
})(window);
