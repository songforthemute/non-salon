import { SITE } from "@/config";
import type { Post } from "@/types";

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
