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
