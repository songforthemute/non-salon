import { describe, expect, it } from "vitest";
import type { Post } from "@/types";
import { buildLlmsTxt } from "./llms";

const posts: Post[] = [
	{
		id: "post-id",
		title: "Example Publication",
		slug: "example-publication",
		type: "publication",
		status: "Published",
		description: "A long-form technical essay.",
		tags: ["AI", "React"],
		lastUpdated: null,
		lastEditedTime: "2026-03-21T10:30:00.000Z",
		createdTime: "2026-03-19T10:30:00.000Z",
		publishedDate: "2026-03-20",
		blocks: [],
	},
];

describe("buildLlmsTxt", () => {
	it("builds a markdown site map for LLM agents", () => {
		const text = buildLlmsTxt(posts);

		expect(text).toContain("# non.salon");
		expect(text).toContain("> Archived Web Logs");
		expect(text).toContain("## Publications");
		expect(text).toContain(
			"- [Example Publication](https://non.salon/publication/example-publication): A long-form technical essay.",
		);
		expect(text).toContain("## Feeds");
		expect(text).toContain("[RSS](https://non.salon/feed.xml)");
		expect(text).not.toContain("undefined");
	});
});
