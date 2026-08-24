import { describe, expect, it } from "vitest";
import type { Post } from "@/types";
import {
	buildArticleJsonLd,
	buildWebSiteJsonLd,
	ensureModifiedDateNotBeforePublished,
	getArticleModifiedDate,
	toCanonicalUrl,
} from "./seo";

const post: Post = {
	id: "post-id",
	title: "Post title",
	slug: "post-title",
	type: "publication",
	status: "Published",
	description: "Post description",
	tags: [],
	lastUpdated: null,
	lastEditedTime: "2026-03-21T10:30:00.000Z",
	createdTime: "2026-03-19T10:30:00.000Z",
	publishedDate: "2026-03-20",
	blocks: [],
};

describe("toCanonicalUrl", () => {
	it("uses extensionless URLs for Astro file build output", () => {
		expect(toCanonicalUrl(new URL("https://example.com/publications.html"))).toBe(
			"https://non.salon/publications",
		);
	});

	it("normalizes detail pages and strips query and hash", () => {
		expect(
			toCanonicalUrl(new URL("https://example.com/publication/post-title.html?ref=feed#code")),
		).toBe("https://non.salon/publication/post-title");
	});

	it("keeps the root canonical URL identical to the site URL", () => {
		expect(toCanonicalUrl(new URL("https://example.com/index.html"))).toBe("https://non.salon");
	});
});

describe("getArticleModifiedDate", () => {
	it("prefers explicit Last Updated metadata", () => {
		expect(getArticleModifiedDate({ ...post, lastUpdated: "2026-03-22" })).toBe("2026-03-22");
	});

	it("falls back to the Notion last edited date", () => {
		expect(getArticleModifiedDate(post)).toBe("2026-03-21");
	});

	it("never returns a modification date earlier than the published date", () => {
		expect(getArticleModifiedDate({ ...post, lastUpdated: "2026-03-19" }, "2026-03-20")).toBe(
			"2026-03-20",
		);
	});
});

describe("ensureModifiedDateNotBeforePublished", () => {
	it("preserves dates that are later than publication", () => {
		expect(ensureModifiedDateNotBeforePublished("2026-03-20", "2026-03-22")).toBe("2026-03-22");
	});

	it("uses the published date when the source modification date predates it", () => {
		expect(ensureModifiedDateNotBeforePublished("2026-03-20", "2026-03-19")).toBe("2026-03-20");
	});
});

describe("buildWebSiteJsonLd", () => {
	it("includes site entity metadata", () => {
		const jsonLd = buildWebSiteJsonLd("Archived Web Logs");

		expect(jsonLd).toMatchObject({
			"@context": "https://schema.org",
			"@type": "WebSite",
			name: "non.salon",
			url: "https://non.salon",
			description: "Archived Web Logs",
			inLanguage: "ko-KR",
		});
		expect(jsonLd.sameAs).toContain("https://github.com/songforthemute");
	});
});

describe("buildArticleJsonLd", () => {
	it("includes article entity metadata", () => {
		const jsonLd = buildArticleJsonLd({
			title: "Post title",
			description: "Post description",
			canonicalUrl: "https://non.salon/publication/post-title",
			imageUrl: "https://non.salon/og/publication-post-title.png",
			publishedDate: "2026-03-20",
			modifiedDate: "2026-03-22",
			section: "publication",
			tags: ["React", "AI"],
		});

		expect(jsonLd).toMatchObject({
			"@context": "https://schema.org",
			"@type": "Article",
			headline: "Post title",
			description: "Post description",
			mainEntityOfPage: "https://non.salon/publication/post-title",
			inLanguage: "ko-KR",
			articleSection: "publication",
			keywords: ["React", "AI"],
		});
		expect(jsonLd.author).toMatchObject({
			"@type": "Person",
			name: "songforthemute",
			url: "https://github.com/songforthemute",
		});
	});

	it("keeps structured-data dates in chronological order", () => {
		const jsonLd = buildArticleJsonLd({
			title: "Post title",
			description: "Post description",
			canonicalUrl: "https://non.salon/publication/post-title",
			imageUrl: "https://non.salon/og/publication-post-title.png",
			publishedDate: "2026-03-20",
			modifiedDate: "2026-03-19",
			section: "publication",
			tags: [],
		});

		expect(jsonLd.dateModified).toBe("2026-03-20");
	});
});
