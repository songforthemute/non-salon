import { describe, expect, it } from "vitest";
import { buildSitemapLastmodMap } from "./sitemap-lastmod.mjs";

describe("buildSitemapLastmodMap", () => {
	it("maps regular posts and section index pages to their latest ISO lastmod while excluding TIL", () => {
		const posts = [
			{
				slug: "pub-1",
				type: "publication",
				publishedDate: "2026-03-20",
				lastUpdated: "2026-03-25",
				lastEditedTime: "2026-03-21T00:00:00.000Z",
			},
			{
				slug: "thought-1",
				type: "thought",
				publishedDate: "2026-04-10",
				lastUpdated: "2026-04-01",
				lastEditedTime: "2026-04-01T00:00:00.000Z",
			},
			{
				slug: "til-1",
				type: "til",
				publishedDate: "2026-09-01",
				lastUpdated: null,
				lastEditedTime: "2026-09-01T00:00:00.000Z",
			},
		];

		const map = buildSitemapLastmodMap(posts, {}, "https://non.salon");

		expect(map.get("https://non.salon/publication/pub-1")).toBe("2026-03-25T00:00:00.000Z");
		// Never earlier than publishedDate
		expect(map.get("https://non.salon/thought/thought-1")).toBe("2026-04-10T00:00:00.000Z");
		expect(map.get("https://non.salon/publications")).toBe("2026-03-25T00:00:00.000Z");
		expect(map.get("https://non.salon/thoughts")).toBe("2026-04-10T00:00:00.000Z");
		expect(map.get("https://non.salon/archive")).toBe("2026-04-10T00:00:00.000Z");
		expect(map.get("https://non.salon")).toBe("2026-04-10T00:00:00.000Z");
		expect(map.has("https://non.salon/til/til-1")).toBe(false);
	});
});
