"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, BarChart3, Check, ChevronDown, Clock3, Code2, Copy, Download,
  Eye, EyeOff, FileText, History, ImageIcon, KeyRound, LoaderCircle, Play,
  RefreshCcw, Save, Search, Sparkles, Square, Trash2, Volume2, WalletCards, WandSparkles, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TTS_RESPONSE_FORMATS, TTS_VOICES, type ModelInfo, type Provider, type RunLog, type TestKind, type TtsResponseFormat, type TtsVoice } from "@/lib/types";
import { KNOWN_IMAGE_MODELS, KNOWN_TEXT_MODELS, KNOWN_TTS_MODELS } from "@/lib/model-catalog";
import { findAspectRatioForSize, getImageAspectRatios, getImageSizePresets, IMAGE_ASPECT_RATIO_LABELS, supportsFlexibleOpenAISizes, type ImageAspectRatio } from "@/lib/image-sizing";
import { getImageParameterDefaults, getTextParameterDefaults, TTS_PARAMETER_DEFAULTS } from "@/lib/model-defaults";
import { looksLikePromptAuthoringInstruction } from "@/lib/prompt-intent";
import { Field, labelClass, Metric, ModeButton, Panel } from "@/features/model-lab/components/layout";
import { ModelSelector } from "@/features/model-lab/components/model-selector";
import { DefaultableNumber, DefaultableRange, type OptionalNumber } from "@/features/model-lab/components/parameter-control";
import { RequestValueSummary, type RequestValueRow } from "@/features/model-lab/components/request-value-summary";
import { ImageResult, LatencyChart, TextResult, TtsResult } from "@/features/model-lab/components/results";
import { calculateBenchmarkStats, formatRate } from "@/features/model-lab/metrics";
import { csvCell, formatCredit as credit, formatDuration as ms, providerName, readJsonResponse, runCredit, runKind } from "@/features/model-lab/utils";
import { readStoredGmsKey, removeStoredGmsKey, saveStoredGmsKey } from "@/features/model-lab/key-storage";

type CreditInfo = { totalCredit: number; usedCredit: number; remainCredit: number; expiredDate: string };
const imagePromptDefault = "A cinematic product photo of a translucent smart speaker on a brushed steel desk, soft morning light, realistic reflections, editorial photography, ultra detailed.";
const textPromptDefault = "실무에서 생성형 AI 모델의 응답 지연시간을 비교할 때 확인해야 할 핵심 지표를 5가지로 정리해줘.";
const ttsPromptDefault = "안녕하세요. GMS 음성 합성 모델의 응답 속도와 음질을 테스트하고 있습니다.";
const initialImageDefaults = getImageParameterDefaults("openai", "gpt-image-2");
const initialTextDefaults = getTextParameterDefaults("openai", "gpt-4.1");

