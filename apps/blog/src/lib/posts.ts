import fs from "node:fs";
import path from "node:path";
import { PATHS } from "@/config";
import type { ContentType, Post, RegularContentType } from "@/types";

const postsPath = path.join(process.cwd(), PATHS.posts);
const publishedDatesPath = path.join(process.cwd(), PATHS.publishedDates);

export function loadPosts(): Post[] {
	if (!fs.existsSync(postsPath)) {
		return [];
	}
	return JSON.parse(fs.readFileSync(postsPath, "utf-8"));
}

export function loadPublishedDates(): Record<string, string> {
	if (!fs.existsSync(publishedDatesPath)) {
		return {};
	}
	return JSON.parse(fs.readFileSync(publishedDatesPath, "utf-8"));
}

export function getPostsByType(type: ContentType): Post[] {
	const posts = loadPosts();
	return posts.filter((p) => p.type === type);
}

export function isTilPost(post: Post): boolean {
	return post.type === "til";
}

export function getRegularPosts(posts: Post[]): (Post & { type: RegularContentType })[] {
	return posts.filter((post): post is Post & { type: RegularContentType } => !isTilPost(post));
}

export function getTilPosts(posts: Post[]): Post[] {
	return posts.filter(isTilPost);
}

export function getTilTopics(posts: Post[]): string[] {
	const topics = new Map<string, string>();
	for (const post of getTilPosts(posts)) {
		for (const tag of post.tags) {
			const topic = tag.trim();
			if (topic && !topics.has(topic.toLowerCase())) {
				topics.set(topic.toLowerCase(), topic);
			}
		}
	}
	return [...topics.values()].sort((a, b) => a.localeCompare(b));
}

export function sortByDate(
	posts: Post[],
	publishedDates: Record<string, string>,
	order: "asc" | "desc" = "desc",
): Post[] {
	return [...posts].sort((a, b) => {
		const dateA = a.publishedDate || publishedDates[a.slug] || a.lastEditedTime;
		const dateB = b.publishedDate || publishedDates[b.slug] || b.lastEditedTime;
		const diff = new Date(dateB).getTime() - new Date(dateA).getTime();
		if (diff !== 0) return order === "desc" ? diff : -diff;

		// 동점 시 createdTime으로 tiebreak
		const tiebreak = new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
		return order === "desc" ? tiebreak : -tiebreak;
	});
}

export function getLatestPosts(
	posts: Post[],
	publishedDates: Record<string, string>,
	limit?: number,
): Post[] {
	const sortedPosts = sortByDate(posts, publishedDates);
	return limit === undefined ? sortedPosts : sortedPosts.slice(0, limit);
}

export function getPublishedDate(post: Post, publishedDates: Record<string, string>): string {
	return post.publishedDate || publishedDates[post.slug] || post.lastEditedTime.split("T")[0];
}

export function getAdjacentPosts(
	currentPost: Post,
	posts: Post[],
	publishedDates: Record<string, string>,
): { previous: Post | null; next: Post | null } {
	const sameType = sortByDate(
		posts.filter((post) => post.type === currentPost.type),
		publishedDates,
		"desc",
	);
	const index = sameType.findIndex((post) => post.slug === currentPost.slug);
	if (index === -1) {
		return { previous: null, next: null };
	}

	return {
		previous: sameType[index + 1] ?? null,
		next: sameType[index - 1] ?? null,
	};
}

function normalizeTagSet(tags: string[]): Set<string> {
	const set = new Set<string>();
	for (const tag of tags) {
		const normalized = tag.trim().toLowerCase();
		if (normalized) set.add(normalized);
	}
	return set;
}

export function getRelatedPosts(
	currentPost: Post,
	posts: Post[],
	publishedDates: Record<string, string>,
	limit = 3,
): Post[] {
	const targetTags = normalizeTagSet(currentPost.tags);
	if (targetTags.size === 0 || limit <= 0) return [];

	const regularOrdered = sortByDate(getRegularPosts(posts), publishedDates, "desc");
	const orderIndex = new Map(regularOrdered.map((post, index) => [post.slug, index]));

	const scored = regularOrdered
		.filter((candidate) => candidate.slug !== currentPost.slug)
		.map((candidate) => {
			let sharedTags = 0;
			for (const tag of normalizeTagSet(candidate.tags)) {
				if (targetTags.has(tag)) sharedTags++;
			}
			return {
				post: candidate,
				sharedTags,
				sameType: candidate.type === currentPost.type ? 1 : 0,
				order: orderIndex.get(candidate.slug) ?? Number.MAX_SAFE_INTEGER,
			};
		})
		.filter((entry) => entry.sharedTags > 0)
		.sort((a, b) => b.sharedTags - a.sharedTags || b.sameType - a.sameType || a.order - b.order);

	return scored.slice(0, limit).map((entry) => entry.post);
}
