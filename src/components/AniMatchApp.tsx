import { AnimeDetailView } from "@/components/AnimeDetailView";
import { Header } from "@/components/Header";
import { HomeView, SearchView } from "@/components/SearchView";
import { useAniMatch } from "@/hooks/useAniMatch";

export default function AniMatchApp() {
  const app = useAniMatch();
  const { route } = app;

  return (
    <div className="flex-1">
      <Header
        compact={Boolean(route.query || route.animeRef)}
        query={route.query}
        searching={app.search.status === "loading"}
        onSearch={app.submitSearch}
        onHome={app.goHome}
      />

      <main className="mx-auto w-full max-w-7xl px-4 pb-20">
        {route.animeRef ? (
          <AnimeDetailView
            preview={app.previewAnime}
            details={app.details}
            canGoBack={Boolean(route.query)}
            onBack={app.backToResults}
            onSelect={app.selectAnime}
            onRetry={app.retry}
          />
        ) : route.query ? (
          <SearchView query={route.query} search={app.search} onSelect={app.selectAnime} onRetry={app.retry} />
        ) : (
          <HomeView trending={app.trending} onSelect={app.selectAnime} onSearch={app.submitSearch} onRetry={app.retry} />
        )}

        <label className="mx-auto mt-20 flex w-fit cursor-pointer items-center gap-2.5 text-xs text-white/35 transition hover:text-white/65">
          <input
            type="checkbox"
            checked={app.includeAdult}
            onChange={(event) => app.setIncludeAdult(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-4 w-7 rounded-full bg-white/15 transition peer-checked:bg-fuchsia-500 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400 after:absolute after:left-0.5 after:top-0.5 after:size-3 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-3"
          />
          Include 18+ titles
        </label>
      </main>
    </div>
  );
}
