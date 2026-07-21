import { NextResponse } from "next/server";
import { listRuns } from "@/lib/server/storage/run-store";
import { DEFAULT_LOG_PAGE_SIZE, LOG_PAGE_SIZES, queryRuns } from "@/lib/server/storage/run-query";
import type { Provider, RunLog, TestKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_KINDS = new Set<TestKind>(["image", "text", "tts"]);
const STATUSES = new Set<RunLog["status"]>(["success", "error"]);
const PROVIDERS = new Set<Provider>(["openai", "gemini", "anthropic"]);

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const requestedPageSize = positiveInteger(params.get("pageSize"), DEFAULT_LOG_PAGE_SIZE);
    const pageSize = LOG_PAGE_SIZES.includes(requestedPageSize as (typeof LOG_PAGE_SIZES)[number]) ? requestedPageSize : DEFAULT_LOG_PAGE_SIZE;
    const kindValue = params.get("kind");
    const statusValue = params.get("status");
    const providerValue = params.get("benchmarkProvider");
    const modelValue = params.get("benchmarkModel")?.trim().slice(0, 200);
    const result = queryRuns(await listRuns(), {
      page: positiveInteger(params.get("page"), 1),
      pageSize,
      kind: kindValue && TEST_KINDS.has(kindValue as TestKind) ? kindValue as TestKind : undefined,
      status: statusValue && STATUSES.has(statusValue as RunLog["status"]) ? statusValue as RunLog["status"] : undefined,
      search: params.get("search")?.trim().slice(0, 200),
      benchmarkProvider: providerValue && PROVIDERS.has(providerValue as Provider) ? providerValue as Provider : undefined,
      benchmarkModel: modelValue || undefined,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  }
  catch { return NextResponse.json({ error: "로컬 실행 기록을 읽지 못했습니다." }, { status: 500, headers: { "Cache-Control": "no-store" } }); }
}
