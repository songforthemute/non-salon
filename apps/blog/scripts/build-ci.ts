import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PATHS } from "../src/config.js";
import { reportBlockDiagnostics } from "../src/lib/block-diagnostics.js";
import { populateImageDimensions, populateWebpVariants } from "../src/lib/image-handler.js";
import type { Post } from "../src/types.js";
import { generateOgImages } from "./generate-og-images.js";

const FIXTURE_POSTS_PATH = path.join(process.cwd(), "fixtures/posts.json");
const FIXTURE_IMAGES_DIR = path.join(process.cwd(), "fixtures/images");
const PUBLIC_IMAGES_DIR = path.join(process.cwd(), PATHS.images);
const POSTS_PATH = path.join(process.cwd(), PATHS.posts);

async function prepareFixtureImages(): Promise<void> {
	await fs.rm(PUBLIC_IMAGES_DIR, { recursive: true, force: true });
	try {
		await fs.access(FIXTURE_IMAGES_DIR);
	} catch {
		return;
	}
	await fs.cp(FIXTURE_IMAGES_DIR, PUBLIC_IMAGES_DIR, { recursive: true });
}

async function prepareFixturePosts(): Promise<void> {
	await prepareFixtureImages();

	const fixture = await fs.readFile(FIXTURE_POSTS_PATH, "utf-8");
	const rawPosts: unknown = JSON.parse(fixture);

	if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
		throw new Error("fixtures/posts.json must contain at least one post");
	}

	const posts = rawPosts as Post[];
	for (const post of posts) {
		post.blocks = await populateImageDimensions(
			post.blocks as Parameters<typeof populateImageDimensions>[0],
		);
		post.blocks = await populateWebpVariants(post.blocks);
	}

	await fs.mkdir(path.dirname(POSTS_PATH), { recursive: true });
	await fs.writeFile(POSTS_PATH, `${JSON.stringify(posts, null, 2)}\n`);
	reportBlockDiagnostics(posts);
	console.log(`📋 Prepared ${posts.length} fixture posts`);
}

async function main() {
	console.log("🚀 CI build started\n");

	await prepareFixturePosts();

	console.log("\n🖼️  Generating OG images...");
	const ogCount = await generateOgImages();
	console.log(`✅ ${ogCount} OG images generated`);

	console.log("\n🔨 Building with Astro...");
	execFileSync("pnpm", ["astro", "build"], { stdio: "inherit" });

	console.log("\n🔍 Indexing for search...");
	execFileSync("pnpm", ["pagefind", "--site", "dist"], { stdio: "inherit" });

	console.log("\n✨ CI build complete!");
}

main().catch((err) => {
	console.error("CI build failed:", err);
	process.exit(1);
});
