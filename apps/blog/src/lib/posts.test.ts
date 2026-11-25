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

describe("TIL content classification", () => {
	it("uses Type to classify TIL and Tags as topics", () => {
		const regular = makePost({ slug: "regular", type: "publication", tags: ["TIL"] });
		const tilCss = makePost({ slug: "til-css", type: "til", tags: ["CSS"] });
		const tilTypescript = makePost({
			slug: "til-typescript",
			type: "til",
			tags: ["TypeScript"],
		});
		const posts = [regular, tilCss, tilTypescript];

		expect(isTilPost(regular)).toBe(false);
		expect(getRegularPosts(posts)).toEqual([regular]);
		expect(getTilPosts(posts)).toEqual([tilCss, tilTypescript]);
		expect(getTilTopics(posts)).toEqual(["CSS", "TypeScript"]);
	});
});
