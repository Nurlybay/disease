/* Загрузчик персонажа. Выбирает СЛУЧАЙНОГО из manifest.js, подключает его
   файл обычным <script> (работает и на file://, где fetch запрещён) и только
   после этого запускает app.js — приложение по-прежнему видит ровно один
   случай в window.CASES.

   Отладка:
     ?char=<id без .js>  — конкретный персонаж, например ?char=cf-omarov
     window.CURRENT_CHARACTER — запись манифеста выбранного персонажа */
(function () {
  'use strict';

  var list = window.CHARACTER_MANIFEST || [];
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

  /* Скрипты страницы стоят в конце <body>, поэтому к моменту динамической
     загрузки DOM уже разобран и init() внутри app.js может стартовать сразу. */
  load('characters/' + pick.file, function () {
    load('app.js');
  });
})();
