/* Конструктор своих случаев — вкладка страницы преподавателя.

   Редактирует JSON-черновик (см. custom-cases.js): двенадцать секций —
   от «кто приходит» до разбора. Состояние одно — объект draft; текстовые
   поля пишут в него на каждое нажатие клавиши БЕЗ перерисовки (иначе
   терялся бы фокус), перерисовываются только структурные изменения:
   добавление/удаление строк, загрузка картинок, выбор случая из списка.

   Случай без озвучки: голоса у кастомных пациентов нет, ответы показываются
   субтитрами. Запуск и «идеальный приём» сначала сохраняют случай — ссылка
   priem.html?char=<id> работает только на сохранённом.

   Один IIFE, ES5, без сети. Стартует сам, если на странице есть
   #constructorRoot (сейчас — teacher.html). */
(function () {
  'use strict';

  var root = document.getElementById('constructorRoot');
  if (!root || !window.CustomCases) return;
  var CC = window.CustomCases;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* =========================================================
     Предзаполнение: стандартные поля с проверенными корнями
     ========================================================= */

  /* Корни скопированы из встроенных случаев: подкнопки «Измерить» в
     тренажёре посылают фиксированные фразы («измерить температуру», …),
     и они обязаны распознаваться. */
  var VITAL_PRESETS = [
    { id: 'v.temp', field: 'Температура', unit: '°C',
      need: [['температур', 'термометр']] },
    { id: 'v.hr', field: 'ЧСС', unit: 'уд/мин',
      need: [['пульс', 'чсс', 'сердцебиен']] },
    { id: 'v.rr', field: 'ЧДД', unit: '/мин',
      need: [['чдд', 'частот']], label: 'Посчитать частоту дыхания' },
    { id: 'v.spo2', field: 'SpO₂', unit: '%',
      need: [['сатурац', 'пульсоксиметр', 'оксиметр', 'spo2', 'спо2', 'оксигенац', 'кислород']] },
    { id: 'v.bp', field: 'АД', unit: 'мм рт.ст.',
      need: [['давлен', 'ад', 'тонометр']] },
    { id: 'v.bmi', field: 'ИМТ', unit: 'кг/м²',
      need: [['рост', 'имт', 'масс', 'взвес', 'вес']] }
  ];

  var PASSPORT_PRESETS = [
    { id: 'p.name', field: 'ФИО',
      need: [['зову', 'зват', 'имя', 'имен', 'фио', 'представ', 'назов', 'фамил', 'отчеств']] },
    { id: 'p.age', field: 'Возраст',
      need: [['возраст', 'лет', 'год', 'стар']] }
  ];

  function blankDraft() {
    return {
      v: 1, id: '',
      disease: '', title: '',
      patient: { name: '', short: '', reason: '', greetingText: '' },
      passport: PASSPORT_PRESETS.map(function (p) {
        return { id: p.id, field: p.field, value: '', text: '',
                 important: false, why: '', need: p.need };
      }),
      vitals: VITAL_PRESETS.map(function (v) {
        return { id: v.id, field: v.field, value: '', unit: v.unit,
                 flag: 'ok', tech: '', note: '', abnormal: false, weight: 1,
                 need: v.need };
      }),
      questions: [{ id: 'q1', label: '', text: '', tag: '', weight: 1,
                    important: false, why: '', need: null, no: [] }],
      exams: [],
      auscultation: { enabled: true, points: {} },
      orders: [],
      treatment: [],
      diagnosis: { correct: '', options: [
        { id: 'dx1', label: '', verdict: '', why: '', need: null },
        { id: 'dx2', label: '', verdict: '', why: '', need: null }
      ] },
      /* Все девять правил включены по умолчанию: они универсальны,
         выключать их стоит осознанно. */
      rules: CC.RULE_LIBRARY.map(function (r) { return r.id; }),
      debrief: { keyFindings: [], trap: '', nextSteps: '' }
    };
  }

  var draft = blankDraft();
  var errors = null;      /* список ошибок после «Сохранить»/«Запустить» */
  var flash = '';         /* одноразовое сообщение в тулбаре */

  /* =========================================================
     Мелкие помощники
     ========================================================= */

  function nextId(prefix, arr) {
    var n = arr.length + 1, id;
    do { id = prefix + n; n++; } while (arr.some(function (x) { return x.id === id; }));
    return id;
  }

  /* need хранится как [[корень, …]]; в форме — строка через запятую. */
  function needToText(need) {
    return (need && need[0]) ? need[0].join(', ') : '';
  }
  function textToRoots(s) {
    return String(s || '').split(/[,;]/).map(function (x) {
      return x.replace(/^\s+|\s+$/g, '').toLowerCase();
    }).filter(Boolean);
  }

  function setPath(o, path, v) {
    var parts = path.split('.');
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = v;
  }

  /* =========================================================
     Контролы: HTML из значений черновика
     ========================================================= */

  function inp(path, sec, i, k, val, ph) {
    return '<input type="text" class="cn-in"' +
      (path ? ' data-path="' + path + '"' : ' data-sec="' + sec + '" data-i="' + i + '" data-k="' + k + '"') +
      ' value="' + esc(val) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>';
  }
  function inpPath(path, val, ph) { return inp(path, null, 0, null, val, ph); }
  function inpRow(sec, i, k, val, ph) { return inp(null, sec, i, k, val, ph); }

  function areaRow(sec, i, k, val, ph) {
    return '<textarea class="cn-in" rows="2" data-sec="' + sec + '" data-i="' + i +
      '" data-k="' + k + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' +
      esc(val) + '</textarea>';
  }

  function chkRow(sec, i, k, on, label) {
    return '<label class="cn-chk"><input type="checkbox" data-sec="' + sec +
      '" data-i="' + i + '" data-k="' + k + '"' + (on ? ' checked' : '') + '> ' +
      esc(label) + '</label>';
  }

  function selRow(sec, i, k, val, opts) {
    var h = '<select class="cn-in" data-sec="' + sec + '" data-i="' + i + '" data-k="' + k + '">';
    opts.forEach(function (o) {
      h += '<option value="' + esc(o.v) + '"' + (o.v === val ? ' selected' : '') + '>' +
        esc(o.t) + '</option>';
    });
    return h + '</select>';
  }

  function needInp(sec, i, val) {
    return inpRow(sec, i, 'need', needToText(val),
      'корни через запятую; пусто — угадать из названия');
  }

  function delBtn(sec, i) {
    return '<button type="button" class="cn-del" data-act="del" data-sec="' + sec +
      '" data-i="' + i + '" title="Удалить строку">×</button>';
  }

  function addBtn(sec, label) {
    return '<button type="button" class="btn btn-ghost btn-sm" data-act="add" data-sec="' +
      sec + '">+ ' + esc(label) + '</button>';
  }

  function secHtml(title, hint, inner) {
    return '<section class="cn-sec"><h3>' + esc(title) + '</h3>' +
      (hint ? '<p class="cn-hint">' + esc(hint) + '</p>' : '') + inner + '</section>';
  }

  /* Картинка результата: загрузка, миниатюра, удаление. */
  function imgCtl(sec, i, img) {
    var h = '<div class="cn-imgrow">';
    if (img) {
      h += '<img class="cn-thumb" src="' + esc(img) + '" alt="Снимок">' +
        '<button type="button" class="cn-del" data-act="delimg" data-sec="' + sec +
        '" data-i="' + i + '" title="Убрать картинку">×</button>';
    }
    h += '<label class="btn btn-ghost btn-sm cn-file">' +
      (img ? 'Заменить картинку' : 'Прикрепить картинку') +
      '<input type="file" accept="image/*" data-act="img" data-sec="' + sec +
      '" data-i="' + i + '"></label></div>';
    return h;
  }

  /* =========================================================
     Рендер секций
     ========================================================= */

  function renderToolbar() {
    var opts = '';
    CC.list().forEach(function (d) {
      opts += '<option value="' + esc(d.id) + '"' + (d.id === draft.id ? ' selected' : '') + '>' +
        esc(d.disease || d.id) + ' — ' + esc(d.title || 'без названия') + '</option>';
    });

    return '<div class="cn-bar">' +
      '<div class="cn-bar-group">' +
        '<select class="cn-in cn-saved" id="cnSaved">' +
          '<option value="">— открыть сохранённый случай —</option>' + opts + '</select>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-cmd="new">Новый</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-cmd="import">Импорт</button>' +
      '</div>' +
      '<div class="cn-bar-group">' +
        '<button type="button" class="btn btn-primary btn-sm" data-cmd="save">Сохранить</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-cmd="download">Скачать .js</button>' +
      '</div>' +
      '<div class="cn-bar-group">' +
        '<button type="button" class="btn btn-primary btn-sm" data-cmd="run">Запустить</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-cmd="demo">Идеальный приём</button>' +
      '</div>' +
      (flash ? '<span class="cn-flash">' + esc(flash) + '</span>' : '') +
      '<input type="file" id="cnImport" accept=".js,.json,text/*" hidden>' +
    '</div>' +
    (errors && errors.length
      ? '<div class="cn-errors"><b>Случай не сохранён — ' + errors.length + ' ошибок:</b><ul>' +
        errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'
      : '');
  }

  function renderIdentity() {
    var slug = 'custom-' + CC.slugify(draft.disease || draft.title || 'случай');
    return secHtml('Случай', 'Кто приходит и с какой болезнью. Студент видит ' +
      'заголовок и повод обращения; болезнь он должен вычислить сам.',
      '<div class="cn-grid">' +
        '<label>Болезнь (правильный диагноз случая)<br>' +
          inpPath('disease', draft.disease, 'Бронхиальная астма') + '</label>' +
        '<label>Заголовок — кто приходит<br>' +
          inpPath('title', draft.title, 'Школьница, 15 лет, пришла с мамой') + '</label>' +
        '<label>ФИО пациента<br>' +
          inpPath('patient.name', draft.patient.name, 'Есжанова Айгерим') + '</label>' +
        '<label>Короткое обращение<br>' +
          inpPath('patient.short', draft.patient.short, 'Айгерим') + '</label>' +
        '<label class="cn-wide">Повод обращения (строка чипа жалобы)<br>' +
          inpPath('patient.reason', draft.patient.reason, 'приступы удушья') + '</label>' +
        '<label>Идентификатор (присваивается при сохранении)<br>' +
          '<input type="text" class="cn-in" value="' + esc(draft.id || slug) + '" disabled></label>' +
      '</div>');
  }

  function renderGreeting() {
    return secHtml('Вступительная реплика',
      'Пациент произносит её, войдя в кабинет. Реплика может и слукавить — ' +
      'встроенные случаи этим пользуются («кашель небольшой»).',
      '<textarea class="cn-in" rows="2" data-path="patient.greetingText" placeholder="Здравствуйте, доктор…">' +
      esc(draft.patient.greetingText) + '</textarea>');
  }

  function renderPassport() {
    var rows = draft.passport.map(function (p, i) {
      return '<div class="cn-row">' +
        '<div class="cn-row-main">' +
          inpRow('passport', i, 'field', p.field, 'Поле (Род занятий)') +
          inpRow('passport', i, 'value', p.value, 'Значение (слесарь)') +
        '</div>' +
        '<div class="cn-row-main">' +
          inpRow('passport', i, 'text', p.text, 'Ответ пациента дословно') +
          chkRow('passport', i, 'important', p.important, 'важное') +
          delBtn('passport', i) +
        '</div>' +
        '<div class="cn-row-sub">' +
          inpRow('passport', i, 'why', p.why, 'Почему важно (для разбора)') +
          needInp('passport', i, p.need) +
        '</div>' +
      '</div>';
    }).join('');
    return secHtml('Паспортная часть',
      'ФИО и возраст предзаполнены — их корни распознавания совпадают с ' +
      'подкнопками тренажёра. Остальные поля добавляйте сами.',
      rows + addBtn('passport', 'поле паспорта'));
  }

  function renderVitals() {
    var rows = draft.vitals.map(function (v, i) {
      return '<div class="cn-row">' +
        '<div class="cn-row-main">' +
          inpRow('vitals', i, 'field', v.field, 'Показатель') +
          inpRow('vitals', i, 'value', v.value, '37,2') +
          inpRow('vitals', i, 'unit', v.unit, '°C') +
          selRow('vitals', i, 'flag', v.flag, [
            { v: 'ok', t: 'норма' }, { v: 'warn', t: 'отклонение (подсветка)' }]) +
          chkRow('vitals', i, 'abnormal', v.abnormal, 'считать отклонением в разборе') +
          delBtn('vitals', i) +
        '</div>' +
        '<div class="cn-row-sub">' +
          inpRow('vitals', i, 'tech', v.tech, 'Методика измерения') +
          inpRow('vitals', i, 'note', v.note, 'Примечание (идёт в факты справа)') +
          needInp('vitals', i, v.need) +
        '</div>' +
      '</div>';
    }).join('');
    return secHtml('Показатели',
      'Шесть стандартных предзаполнены — заполните значения, лишние удалите. ' +
      'Подкнопки «Измерить» в тренажёре посылают имена этих показателей.',
      rows + addBtn('vitals', 'показатель'));
  }

  function renderQuestions() {
    var rows = draft.questions.map(function (q, i) {
      return '<div class="cn-row">' +
        '<div class="cn-row-main">' +
          inpRow('questions', i, 'label', q.label, 'Вопрос (Давно ли кашель?)') +
          chkRow('questions', i, 'important', q.important, 'важный') +
          '<label class="cn-chk">вес <input type="number" class="cn-in cn-num" min="0" max="10" step="1"' +
            ' data-sec="questions" data-i="' + i + '" data-k="weight" value="' +
            esc(q.weight == null ? 1 : q.weight) + '"></label>' +
          delBtn('questions', i) +
        '</div>' +
        '<div class="cn-row-main">' +
          areaRow('questions', i, 'text', q.text, 'Ответ пациента дословно') +
        '</div>' +
        '<div class="cn-row-sub">' +
          inpRow('questions', i, 'tag', q.tag, 'Короткая пометка (идёт в факты справа)') +
          inpRow('questions', i, 'why', q.why, 'Почему важен (для разбора)') +
        '</div>' +
        '<div class="cn-row-sub">' +
          needInp('questions', i, q.need) +
          inpRow('questions', i, 'no', (q.no || []).join(', '),
            'блокирующие корни через запятую (обычно пусто)') +
        '</div>' +
      '</div>';
    }).join('');
    return secHtml('Расспрос', 'Хотя бы один вопрос обязателен. Ответ ' +
      'пациента студент увидит субтитром — кастомные случаи без озвучки.',
      rows + addBtn('questions', 'вопрос'));
  }

  function renderExams() {
    var rows = draft.exams.map(function (e, i) {
      return '<div class="cn-row">' +
        '<div class="cn-row-main">' +
          inpRow('exams', i, 'label', e.label, 'Приём (Осмотреть грудную клетку)') +
          selRow('exams', i, 'kind', e.kind, [
            { v: 'plain', t: 'обычный осмотр' },
            { v: 'throat', t: 'осмотр зева (видео)' }]) +
          chkRow('exams', i, 'findAbnormal', e.findAbnormal, 'выявляет патологию') +
          '<label class="cn-chk">вес <input type="number" class="cn-in cn-num" min="0" max="10" step="1"' +
            ' data-sec="exams" data-i="' + i + '" data-k="weight" value="' +
            esc(e.weight == null ? 1 : e.weight) + '"></label>' +
          delBtn('exams', i) +
        '</div>' +
        '<div class="cn-row-main">' +
          inpRow('exams', i, 'title', e.title, 'Заголовок находки') +
        '</div>' +
        '<div class="cn-row-main">' +
          areaRow('exams', i, 'result', e.result, 'Что видит врач') +
        '</div>' +
        '<div class="cn-row-sub">' +
          inpRow('exams', i, 'why', e.why, 'Почему приём важен (для разбора)') +
          needInp('exams', i, e.need) +
        '</div>' +
        imgCtl('exams', i, e.img) +
      '</div>';
    }).join('');
    return secHtml('Физикальный осмотр',
      'Аускультацию сюда добавлять не нужно — она собирается в следующей ' +
      'секции. «Осмотр зева» проигрывает общее видео.',
      rows + addBtn('exams', 'приём осмотра'));
  }

  function renderAuscultation() {
    var a = draft.auscultation;
    var opts = [{ v: '', t: '— поле не используется —' }, { v: 'normal', t: 'Норма: везикулярное дыхание' }];
    Object.keys(CC.LUNG_PRESETS).forEach(function (k) {
      opts.push({ v: k, t: CC.LUNG_PRESETS[k].title });
    });

    var pts = CC.AUSC_POINTS.map(function (ap) {
      return '<label class="cn-pt"><span>' + esc(ap.label) + '</span>' +
        selRow('auscPoint', ap.id, 'finding', a.points[ap.id] || '', opts) + '</label>';
    }).join('');

    return secHtml('Аускультация лёгких',
      'Шесть полей задней поверхности грудной клетки, звуки — из общей ' +
      'библиотеки. Выключенная аускультация полностью убирает схему из приёма.',
      '<label class="cn-chk cn-big"><input type="checkbox" data-sec="auscFlag" data-i="0" data-k="enabled"' +
        (a.enabled ? ' checked' : '') + '> аускультация есть в этом случае</label>' +
      '<div class="cn-ptgrid' + (a.enabled ? '' : ' is-off') + '">' + pts + '</div>');
  }

  function renderOrders() {
    var rows = draft.orders.map(function (o, i) {
      return '<div class="cn-row">' +
        '<div class="cn-row-main">' +
          inpRow('orders', i, 'label', o.label, 'Исследование (Рентген грудной клетки)') +
          selRow('orders', i, 'role', o.role, [
            { v: 'need', t: 'обязательно' },
            { v: 'useful', t: 'полезно' },
            { v: 'waste', t: 'назначено зря' }]) +
          '<label class="cn-chk">вес <input type="number" class="cn-in cn-num" min="0" max="10" step="1"' +
            ' data-sec="orders" data-i="' + i + '" data-k="weight" value="' +
            esc(o.weight == null ? 1 : o.weight) + '"></label>' +
          delBtn('orders', i) +
        '</div>' +
        '<div class="cn-row-main">' +
          areaRow('orders', i, 'result', o.result, 'Результат исследования') +
        '</div>' +
        '<div class="cn-row-sub">' +
          inpRow('orders', i, 'hint', o.hint, 'Подсказка для разбора (зачем нужно / почему зря)') +
          needInp('orders', i, o.need) +
        '</div>' +
        imgCtl('orders', i, o.img) +
      '</div>';
    }).join('');
    return secHtml('Обследования',
      'К каждому исследованию можно прикрепить снимок: он появится в ' +
      'протоколе приёма и откроется по клику. Картинки сжимаются и хранятся ' +
      'внутри случая — следите за общим весом (лимит ~3 МБ).',
      rows + addBtn('orders', 'обследование'));
  }

  function renderTreatment() {
    var rows = draft.treatment.map(function (x, i) {
      return '<div class="cn-row">' +
        '<div class="cn-row-main">' +
          inpRow('treatment', i, 'label', x.label, 'Назначение (Антибиотик внутрь)') +
          selRow('treatment', i, 'role', x.role, [
            { v: 'need', t: 'нужное' },
            { v: 'useful', t: 'полезное' },
            { v: 'harm', t: 'вредное — прямая ошибка' }]) +
          '<label class="cn-chk">вес <input type="number" class="cn-in cn-num" min="0" max="10" step="1"' +
            ' data-sec="treatment" data-i="' + i + '" data-k="weight" value="' +
            esc(x.weight == null ? 1 : x.weight) + '"></label>' +
          delBtn('treatment', i) +
        '</div>' +
        '<div class="cn-row-sub">' +
          inpRow('treatment', i, 'hint', x.hint, 'Пояснение для разбора') +
          needInp('treatment', i, x.need) +
        '</div>' +
      '</div>';
    }).join('');
    return secHtml('Лечение', 'Назначения по ролям: нужное, полезное, вредное.',
      rows + addBtn('treatment', 'назначение'));
  }

  function renderDiagnosis() {
    var rows = draft.diagnosis.options.map(function (o, i) {
      return '<div class="cn-row">' +
        '<div class="cn-row-main">' +
          '<label class="cn-chk cn-radio"><input type="radio" name="cn-correct" value="' + esc(o.id) + '"' +
            (draft.diagnosis.correct === o.id ? ' checked' : '') + '> верный</label>' +
          inpRow('diagnosis.options', i, 'label', o.label, 'Вариант диагноза') +
          delBtn('diagnosis.options', i) +
        '</div>' +
        '<div class="cn-row-sub">' +
          inpRow('diagnosis.options', i, 'verdict', o.verdict, 'Вердикт разбора (наиболее вероятен / не подходит)') +
          needInp('diagnosis.options', i, o.need) +
        '</div>' +
        '<div class="cn-row-sub">' +
          inpRow('diagnosis.options', i, 'why', o.why, 'Почему так (показывается в разборе)') +
        '</div>' +
      '</div>';
    }).join('');
    return secHtml('Диагноз',
      'Минимум два варианта, один отмечен верным. Вариант с ловушкой делает ' +
      'случай интереснее.', rows + addBtn('diagnosis.options', 'вариант'));
  }

  function renderRules() {
    var rows = CC.RULE_LIBRARY.map(function (r) {
      var on = draft.rules.indexOf(r.id) >= 0;
      return '<label class="cn-rule"><input type="checkbox" data-rule="' + esc(r.id) + '"' +
        (on ? ' checked' : '') + '> <b>' + esc(r.text) + '</b> ' +
        '<span>' + esc(r.why) + '</span></label>';
    }).join('');
    return secHtml('Правила порядка действий',
      'Универсальные правила алгоритма. Правила, привязанные к конкретным ' +
      'назначениям (вроде «КТ без рентгена»), доступны только во встроенных ' +
      'случаях.', rows);
  }

  function renderDebrief() {
    return secHtml('Разбор случая',
      'Тексты для страницы результата. Всё необязательно: пустые блоки ' +
      'в разборе просто не показываются.',
      '<label class="cn-lb">Ключевые находки (каждая с новой строки)</label>' +
        '<textarea class="cn-in" rows="4" data-path="debrief.keyFindings" data-lines="1">' +
          esc((draft.debrief.keyFindings || []).join('\n')) + '</textarea>' +
      '<label class="cn-lb">Ловушка случая</label>' +
        '<textarea class="cn-in" rows="2" data-path="debrief.trap">' +
          esc(draft.debrief.trap) + '</textarea>' +
      '<label class="cn-lb">Тактика после диагноза</label>' +
        '<textarea class="cn-in" rows="2" data-path="debrief.nextSteps">' +
          esc(draft.debrief.nextSteps) + '</textarea>');
  }

  function render() {
    root.innerHTML =
      renderToolbar() +
      renderIdentity() +
      renderGreeting() +
      renderPassport() +
      renderVitals() +
      renderQuestions() +
      renderExams() +
      renderAuscultation() +
      renderOrders() +
      renderTreatment() +
      renderDiagnosis() +
      renderRules() +
      renderDebrief();
    flash = '';
  }

  /* =========================================================
     Запись полей в черновик
     ========================================================= */

  function writeField(t) {
    var path = t.getAttribute('data-path');
    var sec = t.getAttribute('data-sec');
    var val = t.type === 'checkbox' ? t.checked : t.value;

    if (path) {
      if (t.getAttribute('data-lines')) {
        val = String(t.value).split('\n').map(function (x) {
          return x.replace(/^\s+|\s+$/g, '');
        }).filter(Boolean);
      }
      setPath(draft, path, val);
      return;
    }
    if (!sec) return;

    if (sec === 'auscFlag') { draft.auscultation.enabled = !!val; return; }
    if (sec === 'auscPoint') {
      var pt = t.getAttribute('data-i');
      if (val) draft.auscultation.points[pt] = val;
      else delete draft.auscultation.points[pt];
      return;
    }

    var i = +t.getAttribute('data-i');
    var k = t.getAttribute('data-k');
    var arr = sec === 'diagnosis.options' ? draft.diagnosis.options : draft[sec];
    var row = arr && arr[i];
    if (!row) return;

    if (k === 'need') { row.need = textToRoots(val).length ? [textToRoots(val)] : null; return; }
    if (k === 'no') { row.no = textToRoots(val); return; }
    row[k] = val;
  }

  /* =========================================================
     Структурные действия
     ========================================================= */

  var ADDERS = {
    'passport': function (arr) {
      arr.push({ id: nextId('p.custom', arr), field: '', value: '', text: '',
                 important: false, why: '', need: null });
    },
    'vitals': function (arr) {
      arr.push({ id: nextId('v.custom', arr), field: '', value: '', unit: '',
                 flag: 'ok', tech: '', note: '', abnormal: false, weight: 1, need: null });
    },
    'questions': function (arr) {
      arr.push({ id: 'q' + nextNum(arr), label: '',
                 text: '', tag: '', weight: 1, important: false, why: '', need: null, no: [] });
    },
    'exams': function (arr) {
      arr.push({ id: nextId('e.custom', arr), kind: 'plain', label: '', title: '',
                 result: '', why: '', weight: 1, findAbnormal: false, img: '', need: null });
    },
    'orders': function (arr) {
      arr.push({ id: nextId('o.custom', arr), label: '', role: 'need', weight: 1,
                 result: '', hint: '', img: '', need: null });
    },
    'treatment': function (arr) {
      arr.push({ id: nextId('t.custom', arr), label: '', role: 'need', weight: 1,
                 hint: '', need: null });
    },
    'diagnosis.options': function (arr) {
      arr.push({ id: nextId('dx', arr), label: '', verdict: '', why: '', need: null });
    }
  };

  /* Для вопросов id читается в протоколе человеком — оставляем короткие q2, q3… */
  function nextNum(arr) {
    var n = arr.length + 1;
    while (arr.some(function (x) { return x.id === 'q' + n; })) n++;
    return n;
  }

  function addRow(sec) {
    var arr = sec === 'diagnosis.options' ? draft.diagnosis.options : draft[sec];
    if (ADDERS[sec]) { ADDERS[sec](arr); render(); }
  }

  function delRow(sec, i) {
    var arr = sec === 'diagnosis.options' ? draft.diagnosis.options : draft[sec];
    if (!arr || !arr[i]) return;
    var id = arr[i].id;
    arr.splice(i, 1);
    /* Удалённый верный диагноз снимает отметку. */
    if (sec === 'diagnosis.options' && draft.diagnosis.correct === id) {
      draft.diagnosis.correct = '';
    }
    render();
  }

  /* =========================================================
     Команды тулбара
     ========================================================= */

  function doSave() {
    var errs = CC.validate(draft);
    errors = errs.length ? errs : null;
    if (errs.length) { render(); return null; }
    var r = CC.save(draft);
    if (!r.ok) { errors = [r.error]; render(); return null; }
    draft.id = r.id;
    flash = 'Сохранено: ' + r.id + ' — случай есть на витрине и в методичке.';
    render();
    return r.id;
  }

  function doDownload() {
    var name = (draft.id || 'custom-' + CC.slugify(draft.disease || 'случай')) + '.js';
    try {
      var blob = new Blob([CC.exportText(draft)], { type: 'text/javascript;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      flash = 'Файл ' + name + ' скачан.';
    } catch (e) {
      flash = 'Браузер не дал скачать файл — скопируйте случай через «Сохранить».';
    }
    render();
  }

  function doRun(demo) {
    var id = doSave();
    if (!id) return;
    location.href = 'priem.html?char=' + encodeURIComponent(id) +
      (demo ? '&demo=1&finish=1' : '');
  }

  function doImportFile(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var r = CC.importText(String(rd.result || ''));
      if (r.error) {
        errors = ['Импорт не удался: ' + r.error];
      } else {
        /* Импортированный файл всегда открывается как НОВЫЙ случай:
           id стирается, сохранение присвоит свой — так файл коллеги
           не затрёт ваш одноимённый случай. */
        draft = r.draft;
        draft.id = '';
        errors = null;
        flash = 'Импортировано. Проверьте поля и сохраните — случай получит свой идентификатор.';
      }
      render();
    };
    rd.onerror = function () { errors = ['Не удалось прочитать файл.']; render(); };
    rd.readAsText(file, 'utf-8');
  }

  /* =========================================================
     События
     ========================================================= */

  root.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-path') || (t.getAttribute('data-sec') && t.type !== 'checkbox' &&
        t.tagName !== 'SELECT' && t.type !== 'file')) writeField(t);
  });

  root.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;

    if (t.name === 'cn-correct') { draft.diagnosis.correct = t.value; return; }
    if (t.getAttribute('data-rule')) {
      var id = t.getAttribute('data-rule');
      var at = draft.rules.indexOf(id);
      if (t.checked && at < 0) draft.rules.push(id);
      if (!t.checked && at >= 0) draft.rules.splice(at, 1);
      return;
    }
    if (t.id === 'cnSaved') {
      if (!t.value) return;
      var d = CC.get(t.value);
      if (d) { draft = d; errors = null; flash = ''; render(); }
      return;
    }
    if (t.id === 'cnImport') {
      var f = t.files && t.files[0];
      if (f) doImportFile(f);
      t.value = '';
      return;
    }
    if (t.type === 'file' && t.getAttribute('data-act') === 'img') {
      var imgF = t.files && t.files[0];
      if (!imgF) return;
      var sec = t.getAttribute('data-sec'), i = +t.getAttribute('data-i');
      var row = draft[sec] && draft[sec][i];
      if (!row) return;
      flash = 'Сжимаю картинку…';
      CC.imageToDataUri(imgF, function (uri) {
        if (uri) { row.img = uri; flash = 'Картинка прикреплена.'; }
        else { errors = ['Файл не похож на изображение — картинка не прикреплена.']; }
        render();
      });
      return;
    }

    /* чекбоксы и select-ы со структурным эффектом */
    var hadAusc = t.getAttribute('data-sec') === 'auscFlag';
    if (t.getAttribute('data-path') || t.getAttribute('data-sec')) writeField(t);
    if (hadAusc) render();
  });

  root.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;

    var cmd = t.getAttribute('data-cmd');
    if (cmd === 'new') { draft = blankDraft(); errors = null; render(); return; }
    if (cmd === 'import') { $('cnImport').click(); return; }
    if (cmd === 'save') { doSave(); return; }
    if (cmd === 'download') { doDownload(); return; }
    if (cmd === 'run') { doRun(false); return; }
    if (cmd === 'demo') { doRun(true); return; }

    var act = t.getAttribute('data-act');
    if (act === 'add') { addRow(t.getAttribute('data-sec')); return; }
    if (act === 'del') { delRow(t.getAttribute('data-sec'), +t.getAttribute('data-i')); return; }
    if (act === 'delimg') {
      var row = draft[t.getAttribute('data-sec')] &&
                draft[t.getAttribute('data-sec')][+t.getAttribute('data-i')];
      if (row) { row.img = ''; render(); }
    }
  });

  function $(id) { return document.getElementById(id); }

  render();
})();
