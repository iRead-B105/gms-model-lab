import { readImage } from "@/lib/server/storage/run-store";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const image = await readImage(filename);
  if (!image) return new Response("Not found", { status: 404 });
  const contentType = filename.endsWith(".webp") ? "image/webp" : filename.endsWith(".jpg") ? "image/jpeg" : "image/png";
  return new Response(image, { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
}
