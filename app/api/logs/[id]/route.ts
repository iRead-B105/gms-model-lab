import { NextResponse } from "next/server";
import { deleteRun, getRun } from "@/lib/server/storage/run-store";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const run = await getRun(id);
    return run ? NextResponse.json(run, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "기록을 읽지 못했습니다." }, { status: 500, headers: { "Cache-Control": "no-store" } }); }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return (await deleteRun(id)) ? NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "기록을 삭제하지 못했습니다." }, { status: 500, headers: { "Cache-Control": "no-store" } }); }
}
