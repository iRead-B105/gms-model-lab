"use client";

import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContextImageInput } from "@/lib/types";

const MAX_IMAGES = 4;
const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");
      if (separator < 0) reject(new Error(`${file.name} 파일 데이터가 올바르지 않습니다.`));
      else resolve(result.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function ContextImagePicker({ images, disabled, onChange, onError }: {
  images: ContextImageInput[];
  disabled?: boolean;
  onChange: (images: ContextImageInput[]) => void;
  onError: (message: string) => void;
}) {
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const available = MAX_IMAGES - images.length;
    if (files.length > available) return onError(`컨텍스트 이미지는 최대 ${MAX_IMAGES}개까지 추가할 수 있습니다.`);
    const selected = [...files];
    const invalid = selected.find((file) => !ACCEPTED.includes(file.type) || file.size > MAX_BYTES || file.size === 0);
    if (invalid) return onError(`${invalid.name}: PNG, JPEG, WebP 형식의 3MB 이하 이미지만 사용할 수 있습니다.`);
    try {
      const next = await Promise.all(selected.map(async (file) => ({
        name: file.name,
        mimeType: file.type as ContextImageInput["mimeType"],
        base64: await readBase64(file),
        bytes: file.size,
      })));
      onChange([...images, ...next]);
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "이미지 파일을 읽지 못했습니다.");
    }
  }

  return <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-semibold text-slate-800">컨텍스트 이미지</p><p className="mt-1 text-[11px] leading-5 text-slate-500">참조·분석·편집에 사용할 로컬 이미지 · 최대 4개, 각 3MB</p></div>
      <label className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold shadow-sm hover:bg-slate-50 ${disabled || images.length >= MAX_IMAGES ? "pointer-events-none opacity-50" : ""}`}>
        <ImagePlus size={13} /> 업로드
        <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={disabled || images.length >= MAX_IMAGES} onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = ""; }} />
      </label>
    </div>
    {images.length ? <div className="mt-3 grid grid-cols-2 gap-2">{images.map((image, index) => <div key={`${image.name}-${index}`} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="relative aspect-video"><Image src={`data:${image.mimeType};base64,${image.base64}`} alt={`${image.name} 미리보기`} fill unoptimized className="object-cover" /></div>
      <div className="flex items-center justify-between gap-1 p-2"><span className="min-w-0 truncate text-[10px] text-slate-500">{image.name} · {(image.bytes / 1024).toFixed(0)}KB</span><Button type="button" variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0" disabled={disabled} onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))} aria-label={`${image.name} 제거`}><X size={12} /></Button></div>
    </div>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] text-slate-400">이미지를 추가하지 않으면 텍스트 프롬프트만 전송합니다.</p>}
  </div>;
}
