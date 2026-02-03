# Contributing to BuhBot

Спасибо за интерес к проекту **BuhBot**! Мы приветствуем вклад от сообщества.

## 🚀 Как начать

1. **Fork** репозитория
2. **Clone** вашего fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/BuhBot.git
   cd BuhBot
   ```
3. **Установите зависимости** (это также настроит pre-commit hooks):
   ```bash
   pnpm install
   ```
4. Создайте **feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. Внесите изменения и **commit**:
   ```bash
   git commit -m "feat: add your feature description"
   ```
6. **Push** в ваш fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. Откройте **Pull Request**

## 🔧 Pre-commit Hooks

Проект использует **Husky** и **lint-staged** для автоматической проверки кода перед каждым коммитом.

После `pnpm install` hooks настраиваются автоматически. При каждом коммите:
- **ESLint** проверяет и автоматически исправляет ошибки в TypeScript/JavaScript файлах
- **Prettier** форматирует код согласно настройкам проекта

Если проверка не проходит, коммит будет заблокирован. Исправьте ошибки и попробуйте снова.

### Полезные команды

```bash
# Проверить форматирование всех файлов
pnpm format:check

# Автоматически отформатировать все файлы
pnpm format

# Запустить линтер вручную
pnpm lint
```

> **Примечание**: Используйте `git commit --no-verify` только в крайних случаях для обхода hooks.

## 📝 Стандарты кода

- Используйте **ESLint** и **Prettier** для форматирования
- Пишите commit messages по [Commit Conventions](docs/COMMIT_CONVENTIONS.md) (Conventional Commits + Release Please)
- Добавляйте **тесты** для новой функциональности
- Обновляйте **документацию** при необходимости

## 🧪 Тестирование

Перед отправкой PR убедитесь, что:
- [ ] Все тесты проходят: `npm test`
- [ ] Code coverage не снизился
- [ ] Нет TypeScript ошибок: `npm run type-check`
- [ ] Build проходит: `npm run build`

## 📋 Commit Message Convention

Полные правила: **[docs/COMMIT_CONVENTIONS.md](docs/COMMIT_CONVENTIONS.md)** (Conventional Commits + правила для Release Please).

Кратко:
- `feat:` — новая функциональность
- `fix:` — исправление бага
- `docs:` — только документация
- `refactor:` / `test:` / `chore:` / `style:` / `perf:` / `ci:` — см. [COMMIT_CONVENTIONS.md](docs/COMMIT_CONVENTIONS.md)

Subject: imperative, lowercase, без точки в конце, до 72 символов. Не используйте `chore(release):` — это зарезервировано для релизов.

Пример:
```
feat(sla): add SLA monitoring for accountant response time

- Implement webhook processing for Telegram API
- Add timer logic with working hours calculation
- Create admin panel for SLA configuration
```

## 🔍 Code Review Process

1. Maintainer рассмотрит ваш PR в течение **3-5 рабочих дней**
2. Возможны **запросы на изменения** - не волнуйтесь, это нормальный процесс!
3. После одобрения PR будет **merged** в main branch

## 🐛 Баг-репорты

Используйте [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md) при создании issue.

## 💡 Feature Requests

Используйте [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md).

## 📞 Вопросы?

- Откройте [Discussion](https://github.com/maslennikov-ig/BuhBot/discussions)
- Или создайте [Issue](https://github.com/maslennikov-ig/BuhBot/issues)

---

**Спасибо за ваш вклад! ❤️**
