/* Свои случаи (кастомные): хранилище, импорт/экспорт и превращение
   черновика конструктора в полноценный объект случая.

   Кастомный случай — это JSON-безопасный черновик (без функций), который
   живёт в localStorage этого браузера. В рантайм он попадает через
   inflate(): функции правил порядка подставляются из RULE_LIBRARY по id,
   находки аускультации — из LUNG_PRESETS по ключу, служебные реплики —
   общие GENERIC_SYSTEM без озвучки (say() в app.js умеет показывать
   реплику одним субтитром, когда audio: null).

   Экспорт — текстовый .js файл с маркерами-сентинелами: JSON внутри можно
   править руками, файлом делятся между браузерами и машинами.

   Один IIFE, ES5, без сети. Загружается на всех трёх страницах до
   manifest.js — loader.js и teacher.js читают manifestEntries(). */
(function () {
  'use strict';

  var CC = {};
  var STORE_KEY = 'vp.custom.cases.v1';
  CC.STORE_KEY = STORE_KEY;

  CC.storageOk = (function () {
    try {
      localStorage.setItem('vp.t', '1');
      localStorage.removeItem('vp.t');
      return true;
    } catch (e) { return false; }
  })();

  /* =========================================================
     Транслит для slug
     ========================================================= */

  var TR = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };

  /* «Муковисцидоз у студента» → 'mukoviscidoz-u-studenta'. Пустой ввод
     даёт 'case' — id всё равно остаётся уникальным благодаря префиксу. */
  CC.slugify = function (text) {
    var s = String(text || '').toLowerCase();
    var out = '', i, ch;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      if (TR[ch] != null) out += TR[ch];
      else if (/[a-z0-9]/.test(ch)) out += ch;
      else if (out && out.charAt(out.length - 1) !== '-') out += '-';
    }
    out = out.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return out || 'case';
  };

  /* =========================================================
     Аускультация: точки схемы и библиотека находок
     ========================================================= */

  /* Координаты — система SVG viewBox="0 0 300 380" из priem.html, те же
     шесть полей, что у встроенных персонажей. */
  var AUSC_POINTS = [
    { id: 'r-upper', x: 121, y: 137, label: 'Правое, верхнее поле',  side: 'R', zone: 'верх' },
    { id: 'l-upper', x: 179, y: 137, label: 'Левое, верхнее поле',   side: 'L', zone: 'верх' },
    { id: 'r-mid',   x: 112, y: 200, label: 'Правое, среднее поле',  side: 'R', zone: 'середина' },
    { id: 'l-mid',   x: 188, y: 200, label: 'Левое, среднее поле',   side: 'L', zone: 'середина' },
    { id: 'r-lower', x: 118, y: 262, label: 'Правое, нижнее поле',   side: 'R', zone: 'низ' },
    { id: 'l-lower', x: 182, y: 262, label: 'Левое, нижнее поле',    side: 'L', zone: 'низ' }
  ];
  CC.AUSC_POINTS = AUSC_POINTS;

  /* Пресеты — записи из общей библиотеки media/lungs/. Тексты повторяют
     находки встроенных персонажей дословно: звуку соответствует одно и то
     же описание независимо от случая. Ключ = ключ wf в waveforms.js. */
  CC.LUNG_PRESETS = {
    'crackles-bronchiectasis': {
      audio: 'media/lungs/crackles-bronchiectasis.mp3', wf: 'crackles-bronchiectasis',
      title: 'Влажные крупнопузырчатые хрипы',
      desc: 'Грубые «трескучие» хрипы, слышны в обе фазы, преимущественно на вдохе. После покашливания меняются — признак секрета в просвете бронхов.',
      abnormal: true
    },
    'crackles-cf': {
      audio: 'media/lungs/crackles-cf.mp3', wf: 'crackles-cf',
      title: 'Влажные разнокалиберные хрипы',
      desc: 'Влажные хрипы разного калибра; после откашливания меняются — вязкий секрет в расширенных бронхах.',
      abnormal: true
    },
    'crackles-edema': {
      audio: 'media/lungs/crackles-edema.mp3', wf: 'crackles-edema',
      title: 'Влажные мелкопузырчатые хрипы',
      desc: 'Незвучные мелкопузырчатые хрипы в конце вдоха. После покашливания почти не меняются — жидкость в альвеолах, застой.',
      abnormal: true
    },
    'wheeze-asthma': {
      audio: 'media/lungs/wheeze-asthma.mp3', wf: 'wheeze-asthma',
      title: 'Сухие свистящие хрипы',
      desc: 'Высокие свистящие хрипы, выдох удлинён. После покашливания не меняются — шум даёт сужение бронхов, а не секрет.',
      abnormal: true
    }
  };

  var NORMAL_FINDING = {
    audio: 'media/lungs/normal.mp3', wf: 'normal',
    title: 'Дыхание везикулярное',
    desc: 'Вдох длиннее и громче выдоха, побочных шумов нет. Норма.',
    abnormal: false
  };

  /* Служебные реплики без озвучки: у кастомных случаев голоса нет,
     app.js показывает их субтитром. */
  CC.GENERIC_SYSTEM = {
    unknown: { audio: null, text: 'Извините, доктор, я не понял вопроса.' },
    deep:    { audio: null, text: 'Хорошо, доктор. Дышу глубоко, через рот.' },
    cough:   { audio: null, text: 'Кхе-кхе… Вот, покашлял.' },
    mouth:   { audio: null, text: 'А-а-а-а…' }
  };

  /* =========================================================
     needRoots: первое приближение корней из подписи действия
     ========================================================= */

  var STOP = {
    'и': 1, 'в': 1, 'на': 1, 'у': 1, 'о': 1, 'об': 1, 'со': 1, 'по': 1,
    'за': 1, 'из': 1, 'не': 1, 'что': 1, 'как': 1, 'это': 1, 'его': 1,
    'её': 1, 'их': 1, 'для': 1, 'при': 1, 'от': 1, 'до': 1, 'или': 1,
    'про': 1, 'спросить': 1, 'измерить': 1, 'назначить': 1, 'осмотреть': 1,
    'выполнить': 1, 'сделать': 1, 'послушать': 1, 'проверить': 1,
    'пациента': 1, 'пациенту': 1, 'пациент': 1
  };

  /* Отсекает типичные окончания до корня: «температура» → «темпер»,
     «кашель» → «кашел», «давление» → «давлен». Грубо, но nlu.js ищет
     подстрокой, поэтому усечённый корень только шире ловит формы. */
  function rootish(tok) {
    var r = tok.length > 6 ? tok.slice(0, 6) : tok;
    while (r.length > 4 && /[аеёиоуыэюяьъ]/.test(r.charAt(r.length - 1))) {
      r = r.slice(0, -1);
    }
    return r;
  }

  /* Подпись → [[корень, корень, …]]: одна группа, закрывается любым
     корнем. Короче 4 букв пропускаем — короткие корни в nlu.js ищутся
     точным словом и из подписи не угадываются. Конструктор показывает
     результат редактируемым полем. */
  CC.needRoots = function (label) {
    var toks = String(label || '').toLowerCase().replace(/ё/g, 'е')
      .split(/[^a-zа-я0-9]+/);
    var roots = [], seen = {}, i;
    for (i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (!t || STOP[t] || t.length < 4) continue;
      var r = rootish(t);
      if (!seen[r]) { seen[r] = 1; roots.push(r); }
      if (roots.length >= 6) break;
    }
    return roots.length ? [roots] : [[String(label || '').toLowerCase() || 'действие']];
  };

  /* =========================================================
     RULE_LIBRARY: правила порядка, доступные конструктору
     ========================================================= */

  /* Девять универсальных правил — они не зависят от нозологии, только от
     логики приёма. Правила с привязкой к конкретным назначениям («КТ без
     рентгена») конструктору недоступны: id назначений у кастома свои. */
  CC.RULE_LIBRARY = [
    { id: 'r.dx-no-ask',
      text: 'Диагноз поставлен без расспроса пациента.',
      why: 'Без анамнеза диагноз — угадывание.',
      when: function (t) { return t.did('__dx'); },
      test: function (t) { return t.did('__dx') && t.countOf('ask') === 0; } },

    { id: 'r.dx-before-ausc',
      text: 'Диагноз поставлен до аускультации лёгких.',
      why: 'При болезни лёгких диагноз без аускультации недопустим.',
      when: function (t) { return t.did('__dx') && t.did('e.ausc') !== undefined; },
      test: function (t) {
        return t.did('__dx') && (!t.did('e.ausc') || t.at('e.ausc') > t.at('__dx'));
      } },

    { id: 'r.order-first',
      text: 'Приём начат с назначения обследований, а не с разговора и осмотра.',
      why: 'Обследование без гипотезы — стрельба по площадям.',
      when: function (t) { return t.countOf('order') > 0; },
      test: function (t) { return t.firstOf('order') === 0; } },

    { id: 'r.order-before-exam',
      text: 'Обследования назначены раньше физического осмотра.',
      why: 'Осмотр ничего не стоит и сразу сужает круг версий.',
      when: function (t) { return t.countOf('order') > 0; },
      test: function (t) {
        var o = t.firstOf('order'), e = t.firstOf('exam');
        return o >= 0 && (e < 0 || o < e);
      } },

    { id: 'r.ausc-no-deep',
      text: 'Аускультация проведена без просьбы дышать глубоко через рот.',
      why: 'При спокойном носовом дыхании слабые побочные шумы не выслушиваются.',
      when: function (t) { return t.did('e.ausc'); },
      test: function (t) {
        return t.did('e.ausc') && (!t.did('e.deep') || t.at('e.deep') > t.at('e.ausc'));
      } },

    { id: 'r.treat-before-dx',
      text: 'Лечение назначено раньше диагноза.',
      why: 'Лечится диагноз, а не симптом.',
      when: function (t) { return t.countOf('treat') > 0; },
      test: function (t) {
        var tr = t.firstOf('treat');
        return tr >= 0 && (!t.did('__dx') || tr < t.at('__dx'));
      } },

    { id: 'r.no-passport',
      text: 'Паспортные и социальные данные не собраны совсем.',
      why: 'Профессия, условия жизни и привычки — часть диагностики, а не формальность.',
      test: function (t) { return t.countOf('passport') === 0; } },

    { id: 'r.no-vitals',
      text: 'Диагноз поставлен без единого измеренного показателя.',
      why: 'Без температуры, сатурации и АД у диагноза нет объективной опоры.',
      when: function (t) { return t.did('__dx'); },
      test: function (t) { return t.did('__dx') && t.countOf('measure') === 0; } },

    { id: 'r.no-finish-plan',
      text: 'Приём завершён без назначенного лечения.',
      why: 'Диагноз без плана лечения пациенту ничего не даёт.',
      test: function (t) { return t.countOf('treat') === 0; } }
  ];

  function ruleById(id) {
    for (var i = 0; i < CC.RULE_LIBRARY.length; i++) {
      if (CC.RULE_LIBRARY[i].id === id) return CC.RULE_LIBRARY[i];
    }
    return null;
  }

  /* =========================================================
     normalize: черновик → аккуратный JSON-безопасный черновик
     ========================================================= */

  function isArr(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function str(x, dflt) { return (x == null || x === '') ? (dflt || '') : String(x); }
  function num(x, dflt) { var n = +x; return isFinite(n) ? n : dflt; }

  function normNeed(need, label) {
    if (isArr(need) && need.length && isArr(need[0]) && need[0].length) return need;
    return CC.needRoots(label);
  }

  function normList(list, mapItem) {
    var out = [];
    (isArr(list) ? list : []).forEach(function (x, i) {
      if (x && typeof x === 'object') out.push(mapItem(x, i));
    });
    return out;
  }

  CC.normalize = function (raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var d = { v: 1 };

    d.id = str(raw.id);
    d.disease = str(raw.disease);
    d.title = str(raw.title);

    var p = raw.patient || {};
    d.patient = {
      name: str(p.name), short: str(p.short), reason: str(p.reason),
      greetingText: str(p.greetingText || p.greeting && p.greeting.text)
    };

    d.passport = normList(raw.passport, function (x, i) {
      return {
        id: str(x.id, 'p.custom' + i),
        field: str(x.field), value: str(x.value), text: str(x.text),
        important: !!x.important, why: str(x.why),
        need: normNeed(x.need, x.field)
      };
    });

    d.vitals = normList(raw.vitals, function (x, i) {
      return {
        id: str(x.id, 'v.custom' + i),
        field: str(x.field), value: str(x.value), unit: str(x.unit),
        flag: x.flag === 'warn' ? 'warn' : 'ok',
        tech: str(x.tech), note: str(x.note),
        abnormal: !!x.abnormal, weight: num(x.weight, 1),
        need: normNeed(x.need, x.field)
      };
    });

    d.questions = normList(raw.questions, function (x, i) {
      return {
        id: str(x.id, 'q.custom' + i),
        label: str(x.label), text: str(x.text), tag: str(x.tag),
        weight: num(x.weight, 1), important: !!x.important, why: str(x.why),
        need: normNeed(x.need, x.label),
        no: isArr(x.no) ? x.no : []
      };
    });

    d.exams = normList(raw.exams, function (x, i) {
      return {
        id: str(x.id, 'e.custom' + i),
        kind: x.kind === 'throat' ? 'throat' : 'plain',
        label: str(x.label), title: str(x.title), result: str(x.result),
        why: str(x.why), weight: num(x.weight, 1),
        findAbnormal: !!x.findAbnormal, img: str(x.img),
        need: normNeed(x.need, x.label)
      };
    });

    /* Аускультация: { enabled, points: {pointId: ключ пресета|'normal'} } */
    var a = raw.auscultation || {};
    var pts = {};
    if (a.points && typeof a.points === 'object') {
      AUSC_POINTS.forEach(function (ap) {
        var k = a.points[ap.id];
        if (k === 'normal' || CC.LUNG_PRESETS[k]) pts[ap.id] = k;
      });
    }
    d.auscultation = { enabled: a.enabled !== false, points: pts };

    d.orders = normList(raw.orders, function (x, i) {
      return {
        id: str(x.id, 'o.custom' + i),
        label: str(x.label),
        role: x.role === 'useful' ? 'useful' : x.role === 'waste' ? 'waste' : 'need',
        weight: num(x.weight, 1), result: str(x.result), hint: str(x.hint),
        img: str(x.img),
        need: normNeed(x.need, x.label)
      };
    });

    d.treatment = normList(raw.treatment, function (x, i) {
      return {
        id: str(x.id, 't.custom' + i),
        label: str(x.label),
        role: x.role === 'useful' ? 'useful' : x.role === 'harm' ? 'harm' : 'need',
        weight: num(x.weight, 1), hint: str(x.hint),
        need: normNeed(x.need, x.label)
      };
    });

    var dx = raw.diagnosis || {};
    d.diagnosis = {
      correct: str(dx.correct),
      options: normList(dx.options, function (x, i) {
        return {
          id: str(x.id, 'dx' + i),
          label: str(x.label), verdict: str(x.verdict), why: str(x.why),
          need: normNeed(x.need, x.label)
        };
      })
    };

    d.rules = (isArr(raw.rules) ? raw.rules : []).filter(function (id) {
      return !!ruleById(id);
    });

    var db = raw.debrief || {};
    d.debrief = {
      keyFindings: (isArr(db.keyFindings) ? db.keyFindings : [])
        .map(function (k) { return str(k); }).filter(Boolean),
      trap: str(db.trap), nextSteps: str(db.nextSteps)
    };

    return d;
  };

  /* =========================================================
     inflate: черновик → runtime-объект случая для app.js/score.js
     ========================================================= */

  CC.inflate = function (raw) {
    var d = CC.normalize(raw);
    var C = {
      id: d.id, disease: d.disease, title: d.title, custom: true,
      patient: {
        name: d.patient.name || 'Пациент',
        short: d.patient.short || d.patient.name || 'Пациент',
        reason: d.patient.reason || '',
        idleVideo: 'media/patient-idle.mp4',
        throatVideo: 'media/patient-throat.mp4',
        throatPoster: 'media/throat-poster.jpg',
        greeting: {
          audio: null,
          text: d.patient.greetingText || 'Здравствуйте, доктор.'
        },
        chip: []
      },
      system: CC.GENERIC_SYSTEM,
      passport: [], vitals: [], questions: [], exams: [],
      auscultation: { normalAudio: NORMAL_FINDING.audio, points: [], findings: {} },
      orders: [], treatment: [],
      diagnosis: { correct: d.diagnosis.correct, options: [] },
      algorithm: [],
      debrief: d.debrief
    };

    /* Чип жалобы: после первого вопроса показываем повод обращения. */
    if (d.questions.length) {
      C.patient.chip.push({ done: d.questions[0].id, text: C.patient.reason || 'Жалобы собраны' });
    }

    d.passport.forEach(function (x) {
      C.passport.push({
        id: x.id, cat: 'ask', w: 1, label: 'Спросить: ' + x.field,
        field: x.field, value: x.value,
        audio: null, text: x.text || x.value,
        important: x.important, why: x.why, need: x.need
      });
    });

    d.vitals.forEach(function (x) {
      C.vitals.push({
        id: x.id, cat: 'measure', w: 1, label: 'Измерить: ' + x.field,
        field: x.field, value: x.value, unit: x.unit, flag: x.flag,
        tech: x.tech, note: x.note, abnormal: x.abnormal, weight: x.weight,
        need: x.need
      });
    });

    d.questions.forEach(function (x) {
      C.questions.push({
        id: x.id, cat: 'ask', w: 1, label: x.label,
        audio: null, text: x.text, tag: x.tag || x.label,
        weight: x.weight, important: x.important, why: x.why,
        need: x.need, no: x.no
      });
    });

    d.exams.forEach(function (x) {
      var e = {
        id: x.id, cat: 'exam', w: 1, label: x.label,
        kind: x.kind, title: x.title, result: x.result, why: x.why,
        weight: x.weight, findAbnormal: x.findAbnormal, need: x.need
      };
      if (x.img) e.img = x.img;
      if (x.kind === 'throat') e.voice = 'mouth';
      C.exams.push(e);
    });

    /* Аускультация добавляется как два приёма осмотра: глубокое дыхание
       и сама панель. Без e.ausc открыть схему грудной клетки нечем. */
    if (d.auscultation.enabled) {
      var hasAbn = false;
      var used = { normal: true };
      AUSC_POINTS.forEach(function (ap) {
        var key = d.auscultation.points[ap.id];
        if (!key) return;
        var f = key === 'normal' ? NORMAL_FINDING : CC.LUNG_PRESETS[key];
        used[key] = true;
        if (f.abnormal) hasAbn = true;
        C.auscultation.points.push({
          id: ap.id, x: ap.x, y: ap.y, label: ap.label,
          side: ap.side, zone: ap.zone, finding: key
        });
      });
      Object.keys(used).forEach(function (k) {
        C.auscultation.findings[k] = k === 'normal' ? NORMAL_FINDING : CC.LUNG_PRESETS[k];
      });

      C.exams.push(
        { id: 'e.deep', cat: 'exam', w: 1, label: 'Попросить дышать глубоко через рот',
          kind: 'plain', weight: 2, findAbnormal: false, voice: 'deep',
          result: 'Пациент дышит глубоко и ровно через открытый рот. Дыхание стало отчётливо слышно.',
          why: 'Без глубокого дыхания через рот аускультация неинформативна — слабые побочные шумы теряются.',
          need: [['глубок', 'глубже', 'дыша', 'дыши', 'подыш', 'вдохн', 'вдох']] },
        { id: 'e.ausc', cat: 'exam', w: 1, label: 'Аускультация лёгких', kind: 'auscult',
          weight: 6, findAbnormal: hasAbn,
          title: 'Аускультация лёгких',
          note: 'Задняя поверхность грудной клетки. Выберите точку и слушайте.',
          why: 'Слушать нужно все поля: патология выявляется контрастом между зонами.',
          need: [['легкие', 'легких', 'легком', 'легочн', 'аускульт', 'стетоскоп', 'фонендоскоп', 'хрип']] }
      );
    }

    d.orders.forEach(function (x) {
      var o = {
        id: x.id, cat: 'order', w: 1, label: x.label, role: x.role,
        weight: x.weight, result: x.result, hint: x.hint, need: x.need
      };
      if (x.img) o.img = x.img;
      C.orders.push(o);
    });

    d.treatment.forEach(function (x) {
      C.treatment.push({
        id: x.id, cat: 'treat', w: 1, label: x.label, role: x.role,
        weight: x.weight, hint: x.hint, need: x.need
      });
    });

    d.diagnosis.options.forEach(function (x) {
      C.diagnosis.options.push({
        id: x.id, cat: 'dx', w: 1, label: x.label,
        verdict: x.verdict, why: x.why, need: x.need
      });
    });

    d.rules.forEach(function (id) {
      var r = ruleById(id);
      if (r) C.algorithm.push(r);
    });

    return C;
  };

  /* =========================================================
     Общие случаи: публикации преподавателя из облака
     ========================================================= */

  /* Массив черновиков приносит модуль синхронизации (site/sync.js) в
     window.SHARED_CASES. До его готовности, без него (сайт открыт с диска)
     или без сети — пусто, и всё работает как раньше. Общие случаи здесь
     только для чтения: публикуют их в конструкторе, на витрине и в
     тренажёре они просто видны. */
  function sharedDrafts() {
    var raw = window.SHARED_CASES, out = [], seen = {};
    if (!isArr(raw)) return out;
    raw.forEach(function (x) {
      if (!x || typeof x !== 'object') return;
      var d = CC.normalize(x);
      if (!d.id || seen[d.id]) return;
      seen[d.id] = 1;
      d.savedAt = +x.publishedAt || 0;   /* время публикации — для сортировки */
      d.shared = true;
      out.push(d);
    });
    out.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    return out;
  }

  CC.sharedIds = function () {
    var out = {};
    sharedDrafts().forEach(function (d) { out[d.id] = 1; });
    return out;
  };

  /* =========================================================
     Хранилище
     ========================================================= */

  function readAll() {
    if (!CC.storageOk) return {};
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return (raw && typeof raw === 'object' && !isArr(raw)) ? raw : {};
    } catch (e) { return {}; }
  }

  function writeAll(map) {
    if (!CC.storageOk) return false;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(map));
      return true;
    } catch (e) { return false; }   /* переполнение: чаще всего картинки */
  }

  /* Список черновиков: сначала общие (они же видны студентам), затем
     локальные. Префикс «встроенные + общие» одинаков у преподавателя и у
     студентов, поэтому номера случаев на витрине совпадают. */
  CC.list = function () {
    var out = sharedDrafts();
    var shared = CC.sharedIds();
    var map = readAll(), local = [];
    Object.keys(map).forEach(function (k) {
      if (shared[k]) return;  /* общий уже в списке — копию не дублируем */
      var d = CC.normalize(map[k]);
      if (!d.id) return;
      d.savedAt = map[k].savedAt || 0;
      local.push(d);
    });
    local.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    return out.concat(local);
  };

  CC.get = function (id) {
    /* Локальный черновик приоритетнее общего: преподаватель мог править
       случай после публикации — запуск показывает свежую рабочую версию.
       У студента локальной копии с тем же id нет — он получает общую. */
    var raw = readAll()[id];
    if (raw) return CC.normalize(raw);
    var sh = sharedDrafts();
    for (var i = 0; i < sh.length; i++) {
      if (sh[i].id === id) return sh[i];
    }
    return null;
  };

  /* save(draft) → { ok, id, error }. id присваивается при первом
     сохранении и дальше не меняется: на коды результатов студентов уже
     могут ссылаться журналы преподавателей. */
  CC.save = function (draft) {
    var d = CC.normalize(draft);
    if (!d.id) d.id = 'custom-' + CC.slugify(d.disease || d.title || 'случай');
    var map = readAll();
    /* Уникальность id при конфликте имён: второй «отёк лёгких» получает
       суффикс, первый остаётся на месте. */
    if (map[d.id] && map[d.id].__owner !== draft.__owner && !draft.id) {
      var n = 2, base = d.id;
      while (map[d.id]) { d.id = base + '-' + n; n++; }
    }
    map[d.id] = d;
    map[d.id].savedAt = Date.now ? Date.now() : 0;
    if (!writeAll(map)) {
      return { ok: false, id: d.id,
               error: 'Браузер не сохранил случай (переполнение localStorage — уменьшите картинки).' };
    }
    emitChange();
    return { ok: true, id: d.id };
  };

  CC.remove = function (id) {
    var map = readAll();
    if (!map[id]) return false;
    delete map[id];
    writeAll(map);
    emitChange();
    return true;
  };

  /* Записи манифеста для loader/teacher/picker. Дедуп по file — страховка
     от повреждённого хранилища с двумя одинаковыми id. shared — пометка
     общего случая (бейдж на витрине, защита от удаления у студента). */
  CC.manifestEntries = function () {
    var seen = {}, out = [];
    CC.list().forEach(function (d) {
      var file = d.id + '.js';
      if (seen[file]) return;
      seen[file] = 1;
      out.push({ file: file,
                 disease: d.disease || (d.shared ? 'Случай преподавателя' : 'Свой случай'),
                 label: d.title || d.id, custom: true, shared: !!d.shared });
    });
    return out;
  };

  /* =========================================================
     Подписка на изменения (teacher, picker перерисовываются сами)
     ========================================================= */

  var listeners = [];

  CC.onChange = function (fn) {
    if (typeof fn === 'function') listeners.push(fn);
  };

  function emitChange() {
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) {}
    });
  }
  CC.emitChange = emitChange;

  /* =========================================================
     Экспорт / импорт файла случая
     ========================================================= */

  var SENT_OPEN = '// >>> VP-CUSTOM-CASE-V1 >>>';
  var SENT_CLOSE = '// <<< VP-CUSTOM-CASE-V1 <<<';

  CC.exportText = function (draft) {
    var d = CC.normalize(draft);
    return '/* ВИРТУАЛЬНЫЙ ПРИЁМ · СВОЙ СЛУЧАЙ · формат v1\n' +
      '   Создан конструктором (teacher.html → «Конструктор»). Между маркерами —\n' +
      '   обычный JSON: его можно править руками, главное — не трогать сами маркеры.\n' +
      '   Импорт: витрина (index.html) → «Импорт случая» или конструктор → «Импорт». */\n' +
      SENT_OPEN + '\n' +
      'window.__CUSTOM_CASE__ =\n' +
      JSON.stringify(d, null, 2) + '\n' +
      ';\n' +
      SENT_CLOSE + '\n';
  };

  /* Принимает и файл с маркерами, и голый JSON (передали текстом). */
  CC.importText = function (text) {
    var s = String(text || '');
    var body = null;
    var a = s.indexOf(SENT_OPEN), b = s.indexOf(SENT_CLOSE);
    if (a >= 0 && b > a) {
      body = s.slice(a + SENT_OPEN.length, b);
      body = body.replace(/^\s*window\.__CUSTOM_CASE__\s*=\s*/, '')
                 .replace(/;\s*$/, '');
    } else {
      body = s.replace(/^\s+|\s+$/g, '');
    }
    var raw;
    try { raw = JSON.parse(body); }
    catch (e) { return { error: 'файл не читается — это не экспорт конструктора' }; }
    if (!raw || typeof raw !== 'object' || isArr(raw)) {
      return { error: 'в файле нет описания случая' };
    }
    return { draft: CC.normalize(raw) };
  };

  /* =========================================================
     Валидация перед сохранением и запуском
     ========================================================= */

  CC.validate = function (draft) {
    var d = CC.normalize(draft);
    var errs = [];

    if (!d.disease) errs.push('Не указана болезнь (диагноз случая).');
    if (!d.title) errs.push('Не указан заголовок — кто приходит на приём.');
    if (!d.patient.greetingText) errs.push('Пустая вступительная реплика пациента.');
    if (!d.questions.length) errs.push('Нужен хотя бы один вопрос расспроса.');

    if (d.diagnosis.options.length < 2) {
      errs.push('Вариантов диагноза должно быть хотя бы два.');
    } else {
      var okCorrect = false;
      d.diagnosis.options.forEach(function (o) {
        if (o.id === d.diagnosis.correct) okCorrect = true;
      });
      if (!okCorrect) errs.push('Не отмечен верный диагноз.');
    }

    /* Уникальность id по всем коллекциям: app.js кладёт их в один BYID. */
    var seen = {}, dup = null;
    function reg(id) { if (seen[id]) dup = id; seen[id] = 1; }
    d.passport.forEach(function (x) { reg(x.id); });
    d.vitals.forEach(function (x) { reg(x.id); });
    d.questions.forEach(function (x) { reg(x.id); });
    d.exams.forEach(function (x) { reg(x.id); });
    d.orders.forEach(function (x) { reg(x.id); });
    d.treatment.forEach(function (x) { reg(x.id); });
    d.diagnosis.options.forEach(function (x) { reg(x.id); });
    if (dup) errs.push('Повторяющийся идентификатор «' + dup + '» — переименуйте одно из действий.');

    if (d.auscultation.enabled && !Object.keys(d.auscultation.points).length) {
      errs.push('Аускультация включена, но не назначена ни одна находка: ' +
                'отметьте хотя бы одно поле (или выключите аускультацию).');
    }

    /* localStorage не резиновый: data-URI картинок — основной вес. */
    var size = JSON.stringify(d).length;
    if (size > 3 * 1024 * 1024) {
      errs.push('Случай тяжелее 3 МБ — уменьшите или удалите часть картинок.');
    }

    return errs;
  };

  /* =========================================================
     Картинка → data-URI (для снимков в обследованиях)
     ========================================================= */

  /* Сжимает до maxDim по длинной стороне и JPEG: снимок 4 МБ превращается
     в ~150 КБ, что ещё терпимо для localStorage. cb(dataUri | null). */
  CC.imageToDataUri = function (file, cb, maxDim) {
    var lim = maxDim || 900;
    if (!file || !/^image\//.test(file.type || '')) { cb(null); return; }
    var rd = new FileReader();
    rd.onerror = function () { cb(null); };
    rd.onload = function () {
      var img = new Image();
      img.onerror = function () { cb(null); };
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var k = Math.min(1, lim / Math.max(w, h));
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(w * k));
          cv.height = Math.max(1, Math.round(h * k));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          cb(cv.toDataURL('image/jpeg', 0.85));
        } catch (e) { cb(null); }
      };
      img.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  };

  window.CustomCases = CC;
})();
