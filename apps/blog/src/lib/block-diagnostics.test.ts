import { describe, expect, it } from "vitest";
import { collectBlockDiagnostics } from "./block-diagnostics";

describe("collectBlockDiagnostics", () => {
	it("reports unsupported content and media failures with post and block paths", () => {
		const issues = collectBlockDiagnostics([
			{
				slug: "example",
				blocks: [
					{
						id: "parent",
						type: "unsupported",
						children: [{ id: "child", type: "pdf", media_error: "download-failed" }],
					},
				],
			},
		]);
		expect(issues).toEqual([
			{
				post: "example",
				blockId: "parent",
				path: "blocks/0",
				type: "unsupported",
				reason: "unrendered block type",
			},
			{
				post: "example",
				blockId: "child",
				path: "blocks/0/0",
				type: "pdf",
				reason: "media download-failed",
			},
		]);
	});

	it("reports unsupported rich text inside table cells", () => {
		const issues = collectBlockDiagnostics([
			{
				slug: "table-post",
				blocks: [
					{
						type: "table",
						children: [
							{ type: "table_row", table_row: { cells: [[{ type: "unknown", annotations: {} }]] } },
						],
					},
				],
			},
		]);
		expect(issues).toMatchObject([
			{ path: "blocks/0/0/cells/0/0", reason: "unrendered rich text type" },
		]);
	});
});
