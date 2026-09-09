/* Витрина: нумерованный выбор случая. Объединённый список — встроенные
   персонажи из characters/manifest.js, общие случаи преподавателя из
   облака (модуль синхронизации, если настроен) и свои случаи из
   CustomCases. Каждый пункт ведёт на priem.html?char=<id>. «Случайный
   пациент» открывает priem.html без ?char= (loader.js выберет сам). Импорт
   читает файл конструктора (маркеры VP-CUSTOM-CASE-V1) и складывает
   его в localStorage.

   Поддержка отладочных параметров: если на витрину пришли с
   ?demo=1 / ?finish=1 / ?dx=..., они прокидываются дальше и на
   тренажёр. Параметр ?char= из собственных ссылок вычищается. */
(function () {
  'use strict';

  var root = document.getElementById('casePicker');
  if (!root) return;
  var CC = window.CustomCases;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Разбор/сборка location.search — чтобы собрать href на тренажёр,
     заменив или вычистив char. */
  function parseQuery() {
    var out = {};
    var s = location.search.replace(/^\?/, '');
    if (!s) return out;
    s.split('&').forEach(function (p) {
      var kv = p.split('=');
      if (kv[0]) { var name=decodeURIComponent(kv[0]); if (!/^(auth|next|code|state|error|error_description|access_token|refresh_token|sb_flow_id)$/.test(name)) out[name] = decodeURIComponent(kv[1] || ''); }
    });
    return out;
  }

  function buildQuery(q) {
    var parts = [];
    for (var k in q) {
      if (q[k] === null || q[k] === undefined || q[k] === '') continue;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(q[k]));
    }
    return parts.length ? '?' + parts.join('&') : '?';
  }

  var mode = /[?&]mode=independent(?:&|$)/.test(location.search) ? 'independent' : 'learning';
  function hrefFor(file) {
    var q = parseQuery();
    q.mode = mode;
    q.char = file.replace(/\.js$/, '');
    return 'priem.html' + buildQuery(q);
  }

  function randomHref() {
    var q = parseQuery();
    q.mode = mode;
    delete q.char;
    var b = buildQuery(q);
    return 'priem.html' + (b === '?' ? '' : b);
  }

  /* Объединённый список: встроенные, затем свои и общие (самые свежие —
     первыми, manifestEntries отдаёт по времени). Дедуп по file: случай,
     уже импортированный локально, не должен дублировать общую версию. */
  function entries() {
    var out = (window.CHARACTER_MANIFEST || []).slice();
    var have = {};
    out.forEach(function (m) { have[m.file] = 1; });
    if (CC) {
      CC.manifestEntries().forEach(function (m) {
        if (!have[m.file]) { have[m.file] = 1; out.push(m); }
      });
    }
    return out;
  }

  var noteEl = null;
  function note(msg, bad) {
    if (!noteEl) return;
    noteEl.textContent = msg || '';
    noteEl.className = 'picker-note' + (bad ? ' is-bad' : '');
  }

  function render() {
    var card = document.getElementById('studentCard');
    if (card) card.href = randomHref();
    var html = '<div class="picker-actions">' +
      '<a class="btn btn-primary" href="' + esc(randomHref()) + '">Случайный пациент</a>' +
      '<label class="btn btn-ghost picker-import">Импорт случая (.js)' +
      '<input type="file" id="pickerImport" accept=".js,.txt"></label>' +
      '<button type="button" class="btn btn-ghost" id="pickerTextToggle">Вставить текст</button>' +
      '</div>' +
      '<div class="picker-text" id="pickerTextWrap" hidden>' +
        '<textarea id="pickerTextIn" rows="4" spellcheck="false" ' +
          'placeholder="Вставьте сюда текст случая из мессенджера: маркеры ' +
          '// >>> VP-CUSTOM-CASE-V1 >>> или голый JSON"></textarea>' +
        '<button type="button" class="btn btn-primary btn-sm" id="pickerTextGo">' +
          'Импортировать из текста</button>' +
      '</div>';

    var list = entries();
    var count = document.getElementById('caseCount');
    if (count) count.textContent = 'Случаев в каталоге: ' + list.length + ' · реплики и доступные аудиозаписи';
    if (!list.length) {
      html += '<p class="picker-note">Нет ни одного случая.</p>';
    } else {
      html += '<ol class="picker-list">';
      list.forEach(function (m, i) {
        html += '<li><a class="picker-item" href="' + esc(hrefFor(m.file)) + '">' +
          '<span class="picker-num">' + (i + 1) + '</span>' +
          '<span class="picker-body">' +
          '<span class="picker-disease">' + esc(m.disease) + '</span>' +
          '<span class="picker-label">' + esc(m.label) + '</span>' +
          (m.custom
            ? (m.shared
              ? '<span class="picker-shared">случай преподавателя</span>'
              : '<span class="picker-custom">свой случай</span>')
            : '') +
          '</span></a>';
        /* Кнопка удаления — только у локально сохранённых своих случаев:
           общие публикуются преподавателем, студент их не снимает. */
        if (m.custom && !m.shared) {
          html += '<button type="button" class="picker-del" title="Удалить свой случай" ' +
            'data-id="' + esc(m.file.replace(/\.js$/, '')) + '">×</button>';
        }
        html += '</li>';
      });
      html += '</ol>';
    }
    html += '<p class="picker-note" id="pickerNote"></p>';
    root.innerHTML = html;
    noteEl = document.getElementById('pickerNote');
    note('');
  }

  /* Общий финал импорта — и файлом, и вставленным текстом. */
  function finishImport(res) {
    if (res.error) { note('Импорт не сработал: ' + res.error, true); return; }
    /* Импортированная копия получает новый id, чтобы не затирать
       имеющуюся версию этого же случая. */
    res.draft.id = '';
    var saved = CC.save(res.draft);
    if (!saved.ok) { note('Не сохранилось: ' + saved.error, true); return; }
    note('Случай импортирован: ' + (res.draft.title || saved.id));
  }

  function doImport(file) {
    var r = new FileReader();
    r.onload = function () {
      if (!CC) { note('Модуль своих случаев не загружен.', true); return; }
      finishImport(CC.importText(r.result));
    };
    r.onerror = function () { note('Файл не прочитался.', true); };
    r.readAsText(file);
  }

  function doImportText(txt) {
    if (!CC) { note('Модуль своих случаев не загружен.', true); return; }
    if (!String(txt || '').replace(/\s+/g, '')) { note('Поле пустое.', true); return; }
    finishImport(CC.importText(txt));
  }

  root.addEventListener('click', function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains('picker-del')) {
      e.preventDefault();
      var id = t.getAttribute('data-id');
      if (CC && id && window.confirm('Удалить этот свой случай?')) {
        CC.remove(id);
      }
      return;
    }
    if (t.id === 'pickerTextToggle') {
      var wrap = document.getElementById('pickerTextWrap');
      if (wrap) wrap.hidden = !wrap.hidden;
      return;
    }
    if (t.id === 'pickerTextGo') {
      var ta = document.getElementById('pickerTextIn');
      if (ta) doImportText(ta.value);
    }
  });

  root.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'pickerImport') {
      var f = e.target.files && e.target.files[0];
      if (f) doImport(f);
      e.target.value = '';
    }
  });

  /* Подписка: если случаи правили в другой вкладке конструктора,
     список перерисуется. Общие случаи из облака приходят через
     Sync.init → CustomCases.emitChange и доезжают тем же путём. */
  if (CC) CC.onChange(render);

  /* Верхняя карточка «Студенту» — тоже случайный вход: вычищаем ?char=,
     но прокидываем остальные отладочные параметры (demo, finish, dx). */
  var card = document.getElementById('studentCard');
  if (card) card.href = randomHref();

  Array.prototype.forEach.call(document.querySelectorAll('[name="learningMode"]'), function (radio) {
    radio.checked = radio.value === mode;
    radio.addEventListener('change', function () {
      if (!radio.checked) return;
      mode = radio.value;
      render();
    });
  });

  /* Первый рендер — после загрузки общих случаев (если включена
     синхронизация): без неё или без сети витрина рисуется сразу. */
  if (window.Sync) { Sync.init(render); } else { render(); }
})();
