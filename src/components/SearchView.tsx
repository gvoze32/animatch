import { AnimeCard } from "@/components/AnimeCard";
import { AnimeGrid, AnimeGridSkeleton, SectionHeading } from "@/components/AnimeGrid";
import { ErrorMessage, PartialSourcesNotice } from "@/components/StatusMessages";
import type { Async } from "@/hooks/useAniMatch";
import type { SearchResult } from "@/lib/service";
import type { Anime } from "@/lib/types";

const SUGGESTIONS = ["Frieren", "Steins;Gate", "Mob Psycho 100", "Violet Evergarden", "Haikyu!!", "Made in Abyss"];

interface HomeViewProps {
  trending: Async<Anime[]>;
  onSelect: (anime: Anime) => void;
  onSearch: (query: string) => void;
  onRetry: () => void;
}

export function HomeView({ trending, onSelect, onSearch, onRetry }: HomeViewProps) {
  return (
    <div className="space-y-16">
      <div className="-mt-6 flex flex-wrap items-center justify-center gap-2">
        <span className="mr-1 text-sm text-white/40">Try</span>
        {SUGGESTIONS.map((title) => (
          <button
            key={title}
            type="button"
            onClick={() => onSearch(title)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-white/70 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            {title}
          </button>
        ))}
      </div>

      <section aria-labelledby="trending-heading">
        <SectionHeading title={<span id="trending-heading">Trending now</span>} hint="Pick one to see what to watch after it" />
        {trending.status === "error" ? (
          <ErrorMessage message={trending.message} onRetry={onRetry} />
        ) : trending.status === "success" ? (
          <AnimeGrid label="Trending anime">
            {trending.data.map((anime, index) => (
              <AnimeCard key={anime.id} anime={anime} index={index} onSelect={onSelect} />
            ))}
          </AnimeGrid>
        ) : (
          <AnimeGridSkeleton />
        )}
      </section>
    </div>
  );
}

interface SearchViewProps {
  query: string;
  search: Async<SearchResult>;
  onSelect: (anime: Anime) => void;
  onRetry: () => void;
}

export function SearchView({ query, search, onSelect, onRetry }: SearchViewProps) {
  if (search.status === "error") return <ErrorMessage message={search.message} onRetry={onRetry} />;
  if (search.status !== "success") {
    return (
      <section aria-busy="true" aria-label="Loading results">
        <SectionHeading title={`Searching for “${query}”`} hint="Asking AniList, MyAnimeList and Kitsu…" />
        <AnimeGridSkeleton />
      </section>
    );
  }

  const { results, failedSources } = search.data;
  return (
    <section>
      <SectionHeading
        title={results.length > 0 ? <>Results for “{query}”</> : <>No results for “{query}”</>}
        hint={results.length > 0 ? "Pick the one you mean to see your matches" : "Check the spelling, or try the English or Japanese title."}
      >
        <PartialSourcesNotice failed={failedSources} />
      </SectionHeading>
      {results.length > 0 && (
        <AnimeGrid label="Search results">
          {results.map((anime, index) => (
            <AnimeCard key={anime.id} anime={anime} index={index} onSelect={onSelect} />
          ))}
        </AnimeGrid>
      )}
    </section>
  );
}
