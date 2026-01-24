import * as fs from "node:fs/promises";
import * as path from "node:path";

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), "public", "images");

interface ImageBlock {
	id: string;
	type: "image";
	image: {
		type: "file" | "external";
		file?: { url: string };
		external?: { url: string };
		caption: unknown[];
	};
}

interface Block {
	id?: string;
	type: string;
	children?: Block[];
	image?: ImageBlock["image"];
	[key: string]: unknown;
}

interface ImageInfo {
	blockId: string;
	originalUrl: string;
	localPath: string;
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

async function downloadImage(url: string, destPath: string): Promise<string> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to download image: ${response.status} ${url}`);
	}

	const contentType = response.headers.get("content-type") || undefined;
	const ext = getImageExtension(url, contentType);
	const finalPath = destPath.replace(/\.[^.]+$/, `.${ext}`);

	const buffer = Buffer.from(await response.arrayBuffer());
	await fs.writeFile(finalPath, buffer);

	return finalPath;
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
	const urlMapping: Record<string, string> = {};

	for (const img of images) {
		const tempPath = path.join(postImageDir, `${img.blockId}.tmp`);

		try {
			const finalPath = await downloadImage(img.originalUrl, tempPath);
			const relativePath = `/images/${type}/${slug}/${path.basename(finalPath)}`;
			urlMapping[img.originalUrl] = relativePath;
			console.log(`  📷 ${path.basename(finalPath)}`);
		} catch (error) {
			console.warn(`  ⚠️  Failed to download: ${img.blockId}`);
		}
	}

	// 블록 내 URL 교체
	function rewriteUrls(block: Block): Block {
		const newBlock = { ...block };

		if (newBlock.type === "image" && newBlock.image) {
			const img = { ...newBlock.image };

			if (img.type === "file" && img.file && urlMapping[img.file.url]) {
				img.file = { url: urlMapping[img.file.url] };
			} else if (img.type === "external" && img.external && urlMapping[img.external.url]) {
				img.external = { url: urlMapping[img.external.url] };
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
