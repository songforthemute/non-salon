import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://non.salon",
	integrations: [sitemap()],
	output: "static",
	build: {
		format: "file",
	},
});
