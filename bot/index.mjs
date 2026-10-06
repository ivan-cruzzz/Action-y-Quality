#!/usr/bin/env node
/**
 * Action & Quality — бот для мессенджера MAX (max.ru).
 *
 * Роль бота: выдача персонального ключа доступа к приложению
 * (Настройки → «Войти по ключу») + напоминание о чек-ине каждый день в 09:00.
 *
 * Bot API: https://dev.max.ru
 *   База:        https://platform-api2.max.ru
 *   Авторизация: заголовок `Authorization: <токен>` (без Bearer)
 *   Обновления:  GET /updates?marker=&timeout=30&types=message_created
 *   Отправка:    POST /messages?chat_id=<id>  { text, attachments:[inline_keyboard] }
 *
 * Запуск:  MAX_BOT_TOKEN=xxx node bot/index.mjs
 * Тест:    MAX_MOCK=1 node bot/index.mjs   (эмулирует /start и /key без сети)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, "state.json");

const CONFIG = {
  token: process.env.MAX_BOT_TOKEN ?? "",
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  adminId: process.env.ADMIN_ID ?? "",
  pollTimeout: Number(process.env.POLL_TIMEOUT ?? 30),
  api: process.env.MAX_API_BASE ?? "https://platform-api2.max.ru",
  mock: process.env.MAX_MOCK === "1",
  statePath: process.env.MAX_STATE ?? STATE_PATH,
};

/* ---------- state ---------- */

function loadState() {
  if (existsSync(CONFIG.statePath)) {
    try {
      return JSON.parse(readFileSync(CONFIG.statePath, "utf8"));
    } catch {
      /* corrupted — start fresh */
    }
  }
  return { marker: null, chats: {} };
}

function saveState(state) {
  writeFileSync(CONFIG.statePath, JSON.stringify(state, null, 2));
}

const state = loadState();

/* ---------- transport ---------- */

const API = CONFIG.api;

async function apiCall(method, options = {}) {
  const url = new URL(API + method);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: CONFIG.token,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`MAX API ${method} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** Персональный ключ: email-подобный, роль user назначается приложением. */
function personalKey(userId) {
  return `max-${userId}@aq.bot`;
}

function mainKeyboard() {
  return [
    [
      { type: "link", text: "Открыть приложение", url: CONFIG.appUrl },
    ],
  ];
}

async function sendMessage(chatId, text) {
  const body = {
    text,
    attachments: [
      {
        type: "inline_keyboard",
        payload: { buttons: mainKeyboard() },
      },
    ],
  };
  if (CONFIG.mock) {
    console.log(`→ [mock] to ${chatId}:\n${text}\n[keyboard: ${body.attachments[0].payload.buttons[0][0].url}]`);
    return { message: { body: { text } } };
  }
  return apiCall("/messages", { method: "POST", query: { chat_id: chatId }, body });
}

/* ---------- command handlers ---------- */

function welcome(chat) {
  const key = chat.key;
  return (
    `👋 Привет! Я бот Action & Quality — приложения против лени и за дисциплину.\n\n` +
    `Твой персональный ключ доступа:\n\`${key}\`\n\n` +
    `1️⃣ Нажми «Открыть приложение» ниже\n` +
    `2️⃣ Настройки → «Войти по ключу»\n` +
    `3️⃣ Введи этот ключ — и готово.\n\n` +
    `Каждое утро в 09:00 напомню про чек-ин настроения (/remind — вкл/выкл).`
  );
}

const HANDLERS = {
  start(chatId) {
    const chat = state.chats[chatId];
    return welcome(chat);
  },

  key(chatId) {
    const chat = state.chats[chatId];
    return `🔑 Твой ключ доступа:\n\`${chat.key}\`\n\nНастройки → «Войти по ключу» → вставь ключ. Ключ действует постоянно и привязан к этому аккаунту в MAX.`;
  },

  remindOn(chatId) {
    state.chats[chatId].reminders = true;
    saveState(state);
    return `✅ Напоминания включены: каждое утро в 09:00 пришлю напоминание про чек-ин настроения.`;
  },

  remindOff(chatId) {
    state.chats[chatId].reminders = false;
    saveState(state);
    return `🔕 Напоминания выключены. Включить: /remind`;
  },

  help() {
    return (
      `Action & Quality — команды:\n` +
      `/start — приветствие и ключ доступа\n` +
      `/key — показать твой ключ\n` +
      `/remind — вкл/выкл утренние напоминания\n` +
      `/help — эта справка\n\n` +
      `Демо-ключи для ролей: ivan@dev.ru (админ), miAMor@for.you (премиум).`
    );
  },
};

