/* Spoken text only: never changes visible spelling, NLU or clinical facts. */
(function(root){
 'use strict';
 root.Pronunciation={prepare:function(text,language){
  if(language==='kk')return text;
  return String(text||'').replace(/(про|по|от)кашл(я[а-яё]*)/gi,function(_,prefix,end){return prefix+'ка\u0301шл'+end;});
 }};
})(typeof window!=='undefined'?window:globalThis);
