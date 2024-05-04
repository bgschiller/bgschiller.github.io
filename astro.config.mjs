import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import alpinejs from "@astrojs/alpinejs";

// https://astro.build/config
export default defineConfig({
  site: "https://astro-nano-demo.vercel.app",
  integrations: [
    mdx(),
    sitemap(),
    tailwind(),
    alpinejs({
      entrypoint: "src/entrypoints/alpine.ts",
    }),
  ],
});
