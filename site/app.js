/* Свободный приём. Ни одного этапа, ни одной готовой кнопки-вопроса:
   всё, что происходит, происходит потому, что врач это написал.

   Один IIFE, ES5-совместимо, без сборки и без сети — файл открывается
   и через file://. Подсчёт оценки, пропуски и код результата вынесены
   в score.js: их же использует страница преподавателя. */
(function () {
  'use strict';

  var CASE = (window.CASES || [])[0];
  var MODE = window.LearningMode.fromQuery(window.location.search);
  var independent = MODE === 'independent';
  var female = CASE.patient.gender === 'female';
  var person = female ? 'Пациентка' : 'Пациент';
  var speechInput = null;
  var aiChat = null, aiBusy = false, aiUsed = false;
  var pendingAi = null;
  var patientSounds = null;
  var motionEnabled = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var WF = window.WAVEFORMS || {};
  var $ = function (id) { return document.getElementById(id); };

  /* Кнопки категорий. Подсказывают ТИП действия и сужают разбор строки,
     но не перечисляют, что именно спрашивать или назначать. */
  /* Подгруппы (`sub`) — второй ряд кнопок под выбранной категорией.
     Два вида: `run` сразу выполняет каноническую фразу через обычный
     конвейер (submit → NLU), `ph` лишь сужает подсказку в строке ввода.
     Показатели названы прямо — их шесть плиток и так видно на экране
     с самого старта, кнопки не выдают ничего нового. Назначения нигде
     не перечислены, поэтому их подгруппы остаются родовыми: что именно
     назначить, врач по-прежнему пишет сам. */
  var CATS = [
    { id: 'ask',     label: 'Спросить',  ph: 'Задайте вопрос своими словами' },
    { id: 'measure', label: 'Измерить',  ph: 'Какой показатель измерить?',
      sub: [
        { label: 'Температура', run: 'измерить температуру' },
        { label: 'Пульс',       run: 'измерить пульс' },
        { label: 'ЧДД',         run: 'посчитать чдд' },
        { label: 'АД',          run: 'измерить давление' },
        { label: 'SpO₂',        run: 'измерить сатурацию' },
        { label: 'Рост и вес',  run: 'взвесить пациента' }
      ] },
    { id: 'exam', label: 'Осмотреть', ph: 'Например: послушать лёгкие, посмотреть горло, проверить отёки',
      sub: [
        { label: 'Лёгкие', run: 'выслушать лёгкие' },
        { label: 'Сердце', run: 'выслушать сердце' },
        { label: 'Горло', run: 'осмотреть горло' },
        { label: 'Живот', run: 'пальпировать живот' },
        { label: 'Лимфоузлы', run: 'проверить лимфоузлы' },
        { label: 'Отёки', run: 'проверить отёки ног' },
        { label: 'Кожа', run: 'осмотреть кожу' }
      ] },
    { id: 'order',   label: 'Назначить', ph: 'Какое исследование назначить?',
      sub: [
        { label: 'Анализы',           ph: 'Какой анализ назначить? Напишите название' },
        { label: 'Инструментальные',  ph: 'Какое инструментальное исследование назначить?' }
      ] },
    { id: 'treat',   label: 'Лечение',   ph: 'Что назначить из лечения?' },
    { id: 'dx',      label: 'Диагноз',   ph: 'Ваш диагноз?' }
  ];
  var CAT_NAME = { ask: 'Расспрос', measure: 'Измерение', exam: 'Осмотр',
                   order: 'Обследование', treat: 'Лечение', dx: 'Диагноз' };

  var FREE_PH = 'Что вы делаете? Напишите своими словами…';

  var state, voice, lung, rafId, clockId;
  var INTENTS = [], BYID = {};

  /* =========================================================
     Каталог намерений собирается из данных случая
     ========================================================= */

  function buildCatalog() {
    INTENTS = [];
    BYID = {};

    function add(item, kind) {
      var rec = {
        id: item.id, cat: item.cat, w: item.w || 0,
        need: item.need, no: item.no
      };
      INTENTS.push(rec);
      item.__kind = kind;
      BYID[item.id] = item;
    }

    CASE.passport.forEach(function (p) { add(p, 'passport'); });
    CASE.questions.forEach(function (q) { add(q, 'question'); });
    CASE.vitals.forEach(function (v) { add(v, 'vital'); });
    CASE.exams.forEach(function (e) { add(e, 'exam'); });
    CASE.orders.forEach(function (o) { add(o, 'order'); });
    CASE.treatment.forEach(function (t) { add(t, 'treat'); });
    CASE.diagnosis.options.forEach(function (d) { add(d, 'dx'); });
  }

  function labelOf(id) { return BYID[id] ? BYID[id].label : id; }

  /* =========================================================
     Инициализация
     ========================================================= */

  function init() {
    if (patientSounds) patientSounds.reset();
    if (window.PatientSpeech) PatientSpeech.cancel();
    if (aiChat) aiChat.reset();
    pendingAi = null;
    aiUsed = false;
    $('aiPanel').hidden = false;
    $('aiStatus').textContent = '';
    buildCatalog();
    document.body.classList.toggle('independent-mode', independent);
    $('passportCounter').hidden = independent;
    $('vitalsCounter').hidden = independent;
    $('modeBadge').textContent = LearningMode.label(MODE);
    $('modeDescription').textContent = independent
      ? 'Без цветовых оценок и учебных пояснений. Все объяснения — после завершения.'
      : 'Находки выделяются цветом, назначения сопровождаются пояснениями.';

    state = {
      mode: MODE,
      clinicalNotes: '',
      log: [],            // все строки протокола, включая непонятые
      done: {},           // id намерения -> true
      heard: {},          // точки аускультации: id -> finding
      currentPoint: null,
      cat: null,          // активная кнопка категории
      dx: null,
      finished: false,
      unknowns: [],
      clarifies: 0,
      t0: Date.now()
    };

    if (!voice) {
      voice = new Audio();
      lung = new Audio();
      lung.loop = false;
      voice.addEventListener('ended', onVoiceEnded);
      voice.addEventListener('error', function () { hideSpeaking(); $('voiceStatus').textContent = 'Аудио недоступно. Реплика остаётся в тексте.'; });
      lung.addEventListener('play', startScope);
      lung.addEventListener('pause', stopScope);
      lung.addEventListener('ended', stopScope);
      lung.addEventListener('timeupdate', function () { if (!rafId) drawScope(); });
      if (window.PatientSounds) patientSounds = PatientSounds.create({caseId:CASE.id,gender:CASE.patient.gender,canPlay:function(){return !state.finished && !aiBusy && !document.hidden && (!speechInput || !speechInput.isListening()) && voice.paused && lung.paused;}});
      bind();
    }

    renderChip();
    $('vol').value = 80;
    lung.volume = 0.8;

    var idle = $('videoIdle'), throat = $('videoThroat');
    var portrait = $('patientPortrait');
    portrait.hidden = !CASE.patient.portrait;
    portrait.alt = female ? 'Иллюстрация вымышленной пациентки' : 'Иллюстрация вымышленного пациента';
    document.querySelector('.speaking-label').textContent = female ? 'пациентка говорит' : 'пациент говорит';
    document.querySelector('.col-patient').setAttribute('aria-label', person);
    idle.hidden = !CASE.patient.idleVideo;
    throat.hidden = true;
    $('portraitCaption').hidden = !CASE.patient.portrait;
    $('portraitCaption').textContent = person + (CASE.patient.idleVideo ? ' · ИИ-анимация' : ' · ИИ-иллюстрация');
    $('portraitMotion').hidden = !CASE.patient.portrait && !CASE.patient.idleVideo;
    $('portraitMotion').setAttribute('aria-pressed', String(!!CASE.patient.idleVideo && motionEnabled));
    $('portraitMotion').textContent = CASE.patient.idleVideo && motionEnabled ? 'Остановить движение' : 'Включить движение';
    if (CASE.patient.portrait) portrait.src = CASE.patient.portrait;
    if (CASE.patient.idleVideo) {
      idle.src = CASE.patient.idleVideo;
      idle.poster = CASE.patient.portrait || '';
    }
    idle.onerror = function () {
      idle.hidden = true;
      if (CASE.patient.portrait) portrait.hidden = false;
    };
    throat.onended = function () { switchVideo('idle'); };
    throat.onerror = function () { switchVideo('idle'); };
    switchVideo('idle');

    renderCats();
    renderPassport();
    renderVitals();
    resetNotes();
    $('clinicalNotes').value = '';
    resetLog();
    renderChest();
    renderCoverage();

    $('auscPanel').hidden = true;
    $('sheet').hidden = true;
    $('exportBox').hidden = true;
    $('exportName').value = '';
    $('exportGroup').value = '';
    $('exportCode').value = '';
    setExportHint('');
    $('clarify').hidden = true;
    $('actInput').value = '';
    setCat(null);

    if (clockId) clearInterval(clockId);
    clockId = setInterval(tickClock, 1000);
    tickClock();

    /* Пациент вошёл и здоровается — единственное, что происходит само.
       Дальше не произойдёт ничего, пока врач не напишет. */
    logRow({
      kind: 'patient', cat: null,
      act: person + (female ? ' вошла в кабинет' : ' вошёл в кабинет'),
      res: CASE.patient.greeting.text,
      resCls: ''
    });
    say(CASE.patient.greeting.audio, CASE.patient.greeting.text);

    applyUrlOverrides();
  }

  function applyUrlOverrides() {
    var q = window.location.search;
    if (/[?&]demo=1/.test(q)) runDemo();
    var m = /[?&]dx=([a-z-]+)/.exec(q);
    if (m) {
      var opt = pick(CASE.diagnosis.options, m[1]);
      if (opt) perform(opt.id, { silent: true });
    }
    if (/[?&]finish=1/.test(q)) finish(true);
  }

  function sendToPatient(raw, fallback) {
    if (aiBusy) { $('aiStatus').textContent = 'Дождитесь ответа или отмените ожидание.'; return; }
    if (raw.length > 1000) { $('aiStatus').textContent = 'Сократите вопрос до 1000 символов.'; return; }
    pendingAi = { raw: raw, fallback: fallback };
    voice.pause(); hideSpeaking();
    $('aiStatus').textContent = 'Готовится ответ…';
    aiChat.send(raw);
  }

  function bind() {
    if (patientSounds) {
      $('patientSoundsControl').hidden = !patientSounds.available;
      $('patientSoundsToggle').checked = patientSounds.enabled();
      $('patientSoundsToggle').addEventListener('change',function(){patientSounds.setEnabled(this.checked);});
      document.addEventListener('visibilitychange',function(){if(document.hidden)patientSounds.stop();});
      window.addEventListener('pagehide',function(){patientSounds.stop();});
      window.addEventListener('languagechange',function(){patientSounds.stop();});
    }
    // Remove the former shared test password; it is no longer used.
    try { localStorage.removeItem('vp.patient-chat.access.sawcjxnblgepkqdsvlio.v1'); } catch (e) {}
    var aiApi = window.Sync && typeof window.Sync.publicApi === 'function' ? window.Sync.publicApi() : null;
    aiChat = PatientChat.create({
      baseUrl: aiApi ? aiApi.url : '',
      anonKey: aiApi ? aiApi.anonKey : '',
      caseId: CASE.id,
      language: function () { return window.I18n ? I18n.language() : 'ru'; },
      busy: function (on) { aiBusy = on; $('aiCancel').hidden = !on; },
      reply: function (question, answer, audio) {
        pendingAi = null; aiUsed = true;
        if ($('actInput').value.trim() === question) $('actInput').value = '';
        $('aiStatus').textContent = 'Ответ получен.';
        logRow({kind:'patient',cat:'ask',act:question,res:answer,resCls:''});
        if (window.PassportQuestions) PassportQuestions.ids(question,answer,CASE.passport).forEach(function(id){
          if (BYID[id] && BYID[id].__kind === 'passport' && !state.done[id]) perform(id,{silent:true,raw:question});
        });
        say(audio || null, answer, null, true);
      },
      error: function (code) {
        var messages = {
          guest_disabled: 'Гостевой вход ещё не включён на сервере.',
          guest_signin_failed: 'Не удалось открыть гостевую сессию.',
          guest_signup_rate_limit: 'Слишком много новых подключений. Попробуйте позже.',
          guest_expired: 'Сессия завершилась. Повторите вопрос для нового подключения.',
          guest_rate_limit: 'Вопросы отправляются слишком часто. Подождите минуту.',
          guest_daily_limit: 'Достигнут дневной лимит демонстрации: 30 запросов. Войдите в подтверждённый аккаунт для 200 запросов в день.',
          member_daily_limit: 'Достигнут дневной лимит аккаунта: 200 запросов. Он обновится в 05:00 по времени Алматы.',
          global_daily_limit: 'Общий лимит ответов на сегодня исчерпан.',
          total_limit: 'Лимит тестирования исчерпан. Нужна настройка преподавателем.',
          chat_disabled: 'Свободный диалог временно отключён преподавателем.',
          quota_unavailable: 'Серверные лимиты ещё не настроены.',
          invalid_access_code: 'На сервере ещё старая версия функции. Требуется обновление для гостевого входа.',
          provider_timeout: 'Ответ не пришёл вовремя.',
          connection_failed: 'Нет связи с сервером.',
          unsupported_case: 'Свободный диалог для этого случая пока не настроен.'
        };
        var pending = pendingAi; pendingAi = null;
        var text = messages[code] || 'Свободный диалог временно недоступен (' + code + ').';
        if (pending && pending.fallback) {
          text += ' Показан сценарный ответ.';
          aiChat.record(pending.raw, BYID[pending.fallback].text || '');
          perform(pending.fallback, {raw:pending.raw});
        } else text += ' Вопрос сохранён в поле ввода. Можно повторить позже или уточнить нужное действие.';
        $('aiStatus').textContent = text;
      }
    });
    $('aiCancel').addEventListener('click', function () { aiChat.cancel(); pendingAi = null; $('aiStatus').textContent = 'Ожидание отменено.'; });
    window.addEventListener('languagechange', function () { speechInput.cancel(); if (aiChat) aiChat.cancel(); pendingAi=null; $('aiStatus').textContent=''; $('voiceStatus').textContent=''; voice.pause(); if (window.PatientSpeech) PatientSpeech.cancel(); hideSpeaking(); });
    window.addEventListener('pagehide', function () { aiChat.reset(); pendingAi = null; });
    var Engine = window.SpeechRecognition || window.webkitSpeechRecognition;
    $('talkBtn').disabled = !Engine;
    if (!Engine) $('talkStatus').textContent = 'В этом браузере голосовой ввод недоступен. Используйте текстовый ввод или браузер с поддержкой распознавания речи.';
    speechInput = VoiceInput.create({
      language: function () { return window.I18n ? I18n.locale() : 'ru-RU'; }, Engine: Engine,
      beforeStart: function () { voice.pause(); lung.pause(); hideSpeaking(); setCat('ask'); },
      listening: function (on) { $('talkBtn').setAttribute('aria-pressed', String(on)); $('talkBtn').textContent = on ? 'Закончить вопрос' : 'Задать вопрос голосом'; $('cancelTalk').hidden = !on; },
      status: function (text) { $('talkStatus').textContent = text; },
      text: function (text) { $('actInput').value = text; },
      result: function (text) {
        if (state.finished) return;
        if ($('voiceAutoSend').checked) { $('talkStatus').textContent = 'Вопрос отправлен: «' + text + '»'; setCat('ask'); submit(text); }
        else { $('talkStatus').textContent = 'Проверьте вопрос и нажмите «Выполнить».'; $('actInput').focus(); }
      }
    });
    $('talkBtn').addEventListener('click', function () {
      if (patientSounds) patientSounds.stop();
      if (state.finished) { $('talkStatus').textContent = 'Приём завершён. Начните заново для разговора.'; return; }
      if (speechInput.isListening()) speechInput.stop(); else speechInput.start();
    });
    $('cancelTalk').addEventListener('click', function () { speechInput.cancel(); $('actInput').value = ''; $('talkStatus').textContent = 'Запись отменена. Вопрос не отправлен.'; });
    window.addEventListener('languagechange', function () { speechInput.cancel(); if (aiChat) aiChat.cancel(); pendingAi=null; $('aiStatus').textContent=''; $('voiceStatus').textContent=''; voice.pause(); if (window.PatientSpeech) PatientSpeech.cancel(); hideSpeaking(); });
    window.addEventListener('pagehide', function () { speechInput.cancel(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) speechInput.cancel(); });
    $('clinicalNotes').addEventListener('input', function () { state.clinicalNotes = this.value; });
    $('repeatVoice').addEventListener('click', function () {
      if (voice._text) say(voice._source, voice._text);
    });
    $('portraitMotion').addEventListener('click', function () {
      var on = this.getAttribute('aria-pressed') !== 'true';
      this.setAttribute('aria-pressed', String(on));
      this.textContent = on ? 'Остановить движение' : 'Включить движение';
      motionEnabled = on;
      if (CASE.patient.idleVideo) switchVideo('idle');
      else $('patientPortrait').classList.toggle('has-motion', on);
    });
    $('actForm').addEventListener('submit', function (e) {
      e.preventDefault();
      submit($('actInput').value);
    });
    $('actInput').addEventListener('input', function () {
      if (speechInput) speechInput.cancel();
      $('clarify').hidden = true;
    });
    $('restartBtn').addEventListener('click', restart);
    $('againBtn').addEventListener('click', restart);
    $('finishBtn').addEventListener('click', function () { finish(false); });
    $('closeSheet').addEventListener('click', function () { $('sheet').hidden = true; });
    $('exportBtn').addEventListener('click', openExport);
    $('exportClose').addEventListener('click', function () { $('exportBox').hidden = true; });
    /* Миниатюры снимков в протоколе — делегированный клик: строки
       добавляются динамически, своя привязка у каждой была бы лишней. */
    $('log').addEventListener('click', function (e) {
      var n = e.target;
      while (n && n !== this && !(n.classList && n.classList.contains('log-imgwrap'))) {
        n = n.parentNode;
      }
      if (n && n !== this) openImgView(n.getAttribute('data-img'));
    });
    var iv = $('imgView');
    if (iv) iv.addEventListener('click', closeImgView);
    $('exportName').addEventListener('input', refreshExport);
    $('exportGroup').addEventListener('input', refreshExport);
    $('exportCopy').addEventListener('click', copyExport);
    $('exportFile').addEventListener('click', downloadExport);
    $('stethoToggle').addEventListener('click', toggleLung);
    $('vol').addEventListener('input', function () { lung.volume = this.value / 100; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
      b.addEventListener('click', function () { $(b.dataset.close).hidden = true; });
    });
    window.addEventListener('resize', function () { drawScope(); });
  }

  function restart() {
    stopAll();
    init();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function stopAll() {
    if (patientSounds) patientSounds.stop();
    if (aiChat) aiChat.cancel();
    if (speechInput) speechInput.cancel();
    hideSpeaking();
    if (voice) { voice.pause(); voice.src = ''; }
    if (lung) { lung.pause(); lung.src = ''; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function tickClock() {
    $('clock').textContent = Score.mmss((Date.now() - state.t0) / 1000);
  }

  /* =========================================================
     Консоль действий
     ========================================================= */

  function renderCats() {
    var box = $('cats');
    box.innerHTML = '';
    CATS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cat-btn';
      b.dataset.cat = c.id;
      b.textContent = c.label;
      b.addEventListener('click', function () {
        setCat(state.cat === c.id ? null : c.id);
        $('actInput').focus();
      });
      box.appendChild(b);
    });
  }

  function setCat(id) {
    state.cat = id;
    var c = null, i;
    for (i = 0; i < CATS.length; i++) if (CATS[i].id === id) c = CATS[i];
    $('actInput').placeholder = c ? c.ph : FREE_PH;
    Array.prototype.forEach.call(document.querySelectorAll('.cat-btn'), function (b) {
      b.classList.toggle('is-on', b.dataset.cat === id);
    });
    renderSubcats(c);
  }

  function renderSubcats(c) {
    var box = $('subcats');
    box.innerHTML = '';
    box.hidden = !c || !c.sub;
    if (box.hidden) return;
    c.sub.forEach(function (sc) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'subcat-btn';
      b.textContent = sc.label;
      b.addEventListener('click', function () {
        if (sc.run) { submit(sc.run); }
        else {
          $('actInput').placeholder = sc.ph;
          Array.prototype.forEach.call(box.children, function (x) {
            x.classList.toggle('is-on', x === b);
          });
        }
        $('actInput').focus();
      });
      box.appendChild(b);
    });
  }

  function submit(raw) {
    if (patientSounds) patientSounds.stop();
    if (speechInput) speechInput.cancel();
    if (state.finished) return;
    raw = String(raw || '').replace(/^\s+|\s+$/g, '');
    if (!raw) return;
    if (aiBusy) { $('aiStatus').textContent = 'Дождитесь ответа или отмените ожидание.'; return; }
    $('clarify').hidden = true;

    // An invitation to listen does not specify heart vs lungs.
    var invitationRaw = window.EnglishNLU ? EnglishNLU.canonical(raw) : raw;
    var invitation = (window.KazakhNLU ? KazakhNLU.canonical(invitationRaw) : invitationRaw).toLowerCase().replace(/ё/g, 'е').replace(/[.,!?]/g, '').trim();
    if ((!state.cat || state.cat === 'exam') && /^(давайте |можно |я )?(вас )?(послушаем|послушаю|послушать)( вас)?$/.test(invitation)) {
      var choices = CASE.exams.filter(function (e) { return e.id === 'e.heart' || e.id === 'e.lungs' || e.id === 'e.ausc'; });
      askClarify(raw, choices.map(function (e) { return { id: e.id, cat: 'exam', label: e.label }; }));
      return;
    }
    var demonstration=window.CustomCases&&CustomCases.demonstrationMediaFor(CASE,raw);
    if(demonstration){$('actInput').value='';logRow({kind:'exam',cat:'exam',act:raw,res:'Пациент показывает область жалобы.',media:demonstration});return;}
    var r = NLU.match(raw, INTENTS, { cat: state.cat, label: labelOf });

    if(CASE.custom&&!r.ok&&window.CustomCases&&CustomCases.complaintMediaFor(CASE,raw)){
      $('actInput').value='';var response=CASE.patient.reason||CASE.patient.greeting.text;logRow({kind:'patient',cat:'ask',act:raw,res:response});say(null,response,null,true);return;
    }
    if (r.ok && BYID[r.id] && BYID[r.id].cat === 'ask' && !CASE.custom) {
      sendToPatient(raw, r.id); return;
    }
    if (r.ok) {
      $('actInput').value = '';
      perform(r.id, { raw: raw, corrected: r.corrected });
      return;
    }

    if (r.kind === 'clarify') {
      if (!CASE.custom && r.options.length && r.options.every(function (o) { return o.cat === 'ask'; })) {
        sendToPatient(raw, null); return;
      }
      askClarify(raw, r.options);
      return;
    }

    if (r.kind === 'refused') {
      logRow({
        kind: 'refused', cat: null,
        act: '«' + raw + '»',
        res: 'Отказ от действия зафиксирован. Ничего не выполнено.',
        resCls: ''
      });
      return;
    }

    // Unknown wording is sent to the patient, never auto-executed as an exam.
    sendToPatient(raw, null);
  }

  function askClarify(raw, options) {
    var box = $('clarify');
    box.innerHTML = '';
    var head = document.createElement('div');
    head.className = 'clarify-head';
    head.textContent = '«' + raw + '» можно понять по-разному. Что именно вы делаете?';
    box.appendChild(head);

    options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'clarify-btn';
      b.innerHTML = '<span class="clarify-cat">' + esc(CAT_NAME[o.cat] || o.cat) + '</span>' +
                    '<span>' + esc(o.label) + '</span>';
      b.addEventListener('click', function () {
        box.hidden = true;
        if (BYID[o.id] && BYID[o.id].cat === 'ask' && !CASE.custom) sendToPatient(raw, o.id);
        else perform(o.id, { raw: raw });
      });
      box.appendChild(b);
    });

    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'clarify-btn is-none';
    no.textContent = 'Ни то, ни другое';
    no.addEventListener('click', function () {
      box.hidden = true;
      sendToPatient(raw, null);
    });
    box.appendChild(no);

    state.clarifies++;
    box.hidden = false;
  }

  /* =========================================================
     Исполнение действия
     ========================================================= */

  function perform(id, opts) {
    if (patientSounds) patientSounds.stop();
    opts = opts || {};
    var item = BYID[id];
    if (!item) return;

    var repeat = !!state.done[id];
    var kind = item.__kind;
    var actionLabel = independent && opts.raw ? opts.raw : item.label;

    if (repeat && kind !== 'exam') {
      /* Повтор ничего не добавляет к оценке, но пациент отвечает снова. */
      logRow({ kind: kind, cat: item.cat, id: null, act: actionLabel,
               res: item.text || 'Уже выполнено ранее — повторно.', raw:opts.raw, silent:!!opts.silent, media: item.media, resCls: '', repeat: true });
      if (!opts.silent && item.text) say(item.audio, item.text, null, kind === 'question' || kind === 'passport');
      return;
    }

    state.done[id] = true;
    var row = { kind: kind, cat: item.cat, id: id, act: actionLabel, raw: opts.raw, silent: !!opts.silent,
                corrected: independent ? null : opts.corrected || null };

    if (kind === 'passport') {
      row.res = item.text;
      row.resCls = item.important ? 'is-key' : '';
      renderPassport();
      addNote(item.field + ': ' + item.value, item.important ? 'abn' : '');
      if (!opts.silent) say(item.audio, item.text, null, kind === 'question' || kind === 'passport');

    } else if (kind === 'question') {
      if (item.media && window.CustomCases) row.media = CustomCases.normalizeMedia(item.media);
      row.res = item.text;
      row.resCls = item.important ? 'is-key' : '';
      addNote(independent ? item.text : item.tag, item.important ? 'abn' : '');
      if (!opts.silent) say(item.audio, item.text, null, kind === 'question' || kind === 'passport');

    } else if (kind === 'vital') {
      row.res = item.field + ' — ' + item.value + ' ' + (item.unit || '') +
                '. Техника: ' + item.tech;
      row.resCls = item.abnormal ? 'is-abn' : 'is-ok';
      renderVitals();
      addNote(independent ? item.field + ': ' + item.value + ' ' + (item.unit || '') : item.note, item.abnormal ? 'abn' : 'ok');

    } else if (kind === 'exam') {
      performExam(item, row, opts);

    } else if (kind === 'order') {
      row.res = item.result;
      row.hint = item.hint;
      row.resCls = item.role === 'waste' ? 'is-warn' : 'is-ok';
      if (item.img) row.img = item.img;
      addNote(item.label + ': ' + item.result, item.role === 'waste' ? 'abn' : 'ok');

    } else if (kind === 'treat') {
      row.res = item.hint;
      row.resCls = item.role === 'harm' ? 'is-abn' : 'is-ok';
      if (item.img) row.img = item.img;
      addNote('Назначено: ' + actionLabel, item.role === 'harm' ? 'abn' : 'ok');

    } else if (kind === 'dx') {
      state.dx = id;
      state.done['__dx'] = true;
      row.id = '__dx';
      row.dxId = id;
      row.act = 'Диагноз: ' + item.label;
      row.res = 'Диагноз зафиксирован. Приём можно продолжать — назначения ещё не сделаны.';
      row.resCls = '';
      addNote('Выставлен диагноз: ' + item.label, 'abn');
    }

    logRow(row);
    if (kind === 'treat' && item.patientReply) {
      var reply = item.patientReply;
      logRow({ kind: 'patient', cat: null, act: person + ' отвечает на план', res: reply.text, resCls: '' });
      if (!opts.silent) say(reply.audio, reply.text);
    }
    renderChip();
    updateCounters();
  }

  function performExam(item, row, opts) {
    if (item.media && window.CustomCases) row.media = CustomCases.normalizeMedia(item.media);
    if (item.kind === 'auscult') {
      $('auscPanel').hidden = false;
      row.res = independent ? 'Аускультация начата. Выберите точку и опишите услышанное.' : item.note;
      row.resCls = '';
      requestAnimationFrame(drawScope);
      $('auscPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    if (item.kind === 'throat' && !row.media) {
      switchVideo('throat');
      $('videoBadge').textContent = CASE.patient.throatVideo ? 'Осмотр зева' : 'Осмотр зева · текстовый результат';
      var v = $('videoThroat');
      v.currentTime = 0;
      if (CASE.patient.throatVideo) v.play().catch(function () {});
      /* У кастомного случая служебной реплики может не быть — тогда
         осмотр показывает только видео и строку протокола. */
      var sys = CASE.system && CASE.system[item.voice];
      if (!opts.silent && sys) say(sys.audio, sys.text);
      row.res = item.result;
      row.resCls = 'is-abn';
      addNote(independent ? item.result : item.title, 'abn');
      return;
    }

    row.res = item.result;
    row.resCls = item.findAbnormal ? 'is-abn' : 'is-ok';
    if (item.img) row.img = item.img;
    addNote(independent ? item.result : (item.title || item.label), item.findAbnormal ? 'abn' : 'ok');

    if (item.voice && CASE.system && CASE.system[item.voice] && !opts.silent) {
      say(CASE.system[item.voice].audio, CASE.system[item.voice].text);
    }

    if (item.id === 'e.cough' && CASE.patient.coughVideo && !opts.silent) switchVideo('cough');

    /* Проба с кашлем меняет трактовку уже услышанного. */
    if (item.id === 'e.cough' && state.currentPoint && CASE.auscultation) {
      var f = (CASE.auscultation.findings || {})[state.currentPoint.finding] || {};
      if (f.abnormal && !independent) {
        /* Заголовок правится вместе с текстом: иначе панель показывала бы
           «Точка не выбрана» над описанием пробы с кашлем. */
        $('readoutTitle').textContent = state.currentPoint.label + ' — проба с кашлем';
        $('readoutDesc').textContent = item.result || f.desc || '';
      }
    }
  }

  /* =========================================================
     Протокол
     ========================================================= */

  function resetLog() {
    $('log').innerHTML =
      '<li class="log-empty">' + person + (female ? ' вошла' : ' вошёл') + ' и ждёт. Ничего не произойдёт, пока вы не начнёте.</li>';
    updateCounters();
  }

  function logRow(row) {
    if(!row.media&&(row.cat==='ask'||row.cat==='exam')&&window.CustomCases)row.media=CustomCases.complaintMediaFor(CASE,row.raw||row.act);
    row = LearningMode.row(row, BYID[row.id], MODE);
    var ul = $('log');
    var empty = ul.querySelector('.log-empty');
    if (empty) empty.remove();

    row.ts = (Date.now() - state.t0) / 1000;
    state.log.push(row);

    var n = 0, i;
    for (i = 0; i < state.log.length; i++) if (state.log[i].id) n++;

    var li = document.createElement('li');
    li.className = 'log-row' + (row.cat ? ' is-' + row.cat : '') +
                   (row.kind === 'unknown' ? ' is-unknown' : '') +
                   (row.repeat ? ' is-repeat' : '');

    var h = '<div class="log-meta">' +
      '<span class="log-n">' + (row.id ? n : '·') + '</span>' +
      '<span class="log-time">' + Score.mmss(row.ts) + '</span>' +
      '<span class="log-cat">' + esc(row.cat ? CAT_NAME[row.cat] : catNameOf(row.kind)) + '</span>' +
      '</div><div class="log-body">' +
      '<div class="log-act">' + esc(row.act) + '</div>';

    if (row.corrected) {
      h += '<div class="log-fix">понято как «' + esc(row.corrected) + '»</div>';
    }
    if (row.res) {
      h += '<div class="log-res ' + (row.resCls || '') + '">' + esc(row.res) + '</div>';
    }
    if (row.hint) {
      h += '<div class="log-hint">' + esc(row.hint) + '</div>';
    }
    /* Снимок/заключение картинкой (кастомные случаи): миниатюра в протоколе,
       клик открывает просмотр на весь экран. */
    if (row.media && window.CustomCases) h += CustomCases.mediaHtml(row.media);
    if (row.img && !row.media) {
      h += '<button type="button" class="log-imgwrap" data-img="' + esc(row.img) + '">' +
        '<img class="log-img" src="' + esc(row.img) + '" alt="Результат исследования">' +
        '</button>';
    }
    h += '</div>';

    li.innerHTML = h;
    ul.appendChild(li);
    if(row.media&&row.media.video&&!row.silent&&window.CustomCases)CustomCases.openScene(row.media);
    ul.scrollTop = ul.scrollHeight;
    updateCounters();
  }

  function catNameOf(kind) {
    return kind === 'patient' ? person :
           kind === 'unknown' ? 'Не понято' :
           kind === 'refused' ? 'Отказ' : '—';
  }

  /* Просмотр снимка из протокола поверх всего (оверлей #imgView).
     Разметка живёт в priem.html; без неё функции молча отключаются. */
  function openImgView(src) {
    var b = $('imgView');
    if (!b || !src) return;
    $('imgViewImg').src = src;
    b.hidden = false;
  }

  function closeImgView() {
    var b = $('imgView');
    if (!b) return;
    b.hidden = true;
    $('imgViewImg').src = '';
  }

  function updateCounters() {
    var n = 0, i;
    for (i = 0; i < state.log.length; i++) if (state.log[i].id) n++;
    $('stepCount').textContent = n;

    var pTot = 0, pGot = 0;
    CASE.passport.forEach(function (p) { pTot++; if (state.done[p.id]) pGot++; });
    $('passportCounter').textContent = pGot + ' / ' + pTot;

    var vTot = 0, vGot = 0;
    CASE.vitals.forEach(function (v) { vTot++; if (state.done[v.id]) vGot++; });
    $('vitalsCounter').textContent = vGot + ' / ' + vTot;
  }

  /* =========================================================
     Левая колонка: паспорт, показатели, карта осмотра
     ========================================================= */

  /* Чип в топбаре не смеет знать больше врача: пол, возраст и характер
     жалобы появляются в нём только после соответствующего вопроса.
     Иначе «М., 34 г. · длительный кашель» выдало бы ловушку случая —
     пациент вслух называет свой кашель небольшим. */
  function renderChip() {
    var who = state.done['p.name'] ? BYID['p.name'].value
            : state.done['p.age'] ? person + ', ' + BYID['p.age'].value
            : person;
    if (state.done['p.name'] && state.done['p.age']) {
      who += ', ' + BYID['p.age'].value;
    }
    /* Формулировку жалобы задаёт файл персонажа: patient.chip — список
       {done, text}, побеждает первое условие, которое уже выполнено. */
    var why = 'Жалоба не уточнена';
    var states = CASE.patient.chip || [];
    for (var i = 0; i < states.length; i++) {
      if (state.done[states[i].done]) { why = states[i].text; break; }
    }
    $('patientChip').textContent = independent ? who : who + ' · ' + why;
  }

  function renderPassport() {
    var box = $('passport');
    box.innerHTML = '';
    CASE.passport.forEach(function (p) {
      var got = !!state.done[p.id];
      var dt = document.createElement('dt');
      dt.textContent = p.field;
      var dd = document.createElement('dd');
      dd.className = got ? 'is-got' : 'is-empty';
      dd.textContent = got ? p.value : 'не спрошено';
      box.appendChild(dt);
      box.appendChild(dd);
    });
  }

  function renderVitals() {
    var box = $('vitals');
    box.innerHTML = '';
    CASE.vitals.forEach(function (v) {
      var got = !!state.done[v.id];
      var d = document.createElement('div');
      d.className = 'vital' + (got ? (!independent && v.flag && v.flag !== 'ok' ? ' is-' + v.flag : '') : ' is-empty') +
        (got && String(v.value).length > 4 ? ' is-wide' : '');
      d.innerHTML = '<div class="vital-label">' + esc(v.field) + '</div>' +
        '<div class="vital-value">' + (got ? esc(v.value) : '—') +
        '<span class="vital-unit">' + (got ? esc(v.unit || '') : 'не измерено') + '</span></div>';
      box.appendChild(d);
    });
  }

  function resetNotes() {
    $('notes').innerHTML = '<li class="notes-empty">Пусто. Ни один факт не получен.</li>';
    $('notesCounter').textContent = '0';
  }

  function addNote(text, kind) {
    if (independent) kind = '';
    if (!text) return;
    var ul = $('notes');
    var empty = ul.querySelector('.notes-empty');
    if (empty) empty.remove();

    var li = document.createElement('li');
    li.innerHTML = '<span class="note-mark' +
      (kind === 'abn' ? ' is-abn' : kind === 'ok' ? ' is-ok' : '') + '"></span>' +
      '<span>' + esc(text) + '</span>';
    ul.appendChild(li);
    ul.scrollTop = ul.scrollHeight;
    $('notesCounter').textContent = ul.children.length;
  }

  /* =========================================================
     Речь пациента
     ========================================================= */

  function showSpeaking() { $('speakingIndicator').hidden = false; $('patientPortrait').classList.add('is-speaking'); }
  function hideSpeaking() { $('speakingIndicator').hidden = true; $('patientPortrait').classList.remove('is-speaking'); }

  function say(src, text, onEnd, ambient) {
    if (patientSounds) patientSounds.stop();
    voice._ambient = !!ambient;
    if (speechInput) speechInput.cancel();
    voice._text = text; voice._source = src;
    $('voiceStatus').textContent = '';
    lung.pause();
    voice.pause();

    if (window.PatientSpeech) PatientSpeech.cancel();
    text = window.I18n ? I18n.t(text) : text;
    src = window.I18n ? I18n.audio(src) : src;
    var sub = $('subtitle');
    sub.textContent = text;
    sub.hidden = false;

    voice._onEnd = onEnd || null;
    if (!src) {
      if (window.PatientSpeech) {
        showSpeaking();
        PatientSpeech.speak(text, CASE.patient.gender, onVoiceEnded, function (message) { $('voiceStatus').textContent = message; });
      } else { hideSpeaking(); if (onEnd) onEnd(); }

      return;
    }

    voice.src = src;
    voice.currentTime = 0;
    showSpeaking();
    voice.play().catch(function () {
      $('voiceStatus').textContent = 'Нажмите «Повторить реплику», чтобы включить звук.';
      onVoiceEnded();
    });
  }

  function onVoiceEnded() {
    hideSpeaking();
    if (voice._ambient && patientSounds) patientSounds.afterReply();
    voice._ambient = false;
    if (voice._onEnd) { var f = voice._onEnd; voice._onEnd = null; f(); }
  }

  function switchVideo(which) {
    var idle = $('videoIdle'), action = $('videoThroat'), portrait = $('patientPortrait');
    var source = which === 'cough' ? CASE.patient.coughVideo : which === 'throat' ? CASE.patient.throatVideo : null;
    idle.pause(); action.pause();
    idle.classList.remove('is-active'); action.classList.remove('is-active');
    idle.hidden = true; action.hidden = true;
    if (source) {
      portrait.hidden = true;
      action.src = source;
      action.poster = CASE.patient.throatPoster || CASE.patient.portrait || '';
      action.hidden = false; action.classList.add('is-active');
      $('videoBadge').textContent = which === 'cough' ? 'Проба с кашлем' : 'Осмотр зева';
      action.play().catch(function () { switchVideo('idle'); });
    } else if (CASE.patient.idleVideo) {
      portrait.hidden = true;
      idle.hidden = false; idle.classList.add('is-active');
      $('videoBadge').textContent = 'Кабинет';
      if (motionEnabled) idle.play().catch(function () {});
    } else {
      portrait.hidden = !CASE.patient.portrait;
    }
  }

  /* =========================================================
     Аускультация
     ========================================================= */

  /* Кастомный случай может быть создан без аускультации — тогда схема
     остаётся пустой, а приёма e.ausc в каталоге просто нет. */
  function auscPoints() {
    return (CASE.auscultation && CASE.auscultation.points) || [];
  }

  function auscFinding(key) {
    return ((CASE.auscultation && CASE.auscultation.findings) || {})[key] || null;
  }

  function renderChest() {
    var g = $('chestPoints');
    g.innerHTML = '';
    var NS = 'http://www.w3.org/2000/svg';

    auscPoints().forEach(function (p) {
      var node = document.createElementNS(NS, 'g');
      node.setAttribute('class', 'pt');
      node.dataset.id = p.id;
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', p.label);

      ['pulse', 'ring', 'core', 'hit'].forEach(function (kind) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', p.x);
        c.setAttribute('cy', p.y);
        c.setAttribute('r', kind === 'core' ? 3.4 : kind === 'ring' ? 11 : kind === 'pulse' ? 11 : 18);
        c.setAttribute('class', 'pt-' + kind);
        node.appendChild(c);
      });

      node.addEventListener('click', function () { pickPoint(p); });
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickPoint(p); }
      });
      g.appendChild(node);
    });
  }

  /* Вынесено из pickPoint, потому что демо-прогон заполняет точки
     напрямую и тоже обязан оставить панель в согласованном виде. */
  /* Раскраска точек вынесена вместе с showReadout: демо-прогон тоже обязан
     оставить схему в согласованном виде, иначе после ?demo=1 все шесть полей
     выглядят непрослушанными. */
  function markPoints(cur) {
    Array.prototype.forEach.call(document.querySelectorAll('.pt'), function (n) {
      var id = n.dataset.id, f = state.heard[id];
      var fd = f && auscFinding(f);
      n.classList.toggle('is-current', !!cur && id === cur.id);
      n.classList.toggle('is-heard', !!f);
      n.classList.toggle('is-abn', !independent && !!(fd && fd.abnormal));
    });
  }

  function showReadout(p) {
    var f = auscFinding(p.finding);
    if (!f) return;
    var ro = document.querySelector('.stetho-readout');
    ro.classList.toggle('is-abn', !independent && f.abnormal);
    ro.classList.toggle('is-ok', !independent && !f.abnormal);
    var display = LearningMode.finding(p, f, MODE);
    $('readoutTitle').textContent = display.title;
    $('readoutDesc').textContent = display.text;
  }

  function pickPoint(p) {
    var f = auscFinding(p.finding);
    if (!f) return;
    var first = !state.heard[p.id];
    state.heard[p.id] = p.finding;
    state.currentPoint = p;

    markPoints(p);
    showReadout(p);

    $('stethoToggle').disabled = false;
    $('scopeIdle').hidden = true;

    if (first) {
      addNote(p.label + (independent ? ': прослушано' : ': ' + f.title), f.abnormal ? 'abn' : 'ok');
      renderCoverage();
      logRow({
        kind: 'exam', cat: 'exam', id: 'ausc:' + p.id,
        act: 'Выслушано: ' + p.label,
        res: independent ? 'Запись прослушана. Опишите находку самостоятельно.' : f.title + '. ' + f.desc,
        resCls: f.abnormal ? 'is-abn' : 'is-ok'
      });
    }

    voice.pause();
    hideSpeaking();
    lung.pause();
    lung.src = f.audio;
    lung.currentTime = 0;
    /* Ключ волновой формы задаёт находка (поле wf = имя файла в
       media/lungs/ без расширения); waveforms.js построен по той же
       библиотеке, поэтому ключи совпадают автоматически. */
    lung._wf = f.wf || p.finding;
    lung._abn = f.abnormal;
    if (patientSounds) patientSounds.stop();
    lung.play().then(setLungLabel).catch(setLungLabel);
  }

  function toggleLung() {
    if (patientSounds) patientSounds.stop();
    if (!state.currentPoint) return;
    if (lung.paused) lung.play().then(setLungLabel).catch(setLungLabel);
    else { lung.pause(); setLungLabel(); }
  }

  function setLungLabel() {
    var playing = !lung.paused;
    $('stethoLabel').textContent = playing ? 'Пауза' : 'Слушать';
    $('stethoToggle').classList.toggle('is-playing', playing);
  }

  function renderCoverage() {
    var box = $('coverage');
    box.innerHTML = '';
    auscPoints().forEach(function (p) {
      var f = state.heard[p.id];
      var fd = f && auscFinding(f);
      var s = document.createElement('span');
      s.className = 'cov' + (f ? ' is-heard' : '') +
        (!independent && fd && fd.abnormal ? ' is-abn' : '');
      s.textContent = p.side + ' · ' + p.zone + (f ? '' : ' — не прослушано');
      box.appendChild(s);
    });
  }

  /* ---- Волновая форма ---- */

  function startScope() { setLungLabel(); if (!rafId) loopScope(); }
  function stopScope() { setLungLabel(); drawScope(); }
  function loopScope() {
    drawScope();
    rafId = lung.paused ? null : requestAnimationFrame(loopScope);
  }

  function drawScope() {
    var cv = $('scope');
    if (!cv || !cv.offsetWidth) return;

    var dpr = window.devicePixelRatio || 1;
    var w = cv.offsetWidth, h = cv.offsetHeight;
    if (cv.width !== Math.round(w * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }

    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // сетка
    ctx.strokeStyle = 'rgba(120,140,165,.1)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= 4; gx++) {
      var x = (w / 4) * gx;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

    var data = WF[lung._wf];
    if (!data || !data.peaks || !data.peaks.length) return;

    var peaks = data.peaks;
    var dur = lung.duration && isFinite(lung.duration) ? lung.duration : data.duration;
    var prog = dur ? Math.min(1, (lung.currentTime || 0) / dur) : 0;

    var abn = lung._abn;
    var played = independent ? '#8eafca' : abn ? '#e0664f' : '#4bb98a';
    var ahead = 'rgba(140,160,185,.26)';

    var bw = w / peaks.length;
    var barW = Math.max(1, bw * 0.62);
    var mid = h / 2;
    var maxH = h * 0.42;

    for (var i = 0; i < peaks.length; i++) {
      var px = i * bw;
      var ph = Math.max(1, peaks[i] * maxH);
      ctx.fillStyle = (i / peaks.length) <= prog ? played : ahead;
      ctx.fillRect(px + (bw - barW) / 2, mid - ph, barW, ph * 2);
    }

    // курсор воспроизведения
    if (!lung.paused || prog > 0) {
      var cx = prog * w;
      ctx.strokeStyle = independent ? '#8eafca' : abn ? 'rgba(224,102,79,.9)' : 'rgba(75,185,138,.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    }

    // подпись времени
    ctx.fillStyle = 'rgba(150,170,195,.65)';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText((lung.currentTime || 0).toFixed(1) + ' / ' + (dur || 0).toFixed(1) + ' c', 8, h - 8);
  }

  /* =========================================================
     Разбор
     ========================================================= */

  function finish(silent) {
    if (patientSounds) patientSounds.stop();
    if (aiChat) aiChat.cancel();
    if (speechInput) speechInput.cancel();
    if (!state.finished && !state.dx && !silent) {
      /* Диагноз — часть задания, но принудить к нему нельзя: врач вправе
         закончить приём и без него, и разбор это покажет. */
      var box = $('clarify');
      box.innerHTML = '<div class="clarify-head">Диагноз не сформулирован. Завершить приём без диагноза?</div>';
      var yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'clarify-btn';
      yes.textContent = 'Да, завершить и показать разбор';
      yes.addEventListener('click', function () { box.hidden = true; finish(true); });
      var no = document.createElement('button');
      no.type = 'button';
      no.className = 'clarify-btn is-none';
      no.textContent = 'Нет, продолжу приём';
      no.addEventListener('click', function () { box.hidden = true; });
      box.appendChild(yes);
      box.appendChild(no);
      box.hidden = false;
      return;
    }

    state.finished = true;
    stopAll();
    if (clockId) { clearInterval(clockId); clockId = null; }
    renderDebrief();
    $('sheet').hidden = false;
    $('sheet').scrollTop = 0;
  }

  function renderDebrief() {
    var t = Score.timeline(state.log);
    var s = Score.compute(CASE, state);
    var h = '';

    h += '<p class="block-note">Режим: ' + esc(LearningMode.label(MODE)) + '</p>';

    if (state.clinicalNotes) h += '<div class="block"><h3>Ваши наблюдения до разбора</h3><p class="student-notes">' + esc(state.clinicalNotes) + '</p></div>';
    /* --- Итог --- */
    h += '<div class="result-head">' +
      '<div class="result-total ' + Score.band(s.total) + '">' + s.total + ' %</div>' +
      '<div><h2>Разбор приёма</h2><p>' + esc(Score.grade(s.total)) + '</p></div></div>';

    h += '<div class="scores">' +
      tile('ask', Score.pct(s.ask), Score.band(s.ask * 100)) +
      tile('pass', Score.pct(s.pass), Score.band(s.pass * 100)) +
      tile('vit', Score.pct(s.vit), Score.band(s.vit * 100)) +
      tile('exam', Score.pct(s.exam), Score.band(s.exam * 100)) +
      tile('order', Score.pct(s.order), Score.band(s.order * 100)) +
      tile('treat', Score.pct(s.treat), Score.band(s.treat * 100)) +
      tile('dx', s.dx ? 'верно' : 'нет', s.dx ? 'is-good' : 'is-bad') +
      tile('algo', Score.pct(s.algo), Score.band(s.algo * 100),
           'вес 5 % · правил в игре ' + s.rules) +
      '</div>';

    /* --- Хронология --- */
    h += '<div class="block"><h3>Хронология приёма — ваш алгоритм</h3>';
    var acts = 0, i;
    h += '<ol class="timeline">';
    for (i = 0; i < state.log.length; i++) {
      var e = state.log[i];
      if (!e.id && e.kind !== 'unknown' && e.kind !== 'refused' && e.kind !== 'patient') continue;
      if (e.id) acts++;
      h += '<li class="tl' + (e.id ? '' : ' is-void') + '">' +
        '<span class="tl-time">' + Score.mmss(e.ts) + '</span>' +
        '<span class="tl-cat">' + esc(e.cat ? CAT_NAME[e.cat] : catNameOf(e.kind)) + '</span>' +
        '<span class="tl-act">' + esc(e.act) + '</span></li>';
    }
    h += '</ol><p class="block-note">Результативных действий: ' + acts +
      ' · длительность приёма ' + Score.mmss(state.log.length ? state.log[state.log.length - 1].ts : 0) +
      '</p></div>';

    /* --- Ошибки и пропуски --- */
    var errs = '';
    Score.missedGroups(CASE, state).forEach(function (g) {
      errs += errGroupHtml(g.title, g.items);
    });

    h += '<div class="block"><h3>Ошибки и пропуски</h3>' +
      (errs || '<p class="all-clear">Пропусков нет: собрано всё, что можно было собрать, ' +
               'и ничего лишнего не назначено.</p>') +
      '</div>';

    /* --- Алгоритм --- */
    var viol = Score.violations(CASE, t);
    h += '<div class="block"><h3>Замечания по алгоритму</h3>';
    if (!viol.length) {
      h += '<p class="all-clear">Последовательность действий выдержана правильно.</p>';
    } else {
      h += '<ul class="keylist is-bad">';
      viol.forEach(function (r) {
        h += '<li><b>' + esc(r.text) + '</b><span>' + esc(r.why) + '</span></li>';
      });
      h += '</ul>';
    }
    h += '</div>';

    /* --- Ключевые находки случая --- */
    /* У кастомного случая блоки разбора могут быть не заполнены —
       пустые не показываем вовсе. */
    var deb = CASE.debrief || {};
    if (deb.keyFindings && deb.keyFindings.length) {
      h += '<div class="block"><h3>Что было в этом случае</h3><ul class="keylist">';
      deb.keyFindings.forEach(function (k) { h += '<li>' + esc(k) + '</li>'; });
      h += '</ul></div>';
    }

    if (deb.trap) {
      h += '<div class="block is-trap"><h3>Ловушка случая</h3><p>' +
        esc(deb.trap) + '</p></div>';
    }

    if (independent) {
      h += '<div class="block"><h3>Пояснения к выполненным действиям</h3><ul class="keylist">';
      Object.keys(state.done).forEach(function (id) {
        var it = BYID[id];
        if (!it || it.__kind === 'dx') return;
        var explanation = it.hint || it.why || it.note;
        if (explanation) h += '<li><b>' + esc(it.label) + '</b><span>' + esc(explanation) + '</span></li>';
      });
      auscPoints().forEach(function (p) {
        if (!state.heard[p.id]) return;
        var f = auscFinding(p.finding);
        if (f) h += '<li><b>' + esc(p.label + ' — ' + f.title) + '</b><span>' + esc(f.desc) + '</span></li>';
      });
      h += '</ul></div>';
    }

    /* --- Разбор диагнозов --- */
    h += '<div class="block"><h3>Разбор вариантов диагноза</h3><div class="alts">';
    CASE.diagnosis.options.forEach(function (o) {
      var mine = state.dx === o.id;
      var right = o.id === CASE.diagnosis.correct;
      h += '<div class="alt' + (right ? ' is-right' : '') + (mine ? ' is-mine' : '') + '">' +
        '<div class="alt-head"><span class="alt-name">' + esc(o.label) +
        (mine ? ' <em>— ваш ответ</em>' : '') + '</span>' +
        '<span class="alt-verdict">' + esc(o.verdict) + '</span></div>' +
        '<div class="alt-why">' + esc(o.why) + '</div></div>';
    });
    h += '</div></div>';

    if (deb.nextSteps) {
      h += '<div class="block"><h3>Дальнейшая тактика</h3><p>' +
        esc(deb.nextSteps) + '</p></div>';
    }

    if (deb.practice && deb.practice.length) {
      h += '<div class="block"><h3>Перенос в практику · обсудите с преподавателем</h3><ul class="keylist">';
      deb.practice.forEach(function (p) { h += '<li>' + esc(p) + '</li>'; });
      h += '</ul><p class="block-note">Устное обоснование и качество объяснения пациенту не оцениваются автоматически.</p></div>';
    }
    if (deb.sources && deb.sources.length) {
      h += '<div class="block"><h3>Источники учебного сценария</h3><ul class="keylist">';
      deb.sources.forEach(function (source) {
        if (/^https:\/\//i.test(source.url || '')) {
          h += '<li><a href="' + esc(source.url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.title) + '</a></li>';
        }
      });
      h += '</ul></div>';
    }

    if (aiUsed) h += '<div class="block"><h3>ИИ-расспрос</h3><p>В этом приёме использовался ИИ. Его ответы не отмечают пункты чек-листа: итоговый процент не отражает полноту такого расспроса. Текст ИИ-диалога остаётся в протоколе этой страницы и не входит в код результата для преподавателя.</p></div>';
    h += '<div class="block"><h3>Продолжить практику</h3><p><a href="media-lab.html" target="_blank" rel="noopener">Разобрать реальные ЭКГ и звуки сердца</a></p><p class="block-note">Отдельные учебные записи, не исследования этого пациента.</p></div>';
    $('debrief').innerHTML = h;
  }

  function errGroupHtml(title, items) {
    if (!items || !items.length) return '';
    var h = '<div class="err-group"><h4>' + esc(title) +
      ' <span class="err-n">' + items.length + '</span></h4><ul>';
    items.forEach(function (it) {
      h += '<li><b>' + esc(it.label) + '</b>' +
        (it.why ? '<span>' + esc(it.why) + '</span>' : '') + '</li>';
    });
    return h + '</ul></div>';
  }

  /* Плитка разбора: подпись и вес — из score.js, чтобы разбор и критерии
     преподавателя не могли разойтись. */
  function tile(key, value, cls, noteOverride) {
    return '<div class="score ' + cls + '">' +
      '<div class="score-label">' + esc(Score.TILE_LABELS[key]) + '</div>' +
      '<div class="score-value">' + esc(value) + '</div>' +
      '<div class="score-note">' +
        esc(noteOverride || 'вес ' + Math.round(Score.WEIGHTS[key] * 100) + ' %') +
      '</div></div>';
  }

  function pick(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* =========================================================
     Экспорт результата преподавателю
     ========================================================= */

  /* Код содержит весь протокол приёма, но не балл: оценка пересчитывается
     на странице преподавателя. ФИО обязательны — иначе журнал не сможет
     отличить студентов друг от друга. */
  function openExport() {
    $('exportHint').textContent = '';
    refreshExport();
    $('exportBox').hidden = false;
    $('exportName').focus();
  }

  function refreshExport() {
    var name = $('exportName').value.replace(/^\s+|\s+$/g, '');
    var group = $('exportGroup').value.replace(/^\s+|\s+$/g, '');
    var ready = !!name;
    $('exportCode').value = ready
      ? Score.encodeResult(CASE, state, { name: name, group: group })
      : '';
    $('exportCopy').disabled = !ready;
    $('exportFile').disabled = !ready;
  }

  function setExportHint(text) { $('exportHint').textContent = text; }

  function copyExport() {
    var ta = $('exportCode');
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    if (ok) { setExportHint('Код скопирован — отправьте его преподавателю.'); return; }
    /* Некоторые браузеры на file:// не пускают execCommand — пробуем
       асинхронный clipboard API, он работает по клику. */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(function () {
        setExportHint('Код скопирован — отправьте его преподавателю.');
      }, function () {
        setExportHint('Автокопирование не удалось — код выделен, скопируйте вручную (⌘C / Ctrl+C).');
      });
    } else {
      setExportHint('Код выделен — скопируйте вручную (⌘C / Ctrl+C).');
    }
  }

  function downloadExport() {
    var blob = new Blob([$('exportCode').value], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'результат-' + CASE.id + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    setExportHint('Файл скачан — отправьте его преподавателю.');
  }

  /* =========================================================
     Демо-прогон: правильный приём в правильном порядке.
     Нужен для проверки разбора, а не для обучения.
     ========================================================= */

  function runDemo() {
    var order = [];
    CASE.passport.forEach(function (p) { order.push(p.id); });
    CASE.questions.forEach(function (q) { order.push(q.id); });
    CASE.vitals.forEach(function (v) { order.push(v.id); });

    /* Осмотры — из данных случая: сперва все, кроме глубокого дыхания и
       аускультации, затем e.deep и e.ausc в правильном порядке (правило
       a.ausc-no-deep). Точки прослушиваются ниже отдельно. */
    CASE.exams.forEach(function (e) {
      if (e.id !== 'e.deep' && e.id !== 'e.ausc') order.push(e.id);
    });
    /* У кастома без аускультации этих приёмов нет — perform их пропустит. */
    if (BYID['e.deep']) order.push('e.deep');
    if (BYID['e.ausc']) order.push('e.ausc');

    order.forEach(function (id) { perform(id, { silent: true }); });

    auscPoints().forEach(function (p) {
      var f = auscFinding(p.finding);
      if (!f) return;
      state.heard[p.id] = p.finding;
      state.currentPoint = p;
      markPoints(p);
      showReadout(p);
      $('stethoToggle').disabled = false;
      $('scopeIdle').hidden = true;
      logRow({
        kind: 'exam', cat: 'exam', id: 'ausc:' + p.id,
        act: 'Выслушано: ' + p.label,
        res: independent ? 'Запись прослушана. Опишите находку самостоятельно.' : f.title,
        resCls: f.abnormal ? 'is-abn' : 'is-ok'
      });
    });
    renderCoverage();

    CASE.orders.forEach(function (o) {
      if (o.role !== 'waste') perform(o.id, { silent: true });
    });

    if (CASE.diagnosis && CASE.diagnosis.correct) {
      perform(CASE.diagnosis.correct, { silent: true });
    }

    CASE.treatment.forEach(function (x) {
      if (x.role !== 'harm') perform(x.id, { silent: true });
    });

    switchVideo('idle');
    voice.pause();
    hideSpeaking();
    $('subtitle').hidden = true;
  }

  init();
})();
