import type { Provider, RunLog, TestKind } from "@/lib/types";
import { calculateBenchmarkStats } from "@/features/model-lab/metrics";

export const LOG_PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_LOG_PAGE_SIZE = 25;

export type RunQuery = {
  page: number;
  pageSize: number;
  kind?: TestKind;
  status?: RunLog["status"];
  search?: string;
  benchmarkProvider?: Provider;
  benchmarkModel?: string;
};

export function queryRuns(runs: RunLog[], query: RunQuery) {
  const kindRuns = query.kind ? runs.filter((run) => (run.kind || "image") === query.kind) : runs;
  const normalizedSearch = query.search?.trim().toLocaleLowerCase() || "";
  const filteredRuns = kindRuns.filter((run) => {
    if (query.status && run.status !== query.status) return false;
    if (!normalizedSearch) return true;
    const content = `${run.model} ${run.userPrompt} ${run.systemPrompt} ${run.outputText || ""}`.toLocaleLowerCase();
    return content.includes(normalizedSearch);
  });
  const pageSize = LOG_PAGE_SIZES.includes(query.pageSize as (typeof LOG_PAGE_SIZES)[number]) ? query.pageSize : DEFAULT_LOG_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, query.page));
  const benchmarkRuns = query.benchmarkProvider && query.benchmarkModel
    ? kindRuns.filter((run) => run.provider === query.benchmarkProvider && run.model === query.benchmarkModel)
    : [];

  return {
    items: filteredRuns.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: filteredRuns.length,
    totalPages,
    kindTotal: kindRuns.length,
    allTotal: runs.length,
    benchmarkStats: calculateBenchmarkStats(benchmarkRuns, query.kind || "image"),
    recentBenchmarkRuns: benchmarkRuns.filter((run) => run.status === "success").slice(0, 12),
  };
}
