const STORAGE_KEY = "gms-model-lab:gms-key:v1";
const MAX_KEY_LENGTH = 512;

function storage() {
  if (typeof window === "undefined") throw new Error("브라우저 저장소를 사용할 수 없습니다.");
  return window.localStorage;
}

export function readStoredGmsKey() {
  const value = storage().getItem(STORAGE_KEY) || "";
  if (value.length > MAX_KEY_LENGTH) throw new Error("저장된 GMS 키 형식이 올바르지 않습니다.");
  return value;
}

export function saveStoredGmsKey(key: string) {
  const value = key.trim();
  if (!value || value.length > MAX_KEY_LENGTH) throw new Error("저장할 GMS 키 형식이 올바르지 않습니다.");
  storage().setItem(STORAGE_KEY, value);
}

export function removeStoredGmsKey() {
  storage().removeItem(STORAGE_KEY);
}
