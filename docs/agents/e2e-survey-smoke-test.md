# E2E smoke test: Surveys (gh-313 + gh-294 post-deploy)

> Самодостаточный промт. Передай его Claude-агенту целиком одной командой —
> агент НЕ имеет предварительного контекста и должен уметь выполнить всё
> end-to-end без вопросов по ходу.
>
> Рекомендуемая модель: Sonnet 4.6 / Opus 4.7 с `Playwright MCP` + `Supabase MCP`.

---

## 🎯 Задача

После деплоя фикса `buh-3alp` (chats.list limit) и `buh-lmw2` (status=skipped)
в production провести полную smoke-валидацию опросов на
`https://buhbot.aidevteam.ru` и выдать отчёт.

## 🧰 Доступные инструменты

- **Playwright MCP** — `mcp__playwright__browser_navigate`, `browser_click`,
  `browser_fill_form`, `browser_snapshot`, `browser_take_screenshot`,
  `browser_network_requests`, `browser_console_messages`, `browser_evaluate`.
- **Supabase MCP** — `mcp__supabase__execute_sql`, `mcp__supabase__list_tables`
  (для проверок БД).
- **Bash** — для git, артефактов.
- **Read/Write** — для записи отчёта.

## 🔑 Доступы — **ВАЖНО! Login через Telegram вручную**

BuhBot использует Telegram OAuth для входа. Автоматический login через
Playwright невозможен — Telegram требует интерактивной авторизации.

**Flow авторизации (согласовано с Игорем):**

1. Открыть `https://buhbot.aidevteam.ru` через `mcp__playwright__browser_navigate`.
2. На странице login появится кнопка «Войти через Telegram».
3. **Приостановить работу** и написать оператору (Игорю):
   > «Открыл страницу login. Пожалуйста, войди через Telegram как админ.
   > Отпишись, когда будешь на /dashboard, я продолжу.»
4. Игорь выполнит OAuth в том же браузере (он работает с тобой в одной сессии
   Playwright — сессионная cookie сохранится).
5. После его подтверждения сделать `browser_snapshot` и убедиться, что URL
   НЕ содержит `/login` — сессия установлена, можно продолжать.
6. Все последующие запросы используют установленную admin-сессию.

**Если страница закрылась / сессия отвалилась** — повторить шаги 1-5.

**НЕ пытаться** логиниться email+password — такого flow нет (Supabase Auth
настроен только на Telegram OAuth через MTProto).

**Credentials для email-fallback** (если в dev-окружении включен — справочно):
см. `/home/me/code/bobabuh/e2e/fixtures/index.ts` → `testUsers.admin`.

## 📁 Артефакты

Все скриншоты → `docs/reports/e2e/<date>/screenshots/`
Отчёт → `docs/reports/e2e/<date>-survey-smoke.md`
`<date>` = текущая дата `YYYY-MM-DD`.

---

## ✅ Чек-лист (выполнять по порядку, отмечать каждый шаг)

### A. Bug #313 — chats.list принимает limit=500

1. Перейти на `https://buhbot.aidevteam.ru/settings/survey` (сессия уже admin
   после совместного login flow выше).
2. Нажать «Создать опрос». Модальное окно открывается.
3. Выбрать radio «Выбрать чаты».
4. **Ассерт**: список чатов загружается в течение 3 секунд, UI показывает чекбоксы.
   - Если видно «Нет доступных чатов» — это **FAIL** (баг не исправлен).
5. Открыть Network tab через `browser_network_requests` с фильтром `chats.list`.
   - Найти запрос `GET /api/trpc/chats.list?batch=1&input=...limit%22%3A500...`.
   - **Ассерт**: response status = 200.
6. `browser_take_screenshot` → `screenshots/01-chat-picker-loaded.png`.
7. Если чатов ≥ 500 — должен быть виден баннер «Показаны первые 500 чатов»;
   иначе — весь список без баннера.

### B. Bug #294 — skipped-статус рендерится как «Пропущен», не «Ошибка»

1. Перейти на `https://buhbot.aidevteam.ru/settings/survey/d1667780-3f16-48cb-900a-762de1669ec7`.
2. **Ассерт**: в таблице deliveries строки с `skip_reason` имеют бейдж
   **«Пропущен»** серого цвета (`var(--buh-foreground-muted)` / `var(--buh-surface-elevated)`),
   НЕ красный «Ошибка».
3. `browser_take_screenshot` → `screenshots/02-skipped-status.png`.
4. В фильтре статусов выбрать «Пропущены» — таблица фильтруется, строки видны.
5. Проверка БД:
   ```sql
   SELECT status, count(*)
   FROM public.survey_deliveries
   WHERE survey_id = 'd1667780-3f16-48cb-900a-762de1669ec7'
   GROUP BY status;
   ```
   **Ассерт**: `skipped >= 4` (или больше, но не `failed` для cooldown).
6. Общая проверка backfill:
   ```sql
   SELECT status, (skip_reason IS NOT NULL) has_skip, count(*)
   FROM public.survey_deliveries
   GROUP BY status, (skip_reason IS NOT NULL)
   ORDER BY 1;
   ```
   **Ассерт**: строки `status='failed' AND skip_reason LIKE 'cooldown:%'`
   отсутствуют (0).

