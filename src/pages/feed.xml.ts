import type { APIContext } from "astro";
import fs from "node:fs";
import path from "node:path";

interface Post {
	id: string;
	title: string;
	slug: string;
	description: string | null;
	lastEditedTime: string;
}

const SITE_URL = "https://whitespace.blog"; // 추후 환경변수로 변경
const SITE_TITLE = "whitespace";
const SITE_DESCRIPTION = "개인 아카이브 블로그";

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
			const description = post.description || `${post.title} - ${SITE_TITLE}`;

			return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${SITE_URL}/posts/${post.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/posts/${post.slug}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${new Date(pubDate).toUTCString()}</pubDate>
    </item>`;
		})
		.join("\n");

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

	return new Response(rss, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
		},
	});
}
