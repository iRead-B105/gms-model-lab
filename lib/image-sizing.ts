import type { Provider } from "@/lib/types";

export const IMAGE_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;
type ExplicitImageAspectRatio = typeof IMAGE_ASPECT_RATIOS[number];
export type ImageAspectRatio = "auto" | ExplicitImageAspectRatio;
export type ImageSizePreset = { value: string; label: string };

export const IMAGE_ASPECT_RATIO_LABELS: Record<ImageAspectRatio, string> = {
  "auto": "자동 · 공급자 기본값",
  "1:1": "1:1 · 정사각형", "2:3": "2:3 · 세로 포스터", "3:2": "3:2 · 가로 사진", "3:4": "3:4 · 세로 콘텐츠",
  "4:3": "4:3 · 프레젠테이션", "4:5": "4:5 · SNS 피드", "5:4": "5:4 · 가로 피드", "9:16": "9:16 · 쇼츠/스토리",
  "16:9": "16:9 · 영상/배너", "21:9": "21:9 · 울트라와이드",
};

const OPENAI_FLEXIBLE_PRESETS: Record<ExplicitImageAspectRatio, ImageSizePreset[]> = {
  "1:1": [{ value: "1024x1024", label: "1024×1024 · SNS 정사각형" }, { value: "2048x2048", label: "2048×2048 · 2K 정사각형" }],
  "2:3": [{ value: "1024x1536", label: "1024×1536 · 세로 포스터" }, { value: "1536x2304", label: "1536×2304 · 고해상도 세로" }],
  "3:2": [{ value: "1536x1024", label: "1536×1024 · 가로 콘텐츠" }, { value: "2304x1536", label: "2304×1536 · 고해상도 가로" }],
  "3:4": [{ value: "960x1280", label: "960×1280 · 세로 콘텐츠" }, { value: "1536x2048", label: "1536×2048 · 2K 세로" }],
  "4:3": [{ value: "1280x960", label: "1280×960 · 프레젠테이션" }, { value: "2048x1536", label: "2048×1536 · 2K 가로" }],
  "4:5": [{ value: "1024x1280", label: "1024×1280 · SNS 피드" }, { value: "1536x1920", label: "1536×1920 · 고해상도 피드" }],
  "5:4": [{ value: "1280x1024", label: "1280×1024 · 가로 피드" }, { value: "1920x1536", label: "1920×1536 · 고해상도 가로" }],
  "9:16": [{ value: "1152x2048", label: "1152×2048 · 세로 숏폼" }, { value: "2160x3840", label: "2160×3840 · 4K 세로" }],
  "16:9": [{ value: "2048x1152", label: "2048×1152 · 2K 영상/배너" }, { value: "3840x2160", label: "3840×2160 · 4K UHD" }],
  "21:9": [{ value: "1792x768", label: "1792×768 · 울트라와이드 배너" }, { value: "2688x1152", label: "2688×1152 · 고해상도 울트라와이드" }],
};

const OPENAI_LEGACY_PRESETS: Partial<Record<ImageAspectRatio, ImageSizePreset[]>> = {
  "1:1": [{ value: "1024x1024", label: "1024×1024 · 정사각형" }],
  "2:3": [{ value: "1024x1536", label: "1024×1536 · 세로" }],
  "3:2": [{ value: "1536x1024", label: "1536×1024 · 가로" }],
};

const GEMINI_25_RESOLUTIONS: Record<ExplicitImageAspectRatio, string> = {
  "1:1": "1024x1024", "2:3": "832x1248", "3:2": "1248x832", "3:4": "864x1184", "4:3": "1184x864",
  "4:5": "896x1152", "5:4": "1152x896", "9:16": "768x1344", "16:9": "1344x768", "21:9": "1536x672",
};

export function supportsFlexibleOpenAISizes(model: string) {
  return /^gpt-image-2(?:$|-)/i.test(model);
}

export function getImageAspectRatios(provider: Provider, model: string): ImageAspectRatio[] {
  if (provider !== "openai" || supportsFlexibleOpenAISizes(model)) return ["auto", ...IMAGE_ASPECT_RATIOS];
  if (/dall-e-2/i.test(model)) return ["auto", "1:1"];
  return ["auto", "1:1", "2:3", "3:2"];
}

export function getImageSizePresets(provider: Provider, model: string, aspectRatio: ImageAspectRatio): ImageSizePreset[] {
  if (aspectRatio === "auto") return [{ value: "auto", label: "자동 · 공급자 기본값" }];
  if (provider === "gemini") {
    if (!/gemini-2\.5-flash-image/i.test(model)) return [{ value: "auto", label: "모델 기본 해상도" }];
    const value = GEMINI_25_RESOLUTIONS[aspectRatio];
    return [{ value, label: `${value.replace("x", "×")} · 모델 기본 출력` }];
  }
  if (supportsFlexibleOpenAISizes(model)) return OPENAI_FLEXIBLE_PRESETS[aspectRatio];
  return OPENAI_LEGACY_PRESETS[aspectRatio] || OPENAI_LEGACY_PRESETS["1:1"]!;
}

export function findAspectRatioForSize(provider: Provider, model: string, size: string): ImageAspectRatio {
  if (size === "auto") return "auto";
  for (const ratio of getImageAspectRatios(provider, model)) {
    if (getImageSizePresets(provider, model, ratio).some((preset) => preset.value === size)) return ratio;
  }
  return "auto";
}

export function isSupportedImageSize(provider: Provider, model: string, aspectRatio: ImageAspectRatio, size: string) {
  return getImageSizePresets(provider, model, aspectRatio).some((preset) => preset.value === size);
}
