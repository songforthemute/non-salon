interface Env {}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

export const onRequest: PagesFunction<Env> = async ({ request }) => {
	const url = new URL(request.url);
	const title = url.searchParams.get("title") || "non.salon";

	const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#ffffff" width="1200" height="630"/>
  <text x="100" y="315" font-size="48" font-family="system-ui, sans-serif" fill="#000000">
    ${escapeHtml(title)}
  </text>
  <text x="100" y="380" font-size="24" font-family="system-ui, sans-serif" fill="#666666">
    non.salon
  </text>
</svg>`;

	// deprecated: 정적 PNG OG 이미지로 대체됨 (public/og/). 캐시된 링크 호환성을 위해 유지
	return new Response(svg, {
		headers: {
			"Content-Type": "image/svg+xml",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
};
