import { SITE } from "@/config";
import type { Post } from "@/types";

type ArticleJsonLdInput = {
	title: string;
	description: string;
	canonicalUrl: string;
	imageUrl: string;
	publishedDate?: string;
	modifiedDate?: string;
	section: string;
	tags: string[];
};

type BreadcrumbJsonLdInput = Pick<ArticleJsonLdInput, "canonicalUrl" | "section" | "title">;

export function toCanonicalUrl(url: URL): string {
	const siteUrl = new URL(SITE.url);
	let pathname = url.pathname;

	if (pathname === "/index.html") {
		pathname = "/";
	} else if (pathname.endsWith(".html")) {
		pathname = pathname.slice(0, -".html".length);
	}

	// SITE.url is also the value used by the sitemap and WebSite JSON-LD. Keep
	// the homepage canonical identical rather than serializing it with a slash.
	if (pathname === "/") return SITE.url;

	return new URL(pathname, siteUrl).href;
}

export function ensureModifiedDateNotBeforePublished(
	publishedDate: string | undefined,
	modifiedDate: string | undefined,
): string | undefined {
	if (!modifiedDate || !publishedDate) return modifiedDate;

	return modifiedDate < publishedDate ? publishedDate : modifiedDate;
}

export function getArticleModifiedDate(post: Post, publishedDate?: string): string {
	const modifiedDate = (post.lastUpdated || post.lastEditedTime).split("T")[0];
	return (
		ensureModifiedDateNotBeforePublished(publishedDate || post.publishedDate || undefined, modifiedDate) ||
		modifiedDate
	);
}

export function buildPersonJsonLd() {
	return {
		"@type": "Person",
		"@id": `${SITE.authorUrl}#person`,
		name: SITE.author,
		url: SITE.authorUrl,
		sameAs: SITE.sameAs,
	};
}

export function buildWebSiteJsonLd(description: string) {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"@id": `${SITE.url}#website`,
		name: SITE.name,
		url: SITE.url,
		description,
		inLanguage: SITE.language,
		publisher: buildPersonJsonLd(),
		sameAs: SITE.sameAs,
	};
}

export function buildArticleJsonLd(input: ArticleJsonLdInput) {
	const modifiedDate = ensureModifiedDateNotBeforePublished(
		input.publishedDate,
		input.modifiedDate,
	);

	return {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		"@id": `${input.canonicalUrl}#blogposting`,
		headline: input.title,
		description: input.description,
		datePublished: input.publishedDate,
		dateModified: modifiedDate,
		author: buildPersonJsonLd(),
		publisher: buildPersonJsonLd(),
		image: {
			"@type": "ImageObject",
			url: input.imageUrl,
		},
		url: input.canonicalUrl,
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": input.canonicalUrl,
		},
		isPartOf: { "@id": `${SITE.url}#website` },
		inLanguage: SITE.language,
		articleSection: input.section,
		keywords: input.tags,
	};
}

export function buildBreadcrumbJsonLd(input: BreadcrumbJsonLdInput) {
	const sectionName = `${input.section.charAt(0).toUpperCase()}${input.section.slice(1)}s`;
	const sectionUrl = `${SITE.url}/${input.section}s`;

	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		"@id": `${input.canonicalUrl}#breadcrumb`,
		itemListElement: [
			{
				"@type": "ListItem",
				position: 1,
				name: "Root",
				item: SITE.url,
			},
			{
				"@type": "ListItem",
				position: 2,
				name: sectionName,
				item: sectionUrl,
			},
			{
				"@type": "ListItem",
				position: 3,
				name: input.title,
				item: input.canonicalUrl,
			},
		],
	};
}
