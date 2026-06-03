# SEO/GEO/AEO 보완 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** non.salon의 검색/AI 검색 노출 신호를 안정화하고, visible summary, entity metadata, `/llms.txt`를 추가한다.

**Architecture:** 기존 Astro 정적 빌드 흐름을 유지한다. SEO/GEO/AEO 관련 계산은 `src/lib/seo.ts`와 새 `src/lib/llms.ts`로 분리해 테스트 가능하게 만들고, Astro 페이지는 helper 결과를 렌더링만 한다. `llms.txt`는 수동 파일이 아니라 `src/pages/llms.txt.ts` endpoint로 생성해 Notion 데이터 변경 시 자동 갱신되게 한다.

**Tech Stack:** Astro 5, TypeScript, Vitest, Biome, pnpm, Cloudflare Pages, Notion-generated `data/posts.json`.

---

## 판단 기준

- Google Search 공식 문서 기준, AI Overview/AI Mode 노출을 위해 `llms.txt`가 필요하다고 볼 근거는 아직 약하다.
- Google 쪽 확실한 기준은 crawl 가능성, indexable text, canonical 일관성, visible content와 structured data의 일치, snippet 허용이다.
- `llms.txt`는 Google ranking 신호가 아니라 agent-readable content map으로 취급한다.
- 따라서 구현 우선순위는 `visible content + structured data + entity clarity`가 먼저이고, `llms.txt`는 낮은 비용의 실험적 보강으로 둔다.

## Non-goals

- `llms-full.txt`는 이번 범위에서 제외한다. 현재 HTML renderer만 있고 Markdown full-content renderer가 없어 중복 변환 로직이 생길 수 있다.
- FAQ schema를 억지로 추가하지 않는다. 실제 Q/A 콘텐츠가 있는 글에만 추후 별도 적용한다.
- robots policy로 AI 학습 opt-out을 바꾸지 않는다. 현재는 Search 노출을 우선한다.
- 디자인 대개편은 하지 않는다. 상세 글 description/dek는 현재 미니멀 문서 톤 안에서만 추가한다.

## Current Baseline

- `src/lib/seo.ts`가 canonical URL을 extensionless로 정규화한다.
- `src/layouts/Layout.astro`가 canonical, `og:url`, Article JSON-LD `url`을 같은 값으로 출력한다.
- `src/pages/[type]/[slug].astro`가 `dateModified`를 Layout에 전달한다.
- 라이브 기준 `/publications.html`은 `/publications`로 308 redirect된다.
- `robots.txt`, sitemap, RSS, OG 이미지 접근성은 확인됐다.

---

### Task 1: Site Entity Metadata 확장

**Files:**
- Modify: `src/config.ts`
- Modify: `src/lib/seo.test.ts`
- Modify: `src/lib/seo.ts`

**Step 1: Write failing tests for site metadata usage**

Add tests in `src/lib/seo.test.ts` for the future JSON-LD helper:

```ts
import { buildArticleJsonLd, buildWebSiteJsonLd } from "./seo";

it("builds WebSite JSON-LD with sameAs links", () => {
	const jsonLd = buildWebSiteJsonLd("Archived Web Logs");

	expect(jsonLd).toMatchObject({
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "non.salon",
		url: "https://non.salon",
		description: "Archived Web Logs",
	});
	expect(jsonLd.sameAs).toContain("https://github.com/songforthemute");
});

it("builds Article JSON-LD with author URL and sameAs links", () => {
	const jsonLd = buildArticleJsonLd({
		title: "Post title",
		description: "Post description",
		canonicalUrl: "https://non.salon/publication/post-title",
		imageUrl: "https://non.salon/og/publication-post-title.png",
		publishedDate: "2026-03-20",
		modifiedDate: "2026-03-22",
		section: "publication",
		tags: ["React", "AI"],
	});

	expect(jsonLd).toMatchObject({
		"@type": "Article",
		mainEntityOfPage: "https://non.salon/publication/post-title",
		inLanguage: "ko-KR",
		articleSection: "publication",
		keywords: ["React", "AI"],
	});
	expect(jsonLd.author).toMatchObject({
		"@type": "Person",
		name: "songforthemute",
		url: "https://github.com/songforthemute",
	});
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/lib/seo.test.ts
```

