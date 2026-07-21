import type { RunLog, TestKind } from "@/lib/types";

type Distribution = { p50?: number; p95?: number };

export type BenchmarkStats = {
  attempts: number;
  successes: number;
  successRate: number;
  totalLatency: Distribution;
  apiLatency: Distribution;
  ttft: Distribution;
  tokenVelocity: Distribution;
  imageThroughput: Distribution;
  speechTtfb: Distribution;
  characterThroughput: Distribution;
  inputCharacters: Distribution;
  audioBytes: Distribution;
  outputTokens: Distribution;
  estimatedCreditPerUnit?: number;
  estimatedCreditSamples: number;
  generatedImages: number;
};

function distribution(values: Array<number | undefined>): Distribution {
  const measured = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  return measured.length ? { p50: percentile(measured, 0.5), p95: percentile(measured, 0.95) } : {};
}

export function percentile(values: number[], point: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, point));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function calculateBenchmarkStats(logs: RunLog[], kind: TestKind): BenchmarkStats {
  const successful = logs.filter((run) => run.status === "success");
  const outputTokens = successful
    .map((run) => run.usage.outputTokens)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  let estimatedCredits = 0;
  let pricedUnits = 0;
  let estimatedCreditSamples = 0;

  for (const run of successful) {
    if (typeof run.usage.estimatedCredit !== "number" || !Number.isFinite(run.usage.estimatedCredit)) continue;
    const units = kind === "image" ? run.images.length : 1;
    if (units < 1) continue;
    estimatedCredits += run.usage.estimatedCredit;
    pricedUnits += units;
    estimatedCreditSamples += 1;
  }

  return {
    attempts: logs.length,
    successes: successful.length,
    successRate: logs.length ? (successful.length / logs.length) * 100 : 0,
    totalLatency: distribution(successful.map((run) => run.timings.totalMs)),
    apiLatency: distribution(successful.map((run) => run.timings.apiMs)),
    ttft: distribution(successful.map((run) => run.textMetrics?.ttftMs)),
    tokenVelocity: distribution(successful.map((run) => run.textMetrics?.tokensPerSecond)),
    imageThroughput: distribution(successful.map((run) => run.images.length && run.timings.totalMs > 0 ? run.images.length * 60_000 / run.timings.totalMs : undefined)),
    speechTtfb: distribution(successful.map((run) => run.speechMetrics?.timeToFirstByteMs)),
    characterThroughput: distribution(successful.map((run) => run.speechMetrics?.charactersPerSecond)),
    inputCharacters: distribution(successful.map((run) => run.speechMetrics?.characterCount)),
    audioBytes: distribution(successful.map((run) => run.audio?.bytes)),
    outputTokens: distribution(outputTokens),
    estimatedCreditPerUnit: pricedUnits ? estimatedCredits / pricedUnits : undefined,
    estimatedCreditSamples,
    generatedImages: successful.reduce((sum, run) => sum + run.images.length, 0),
  };
}

export function formatRate(value: number | undefined, unit: string) {
  return value === undefined ? "—" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} ${unit}`;
}
