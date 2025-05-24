# AniMatch

AniMatch is an AI-powered anime recommendation web app that lets you search for your favorite anime and get similar recommendations from multiple popular data sources.

## Features

- **Anime Search**: Quickly find your favorite anime titles.
- **AI Recommendations**: Get content-based recommendations using genres, studios, scores, tags, and more.
- **Multi-Source Data**: Aggregates anime data from AniList, MyAnimeList, Kitsu, AnimeThemes, Consumet, Jikan, TMDB, and TrackT.

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/username/animatch.git
   cd animatch
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. Open [http://localhost:4321](http://localhost:4321) in your browser.

## Technologies Used

- [Astro](https://astro.build/) (main framework)
- [React](https://react.dev/) (UI components)
- [TailwindCSS](https://tailwindcss.com/) (styling)
- [Framer Motion](https://www.framer.com/motion/) (animations)
- [GraphQL Request](https://github.com/jasonkuhrt/graphql-request) (data fetching)
- [Lucide React](https://lucide.dev/) (icons)
- TypeScript

## Project Structure

```
src/
  components/      # React components (UI, Card, Recommendation, etc)
  lib/             # Core logic, services, data sources, utilities
  pages/           # Main pages (index, 404)
  styles/          # CSS/Tailwind files
  layouts/         # Astro layouts
public/            # Public assets (images, favicon, etc)
```

## Data Sources

AniMatch aggregates anime data from multiple APIs and sources:
- AniList
- MyAnimeList
- Kitsu
- AnimeThemes
- Consumet
- Jikan
- TMDB
- TrackT

## Configuration & Development

- Main configuration is in `astro.config.mjs` and `tsconfig.json`.
- For build and preview:
  ```bash
  npm run build
  npm run preview
  ```
- The project is ready to deploy to Netlify (see the adapter in `astro.config.mjs`).

## Contribution

Contributions are welcome! Please fork, create a branch, and submit a pull request.

## License

MIT 