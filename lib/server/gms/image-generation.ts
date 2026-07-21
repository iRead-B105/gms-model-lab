/* eslint-disable @typescript-eslint/no-explicit-any -- Image responses vary by provider and model. */
import type { GenerateRequest, RunLog, Usage } from "@/lib/types";
import { calculateUsage, fetchWithTimeout, GMS_URLS, readJsonResponse, safeError, sanitizeCustom, TIMEOUTS, usageCount } from "@/lib/server/gms/common";
import { saveImage, saveRun } from "@/lib/server/storage/run-store";
import { contextBytes, persistContextImages } from "@/lib/server/context-images";

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const IMAGE_PROTECTED_FIELDS = ["model", "prompt", "contents", "systemInstruction"];

async function persist(run: RunLog, key: string) {
  try { await saveRun(run); return run; }
  catch (error) {
    return { ...run, status: "error" as const, error: `${run.error ? `${run.error} · ` : ""}로컬 로그 저장 실패: ${safeError(error, [key])}` };
  }
}

function decodeBase64(value: string) {
  if (value.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4) throw new Error("생성 이미지가 허용된 최대 크기(50MB)를 초과했습니다.");
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("생성 이미지 데이터가 비어 있거나 너무 큽니다.");
  return new Uint8Array(bytes);
}

