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
		const avif = Buffer.alloc(20);
		avif.write("ispe", 4);
		avif.writeUInt32BE(1024, 12);
		avif.writeUInt32BE(768, 16);

		expect(getImageDimensions(avif)).toEqual({ width: 1024, height: 768 });
	});

	it("uses an SVG viewBox when its declared dimensions are relative", () => {
		const svg = Buffer.from('<svg width="100%" height="100%" viewBox="0 0 640 480"></svg>');

		expect(getImageDimensions(svg)).toEqual({ width: 640, height: 480 });
	});
});
