import { describe, expect, it } from "vitest";
import { getImageDimensions } from "./image-handler";

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
