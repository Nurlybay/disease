/* Explicit identity questions only: symptom duration and test orders are not passport fields. */
(function(root){
 'use strict';
 root.PassportQuestions={ids:function(question,answer){
  if(!answer || /не (знаю|помню|скажу)|не хочу|don't (know|remember)|do not (know|remember)|білмеймін|есімде жоқ/i.test(answer))return [];
  var q=String(question).toLowerCase().replace(/ё/g,'е'),ids=[];
  if(/как (вас|тебя) (зовут|звать)|ваш[еи]? (имя|фио|фамил)|представьтесь|давайте познакомимся|\b(your (full )?name|introduce yourself)\b|аты[ңн]ыз|есіміңіз|аты жөніңіз/.test(q))ids.push('p.name');
  if(/сколько (вам|тебе) (лет|год)|ваш возраст|\b(how old are you|your age)\b|жасыңыз|неше жастасыз/.test(q))ids.push('p.age');
  if(!/аллерго(тест|проб|панел)|\ballergy test|талдау/.test(q) && /аллерги|непереносимость лекарств|\ballerg(y|ies|ic)\b/.test(q))ids.push('p.allergy');
  if(/(где|кем|кто вы по профессии|какая у вас профессия).*(работ|професс)|кем вы (были|работали)|чем (вы )?занимаетесь|ваша (профессия|специальность)|\b(your (job|occupation|profession)|what do you do for (a )?living|where do you work|what (is|was) your job)\b|қайда.*жұмыс|кім болып.*(жұмыс|істе)|мамандығыңыз/.test(q))ids.push('p.job');
  return ids;
 }};
})(window);
