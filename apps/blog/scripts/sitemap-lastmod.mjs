import fs from "node:fs";
import path from "node:path";

const REGULAR_TYPES = new Set(["publication", "thought", "notebook"]);

function resolveModifiedDate(post, publishedDates) {
	const publishedDate = post.publishedDate || publishedDates[post.slug] || undefined;
	const rawModified = (post.lastUpdated || post.lastEditedTime || "").split("T")[0];
	if (!rawModified) return publishedDate;
	if (publishedDate && rawModified < publishedDate) return publishedDate;
	return rawModified;
}

function toIsoLastmod(dateString) {
	if (!dateString) return undefined;
	const normalized = dateString.includes("T") ? dateString : `${dateString}T00:00:00.000Z`;
	const timestamp = Date.parse(normalized);
	return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

export function buildSitemapLastmodMap(posts, publishedDates = {}, siteUrl = "https://non.salon") {
	const baseUrl = siteUrl.replace(/\/$/, "");
	const map = new Map();
	const latestBySection = new Map();
	let latestOverall;

	const trackLatest = (key, isoDate) => {
		if (!isoDate) return;
		const existing = latestBySection.get(key);
		if (!existing || isoDate > existing) {
			latestBySection.set(key, isoDate);
		}
		if (!latestOverall || isoDate > latestOverall) {
			latestOverall = isoDate;
		}
	};

	for (const post of posts) {
		if (!REGULAR_TYPES.has(post.type) || !post.slug) continue;
		const isoDate = toIsoLastmod(resolveModifiedDate(post, publishedDates));
		if (!isoDate) continue;

		map.set(`${baseUrl}/${post.type}/${post.slug}`, isoDate);
		trackLatest(`${post.type}s`, isoDate);
	}

	if (latestOverall) {
		map.set(baseUrl, latestOverall);
		map.set(`${baseUrl}/`, latestOverall);
		map.set(`${baseUrl}/archive`, latestOverall);
	}

	for (const [section, isoDate] of latestBySection) {
		map.set(`${baseUrl}/${section}`, isoDate);
	}

	return map;
}

export function loadSitemapLastmodMap(baseDir = process.cwd(), siteUrl = "https://non.salon") {
	const postsPath = path.join(baseDir, "data/posts.json");
	if (!fs.existsSync(postsPath)) return new Map();

	const publishedDatesPath = path.join(baseDir, "data/published-dates.json");
	const posts = JSON.parse(fs.readFileSync(postsPath, "utf-8"));
	const publishedDates = fs.existsSync(publishedDatesPath)
		? JSON.parse(fs.readFileSync(publishedDatesPath, "utf-8"))
		: {};

	return buildSitemapLastmodMap(posts, publishedDates, siteUrl);
}
