import { createTextStream } from "@/lib/server/gms/text-generation";
import { parseTextBody, readRequestJson, validationResponse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = parseTextBody(await readRequestJson(request));
    return new Response(createTextStream(input), {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) { return validationResponse(error); }
}
