# Contributing to BuhBot

Спасибо за интерес к проекту **BuhBot**! Мы приветствуем вклад от сообщества.

## 🚀 Как начать

1. **Fork** репозитория
2. **Clone** вашего fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/BuhBot.git
   cd BuhBot
   ```
3. Создайте **feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. Внесите изменения и **commit**:
   ```bash
   git commit -m "feat: add your feature description"
   ```
5. **Push** в ваш fork:
   ```bash
   git push origin feature/your-feature-name
   ```
6. Откройте **Pull Request**

## 📝 Стандарты кода

- Используйте **ESLint** и **Prettier** для форматирования
- Пишите **понятные commit messages** (см. [Conventional Commits](https://www.conventionalcommits.org/))
- Добавляйте **тесты** для новой функциональности
- Обновляйте **документацию** при необходимости

## 🧪 Тестирование

Перед отправкой PR убедитесь, что:
- [ ] Все тесты проходят: `npm test`
- [ ] Code coverage не снизился
- [ ] Нет TypeScript ошибок: `npm run type-check`
- [ ] Build проходит: `npm run build`

## 📋 Commit Message Convention

Используйте префиксы:
- `feat:` - новая функциональность
- `fix:` - исправление бага
- `docs:` - изменения в документации
- `refactor:` - рефакторинг кода
- `test:` - добавление/изменение тестов
- `chore:` - обновление зависимостей, конфигурации и т.д.

Пример:
```
feat: add SLA monitoring for accountant response time

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
