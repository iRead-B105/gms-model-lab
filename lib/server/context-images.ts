import type { ContextImageInput, StoredContextImage } from "@/lib/types";
import { saveContextImage } from "@/lib/server/storage/run-store";

export function contextBytes(image: ContextImageInput) {
  return new Uint8Array(Buffer.from(image.base64, "base64"));
}

export function contextDataUrl(image: ContextImageInput) {
  return `data:${image.mimeType};base64,${image.base64}`;
}

export async function persistContextImages(runId: string, images: ContextImageInput[] = []): Promise<StoredContextImage[]> {
  return Promise.all(images.map((image, index) => saveContextImage(runId, index, contextBytes(image), image.mimeType, image.name)));
}
