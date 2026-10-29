import { useEffect, useState, type SubmitEvent } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchFormProps {
  query: string;
  searching: boolean;
  onSearch: (query: string) => void;
  size: "hero" | "bar";
}

function SearchForm({ query, searching, onSearch, size }: SearchFormProps) {
  const [value, setValue] = useState(query);
  // Keep the input in sync with back/forward navigation.
  useEffect(() => setValue(query), [query]);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim()) onSearch(value);
  };
  const hero = size === "hero";

  return (
    <form
      onSubmit={submit}
      role="search"
      className={cn(
        "group relative flex w-full min-w-0 items-center rounded-2xl border border-white/10 bg-white/[0.04] transition focus-within:border-violet-400/50 focus-within:bg-white/[0.07] focus-within:shadow-[0_0_0_4px_rgb(139_92_246/0.15)]",
        hero ? "h-16 max-w-2xl pl-5 pr-2" : "h-11 max-w-xl pl-4 pr-1.5",
      )}
    >
      <Search className={cn("shrink-0 text-white/40", hero ? "size-5" : "size-4")} aria-hidden />
      <label className="sr-only" htmlFor={`search-${size}`}>
        Anime title
      </label>
      <input
        id={`search-${size}`}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={hero ? "Search an anime you love…" : "Search anime…"}
        autoFocus={hero}
        autoComplete="off"
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent px-3 text-white placeholder:text-white/35 focus:outline-none",
          hero ? "text-lg" : "text-sm",
        )}
      />
      <button
        type="submit"
        disabled={searching || !value.trim()}
        className={cn(
          "bg-accent-gradient inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50",
          hero ? "h-12 px-6" : "h-8 px-3.5 text-sm",
        )}
      >
        {searching ? <Loader2 className="size-4 animate-spin" aria-label="Searching" /> : hero ? "Find matches" : "Search"}
      </button>
    </form>
  );
}

function Logo({ onHome, compact }: { onHome: () => void; compact: boolean }) {
  return (
    <a
      href="/"
      onClick={(event) => {
        event.preventDefault();
        onHome();
      }}
      className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
    >
      <span className="bg-accent-gradient grid size-8 place-items-center rounded-xl shadow-lg shadow-fuchsia-900/40">
        <Sparkles className="size-4 text-white" aria-hidden />
      </span>
      <span className={cn("font-display font-bold tracking-tight text-white", compact ? "hidden text-lg sm:inline" : "text-xl")}>
        AniMatch
      </span>
    </a>
  );
}

interface HeaderProps {
  /** Compact sticky bar once the user has searched or opened an anime. */
  compact: boolean;
  query: string;
  searching: boolean;
  onSearch: (query: string) => void;
  onHome: () => void;
}

export function Header({ compact, query, searching, onSearch, onHome }: HeaderProps) {
  if (compact) {
    return (
      <header className="sticky top-0 z-30 mb-8 border-b border-white/[0.06] bg-[#07060d]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:gap-8">
          <Logo onHome={onHome} compact />
          <SearchForm query={query} searching={searching} onSearch={onSearch} size="bar" />
        </div>
      </header>
    );
  }

  return (
    <header className="mx-auto flex max-w-7xl flex-col items-center px-4 pb-14 pt-6 text-center">
      <div className="self-start">
        <Logo onHome={onHome} compact={false} />
      </div>
      <p className="mt-[12vh] inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/60">
        <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
        AniList · MyAnimeList · Kitsu
      </p>
      <h1 className="font-display mt-6 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-7xl">
        Loved an anime?{" "}<span className="text-gradient block">Find your next one.</span>
      </h1>
      <p className="mt-5 max-w-xl text-base text-white/55 md:text-lg">
        Pick a title and get community recommendations ranked by how closely they match its genres, themes and
        style — sequels grouped, not spammed.
      </p>
      <div className="mt-10 flex w-full justify-center">
        <SearchForm query={query} searching={searching} onSearch={onSearch} size="hero" />
      </div>
    </header>
  );
}
