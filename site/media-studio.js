/* Teacher media library. Provider keys and all paid operations stay on the server. */
(function () {
 'use strict';
 var root=document.getElementById('mediaStudio');
 if(!root)return;
 var jobs=[],selected=null,busy=false,timer=null,config={image:false,video:false},loaded=false;
 var errors={patient_required:'Выберите готового пациента из списка.',signin_required:'Войдите в аккаунт преподавателя.',teacher_required:'Создание доступно только преподавателям.',not_configured:'Генерация ещё не подключена. Администратору нужно настроить OpenRouter.',daily_limit:'Достигнут дневной лимит генераций. Готовые материалы можно использовать.',provider_balance:'На счёте сервиса недостаточно средств.',provider_access:'Сервис отклонил ключ или доступ к модели. Обратитесь к администратору.',provider_rejected:'Сервис отклонил запрос. Уточните описание.',provider_busy:'Сервис занят. Попробуйте позже.',provider_uncertain:'Результат запроса неизвестен. Новая попытка может оплачиваться повторно. Обратитесь к администратору с номером задания.',storage_unavailable:'Хранилище недоступно. Обратитесь к администратору.',video_failed:'Видео не удалось создать. Картинка сохранена в библиотеке.',save_failed:'Не удалось сохранить файл.',review_required:'Сначала проверьте изображение.',unsupported_video_host:'Видео создано, но сервер не разрешает адрес его хранения. Администратору нужно проверить домен CDN.',download_failed:'Не удалось скачать готовое видео. Обновите статус, повторная генерация не нужна.'};
 function el(id){return document.getElementById(id);}
 function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
 function message(s,error){el('msStatus').textContent=s;el('msStatus').classList.toggle('is-error',!!error);}
 async function api(body){
  if(!window.LearningAccess||!LearningAccess.mediaRequest)throw new Error('not_configured');
  return LearningAccess.mediaRequest(body);
 }
 function put(job){var i=jobs.findIndex(function(j){return j.id===job.id;});if(i<0)jobs.unshift(job);else jobs[i]=job;}
 function active(j){return j&&(j.status==='queued'||j.status==='running');}
 function label(j){return {queued:'В очереди',running:j.kind==='image'?'Создаём изображение':'Создаём видео',ready:'Готово',failed:'Не удалось создать',uncertain:'Нужно проверить запрос'}[j.status]||j.status;}
 root.innerHTML='<details id="msDetails" class="ms-studio"><summary><span class="ms-kicker">НЕОБЯЗАТЕЛЬНЫЙ ШАГ</span><strong>Добавить анимацию жалобы</strong><span>Можно пропустить — случай будет работать без неё</span></summary>'+
 '<div class="ms-body"><p>Студент спросит «Что вас беспокоит?» — тренажёр покажет сохранённую анимацию. Выбирать конкретный вопрос или осмотр не нужно.</p><button type="button" id="msSkip" class="btn btn-ghost">Продолжить без создания анимации</button>'+
 '<div class="ms-grid"><div class="ms-compose"><label for="msPatient">1. Выберите готового пациента</label><select id="msPatient"></select><img id="msPatientPhoto" alt="Выбранный пациент" style="width:120px;max-height:120px;object-fit:contain" hidden><p class="cn-hint">Это внешность пациента в вашем случае. Создание новых персонажей отключено.</p>'+
 '<label for="msDescription">2. Что пациент должен показать?</label><div class="ms-presets"><button type="button" class="btn btn-ghost btn-sm" data-ms-preset="skin">Показать кисть</button><button type="button" class="btn btn-ghost btn-sm" data-ms-preset="pain">Показать, где болит</button></div>'+
 '<textarea id="msDescription" rows="3" maxlength="1500" placeholder="Например: пациент показывает сухую кожу на кисти"></textarea><p class="cn-hint">Опишите видимое действие простыми словами. Сначала получите кадр и проверьте его, затем создайте видео.</p>'+
 '<details><summary>Дополнительные настройки</summary><label for="msFinding">Образец находки из библиотеки</label><select id="msFinding"></select><p class="cn-hint">Необязательно. Выбранное изображение также будет доступно крупным планом после видео. Оно должно соответствовать пациенту.</p><label for="msMotion">Движение в видео</label><textarea id="msMotion" rows="3" maxlength="800">Небольшое естественное движение при демонстрации жалобы. Сохранить лицо, одежду и анатомию. Камера неподвижна.</textarea></details>'+
 '<button type="button" id="msImage" class="btn btn-primary">Подготовить кадр</button><p class="cn-hint">Генерация кадра и видео оплачивается отдельно. Повторное использование готовой анимации не запускает генерацию.</p><label class="cn-chk"><input id="msImageReviewed" type="checkbox">Кадр проверен: пациент и находка выглядят правильно</label><button type="button" id="msVideo" class="btn btn-primary" disabled>Создать анимацию · 6 секунд</button></div>'+
 '<div class="ms-preview"><div id="msPreview" class="ms-frame"><p>Здесь появится кадр, затем анимация</p></div><div class="ms-status-row"><span id="msStage">Новая анимация</span><button id="msRefresh" type="button" class="btn btn-ghost btn-sm">Обновить библиотеку</button></div><p id="msStatus" role="status" aria-live="polite"></p><p id="msCost" class="cn-hint"></p><details><summary>Номер задания</summary><p id="msJobId"></p></details>'+
 '<strong>3. Посмотрите результат и используйте в случае</strong><label class="cn-chk"><input id="msReviewed" type="checkbox">Анимация соответствует жалобе этого пациента</label><div class="ms-actions"><button id="msAttach" type="button" class="btn btn-primary" disabled>Использовать при рассказе о жалобах</button><a id="msDownload" class="btn btn-ghost" target="_blank" rel="noopener" hidden>Открыть файл</a></div><p class="cn-hint">После добавления сохраните случай обычной кнопкой конструктора. Анимация появится в ответе на общий вопрос о жалобах; студент сможет включить видео и открыть его крупно.</p></div></div>'+
 '<details class="ms-library"><summary>Или выбрать уже готовый материал</summary><div id="msLibrary"></div></details></div></details>';
 function patient(){
  var id=window.ConstructorMedia?ConstructorMedia.patient():'';
  el('msPatient').innerHTML='<option value="">Выберите пациента</option>'+CustomCases.PATIENTS.map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.label)+'</option>';}).join('');el('msPatient').value=id;
  var chosen=CustomCases.PATIENTS.find(function(p){return p.id===id;});el('msPatientPhoto').hidden=!chosen;if(chosen)el('msPatientPhoto').src=chosen.image;
 }
 function buttons(){
  var mismatch=selected&&selected.patient_key&&selected.patient_key!==el('msPatient').value;
  el('msImage').disabled=busy||!config.image||!el('msPatient').value||el('msDescription').value.trim().length<3;
  el('msVideo').disabled=busy||mismatch||!config.video||!selected||selected.status!=='ready'||!selected.image_url||!el('msImageReviewed').checked;
  el('msAttach').disabled=busy||mismatch||!selected||!selected.video_url||selected.status!=='ready'||!el('msReviewed').checked;
  el('msRefresh').disabled=busy;
 }
 function references(){
  ['msFinding'].forEach(function(id){var field=el(id),value=field.value;field.innerHTML='<option value="">'+(id==='msPatient'?'Выберите пациента':'Без крупного плана')+'</option>'+jobs.filter(function(j){return j.status==='ready'&&j.image_url&&j.kind==='image';}).map(function(j){return '<option value="'+esc(j.id)+'">'+(j.purpose==='patient'?'Пациент: ':'')+esc(j.description)+'</option>';}).join('');field.value=value;});
 }
 function library(){
  references();
  var total=jobs.reduce(function(sum,j){return sum+(typeof j.cost==='number'?j.cost:0);},0);
  el('msCost').textContent='Подтверждённый расход по загруженным заданиям: $'+total.toFixed(5)+(selected&&typeof selected.cost==='number'?' · Выбранное: $'+selected.cost.toFixed(5):'');
  el('msLibrary').innerHTML=jobs.length?jobs.map(function(j){return '<button type="button" class="ms-library-item'+(selected&&selected.id===j.id?' is-selected':'')+'" data-ms-job="'+esc(j.id)+'">'+(j.image_url?'<img loading="lazy" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:6px" src="'+esc(j.image_url)+'">':'')+'<span>'+(j.kind==='video'?'Видео':j.purpose==='patient'?'Пациент':j.purpose==='scene'?'Сцена':'Находка')+' · '+esc(label(j))+'</span><strong>'+esc(j.description)+'</strong></button>';}).join(''):'<p class="cn-hint">Пока нет материалов. Начните с описания находки.</p>';
 }
 function media(job){return {image:job.image_url,video:job.video_url||'',detail:job.detail_image||'',patientKey:job.patient_key||'',synthetic:true,jobId:job.id};}
 function select(job){
  selected=job;el('msReviewed').checked=false;el('msImageReviewed').checked=false;
  el('msDescription').value=job.description;
  if(job.motion)el('msMotion').value=job.motion;
  el('msStage').textContent=label(job);el('msJobId').textContent='Задание: '+job.id;
  var frame=el('msPreview');frame.replaceChildren();
  if(job.video_url){var v=document.createElement('video');v.src=job.video_url;v.poster=job.image_url||'';v.controls=true;v.muted=true;v.playsInline=true;v.loop=true;v.preload='metadata';v.setAttribute('aria-label','Синтетическая анимация осмотра');frame.appendChild(v);}
  else if(job.image_url){var img=document.createElement('img');img.src=job.image_url;img.alt='Синтетическая иллюстрация осмотра';frame.appendChild(img);}
  else{var p=document.createElement('p');p.textContent=label(job);frame.appendChild(p);}
  if(job.status==='ready'){var preview=document.createElement('button');preview.className='btn btn-ghost';preview.textContent='Предпросмотр сцены';preview.onclick=function(){CustomCases.openScene(media(job));};frame.appendChild(preview);}
  el('msDownload').hidden=!job.video_url&&!job.image_url;
  if(!el('msDownload').hidden)el('msDownload').href=job.video_url||job.image_url;
  message(job.error?(errors[job.error]||'Не удалось завершить операцию. Проверьте статус позже.'):active(job)?'Задание сохранено. Можно закрыть страницу и вернуться к нему в библиотеке.':'Материал готов к просмотру.',!!job.error);
  if(job.patient_key&&job.patient_key!==el('msPatient').value)message('Эта анимация относится к другому пациенту. Выберите соответствующего пациента или подготовьте новый кадр.',true);
  library();buttons();schedule();
 }
 function schedule(){clearTimeout(timer);if(selected&&active(selected)&&el('msDetails').open&&!document.hidden)timer=setTimeout(poll,30000);}
 async function poll(){
  if(busy){schedule();return;}
  var id=selected&&selected.id;if(!id)return;
  try{var r=await api({action:'status',id:id});put(r.job);if(selected&&selected.id===id){if(r.job.status!==selected.status||r.job.video_url!==selected.video_url||r.job.image_url!==selected.image_url)select(r.job);else selected=r.job;}library();}
  catch(e){message(errors[e.message]||'Не удалось обновить статус. Повторим проверку.',true);}
  schedule();
 }
 async function load(){
  busy=true;buttons();
  try{
   var results=await Promise.all([api({action:'config'}),api({action:'list'})]);config=results[0];jobs=results[1].jobs;loaded=true;
   if(selected){var current=jobs.find(function(j){return j.id===selected.id;});if(current)select(current);}
   else if(jobs.length)select(jobs[0]);
   library();if(!config.image||!config.video)message(!config.image&&!config.video?'Генерация ещё не подключена. Администратору нужно настроить сервисы.':!config.video?'Изображения подключены. Создание видео пока не настроено.':'Создание изображений пока не настроено. Видео доступно для готовых изображений.');
  }catch(e){message(errors[e.message]||'Сервис недоступен. Проверьте подключение и настройку генерации.',true);}
  finally{busy=false;buttons();schedule();}
 }
 async function generate(kind){
  if(busy)return;
  var body={action:kind,id:crypto.randomUUID()};
  if(kind==='image'){if(!config.image||!el('msPatient').value)return;body.description=el('msDescription').value;body.purpose='scene';body.patient_key=el('msPatient').value;body.finding_id=el('msFinding').value;body.reviewed=true;}
  else{if(!selected||!el('msImageReviewed').checked||!config.video)return;body.parent_id=selected.id;body.motion=el('msMotion').value;body.reviewed=true;}
  busy=true;buttons();message(kind==='image'?'Отправляем описание…':'Отправляем изображение на анимацию…');
  try{var r=await api(body);put(r.job);select(r.job);}
  catch(e){message((errors[e.message]||'Не удалось получить ответ. Обновите библиотеку перед новой попыткой, чтобы не оплатить повторный запрос.')+' Номер запроса: '+body.id,true);}
  finally{busy=false;buttons();schedule();}
 }
 el('msImage').onclick=function(){generate('image');};el('msVideo').onclick=function(){generate('video');};el('msRefresh').onclick=load;
 el('msAttach').onclick=function(){
  if(!selected||!selected.video_url||!el('msReviewed').checked)return;
  var result=ConstructorMedia.setComplaint(media(selected));
  message(result.ok?'Анимация добавлена. Сохраните случай в конструкторе. На вопросы о жалобах она будет предлагаться автоматически.':result.error,!result.ok);
 };
 el('msPatient').onchange=function(){ConstructorMedia.choosePatient(this.value);el('msImageReviewed').checked=false;buttons();};
 el('msSkip').onclick=function(){el('msDetails').open=false;document.getElementById('constructorRoot').scrollIntoView({behavior:'smooth',block:'start'});};
 root.addEventListener('input',buttons);root.addEventListener('change',buttons);
 root.addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  var id=b.getAttribute('data-ms-job');if(id){select(jobs.find(function(j){return j.id===id;}));return;}
  var preset=b.getAttribute('data-ms-preset');if(!preset)return;
  el('msDescription').value=preset==='skin'?'Выбранный пациент показывает тыльную сторону кисти с умеренной сухостью и шелушением кожи, без трещин и сыпи.':'Выбранный пациент указывает рукой на область боли. Уточните здесь точное место и жест.';
  el('msMotion').value='Пациент медленно демонстрирует область жалобы. Сохранить внешность, одежду и видимые признаки. Камера неподвижна.';buttons();
 });
 el('msDetails').addEventListener('toggle',function(){if(this.open&&!loaded)load();else schedule();});
 document.addEventListener('visibilitychange',schedule);
 window.addEventListener('constructor-media-change',function(){patient();el('msReviewed').checked=false;buttons();});
 patient();buttons();
})();
