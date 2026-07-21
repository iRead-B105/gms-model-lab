export type Provider = "openai" | "gemini" | "anthropic";
export type ImageProvider = Exclude<Provider, "anthropic">;
export type TestKind = "image" | "text" | "tts";

export type CreditRate = { input: number; output: number; source: string };

export type ModelInfo = {
  id: string;
  provider: Provider;
  label: string;
  description: string;
  rate?: CreditRate;
  listedCredit?: number;
  discovered?: boolean;
};

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCredit?: number;
};

export type RunTimings = { apiMs: number; imageReadyMs: number; saveMs: number; totalMs: number };

export type RunLog = {
  id: string;
  createdAt: string;
  kind?: TestKind;
  status: "success" | "error";
  provider: Provider;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  finalPrompt: string;
  parameters: Record<string, unknown>;
  timings: RunTimings;
  usage: Usage;
  images: Array<{ filename: string; mimeType: string; bytes: number; url: string }>;
  audio?: { filename: string; mimeType: string; bytes: number; url: string };
  outputText?: string;
  textMetrics?: { ttftMs: number; tokensPerSecond?: number; characterCount: number };
  speechMetrics?: { timeToFirstByteMs?: number; characterCount: number; charactersPerSecond?: number };
  responseSummary?: Record<string, unknown>;
  errorCode?: string;
  error?: string;
};

export type GenerateRequest = {
  key: string;
  provider: ImageProvider;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  parameters: Record<string, unknown>;
  customParameters?: Record<string, unknown>;
};

export type TextGenerateRequest = {
  key: string;
  provider: Provider;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  parameters: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    reasoningEffort?: string;
    stopSequences?: string[];
  };
  customParameters?: Record<string, unknown>;
};

export type TtsGenerateRequest = {
  key: string;
  provider: "openai";
  model: string;
  systemPrompt: string;
  userPrompt: string;
  parameters: {
    voice: TtsVoice;
    responseFormat: TtsResponseFormat;
    speed: number;
  };
  customParameters?: Record<string, unknown>;
};

export const TTS_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"] as const;
export type TtsVoice = typeof TTS_VOICES[number];

export const TTS_RESPONSE_FORMATS = ["mp3", "opus", "aac", "flac", "wav", "pcm"] as const;
export type TtsResponseFormat = typeof TTS_RESPONSE_FORMATS[number];
