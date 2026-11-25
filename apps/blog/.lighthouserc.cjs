const COMMON_ASSERTIONS = {
	"categories:accessibility": ["error", { minScore: 0.85 }],
	"categories:best-practices": ["error", { minScore: 0.85 }],
	"categories:performance": ["error", { minScore: 0.7 }],
	"largest-contentful-paint": ["error", { maxNumericValue: 3_500 }],
	"cumulative-layout-shift": ["error", { maxNumericValue: 0.15 }],
	"total-blocking-time": ["error", { maxNumericValue: 700 }],
};

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
				"http://127.0.0.1:4321/publications.html",
				"http://127.0.0.1:4321/thoughts.html",
				"http://127.0.0.1:4321/notebooks.html",
				"http://127.0.0.1:4321/til.html",
				"http://127.0.0.1:4321/publication/sticky-stuck-state-dynamic-styling.html",
				"http://127.0.0.1:4321/thought/magic-engineering.html",
				"http://127.0.0.1:4321/notebook/query-document-interaction.html",
				"http://127.0.0.1:4321/til/oct-10th-pnpm-turborepo.html",
				"http://127.0.0.1:4321/til/oct-12th-docker-cd.html",
			],
			numberOfRuns: 3,
			settings: {
				formFactor: "mobile",
			},
		},
		assert: {
			assertMatrix: [
				{
					matchingUrlPattern: "^http://127\\.0\\.0\\.1:4321/(?!til(?:\\.html|/|$))",
					assertions: {
						...COMMON_ASSERTIONS,
						"categories:seo": ["error", { minScore: 0.95 }],
					},
				},
				{
					// TIL pages intentionally use noindex, capping Lighthouse's SEO category score at 0.63.
					matchingUrlPattern: "^http://127\\.0\\.0\\.1:4321/til(?:\\.html|/|$)",
					assertions: {
						...COMMON_ASSERTIONS,
						"categories:seo": ["error", { minScore: 0.6 }],
						"crawlable-anchors": ["error", { minScore: 1 }],
						"document-title": ["error", { minScore: 1 }],
						"meta-description": ["error", { minScore: 1 }],
					},
				},
			],
		},
		upload: {
			target: "filesystem",
			outputDir: ".lighthouseci",
		},
	},
};
