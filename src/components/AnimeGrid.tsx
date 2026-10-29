import type { ReactNode } from "react";

export function AnimeGrid({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      {children}
    </ul>
  );
}

export function AnimeGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3">
          <div className="aspect-[2/3] animate-pulse rounded-2xl bg-white/[0.06]" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

export function SectionHeading({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">{title}</h2>
        {hint && <div className="mt-1 text-sm text-white/45">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
