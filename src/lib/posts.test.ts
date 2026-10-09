import { describe, expect, it } from "vitest";
import type { Post } from "@/types";
import { getLatestPosts, getRegularPosts, getTilPosts, getTilTopics, isTilPost } from "./posts";

function makePost(overrides: Partial<Post>): Post {
	return {
		id: "post-id",
		title: "Post title",
		slug: "post-slug",
		type: "thought",
		status: "Published",
		description: null,
		tags: [],
		lastUpdated: null,
		lastEditedTime: "2026-01-01T00:00:00.000Z",
		createdTime: "2026-01-01T00:00:00.000Z",
		publishedDate: null,
		blocks: [],
		...overrides,
	};
}

describe("getLatestPosts", () => {
	it("sorts posts across content types and applies a limit", () => {
		const posts = [
			makePost({ id: "older", slug: "older", type: "notebook", publishedDate: "2026-01-01" }),
			makePost({ id: "newest", slug: "newest", type: "thought", publishedDate: "2026-03-01" }),
			makePost({
				id: "middle",
				slug: "middle",
				type: "publication",
				publishedDate: "2026-02-01",
			}),
		];

		const latestPosts = getLatestPosts(posts, {}, 2);

		expect(latestPosts.map((post) => `${post.type}:${post.slug}`)).toEqual([
			"thought:newest",
			"publication:middle",
		]);
	});
});

describe("TIL tag classification", () => {
	it("uses only an exact, case-insensitive TIL tag and keeps the original content type", () => {
		const regular = makePost({ slug: "regular", tags: ["utility"] });
		const tilNotebook = makePost({ slug: "til-notebook", type: "notebook", tags: ["TIL", "CSS"] });
		const tilPublication = makePost({
			slug: "til-publication",
			type: "publication",
			tags: ["til", "TypeScript"],
		});
		const posts = [regular, tilNotebook, tilPublication];

		expect(isTilPost(regular)).toBe(false);
		expect(getRegularPosts(posts)).toEqual([regular]);
		expect(getTilPosts(posts)).toEqual([tilNotebook, tilPublication]);
		expect(getTilTopics(posts)).toEqual(["CSS", "TypeScript"]);
	});
});
