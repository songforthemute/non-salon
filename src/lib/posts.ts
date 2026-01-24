import fs from "node:fs";
import path from "node:path";
import { PATHS } from "@/config";
import type { ContentType, Post } from "@/types";

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

export function sortByDate(
	posts: Post[],
	publishedDates: Record<string, string>,
	order: "asc" | "desc" = "desc",
): Post[] {
	return [...posts].sort((a, b) => {
		const dateA = publishedDates[a.slug] || a.lastEditedTime;
		const dateB = publishedDates[b.slug] || b.lastEditedTime;
		const diff = new Date(dateB).getTime() - new Date(dateA).getTime();
		return order === "desc" ? diff : -diff;
	});
}

export function getPublishedDate(post: Post, publishedDates: Record<string, string>): string {
	return publishedDates[post.slug] || post.lastEditedTime.split("T")[0];
}
