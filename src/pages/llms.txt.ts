import { buildLlmsTxt } from "@/lib/llms";
import { loadPosts } from "@/lib/posts";

export async function GET() {
	return new Response(buildLlmsTxt(loadPosts()), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}
