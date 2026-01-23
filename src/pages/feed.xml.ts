import type { APIContext } from "astro";
import fs from "node:fs";
import path from "node:path";
import { SITE } from "@/config";

interface Post {
	id: string;
	title: string;
	slug: string;
	description: string | null;
	lastEditedTime: string;
}

function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export async function GET({ site }: APIContext) {
	const postsPath = path.join(process.cwd(), "data", "posts.json");
	const publishedDatesPath = path.join(process.cwd(), "data", "published-dates.json");

	let posts: Post[] = [];
	let publishedDates: Record<string, string> = {};

	if (fs.existsSync(postsPath)) {
		posts = JSON.parse(fs.readFileSync(postsPath, "utf-8"));
	}

	if (fs.existsSync(publishedDatesPath)) {
		publishedDates = JSON.parse(fs.readFileSync(publishedDatesPath, "utf-8"));
	}

	// 출판일 기준 내림차순 정렬
	posts.sort((a, b) => {
		const dateA = publishedDates[a.slug] || a.lastEditedTime;
		const dateB = publishedDates[b.slug] || b.lastEditedTime;
		return new Date(dateB).getTime() - new Date(dateA).getTime();
	});

	// 최근 20개만
	const recentPosts = posts.slice(0, 20);

	const items = recentPosts
		.map((post) => {
			const pubDate = publishedDates[post.slug] || post.lastEditedTime.split("T")[0];
			const description = post.description || `${post.title} - ${SITE.name}`;

			return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${SITE.url}/posts/${post.slug}</link>
      <guid isPermaLink="true">${SITE.url}/posts/${post.slug}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${new Date(pubDate).toUTCString()}</pubDate>
    </item>`;
		})
		.join("\n");

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.name)}</title>
    <link>${SITE.url}</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>${SITE.language}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE.url}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

	return new Response(rss, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
		},
	});
}
