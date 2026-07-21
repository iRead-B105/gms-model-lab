import { NextResponse } from "next/server";
import { deleteRun, getRun, updateRunCreditMeasurement } from "@/lib/server/storage/run-store";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const run = await getRun(id);
    if (!run) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const download = new URL(request.url).searchParams.get("download") === "1";
    return NextResponse.json(run, { headers: { "Cache-Control": "no-store", ...(download ? { "Content-Disposition": `attachment; filename="gms-run-${run.id}.json"` } : {}) } });
  } catch { return NextResponse.json({ error: "기록을 읽지 못했습니다." }, { status: 500, headers: { "Cache-Control": "no-store" } }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { actualCredit?: unknown; status?: unknown; error?: unknown };
    if (!(["measured", "unavailable", "batch-only"] as const).includes(body.status as "measured" | "unavailable" | "batch-only")) {
      return NextResponse.json({ error: "크레딧 측정 상태가 올바르지 않습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (body.actualCredit !== undefined && (typeof body.actualCredit !== "number" || !Number.isFinite(body.actualCredit) || body.actualCredit < 0)) {
      return NextResponse.json({ error: "실제 차감 크레딧 값이 올바르지 않습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (body.status === "measured" && typeof body.actualCredit !== "number") {
      return NextResponse.json({ error: "측정 완료 상태에는 실제 차감 크레딧이 필요합니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (body.error !== undefined && (typeof body.error !== "string" || body.error.length > 500)) {
      return NextResponse.json({ error: "크레딧 측정 오류 형식이 올바르지 않습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const run = await updateRunCreditMeasurement(id, {
      actualCredit: body.actualCredit as number | undefined,
      status: body.status as "measured" | "unavailable" | "batch-only",
      error: body.error as string | undefined,
    });
    return run ? NextResponse.json(run, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "실제 차감 크레딧을 저장하지 못했습니다." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return (await deleteRun(id)) ? NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "기록을 삭제하지 못했습니다." }, { status: 500, headers: { "Cache-Control": "no-store" } }); }
}
