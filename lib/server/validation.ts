import { TTS_RESPONSE_FORMATS, TTS_VOICES, type GenerateRequest, type ImageProvider, type Provider, type TextGenerateRequest, type TtsGenerateRequest } from "@/lib/types";
import { isRecord, type JsonObject } from "@/lib/server/gms/common";
import { getImageAspectRatios, getImageSizePresets, supportsFlexibleOpenAISizes, type ImageAspectRatio } from "@/lib/image-sizing";

const MAX_BODY_BYTES = 256 * 1024;
const PROVIDERS: Provider[] = ["openai", "gemini", "anthropic"];
const IMAGE_PROVIDERS: ImageProvider[] = ["openai", "gemini"];

export class RequestValidationError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export async function readRequestJson(request: Request): Promise<JsonObject> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new RequestValidationError("요청 본문이 너무 큽니다.", 413);
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new RequestValidationError("요청 본문이 너무 큽니다.", 413);
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new RequestValidationError("JSON 요청 형식이 올바르지 않습니다."); }
  if (!isRecord(value)) throw new RequestValidationError("요청 본문은 JSON 객체여야 합니다.");
  return value;
}

function requiredString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) throw new RequestValidationError(`${label}을(를) 입력해주세요.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new RequestValidationError(`${label}은(는) ${maxLength.toLocaleString()}자 이하여야 합니다.`);
  return trimmed;
}

function optionalString(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new RequestValidationError(`${label} 형식이 올바르지 않습니다.`);
  if (value.length > maxLength) throw new RequestValidationError(`${label}은(는) ${maxLength.toLocaleString()}자 이하여야 합니다.`);
  return value;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new RequestValidationError(`${label} 값이 올바르지 않습니다.`);
  return value as T;
}

function numberValue(value: unknown, label: string, min: number, max: number, fallback?: number) {
  if ((value === undefined || value === null) && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new RequestValidationError(`${label}은(는) ${min}~${max} 범위여야 합니다.`);
  return value;
}

function optionalNumberValue(value: unknown, label: string, min: number, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return numberValue(value, label, min, max);
}

function integerValue(value: unknown, label: string, min: number, max: number, fallback?: number) {
  const result = numberValue(value, label, min, max, fallback);
  if (!Number.isInteger(result)) throw new RequestValidationError(`${label}은(는) 정수여야 합니다.`);
  return result;
}

function modelValue(value: unknown) {
  const model = requiredString(value, "모델", 200);
  if (!/^[a-zA-Z0-9._:/-]+$/.test(model)) throw new RequestValidationError("모델 ID에 허용되지 않은 문자가 포함되어 있습니다.");
  return model;
}

function customValue(value: unknown) {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new RequestValidationError("추가 파라미터는 JSON 객체여야 합니다.");
  return value;
}

export function parseKeyBody(body: JsonObject) {
  return { key: requiredString(body.key, "GMS 키", 512) };
}

export function parseImageBody(body: JsonObject): GenerateRequest {
  const provider = enumValue(body.provider, IMAGE_PROVIDERS, "이미지 공급자");
  const model = modelValue(body.model);
  const rawParameters = isRecord(body.parameters) ? body.parameters : {};
  const aspectRatio = enumValue(rawParameters.aspectRatio ?? "auto", getImageAspectRatios(provider, model), "화면 비율") as ImageAspectRatio;
  const sizePresets = getImageSizePresets(provider, model, aspectRatio);
  const size = enumValue(rawParameters.size ?? sizePresets[0].value, sizePresets.map((preset) => preset.value), "이미지 크기");
  const parameters: JsonObject = provider === "openai" ? {
    aspectRatio,
    size,
    quality: enumValue(rawParameters.quality ?? "auto", ["auto", "low", "medium", "high"], "품질"),
    background: enumValue(rawParameters.background ?? "auto", supportsFlexibleOpenAISizes(model) ? ["auto", "opaque"] : ["auto", "opaque", "transparent"], "배경"),
    output_format: enumValue(rawParameters.output_format ?? "png", ["png", "webp", "jpeg"], "출력 형식"),
    output_compression: integerValue(rawParameters.output_compression, "압축률", 0, 100, 100),
    moderation: enumValue(rawParameters.moderation ?? "auto", ["auto", "low"], "모더레이션"),
    n: integerValue(rawParameters.n, "이미지 수", 1, 4, 1),
  } : (() => {
    const temperature = optionalNumberValue(rawParameters.temperature, "Temperature", 0, 2);
    const topP = optionalNumberValue(rawParameters.topP, "Top P", 0, 1);
    return {
      aspectRatio,
      size,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(topP !== undefined ? { topP } : {}),
    };
  })();
  return {
    key: requiredString(body.key, "GMS 키", 512),
    provider,
    model,
    systemPrompt: optionalString(body.systemPrompt, "시스템 프롬프트", 20_000),
    userPrompt: requiredString(body.userPrompt, "사용자 프롬프트", 100_000),
    parameters,
    customParameters: customValue(body.customParameters),
  };
}

export function parseTextBody(body: JsonObject): TextGenerateRequest {
  const provider = enumValue(body.provider, PROVIDERS, "텍스트 공급자");
  const model = modelValue(body.model);
  const rawParameters = isRecord(body.parameters) ? body.parameters : {};
  const rawStops = rawParameters.stopSequences;
  const stopSequences = rawStops === undefined ? [] : Array.isArray(rawStops) && rawStops.length <= 20 && rawStops.every((item) => typeof item === "string" && item.length <= 1000)
    ? rawStops as string[]
    : (() => { throw new RequestValidationError("Stop sequence는 1,000자 이하 문자열을 최대 20개까지 사용할 수 있습니다."); })();
  const effort = rawParameters.reasoningEffort === undefined || rawParameters.reasoningEffort === "" ? "" : enumValue(rawParameters.reasoningEffort, ["low", "medium", "high", "xhigh", "max"], "Reasoning effort");
  const maxTokens = rawParameters.maxTokens === undefined || rawParameters.maxTokens === null || rawParameters.maxTokens === ""
    ? provider === "anthropic" ? 1024 : undefined
    : integerValue(rawParameters.maxTokens, "최대 출력 토큰", 1, 32_000);
  const temperature = optionalNumberValue(rawParameters.temperature, "Temperature", 0, provider === "anthropic" ? 1 : 2);
  const topP = optionalNumberValue(rawParameters.topP, "Top P", 0, 1);
  return {
    key: requiredString(body.key, "GMS 키", 512),
    provider,
    model,
    systemPrompt: optionalString(body.systemPrompt, "시스템 프롬프트", 20_000),
    userPrompt: requiredString(body.userPrompt, "사용자 프롬프트", 100_000),
    parameters: {
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(topP !== undefined ? { topP } : {}),
      reasoningEffort: effort || undefined,
      stopSequences,
    },
    customParameters: customValue(body.customParameters),
  };
}

export function parseTtsBody(body: JsonObject): TtsGenerateRequest {
  const rawParameters = isRecord(body.parameters) ? body.parameters : {};
  const provider = enumValue(body.provider ?? "openai", ["openai"] as const, "음성 공급자");
  return {
    key: requiredString(body.key, "GMS 키", 512),
    provider,
    model: modelValue(body.model),
    systemPrompt: optionalString(body.systemPrompt, "음성 지시문", 4_000),
    // The model limit is 2,000 input tokens. 8,000 characters is a conservative
    // local guard; the provider remains the authority for exact tokenization.
    userPrompt: requiredString(body.userPrompt, "합성할 텍스트", 8_000),
    parameters: {
      voice: enumValue(rawParameters.voice ?? "alloy", TTS_VOICES, "보이스"),
      responseFormat: enumValue(rawParameters.responseFormat ?? "mp3", TTS_RESPONSE_FORMATS, "응답 포맷"),
      speed: numberValue(rawParameters.speed, "재생 속도", 0.25, 4, 1),
    },
    customParameters: customValue(body.customParameters),
  };
}

export function validationResponse(error: unknown) {
  const status = error instanceof RequestValidationError ? error.status : 500;
  const message = error instanceof RequestValidationError ? error.message : "요청을 처리하는 중 오류가 발생했습니다.";
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
