/* Раздел преподавателя: методичка по случаям, критерии оценки и журнал
   результатов.

   Методичка рендерится из тех же файлов персонажей, что питают тренажёр, —
   отдельных «данных для преподавателя» нет: новый случай в manifest.js
   появляется здесь сам. Журнал принимает коды результатов (score.js,
   строка VP1.…), пересчитывает оценку из протокола приёма и хранит записи
   в localStorage этого браузера.

   Один IIFE, ES5, без сети. */
(function () {
  'use strict';

  var MANIFEST_BUILT = window.CHARACTER_MANIFEST || [];
  var MANIFEST = MANIFEST_BUILT.slice();
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function cases() { return window.CASES || []; }

  /* Кастомные случаи живут в localStorage: их записи манифеста дописываются
     к встроенным, а сами случаи разворачиваются inflate() прямо в
     window.CASES — иначе журнал не смог бы пересчитать коды студентов,
     прошедших кастомный приём. */
  function refreshCustoms() {
    var have = {};
    MANIFEST = MANIFEST_BUILT.slice();
    MANIFEST.forEach(function (m) { have[m.file] = 1; });

    if (window.CustomCases) {
      window.CASES = cases().filter(function (C) { return !C.custom; });
      window.CustomCases.list().forEach(function (d) {
        window.CASES.push(window.CustomCases.inflate(d));
      });
      window.CustomCases.manifestEntries().forEach(function (m) {
        if (!have[m.file]) { have[m.file] = 1; MANIFEST.push(m); }
      });
    }
    if (activeChar >= MANIFEST.length) activeChar = 0;
  }

  function caseByManifest(m) {
    var want = m.file.replace(/\.js$/, '');
    var all = cases(), i;
    for (i = 0; i < all.length; i++) if (all[i].id === want) return all[i];
    return null;
  }

  var activeChar = 0;

  /* =========================================================
     Загрузка всех персонажей из манифеста
     ========================================================= */

  /* Динамические <script> исполняются не по порядку вставки, поэтому
     считаем завершённые и рендерим, когда готовы все. Ошибка загрузки
     тоже засчитывается: методичка покажет, какой файл не поднялся.
     Кастомные записи файлов не имеют — они уже в CASES после
     refreshCustoms(), и загружать их не нужно. */
  function loadAll(onDone) {
    var files = MANIFEST.filter(function (m) { return !m.custom; });
    var left = files.length;
    if (!left) { onDone(); return; }
    files.forEach(function (m) {
      var s = document.createElement('script');
      s.src = 'characters/' + m.file;
      s.onload = s.onerror = function () {
        left--;
        if (!left) onDone();
      };
      document.head.appendChild(s);
    });
  }

  /* =========================================================
     Аудио: один плеер на страницу
     ========================================================= */

  var audio = null;
  var playingBtn = null;
  var chain = null;   /* очередь «Прослушать все ответы» */

  function ensureAudio() {
    if (audio) return;
    audio = new Audio();
    audio.addEventListener('ended', function () {
      markBtn(playingBtn, false);
      playingBtn = null;
      if (chain && chain.length) {
        var next = chain.shift();
        playingBtn = next;
        markBtn(next, true);
        audio.src = next.getAttribute('data-audio');
        audio.currentTime = 0;
        tryPlay();
      } else {
        chain = null;
      }
    });
  }

  function markBtn(b, on) { if (b) b.classList.toggle('is-playing', on); }

  function tryPlay() {
    try {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { stopAudio(); });
    } catch (e) { stopAudio(); }
  }

  function stopAudio() {
    if (!audio) return;
    audio.pause();
    markBtn(playingBtn, false);
    playingBtn = null;
    chain = null;
  }

  function playSrc(src) {
    ensureAudio();
    stopAudio();
    audio.src = src;
    audio.currentTime = 0;
    tryPlay();
  }

  function toggleAudioBtn(btn) {
    ensureAudio();
    if (playingBtn === btn) { stopAudio(); return; }
    chain = null;
    playingBtn = btn;
    markBtn(btn, true);
    audio.src = btn.getAttribute('data-audio');
    audio.currentTime = 0;
    tryPlay();
  }

  function playAllAudio() {
    ensureAudio();
    /* Только реплики пациента; звуки лёгких из блока аускультации
       в очередь не идут — у них своя кнопка прослушивания. */
    var all = document.querySelectorAll('#methodBody .m-audio');
    var btns = [];
    Array.prototype.forEach.call(all, function (b) {
      if (!b.closest('.m-ausc')) btns.push(b);
    });
    if (!btns.length) return;
    stopAudio();
    chain = Array.prototype.slice.call(btns);
    var first = chain.shift();
    playingBtn = first;
    markBtn(first, true);
    audio.src = first.getAttribute('data-audio');
    audio.currentTime = 0;
    tryPlay();
  }

  /* =========================================================
     Верхние вкладки
     ========================================================= */

  function bindTabs() {
    Array.prototype.forEach.call($('ttabs').children, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call($('ttabs').children, function (x) {
          x.classList.toggle('is-on', x === b);
        });
        ['method', 'journal', 'criteria', 'constructor'].forEach(function (t) {
          var sec = $('tab-' + t);
          if (sec) sec.hidden = (t !== b.getAttribute('data-tab'));
        });
      });
    });
  }

  /* =========================================================
     Методичка: вкладки персонажей
     ========================================================= */

  function renderCharTabs() {
    var box = $('charTabs');
    box.innerHTML = '';
    MANIFEST.forEach(function (m, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'char-tab' + (m.custom ? ' is-custom' : '') +
                    (i === activeChar ? ' is-on' : '');
      b.innerHTML = '<span class="ct-label">' + esc(m.label) + '</span>' +
                    '<span class="ct-dis">' + esc(m.disease) +
                    (m.custom ? ' · свой случай' : '') + '</span>';
      b.addEventListener('click', function () {
        if (i === activeChar) return;
        stopAudio();
        activeChar = i;
        renderCharTabs();
        renderMethod();
      });
      box.appendChild(b);
    });
  }

  /* =========================================================
     Методичка: рендер случая
     ========================================================= */

  var ORDER_GROUPS = [
    { role: 'need',   title: 'Обязательно',       cls: 'is-ok' },
    { role: 'useful', title: 'Полезно',           cls: 'is-mid' },
    { role: 'waste',  title: 'Назначено зря',     cls: 'is-warn' }
  ];

  var TREAT_GROUPS = [
    { role: 'need',   title: 'Нужное',                 cls: 'is-ok' },
    { role: 'useful', title: 'Полезное',               cls: 'is-mid' },
    { role: 'harm',   title: 'Вредное — прямая ошибка', cls: 'is-bad' }
  ];

  function badge(text, cls) {
    return '<span class="m-badge ' + (cls || '') + '">' + esc(text) + '</span>';
  }

  function audioBtn(src) {
    if (!src) return '';
    return '<button class="m-audio" type="button" data-audio="' + esc(src) + '">' +
      '<span class="m-audio-ico" aria-hidden="true"></span>слушать</button>';
  }

  function sec(title, inner) {
    return '<section class="m-sec"><h3>' + title + '</h3>' + inner + '</section>';
  }

  function runLink(text, href, cls) {
    return '<a class="btn ' + (cls || 'btn-ghost') + ' btn-sm" href="' + esc(href) + '">' +
           esc(text) + '</a>';
  }

  function chestSvg(C) {
    var points = '';
    var pts = (C.auscultation && C.auscultation.points) || [];
    var finds = (C.auscultation && C.auscultation.findings) || {};
    pts.forEach(function (p) {
      var f = finds[p.finding] || {};
      points += '<g class="m-point' + (f.abnormal ? ' is-abn' : '') + '"' +
        ' data-point="' + esc(p.id) + '" tabindex="0" role="button"' +
        ' aria-label="' + esc(p.label) + '">' +
        '<circle class="mpt-ring" cx="' + p.x + '" cy="' + p.y + '" r="11.5"/>' +
        '<circle class="mpt-core" cx="' + p.x + '" cy="' + p.y + '" r="3.6"/></g>';
    });
    return $('chestTpl').innerHTML.replace('<g class="chest-points"></g>', points);
  }

  /* Миниатюра снимка у обследования/приёма (кастомные случаи). */
  function thumb(src) {
    if (!src) return '';
    return '<img class="m-thumb" src="' + esc(src) + '" alt="Снимок — результат исследования">';
  }

  function auscBlock(C, e) {
    var legend = '';
    Object.keys(C.auscultation.findings).forEach(function (k) {
      var f = C.auscultation.findings[k];
      var where = [];
      C.auscultation.points.forEach(function (p) {
        if (p.finding === k) where.push(p.label);
      });
      legend += '<div class="m-find' + (f.abnormal ? ' is-abn' : '') + '">' +
        '<div class="m-find-head">' +
          '<span class="m-find-title">' + esc(f.title) + '</span>' +
          badge(f.abnormal ? 'патология' : 'норма', f.abnormal ? 'is-bad' : 'is-ok') +
          audioBtn(f.audio) +
        '</div>' +
        '<div class="m-find-desc">' + esc(f.desc) + '</div>' +
        '<div class="m-find-where">' + esc(where.join(' · ')) + '</div>' +
      '</div>';
    });

    return '<div class="m-ausc">' +
      '<div class="m-item-head">' +
        '<span class="m-item-label">' + esc(e.title || e.label) + '</span>' +
        badge(e.findAbnormal ? 'патология' : 'без патологии', e.findAbnormal ? 'is-bad' : 'is-ok') +
        badge('вес ' + (e.weight || 0), 'is-dim') +
      '</div>' +
      '<div class="m-ausc-body">' +
        '<div class="m-chest">' + chestSvg(C) + '</div>' +
        '<div class="m-ausc-side">' +
          '<div class="m-readout" id="mReadout">Нажмите точку на схеме, чтобы прослушать её.</div>' +
          legend +
        '</div>' +
      '</div>' +
      '<p class="m-ausc-hint">Вид со спины: правое лёгкое пациента — слева от вас. Патология выявляется контрастом между полями.</p>' +
    '</div>';
  }

  function renderMethod() {
    var m = MANIFEST[activeChar];
    var C = caseByManifest(m);
    var box = $('methodBody');
    if (!C) {
      box.innerHTML = '<div class="m-sec"><p class="m-load-err">Файл случая не загрузился: ' +
        esc(m.file) + '</p></div>';
      return;
    }

    var h = '';

    /* Шапка: кто перед студентом и как запустить. */
    h += '<div class="m-head">' +
      '<div class="m-head-txt">' +
        '<h2>' + esc(C.title) + '</h2>' +
        '<p class="m-dis">' + esc(C.disease) + ' · ' + esc(m.label) + '</p>' +
        '<p class="m-stats">' + C.questions.length + ' вопросов · ' + C.exams.length +
          ' приёмов осмотра · ' + C.orders.length + ' обследований · ' +
          C.treatment.length + ' назначений лечения · ' + (C.algorithm || []).length +
          ' правил порядка</p>' +
      '</div>' +
      '<div class="m-run">' +
        runLink('Запустить случай', 'priem.html?char=' + C.id, 'btn-primary') +
        runLink('Идеальный приём', 'priem.html?char=' + C.id + '&demo=1') +
        runLink('Разбор идеального приёма', 'priem.html?char=' + C.id + '&demo=1&finish=1') +
      '</div>' +
    '</div>';

    /* У кастомного случая блоки разбора могут быть не заполнены —
       пустые не показываем вовсе. */
    var deb = C.debrief || {};
    if (deb.trap) {
      h += '<div class="m-trap"><h3>Ловушка случая</h3><p>' + esc(deb.trap) + '</p></div>';
    }

    /* Вступительная жалоба — тоже ответ, начинается последовательность. */
    h += '<div class="m-greet">' +
      '<div class="m-greet-head"><span class="m-greet-label">Вступительная жалоба</span>' +
        audioBtn(C.patient.greeting.audio) + '</div>' +
      '<p class="m-greet-text">«' + esc(C.patient.greeting.text) + '»</p>' +
    '</div>';

    /* Паспортная часть. */
    var pass = '';
    C.passport.forEach(function (p) {
      pass += '<div class="m-pass' + (p.important ? ' is-imp' : '') + '">' +
        '<div class="m-pass-row">' +
          '<span class="mp-field">' + esc(p.field) + '</span>' +
          '<span class="mp-val">' + esc(p.value) + '</span>' +
          (p.important ? badge('важное', 'is-imp') : '') +
          audioBtn(p.audio) +
        '</div>' +
        '<div class="mp-text">«' + esc(p.text) + '»</div>' +
        (p.important && p.why ? '<div class="mp-why">' + esc(p.why) + '</div>' : '') +
      '</div>';
    });
    if (pass) h += sec('Паспортная часть', pass);

    /* Расспрос. */
    var hasVoice = !!C.patient.greeting.audio;
    var qRows = '';
    C.questions.forEach(function (q) {
      if (q.audio) hasVoice = true;
      qRows += '<div class="m-q' + (q.important ? ' is-imp' : '') + '">' +
        '<div class="m-q-head">' +
          '<span class="m-q-label">' + esc(q.label) + '</span>' +
          (q.important ? badge('важный', 'is-imp') : '') +
          badge('вес ' + (q.weight || 1), 'is-dim') +
          audioBtn(q.audio) +
        '</div>' +
        '<div class="m-q-tag">' + esc(q.tag) + '</div>' +
        '<div class="m-q-text">«' + esc(q.text) + '»</div>' +
        (q.why ? '<div class="m-q-why">' + esc(q.why) + '</div>' : '') +
      '</div>';
    });
    /* «Прослушать все» без единой озвученной реплики бессмысленна —
       кастомные случаи голоса не имеют. */
    var qs = hasVoice
      ? '<div class="m-sec-head">' +
        '<button class="btn btn-ghost btn-sm m-playall" type="button">Прослушать все ответы</button>' +
        '<span class="m-sec-note">реплики идут подряд: жалоба → паспорт → вопросы</span></div>' + qRows
      : qRows;
    if (qRows) h += sec('Расспрос', qs);

    /* Показатели. */
    var vs = '';
    C.vitals.forEach(function (v) {
      vs += '<div class="m-vital' + (v.abnormal ? ' is-abn' : '') + '">' +
        '<div class="mv-row">' +
          '<span class="mv-field">' + esc(v.field) + '</span>' +
          '<span class="mv-val">' + esc(v.value) + (v.unit ? ' ' + esc(v.unit) : '') + '</span>' +
          badge(v.abnormal ? 'отклонение' : 'норма', v.abnormal ? 'is-bad' : 'is-ok') +
          badge('вес ' + (v.weight || 1), 'is-dim') +
        '</div>' +
        (v.note ? '<div class="mv-note">' + esc(v.note) + '</div>' : '') +
        (v.tech ? '<div class="mv-tech">Методика: ' + esc(v.tech) + '</div>' : '') +
      '</div>';
    });
    if (vs) h += sec('Показатели', vs);

    /* Физикальный осмотр; на месте аускультации — карта точек. */
    var ex = '';
    C.exams.forEach(function (e) {
      if (e.kind === 'auscult' && C.auscultation && (C.auscultation.points || []).length) {
        ex += auscBlock(C, e);
        return;
      }
      ex += '<div class="m-exam' + (e.findAbnormal ? ' is-abn' : '') + '">' +
        '<div class="m-item-head">' +
          '<span class="m-item-label">' + esc(e.title || e.label) + '</span>' +
          badge(e.findAbnormal ? 'патология' : 'норма', e.findAbnormal ? 'is-bad' : 'is-ok') +
          badge('вес ' + (e.weight || 0), 'is-dim') +
        '</div>' +
        (e.result ? '<div class="m-item-res">' + esc(e.result) + '</div>' : '') +
        (e.why ? '<div class="m-item-why">' + esc(e.why) + '</div>' : '') +
        thumb(e.img) +
      '</div>';
    });
    if (ex) h += sec('Физикальный осмотр', ex);

    /* Обследование по ролям. */
    var os = '';
    ORDER_GROUPS.forEach(function (g) {
      var list = C.orders.filter(function (o) { return o.role === g.role; });
      if (!list.length) return;
      os += '<div class="m-group ' + g.cls + '"><h4>' + esc(g.title) +
        '<span class="m-count">' + list.length + '</span></h4>';
      list.forEach(function (o) {
        os += '<div class="m-item">' +
          '<div class="m-item-head">' +
            '<span class="m-item-label">' + esc(o.label) + '</span>' +
            badge('вес ' + (o.weight || 0), 'is-dim') +
          '</div>' +
          (o.result ? '<div class="m-item-res">' + esc(o.result) + '</div>' : '') +
          (o.hint ? '<div class="m-item-why">' + esc(o.hint) + '</div>' : '') +
          thumb(o.img) +
        '</div>';
      });
      os += '</div>';
    });
    if (os) h += sec('Обследование', os);

    /* Лечение по ролям. */
    var ts = '';
    TREAT_GROUPS.forEach(function (g) {
      var list = C.treatment.filter(function (x) { return x.role === g.role; });
      if (!list.length) return;
      ts += '<div class="m-group ' + g.cls + '"><h4>' + esc(g.title) +
        '<span class="m-count">' + list.length + '</span></h4>';
      list.forEach(function (x) {
        ts += '<div class="m-item">' +
          '<div class="m-item-head">' +
            '<span class="m-item-label">' + esc(x.label) + '</span>' +
            badge('вес ' + (x.weight || 0), 'is-dim') +
          '</div>' +
          (x.hint ? '<div class="m-item-why">' + esc(x.hint) + '</div>' : '') +
        '</div>';
      });
      ts += '</div>';
    });
    if (ts) h += sec('Лечение', ts);

    /* Диагноз. */
    var ds = '';
    (C.diagnosis.options || []).forEach(function (o) {
      var ok = o.id === C.diagnosis.correct;
      ds += '<div class="m-dx' + (ok ? ' is-ok' : '') + '">' +
        '<div class="m-item-head">' +
          '<span class="m-item-label">' + esc(o.label) + '</span>' +
          (ok ? badge('верный ответ', 'is-imp') : '') +
          (o.verdict ? '<span class="m-dx-verdict">' + esc(o.verdict) + '</span>' : '') +
        '</div>' +
        (o.why ? '<div class="m-item-why">' + esc(o.why) + '</div>' : '') +
      '</div>';
    });
    if (ds) h += sec('Диагноз', ds);

    /* Алгоритм: правила описываются, функции не исполняются. */
    if ((C.algorithm || []).length) {
      var als = '<p class="m-algo-note">Правила на порядок действий. Правило с пометкой' +
        ' «предпосылка» включается в оценку, только если ситуация возникла; без' +
        ' пометки — в игре всегда.</p>';
      C.algorithm.forEach(function (r) {
        als += '<div class="m-rule">' +
          '<div class="m-rule-head">' +
            '<span class="m-rule-text">' + esc(r.text) + '</span>' +
            (typeof r.when === 'function' ? badge('предпосылка', 'is-warn')
                                          : badge('всегда в игре', 'is-dim')) +
          '</div>' +
          (r.why ? '<div class="m-rule-why">' + esc(r.why) + '</div>' : '') +
        '</div>';
      });
      h += sec('Алгоритм приёма — ' + C.algorithm.length + ' правил', als);
    }

    /* Ключевые находки и тактика. */
    if (deb.keyFindings && deb.keyFindings.length) {
      var keys = '<ul class="m-keys">';
      deb.keyFindings.forEach(function (k) { keys += '<li>' + esc(k) + '</li>'; });
      keys += '</ul>';
      h += sec('Ключевые находки', keys);
    }

    if (deb.nextSteps) {
      h += sec('Тактика после диагноза', '<p class="m-next">' + esc(deb.nextSteps) + '</p>');
    }

    box.innerHTML = h;
  }

  /* Клик по методичке: аудио-кнопки, карта точек, «прослушать все». */
  function bindMethod() {
    $('methodBody').addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var b = t.closest('.m-audio');
      if (b) { toggleAudioBtn(b); return; }
      if (t.closest('.m-playall')) { playAllAudio(); return; }
      var pt = t.closest('.m-point');
      if (pt) { playPoint(pt); }
    });

    $('methodBody').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var pt = e.target && e.target.closest ? e.target.closest('.m-point') : null;
      if (pt) { e.preventDefault(); playPoint(pt); }
    });
  }

  function playPoint(el) {
    var m = MANIFEST[activeChar];
    var C = caseByManifest(m);
    if (!C || !C.auscultation) return;
    var pts = C.auscultation.points || [];
    var p = null, i;
    for (i = 0; i < pts.length; i++) {
      if (pts[i].id === el.getAttribute('data-point')) p = pts[i];
    }
    if (!p) return;
    var f = (C.auscultation.findings || {})[p.finding];
    if (!f) return;
    var ro = $('mReadout');
    if (ro) {
      ro.innerHTML = '<b>' + esc(p.label) + '</b> — ' + esc(f.title) + ' ' +
        badge(f.abnormal ? 'патология' : 'норма', f.abnormal ? 'is-bad' : 'is-ok') +
        '<span class="m-readout-note">' + esc(f.desc) + '</span>';
    }
    playSrc(f.audio);
  }

  /* =========================================================
     Критерии оценки
     ========================================================= */

  function renderCriteria() {
    var W = Score.WEIGHTS, L = Score.TILE_LABELS;
    var notes = {
      ask: 'Доля заданных вопросов, взвешенная по весам вопросов.',
      pass: 'Доля собранных полей; важные поля весят вдвое больше обычных.',
      vit: 'Доля измеренных показателей, взвешенная по весам.',
      exam: 'Приёмы осмотра по весам. Аускультация — отдельно: 0,4 × охват полей + 0,6 × доля найденной патологии.',
      order: 'Нужное и полезное по весам; каждое назначение «зря» вычитает 0,10 из плитки (до нуля).',
      treat: 'Нужное и полезное по весам; каждое вредное назначение вычитает 0,20 (до нуля).',
      dx: 'Верный диагноз — 100 %, неверный или не поставленный — 0 %.',
      algo: 'Доля соблюдённых правил среди возникших. У правила есть предпосылка: не возникла — правило не в счёте.'
    };

    var h = '<div class="crit-intro">' +
      '<p>Итог приёма — взвешенная сумма восьми плиток, от 0 до 100 %.' +
      ' Балл всегда пересчитывается из протокола приёма: в коде результата,' +
      ' который присылает студент, готового балла нет.</p></div>';

    h += '<div class="crit-grid">';
    Object.keys(L).forEach(function (k) {
      h += '<div class="crit"><div class="crit-w">' + Math.round(W[k] * 100) +
        ' %</div><div class="crit-body"><b>' + esc(L[k]) + '</b>' +
        '<span>' + esc(notes[k]) + '</span></div></div>';
    });
    h += '</div>';

    h += '<div class="crit-grades">' +
      '<h3>Градации итога</h3>' +
      '<div class="cg-row"><b>85–100 %</b><span>приём проведён образцово</span></div>' +
      '<div class="cg-row"><b>70–84 %</b><span>хорошо, но есть пробелы</span></div>' +
      '<div class="cg-row"><b>50–69 %</b><span>приём поверхностный</span></div>' +
      '<div class="cg-row"><b>0–49 %</b><span>ключевые данные не собраны</span></div>' +
    '</div>';

    $('criteriaBody').innerHTML = h;
  }

  /* =========================================================
     Журнал результатов
     ========================================================= */

  var STORE_KEY = 'vp.teacher.journal.v1';
  var entries = [];
  var openIdx = -1;

  var storageOk = (function () {
    try {
      localStorage.setItem('vp.t', '1');
      localStorage.removeItem('vp.t');
      return true;
    } catch (e) { return false; }
  })();

  var CAT_NAME = {
    passport: 'Паспорт', ask: 'Расспрос', measure: 'Измерение',
    exam: 'Осмотр', order: 'Обследование', treat: 'Лечение', dx: 'Диагноз'
  };

  function loadEntries() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      if (Object.prototype.toString.call(raw) === '[object Array]') {
        raw.forEach(function (e) {
          if (e && typeof e.code === 'string') {
            entries.push({ code: e.code, addedAt: +e.addedAt || 0 });
          }
        });
      }
    } catch (e) { /* пустой или битый журнал начинаем с нуля */ }
  }

  function saveEntries() {
    if (!storageOk) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(entries)); }
    catch (e) { /* переполнено — журнал живёт до перезагрузки */ }
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function shortCode(code) {
    var s = String(code || '');
    return s.length > 24 ? s.slice(0, 24) + '…' : s;
  }

  /* Строка-продолжение (код разорван переносом) приклеивается к предыдущей;
     несколько кодов через пробел разводятся по строкам. */
  function splitCodes(text) {
    var out = [];
    var txt = String(text || '').replace(/\s+(?=VP1\.)/g, '\n');
    txt.split(/[\r\n]+/).forEach(function (raw) {
      var line = raw.replace(/^\s+|\s+$/g, '');
      if (!line) return;
      if (line.indexOf('VP1.') === 0) { out.push(line); return; }
      if (out.length && /^[A-Za-z0-9+/=]+$/.test(line)) {
        out[out.length - 1] += line;
        return;
      }
      out.push(line);
    });
    return out;
  }

  function addCodes(codes) {
    var errors = [], added = 0, dups = 0;

    codes.forEach(function (code) {
      var r = Score.decodeResult(code, cases());
      if (r.error) { errors.push({ code: code, error: r.error }); return; }

      /* Канонический вид: как ни был разорван код при пересылке, одинаковые
         результаты дают одну строку — и дедупликация их ловит. */
      var canon = Score.encodeResult(r.CASE, r.session,
        { name: r.meta.name, group: r.meta.group });

      var dup = entries.some(function (e) { return e.code === canon; });
      if (dup) { dups++; return; }

      entries.push({ code: canon, addedAt: Date.now() });
      added++;
    });

    if (added) {
      saveEntries();
      openIdx = entries.length - added;   /* раскрыть первую новую запись */
    }
    renderJournal(errors, dups);
  }

  function initJournal() {
    loadEntries();

    $('jStorageNote').textContent = storageOk
      ? 'Записи хранятся в этом браузере'
      : 'Браузер не даёт сохранить журнал — записи живут до перезагрузки. Скачивайте CSV как резервную копию.';

    $('jAdd').addEventListener('click', function () {
      var codes = splitCodes($('jInput').value);
      $('jInput').value = '';
      addCodes(codes);
    });

    $('jFiles').addEventListener('change', function () {
      var files = this.files;
      if (!files || !files.length) return;
      var left = files.length, texts = [];
      function done() {
        if (--left) return;
        addCodes(splitCodes(texts.join('\n')));
      }
      Array.prototype.forEach.call(files, function (f) {
        var r = new FileReader();
        r.onload = function () { texts.push(String(r.result || '')); done(); };
        r.onerror = function () { texts.push(''); done(); };
        r.readAsText(f, 'utf-8');
      });
      this.value = '';   /* тот же файл можно выбрать снова */
    });

    $('jCsv').addEventListener('click', downloadCsv);

    $('jClear').addEventListener('click', function () {
      if (!entries.length) return;
      if (!window.confirm('Удалить все записи журнала (' + entries.length + ')?\nДействие необратимо.')) return;
      entries = [];
      openIdx = -1;
      saveEntries();
      renderJournal();
    });

    $('jTable').addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var del = t.closest('.j-del');
      if (del) {
        var i = parseInt(del.getAttribute('data-del'), 10);
        if (!isNaN(i) && i >= 0 && i < entries.length) {
          entries.splice(i, 1);
          if (openIdx === i) openIdx = -1;
          else if (openIdx > i) openIdx--;
          saveEntries();
          renderJournal();
        }
        return;
      }

      var row = t.closest('.j-row[data-idx]');
      if (row) {
        var j = parseInt(row.getAttribute('data-idx'), 10);
        openIdx = (openIdx === j) ? -1 : j;
        renderJournal();
      }
    });

    renderJournal();
  }

  function renderJournal(errors, dups) {
    var errBox = $('jErrors');

    if (errors && errors.length) {
      errBox.hidden = false;
      errBox.innerHTML = '<b>Не добавлено: ' + errors.length + '</b>' +
        errors.map(function (x) {
          return '<div class="j-err">' + esc(shortCode(x.code)) + ' — ' +
            esc(x.error) + '</div>';
        }).join('') +
        (dups ? '<div class="j-dup">Ещё ' + dups + ' — уже есть в журнале.</div>' : '');
    } else if (dups) {
      errBox.hidden = false;
      errBox.innerHTML = '<div class="j-dup">' +
        (dups === 1 ? 'Этот код уже есть' : 'Эти коды уже есть') +
        ' в журнале — повторно не добавлен' + (dups === 1 ? '' : 'ы') + '.</div>';
    } else {
      errBox.hidden = true;
      errBox.innerHTML = '';
    }

    renderSummary();
    renderTable();
  }

  function decodeAll() {
    return entries.map(function (e) {
      return Score.decodeResult(e.code, cases());
    });
  }

  /* -------- Сводка по группе -------- */

  function renderSummary() {
    var box = $('jSummary');
    var rs = decodeAll().filter(function (r) { return !r.error; });
    if (!rs.length) { box.hidden = true; box.innerHTML = ''; return; }

    var n = rs.length;

    /* средние по плиткам */
    var sums = { ask: 0, pass: 0, vit: 0, exam: 0, order: 0, treat: 0, dx: 0, algo: 0, total: 0 };
    var dxCounts = {};
    var missedCounts = {};
    var violCounts = {};

    rs.forEach(function (r) {
      var s = Score.compute(r.CASE, r.session);
      Object.keys(sums).forEach(function (k) {
        sums[k] += (k === 'dx') ? (s.dx ? 1 : 0) : (k === 'total' ? s.total : s[k]);
      });

      /* какой диагноз выставлен */
      var dxLabel = 'не поставлен';
      r.CASE.diagnosis.options.forEach(function (o) {
        if (o.id === r.session.dx) dxLabel = o.label;
      });
      dxCounts[dxLabel] = (dxCounts[dxLabel] || 0) + 1;

      /* пропуски: срывы по пунктам, чтобы видеть частые пробелы группы */
      Score.missedGroups(r.CASE, r.session).forEach(function (g) {
        g.items.forEach(function (it) {
          var key = r.CASE.disease + '|' + it.label;
          missedCounts[key] = (missedCounts[key] || 0) + 1;
        });
      });

      /* нарушения алгоритма */
      var t = Score.timeline(r.session.log);
      Score.violations(r.CASE, t).forEach(function (v) {
        violCounts[v.text] = (violCounts[v.text] || 0) + 1;
      });
    });

    function topList(counts, limit, fmt) {
      var arr = Object.keys(counts).map(function (k) {
        return { k: k, n: counts[k] };
      });
      arr.sort(function (a, b) { return b.n - a.n; });
      return arr.slice(0, limit).map(function (x) {
        return '<li><span class="j-top-n">' + x.n + '</span>' + esc(fmt(x)) + '</li>';
      }).join('');
    }

    var tiles = '<div class="scores">';
    Object.keys(Score.TILE_LABELS).forEach(function (k) {
      var pct = Math.round(sums[k] / n * 100);
      var note = (k === 'dx') ? 'верных диагнозов' : 'среднее по группе';
      tiles += '<div class="score ' + Score.band(pct) + '">' +
        '<div class="score-label">' + esc(Score.TILE_LABELS[k]) + '</div>' +
        '<div class="score-value">' + pct + ' %</div>' +
        '<div class="score-note">' + esc(note) + '</div></div>';
    });
    tiles += '<div class="score ' + Score.band(Math.round(sums.total / n)) + '">' +
      '<div class="score-label">Итог, среднее</div>' +
      '<div class="score-value">' + Math.round(sums.total / n) + ' %</div>' +
      '<div class="score-note">по ' + n + ' результат' +
      (n % 10 === 1 && n % 100 !== 11 ? 'у' : 'ам') + '</div></div>';
    tiles += '</div>';

    var missedTop = topList(missedCounts, 5, function (x) {
      var parts = x.k.split('|');
      return parts[1] + ' <span class="j-top-dis">(' + parts[0] + ')</span>';
    });
    var violTop = topList(violCounts, 5, function (x) { return x.k; });

    var dxRows = Object.keys(dxCounts).sort(function (a, b) {
      return dxCounts[b] - dxCounts[a];
    }).map(function (k) {
      return '<div class="j-dx-row"><span>' + esc(k) + '</span><b>' + dxCounts[k] + '</b></div>';
    }).join('');

    box.innerHTML = '<h3>Сводка по ' + n + ' результат' +
      (n % 10 === 1 && n % 100 !== 11 ? 'у' : 'ам') + '</h3>' + tiles +
      '<div class="j-sum-grid">' +
        '<div class="j-sum-col"><h4>Частые пропуски</h4>' +
          (missedTop ? '<ol class="j-top">' + missedTop + '</ol>'
                     : '<p class="j-sum-empty">Пропусков нет.</p>') + '</div>' +
        '<div class="j-sum-col"><h4>Частые нарушения порядка</h4>' +
          (violTop ? '<ol class="j-top">' + violTop + '</ol>'
                   : '<p class="j-sum-empty">Нарушений нет.</p>') + '</div>' +
        '<div class="j-sum-col"><h4>Выставленные диагнозы</h4>' + dxRows + '</div>' +
      '</div>';
    box.hidden = false;
  }

  /* -------- Таблица -------- */

  function labelMap(C, session) {
    var m = {};
    ['passport', 'questions', 'vitals', 'exams', 'orders', 'treatment'].forEach(function (k) {
      (C[k] || []).forEach(function (x) { m[x.id] = x.label; });
    });
    (C.diagnosis.options || []).forEach(function (o) { m[o.id] = 'Диагноз: ' + o.label; });
    (C.auscultation.points || []).forEach(function (p) {
      m['ausc:' + p.id] = 'Выслушано: ' + p.label;
    });
    m['__dx'] = m[session.dx] || 'Диагноз заявлен';
    return m;
  }

  function renderTable() {
    var box = $('jTable');
    $('jTableTitle').textContent = 'Результаты' +
      (entries.length ? ' — ' + entries.length : '');

    if (!entries.length) {
      box.innerHTML = '<p class="j-empty">Журнал пуст. Вставьте код результата выше.</p>';
      return;
    }

    var h = '<div class="j-row j-head-row">' +
      '<span>ФИО</span><span>Группа</span><span>Случай</span><span>Итог</span>' +
      '<span>Диагноз</span><span class="j-c-num">Действ.</span><span>Время</span>' +
      '<span>Добавлен</span><span></span></div>';

    entries.forEach(function (e, i) {
      var r = Score.decodeResult(e.code, cases());
      if (r.error) {
        h += '<div class="j-row is-err">Код не читается: ' + esc(shortCode(e.code)) + '</div>';
        return;
      }
      var s = Score.compute(r.CASE, r.session);
      var dur = r.session.log.length ? r.session.log[r.session.log.length - 1].ts : 0;

      h += '<div class="j-row' + (openIdx === i ? ' is-open' : '') + '" data-idx="' + i + '"' +
        ' title="Нажмите, чтобы раскрыть разбор">' +
        '<span class="j-name">' + esc(r.meta.name || '—') + '</span>' +
        '<span class="j-group">' + esc(r.meta.group || '—') + ' · ' + (r.meta.mode === 'independent' ? 'самостоятельно' : 'с пояснениями') + '</span>' +
        '<span class="j-case">' + esc(r.CASE.disease) + '</span>' +
        '<span class="j-total ' + Score.band(s.total) + '">' + s.total + ' %</span>' +
        '<span class="j-dx ' + (s.dx ? 'is-ok-text' : 'is-bad-text') + '">' +
          (s.dx ? 'верно' : 'неверно') + '</span>' +
        '<span class="j-c-num">' + r.session.log.length + '</span>' +
        '<span class="j-time">' + Score.mmss(dur) + '</span>' +
        '<span class="j-date">' + fmtDate(e.addedAt) + '</span>' +
        '<button class="j-del" type="button" data-del="' + i + '" title="Удалить запись">×</button>' +
      '</div>';

      if (openIdx === i) h += detailHtml(r, s, e);
    });

    box.innerHTML = h;
  }

  function detailHtml(r, s, entry) {
    var t = Score.timeline(r.session.log);
    var viol = Score.violations(r.CASE, t);
    var groups = Score.missedGroups(r.CASE, r.session);

    var tiles = '<div class="scores">';
    Object.keys(Score.TILE_LABELS).forEach(function (k) {
      var pct = (k === 'dx') ? (s.dx ? 100 : 0) : Math.round(s[k] * 100);
      var val = pct + ' %';
      var note = (k === 'algo') ? 'правил в игре ' + s.rules : '';
      tiles += '<div class="score ' + Score.band(pct) + '">' +
        '<div class="score-label">' + esc(Score.TILE_LABELS[k]) + '</div>' +
        '<div class="score-value">' + val + '</div>' +
        '<div class="score-note">' + esc(note) + '</div></div>';
    });
    tiles += '</div>';

    var v = '';
    if (viol.length) {
      v = '<div class="jd-block"><h4>Нарушения алгоритма — ' + viol.length + '</h4><ul class="jd-list">' +
        viol.map(function (x) { return '<li>' + esc(x.text) + '</li>'; }).join('') +
        '</ul></div>';
    } else {
      v = '<div class="jd-block"><h4>Алгоритм</h4><p class="jd-ok">Нарушений нет:' +
        ' ' + s.rules + ' ' + (s.rules === 1 ? 'правило' : 'правил') + ' в игре, все соблюдены.</p></div>';
    }

    var m = '';

    if (groups.length) {
      m = '<div class="jd-block"><h4>Ошибки и пропуски</h4>';
      groups.forEach(function (g) {
        m += '<div class="jd-group"><b>' + esc(g.title) + ' — ' + g.items.length + '</b><ul class="jd-list">';
        g.items.forEach(function (it) {
          m += '<li>' + esc(it.label) +
            (it.why ? '<span class="jd-why"> — ' + esc(it.why) + '</span>' : '') + '</li>';
        });
        m += '</ul></div>';
      });
      m += '</div>';
    } else {
      m = '<div class="jd-block"><h4>Ошибки и пропуски</h4><p class="jd-ok">Пропусков нет.</p></div>';
    }

    if (r.session.clinicalNotes) m += '<div class="jd-group"><b>Наблюдения студента</b><p class="student-notes">' + esc(r.session.clinicalNotes) + '</p></div>';

    var lm = labelMap(r.CASE, r.session);
    var tl = '<div class="jd-block"><h4>Хронология — ' + r.session.log.length +
      ' действий</h4><ol class="jd-tl">';
    r.session.log.forEach(function (row) {
      tl += '<li><span class="jd-ts">' + Score.mmss(row.ts) + '</span>' +
        '<span class="jd-cat">' + esc(CAT_NAME[row.cat] || '') + '</span>' +
        '<span class="jd-what">' + esc(lm[row.id] || row.id) + '</span></li>';
    });
    tl += '</ol></div>';

    var unknowns = (r.meta.unknowns || []);
    var uk = '';
    if (unknowns.length) {
      uk = '<div class="jd-block"><h4>Нераспознанные вопросы — ' + unknowns.length + '</h4>' +
        '<p class="jd-unk">' + unknowns.map(function (u) { return '«' + esc(u) + '»'; }).join(' · ') + '</p></div>';
    }

    return '<div class="jd">' +
      '<div class="jd-head">' +
        '<b>' + esc(r.meta.name || '—') + '</b>' +
        (r.meta.group ? '<span class="jd-group">' + esc(r.meta.group) + '</span>' : '') +
        '<span class="jd-case">' + esc(r.CASE.disease) + '</span>' +
        '<span class="jd-grade">' + s.total + ' % — ' + esc(Score.grade(s.total)) + '</span>' +
      '</div>' +
      tiles + v + m + uk + tl +
      '<div class="jd-code"><b>Код результата</b>' +
        '<code>' + esc(entry.code) + '</code></div>' +
    '</div>';
  }

  /* -------- CSV -------- */

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadCsv() {
    var head = ['ФИО', 'Группа', 'Случай', 'Итог, %',
      'Расспрос, %', 'Паспортная часть, %', 'Показатели, %', 'Осмотр, %',
      'Обследование, %', 'Лечение, %', 'Диагноз', 'Алгоритм, %',
      'Правил в игре', 'Нарушений', 'Диагноз выставлен',
      'Действий', 'Длительность', 'Добавлен', 'Код'];
    var rows = [head];

    entries.forEach(function (e) {
      var r = Score.decodeResult(e.code, cases());
      if (r.error) {
        rows.push(['', '', 'код не читается', '', '', '', '', '', '', '', '', '',
          '', '', '', '', '', fmtDate(e.addedAt), e.code]);
        return;
      }
      var s = Score.compute(r.CASE, r.session);
      var t = Score.timeline(r.session.log);
      var viol = Score.violations(r.CASE, t);
      var dur = r.session.log.length ? r.session.log[r.session.log.length - 1].ts : 0;
      var dxLabel = 'не поставлен';
      r.CASE.diagnosis.options.forEach(function (o) {
        if (o.id === r.session.dx) dxLabel = o.label;
      });
      rows.push([
        r.meta.name, r.meta.group, r.CASE.disease, s.total,
        Math.round(s.ask * 100), Math.round(s.pass * 100), Math.round(s.vit * 100),
        Math.round(s.exam * 100), Math.round(s.order * 100), Math.round(s.treat * 100),
        dxLabel, Math.round(s.algo * 100),
        s.rules, viol.length, s.dx ? 'верно' : 'неверно',
        r.session.log.length, Score.mmss(dur), fmtDate(e.addedAt), e.code
      ]);
    });

    /* BOM — чтобы Excel и Numbers открыли кириллицу сразу; разделитель «;». */
    var csv = '﻿' + rows.map(function (row) {
      return row.map(csvCell).join(';');
    }).join('\r\n');

    try {
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'журнал-результатов.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    } catch (e) {
      /* файл://-браузер без Blob URL: показываем содержимое в поле ввода */
      $('jInput').value = csv;
    }
  }

  /* =========================================================
     Запуск
     ========================================================= */

  /* Общие случаи преподавателя приходят из облака (модуль синхронизации):
     методичка и журнал стартуют после его готовности, чтобы общие случаи
     сразу были в списке и журнал мог пересчитать их коды. Без модуля или
     без сети — мгновенный старт, как раньше. */
  function start() {
    refreshCustoms();
    loadAll(function () {
      if (!MANIFEST.length) {
        $('methodBody').innerHTML = '<div class="m-sec"><p class="m-load-err">' +
          'Манифест персонажей пуст: characters/manifest.js не подгрузился.</p></div>';
      }
      renderCharTabs();
      renderMethod();
      renderCriteria();
      initJournal();
      bindTabs();
      bindMethod();
    });
  }

  if (window.Sync) { Sync.init(start); } else { start(); }

  /* Сохранение/удаление случая в конструкторе сразу отражается в
     методичке и журнале: кастомы переинфлейтируются, вкладки персонажей
     пересобираются. */
  if (window.CustomCases) {
    window.CustomCases.onChange(function () {
      refreshCustoms();
      renderCharTabs();
      renderMethod();
      renderJournal();
    });
  }

})();
