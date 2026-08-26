/* Виртуальный приём — логика тренажёра.
   Данные случая лежат в cases/*.js, пики волновых форм — в media/waveforms.js */
(function () {
  'use strict';

  var CASE = (window.CASES || [])[0];
  var WF = window.WAVEFORMS || {};

  if (!CASE) {
    document.body.innerHTML = '<p style="padding:40px;color:#e0664f">' +
      'Случай не загружен: проверьте, что cases/bronchiectasis.js подключён.</p>';
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var STAGES = [
    { id: 'intake',  label: 'Жалобы' },
    { id: 'history', label: 'Анамнез' },
    { id: 'auscult', label: 'Аускультация' },
    { id: 'throat',  label: 'Зев' },
    { id: 'workup',  label: 'Исследования' },
    { id: 'dx',      label: 'Диагноз' }
  ];

  var state, voice, lung, rafId;

  /* =========================================================
     Инициализация
     ========================================================= */

  function init() {
    state = {
      stage: 'intake',
      greetingHeard: false,
      asked: [],
      heard: {},          // pointId -> 'normal' | 'crackles'
      coughed: false,
      throatDone: false,
      ordered: [],
      currentPoint: null,
      dx: null,
      dxWarned: false
    };

    voice = new Audio();
    voice.preload = 'auto';
    lung = new Audio();
    lung.preload = 'auto';
    lung.loop = true;
    lung.volume = 0.8;

    voice.addEventListener('ended', onVoiceEnded);
    lung.addEventListener('play', startScope);
    lung.addEventListener('pause', stopScope);

    $('videoIdle').src = CASE.patient.idleVideo;
    $('videoThroat').src = CASE.patient.throatVideo;
    $('videoThroat').poster = CASE.patient.throatPoster || '';
    $('videoIdle').play().catch(function () {});

    $('patientChip').textContent = CASE.patient.short + ' · ' + CASE.patient.reason;
    $('auscultNote').textContent = CASE.auscultation.note;
    $('throatNote').textContent = CASE.throat.note;

    renderStepper();
    renderVitals();
    renderQuestions();
    renderChest();
    renderCoverage();
    renderWorkup();
    renderDiagnosis();
    resetNotes();
    clearDialogue();

    bind();
    show('intake');
    applyUrlOverrides();
  }

  /* Отладка при разработке случаев: ?demo=1 заполняет осмотр,
     ?stage=auscult открывает нужный этап, ?dx=<id> сразу даёт разбор. */
  function applyUrlOverrides() {
    var p = new URLSearchParams(location.search);
    if (!p.has('demo') && !p.has('stage') && !p.has('dx')) return;

    if (p.get('demo') === '1') {
      state.greetingHeard = true;
      $('dialogue').hidden = false;
      $('toHistory').disabled = false;
      addTurn('pat', 'Пациент', CASE.patient.greeting.text, false);
      addNote('Жалоба: кашель, по словам пациента незначительный');

      CASE.questions.forEach(function (q) {
        state.asked.push(q.key);
        var b = document.querySelector('.qbtn[data-key="' + q.key + '"]');
        if (b) b.classList.add('is-asked');
        addTurn('doc', 'Врач', q.q, false);
        addTurn('pat', 'Пациент', q.a, false);
        if (q.tag) addNote(q.tag, q.weight >= 2 ? 'abn' : null);
      });
      updateHistoryProgress();

      CASE.auscultation.points.forEach(function (pt) {
        state.heard[pt.id] = pt.finding;
        var f = CASE.auscultation.findings[pt.finding];
        addNote(pt.label + ': ' + f.title, f.abnormal ? 'abn' : 'ok');
      });
      state.coughed = true;
      state.throatDone = true;
      addNote(CASE.throat.title,'abn');
      CASE.workup.forEach(function (w) { state.ordered.push(w.id); });

      renderCoverage();
      Array.prototype.forEach.call(document.querySelectorAll('.pt'), function (n) {
        var id = n.dataset.id;
        n.classList.add('is-heard');
        if (CASE.auscultation.findings[state.heard[id]].abnormal) n.classList.add('is-abn');
      });
      Array.prototype.forEach.call(document.querySelectorAll('.step'), function (b) {
        b.disabled = false;
      });

      // показать снимок аускультации без автозапуска звука
      var demoPt = CASE.auscultation.points.filter(function (x) {
        return CASE.auscultation.findings[x.finding].abnormal;
      })[0];
      if (demoPt) {
        var df = CASE.auscultation.findings[demoPt.finding];
        state.currentPoint = demoPt;
        lung.src = df.audio;
        lung._wf = 'lung-crackles';
        lung._abn = true;
        document.querySelector('.stetho-readout').classList.add('is-abn');
        $('readoutTitle').textContent = demoPt.label + ' — ' + df.title;
        $('readoutDesc').textContent = df.desc;
        $('scopeIdle').hidden = true;
        $('stethoToggle').disabled = false;
        var node = document.querySelector('.pt[data-id="' + demoPt.id + '"]');
        if (node) node.classList.add('is-current');
      }

      $('throatBadge').textContent = 'Лёгкие изменения';
      $('throatTitle').textContent = CASE.throat.title;
      $('throatDesc').textContent = CASE.throat.desc;
      $('throatFinding').hidden = false;
    }

    if (p.has('dx')) {
      state.dx = p.get('dx');
      renderDebrief();
      show('debrief');
      return;
    }
    if (p.has('stage')) show(p.get('stage'));
  }

  function bind() {
    $('playGreeting').addEventListener('click', playGreeting);
    $('toHistory').addEventListener('click', function () { show('history'); });
    $('toExam').addEventListener('click', function () { show('auscult'); });
    $('toThroat').addEventListener('click', function () { show('throat'); });
    $('toWorkup').addEventListener('click', function () { show('workup'); });
    $('toDx').addEventListener('click', function () { show('dx'); });

    Array.prototype.forEach.call(document.querySelectorAll('[data-goto]'), function (b) {
      b.addEventListener('click', function () { show(b.dataset.goto); });
    });

    $('stethoToggle').addEventListener('click', toggleLung);
    $('coughBtn').addEventListener('click', askCough);
    $('vol').addEventListener('input', function () { lung.volume = this.value / 100; });
    $('throatPlay').addEventListener('click', examineThroat);
    $('submitDx').addEventListener('click', submitDiagnosis);
    $('restartBtn').addEventListener('click', restart);
    $('againBtn').addEventListener('click', restart);
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

  /* =========================================================
     Навигация по этапам
     ========================================================= */

  function renderStepper() {
    var box = $('stepper');
    box.innerHTML = '';
    STAGES.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'step';
      b.dataset.step = s.id;
      b.innerHTML = '<span class="step-n">' + (i + 1) + '</span>' + s.label;
      b.addEventListener('click', function () { show(s.id); });
      box.appendChild(b);
    });
  }

  function stageIndex(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i;
    return -1;
  }

  function show(id) {
    if (id === 'history' && !state.greetingHeard) return;

    state.stage = id;
    voice.pause();
    lung.pause();
    hideSpeaking();

    Array.prototype.forEach.call(document.querySelectorAll('.stage'), function (el) {
      el.hidden = el.dataset.stage !== id;
    });

    switchVideo(id === 'throat' && state.throatDone ? 'throat' : 'idle');
    $('videoBadge').textContent = id === 'throat' ? 'Осмотр зева' : 'Кабинет · осмотр';

    var cur = stageIndex(id);
    Array.prototype.forEach.call(document.querySelectorAll('.step'), function (b) {
      var i = stageIndex(b.dataset.step);
      b.classList.toggle('is-current', b.dataset.step === id);
      b.classList.toggle('is-done', cur === -1 ? true : i < cur);
      b.disabled = b.dataset.step !== 'intake' && !state.greetingHeard;
    });

    if (id === 'auscult') requestAnimationFrame(drawScope);
    if (id === 'dx') checkDxReadiness();
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
     Показатели и карта осмотра
     ========================================================= */

  function renderVitals() {
    var box = $('vitals');
    box.innerHTML = '';
    CASE.vitals.forEach(function (v) {
      var d = document.createElement('div');
      d.className = 'vital' + (v.flag && v.flag !== 'ok' ? ' is-' + v.flag : '') +
        (String(v.value).length > 4 ? ' is-wide' : '');
      d.innerHTML = '<div class="vital-label">' + v.label + '</div>' +
        '<div class="vital-value">' + v.value +
        '<span class="vital-unit">' + (v.unit || '') + '</span></div>';
      box.appendChild(d);
    });
  }

  function resetNotes() {
    $('notes').innerHTML = '<li class="notes-empty">Записи появятся по ходу приёма.</li>';
    $('notesCounter').textContent = '0';
  }

  function addNote(text, kind) {
    var ul = $('notes');
    var empty = ul.querySelector('.notes-empty');
    if (empty) empty.remove();

    var li = document.createElement('li');
    li.innerHTML = '<span class="note-mark' +
      (kind === 'abn' ? ' is-abn' : kind === 'ok' ? ' is-ok' : '') + '"></span>' +
      '<span>' + text + '</span>';
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
    Array.prototype.forEach.call(document.querySelectorAll('.turn.is-active'), function (t) {
      t.classList.remove('is-active');
    });
    setTimeout(function () {
      if (voice.paused) $('subtitle').hidden = true;
    }, 2600);
    if (voice._onEnd) { var f = voice._onEnd; voice._onEnd = null; f(); }
  }

  /* =========================================================
     Этап 1 — жалоба
     ========================================================= */

  function playGreeting() {
    var g = CASE.patient.greeting;
    say(g.audio, g.text);

    if (!state.greetingHeard) {
      state.greetingHeard = true;
      addTurn('pat', 'Пациент', g.text, true);
      $('dialogue').hidden = false;
      $('toHistory').disabled = false;
      $('intakeHint').textContent =
        'Жалоба звучит легко — «чуть кашель». Не принимайте формулировку пациента за оценку тяжести: расспросите подробно.';
      addNote('Жалоба: кашель, по словам пациента незначительный');
      Array.prototype.forEach.call(document.querySelectorAll('.step'), function (b) {
        b.disabled = false;
      });
    }
  }

  function clearDialogue() {
    $('dialogueLog').innerHTML = '';
    $('dialogueLog2').innerHTML = '';
    $('dialogue').hidden = true;
    $('subtitle').hidden = true;
  }

  function addTurn(who, label, text, active) {
    ['dialogueLog', 'dialogueLog2'].forEach(function (id) {
      var ul = $(id);
      var li = document.createElement('li');
      li.className = 'turn is-' + who + (active ? ' is-active' : '');
      li.innerHTML = '<div class="turn-who">' + label + '</div>' +
        '<div class="turn-text">' + text + '</div>';
      ul.appendChild(li);
      ul.scrollTop = ul.scrollHeight;
    });
  }

  /* =========================================================
     Этап 2 — анамнез
     ========================================================= */

  function renderQuestions() {
    var box = $('qgrid');
    box.innerHTML = '';
    CASE.questions.forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'qbtn';
      b.dataset.key = q.key;
      b.textContent = q.q;
      b.addEventListener('click', function () { ask(q, b); });
      box.appendChild(b);
    });
    updateHistoryProgress();
  }

  function ask(q, btn) {
    var first = state.asked.indexOf(q.key) === -1;
    if (first) {
      state.asked.push(q.key);
      btn.classList.add('is-asked');
      addTurn('doc', 'Врач', q.q, false);
      addTurn('pat', 'Пациент', q.a, true);
      if (q.tag) addNote(q.tag, q.weight >= 2 ? 'abn' : null);
      updateHistoryProgress();
    } else {
      Array.prototype.forEach.call(document.querySelectorAll('.turn'), function (t) {
        t.classList.remove('is-active');
      });
    }
    say(q.audio, q.a);
  }

  function historyScore() {
    var total = 0, got = 0;
    CASE.questions.forEach(function (q) {
      total += q.weight;
      if (state.asked.indexOf(q.key) !== -1) got += q.weight;
    });
    return total ? got / total : 0;
  }

  function updateHistoryProgress() {
    var pct = Math.round(historyScore() * 100);
    $('histFill').style.width = pct + '%';
    $('histPct').textContent = pct + ' %';
  }

  /* =========================================================
     Этап 3 — аускультация
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

  function pickPoint(p) {
    var f = CASE.auscultation.findings[p.finding];
    var first = !state.heard[p.id];
    state.heard[p.id] = p.finding;
    state.currentPoint = p;

    Array.prototype.forEach.call(document.querySelectorAll('.pt'), function (n) {
      var id = n.dataset.id;
      n.classList.toggle('is-current', id === p.id);
      n.classList.toggle('is-heard', !!state.heard[id]);
      n.classList.toggle('is-abn',
        !!state.heard[id] && CASE.auscultation.findings[state.heard[id]].abnormal);
    });

    var ro = document.querySelector('.stetho-readout');
    ro.classList.toggle('is-abn', f.abnormal);
    ro.classList.toggle('is-ok', !f.abnormal);
    $('readoutTitle').textContent = p.label + ' — ' + f.title;
    $('readoutDesc').textContent = f.desc;

    $('stethoToggle').disabled = false;
    $('coughBtn').disabled = !f.abnormal;
    $('scopeIdle').hidden = true;

    if (first) {
      addNote(p.label + ': ' + f.title, f.abnormal ? 'abn' : 'ok');
      renderCoverage();
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

  function askCough() {
    if (!state.currentPoint) return;
    var p = state.currentPoint;
    state.coughed = true;
    $('readoutDesc').textContent =
      'Заключение после покашливания: хрипы изменили звучание и частично исчезли, ' +
      'затем вернулись при следующем вдохе. Это подвижный секрет в просвете бронхов, ' +
      'а не фиброз и не крепитация альвеол.';
    addNote('Проба с кашлем (' + p.label + '): хрипы изменчивы — секрет в бронхах', 'abn');
    $('coughBtn').disabled = true;
    lung.currentTime = 0;
    lung.play().then(setLungLabel).catch(setLungLabel);
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
     Этап 4 — зев
     ========================================================= */

  function examineThroat() {
    var v = $('videoThroat');
    switchVideo('throat');
    v.currentTime = 0;
    v.play().catch(function () {});

    if (!state.throatDone) {
      state.throatDone = true;
      addNote(CASE.throat.title,CASE.throat.abnormal ? 'abn' : 'ok');
    }

    $('throatBadge').textContent =
      CASE.throat.abnormal === 'mild' ? 'Лёгкие изменения' :
      CASE.throat.abnormal ? 'Патология' : 'Норма';
    $('throatTitle').textContent = CASE.throat.title;
    $('throatDesc').textContent = CASE.throat.desc;
    $('throatFinding').hidden = false;
  }

  /* =========================================================
     Этап 5 — исследования
     ========================================================= */

  function renderWorkup() {
    var box = $('workup');
    box.innerHTML = '';
    CASE.workup.forEach(function (w) {
      var card = document.createElement('div');
      card.className = 'wu';

      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'wu-head';
      head.innerHTML = '<span>' + w.name + '</span>' +
        '<span class="wu-order">Назначить</span>';

      var body = document.createElement('div');
      body.className = 'wu-body';
      body.hidden = true;
      body.innerHTML = '<div class="wu-result">' + w.result + '</div>' +
        (w.hint ? '<div class="wu-hint">' + w.hint + '</div>' : '');

      head.addEventListener('click', function () {
        var open = card.classList.toggle('is-open');
        body.hidden = !open;
        head.querySelector('.wu-order').textContent = open ? 'Результат получен' : 'Назначить';
        if (open && state.ordered.indexOf(w.id) === -1) {
          state.ordered.push(w.id);
          addNote(w.name + ' — выполнено');
        }
      });

      card.appendChild(head);
      card.appendChild(body);
      box.appendChild(card);
    });
  }

  /* =========================================================
     Этап 6 — диагноз
     ========================================================= */

  function renderDiagnosis() {
    var box = $('dxlist');
    box.innerHTML = '';
    CASE.diagnosis.options.forEach(function (o) {
      var lab = document.createElement('label');
      lab.className = 'dx';
      lab.innerHTML = '<input type="radio" name="dx" value="' + o.id + '"><span>' + o.name + '</span>';
      lab.querySelector('input').addEventListener('change', function () {
        state.dx = o.id;
        Array.prototype.forEach.call(document.querySelectorAll('.dx'), function (d) {
          d.classList.remove('is-sel');
        });
        lab.classList.add('is-sel');
        $('submitDx').disabled = false;
      });
      box.appendChild(lab);
    });
    $('submitDx').disabled = true;
  }

  function checkDxReadiness() {
    var gaps = [];
    var heardCount = Object.keys(state.heard).length;
    if (historyScore() < 0.6) gaps.push('анамнез собран неполно');
    if (heardCount < CASE.auscultation.points.length)
      gaps.push('прослушано полей: ' + heardCount + ' из ' + CASE.auscultation.points.length);
    if (!state.throatDone) gaps.push('зев не осмотрен');

    var w = $('dxWarn');
    if (gaps.length) {
      w.hidden = false;
      w.textContent = 'Осмотр не завершён: ' + gaps.join('; ') +
        '. Диагноз поставить можно, но это будет отражено в разборе.';
    } else {
      w.hidden = true;
    }
  }

  function submitDiagnosis() {
    if (!state.dx) return;
    stopAll();
    renderDebrief();
    show('debrief');
    Array.prototype.forEach.call(document.querySelectorAll('.step'), function (b) {
      b.classList.add('is-done');
      b.classList.remove('is-current');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* =========================================================
     Разбор
     ========================================================= */

  function renderDebrief() {
    var correctId = CASE.diagnosis.correct;
    var chosen = pick(CASE.diagnosis.options, state.dx);
    var right = state.dx === correctId;

    var hist = historyScore();
    var pts = CASE.auscultation.points;
    var abnPts = pts.filter(function (p) {
      return CASE.auscultation.findings[p.finding].abnormal;
    });
    var heardIds = Object.keys(state.heard);
    var abnFound = abnPts.filter(function (p) { return !!state.heard[p.id]; });
    var ausc = pts.length ? heardIds.length / pts.length : 0;
    var abnRate = abnPts.length ? abnFound.length / abnPts.length : 1;

    var wu = CASE.workup.length ? state.ordered.length / CASE.workup.length : 0;
    var ctDone = state.ordered.indexOf('ct') !== -1;

    var total = Math.round(100 * (
      0.32 * hist +
      0.18 * ausc +
      0.14 * abnRate +
      0.04 * (state.throatDone ? 1 : 0) +
      0.04 * (state.coughed ? 1 : 0) +
      0.08 * wu +
      0.20 * (right ? 1 : 0)
    ));

    var missedQ = CASE.questions.filter(function (q) {
      return q.weight >= 2 && state.asked.indexOf(q.key) === -1;
    });
    var missedPts = abnPts.filter(function (p) { return !state.heard[p.id]; });

    var h = '';

    h += '<div class="result-hero ' + (right ? 'is-right' : 'is-wrong') + '">' +
      '<div class="result-verdict">' + esc(chosen.verdict) + '</div>' +
      '<div class="result-dx">' + esc(chosen.name) + '</div>' +
      '<div class="result-why">' + esc(chosen.why) + '</div>';
    if (!right) {
      var c = pick(CASE.diagnosis.options, correctId);
      h += '<div class="result-why" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">' +
        '<strong>Правильный ответ: ' + esc(c.name) + '.</strong> ' + esc(c.why) + '</div>';
    }
    h += '</div>';

    h += '<div class="score-row">' +
      tile('Итог', total + ' %', grade(total), band(total)) +
      tile('Анамнез', Math.round(hist * 100) + ' %',
        state.asked.length + ' из ' + CASE.questions.length + ' вопросов', band(hist * 100)) +
      tile('Аускультация', heardIds.length + '/' + pts.length,
        'патология найдена: ' + abnFound.length + ' из ' + abnPts.length, band(abnRate * 100)) +
      tile('Исследования', state.ordered.length + '/' + CASE.workup.length,
        ctDone ? 'КТ назначена' : 'КТ не назначена', band(ctDone ? 100 : 45)) +
      '</div>';

    h += '<div class="block"><h3>Ключевые признаки случая</h3><ul class="keylist">';
    CASE.debrief.keyFindings.forEach(function (k) {
      h += '<li>' + esc(k) + '</li>';
    });
    h += '</ul></div>';

    if (missedQ.length || missedPts.length || !state.throatDone || !ctDone) {
      h += '<div class="block"><h3>Что вы упустили</h3><ul class="keylist">';
      missedQ.forEach(function (q) {
        h += '<li class="is-missed">Не спросили: «' + esc(q.q) + '» ' +
          '<span class="miss-tag">— ' + esc(q.tag) + '</span></li>';
      });
      missedPts.forEach(function (p) {
        h += '<li class="is-missed">Не прослушали ' + esc(p.label) +
          ' <span class="miss-tag">— там были хрипы</span></li>';
      });
      if (!state.throatDone)
        h += '<li class="is-missed">Не осмотрели зев</li>';
      if (!state.coughed)
        h += '<li class="is-missed">Не выполнили пробу с кашлем ' +
          '<span class="miss-tag">— она отличает секрет в бронхах от фиброза</span></li>';
      if (!ctDone)
        h += '<li class="is-missed">Не назначили КТ ' +
          '<span class="miss-tag">— золотой стандарт при подозрении на бронхоэктазы</span></li>';
      h += '</ul></div>';
    } else {
      h += '<div class="block"><h3>Полнота осмотра</h3>' +
        '<p>Осмотр проведён полностью: анамнез собран, все поля прослушаны, ' +
        'патология найдена во всех зонах, зев осмотрен, КТ назначена.</p></div>';
    }

    h += '<div class="block"><h3>Ловушка этого случая</h3><p>' +
      esc(CASE.debrief.trap) + '</p></div>';

    h += '<div class="block"><h3>Разбор остальных вариантов</h3>';
    CASE.diagnosis.options.forEach(function (o) {
      if (o.id === state.dx) return;
      h += '<div class="alt"><div class="alt-name">' + esc(o.name) +
        '<span class="alt-verdict">' + esc(o.verdict) + '</span></div>' +
        '<div class="alt-why">' + esc(o.why) + '</div></div>';
    });
    h += '</div>';

    h += '<div class="block"><h3>Дальнейшая тактика</h3><p>' +
      esc(CASE.debrief.nextSteps) + '</p></div>';

    $('debrief').innerHTML = h;
  }

  function tile(label, value, note, cls) {
    return '<div class="score ' + cls + '">' +
      '<div class="score-label">' + label + '</div>' +
      '<div class="score-value">' + value + '</div>' +
      '<div class="score-note">' + note + '</div></div>';
  }

  function band(pct) { return pct >= 80 ? 'is-good' : pct >= 50 ? 'is-mid' : 'is-bad'; }

  function grade(t) {
    return t >= 85 ? 'осмотр проведён образцово' :
           t >= 70 ? 'хорошо, но есть пробелы' :
           t >= 50 ? 'осмотр поверхностный' :
                     'ключевые данные не собраны';
  }

  function pick(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return arr[0];
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  init();
})();
