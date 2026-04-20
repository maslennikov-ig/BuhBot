# E2E Smoke Test — Surveys (2026-04-20)

**Статус:** PASS
**Длительность:** 55 минут
**Окружение:** production
**commit:** 58b5c54
**Deploy run:** `Deploy to Production` success, `headSha=16196c61c5e6e2c95b952308cfdd9fe1d51ec8fe`

## Executive summary

Production подтверждает фиксы из PR #322: `gh-313` chat picker грузит `chats.list` с `limit=500` и получает `200`, а `gh-294` cooldown-deliveries уже хранятся и рендерятся как `skipped / Пропущен`, без legacy `failed + skip_reason`.

Первичный `FAIL` на `C/D` для `2026-Q2` оказался не багом, а корректным `OVERLAP` guard из-за предсуществующего активного survey `d1667780-3f16-48cb-900a-762de1669ec7`. Retry на `2026-Q3` прошёл: quarter preset создаётся, а `specific_chats` создаёт survey с двумя chat IDs и двумя deliveries. Итоговый verdict — `PASS`.

## Результаты по шагам

| Шаг | Результат | Скриншот | Комментарий |
|-----|-----------|----------|-------------|
| Preflight deploy | ✅ PASS | - | Последний `Deploy to Production` зелёный, `headSha=16196c61...` |
| Preflight migration | ✅ PASS | - | `DeliveryStatus` в prod содержит `skipped` |
| A.1-A.6 | ✅ PASS | `01-chat-picker.png` | `GET /api/trpc/chats.list?...limit=500...` вернул `200`, чекбоксы видны, `Нет доступных чатов` нет |
| B.1-B.4 | ✅ PASS | `02-skipped-status.png` | В UI строки cooldown серые `Пропущен`, фильтр `Пропущены` есть и работает |
| B.5 | ✅ PASS | - | В БД `skipped >= 8`, `failed + cooldown = 0` |
| C.1-C.6 | ❌ FAIL | `03-quarter-q2-created.png` | `POST /api/trpc/survey.create` вернул `412 PRECONDITION_FAILED`: overlap с `d166...`, новый survey не создан |
| C.7-C.8 | ⚠️ PARTIAL | - | SQL-подтверждение нового `2026-Q2` survey и cleanup не применимы, т.к. запись не создалась |
| C-retry pre-check | ✅ PASS | - | Для `2026-Q3` overlap-строк среди `scheduled/sending/active` survey не найдено |
| C-retry 1-8 | ✅ PASS | `03b-quarter-q3-created.png` | `POST /api/trpc/survey.create` вернул `200`; survey `86070cc0...` создан с `quarter='2026-Q3'`, затем удалён |
| D.1-D.4 | ❌ FAIL | - | `specific_chats` на `2026-Q2` также падает с тем же `412 OVERLAP`, survey не создаётся |
| D.5 | ⚠️ PARTIAL | - | Cleanup не нужен, потому что записи не создались |
| D-retry 1-7 | ✅ PASS | `04-specific-chats-q3.png` | `specific_chats` на `2026-Q3` вернул `200`; survey `b9ba03ca...` имел 2 chatIds и 2 deliveries, затем удалён |
| E.1-E.4 | ⏭️ SKIP | - | В production нет sandbox segment (`public.chat_segments` пуст) |
| F.1-F.4 | ✅ PASS | - | Временный accountant после login редиректится на `/dashboard`; доступ к `/settings/survey` отсутствует |

## SQL-проверки

`Preflight — DeliveryStatus enum`

```json
[
  { "status": "pending" },
  { "status": "delivered" },
  { "status": "reminded" },
  { "status": "expired" },
  { "status": "failed" },
  { "status": "responded" },
  { "status": "skipped" }
]
```

`B.5 — grouped survey_deliveries`

