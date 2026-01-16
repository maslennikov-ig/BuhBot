# MCP Configuration для bobabuh

## Текущая конфигурация

**File**: `/.mcp.json` (root directory)

Унифицированная конфигурация с 6 MCP серверами.

### Included Servers
- **context7**
- **playwright**
- **sequential-thinking**
- **serena**
- **shadcn**
- **supabase**

## Переменные окружения

Конфигурация в `/.env`:
- ✅ Файл создан автоматически
- ✅ В .gitignore (не попадает в git)
- ✅ Permissions: 600 (только владелец)

## Auto-Optimization

Claude Code автоматически оптимизирует загрузку:
- Активация при >10K tokens
- 85% сокращение контекста
- On-demand загрузка серверов

## Проверка

После изменений:
```bash
cd /home/me/code/bobabuh
claude doctor
```

## References

- [MCP Tool Search](https://www.anthropic.com/engineering/advanced-tool-use)
- [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp)
