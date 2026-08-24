import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PATHS } from "../src/config.js";
import { generateOgImages } from "./generate-og-images.js";

const FIXTURE_POSTS_PATH = path.join(process.cwd(), "fixtures/posts.json");
const POSTS_PATH = path.join(process.cwd(), PATHS.posts);

async function prepareFixturePosts(): Promise<void> {
	const fixture = await fs.readFile(FIXTURE_POSTS_PATH, "utf-8");
	const posts: unknown = JSON.parse(fixture);

	if (!Array.isArray(posts) || posts.length === 0) {
		throw new Error("fixtures/posts.json must contain at least one post");
	}

	await fs.mkdir(path.dirname(POSTS_PATH), { recursive: true });
	await fs.writeFile(POSTS_PATH, `${JSON.stringify(posts, null, 2)}\n`);
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
