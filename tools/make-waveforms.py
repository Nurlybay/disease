#!/usr/bin/env python3
"""Считает пики аудиофайлов в waveforms.json.

Волновая форма рисуется на canvas из готовых данных, поэтому визуализация
работает и при открытии index.html напрямую с диска (file://), где Web Audio
API не может анализировать локальный файл.
"""
import array
import json
import pathlib
import subprocess
import sys

BUCKETS = 420          # столбиков в волновой форме
SR = 8000              # частоты выше для огибающей не нужны
ROOT = pathlib.Path(__file__).resolve().parent.parent
MEDIA = ROOT / "site" / "media"

# Ключ волновой формы = имя файла без расширения; на него ссылается поле
# `wf` находки в файле персонажа. Библиотека сканируется целиком, поэтому
# новый звук достаточно положить в site/media/lungs/ и перезапустить скрипт.
TARGETS = {
    p.stem: p for p in sorted((MEDIA / "lungs").glob("*.mp3"))
}


def peaks(path: pathlib.Path) -> dict:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path),
         "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        capture_output=True, check=True).stdout

    samples = array.array("h")
    samples.frombytes(raw[: len(raw) - (len(raw) % 2)])
    if not samples:
        raise SystemExit(f"нет отсчётов: {path}")

    step = max(1, len(samples) // BUCKETS)
    out = []
    for i in range(0, len(samples) - step + 1, step):
        window = samples[i:i + step]
        # RMS даёт читаемую огибающую; чистый пик слишком шумный
        rms = (sum(s * s for s in window) / len(window)) ** 0.5
        out.append(rms)
        if len(out) == BUCKETS:
            break

    top = max(out) or 1.0
    return {
        "duration": len(samples) / SR,
        "peaks": [round(v / top, 4) for v in out],
    }


def main() -> None:
    data = {}
    for name, path in TARGETS.items():
        if not path.exists():
            sys.exit(f"файл не найден: {path}")
        data[name] = peaks(path)
        print(f"  {name:16} {data[name]['duration']:5.2f}s  "
              f"{len(data[name]['peaks'])} столбиков")

    dest = MEDIA / "waveforms.json"
    dest.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")

    # Дубль в виде .js: fetch() заблокирован на file://, а <script> работает.
    (MEDIA / "waveforms.js").write_text(
        "window.WAVEFORMS=" + json.dumps(data, separators=(",", ":")) + ";\n",
        encoding="utf-8")
    print(f"Записано: {dest.name} и waveforms.js")


if __name__ == "__main__":
    main()
