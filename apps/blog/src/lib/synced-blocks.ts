import type { Block } from "../types";

type LoadChildren = (blockId: string) => Promise<Block[]>;

// Duplicates do not contain their source's children in Notion's block response.
// Refresh them even when the containing page is cached: editing the source does
// not necessarily update that page's last_edited_time.
export async function refreshSyncedBlocks(
	blocks: Block[],
	loadChildren: LoadChildren,
	activeSources = new Set<string>(),
): Promise<Block[]> {
	const result: Block[] = [];
	for (const block of blocks) {
		const synced =
			block.type === "synced_block"
				? (block.synced_block as { synced_from?: { block_id: string } | null } | undefined)
				: undefined;
		const sourceId = synced?.synced_from?.block_id;
		if (sourceId) {
			if (activeSources.has(sourceId)) {
				console.warn(`Synced block cycle: ${block.id ?? "unknown"} → ${sourceId}`);
				result.push({ ...block, children: [], sync_error: "cycle" });
				continue;
			}
			try {
				const nextSources = new Set(activeSources).add(sourceId);
				const children = await refreshSyncedBlocks(
					await loadChildren(sourceId),
					loadChildren,
					nextSources,
				);
				result.push({ ...block, children, sync_error: undefined });
			} catch (error) {
				console.warn(
					`Could not load synced block ${block.id ?? "unknown"} from ${sourceId}:`,
					error,
				);
				result.push({ ...block, children: [], sync_error: "unavailable" });
			}
		} else if (block.children?.length) {
			result.push({
				...block,
				children: await refreshSyncedBlocks(block.children, loadChildren, activeSources),
			});
		} else {
			result.push(block);
		}
	}
	return result;
}
