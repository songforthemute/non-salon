import { describe, expect, it } from "vitest";
import type { Post } from "@/types";
import {
	getAdjacentPosts,
	getLatestPosts,
	getRegularPosts,
	getRelatedPosts,
	getTilPosts,
	getTilTopics,
	isTilPost,
} from "./posts";

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

describe("getAdjacentPosts", () => {
	it("returns older (previous) and newer (next) posts within the same type", () => {
		const oldest = makePost({ slug: "oldest", type: "publication", publishedDate: "2026-01-01" });
		const middle = makePost({ slug: "middle", type: "publication", publishedDate: "2026-02-01" });
		const newest = makePost({ slug: "newest", type: "publication", publishedDate: "2026-03-01" });
		const otherType = makePost({ slug: "other", type: "thought", publishedDate: "2026-02-15" });
		const posts = [oldest, newest, otherType, middle];

		expect(getAdjacentPosts(middle, posts, {})).toEqual({ previous: oldest, next: newest });
		expect(getAdjacentPosts(newest, posts, {})).toEqual({ previous: middle, next: null });
		expect(getAdjacentPosts(oldest, posts, {})).toEqual({ previous: null, next: middle });
	});
});

describe("getRelatedPosts", () => {
	it("ranks regular posts by shared tags, same type, and recency while excluding TIL", () => {
		const current = makePost({
			slug: "current",
			type: "publication",
			tags: ["React", "Frontend"],
			publishedDate: "2026-03-01",
		});
		const twoTags = makePost({
			slug: "two-tags",
			type: "thought",
			tags: ["react", "frontend"],
			publishedDate: "2026-01-01",
		});
		const oneTagSameType = makePost({
			slug: "one-tag-same-type",
			type: "publication",
			tags: ["React"],
			publishedDate: "2026-01-10",
		});
		const oneTagOtherTypeNewer = makePost({
			slug: "one-tag-other-type",
			type: "notebook",
			tags: ["Frontend"],
			publishedDate: "2026-04-01",
		});
		const tilMatch = makePost({
			slug: "til-match",
			type: "til",
			tags: ["React", "Frontend"],
			publishedDate: "2026-05-01",
		});
		const unrelated = makePost({
			slug: "unrelated",
			type: "publication",
			tags: ["Docker"],
			publishedDate: "2026-05-01",
		});

		const related = getRelatedPosts(
			current,
			[current, unrelated, tilMatch, oneTagOtherTypeNewer, oneTagSameType, twoTags],
			{},
			3,
		);

		expect(related.map((post) => post.slug)).toEqual([
			"two-tags",
			"one-tag-same-type",
			"one-tag-other-type",
		]);
	});

	it("returns an empty array when the current post has no tags", () => {
		const current = makePost({ slug: "no-tags", type: "thought", tags: [] });
		const other = makePost({ slug: "other", type: "thought", tags: ["AI"] });
		expect(getRelatedPosts(current, [current, other], {})).toEqual([]);
	});
});
