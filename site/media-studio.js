/* Teacher media library. Provider keys and all paid operations stay on the server. */
(function () {
 'use strict';
 var root=document.getElementById('mediaStudio');
 if(!root)return;
 var jobs=[],selected=null,busy=false,timer=null,config={image:false,video:false},loaded=false;
 var errors={signin_required:'Войдите в аккаунт преподавателя.',teacher_required:'Создание доступно только преподавателям.',not_configured:'Генерация ещё не подключена. Администратору нужно настроить OpenRouter.',daily_limit:'Достигнут дневной лимит генераций. Готовые материалы можно использовать.',provider_balance:'На счёте сервиса недостаточно средств.',provider_access:'Сервис отклонил ключ или доступ к модели. Обратитесь к администратору.',provider_rejected:'Сервис отклонил запрос. Уточните описание.',provider_busy:'Сервис занят. Попробуйте позже.',provider_uncertain:'Результат запроса неизвестен. Новая попытка может оплачиваться повторно. Обратитесь к администратору с номером задания.',storage_unavailable:'Хранилище недоступно. Обратитесь к администратору.',video_failed:'Видео не удалось создать. Картинка сохранена в библиотеке.',save_failed:'Не удалось сохранить файл.',review_required:'Сначала проверьте изображение.',unsupported_video_host:'Видео создано, но сервер не разрешает адрес его хранения. Администратору нужно проверить домен CDN.',download_failed:'Не удалось скачать готовое видео. Обновите статус, повторная генерация не нужна.'};
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
 root.innerHTML='<details id="msDetails" class="ms-studio"><summary><span class="ms-kicker">ПАЦИЕНТЫ И СЦЕНЫ</span><strong>Создать пациента и анимацию</strong><span>Пациент → находка → сцена → вопрос или осмотр</span></summary>'+
 '<div class="ms-body"><p class="cn-hint">Создавайте иллюстрации вымышленных пациентов. Перед анимацией проверьте изображение, перед прикреплением — готовый материал.</p>'+
 '<div class="ms-grid"><div class="ms-compose"><label for="msPurpose">Что создаём?</label><select id="msPurpose"><option value="finding">Находку: кожа, горло и другое</option><option value="patient">Внешность пациента</option><option value="scene">Сцену с выбранным пациентом</option></select><div id="msReferences" hidden><label for="msPatient">Пациент из библиотеки</label><select id="msPatient"></select><label for="msFinding">Находка для сцены (необязательно)</label><select id="msFinding"></select><label class="cn-chk"><input type="checkbox" id="msReferencesReviewed">Пациент и находка совместимы; изображения проверены</label><p class="cn-hint">Например: пациент показывает кисть или указывает, где болит. Проверьте соответствие кожи и анатомии на общем и крупном плане.</p></div><label for="msDescription">1. Опишите пациента, находку или сцену</label>'+
 '<div class="ms-presets"><button type="button" class="btn btn-ghost btn-sm" data-ms-preset="skin">Сухая кожа кисти</button><button type="button" class="btn btn-ghost btn-sm" data-ms-preset="throat">Покраснение горла</button></div>'+
 '<textarea id="msDescription" rows="4" maxlength="1500" placeholder="Например: сухая кожа на тыльной стороне кисти взрослого, умеренное шелушение, без трещин"></textarea>'+
 '<button type="button" id="msImage" class="btn btn-primary">Создать изображение</button>'+
 '<p id="msCost" class="cn-hint"></p><button id="msSetPatient" type="button" class="btn btn-ghost" disabled>Использовать как внешность пациента</button><p class="cn-hint">GPT Image 2.5 → Hailuo H3 Max через OpenRouter. Каждое новое изображение и видео — отдельная платная генерация. Просмотр сохранённых файлов не запускает генерацию.</p>'+
 '<label for="msMotion">2. Какое движение добавить?</label><textarea id="msMotion" rows="3" maxlength="800">Кисть медленно и слегка поворачивается. Камера неподвижна, рисунок и состояние кожи не меняются.</textarea>'+
 '<label class="cn-chk"><input id="msImageReviewed" type="checkbox"> Изображение проверено, можно анимировать</label>'+
 '<button type="button" id="msVideo" class="btn btn-ghost" disabled>Создать видео · 6 секунд · 768p</button></div>'+
 '<div class="ms-preview"><div id="msPreview" class="ms-frame"><p>Здесь появится изображение или видео</p></div>'+
 '<div class="ms-status-row"><span id="msStage">Новый материал</span><button id="msRefresh" type="button" class="btn btn-ghost btn-sm">Обновить библиотеку</button></div>'+
 '<p id="msStatus" role="status" aria-live="polite"></p><p id="msJobId" class="cn-hint"></p>'+
 '<label for="msTarget">3. Когда показывать сцену?</label><select id="msTarget"></select>'+
 '<label for="msExamLabel">Название нового вопроса или действия</label><input id="msExamLabel" value="Что вас беспокоит?" maxlength="120">'+
 '<label class="cn-chk"><input id="msReviewed" type="checkbox"> Проверено преподавателем для этого случая</label>'+
 '<div class="ms-actions"><button id="msAttach" type="button" class="btn btn-primary" disabled>Прикрепить к случаю</button><a id="msDownload" class="btn btn-ghost" target="_blank" rel="noopener" hidden>Открыть файл</a></div>'+
 '<p class="cn-hint">Материал помечается как синтетический. После прикрепления сохраните случай в конструкторе. Для просмотра облачных файлов нужен интернет.</p></div></div>'+
 '<div class="ms-library"><h3>Моя библиотека</h3><div id="msLibrary"><p class="cn-hint">Сохранённые материалы появятся после подключения.</p></div></div></div></details>';
 function targets(){
  var value=el('msTarget').value,entries=window.ConstructorMedia?ConstructorMedia.targets():[];
  el('msTarget').innerHTML='<option value="new-question">Добавить новый вопрос</option><option value="">Добавить новый приём осмотра</option>'+entries.map(function(e){return '<option value="'+esc(e.id)+'">'+esc(e.label||'Осмотр без названия')+'</option>';}).join('');
  if(entries.some(function(e){return e.id===value;}))el('msTarget').value=value;
  el('msExamLabel').disabled=!!el('msTarget').value&&el('msTarget').value!=='new-question';
 }
 function buttons(){
  el('msImage').disabled=busy||!config.image||el('msDescription').value.trim().length<3||(el('msPurpose').value==='scene'&&(!el('msPatient').value||!el('msReferencesReviewed').checked));
  el('msSetPatient').disabled=busy||!selected||selected.status!=='ready'||!selected.image_url;
  el('msVideo').disabled=busy||!config.video||!selected||selected.status!=='ready'||!selected.image_url||!el('msImageReviewed').checked;
  el('msAttach').disabled=busy||!selected||selected.status!=='ready'||!el('msReviewed').checked;
  el('msRefresh').disabled=busy;
 }
 function references(){
  ['msPatient','msFinding'].forEach(function(id){var field=el(id),value=field.value;field.innerHTML='<option value="">'+(id==='msPatient'?'Выберите пациента':'Без крупного плана')+'</option>'+jobs.filter(function(j){return j.status==='ready'&&j.image_url&&j.kind==='image';}).map(function(j){return '<option value="'+esc(j.id)+'">'+(j.purpose==='patient'?'Пациент: ':'')+esc(j.description)+'</option>';}).join('');field.value=value;});
 }
 function library(){
  references();
  var total=jobs.reduce(function(sum,j){return sum+(typeof j.cost==='number'?j.cost:0);},0);
  el('msCost').textContent='Подтверждённый расход по загруженным заданиям: $'+total.toFixed(5)+(selected&&typeof selected.cost==='number'?' · Выбранное: $'+selected.cost.toFixed(5):'');
  el('msLibrary').innerHTML=jobs.length?jobs.map(function(j){return '<button type="button" class="ms-library-item'+(selected&&selected.id===j.id?' is-selected':'')+'" data-ms-job="'+esc(j.id)+'">'+(j.image_url?'<img loading="lazy" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:6px" src="'+esc(j.image_url)+'">':'')+'<span>'+(j.kind==='video'?'Видео':j.purpose==='patient'?'Пациент':j.purpose==='scene'?'Сцена':'Находка')+' · '+esc(label(j))+'</span><strong>'+esc(j.description)+'</strong></button>';}).join(''):'<p class="cn-hint">Пока нет материалов. Начните с описания находки.</p>';
 }
 function media(job){return {image:job.image_url,video:job.video_url||'',detail:job.detail_image||'',synthetic:true,jobId:job.id};}
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
  if(kind==='image'){if(!config.image)return;body.description=el('msDescription').value;body.purpose=el('msPurpose').value;if(body.purpose==='scene'){body.patient_id=el('msPatient').value;body.finding_id=el('msFinding').value;body.reviewed=el('msReferencesReviewed').checked;}}
  else{if(!selected||!el('msImageReviewed').checked||!config.video)return;body.parent_id=selected.id;body.motion=el('msMotion').value;body.reviewed=true;}
  busy=true;buttons();message(kind==='image'?'Отправляем описание…':'Отправляем изображение на анимацию…');
  try{var r=await api(body);put(r.job);select(r.job);}
  catch(e){message((errors[e.message]||'Не удалось получить ответ. Обновите библиотеку перед новой попыткой, чтобы не оплатить повторный запрос.')+' Номер запроса: '+body.id,true);}
  finally{busy=false;buttons();schedule();}
 }
 el('msImage').onclick=function(){generate('image');};el('msVideo').onclick=function(){generate('video');};el('msRefresh').onclick=load;
 el('msTarget').onchange=function(){el('msExamLabel').disabled=!!this.value&&this.value!=='new-question';if(this.value==='new-question')el('msExamLabel').value='Что вас беспокоит?';else if(!this.value)el('msExamLabel').value='Осмотреть область жалобы';el('msReviewed').checked=false;buttons();};
 el('msAttach').onclick=function(){
  if(!selected||selected.status!=='ready'||!el('msReviewed').checked||!window.ConstructorMedia)return;
  var result=ConstructorMedia.attach(el('msTarget').value,el('msExamLabel').value,media(selected));
  if(result.ok){targets();el('msTarget').value=result.id;el('msExamLabel').disabled=true;message('Сцена прикреплена к выбранному вопросу или осмотру. Сохраните случай в конструкторе.');}
  else message(result.error,true);
 };
 el('msPurpose').onchange=function(){el('msReferences').hidden=this.value!=='scene';el('msReferencesReviewed').checked=false;if(this.value==='patient'){el('msDescription').value='Вымышленный мужчина 45 лет, сидит в кабинете врача, видны лицо, туловище и обе кисти. Нейтральная одежда.';el('msMotion').value='Спокойно сидит, едва заметное естественное движение. Камера неподвижна.';}else if(this.value==='scene'){el('msDescription').value='Пациент в ответ на вопрос о жалобах показывает, что его беспокоит.';el('msMotion').value='Пациент медленно показывает рукой область жалобы. Сохранить лицо, одежду и анатомию. Камера неподвижна.';}buttons();};
 el('msPatient').onchange=el('msFinding').onchange=function(){el('msReferencesReviewed').checked=false;buttons();};
 el('msSetPatient').onclick=function(){if(!selected||selected.status!=='ready')return;ConstructorMedia.setPatient(media(selected));message('Внешность пациента выбрана. Сохраните случай в конструкторе.');};
 root.addEventListener('input',buttons);root.addEventListener('change',buttons);
 root.addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  var id=b.getAttribute('data-ms-job');if(id){select(jobs.find(function(j){return j.id===id;}));return;}
  var preset=b.getAttribute('data-ms-preset');if(!preset)return;
  el('msPurpose').value='finding';el('msReferences').hidden=true;el('msTarget').value='';el('msExamLabel').disabled=false;
  el('msDescription').value=preset==='skin'?'Сухая кожа на тыльной стороне кисти взрослого. Умеренное мелкое шелушение, без трещин, крови и сыпи. Крупный план.':'Осмотр ротоглотки взрослого: умеренное покраснение слизистой, без налёта и язв. Хорошо видны язычок и миндалины. Крупный план.';
  el('msMotion').value=preset==='skin'?'Кисть медленно и слегка поворачивается. Камера неподвижна, рисунок и состояние кожи не меняются.':'Минимальное естественное движение при открытом рте. Камера неподвижна, анатомия и цвет слизистой сохраняются.';
  el('msExamLabel').value=preset==='skin'?'Осмотреть кожу':'Осмотреть горло';buttons();
 });
 el('msDetails').addEventListener('toggle',function(){if(this.open&&!loaded)load();else schedule();});
 document.addEventListener('visibilitychange',schedule);
 window.addEventListener('constructor-media-change',function(){targets();el('msReviewed').checked=false;buttons();});
 targets();buttons();
})();
