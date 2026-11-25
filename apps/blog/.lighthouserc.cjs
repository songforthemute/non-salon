/** @type {import('@lhci/cli/src/config.js').LHCIConfig} */
module.exports = {
	ci: {
		collect: {
			startServerCommand: "pnpm preview --host 127.0.0.1 --port 4321",
			startServerReadyPattern: "Local",
			startServerReadyTimeout: 10_000,
			url: [
				"http://127.0.0.1:4321/",
				"http://127.0.0.1:4321/archive.html",
				"http://127.0.0.1:4321/publication/ci-fixture-publication.html",
			],
			numberOfRuns: 3,
			settings: {
				formFactor: "mobile",
			},
		},
		assert: {
			assertions: {
				"categories:seo": ["error", { minScore: 0.95 }],
				"categories:accessibility": ["error", { minScore: 0.85 }],
				"categories:best-practices": ["error", { minScore: 0.85 }],
				"categories:performance": ["error", { minScore: 0.7 }],
				"largest-contentful-paint": ["error", { maxNumericValue: 3_500 }],
				"cumulative-layout-shift": ["error", { maxNumericValue: 0.15 }],
				"total-blocking-time": ["error", { maxNumericValue: 700 }],
			},
		},
		upload: {
			target: "filesystem",
			outputDir: ".lighthouseci",
		},
	},
};
