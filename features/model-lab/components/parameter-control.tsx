"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/features/model-lab/components/layout";

export type OptionalNumber = number | "";

type CommonProps = {
  label: string;
  value: OptionalNumber;
  fallback: number;
  onChange: (value: OptionalNumber) => void;
};

export function DefaultableNumber({ label, value, fallback, onChange, min, max }: CommonProps & { min: number; max: number }) {
  const automatic = value === "";
  return (
    <Field label={`${label} · ${automatic ? "자동 (전송 안 함)" : value.toLocaleString()}`}>
      <div className="flex gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          placeholder="API 요청에서 생략"
          onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
          disabled={automatic}
        />
        <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" onClick={() => onChange(automatic ? fallback : "")}>
          {automatic ? "직접 설정" : "자동"}
        </Button>
      </div>
    </Field>
  );
}

export function DefaultableRange({ label, value, fallback, onChange, min, max, step }: CommonProps & { min: number; max: number; step: number }) {
  const automatic = value === "";
  return (
    <Field label={`${label} · ${automatic ? "자동 (전송 안 함)" : value}`}>
      <div className="flex items-center gap-2">
        {automatic
          ? <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">선택 모델의 기본값 사용</div>
          : <input aria-label={label} className="range min-w-0 flex-1" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />}
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onChange(automatic ? fallback : "")}>
          {automatic ? "직접 설정" : "자동"}
        </Button>
      </div>
    </Field>
  );
}
