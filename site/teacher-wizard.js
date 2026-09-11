/* Guided authoring. Text generation is server-side; publication is never automatic. */
(function(){
 'use strict';
 const root=document.getElementById('caseWizard'),CC=window.CustomCases;
 if(!root||!CC||!window.CaseEditor)return;
 let step=0,busy=false,selected='',savedId='',reviewed=false;
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const $=id=>document.getElementById(id);
 const t=s=>window.I18n?I18n.t(s):s;
 root.innerHTML='<div class="wizard-heading"><h1>Создать учебный случай</h1><p>Опишите идею — ИИ подготовит сценарий. Вы проверите его и выберете внешность пациента.</p></div>'+
 '<details class="wizard-saved"><summary>Мои сохранённые случаи</summary><select id="wSaved" aria-label="Сохранённый случай"><option value="">Выберите случай</option></select><button type="button" id="wOpen" class="btn btn-ghost">Открыть</button></details>'+
 '<ol class="wizard-steps"><li>1. Описание</li><li>2. Пациент</li><li>3. Проверка</li></ol>'+
 '<section id="wStep0"><h2>Какой случай создаём?</h2><label>Болезнь<input id="wDisease" maxlength="200" placeholder="Например: бронхиальная астма"></label><label>Краткое описание случая<textarea id="wDescription" rows="5" maxlength="2500" placeholder="Что беспокоит пациента? Чему должен научиться студент? Достаточно 2–3 предложений."></textarea></label><p class="wizard-hint">Используйте вымышленного пациента. Не вводите персональные данные реальных людей.</p><button id="wNext" type="button" class="btn btn-primary">Далее: выбрать пациента</button></section>'+
 '<section id="wStep1" hidden><h2>Выберите внешность пациента</h2><p>Фото уже готовы. ИИ согласует возраст и пол сценария с выбранным персонажем.</p><div id="wPatients" class="wizard-patients"></div><button id="wBack0" type="button" class="btn btn-ghost">Назад</button><button id="wGenerate" type="button" class="btn btn-primary">Подготовить сценарий с ИИ</button><p class="wizard-hint">Создание текста использует ИИ-бюджет проекта. Фото и видео автоматически не генерируются.</p></section>'+
 '<section id="wStep2" hidden><h2>Проверьте сценарий</h2><p>Это черновик ИИ. Откройте разделы и исправьте медицинские неточности перед занятием.</p><div id="wReview"></div><div class="wizard-idea"><h3>Идея для фото и анимации</h3><p id="wImageIdea"></p><p id="wMotionIdea"></p><button id="wMedia" type="button" class="btn btn-ghost">Добавить фото или анимацию</button><p>Необязательно: случай можно сохранить с готовым фото пациента.</p></div><label class="wizard-check"><input id="wReviewed" type="checkbox">Я проверил медицинское содержание и соответствие пациента случаю</label><div class="wizard-actions"><button id="wSave" type="button" class="btn btn-ghost">Сохранить черновик</button><button id="wRun" type="button" class="btn btn-primary">Проверить в тренажёре</button></div><p id="wSavedHint"></p><button id="wNew" type="button" class="btn btn-ghost">Создать другой случай</button></section><p id="wStatus" role="status" aria-live="polite"></p>';
 const media=document.getElementById('wizardMedia'),advanced=document.getElementById('wizardAdvanced');
 function status(s){$('wStatus').textContent=t(s);}
 function show(n){step=n;for(let i=0;i<3;i++){ $('wStep'+i).hidden=n!==i;const li=root.querySelectorAll('.wizard-steps li')[i];li.classList.toggle('is-current',i===n);if(i===n)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');}if(media)media.hidden=true;if(advanced)advanced.hidden=n!==2;root.querySelector('#wStep'+n+' h2').setAttribute('tabindex','-1');root.querySelector('#wStep'+n+' h2').focus({preventScroll:true});status('');}
 function saved(){const select=$('wSaved'),value=select.value;select.innerHTML='<option value="">'+t('Выберите случай')+'</option>'+CC.list().map(d=>'<option value="'+esc(d.id)+'">'+esc(d.disease)+' — '+esc(d.title)+'</option>').join('');select.value=value;}
 $('wPatients').innerHTML=CC.PATIENTS.map(p=>'<button type="button" class="wizard-patient" data-patient="'+esc(p.id)+'" aria-pressed="false"><img loading="lazy" src="'+esc(p.image)+'" alt="'+esc(p.label)+'"><span>'+esc(p.label)+'</span></button>').join('');
 $('wPatients').onclick=e=>{const b=e.target.closest('[data-patient]');if(!b||busy)return;selected=b.dataset.patient;for(const x of $('wPatients').children)x.setAttribute('aria-pressed',String(x===b));};
 function inputValid(){if($('wDisease').value.trim().length<3||$('wDescription').value.trim().length<10){status('Укажите болезнь и кратко опишите случай.');return false;}return true;}
 $('wNext').onclick=()=>{if(inputValid())show(1);};$('wBack0').onclick=()=>show(0);
 function toDraft(x,p){
  const d={v:1,id:'',disease:$('wDisease').value.trim(),title:x.title,patient:{name:x.name,short:x.name,reason:x.greeting,greetingText:x.greeting,gender:p.gender,templateId:p.id,appearance:CC.normalizeMedia(p)},passport:[
   {id:'p.name',field:'ФИО',value:x.name,text:x.name,need:[['имя','фио','фамил','зовут','name','аты','есім']]},
   {id:'p.age',field:'Возраст',value:x.age,text:x.age,need:[['возраст','лет','age','жас']]},
   {id:'p.allergy',field:'Аллергии',value:x.allergies,text:x.allergies,need:[['аллерг','allerg']]},
   {id:'p.job',field:'Профессия',value:x.occupation,text:x.occupation,need:[['работ','професс','occupation','жұмыс']]}],
   vitals:x.vitals.map((v,i)=>({id:'v.gen'+i,field:v.label,value:v.value,unit:v.unit,abnormal:v.abnormal,flag:v.abnormal?'warn':'ok',need:[v.aliases],weight:1})),
   questions:x.questions.map((q,i)=>({id:'q.gen'+i,label:q.label,text:q.answer,why:q.why,need:[q.aliases],weight:1})),
   exams:x.exams.map((q,i)=>({id:'e.gen'+i,label:q.label,title:q.label,result:q.result,why:q.why,kind:'plain',findAbnormal:q.abnormal,need:[q.aliases],weight:1})),
   orders:x.orders.map((q,i)=>({id:'o.gen'+i,label:q.label,result:q.result,hint:q.why,role:'useful',need:[q.aliases],weight:1})),
   treatment:x.treatment.map((q,i)=>({id:'t.gen'+i,label:q.label,hint:q.why,role:'useful',need:[q.aliases],weight:1})),
   diagnosis:{correct:'dx.gen0',options:x.diagnoses.map((q,i)=>({id:'dx.gen'+i,label:q.label,why:q.why}))},
   auscultation:{enabled:false,points:{}},rules:[],debrief:{keyFindings:x.teachingPoints,trap:'',nextSteps:''}};
  return CC.normalize(d);
 }
 $('wGenerate').onclick=async()=>{
  if(busy||!inputValid())return;const p=CC.PATIENTS.find(p=>p.id===selected);if(!p){status('Выберите пациента на фото.');return;}
  busy=true;for(const b of $('wStep1').querySelectorAll('button'))b.disabled=true;status('ИИ готовит сценарий. Обычно это занимает до минуты.');
  try{
   const r=await LearningAccess.caseRequest({disease:$('wDisease').value.trim(),description:$('wDescription').value.trim(),patientLabel:p.label,gender:p.gender,language:window.I18n?I18n.language():'ru'});
   const d=toDraft(r.draft,p),errors=CC.validate(d);if(errors.length)throw Error('invalid_draft');
   CaseEditor.set(d);savedId='';reviewed=false;$('wReviewed').checked=false;
   $('wImageIdea').textContent=r.draft.imageIdea;$('wMotionIdea').textContent=r.draft.motionIdea;
   $('wSavedHint').textContent='';renderReview();show(2);
  }catch(e){status(({not_configured:'Создание сценария ещё не подключено. Обратитесь к администратору.',daily_limit:'Достигнут лимит ИИ-запросов проекта. Попробуйте позже.',teacher_required:'Для создания нужна роль преподавателя.',provider_balance:'Недостаточно средств на ИИ-балансе проекта.',invalid_draft:'Не удалось получить полный сценарий. Описание сохранено — можно повторить запрос.'})[e.message]||'Не удалось создать сценарий. Описание сохранено. Попробуйте ещё раз.');}
  finally{busy=false;for(const b of $('wStep1').querySelectorAll('button'))b.disabled=false;}
 };
 function field(path,label,value){return '<label>'+esc(label)+'<textarea rows="2" data-edit="'+esc(path)+'">'+esc(value)+'</textarea></label>';}
 function renderReview(){const d=CaseEditor.get();let html=field('title','Название случая',d.title)+field('patient.greetingText','Первая реплика пациента',d.patient.greetingText);
  const sections=[['passport','Данные пациента',[['value','Ответ']]],['questions','Жалобы и ответы',[['text','Ответ'],['why','Пояснение']]],['vitals','Показатели',[['value','Значение'],['unit','Единицы']]],['exams','Осмотр',[['result','Результат'],['why','Пояснение']]],['orders','Обследования',[['result','Результат'],['hint','Пояснение']]],['treatment','Лечение и тактика',[['hint','Пояснение']]],['diagnosis.options','Диагнозы',[['why','Обоснование']]]];
  for(const [path,title,fields] of sections){const rows=path.split('.').reduce((x,k)=>x[k],d);html+='<details><summary>'+t(title)+' · '+rows.length+'</summary>';rows.forEach((row,i)=>{const labelKey=row.field!==undefined?'field':'label';html+='<div class="wizard-review-row">'+field(path+'.'+i+'.'+labelKey,'Название',row[labelKey]);for(const [key,label]of fields)html+=field(path+'.'+i+'.'+key,label,row[key]);html+='</div>';});html+='</details>';}
  html+='<details><summary>'+t('Учебные акценты')+'</summary>'+d.debrief.keyFindings.map((v,i)=>field('debrief.keyFindings.'+i,'Пояснение',v)).join('')+'</details>';
  $('wReview').innerHTML=html;
 }
 $('wReview').oninput=e=>{if(!e.target.dataset.edit)return;const d=CaseEditor.get(),parts=e.target.dataset.edit.split('.');let obj=d;for(const k of parts.slice(0,-1))obj=obj[k];obj[parts.at(-1)]=e.target.value;
  if(parts[0]==='passport'&&parts[2]==='value'){d.passport[parts[1]].text=e.target.value;if(d.passport[parts[1]].id==='p.name'){d.patient.name=e.target.value;d.patient.short=e.target.value;}}
  CaseEditor.set(d);reviewed=false;$('wReviewed').checked=false;$('wSavedHint').textContent='';};
 $('wReviewed').onchange=()=>{reviewed=$('wReviewed').checked;};
 function save(run){if(run&&!reviewed){status('Сначала проверьте сценарий и отметьте это галочкой.');return;}const d=CaseEditor.get(),errors=CC.validate(d);if(errors.length){status(errors.join(' '));return;}const r=CC.save(d);if(!r.ok){status('Не удалось сохранить случай в браузере.');return;}savedId=r.id;d.id=r.id;CaseEditor.set(d);saved();$('wSavedHint').textContent=t('Черновик сохранён в этом браузере. Для доступа с другого устройства используйте публикацию в дополнительных настройках.');if(run)location.href='priem.html?char='+encodeURIComponent(savedId)+'&lang='+(window.I18n?I18n.language():'ru');}
 $('wSave').onclick=()=>save(false);$('wRun').onclick=()=>save(true);
 $('wNew').onclick=()=>{$('wDisease').value='';$('wDescription').value='';root.querySelector('.wizard-saved').open=false;show(0);window.scrollTo(0,0);};
 $('wOpen').onclick=()=>{const d=CC.get($('wSaved').value);if(!d)return;CaseEditor.set(d);savedId=d.id;reviewed=false;$('wReviewed').checked=false;$('wImageIdea').textContent='';$('wMotionIdea').textContent='';renderReview();show(2);};
 $('wMedia').onclick=()=>{if(media){media.hidden=false;const details=$('msDetails');if(details)details.open=true;if($('msPatient'))$('msPatient').disabled=true;if($('msDescription'))$('msDescription').value=$('wImageIdea').textContent;if($('msMotion'))$('msMotion').value=$('wMotionIdea').textContent;media.scrollIntoView({behavior:'smooth',block:'start'});}};
 if(advanced)advanced.addEventListener('toggle',()=>{if(!advanced.open&&step===2){renderReview();reviewed=false;$('wReviewed').checked=false;}});
 if($('wMediaBack'))$('wMediaBack').onclick=()=>{media.hidden=true;$('wMedia').focus();};
 saved();if(CC.onChange)CC.onChange(saved);if(window.Sync)Sync.init(saved);show(0);
})();
