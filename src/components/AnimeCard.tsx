import { memo, type CSSProperties } from "react";
import { Layers, Star } from "lucide-react";
import { Cover } from "@/components/Cover";
import { formatMeta, formatScore, getTitle } from "@/lib/anime";
import { cn } from "@/lib/utils";
import type { Anime, RecommendationReason } from "@/lib/types";

/** Circular match indicator; colour shifts from amber to violet as the match improves. */
export function MatchRing({ score, size = 44 }: { score: number; size?: number }) {
  const percent = Math.round(score * 100);
  const color = percent >= 75 ? "#c084fc" : percent >= 60 ? "#f0abfc" : "#fcd34d";
  return (
    <div
      role="img"
      aria-label={`${percent}% match`}
      className="grid place-items-center rounded-full shadow-lg"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${percent * 3.6}deg, rgb(255 255 255 / 0.12) 0deg)`,
      }}
    >
      <span
        className="grid place-items-center rounded-full bg-[#0c0a14] font-display text-xs font-bold text-white"
        style={{ width: size - 7, height: size - 7 }}
      >
        {percent}
        <span className="sr-only">%</span>
      </span>
    </div>
  );
}

interface AnimeCardProps {
  anime: Anime;
  onSelect: (anime: Anime) => void;
  index: number;
  /** 0-1 match score, shown for recommendations. */
  match?: number;
  reasons?: RecommendationReason[];
  /** Other seasons/versions collapsed into this card. */
  relatedCount?: number;
  size?: "md" | "sm";
  className?: string;
}

export const AnimeCard = memo(function AnimeCard({
  anime,
  onSelect,
  index,
  match,
  reasons,
  relatedCount = 0,
  size = "md",
  className,
}: AnimeCardProps) {
  const title = getTitle(anime);
  const score = formatScore(anime.averageScore);
  const meta = formatMeta(anime);
  // Specific tags ("Time Loop") explain a match better than broad genres, so they lead.
  const chips = reasons
    ? [...reasons.filter((r) => r.type === "tag"), ...reasons.filter((r) => r.type === "genre")].slice(0, 3)
    : anime.genres.slice(0, 2).map((label) => ({ label }));
  const community = reasons?.find((r) => r.type === "community");
  const accent = { "--accent": anime.accentColor ?? "#a855f7" } as CSSProperties;

  return (
    <li
      style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}
      className={cn(
        "animate-in fade-in slide-in-from-bottom-3 fill-mode-both list-none duration-300 ease-out motion-reduce:animate-none",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(anime)}
        style={accent}
        className="group flex w-full flex-col gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#07060d]"
      >
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-12px_var(--accent)] group-hover:ring-white/25">
          <Cover src={anime.coverImage} alt="" className="[&_img]:duration-700 [&_img]:group-hover:scale-[1.04]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

          {match !== undefined && (
            <div className="absolute left-2.5 top-2.5">
              <MatchRing score={match} size={size === "sm" ? 36 : 44} />
            </div>
          )}
          {score && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold text-amber-300 backdrop-blur">
              <Star className="size-3 fill-current" aria-hidden />
              {score}
            </span>
          )}
          {relatedCount > 0 && (
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
              <Layers className="size-3" aria-hidden />+{relatedCount} more in series
            </span>
          )}
        </div>

        <div className="space-y-1.5 px-0.5">
          <h3 className={cn("line-clamp-2 font-semibold leading-snug text-white group-hover:text-violet-200", size === "sm" ? "text-sm" : "text-[15px]")}>
            {title}
          </h3>
          {meta && <p className="text-xs text-white/45">{meta}</p>}
          {size === "md" && chips.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {chips.map((chip) => (
                <span key={chip.label} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/65">
                  {chip.label}
                </span>
              ))}
            </div>
          )}
          {size === "md" && community && <p className="text-[11px] text-fuchsia-200/60">{community.label}</p>}
        </div>
      </button>
    </li>
  );
});
