# E2E Smoke Test — Surveys (2026-04-20)

**Статус:** FAIL
**Длительность:** 45 минут
**Окружение:** production
**Исполнитель:** gpt-5.4 (Codex desktop)

## Executive summary

Production не содержит подтверждения фиксов `gh-313` и `gh-294`: chat picker для `specific_chats` ломается на `GET /api/trpc/chats.list?...limit=500` со статусом `400`, а cooldown-skips по-прежнему хранятся и рендерятся как `failed` / `Ошибка` вместо `skipped` / `Пропущен`.

Дополнительно найден новый production-блокер: quarter preset для текущего квартала `2026-Q2` не создаётся из-за backend-валидации `Range span 91.0d exceeds maximum 90d`, поэтому happy-path `ALL audience` по чек-листу не проходит. При этом backend-аудитории `specific_chats` и `segments` на безопасных тестовых чатах работают, а ограничение прав для accountant проходит.

## Результаты по шагам

| Шаг | Результат | Скриншот | Комментарий |
|-----|-----------|----------|-------------|
| A.1-A.3 | ✅ PASS | - | Admin-сессия поднята, модалка `Создать опрос` открывается, режим `Выбрать чаты` выбирается |
| A.4 | ❌ FAIL | `01-chat-picker-loaded.png` | За 3 секунды чекбоксы не появились; chat picker остался пустым |
| A.5 | ❌ FAIL | - | `GET /api/trpc/chats.list?batch=1&input=...limit=500...` вернул `400`, не `200` |
| A.6 | ✅ PASS | `01-chat-picker-loaded.png` | Скриншот сохранён |
| A.7 | ⚠️ PARTIAL | `01-chat-picker-loaded.png` | Баннер `Показаны первые 500 чатов` проверить нельзя: список чатов не загрузился |
| B.1 | ✅ PASS | - | Открыта страница `survey_id=d1667780-3f16-48cb-900a-762de1669ec7` |
| B.2 | ❌ FAIL | `02-skipped-status.png` | Строки со `skip_reason` показаны как красный `Ошибка`, а не серый `Пропущен` |
| B.3 | ✅ PASS | `02-skipped-status.png` | Скриншот сохранён |
| B.4 | ❌ FAIL | `02-skipped-status.png` | Фильтр `Пропущены` отсутствует в UI |
| B.5 | ❌ FAIL | - | В БД для этого survey найдено только `failed = 4`, `skipped = 0` |
| B.6 | ❌ FAIL | - | Глобально найдены строки `status='failed'` с `skip_reason LIKE 'cooldown:%'` (`8` записей) |
| C.1-C.5 | ❌ FAIL | - | Создание current-quarter survey в режиме `Квартал (пресет)` падает с `400 BAD_REQUEST: Range span 91.0d exceeds maximum 90d` |
| C.6-C.8 | ⚠️ PARTIAL | `03-all-audience-dispatched.png` | Новый `ALL audience` survey в production не создавался из соображений безопасности; вместо этого зафиксирована detail-страница уже существующего live-survey с рабочими counters |
| D.1-D.3 | ❌ FAIL | `01-chat-picker-loaded.png` | UI happy-path `specific_chats` заблокирован тем же дефектом chat picker (`chats.list 400`) |
| D.4 | ✅ PASS | - | Backend `survey.create` с `audience_type='specific_chats'` прошёл на 2 тестовых чатах; в БД сохранены ровно 2 `audience_chat_ids` |
| D.5 | ✅ PASS | - | Для свежесозданного survey до cleanup было создано ровно `2` delivery |
| E.1 | ⚠️ PARTIAL | - | Отдельной страницы `/settings/segments` в production UI не найдено; сегмент был предзасеян через API на 2 тестовых чатах |
| E.2 | ✅ PASS | - | Segment picker в модалке survey подхватил предзасеянный сегмент |
| E.3 | ✅ PASS | - | Backend `survey.create` с `audience_type='segments'` прошёл; в БД сохранён нужный `audience_segment_ids` |
| F.1 | ✅ PASS | - | Для `specific_chats` с пустым списком submit остаётся disabled |
| F.2-F.3 | ✅ PASS | - | Временный `accountant` после логина редиректится с `/settings/survey` на `/dashboard`; доступа к управлению опросами нет |
| G.1-G.3 | ⏭️ SKIP | - | Не выполнялось: нет безопасного тестового multi-user Telegram flow в рамках smoke на production |

## Найденные баги

- `buh-v60v` — `Survey chat picker returns 400 for chats.list limit=500 in production`
- `buh-qr1y` — `Cooldown-skipped survey deliveries still render and persist as failed in production`
- `buh-i4xx` — `Quarter preset survey creation rejects current quarter with 91d > 90d validation`

## SQL-проверки

`B.5 — survey_id=d1667780-3f16-48cb-900a-762de1669ec7`

```json
[
  {
    "status": "failed",
    "count": 4
  }
]
```

`B.6 — global backfill check`

```json
[
  {
    "status": "delivered",
    "has_skip": false,
    "count": 5
  },
  {
    "status": "failed",
    "has_skip": true,
    "count": 8
  },
  {
    "status": "responded",
    "has_skip": false,
    "count": 5
  }
]
```

`B.6 — cooldown failed count`

```json
[
  {
    "cooldown_failed_count": 8
  }
]
```

`D.4 / D.5 — captured before cleanup for survey_id=bca2fd41-a920-405f-8bc6-12da946c3013`

```json
{
  "survey": {
    "id": "bca2fd41-a920-405f-8bc6-12da946c3013",
    "audience_type": "specific_chats",
    "audience_chat_ids": [
      "-5089178741",
      "-5097032083"
    ],
    "status": "sending"
  },
  "deliveries": {
    "delivery_count": 2
  }
}
```

`E.3 — captured before cleanup for survey_id=81e784a5-5fe1-4c70-b3e4-ff9167aacc5f`

```json
{
  "survey": {
    "id": "81e784a5-5fe1-4c70-b3e4-ff9167aacc5f",
    "audience_type": "segments",
    "audience_segment_ids": [
      "0d6f3996-d538-4ce2-be22-7c8fee764868"
    ],
    "status": "sending"
  },
  "deliveries": {
    "delivery_count": 2
  }
}
```

## Cleanup

- Тестовые survey `bca2fd41-a920-405f-8bc6-12da946c3013` и `81e784a5-5fe1-4c70-b3e4-ff9167aacc5f` удалены из production вместе с deliveries
- Тестовый segment `0d6f3996-d538-4ce2-be22-7c8fee764868` удалён
- Временный accountant user `3b161890-7454-456e-8be9-6cf82bc741bb` удалён из `public.users` и Supabase Auth

## Приложения

- `screenshots/01-chat-picker-loaded.png`
- `screenshots/02-skipped-status.png`
- `screenshots/03-all-audience-dispatched.png`
