import { describe, expect, it } from "vitest";
import { blocksToHtml, blockToHtml, richTextToHtml } from "./block-to-html";

describe("richTextToHtml", () => {
	it("plain text", () => {
		const richText = [{ type: "text", text: { content: "Hello" }, annotations: {} }];
		expect(richTextToHtml(richText)).toBe("Hello");
	});

	it("bold", () => {
		const richText = [{ type: "text", text: { content: "bold" }, annotations: { bold: true } }];
		expect(richTextToHtml(richText)).toBe("<strong>bold</strong>");
	});

	it("italic", () => {
		const richText = [{ type: "text", text: { content: "italic" }, annotations: { italic: true } }];
		expect(richTextToHtml(richText)).toBe("<em>italic</em>");
	});

	it("inline code", () => {
		const richText = [{ type: "text", text: { content: "code" }, annotations: { code: true } }];
		expect(richTextToHtml(richText)).toBe("<code>code</code>");
	});

	it("strikethrough", () => {
		const richText = [
			{ type: "text", text: { content: "deleted" }, annotations: { strikethrough: true } },
		];
		expect(richTextToHtml(richText)).toBe("<s>deleted</s>");
	});

	it("link", () => {
		const richText = [
			{
				type: "text",
				text: { content: "link", link: { url: "https://example.com" } },
				annotations: {},
			},
		];
		expect(richTextToHtml(richText)).toBe('<a href="https://example.com">link</a>');
	});

	it("combined annotations", () => {
		const richText = [
			{
				type: "text",
				text: { content: "bold italic" },
				annotations: { bold: true, italic: true },
			},
		];
		expect(richTextToHtml(richText)).toBe("<strong><em>bold italic</em></strong>");
	});

	it("escapes HTML", () => {
		const richText = [
			{ type: "text", text: { content: "<script>alert('xss')</script>" }, annotations: {} },
		];
		expect(richTextToHtml(richText)).toBe("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
	});

	it("mention with href", () => {
		const richText = [
			{
				type: "mention",
				mention: { type: "page", page: { id: "abc123" } },
				plain_text: "Linked Page",
				href: "https://notion.so/abc123",
				annotations: {},
			},
		];
		expect(richTextToHtml(richText)).toBe('<a href="https://notion.so/abc123">Linked Page</a>');
	});

	it("mention with annotations", () => {
		const richText = [
			{
				type: "mention",
				mention: { type: "link_preview", link_preview: { url: "https://example.com" } },
				plain_text: "Example",
				href: "https://example.com",
				annotations: { bold: true },
			},
		];
		expect(richTextToHtml(richText)).toBe(
			'<a href="https://example.com"><strong>Example</strong></a>',
		);
	});
});

describe("blockToHtml", () => {
	it("paragraph", () => {
		const block = {
			type: "paragraph",
			paragraph: {
				rich_text: [{ type: "text", text: { content: "Hello world" }, annotations: {} }],
			},
		};
		expect(blockToHtml(block)).toBe("<p>Hello world</p>");
	});

	it("empty paragraph returns empty", () => {
		const block = {
			type: "paragraph",
			paragraph: { rich_text: [] },
		};
		expect(blockToHtml(block)).toBe("");
	});

	it("heading_1 → h2", () => {
		const block = {
			type: "heading_1",
			heading_1: {
				rich_text: [{ type: "text", text: { content: "Title" }, annotations: {} }],
			},
		};
		expect(blockToHtml(block)).toBe("<h2>Title</h2>");
	});

	it("heading_2 → h3", () => {
		const block = {
			type: "heading_2",
			heading_2: {
				rich_text: [{ type: "text", text: { content: "Subtitle" }, annotations: {} }],
			},
		};
		expect(blockToHtml(block)).toBe("<h3>Subtitle</h3>");
	});

	it("heading_3 → h4", () => {
		const block = {
			type: "heading_3",
			heading_3: {
				rich_text: [{ type: "text", text: { content: "Section" }, annotations: {} }],
			},
		};
		expect(blockToHtml(block)).toBe("<h4>Section</h4>");
	});

	it("quote", () => {
		const block = {
			type: "quote",
			quote: {
				rich_text: [{ type: "text", text: { content: "Quote text" }, annotations: {} }],
			},
		};
		expect(blockToHtml(block)).toBe("<blockquote>Quote text</blockquote>");
	});

	it("code block", () => {
		const block = {
			type: "code",
			code: {
				rich_text: [{ type: "text", text: { content: "const x = 1;" }, annotations: {} }],
				language: "javascript",
			},
		};
		expect(blockToHtml(block)).toBe("<pre><code>const x = 1;</code></pre>");
	});

	it("divider", () => {
		const block = { type: "divider", divider: {} };
		expect(blockToHtml(block)).toBe("<hr>");
	});

	it("bulleted_list_item", () => {
		const block = {
			type: "bulleted_list_item",
			bulleted_list_item: {
				rich_text: [{ type: "text", text: { content: "Item" }, annotations: {} }],
			},
		};
		expect(blockToHtml(block)).toBe("<li>Item</li>");
	});

	it("numbered_list_item", () => {
		const block = {
			type: "numbered_list_item",
			numbered_list_item: {
				rich_text: [{ type: "text", text: { content: "Item" }, annotations: {} }],
			},
		};
		expect(blockToHtml(block)).toBe("<li>Item</li>");
	});

	it("image with caption", () => {
		const block = {
			type: "image",
			image: {
				type: "file",
				file: { url: "https://example.com/image.png" },
				caption: [{ type: "text", text: { content: "Caption" }, annotations: {} }],
			},
		};
		expect(blockToHtml(block)).toBe(
			'<figure><img src="https://example.com/image.png" alt="Caption"><figcaption>Caption</figcaption></figure>',
		);
	});

	it("image without caption", () => {
		const block = {
			type: "image",
			image: {
				type: "external",
				external: { url: "https://example.com/image.png" },
				caption: [],
			},
		};
		expect(blockToHtml(block)).toBe(
			'<figure><img src="https://example.com/image.png" alt=""></figure>',
		);
	});

	it("unsupported block returns empty", () => {
		const block = { type: "toggle", toggle: {} };
		expect(blockToHtml(block)).toBe("");
	});
});

describe("blocksToHtml", () => {
	it("wraps consecutive bulleted items in ul", () => {
		const blocks = [
			{
				type: "bulleted_list_item",
				bulleted_list_item: {
					rich_text: [{ type: "text", text: { content: "A" }, annotations: {} }],
				},
			},
			{
				type: "bulleted_list_item",
				bulleted_list_item: {
					rich_text: [{ type: "text", text: { content: "B" }, annotations: {} }],
				},
			},
		];
		expect(blocksToHtml(blocks)).toBe("<ul><li>A</li><li>B</li></ul>");
	});

	it("wraps consecutive numbered items in ol", () => {
		const blocks = [
			{
				type: "numbered_list_item",
				numbered_list_item: {
					rich_text: [{ type: "text", text: { content: "1" }, annotations: {} }],
				},
			},
			{
				type: "numbered_list_item",
				numbered_list_item: {
					rich_text: [{ type: "text", text: { content: "2" }, annotations: {} }],
				},
			},
		];
		expect(blocksToHtml(blocks)).toBe("<ol><li>1</li><li>2</li></ol>");
	});

	it("handles nested list items", () => {
		const blocks = [
			{
				type: "bulleted_list_item",
				bulleted_list_item: {
					rich_text: [{ type: "text", text: { content: "Parent" }, annotations: {} }],
				},
				children: [
					{
						type: "bulleted_list_item",
						bulleted_list_item: {
							rich_text: [{ type: "text", text: { content: "Child" }, annotations: {} }],
						},
					},
				],
			},
		];
		expect(blocksToHtml(blocks)).toBe("<ul><li>Parent<ul><li>Child</li></ul></li></ul>");
	});

	it("mixed content", () => {
		const blocks = [
			{
				type: "paragraph",
				paragraph: {
					rich_text: [{ type: "text", text: { content: "Intro" }, annotations: {} }],
				},
			},
			{
				type: "bulleted_list_item",
				bulleted_list_item: {
					rich_text: [{ type: "text", text: { content: "Item" }, annotations: {} }],
				},
			},
			{
				type: "paragraph",
				paragraph: {
					rich_text: [{ type: "text", text: { content: "Outro" }, annotations: {} }],
				},
			},
		];
		expect(blocksToHtml(blocks)).toBe("<p>Intro</p><ul><li>Item</li></ul><p>Outro</p>");
	});
});
