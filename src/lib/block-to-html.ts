import type { Block, RichTextItem } from "@/types";
import { escapeHtml } from "./utils";

function getImageUrl(image: {
	type: string;
	file?: { url: string };
	external?: { url: string };
}): string {
	if (image.type === "file" && image.file) {
		return image.file.url;
	}
	if (image.type === "external" && image.external) {
		return image.external.url;
	}
	return "";
}

type ImageRenderOptions = {
	loading?: "eager" | "lazy";
};

const CONTAINER_CLOSING_TAGS: Record<string, string> = {
	quote: "</blockquote>",
	callout: "</aside>",
};

function insertChildren(type: string, html: string, childrenHtml: string): string {
	if (html.endsWith("</details>")) {
		return `${html.slice(0, -"</details>".length)}${childrenHtml}</details>`;
	}
	const closingTag = CONTAINER_CLOSING_TAGS[type];
	if (closingTag) {
		return html.replace(closingTag, `${childrenHtml}${closingTag}`);
	}
	return `${html}<div class="indent">${childrenHtml}</div>`;
}

function headingToHtml(
	level: number,
	data: { rich_text: RichTextItem[]; is_toggleable?: boolean },
) {
	const heading = `<h${level}>${richTextToHtml(data.rich_text)}</h${level}>`;
	return data.is_toggleable
		? `<details class="notion-toggle notion-toggle-heading"><summary>${heading}</summary></details>`
		: heading;
}

function safeHttpUrl(rawUrl: string): URL | null {
	try {
		const url = new URL(rawUrl);
		return url.protocol === "http:" || url.protocol === "https:" ? url : null;
	} catch {
		return null;
	}
}

function tableToHtml(block: Block): string {
	const data = block.table as {
		table_width: number;
		has_column_header: boolean;
		has_row_header: boolean;
	};
	const rows = (block.children || []).filter((child) => child.type === "table_row");
	const cellsByRow = rows.map((row) => (row.table_row as { cells: RichTextItem[][] }).cells || []);
	const width = Math.max(data.table_width || 0, ...cellsByRow.map((cells) => cells.length));
	if (width === 0 || rows.length === 0) return "";

	const renderRow = (cells: RichTextItem[][], isColumnHeader: boolean) => {
		const html = Array.from({ length: width }, (_, index) => {
			const isRowHeader = data.has_row_header && index === 0;
			const tag = isColumnHeader || isRowHeader ? "th" : "td";
			const scope = isColumnHeader ? ' scope="col"' : isRowHeader ? ' scope="row"' : "";
			return `<${tag}${scope}>${richTextToHtml(cells[index] || [])}</${tag}>`;
		}).join("");
		return `<tr>${html}</tr>`;
	};

	const head = data.has_column_header ? `<thead>${renderRow(cellsByRow[0], true)}</thead>` : "";
	const body = cellsByRow
		.slice(data.has_column_header ? 1 : 0)
		.map((cells) => renderRow(cells, false))
		.join("");
	const columns = `<colgroup>${"<col>".repeat(width)}</colgroup>`;
	const minWidth = width >= 3 ? Math.max(672, width * 160) : width * 160;
	return `<div class="notion-table-scroll" role="region" aria-label="Scrollable table" tabindex="0"><table class="notion-table" data-columns="${width}" style="--notion-table-min-width: ${minWidth}px">${columns}${head}<tbody>${body}</tbody></table></div>`;
}

export function richTextToHtml(richText: RichTextItem[]): string {
	return richText
		.map((item) => {
			let content: string;
			let href: string | null = null;

			if (item.type === "text" && item.text) {
				content = escapeHtml(item.text.content);
				href = item.text.link?.url || null;
			} else if (item.type === "mention") {
				content = escapeHtml(item.plain_text || "");
				href = item.href || null;
			} else {
				return "";
			}

			const { annotations } = item;

			// 순서: bold > italic > code > strikethrough
			if (annotations.strikethrough) {
				content = `<s>${content}</s>`;
			}
			if (annotations.code) {
				content = `<code>${content}</code>`;
			}
			if (annotations.italic) {
				content = `<em>${content}</em>`;
			}
			if (annotations.bold) {
				content = `<strong>${content}</strong>`;
			}

			if (href) {
				content = `<a href="${escapeHtml(href)}">${content}</a>`;
			}

			return content;
		})
		.join("");
}

