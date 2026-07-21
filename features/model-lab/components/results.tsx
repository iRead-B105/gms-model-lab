import Image from "next/image";
import { Braces, Download, FileText, ImageIcon, LoaderCircle, Volume2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RunLog, TestKind } from "@/lib/types";
import { formatRate } from "@/features/model-lab/metrics";
import { formatCredit, formatDuration } from "@/features/model-lab/utils";

function Timing({ label, value, strong = false, suffix }: { label: string; value?: number; strong?: boolean; suffix?: string }) {
  return <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${strong ? "bg-slate-950 text-white" : "border border-slate-200"}`}><span className={`text-xs ${strong ? "text-slate-300" : "text-slate-500"}`}>{label}</span><b className="font-mono text-sm">{suffix || formatDuration(value)}</b></div>;
}

export function ImageResult({ run }: { run: RunLog | null }) {
  if (!run) return <EmptyState kind="image" />;
  const image = run.images[0];
  const imagesPerMinute = run.images.length && run.timings.totalMs > 0 ? run.images.length * 60_000 / run.timings.totalMs : undefined;

  return <><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_250px]"><div className="preview-grid relative grid min-h-[430px] place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">{image ? <Image src={image.url} alt="생성 결과" fill unoptimized sizes="(min-width: 1280px) 55vw, 100vw" className="object-contain" /> : <ErrorResult message={run.error} />}{run.status === "error" && image && <div className="absolute inset-x-3 bottom-3 rounded-lg bg-red-950/85 px-3 py-2 text-xs text-white">이미지는 저장됐지만 후속 처리 중 오류가 발생했습니다. {run.error}</div>}{run.images.length > 1 && <Badge className="absolute right-3 top-3 bg-white/90">+{run.images.length - 1}장</Badge>}</div><div className="space-y-3"><Timing label="전체 완료" value={run.timings.totalMs} strong /><Timing label="API 생성" value={run.timings.apiMs} /><Timing label="생성 이미지" suffix={`${run.images.length}장`} /><Timing label="이미지 처리량" suffix={formatRate(imagesPerMinute, "장/분")} /><UsageCard run={run} />{run.images.map((item, index) => <a key={item.filename} href={item.url} download={item.filename} className="flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download size={13} /> 이미지 {index + 1} 다운로드</a>)}</div></div><ResponseJsonCard run={run} /></>;
}

export function TextResult({ run, liveOutput }: { run: RunLog | null; liveOutput: string }) {
  const output = liveOutput || run?.outputText || "";
  if (!run && !liveOutput) return <EmptyState kind="text" />;
  const generationMs = run?.textMetrics?.ttftMs ? Math.max(0, run.timings.totalMs - run.textMetrics.ttftMs) : undefined;
  return <><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_250px]"><div className="relative min-h-[430px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-5 text-slate-100" aria-live="polite"><div className="mb-4 flex items-center gap-2 border-b border-slate-800 pb-3 text-[11px] uppercase tracking-widest text-slate-500"><span className={`h-2 w-2 rounded-full ${liveOutput ? "animate-pulse bg-emerald-400" : "bg-slate-600"}`} /> model output</div>{run?.status === "error" && !output ? <ErrorResult message={run.error} dark /> : <pre className="whitespace-pre-wrap font-sans text-sm leading-7">{output}<span className={liveOutput ? "ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-emerald-400 align-middle" : ""} /></pre>}</div><div className="space-y-3">{run ? <><Timing label="전체 완료" value={run.timings.totalMs} strong /><Timing label="첫 토큰 TTFT" value={run.textMetrics?.ttftMs} /><Timing label="첫 토큰 이후 생성" value={generationMs} /><Timing label="생성 속도" suffix={formatRate(run.textMetrics?.tokensPerSecond, "tok/s")} /><UsageCard run={run} /></> : <div className="rounded-xl border border-slate-200 p-4 text-xs leading-5 text-slate-500"><LoaderCircle className="mb-2 animate-spin" size={16} />응답을 스트리밍하고 있습니다.</div>}</div></div>{run && <ResponseJsonCard run={run} />}</>;
}

export function TtsResult({ run }: { run: RunLog | null }) {
  if (!run) return <EmptyState kind="tts" />;
  if (!run.audio) return <><div className="grid min-h-[430px] place-items-center rounded-xl border border-slate-200 bg-slate-50"><ErrorResult message={run.error} /></div><ResponseJsonCard run={run} /></>;
  const format = String(run.parameters.responseFormat || run.audio.filename.split(".").pop() || "audio").toUpperCase();
  return <><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_250px]">
    <div className="grid min-h-[430px] place-items-center rounded-xl border border-slate-800 bg-slate-950 p-8 text-white">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-400 text-slate-950"><Volume2 size={28} /></div>
        <p className="mt-5 text-sm font-semibold">{run.model} · {String(run.parameters.voice || "alloy")}</p>
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{run.userPrompt}</p>
        <audio className="mt-8 w-full" controls preload="metadata" src={run.audio.url}>이 브라우저는 오디오 재생을 지원하지 않습니다.</audio>
        <a href={run.audio.url} download={run.audio.filename} className="mx-auto mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800"><Download size={14} /> {format} 다운로드</a>
        {run.audio.mimeType === "audio/L16" && <p className="mt-3 text-[11px] text-amber-300">PCM은 브라우저에서 바로 재생되지 않을 수 있습니다. 다운로드 후 호환 플레이어를 사용하세요.</p>}
      </div>
    </div>
    <div className="space-y-3"><Timing label="전체 완료" value={run.timings.totalMs} strong /><Timing label="오디오 수신 완료" value={run.timings.apiMs} /><Timing label="첫 바이트 TTFB" value={run.speechMetrics?.timeToFirstByteMs} /><Timing label="입력 처리량" suffix={formatRate(run.speechMetrics?.charactersPerSecond, "자/초")} /><Timing label="오디오 크기" suffix={formatBytes(run.audio.bytes)} /><UsageCard run={run} /></div>
  </div><ResponseJsonCard run={run} /></>;
}

function formatBytes(value: number) {
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(2)} MB` : `${(value / 1024).toFixed(1)} KB`;
}

