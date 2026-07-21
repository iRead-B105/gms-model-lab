import { NextResponse } from "next/server";
import { discoverModels } from "@/lib/server/gms/models";
import { safeError } from "@/lib/server/gms/common";
import { parseKeyBody, readRequestJson, validationResponse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let key = "";
  try {
    key = parseKeyBody(await readRequestJson(request)).key;
    return NextResponse.json(await discoverModels(key, request.signal), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!key) return validationResponse(error);
    return NextResponse.json({ error: safeError(error, [key]) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
