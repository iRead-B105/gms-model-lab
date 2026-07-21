import type { ImageProvider, Provider } from "@/lib/types";

export type ImageParameterDefaults = {
  aspectRatio: "auto";
  size: "auto";
  quality: "auto";
  background: "auto";
  outputFormat: "png";
  compression: 100;
  moderation: "auto";
  imageCount: 1;
  temperature?: number;
  topP?: number;
};

export type TextParameterDefaults = {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  reasoningEffort: "";
  maxTokensFallback: number;
  temperatureFallback: number;
  topPFallback: number;
  description: string;
};

export const TTS_PARAMETER_DEFAULTS = {
  voice: "alloy",
  responseFormat: "mp3",
  speed: 1,
} as const;

/**
 * `undefined` means that the option is intentionally omitted so the provider
 * can apply the selected model's own default. Keep this distinction when
 * building API payloads instead of replacing it with an application-wide
 * numeric guess.
 */
export function getImageParameterDefaults(provider: ImageProvider, _model: string): ImageParameterDefaults {
  void _model;
  if (provider === "openai") {
    return {
      aspectRatio: "auto",
      size: "auto",
      quality: "auto",
      background: "auto",
      outputFormat: "png",
      compression: 100,
      moderation: "auto",
      imageCount: 1,
    };
  }

  return {
    aspectRatio: "auto",
    size: "auto",
    quality: "auto",
    background: "auto",
    outputFormat: "png",
    compression: 100,
    moderation: "auto",
    imageCount: 1,
    temperature: undefined,
    topP: undefined,
  };
}

export function getTextParameterDefaults(provider: Provider, _model: string): TextParameterDefaults {
  void _model;
  if (provider === "anthropic") {
    return {
      // Anthropic requires max_tokens and does not define an API default.
      // 1024 follows the GMS Quick Start supplied for Claude Opus 4.1.
      maxTokens: 1024,
      temperature: undefined,
      topP: undefined,
      reasoningEffort: "",
      maxTokensFallback: 1024,
      temperatureFallback: 1,
      topPFallback: 0.999,
      description: "Temperature와 Top P는 Claude 기본값을 사용합니다. 필수 항목인 최대 출력 토큰은 GMS 예제값 1,024를 적용합니다.",
    };
  }

  return {
    maxTokens: undefined,
    temperature: undefined,
    topP: undefined,
    reasoningEffort: "",
    maxTokensFallback: 1024,
    temperatureFallback: 1,
    topPFallback: 1,
    description: provider === "gemini"
      ? "최대 출력 토큰과 샘플링 값은 전송하지 않아 선택한 Gemini 모델의 기본값을 사용합니다."
      : "최대 출력 토큰과 샘플링 값은 전송하지 않아 선택한 OpenAI 모델의 기본값을 사용합니다.",
  };
}