```json
{
  "grouped": [
    {
      "status": "delivered",
      "has_skip": false,
      "count": 5
    },
    {
      "status": "responded",
      "has_skip": false,
      "count": 5
    },
    {
      "status": "skipped",
      "has_skip": true,
      "count": 8
    }
  ],
  "cooldown_failed": {
    "cooldown_failed_count": 0
  },
  "survey_d166": [
    {
      "status": "skipped",
      "count": 4
    }
  ]
}
```

`C/D retry pre-check — overlap for 2026-Q3`

```json
[]
```

`C-retry — captured before cleanup for survey_id=86070cc0-4d02-4091-8bf3-d5145e6d1e79`

```json
{
  "details": {
    "id": "86070cc0-4d02-4091-8bf3-d5145e6d1e79",
    "quarter": "2026-Q3",
    "start_date": "2026-07-01T00:00:00.000Z",
    "end_date": "2026-09-30T23:59:59.999Z",
    "status": "sending",
    "total_clients": 0,
    "delivered_count": 0,
    "response_count": 0
  },
  "deliveries": {
    "count": 0
  },
  "cleanedSurveyId": "86070cc0-4d02-4091-8bf3-d5145e6d1e79"
}
```

`D-retry — captured before cleanup for survey_id=b9ba03ca-c761-41fa-a43c-8e0e651655cc`

```json
{
  "details": {
    "id": "b9ba03ca-c761-41fa-a43c-8e0e651655cc",
    "audience_type": "specific_chats",
    "audience_chat_ids": [
      "-5089178741",
      "-5097032083"
    ],
    "quarter": "2026-Q3",
    "start_date": "2026-07-01T00:00:00.000Z",
    "end_date": "2026-09-30T23:59:59.999Z",
    "status": "sending"
  },
  "deliveries": {
    "count": 2
  },
  "cleanedSurveyId": "b9ba03ca-c761-41fa-a43c-8e0e651655cc"
}
```

`E.1 — available segments`

```json
{
  "segments": [],
  "latestSurveys": [
    {
      "id": "d1667780-3f16-48cb-900a-762de1669ec7",
      "quarter": null,
      "start_date": "2026-04-06T03:00:00.000Z",
      "end_date": "2026-04-15T03:00:00.000Z",
      "status": "sending",
      "audience_type": "all",
      "audience_chat_ids": [],
      "audience_segment_ids": []
    },
    {
      "id": "aefd15fe-dfa1-4a01-a786-ac29977cd21f",
      "quarter": null,
      "start_date": "2026-04-06T03:00:00.000Z",
      "end_date": "2026-04-15T03:00:00.000Z",
      "status": "closed",
      "audience_type": "all",
      "audience_chat_ids": [],
      "audience_segment_ids": []
    },
    {
      "id": "d47058d4-9803-4ef3-8b46-754363390988",
      "quarter": null,
      "start_date": "2026-04-01T03:00:00.000Z",
      "end_date": "2026-04-18T03:00:00.000Z",
      "status": "closed",
      "audience_type": "all",
      "audience_chat_ids": [],
      "audience_segment_ids": []
    }
  ]
}
```

## Найденные баги

- `buh-ggob` — closed as `not a bug`: overlap guard корректно заблокировал `Q2` из-за предсуществующего активного survey; retry на `Q3` прошёл

## Cleanup

- Временный accountant `df9bbdbf-0528-45ef-8d93-85b5150d5606` удалён из `public.users` и Supabase Auth
- Новые survey для шагов `[C]` и `[D]` не создались, cleanup записей не потребовался
- Retry survey `86070cc0-4d02-4091-8bf3-d5145e6d1e79` (`C-retry`) удалён вместе с deliveries
- Retry survey `b9ba03ca-c761-41fa-a43c-8e0e651655cc` (`D-retry`) удалён вместе с deliveries
- Шаг `[E]` пропущен, потому что в production нет sandbox segment

## Приложения

- `screenshots/01-chat-picker.png`
- `screenshots/02-skipped-status.png`
- `screenshots/03-quarter-q2-created.png`
- `screenshots/03b-quarter-q3-created.png`
- `screenshots/04-specific-chats-q3.png`

ГОТОВ К ПРОДУ: YES
