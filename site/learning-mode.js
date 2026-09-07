/* Presentation policy only. The same actions and score apply in both modes. */
(function () {
  'use strict';
  var Mode = {};
  Mode.fromQuery = function (query) {
    return /[?&]mode=independent(?:&|$)/.test(query || '') ? 'independent' : 'learning';
  };
  Mode.label = function (mode) { return mode === 'independent' ? 'Самостоятельный приём' : 'Обучение с пояснениями'; };
  Mode.row = function (row, item, mode) {
    if (mode !== 'independent') return row;
    row.resCls = '';
    delete row.hint;
    if (row.kind === 'treat' && item) row.res = 'Назначение записано. Обоснование и оценка — в разборе после приёма.';
    return row;
  };
  Mode.finding = function (point, finding, mode) {
    return mode === 'independent'
      ? { title: point.label, text: 'Запись доступна для прослушивания. Опишите услышанное самостоятельно; расшифровка будет в разборе.' }
      : { title: point.label + ' — ' + finding.title, text: finding.desc };
  };
  window.LearningMode = Mode;
})();
