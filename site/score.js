/* Оценка приёма и код результата — общий модуль тренажёра (app.js) и
   страницы преподавателя (teacher.js).

   Подсчёт раньше жил внутри app.js; теперь его видит и журнал
   преподавателя: балл всегда пересчитывается из лога приёма, а не
   доверяется числу в коде результата.

   session — снимок состояния приёма: { log, done, heard, dx, unknowns,
   clarifies }. Тренажёр передаёт свой state целиком, журнал — объект,
   восстановленный из кода результата. Один IIFE, ES5, без сети. */
(function () {
  'use strict';

  var Score = {};

  /* Веса восьми плиток разбора. Единственный источник правды: критерии
     на странице преподавателя рендерятся отсюда же. */
  Score.WEIGHTS = {
    ask: 0.25, pass: 0.05, vit: 0.10, exam: 0.20,
    order: 0.15, treat: 0.10, dx: 0.10, algo: 0.05
  };
  Score.TILE_LABELS = {
    ask: 'Расспрос', pass: 'Паспортная часть', vit: 'Показатели',
    exam: 'Физикальный осмотр', order: 'Обследование', treat: 'Лечение',
    dx: 'Диагноз', algo: 'Алгоритм'
  };

  function pick(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  /* =========================================================
     Хронология для правил на порядок действий
     ========================================================= */

  Score.timeline = function (log) {
    var acts = [], i;
    for (i = 0; i < (log || []).length; i++) if (log[i].id) acts.push(log[i]);

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
  };

  /* =========================================================
     Правила алгоритма
     ========================================================= */

  /* Правило участвует в оценке только если его предпосылка возникла:
     «КТ без рентгена» ничего не говорит о враче, который КТ не назначал.
     Без этого фильтра бездействие получало бы высокий балл за алгоритм —
     просто потому, что нарушать было нечего. Правило без `when` в игре
     всегда. */
  function applies(r, t) {
    if (!r.when) return true;
    try { return !!r.when(t); } catch (e) { return false; }
  }

  Score.violations = function (CASE, t) {
    var out = [];
    (CASE.algorithm || []).forEach(function (r) {
      if (!applies(r, t)) return;
      var bad = false;
      try { bad = !!r.test(t); } catch (e) { bad = false; }
      if (bad) out.push(r);
    });
    return out;
  };

  Score.rulesInPlay = function (CASE, t) {
    var n = 0;
    (CASE.algorithm || []).forEach(function (r) { if (applies(r, t)) n++; });
    return n;
  };

  /* =========================================================
     Оценка
     ========================================================= */

  Score.compute = function (CASE, session) {
    var s = {};
    var done = session.done || {};
    var heard = session.heard || {};

    function ratio(list, wOf) {
      var tot = 0, got = 0;
      list.forEach(function (x) {
        var w = wOf(x);
        tot += w;
        if (done[x.id]) got += w;
      });
      return tot ? got / tot : 0;
    }

    /* Полезное набирает, вредное и бессмысленное вычитает. */
    function roleScore(list, badRole, penalty) {
      var tot = 0, got = 0, bad = 0;
      list.forEach(function (x) {
        if (x.role === badRole) {
          if (done[x.id]) bad++;
          return;
        }
        if (x.role === 'waste') {
          if (done[x.id]) bad++;
          return;
        }
        var w = x.weight || 1;
        tot += w;
        if (done[x.id]) got += w;
      });
      var base = tot ? got / tot : 0;
      return Math.max(0, base - bad * penalty);
    }

    s.ask = ratio(CASE.questions || [], function (q) { return q.weight || 1; });
    s.pass = ratio(CASE.passport || [], function (p) { return p.important ? 2 : 1; });
    s.vit = ratio(CASE.vitals || [], function (v) { return v.weight || 1; });

    /* Физикальный осмотр: аускультация считается отдельно — важно не то,
       что врач её начал, а сколько полей прослушал и нашёл ли патологию.
       Кастомный случай без схемы грудной клетки (пустые points) оценивает
       приём аускультации как обычный осмотр: выполнил — получил вес. */
    var auscPts = (CASE.auscultation && CASE.auscultation.points) || [];
    var auscFind = (CASE.auscultation && CASE.auscultation.findings) || {};
    var eTot = 0, eGot = 0;
    (CASE.exams || []).forEach(function (e) {
      var w = e.weight || 0;
      if (!w) return;
      eTot += w;
      if (e.kind === 'auscult' && auscPts.length) {
        var h = 0, abn = 0, abnTot = 0;
        auscPts.forEach(function (p) {
          var f = auscFind[p.finding] || {};
          if (f.abnormal) abnTot++;
          if (heard[p.id]) { h++; if (f.abnormal) abn++; }
        });
        var cov = h / auscPts.length;
        var found = abnTot ? abn / abnTot : 1;
        eGot += w * (0.4 * cov + 0.6 * found);
      } else if (done[e.id]) {
        eGot += w;
      }
    });
    s.exam = eTot ? eGot / eTot : 0;

    s.order = roleScore(CASE.orders || [], 'waste', 0.10);
    s.treat = roleScore(CASE.treatment || [], 'harm', 0.20);
    s.dx = session.dx === (CASE.diagnosis || {}).correct;

    /* Доля соблюдённых правил среди тех, что были в игре, а не вычитание
       фиксированного штрафа: иначе балл зависел бы от того, сколько правил
       вообще есть в файле случая. */
    var t = Score.timeline(session.log);
    s.rules = Score.rulesInPlay(CASE, t);
    s.algo = s.rules ? Math.max(0, 1 - Score.violations(CASE, t).length / s.rules) : 0;

    /* Веса нормируются по активным плиткам: у кастомного случая может не
       быть паспорта, показателей или обследований, и пустая коллекция не
       должна тянуть итог вниз — её вес распределяется между оставшимися.
       У встроенных случаев все плитки на месте, делитель равен единице и
       формула совпадает с прежней. */
    var acc = 0, wSum = 0;
    function tile(w, v) { acc += w * v; wSum += w; }
    if ((CASE.questions || []).length) tile(Score.WEIGHTS.ask, s.ask);
    if ((CASE.passport || []).length) tile(Score.WEIGHTS.pass, s.pass);
    if ((CASE.vitals || []).length) tile(Score.WEIGHTS.vit, s.vit);
    if (eTot) tile(Score.WEIGHTS.exam, s.exam);
    if ((CASE.orders || []).length) tile(Score.WEIGHTS.order, s.order);
    if ((CASE.treatment || []).length) tile(Score.WEIGHTS.treat, s.treat);
    if ((CASE.diagnosis || {}).correct != null) tile(Score.WEIGHTS.dx, s.dx ? 1 : 0);
    if (s.rules) tile(Score.WEIGHTS.algo, s.algo);
    s.total = Math.round(100 * (wSum ? acc / wSum : 0));
    return s;
  };

  /* =========================================================
     Ошибки и пропуски
     ========================================================= */

  /* Не выявленные патологии: поля, которые не выслушаны, приёмы, которые
     не выполнены, показатели, которые не измерены. */
  Score.missed = function (CASE, session) {
    var out = [];
    var done = session.done || {};
    var heard = session.heard || {};

    /* Кастомный случай может быть без схемы грудной клетки и даже без
       приёма аускультации — тогда и пропусков этой группы нет. */
    var auscPts = (CASE.auscultation && CASE.auscultation.points) || [];
    var auscFind = (CASE.auscultation && CASE.auscultation.findings) || {};
    auscPts.forEach(function (p) {
      var f = auscFind[p.finding] || {};
      if (f.abnormal && !heard[p.id]) {
        out.push({
          label: p.label + ' — ' + (f.title || 'патология'),
          why: 'Поле не выслушано. Именно здесь была слышна патология.'
        });
      }
    });
    var auscExam = pick(CASE.exams || [], 'e.ausc');
    if (auscExam && !done['e.ausc']) {
      out.push({ label: 'Аускультация лёгких не проводилась совсем',
                 why: auscExam.why });
    }

    (CASE.exams || []).forEach(function (e) {
      if (e.findAbnormal && e.kind !== 'auscult' && !done[e.id]) {
        out.push({ label: e.title || e.label, why: e.why });
      }
    });

    (CASE.vitals || []).forEach(function (v) {
      if (v.abnormal && !done[v.id]) {
        out.push({ label: v.field + ' ' + v.value + ' ' + (v.unit || ''),
                   why: 'Отклонение осталось неизмеренным.' });
      }
    });

    return out;
  };

  /* Те же одиннадцать групп «Ошибок и пропусков», что в разборе тренажёра,
     но данными: разбор рендерит их в HTML, журнал преподавателя
     агрегирует по группе. Пустые группы не входят. */
  Score.missedGroups = function (CASE, session) {
    var done = session.done || {};
    function notDone(x) { return !done[x.id]; }
    function isDone(x) { return !!done[x.id]; }

    var groups = [];
    function add(title, items) {
      if (items && items.length) groups.push({ title: title, items: items });
    }

    add('Не собраны паспортные данные',
      CASE.passport.filter(notDone).map(function (p) {
        return { label: p.field + ' — ' + p.label.toLowerCase(), why: p.why };
      }));

    add('Не измерено',
      CASE.vitals.filter(notDone).map(function (v) {
        return {
          label: v.field,
          why: v.abnormal
            ? 'Показатель был отклонён от нормы (' + v.value + ' ' + (v.unit || '') +
              ') — отклонение осталось незамеченным.'
            : null
        };
      }));

    add('Не заданы важные вопросы',
      CASE.questions.filter(notDone).filter(function (q) { return q.important; })
        .map(function (q) { return { label: q.label, why: q.why }; }));

    add('Не заданы прочие вопросы',
      CASE.questions.filter(notDone).filter(function (q) { return !q.important; })
        .map(function (q) { return { label: q.label, why: null }; }));

    add('Не выявленные патологии', Score.missed(CASE, session));

    add('Не назначено — обследование',
      CASE.orders.filter(notDone).filter(function (o) { return o.role === 'need'; })
        .map(function (o) { return { label: o.label, why: o.hint }; }));

    add('Стоило рассмотреть — обследование',
      CASE.orders.filter(notDone).filter(function (o) { return o.role === 'useful'; })
        .map(function (o) { return { label: o.label, why: o.hint }; }));

    add('Не назначено — лечение',
      CASE.treatment.filter(notDone).filter(function (x) { return x.role === 'need'; })
        .map(function (x) { return { label: x.label, why: x.hint }; }));

    add('Назначено зря',
      CASE.orders.filter(isDone).filter(function (o) { return o.role === 'waste'; })
        .map(function (o) { return { label: o.label, why: o.hint }; }));

    add('Назначено ошибочно',
      CASE.treatment.filter(isDone).filter(function (x) { return x.role === 'harm'; })
        .map(function (x) { return { label: x.label, why: x.hint }; }));

    add('Пациент не понял вопрос',
      (session.unknowns || []).map(function (u) {
        return { label: '«' + u + '»', why: null };
      }));

    return groups;
  };

  /* =========================================================
     Презентационные
     ========================================================= */

  Score.band = function (pct) {
    return pct >= 80 ? 'is-good' : pct >= 50 ? 'is-mid' : 'is-bad';
  };

  Score.grade = function (t) {
    return t >= 85 ? 'приём проведён образцово' :
           t >= 70 ? 'хорошо, но есть пробелы' :
           t >= 50 ? 'приём поверхностный' :
                     'ключевые данные не собраны';
  };

  Score.pct = function (x) { return Math.round(x * 100) + ' %'; };

  Score.mmss = function (sec) {
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  };

  /* =========================================================
     Код результата
     ========================================================= */

  /* Строка вида VP1.<base64>. Сам балл в код не входит: преподавательская
     страница пересчитывает его из лога, и правка кода руками ничего не
     даёт. В `a` идут только строки журнала с id — включая служебные
     'ausc:*' и '__dx': правилам порядка нужен их вклад в хронологию. */
  var CODE_PREFIX = 'VP1.';

  Score.encodeResult = function (CASE, session, meta) {
    meta = meta || {};
    var log = session.log || [];
    var last = log.length ? log[log.length - 1].ts : 0;

    var payload = {
      v: 1,
      c: CASE.id,
      n: meta.name || '',
      g: meta.group || '',
      d: Math.round(last),
      dx: session.dx || null,
      u: session.unknowns || [],
      k: session.clarifies || 0,
      a: log.filter(function (r) { return r.id; })
            .map(function (r) { return [r.id, Math.round(r.ts)]; }),
      h: session.heard || {}
    };
    return CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  };

  /* Индекс id -> {cat, kind} по данным случая: восстановленный лог обязан
     нести те же поля, что и живой, — правилам нужен и cat, и kind. */
  function intentIndex(CASE) {
    var ix = {};
    function reg(list, kind) {
      list.forEach(function (x) { ix[x.id] = { cat: x.cat, kind: kind }; });
    }
    reg(CASE.passport || [], 'passport');
    reg(CASE.questions || [], 'question');
    reg(CASE.vitals || [], 'vital');
    reg(CASE.exams || [], 'exam');
    reg(CASE.orders || [], 'order');
    reg(CASE.treatment || [], 'treat');
    reg((CASE.diagnosis && CASE.diagnosis.options) || [], 'dx');
    return ix;
  }

  /* cases — массив загруженных случаев (window.CASES). Возвращает
     { error } либо { CASE, meta, session }. */
  Score.decodeResult = function (code, cases) {
    var s = String(code || '').replace(/^\s+|\s+$/g, '');
    if (s.indexOf(CODE_PREFIX) === 0) s = s.slice(CODE_PREFIX.length);
    s = s.replace(/\s+/g, '');

    var p;
    try {
      p = JSON.parse(decodeURIComponent(escape(atob(s))));
    } catch (e) {
      return { error: 'код не читается — проверьте, что скопирован целиком' };
    }
    if (!p || p.v !== 1) return { error: 'формат кода не поддерживается' };

    var CASE = null, i;
    for (i = 0; i < (cases || []).length; i++) {
      if (cases[i].id === p.c) { CASE = cases[i]; break; }
    }
    if (!CASE) return { error: 'случай «' + (p.c || ' ?') + '» на этой странице не загружен' };

    var ix = intentIndex(CASE);
    var log = [], done = {};
    (p.a || []).forEach(function (row) {
      var id = row[0];
      var meta = ix[id];
      if (!meta && id === '__dx') meta = { cat: 'dx', kind: 'dx' };
      if (!meta && id.indexOf('ausc:') === 0) meta = { cat: 'exam', kind: 'exam' };
      log.push({ id: id, ts: row[1],
                 cat: meta ? meta.cat : null, kind: meta ? meta.kind : null });
      if (id === '__dx') { done['__dx'] = true; return; }
      if (id.indexOf('ausc:') === 0) return;
      if (meta) done[id] = true;
    });

    return {
      error: null,
      CASE: CASE,
      meta: { name: p.n || '', group: p.g || '', duration: p.d || 0,
              unknowns: p.u || [], clarifies: p.k || 0 },
      session: { log: log, done: done, heard: p.h || {}, dx: p.dx || null,
                 unknowns: p.u || [], clarifies: p.k || 0 }
    };
  };

  window.Score = Score;
})();
