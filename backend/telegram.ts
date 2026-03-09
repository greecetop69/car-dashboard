import type { PendingNotification } from "./notificationFactories.js";

const TG_ENABLED = ["1", "true", "yes"].includes(
  (process.env.TG_ENABLED ?? "").toLowerCase(),
);
const TG_BOT_TOKEN = (process.env.TG_BOT_TOKEN ?? "").trim();
const TG_CHAT_ID = (process.env.TG_CHAT_ID ?? "").trim();
const TG_TIMEOUT_MS = Math.max(1000, Number(process.env.TG_TIMEOUT_MS ?? 8000));
const TG_MAX_MESSAGES_PER_BATCH = Math.max(
  1,
  Number(process.env.TG_MAX_MESSAGES_PER_BATCH ?? 25),
);
const TG_RETRY_COUNT = Math.max(0, Number(process.env.TG_RETRY_COUNT ?? 1));
const TG_RETRY_DELAY_MS = Math.max(100, Number(process.env.TG_RETRY_DELAY_MS ?? 600));

function formatTypeLabel(type: PendingNotification["type"]) {
  if (type === "new_car") return "NEW";
  if (type === "price_drop") return "PRICE DOWN";
  if (type === "price_change") return "PRICE UP";
  if (type === "car_sold") return "SOLD";
  return "EVENT";
}

function getNotificationUrl(item: PendingNotification) {
  const raw = item.payloadJson?.url;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function getNotificationPhotoUrl(item: PendingNotification) {
  const raw = item.payloadJson?.mainPhoto;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function buildTelegramText(item: PendingNotification) {
  const lines = [`[${formatTypeLabel(item.type)}] ${item.title}`, item.message];
  const url = getNotificationUrl(item);
  if (url) lines.push(url);
  return lines.join("\n");
}

function isValidChatId(chatId: string) {
  if (!chatId) return false;
  if (chatId.startsWith("@")) return chatId.length >= 5;
  return /^-?\d+$/.test(chatId);
}

async function postTelegram(method: "sendMessage" | "sendPhoto", payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TG_TIMEOUT_MS);
  const response = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  const body = (await response.json()) as { ok?: boolean; description?: string };
  if (body.ok !== true) {
    throw new Error(`Telegram API error: ${body.description ?? "unknown error"}`);
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry(task: () => Promise<void>) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TG_RETRY_COUNT; attempt += 1) {
    try {
      await task();
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= TG_RETRY_COUNT) break;
      await delay(TG_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError;
}

async function sendTelegramMessage(text: string) {
  await postTelegram("sendMessage", {
    chat_id: TG_CHAT_ID,
    text,
    disable_web_page_preview: true,
  });
}

async function sendTelegramPhoto(photoUrl: string, caption: string) {
  await postTelegram("sendPhoto", {
    chat_id: TG_CHAT_ID,
    photo: photoUrl,
    caption: caption.slice(0, 1024),
    disable_notification: false,
  });
}

export async function sendTelegramNotifications(items: PendingNotification[]) {
  if (!TG_ENABLED) return;
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  if (!isValidChatId(TG_CHAT_ID)) {
    throw new Error("Invalid TG_CHAT_ID format");
  }

  const notifyTypes = new Set<PendingNotification["type"]>([
    "new_car",
    "price_drop",
    "price_change",
    "car_sold",
  ]);
  const targets = items.filter((item) => notifyTypes.has(item.type)).slice(0, TG_MAX_MESSAGES_PER_BATCH);
  if (targets.length === 0) return;

  for (const item of targets) {
    const text = buildTelegramText(item);
    const photoUrl = getNotificationPhotoUrl(item);
    if (photoUrl) {
      try {
        await sendWithRetry(() => sendTelegramPhoto(photoUrl, text));
        continue;
      } catch {
        await sendWithRetry(() => sendTelegramMessage(text));
        continue;
      }
    }
    await sendWithRetry(() => sendTelegramMessage(text));
  }
}
