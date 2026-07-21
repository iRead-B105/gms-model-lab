import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function LogPagination({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange }: Props) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        {total ? `${first.toLocaleString("ko-KR")}–${last.toLocaleString("ko-KR")}` : "0"} / {total.toLocaleString("ko-KR")}건
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          페이지당
          <Select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-8 w-20 text-xs" aria-label="페이지당 기록 수">
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}개</option>)}
          </Select>
        </label>
        <span className="min-w-20 text-center text-xs font-medium text-slate-600">{page} / {totalPages}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="px-2" onClick={() => onPageChange(1)} disabled={page <= 1} aria-label="첫 페이지"><ChevronsLeft size={14} /></Button>
          <Button variant="outline" size="sm" className="px-2" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="이전 페이지"><ChevronLeft size={14} /></Button>
          <Button variant="outline" size="sm" className="px-2" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="다음 페이지"><ChevronRight size={14} /></Button>
          <Button variant="outline" size="sm" className="px-2" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} aria-label="마지막 페이지"><ChevronsRight size={14} /></Button>
        </div>
      </div>
    </div>
  );
}
