# План: Исправление графика "История времени ответа"

## Проблема

На странице `/analytics` график "История времени ответа" отображается некорректно:

1. **График выходит за границы контейнера** — накладывается на секции "Топ бухгалтеров" и "Распределение"
2. Визуально занимает слишком много места по вертикали

## Причина

В файле `frontend/src/components/ui/chart.tsx` (строка 55) компонент `ChartContainer` имеет класс `aspect-video`:

```tsx
className={cn(
  "flex aspect-video justify-center text-xs ...",
  className
)}
```

**Конфликт стилей:**

- `aspect-video` (соотношение 16:9) пытается вычислить высоту из ширины
- Родительский контейнер `<div className="h-80">` задаёт фиксированную высоту 320px
- `ResponsiveContainer` (recharts) пытается заполнить всё доступное пространство
- **Нет `overflow-hidden`** — контент выходит за границы

## Решение

Переопределить стили `ChartContainer` в `analytics/page.tsx` добавив:

1. `overflow-hidden` для ограничения контента
2. `!aspect-auto` для отмены aspect-video
3. `h-full` для заполнения родительского контейнера

## Изменения

### Файл: `frontend/src/app/analytics/page.tsx`

**Строки 592-593:**

До:

```tsx
<div className="h-80">
  <ChartContainer config={historyChartConfig}>
```

После:

```tsx
<div className="h-80 overflow-hidden">
  <ChartContainer config={historyChartConfig} className="!aspect-auto h-full">
```

## Верификация

1. Запустить type-check: `pnpm --filter frontend type-check`
2. Запустить build: `pnpm --filter frontend build`
3. Открыть страницу `/analytics` в браузере
4. Убедиться, что график:
   - Не выходит за границы карточки
   - Корректно отображает данные
   - Не накладывается на секции "Топ бухгалтеров" и "Распределение"

## Критические файлы

- `frontend/src/app/analytics/page.tsx` — основной файл (строки 592-593)
- `frontend/src/components/ui/chart.tsx` — определение ChartContainer (информационно)
