# E2E retry: C/D шаги с 2026-Q3 (post PR #322)

> Передай этот файл тому же Claude-агенту, который делал первый прогон
> `e2e-survey-validation-pr322.md` и выдал отчёт
> `docs/reports/e2e/2026-04-20-survey-smoke-post-deploy.md`.
>
> Он уже в admin-сессии. Попросит заново залогиниться только если сессия
> отвалилась.

---

## Что изменилось

Первый прогон пометил C/D как FAIL из-за `412 PRECONDITION_FAILED` на overlap.
Это **не баг фикса buh-i4xx** — это корректная работа gh-292 rule 3 (OVERLAP
guard). Период 2026-Q2 (01.04–30.06) пересекался с тогда-активным survey
`d1667780-...` (06.04–15.04, sending). Тот survey с тех пор **auto-closed**
(SQL confirmed: status='closed', closed_at=2026-04-20 15:55:34Z), поэтому C
на Q2 можно повторить — но безопаснее взять 2026-Q3, чтобы исключить
любые оставшиеся пересечения и не засорять Q2 у реальных админов.

---

## Промт (передать агенту целиком)

```
Продолжи E2E smoke-test из docs/agents/e2e-survey-validation-pr322.md.
Шаги A, B, F помечены PASS — не переделывай их.

ПЕРЕПРОВЕРЬ ТОЛЬКО [C] и [D], с одним изменением: вместо 2026-Q2 используй 2026-Q3.

Почему: в первом прогоне [C]/[D] упали с 412 PRECONDITION_FAILED из-за
OVERLAP guard — активный survey d1667780... покрывал Q2. Это не баг нашего
фикса (buh-i4xx трогал rule 2 max-range, а упала rule 3 overlap). Переключение
на Q3 (01.07–30.09) гарантирует отсутствие overlap и даёт чистый happy-path.

ПРЕ-ЧЕК перед retry:
mcp__supabase__execute_sql → 
   SELECT id, status, start_date, end_date 
   FROM public.feedback_surveys 
   WHERE status IN ('scheduled','sending','active')
     AND (
       (start_date <= '2026-09-30'::timestamptz AND end_date >= '2026-07-01'::timestamptz)
       OR start_date IS NULL OR end_date IS NULL
     );
АССЕРТ: вернуло 0 строк (никакого overlap с Q3).
Если не пусто — зафиксируй в отчёте и пропусти [C]/[D] (не баг, а данные).

[C-retry] Quarter preset 2026-Q3 (buh-i4xx)
1. Сессия admin → /settings/survey → «Создать опрос».
2. Режим «По кварталу» → 2026-Q3.
3. Audience=«Все чаты». Запуск=«Немедленно». Submit.
4. АССЕРТ: POST /api/trpc/survey.create = 200 (не 400, не 412).
5. `SELECT id, quarter, start_date, end_date, status FROM public.feedback_surveys ORDER BY created_at DESC LIMIT 1;`
   АССЕРТ: quarter='2026-Q3', start_date=2026-07-01, end_date=2026-09-30.
6. Скриншот detail-страницы → `03b-quarter-q3-created.png`.
7. **Cleanup**: 
   DELETE FROM public.survey_deliveries WHERE survey_id='<new_id>';
   DELETE FROM public.feedback_surveys WHERE id='<new_id>';

[D-retry] Specific chats на 2026-Q3
1. «Создать опрос» → «Выбрать чаты» → выбери 2 тестовых чата.
2. Режим «По кварталу» 2026-Q3. Immediate. Submit.
3. АССЕРТ: 200 OK.
4. `SELECT audience_type, audience_chat_ids FROM public.feedback_surveys ORDER BY created_at DESC LIMIT 1;` 
   АССЕРТ: specific_chats + 2 chatIds.
5. `SELECT count(*) FROM public.survey_deliveries WHERE survey_id='<new_id>';` — АССЕРТ = 2.
6. Скриншот → `04-specific-chats-q3.png`.
7. Cleanup как в [C-retry].

ОБНОВИ отчёт docs/reports/e2e/2026-04-20-survey-smoke-post-deploy.md:
- В таблице: C.1-C.8 и D.1-D.5 перепиши с новыми результатами (не удаляй исходные FAIL-строки — добавь строки «C-retry» и «D-retry» ниже).
- В блок «Найденные баги»: buh-ggob пометь как «not a bug — test-data issue resolved, overlap was with auto-closing survey d1667780».
- Обнови Executive summary и финальную строку «ГОТОВ К ПРОДУ: YES» если всё PASS.
- Скриншоты: добавь `03b-quarter-q3-created.png`, `04-specific-chats-q3.png`.

ЕСЛИ оба retry PASS — `bd close buh-ggob --reason="Not a bug: overlap guard correctly blocked retry on Q2 due to pre-existing active survey; retry on Q3 passed"`.

НЕ трогай A/B/F — они уже PASS в отчёте.
```

---

## После retry

Если агент отчитался `ГОТОВ К ПРОДУ: YES` — PR #322 финально валидирован.
Если нашёл реальный баг — `bd create -t bug` и новый hotfix-PR.
