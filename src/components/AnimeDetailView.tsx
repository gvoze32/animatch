import { useState, type CSSProperties } from "react";
import { ArrowLeft, ExternalLink, Info, Star } from "lucide-react";
import { AnimeCard } from "@/components/AnimeCard";
import { AnimeGrid, AnimeGridSkeleton, SectionHeading } from "@/components/AnimeGrid";
import { Cover } from "@/components/Cover";
import { ErrorMessage, PartialSourcesNotice } from "@/components/StatusMessages";
import type { Async } from "@/hooks/useAniMatch";
import { formatMeta, formatScore, getTitle, toPlainText, truncate } from "@/lib/anime";
import type { RecommendationsResult } from "@/lib/service";
import { SOURCE_LABELS, type Anime, type SourceName } from "@/lib/types";

const SOURCE_URLS: Record<SourceName, (id: number) => string> = {
  anilist: (id) => `https://anilist.co/anime/${id}`,
  mal: (id) => `https://myanimelist.net/anime/${id}`,
  kitsu: (id) => `https://kitsu.app/anime/${id}`,
};

const DESCRIPTION_PREVIEW = 360;

function AnimeHero({ anime }: { anime: Anime }) {
  const [expanded, setExpanded] = useState(false);
  const title = getTitle(anime);
  const score = formatScore(anime.averageScore);
  const meta = formatMeta(anime);
  const description = anime.description ? toPlainText(anime.description) : "";
  const subtitle = [anime.title.romaji, anime.title.native].find((t) => t && t !== title);
  const backdrop = anime.bannerImage ?? anime.coverImage;
  const accent = { "--accent": anime.accentColor ?? "#a855f7" } as CSSProperties;

  return (
    <article
      key={anime.id}
      style={accent}
      className="animate-in fade-in slide-in-from-bottom-2 relative isolate overflow-hidden rounded-3xl border border-white/[0.08] duration-500 motion-reduce:animate-none"
    >
      {backdrop && (
        <div
          aria-hidden
          className={`absolute inset-0 -z-10 bg-cover bg-center ${anime.bannerImage ? "opacity-40" : "scale-110 opacity-30 blur-2xl"}`}
          style={{ backgroundImage: `url(${JSON.stringify(backdrop)})` }}
        />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[#07060d] via-[#07060d]/85 to-[#07060d]/40" />
      <div
        aria-hidden
        className="absolute -left-24 -top-24 -z-10 size-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <div className="flex flex-col gap-8 p-6 pt-24 sm:flex-row sm:items-end md:p-10 md:pt-40">
        <Cover
          key={anime.id}
          src={anime.coverImage}
          alt={title}
          priority
          className="w-40 shrink-0 self-center rounded-2xl shadow-[0_24px_60px_-15px_var(--accent)] ring-1 ring-white/15 sm:self-auto md:w-52"
        />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-white/45">{subtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {score && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 font-semibold text-amber-300">
                <Star className="size-3.5 fill-current" aria-hidden /> {score}
              </span>
            )}
            {meta && <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-white/75">{meta}</span>}
            {anime.studios.length > 0 && (
              <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-white/75">{anime.studios.join(", ")}</span>
            )}
          </div>

          {anime.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {anime.genres.map((genre) => (
                <span key={genre} className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-white/70">
                  {genre}
                </span>
              ))}
            </div>
          )}

          {description && (
            <div className="max-w-3xl text-[15px] leading-relaxed text-white/65">
              <p className="whitespace-pre-line">{expanded ? description : truncate(description, DESCRIPTION_PREVIEW)}</p>
              {description.length > DESCRIPTION_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-sm font-medium text-violet-300 hover:text-violet-200 focus-visible:underline focus-visible:outline-none"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {(Object.keys(SOURCE_URLS) as SourceName[]).map((source) => {
              const id = anime.ids[source];
              return id === undefined ? null : (
                <a
                  key={source}
                  href={SOURCE_URLS[source](id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white"
                >
                  {SOURCE_LABELS[source]} <ExternalLink className="size-3" aria-hidden />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}

function HeroSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8 rounded-3xl border border-white/[0.08] p-6 pt-24 sm:flex-row sm:items-end md:p-10 md:pt-40">
      <div className="aspect-[2/3] w-40 animate-pulse self-center rounded-2xl bg-white/[0.06] sm:self-auto md:w-52" />
      <div className="flex-1 space-y-4">
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-6 w-1/3 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-white/[0.06]" />
      </div>
    </div>
  );
}

function MatchExplainer() {
  return (
    <details className="group text-sm text-white/50 [&_summary::-webkit-details-marker]:hidden">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-white/[0.05] hover:text-white/80">
        <Info className="size-4" aria-hidden /> How is the match calculated?
      </summary>
      <div className="mt-2 max-w-md space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-white/60">
        <p>
          <strong className="text-white/85">60% content</strong>: shared genres, the original's most defining tags,
          release era and studio.
        </p>
        <p>
          <strong className="text-white/85">40% community</strong>: how many AniList/MyAnimeList fans recommend the
          pair (log scale; 1,000+ votes counts in full).
        </p>
        <p>Seasons of the same show are grouped into one card. Equal scores are broken by rating.</p>
      </div>
    </details>
  );
}

interface AnimeDetailViewProps {
  preview?: Anime;
  details: Async<RecommendationsResult>;
  canGoBack: boolean;
  onBack: () => void;
  onSelect: (anime: Anime) => void;
  onRetry: () => void;
}

export function AnimeDetailView({ preview, details, canGoBack, onBack, onSelect, onRetry }: AnimeDetailViewProps) {
  const anime = details.status === "success" ? details.data.anime : preview;
  const data = details.status === "success" ? details.data : undefined;

  return (
    <div className="space-y-14">
      <div className="space-y-4">
        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-white/60 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to results
          </button>
        )}
        {anime ? <AnimeHero anime={anime} /> : details.status === "loading" && <HeroSkeleton />}
      </div>

      {data && data.sameSeries.length > 0 && (
        <section aria-labelledby="series-heading">
          <SectionHeading title={<span id="series-heading">More from this series</span>} hint="Sequels, prequels and side stories" />
          <ul aria-label="Same series" className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
            {data.sameSeries.map((entry, index) => (
              <AnimeCard
                key={entry.id}
                anime={entry}
                index={index}
                onSelect={onSelect}
                size="sm"
                className="w-32 shrink-0 snap-start sm:w-36"
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recommendations-heading">
        <SectionHeading
          title={<span id="recommendations-heading">{anime ? <>If you liked <span className="text-gradient">{getTitle(anime)}</span></> : "Recommendations"}</span>}
          hint={data ? <PartialSourcesNotice failed={data.failedSources} /> : undefined}
        >
          <MatchExplainer />
        </SectionHeading>

        {details.status === "loading" && <AnimeGridSkeleton />}
        {details.status === "error" && <ErrorMessage message={details.message} onRetry={onRetry} />}
        {data &&
          (data.recommendations.length > 0 ? (
            <AnimeGrid label="Recommendations">
              {data.recommendations.map((rec, index) => (
                <AnimeCard
                  key={rec.anime.id}
                  anime={rec.anime}
                  match={rec.score}
                  reasons={rec.reasons}
                  relatedCount={rec.related.length}
                  index={index}
                  onSelect={onSelect}
                />
              ))}
            </AnimeGrid>
          ) : (
            <p className="text-white/55">No one has recommended anything for this title yet.</p>
          ))}
      </section>
    </div>
  );
}
