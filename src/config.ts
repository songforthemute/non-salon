export const SITE = {
	name: "whitespace",
	url: "https://whitespace.blog",
	author: "songforthemute",
	description: "개인 아카이브 블로그",
	language: "ko-KR",
} as const;

export const PATHS = {
	data: "data",
	posts: "data/posts.json",
	publishedDates: "data/published-dates.json",
	images: "public/images",
} as const;

export const NAV_LINKS = [
	{ href: "/", label: "Home" },
	{ href: "/publications", label: "Publications" },
	{ href: "/thoughts", label: "Thoughts" },
	{ href: "/notebooks", label: "Notebooks" },
] as const;
