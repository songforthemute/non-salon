import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PATHS } from "@/config";
import type { Block } from "@/types";

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), PATHS.images);

interface ImageInfo {
	blockId: string;
	originalUrl: string;
	localPath: string;
}

interface ImageDimensions {
	width: number;
	height: number;
}

interface DownloadedImage {
	path: string;
	dimensions?: ImageDimensions;
}

function startsWithBytes(buffer: Buffer, bytes: readonly number[]): boolean {
	return bytes.every((byte, index) => buffer[index] === byte);
}

function getImageExtension(url: string, contentType?: string): string {
	// Content-Type 기반
	if (contentType) {
		const match = contentType.match(/image\/(\w+)/);
		if (match) {
			const ext = match[1].toLowerCase();
			if (ext === "jpeg") return "jpg";
			return ext;
		}
	}

	// URL 기반
	const urlPath = new URL(url).pathname;
	const ext = path.extname(urlPath).toLowerCase().replace(".", "");
	if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext)) {
		return ext === "jpeg" ? "jpg" : ext;
	}

	return "png"; // 기본값
}

function extractImagesFromBlocks(blocks: Block[]): ImageInfo[] {
	const images: ImageInfo[] = [];

	function walk(block: Block) {
		if (block.type === "image" && block.image && block.id) {
			const { image } = block;
			let originalUrl = "";

			if (image.type === "file" && image.file) {
				originalUrl = image.file.url;
			} else if (image.type === "external" && image.external) {
				originalUrl = image.external.url;
			}

			if (originalUrl) {
				images.push({
					blockId: block.id.replace(/-/g, ""),
					originalUrl,
					localPath: "", // 다운로드 후 채움
				});
			}
		}

		if (block.children) {
			for (const child of block.children) {
				walk(child);
			}
		}
	}

	for (const block of blocks) {
		walk(block);
	}

	return images;
}

export function getImageDimensions(buffer: Buffer): ImageDimensions | undefined {
	if (
		buffer.length >= 24 &&
		startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
	) {
		return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
	}

	if (buffer.length >= 10 && buffer.subarray(0, 3).toString() === "GIF") {
		return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
	}

	if (
		buffer.length >= 30 &&
		buffer.subarray(0, 4).toString() === "RIFF" &&
		buffer.subarray(8, 12).toString() === "WEBP"
	) {
		const format = buffer.subarray(12, 16).toString();
		if (format === "VP8X") {
			return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
		}
		if (format === "VP8 ") {
			return {
				width: buffer.readUInt16LE(26) & 0x3fff,
				height: buffer.readUInt16LE(28) & 0x3fff,
			};
		}
		if (format === "VP8L" && buffer[20] === 0x2f) {
			const dimensions = buffer.readUInt32LE(21);
			return {
				width: (dimensions & 0x3fff) + 1,
				height: ((dimensions >> 14) & 0x3fff) + 1,
			};
		}
	}

	if (buffer.length >= 12 && startsWithBytes(buffer, [0xff, 0xd8])) {
		let offset = 2;
		while (offset + 9 < buffer.length) {
			if (buffer[offset] !== 0xff) {
				offset++;
				continue;
			}

			const marker = buffer[offset + 1];
			offset += 2;
			if (marker === 0xd8 || marker === 0xd9) continue;

			const segmentLength = buffer.readUInt16BE(offset);
			if (segmentLength < 2 || offset + segmentLength > buffer.length) return undefined;

			if (
				[0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
					marker,
				)
			) {
				return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
			}

			offset += segmentLength;
		}
	}

	// AVIF stores its display dimensions in the ISO-BMFF ImageSpatialExtents box.
	const imageSpatialExtents = buffer.indexOf("ispe");
	if (imageSpatialExtents >= 4 && imageSpatialExtents + 16 <= buffer.length) {
		return {
			width: buffer.readUInt32BE(imageSpatialExtents + 8),
			height: buffer.readUInt32BE(imageSpatialExtents + 12),
		};
	}

	const svg = buffer.subarray(0, 1024).toString("utf8");
	if (svg.includes("<svg")) {
		const width = svg.match(/\bwidth=["']([^"']+)["']/)?.[1];
		const height = svg.match(/\bheight=["']([^"']+)["']/)?.[1];
		const absoluteLength = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/;
		const absoluteWidth = width?.match(absoluteLength)?.[1];
		const absoluteHeight = height?.match(absoluteLength)?.[1];
		if (absoluteWidth && absoluteHeight) {
			return { width: Number(absoluteWidth), height: Number(absoluteHeight) };
		}

		const viewBox = svg.match(/\bviewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/);
		if (viewBox) return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
	}

	return undefined;
}

