# AniMatch

Search for an anime you love and get a ranked list of what to watch next.

## How it works

- **Search** queries AniList, MyAnimeList (via [Jikan](https://jikan.moe)) and Kitsu in parallel. Results are de-duplicated through cross-source ids (AniList `idMal`, Kitsu mappings, falling back to title + year) and ranked with reciprocal rank fusion.
- **Recommendations** start from AniList and MyAnimeList community recommendations. Each one gets an absolute match score:
  - 60% content: genre coverage, overlap with the original's 12 most defining tags (broad cast tags like "Male Protagonist" count 30%), release era, studio (5%).
  - 40% community: votes on a log scale, where 1,000+ votes counts in full.
  - Equal percentages are broken by rating.
- **Franchises** are detected through AniList relations (sequel, prequel, side story, spin-off, alternative…) plus a title-root fallback. Seasons of a recommended show collapse into one card ("+N more in series"). The selected show's own sequels appear separately under "More from this series".
- **Resilience**: a source that fails or lags is dropped 2.5 s after the first source answers, and the UI marks the results as partial.
- **Shareable URLs**: `/?q=frieren&anime=anilist-154587`. Refs use `anilist-<id>`, `mal-<id>` or `kitsu-<id>`, and the back button works.
- Everything runs in the browser, so API rate limits apply per visitor. There are no API keys to configure.

## Development

Requires Node ≥ 22.23.

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # vitest: merging, ranking/franchise grouping, source mappers
npm run check    # astro/TypeScript diagnostics
npm run build    # production build (Netlify adapter, all pages prerendered)
```

## Project structure

```
src/
  components/        React UI (AniMatchApp, Header, SearchView/HomeView, AnimeDetailView, AnimeCard) + Footer.astro
  hooks/useAniMatch  URL-driven state, abortable requests, trending, 18+ preference
  lib/
    sources/         AniList (GraphQL), Jikan, Kitsu clients + mappers
    merge.ts         cross-source de-duplication and rank fusion
    franchise.ts     franchise grouping (relations + title roots)
    recommend.ts     match scoring, franchise collapsing, explanations
    service.ts       search / recommendations / trending orchestration and caching
  layouts/, pages/   Astro shell, index and 404
```

## Tech

[Astro 7](https://astro.build), [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com) with tw-animate-css, [Lucide](https://lucide.dev), TypeScript 6, Vitest 5.

## License

MIT
