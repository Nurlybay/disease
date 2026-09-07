(function () {
  'use strict';
  var $ = function(id){return document.getElementById(id);};
  var records = window.CLINICAL_MEDIA || [], current, storageOK=true;
  var memory={};
  function esc(s){return String(s || '').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function key(){return 'vp.media.attempt.v1.'+current.id;}
  function read(){try { var d=JSON.parse(localStorage.getItem(key())||'null');return d&&typeof d.text==='string'?d:{text:'',revealed:false}; }catch(e){storageOK=false;return memory[key()]||{text:'',revealed:false};}}
  function save(revealed){var d={text:$('interpretation').value,revealed:revealed};memory[key()]=d;try{localStorage.setItem(key(),JSON.stringify(d));}catch(e){storageOK=false;} $('saveStatus').textContent=storageOK?'Ответ сохранён только в этом браузере. Автоматической оценки нет.':'Хранилище недоступно. Ответ сохранится только до закрытия этой страницы.';}
  function debrief(){
    $('mediaDebrief').innerHTML='<h3>'+esc(current.diagnosis)+'</h3><ul>'+current.findings.map(function(f){return '<li>'+esc(f)+'</li>';}).join('')+'</ul><p>'+esc(current.limit)+'</p>';
    $('mediaDebrief').hidden=false;$('ecgMarks').hidden=false;$('interpretation').readOnly=true;$('revealBtn').disabled=true;
  }
  function show(id){
    current=records.filter(function(r){return r.id===id;})[0]||records[0];if(!current)return;
    $('labAudio').pause();$('labAudio').removeAttribute('src');$('labAudio').load();
    $('mediaError').hidden=true;$('mediaTitle').textContent=current.title;$('mediaKind').textContent=current.kind==='ecg'?'12 отведений':'Аускультация';$('mediaPrompt').textContent=current.prompt;
    $('ecgWrap').hidden=current.kind!=='ecg';$('ecgZoom').hidden=current.kind!=='ecg';$('audioWrap').hidden=current.kind!=='audio';
    $('ecgStage').classList.remove('is-zoomed');$('ecgZoom').textContent='Увеличить ЭКГ';
    if(current.kind==='ecg')$('ecgImage').src=current.file;else $('labAudio').src=current.file;
    $('ecgMarks').innerHTML=(current.marks||[]).map(function(m){return '<span class="ecg-mark" style="left:'+m.x+'%;top:'+m.y+'%;width:'+m.w+'%;height:'+m.h+'%"><b>'+esc(m.label)+'</b></span>';}).join('');
    $('ecgMarks').hidden=true;$('mediaDebrief').hidden=true;$('mediaDebrief').innerHTML='';$('interpretation').readOnly=false;$('revealBtn').disabled=false;
    $('interpretation').setCustomValidity('');var d=read();$('interpretation').value=d.text;if(d.revealed)debrief();
    $('saveStatus').textContent=storageOK?'Ответ остаётся в этом браузере. Автоматической оценки правильности нет.':'Хранилище недоступно. Ответ сохранится только до закрытия этой страницы.';
    $('mediaCredit').innerHTML='Автор: '+esc(current.author)+' · <a target="_blank" rel="noopener noreferrer" href="'+esc(current.source)+'">Источник</a> · <a target="_blank" rel="noopener noreferrer" href="'+esc(current.licenseUrl)+'">'+esc(current.license)+'</a><br>'+esc(current.changes);
    Array.prototype.forEach.call(document.querySelectorAll('[data-record]'),function(b){b.setAttribute('aria-current',b.dataset.record===current.id?'true':'false');});
  }
  $('mediaNav').innerHTML=records.map(function(r){return '<a data-record="'+r.id+'" href="#'+r.id+'">'+esc(r.title)+'</a>';}).join('');
  $('interpretForm').addEventListener('submit',function(e){e.preventDefault();if(!$('interpretation').value.trim()){ $('interpretation').setCustomValidity('Сначала опишите хотя бы одну находку.');$('interpretation').reportValidity();return;}save(true);debrief();$('mediaDebrief').focus();});
  $('interpretation').addEventListener('input',function(){this.setCustomValidity('');save(false);});
  $('resetAttempt').addEventListener('click',function(){$('interpretation').value='';save(false);show(current.id);$('interpretation').focus();});
  $('ecgZoom').addEventListener('click',function(){var expanded=$('ecgStage').classList.toggle('is-zoomed');this.textContent=expanded?'Показать целиком':'Увеличить ЭКГ';});
  ['ecgImage','labAudio'].forEach(function(id){$(id).addEventListener('error',function(){if((id==='labAudio'&&current.kind==='audio')||(id==='ecgImage'&&current.kind==='ecg'))$('mediaError').hidden=false;});});
  window.addEventListener('hashchange',function(){show(location.hash.slice(1));});
  show(location.hash.slice(1));
})();
