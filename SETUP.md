# Настройка общих случаев через интернет (один раз, ~15 минут)

После этой настройки случай, который преподаватель публикует в конструкторе,
сразу виден студентам на любом ноутбуке — на общей ссылке сайта.

Схема простая:

```
конструктор преподавателя ──публикация──▶ облачная база (бесплатный Supabase)
витрина студента ─────────чтение─────────▶ случаи появляются сразу
```

Две вещи, которые нужно сделать руками:

1. Создать бесплатную базу на Supabase и вставить туда скрипт (шаги 1–3).
2. Разместить сайт на GitHub Pages и вписать адрес базы в `site/sync.js`
   (шаги 4–6).

---

## Шаг 1. Создать проект в Supabase

1. Открыть [supabase.com](https://supabase.com), войти (можно через аккаунт
   GitHub), нажать **New project**.
2. Пароль базы — любой сложный; запишите его (понадобится только в панели).
3. Регион — ближайший (например, Frankfurt).
4. Дождаться, пока проект создастся (1–2 минуты).

## Шаг 2. Вставить скрипт

В панели проекта: **SQL Editor** (иконка `</>` слева) → **New query** →
вставить целиком и нажать **Run**:

```sql
create table public.teacher_secret (code text primary key);
create table public.cases (
  id text primary key,
  draft jsonb not null,
  published_at timestamptz not null default now()
);
insert into public.teacher_secret (code) values ('СМЕНИТЬ-НА-СВОЙ-КОД');

alter table public.cases enable row level security;
alter table public.teacher_secret enable row level security;

create policy "public read" on public.cases for select to anon using (true);

create or replace function public.publish_case(p_id text, p_draft jsonb, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from teacher_secret where code = p_code) then
    return false;
  end if;
  insert into cases (id, draft, published_at) values (p_id, p_draft, now())
  on conflict (id) do update
    set draft = excluded.draft, published_at = excluded.published_at;
  return true;
end $$;

create or replace function public.unpublish_case(p_id text, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from teacher_secret where code = p_code) then
    return false;
  end if;
  delete from cases where id = p_id;
  return true;
end $$;

grant execute on function public.publish_case(text, jsonb, text) to anon;
grant execute on function public.unpublish_case(text, text) to anon;
```

Что делает скрипт:

- `cases` — опубликованные случаи. Читаются всеми анонимно (политика
  `public read`); напрямую записать в неё ничего нельзя — только через функции.
- `teacher_secret` — код преподавателя. Таблица закрыта от всех; код
  проверяется внутри функций на сервере и в код сайта не попадает.
- `publish_case` / `unpublish_case` — единственные способы записи: с верным
  кодом публикуют/снимают случай, с неверным — молча отвечают `false`.

**Смените код в строке `insert into public.teacher_secret`** перед запуском
(или после: `delete from public.teacher_secret;` и новый `insert`).
Код — любое слово/фраза, которую знаете только вы; он вводится один раз в
конструкторе. Потеряли — просто вставьте новый код тем же способом.

Проверка: **Table Editor** → `cases` — таблица пустая.

## Шаг 3. Взять адрес проекта и ключ

В панели: **Settings → API** (иконка шестерёнки → API). Нужны два значения:

- **Project URL** — вида `https://xxxx.supabase.co`
- **anon public** ключ — длинная строка в блоке *Project API keys*

Оба значения не секретны: ключ предназначен для браузера, а доступ к данным
ограничен политикой чтения из шага 2.

## Шаг 4. Вписать значения в `site/sync.js`

Открыть `site/sync.js`, заполнить две константы в самом верху файла:

```js
var SUPABASE_URL = 'https://xxxx.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOi…длинная строка…';
```

Без них синхронизация молча неактивна — сайт работает как раньше.

## Шаг 5. Разместить сайт на GitHub Pages

1. Репозиторий на GitHub должен быть **публичным** (если приватный —
   сделать публичным, либо разместить сайт на бесплатном
   [Netlify](https://netlify.com): просто перетащить папку `site/`,
   без этого шага).
2. В репозитории: **Settings → Pages → Source: «GitHub Actions»** —
   сохранить. Деплой уже настроен (`.github/workflows/pages.yml`): на каждый
   пуш в `main` папка `site/` выкладывается сама.
3. Запушить репозиторий (`git push`) и в **Actions** дождаться зелёной
   галочки (обычно меньше минуты).
4. Сайт откроется по адресу вида `https://имя-на-гитхабе.github.io/disease/` —
   он написан в Settings → Pages.

Важно: `teacher.html` с ответами случаев доступен по прямой ссылке на любом
хостинге всего сайта, как и при локальном сервере. Не публикуйте ссылку на
него студентам; конструктор и журнал открывайте сами.

## Шаг 6. Проверить

1. Открыть сайт на двух ноутбуках (или в обычном окне и в приватном).
2. Преподаватель: вкладка «Конструктор случаев» → ввести код из шага 2 в поле
   «Код преподавателя» → открыть случай → **«Опубликовать для группы»**.
3. Студент обновляет витрину — случай появляется в списке с меткой
   «случай преподавателя» и запускается по номеру.
4. «Снять с публикации» в конструкторе убирает случай у студентов после
   обновления страницы.

---

## Если что-то пошло не так

| Симптом | Причина и решение |
|---|---|
| «не опубликовано: проверьте код преподавателя» | Неверный код в поле конструктора — сверьте со строкой `insert` из шага 2 |
| «доступ запрещён — проверьте настройки проекта в sync.js» | URL/ключ в `sync.js` не совпадают с Settings → API |
| «нет связи с облаком» | Нет интернета, либо проект заснул — см. ниже |
| У студента нет опубликованного случая | Обновить витрину (случаи подгружаются при загрузке страницы) |
| Страница открыта как файл (`file://`) | Синхронизация намеренно отключена на `file://` — откройте по ссылке |

## Про сон бесплатного проекта

Бесплатный проект Supabase **засыпает без активности** (через несколько дней).
Случаи при этом не теряются — просыпается база за пару секунд. Если долго
никто не заходил, перед парой зайдите в панель проекта и подождите надписи
«Active». Во время работы сайта запросы студентов сами держат базу активной.

Если проект пропал из панели навсегда (такое бывает после очень долгого сна) —
достаточно заново выполнить скрипт из шага 2 и переопубликовать случаи.
