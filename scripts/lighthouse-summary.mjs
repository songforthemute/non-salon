import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const REPORTS_DIR = join(process.cwd(), ".lighthouseci");
const SCORE_CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const VITALS = [
	["largest-contentful-paint", "LCP", (value) => `${(value / 1_000).toFixed(2)} s`],
	["cumulative-layout-shift", "CLS", (value) => value.toFixed(3)],
	["total-blocking-time", "TBT", (value) => `${Math.round(value)} ms`],
];

function median(values) {
	const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
	if (ordered.length === 0) return undefined;
	const middle = Math.floor(ordered.length / 2);
	return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
}

function displayUrl(url) {
	try {
		const parsed = new URL(url);
		return parsed.pathname || "/";
	} catch {
		return url;
	}
}

async function main() {
	let names;
	try {
		names = await readdir(REPORTS_DIR);
	} catch {
		console.log("## Lighthouse CI\n\nNo Lighthouse reports were generated.");
		return;
	}

	const reports = await Promise.all(
		names
			.filter((name) => name.startsWith("lhr-") && name.endsWith(".json"))
			.map(async (name) => JSON.parse(await readFile(join(REPORTS_DIR, name), "utf8"))),
	);

	if (reports.length === 0) {
		console.log("## Lighthouse CI\n\nNo Lighthouse reports were generated.");
		return;
	}

	const byUrl = new Map();
	for (const report of reports) {
		const url = displayUrl(report.finalUrl || report.requestedUrl || "unknown URL");
		const results = byUrl.get(url) ?? [];
		results.push(report);
		byUrl.set(url, results);
	}

	const lines = [
		"## Lighthouse CI",
		"",
		"Median of three mobile Lighthouse runs per page.",
		"",
		"| Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |",
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
	];

	for (const [url, urlReports] of byUrl) {
		const scores = SCORE_CATEGORIES.map((category) => {
			const score = median(urlReports.map((report) => report.categories?.[category]?.score));
			return score === undefined ? "—" : `${Math.round(score * 100)}`;
		});
		const vitals = VITALS.map(([audit, _label, format]) => {
			const value = median(urlReports.map((report) => report.audits?.[audit]?.numericValue));
			return value === undefined ? "—" : format(value);
		});
		lines.push(`| \`${url}\` | ${[...scores, ...vitals].join(" | ")} |`);
	}

	console.log(lines.join("\n"));
}

main().catch((error) => {
	console.error("Unable to summarize Lighthouse results:", error);
	process.exitCode = 1;
});
