import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/**/*.ts", "scripts/**/*.ts"],
			exclude: ["**/*.test.ts", "**/*.d.ts"],
		},
	},
	resolve: {
		alias: {
			"@": "./src",
		},
	},
});