### C. Happy-path ALL audience (regression)

1. На `/settings/survey` кликнуть «Создать опрос».
2. В модалке: режим «По кварталу» → выбрать текущий квартал.
3. Audience: «Все чаты» (default).
4. Запуск: «Немедленно».
5. Submit.
6. **Ассерт**: опрос появляется в таблице со статусом `scheduled` или `sending`.
7. Через 30 сек poll → статус переходит в `sending` (ждать до 2 мин).
8. Кликнуть по строке → детальная страница показывает счётчики
   targeted/sent/pending/skipped/failed.
9. Screenshot → `screenshots/03-all-audience-dispatched.png`.

### D. Happy-path SPECIFIC_CHATS (gh-313)

1. «Создать опрос» → «Выбрать чаты» → выбрать 2 чата (любые).
2. Режим «По кварталу» → текущий квартал. Immediate.
3. Submit.
4. Через БД получить id свежесозданного опроса:
   ```sql
   SELECT id, audience_type, audience_chat_ids
   FROM public.feedback_surveys
   ORDER BY created_at DESC LIMIT 1;
   ```
   **Ассерт**: `audience_type='specific_chats'`, `array_length(audience_chat_ids,1)=2`.
5. ```sql
   SELECT count(*) FROM public.survey_deliveries WHERE survey_id='<new_id>';
   ```
   **Ассерт**: `count = 2` (ровно 2 доставки, не больше).

### E. Happy-path SEGMENTS (gh-313)

1. Если сегментов ещё нет — создать через UI `/settings/segments`
   (или пропустить если ручки нет; тогда pre-seed SQL).
2. «Создать опрос» → «Сегменты» → выбрать 1 сегмент → submit.
3. Проверить в БД: `audience_type='segments'`, `audience_segment_ids` содержит id.

### F. Negative / security

1. Попытка submit опроса audience=specific_chats с пустым списком чатов.
   **Ассерт**: UI блокирует submit (кнопка disabled) ИЛИ сервер отвечает
   `BAD_REQUEST` без сохранения.
2. Выйти из admin, войти как `accountant@test.com`.
3. Перейти на `/settings/survey`.
   **Ассерт**: страница либо редиректит, либо показывает 403 — accountant
   не должен иметь доступ к управлению опросами.

### G. Регрессия голосования (gh-294)

> Эта часть опциональна если нет тестового Telegram-бота. Если есть —
> проверить multi-user voting (из спека gh-294). Если нет — пропустить
> и записать в отчёт.

1. В том же чате несколько пользователей голосуют за опрос.
2. **Ассерт**: первый голос не закрывает голосование для остальных.
3. Проверить `survey_vote_history` — все переходы записаны.

---

## 🧾 Формат отчёта

Записать в `docs/reports/e2e/<date>-survey-smoke.md`:

```markdown
# E2E Smoke Test — Surveys (<date>)

**Статус:** PASS | FAIL | PARTIAL
**Длительность:** <m минут>
**Окружение:** production / stage
**Исполнитель:** <agent-id>

## Executive summary

<2-3 предложения: что главное сломано / работает>

## Результаты по шагам

| Шаг | Результат | Скриншот | Комментарий |
|-----|-----------|----------|-------------|
| A.1 | ✅ PASS | - | Login успешен |
| A.4 | ✅ PASS | 01-chat-picker-loaded.png | 50 чатов загружено, 200 OK |
| ... |

## Найденные баги

Для каждого бага:
```bash
bd create --title="..." --type=bug --priority=1 \
  --description="Шаги воспроизведения, ожидаемое, фактическое, скриншот"
```
(Записать ID созданных задач сюда.)

## SQL-проверки

<паста output SELECT-запросов из шагов B.5, B.6, D.4, E.3>

## Приложения

- `screenshots/01-chat-picker-loaded.png`
- `screenshots/02-skipped-status.png`
- `screenshots/03-all-audience-dispatched.png`
```

---

## ⚠️ Правила

- **Не мьютить ошибки**: если шаг падает — зафиксировать, сделать скриншот,
  продолжить остальные шаги.
- **Не создавать мусор**: по окончании удалить тестовые опросы, созданные в
  C/D/E, если они не нужны (DELETE по id через Supabase MCP).
- **Не деплоить, не мерджить**: агент только тестирует + пишет отчёт + создаёт
  beads-задачи для найденных багов. Решения по деплою — человек.
- **Respect rate limits**: Telegram-бот не дёргать искусственно — настоящих
  юзеров не спамить.
- **Idempotency**: при повторных запусках тестовые данные должны чиститься
  или использовать уникальные идентификаторы.

## 📌 Критерии успеха

- Все блоки A, B прошли (фиксы подтверждены).
- Блок C прошёл без регрессий.
- Блоки D, E прошли (новая audience-функциональность работает).
- Блок F прошёл (нет утечки прав).
- Отчёт сохранён в `docs/reports/e2e/`.
- Для всех FAIL-шагов созданы beads-таски.
