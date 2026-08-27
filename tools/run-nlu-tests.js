/* Прогон tools/test-nlu.html в node: вытаскивает таблицу пар из html
   и вызывает NLU.match без DOM. Печатает провалившиеся строки.
   Запуск: node tools/run-nlu-tests.js */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var root = path.join(__dirname, '..');

var sandbox = { window: {}, console: console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);

function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), sandbox, { filename: rel });
}
sandbox.window.CASES = [];
load('site/nlu.js');
load('site/characters/bronchiectasis-abenov.js');

var NLU = sandbox.NLU || sandbox.window.NLU;
var CASE = sandbox.window.CASES[0];

var INTENTS = [], LABEL = {};
[CASE.passport, CASE.questions, CASE.vitals, CASE.exams,
 CASE.orders, CASE.treatment, CASE.diagnosis.options].forEach(function (list) {
  list.forEach(function (it) {
    INTENTS.push({ id: it.id, cat: it.cat, w: it.w || 0, need: it.need, no: it.no });
    LABEL[it.id] = it.label;
  });
});

/* Таблица пар берётся из самого html, чтобы не расходилась с ним. */
var html = fs.readFileSync(path.join(root, 'tools/test-nlu.html'), 'utf8');
var body = html.slice(html.indexOf('var T = ['), html.indexOf('\n  ];', html.indexOf('var T = [')) + 4);
var T = vm.runInNewContext('(function(){' + body.replace(/^var T =/, 'return') + '})()');

function ids(r) { return r.options.map(function (o) { return o.id; }).sort().join(','); }

var pass = 0, fail = 0;
T.forEach(function (t) {
  var r = NLU.match(t.in, INTENTS, { cat: t.cat, label: function (id) { return LABEL[id]; } });
  var good, got;
  if (r.ok) got = 'ok · ' + r.id + (r.corrected ? ' · «' + r.corrected + '»' : '');
  else got = r.kind === 'clarify' ? 'clarify · ' + ids(r) : r.kind;

  if (t.clarify) good = !r.ok && r.kind === 'clarify' && ids(r) === t.clarify.slice().sort().join(',');
  else if (t.unknown) good = !r.ok && r.kind === 'unknown';
  else if (t.refused) good = !r.ok && r.kind === 'refused';
  else good = r.ok && r.id === t.id && (!t.fix || !!r.corrected);

  if (good) { pass++; return; }
  fail++;
  var exp = t.clarify ? 'clarify · ' + t.clarify.slice().sort().join(',')
          : t.unknown ? 'unknown' : t.refused ? 'refused'
          : 'ok · ' + t.id + (t.fix ? ' · с исправлением' : '');
  console.log('✕ «' + t.in + '»' + (t.cat ? ' [' + t.cat + ']' : '') +
              '\n    ждали:  ' + exp + '\n    вышло:  ' + got);
});

console.log('\nпройдено ' + pass + ' · провалено ' + fail +
            ' · намерений в каталоге ' + INTENTS.length);
process.exit(fail ? 1 : 0);
