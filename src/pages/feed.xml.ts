import { SITE } from "@/config";
import { getPostsByType, getPublishedDate, loadPublishedDates, sortByDate } from "@/lib/posts";

function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export async function GET() {
	const publishedDates = loadPublishedDates();
	const posts = sortByDate(getPostsByType("publication"), publishedDates).slice(0, 20);

	const items = posts
		.map((post) => {
			const pubDate = getPublishedDate(post, publishedDates);
			const description = post.description || `${post.title} - ${SITE.name}`;

			return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${SITE.url}/publications/${post.slug}</link>
      <guid isPermaLink="true">${SITE.url}/publications/${post.slug}</guid>
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
