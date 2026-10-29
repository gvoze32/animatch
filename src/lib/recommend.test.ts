import { describe, expect, it } from "vitest";
import { titleRoot } from "./franchise";
import { rankRecommendations } from "./recommend";
import type { Anime } from "./types";

function anime(overrides: Partial<Anime> & Pick<Anime, "ids">): Anime {
  return {
    id: "x",
    title: { romaji: `Untitled ${JSON.stringify(overrides.ids)}` },
    genres: [],
    tags: [],
    studios: [],
    isAdult: false,
    ...overrides,
  };
}

const source = anime({
  ids: { anilist: 1, mal: 10 },
  title: { romaji: "Sousou no Frieren" },
  genres: ["Adventure", "Drama", "Fantasy"],
  tags: [
    { name: "Magic", rank: 90 },
    { name: "Elf", rank: 85 },
    { name: "Travel", rank: 80 },
  ],
  studios: ["Madhouse"],
  year: 2023,
  franchiseIds: [2],
});

const twin = (ids: Anime["ids"], extra: Partial<Anime> = {}) =>
  anime({ ids, genres: source.genres, tags: source.tags, year: 2023, ...extra });

describe("rankRecommendations", () => {
  it("drops the source itself (matched by any id), adult titles and negatively voted pairs", () => {
    const { recommendations } = rankRecommendations(source, [
      { anime: anime({ ids: { mal: 10 } }), votes: 100 },
      { anime: anime({ ids: { anilist: 20 }, isAdult: true }), votes: 50 },
      { anime: anime({ ids: { anilist: 30 } }), votes: -4 },
      { anime: anime({ ids: { anilist: 40 } }), votes: 1 },
    ]);
    expect(recommendations.map((r) => r.anime.ids.anilist)).toEqual([40]);
  });

  it("moves the source's own franchise (relations or title root) into sameSeries", () => {
    const { recommendations, sameSeries } = rankRecommendations(source, [
      { anime: twin({ anilist: 2 }, { year: 2026 }), votes: 300 },
      { anime: twin({ anilist: 3 }, { title: { romaji: "Sousou no Frieren 2nd Season" }, year: 2027 }), votes: 200 },
      { anime: twin({ anilist: 4 }), votes: 10 },
    ]);
    expect(sameSeries.map((a) => a.ids.anilist)).toEqual([2, 3]);
    expect(recommendations.map((r) => r.anime.ids.anilist)).toEqual([4]);
  });

  it("collapses other franchises into their best entry and lists the rest as related", () => {
    const { recommendations } = rankRecommendations(source, [
      { anime: twin({ anilist: 50 }, { franchiseIds: [51], year: 2016 }), votes: 900 },
      { anime: twin({ anilist: 51 }, { year: 2020 }), votes: 100 },
      { anime: twin({ anilist: 52 }, { franchiseIds: [51], year: 2024 }), votes: 50 },
      { anime: twin({ anilist: 60 }), votes: 80 },
    ]);
    expect(recommendations.map((r) => r.anime.ids.anilist)).toEqual([50, 60]);
    expect(recommendations[0].related.map((a) => a.ids.anilist)).toEqual([51, 52]);
  });

  it("scores each pair absolutely, independent of the other candidates", () => {
    const candidate = { anime: twin({ anilist: 70 }, { genres: ["Drama"] }), votes: 40 };
    const alone = rankRecommendations(source, [candidate]).recommendations[0].score;
    const crowded = rankRecommendations(source, [candidate, { anime: twin({ anilist: 71 }), votes: 5000 }])
      .recommendations.find((r) => r.anime.ids.anilist === 70)!.score;
    expect(crowded).toBe(alone);
  });

  it("calibrates: a near-identical, widely endorsed title scores high; an unrelated one low", () => {
    const { recommendations } = rankRecommendations(source, [
      { anime: twin({ anilist: 80 }, { studios: ["Madhouse"] }), votes: 1000 },
      { anime: anime({ ids: { anilist: 81 }, genres: ["Sports"], year: 1990 }), votes: 2 },
    ]);
    expect(recommendations[0].score).toBeGreaterThan(0.9);
    expect(recommendations[1].score).toBeLessThan(0.1);
  });

  it("breaks equal percentages by rating, and a shared studio alone can't beat better content", () => {
    const { recommendations } = rankRecommendations(source, [
      { anime: twin({ anilist: 90 }, { averageScore: 70 }), votes: 100 },
      { anime: twin({ anilist: 91 }, { averageScore: 88 }), votes: 100 },
      { anime: anime({ ids: { anilist: 92 }, genres: ["Drama"], studios: ["Madhouse"], year: 2023 }), votes: 100 },
    ]);
    expect(recommendations.map((r) => r.anime.ids.anilist)).toEqual([91, 90, 92]);
  });

  it("explains matches with shared genres, tags, studio and votes", () => {
    const { recommendations } = rankRecommendations(source, [
      { anime: twin({ anilist: 95 }, { studios: ["Madhouse"] }), votes: 30 },
    ]);
    expect(recommendations[0].reasons.map((r) => r.label)).toEqual([
      "Adventure",
      "Drama",
      "Fantasy",
      "Magic",
      "Elf",
      "Madhouse",
      "30 fans recommend",
    ]);
  });
});

describe("titleRoot", () => {
  it.each([
    ["Re:Zero kara Hajimeru Isekai Seikatsu 2nd Season Part 2", "re:zero kara hajimeru isekai seikatsu"],
    ["Shingeki no Kyojin: The Final Season", "shingeki no kyojin"],
    ["Mob Psycho 100 III", "mob psycho 100"],
    ["Hunter x Hunter (2011)", "hunter x hunter"],
    ["Steins;Gate 0", "steins;gate 0"],
    ["Hawaii", "hawaii"],
  ])("%s → %s", (title, root) => {
    expect(titleRoot(anime({ ids: { anilist: 1 }, title: { romaji: title } }))).toBe(root);
  });
});
