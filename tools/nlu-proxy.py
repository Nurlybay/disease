#!/usr/bin/env python3
# Локальный ЛЛМ-фолбэк понимания для свободного приёма (ветка main).
#
# Сайт спрашивает этот прокси ТОЛЬКО когда офлайновый сопоставитель nlu.js
# сдался («не понял»). Прокси не отвечает за пациента, не сочиняет реплик и
# не ставит оценок — он делает ровно одно: выбирает id намерения из каталога,
# который страница прислала вместе с текстом. Дальше действие идёт обычным
# конвейером: озвученный заранее ответ, детерминированный разбор.
#
# Без запущенного прокси сайт работает как раньше: XHR на 127.0.0.1 падает
# мгновенно, и врач видит обычное «не понял вопроса».
#
# Ключ API — ТОЛЬКО из переменной окружения, в репозитории его нет:
#   export LLM_API_KEY=sk-...
#   python3 tools/nlu-proxy.py
# Необязательные переменные:
#   LLM_BASE_URL  (по умолчанию https://api.neuraldeep.ru/v1)
#   LLM_MODEL     (по умолчанию qwen3.8-27b)
#   LLM_PORT      (по умолчанию 8790)
#
# Только стандартная библиотека — ставить ничего не нужно.
import json
import os
import re
import sys
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_URL = os.environ.get('LLM_BASE_URL', 'https://api.neuraldeep.ru/v1').rstrip('/')
MODEL = os.environ.get('LLM_MODEL', 'qwen3.8-27b')
PORT = int(os.environ.get('LLM_PORT', '8790'))
KEY = os.environ.get('LLM_API_KEY')

if not KEY:
    sys.exit('LLM_API_KEY не задан. Запуск: LLM_API_KEY=sk-... python3 tools/nlu-proxy.py')

CAT_RU = {
    'ask': 'спросить пациента', 'measure': 'измерить показатель',
    'exam': 'физикальный приём', 'order': 'назначить исследование',
    'treat': 'назначить лечение', 'dx': 'поставить диагноз',
}


def pick_intent(text, cat, intents):
    """Спросить модель, какому намерению из каталога соответствует текст.
    Возвращает id или None. Любая ошибка сети/формата -> None: фолбэк
    обязан деградировать в обычное «не понял», а не ронять приём."""
    lines = []
    for it in intents:
        lines.append('%s | %s | %s' % (it['id'], CAT_RU.get(it['cat'], it['cat']), it['label']))
    catalog = '\n'.join(lines)

    hint = ''
    if cat:
        hint = ('\nВрач нажал кнопку категории «%s» — выбирай только из неё.'
                % CAT_RU.get(cat, cat))

    prompt = (
        'Ты — маршрутизатор действий врача в учебном тренажёре. Врач напечатал '
        'фразу, офлайновый разборщик её не понял. Выбери из каталога ровно одно '
        'намерение, которое врач имел в виду, и ответь ТОЛЬКО его id. Если ни '
        'одно намерение уверенно не подходит — ответь NONE. Не объясняй.%s\n\n'
        'Каталог (id | категория | название):\n%s\n\n'
        'Фраза врача: «%s»' % (hint, catalog, text)
    )

    body = json.dumps({
        'model': MODEL,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0,
        'max_tokens': 2000,  # запас на «размышления» модели до ответа
    }).encode('utf-8')

    req = urllib.request.Request(
        BASE_URL + '/chat/completions', data=body,
        headers={'Content-Type': 'application/json',
                 'Authorization': 'Bearer ' + KEY})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        reply = data['choices'][0]['message']['content'] or ''
    except Exception as e:
        print('  upstream: %s' % e, file=sys.stderr)
        return None

    # Модель может обернуть ответ в рассуждения — ищем точные id из каталога
    # в тексте ответа, а не верим ему на слово.
    reply = re.sub(r'<think>.*?</think>', '', reply, flags=re.S)
    ids = [it['id'] for it in intents]
    found = [i for i in ids if re.search(r'(?<![\w.])%s(?![\w.])' % re.escape(i), reply)]
    if len(found) == 1:
        return found[0]
    if found and reply.strip().split()[-1] in found:
        return reply.strip().split()[-1]
    return None


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        # Страница открывается и с file:// (origin "null") — поэтому "*".
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != '/match':
            self.send_response(404); self._cors(); self.end_headers()
            return
        try:
            n = int(self.headers.get('Content-Length', '0'))
            payload = json.loads(self.rfile.read(n).decode('utf-8'))
            text = str(payload.get('text', ''))[:500]
            cat = payload.get('cat')
            intents = payload.get('intents') or []
            intent_id = pick_intent(text, cat, intents) if text and intents else None
        except Exception as e:
            print('  bad request: %s' % e, file=sys.stderr)
            intent_id = None
        out = json.dumps({'id': intent_id}).encode('utf-8')
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(out)))
        self.end_headers()
        self.wfile.write(out)
        print('  «%s» -> %s' % (text, intent_id or 'NONE'))

    def log_message(self, *a):  # глушим построчный лог BaseHTTPRequestHandler
        pass


if __name__ == '__main__':
    print('ЛЛМ-фолбэк понимания: http://127.0.0.1:%d/match  (модель %s)' % (PORT, MODEL))
    print('Остановить: Ctrl+C. Сайт без прокси работает как обычно.')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