Expected:

- FAIL because `buildWebSiteJsonLd` and `buildArticleJsonLd` do not exist yet.

**Step 3: Extend `SITE` metadata**

Update `src/config.ts`:

```ts
export const SITE = {
	name: "non.salon",
	url: "https://non.salon",
	author: "songforthemute",
	authorUrl: "https://github.com/songforthemute",
	sameAs: ["https://github.com/songforthemute", "https://medium.com/@songforthemute"],
	description: "Archived Web Logs",
	language: "ko-KR",
} as const;
```

**Step 4: Implement minimal JSON-LD helpers**

Update `src/lib/seo.ts`:

```ts
type ArticleJsonLdInput = {
	title: string;
	description: string;
	canonicalUrl: string;
	imageUrl: string;
	publishedDate?: string;
	modifiedDate?: string;
	section: string;
	tags: string[];
};

export function buildPersonJsonLd() {
	return {
		"@type": "Person",
		name: SITE.author,
		url: SITE.authorUrl,
		sameAs: SITE.sameAs,
	};
}

export function buildWebSiteJsonLd(description: string) {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: SITE.name,
		url: SITE.url,
		description,
		inLanguage: SITE.language,
		publisher: buildPersonJsonLd(),
		sameAs: SITE.sameAs,
	};
}

export function buildArticleJsonLd(input: ArticleJsonLdInput) {
	return {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: input.title,
		description: input.description,
		datePublished: input.publishedDate,
		dateModified: input.modifiedDate,
		author: buildPersonJsonLd(),
		publisher: buildPersonJsonLd(),
		image: input.imageUrl,
		url: input.canonicalUrl,
		mainEntityOfPage: input.canonicalUrl,
		inLanguage: SITE.language,
		articleSection: input.section,
		keywords: input.tags,
	};
}
```

**Step 5: Run test to verify it passes**

Run:

```bash
pnpm vitest run src/lib/seo.test.ts
```

Expected:

- PASS.

**Step 6: Commit**

```bash
git add src/config.ts src/lib/seo.ts src/lib/seo.test.ts
git commit -m "feat(seo): 구조화 데이터 메타 보강"
```

---

### Task 2: Layout JSON-LD Integration

**Files:**
- Modify: `src/layouts/Layout.astro`
- Modify: `src/pages/[type]/[slug].astro`

**Step 1: Update Layout props**

Add optional props:

```ts
section?: string;
tags?: string[];
```

**Step 2: Replace inline JSON-LD construction**

Use helpers from `src/lib/seo.ts`:

```ts
import { buildArticleJsonLd, buildWebSiteJsonLd, toCanonicalUrl } from "@/lib/seo";
```

For article pages:

```ts
const jsonLd =
	ogType === "article"
		? buildArticleJsonLd({
				title: ogTitle,
				description,
				canonicalUrl,
				imageUrl: ogImageUrl,
				publishedDate,
				modifiedDate,
				section: section || "article",
				tags,
			})
		: buildWebSiteJsonLd(description);
```

**Step 3: Pass section and tags from detail page**

Update `src/pages/[type]/[slug].astro`:

```astro
<Layout
	title={post.title}
	description={post.description || undefined}
	ogType="article"
	ogImage={`${post.type}-${post.slug}.png`}
	publishedDate={publishedDate}
	modifiedDate={modifiedDate}
	section={post.type}
	tags={post.tags}
>
```

**Step 4: Build and inspect generated head**

Run:

```bash
pnpm build:astro
rg -n "mainEntityOfPage|inLanguage|articleSection|keywords|sameAs" dist/publication/*.html
```

Expected:

- Article JSON-LD includes `mainEntityOfPage`, `inLanguage`, `articleSection`, `keywords`, author `url`, and `sameAs`.

**Step 5: Commit**

