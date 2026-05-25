import "dotenv/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Client } from "@notionhq/client";
import type {
	BlockObjectResponse,
	PageObjectResponse,
	RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { CONTENT_TYPES, type ContentType, type Post } from "../src/types.js";

const DATA_DIR = path.join(process.cwd(), "data");

// 350ms delay for rate limit (3 req/s)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// fetch-notion 전용 Post 타입 (blocks가 BlockObjectResponse[])
type FetchedPost = Omit<Post, "blocks"> & { blocks: BlockObjectResponse[] };

function getRichTextContent(richText: RichTextItemResponse[]): string {
	return richText.map((t) => t.plain_text).join("");
}

function extractPostProperties(page: PageObjectResponse): Omit<FetchedPost, "blocks"> {
	const props = page.properties;

	const titleProp = props.Title;
	const title = titleProp.type === "title" ? getRichTextContent(titleProp.title) : "";

	const slugProp = props.Slug;
	const slug = slugProp.type === "rich_text" ? getRichTextContent(slugProp.rich_text) : "";

	const typeProp = props.Type;
	const typeRaw =
		typeProp?.type === "select"
			? (typeProp.select?.name?.toLowerCase() ?? "")
			: typeProp?.type === "status"
				? (typeProp.status?.name?.toLowerCase() ?? "")
				: "";
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

	// Notion "Published Date" 프로퍼티 — 사용자가 직접 지정한 게시일
	const publishedDateProp = props["Published Date"];
	const publishedDate =
		publishedDateProp?.type === "date" ? (publishedDateProp.date?.start ?? null) : null;

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
		createdTime: page.created_time,
		publishedDate,
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

// 메타데이터만 조회 (블록 fetch 없이 페이지 프로퍼티만)
async function fetchPublishedPostsMeta(
	notion: Client,
	dataSourceId: string,
): Promise<Omit<FetchedPost, "blocks">[]> {
	const metas: Omit<FetchedPost, "blocks">[] = [];
	let cursor: string | undefined;

	console.log("Fetching published posts metadata from Notion...");

	do {
		await delay(350);
		const response = await notion.dataSources.query({
			data_source_id: dataSourceId,
			filter: {
				property: "Status",
				status: { equals: "Published" },
			},
			sorts: [{ timestamp: "created_time", direction: "descending" }],
			start_cursor: cursor,
		});

		for (const page of response.results) {
			if (!("properties" in page)) continue;
			const p = page as PageObjectResponse;
			const meta = extractPostProperties(p);

			if (!meta.slug) {
				console.warn(`Skipping post "${meta.title}": no slug`);
				continue;
			}

			metas.push(meta);
		}

		cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
	} while (cursor);

	return metas;
}

async function loadCachedPosts(filePath: string): Promise<FetchedPost[]> {
	try {
		const content = await fs.readFile(filePath, "utf-8");
		return JSON.parse(content);
	} catch {
		return [];
	}
}

async function main() {
	const apiKey = process.env.NOTION_API_KEY;
	const databaseId = process.env.NOTION_DATABASE_ID;
	const forceFullFetch = process.argv.includes("--force");

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

	const outputPath = path.join(DATA_DIR, "posts.json");

	// 캐시 로드 (증분 빌드용)
	const cachedPosts = forceFullFetch ? [] : await loadCachedPosts(outputPath);
	const cacheMap = new Map(cachedPosts.map((p) => [p.id, p]));

	if (forceFullFetch) {
		console.log("Force mode: fetching all posts from scratch");
	} else if (cacheMap.size > 0) {
		console.log(`Loaded ${cacheMap.size} cached posts for incremental update`);
	}

	// 1단계: 메타데이터만 조회
	const metas = await fetchPublishedPostsMeta(notion, dataSourceId);

	// 2단계: 변경된 게시물만 블록 조회
	const posts: FetchedPost[] = [];
	let fetchedCount = 0;
	let cachedCount = 0;

	for (const meta of metas) {
		const cached = cacheMap.get(meta.id);

		if (cached && cached.lastEditedTime === meta.lastEditedTime) {
			// 변경 없음: 메타는 갱신하되 블록은 캐시 재사용
			posts.push({ ...meta, blocks: cached.blocks });
			cachedCount++;
		} else {
			// 신규 또는 변경: 블록 조회
			console.log(`Fetching blocks for: ${meta.title}`);
			const blocks = await getBlocksRecursive(notion, meta.id);
			posts.push({ ...meta, blocks });
			fetchedCount++;
		}
	}

	await fs.writeFile(outputPath, JSON.stringify(posts, null, 2));

	console.log(
		`\nDone! ${posts.length} posts saved (${fetchedCount} fetched, ${cachedCount} cached)`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