async function downloadImage(urlValue: string, signal?: AbortSignal) {
  let url: URL;
  try { url = new URL(urlValue); } catch { throw new Error("GMS가 올바르지 않은 이미지 URL을 반환했습니다."); }
  if (url.protocol !== "https:") throw new Error("HTTPS 이미지 URL만 다운로드할 수 있습니다.");
  const response = await fetchWithTimeout(url.toString(), { signal }, TIMEOUTS.imageDownload);
  if (!response.ok) throw new Error(`생성 이미지 다운로드 실패: ${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_IMAGE_BYTES) throw new Error("생성 이미지가 허용된 최대 크기(50MB)를 초과했습니다.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("다운로드한 이미지가 비어 있거나 너무 큽니다.");
  return { bytes, mimeType: response.headers.get("content-type") || "image/png" };
}

export async function generateImage(request: GenerateRequest, signal?: AbortSignal): Promise<RunLog> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const overallStarted = performance.now();
  const finalPrompt = request.userPrompt;
  let apiMs = 0;
  let imageReadyMs = 0;
  let saveMs = 0;
  let responseSummary: Record<string, unknown> | undefined;
  const savedImages: RunLog["images"] = [];
  let storedContextImages: NonNullable<RunLog["contextImages"]> = [];

  try {
    const apiStarted = performance.now();
    let payloads: Array<{ bytes: Uint8Array; mimeType: string }> = [];
    let usage: Usage = {};

    const contextSaveStarted = performance.now();
    storedContextImages = await persistContextImages(id, request.contextImages);
    saveMs += Math.round(performance.now() - contextSaveStarted);

    if (request.provider === "openai") {
      const prompt = request.systemPrompt ? `${request.systemPrompt.trim()}\n\n${finalPrompt}` : finalPrompt;
      const apiParameters = Object.fromEntries(Object.entries(request.parameters).filter(([name]) => name !== "aspectRatio"));
      const response = request.contextImages?.length
        ? await (() => {
          const form = new FormData();
          form.append("model", request.model);
          form.append("prompt", prompt);
          for (const [name, value] of Object.entries({ ...sanitizeCustom(request.customParameters, IMAGE_PROTECTED_FIELDS), ...apiParameters })) {
            if (value !== undefined && value !== null) form.append(name, typeof value === "object" ? JSON.stringify(value) : String(value));
          }
          for (const image of request.contextImages || []) form.append("image[]", new Blob([contextBytes(image)], { type: image.mimeType }), image.name);
          return fetchWithTimeout(`${GMS_URLS.openaiBase}/images/edits`, {
            method: "POST", signal, headers: { Authorization: `Bearer ${request.key}` }, body: form,
          }, TIMEOUTS.imageGeneration);
        })()
        : await fetchWithTimeout(`${GMS_URLS.openaiBase}/images/generations`, {
          method: "POST", signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${request.key}` },
          body: JSON.stringify({ ...sanitizeCustom(request.customParameters, IMAGE_PROTECTED_FIELDS), model: request.model, prompt, ...apiParameters }),
        }, TIMEOUTS.imageGeneration);
      const body = await readJsonResponse(response);
      apiMs = Math.round(performance.now() - apiStarted);
      const items = Array.isArray(body.data) ? body.data : [];
      for (const item of items as any[]) {
        if (typeof item.b64_json === "string") payloads.push({ bytes: decodeBase64(item.b64_json), mimeType: `image/${request.parameters.output_format || "png"}` });
        else if (typeof item.url === "string") payloads.push(await downloadImage(item.url, signal));
      }
      const apiUsage = body.usage as any;
      usage = calculateUsage("image", request.model, usageCount(apiUsage?.input_tokens), usageCount(apiUsage?.output_tokens), usageCount(apiUsage?.total_tokens));
      responseSummary = { endpoint: request.contextImages?.length ? "images/edits" : "images/generations", created: body.created, imageCount: items.length, data: items.map((item: any) => ({ ...item, ...(item.b64_json ? { b64_json: `[이미지 Base64 ${item.b64_json.length.toLocaleString("ko-KR")}자 생략]` } : {}) })), usage: apiUsage || null };
    } else {
      const temperature = typeof request.parameters.temperature === "number" ? request.parameters.temperature : undefined;
      const topP = typeof request.parameters.topP === "number" ? request.parameters.topP : undefined;
      const aspectRatio = request.parameters.aspectRatio;
      const response = await fetchWithTimeout(`${GMS_URLS.geminiBase}/models/${encodeURIComponent(request.model)}:generateContent`, {
        method: "POST", signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": request.key },
        body: JSON.stringify({
          ...sanitizeCustom(request.customParameters, IMAGE_PROTECTED_FIELDS),
          ...(request.systemPrompt ? { systemInstruction: { parts: [{ text: request.systemPrompt }] } } : {}),
          contents: [{ parts: [...(request.contextImages || []).map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.base64 } })), { text: finalPrompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            ...(typeof aspectRatio === "string" && aspectRatio !== "auto" ? { imageConfig: { aspectRatio } } : {}),
            ...(temperature !== undefined ? { temperature } : {}),
            ...(topP !== undefined ? { topP } : {}),
          },
        }),
      }, TIMEOUTS.imageGeneration);
      const body = await readJsonResponse(response);
      apiMs = Math.round(performance.now() - apiStarted);
      const candidates = Array.isArray(body.candidates) ? body.candidates : [];
      const parts = candidates.flatMap((candidate: any) => candidate.content?.parts || []);
      payloads = parts.filter((part: any) => typeof part.inlineData?.data === "string").map((part: any) => ({ bytes: decodeBase64(part.inlineData.data), mimeType: part.inlineData.mimeType || "image/png" }));
      const meta = (body.usageMetadata || {}) as any;
      usage = calculateUsage("image", request.model, usageCount(meta.promptTokenCount), usageCount(meta.candidatesTokenCount), usageCount(meta.totalTokenCount));
      responseSummary = { responseId: body.responseId, modelVersion: body.modelVersion, finishReasons: candidates.map((candidate: any) => candidate.finishReason).filter(Boolean), imageCount: payloads.length, candidates: candidates.map((candidate: any) => ({ ...candidate, content: candidate.content ? { ...candidate.content, parts: (candidate.content.parts || []).map((part: any) => part.inlineData?.data ? { ...part, inlineData: { ...part.inlineData, data: `[이미지 Base64 ${part.inlineData.data.length.toLocaleString("ko-KR")}자 생략]` } } : part) } : undefined })), usageMetadata: meta };
    }

    imageReadyMs = Math.round(performance.now() - overallStarted);
    if (!payloads.length) throw new Error("응답에서 이미지 데이터를 찾지 못했습니다.");
    const saveStarted = performance.now();
    for (let index = 0; index < payloads.length; index += 1) savedImages.push(await saveImage(id, index, payloads[index].bytes, payloads[index].mimeType));
    saveMs += Math.round(performance.now() - saveStarted);
    return persist({
      id, createdAt, kind: "image", status: "success", provider: request.provider, model: request.model,
      systemPrompt: request.systemPrompt, userPrompt: request.userPrompt, finalPrompt,
      parameters: { ...sanitizeCustom(request.customParameters, IMAGE_PROTECTED_FIELDS), ...request.parameters },
      timings: { apiMs, imageReadyMs, saveMs, totalMs: Math.round(performance.now() - overallStarted) },
      usage, images: savedImages, contextImages: storedContextImages, responseSummary,
    }, request.key);
  } catch (error) {
    const finishReasons = Array.isArray(responseSummary?.finishReasons) ? responseSummary.finishReasons : [];
    const noImage = finishReasons.includes("NO_IMAGE");
    return persist({
      id, createdAt, kind: "image", status: "error", provider: request.provider, model: request.model,
      systemPrompt: request.systemPrompt, userPrompt: request.userPrompt, finalPrompt,
      parameters: { ...sanitizeCustom(request.customParameters, IMAGE_PROTECTED_FIELDS), ...request.parameters },
      timings: { apiMs, imageReadyMs, saveMs, totalMs: Math.round(performance.now() - overallStarted) },
      usage: {}, images: savedImages, contextImages: storedContextImages, responseSummary,
      errorCode: noImage ? "NO_IMAGE" : undefined,
      error: noImage
        ? "Gemini가 이미지를 생성하지 않고 NO_IMAGE로 종료했습니다. 시스템 프롬프트가 ‘이미지 생성 프롬프트를 작성해 텍스트로 출력’하도록 요구하면 이미지 전용 응답과 충돌합니다. 이 경우 텍스트 탭에서 프롬프트를 먼저 만든 뒤, 완성된 이미지 묘사만 이미지 탭에 입력하세요. 안전 정책이나 서로 충돌하는 지시도 함께 확인해주세요."
        : safeError(error, [request.key]),
    }, request.key);
  }
}
