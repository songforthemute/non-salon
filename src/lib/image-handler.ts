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

interface BmffBox {
	type: string;
	contentStart: number;
	end: number;
}

const AVIF_BRANDS = new Set(["avif", "avis"]);

function readBmffBox(buffer: Buffer, start: number, end: number): BmffBox | undefined {
	if (start + 8 > end) return undefined;

	const size = buffer.readUInt32BE(start);
	const type = buffer.subarray(start + 4, start + 8).toString("ascii");
	let headerSize = 8;
	let boxEnd: number;

	if (size === 1) {
		if (start + 16 > end) return undefined;
		const largeSize = buffer.readBigUInt64BE(start + 8);
		if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
		boxEnd = start + Number(largeSize);
		headerSize = 16;
	} else if (size === 0) {
		boxEnd = end;
	} else {
		boxEnd = start + size;
	}

	if (boxEnd > end || boxEnd < start + headerSize) return undefined;
	return { type, contentStart: start + headerSize, end: boxEnd };
}

function hasAvifFileType(buffer: Buffer): boolean {
	let offset = 0;
	while (offset < buffer.length) {
		const box = readBmffBox(buffer, offset, buffer.length);
		if (!box) return false;

		if (box.type === "ftyp") {
			if (box.contentStart + 8 > box.end) return false;
			const brands = [buffer.subarray(box.contentStart, box.contentStart + 4).toString("ascii")];
			for (let brandOffset = box.contentStart + 8; brandOffset + 4 <= box.end; brandOffset += 4) {
				brands.push(buffer.subarray(brandOffset, brandOffset + 4).toString("ascii"));
			}
			return brands.some((brand) => AVIF_BRANDS.has(brand));
		}

		offset = box.end;
	}

	return false;
}

interface AvifProperty {
	type: string;
	dimensions?: ImageDimensions;
	rotation?: number;
}

interface AvifItemProperties {
	properties: AvifProperty[];
	associations: Map<number, number[]>;
}

function getBmffBoxes(buffer: Buffer, start: number, end: number): BmffBox[] | undefined {
	const boxes: BmffBox[] = [];
	let offset = start;
	while (offset < end) {
		const box = readBmffBox(buffer, offset, end);
		if (!box) return undefined;
		boxes.push(box);
		offset = box.end;
	}
	return offset === end ? boxes : undefined;
}

function getFullBoxVersion(buffer: Buffer, box: BmffBox): number | undefined {
	return box.contentStart + 4 <= box.end ? buffer[box.contentStart] : undefined;
}

function parseAvifPrimaryItemId(buffer: Buffer, box: BmffBox): number | undefined {
	const version = getFullBoxVersion(buffer, box);
	if (version === 0 && box.contentStart + 6 === box.end) {
		return buffer.readUInt16BE(box.contentStart + 4);
	}
	if (version === 1 && box.contentStart + 8 === box.end) {
		return buffer.readUInt32BE(box.contentStart + 4);
	}
	return undefined;
}

function parseAvifProperties(buffer: Buffer, box: BmffBox): AvifProperty[] | undefined {
	const boxes = getBmffBoxes(buffer, box.contentStart, box.end);
	if (!boxes) return undefined;

	const properties: AvifProperty[] = [];
	for (const propertyBox of boxes) {
		if (propertyBox.type === "ispe") {
			// ispe is a version-zero FullBox followed by 32-bit width and height.
			if (
				getFullBoxVersion(buffer, propertyBox) !== 0 ||
				propertyBox.contentStart + 12 !== propertyBox.end
			) {
				return undefined;
			}
			const width = buffer.readUInt32BE(propertyBox.contentStart + 4);
			const height = buffer.readUInt32BE(propertyBox.contentStart + 8);
			if (width === 0 || height === 0) return undefined;
			properties.push({ type: "ispe", dimensions: { width, height } });
			continue;
		}

		if (propertyBox.type === "irot") {
			if (propertyBox.contentStart + 1 !== propertyBox.end) return undefined;
			const rotation = buffer[propertyBox.contentStart];
			if ((rotation & 0xfc) !== 0) return undefined;
			properties.push({ type: "irot", rotation });
			continue;
		}

		if (propertyBox.type === "imir") {
			if (propertyBox.contentStart + 1 !== propertyBox.end) return undefined;
			if ((buffer[propertyBox.contentStart] & 0xfe) !== 0) return undefined;
			properties.push({ type: "imir" });
			continue;
		}

		properties.push({ type: propertyBox.type });
	}
	return properties;
}

