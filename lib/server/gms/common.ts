import type { Usage } from "@/lib/types";
import { KNOWN_IMAGE_MODELS, KNOWN_TEXT_MODELS } from "@/lib/model-catalog";

export const GMS_URLS = {
  keyInfo: "https://gms.ssafy.io/gmsapi/key-info",
  openaiBase: "https://gms.ssafy.io/gmsapi/api.openai.com/v1",
  anthropicBase: "https://gms.ssafy.io/gmsapi/api.anthropic.com/v1",
  geminiBase: "https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com/v1beta",
} as const;

export const TIMEOUTS = {
  metadata: 30_000,
  imageGeneration: 300_000,
  imageDownload: 60_000,
  textGeneration: 300_000,
  speechGeneration: 300_000,
} as const;

export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function combineSignals(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  return fetch(url, { ...init, signal: combineSignals(init.signal || undefined, timeoutMs), cache: "no-store" });
}

export async function readJsonResponse(response: Response): Promise<JsonObject> {
  const text = await response.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; }
  catch { body = { message: text.slice(0, 1000) }; }
  if (!response.ok) {
    const details = isRecord(body) && "error" in body ? body.error : body;
    throw new Error(`GMS ${response.status}: ${JSON.stringify(details).slice(0, 1200)}`);
  }
  if (!isRecord(body)) throw new Error("GMS가 예상하지 못한 응답 형식을 반환했습니다.");
  return body;
}

export function sanitizeCustom(custom: JsonObject | undefined, protectedFields: string[]) {
  const protectedNames = new Set([
    ...protectedFields,
    "key", "api_key", "apiKey", "gms_key", "gmsKey", "authorization",
    "password", "secret", "credential", "access_token", "refresh_token",
  ].map((field) => field.toLowerCase()));
  return Object.fromEntries(Object.entries(custom || {}).filter(([field]) => !protectedNames.has(field.toLowerCase())));
}

export function safeError(value: unknown, secrets: string[] = []) {
  let message = value instanceof Error ? value.message : String(value);
  if (/abort|timeout|timed out/i.test(message)) message = "요청 시간이 초과되었거나 사용자가 요청을 취소했습니다.";
  message = message.replace(/(Bearer|x-api-key|x-goog-api-key)\s+[^\s"']+/gi, "$1 [REDACTED]");
  for (const secret of secrets.filter(Boolean)) message = message.split(secret).join("[REDACTED]");
  return message.slice(0, 1600);
}

export function usageCount(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : undefined;
}

export function calculateUsage(kind: "image" | "text", model: string, inputTokens?: number, outputTokens?: number): Usage {
  const catalog = kind === "image" ? KNOWN_IMAGE_MODELS : KNOWN_TEXT_MODELS;
  const rate = catalog.find((item) => item.id === model)?.rate;
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined,
    estimatedCredit: rate && inputTokens !== undefined && outputTokens !== undefined ? inputTokens * rate.input + outputTokens * rate.output : undefined,
  };
}
