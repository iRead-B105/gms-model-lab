import { NextResponse } from "next/server";
import { generateImage } from "@/lib/server/gms/image-generation";
import { parseImageBody, readRequestJson, validationResponse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = parseImageBody(await readRequestJson(request));
    // Keep paid upstream work alive if the browser reloads or HMR disconnects.
    // The completed result must still be persisted locally.
    const run = await generateImage(input);
    const status = run.status === "success" ? 200 : run.errorCode === "NO_IMAGE" ? 422 : run.error?.includes("로컬 로그 저장 실패") ? 507 : 502;
    return NextResponse.json(run, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return validationResponse(error); }
}
