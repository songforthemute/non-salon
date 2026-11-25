import type { Block, Post, RichTextItem } from "../types";
import { notionHostedUrl } from "./media-handler";

const RENDERED_TYPES = new Set([
	"paragraph",
	"heading_1",
	"heading_2",
	"heading_3",
	"heading_4",
	"toggle",
	"to_do",
	"quote",
	"callout",
	"code",
	"divider",
	"bulleted_list_item",
	"numbered_list_item",
	"table",
	"bookmark",
	"link_preview",
	"image",
	"equation",
	"synced_block",
	"file",
	"pdf",
	"audio",
	"video",
	"embed",
]);

export type BlockDiagnostic = {
	post: string;
	blockId: string;
	path: string;
	type: string;
	reason: string;
};

export function collectBlockDiagnostics(posts: Pick<Post, "slug" | "blocks">[]): BlockDiagnostic[] {
	const diagnostics: BlockDiagnostic[] = [];
	for (const post of posts) {
		function walk(blocks: Block[], parentPath: string) {
			blocks.forEach((block, index) => {
				const blockPath = `${parentPath}/${index}`;
				const data = block[block.type] as
					| {
							rich_text?: RichTextItem[];
							caption?: RichTextItem[];
							type?: string;
							file?: { url: string };
							url?: string;
							cells?: RichTextItem[][];
					  }
					| undefined;
				const hasTemporaryMediaUrl =
					(data?.type === "file" && data.file?.url?.startsWith("http")) ||
					(block.type === "embed" && notionHostedUrl(data?.url || ""));
				const reason =
					!RENDERED_TYPES.has(block.type) && block.type !== "table_row"
						? "unrendered block type"
						: block.sync_error
							? `synced content ${block.sync_error}`
							: block.media_error
								? `media ${block.media_error}`
								: hasTemporaryMediaUrl
									? "unlocalized temporary media URL"
									: null;
				if (reason)
					diagnostics.push({
						post: post.slug,
						blockId: block.id || "unknown",
						path: blockPath,
						type: block.type,
						reason,
					});
				for (const [field, items] of [
					["rich_text", data?.rich_text],
					["caption", data?.caption],
					...(data?.cells?.map((cell, cellIndex) => [`cells/${cellIndex}`, cell] as const) || []),
				] as const) {
					items?.forEach((item, itemIndex) => {
						if (!["text", "mention", "equation"].includes(item.type)) {
							diagnostics.push({
								post: post.slug,
								blockId: block.id || "unknown",
								path: `${blockPath}/${field}/${itemIndex}`,
								type: item.type,
								reason: "unrendered rich text type",
							});
						}
					});
				}
				if (block.children?.length) walk(block.children, blockPath);
			});
		}
		walk(post.blocks, "blocks");
	}
	return diagnostics;
}

export function reportBlockDiagnostics(posts: Pick<Post, "slug" | "blocks">[]): void {
	const diagnostics = collectBlockDiagnostics(posts);
	if (!diagnostics.length) return;
	console.warn(`⚠️  ${diagnostics.length} Notion content issue(s):`);
	for (const item of diagnostics) {
		console.warn(`  ${item.post} ${item.path} [${item.type}, ${item.blockId}]: ${item.reason}`);
	}
}
