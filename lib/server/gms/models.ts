/* eslint-disable @typescript-eslint/no-explicit-any -- Model catalogs are provider-defined JSON. */
import type { ModelInfo } from "@/lib/types";
import { KNOWN_IMAGE_MODELS, KNOWN_TEXT_MODELS, KNOWN_TTS_MODELS } from "@/lib/model-catalog";
import { fetchWithTimeout, GMS_URLS, readJsonResponse, safeError, TIMEOUTS } from "@/lib/server/gms/common";

export type ModelCatalog = { imageModels: ModelInfo[]; textModels: ModelInfo[]; ttsModels: ModelInfo[]; warnings: string[] };

export async function getKeyInfo(key: string, signal?: AbortSignal) {
  const response = await fetchWithTimeout(GMS_URLS.keyInfo, { headers: { Authorization: `Bearer ${key}` }, signal }, TIMEOUTS.metadata);
  const body = await readJsonResponse(response);
  const totalCredit = Number(body.totalCredit);
  const usedCredit = Number(body.usedCredit);
  const remainCredit = Number(body.remainCredit);
  if (![totalCredit, usedCredit, remainCredit].every(Number.isFinite)) {
    throw new Error("GMS 크레딧 응답 형식이 올바르지 않습니다.");
  }
  return {
    totalCredit,
    usedCredit,
    remainCredit,
    expiredDate: typeof body.expiredDate === "string" ? body.expiredDate : "",
  };
}

export async function discoverModels(key: string, signal?: AbortSignal): Promise<ModelCatalog> {
  const discoveredImages: ModelInfo[] = [];
  const discoveredText: ModelInfo[] = [];
  const discoveredTts: ModelInfo[] = [];
  const warnings: string[] = [];
  const requests = [
    { provider: "OpenAI", promise: fetchWithTimeout(`${GMS_URLS.openaiBase}/models`, { headers: { Authorization: `Bearer ${key}` }, signal }, TIMEOUTS.metadata).then(readJsonResponse) },
    { provider: "Gemini", promise: fetchWithTimeout(`${GMS_URLS.geminiBase}/models`, { headers: { "x-goog-api-key": key }, signal }, TIMEOUTS.metadata).then(readJsonResponse) },
    { provider: "Anthropic", promise: fetchWithTimeout(`${GMS_URLS.anthropicBase}/models`, { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, signal }, TIMEOUTS.metadata).then(readJsonResponse) },
  ];
  const results = await Promise.allSettled(requests.map((request) => request.promise));
  const [openai, gemini, anthropic] = results;
  results.forEach((result, index) => {
    if (result.status === "rejected") warnings.push(`${requests[index].provider} 모델 목록을 불러오지 못했습니다: ${safeError(result.reason, [key])}`);
  });

  if (openai.status === "fulfilled") {
    for (const item of Array.isArray(openai.value.data) ? openai.value.data : []) {
      const id = String((item as any).id || "");
      if (/tts|text-to-speech/i.test(id)) discoveredTts.push({ id, provider: "openai", label: id, description: "GMS 모델 API에서 조회된 음성 합성 모델", discovered: true });
      else if (/image|dall-e/i.test(id)) discoveredImages.push({ id, provider: "openai", label: id, description: "GMS 모델 API에서 조회됨", discovered: true });
      else if (id && !/embedding|whisper|tts|audio|transcri|moderation|realtime|sora|search|computer-use/i.test(id)) discoveredText.push({ id, provider: "openai", label: id, description: "GMS 모델 API에서 조회됨", discovered: true });
    }
  }
  if (gemini.status === "fulfilled") {
    for (const item of Array.isArray(gemini.value.models) ? gemini.value.models : []) {
      const id = String((item as any).name || "").replace(/^models\//, "");
      const methods = Array.isArray((item as any).supportedGenerationMethods) ? (item as any).supportedGenerationMethods : [];
      const model = { id, provider: "gemini" as const, label: (item as any).displayName || id, description: (item as any).description || "GMS 모델 API에서 조회됨", discovered: true };
      if (/image/i.test(id) && methods.includes("generateContent")) discoveredImages.push(model);
      else if (id && methods.includes("generateContent") && !/embedding|aqa|vision|robotics|tts|audio/i.test(id)) discoveredText.push(model);
    }
  }
  if (anthropic.status === "fulfilled") {
    for (const item of Array.isArray(anthropic.value.data) ? anthropic.value.data : []) {
      const id = String((item as any).id || "");
      if (id) discoveredText.push({ id, provider: "anthropic", label: (item as any).display_name || id, description: "GMS 모델 API에서 조회됨", discovered: true });
    }
  }

  const imageModels = new Map(KNOWN_IMAGE_MODELS.map((item) => [`${item.provider}:${item.id}`, item]));
  const textModels = new Map(KNOWN_TEXT_MODELS.map((item) => [`${item.provider}:${item.id}`, item]));
  const ttsModels = new Map(KNOWN_TTS_MODELS.map((item) => [`${item.provider}:${item.id}`, item]));
  for (const item of discoveredImages) imageModels.set(`${item.provider}:${item.id}`, { ...item, ...(imageModels.get(`${item.provider}:${item.id}`) || {}) });
  for (const item of discoveredText) textModels.set(`${item.provider}:${item.id}`, { ...item, ...(textModels.get(`${item.provider}:${item.id}`) || {}) });
  for (const item of discoveredTts) ttsModels.set(`${item.provider}:${item.id}`, { ...item, ...(ttsModels.get(`${item.provider}:${item.id}`) || {}) });
  return { imageModels: [...imageModels.values()], textModels: [...textModels.values()], ttsModels: [...ttsModels.values()], warnings };
}