export function blockToHtml(block: Block, options: ImageRenderOptions = {}): string {
	const { type } = block;

	switch (type) {
		case "paragraph": {
			const data = block.paragraph as { rich_text: RichTextItem[] };
			const content = richTextToHtml(data.rich_text);
			if (!content) return "";
			return `<p>${content}</p>`;
		}

		case "heading_1": {
			const data = block.heading_1 as { rich_text: RichTextItem[]; is_toggleable?: boolean };
			return headingToHtml(2, data);
		}

		case "heading_2": {
			const data = block.heading_2 as { rich_text: RichTextItem[]; is_toggleable?: boolean };
			return headingToHtml(3, data);
		}

		case "heading_3": {
			const data = block.heading_3 as { rich_text: RichTextItem[]; is_toggleable?: boolean };
			return headingToHtml(4, data);
		}

		case "heading_4": {
			const data = block.heading_4 as { rich_text: RichTextItem[]; is_toggleable?: boolean };
			return headingToHtml(5, data);
		}

		case "toggle": {
			const data = block.toggle as { rich_text: RichTextItem[] };
			return `<details class="notion-toggle"><summary>${richTextToHtml(data.rich_text)}</summary></details>`;
		}

		case "to_do": {
			const data = block.to_do as { rich_text: RichTextItem[]; checked: boolean };
			const checked = data.checked ? " checked" : "";
			const checkmark = data.checked ? "✓" : "";
			return `<label class="notion-to-do"><input type="checkbox" disabled${checked}><span class="notion-to-do-box" aria-hidden="true">${checkmark}</span><span>${richTextToHtml(data.rich_text)}</span></label>`;
		}

		case "quote": {
			const data = block.quote as { rich_text: RichTextItem[] };
			return `<blockquote>${richTextToHtml(data.rich_text)}</blockquote>`;
		}

		case "callout": {
			const data = block.callout as { rich_text: RichTextItem[]; icon?: { emoji?: string } };
			const icon = data.icon?.emoji ? `<span>${data.icon.emoji}</span> ` : "";
			return `<aside>${icon}${richTextToHtml(data.rich_text)}</aside>`;
		}

		case "code": {
			const data = block.code as { rich_text: RichTextItem[]; language: string };
			const code = richTextToHtml(data.rich_text);
			return `<pre><code>${code}</code></pre>`;
		}

		case "divider": {
			return "<hr>";
		}

		case "bulleted_list_item": {
			const data = block.bulleted_list_item as { rich_text: RichTextItem[] };
			return `<li>${richTextToHtml(data.rich_text)}</li>`;
		}

		case "numbered_list_item": {
			const data = block.numbered_list_item as { rich_text: RichTextItem[] };
			return `<li>${richTextToHtml(data.rich_text)}</li>`;
		}

		case "table": {
			return tableToHtml(block);
		}

		case "bookmark": {
			const data = block.bookmark as { url: string; caption?: RichTextItem[] };
			const caption = (data.caption || [])
				.map((item) => item.plain_text ?? item.text?.content ?? "")
				.join("")
				.trim();
			const url = safeHttpUrl(data.url);
			const title = escapeHtml(caption || data.url);
			const linkedTitle = url ? `<a href="${escapeHtml(url.href)}">${title}</a>` : title;
			const domain =
				url && caption
					? `<span class="notion-bookmark-domain">${escapeHtml(url.hostname.replace(/^www\./, ""))}</span>`
					: "";
			return `<div class="notion-bookmark">${linkedTitle}${domain}</div>`;
		}

		case "link_preview": {
			const data = block.link_preview as { url: string };
			const url = safeHttpUrl(data.url);
			const label = escapeHtml(data.url);
			return `<p class="notion-link-preview">${url ? `<a href="${escapeHtml(url.href)}">${label}</a>` : label}</p>`;
		}

		case "image": {
			const data = block.image as {
				type: string;
				file?: { url: string };
				external?: { url: string };
				caption: RichTextItem[];
				width?: number;
				height?: number;
			};
			const url = getImageUrl(data);
			const caption = richTextToHtml(data.caption);
			const alt = escapeHtml(data.caption.map((c) => c.text?.content || "").join(""));

			const dimensions =
				data.width && data.height ? ` width="${data.width}" height="${data.height}"` : "";
			const loading = options.loading === "lazy" ? ' loading="lazy"' : "";
			const image = `<img src="${url}" alt="${alt}"${dimensions}${loading} decoding="async">`;

			if (caption) {
				return `<figure>${image}<figcaption>${caption}</figcaption></figure>`;
			}
			return `<figure>${image}</figure>`;
		}

		default:
			return "";
	}
}

export function blocksToHtml(blocks: Block[], imageState = { hasRenderedImage: false }): string {
	const result: string[] = [];
	let i = 0;

	while (i < blocks.length) {
		const block = blocks[i];
		const { type } = block;

		if (type === "bulleted_list_item" || type === "numbered_list_item") {
			const tag = type === "bulleted_list_item" ? "ul" : "ol";
			const items: string[] = [];

			while (i < blocks.length && blocks[i].type === type) {
				const currentBlock = blocks[i];
				const imageLoading = imageState.hasRenderedImage ? "lazy" : "eager";
				let itemHtml = blockToHtml(currentBlock, { loading: imageLoading });
				if (currentBlock.type === "image" && itemHtml) imageState.hasRenderedImage = true;

				if (currentBlock.children && currentBlock.children.length > 0) {
					const nestedHtml = blocksToHtml(currentBlock.children, imageState);
					itemHtml = itemHtml.replace("</li>", `${nestedHtml}</li>`);
				}

				items.push(itemHtml);
				i++;
			}

			result.push(`<${tag}>${items.join("")}</${tag}>`);
		} else {
			const imageLoading = imageState.hasRenderedImage ? "lazy" : "eager";
			let html = blockToHtml(block, { loading: imageLoading });
			if (block.type === "image" && html) imageState.hasRenderedImage = true;
			const childrenHtml =
				block.type !== "table" && block.children?.length
					? blocksToHtml(block.children, imageState)
					: "";
			if (html) {
				if (childrenHtml) html = insertChildren(type, html, childrenHtml);
				result.push(html);
			} else if (childrenHtml) {
				// Preserve nested content even when the parent block has no HTML renderer.
				result.push(`<div class="indent">${childrenHtml}</div>`);
			}
			i++;
		}
	}

	return result.join("");
}