function UsageCard({ run }: { run: RunLog }) {
  const statusMessage = run.usage.creditMeasurementStatus === "unavailable"
    ? `GMS 차감 측정 실패${run.usage.creditMeasurementError ? ` · ${run.usage.creditMeasurementError}` : ""}`
    : run.usage.creditMeasurementStatus === "batch-only"
      ? "병렬 실행이라 차감 크레딧은 배치 단위로만 측정했습니다."
      : run.usage.creditMeasurementStatus === "measured"
        ? "실행 전후 GMS 잔액 차이로 측정했습니다."
        : "기존 기록에는 실행별 차감 측정 정보가 없습니다.";
  return <div className="rounded-xl border border-slate-200 p-3 text-xs"><p className="font-semibold text-slate-800">API 토큰 및 GMS 사용량</p><p className="mt-2 flex justify-between text-slate-500"><span>API Input / Output</span><b className="text-slate-800">{run.usage.inputTokens ?? "—"} / {run.usage.outputTokens ?? "—"}</b></p><p className="mt-1.5 flex justify-between text-slate-500"><span>GMS 사용 토큰</span><b className="text-slate-800">{run.usage.totalTokens === undefined ? "—" : `${run.usage.totalTokens.toLocaleString("ko-KR")} tok`}</b></p><p className="mt-1.5 flex justify-between text-slate-500"><span>GMS 차감 크레딧</span><b className="text-slate-800">{formatCredit(run.usage.actualCredit)}</b></p>{run.usage.estimatedCredit !== undefined && <p className="mt-1.5 flex justify-between text-slate-400"><span>참고 추정값</span><span>{formatCredit(run.usage.estimatedCredit)}</span></p>}<p className={`mt-2 border-t border-slate-100 pt-2 text-[11px] ${run.usage.creditMeasurementStatus === "unavailable" ? "text-amber-700" : "text-slate-400"}`}>{statusMessage}</p></div>;
}

