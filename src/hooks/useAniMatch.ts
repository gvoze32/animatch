import { useCallback, useEffect, useRef, useState } from "react";
import { parseRef } from "@/lib/anime";
import { isAbortError } from "@/lib/http";
import {
  AllSourcesFailedError,
  getRecommendations,
  getTrending,
  searchAnime,
  type RecommendationsResult,
  type SearchResult,
} from "@/lib/service";
import type { Anime, ExternalIds } from "@/lib/types";

/** Everything navigable lives in the URL: `?q=<query>&anime=<ref>`. */
export interface Route {
  query: string;
  animeRef: string | null;
}

export type Async<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

const ADULT_STORAGE_KEY = "animatch:include-adult";

function readRoute(): Route {
  const params = new URLSearchParams(window.location.search);
  return { query: params.get("q") ?? "", animeRef: params.get("anime") };
}

function routeUrl({ query, animeRef }: Route): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (animeRef) params.set("anime", animeRef);
  const search = params.toString();
  return search ? `?${search}` : window.location.pathname;
}

function errorMessage(error: unknown, action: string): string {
  if (error instanceof AllSourcesFailedError) {
    return "None of the anime databases responded. Check your connection and try again.";
  }
  return `Couldn't ${action}. Please try again.`;
}

export function useAniMatch() {
  const [route, setRoute] = useState<Route>({ query: "", animeRef: null });
  const [includeAdult, setIncludeAdultState] = useState(false);
  const [search, setSearch] = useState<Async<SearchResult>>({ status: "idle" });
  const [details, setDetails] = useState<Async<RecommendationsResult>>({ status: "idle" });
  const [trending, setTrending] = useState<Async<Anime[]>>({ status: "idle" });
  const [retryToken, setRetryToken] = useState(0);
  // Anime already shown, so a ref expands to every known source id and the
  // detail view has something to render while recommendations load.
  const knownAnime = useRef(new Map<string, Anime>());

  useEffect(() => {
    setRoute(readRoute());
    setIncludeAdultState(localStorage.getItem(ADULT_STORAGE_KEY) === "true");
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback(
    (next: Route) => {
      if (route.query === next.query && route.animeRef === next.animeRef) {
        // Re-submitting the current route acts as a retry.
        setRetryToken((n) => n + 1);
      } else {
        window.history.pushState(null, "", routeUrl(next));
        setRoute(next);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [route],
  );

  const onHome = !route.query && !route.animeRef;
  useEffect(() => {
    if (!onHome || trending.status === "success") return;
    const controller = new AbortController();
    setTrending({ status: "loading" });
    getTrending({ signal: controller.signal })
      .then((data) => {
        for (const anime of data) knownAnime.current.set(anime.id, anime);
        setTrending({ status: "success", data });
      })
      .catch((error) => {
        if (!isAbortError(error)) setTrending({ status: "error", message: errorMessage(error, "load trending anime") });
      });
    return () => controller.abort();
    // `trending.status` is deliberately not a dependency: retries go through retryToken.
  }, [onHome, retryToken]);

  useEffect(() => {
    if (!route.query) {
      setSearch({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setSearch({ status: "loading" });
    searchAnime(route.query, { includeAdult }, { signal: controller.signal })
      .then((data) => {
        for (const anime of data.results) knownAnime.current.set(anime.id, anime);
        setSearch({ status: "success", data });
      })
      .catch((error) => {
        if (!isAbortError(error)) setSearch({ status: "error", message: errorMessage(error, "search") });
      });
    return () => controller.abort();
  }, [route.query, includeAdult, retryToken]);

  useEffect(() => {
    if (!route.animeRef) {
      setDetails({ status: "idle" });
      return;
    }
    const ids: ExternalIds | null = knownAnime.current.get(route.animeRef)?.ids ?? parseRef(route.animeRef);
    if (!ids) {
      setDetails({ status: "error", message: "That anime link is invalid." });
      return;
    }
    const controller = new AbortController();
    setDetails({ status: "loading" });
    getRecommendations(ids, { includeAdult }, { signal: controller.signal })
      .then((data) => {
        for (const rec of data.recommendations) knownAnime.current.set(rec.anime.id, rec.anime);
        setDetails({ status: "success", data });
      })
      .catch((error) => {
        if (!isAbortError(error)) {
          setDetails({ status: "error", message: errorMessage(error, "load recommendations") });
        }
      });
    return () => controller.abort();
  }, [route.animeRef, includeAdult, retryToken]);

  const setIncludeAdult = useCallback((value: boolean) => {
    localStorage.setItem(ADULT_STORAGE_KEY, String(value));
    setIncludeAdultState(value);
  }, []);

  const selectAnime = useCallback(
    (anime: Anime) => {
      knownAnime.current.set(anime.id, anime);
      navigate({ query: route.query, animeRef: anime.id });
    },
    [navigate, route.query],
  );

  return {
    route,
    search,
    details,
    trending,
    includeAdult,
    previewAnime: route.animeRef ? knownAnime.current.get(route.animeRef) : undefined,
    setIncludeAdult,
    selectAnime,
    submitSearch: (query: string) => navigate({ query: query.trim(), animeRef: null }),
    backToResults: () => navigate({ query: route.query, animeRef: null }),
    goHome: () => navigate({ query: "", animeRef: null }),
    retry: () => setRetryToken((n) => n + 1),
  };
}
