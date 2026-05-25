import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://non.salon",
	integrations: [
		sitemap({
			filter: (page) => !page.includes("/404"),
		}),
	],
	output: "static",
	build: {
		format: "file",
	},
});
