// Export all data sources and related types
export * from "./base.js";
export * from "./anilist.js";
export * from "./myanimelist.js";
export * from "./kitsu.js";
export * from "./animethemes.js";
export * from "./consumet.js";
export * from "./jikan.js";
export * from "./tmdb.js";
export * from "./trackt.js";
export * from "./aggregator.js";

// Export default aggregator instance
export { DataAggregator as default } from "./aggregator.js";
