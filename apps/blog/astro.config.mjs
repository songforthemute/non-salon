import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { loadSitemapLastmodMap } from "./scripts/sitemap-lastmod.mjs";

const SITE_URL = "https://non.salon";
let lastmodMap;

export default defineConfig({
	site: SITE_URL,
	integrations: [
		sitemap({
			filter: (page) => !page.includes("/404") && !/^https:\/\/[^/]+\/til(?:\/|$)/.test(page),
			serialize(item) {
				lastmodMap ??= loadSitemapLastmodMap(process.cwd(), SITE_URL);
				const normalizedUrl =
					item.url.endsWith("/") && item.url !== `${SITE_URL}/` ? item.url.slice(0, -1) : item.url;
				const lastmod = lastmodMap.get(normalizedUrl) ?? lastmodMap.get(item.url);
				return lastmod ? { ...item, lastmod } : item;
			},
		}),
	],
	output: "static",
	build: {
		format: "file",
	},
});