```bash
git add src/layouts/Layout.astro src/pages/[type]/[slug].astro
git commit -m "feat(seo): 페이지 구조화 데이터 연결"
```

---

### Task 3: Detail Page Visible Summary/Dek

**Files:**
- Modify: `src/pages/[type]/[slug].astro`

**Step 1: Add visible description in article header**

Add a visible summary under title/date/tags:

```astro
{post.description && <p class="summary">{post.description}</p>}
```

Place it inside `<header>`, after tags or before tags. Recommended order:

1. `h1`
2. `time`
3. summary
4. tags

**Step 2: Add minimal styling**

Use current muted document style:

```css
.summary {
	margin-top: 1rem;
	color: var(--color-subtle);
}
```

Do not make it card-like. Keep it plain text.

**Step 3: Build and inspect visible HTML**

Run:

```bash
pnpm build:astro
rg -n "class=\"summary\"" dist/publication/*.html
```

Expected:

- Published detail page has a visible summary paragraph.
- The summary text matches the meta description/JSON-LD description.

**Step 4: Commit**

```bash
git add src/pages/[type]/[slug].astro
git commit -m "feat(aeo): 글 요약 문단 노출"
```

---

### Task 4: `/llms.txt` Generator

**Files:**
- Create: `src/lib/llms.ts`
- Create: `src/lib/llms.test.ts`
- Create: `src/pages/llms.txt.ts`

**Step 1: Write failing tests**

Create `src/lib/llms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Post } from "@/types";
import { buildLlmsTxt } from "./llms";

const posts: Post[] = [
	{
		id: "1",
		title: "Example Publication",
		slug: "example-publication",
		type: "publication",
		status: "Published",
		description: "A long-form technical essay.",
		tags: ["AI", "React"],
		lastUpdated: null,
		lastEditedTime: "2026-03-21T10:30:00.000Z",
		createdTime: "2026-03-19T10:30:00.000Z",
		publishedDate: "2026-03-20",
		blocks: [],
	},
];

describe("buildLlmsTxt", () => {
	it("builds a markdown site map for LLM agents", () => {
		const text = buildLlmsTxt(posts);

		expect(text).toContain("# non.salon");
		expect(text).toContain("> Archived Web Logs");
		expect(text).toContain("## Publications");
		expect(text).toContain(
			"- [Example Publication](https://non.salon/publication/example-publication): A long-form technical essay.",
		);
		expect(text).toContain("## Feeds");
		expect(text).toContain("[RSS](https://non.salon/feed.xml)");
		expect(text).not.toContain("undefined");
	});
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/lib/llms.test.ts
```

Expected:

- FAIL because `src/lib/llms.ts` does not exist.

**Step 3: Implement `src/lib/llms.ts`**

Create helper:

```ts
import { ROUTE_TYPE_MAP, SITE } from "@/config";
import { sortByDate } from "@/lib/posts";
import type { ContentType, Post } from "@/types";

const TYPE_LABELS: Record<ContentType, string> = {
	publication: "Publications",
	thought: "Thoughts",
	notebook: "Notebooks",
};

const TYPE_ROUTES: Record<ContentType, keyof typeof ROUTE_TYPE_MAP> = {
	publication: "publication",
	thought: "thought",
	notebook: "notebook",
};

function describePost(post: Post): string {
	return post.description || `${post.title} on ${SITE.name}`;
}

function buildPostLine(post: Post): string {
	const route = TYPE_ROUTES[post.type];
	return `- [${post.title}](${SITE.url}/${route}/${post.slug}): ${describePost(post)}`;
}

export function buildLlmsTxt(posts: Post[]): string {
	const sections = (Object.keys(TYPE_LABELS) as ContentType[])
		.map((type) => {
			const typePosts = sortByDate(
				posts.filter((post) => post.type === type),
				{},
			);
			if (typePosts.length === 0) return "";
			return [`## ${TYPE_LABELS[type]}`, ...typePosts.map(buildPostLine)].join("\n");
		})
		.filter(Boolean);

	return [
		`# ${SITE.name}`,
		"",
		`> ${SITE.description}`,
		"",
		`${SITE.name} is a Korean web log by ${SITE.author}. It archives long-form technical writing, short essays, and learning notes.`,
		"",
		"## Site",
		`- [Root](${SITE.url}/): Site index`,
		`- [Publications](${SITE.url}/publications): Long-form writing`,
		`- [Thoughts](${SITE.url}/thoughts): Short essays`,
		`- [Notebooks](${SITE.url}/notebooks): Learning notes`,
		"",
		...sections.flatMap((section) => [section, ""]),
		"## Feeds",
		`- [RSS](${SITE.url}/feed.xml): RSS feed for publications`,
		`- [Sitemap](${SITE.url}/sitemap-index.xml): XML sitemap`,
		"",
	].join("\n");
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm vitest run src/lib/llms.test.ts
```

Expected:

- PASS.

**Step 5: Create Astro endpoint**

Create `src/pages/llms.txt.ts`:

```ts
import { buildLlmsTxt } from "@/lib/llms";
import { loadPosts } from "@/lib/posts";

