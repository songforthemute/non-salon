export const CONTENT_TYPES = ["publication", "thought", "notebook"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

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
	blocks: unknown[];
}
