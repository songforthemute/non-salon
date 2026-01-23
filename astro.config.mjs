import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://whitespace.example.com", // TODO: 실제 도메인으로 변경
	integrations: [sitemap()],
	output: "static",
	build: {
		format: "file",
	},
});
