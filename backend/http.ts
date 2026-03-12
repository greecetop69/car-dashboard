import type { IncomingMessage, ServerResponse } from "node:http";

export const DEFAULT_HTTP_TIMEOUT_MS = 15000;

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
  headers?: Record<string, string | string[]>,
) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

export function sendHtml(
  res: ServerResponse,
  statusCode: number,
  html: string,
  headers?: Record<string, string | string[]>,
) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    ...headers,
  });
  res.end(html);
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const raw = await readTextBody(req);
  if (!raw) return {};
  return JSON.parse(raw);
}

export async function readTextBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return "";
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  return raw;
}

export async function readFormBody(req: IncomingMessage) {
  const raw = await readTextBody(req);
  return new URLSearchParams(raw);
}

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
