export type RequestValueRow = {
  label: string;
  value: string;
  detail: string;
};

export function RequestValueSummary({ rows }: { rows: RequestValueRow[] }) {
  return (
    <div className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-xs font-bold text-slate-800">현재 API 전달값</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">자동과 auto가 실제 요청에서 어떻게 처리되는지 표시합니다.</p>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 rounded-lg border border-slate-200/80 bg-white px-3 py-2">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <dt className="shrink-0 text-[11px] font-semibold text-slate-500">{row.label}</dt>
              <dd className="min-w-0 break-all text-right font-mono text-xs font-semibold text-slate-900">{row.value}</dd>
            </div>
            <p className="mt-1 break-words text-[11px] leading-4 text-slate-400">{row.detail}</p>
          </div>
        ))}
      </dl>
    </div>
  );
}
