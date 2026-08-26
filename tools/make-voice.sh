#!/usr/bin/env bash
# Генерация реплик пациента: macOS `say` (голос Milena) + понижение тона до мужского.
# Требует: macOS с русским голосом Milena, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=site/media/voice
mkdir -p "$OUT"

VOICE=Milena
RATE=168
PITCH=0.84            # множитель частоты дискретизации -> понижение тона (~3 полутона)
TEMPO=1.190476        # 1/PITCH, возвращает исходную длительность

say_line() {
  local name="$1" text="$2"
  say -v "$VOICE" -r "$RATE" -o "/tmp/_v.aiff" "$text"
  ffmpeg -y -v error -i /tmp/_v.aiff -af \
    "aresample=44100,asetrate=44100*${PITCH},aresample=44100,atempo=${TEMPO},highpass=f=85,lowpass=f=8200,adelay=250|250,apad=pad_dur=0.5,loudnorm=I=-16:TP=-1.5:LRA=11" \
    -ar 44100 -ac 1 -b:a 128k "$OUT/$name.mp3"
  printf '  %-14s %5.2fs  %s\n' "$name" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$name.mp3")" "$text"
}

echo "Генерация реплик пациента:"
say_line duration  "Кашель у меня уже давно, месяцев восемь, а может и больше. Сильнее всего с утра."
say_line sputum    "Мокроты много. Каждое утро откашливаю почти полстакана. Густая, желтовато-зелёная, с неприятным запахом."
say_line fever     "Высокой температуры нет. Иногда к вечеру тридцать семь и два, не больше."
say_line smoking   "Нет, доктор, я не курю. Никогда не курил."
say_line blood     "Раза два были прожилки крови в мокроте. Я испугался, но потом само прошло."
say_line history   "В детстве я долго лежал в больнице с тяжёлым воспалением лёгких. С тех пор кашляю почти постоянно."
say_line dyspnea   "Когда поднимаюсь на третий этаж, начинаю задыхаться. Раньше такого не было."
say_line weight    "За полгода похудел килограммов на пять. Аппетита совсем нет."
say_line antibiotic "Несколько раз пил антибиотики. Становилось легче на пару недель, потом всё возвращалось."
say_line night     "Ночью кашель будит, особенно если лягу на правый бок."
echo "Готово."
