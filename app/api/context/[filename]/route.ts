import { NextResponse } from "next/server";
import { readContextImage } from "@/lib/server/storage/run-store";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const bytes = await readContextImage(filename);
  if (!bytes) return NextResponse.json({ error: "컨텍스트 이미지를 찾을 수 없습니다." }, { status: 404 });
  const mimeType = filename.endsWith(".jpg") ? "image/jpeg" : filename.endsWith(".webp") ? "image/webp" : "image/png";
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
