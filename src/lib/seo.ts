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

export function toCanonicalUrl(url: URL): string {
	const siteUrl = new URL(SITE.url);
	let pathname = url.pathname;

	if (pathname === "/index.html") {
		pathname = "/";
	} else if (pathname.endsWith(".html")) {
		pathname = pathname.slice(0, -".html".length);
	}

	return new URL(pathname, siteUrl).href;
}

export function getArticleModifiedDate(post: Post): string {
	return (post.lastUpdated || post.lastEditedTime).split("T")[0];
}

export function buildPersonJsonLd() {
	return {
		"@type": "Person",
		name: SITE.author,
		url: SITE.authorUrl,
		sameAs: SITE.sameAs,
	};
}

export function buildWebSiteJsonLd(description: string) {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: SITE.name,
		url: SITE.url,
		description,
		inLanguage: SITE.language,
		publisher: buildPersonJsonLd(),
		sameAs: SITE.sameAs,
	};
}

export function buildArticleJsonLd(input: ArticleJsonLdInput) {
	return {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: input.title,
		description: input.description,
		datePublished: input.publishedDate,
		dateModified: input.modifiedDate,
		author: buildPersonJsonLd(),
		publisher: buildPersonJsonLd(),
		image: input.imageUrl,
		url: input.canonicalUrl,
		mainEntityOfPage: input.canonicalUrl,
		inLanguage: SITE.language,
		articleSection: input.section,
		keywords: input.tags,
	};
}
