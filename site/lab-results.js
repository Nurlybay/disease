/* Structured lab sheets: every cell is escaped; no diagnostic highlighting. */
(function(root){
 'use strict';
 function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 root.LabResults={render:function(lab){
  if(!lab||!Array.isArray(lab.rows))return '';
  return '<div class="lab-sheet"><p class="lab-caption">'+esc(lab.title)+'</p><div class="lab-scroll" tabindex="0"><table class="lab-table"><thead><tr>'+['Показатель','Результат','Единицы','Референсный интервал'].map(function(s){return '<th scope="col">'+esc(s)+'</th>';}).join('')+'</tr></thead><tbody>'+lab.rows.map(function(r){return '<tr><th scope="row">'+esc(r.name)+'</th><td>'+esc(r.value)+'</td><td>'+esc(r.unit)+'</td><td>'+esc(r.ref)+'</td></tr>';}).join('')+'</tbody></table></div><p class="lab-note">Учебный бланк: фиксированные данные вымышленного пациента. Референсы этой условной лаборатории могут отличаться от других лабораторий.</p></div>';
 }};
})(window);
