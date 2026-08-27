import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PATHS } from "@/config";
import type { Block } from "@/types";

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), PATHS.images);
// Remote Notion assets are untrusted input. Keep the build bounded when an asset is
// unexpectedly large or a malformed AVIF advertises excessive metadata entries.
const MAX_IMAGE_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_BMFF_BOXES = 1_024;
const MAX_AVIF_ASSOCIATION_ENTRIES = 1_024;
const MAX_AVIF_PROPERTY_ASSOCIATIONS = 4_096;

const BMFF_UINT16_BYTES = 2;
const BMFF_UINT32_BYTES = 4;
const BMFF_BOX_HEADER_BYTES = BMFF_UINT32_BYTES * 2;
const BMFF_LARGE_SIZE_HEADER_BYTES = BMFF_BOX_HEADER_BYTES * 2;
const BMFF_BOX_TYPE_OFFSET = BMFF_UINT32_BYTES;
const BMFF_BRAND_BYTES = BMFF_UINT32_BYTES;
const BMFF_FULL_BOX_HEADER_BYTES = BMFF_UINT32_BYTES;
const BMFF_FULL_BOX_FLAGS_BYTES = 3;
const IPMA_LARGE_PROPERTY_INDEX_FLAG = 0x1;
const IPMA_LARGE_PROPERTY_INDEX_MASK = 0x7fff;
const IPMA_SMALL_PROPERTY_INDEX_MASK = 0x7f;
const IROT_RESERVED_BITS_MASK = 0xfc;
const IMIR_RESERVED_BITS_MASK = 0xfe;
const IROT_QUARTER_TURN = 1;
const IROT_THREE_QUARTER_TURNS = 3;

const EXIF_IDENTIFIER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] as const;
const EXIF_TIFF_OFFSET = 6;
const TIFF_LITTLE_ENDIAN_BYTE_ORDER = "II";
const TIFF_BIG_ENDIAN_BYTE_ORDER = "MM";
const TIFF_BYTE_ORDER_BYTES = 2;
const TIFF_HEADER_BYTES = 8;
const TIFF_MAGIC_OFFSET = 2;
const TIFF_MAGIC = 42;
const TIFF_FIRST_IFD_OFFSET = 4;
const TIFF_IFD_ENTRY_COUNT_BYTES = 2;
const TIFF_IFD_ENTRY_BYTES = 12;
const TIFF_ORIENTATION_TAG = 0x0112;
const TIFF_SHORT_TYPE = 3;
const TIFF_ORIENTATION_COMPONENT_COUNT = 1;
const TIFF_ENTRY_TYPE_OFFSET = 2;
const TIFF_ENTRY_COMPONENT_COUNT_OFFSET = 4;
const TIFF_ENTRY_VALUE_OFFSET = 8;

