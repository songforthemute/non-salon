export const SITE = {
  name: "non.salon",
  url: "https://non.salon",
  author: "songforthemute",
  description: "Archieved Web Logs",
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

// URL 세그먼트 ↔ ContentType 매핑 (상세 페이지용, 단수형)
export const ROUTE_TYPE_MAP = {
  publication: "publication",
  thought: "thought",
  notebook: "notebook",
} as const;

export type RouteSegment = keyof typeof ROUTE_TYPE_MAP;
