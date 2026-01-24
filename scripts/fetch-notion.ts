import "dotenv/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Client } from "@notionhq/client";
import type {
	BlockObjectResponse,
	PageObjectResponse,
	RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { CONTENT_TYPES, type ContentType } from "../src/types.js";

const DATA_DIR = path.join(process.cwd(), "data");

// 350ms delay for rate limit (3 req/s)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Post {
	id: string;
	title: string;
	slug: string;
	type: ContentType;
	status: string;
	description: string | null;
	tags: string[];
	lastUpdated: string | null;
	lastEditedTime: string;
	blocks: BlockObjectResponse[];
}

function getRichTextContent(richText: RichTextItemResponse[]): string {
	return richText.map((t) => t.plain_text).join("");
}

function extractPostProperties(page: PageObjectResponse): Omit<Post, "blocks"> {
	const props = page.properties;

	const titleProp = props.Title;
	const title = titleProp.type === "title" ? getRichTextContent(titleProp.title) : "";

	const slugProp = props.Slug;
	const slug = slugProp.type === "rich_text" ? getRichTextContent(slugProp.rich_text) : "";

	const typeProp = props.Type;
	const typeRaw = typeProp?.type === "select" ? (typeProp.select?.name?.toLowerCase() ?? "") : "";
	const type: ContentType = CONTENT_TYPES.includes(typeRaw as ContentType)
		? (typeRaw as ContentType)
		: "publication";

	const statusProp = props.Status;
	const status = statusProp.type === "status" ? (statusProp.status?.name ?? "") : "";

	const descProp = props.Description;
	const description =
		descProp?.type === "rich_text" ? getRichTextContent(descProp.rich_text) || null : null;

	const tagsProp = props.Tags;
	const tags = tagsProp?.type === "multi_select" ? tagsProp.multi_select.map((t) => t.name) : [];

	const lastUpdatedProp = props["Last Updated"];
	const lastUpdated =
		lastUpdatedProp?.type === "date"
			? (lastUpdatedProp.date?.start ?? null)
			: lastUpdatedProp?.type === "last_edited_time"
				? lastUpdatedProp.last_edited_time
				: null;

	return {
		id: page.id,
		title,
		slug,
		type,
		status,
		description,
		tags,
		lastUpdated,
		lastEditedTime: page.last_edited_time,
	};
}

async function getBlocksRecursive(notion: Client, blockId: string): Promise<BlockObjectResponse[]> {
	const blocks: BlockObjectResponse[] = [];
	let cursor: string | undefined;

	do {
		await delay(350);
		const response = await notion.blocks.children.list({
			block_id: blockId,
			page_size: 100,
			start_cursor: cursor,
		});

		for (const block of response.results) {
			if (!("type" in block)) continue;
			const b = block as BlockObjectResponse;

			if (b.has_children && !["child_page", "child_database"].includes(b.type)) {
				(b as BlockObjectResponse & { children: BlockObjectResponse[] }).children =
					await getBlocksRecursive(notion, b.id);
			}

			blocks.push(b);
		}

		cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
	} while (cursor);

	return blocks;
}

async function getDataSourceId(notion: Client, databaseId: string): Promise<string> {
	const response = await notion.databases.retrieve({ database_id: databaseId });
	const dataSources = (response as { data_sources?: { id: string }[] }).data_sources;

	if (!dataSources || dataSources.length === 0) {
		throw new Error("No data sources found for database");
	}

	return dataSources[0].id;
}

async function fetchPublishedPosts(notion: Client, dataSourceId: string): Promise<Post[]> {
	const posts: Post[] = [];
	let cursor: string | undefined;

	console.log("Fetching published posts from Notion...");

	do {
		await delay(350);
		const response = await notion.dataSources.query({
			data_source_id: dataSourceId,
			filter: {
				property: "Status",
				status: { equals: "Published" },
			},
			start_cursor: cursor,
		});

		for (const page of response.results) {
			if (!("properties" in page)) continue;
			const p = page as PageObjectResponse;
			const postMeta = extractPostProperties(p);

			if (!postMeta.slug) {
				console.warn(`Skipping post "${postMeta.title}": no slug`);
				continue;
			}

			console.log(`Fetching blocks for: ${postMeta.title}`);
			const blocks = await getBlocksRecursive(notion, p.id);

			posts.push({ ...postMeta, blocks });
		}

		cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
	} while (cursor);

	return posts;
}

async function main() {
	const apiKey = process.env.NOTION_API_KEY;
	const databaseId = process.env.NOTION_DATABASE_ID;

	if (!apiKey) {
		console.error("NOTION_API_KEY is not set");
		process.exit(1);
	}
	if (!databaseId) {
		console.error("NOTION_DATABASE_ID is not set");
		process.exit(1);
	}

	const notion = new Client({ auth: apiKey });

	console.log("Getting data source ID...");
	const dataSourceId = await getDataSourceId(notion, databaseId);
	console.log(`Data source ID: ${dataSourceId}`);

	await fs.mkdir(DATA_DIR, { recursive: true });

	const posts = await fetchPublishedPosts(notion, dataSourceId);

	const outputPath = path.join(DATA_DIR, "posts.json");
	await fs.writeFile(outputPath, JSON.stringify(posts, null, 2));

	console.log(`\nDone! ${posts.length} posts saved to ${outputPath}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
