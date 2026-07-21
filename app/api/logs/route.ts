import { NextResponse } from "next/server";
import { listRuns } from "@/lib/server/storage/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await listRuns(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "로컬 실행 기록을 읽지 못했습니다." }, { status: 500, headers: { "Cache-Control": "no-store" } }); }
}
