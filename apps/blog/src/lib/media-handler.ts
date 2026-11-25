import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Block } from "../types";

const MEDIA_TYPES = new Set(["file", "pdf", "audio", "video", "embed"]);
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const CONTENT_EXTENSIONS: Record<string, string> = {
	"application/pdf": "pdf",
	"audio/mpeg": "mp3",
	"audio/mp4": "m4a",
	"audio/ogg": "ogg",
	"audio/wav": "wav",
	"video/mp4": "mp4",
	"video/webm": "webm",
};
const SAFE_EXTENSIONS = new Set([
	"pdf",
	"mp3",
	"m4a",
	"ogg",
	"wav",
	"mp4",
	"webm",
	"mov",
	"zip",
	"txt",
	"csv",
	"docx",
	"xlsx",
	"pptx",
]);

type MediaData = {
	type?: "file" | "external";
	file?: { url: string };
	external?: { url: string };
	url?: string;
};

export function notionHostedUrl(raw: string): boolean {
	try {
		const url = new URL(raw);
		return (
			url.protocol === "https:" &&
			(url.hostname === "file.notion.so" ||
				url.hostname.endsWith(".notion-static.com") ||
				(url.hostname.endsWith(".amazonaws.com") &&
					/notion|prod-files-secure/.test(url.pathname + url.hostname)))
		);
	} catch {
		return false;
	}
}

function hostedMediaUrl(block: Block): string | null {
	if (!MEDIA_TYPES.has(block.type)) return null;
	const data = block[block.type] as MediaData | undefined;
	if (!data) return null;
	if (data.type === "file" && data.file?.url?.startsWith("https://")) return data.file.url;
	if (block.type === "embed" && data.url && notionHostedUrl(data.url)) return data.url;
	return null;
}

function mediaExtension(url: string, contentType: string | null): string {
	const mime = contentType?.split(";")[0].trim().toLowerCase();
	if (mime && CONTENT_EXTENSIONS[mime]) return CONTENT_EXTENSIONS[mime];
	const ext = path.extname(new URL(url).pathname).slice(1).toLowerCase();
	return SAFE_EXTENSIONS.has(ext) ? ext : "bin";
}

async function downloadMedia(url: string, destination: string): Promise<void> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		if (response.headers.get("content-type")?.toLowerCase().startsWith("text/html")) {
			throw new Error("unexpected HTML response");
		}
		const length = Number(response.headers.get("content-length"));
		if (length > MAX_MEDIA_BYTES) throw new Error("file exceeds 50 MB");
		if (!response.body) throw new Error("empty response");
		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let bytes = 0;
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				bytes += value.byteLength;
				if (bytes > MAX_MEDIA_BYTES) {
					controller.abort();
					throw new Error("file exceeds 50 MB");
				}
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}
		if (bytes === 0) throw new Error("empty response");
		const extension = mediaExtension(url, response.headers.get("content-type"));
		await fs.writeFile(`${destination}.${extension}`, Buffer.concat(chunks, bytes));
	} finally {
		clearTimeout(timeout);
	}
}

export async function localizePostMedia(
	postType: string,
	slug: string,
	blocks: Block[],
): Promise<{ blocks: Block[]; downloadedCount: number }> {
	const directory = path.join(process.cwd(), "public", "media", postType, slug);
	let downloadedCount = 0;
	async function walk(items: Block[]): Promise<Block[]> {
		const result: Block[] = [];
		for (const block of items) {
			const copy = { ...block };
			// A cached failure is not the result of this build's download or file check.
			delete copy.media_error;
			const url = hostedMediaUrl(block);
			const data = MEDIA_TYPES.has(block.type)
				? (block[block.type] as MediaData | undefined)
				: undefined;
			const cachedUrl =
				data?.type === "file" ? data.file?.url : block.type === "embed" ? data?.url : undefined;
			if (cachedUrl?.startsWith("/media/")) {
				const localPath = path.resolve(process.cwd(), "public", cachedUrl.slice(1));
				const mediaRoot = path.resolve(process.cwd(), "public", "media");
				if (localPath.startsWith(`${mediaRoot}${path.sep}`)) {
					try {
						await fs.access(localPath);
					} catch {
						copy.media_error = "cached-file-missing";
					}
				}
			}
			if (url) {
				const id = (block.id || `media-${downloadedCount}`).replace(/[^a-zA-Z0-9-]/g, "");
				const base = path.join(directory, id);
				await fs.mkdir(directory, { recursive: true });
				try {
					for (const name of await fs.readdir(directory)) {
						if (name.startsWith(`${id}.`)) await fs.rm(path.join(directory, name));
					}
					await downloadMedia(url, base);
					const filename = (await fs.readdir(directory)).find((name) => name.startsWith(`${id}.`));
					if (!filename) throw new Error("downloaded file missing");
					const localUrl = `/media/${postType}/${slug}/${filename}`;
					const data = { ...(block[block.type] as MediaData) };
					if (block.type === "embed") data.url = localUrl;
					else data.file = { url: localUrl };
					copy[block.type] = data;
					downloadedCount++;
				} catch (error) {
					console.warn(
						`Media download failed (${postType}/${slug}, ${block.type}, ${block.id ?? "unknown"}):`,
						error,
					);
					copy.media_error = "download-failed";
				}
			}
			if (block.children?.length) copy.children = await walk(block.children);
			result.push(copy);
		}
		return result;
	}
	return { blocks: await walk(blocks), downloadedCount };
}

export async function cleanupOrphanedMedia(
	posts: { type: string; slug: string }[],
): Promise<number> {
	const root = path.join(process.cwd(), "public", "media");
	const valid = new Set(posts.map((post) => `${post.type}/${post.slug}`));
	let removed = 0;
	let types: string[];
	try {
		types = await fs.readdir(root);
	} catch {
		return 0;
	}
	for (const type of types) {
		const typePath = path.join(root, type);
		if (!(await fs.stat(typePath)).isDirectory()) continue;
		for (const slug of await fs.readdir(typePath)) {
			if (valid.has(`${type}/${slug}`)) continue;
			await fs.rm(path.join(typePath, slug), { recursive: true, force: true });
			removed++;
		}
		if ((await fs.readdir(typePath)).length === 0) {
			await fs.rm(typePath, { recursive: true, force: true });
		}
	}
	return removed;
}
