# Исходные материалы

Файлы, из которых собрано всё содержимое `site/media/`. Лежат в репозитории,
чтобы сборку медиа можно было повторить.

## Видео

| Файл | Что это | Во что превращается |
|---|---|---|
| `Hailuo_Video_subtle idle motion, breathing,_548198744830246920.mp4` | пациент в кабинете, лёгкие движения | `site/media/patient-idle.mp4` |
| `Hailuo_Video_A person opens their mouth to _548938829439672324.mp4` | пациент открывает рот, видно зев | `site/media/patient-throat.mp4`, `throat-poster.jpg` |

## Записи лёгких → библиотека site/media/lungs/

Сборка: `bash tools/make-lungs.sh` (loudnorm под общую громкость с озвучкой),
затем `python3 tools/make-waveforms.py` — пересчёт осциллограмм.

| Файл | Что записано | Во что превращается |
|---|---|---|
| `Crackles-Bronchiectasis.mp3` | влажные хрипы, бронхоэктазы (мужчина 47 лет, латерально слева) | `lungs/crackles-bronchiectasis.mp3` |
| `CracklesWheezes-CF1.mp3` | бронхоэктазы при муковисцидозе (мужчина 21 год, латерально справа): мокрота, обструкция | `lungs/crackles-cf.mp3` |
| `Wheeze-Asthma.mp3` | свистящие хрипы на вдохе при бронхообструкции | `lungs/wheeze-asthma.mp3` |
| `Crackles.mp3` | ранние и поздние инспираторные мелкопузырчатые хрипы, отёк лёгких | `lungs/crackles-edema.mp3` |

`lungs/normal.mp3` среди исходников не имеет прототипа — файл синтезирован
(розовый шум + огибающая дыхания, см. корневой `README.md`).

Пересборка описана в корневом `README.md`, раздел «Откуда взялись медиафайлы».
