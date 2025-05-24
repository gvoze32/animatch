// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
// import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  adapter: netlify(),
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [react()],
});