/** Returns a reply text or null for unknown input. */
function handleText(chatId, text) {
  const cmd = text.trim().toLowerCase().split(/[\s@]+/)[0];
  switch (cmd) {
    case "/start":
      return HANDLERS.start(chatId);
    case "/key":
      return HANDLERS.key(chatId);
    case "/remind":
    case "/remind_on":
      return HANDLERS.remindOn(chatId);
    case "/remind_off":
      return HANDLERS.remindOff(chatId);
    default:
      return HANDLERS.help();
  }
}

/** Registers the chat (or refreshes its personal key). */
function ensureChat(userId, chatId) {
  if (!state.chats[chatId]) {
    state.chats[chatId] = {
      user_id: userId,
      key: personalKey(userId),
      reminders: true,
      since: new Date().toISOString(),
    };
  }
  saveState(state);
  return state.chats[chatId];
}

/* ---------- daily reminder loop ---------- */

let lastReminderDate = "";

function checkReminders() {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);
  if (hhmm !== "09:00" || lastReminderDate === today) return;
  lastReminderDate = today;
  for (const [chatId, chat] of Object.entries(state.chats)) {
    if (!chat.reminders) continue;
    sendMessage(chatId, `☀️ Доброе утро! Время чек-ина настроения — как ты себя чувствуешь сегодня?`)
      .then(() => console.log(`reminder sent to ${chatId}`))
      .catch((e) => console.error(`reminder failed for ${chatId}:`, e.message));
  }
}

/* ---------- long polling ---------- */

async function pollLoop() {
  for (;;) {
    try {
      const data = await apiCall("/updates", {
        query: {
          marker: state.marker ?? undefined,
          timeout: CONFIG.pollTimeout,
          types: "message_created",
        },
      });
      state.marker = data.marker ?? state.marker;
      saveState(state);
      for (const update of data.updates ?? []) {
        if (update.update_type !== "message_created") continue;
        const msg = update.message;
        const chatId = msg?.recipient?.chat_id;
        const userId = msg?.sender?.user_id;
        const text = msg?.body?.text ?? "";
        if (!chatId || !userId) continue;
        ensureChat(userId, chatId);
        const reply = handleText(chatId, text);
        if (reply) await sendMessage(chatId, reply);
      }
    } catch (e) {
      console.error("poll error:", e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/* ---------- mock self-test ---------- */

async function runMock() {
  console.log("== MAX bot: MOCK self-test ==");
  const fakeUserId = 424242;
  const fakeChatId = 424242; // в диалоге chat_id совпадает с user_id
  const scenarios = ["/start", "/key", "/remind", "/help", "привет"];
  for (const text of scenarios) {
    console.log(`← [mock] ${text}`);
    ensureChat(fakeUserId, fakeChatId);
    const reply = handleText(fakeChatId, text);
    if (reply) await sendMessage(fakeChatId, reply);
  }
  const chat = state.chats[fakeChatId];
  if (!chat || chat.key !== personalKey(fakeUserId)) throw new Error("self-test failed: key");
  console.log("\n== self-test OK: state saved to", CONFIG.statePath, "==");
}

/* ---------- entry ---------- */

if (CONFIG.mock) {
  await runMock();
} else if (!CONFIG.token) {
  console.error("MAX_BOT_TOKEN не задан. Получите токен бота (business.max.ru → Чат-боты) и запустите:\n  MAX_BOT_TOKEN=xxx node bot/index.mjs\nДля локального самотеста: MAX_MOCK=1 node bot/index.mjs");
  process.exit(1);
} else {
  console.log(`Action & Quality bot: long polling ${CONFIG.api}, приложение: ${CONFIG.appUrl}`);
  setInterval(checkReminders, 30_000);
  await pollLoop();
}
