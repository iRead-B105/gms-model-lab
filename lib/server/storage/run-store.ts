import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunLog } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const RUNS_DIR = path.join(DATA_DIR, "runs");
const IMAGES_DIR = path.join(DATA_DIR, "images");
const AUDIO_DIR = path.join(DATA_DIR, "audio");
const CONTEXT_DIR = path.join(DATA_DIR, "context");
const RUN_ID = /^[a-zA-Z0-9-]{1,100}$/;
const IMAGE_FILE = /^[a-zA-Z0-9-]{1,100}-[1-4]\.(png|webp|jpg)$/;
const AUDIO_FILE = /^[a-zA-Z0-9-]{1,100}\.(mp3|opus|aac|flac|wav|pcm)$/;
const CONTEXT_FILE = /^[a-zA-Z0-9-]{1,100}-context-[1-4]\.(png|webp|jpg)$/;
const SENSITIVE_FIELD = /^(key|api_?key|gms_?key|authorization|password|secret|credential|access_?token|refresh_?token|bearer)$/i;

async function ensureDirs() {
  await Promise.all([mkdir(RUNS_DIR, { recursive: true }), mkdir(IMAGES_DIR, { recursive: true }), mkdir(AUDIO_DIR, { recursive: true }), mkdir(CONTEXT_DIR, { recursive: true })]);
}

function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 20) return "[MAX_DEPTH]";
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_FIELD.test(key) ? "[REDACTED]" : redactSensitive(item, depth + 1)]));
}

async function atomicWrite(filename: string, data: string | Uint8Array) {
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, data);
    await rename(temporary, filename);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export async function saveImage(runId: string, index: number, bytes: Uint8Array, mimeType: string) {
  if (!RUN_ID.test(runId) || index < 0 || index > 3) throw new Error("이미지 저장 경로가 올바르지 않습니다.");
  await ensureDirs();
  const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("webp") ? "webp" : "png";
  const filename = `${runId}-${index + 1}.${extension}`;
  await atomicWrite(path.join(IMAGES_DIR, filename), bytes);
  return { filename, mimeType: extension === "jpg" ? "image/jpeg" : `image/${extension}`, bytes: bytes.byteLength, url: `/api/images/${filename}` };
}

export async function saveAudio(runId: string, bytes: Uint8Array, format: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm") {
  if (!RUN_ID.test(runId)) throw new Error("오디오 저장 경로가 올바르지 않습니다.");
  await ensureDirs();
  const mimeTypes = { mp3: "audio/mpeg", opus: "audio/ogg", aac: "audio/aac", flac: "audio/flac", wav: "audio/wav", pcm: "audio/L16" } as const;
  const filename = `${runId}.${format}`;
  await atomicWrite(path.join(AUDIO_DIR, filename), bytes);
  return { filename, mimeType: mimeTypes[format], bytes: bytes.byteLength, url: `/api/audio/${filename}` };
}

export async function saveContextImage(runId: string, index: number, bytes: Uint8Array, mimeType: "image/png" | "image/jpeg" | "image/webp", name: string) {
  if (!RUN_ID.test(runId) || index < 0 || index > 3) throw new Error("컨텍스트 이미지 저장 경로가 올바르지 않습니다.");
  await ensureDirs();
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
  const filename = `${runId}-context-${index + 1}.${extension}`;
  await atomicWrite(path.join(CONTEXT_DIR, filename), bytes);
  return { filename, name, mimeType, bytes: bytes.byteLength, url: `/api/context/${filename}` };
}

export async function updateRunActualCredit(id: string, actualCredit: number) {
  if (!Number.isFinite(actualCredit) || actualCredit < 0) throw new Error("실제 차감 크레딧 값이 올바르지 않습니다.");
  const run = await getRun(id);
  if (!run) return null;
  const updated = { ...run, usage: { ...run.usage, actualCredit } };
  await saveRun(updated);
  return updated;
}

export async function saveRun(run: RunLog) {
  if (!RUN_ID.test(run.id)) throw new Error("실행 기록 ID가 올바르지 않습니다.");
  await ensureDirs();
  const safeRun = redactSensitive(run) as RunLog;
  await atomicWrite(path.join(RUNS_DIR, `${run.id}.json`), JSON.stringify(safeRun, null, 2));
}

export async function listRuns(): Promise<RunLog[]> {
  await ensureDirs();
  const files = (await readdir(RUNS_DIR)).filter((file) => file.endsWith(".json") && RUN_ID.test(file.slice(0, -5)));
  const runs = await Promise.all(files.map(async (file) => {
    try {
      const value = JSON.parse(await readFile(path.join(RUNS_DIR, file), "utf8")) as Partial<RunLog>;
      return value.id && value.createdAt && value.model && value.status ? value as RunLog : null;
    } catch { return null; }
  }));
  return runs.filter((run): run is RunLog => Boolean(run)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRun(id: string) {
  if (!RUN_ID.test(id)) return null;
  try { return JSON.parse(await readFile(path.join(RUNS_DIR, `${id}.json`), "utf8")) as RunLog; }
  catch { return null; }
}

export async function deleteRun(id: string) {
  const run = await getRun(id);
  if (!run) return false;
  const images = Array.isArray(run.images) ? run.images.filter((image) => IMAGE_FILE.test(image.filename)) : [];
  const audio = run.audio && AUDIO_FILE.test(run.audio.filename) ? run.audio : null;
  const contextImages = Array.isArray(run.contextImages) ? run.contextImages.filter((image) => CONTEXT_FILE.test(image.filename)) : [];
  await Promise.all([
    unlink(path.join(RUNS_DIR, `${id}.json`)),
    ...images.map((image) => unlink(path.join(IMAGES_DIR, image.filename)).catch(() => undefined)),
    ...(audio ? [unlink(path.join(AUDIO_DIR, audio.filename)).catch(() => undefined)] : []),
    ...contextImages.map((image) => unlink(path.join(CONTEXT_DIR, image.filename)).catch(() => undefined)),
  ]);
  return true;
}

export async function readImage(filename: string) {
  if (!IMAGE_FILE.test(filename)) return null;
  try { return await readFile(path.join(IMAGES_DIR, filename)); }
  catch { return null; }
}

export async function readAudio(filename: string) {
  if (!AUDIO_FILE.test(filename)) return null;
  try { return await readFile(path.join(AUDIO_DIR, filename)); }
  catch { return null; }
}

export async function readContextImage(filename: string) {
  if (!CONTEXT_FILE.test(filename)) return null;
  try { return await readFile(path.join(CONTEXT_DIR, filename)); }
  catch { return null; }
}
