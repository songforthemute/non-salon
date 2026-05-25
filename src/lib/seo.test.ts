import { describe, expect, it } from "vitest";
import type { Post } from "@/types";
import { getArticleModifiedDate, toCanonicalUrl } from "./seo";

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

	it("keeps the root canonical URL with a trailing slash", () => {
		expect(toCanonicalUrl(new URL("https://example.com/index.html"))).toBe("https://non.salon/");
	});
});

describe("getArticleModifiedDate", () => {
	it("prefers explicit Last Updated metadata", () => {
		expect(getArticleModifiedDate({ ...post, lastUpdated: "2026-03-22" })).toBe("2026-03-22");
	});

	it("falls back to the Notion last edited date", () => {
		expect(getArticleModifiedDate(post)).toBe("2026-03-21");
	});
});
