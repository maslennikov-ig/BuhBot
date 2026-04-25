# E2E promt: валидация PR #322 после деплоя (gh-313, gh-294, buh-i4xx)

> Передай этот файл Claude-агенту целиком одной командой.
> Агент получает admin-сессию через совместный Telegram-login flow (см. ниже).
>
> **Запускать только** после зелёного `Deploy to Production` на commit `58b5c54`:
> `gh run list --repo maslennikov-ig/BuhBot --branch main --workflow="Deploy to Production" --limit 1`

---

## Промт (скопировать целиком, передать агенту)

```
Ты — E2E-тестер BuhBot. Задача: валидировать три production-фикса из PR #322 (merge commit 58b5c54) после деплоя на https://buhbot.aidevteam.ru.

ДОСТУПЫ
- Playwright MCP (`mcp__playwright__browser_*`) для браузера
- Supabase MCP (`mcp__supabase__execute_sql`) для БД
- Bash / Read / Write / bd

АВТОРИЗАЦИЯ — интерактивный flow:
1. `mcp__playwright__browser_navigate` на `https://buhbot.aidevteam.ru`.
2. На странице login останови работу и напиши мне (Игорю):
   «Открыл страницу login. Залогинься через Telegram как админ. Отпишись когда будешь на /dashboard.»
3. Я залогинюсь через Telegram OAuth в твоём же Playwright-браузере (сессионная cookie переживёт).
4. После моего «готов» сделай browser_snapshot и убедись что URL НЕ содержит /login.
5. Дальше используй эту admin-сессию для всего.
НЕ пытайся email+password — такого flow нет.

БАГИ К ВАЛИДАЦИИ

[A] buh-3alp — chats.list limit=500 (issue #313)
1. На /settings/survey кликни «Создать опрос».
2. Выбери radio «Выбрать чаты».
3. АССЕРТ: список чатов загружается, чекбоксы видны, «Нет доступных чатов» НЕТ.
4. `mcp__playwright__browser_network_requests` → найти `GET /api/trpc/chats.list?batch=1&input=...limit%22%3A500...`.
5. АССЕРТ: status=200 (НЕ 400).
6. Скриншот → `docs/reports/e2e/<date>/screenshots/01-chat-picker.png`.

[B] buh-lmw2 — skipped-статус НЕ как «Ошибка» (issue #294)
1. Открой https://buhbot.aidevteam.ru/settings/survey/d1667780-3f16-48cb-900a-762de1669ec7
2. АССЕРТ: строки с cooldown отображаются серым «Пропущен» (не красным «Ошибка»).
3. В фильтре статусов АССЕРТ наличие опции «Пропущены», клик — таблица фильтруется.
4. Скриншот → `02-skipped-status.png`.
5. Supabase SQL:
   SELECT status, (skip_reason IS NOT NULL) has_skip, count(*)
   FROM public.survey_deliveries
   GROUP BY status, (skip_reason IS NOT NULL)
   ORDER BY 1;
   АССЕРТ: `skipped` >= 8 (backfill сработал), строк `failed + has_skip=true + skip_reason LIKE 'cooldown:%'` = 0.

[C] buh-i4xx — quarter preset 2026-Q2 проходит (NEW)
1. На /settings/survey кликни «Создать опрос».
2. Режим «По кварталу» → выбери 2026-Q2 (текущий, 91д).
3. Audience=«Все чаты». Запуск=«Немедленно».
4. Submit.
5. АССЕРТ: POST /api/trpc/survey.create вернул 200 (НЕ 400 «Range span 91.0d exceeds maximum 90d»).
6. В UI появилась новая строка со статусом scheduled/sending.
7. Supabase: SELECT quarter, start_date, end_date, status FROM public.feedback_surveys ORDER BY created_at DESC LIMIT 1; — АССЕРТ quarter='2026-Q2'.
8. Cleanup: удали эту запись и её доставки после подтверждения (DELETE FROM survey_deliveries WHERE survey_id=...; DELETE FROM feedback_surveys WHERE id=...;) — production, не мусорь.
9. Скриншот detail-страницы → `03-quarter-q2-created.png`.

[D] Регрессия specific_chats (gh-313 happy)
1. «Создать опрос» → «Выбрать чаты» → выбери 2 безопасных тестовых чата.
2. Режим «По кварталу» 2026-Q2. Immediate. Submit.
3. Supabase: SELECT audience_type, audience_chat_ids FROM public.feedback_surveys ORDER BY created_at DESC LIMIT 1; — АССЕРТ specific_chats, 2 id.
4. SELECT count(*) FROM public.survey_deliveries WHERE survey_id='<new_id>'; → АССЕРТ = 2.
5. Cleanup как в [C].

[E] Регрессия segments (если сегмент есть)
1. Если в БД уже есть sandbox-сегмент — используй. Если нет — пропусти, зафиксируй в отчёте.
2. «Создать опрос» → «Сегменты» → выбери сегмент → submit.
3. АССЕРТ audience_type=segments.
4. Cleanup.

[F] Negative auth
1. Logout admin (через UI или clear cookies).
2. Создай через Supabase auth test accountant или используй существующего.
3. Попытайся зайти на /settings/survey.
4. АССЕРТ: redirect или 403. Управление опросами недоступно для accountant.

ФОРМАТ ОТЧЁТА
Запиши в `docs/reports/e2e/2026-04-20-survey-smoke-post-deploy.md` со структурой:
- Header: статус PASS/FAIL/PARTIAL, duration, commit=58b5c54
- Таблица «Шаг | Результат | Скриншот | Комментарий»
- Блок «SQL-проверки» с реальными outputs
- Блок «Найденные баги» — для каждого создай bd create -t bug -p 1 --title "..." --description "..."
- Блок «Cleanup» — подтверждение удаления тестовых данных
- Приложения: список скриншотов

ПРАВИЛА
- Не деплоить, не мерджить (ты только тестер).
- Цепочки Telegram-отправок — не ждём реальной доставки, проверяем только UI+БД.
- Не создавай мусор на проде: всё что создал — удали.
- При FAIL — не прерывай тест, фиксируй и двигайся дальше.
- Финальная строка отчёта: «ГОТОВ К ПРОДУ: YES/NO».

Начинай с шага [A], сначала попроси меня залогиниться через Telegram.
```

---

## Чек перед запуском агента

```bash
# Deploy зелёный?
gh run list --repo maslennikov-ig/BuhBot --branch main --workflow="Deploy to Production" --limit 1

# Миграции применились на prod?
# (через Supabase MCP)
SELECT unnest(enum_range(NULL::public."DeliveryStatus"));
# ожидаемо: pending, delivered, reminded, expired, failed, responded, skipped
```

Если миграция `skipped` не появилась — deploy не отработал или миграции не прогнаны. Проверить GitHub Actions логи.
