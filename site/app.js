/* Свободный приём. Ни одного этапа, ни одной готовой кнопки-вопроса:
   всё, что происходит, происходит потому, что врач это написал.

   Один IIFE, ES5-совместимо, без сборки и без сети — файл открывается
   и через file://. */
(function () {
  'use strict';

  var CASE = (window.CASES || [])[0];
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
    { id: 'ask',     label: 'Спросить',  ph: 'О чём спросить пациента? Формулируйте своими словами' },
    { id: 'measure', label: 'Измерить',  ph: 'Какой показатель измерить?',
      sub: [
        { label: 'Температура', run: 'измерить температуру' },
        { label: 'Пульс',       run: 'измерить пульс' },
        { label: 'ЧДД',         run: 'посчитать чдд' },
        { label: 'АД',          run: 'измерить давление' },
        { label: 'SpO₂',        run: 'измерить сатурацию' },
        { label: 'Рост и вес',  run: 'взвесить пациента' }
      ] },
    { id: 'exam',    label: 'Осмотреть', ph: 'Какой физикальный приём выполнить?' },
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
    buildCatalog();

    state = {
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
      lung.addEventListener('play', startScope);
      lung.addEventListener('pause', stopScope);
      lung.addEventListener('ended', stopScope);
      lung.addEventListener('timeupdate', function () { if (!rafId) drawScope(); });
      bind();
    }

    renderChip();
    $('vol').value = 80;
    lung.volume = 0.8;

    var idle = $('videoIdle'), throat = $('videoThroat');
    if (!idle.src) {
      idle.src = CASE.patient.idleVideo;
      throat.src = CASE.patient.throatVideo;
      throat.poster = CASE.patient.throatPoster;
    }
    switchVideo('idle');
    idle.play().catch(function () {});

    renderCats();
    renderPassport();
    renderVitals();
    resetNotes();
    resetLog();
    renderChest();
    renderCoverage();

    $('auscPanel').hidden = true;
    $('sheet').hidden = true;
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
      act: 'Пациент вошёл в кабинет',
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

  function bind() {
    $('actForm').addEventListener('submit', function (e) {
      e.preventDefault();
      submit($('actInput').value);
    });
    $('actInput').addEventListener('input', function () {
      $('clarify').hidden = true;
    });
    $('restartBtn').addEventListener('click', restart);
    $('againBtn').addEventListener('click', restart);
    $('finishBtn').addEventListener('click', function () { finish(false); });
    $('closeSheet').addEventListener('click', function () { $('sheet').hidden = true; });
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
    if (voice) { voice.pause(); voice.src = ''; }
    if (lung) { lung.pause(); lung.src = ''; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function tickClock() {
    $('clock').textContent = mmss((Date.now() - state.t0) / 1000);
  }

  function mmss(sec) {
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
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
    raw = String(raw || '').replace(/^\s+|\s+$/g, '');
    if (!raw) return;
    $('actInput').value = '';
    $('clarify').hidden = true;

    var r = NLU.match(raw, INTENTS, { cat: state.cat, label: labelOf });

    if (r.ok) {
      perform(r.id, { raw: raw, corrected: r.corrected });
      return;
    }

    if (r.kind === 'clarify') {
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

    /* Не понял. Прежде чем сдаться, спрашиваем локальный ЛЛМ-прокси
       (tools/nlu-proxy.py): если он запущен и уверенно выбрал намерение
       из каталога, действие идёт обычным конвейером — озвученный заранее
       ответ, детерминированный разбор. Без прокси XHR на 127.0.0.1 падает
       мгновенно, и приём работает как раньше. */
    askLLM(raw, function (id) {
      if (id && BYID[id]) {
        perform(id, { raw: raw, corrected: labelOf(id) });
        return;
      }
      state.unknowns.push(raw);
      var u = CASE.system.unknown;
      logRow({
        kind: 'unknown', cat: null,
        act: '«' + raw + '»',
        res: u.text,
        resCls: 'is-warn'
      });
      say(u.audio, u.text);
    });
  }

  /* ЛЛМ-фолбэк понимания. Прокси не отвечает за пациента и не ставит
     оценок — он лишь выбирает id из каталога, который мы сами и прислали.
     Ключ API живёт в переменной окружения прокси, страница его не видит.
     Любая ошибка — сеть, таймаут, кривой ответ — эквивалентна «не понял». */
  var LLM_URL = 'http://127.0.0.1:8790/match';

  function askLLM(raw, done) {
    var x, fin = false;
    function finish(id) { if (!fin) { fin = true; done(id); } }
    try {
      x = new XMLHttpRequest();
      x.open('POST', LLM_URL, true);
      x.timeout = 8000;
      x.setRequestHeader('Content-Type', 'application/json');
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        if (x.status !== 200) { finish(null); return; }
        var id = null;
        try { id = JSON.parse(x.responseText).id || null; } catch (e) {}
        finish(id);
      };
      x.ontimeout = function () { finish(null); };
      x.onerror = function () { finish(null); };
      x.send(JSON.stringify({
        text: raw,
        cat: state.cat || null,
        intents: INTENTS.map(function (it) {
          return { id: it.id, cat: it.cat, label: labelOf(it.id) };
        })
      }));
    } catch (e) { finish(null); }
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
        perform(o.id, { raw: raw });
      });
      box.appendChild(b);
    });

    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'clarify-btn is-none';
    no.textContent = 'Ни то, ни другое';
    no.addEventListener('click', function () {
      box.hidden = true;
      state.unknowns.push(raw);
      logRow({ kind: 'unknown', cat: null, act: '«' + raw + '»',
               res: 'Действие не распознано и не выполнено.', resCls: 'is-warn' });
    });
    box.appendChild(no);

    state.clarifies++;
    box.hidden = false;
  }

  /* =========================================================
     Исполнение действия
     ========================================================= */

  function perform(id, opts) {
    opts = opts || {};
    var item = BYID[id];
    if (!item) return;

    var repeat = !!state.done[id];
    var kind = item.__kind;

    if (repeat && kind !== 'exam') {
      /* Повтор ничего не добавляет к оценке, но пациент отвечает снова. */
      logRow({ kind: kind, cat: item.cat, id: null, act: item.label,
               res: 'Уже выполнено ранее — повторно.', resCls: '', repeat: true });
      if (!opts.silent && item.audio) say(item.audio, item.text);
      return;
    }

    state.done[id] = true;
    var row = { kind: kind, cat: item.cat, id: id, act: item.label,
                corrected: opts.corrected || null };

    if (kind === 'passport') {
      row.res = item.text;
      row.resCls = item.important ? 'is-key' : '';
      renderPassport();
      addNote(item.field + ': ' + item.value, item.important ? 'abn' : '');
      if (!opts.silent) say(item.audio, item.text);

    } else if (kind === 'question') {
      row.res = item.text;
      row.resCls = item.important ? 'is-key' : '';
      addNote(item.tag, item.important ? 'abn' : '');
      if (!opts.silent) say(item.audio, item.text);

    } else if (kind === 'vital') {
      row.res = item.field + ' — ' + item.value + ' ' + (item.unit || '') +
                '. Техника: ' + item.tech;
      row.resCls = item.abnormal ? 'is-abn' : 'is-ok';
      renderVitals();
      addNote(item.note, item.abnormal ? 'abn' : 'ok');

    } else if (kind === 'exam') {
      performExam(item, row, opts);

    } else if (kind === 'order') {
      row.res = item.result;
      row.hint = item.hint;
      row.resCls = item.role === 'waste' ? 'is-warn' : 'is-ok';
      addNote(item.label + ': ' + item.result, item.role === 'waste' ? 'abn' : 'ok');

    } else if (kind === 'treat') {
      row.res = item.hint;
      row.resCls = item.role === 'harm' ? 'is-abn' : 'is-ok';
      addNote('Назначено: ' + item.label, item.role === 'harm' ? 'abn' : 'ok');

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
    renderChip();
    updateCounters();
  }

  function performExam(item, row, opts) {
    if (item.kind === 'auscult') {
      $('auscPanel').hidden = false;
      row.res = item.note;
      row.resCls = '';
      requestAnimationFrame(drawScope);
      $('auscPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    if (item.kind === 'throat') {
      switchVideo('throat');
      $('videoBadge').textContent = 'Осмотр зева';
      var v = $('videoThroat');
      v.currentTime = 0;
      v.play().catch(function () {});
      if (!opts.silent) say(CASE.system[item.voice].audio, CASE.system[item.voice].text);
      row.res = item.result;
      row.resCls = 'is-abn';
      addNote(item.title, 'abn');
      return;
    }

    row.res = item.result;
    row.resCls = item.findAbnormal ? 'is-abn' : 'is-ok';
    addNote(item.title || item.label, item.findAbnormal ? 'abn' : 'ok');

    if (item.voice && CASE.system[item.voice] && !opts.silent) {
      say(CASE.system[item.voice].audio, CASE.system[item.voice].text);
    }

    /* Проба с кашлем меняет трактовку уже услышанного. */
    if (item.id === 'e.cough' && state.currentPoint) {
      var f = CASE.auscultation.findings[state.currentPoint.finding];
      if (f.abnormal) {
        /* Заголовок правится вместе с текстом: иначе панель показывала бы
           «Точка не выбрана» над описанием пробы с кашлем. */
        $('readoutTitle').textContent = state.currentPoint.label + ' — проба с кашлем';
        $('readoutDesc').textContent =
          'После покашливания хрипы изменили звучание и частично исчезли, затем вернулись ' +
          'при следующем вдохе. Это подвижный секрет в просвете бронхов, а не фиброз.';
      }
    }
  }

  /* =========================================================
     Протокол
     ========================================================= */

  function resetLog() {
    $('log').innerHTML =
      '<li class="log-empty">Пациент вошёл и ждёт. Ничего не произойдёт, пока вы не начнёте.</li>';
    updateCounters();
  }

  function logRow(row) {
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
      '<span class="log-time">' + mmss(row.ts) + '</span>' +
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
    h += '</div>';

    li.innerHTML = h;
    ul.appendChild(li);
    ul.scrollTop = ul.scrollHeight;
    updateCounters();
  }

  function catNameOf(kind) {
    return kind === 'patient' ? 'Пациент' :
           kind === 'unknown' ? 'Не понято' :
           kind === 'refused' ? 'Отказ' : '—';
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
            : state.done['p.age'] ? 'Пациент, ' + BYID['p.age'].value
            : 'Пациент';
    if (state.done['p.name'] && state.done['p.age']) {
      who += ', ' + BYID['p.age'].value;
    }
    var why = state.done['q.duration'] ? CASE.patient.reason
            : state.done['q.cough'] ? 'Кашель, длительность не уточнена'
            : 'Жалоба не уточнена';
    $('patientChip').textContent = who + ' · ' + why;
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
      d.className = 'vital' + (got ? (v.flag && v.flag !== 'ok' ? ' is-' + v.flag : '') : ' is-empty') +
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

  function showSpeaking() { $('speakingIndicator').hidden = false; }
  function hideSpeaking() { $('speakingIndicator').hidden = true; }

  function say(src, text, onEnd) {
    lung.pause();
    voice.pause();
    voice.src = src;
    voice.currentTime = 0;

    var sub = $('subtitle');
    sub.textContent = text;
    sub.hidden = false;
    showSpeaking();

    voice._onEnd = onEnd || null;
    voice.play().catch(function () {
      // Автовоспроизведение заблокировано — субтитр всё равно показан.
      onVoiceEnded();
    });
  }

  function onVoiceEnded() {
    hideSpeaking();
    setTimeout(function () {
      if (voice.paused) $('subtitle').hidden = true;
    }, 2600);
    if (voice._onEnd) { var f = voice._onEnd; voice._onEnd = null; f(); }
  }

  function switchVideo(which) {
    var idle = $('videoIdle'), throat = $('videoThroat');
    if (which === 'throat') {
      throat.classList.add('is-active');
      idle.classList.remove('is-active');
    } else {
      idle.classList.add('is-active');
      throat.classList.remove('is-active');
      throat.pause();
      idle.play().catch(function () {});
    }
  }

  /* =========================================================
     Аускультация
     ========================================================= */

  function renderChest() {
    var g = $('chestPoints');
    g.innerHTML = '';
    var NS = 'http://www.w3.org/2000/svg';

    CASE.auscultation.points.forEach(function (p) {
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
      n.classList.toggle('is-current', !!cur && id === cur.id);
      n.classList.toggle('is-heard', !!f);
      n.classList.toggle('is-abn', !!f && CASE.auscultation.findings[f].abnormal);
    });
  }

  function showReadout(p) {
    var f = CASE.auscultation.findings[p.finding];
    var ro = document.querySelector('.stetho-readout');
    ro.classList.toggle('is-abn', f.abnormal);
    ro.classList.toggle('is-ok', !f.abnormal);
    $('readoutTitle').textContent = p.label + ' — ' + f.title;
    $('readoutDesc').textContent = f.desc;
  }

  function pickPoint(p) {
    var f = CASE.auscultation.findings[p.finding];
    var first = !state.heard[p.id];
    state.heard[p.id] = p.finding;
    state.currentPoint = p;

    markPoints(p);
    showReadout(p);

    $('stethoToggle').disabled = false;
    $('scopeIdle').hidden = true;

    if (first) {
      addNote(p.label + ': ' + f.title, f.abnormal ? 'abn' : 'ok');
      renderCoverage();
      logRow({
        kind: 'exam', cat: 'exam', id: 'ausc:' + p.id,
        act: 'Выслушано: ' + p.label,
        res: f.title + '. ' + f.desc,
        resCls: f.abnormal ? 'is-abn' : 'is-ok'
      });
    }

    voice.pause();
    hideSpeaking();
    lung.pause();
    lung.src = f.audio;
    lung.currentTime = 0;
    lung._wf = p.finding === 'crackles' ? 'lung-crackles' : 'lung-normal';
    lung._abn = f.abnormal;
    lung.play().then(setLungLabel).catch(setLungLabel);
  }

  function toggleLung() {
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
    CASE.auscultation.points.forEach(function (p) {
      var f = state.heard[p.id];
      var s = document.createElement('span');
      s.className = 'cov' + (f ? ' is-heard' : '') +
        (f && CASE.auscultation.findings[f].abnormal ? ' is-abn' : '');
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
    var played = abn ? '#e0664f' : '#4bb98a';
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
      ctx.strokeStyle = abn ? 'rgba(224,102,79,.9)' : 'rgba(75,185,138,.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    }

    // подпись времени
    ctx.fillStyle = 'rgba(150,170,195,.65)';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText((lung.currentTime || 0).toFixed(1) + ' / ' + (dur || 0).toFixed(1) + ' c', 8, h - 8);
  }

  /* =========================================================
     Хронология для правил на порядок действий
     ========================================================= */

  function makeTimeline() {
    var acts = [], i;
    for (i = 0; i < state.log.length; i++) if (state.log[i].id) acts.push(state.log[i]);

    var idx = {};
    for (i = 0; i < acts.length; i++) {
      if (!(acts[i].id in idx)) idx[acts[i].id] = i;
    }

    return {
      at: function (id) { return (id in idx) ? idx[id] : -1; },
      did: function (id) { return (id in idx); },
      firstOf: function (c) {
        for (var k = 0; k < acts.length; k++) {
          if (acts[k].cat === c || acts[k].kind === c) return k;
        }
        return -1;
      },
      countOf: function (c) {
        var n = 0;
        for (var k = 0; k < acts.length; k++) {
          if (acts[k].cat === c || acts[k].kind === c) n++;
        }
        return n;
      }
    };
  }

  /* =========================================================
     Разбор
     ========================================================= */

  function finish(silent) {
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
    var t = makeTimeline();
    var s = computeScore(t);
    var h = '';

    /* --- Итог --- */
    h += '<div class="result-head">' +
      '<div class="result-total ' + band(s.total) + '">' + s.total + ' %</div>' +
      '<div><h2>Разбор приёма</h2><p>' + esc(grade(s.total)) + '</p></div></div>';

    h += '<div class="scores">' +
      tile('Расспрос', pctS(s.ask), 'вес 25 %', band(s.ask * 100)) +
      tile('Паспортная часть', pctS(s.pass), 'вес 5 %', band(s.pass * 100)) +
      tile('Показатели', pctS(s.vit), 'вес 10 %', band(s.vit * 100)) +
      tile('Физикальный осмотр', pctS(s.exam), 'вес 20 %', band(s.exam * 100)) +
      tile('Обследование', pctS(s.order), 'вес 15 %', band(s.order * 100)) +
      tile('Лечение', pctS(s.treat), 'вес 10 %', band(s.treat * 100)) +
      tile('Диагноз', s.dx ? 'верно' : 'нет', 'вес 10 %', s.dx ? 'is-good' : 'is-bad') +
      tile('Алгоритм', pctS(s.algo), 'вес 5 % · правил в игре ' + s.rules, band(s.algo * 100)) +
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
        '<span class="tl-time">' + mmss(e.ts) + '</span>' +
        '<span class="tl-cat">' + esc(e.cat ? CAT_NAME[e.cat] : catNameOf(e.kind)) + '</span>' +
        '<span class="tl-act">' + esc(e.act) + '</span></li>';
    }
    h += '</ol><p class="block-note">Результативных действий: ' + acts +
      ' · длительность приёма ' + mmss(state.log.length ? state.log[state.log.length - 1].ts : 0) +
      '</p></div>';

    /* --- Ошибки и пропуски --- */
    var errs = '';

    errs += errGroupHtml('Не собраны паспортные данные',
      CASE.passport.filter(notDone).map(function (p) {
        return { label: p.field + ' — ' + p.label.toLowerCase(), why: p.why };
      }));

    errs += errGroupHtml('Не измерено',
      CASE.vitals.filter(notDone).map(function (v) {
        return {
          label: v.field,
          why: v.abnormal
            ? 'Показатель был отклонён от нормы (' + v.value + ' ' + (v.unit || '') +
              ') — отклонение осталось незамеченным.'
            : null
        };
      }));

    errs += errGroupHtml('Не заданы важные вопросы',
      CASE.questions.filter(notDone).filter(function (q) { return q.important; })
        .map(function (q) { return { label: q.label, why: q.why }; }));

    errs += errGroupHtml('Не заданы прочие вопросы',
      CASE.questions.filter(notDone).filter(function (q) { return !q.important; })
        .map(function (q) { return { label: q.label, why: null }; }));

    errs += errGroupHtml('Не выявленные патологии', missedPathology());

    errs += errGroupHtml('Не назначено — обследование',
      CASE.orders.filter(notDone).filter(function (o) { return o.role === 'need'; })
        .map(function (o) { return { label: o.label, why: o.hint }; }));

    errs += errGroupHtml('Стоило рассмотреть — обследование',
      CASE.orders.filter(notDone).filter(function (o) { return o.role === 'useful'; })
        .map(function (o) { return { label: o.label, why: o.hint }; }));

    errs += errGroupHtml('Не назначено — лечение',
      CASE.treatment.filter(notDone).filter(function (x) { return x.role === 'need'; })
        .map(function (x) { return { label: x.label, why: x.hint }; }));

    errs += errGroupHtml('Назначено зря',
      CASE.orders.filter(isDone).filter(function (o) { return o.role === 'waste'; })
        .map(function (o) { return { label: o.label, why: o.hint }; }));

    errs += errGroupHtml('Назначено ошибочно',
      CASE.treatment.filter(isDone).filter(function (x) { return x.role === 'harm'; })
        .map(function (x) { return { label: x.label, why: x.hint }; }));

    errs += errGroupHtml('Пациент не понял вопрос',
      state.unknowns.map(function (u) { return { label: '«' + u + '»', why: null }; }));

    h += '<div class="block"><h3>Ошибки и пропуски</h3>' +
      (errs || '<p class="all-clear">Пропусков нет: собрано всё, что можно было собрать, ' +
               'и ничего лишнего не назначено.</p>') +
      '</div>';

    /* --- Алгоритм --- */
    var viol = violations(t);
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
    h += '<div class="block"><h3>Что было в этом случае</h3><ul class="keylist">';
    CASE.debrief.keyFindings.forEach(function (k) { h += '<li>' + esc(k) + '</li>'; });
    h += '</ul></div>';

    h += '<div class="block is-trap"><h3>Ловушка случая</h3><p>' +
      esc(CASE.debrief.trap) + '</p></div>';

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

    h += '<div class="block"><h3>Дальнейшая тактика</h3><p>' +
      esc(CASE.debrief.nextSteps) + '</p></div>';

    $('debrief').innerHTML = h;
  }

  function notDone(x) { return !state.done[x.id]; }
  function isDone(x) { return !!state.done[x.id]; }

  function missedPathology() {
    var out = [];

    /* Не выслушанные поля с патологией. */
    CASE.auscultation.points.forEach(function (p) {
      var f = CASE.auscultation.findings[p.finding];
      if (f.abnormal && !state.heard[p.id]) {
        out.push({
          label: p.label + ' — ' + f.title,
          why: 'Поле не выслушано. Именно здесь была слышна патология.'
        });
      }
    });
    if (!state.done['e.ausc']) {
      out.push({ label: 'Аускультация лёгких не проводилась совсем',
                 why: pick(CASE.exams, 'e.ausc').why });
    }

    /* Не выполненные приёмы, которые дали бы патологию. */
    CASE.exams.forEach(function (e) {
      if (e.findAbnormal && e.kind !== 'auscult' && !state.done[e.id]) {
        out.push({ label: e.title || e.label, why: e.why });
      }
    });

    /* Не найденные патологии в показателях. */
    CASE.vitals.forEach(function (v) {
      if (v.abnormal && !state.done[v.id]) {
        out.push({ label: v.field + ' ' + v.value + ' ' + (v.unit || ''),
                   why: 'Отклонение осталось неизмеренным.' });
      }
    });

    return out;
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

  /* Правило участвует в оценке только если его предпосылка возникла:
     «КТ без рентгена» ничего не говорит о враче, который КТ не назначал.
     Без этого фильтра бездействие получало бы высокий балл за алгоритм —
     просто потому, что нарушать было нечего. Правило без `when` в игре
     всегда. */
  function applies(r, t) {
    if (!r.when) return true;
    try { return !!r.when(t); } catch (e) { return false; }
  }

  function violations(t) {
    var out = [];
    CASE.algorithm.forEach(function (r) {
      if (!applies(r, t)) return;
      var bad = false;
      try { bad = !!r.test(t); } catch (e) { bad = false; }
      if (bad) out.push(r);
    });
    return out;
  }

  function rulesInPlay(t) {
    var n = 0;
    CASE.algorithm.forEach(function (r) { if (applies(r, t)) n++; });
    return n;
  }

  /* =========================================================
     Оценка
     ========================================================= */

  function computeScore(t) {
    var s = {};

    s.ask = ratio(CASE.questions, function (q) { return q.weight || 1; });
    s.pass = ratio(CASE.passport, function (p) { return p.important ? 2 : 1; });
    s.vit = ratio(CASE.vitals, function (v) { return v.weight || 1; });

    /* Физикальный осмотр: аускультация считается отдельно — важно не то,
       что врач её начал, а сколько полей прослушал и нашёл ли патологию. */
    var eTot = 0, eGot = 0;
    CASE.exams.forEach(function (e) {
      var w = e.weight || 0;
      if (!w) return;
      eTot += w;
      if (e.kind === 'auscult') {
        var heard = 0, abn = 0, abnTot = 0;
        CASE.auscultation.points.forEach(function (p) {
          var f = CASE.auscultation.findings[p.finding];
          if (f.abnormal) abnTot++;
          if (state.heard[p.id]) { heard++; if (f.abnormal) abn++; }
        });
        var cov = heard / CASE.auscultation.points.length;
        var found = abnTot ? abn / abnTot : 1;
        eGot += w * (0.4 * cov + 0.6 * found);
      } else if (state.done[e.id]) {
        eGot += w;
      }
    });
    s.exam = eTot ? eGot / eTot : 0;

    s.order = roleScore(CASE.orders, 'waste', 0.10);
    s.treat = roleScore(CASE.treatment, 'harm', 0.20);
    s.dx = state.dx === CASE.diagnosis.correct;

    /* Доля соблюдённых правил среди тех, что были в игре, а не вычитание
       фиксированного штрафа: иначе балл зависел бы от того, сколько правил
       вообще есть в файле случая. */
    s.rules = rulesInPlay(t);
    s.algo = s.rules ? Math.max(0, 1 - violations(t).length / s.rules) : 0;

    s.total = Math.round(100 * (
      0.25 * s.ask + 0.05 * s.pass + 0.10 * s.vit + 0.20 * s.exam +
      0.15 * s.order + 0.10 * s.treat + 0.10 * (s.dx ? 1 : 0) + 0.05 * s.algo
    ));
    return s;
  }

  function ratio(list, wOf) {
    var tot = 0, got = 0;
    list.forEach(function (x) {
      var w = wOf(x);
      tot += w;
      if (state.done[x.id]) got += w;
    });
    return tot ? got / tot : 0;
  }

  /* Полезное набирает, вредное и бессмысленное вычитает. */
  function roleScore(list, badRole, penalty) {
    var tot = 0, got = 0, bad = 0;
    list.forEach(function (x) {
      if (x.role === badRole) {
        if (state.done[x.id]) bad++;
        return;
      }
      if (x.role === 'waste') {
        if (state.done[x.id]) bad++;
        return;
      }
      var w = x.weight || 1;
      tot += w;
      if (state.done[x.id]) got += w;
    });
    var base = tot ? got / tot : 0;
    return Math.max(0, base - bad * penalty);
  }

  function pctS(x) { return Math.round(x * 100) + ' %'; }

  function tile(label, value, note, cls) {
    return '<div class="score ' + cls + '">' +
      '<div class="score-label">' + esc(label) + '</div>' +
      '<div class="score-value">' + esc(value) + '</div>' +
      '<div class="score-note">' + esc(note) + '</div></div>';
  }

  function band(pct) { return pct >= 80 ? 'is-good' : pct >= 50 ? 'is-mid' : 'is-bad'; }

  function grade(t) {
    return t >= 85 ? 'приём проведён образцово' :
           t >= 70 ? 'хорошо, но есть пробелы' :
           t >= 50 ? 'приём поверхностный' :
                     'ключевые данные не собраны';
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
     Демо-прогон: правильный приём в правильном порядке.
     Нужен для проверки разбора, а не для обучения.
     ========================================================= */

  function runDemo() {
    var order = [];
    CASE.passport.forEach(function (p) { order.push(p.id); });
    CASE.questions.forEach(function (q) { order.push(q.id); });
    CASE.vitals.forEach(function (v) { order.push(v.id); });

    order.push('e.chestshape', 'e.skin', 'e.fingers', 'e.lymph', 'e.percussion',
               'e.fremitus', 'e.deep', 'e.ausc');

    order.forEach(function (id) { perform(id, { silent: true }); });

    CASE.auscultation.points.forEach(function (p) {
      state.heard[p.id] = p.finding;
      state.currentPoint = p;
      markPoints(p);
      showReadout(p);
      $('stethoToggle').disabled = false;
      $('scopeIdle').hidden = true;
      logRow({
        kind: 'exam', cat: 'exam', id: 'ausc:' + p.id,
        act: 'Выслушано: ' + p.label,
        res: CASE.auscultation.findings[p.finding].title,
        resCls: CASE.auscultation.findings[p.finding].abnormal ? 'is-abn' : 'is-ok'
      });
    });
    renderCoverage();

    ['e.cough', 'e.throat', 'e.heart', 'e.abdomen'].forEach(function (id) {
      perform(id, { silent: true });
    });

    CASE.orders.forEach(function (o) {
      if (o.role !== 'waste') perform(o.id, { silent: true });
    });

    perform(CASE.diagnosis.correct, { silent: true });

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