function parseAvifPropertyAssociations(
	buffer: Buffer,
	box: BmffBox,
): Map<number, number[]> | undefined {
	const version = getFullBoxVersion(buffer, box);
	if (version !== 0 && version !== 1) return undefined;
	if (box.contentStart + 8 > box.end) return undefined;

	const flags = buffer.readUIntBE(box.contentStart + 1, 3);
	if ((flags & ~1) !== 0) return undefined;
	const largeIndexes = (flags & 1) !== 0;
	const entryCount = buffer.readUInt32BE(box.contentStart + 4);
	const associations = new Map<number, number[]>();
	let offset = box.contentStart + 8;

	for (let entry = 0; entry < entryCount; entry++) {
		const itemIdSize = version === 0 ? 2 : 4;
		if (offset + itemIdSize + 1 > box.end) return undefined;
		const itemId = version === 0 ? buffer.readUInt16BE(offset) : buffer.readUInt32BE(offset);
		offset += itemIdSize;
		const associationCount = buffer[offset++];
		const indexSize = largeIndexes ? 2 : 1;
		if (offset + associationCount * indexSize > box.end || associations.has(itemId))
			return undefined;

		const propertyIndexes: number[] = [];
		for (let association = 0; association < associationCount; association++) {
			const value = largeIndexes ? buffer.readUInt16BE(offset) : buffer[offset];
			offset += indexSize;
			const propertyIndex = largeIndexes ? value & 0x7fff : value & 0x7f;
			if (propertyIndex === 0) return undefined;
			propertyIndexes.push(propertyIndex);
		}
		associations.set(itemId, propertyIndexes);
	}

	return offset === box.end ? associations : undefined;
}

function parseAvifItemProperties(buffer: Buffer, box: BmffBox): AvifItemProperties | undefined {
	const boxes = getBmffBoxes(buffer, box.contentStart, box.end);
	if (!boxes) return undefined;

	const ipco = boxes.filter((child) => child.type === "ipco");
	const ipma = boxes.filter((child) => child.type === "ipma");
	if (ipco.length !== 1 || ipma.length !== 1) return undefined;

	const properties = parseAvifProperties(buffer, ipco[0]);
	const associations = parseAvifPropertyAssociations(buffer, ipma[0]);
	return properties && associations ? { properties, associations } : undefined;
}

function getAvifDimensions(buffer: Buffer): ImageDimensions | undefined {
	const topLevelBoxes = getBmffBoxes(buffer, 0, buffer.length);
	if (!topLevelBoxes) return undefined;
	const metaBoxes = topLevelBoxes.filter((box) => box.type === "meta");
	if (metaBoxes.length !== 1) return undefined;

	const meta = metaBoxes[0];
	// meta is a FullBox, so its nested boxes begin after version and flags.
	if (getFullBoxVersion(buffer, meta) !== 0 || meta.contentStart + 4 > meta.end) return undefined;
	const metaChildren = getBmffBoxes(buffer, meta.contentStart + 4, meta.end);
	if (!metaChildren) return undefined;
	const pitm = metaChildren.filter((child) => child.type === "pitm");
	const iprp = metaChildren.filter((child) => child.type === "iprp");
	if (pitm.length !== 1 || iprp.length !== 1) return undefined;

	const primaryItemId = parseAvifPrimaryItemId(buffer, pitm[0]);
	const itemProperties = parseAvifItemProperties(buffer, iprp[0]);
	if (primaryItemId === undefined || !itemProperties) return undefined;

	const propertyIndexes = itemProperties.associations.get(primaryItemId);
	if (!propertyIndexes) return undefined;
	const primaryProperties: AvifProperty[] = [];
	for (const propertyIndex of propertyIndexes) {
		const property = itemProperties.properties[propertyIndex - 1];
		if (!property) return undefined;
		primaryProperties.push(property);
	}

	// clean aperture and pixel aspect ratio alter the displayed aspect ratio; without
	// implementing them, reserve no space rather than reserve the wrong space.
	if (primaryProperties.some((property) => property.type === "clap" || property.type === "pasp"))
		return undefined;
	const spatialExtents = primaryProperties.filter(
		(property): property is AvifProperty & { dimensions: ImageDimensions } =>
			property.type === "ispe" && property.dimensions !== undefined,
	);
	if (spatialExtents.length !== 1) return undefined;

	const rotations = primaryProperties.filter((property) => property.type === "irot");
	if (rotations.length > 1 || rotations.some((property) => property.rotation === undefined))
		return undefined;
	const { width, height } = spatialExtents[0].dimensions;
	return rotations[0]?.rotation === 1 || rotations[0]?.rotation === 3
		? { width: height, height: width }
		: { width, height };
}

function getSvgAttribute(svgTag: string, name: string): string | undefined {
	const attribute = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
	const match = svgTag.match(attribute);
	return match?.[1] ?? match?.[2];
}

