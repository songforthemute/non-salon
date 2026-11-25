import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blockToHtml } from "./block-to-html";
import { localizePostMedia } from "./media-handler";

const slug = "vitest-media-localization";
const directory = path.join(process.cwd(), "public", "media", "publication", slug);

afterEach(async () => {
	vi.unstubAllGlobals();
	await fs.rm(directory, { recursive: true, force: true });
});

describe("localizePostMedia", () => {
	it("saves a hosted PDF and renders a stable local link", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response("%PDF-test", {
						headers: { "content-type": "application/pdf" },
					}),
			),
		);
		const { blocks, downloadedCount } = await localizePostMedia("publication", slug, [
			{
				id: "pdf-1",
				type: "pdf",
				pdf: { type: "file", file: { url: "https://file.notion.so/temporary" }, caption: [] },
			},
		]);
		expect(downloadedCount).toBe(1);
		expect(await fs.readFile(path.join(directory, "pdf-1.pdf"), "utf8")).toBe("%PDF-test");
		expect(blockToHtml(blocks[0])).toContain(`href="/media/publication/${slug}/pdf-1.pdf"`);
	});

	it("keeps failed hosted media visible without linking its temporary URL", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("expired", { status: 403 })),
		);
		const { blocks } = await localizePostMedia("publication", slug, [
			{
				id: "pdf-2",
				type: "pdf",
				pdf: { type: "file", file: { url: "https://file.notion.so/expired" }, caption: [] },
			},
		]);
		expect(blocks[0].media_error).toBe("download-failed");
		expect(blockToHtml(blocks[0])).not.toContain("href=");
	});

	it("reports a missing cached asset instead of emitting a dead link", async () => {
		const { blocks } = await localizePostMedia("publication", slug, [
			{
				id: "pdf-3",
				type: "pdf",
				pdf: { type: "file", file: { url: `/media/publication/${slug}/missing.pdf` }, caption: [] },
			},
		]);
		expect(blocks[0].media_error).toBe("cached-file-missing");
		expect(blockToHtml(blocks[0])).not.toContain("href=");
	});
});
