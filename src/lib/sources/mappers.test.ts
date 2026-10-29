import { describe, expect, it } from "vitest";
import { parseRef, toPlainText, toRef } from "../anime";
import { mapJikanAnime } from "./jikan";
import { mapKitsuResponse } from "./kitsu";

describe("refs", () => {
  it("round-trips the preferred source id", () => {
    expect(toRef({ kitsu: 3, mal: 20 })).toBe("mal-20");
    expect(parseRef("mal-20")).toEqual({ mal: 20 });
  });

  it("rejects unknown sources and malformed ids", () => {
    expect(parseRef("consumet-one-piece")).toBeNull();
    expect(parseRef("anilist-12abc")).toBeNull();
  });
});

describe("toPlainText", () => {
  it("strips tags and decodes entities from descriptions", () => {
    expect(toPlainText("Tom &amp; Jerry<br>are <i>back</i> &#8212; again&quot;")).toBe(
      'Tom & Jerry\nare back — again"',
    );
  });
});

describe("mapJikanAnime", () => {
  const base = {
    mal_id: 52991,
    images: { jpg: { image_url: "s.jpg", large_image_url: "l.jpg" } },
    title: "Sousou no Frieren",
    title_english: "Frieren",
    title_japanese: "葬送のフリーレン",
    type: "TV",
    episodes: 28,
    status: "Finished Airing",
    rating: "PG-13 - Teens 13 or older",
    score: 9.31,
    popularity: 150,
    synopsis: "…",
    year: null,
    aired: { prop: { from: { year: 2023 } } },
    studios: [{ name: "Madhouse" }],
    genres: [{ name: "Adventure" }, { name: "Award Winning" }],
    themes: [{ name: "Elf" }],
    demographics: [{ name: "Shounen" }],
  };

  it("normalises score, year, genres and keeps non-AniList genres as tags", () => {
    const anime = mapJikanAnime(base);
    expect(anime.id).toBe("mal-52991");
    expect(anime.averageScore).toBe(93);
    expect(anime.year).toBe(2023);
    expect(anime.status).toBe("FINISHED");
    expect(anime.genres).toEqual(["Adventure"]);
    expect(anime.tags.map((t) => t.name)).toEqual(["Award Winning", "Elf", "Shounen"]);
    expect(anime.isAdult).toBe(false);
  });

  it("flags Rx ratings as adult", () => {
    expect(mapJikanAnime({ ...base, rating: "Rx - Hentai" }).isAdult).toBe(true);
  });
});

describe("mapKitsuResponse", () => {
  it("resolves included categories and AniList/MAL mappings", () => {
    const [anime] = mapKitsuResponse({
      data: [
        {
          id: "46474",
          attributes: {
            canonicalTitle: "Sousou no Frieren",
            titles: { en: "Frieren", en_jp: "Sousou no Frieren", ja_jp: null },
            synopsis: null,
            posterImage: { large: "p.jpg" },
            coverImage: null,
            averageRating: "88.85",
            episodeCount: 28,
            subtype: "TV",
            status: "finished",
            startDate: "2023-09-29",
            nsfw: false,
            ageRating: "PG",
          },
          relationships: {
            categories: { data: [{ type: "categories", id: "1" }, { type: "categories", id: "2" }] },
            mappings: { data: [{ type: "mappings", id: "9" }, { type: "mappings", id: "8" }] },
          },
        },
      ],
      included: [
        { type: "categories", id: "1", attributes: { title: "Science Fiction" } },
        { type: "categories", id: "2", attributes: { title: "Elf" } },
        { type: "mappings", id: "9", attributes: { externalSite: "myanimelist/anime", externalId: "52991" } },
        { type: "mappings", id: "8", attributes: { externalSite: "anilist/anime", externalId: "154587" } },
      ],
    });

    expect(anime.ids).toEqual({ kitsu: 46474, mal: 52991, anilist: 154587 });
    expect(anime.genres).toEqual(["Sci-Fi"]);
    expect(anime.tags).toEqual([{ name: "Elf", rank: 100 }]);
    expect(anime.averageScore).toBe(89);
    expect(anime.year).toBe(2023);
  });
});