export async function GET() {
	return new Response(buildLlmsTxt(loadPosts()), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}
```

**Step 6: Build and inspect output**

Run:

```bash
pnpm build:astro
sed -n '1,220p' dist/llms.txt
```

Expected:

- `dist/llms.txt` exists.
- It starts with `# non.salon`.
- It includes links to Root, Publications, Thoughts, Notebooks, RSS, Sitemap.
- It includes current published posts from `data/posts.json`.

**Step 7: Commit**

```bash
git add src/lib/llms.ts src/lib/llms.test.ts src/pages/llms.txt.ts
git commit -m "feat(geo): llms.txt 생성 추가"
```

---

### Task 5: Final Verification

**Files:**
- No planned source edits.

**Step 1: Run full tests**

Run:

```bash
pnpm test:run
```

Expected:

- All tests pass.

**Step 2: Run lint**

Run:

```bash
pnpm lint
```

Expected:

- Exit code 0.
- Existing `src/lib/image-handler.ts:132` unused `error` warning may remain unless intentionally addressed in a separate cleanup.

**Step 3: Build**

Run:

```bash
pnpm build:astro
```

Expected:

- Build succeeds.
- Routes include `/llms.txt`.

**Step 4: Inspect SEO/GEO/AEO outputs**

Run:

```bash
rg -n "mainEntityOfPage|sameAs|articleSection|keywords|class=\"summary\"" dist/publication/*.html
sed -n '1,220p' dist/llms.txt
sed -n '1,120p' dist/sitemap-0.xml
sed -n '1,80p' dist/robots.txt
```

Expected:

- Detail pages include enhanced JSON-LD and visible summary.
- `dist/llms.txt` is present and readable.
- sitemap/robots remain valid.

**Step 5: Create PR**

If working on `preview`, push and create PR to `main`:

```bash
git push origin preview
gh pr create --base main --head preview --title "feat(seo): GEO/AEO 메타 보강" --body "<summary and verification>"
```

Recommended PR title:

```text
feat(seo): GEO/AEO 메타 보강
```

Recommended PR body sections:

- Summary
- Why
- Verification
- Notes about `llms.txt` being experimental for Google but useful as an agent-readable map

---

## Rollback Plan

- If structured data validation fails, revert Task 2 and keep Task 1 helpers for review.
- If `/llms.txt` output is stale or malformed, remove only `src/pages/llms.txt.ts`, `src/lib/llms.ts`, and `src/lib/llms.test.ts`.
- If visible summary harms the design tone, keep JSON-LD and `llms.txt` changes but revert Task 3.

## Acceptance Criteria

- `pnpm test:run` passes.
- `pnpm lint` exits 0.
- `pnpm build:astro` succeeds.
- Live detail pages preserve extensionless canonical URLs.
- Article JSON-LD includes author identity, language, main entity URL, section, and keywords.
- Visible article summary matches or closely mirrors meta description.
- `/llms.txt` returns `200` with `text/plain; charset=utf-8` after deployment.
- Search Console can inspect canonical pages without `.html` canonical drift.
