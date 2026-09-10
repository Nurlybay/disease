/* Реестр персонажей. Одна строка — один персонаж.
   Порядок не имеет значения: loader.js выбирает случайного.

   file    имя файла в site/characters/ (самодостаточный случай)
   disease болезнь — для отладки и списков, в игре студенту не показывается
   label   короткая подпись персонажа (тоже не показывается до разбора)

   Чтобы добавить персонажа: положите файл рядом и допишите строку.
   Больше нигде регистрировать не нужно. */
window.CHARACTER_MANIFEST = [
  { file: 'bronchiectasis-abenov.js', hasAnimation: true, disease: 'Бронхоэктатическая болезнь', label: 'Абенов Мурат, 34' },
  { file: 'asthma-eszhanova.js', hasAnimation: false,      disease: 'Бронхиальная астма',         label: 'Есжанова Айгерим, 24' },
  { file: 'cf-omarov.js', hasAnimation: true,             disease: 'Муковисцидоз',               label: 'Омаров Даулет, 21' },
  { file: 'chf-baizhanov.js', hasAnimation: true,         disease: 'Хроническая сердечная недостаточность', label: 'Байжанов Серик, 67' },
  { file: 'hypertension-saparov.js', hasAnimation: true, disease: 'Артериальная гипертензия', label: 'Сапаров Ерлан, 52' },
  { file: 'angina-iskakov.js', hasAnimation: true, disease: 'ИБС: стенокардия напряжения', label: 'Искаков Марат, 59' },
  { file: 'af-nurgaliev.js', hasAnimation: true, disease: 'Фибрилляция предсердий (мерцательная аритмия)', label: 'Нургалиев Бекзат, 72' },
  { file: 'pericarditis-alimov.js', hasAnimation: true, disease: 'Острый перикардит', label: 'Алимов Данияр, 31' },
  { file: 'copd-tulegenov.js', hasAnimation: true, disease: 'ХОБЛ', label: 'Тулегенов Аскар, 63' },
  { file: 'chronic-bronchitis-bekova.js', hasAnimation: true, disease: 'Хронический бронхит', label: 'Бекова Гульнара, 46' },
  { file: 'acs-serikbayev.js', hasAnimation: true, disease: 'Острый коронарный синдром', label: 'Серикбаев Болат, 58' },
  { file: 'myocarditis-omarova.js', hasAnimation: true, disease: 'Острый миокардит', label: 'Омарова Алия, 29' }
];
