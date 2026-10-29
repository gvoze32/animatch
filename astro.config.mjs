// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import netlify from "@astrojs/netlify";

// Every page is prerendered; the app fetches anime APIs from the browser so
// rate limits are spread across visitors instead of one server IP.
export default defineConfig({
  // No edge functions or Netlify Image CDN are used, so skip their local emulation
  // (it needs a Deno runtime and crashes `astro dev` without one).
  adapter: netlify({ devFeatures: false }),
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react()],
});
