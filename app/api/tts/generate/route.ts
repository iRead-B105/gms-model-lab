import { NextResponse } from "next/server";
import { generateSpeech } from "@/lib/server/gms/speech-generation";
import { parseTtsBody, readRequestJson, validationResponse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = parseTtsBody(await readRequestJson(request));
    const run = await generateSpeech(input);
    return NextResponse.json(run, { status: run.status === "success" ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return validationResponse(error); }
}
