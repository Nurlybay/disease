#!/usr/bin/env bash
# Сборка общей библиотеки звуков лёгких: sources/*.mp3 -> site/media/lungs/.
# Все персонажи ссылаются на эти файлы по id находки — тысяча персонажей
# делит несколько десятков записей, поэтому библиотека живёт отдельно от
# персонажей и собирается одним скриптом.
#
# Каждая запись прогоняется через loudnorm с теми же целями, что и озвучка
# (tools/make-voice.sh): иначе при переключении «речь пациента - стетоскоп»
# громкость прыгает.
#
# site/media/lungs/normal.mp3 этим скриптом НЕ собирается: записи нормального
# везикулярного дыхания среди исходников нет, файл синтезирован однажды
# (розовый шум + огибающая дыхания, см. README) и лежит в репозитории как есть.
#
# После изменения состава библиотеки перезапустите tools/make-waveforms.py —
# он сканирует site/media/lungs/ и пересчитывает пики для canvas.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=site/media/lungs
mkdir -p "$OUT"

norm() {
  local src="$1" name="$2"
  ffmpeg -y -v error -i "sources/$src" \
    -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
    -ar 44100 -ac 1 -b:a 128k "$OUT/$name.mp3"
  printf '  %-28s %6.2fs  <- %s\n' "$name.mp3" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$name.mp3")" "$src"
}

echo "Библиотека звуков лёгких:"
# Влажные крупнопузырчатые хрипы, бронхоэктазы (мужчина 47 лет, слева латерально)
norm "Crackles-Bronchiectasis.mp3" "crackles-bronchiectasis"
# Хрипы при муковисцидозе (мужчина 21 год, справа латерально): мокрота, обструкция
norm "CracklesWheezes-CF1.mp3"     "crackles-cf"
# Свистящие хрипы на вдохе (запись при бронхообструкции)
norm "Wheeze-Asthma.mp3"           "wheeze-asthma"
# Ранние + поздние инспираторные мелкопузырчатые хрипы, отёк лёгких
norm "Crackles.mp3"                "crackles-edema"

echo "Готово. Не забудьте: python3 tools/make-waveforms.py"
