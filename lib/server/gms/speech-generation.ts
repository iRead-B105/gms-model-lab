import type { RunLog, TtsGenerateRequest } from "@/lib/types";
import { fetchWithTimeout, GMS_URLS, safeError, sanitizeCustom, TIMEOUTS } from "@/lib/server/gms/common";
import { saveAudio, saveRun } from "@/lib/server/storage/run-store";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_ERROR_BYTES = 64 * 1024;
const SPEECH_PROTECTED_FIELDS = ["model", "input", "voice", "instructions", "response_format", "speed"];

async function persist(run: RunLog, key: string) {
  try { await saveRun(run); return run; }
  catch (error) {
    return { ...run, status: "error" as const, error: `${run.error ? `${run.error} · ` : ""}로컬 로그 저장 실패: ${safeError(error, [key])}` };
  }
}

async function readLimitedError(response: Response) {
  if (!response.body) return response.statusText;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let message = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value?.byteLength || 0;
    if (totalBytes > MAX_ERROR_BYTES) { await reader.cancel().catch(() => undefined); break; }
    message += decoder.decode(value, { stream: true });
  }
  return message.slice(0, 1_200) || response.statusText;
}

async function readAudioResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`GMS ${response.status}: ${await readLimitedError(response)}`);
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() || "";
  if (contentType && !contentType.startsWith("audio/") && contentType !== "application/octet-stream") {
    throw new Error(`GMS가 오디오가 아닌 응답을 반환했습니다: ${await readLimitedError(response)}`);
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_AUDIO_BYTES) throw new Error("생성 오디오가 허용된 최대 크기(50MB)를 초과했습니다.");
  if (!response.body) throw new Error("GMS가 빈 오디오 응답을 반환했습니다.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let firstChunkAt: number | undefined;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    firstChunkAt ??= performance.now();
    totalBytes += value.byteLength;
    if (totalBytes > MAX_AUDIO_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("생성 오디오가 허용된 최대 크기(50MB)를 초과했습니다.");
    }
    chunks.push(value);
  }
  if (!totalBytes) throw new Error("GMS가 빈 오디오 응답을 반환했습니다.");
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { bytes, firstChunkAt };
}

export async function generateSpeech(request: TtsGenerateRequest, signal?: AbortSignal): Promise<RunLog> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const started = performance.now();
  let apiMs = 0;
  let saveMs = 0;
  let timeToFirstByteMs: number | undefined;

  try {
    const response = await fetchWithTimeout(`${GMS_URLS.openaiBase}/audio/speech`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${request.key}` },
      body: JSON.stringify({
        ...sanitizeCustom(request.customParameters, SPEECH_PROTECTED_FIELDS),
        model: request.model,
        input: request.userPrompt,
        voice: request.parameters.voice,
        ...(request.systemPrompt ? { instructions: request.systemPrompt } : {}),
        response_format: request.parameters.responseFormat,
        speed: request.parameters.speed,
      }),
    }, TIMEOUTS.speechGeneration);
    const { bytes, firstChunkAt } = await readAudioResponse(response);
    apiMs = Math.round(performance.now() - started);
    timeToFirstByteMs = firstChunkAt === undefined ? undefined : Math.round(firstChunkAt - started);
    const saveStarted = performance.now();
    const audio = await saveAudio(id, bytes, request.parameters.responseFormat);
    saveMs = Math.round(performance.now() - saveStarted);
    const totalMs = Math.round(performance.now() - started);
    return persist({
      id, createdAt, kind: "tts", status: "success", provider: "openai", model: request.model,
      systemPrompt: request.systemPrompt, userPrompt: request.userPrompt, finalPrompt: request.userPrompt,
      parameters: { ...sanitizeCustom(request.customParameters, SPEECH_PROTECTED_FIELDS), ...request.parameters },
      timings: { apiMs, imageReadyMs: 0, saveMs, totalMs }, usage: {}, images: [], audio,
      speechMetrics: {
        timeToFirstByteMs,
        characterCount: request.userPrompt.length,
        charactersPerSecond: apiMs > 0 ? request.userPrompt.length * 1_000 / apiMs : undefined,
      },
      responseSummary: { contentType: response.headers.get("content-type"), audioBytes: bytes.byteLength },
    }, request.key);
  } catch (error) {
    const totalMs = Math.round(performance.now() - started);
    return persist({
      id, createdAt, kind: "tts", status: "error", provider: "openai", model: request.model,
      systemPrompt: request.systemPrompt, userPrompt: request.userPrompt, finalPrompt: request.userPrompt,
      parameters: { ...sanitizeCustom(request.customParameters, SPEECH_PROTECTED_FIELDS), ...request.parameters },
      timings: { apiMs: apiMs || totalMs, imageReadyMs: 0, saveMs, totalMs }, usage: {}, images: [],
      speechMetrics: { timeToFirstByteMs, characterCount: request.userPrompt.length },
      error: safeError(error, [request.key]),
    }, request.key);
  }
}
