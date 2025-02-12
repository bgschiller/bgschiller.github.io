import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import alpinejs from "@astrojs/alpinejs";

// https://astro.build/config
export default defineConfig({
  redirects: {
    "/blog/2024/12/02/constraint-solving-in-spreadsheets": {
      status: 301,
      destination: "/blog/2025/02/11/constraint-solving-in-spreadsheets",
    },
  },
  site: "https://brianschiller.com",
  integrations: [
    mdx(),
    sitemap(),
    tailwind(),
    alpinejs({
      entrypoint: "src/entrypoints/alpine.ts",
    }),
  ],
});
