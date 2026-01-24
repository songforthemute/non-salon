import "dotenv/config";
import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { cleanupOrphanedImages, processPostImages } from "../src/lib/image-handler.js";
import type { ContentType } from "../src/types.js";

const DATA_DIR = path.join(process.cwd(), "data");
const POSTS_PATH = path.join(DATA_DIR, "posts.json");
const PUBLISHED_DATES_PATH = path.join(DATA_DIR, "published-dates.json");

interface Post {
	id: string;
	title: string;
	slug: string;
	type: ContentType;
	blocks: unknown[];
}

async function loadJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
	try {
		const content = await fs.readFile(filePath, "utf-8");
		return JSON.parse(content);
	} catch {
		return defaultValue;
	}
}

async function main() {
	console.log("🚀 Build started\n");

	// 1. Notion에서 데이터 가져오기
	console.log("📥 Fetching from Notion...");
	execSync("pnpm tsx scripts/fetch-notion.ts", { stdio: "inherit" });
	console.log("");

	// 2. posts.json 로드
	const posts: Post[] = await loadJsonFile(POSTS_PATH, []);
	if (posts.length === 0) {
		console.log("⚠️  No posts found, skipping build");
		return;
	}

	// 3. published-dates.json 로드
	const publishedDates: Record<string, string> = await loadJsonFile(PUBLISHED_DATES_PATH, {});
	const today = new Date().toISOString().split("T")[0];
	let newPostCount = 0;

	// 4. 새 글에 출판일 부여
	for (const post of posts) {
		if (!publishedDates[post.slug]) {
			publishedDates[post.slug] = today;
			console.log(`📅 New post: "${post.title}" → ${today}`);
			newPostCount++;
		}
	}

	// 5. 삭제된 글 정리 (published-dates에서 제거)
	const currentSlugs = new Set(posts.map((p) => p.slug));
	const removedSlugs: string[] = [];

	for (const slug of Object.keys(publishedDates)) {
		if (!currentSlugs.has(slug)) {
			removedSlugs.push(slug);
			delete publishedDates[slug];
		}
	}

	if (removedSlugs.length > 0) {
		console.log(`🗑️  Removed ${removedSlugs.length} archived posts from published-dates`);
	}

	// 6. published-dates.json 저장
	await fs.writeFile(PUBLISHED_DATES_PATH, JSON.stringify(publishedDates, null, 2));

	if (newPostCount > 0) {
		console.log(`\n✅ ${newPostCount} new posts assigned publish dates`);
	}

	// 7. 이미지 처리
	console.log("\n📷 Processing images...");
	let totalImages = 0;

	for (const post of posts) {
		console.log(`Processing: ${post.title}`);
		const { blocks, downloadedCount } = await processPostImages(
			post.type,
			post.slug,
			post.blocks as Parameters<typeof processPostImages>[2],
		);
		post.blocks = blocks;
		totalImages += downloadedCount;
	}

	// 8. 삭제된 글의 이미지 폴더 정리
	const currentPosts = posts.map((p) => ({ type: p.type, slug: p.slug }));
	const removedImageDirs = await cleanupOrphanedImages(currentPosts);
	if (removedImageDirs > 0) {
		console.log(`🗑️  Cleaned up ${removedImageDirs} orphaned image directories`);
	}

	// 9. 이미지 URL이 교체된 posts.json 저장
	await fs.writeFile(POSTS_PATH, JSON.stringify(posts, null, 2));

	if (totalImages > 0) {
		console.log(`\n✅ ${totalImages} images downloaded`);
	}

	// 10. Astro 빌드
	console.log("\n🔨 Building with Astro...");
	execSync("pnpm astro build", { stdio: "inherit" });

	// 11. Pagefind 인덱싱
	console.log("\n🔍 Indexing for search...");
	execSync("pnpm pagefind --site dist", { stdio: "inherit" });

	console.log("\n✨ Build complete!");
}

main().catch((err) => {
	console.error("Build failed:", err);
	process.exit(1);
});
