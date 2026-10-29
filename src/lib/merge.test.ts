import { describe, expect, it } from "vitest";
import { mergeCandidates, mergeSearchResults } from "./merge";
import type { Anime } from "./types";

function anime(overrides: Partial<Anime> & Pick<Anime, "ids">): Anime {
  return {
    id: "x",
    title: { romaji: "Untitled" },
    genres: [],
    tags: [],
    studios: [],
    isAdult: false,
    ...overrides,
  };
}

describe("mergeSearchResults", () => {
  it("joins records across sources through shared ids and keeps the AniList data", () => {
    const aniList = anime({ ids: { anilist: 1, mal: 10 }, title: { romaji: "Frieren" }, averageScore: 91 });
    const jikan = anime({ ids: { mal: 10 }, title: { romaji: "Sousou no Frieren" }, averageScore: 93 });
    const kitsu = anime({ ids: { kitsu: 5, mal: 10 }, studios: ["Madhouse"] });

    const [merged, ...rest] = mergeSearchResults([[aniList], [jikan], [kitsu]]);

    expect(rest).toHaveLength(0);
    expect(merged.ids).toEqual({ anilist: 1, mal: 10, kitsu: 5 });
    expect(merged.id).toBe("anilist-1");
    expect(merged.title.romaji).toBe("Frieren");
    expect(merged.averageScore).toBe(91);
    // Empty arrays on the primary are backfilled.
    expect(merged.studios).toEqual(["Madhouse"]);
  });

  it("falls back to title + year, but never merges conflicting ids", () => {
    const a = anime({ ids: { anilist: 1 }, title: { romaji: "Hunter x Hunter" }, year: 2011 });
    const sameTitle = anime({ ids: { kitsu: 2 }, title: { romaji: "Hunter X Hunter!" }, year: 2011 });
    const remake = anime({ ids: { anilist: 99 }, title: { romaji: "Hunter x Hunter" }, year: 2011 });

    const merged = mergeSearchResults([[a, remake], [sameTitle]]);

    expect(merged).toHaveLength(2);
    expect(merged[0].ids).toEqual({ anilist: 1, kitsu: 2 });
  });

  it("ranks titles every source agrees on above single-source top hits", () => {
    const shared = (n: number) => anime({ ids: { mal: 1 }, id: `s${n}` });
    const onlyAniList = anime({ ids: { anilist: 7 } });

    const merged = mergeSearchResults([[onlyAniList, shared(1)], [shared(2)], [shared(3)]]);

    expect(merged[0].ids.mal).toBe(1);
  });
});

describe("mergeCandidates", () => {
  it("sums votes for the same anime and ignores negative votes from later sources", () => {
    const merged = mergeCandidates([
      [{ anime: anime({ ids: { anilist: 1, mal: 10 } }), votes: 40 }],
      [
        { anime: anime({ ids: { mal: 10 } }), votes: 12 },
        { anime: anime({ ids: { mal: 10 } }), votes: -5 },
        { anime: anime({ ids: { mal: 11 } }), votes: 3 },
      ],
    ]);

    expect(merged.map((c) => c.votes)).toEqual([52, 3]);
  });
});
