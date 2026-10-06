# Бот Action & Quality для MAX (max.ru)

Бот выдаёт пользователям **персональный ключ доступа** к приложению (Настройки → «Войти по ключу») и напоминает о чек-ине настроения каждое утро в 09:00.

## Как это работает

1. Пользователь пишет боту `/start` → получает персональный ключ вида `max-<id>@aq.bot` и кнопку «Открыть приложение».
2. Ключ вводится один раз в приложении — сессия привязывается к аккаунту MAX навсегда.
3. `/remind` включает/выключает утренние напоминания (напоминание шлёт сам бот в 09:00 по локальному времени сервера).

## Создание бота

1. Откройте [business.max.ru/self](https://business.max.ru/self) (или мини-приложение «MAX для бизнеса» → бот «Получить токен»).
2. **Чат-боты → Создать** → укажите название и описание.
3. Скопируйте **access_token** из настроек бота (⋮ → Настройки).

## Запуск

```bash
# самотест без сети (эмулирует /start, /key, /remind, /help):
npm run bot:test

# боевой режим (long polling):
MAX_BOT_TOKEN=<ваш-токен> APP_URL=https://ваш-домен node bot/index.mjs
# или коротко:
MAX_BOT_TOKEN=<токен> npm run bot
```

Переменные окружения:

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `MAX_BOT_TOKEN` | — (обязателен) | токен бота из business.max.ru |
| `APP_URL` | `http://localhost:5173` | адрес приложения для кнопки «Открыть приложение» |
| `MAX_API_BASE` | `https://platform-api2.max.ru` | база Bot API |
| `MAX_STATE` | `bot/state.json` | файл состояния (маркер polling + подписчики) |
| `POLL_TIMEOUT` | `30` | long-polling таймаут, сек (0–90) |
| `MAX_MOCK` | — | `1` = самотест без сети |

## API (dev.max.ru)

- База: `https://platform-api2.max.ru`, токен — заголовок `Authorization: <токен>`.
- `GET /updates?marker=&timeout=30&types=message_created` — long polling; ответ `{ updates, marker }`, маркер сохраняем.
- `POST /messages?chat_id=<id>` — отправка; кнопка-ссылка: `attachments: [{ type: "inline_keyboard", payload: { buttons: [[{ type: "link", text, url }]] } }]`.

Для продакшна MAX рекомендует webhooks (`POST /subscriptions`) вместо long polling — текущий бот использует polling, т.к. не требует публичного HTTPS-домена.

## Требования

- Node.js 18+ (используется глобальный `fetch`), зависимостей нет.
- Сертификат Минцифры должен быть доверенным на сервере, где работает бот (требование MAX API).
