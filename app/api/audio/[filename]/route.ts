import { readAudio } from "@/lib/server/storage/run-store";

export const runtime = "nodejs";

const MIME_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "audio/L16",
};

export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const audio = await readAudio(filename);
  if (!audio) return new Response("Not found", { status: 404 });
  const extension = filename.split(".").pop() || "";
  const commonHeaders = {
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Accept-Ranges": "bytes",
  };
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const suffixLength = !range[1] && range[2] ? Number(range[2]) : 0;
    const requestedStart = suffixLength ? Math.max(0, audio.byteLength - suffixLength) : range[1] ? Number(range[1]) : 0;
    const requestedEnd = suffixLength ? audio.byteLength - 1 : range[2] ? Number(range[2]) : audio.byteLength - 1;
    const start = Math.max(0, requestedStart);
    const end = Math.min(audio.byteLength - 1, requestedEnd);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= audio.byteLength) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${audio.byteLength}` } });
    }
    const chunk = audio.subarray(start, end + 1);
    return new Response(chunk, { status: 206, headers: { ...commonHeaders, "Content-Length": String(chunk.byteLength), "Content-Range": `bytes ${start}-${end}/${audio.byteLength}` } });
  }
  return new Response(audio, {
    headers: {
      ...commonHeaders,
      "Content-Length": String(audio.byteLength),
    },
  });
}
