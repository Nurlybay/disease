(function () {
  'use strict';
  var $ = function(id){return document.getElementById(id);};
  var records = window.CLINICAL_MEDIA || [], current, storageOK=true;
  var memory={}, visible=[];
  var numbered=records.filter(function(r){return r.number;}).sort(function(a,b){return a.number-b.number;});
  function filtered(){var group=$('mediaGroup').value,q=$('mediaSearch').value.toLocaleLowerCase().trim();return records.filter(function(r){return (group==='extras'?!r.number:(group==='all'?!!r.number:r.group===group))&&(!q||(r.number+' '+(r.topic||r.diagnosis)+' '+r.id).toLocaleLowerCase().indexOf(q)!==-1);}).sort(function(a,b){return (a.number||100)-(b.number||100);});}
  function updatePicker(){
    visible=filtered();$('mediaTopic').innerHTML=visible.map(function(r){return '<option value="'+esc(r.id)+'">'+esc((r.number?r.number+'. ':'')+(r.topic||r.diagnosis))+'</option>';}).join('');
    if(current&&visible.some(function(r){return r.id===current.id;}))$('mediaTopic').value=current.id;
    else if(visible.length){$('mediaTopic').insertAdjacentHTML('afterbegin','<option value="">Выберите материал из найденных</option>');$('mediaTopic').value='';}
    $('mediaTopic').disabled=!visible.length;
    var index=visible.findIndex(function(r){return current&&r.id===current.id;});
    $('mediaPrev').disabled=index<=0;$('mediaNext').disabled=index<0||index>=visible.length-1;
    $('mediaCount').textContent=visible.length?'Материалов: '+visible.length:'Ничего не найдено. Измените поиск.';
  }
  function navigate(id){if(location.hash.slice(1)===id)show(id);else location.hash=id;}
  function changeFilter(){updatePicker();if(visible.length)navigate(visible[0].id);}
  $('mediaGroup').addEventListener('change',changeFilter);
  $('mediaSearch').addEventListener('input',updatePicker);
  $('mediaTopic').addEventListener('change',function(){if(this.value)navigate(this.value);});
  ['mediaPrev','mediaNext'].forEach(function(id){$(id).addEventListener('click',function(){var i=visible.findIndex(function(r){return r.id===current.id;});var next=visible[i+(id==='mediaNext'?1:-1)];if(next)navigate(next.id);});});
  function esc(s){return String(s || '').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function key(){return 'vp.media.attempt.v1.'+current.id;}
  function read(){try { var d=JSON.parse(localStorage.getItem(key())||'null');return d&&typeof d.text==='string'?d:{text:'',revealed:false}; }catch(e){storageOK=false;return memory[key()]||{text:'',revealed:false};}}
  function save(revealed){var d={text:$('interpretation').value,revealed:revealed};memory[key()]=d;try{localStorage.setItem(key(),JSON.stringify(d));}catch(e){storageOK=false;} $('saveStatus').textContent=storageOK?'Ответ сохранён только в этом браузере. Автоматической оценки нет.':'Хранилище недоступно. Ответ сохранится только до закрытия этой страницы.';}
  function debrief(){
    $('mediaDebrief').innerHTML='<h3>'+esc(current.diagnosis)+'</h3><ul>'+current.findings.map(function(f){return '<li>'+esc(f)+'</li>';}).join('')+'</ul><p>'+esc(current.limit)+'</p>'+(current.reference?'<p><a target="_blank" rel="noopener noreferrer" href="'+esc(current.reference)+'">Справочный материал по теме ↗</a></p>':'');
    $('mediaDebrief').hidden=false;$('ecgMarks').hidden=false;$('interpretation').readOnly=true;$('revealBtn').disabled=true;
  }
  function show(id){
    current=records.filter(function(r){return r.id===id;})[0]||numbered[0]||records[0];if(!current)return;
    $('labAudio').pause();$('labAudio').removeAttribute('src');$('labAudio').load();
    $('mediaError').hidden=true;$('mediaTitle').textContent=current.topic||current.diagnosis;$('mediaKind').textContent=current.format||(current.kind==='ecg'?'ЭКГ из открытого источника':'Аускультация');$('mediaPrompt').textContent=current.prompt;
    $('ecgWrap').hidden=current.kind!=='ecg';$('ecgZoom').hidden=current.kind!=='ecg';$('audioWrap').hidden=current.kind!=='audio';
    $('ecgStage').classList.remove('is-zoomed');$('ecgZoom').textContent='Увеличить ЭКГ';
    if(current.kind==='ecg')$('ecgImage').src=current.file;else $('labAudio').src=current.file;
    $('ecgMarks').innerHTML=(current.marks||[]).map(function(m){return '<span class="ecg-mark" style="left:'+m.x+'%;top:'+m.y+'%;width:'+m.w+'%;height:'+m.h+'%"><b>'+esc(m.label)+'</b></span>';}).join('');
    $('ecgMarks').hidden=true;$('mediaDebrief').hidden=true;$('mediaDebrief').innerHTML='';$('interpretation').readOnly=false;$('revealBtn').disabled=false;
    $('interpretation').setCustomValidity('');var d=read();$('interpretation').value=d.text;if(d.revealed)debrief();
    $('saveStatus').textContent=storageOK?'Ответ остаётся в этом браузере. Автоматической оценки правильности нет.':'Хранилище недоступно. Ответ сохранится только до закрытия этой страницы.';
    $('mediaCredit').innerHTML='Автор: '+esc(current.author)+' · <a target="_blank" rel="noopener noreferrer" href="'+esc(current.source)+'">Источник</a> · <a target="_blank" rel="noopener noreferrer" href="'+esc(current.licenseUrl)+'">'+esc(current.license)+'</a><br>'+esc(current.changes)+(current.sourceTitle?'<br>Исходное название: '+esc(current.sourceTitle):'');
    if(!filtered().some(function(r){return r.id===current.id;})){$('mediaGroup').value=current.number?(current.group||'all'):'extras';$('mediaSearch').value='';}
    updatePicker();
  }
  $('interpretForm').addEventListener('submit',function(e){e.preventDefault();if(!$('interpretation').value.trim()){ $('interpretation').setCustomValidity('Сначала опишите хотя бы одну находку.');$('interpretation').reportValidity();return;}save(true);debrief();$('mediaDebrief').focus();});
  $('interpretation').addEventListener('input',function(){this.setCustomValidity('');save(false);});
  $('resetAttempt').addEventListener('click',function(){$('interpretation').value='';save(false);show(current.id);$('interpretation').focus();});
  $('ecgZoom').addEventListener('click',function(){var expanded=$('ecgStage').classList.toggle('is-zoomed');this.textContent=expanded?'Показать целиком':'Увеличить ЭКГ';});
  ['ecgImage','labAudio'].forEach(function(id){$(id).addEventListener('error',function(){if((id==='labAudio'&&current.kind==='audio')||(id==='ecgImage'&&current.kind==='ecg'))$('mediaError').hidden=false;});});
  window.addEventListener('hashchange',function(){show(location.hash.slice(1));});
  show(location.hash.slice(1));
})();
