import { describe, expect, it } from "vitest";
import { getImageDimensions } from "./image-handler";

function jpegSegment(marker: number, payload: Buffer): Buffer {
	const segment = Buffer.alloc(payload.length + 4);
	segment[0] = 0xff;
	segment[1] = marker;
	segment.writeUInt16BE(payload.length + 2, 2);
	payload.copy(segment, 4);
	return segment;
}

function createExifOrientation(orientation: number, byteOrder: "II" | "MM"): Buffer {
	const tiff = Buffer.alloc(26);
	tiff.write(byteOrder);
	const writeUInt16 =
		byteOrder === "II" ? tiff.writeUInt16LE.bind(tiff) : tiff.writeUInt16BE.bind(tiff);
	const writeUInt32 =
		byteOrder === "II" ? tiff.writeUInt32LE.bind(tiff) : tiff.writeUInt32BE.bind(tiff);
	writeUInt16(42, 2);
	writeUInt32(8, 4);
	writeUInt16(1, 8);
	writeUInt16(0x0112, 10);
	writeUInt16(3, 12);
	writeUInt32(1, 14);
	writeUInt16(orientation, 18);

	return Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
}

function createJpeg(width: number, height: number, app1Payload?: Buffer): Buffer {
	const sof = Buffer.alloc(6);
	sof[0] = 8;
	sof.writeUInt16BE(height, 1);
	sof.writeUInt16BE(width, 3);
	sof[5] = 1;
	return Buffer.concat([
		Buffer.from([0xff, 0xd8]),
		...(app1Payload ? [jpegSegment(0xe1, app1Payload)] : []),
		jpegSegment(0xc0, sof),
	]);
}

function bmffBox(type: string, payload: Buffer): Buffer {
	const box = Buffer.alloc(payload.length + 8);
	box.writeUInt32BE(box.length, 0);
	box.write(type, 4);
	payload.copy(box, 8);
	return box;
}

function fullBox(version: number, flags: number, payload: Buffer): Buffer {
	const header = Buffer.alloc(4);
	header[0] = version;
	header.writeUIntBE(flags, 1, 3);
	return Buffer.concat([header, payload]);
}

function avifIspe(width: number, height: number): Buffer {
	const dimensions = Buffer.alloc(8);
	dimensions.writeUInt32BE(width, 0);
	dimensions.writeUInt32BE(height, 4);
	return bmffBox("ispe", fullBox(0, 0, dimensions));
}

function createAvif({
	primaryItemId,
	pitmVersion = 0,
	ipmaVersion = 0,
	largePropertyIndexes = false,
	properties,
	associations,
}: {
	primaryItemId: number;
	pitmVersion?: 0 | 1;
	ipmaVersion?: 0 | 1;
	largePropertyIndexes?: boolean;
	properties: Buffer[];
	associations: Array<{ itemId: number; propertyIndexes: number[] }>;
}): Buffer {
	const ftyp = bmffBox(
		"ftyp",
		Buffer.concat([Buffer.from("avif"), Buffer.alloc(4), Buffer.from("mif1")]),
	);
	const pitmId = Buffer.alloc(pitmVersion === 0 ? 2 : 4);
	if (pitmVersion === 0) pitmId.writeUInt16BE(primaryItemId);
	else pitmId.writeUInt32BE(primaryItemId);
	const pitm = bmffBox("pitm", fullBox(pitmVersion, 0, pitmId));

	const entryBuffers = associations.map(({ itemId, propertyIndexes }) => {
		const itemIdBuffer = Buffer.alloc(ipmaVersion === 0 ? 2 : 4);
		if (ipmaVersion === 0) itemIdBuffer.writeUInt16BE(itemId);
		else itemIdBuffer.writeUInt32BE(itemId);
		const indexes = Buffer.alloc(propertyIndexes.length * (largePropertyIndexes ? 2 : 1));
		for (const [index, propertyIndex] of propertyIndexes.entries()) {
			if (largePropertyIndexes) indexes.writeUInt16BE(propertyIndex, index * 2);
			else indexes[index] = propertyIndex;
		}
		return Buffer.concat([itemIdBuffer, Buffer.from([propertyIndexes.length]), indexes]);
	});
	const entryCount = Buffer.alloc(4);
	entryCount.writeUInt32BE(associations.length);
	const ipma = bmffBox(
		"ipma",
		fullBox(
			ipmaVersion,
			largePropertyIndexes ? 1 : 0,
			Buffer.concat([entryCount, ...entryBuffers]),
		),
	);
	const ipco = bmffBox("ipco", Buffer.concat(properties));
	const iprp = bmffBox("iprp", Buffer.concat([ipco, ipma]));
	const meta = bmffBox("meta", fullBox(0, 0, Buffer.concat([pitm, iprp])));
	return Buffer.concat([ftyp, meta]);
}

