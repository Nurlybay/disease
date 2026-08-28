/* Синхронизация общих случаев через интернет (облако Supabase).

   Преподаватель публикует случай в конструкторе — он попадает в облачную
   таблицу; страницы читают её на каждой загрузке и кладут черновики в
   window.SHARED_CASES, а дальше их видит обычный CustomCases (витрина,
   тренажёр, методичка, журнал).

   Доступ: чтение публичное (список случаев и не секрет — как в аудитории).
   Запись идёт через серверные функции publish_case/unpublish_case, которые
   проверяют код преподавателя; сам код хранится в базе, а не здесь.
   Настройка таблицы и функций — в SETUP.md.

   Модуль необязателен: без заполненных настроек ниже, с file:// или без
   сети он просто оставляет список общих случаев пустым — сайт работает
   ровно как раньше. Один IIFE, ES5, XHR по образцу askLLM из app.js. */
(function () {
  'use strict';

  var Sync = {};

  /* === НАСТРОЙКА (однократно) =========================================
     Адрес проекта и его анонимный ключ: панель Supabase → Settings → API.
     Анонимный ключ предназначен для браузера: доступ к данным ограничен
     политиками таблицы (чтение случаев всем, запись — только через функции
     с кодом преподавателя). Пока оба значения пустые — синхронизация
     выключена. */
  var SUPABASE_URL = '';
  var SUPABASE_ANON_KEY = '';

  var CODE_KEY = 'vp.sync.code';   /* код преподавателя, вводится один раз */

  Sync.configured = function () {
    return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
  };

  Sync.getCode = function () {
    try { return localStorage.getItem(CODE_KEY) || ''; } catch (e) { return ''; }
  };
  Sync.setCode = function (code) {
    try { localStorage.setItem(CODE_KEY, String(code || '')); } catch (e) {}
  };

  /* XHR-обёртка. Колбэк получает { ok, data, status } ровно один раз —
     таймаут и сетевая ошибка не должны вызывать его дважды. */
  function request(method, path, body, cb, timeoutMs) {
    var xhr;
    try { xhr = new XMLHttpRequest(); }
    catch (e) { cb({ ok: false, data: null, status: 0 }); return; }
    var done = false;
    function finish(ok, data, status) {
      if (done) return;
      done = true;
      cb({ ok: ok, data: data, status: status });
    }
    xhr.open(method, SUPABASE_URL + path, true);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Authorization', 'Bearer ' + SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = timeoutMs || 8000;
    xhr.onload = function () {
      var data = null;
      try { data = JSON.parse(xhr.responseText || 'null'); } catch (e) {}
      finish(xhr.status >= 200 && xhr.status < 300, data, xhr.status);
    };
    xhr.onerror = function () { finish(false, null, 0); };
    xhr.ontimeout = function () { finish(false, null, 0); };
    try { xhr.send(body ? JSON.stringify(body) : null); }
    catch (e) { finish(false, null, 0); }
  }

  /* Загрузка общих случаев. Страницы вызывают до первого рывка (выбор
     персонажа, первая отрисовка витрины/методички): успех кладёт
     черновики в window.SHARED_CASES и будит слушателей, ошибка/таймаут —
     пусто, но колбэк вызывается всегда и всегда один раз. */
  Sync.init = function (cb, timeoutMs) {
    function go() { if (typeof cb === 'function') cb(); }
    if (!Sync.configured() || location.protocol === 'file:') {
      window.SHARED_CASES = window.SHARED_CASES || [];
      go();
      return;
    }
    request('GET',
      '/rest/v1/cases?select=id,draft,published_at&order=published_at.desc',
      null,
      function (r) {
        if (r.ok && r.data && r.data.length != null) {
          var out = [];
          r.data.forEach(function (row) {
            var d = row && row.draft;
            if (!d || typeof d !== 'object') return;
            if (!d.id) d.id = row.id;
            if (!d.id) return;
            d.publishedAt = Date.parse(row.published_at) || 0;
            out.push(d);
          });
          window.SHARED_CASES = out;
          if (window.CustomCases) {
            try { window.CustomCases.emitChange(); } catch (e) {}
          }
        } else {
          window.SHARED_CASES = window.SHARED_CASES || [];
        }
        go();
      },
      timeoutMs || 3000);
  };

  /* Публикация случая для группы. Черновик нормализуется, чтобы в базу
     лёг аккуратный JSON. База отвечает true/false: false — неверный код
     преподавателя. */
  Sync.publish = function (draft, cb) {
    if (!Sync.configured()) {
      cb({ ok: false, error: 'синхронизация не настроена (см. SETUP.md)' });
      return;
    }
    var code = Sync.getCode();
    if (!code) { cb({ ok: false, error: 'укажите код преподавателя' }); return; }
    var CC = window.CustomCases;
    var d = CC ? CC.normalize(draft) : draft;
    if (!d || !d.id) { cb({ ok: false, error: 'у случая нет идентификатора — сначала сохраните' }); return; }
    request('POST', '/rest/v1/rpc/publish_case',
      { p_id: d.id, p_draft: d, p_code: code },
      function (r) {
        if (r.ok && r.data === true) { cb({ ok: true }); return; }
        cb({ ok: false, error: publishError(r) });
      });
  };

  /* Снятие случая с публикации. */
  Sync.unpublish = function (id, cb) {
    if (!Sync.configured()) {
      cb({ ok: false, error: 'синхронизация не настроена (см. SETUP.md)' });
      return;
    }
    var code = Sync.getCode();
    if (!code) { cb({ ok: false, error: 'укажите код преподавателя' }); return; }
    if (!id) { cb({ ok: false, error: 'нет идентификатора случая' }); return; }
    request('POST', '/rest/v1/rpc/unpublish_case',
      { p_id: id, p_code: code },
      function (r) {
        if (r.ok && r.data === true) { cb({ ok: true }); return; }
        cb({ ok: false, error: publishError(r) });
      });
  };

  function publishError(r) {
    if (r.status === 401 || r.status === 403) {
      return 'доступ запрещён — проверьте настройки проекта в sync.js';
    }
    if (!r.status) return 'нет связи с облаком';
    return 'не опубликовано: проверьте код преподавателя';
  }

  window.Sync = Sync;
})();