export default function Home() {
  const [mode, setMode] = useState<TestKind>("image");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [imageModels, setImageModels] = useState<ModelInfo[]>(KNOWN_IMAGE_MODELS);
  const [textModels, setTextModels] = useState<ModelInfo[]>(KNOWN_TEXT_MODELS);
  const [ttsModels, setTtsModels] = useState<ModelInfo[]>(KNOWN_TTS_MODELS);
  const [imageModelKey, setImageModelKey] = useState("openai:gpt-image-2");
  const [textModelKey, setTextModelKey] = useState("openai:gpt-4.1");
  const [ttsModelKey, setTtsModelKey] = useState("openai:gpt-4o-mini-tts");
  const [imageSystemPrompt, setImageSystemPrompt] = useState("Create one production-ready image. Follow the user's composition, lighting, material, and text placement instructions exactly.");
  const [imagePrompt, setImagePrompt] = useState(imagePromptDefault);
  const [textSystemPrompt, setTextSystemPrompt] = useState("정확하고 명료하게 답변하세요. 필요한 경우 구조화된 목록을 사용하세요.");
  const [textPrompt, setTextPrompt] = useState(textPromptDefault);
  const [ttsInstructions, setTtsInstructions] = useState("차분하고 자연스러운 한국어 발음으로 읽어주세요.");
  const [ttsPrompt, setTtsPrompt] = useState(ttsPromptDefault);
  const [ttsVoice, setTtsVoice] = useState<TtsVoice>(TTS_PARAMETER_DEFAULTS.voice);
  const [ttsResponseFormat, setTtsResponseFormat] = useState<TtsResponseFormat>(TTS_PARAMETER_DEFAULTS.responseFormat);
  const [ttsSpeed, setTtsSpeed] = useState<number>(TTS_PARAMETER_DEFAULTS.speed);
  const [repeat, setRepeat] = useState(1);
  const [concurrency, setConcurrency] = useState(1);
  const [size, setSize] = useState<string>(initialImageDefaults.size);
  const [quality, setQuality] = useState<string>(initialImageDefaults.quality);
  const [background, setBackground] = useState<string>(initialImageDefaults.background);
  const [outputFormat, setOutputFormat] = useState<string>(initialImageDefaults.outputFormat);
  const [compression, setCompression] = useState<number>(initialImageDefaults.compression);
  const [moderation, setModeration] = useState<string>(initialImageDefaults.moderation);
  const [imageCount, setImageCount] = useState<number>(initialImageDefaults.imageCount);
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>(initialImageDefaults.aspectRatio);
  const [imageTemperature, setImageTemperature] = useState<OptionalNumber>(initialImageDefaults.temperature ?? "");
  const [imageTopP, setImageTopP] = useState<OptionalNumber>(initialImageDefaults.topP ?? "");
  const [textTemperature, setTextTemperature] = useState<OptionalNumber>(initialTextDefaults.temperature ?? "");
  const [textTopP, setTextTopP] = useState<OptionalNumber>(initialTextDefaults.topP ?? "");
  const [maxTokens, setMaxTokens] = useState<OptionalNumber>(initialTextDefaults.maxTokens ?? "");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [stopSequences, setStopSequences] = useState("");
  const [customJson, setCustomJson] = useState("{}");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [notice, setNotice] = useState("");
  const [liveOutput, setLiveOutput] = useState("");
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [lastBatchCredit, setLastBatchCredit] = useState<number | null>(null);
  const [checkingKey, setCheckingKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const runAbortRef = useRef<AbortController | null>(null);

  const models = mode === "image" ? imageModels : mode === "tts" ? ttsModels : textModels;
  const modelKey = mode === "image" ? imageModelKey : mode === "tts" ? ttsModelKey : textModelKey;
  const selectedModel = models.find((model) => `${model.provider}:${model.id}` === modelKey) || models[0];
  const modelId = selectedModel?.id || "";
  const provider: Provider = selectedModel?.provider || "openai";
  const textDefaults = getTextParameterDefaults(provider, modelId);
  const imageAspectRatios = getImageAspectRatios(provider, modelId);
  const effectiveAspectRatio = imageAspectRatios.includes(aspectRatio as ImageAspectRatio) ? aspectRatio as ImageAspectRatio : imageAspectRatios[0];
  const imageSizePresets = getImageSizePresets(provider, modelId, effectiveAspectRatio);
  const effectiveSize = imageSizePresets.some((preset) => preset.value === size) ? size : imageSizePresets[0].value;
  const effectiveBackground = supportsFlexibleOpenAISizes(modelId) && background === "transparent" ? "auto" : background;
  const modeLogs = useMemo(() => logs.filter((run) => runKind(run) === mode), [logs, mode]);
  const benchmarkLogs = useMemo(() => modeLogs.filter((run) => run.provider === provider && run.model === modelId), [modeLogs, provider, modelId]);
  const selected = modeLogs.find((run) => run.id === selectedId) || modeLogs[0] || null;
  const imagePromptConflict = mode === "image" && looksLikePromptAuthoringInstruction(imageSystemPrompt);

  const loadLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/logs", { cache: "no-store" });
      const nextLogs = await readJsonResponse<RunLog[] | { error?: string }>(response);
      if (!response.ok || !Array.isArray(nextLogs)) {
        throw new Error(!Array.isArray(nextLogs) && nextLogs.error ? nextLogs.error : "로컬 기록을 불러오지 못했습니다.");
      }
      setLogs(nextLogs);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "로컬 기록을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLogs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedKey = readStoredGmsKey();
        if (storedKey) {
          setKey(storedKey);
          setHasStoredKey(true);
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "저장된 GMS 키를 불러오지 못했습니다.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => runAbortRef.current?.abort(), []);

  const stats = useMemo(() => calculateBenchmarkStats(benchmarkLogs, mode), [benchmarkLogs, mode]);

  const filteredLogs = useMemo(() => modeLogs.filter((run) => {
    const matchesStatus = statusFilter === "all" || run.status === statusFilter;
    const content = `${run.model} ${run.userPrompt} ${run.systemPrompt} ${run.outputText || ""}`.toLowerCase();
    return matchesStatus && content.includes(search.toLowerCase());
  }), [modeLogs, search, statusFilter]);

  function changeMode(next: TestKind) {
    if (running) return;
    setMode(next);
    setSelectedId(logs.find((run) => runKind(run) === next)?.id || null);
    setLiveOutput("");
    setLastBatchCredit(null);
    setNotice("");
  }

  function resetImageParameters(nextProvider: Provider, nextModel: string) {
    if (nextProvider === "anthropic") return;
    const defaults = getImageParameterDefaults(nextProvider, nextModel);
    setAspectRatio(defaults.aspectRatio);
    setSize(defaults.size);
    setQuality(defaults.quality);
    setBackground(defaults.background);
    setOutputFormat(defaults.outputFormat);
    setCompression(defaults.compression);
    setModeration(defaults.moderation);
    setImageCount(defaults.imageCount);
    setImageTemperature(defaults.temperature ?? "");
    setImageTopP(defaults.topP ?? "");
  }

  function resetTextParameters(nextProvider: Provider, nextModel: string) {
    const defaults = getTextParameterDefaults(nextProvider, nextModel);
    setMaxTokens(defaults.maxTokens ?? "");
    setTextTemperature(defaults.temperature ?? "");
    setTextTopP(defaults.topP ?? "");
    setReasoningEffort(defaults.reasoningEffort);
    setStopSequences("");
  }

  function resetTtsParameters() {
    setTtsVoice(TTS_PARAMETER_DEFAULTS.voice);
    setTtsResponseFormat(TTS_PARAMETER_DEFAULTS.responseFormat);
    setTtsSpeed(TTS_PARAMETER_DEFAULTS.speed);
  }

  function selectModel(value: string) {
    const separator = value.indexOf(":");
    const nextProvider = value.slice(0, separator) as Provider;
    const nextModel = value.slice(separator + 1);
    if (!nextModel || !["openai", "gemini", "anthropic"].includes(nextProvider)) return;
    setLastBatchCredit(null);
    if (mode === "image") {
      setImageModelKey(value);
      resetImageParameters(nextProvider, nextModel);
    } else if (mode === "text") {
      setTextModelKey(value);
      resetTextParameters(nextProvider, nextModel);
    } else {
      setTtsModelKey(value);
      resetTtsParameters();
    }
  }

  async function fetchCredit() {
    const response = await fetch("/api/key-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    const body = await readJsonResponse<CreditInfo & { error?: string }>(response);
    if (!response.ok) throw new Error(body.error || "키 확인 실패");
    setCreditInfo(body);
    return body as CreditInfo;
  }

  async function checkKey() {
    if (!key.trim()) return setNotice("GMS 키를 먼저 입력해주세요.");
    setCheckingKey(true); setNotice("");
    try {
      const [creditBody, modelResponse] = await Promise.all([
        fetchCredit(),
        fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) }),
      ]);
      const modelBody = await readJsonResponse<{ imageModels?: ModelInfo[]; textModels?: ModelInfo[]; ttsModels?: ModelInfo[]; warnings?: string[]; error?: string }>(modelResponse);
      if (!modelResponse.ok) throw new Error(modelBody.error || "모델 목록 조회 실패");
      if (Array.isArray(modelBody.imageModels)) setImageModels(modelBody.imageModels);
      if (Array.isArray(modelBody.textModels)) setTextModels((current) => {
        const merged = new Map(modelBody.textModels!.map((model) => [`${model.provider}:${model.id}`, model]));
        for (const model of current) if (!merged.has(`${model.provider}:${model.id}`)) merged.set(`${model.provider}:${model.id}`, model);
        return [...merged.values()];
      });
      if (Array.isArray(modelBody.ttsModels)) setTtsModels(modelBody.ttsModels);
      const warning = modelBody.warnings?.length ? ` · 일부 제공자 조회 실패: ${modelBody.warnings.join(", ")}` : "";
      setNotice(`키 확인 완료 · 이미지 ${modelBody.imageModels?.length || KNOWN_IMAGE_MODELS.length}개 · 텍스트 ${modelBody.textModels?.length || KNOWN_TEXT_MODELS.length}개 · TTS ${modelBody.ttsModels?.length || KNOWN_TTS_MODELS.length}개 · 잔여 ${credit(creditBody.remainCredit)}${warning}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "키 확인 실패"); }
    finally { setCheckingKey(false); }
  }

  function saveKeyLocally() {
    try {
      saveStoredGmsKey(key);
      setKey(key.trim());
      setHasStoredKey(true);
      setNotice("GMS 키를 이 브라우저에 저장했습니다. 공용 PC에서는 사용하지 마세요.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "GMS 키를 저장하지 못했습니다.");
    }
  }

  function deleteStoredKey() {
    try {
      removeStoredGmsKey();
      setHasStoredKey(false);
      setNotice("브라우저에 저장된 GMS 키를 삭제했습니다. 현재 입력값은 유지됩니다.");
    } catch {
      setNotice("브라우저에 저장된 GMS 키를 삭제하지 못했습니다.");
    }
  }

  function imageParameters() {
    return provider === "openai"
      ? { aspectRatio: effectiveAspectRatio, size: effectiveSize, quality, background: effectiveBackground, output_format: outputFormat, output_compression: compression, moderation, n: imageCount }
      : {
        aspectRatio: effectiveAspectRatio,
        size: effectiveSize,
        ...(imageTemperature !== "" ? { temperature: imageTemperature } : {}),
        ...(imageTopP !== "" ? { topP: imageTopP } : {}),
      };
  }

  function requestValueRows(): RequestValueRow[] {
    const omitted = (label: string, detail: string): RequestValueRow => ({ label, value: "전송 안 함", detail });
    const sent = (label: string, value: string | number, detail = "현재 값으로 API 요청에 포함됩니다."): RequestValueRow => ({ label, value: typeof value === "string" ? `"${value}"` : String(value), detail });

    if (mode === "tts") return [
      sent("voice", ttsVoice),
      sent("response_format", ttsResponseFormat),
      sent("speed", ttsSpeed),
      ttsInstructions.trim() ? sent("instructions", "입력한 음성 지시문", "지시문 전문이 API 요청에 포함됩니다.") : omitted("instructions", "지시문이 비어 있어 필드를 생략합니다."),
    ];

    if (mode === "text") {
      const reasoningActive = provider === "openai" && Boolean(reasoningEffort);
      const rows = [
        maxTokens === "" ? omitted(provider === "openai" ? "max_output_tokens" : "max_tokens", "선택 모델의 공급자 기본 출력 한도를 사용합니다.") : sent(provider === "openai" ? "max_output_tokens" : "max_tokens", maxTokens),
        textTemperature === "" || reasoningActive ? omitted("temperature", reasoningActive ? "OpenAI reasoning 모드에서는 이 값을 보내지 않습니다." : "선택 모델의 공급자 기본값을 사용합니다.") : sent("temperature", textTemperature),
        textTopP === "" || reasoningActive ? omitted(provider === "gemini" ? "topP" : "top_p", reasoningActive ? "OpenAI reasoning 모드에서는 이 값을 보내지 않습니다." : "선택 모델의 공급자 기본값을 사용합니다.") : sent(provider === "gemini" ? "topP" : "top_p", textTopP),
      ];
      if (provider === "openai") rows.push(reasoningEffort ? sent("reasoning.effort", reasoningEffort) : omitted("reasoning", "추론 강도를 지정하지 않습니다."));
      else rows.push(stopSequences.trim() ? sent(provider === "gemini" ? "stopSequences" : "stop_sequences", "입력한 목록", "빈 줄을 제외한 목록을 API 요청에 포함합니다.") : omitted(provider === "gemini" ? "stopSequences" : "stop_sequences", "중지 문자열을 지정하지 않습니다."));
      return rows;
    }

    if (provider === "openai") return [
      omitted("aspectRatio", "OpenAI 요청에는 별도 비율 필드를 보내지 않고 size로 제어합니다."),
      sent("size", effectiveSize, effectiveSize === "auto" ? "auto를 전달해 모델이 출력 크기를 선택합니다." : "선택한 비율 프리셋의 정확한 픽셀 크기입니다."),
      sent("quality", quality, quality === "auto" ? "auto를 전달해 모델이 품질을 선택합니다." : "선택한 품질을 사용합니다."),
      sent("background", effectiveBackground, effectiveBackground === "auto" ? "auto를 전달해 모델이 배경 처리를 선택합니다." : "선택한 배경 처리를 사용합니다."),
      sent("output_format", outputFormat),
      sent("output_compression", compression),
      sent("moderation", moderation, moderation === "auto" ? "auto를 전달해 공급자 기본 모더레이션을 사용합니다." : "선택한 모더레이션 수준을 사용합니다."),
      sent("n", imageCount),
    ];

    return [
      effectiveAspectRatio === "auto" ? omitted("imageConfig.aspectRatio", "모델이 기본 이미지 비율을 선택합니다.") : sent("imageConfig.aspectRatio", effectiveAspectRatio),
      omitted("size", `화면의 ${effectiveSize} 표시는 예상 크기이며 Gemini 요청에는 픽셀 크기를 보내지 않습니다.`),
      imageTemperature === "" ? omitted("temperature", "선택 모델의 공급자 기본값을 사용합니다.") : sent("temperature", imageTemperature),
      imageTopP === "" ? omitted("topP", "선택 모델의 공급자 기본값을 사용합니다.") : sent("topP", imageTopP),
    ];
  }

  function changeImageAspectRatio(next: string) {
    const ratio = next as ImageAspectRatio;
    setAspectRatio(ratio);
    setSize(getImageSizePresets(provider, modelId, ratio)[0].value);
  }

  async function runImage(payload: Record<string, unknown>, signal: AbortSignal) {
    const response = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal,
    });
    const body = await readJsonResponse<RunLog & { error?: string }>(response);
    if (body.id) return body as RunLog;
    throw new Error(body.error || "이미지 생성 요청 실패");
  }

  async function runText(payload: Record<string, unknown>, showStream: boolean, signal: AbortSignal) {
    const response = await fetch("/api/text/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal,
    });
    if (!response.ok || !response.body) {
      const body = await readJsonResponse<{ error?: string }>(response);
      throw new Error(body.error || "텍스트 생성 요청 실패");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed: RunLog | null = null;
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      if (buffer.length > 2_000_000) throw new Error("스트리밍 응답이 허용 크기를 초과했습니다.");
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        const event = block.split(/\r?\n/).find((line) => line.startsWith("event:"))?.slice(6).trim();
        const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!data) continue;
        let eventPayload: unknown;
        try { eventPayload = JSON.parse(data); }
        catch { throw new Error("스트리밍 응답 형식이 올바르지 않습니다."); }
        if (!eventPayload || typeof eventPayload !== "object") continue;
        const parsed = eventPayload as { text?: string } & RunLog;
        if (event === "delta" && showStream && typeof parsed.text === "string") setLiveOutput((current) => current + parsed.text);
        if (event === "done" || event === "error") completed = parsed;
      }
      if (done) break;
    }
    if (!completed) throw new Error("스트리밍 응답이 완료되기 전에 종료되었습니다.");
    return completed;
  }

  async function runTts(payload: Record<string, unknown>, signal: AbortSignal) {
    const response = await fetch("/api/tts/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal,
    });
    const body = await readJsonResponse<RunLog & { error?: string }>(response);
    if (body.id) return body as RunLog;
    throw new Error(body.error || "음성 합성 요청 실패");
  }

  async function runTests() {
    const prompt = mode === "image" ? imagePrompt : mode === "tts" ? ttsPrompt : textPrompt;
    if (!key.trim()) return setNotice("GMS 키를 입력해주세요.");
    if (!prompt.trim()) return setNotice(mode === "tts" ? "합성할 텍스트를 입력해주세요." : "사용자 프롬프트를 입력해주세요.");
    if (mode === "image" && imagePromptConflict) {
      const proceed = window.confirm("현재 시스템 프롬프트는 이미지를 생성하는 대신 ‘이미지 생성 프롬프트 텍스트’를 출력하도록 요구합니다. Gemini 이미지 모델에서는 NO_IMAGE로 종료될 가능성이 높고 크레딧이 차감될 수 있습니다. 그래도 실행할까요?");
      if (!proceed) return setNotice("이미지 요청을 보내지 않았습니다. 이 지시는 텍스트 탭에서 실행하고, 완성된 이미지 묘사만 이미지 탭에 입력해주세요.");
    }
    let customParameters: Record<string, unknown>;
    try {
      customParameters = JSON.parse(customJson);
      if (!customParameters || Array.isArray(customParameters) || typeof customParameters !== "object") throw new Error();
    }
    catch { return setNotice("추가 JSON 파라미터 형식이 올바르지 않습니다."); }
    const requestMode = mode;
    const requestProvider = provider;
    const requestPayload = requestMode === "image"
      ? { key, provider: requestProvider, model: modelId, systemPrompt: imageSystemPrompt, userPrompt: imagePrompt, parameters: imageParameters(), customParameters }
      : requestMode === "text" ? {
        key,
        provider: requestProvider,
        model: modelId,
        systemPrompt: textSystemPrompt,
        userPrompt: textPrompt,
        parameters: {
          ...(maxTokens !== "" ? { maxTokens } : {}),
          ...(textTemperature !== "" ? { temperature: textTemperature } : {}),
          ...(textTopP !== "" ? { topP: textTopP } : {}),
          reasoningEffort: requestProvider === "openai" ? reasoningEffort : undefined,
          stopSequences: requestProvider === "openai" ? undefined : stopSequences.split("\n").map((value) => value.trim()).filter(Boolean),
        },
        customParameters,
      } : {
        key,
        provider: "openai",
        model: modelId,
        systemPrompt: ttsInstructions,
        userPrompt: ttsPrompt,
        parameters: { voice: ttsVoice, responseFormat: ttsResponseFormat, speed: ttsSpeed },
        customParameters,
      };
    const controller = new AbortController();
    runAbortRef.current = controller;
    setRunning(true); setNotice(""); setLiveOutput(""); setLastBatchCredit(null); setProgress({ done: 0, total: repeat });
    let beforeCredit = creditInfo?.remainCredit;
    if (beforeCredit === undefined) {
      try { beforeCredit = (await fetchCredit()).remainCredit; } catch { /* Token metrics can still be collected. */ }
    }
    let cursor = 0;
    const results: RunLog[] = [];
    const worker = async () => {
      while (cursor < repeat) {
        if (controller.signal.aborted) break;
        const index = cursor; cursor += 1;
        try {
          const result = requestMode === "image"
            ? await runImage(requestPayload, controller.signal)
            : requestMode === "text"
              ? await runText(requestPayload, index === 0, controller.signal)
              : await runTts(requestPayload, controller.signal);
          results.push(result);
        } catch (error) {
          if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "생성 요청 실패");
        }
        finally { setProgress((value) => ({ ...value, done: value.done + 1 })); }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(concurrency, repeat) }, () => worker()));
      await loadLogs();
      const latest = results.find((run) => run.status === "success") || results[0];
      if (latest) setSelectedId(latest.id);
      let consumed: number | null = null;
      if (!controller.signal.aborted) {
        try {
          const after = await fetchCredit();
          if (beforeCredit !== undefined) consumed = Math.max(0, beforeCredit - after.remainCredit);
          setLastBatchCredit(consumed);
        } catch { /* Generation result remains valid when balance refresh fails. */ }
      }
      const successes = results.filter((run) => run.status === "success").length;
      setNotice(controller.signal.aborted
        ? `테스트를 취소했습니다. 완료된 요청 ${results.length}개는 기록에 남아 있습니다.`
        : `${repeat}회 테스트 완료 · 성공 ${successes} · 실패 ${repeat - successes}${consumed !== null ? ` · 실제 차감 ${credit(consumed)}` : ""}`);
    } finally {
      runAbortRef.current = null;
      setRunning(false);
    }
  }

  function cancelTests() {
    runAbortRef.current?.abort();
    setNotice("진행 중인 요청을 취소하고 있습니다. 이미 GMS에 전달된 요청은 크레딧이 차감될 수 있습니다.");
  }

  function reuseRun(run: RunLog) {
    if (running) return;
    const kind = runKind(run); changeMode(kind);
    if (kind === "image") {
      setImageModels((current) => current.some((model) => model.id === run.model && model.provider === run.provider) ? current : [...current, { id: run.model, provider: run.provider, label: run.model, description: "로컬 기록에서 불러온 모델" }]);
      setImageModelKey(`${run.provider}:${run.model}`); setImageSystemPrompt(run.systemPrompt); setImagePrompt(run.userPrompt);
      const p = run.parameters;
      const savedSize = String(p.size || "auto");
      setAspectRatio(String(p.aspectRatio || findAspectRatioForSize(run.provider, run.model, savedSize)) as ImageAspectRatio); setSize(savedSize);
      if (run.provider === "openai") { setQuality(String(p.quality || "auto")); setBackground(String(p.background || "auto")); setOutputFormat(String(p.output_format || "png")); setCompression(Number(p.output_compression ?? 100)); setModeration(String(p.moderation || "auto")); setImageCount(Number(p.n || 1)); }
      else {
        setImageTemperature(typeof p.temperature === "number" ? p.temperature : "");
        setImageTopP(typeof p.topP === "number" ? p.topP : "");
      }
    } else if (kind === "text") {
      setTextModels((current) => current.some((model) => model.id === run.model && model.provider === run.provider) ? current : [...current, { id: run.model, provider: run.provider, label: run.model, description: "로컬 기록에서 불러온 모델" }]);
      setTextModelKey(`${run.provider}:${run.model}`); setTextSystemPrompt(run.systemPrompt); setTextPrompt(run.userPrompt);
      const defaults = getTextParameterDefaults(run.provider, run.model);
      setMaxTokens(typeof run.parameters.maxTokens === "number" ? run.parameters.maxTokens : defaults.maxTokens ?? "");
      setTextTemperature(typeof run.parameters.temperature === "number" ? run.parameters.temperature : "");
      setTextTopP(typeof run.parameters.topP === "number" ? run.parameters.topP : "");
      setReasoningEffort(String(run.parameters.reasoningEffort || ""));
      setStopSequences(Array.isArray(run.parameters.stopSequences) ? run.parameters.stopSequences.filter((value): value is string => typeof value === "string").join("\n") : "");
    } else {
      setTtsModels((current) => current.some((model) => model.id === run.model && model.provider === run.provider) ? current : [...current, { id: run.model, provider: run.provider, label: run.model, description: "로컬 기록에서 불러온 TTS 모델" }]);
      setTtsModelKey(`${run.provider}:${run.model}`);
      setTtsInstructions(run.systemPrompt);
      setTtsPrompt(run.userPrompt);
      setTtsVoice(TTS_VOICES.includes(run.parameters.voice as TtsVoice) ? run.parameters.voice as TtsVoice : TTS_PARAMETER_DEFAULTS.voice);
      setTtsResponseFormat(TTS_RESPONSE_FORMATS.includes(run.parameters.responseFormat as TtsResponseFormat) ? run.parameters.responseFormat as TtsResponseFormat : TTS_PARAMETER_DEFAULTS.responseFormat);
      setTtsSpeed(typeof run.parameters.speed === "number" ? run.parameters.speed : TTS_PARAMETER_DEFAULTS.speed);
    }
    setCustomJson("{}"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeRun(run: RunLog) {
    if (!window.confirm("이 실행 기록과 연결된 결과 파일을 로컬에서 삭제할까요?")) return;
    try {
      const response = await fetch(`/api/logs/${encodeURIComponent(run.id)}`, { method: "DELETE" });
      const body = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error || "기록을 삭제하지 못했습니다.");
      if (selectedId === run.id) setSelectedId(null);
      await loadLogs();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "기록을 삭제하지 못했습니다.");
    }
  }

  function exportLogs(format: "json" | "csv") {
    const data = format === "json" ? JSON.stringify(filteredLogs, null, 2) : [
      "id,kind,createdAt,status,provider,model,totalMs,apiMs,ttftMs,tokensPerSecond,imageCount,imagesPerMinute,speechTtfbMs,charactersPerSecond,audioBytes,inputTokens,outputTokens,estimatedCredit,prompt",
      ...filteredLogs.map((run) => [run.id, runKind(run), run.createdAt, run.status, run.provider, run.model, run.timings.totalMs, run.timings.apiMs, run.textMetrics?.ttftMs ?? "", run.textMetrics?.tokensPerSecond ?? "", run.images.length, run.images.length && run.timings.totalMs > 0 ? run.images.length * 60_000 / run.timings.totalMs : "", run.speechMetrics?.timeToFirstByteMs ?? "", run.speechMetrics?.charactersPerSecond ?? "", run.audio?.bytes ?? "", run.usage.inputTokens ?? "", run.usage.outputTokens ?? "", run.usage.estimatedCredit ?? "", run.userPrompt].map(csvCell).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([format === "csv" ? `\uFEFF${data}` : data], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `gms-model-lab-${mode}-${new Date().toISOString().slice(0, 10)}.${format}`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1520px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white"><Sparkles size={17} /></div><div><h1 className="text-sm font-bold tracking-tight">GMS Model Lab</h1><p className="text-[11px] text-slate-500">Multimodal latency & credit profiler</p></div></div>
          <div className="flex rounded-xl bg-slate-100 p-1" aria-label="테스트 모드">
            <ModeButton active={mode === "image"} disabled={running} onClick={() => changeMode("image")} icon={<ImageIcon size={14} />}>이미지</ModeButton>
            <ModeButton active={mode === "text"} disabled={running} onClick={() => changeMode("text")} icon={<FileText size={14} />}>텍스트</ModeButton>
            <ModeButton active={mode === "tts"} disabled={running} onClick={() => changeMode("tts")} icon={<Volume2 size={14} />}>TTS</ModeButton>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 로컬 모드 <Badge>{hasStoredKey ? "키 로컬 저장됨" : "키 저장 안 함"}</Badge></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1520px] px-4 py-6 sm:px-6">
        <section className="mb-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={<Clock3 size={16} />} label="전체 완료 P50" value={ms(stats.totalLatency.p50)} sub={`P95 ${ms(stats.totalLatency.p95)}`} />
          <Metric icon={<Activity size={16} />} label={mode === "text" ? "첫 토큰 P50" : mode === "tts" ? "첫 바이트 P50" : "API 생성 P50"} value={ms(mode === "text" ? stats.ttft.p50 : mode === "tts" ? stats.speechTtfb.p50 : stats.apiLatency.p50)} sub={`P95 ${ms(mode === "text" ? stats.ttft.p95 : mode === "tts" ? stats.speechTtfb.p95 : stats.apiLatency.p95)}`} />
          <Metric icon={<BarChart3 size={16} />} label={mode === "text" ? "생성 속도 P50" : mode === "tts" ? "입력 처리량 P50" : "이미지 처리량 P50"} value={formatRate(mode === "text" ? stats.tokenVelocity.p50 : mode === "tts" ? stats.characterThroughput.p50 : stats.imageThroughput.p50, mode === "text" ? "tok/s" : mode === "tts" ? "자/초" : "장/분")} sub={mode === "text" ? `출력 P50 ${stats.outputTokens.p50 === undefined ? "—" : Math.round(stats.outputTokens.p50).toLocaleString("ko-KR")} tok` : mode === "tts" ? `오디오 P50 ${stats.audioBytes.p50 === undefined ? "—" : `${(stats.audioBytes.p50 / 1024).toFixed(1)} KB`}` : `생성 ${stats.generatedImages}장`} />
          <Metric icon={<Check size={16} />} label="성공률" value={stats.attempts ? `${stats.successRate.toFixed(1)}%` : "—"} sub={`${stats.successes}/${stats.attempts}회 성공`} />
          <Metric icon={<WalletCards size={16} />} label={mode === "image" ? "크레딧/이미지" : mode === "tts" ? "크레딧/음성" : "크레딧/응답"} value={credit(stats.estimatedCreditPerUnit)} sub={lastBatchCredit !== null ? `최근 실제 차감 ${credit(lastBatchCredit)}` : `단가 확인 ${stats.estimatedCreditSamples}건`} />
        </section>
        <p className="mb-6 text-right text-[11px] leading-5 text-slate-400">선택한 모델의 기록만 집계합니다. P50은 일반적인 체감값, P95는 느린 구간입니다. P95는 최소 20회, 안정적인 비교는 100회 이상을 권장합니다.</p>

        <section className="grid items-start gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="space-y-5">
            <Panel title="접속 및 모델" icon={<KeyRound size={16} />} description={hasStoredKey ? "저장된 키를 이 브라우저에서 불러왔습니다." : "키를 현재 페이지에서만 사용하거나 브라우저에 저장할 수 있습니다."}>
              <div className="relative"><Input type={showKey ? "text" : "password"} value={key} onChange={(event) => setKey(event.target.value)} placeholder="GMS Key를 입력하세요" className="pr-10 font-mono" autoComplete="off" maxLength={512} disabled={running || checkingKey} /><button type="button" disabled={running} onClick={() => setShowKey((value) => !value)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 disabled:opacity-40" aria-label="키 표시 전환">{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
              <Button variant="outline" className="mt-2 w-full" onClick={checkKey} disabled={checkingKey || running}>{checkingKey ? <LoaderCircle className="animate-spin" size={15} /> : <RefreshCcw size={15} />} 키·전체 모델 확인</Button>
              <div className={`mt-2 grid gap-2 ${hasStoredKey ? "grid-cols-2" : "grid-cols-1"}`}>
                <Button variant="outline" onClick={saveKeyLocally} disabled={!key.trim() || checkingKey || running}><Save size={14} /> {hasStoredKey ? "저장 키 덮어쓰기" : "이 브라우저에 키 저장"}</Button>
                {hasStoredKey && <Button variant="danger" onClick={deleteStoredKey} disabled={checkingKey || running}><Trash2 size={14} /> 저장 키 삭제</Button>}
              </div>
              <p className="mt-2 text-[11px] leading-5 text-amber-700">저장한 키는 이 브라우저의 암호화되지 않은 로컬 저장소에 보관됩니다. 공용 PC나 공유 계정에서는 저장하지 마세요.</p>
              <ModelSelector mode={mode} models={models} value={modelKey} disabled={running} onChange={selectModel} onAddTextModel={(model) => setTextModels((current) => current.some((item) => item.id === model.id && item.provider === model.provider) ? current : [...current, model])} />
              {selectedModel && <div className="mt-3 min-w-0 overflow-visible rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex min-w-0 items-start justify-between gap-2"><span className="min-w-0 break-words text-xs font-semibold leading-5">{selectedModel.description}</span>{selectedModel.discovered && <Badge>동적 조회</Badge>}</div><div className="mt-2 grid min-w-0 grid-cols-1 gap-2 text-xs text-slate-500"><span className="min-w-0 break-words">GMS 표기 크레딧 <b className="text-slate-800">{selectedModel.listedCredit === undefined ? "미등록" : `${selectedModel.listedCredit.toLocaleString("ko-KR")} Credit`}</b></span>{creditInfo && <><span>잔여 <b className="text-slate-800">{credit(creditInfo.remainCredit)}</b></span><span>사용 <b className="text-slate-800">{credit(creditInfo.usedCredit)}</b></span></>}</div><p className="mt-2 break-words text-[11px] leading-5 text-slate-400">표기 크레딧은 GMS 모델 안내 값입니다. 청구 단위가 확인되지 않아 예상 비용에는 넣지 않고, 실행 전후 실제 잔액 차이를 별도로 표시합니다.</p></div>}
            </Panel>

            <Panel title="프롬프트" icon={<WandSparkles size={16} />} description="시스템 지시와 사용자 요청을 분리해 기록합니다.">
              <label className={labelClass}>{mode === "tts" ? "음성 지시문" : "시스템 프롬프트"}</label><Textarea value={mode === "image" ? imageSystemPrompt : mode === "tts" ? ttsInstructions : textSystemPrompt} onChange={(event) => mode === "image" ? setImageSystemPrompt(event.target.value) : mode === "tts" ? setTtsInstructions(event.target.value) : setTextSystemPrompt(event.target.value)} className="min-h-28" />
              {imagePromptConflict && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800" role="alert"><b>NO_IMAGE 가능성이 높은 지시입니다.</b> 이미지 탭은 이미지 파일을 직접 생성합니다. “프롬프트만 출력”하는 작업은 텍스트 탭에서 실행한 뒤 결과를 이미지 설명으로 사용해주세요.</div>}
              <label className={`${labelClass} mt-4`}>{mode === "tts" ? "합성할 텍스트" : "사용자 프롬프트"}</label><Textarea value={mode === "image" ? imagePrompt : mode === "tts" ? ttsPrompt : textPrompt} onChange={(event) => mode === "image" ? setImagePrompt(event.target.value) : mode === "tts" ? setTtsPrompt(event.target.value) : setTextPrompt(event.target.value)} className="min-h-36" maxLength={mode === "tts" ? 8000 : undefined} />
              {mode === "tts" && <p className="mt-2 text-right text-[11px] text-slate-400">{ttsPrompt.length.toLocaleString("ko-KR")} / 8,000자 · 모델 한도 2,000 토큰</p>}
            </Panel>

            <Panel title="생성 파라미터" icon={mode === "image" ? <ImageIcon size={16} /> : mode === "tts" ? <Volume2 size={16} /> : <Code2 size={16} />} description={`${providerName(provider)} ${mode === "image" ? "이미지" : mode === "tts" ? "음성 합성" : "스트리밍 텍스트"} 옵션`}>
              {mode === "tts" ? <div className="grid min-w-0 grid-cols-1 gap-4">
                <Field label="보이스"><Select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value as TtsVoice)}>{TTS_VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</Select></Field>
                <Field label="응답 포맷"><Select value={ttsResponseFormat} onChange={(e) => setTtsResponseFormat(e.target.value as TtsResponseFormat)}>{TTS_RESPONSE_FORMATS.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}</Select></Field>
                <Field label={`재생 속도 ${ttsSpeed.toFixed(2)}×`}><input className="range" type="range" min="0.25" max="4" step="0.05" value={ttsSpeed} onChange={(e) => setTtsSpeed(Number(e.target.value))} /></Field>
                <Field label="속도 직접 입력"><Input type="number" min="0.25" max="4" step="0.05" value={ttsSpeed} onChange={(e) => setTtsSpeed(Math.min(4, Math.max(0.25, Number(e.target.value) || 1)))} /></Field>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">기본값은 OpenAI Audio API 기준 alloy, MP3, 1.0×입니다. 음성 지시문은 GPT-4o mini TTS의 instructions로 전달됩니다.</p>
              </div> : mode === "text" ? <div className="grid min-w-0 grid-cols-1 gap-4">
                <DefaultableNumber label="최대 출력 토큰" min={1} max={32000} value={maxTokens} fallback={textDefaults.maxTokensFallback} onChange={setMaxTokens} />
                <DefaultableRange label="Temperature" min={0} max={provider === "anthropic" ? 1 : 2} step={0.05} value={textTemperature} fallback={textDefaults.temperatureFallback} onChange={setTextTemperature} />
                <DefaultableRange label="Top P" min={0} max={1} step={0.001} value={textTopP} fallback={textDefaults.topPFallback} onChange={setTextTopP} />
                {provider === "openai" && <Field label="Reasoning effort"><Select value={reasoningEffort} onChange={(e) => setReasoningEffort(e.target.value)}><option value="">사용 안 함 · 필드 생략</option><option>low</option><option>medium</option><option>high</option></Select></Field>}
                {provider !== "openai" && <div><label className={labelClass}>Stop sequences · 한 줄에 하나</label><Textarea value={stopSequences} onChange={(e) => setStopSequences(e.target.value)} className="min-h-20 font-mono text-xs" placeholder="선택 사항" /></div>}
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">{textDefaults.description}</p>
              </div> : <div className="grid min-w-0 grid-cols-1 gap-4">
                <Field label="이미지 비율"><Select value={effectiveAspectRatio} onChange={(e) => changeImageAspectRatio(e.target.value)}>{imageAspectRatios.map((ratio) => <option key={ratio} value={ratio}>{IMAGE_ASPECT_RATIO_LABELS[ratio]}</option>)}</Select></Field>
                <Field label="출력 크기"><Select value={effectiveSize} onChange={(e) => setSize(e.target.value)} disabled={imageSizePresets.length === 1}>{imageSizePresets.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}</Select></Field>
                {provider === "openai" ? <>
                  <Field label="품질"><Select value={quality} onChange={(e) => setQuality(e.target.value)}><option value="auto">auto · 모델이 품질 선택</option><option>low</option><option>medium</option><option>high</option></Select></Field>
                  <Field label="배경"><Select value={effectiveBackground} onChange={(e) => setBackground(e.target.value)}><option value="auto">auto · 모델이 배경 처리 선택</option><option>opaque</option>{!supportsFlexibleOpenAISizes(modelId) && <option>transparent</option>}</Select></Field>
                  <Field label="출력 포맷"><Select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}><option>png</option><option>webp</option><option>jpeg</option></Select></Field>
                  <Field label={`압축 ${compression}`}><input className="range" type="range" min="0" max="100" value={compression} onChange={(e) => setCompression(Number(e.target.value))} /></Field>
                  <Field label="이미지 수"><Input type="number" min="1" max="4" value={imageCount} onChange={(e) => setImageCount(Number(e.target.value))} /></Field>
                  <Field label="모더레이션"><Select value={moderation} onChange={(e) => setModeration(e.target.value)}><option value="auto">auto · 공급자 기본 정책</option><option>low</option></Select></Field>
                </> : <>
                  <DefaultableRange label="Temperature" min={0} max={2} step={0.05} value={imageTemperature} fallback={1} onChange={setImageTemperature} />
                  <DefaultableRange label="Top P" min={0} max={1} step={0.05} value={imageTopP} fallback={1} onChange={setImageTopP} />
                </>}
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">{effectiveAspectRatio === "auto" ? "자동 선택 시 아래 API 전달값에서 실제 처리 방식을 확인할 수 있습니다." : provider === "openai" ? "선택한 비율에서 API 제약을 만족하는 자주 쓰는 크기만 표시합니다. 고해상도는 생성 시간이 더 길어질 수 있습니다." : /gemini-2\.5-flash-image/i.test(modelId) ? "Gemini 2.5 Flash Image는 비율에 따라 출력 해상도가 정해지며, 예상 크기를 함께 표시합니다." : "이 모델은 비율을 지정하고 실제 해상도는 모델 기본값을 사용합니다."}</p>
              </div>}
              <RequestValueSummary rows={requestValueRows()} />
              <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={() => mode === "image" ? resetImageParameters(provider, modelId) : mode === "tts" ? resetTtsParameters() : resetTextParameters(provider, modelId)}><RefreshCcw size={13} /> 공급자 기본값으로 복원</Button>
              <button className="mt-4 flex w-full items-center justify-between border-t border-slate-100 pt-4 text-left text-xs font-semibold text-slate-600" onClick={() => setAdvancedOpen((value) => !value)}>추가 JSON 파라미터 <ChevronDown size={15} className={advancedOpen ? "rotate-180" : ""} /></button>
              {advancedOpen && <div className="mt-3"><Textarea value={customJson} onChange={(e) => setCustomJson(e.target.value)} className="min-h-24 font-mono text-xs" spellCheck={false} /><p className="mt-1.5 text-[11px] text-slate-400">인증 및 핵심 라우팅 필드는 덮어쓸 수 없습니다.</p></div>}
            </Panel>

            <Panel title="테스트 실행" icon={<Play size={16} />}>
              <div className="grid grid-cols-2 gap-3"><Field label="반복 횟수"><Input type="number" min="1" max="10" value={repeat} onChange={(e) => setRepeat(Math.min(10, Math.max(1, Number(e.target.value))))} /></Field><Field label="동시 요청"><Input type="number" min="1" max="4" value={concurrency} onChange={(e) => setConcurrency(Math.min(4, Math.max(1, Number(e.target.value))))} /></Field></div>
              <Button size="lg" className="mt-4 w-full" onClick={runTests} disabled={running}>{running ? <><LoaderCircle className="animate-spin" size={17} /> 생성 중 {progress.done}/{progress.total}</> : <><Sparkles size={17} /> {mode === "image" ? "이미지" : mode === "tts" ? "TTS" : "텍스트"} 테스트 시작</>}</Button>
              {running && <Button variant="outline" className="mt-2 w-full" onClick={cancelTests}><Square size={14} /> 요청 취소</Button>}
              {running && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>}
              {notice && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600" role="status" aria-live="polite">{notice}</p>}
            </Panel>
          </div>

          <div className="min-w-0 space-y-5 xl:sticky xl:top-20">
            <Panel title={mode === "image" ? "결과 미리보기" : mode === "tts" ? "음성 재생" : "스트리밍 응답"} icon={mode === "image" ? <ImageIcon size={16} /> : mode === "tts" ? <Volume2 size={16} /> : <FileText size={16} />} description={running && mode === "text" ? "첫 번째 요청을 실시간으로 표시 중" : selected ? `${selected.model} · ${new Date(selected.createdAt).toLocaleString("ko-KR")}` : "테스트를 실행하면 결과가 표시됩니다."} action={selected && <Button variant="outline" size="sm" onClick={() => reuseRun(selected)}><Copy size={13} /> 설정 불러오기</Button>}>
              {mode === "text" ? <TextResult run={running ? null : selected} liveOutput={running ? liveOutput : ""} /> : mode === "tts" ? <TtsResult run={selected} /> : <ImageResult run={selected} />}
            </Panel>
            <Panel title="최근 지연시간" icon={<BarChart3 size={16} />} description={`${modelId} 최근 성공 12회 · ${mode === "text" ? "전체 시간과 TTFT" : mode === "tts" ? "전체 시간과 첫 바이트" : "전체 시간과 API 생성"}`}>
              <LatencyChart logs={benchmarkLogs} selectedId={selectedId} onSelect={setSelectedId} kind={mode} />
            </Panel>
          </div>
        </section>

        <section className="mt-5"><Panel title="로컬 테스트 기록" icon={<History size={16} />} description={`${mode === "image" ? "이미지" : mode === "tts" ? "TTS" : "텍스트"} ${modeLogs.length}개 · 전체 ${logs.length}개 기록`} action={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => exportLogs("csv")}><Download size={13} /> CSV</Button><Button variant="outline" size="sm" onClick={() => exportLogs("json")}>JSON</Button></div>}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="모델, 프롬프트 또는 응답 검색" className="pl-9" /></div><Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-36"><option value="all">모든 상태</option><option value="success">성공</option><option value="error">실패</option></Select></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-sm"><thead><tr className="border-y border-slate-100 text-[11px] uppercase tracking-wider text-slate-400"><th className="px-3 py-3 font-semibold">상태 / 시간</th><th className="px-3 py-3 font-semibold">모델</th><th className="px-3 py-3 font-semibold">프롬프트</th><th className="px-3 py-3 font-semibold">{mode === "text" ? "전체 / TTFT" : mode === "tts" ? "전체 / 첫 바이트" : "전체 / API"}</th><th className="px-3 py-3 font-semibold">{mode === "tts" ? "오디오 / 처리량" : "토큰 / 크레딧"}</th><th className="px-3 py-3 font-semibold text-right">작업</th></tr></thead><tbody>{filteredLogs.map((run) => <tr key={run.id} onClick={() => setSelectedId(run.id)} className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${selected?.id === run.id ? "bg-slate-50" : ""}`}><td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${run.status === "success" ? "text-emerald-700" : "text-red-600"}`}>{run.status === "success" ? <Check size={13} /> : <XCircle size={13} />}{run.status === "success" ? "성공" : "실패"}</span><p className="mt-1 text-[11px] text-slate-400">{new Date(run.createdAt).toLocaleString("ko-KR")}</p></td><td className="px-3 py-3"><p className="font-medium">{run.model}</p><p className="mt-1 text-xs text-slate-400">{providerName(run.provider)}</p></td><td className="max-w-sm px-3 py-3"><p className="truncate text-slate-600">{run.userPrompt}</p></td><td className="px-3 py-3 font-mono text-xs"><b>{ms(run.timings.totalMs)}</b><span className="mx-1 text-slate-300">/</span><span className="text-slate-500">{mode === "text" ? ms(run.textMetrics?.ttftMs) : mode === "tts" ? ms(run.speechMetrics?.timeToFirstByteMs) : ms(run.timings.apiMs)}</span></td><td className="px-3 py-3 font-mono text-xs">{mode === "tts" ? <><p>{run.audio ? `${(run.audio.bytes / 1024).toFixed(1)} KB` : "—"}</p><p className="mt-1 text-slate-400">{formatRate(run.speechMetrics?.charactersPerSecond, "자/초")}</p></> : <><p>{run.usage.inputTokens ?? "—"} / {run.usage.outputTokens ?? "—"}</p><p className="mt-1 text-slate-400">{credit(runCredit(run))}</p></>}</td><td className="px-3 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); reuseRun(run); }}><RefreshCcw size={13} /> 재사용</Button><Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); void removeRun(run); }} aria-label="기록 삭제"><Trash2 size={14} /></Button></div></td></tr>)}{!filteredLogs.length && <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">조건에 맞는 테스트 기록이 없습니다.</td></tr>}</tbody></table></div>
        </Panel></section>
        <footer className="py-8 text-center text-xs text-slate-400">GMS Model Lab · GMS 키는 사용자가 선택한 경우에만 브라우저에 저장되며 서버 로그에는 남기지 않습니다.</footer>
      </div>
    </main>
  );
}