const JPEG_MARKER_PREFIX = 0xff;
const JPEG_STUFFED_BYTE_MARKER = 0x00;
const JPEG_START_OF_IMAGE_MARKER = 0xd8;
const JPEG_END_OF_IMAGE_MARKER = 0xd9;
const JPEG_TEM_MARKER = 0x01;
const JPEG_RESTART_MARKER_FIRST = 0xd0;
const JPEG_RESTART_MARKER_LAST = 0xd7;
const JPEG_EXIF_APP1_MARKER = 0xe1;
const JPEG_START_OF_SCAN_MARKER = 0xda;
const JPEG_SEGMENT_LENGTH_BYTES = 2;
const JPEG_MINIMUM_SEGMENT_LENGTH = 2;
const JPEG_SOF_MINIMUM_SEGMENT_LENGTH = 8;
const JPEG_SOF_HEIGHT_OFFSET = 3;
const JPEG_SOF_WIDTH_OFFSET = 5;
const JPEG_SOF_MARKERS = new Set([
	0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const EXIF_ORIENTATION_MIN = 1;
const EXIF_ORIENTATION_MAX = 8;
const EXIF_SWAP_DIMENSION_ORIENTATIONS = new Set([5, 6, 7, 8]);

const SVG_PREFIX_BYTE_LIMIT = 1_024;
const SVG_CSS_PIXELS_PER_INCH = 96;
const SVG_CSS_PIXELS_PER_CENTIMETER = SVG_CSS_PIXELS_PER_INCH / 2.54;
const SVG_CSS_PIXELS_PER_MILLIMETER = SVG_CSS_PIXELS_PER_CENTIMETER / 10;
const SVG_CSS_PIXELS_PER_POINT = SVG_CSS_PIXELS_PER_INCH / 72;
const SVG_CSS_PIXELS_PER_PICA = SVG_CSS_PIXELS_PER_POINT * 12;
const SVG_NUMBER_PATTERN = "[+-]?(?:(?:\\d+\\.?\\d*)|(?:\\.\\d+))(?:[eE][+-]?\\d+)?";
const SVG_ABSOLUTE_LENGTH_PATTERN = new RegExp(
	`^\\s*(${SVG_NUMBER_PATTERN})\\s*(px|in|cm|mm|pt|pc)?\\s*$`,
	"i",
);
const SVG_PERCENTAGE_LENGTH_PATTERN = new RegExp(`^\\s*(${SVG_NUMBER_PATTERN})\\s*%\\s*$`);
const SVG_ABSOLUTE_LENGTH_UNIT_TO_CSS_PIXELS = {
	"": 1,
	px: 1,
	in: SVG_CSS_PIXELS_PER_INCH,
	cm: SVG_CSS_PIXELS_PER_CENTIMETER,
	mm: SVG_CSS_PIXELS_PER_MILLIMETER,
	pt: SVG_CSS_PIXELS_PER_POINT,
	pc: SVG_CSS_PIXELS_PER_PICA,
} as const;

interface ImageInfo {
	blockId: string;
	originalUrl: string;
}

interface ImageDimensions {
	width: number;
	height: number;
}

type SvgLength =
	| { type: "missing" }
	| { type: "absolute"; value: number }
	| { type: "relative" }
	| { type: "unsupported" };

interface DownloadedImage {
	path: string;
	dimensions?: ImageDimensions;
}

type ImageDownloadFailureReason = "http-status" | "too-large" | "timeout" | "unavailable";

class ImageDownloadError extends Error {
	constructor(
		readonly reason: ImageDownloadFailureReason,
		readonly status?: number,
	) {
		super(reason);
	}
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
	if (start + BMFF_BOX_HEADER_BYTES > end) return undefined;

	const size = buffer.readUInt32BE(start);
	const type = buffer
		.subarray(start + BMFF_BOX_TYPE_OFFSET, start + BMFF_BOX_HEADER_BYTES)
		.toString("ascii");
	let headerSize = BMFF_BOX_HEADER_BYTES;
	let boxEnd: number;

	if (size === 1) {
		if (start + BMFF_LARGE_SIZE_HEADER_BYTES > end) return undefined;
		const largeSize = buffer.readBigUInt64BE(start + BMFF_BOX_HEADER_BYTES);
		if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
		boxEnd = start + Number(largeSize);
		headerSize = BMFF_LARGE_SIZE_HEADER_BYTES;
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
	for (let boxCount = 0; offset < buffer.length; boxCount++) {
		if (boxCount >= MAX_BMFF_BOXES) return false;
		const box = readBmffBox(buffer, offset, buffer.length);
		if (!box) return false;

		if (box.type === "ftyp") {
			if (box.contentStart + BMFF_BOX_HEADER_BYTES > box.end) return false;
			const brands = [
				buffer.subarray(box.contentStart, box.contentStart + BMFF_BRAND_BYTES).toString("ascii"),
			];
			for (
				let brandOffset = box.contentStart + BMFF_BOX_HEADER_BYTES;
				brandOffset + BMFF_BRAND_BYTES <= box.end;
				brandOffset += BMFF_BRAND_BYTES
			) {
				brands.push(buffer.subarray(brandOffset, brandOffset + BMFF_BRAND_BYTES).toString("ascii"));
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
		if (boxes.length >= MAX_BMFF_BOXES) return undefined;
		const box = readBmffBox(buffer, offset, end);
		if (!box) return undefined;
		boxes.push(box);
		offset = box.end;
	}
	return offset === end ? boxes : undefined;
}

function getFullBoxVersion(buffer: Buffer, box: BmffBox): number | undefined {
	return box.contentStart + BMFF_FULL_BOX_HEADER_BYTES <= box.end
		? buffer[box.contentStart]
		: undefined;
}

function parseAvifPrimaryItemId(buffer: Buffer, box: BmffBox): number | undefined {
	const version = getFullBoxVersion(buffer, box);
	if (
		version === 0 &&
		box.contentStart + BMFF_FULL_BOX_HEADER_BYTES + BMFF_UINT16_BYTES === box.end
	) {
		return buffer.readUInt16BE(box.contentStart + BMFF_FULL_BOX_HEADER_BYTES);
	}
	if (version === 1 && box.contentStart + BMFF_BOX_HEADER_BYTES === box.end) {
		return buffer.readUInt32BE(box.contentStart + BMFF_FULL_BOX_HEADER_BYTES);
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
				propertyBox.contentStart + BMFF_FULL_BOX_HEADER_BYTES + BMFF_BOX_HEADER_BYTES !==
					propertyBox.end
			) {
				return undefined;
			}
			const width = buffer.readUInt32BE(propertyBox.contentStart + BMFF_FULL_BOX_HEADER_BYTES);
			const height = buffer.readUInt32BE(propertyBox.contentStart + BMFF_BOX_HEADER_BYTES);
			if (width === 0 || height === 0) return undefined;
			properties.push({ type: "ispe", dimensions: { width, height } });
			continue;
		}

		if (propertyBox.type === "irot") {
			if (propertyBox.contentStart + 1 !== propertyBox.end) return undefined;
			const rotation = buffer[propertyBox.contentStart];
			if ((rotation & IROT_RESERVED_BITS_MASK) !== 0) return undefined;
			properties.push({ type: "irot", rotation });
			continue;
		}

		if (propertyBox.type === "imir") {
			if (propertyBox.contentStart + 1 !== propertyBox.end) return undefined;
			if ((buffer[propertyBox.contentStart] & IMIR_RESERVED_BITS_MASK) !== 0) return undefined;
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
	if (box.contentStart + BMFF_BOX_HEADER_BYTES > box.end) return undefined;

	const flags = buffer.readUIntBE(box.contentStart + 1, BMFF_FULL_BOX_FLAGS_BYTES);
	if ((flags & ~IPMA_LARGE_PROPERTY_INDEX_FLAG) !== 0) return undefined;
	const largeIndexes = (flags & IPMA_LARGE_PROPERTY_INDEX_FLAG) !== 0;
	const entryCount = buffer.readUInt32BE(box.contentStart + BMFF_FULL_BOX_HEADER_BYTES);
	if (entryCount > MAX_AVIF_ASSOCIATION_ENTRIES) return undefined;
	const associations = new Map<number, number[]>();
	let offset = box.contentStart + BMFF_BOX_HEADER_BYTES;
	let associationTotal = 0;

	for (let entry = 0; entry < entryCount; entry++) {
		const itemIdSize = version === 0 ? BMFF_UINT16_BYTES : BMFF_UINT32_BYTES;
		if (offset + itemIdSize + 1 > box.end) return undefined;
		const itemId = version === 0 ? buffer.readUInt16BE(offset) : buffer.readUInt32BE(offset);
		offset += itemIdSize;
		const associationCount = buffer[offset++];
		const indexSize = largeIndexes ? BMFF_UINT16_BYTES : 1;
		associationTotal += associationCount;
		if (associationTotal > MAX_AVIF_PROPERTY_ASSOCIATIONS) return undefined;
		if (offset + associationCount * indexSize > box.end || associations.has(itemId))
			return undefined;

		const propertyIndexes: number[] = [];
		for (let association = 0; association < associationCount; association++) {
			const value = largeIndexes ? buffer.readUInt16BE(offset) : buffer[offset];
			offset += indexSize;
			const propertyIndex = largeIndexes
				? value & IPMA_LARGE_PROPERTY_INDEX_MASK
				: value & IPMA_SMALL_PROPERTY_INDEX_MASK;
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
	if (
		getFullBoxVersion(buffer, meta) !== 0 ||
		meta.contentStart + BMFF_FULL_BOX_HEADER_BYTES > meta.end
	)
		return undefined;
	const metaChildren = getBmffBoxes(
		buffer,
		meta.contentStart + BMFF_FULL_BOX_HEADER_BYTES,
		meta.end,
	);
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
	return rotations[0]?.rotation === IROT_QUARTER_TURN ||
		rotations[0]?.rotation === IROT_THREE_QUARTER_TURNS
		? { width: height, height: width }
		: { width, height };
}

function getSvgAttribute(svgTag: string, name: string): string | undefined {
	const attribute = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
	const match = svgTag.match(attribute);
	return match?.[1] ?? match?.[2];
}

function parseSvgLength(value: string | undefined): SvgLength {
	if (value === undefined) return { type: "missing" };

	const absoluteLength = value.match(SVG_ABSOLUTE_LENGTH_PATTERN);
	if (absoluteLength) {
		const numericValue = Number(absoluteLength[1]);
		const unit = absoluteLength[2]?.toLowerCase() ?? "";
		const pixels = Math.round(
			numericValue *
				SVG_ABSOLUTE_LENGTH_UNIT_TO_CSS_PIXELS[
					unit as keyof typeof SVG_ABSOLUTE_LENGTH_UNIT_TO_CSS_PIXELS
				],
		);
		return Number.isSafeInteger(pixels) && pixels > 0
			? { type: "absolute", value: pixels }
			: { type: "unsupported" };
	}

	const percentageLength = value.match(SVG_PERCENTAGE_LENGTH_PATTERN);
	const percentage = Number(percentageLength?.[1]);
	if (Number.isFinite(percentage) && percentage > 0) return { type: "relative" };

	return { type: "unsupported" };
}

function getSvgViewBoxDimensions(svgTag: string): ImageDimensions | undefined {
	const viewBoxSeparator = "(?:\\s*,\\s*|\\s+)";
	const viewBox = getSvgAttribute(svgTag, "viewBox")?.match(
		new RegExp(
			`^\\s*(${SVG_NUMBER_PATTERN})${viewBoxSeparator}(${SVG_NUMBER_PATTERN})${viewBoxSeparator}(${SVG_NUMBER_PATTERN})${viewBoxSeparator}(${SVG_NUMBER_PATTERN})\\s*$`,
		),
	);
	if (!viewBox) return undefined;

	const width = Number(viewBox[3]);
	const height = Number(viewBox[4]);
	return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
		? { width, height }
		: undefined;
}

function getDoctypeEnd(svg: string, start: number): number | undefined {
	let quote: '"' | "'" | undefined;
	let internalSubsetDepth = 0;

	for (let index = start + "<!DOCTYPE".length; index < svg.length; index++) {
		const character = svg[index];
		if (quote) {
			if (character === quote) quote = undefined;
			continue;
		}

		if (svg.startsWith("<!--", index)) {
			const commentEnd = svg.indexOf("-->", index + 4);
			if (commentEnd === -1) return undefined;
			index = commentEnd + 2;
			continue;
		}

		if (svg.startsWith("<?", index)) {
			const instructionEnd = svg.indexOf("?>", index + 2);
			if (instructionEnd === -1) return undefined;
			index = instructionEnd + 1;
			continue;
		}

		if (character === '"' || character === "'") {
			quote = character;
			continue;
		}
		if (character === "[") {
			internalSubsetDepth++;
			continue;
		}
		if (character === "]" && internalSubsetDepth > 0) {
			internalSubsetDepth--;
			continue;
		}
		if (character === ">" && internalSubsetDepth === 0) return index;
	}

	return undefined;
}

function getSvgRootOpeningTag(svg: string): string | undefined {
	let start = 0;
	while (start < svg.length) {
		if (/\s/.test(svg[start])) {
			start++;
			continue;
		}

		if (svg.startsWith("<!--", start)) {
			const commentEnd = svg.indexOf("-->", start + 4);
			if (commentEnd === -1) return undefined;
			start = commentEnd + 3;
			continue;
		}

		if (svg.startsWith("<?", start)) {
			const instructionEnd = svg.indexOf("?>", start + 2);
			if (instructionEnd === -1) return undefined;
			start = instructionEnd + 2;
			continue;
		}

		if (/^<!DOCTYPE\b/i.test(svg.slice(start))) {
			const doctypeEnd = getDoctypeEnd(svg, start);
			if (doctypeEnd === undefined) return undefined;
			start = doctypeEnd + 1;
			continue;
		}

		break;
	}

	const match = /<svg\b/i.exec(svg.slice(start));
	if (!match || match.index !== 0) return undefined;

	let quote: '"' | "'" | undefined;
	for (let index = start + match[0].length; index < svg.length; index++) {
		const character = svg[index];
		if (quote) {
			if (character === quote) quote = undefined;
			continue;
		}

		if (character === '"' || character === "'") {
			quote = character;
			continue;
		}
		if (character === ">") return svg.slice(start, index + 1);
	}

	return undefined;
}

function getJpegExifOrientation(segment: Buffer): number | undefined {
	// APP1 Exif payloads begin with an Exif identifier, followed by a TIFF header.
	if (
		segment.length < EXIF_IDENTIFIER.length + TIFF_HEADER_BYTES ||
		!startsWithBytes(segment, EXIF_IDENTIFIER)
	) {
		return undefined;
	}

	const tiffStart = EXIF_TIFF_OFFSET;
	const byteOrder = segment
		.subarray(tiffStart, tiffStart + TIFF_BYTE_ORDER_BYTES)
		.toString("ascii");
	const readUInt16 =
		byteOrder === TIFF_LITTLE_ENDIAN_BYTE_ORDER
			? (offset: number) => segment.readUInt16LE(offset)
			: byteOrder === TIFF_BIG_ENDIAN_BYTE_ORDER
				? (offset: number) => segment.readUInt16BE(offset)
				: undefined;
	const readUInt32 =
		byteOrder === TIFF_LITTLE_ENDIAN_BYTE_ORDER
			? (offset: number) => segment.readUInt32LE(offset)
			: byteOrder === TIFF_BIG_ENDIAN_BYTE_ORDER
				? (offset: number) => segment.readUInt32BE(offset)
				: undefined;
	if (!readUInt16 || !readUInt32 || tiffStart + TIFF_HEADER_BYTES > segment.length)
		return undefined;

	// TIFF's fixed marker is 42; reject arbitrary APP1 payloads before following offsets.
	if (readUInt16(tiffStart + TIFF_MAGIC_OFFSET) !== TIFF_MAGIC) return undefined;

	const ifdOffset = readUInt32(tiffStart + TIFF_FIRST_IFD_OFFSET);
	const ifdStart = tiffStart + ifdOffset;
	if (ifdStart + TIFF_IFD_ENTRY_COUNT_BYTES > segment.length) return undefined;

	const entryCount = readUInt16(ifdStart);
	const entriesStart = ifdStart + TIFF_IFD_ENTRY_COUNT_BYTES;
	const entriesEnd = entriesStart + entryCount * TIFF_IFD_ENTRY_BYTES;
	if (entriesEnd > segment.length) return undefined;

	for (let index = 0; index < entryCount; index++) {
		const entryStart = entriesStart + index * TIFF_IFD_ENTRY_BYTES;
		if (readUInt16(entryStart) !== TIFF_ORIENTATION_TAG) continue;

		// Orientation is one TIFF SHORT stored inline in the entry's value field.
		if (
			readUInt16(entryStart + TIFF_ENTRY_TYPE_OFFSET) !== TIFF_SHORT_TYPE ||
			readUInt32(entryStart + TIFF_ENTRY_COMPONENT_COUNT_OFFSET) !==
				TIFF_ORIENTATION_COMPONENT_COUNT
		)
			return undefined;
		const orientation = readUInt16(entryStart + TIFF_ENTRY_VALUE_OFFSET);
		return orientation >= EXIF_ORIENTATION_MIN && orientation <= EXIF_ORIENTATION_MAX
			? orientation
			: undefined;
	}

	return undefined;
}

function getJpegDimensions(buffer: Buffer): ImageDimensions | undefined {
	let offset = 2;
	let dimensions: ImageDimensions | undefined;
	let orientation: number | undefined;

	while (offset < buffer.length) {
		if (buffer[offset] !== JPEG_MARKER_PREFIX) {
			offset++;
			continue;
		}

		while (buffer[offset] === JPEG_MARKER_PREFIX) offset++;
		if (offset >= buffer.length) break;

		const marker = buffer[offset++];
		if (
			marker === JPEG_STUFFED_BYTE_MARKER ||
			marker === JPEG_START_OF_IMAGE_MARKER ||
			marker === JPEG_END_OF_IMAGE_MARKER ||
			marker === JPEG_TEM_MARKER ||
			(marker >= JPEG_RESTART_MARKER_FIRST && marker <= JPEG_RESTART_MARKER_LAST)
		) {
			continue;
		}
		if (offset + JPEG_SEGMENT_LENGTH_BYTES > buffer.length) break;

		const segmentLength = buffer.readUInt16BE(offset);
		if (segmentLength < JPEG_MINIMUM_SEGMENT_LENGTH || offset + segmentLength > buffer.length)
			break;

		const segmentDataStart = offset + JPEG_SEGMENT_LENGTH_BYTES;
		const segmentEnd = offset + segmentLength;
		if (marker === JPEG_EXIF_APP1_MARKER) {
			orientation ??= getJpegExifOrientation(buffer.subarray(segmentDataStart, segmentEnd));
		} else if (JPEG_SOF_MARKERS.has(marker) && segmentLength >= JPEG_SOF_MINIMUM_SEGMENT_LENGTH) {
			const height = buffer.readUInt16BE(offset + JPEG_SOF_HEIGHT_OFFSET);
			const width = buffer.readUInt16BE(offset + JPEG_SOF_WIDTH_OFFSET);
			if (width > 0 && height > 0) dimensions = { width, height };
		}

		if (marker === JPEG_START_OF_SCAN_MARKER) break;
		offset = segmentEnd;
	}

	if (!dimensions) return undefined;
	return orientation && EXIF_SWAP_DIMENSION_ORIENTATIONS.has(orientation)
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

	const svg = buffer.subarray(0, SVG_PREFIX_BYTE_LIMIT).toString("utf8");
	const svgTag = getSvgRootOpeningTag(svg);
	if (svgTag) {
		const width = parseSvgLength(getSvgAttribute(svgTag, "width"));
		const height = parseSvgLength(getSvgAttribute(svgTag, "height"));
		if (width.type === "absolute" && height.type === "absolute") {
			return { width: width.value, height: height.value };
		}
		if (
			(width.type === "missing" && height.type === "missing") ||
			(width.type === "relative" && height.type === "relative")
		) {
			return getSvgViewBoxDimensions(svgTag);
		}
	}

	return undefined;
}

function hasContentLengthOverLimit(contentLength: string | null): boolean {
	if (!contentLength?.match(/^\d+$/)) return false;
	return Number(contentLength) > MAX_IMAGE_DOWNLOAD_BYTES;
}

async function readImageResponse(response: Response, controller: AbortController): Promise<Buffer> {
	if (!response.body) return Buffer.alloc(0);

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			byteLength += value.byteLength;
			if (byteLength > MAX_IMAGE_DOWNLOAD_BYTES) {
				controller.abort();
				throw new ImageDownloadError("too-large");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	return Buffer.concat(chunks, byteLength);
}

async function downloadImage(url: string, destPath: string): Promise<DownloadedImage> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT_MS);

	try {
		const response = await fetch(url, { signal: controller.signal });

		if (!response.ok) {
			throw new ImageDownloadError("http-status", response.status);
		}
		if (hasContentLengthOverLimit(response.headers.get("content-length"))) {
			controller.abort();
			throw new ImageDownloadError("too-large");
		}

		const contentType = response.headers.get("content-type") || undefined;
		const ext = getImageExtension(url, contentType);
		const finalPath = destPath.replace(/\.[^.]+$/, `.${ext}`);
		const buffer = await readImageResponse(response, controller);
		await fs.writeFile(finalPath, buffer);

		return { path: finalPath, dimensions: getImageDimensions(buffer) };
	} catch (error) {
		if (error instanceof ImageDownloadError) throw error;
		if (controller.signal.aborted) throw new ImageDownloadError("timeout");
		throw new ImageDownloadError("unavailable");
	} finally {
		clearTimeout(timeout);
	}
}

function getDownloadFailureDescription(error: unknown): string {
	if (!(error instanceof ImageDownloadError)) return "unavailable";
	if (error.reason === "http-status") return `HTTP ${error.status ?? "error"}`;
	return error.reason;
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
		} catch (error) {
			console.warn(
				`  ⚠️  Failed to download image block ${img.blockId}: ${getDownloadFailureDescription(error)}`,
			);
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
