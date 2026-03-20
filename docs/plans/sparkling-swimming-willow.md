# Ревью и оптимизация PR #196

## Контекст

PR #196 (`docs/security-assessment-and-roadmap`) уже смержен в main. Он добавил:
- Архивирование 7 старых security audit отчётов в `docs/archive/reports/security/2026-02-16/`
- 2 новых security assessment документа (`SECURITY-ASSESSMENT.md` + `SECURITY-ASSESSMENT-FULL.md`)
- Roadmap на 873 строки (`SECURE-BY-DESIGN-ROADMAP.md`)
- Расширение commitlint `subject-case` до всех возможных форматов
- Обновление `COMMIT_CONVENTIONS.md`

Все CI-проверки прошли (lint, test, type-check, format, security scan, docker build). Технические утверждения в assessments **верифицированы** по коду: Prisma, RLS, Zod, rate limiting, webhook signature, DEV_MODE isolation, Winston logger, отсутствие хардкод-секретов.

Ниже -- найденные проблемы и план исправлений.

---

## P0: Исправить сейчас

### 1. commitlint `subject-case` -- правило-пустышка

**Проблема:** Массив из 8 case-форматов (lower, upper, camel, kebab, pascal, sentence, snake, start) делает правило no-op -- любая строка попадёт хотя бы в один формат.

**Файлы:**
- `commitlint.config.js` -- оставить только `['lower-case', 'sentence-case']`
- `docs/COMMIT_CONVENTIONS.md` -- убрать таблицу на 8 форматов, оставить 2; удалить блок "Valid Case Variations"; вернуть удалённый bad example `Fix(frontend): Fix button`

### 2. Неточность описания rate limiting в roadmap

**Проблема:** Roadmap описывает rate limiting как "Redis sliding window, ZADD before ZCARD" для всех слоёв. В реальности:
- Bot middleware (`bot/middleware/rate-limit.ts`) -- Redis ZSET, fail-closed ✅
- Express middleware (`middleware/rate-limit.ts`) -- **in-memory Map**, не Redis
- Telegram link auth (`services/telegram/rate-limiter.ts`) -- **in-memory Map**
- Nginx -- `limit_req_zone`, shared memory

**Файл:** `docs/SECURE-BY-DESIGN-ROADMAP.md` -- заменить таблицу rate limiting на точную с разбивкой по компонентам.

---

## P1: Исправить в этом же PR

### 3. Неточный код webhook signature в roadmap

**Проблема:** Секция 2.3 показывает HMAC-SHA256 вычисление, но реальная реализация (`middleware/telegram-signature.ts`) -- прямое constant-time сравнение секрета из заголовка `X-Telegram-Bot-Api-Secret-Token`. Telegram не использует HMAC для webhook secret.

**Файл:** `docs/SECURE-BY-DESIGN-ROADMAP.md` -- заменить сниппет на соответствующий реальной реализации.

### 4. Консолидация двух assessment-документов

**Проблема:** `SECURITY-ASSESSMENT.md` (365 строк) и `SECURITY-ASSESSMENT-FULL.md` (680 строк) дублируют ~60% контента. Два документа = риск расхождений.

**Файлы:**
- Удалить `docs/reports/security/2026-02-21/SECURITY-ASSESSMENT.md`
- Переименовать `SECURITY-ASSESSMENT-FULL.md` в `SECURITY-ASSESSMENT.md`
- Обновить ссылки в roadmap

### 5. Roadmap раздут для масштаба проекта

**Проблема:** 873 строки с ISO 27001, bug bounty, red team, training LMS, RACI-матрицы, security champion программы -- это для enterprise, не для проекта с 1-2 разработчиками.

**Файл:** `docs/SECURE-BY-DESIGN-ROADMAP.md` -- удалить/сократить:
- Секция 1 "Cultural Shifts" -- убрать training curriculum, RACI matrix, cross-team framework (заменить на 5 строк)
- Phase 3 -- убрать pentest procurement, bug bounty, red team
- Phase 4 -- убрать ISO 27001, сократить до 3 строк
- Security Maturity Model -- убрать 5-уровневую модель, оставить простую таблицу текущего состояния

**Цель:** ~300-400 строк вместо 873, сохранив ценную часть (архитектура, code references, Phase 0-1, risk register).

---

## P2: Создать Beads-задачи на будущее

### 6. Добавить CSP-заголовки

Оба assessment корректно отмечают отсутствие Content-Security-Policy. Добавить в `infrastructure/nginx/nginx.conf` рядом с существующими security headers (строки 144-148). Требует тестирования на staging.

### 7. Smoke-тест логгера

Коммит `aa78ca4` показал, что логирование может молча ломаться. Добавить `backend/src/utils/__tests__/logger.smoke.test.ts` -- проверка что logger.info/warn/error не кидают исключения, включая BigInt в metadata.

---

## Последовательность выполнения

```
1. git pull origin main                     # получить PR #196 локально
2. Создать ветку fix/pr196-review-fixes
3. Задача 1: commitlint.config.js + COMMIT_CONVENTIONS.md
4. Задача 2: rate limiting description в roadmap
5. Задача 3: webhook signature snippet в roadmap
6. Задача 4: консолидация assessment-файлов
7. Задача 5: сокращение roadmap
8. /push -m "fix(docs): correct security docs after PR #196 review"
9. bd create для задач 6 и 7 (P2)
```

## Верификация

- `pnpm commitlint --from HEAD~1` -- проверить что commitlint работает с тестовыми сообщениями
- Визуально проверить что ссылки между документами не разорваны
- `git diff --stat` -- убедиться что затронуты только docs/ + commitlint.config.js
