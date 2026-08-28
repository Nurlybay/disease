/* Загрузчик персонажа. Выбирает СЛУЧАЙНОГО из объединённого манифеста
   (встроенные manifest.js + кастомные CustomCases.manifestEntries()),
   подключает файл обычным <script> (работает и на file://, где fetch
   запрещён) и только после этого запускает app.js — приложение
   по-прежнему видит ровно один случай в window.CASES.

   Кастомный случай не лежит файлом: он живёт в localStorage, поэтому
   вместо <script> его черновик разворачивается через CustomCases.inflate().

   Отладка:
     ?char=<id без .js>  — конкретный персонаж, например ?char=cf-omarov
     window.CURRENT_CHARACTER — запись манифеста выбранного персонажа */
(function () {
  'use strict';

  var list = (window.CHARACTER_MANIFEST || []).slice();

  /* Кастомные случаи — в конец списка. Дедуп по file: страховка от
     повреждённого хранилища (id кастома имеет префикс custom- и с
     встроенным файлом столкнуться не может, но дешевле проверить). */
  if (window.CustomCases) {
    var have = {};
    list.forEach(function (m) { have[m.file] = 1; });
    window.CustomCases.manifestEntries().forEach(function (m) {
      if (!have[m.file]) { have[m.file] = 1; list.push(m); }
    });
  }
  if (!list.length) return;

  var pick = null;
  var m = /[?&]char=([^&]+)/.exec(location.search);
  if (m) {
    var want = decodeURIComponent(m[1]) + '.js';
    for (var i = 0; i < list.length; i++) {
      if (list[i].file === want) { pick = list[i]; break; }
    }
  }
  if (!pick) pick = list[Math.floor(Math.random() * list.length)];
  window.CURRENT_CHARACTER = pick;

  function load(src, onDone) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = onDone;
    s.onerror = function () {
      document.title = 'Ошибка загрузки: ' + src;
    };
    document.head.appendChild(s);
  }

  function loadApp() { load('app.js'); }

  /* Скрипты страницы стоят в конце <body>, поэтому к моменту динамической
     загрузки DOM уже разобран и init() внутри app.js может стартовать сразу. */
  if (pick.custom && window.CustomCases) {
    var id = pick.file.replace(/\.js$/, '');
    var draft = window.CustomCases.get(id);
    if (!draft) {
      document.title = 'Случай не найден: ' + id;
      return;
    }
    window.CASES = [window.CustomCases.inflate(draft)];
    loadApp();
  } else {
    load('characters/' + pick.file, loadApp);
  }
})();
