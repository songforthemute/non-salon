import { SITE } from "@/config";
import { sortByDate } from "@/lib/posts";
import type { ContentType, Post } from "@/types";

const TYPE_LABELS: Record<ContentType, string> = {
	publication: "Publications",
	thought: "Thoughts",
	notebook: "Notebooks",
};

const TYPE_ROUTES: Record<ContentType, string> = {
	publication: "publication",
	thought: "thought",
	notebook: "notebook",
};

function escapeMarkdown(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/\[/g, "\\[")
		.replace(/\]/g, "\\]")
		.replace(/\s+/g, " ")
		.trim();
}

function describePost(post: Post): string {
	return escapeMarkdown(post.description || `${post.title} on ${SITE.name}`);
}

function buildPostLine(post: Post): string {
	const route = TYPE_ROUTES[post.type];
	return `- [${escapeMarkdown(post.title)}](${SITE.url}/${route}/${post.slug}): ${describePost(post)}`;
}

function buildTypeSection(type: ContentType, posts: Post[]): string {
	const typePosts = sortByDate(
		posts.filter((post) => post.type === type && post.status === "Published"),
		{},
	);

	if (typePosts.length === 0) return "";

	return [`## ${TYPE_LABELS[type]}`, ...typePosts.map(buildPostLine)].join("\n");
}

export function buildLlmsTxt(posts: Post[]): string {
	const sections = (Object.keys(TYPE_LABELS) as ContentType[])
		.map((type) => buildTypeSection(type, posts))
		.filter(Boolean);

	return [
		`# ${SITE.name}`,
		"",
		`> ${SITE.description}`,
		"",
		`${SITE.name} is a Korean web log by ${SITE.author}. It archives long-form technical writing, short essays, and learning notes.`,
		"",
		"## Site",
		`- [Root](${SITE.url}/): Site index`,
		`- [Publications](${SITE.url}/publications): Long-form writing`,
		`- [Thoughts](${SITE.url}/thoughts): Short essays`,
		`- [Notebooks](${SITE.url}/notebooks): Learning notes`,
		"",
		...sections.flatMap((section) => [section, ""]),
		"## Feeds",
		`- [RSS](${SITE.url}/feed.xml): RSS feed for publications`,
		`- [Sitemap](${SITE.url}/sitemap-index.xml): XML sitemap`,
		"",
	].join("\n");
}
