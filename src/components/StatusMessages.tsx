import { AlertCircle, RotateCw, WifiOff } from "lucide-react";
import { SOURCE_LABELS, type SourceName } from "@/lib/types";

export function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-4 rounded-2xl border border-rose-400/20 bg-rose-500/[0.07] p-5">
      <AlertCircle className="size-5 shrink-0 text-rose-300" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-rose-100">Something went wrong</p>
        <p className="text-sm text-rose-200/70">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-300/25 px-3.5 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
      >
        <RotateCw className="size-4" aria-hidden /> Retry
      </button>
    </div>
  );
}

/** Shown when some (not all) sources failed, so the results are partial. */
export function PartialSourcesNotice({ failed }: { failed: SourceName[] }) {
  if (failed.length === 0) return null;
  const names = failed.map((s) => SOURCE_LABELS[s]).join(" and ");
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-400/[0.06] px-3 py-1 text-xs text-amber-200/80">
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      {names} didn't respond — results may be incomplete
    </p>
  );
}
