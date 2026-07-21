/* eslint-disable @typescript-eslint/no-explicit-any -- Streaming events are provider-defined JSON. */
import type { RunLog, TextGenerateRequest } from "@/lib/types";
import { calculateUsage, fetchWithTimeout, GMS_URLS, safeError, sanitizeCustom, TIMEOUTS, usageCount } from "@/lib/server/gms/common";
import { saveRun } from "@/lib/server/storage/run-store";

const MAX_SSE_FRAME_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_CHARACTERS = 2_000_000;
const PROTECTED_FIELDS = ["model", "stream", "input", "instructions", "messages", "contents", "system", "systemInstruction"];

async function ensureOk(response: Response) {
  if (response.ok && response.body) return;
  const text = await response.text();
  throw new Error(`GMS ${response.status}: ${text.slice(0, 1200)}`);
}

async function* readSse(response: Response): AsyncGenerator<Record<string, any>> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      if (Buffer.byteLength(buffer, "utf8") > MAX_SSE_FRAME_BYTES) throw new Error("스트리밍 응답 프레임이 너무 큽니다.");
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!data || data === "[DONE]") continue;
        try { yield JSON.parse(data); } catch { /* Keep-alive or non-JSON provider frame. */ }
      }
      if (done) break;
    }
    const data = buffer.trim().split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    if (data && data !== "[DONE]") try { yield JSON.parse(data); } catch { /* Ignore malformed tail. */ }
  } finally { reader.releaseLock(); }
}

