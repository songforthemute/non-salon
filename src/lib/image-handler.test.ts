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

	it("reads AVIF dimensions from its image spatial extents box", () => {
		const ftyp = Buffer.alloc(20);
		ftyp.writeUInt32BE(20, 0);
		ftyp.write("ftyp", 4);
		ftyp.write("avif", 8);
		ftyp.writeUInt32BE(0, 12);
		ftyp.write("mif1", 16);
		const ispe = Buffer.alloc(20);
		ispe.writeUInt32BE(20, 0);
		ispe.write("ispe", 4);
		ispe.writeUInt32BE(1024, 12);
		ispe.writeUInt32BE(768, 16);
		const ipco = Buffer.concat([Buffer.from([0, 0, 0, 28]), Buffer.from("ipco"), ispe]);
		const iprp = Buffer.concat([Buffer.from([0, 0, 0, 36]), Buffer.from("iprp"), ipco]);
		const meta = Buffer.concat([
			Buffer.from([0, 0, 0, 48]),
			Buffer.from("meta"),
			Buffer.alloc(4),
			iprp,
		]);
		const avif = Buffer.concat([ftyp, meta]);

		expect(getImageDimensions(avif)).toEqual({ width: 1024, height: 768 });
	});

	it("does not treat an arbitrary ispe string as AVIF metadata", () => {
		const svg = Buffer.from("<svg><text>ispe</text></svg>");

		expect(getImageDimensions(svg)).toBeUndefined();
	});

	it("uses an SVG viewBox when its declared dimensions are relative", () => {
		const svg = Buffer.from('<svg width="100%" height="100%" viewBox="0 0 640 480"></svg>');

		expect(getImageDimensions(svg)).toEqual({ width: 640, height: 480 });
	});

	it("uses the root SVG viewBox instead of descendant dimensions", () => {
		const svg = Buffer.from(
			'<svg width="100%" height="100%" viewBox="0 0 640 480"><rect width="10" height="20" /></svg>',
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