async function downloadImage(url: string, destPath: string): Promise<DownloadedImage> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to download image: ${response.status} ${url}`);
	}

	const contentType = response.headers.get("content-type") || undefined;
	const ext = getImageExtension(url, contentType);
	const finalPath = destPath.replace(/\.[^.]+$/, `.${ext}`);

	const buffer = Buffer.from(await response.arrayBuffer());
	await fs.writeFile(finalPath, buffer);

	return { path: finalPath, dimensions: getImageDimensions(buffer) };
}

// 블록 내 이미지 URL이 원격(http)인지 확인 — 로컬 경로면 이미 처리된 캐시
export function hasRemoteImages(blocks: Block[]): boolean {
	function check(block: Block): boolean {
		if (block.type === "image" && block.image) {
			const url = block.image.type === "file" ? block.image.file?.url : block.image.external?.url;
			if (url?.startsWith("http")) return true;
		}
		return block.children?.some(check) ?? false;
	}
	return blocks.some(check);
}

export async function processPostImages(
	type: string,
	slug: string,
	blocks: Block[],
): Promise<{ blocks: Block[]; downloadedCount: number }> {
	// /images/{type}/{slug}/ 구조
	const postImageDir = path.join(PUBLIC_IMAGES_DIR, type, slug);

	// 기존 이미지 폴더 삭제 후 재생성 (PRD: 전체 재다운로드)
	await fs.rm(postImageDir, { recursive: true, force: true });
	await fs.mkdir(postImageDir, { recursive: true });

	const images = extractImagesFromBlocks(blocks);

	if (images.length === 0) {
		// 이미지 없으면 빈 폴더도 삭제
		await fs.rm(postImageDir, { recursive: true, force: true });
		return { blocks, downloadedCount: 0 };
	}

	// URL 매핑 생성
	const urlMapping: Record<string, { url: string; dimensions?: ImageDimensions }> = {};

	for (const img of images) {
		const tempPath = path.join(postImageDir, `${img.blockId}.tmp`);

		try {
			const downloadedImage = await downloadImage(img.originalUrl, tempPath);
			const relativePath = `/images/${type}/${slug}/${path.basename(downloadedImage.path)}`;
			urlMapping[img.originalUrl] = { url: relativePath, dimensions: downloadedImage.dimensions };
			console.log(`  📷 ${path.basename(downloadedImage.path)}`);
		} catch (_error) {
			console.warn(`  ⚠️  Failed to download: ${img.blockId}`);
		}
	}

	// 블록 내 URL 교체
	function rewriteUrls(block: Block): Block {
		const newBlock = { ...block };

		if (newBlock.type === "image" && newBlock.image) {
			const img = { ...newBlock.image };

			const originalUrl = img.type === "file" ? img.file?.url : img.external?.url;
			const mappedImage = originalUrl ? urlMapping[originalUrl] : undefined;

			if (img.type === "file" && img.file && mappedImage) {
				img.file = { url: mappedImage.url };
			} else if (img.type === "external" && img.external && mappedImage) {
				img.external = { url: mappedImage.url };
			}

			if (mappedImage?.dimensions) {
				img.width = mappedImage.dimensions.width;
				img.height = mappedImage.dimensions.height;
			}

			newBlock.image = img;
		}

		if (newBlock.children) {
			newBlock.children = newBlock.children.map(rewriteUrls);
		}

		return newBlock;
	}

	const processedBlocks = blocks.map(rewriteUrls);

	return {
		blocks: processedBlocks,
		downloadedCount: Object.keys(urlMapping).length,
	};
}

function getLocalImagePath(url: string): string | undefined {
	if (!url.startsWith("/images/")) return undefined;

	const localPath = path.resolve(PUBLIC_IMAGES_DIR, "..", url.slice(1));
	const imagesDir = path.resolve(PUBLIC_IMAGES_DIR);
	return localPath.startsWith(`${imagesDir}${path.sep}`) ? localPath : undefined;
}

export async function populateImageDimensions(blocks: Block[]): Promise<Block[]> {
	async function enrich(block: Block): Promise<Block> {
		const newBlock = { ...block };

		if (
			newBlock.type === "image" &&
			newBlock.image &&
			(!newBlock.image.width || !newBlock.image.height)
		) {
			const url =
				newBlock.image.type === "file" ? newBlock.image.file?.url : newBlock.image.external?.url;
			const localPath = url ? getLocalImagePath(url) : undefined;

			if (localPath) {
				try {
					const dimensions = getImageDimensions(await fs.readFile(localPath));
					if (dimensions) {
						newBlock.image = { ...newBlock.image, ...dimensions };
					}
				} catch {
					// Keep rendering the image even when a cached local asset is unavailable.
				}
			}
		}

		if (newBlock.children) {
			newBlock.children = await Promise.all(newBlock.children.map(enrich));
		}

		return newBlock;
	}

	return Promise.all(blocks.map(enrich));
}

export async function cleanupOrphanedImages(
	currentPosts: Array<{ type: string; slug: string }>,
): Promise<number> {
	let removedCount = 0;
	const validPaths = new Set(currentPosts.map((p) => `${p.type}/${p.slug}`));

	try {
		const types = await fs.readdir(PUBLIC_IMAGES_DIR);

		for (const type of types) {
			const typePath = path.join(PUBLIC_IMAGES_DIR, type);
			const stat = await fs.stat(typePath);

			if (!stat.isDirectory()) continue;

			const slugs = await fs.readdir(typePath);

			for (const slug of slugs) {
				if (!validPaths.has(`${type}/${slug}`)) {
					await fs.rm(path.join(typePath, slug), { recursive: true, force: true });
					removedCount++;
				}
			}

			// 빈 type 폴더도 삭제
			const remaining = await fs.readdir(typePath);
			if (remaining.length === 0) {
				await fs.rm(typePath, { recursive: true, force: true });
			}
		}
	} catch {
		// 디렉토리가 없으면 무시
	}

	return removedCount;
}
