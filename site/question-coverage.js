/* Link completed dialogue to existing checklist IDs; never credit an examination. */
(function(root){
 'use strict';
 function uncertain(answer){return /не (знаю|помню|скажу|могу (точно )?сказать)|не понял|уточните|трудно сказать|don't (know|remember|understand)|do not (know|remember|understand)|could you clarify|білмеймін|есімде жоқ|түсінбедім/i.test(answer);}
 root.QuestionCoverage={ids:function(question,answer,covered,CASE,NLU){
  if(!answer)return [];
  var items=(CASE.passport||[]).concat(CASE.questions||[]),ids=[];
  function add(id){if(items.some(function(p){return p.id===id;})&&ids.indexOf(id)<0)ids.push(id);}
  (Array.isArray(covered)?covered:[]).forEach(function(c){
   if(c&&typeof c.asked==='string'&&c.asked.trim()&&question.indexOf(c.asked)>=0&&typeof c.evidence==='string'&&c.evidence.trim().length>=2&&answer.indexOf(c.evidence)>=0&&!uncertain(c.evidence))add(c.id);
  });
  if(!Array.isArray(covered) && !uncertain(answer)){
   if(root.PassportQuestions)root.PassportQuestions.ids(question,answer,CASE.passport).forEach(add);
   // Existing audited keywords and explicit alternative phrasings are a fallback for older/plain-text servers.
   (CASE.questions||[]).forEach(function(item){
    var alternatives=(item.aliases||[]).map(function(phrase){return {id:item.id,cat:'ask',need:[[phrase]],w:item.w||1};});
    var r=NLU.match(question,[item].concat(alternatives),{cat:'ask'});
    if(r.ok&&r.id===item.id)add(item.id);
   });
  }
  return ids;
 }};
})(window);
