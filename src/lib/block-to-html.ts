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
	const closingTag = CONTAINER_CLOSING_TAGS[type];
	if (closingTag) {
		return html.replace(closingTag, `${childrenHtml}${closingTag}`);
	}
	return `${html}<div class="indent">${childrenHtml}</div>`;
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
			const data = block.heading_1 as { rich_text: RichTextItem[] };
			return `<h2>${richTextToHtml(data.rich_text)}</h2>`;
		}

		case "heading_2": {
			const data = block.heading_2 as { rich_text: RichTextItem[] };
			return `<h3>${richTextToHtml(data.rich_text)}</h3>`;
		}

		case "heading_3": {
			const data = block.heading_3 as { rich_text: RichTextItem[] };
			return `<h4>${richTextToHtml(data.rich_text)}</h4>`;
		}

		case "heading_4": {
			const data = block.heading_4 as { rich_text: RichTextItem[] };
			return `<h5>${richTextToHtml(data.rich_text)}</h5>`;
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
			if (html && block.children && block.children.length > 0) {
				const childrenHtml = blocksToHtml(block.children, imageState);
				html = insertChildren(type, html, childrenHtml);
			}
			if (html) {
				result.push(html);
			}
			i++;
		}
	}

	return result.join("");
}