function getJpegExifOrientation(segment: Buffer): number | undefined {
	// APP1 Exif payloads begin with an Exif identifier, followed by a TIFF header.
	if (segment.length < 14 || !startsWithBytes(segment, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00])) {
		return undefined;
	}

	const tiffStart = 6;
	const byteOrder = segment.subarray(tiffStart, tiffStart + 2).toString("ascii");
	const readUInt16 =
		byteOrder === "II"
			? (offset: number) => segment.readUInt16LE(offset)
			: byteOrder === "MM"
				? (offset: number) => segment.readUInt16BE(offset)
				: undefined;
	const readUInt32 =
		byteOrder === "II"
			? (offset: number) => segment.readUInt32LE(offset)
			: byteOrder === "MM"
				? (offset: number) => segment.readUInt32BE(offset)
				: undefined;
	if (!readUInt16 || !readUInt32 || tiffStart + 8 > segment.length) return undefined;

	// TIFF's fixed marker is 42; reject arbitrary APP1 payloads before following offsets.
	if (readUInt16(tiffStart + 2) !== 42) return undefined;

	const ifdOffset = readUInt32(tiffStart + 4);
	const ifdStart = tiffStart + ifdOffset;
	if (ifdStart + 2 > segment.length) return undefined;

	const entryCount = readUInt16(ifdStart);
	const entriesStart = ifdStart + 2;
	const entriesEnd = entriesStart + entryCount * 12;
	if (entriesEnd > segment.length) return undefined;

	for (let index = 0; index < entryCount; index++) {
		const entryStart = entriesStart + index * 12;
		if (readUInt16(entryStart) !== 0x0112) continue;

		// Orientation is one TIFF SHORT stored inline in the entry's value field.
		if (readUInt16(entryStart + 2) !== 3 || readUInt32(entryStart + 4) !== 1) return undefined;
		const orientation = readUInt16(entryStart + 8);
		return orientation >= 1 && orientation <= 8 ? orientation : undefined;
	}

	return undefined;
}

function getJpegDimensions(buffer: Buffer): ImageDimensions | undefined {
	let offset = 2;
	let dimensions: ImageDimensions | undefined;
	let orientation: number | undefined;

	while (offset < buffer.length) {
		if (buffer[offset] !== 0xff) {
			offset++;
			continue;
		}

		while (buffer[offset] === 0xff) offset++;
		if (offset >= buffer.length) break;

		const marker = buffer[offset++];
		if (
			marker === 0x00 ||
			marker === 0xd8 ||
			marker === 0xd9 ||
			marker === 0x01 ||
			(marker >= 0xd0 && marker <= 0xd7)
		) {
			continue;
		}
		if (offset + 2 > buffer.length) break;

		const segmentLength = buffer.readUInt16BE(offset);
		if (segmentLength < 2 || offset + segmentLength > buffer.length) break;

		const segmentDataStart = offset + 2;
		const segmentEnd = offset + segmentLength;
		if (marker === 0xe1) {
			orientation ??= getJpegExifOrientation(buffer.subarray(segmentDataStart, segmentEnd));
		} else if (
			[0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
				marker,
			) &&
			segmentLength >= 8
		) {
			const height = buffer.readUInt16BE(offset + 3);
			const width = buffer.readUInt16BE(offset + 5);
			if (width > 0 && height > 0) dimensions = { width, height };
		}

		if (marker === 0xda) break;
		offset = segmentEnd;
	}

	if (!dimensions) return undefined;
	return orientation && [5, 6, 7, 8].includes(orientation)
		? { width: dimensions.height, height: dimensions.width }
		: dimensions;
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
		return getJpegDimensions(buffer);
	}

	// AVIF stores its display dimensions in an ISO-BMFF ImageSpatialExtents box.
	// Resolve the primary item through its property associations before reading it.
	if (hasAvifFileType(buffer)) {
		const dimensions = getAvifDimensions(buffer);
		if (dimensions) return dimensions;
	}

	const svg = buffer.subarray(0, 1024).toString("utf8");
	const svgTag = svg.match(/<svg\b[^>]*>/i)?.[0];
	if (svgTag) {
		const width = getSvgAttribute(svgTag, "width");
		const height = getSvgAttribute(svgTag, "height");
		const absoluteLength = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/;
		const absoluteWidth = width?.match(absoluteLength)?.[1];
		const absoluteHeight = height?.match(absoluteLength)?.[1];
		if (absoluteWidth && absoluteHeight) {
			return { width: Number(absoluteWidth), height: Number(absoluteHeight) };
		}

		const svgNumber = "[+-]?(?:(?:\\d+\\.?\\d*)|(?:\\.\\d+))(?:[eE][+-]?\\d+)?";
		const viewBoxSeparator = "(?:\\s*,\\s*|\\s+)";
		const viewBox = getSvgAttribute(svgTag, "viewBox")?.match(
			new RegExp(
				`^\\s*(${svgNumber})${viewBoxSeparator}(${svgNumber})${viewBoxSeparator}(${svgNumber})${viewBoxSeparator}(${svgNumber})\\s*$`,
			),
		);
		if (viewBox) {
			const width = Number(viewBox[3]);
			const height = Number(viewBox[4]);
			if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
				return { width, height };
			}
		}
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
