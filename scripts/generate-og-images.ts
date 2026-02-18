import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { FONT_FAMILY, PATHS, SITE } from "../src/config.js";
import { escapeHtml } from "../src/lib/utils.js";

const OG_DIR = path.join(process.cwd(), "public/og");
const POSTS_PATH = path.join(process.cwd(), PATHS.posts);

const WIDTH = 1200;
const HEIGHT = 630;

// 긴 제목 말줄임: SVG <text>는 줄바꿈 불가
const MAX_TITLE_LENGTH = 40;

function truncateTitle(title: string): string {
	if (title.length <= MAX_TITLE_LENGTH) return title;
	return `${title.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}

function buildSvg(title: string, subtitle: string): string {
	return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#ffffff" width="${WIDTH}" height="${HEIGHT}"/>
  <text x="100" y="315" font-size="48" font-family='${FONT_FAMILY}' fill="#000000">
    ${escapeHtml(truncateTitle(title))}
  </text>
  <text x="100" y="380" font-size="24" font-family='${FONT_FAMILY}' fill="#666666">
    ${escapeHtml(subtitle)}
  </text>
</svg>`;
}

function renderPng(svg: string): Buffer {
	const resvg = new Resvg(svg, {
		fitTo: { mode: "width", value: WIDTH },
		font: { loadSystemFonts: true },
	});
	return Buffer.from(resvg.render().asPng());
}

interface Post {
	title: string;
	slug: string;
	type: string;
}

export async function generateOgImages(): Promise<number> {
	// public/og/ 초기화
	await fs.rm(OG_DIR, { recursive: true, force: true });
	await fs.mkdir(OG_DIR, { recursive: true });

	// 기본 OG 이미지
	const defaultSvg = buildSvg(SITE.name, SITE.description);
	await fs.writeFile(path.join(OG_DIR, "default.png"), renderPng(defaultSvg));

	// 포스트별 OG 이미지
	let postsData: Post[];
	try {
		const raw = await fs.readFile(POSTS_PATH, "utf-8");
		postsData = JSON.parse(raw);
	} catch {
		console.log("⚠️  posts.json not found, only default OG image generated");
		return 1;
	}

	for (const post of postsData) {
		const svg = buildSvg(post.title, SITE.name);
		const filename = `${post.type}-${post.slug}.png`;
		await fs.writeFile(path.join(OG_DIR, filename), renderPng(svg));
	}

	return postsData.length + 1;
}

// 직접 실행 시
const isDirectRun = process.argv[1]?.endsWith("generate-og-images.ts");
if (isDirectRun) {
	generateOgImages()
		.then((count) => console.log(`✅ ${count} OG images generated`))
		.catch((err) => {
			console.error("OG image generation failed:", err);
			process.exit(1);
		});
}