async function openUpstream(request: TextGenerateRequest, signal: AbortSignal) {
  const safe = sanitizeCustom(request.customParameters, PROTECTED_FIELDS);
  const { maxTokens, temperature, topP, reasoningEffort, stopSequences } = request.parameters;
  if (request.provider === "openai") {
    return fetchWithTimeout(`${GMS_URLS.openaiBase}/responses`, {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${request.key}` },
      body: JSON.stringify({
        ...safe,
        model: request.model,
        instructions: request.systemPrompt || undefined,
        input: request.userPrompt,
        ...(maxTokens !== undefined ? { max_output_tokens: maxTokens } : {}),
        ...(!reasoningEffort && temperature !== undefined ? { temperature } : {}),
        ...(!reasoningEffort && topP !== undefined ? { top_p: topP } : {}),
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
        stream: true,
      }),
    }, TIMEOUTS.textGeneration);
  }
  if (request.provider === "anthropic") {
    return fetchWithTimeout(`${GMS_URLS.anthropicBase}/messages`, {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", "x-api-key": request.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        ...safe,
        model: request.model,
        system: request.systemPrompt || undefined,
        messages: [{ role: "user", content: request.userPrompt }],
        max_tokens: maxTokens ?? 1024,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(topP !== undefined ? { top_p: topP } : {}),
        ...(stopSequences?.length ? { stop_sequences: stopSequences } : {}),
        stream: true,
      }),
    }, TIMEOUTS.textGeneration);
  }
  const generationConfig = {
    ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(topP !== undefined ? { topP } : {}),
    ...(stopSequences?.length ? { stopSequences } : {}),
  };
  return fetchWithTimeout(`${GMS_URLS.geminiBase}/models/${encodeURIComponent(request.model)}:streamGenerateContent?alt=sse`, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": request.key },
    body: JSON.stringify({
      ...safe,
      ...(request.systemPrompt ? { systemInstruction: { parts: [{ text: request.systemPrompt }] } } : {}),
      contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
      ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    }),
  }, TIMEOUTS.textGeneration);
}

function extractChunk(provider: TextGenerateRequest["provider"], event: Record<string, any>) {
  if (event.type === "error" || event.type === "response.failed" || event.error) throw new Error(typeof event.error?.message === "string" ? event.error.message : "공급자 스트림에서 오류가 발생했습니다.");
  if (provider === "openai") return {
    delta: event.type === "response.output_text.delta" ? String(event.delta || "") : "",
    inputTokens: usageCount(event.response?.usage?.input_tokens), outputTokens: usageCount(event.response?.usage?.output_tokens),
    summary: event.type === "response.completed" ? { responseId: event.response?.id, status: event.response?.status } : undefined,
  };
  if (provider === "anthropic") return {
    delta: event.type === "content_block_delta" && event.delta?.type === "text_delta" ? String(event.delta.text || "") : "",
    inputTokens: usageCount(event.message?.usage?.input_tokens), outputTokens: usageCount(event.usage?.output_tokens),
    summary: event.type === "message_delta" ? { stopReason: event.delta?.stop_reason || null } : undefined,
  };
  const candidates = Array.isArray(event.candidates) ? event.candidates : [];
  const parts = candidates.flatMap((candidate: any) => candidate.content?.parts || []);
  const meta = event.usageMetadata || {};
  return {
    delta: parts.filter((part: any) => typeof part.text === "string").map((part: any) => part.text).join(""),
    inputTokens: usageCount(meta.promptTokenCount), outputTokens: usageCount(meta.candidatesTokenCount),
    summary: candidates.length ? { finishReasons: candidates.map((candidate: any) => candidate.finishReason).filter(Boolean) } : undefined,
  };
}

async function persist(run: RunLog, key: string) {
  try { await saveRun(run); return run; }
  catch (error) { return { ...run, status: "error" as const, error: `${run.error ? `${run.error} · ` : ""}로컬 로그 저장 실패: ${safeError(error, [key])}` }; }
}

export function createTextStream(request: TextGenerateRequest, requestSignal?: AbortSignal) {
  const encoder = new TextEncoder();
  const localAbort = new AbortController();
  const signal = requestSignal ? AbortSignal.any([requestSignal, localAbort.signal]) : localAbort.signal;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const started = performance.now();
  let clientClosed = false;

  const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) => {
    if (clientClosed) return;
    try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); }
    catch { clientClosed = true; localAbort.abort(); }
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let outputText = "";
      let ttftMs = 0;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      let responseSummary: Record<string, unknown> | undefined;
      try {
        const upstream = await openUpstream(request, signal);
        await ensureOk(upstream);
        for await (const event of readSse(upstream)) {
          const chunk = extractChunk(request.provider, event);
          if (chunk.inputTokens !== undefined) inputTokens = chunk.inputTokens;
          if (chunk.outputTokens !== undefined) outputTokens = chunk.outputTokens;
          if (chunk.summary) responseSummary = chunk.summary;
          if (chunk.delta) {
            if (!ttftMs) ttftMs = Math.round(performance.now() - started);
            outputText += chunk.delta;
            if (outputText.length > MAX_OUTPUT_CHARACTERS) throw new Error("텍스트 응답이 로컬 저장 한도(200만 자)를 초과했습니다.");
            send(controller, "delta", { text: chunk.delta });
          }
        }
        if (!outputText.trim()) throw new Error("GMS 응답에서 텍스트를 찾지 못했습니다.");
        const totalMs = Math.round(performance.now() - started);
        const generationSeconds = Math.max(0.001, (totalMs - ttftMs) / 1000);
        const run = await persist({
          id, createdAt, kind: "text", status: "success", provider: request.provider, model: request.model,
          systemPrompt: request.systemPrompt, userPrompt: request.userPrompt, finalPrompt: request.userPrompt,
          parameters: { ...sanitizeCustom(request.customParameters, PROTECTED_FIELDS), ...request.parameters },
          timings: { apiMs: totalMs, imageReadyMs: 0, saveMs: 0, totalMs },
          usage: calculateUsage("text", request.model, inputTokens, outputTokens), images: [], outputText,
          textMetrics: { ttftMs, tokensPerSecond: outputTokens ? outputTokens / generationSeconds : undefined, characterCount: outputText.length }, responseSummary,
        }, request.key);
        send(controller, run.status === "success" ? "done" : "error", run);
      } catch (error) {
        const totalMs = Math.round(performance.now() - started);
        const run = await persist({
          id, createdAt, kind: "text", status: "error", provider: request.provider, model: request.model,
          systemPrompt: request.systemPrompt, userPrompt: request.userPrompt, finalPrompt: request.userPrompt,
          parameters: { ...sanitizeCustom(request.customParameters, PROTECTED_FIELDS), ...request.parameters },
          timings: { apiMs: totalMs, imageReadyMs: 0, saveMs: 0, totalMs },
          usage: calculateUsage("text", request.model, inputTokens, outputTokens), images: [], outputText,
          textMetrics: { ttftMs, characterCount: outputText.length }, responseSummary, error: safeError(error, [request.key]),
        }, request.key);
        send(controller, "error", run);
      } finally {
        if (!clientClosed) try { controller.close(); } catch { /* Client already disconnected. */ }
      }
    },
    cancel() { clientClosed = true; localAbort.abort(); },
  });
}
