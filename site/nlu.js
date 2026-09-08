/* Разбор свободного текста врача в намерение.
   Полностью офлайн: словарь корней и арифметика. Никаких моделей,
   никаких запросов в сеть — файл работает и с file://.

   Почему без стеммера. Сопоставление идёт по ПОДСТРОКЕ корня, а не по
   равенству основ, поэтому склонение и спряжение снимаются сами:
   «мокрот» находится и в «мокрота», и в «мокроты», и в «мокротой».
   Стеммер добавил бы только риск переусечения («лёгкие» → «легк» → ложное
   совпадение с «легко»). Нерегулярные формы («кашель» при корне «кашл»)
   перечисляются в группе явными вариантами — это видно и отлаживается.

   Правило совпадения корня с токеном:
     длина корня >= 4  — подстрока  ('кашл' ловит «покашливание»)
     длина корня <= 3  — точное равенство ('кт', 'оак', 'ад' не должны
                         совпадать с «ктото», «оаки», «адрес») */
(function () {
  'use strict';

  var NLU = {};

  /* ---------------------------------------------------------------- */
  /* 1. Нормализация                                                  */
  /* ---------------------------------------------------------------- */

  function normalize(s) {
    s = window.KazakhNLU ? window.KazakhNLU.canonical(s == null ? '' : s) : s;
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-яәғқңөұүһі0-9]+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
  }

  function tokenize(s) {
    var n = normalize(s);
    return n ? n.split(/\s+/) : [];
  }

  NLU.normalize = normalize;
  NLU.tokenize = tokenize;

  /* ---------------------------------------------------------------- */
  /* 2. Совпадение корня и группы                                     */
  /* ---------------------------------------------------------------- */

  function rootHitsToken(root, token) {
    if (root.length <= 3) return token === root;
    return token.indexOf(root) >= 0;
  }

  /* Группа закрыта, если хотя бы один её корень нашёлся хотя бы в одном
     токене. */
  function groupClosed(group, toks) {
    for (var i = 0; i < group.length; i++) {
      for (var j = 0; j < toks.length; j++) {
        if (rootHitsToken(group[i], toks[j])) return true;
      }
    }
    return false;
  }

  function anyRootHits(roots, toks) {
    if (!roots || !roots.length) return false;
    return groupClosed(roots, toks);
  }

  /* ---------------------------------------------------------------- */
  /* 3. Глаголы действия — жёсткая маршрутизация по категории          */
  /* ---------------------------------------------------------------- */

  /* Каждый глагол задаёт МНОЖЕСТВО допустимых категорий. «Назначить»
     подходит и обследованию, и лечению — разведёт сам счёт. */
  var VERBS = [
    { cats: ['measure'], roots: ['измер', 'смер', 'термометр', 'посчита', 'подсчита', 'сосчита', 'взвес'] },
    { cats: ['order'],   roots: ['направ', 'заказ', 'обследова'] },
    { cats: ['order', 'treat'], roots: ['назнач', 'сдела', 'выпис'] },
    { cats: ['treat'],   roots: ['лечен', 'лечит', 'вылеч', 'пропис', 'рекоменд', 'терапи', 'дать', 'назначаю лечение'] },
    { cats: ['exam'],    roots: ['послуш', 'выслуш', 'аускульт', 'перкут', 'перкусс', 'пальпир', 'прощупа', 'ощупа', 'осмотр', 'осмотрет', 'посмотр', 'взглян', 'гляну', 'обследуй'] },
    { cats: ['exam', 'measure'], roots: ['провер'] },
    { cats: ['ask'],     roots: ['спрос', 'спрош', 'узна', 'уточн', 'расспрос', 'опрос'] },
    { cats: ['dx'],      roots: ['диагноз', 'диагностир', 'заключен'] }
  ];

  /* Признаки того, что человек задаёт вопрос пациенту, а не командует. */
  var QWORDS = ['как', 'скольк', 'что', 'чем', 'кем', 'ког', 'где', 'как', 'какой', 'кака',
                'почему', 'зачем', 'бывае', 'беспоко', 'есть', 'ли', 'был', 'была', 'были',
                'давно', 'часто', 'вас', 'вам', 'вы'];
  var NEG = { 'не': 1, 'нет': 1, 'без': 1, 'не-': 1 };

  function detectCats(toks) {
    var set = {}, found = false, i;
    for (i = 0; i < VERBS.length; i++) {
      if (anyRootHits(VERBS[i].roots, toks)) {
        found = true;
        for (var j = 0; j < VERBS[i].cats.length; j++) set[VERBS[i].cats[j]] = 1;
      }
    }
    return found ? set : null;
  }

  function looksLikeQuestion(raw, toks) {
    if (/[?]\s*$/.test(String(raw || ''))) return true;
    return anyRootHits(QWORDS, toks);
  }

  function hasNegation(toks) {
    for (var i = 0; i < toks.length; i++) if (NEG[toks[i]]) return true;
    return false;
  }

  /* ---------------------------------------------------------------- */
  /* 4. Опечатки — аварийная ступень, а не поблажка                    */
  /* ---------------------------------------------------------------- */

  /* Расстояние Дамерау—Левенштейна с отсечением: считаем только до 2,
     дальше не интересно. */
  function editDist(a, b, cap) {
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    var prev2 = null,
        prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var best = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 &&
            a.charAt(i - 1) === b.charAt(j - 2) &&
            a.charAt(i - 2) === b.charAt(j - 1)) {
          v = Math.min(v, prev2[j - 2] + 1);
        }
        cur[j] = v;
        if (v < best) best = v;
      }
      if (best > cap) return cap + 1;
      prev2 = prev;
      prev = cur;
    }
    return prev[b.length];
  }

  NLU.editDist = editDist;

  /* Одна правка в токене, если он почти совпадает с корнем словаря.
     Возвращает исправленный список токенов или null. */
  function repair(toks, vocab) {
    var out = toks.slice(), changed = false, i, k;
    for (i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t.length < 5) continue;
      var hit = null, hits = 0;
      for (k = 0; k < vocab.length; k++) {
        var root = vocab[k];
        if (root.length < 5) continue;
        if (t.indexOf(root) >= 0) { hits = 0; hit = null; break; }
        var head = t.slice(0, root.length + 1);
        if (editDist(head, root, 1) === 1) {
          if (hit && hit !== root) { hits = 2; break; }
          hit = root; hits = 1;
        }
      }
      if (hits === 1 && hit) { out[i] = hit; changed = true; }
    }
    return changed ? out : null;
  }

  /* ---------------------------------------------------------------- */
  /* 5. Счёт намерений                                                */
  /* ---------------------------------------------------------------- */

  /* Намерение: { id, cat, w, need: [[корни], ...], no: [корни] }
     Кандидат — только если закрыты ВСЕ группы need и не сработал ни один
     корень из no. Счёт = число закрытых групп + w. */
  function score(intents, toks, catFilter, qBonus) {
    var out = [], i, g;
    for (i = 0; i < intents.length; i++) {
      var it = intents[i];
      if (catFilter && !catFilter[it.cat]) continue;
      if (it.no && anyRootHits(it.no, toks)) continue;
      var need = it.need || [], closed = 0, ok = true;
      for (g = 0; g < need.length; g++) {
        if (groupClosed(need[g], toks)) closed++;
        else { ok = false; break; }
      }
      if (!ok || !need.length) continue;
      var s = closed + (it.w || 0);
      if (qBonus && it.cat === 'ask') s += 2;
      out.push({ id: it.id, cat: it.cat, w: it.w || 0, score: s, intent: it });
    }
    out.sort(function (a, b) { return b.score - a.score || b.w - a.w; });
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* 6. Точка входа                                                   */
  /* ---------------------------------------------------------------- */

  /* NLU.match(raw, intents, opts) → одна из форм:
       { ok:true,  cat, id, score, corrected:'строка'|null }
       { ok:false, kind:'clarify', options:[{id,cat,label}, ...] }
       { ok:false, kind:'refused', verbCats:{...} }
       { ok:false, kind:'unknown', raw }
     opts.cat — категория, выбранная кнопкой; перекрывает глагол.
     opts.label(id) — подпись намерения для кнопок уточнения. */
  NLU.match = function (raw, intents, opts) {
    opts = opts || {};
    var toks = tokenize(raw);
    if (!toks.length) return { ok: false, kind: 'unknown', raw: raw };

    var verbCats = detectCats(toks);

    /* Отрицание перед действием — врач отменяет назначение, а не делает его. */
    if (verbCats && hasNegation(toks)) {
      return { ok: false, kind: 'refused', verbCats: verbCats, raw: raw };
    }

    var catFilter = null;
    if (opts.cat) {
      catFilter = {};
      catFilter[opts.cat] = 1;
    } else if (verbCats) {
      catFilter = verbCats;
    }

    var qBonus = !catFilter && looksLikeQuestion(raw, toks);
    var cands = score(intents, toks, catFilter, qBonus);
    var corrected = null;

    /* Кандидатов нет — единственное место, где допускается опечатка. */
    if (!cands.length) {
      var vocab = NLU.vocabulary(intents);
      var fixed = repair(toks, vocab);
      if (fixed) {
        var retry = score(intents, fixed, catFilter, qBonus);
        if (retry.length === 1) {
          cands = retry;
          corrected = fixed.join(' ');
        }
      }
    }

    if (!cands.length) return { ok: false, kind: 'unknown', raw: raw };

    if (cands.length === 1) {
      return { ok: true, cat: cands[0].cat, id: cands[0].id, score: cands[0].score, corrected: corrected };
    }

    var gap = cands[0].score - cands[1].score;
    if (gap >= 2) {
      return { ok: true, cat: cands[0].cat, id: cands[0].id, score: cands[0].score, corrected: corrected };
    }

    /* Разрыв мал. Внутри одной категории решает специфичность, между
       категориями — не угадываем, а спрашиваем. */
    if (cands[0].cat === cands[1].cat && cands[0].w > cands[1].w) {
      return { ok: true, cat: cands[0].cat, id: cands[0].id, score: cands[0].score, corrected: corrected };
    }

    var opts2 = [], seen = {}, i;
    for (i = 0; i < cands.length && opts2.length < 3; i++) {
      if (cands[i].score < cands[0].score - 1) break;
      if (seen[cands[i].id]) continue;
      seen[cands[i].id] = 1;
      opts2.push({
        id: cands[i].id,
        cat: cands[i].cat,
        label: opts.label ? opts.label(cands[i].id) : cands[i].id
      });
    }
    if (opts2.length < 2) {
      return { ok: true, cat: cands[0].cat, id: cands[0].id, score: cands[0].score, corrected: corrected };
    }
    return { ok: false, kind: 'clarify', options: opts2, raw: raw };
  };

  /* Все корни каталога — для аварийного исправления опечаток. */
  NLU.vocabulary = function (intents) {
    if (intents.__vocab) return intents.__vocab;
    var v = [], seen = {}, i, g, k;
    for (i = 0; i < intents.length; i++) {
      var need = intents[i].need || [];
      for (g = 0; g < need.length; g++) {
        for (k = 0; k < need[g].length; k++) {
          var r = need[g][k];
          if (!seen[r]) { seen[r] = 1; v.push(r); }
        }
      }
    }
    for (i = 0; i < VERBS.length; i++) {
      for (k = 0; k < VERBS[i].roots.length; k++) {
        var vr = VERBS[i].roots[k];
        if (!seen[vr]) { seen[vr] = 1; v.push(vr); }
      }
    }
    try { intents.__vocab = v; } catch (e) {}
    return v;
  };

  window.NLU = NLU;
})();
