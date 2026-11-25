import { describe, expect, it, vi } from "vitest";
import type { Block } from "../types";
import { refreshSyncedBlocks } from "./synced-blocks";

describe("refreshSyncedBlocks", () => {
	it("replaces stale cached children with the current source content", async () => {
		const duplicate: Block = {
			id: "duplicate",
			type: "synced_block",
			synced_block: { synced_from: { block_id: "source" } },
			children: [{ type: "paragraph", paragraph: { rich_text: [] } }],
		};
		const load = vi.fn(async () => [{ type: "equation", equation: { expression: "new" } }]);
		const result = await refreshSyncedBlocks([duplicate], load);
		expect(load).toHaveBeenCalledWith("source");
		expect(result[0].children).toEqual([{ type: "equation", equation: { expression: "new" } }]);
	});

	it("stops cycles and exposes a visible failure marker", async () => {
		const load = vi.fn(async () => [
			{
				id: "again",
				type: "synced_block",
				synced_block: { synced_from: { block_id: "source" } },
			},
		]);
		const result = await refreshSyncedBlocks(
			[
				{
					id: "first",
					type: "synced_block",
					synced_block: { synced_from: { block_id: "source" } },
				},
			],
			load,
		);
		expect(load).toHaveBeenCalledTimes(1);
		expect(result[0].children?.[0].sync_error).toBe("cycle");
	});
});
