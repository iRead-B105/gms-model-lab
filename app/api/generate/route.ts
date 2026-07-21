import { NextResponse } from "next/server";
import { generateImage } from "@/lib/server/gms/image-generation";
import { parseImageBody, readRequestJson, validationResponse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = parseImageBody(await readRequestJson(request));
    const run = await generateImage(input, request.signal);
    const status = run.status === "success" ? 200 : run.error?.includes("로컬 로그 저장 실패") ? 507 : 502;
    return NextResponse.json(run, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return validationResponse(error); }
}