function ResponseJsonCard({ run }: { run: RunLog }) {
  return <details className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-slate-700"><span className="flex items-center gap-2"><Braces size={14} /> 응답 결과 JSON</span><a href={`/api/logs/${encodeURIComponent(run.id)}?download=1`} download={`gms-run-${run.id}.json`} onClick={(event) => event.stopPropagation()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] hover:bg-slate-50"><Download size={12} /> JSON 다운로드</a></summary>
    <div className="border-t border-slate-100 p-3"><p className="mb-2 text-[11px] leading-5 text-slate-400">공급자 응답 요약과 로컬 측정·파일 정보를 함께 표시합니다. 이미지 Base64 원문은 파일로 저장하고 JSON에서는 생략합니다.</p><pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-5 text-slate-200">{JSON.stringify(run, null, 2)}</pre></div>
  </details>;
}

function ErrorResult({ message, dark = false }: { message?: string; dark?: boolean }) {
  return <div className="max-w-md px-8 text-center"><XCircle className={`mx-auto mb-3 ${dark ? "text-red-300" : "text-red-400"}`} /><p className="text-sm font-semibold">요청 실패</p><p className={`mt-2 text-xs leading-5 ${dark ? "text-slate-400" : "text-slate-500"}`}>{message || "알 수 없는 오류가 발생했습니다."}</p></div>;
}

function EmptyState({ kind }: { kind: TestKind }) {
  return <div className="grid min-h-[430px] place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm">{kind === "image" ? <ImageIcon size={20} /> : kind === "tts" ? <Volume2 size={20} /> : <FileText size={20} />}</div><p className="mt-4 text-sm font-semibold">아직 생성 결과가 없습니다</p><p className="mt-1 text-xs text-slate-400">왼쪽에서 모델과 프롬프트를 설정해 테스트하세요.</p></div></div>;
}

export function LatencyChart({ logs, selectedId, onSelect, kind }: { logs: RunLog[]; selectedId: string | null; onSelect: (id: string) => void; kind: TestKind }) {
  const recent = logs.filter((run) => run.status === "success").slice(0, 12).reverse();
  const max = Math.max(...recent.map((run) => run.timings.totalMs), 1);
  if (!recent.length) return <div className="grid h-28 place-items-center text-xs text-slate-400">기록이 쌓이면 추이를 표시합니다.</div>;
  return <><div className="flex h-28 items-end gap-2 pt-4">{recent.map((run) => {
    const secondary = kind === "text" ? run.textMetrics?.ttftMs : kind === "tts" ? run.speechMetrics?.timeToFirstByteMs : run.timings.apiMs;
    const secondaryLabel = kind === "text" ? "TTFT" : kind === "tts" ? "첫 바이트" : "API 생성";
    return <button type="button" key={run.id} onClick={() => onSelect(run.id)} className={`group relative min-w-0 flex-1 rounded-t transition-colors ${selectedId === run.id ? "bg-slate-950" : "bg-slate-200 hover:bg-slate-400"}`} style={{ height: `${Math.max(8, (run.timings.totalMs / max) * 100)}%` }} aria-label={`${run.model} 전체 ${formatDuration(run.timings.totalMs)}, ${secondaryLabel} ${formatDuration(secondary)}`}>{secondary && run.timings.totalMs > 0 ? <span className="absolute inset-x-0 bottom-0 rounded-t bg-emerald-400" style={{ height: `${Math.max(4, (secondary / run.timings.totalMs) * 100)}%` }} /> : null}<span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-[10px] text-white group-hover:block">{formatDuration(run.timings.totalMs)}</span></button>;
  })}</div><div className="mt-3 flex justify-end gap-3 text-[11px] text-slate-400"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-400" /> {kind === "text" ? "TTFT" : kind === "tts" ? "첫 바이트" : "API 생성"}</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-slate-300" /> 전체 완료</span></div></>;
}
