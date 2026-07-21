import type { Provider, RunLog, TestKind } from "@/lib/types";

export function runKind(run: RunLog): TestKind {
  return run.kind || "image";
}

export function formatDuration(value?: number) {
  if (value === undefined || !Number.isFinite(value) || value < 0) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(2)}초` : `${Math.round(value)}ms`;
}

export function formatCredit(value?: number) {
  return value === undefined
    ? "단가 미등록"
    : value.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
}

export function runCredit(run: RunLog) {
  return run.usage.estimatedCredit;
}

export function providerName(provider: Provider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Google";
  return "Anthropic";
}

export function csvCell(value: unknown) {
  const original = String(value ?? "");
  const safe = /^[=+\-@]/.test(original) ? `'${original}` : original;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) throw new Error(`서버가 빈 응답을 반환했습니다. (${response.status})`);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`서버 응답을 해석할 수 없습니다. (${response.status})`);
  }
}
