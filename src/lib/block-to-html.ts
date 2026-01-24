type RichTextItem = {
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

type Block = {
	type: string;
	children?: Block[];
	[key: string]: unknown;
};

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
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

export function blockToHtml(block: Block): string {
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

		case "quote": {
			const data = block.quote as { rich_text: RichTextItem[] };
			return `<blockquote>${richTextToHtml(data.rich_text)}</blockquote>`;
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
			};
			const url = getImageUrl(data);
			const caption = richTextToHtml(data.caption);
			const alt = escapeHtml(data.caption.map((c) => c.text.content).join(""));

			if (caption) {
				return `<figure><img src="${url}" alt="${alt}"><figcaption>${caption}</figcaption></figure>`;
			}
			return `<figure><img src="${url}" alt=""></figure>`;
		}

		default:
			return "";
	}
}

export function blocksToHtml(blocks: Block[]): string {
	const result: string[] = [];
	let i = 0;

	while (i < blocks.length) {
		const block = blocks[i];
		const { type } = block;

		// 리스트 그룹핑
		if (type === "bulleted_list_item" || type === "numbered_list_item") {
			const tag = type === "bulleted_list_item" ? "ul" : "ol";
			const items: string[] = [];

			while (i < blocks.length && blocks[i].type === type) {
				const currentBlock = blocks[i];
				let itemHtml = blockToHtml(currentBlock);

				// 중첩 리스트 처리
				if (currentBlock.children && currentBlock.children.length > 0) {
					const nestedHtml = blocksToHtml(currentBlock.children);
					// </li> 앞에 중첩 리스트 삽입
					itemHtml = itemHtml.replace("</li>", `${nestedHtml}</li>`);
				}

				items.push(itemHtml);
				i++;
			}

			result.push(`<${tag}>${items.join("")}</${tag}>`);
		} else {
			const html = blockToHtml(block);
			if (html) {
				result.push(html);
			}
			i++;
		}
	}

	return result.join("");
}
