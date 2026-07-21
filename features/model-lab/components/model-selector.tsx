"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ModelInfo, Provider, TestKind } from "@/lib/types";
import { providerName } from "@/features/model-lab/utils";
import { labelClass } from "@/features/model-lab/components/layout";

const PROVIDERS: Provider[] = ["openai", "gemini", "anthropic"];
const MODEL_ID_PATTERN = /^[a-zA-Z0-9._:/-]+$/;

function modelKey(model: Pick<ModelInfo, "provider" | "id">) {
  return `${model.provider}:${model.id}`;
}

export function ModelSelector({
  mode,
  models,
  value,
  disabled,
  onChange,
  onAddTextModel,
}: {
  mode: TestKind;
  models: ModelInfo[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onAddTextModel: (model: ModelInfo) => void;
}) {
  const [query, setQuery] = useState("");
  const [manualProvider, setManualProvider] = useState<Provider>("openai");
  const [manualModelId, setManualModelId] = useState("");
  const [manualError, setManualError] = useState("");

  const visibleModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return models.filter((model) => {
      if (modelKey(model) === value || !normalized) return true;
      return `${model.id} ${model.label} ${model.description} ${providerName(model.provider)}`.toLowerCase().includes(normalized);
    });
  }, [models, query, value]);

  function addManualModel() {
    const id = manualModelId.trim();
    if (!id || id.length > 200 || !MODEL_ID_PATTERN.test(id)) {
      setManualError("영문, 숫자, 점, 밑줄, 콜론, 슬래시, 하이픈으로 된 모델 ID를 입력해주세요.");
      return;
    }
    const model: ModelInfo = {
      id,
      provider: manualProvider,
      label: id,
      description: "직접 추가한 GMS 텍스트 모델",
    };
    onAddTextModel(model);
    onChange(modelKey(model));
    setManualModelId("");
    setManualError("");
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-xs font-semibold tracking-wide text-slate-600">{mode === "image" ? "이미지 생성" : mode === "tts" ? "음성 합성" : "텍스트 생성"} 모델</label>
        <span className="text-[11px] text-slate-400">{models.length}개</span>
      </div>

      {mode === "text" && (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="모델 ID 또는 공급자 검색" className="pl-9" disabled={disabled} />
        </div>
      )}

      <Select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {PROVIDERS.map((provider) => {
          const providerModels = visibleModels.filter((model) => model.provider === provider);
          if (!providerModels.length) return null;
          return <optgroup key={provider} label={`${providerName(provider)} · ${providerModels.length}개`}>{providerModels.map((model) => <option key={modelKey(model)} value={modelKey(model)}>{model.label}{model.listedCredit !== undefined ? ` · ${model.listedCredit.toLocaleString("ko-KR")} Credit` : ""}</option>)}</optgroup>;
        })}
      </Select>

      {mode === "text" && (
        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">목록에 없는 텍스트 모델 추가</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
            <div><label className={labelClass}>공급자</label><Select value={manualProvider} onChange={(event) => setManualProvider(event.target.value as Provider)} disabled={disabled}>{PROVIDERS.map((provider) => <option key={provider} value={provider}>{providerName(provider)}</option>)}</Select></div>
            <div><label className={labelClass}>GMS 모델 ID</label><Input value={manualModelId} onChange={(event) => setManualModelId(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addManualModel(); } }} placeholder="예: gpt-4o-mini" maxLength={200} disabled={disabled} /></div>
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={addManualModel} disabled={disabled}><Plus size={13} /> 모델 선택란에 추가</Button>
          {manualError && <p className="mt-2 text-[11px] leading-5 text-red-600" role="alert">{manualError}</p>}
          <p className="mt-2 text-[11px] leading-5 text-slate-400">GMS에서 실제로 허용된 모델 ID만 실행됩니다. 직접 추가한 모델의 단가는 실제 잔액 차이로 확인합니다.</p>
        </details>
      )}
    </div>
  );
}
