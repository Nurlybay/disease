/* Push-to-talk; no background listening or automatic microphone restart. */
(function (root) {
  'use strict';
  root.VoiceInput = { create: function (options) {
    var Engine = options.Engine, active = null;
    function cancel() {
      var old = active; active = null;
      if (old) { old.onresult = old.onerror = old.onend = null; try { old.abort(); } catch (e) {} }
      options.listening(false);
    }
    function start() {
      if (!Engine || active) return;
      var rec = new Engine(), finalText = '', failed = false;
      active = rec; rec.lang = 'ru-RU'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.onresult = function (event) {
        if (active !== rec) return;
        var all = [], finals = [];
        for (var i = 0; i < event.results.length; i++) {
          all.push(event.results[i][0].transcript);
          if (event.results[i].isFinal) finals.push(event.results[i][0].transcript);
        }
        finalText = finals.join(' ').trim(); options.text(all.join(' ').trim());
      };
      rec.onerror = function (event) {
        if (active !== rec) return;
        failed = true;
        var messages = { 'not-allowed': 'Нет доступа к микрофону. Разрешите его в настройках сайта или напишите вопрос.',
          'service-not-allowed': 'Сервис распознавания недоступен в этом браузере. Напишите вопрос.',
          'audio-capture': 'Микрофон не найден. Проверьте подключение.',
          'network': 'Браузер не смог подключиться к сервису распознавания речи. Это не обязательно проблема вашего интернета: сервис может быть недоступен во встроенном браузере. Попробуйте открыть этот же адрес отдельно в Google Chrome. Если ошибка повторится, используйте системную диктовку в поле вопроса или введите текст.',
          'no-speech': 'Речь не распознана. Нажмите микрофон и попробуйте ещё раз.',
          'language-not-supported': 'Распознавание русской речи недоступно в этом браузере.' };
        options.status(messages[event.error] || 'Распознавание остановлено. Можно написать вопрос.');
        cancel();
      };
      rec.onend = function () {
        if (active !== rec) return;
        active = null; options.listening(false);
        if (failed) return;
        if (finalText) { options.text(finalText); options.result(finalText); }
        else options.status('Речь не распознана. Попробуйте ещё раз или напишите вопрос.');
      };
      options.beforeStart(); options.listening(true); options.status('Слушаю… Задайте один вопрос.');
      try { rec.start(); } catch (e) { cancel(); options.status('Не удалось включить микрофон. Попробуйте ещё раз или напишите вопрос.'); }
    }
    return { start: start, cancel: cancel, stop: function () { if (active) { try { active.stop(); } catch (e) { cancel(); } } }, isListening: function () { return !!active; } };
  } };
})(typeof window !== 'undefined' ? window : globalThis);