describe("getImageDimensions", () => {
	it("reads PNG dimensions from its header", () => {
		const png = Buffer.alloc(24);
		png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		png.writeUInt32BE(640, 16);
		png.writeUInt32BE(480, 20);

		expect(getImageDimensions(png)).toEqual({ width: 640, height: 480 });
	});

	it("reads WebP extended dimensions from its header", () => {
		const webp = Buffer.alloc(30);
		webp.write("RIFF");
		webp.write("WEBP", 8);
		webp.write("VP8X", 12);
		webp.writeUIntLE(319, 24, 3);
		webp.writeUIntLE(239, 27, 3);

		expect(getImageDimensions(webp)).toEqual({ width: 320, height: 240 });
	});

	it("reads JPEG dimensions without Exif orientation metadata", () => {
		expect(getImageDimensions(createJpeg(640, 480))).toEqual({ width: 640, height: 480 });
	});

	it.each([
		"II",
		"MM",
	] as const)("swaps JPEG dimensions for orientation 6 in %s Exif metadata", (byteOrder) => {
		const jpeg = createJpeg(640, 480, createExifOrientation(6, byteOrder));

		expect(getImageDimensions(jpeg)).toEqual({ width: 480, height: 640 });
	});

	it("keeps JPEG dimensions when Exif metadata is malformed", () => {
		const malformedExif = Buffer.from("Exif\0\0II*\0");

		expect(getImageDimensions(createJpeg(640, 480, malformedExif))).toEqual({
			width: 640,
			height: 480,
		});
	});

	it("keeps JPEG dimensions for non-Exif APP1 metadata", () => {
		expect(
			getImageDimensions(createJpeg(640, 480, Buffer.from("http://ns.adobe.com/xap/1.0/"))),
		).toEqual({ width: 640, height: 480 });
	});

	it("uses the primary AVIF item's spatial extents rather than the first ispe property", () => {
		const avif = createAvif({
			primaryItemId: 42,
			properties: [avifIspe(320, 180), avifIspe(2400, 1600)],
			associations: [
				{ itemId: 7, propertyIndexes: [1] },
				{ itemId: 42, propertyIndexes: [2] },
			],
		});

		expect(getImageDimensions(avif)).toEqual({ width: 2400, height: 1600 });
	});

	it("does not emit AVIF dimensions when the primary item has no property mapping", () => {
		const avif = createAvif({
			primaryItemId: 42,
			properties: [avifIspe(1024, 768)],
			associations: [{ itemId: 7, propertyIndexes: [1] }],
		});

		expect(getImageDimensions(avif)).toBeUndefined();
	});

	it("does not emit AVIF dimensions for an out-of-range primary property index", () => {
		const avif = createAvif({
			primaryItemId: 42,
			properties: [avifIspe(1024, 768)],
			associations: [{ itemId: 42, propertyIndexes: [2] }],
		});

		expect(getImageDimensions(avif)).toBeUndefined();
	});

	it("does not emit AVIF dimensions when the primary item has multiple spatial extents", () => {
		const avif = createAvif({
			primaryItemId: 42,
			properties: [avifIspe(1024, 768), avifIspe(2048, 1024)],
			associations: [{ itemId: 42, propertyIndexes: [1, 2] }],
		});

		expect(getImageDimensions(avif)).toBeUndefined();
	});

	it("reads version-one AVIF item and 15-bit property associations", () => {
		const avif = createAvif({
			primaryItemId: 0x1_0001,
			pitmVersion: 1,
			ipmaVersion: 1,
			largePropertyIndexes: true,
			properties: [avifIspe(1024, 768)],
			associations: [{ itemId: 0x1_0001, propertyIndexes: [1] }],
		});

		expect(getImageDimensions(avif)).toEqual({ width: 1024, height: 768 });
	});

	it("stops AVIF parsing after the configured BMFF box limit", () => {
		const avif = Buffer.concat([
			createAvif({
				primaryItemId: 42,
				properties: [avifIspe(1024, 768)],
				associations: [{ itemId: 42, propertyIndexes: [1] }],
			}),
			...Array.from({ length: 1_023 }, () => bmffBox("free", Buffer.alloc(0))),
		]);

		expect(getImageDimensions(avif)).toBeUndefined();
	});

	it("swaps AVIF dimensions for a 90-degree primary item rotation", () => {
		const avif = createAvif({
			primaryItemId: 42,
			properties: [avifIspe(1024, 768), bmffBox("irot", Buffer.from([1]))],
			associations: [{ itemId: 42, propertyIndexes: [1, 2] }],
		});

		expect(getImageDimensions(avif)).toEqual({ width: 768, height: 1024 });
	});

	it("does not swap AVIF dimensions for a primary item mirror", () => {
		const avif = createAvif({
			primaryItemId: 42,
			properties: [avifIspe(1024, 768), bmffBox("imir", Buffer.from([1]))],
			associations: [{ itemId: 42, propertyIndexes: [1, 2] }],
		});

		expect(getImageDimensions(avif)).toEqual({ width: 1024, height: 768 });
	});

	it("does not emit AVIF dimensions when the primary item has a clean aperture", () => {
		const avif = createAvif({
			primaryItemId: 42,
			properties: [avifIspe(1024, 768), bmffBox("clap", Buffer.alloc(32))],
			associations: [{ itemId: 42, propertyIndexes: [1, 2] }],
		});

		expect(getImageDimensions(avif)).toBeUndefined();
	});

	it("does not emit AVIF dimensions when the primary item has pixel aspect ratio metadata", () => {
		const avif = createAvif({
			primaryItemId: 42,
			properties: [avifIspe(1024, 768), bmffBox("pasp", Buffer.alloc(8))],
			associations: [{ itemId: 42, propertyIndexes: [1, 2] }],
		});

		expect(getImageDimensions(avif)).toBeUndefined();
	});

	it("does not treat an arbitrary ispe string as AVIF metadata", () => {
		const svg = Buffer.from("<svg><text>ispe</text></svg>");

		expect(getImageDimensions(svg)).toBeUndefined();
	});

	it("uses an SVG viewBox when its declared dimensions are relative", () => {
		const svg = Buffer.from('<svg width="100%" height="100%" viewBox="0 0 640 480"></svg>');

		expect(getImageDimensions(svg)).toEqual({ width: 640, height: 480 });
	});

	it("reads SVG attributes after a quoted value containing a greater-than sign", () => {
		const svg = Buffer.from(
			'<svg aria-label="a > b" width="100%" height="100%" viewBox="0 0 640 480"></svg>',
		);

		expect(getImageDimensions(svg)).toEqual({ width: 640, height: 480 });
	});

	it("uses an SVG viewBox with comma-separated values", () => {
		const svg = Buffer.from('<svg viewBox="0,0,640,480"></svg>');

		expect(getImageDimensions(svg)).toEqual({ width: 640, height: 480 });
	});

	it("uses an SVG viewBox with mixed separators and a negative origin", () => {
		const svg = Buffer.from('<svg viewBox="-12.5, 4.25 640, 480.5"></svg>');

		expect(getImageDimensions(svg)).toEqual({ width: 640, height: 480.5 });
	});

	it("does not use an SVG viewBox with malformed or non-positive dimensions", () => {
		const malformed = Buffer.from('<svg viewBox="0,0,640"></svg>');
		const zeroWidth = Buffer.from('<svg viewBox="0 0 0 480"></svg>');
		const negativeHeight = Buffer.from('<svg viewBox="0 0 640 -480"></svg>');

		expect(getImageDimensions(malformed)).toBeUndefined();
		expect(getImageDimensions(zeroWidth)).toBeUndefined();
		expect(getImageDimensions(negativeHeight)).toBeUndefined();
	});

	it("uses the root SVG viewBox instead of descendant dimensions", () => {
		const svg = Buffer.from(
			'<svg width="100%" height="100%" viewBox="0 0 640 480"><rect width="10" height="20" /></svg>',
		);

		expect(getImageDimensions(svg)).toEqual({ width: 640, height: 480 });
	});

	it("ignores SVG attributes whose names only end with dimension attribute names", () => {
		const svg = Buffer.from(
			'<svg data-width="100" aria-height="50" custom:viewBox="0 0 100 50" viewBox="0 0 640 480"></svg>',
		);

		expect(getImageDimensions(svg)).toEqual({ width: 640, height: 480 });
	});

	it("uses absolute dimensions declared on the root SVG tag", () => {
		const svg = Buffer.from(
			'<svg width="320px" height="240"><rect width="10" height="20" /></svg>',
		);

		expect(getImageDimensions(svg)).toEqual({ width: 320, height: 240 });
	});
});
