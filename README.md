# BuhBot

**Платформа автоматизации коммуникаций для бухгалтерских фирм**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: Phase 1 Infrastructure](https://img.shields.io/badge/Status-Phase%201%20Infrastructure-green.svg)]()

---

## 📋 О проекте

**BuhBot** — это комплексная система автоматизации взаимодействия бухгалтерских фирм с клиентами через Telegram-бот с интеллектуальным мониторингом SLA, проактивной аналитикой и системой удержания клиентов.

### Ключевые возможности

- 🎯 **SLA-мониторинг** — отслеживание времени ответа бухгалтеров с учетом рабочего времени
- 📊 **Аналитика коммуникаций** — анализ типов задач, настроения клиентов, индикаторов риска
- 🤖 **AI-фильтр флуда** — умная классификация запросов от "флуда"
- 📈 **Обратная связь** — автоматический сбор оценок клиентов с анонимностью
- 💬 **Quick Wins** — inline-кнопки, автоответы на FAQ, шаблоны ответов
- 🎁 **Проактивный сервис** — умные напоминания, celebration достижений, tier-based membership
- 🔐 **152-ФЗ compliance** — локализация данных в Yandex Cloud, encryption

---

## 🏗️ Архитектура проекта

Проект разрабатывается в **3 фазы**:

### 📦 Фаза 1: CORE + QUICK WINS (6-8 недель)
- SLA-мониторинг и алерты
- Квартальная обратная связь
- Inline-кнопки для клиентов и бухгалтеров
- Автоответы на FAQ
- Шаблоны ответов
- n8n Foundation
- Инфраструктура (Yandex Cloud, 152-ФЗ)

### 🎁 Фаза 2: INTELLIGENCE & PROACTIVE (8-12 недель)
- Аналитика коммуникаций (время, типы задач, sentiment)
- Big Data Collection (бизнес-события, риски, предпочтения)
- Умные напоминания с эскалацией
- Early churn detection

### 🚀 Фаза 3: WOW & DIFFERENTIATION (10-14 недель)
- Реферальная программа
- Статус запросов и быстрые действия
- Рассылки и новости
- Celebration достижений клиента
- Tier-based membership (геймификация)
- Интеграции (YooKassa, Yandex.Disk, OCR)
- Автоподготовка документов
- База знаний

---

## 📁 Структура репозитория

```
BuhBot/
├── .claude/                 # Claude Code агенты и команды
│   ├── agents/             # AI-агенты для автоматизации
│   ├── commands/           # Slash-команды
│   └── skills/             # Переиспользуемые навыки
├── docs/                   # Документация проекта
│   ├── Technical-Specification.md
│   ├── Final-Modular-Offer-With-Hours.md
│   └── Agents Ecosystem/   # Документация агентной архитектуры
├── mcp/                    # Model Context Protocol конфигурация
├── .env.example            # Пример переменных окружения
├── .gitignore
├── CHANGELOG.md
├── CLAUDE.md               # Правила оркестрации для Claude Code
└── README.md
```

---

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+
- PostgreSQL 14+
- Telegram Bot Token (с отключённым Privacy Mode!)
- Yandex Cloud аккаунт
- Yandex GPT API ключ

> ⚠️ **ВАЖНО**: В BotFather необходимо отключить Privacy Mode для бота.
> Иначе бот не будет получать сообщения в групповых чатах.
> BotFather → `/mybots` → Ваш бот → Bot Settings → Group Privacy → Turn off

### Установка

```bash
# Клонирование репозитория
git clone https://github.com/maslennikov-ig/BuhBot.git
cd BuhBot

# Установка зависимостей (автоматически настраивает pre-commit hooks)
pnpm install

# Настройка переменных окружения
cp .env.example .env.local
# Отредактируйте .env.local с вашими credentials
```

### Разработка

Проект использует pre-commit hooks для автоматической проверки качества кода:

```bash
# Запуск линтера
pnpm lint

# Проверка форматирования
pnpm format:check

# Автоформатирование кода
pnpm format

# Проверка типов
pnpm type-check
```

При каждом коммите автоматически запускаются ESLint и Prettier на измененных файлах.

---

## 📊 Метрики и ROI

### Ожидаемые результаты:

- **Retention рост:** +15-20%
- **Efficiency рост:** +40% (автоматизация рутины)
- **Response time:** с 45 мин → 1 мин (FAQ)
- **Окупаемость Фазы 1:** 1 месяц
- **ROI Фазы 1:** 1,125%

---

## 📖 Документация

- [Техническое задание](docs/Technical-Specification.md)
- [Детальное предложение с часами](docs/Final-Modular-Offer-With-Hours.md)
- [Архитектура агентной системы](docs/Agents%20Ecosystem/ARCHITECTURE.md)
- [Правила оркестрации](CLAUDE.md)
- [Архитектурные решения (ADR)](docs/adr/) - Architecture Decision Records

### Infrastructure Documentation

Phase 1 Infrastructure Foundation completed. Technology stack: Supabase (PostgreSQL), Docker, Yandex Cloud VDS.

- [Quick Start Deployment Guide](docs/infrastructure/quickstart.md) - Get started with deployment
- [Architecture Overview](docs/infrastructure/architecture-diagram.md) - System architecture and components
- [CI/CD Pipeline Setup](docs/infrastructure/ci-cd-setup.md) - GitHub Actions automation
- [Security Checklist](docs/infrastructure/security-checklist.md) - Security hardening guide
- [Monitoring & Alerting Guide](docs/infrastructure/monitoring-guide.md) - Observability setup
- [Backup & Disaster Recovery](docs/infrastructure/disaster-recovery.md) - Data protection strategy
- [Troubleshooting Guide](docs/infrastructure/troubleshooting.md) - Common issues and solutions
- [Project Specification](specs/001-infrastructure-setup/) - Detailed infrastructure specs

---

## 🛠️ Технологический стек

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js / Fastify
- **Database:** PostgreSQL 14+ (Yandex Managed Database)
- **Cache:** Redis
- **Queue:** BullMQ

### Frontend
- **Bot Framework:** node-telegram-bot-api / Telegraf
- **Web Admin Panel:** Next.js 14+ / React

### AI & ML
- **LLM:** Yandex GPT (для фильтрации, NLP)
- **OCR:** Google Vision API / Tesseract
- **Sentiment Analysis:** Russian-specific models

### Integrations
- **Automation:** n8n
- **Payments:** YooKassa (54-ФЗ compliance)
- **Storage:** Yandex Object Storage / Yandex.Disk
- **Hosting:** Yandex Cloud (152-ФЗ compliance)

---

## 📅 Roadmap

### Q1 2025
- [x] Исследование и анализ требований
- [x] Техническое задание
- [x] Инициализация репозитория
- [x] Настройка CI/CD
- [x] Phase 1: Infrastructure Foundation (Supabase, Docker, Yandex Cloud)
- [ ] Начало Фазы 1: Core Features

### Q2 2025
- [ ] Завершение Фазы 1 (CORE + QUICK WINS)
- [ ] Beta-тестирование с первыми клиентами
- [ ] Начало Фазы 2

### Q3-Q4 2025
- [ ] Фаза 2: Intelligence & Proactive
- [ ] Фаза 3: WOW & Differentiation
- [ ] Production-ready release

---

## 🤝 Контрибьютинг

Проект находится в стадии активной разработки. Вклад приветствуется!

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

---

## 📝 Лицензия

MIT License - см. файл [LICENSE](LICENSE) для деталей.

---

## 👥 Авторы

- **Igor Maslennikov** - [GitHub](https://github.com/maslennikov-ig)

---

## 📞 Контакты

- **Repository:** https://github.com/maslennikov-ig/BuhBot
- **Issues:** https://github.com/maslennikov-ig/BuhBot/issues

---

**Made with ❤️ for бухгалтерские фирмы России**
