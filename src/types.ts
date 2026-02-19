export const CONTENT_TYPES = ["publication", "thought", "notebook"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

// Notion Rich Text
export type RichTextItem = {
	type: string;
	text?: {
		content: string;
		link?: { url: string } | null;
	};
	mention?: {
		type: string;
		page?: { id: string };
		link_preview?: { url: string };
	};
	plain_text?: string;
	href?: string | null;
	annotations: {
		bold?: boolean;
		italic?: boolean;
		strikethrough?: boolean;
		underline?: boolean;
		code?: boolean;
		color?: string;
	};
};

// Notion Block (generic)
export type Block = {
	id?: string;
	type: string;
	children?: Block[];
	image?: {
		type: "file" | "external";
		file?: { url: string };
		external?: { url: string };
		caption: RichTextItem[];
	};
	[key: string]: unknown;
};

export interface Post {
	id: string;
	title: string;
	slug: string;
	type: ContentType;
	status: string;
	description: string | null;
	tags: string[];
	lastUpdated: string | null;
	lastEditedTime: string;
	createdTime: string;
	// Notion "Published Date" 프로퍼티 — null이면 published-dates.json fallback
	publishedDate: string | null;
	blocks: Block[];
}
