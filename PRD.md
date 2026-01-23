# Notion → Static Blog PRD

**Version:** 1.0 Draft  
**Date:** 2025-01-22  
**Author:** Coco  

---

## 1. Project Overview

개인 아카이브 블로그를 Medium에서 Notion 기반 정적 사이트로 이전하는 프로젝트.

### Goals
- Notion을 CMS(Content Management System)로 사용
- 완전히 독립적인 정적 사이트 생성
- 최소한의 의존성과 복잡도
- 20년 후에도 동일하게 렌더링되는 HTML

### Non-Goals
- 댓글 시스템 (v1)
- Syntax highlighting (v1)
- 다크모드 (v1)
- 애니메이션/인터랙션 (v1)

---

## 2. Vision & Philosophy

> "단순함의 미학, 경계와 구조의 미니멀리즘"

### Core Principles

1. **브라우저를 믿는다**
   - HTML 시맨틱 요소 최대 활용
   - 브라우저 기본 스타일 존중
   - CSS 최소화 (레이아웃만)

2. **시간의 테스트를 통과한 것만**
   - 외부 의존성 최소화
   - 표준 기술만 사용
   - 각 HTML 파일이 완전히 독립적

3. **점진적 향상 (Progressive Enhancement)**
   - JavaScript 없이도 모든 기능 작동
   - Search는 점진적 향상으로 추가

---

## 3. Technical Stack

### SSG (Static Site Generator)
- **Astro**
- 이유: Zero-JS 출력, HTML 시맨틱 최적화, 빠른 빌드

### Content Source
- **Notion API**
- Database Query → Blocks Retrieval → HTML 생성

### Hosting
- **Cloudflare Pages**
- 이유: 무제한 대역폭, 무료, 빠른 글로벌 CDN

### Build Automation
- **Cloudflare Workers** (Webhook 수신)
- **GitHub Actions** (빌드 실행)

### Search
- **Pagefind** (~20KB gzipped)
- 빌드 타임 인덱싱, 클라이언트 사이드 검색

### OG Image
- **Cloudflare Pages Functions**
- 동적 생성 (v1: SVG, v2: PNG)

---

## 4. Database Schema

### Notion Database: "Blog Posts"

```yaml
Properties:
  Title:
    type: title (built-in)
    required: true
  
  Slug:
    type: text
    required: true
    validation: ^[a-z0-9-]+$
    unique: true
    manual: 사용자 직접 입력 (SEO 최적화)
    example: "build-blog-with-astro"
  
  Status:
    type: select
    required: true
    options:
      - "작성 중"
      - "출판됨"
      - "아카이브됨"
    build_behavior:
      - "작성 중": 빌드 제외
      - "출판됨": 빌드 포함
      - "아카이브됨": 빌드 제외 → 404 발생
  
  Published Date:
    type: date
    required: when Status = "출판됨"
    display: 항상 표시
  
  Last Updated:
    type: date
    optional: true
    manual: 의미있는 업데이트만 기록
    display: 있으면 표시
  
  Tags:
    type: multi-select
    optional: true
    usage: 클라이언트 사이드 필터
  
  Description:
    type: text
    optional: true
    max: 160 characters
    usage: meta description (SEO)
  
  빌드 트리거:
    type: button
    label: "🚀 배포하기"
    action: "Open URL"
    url: "https://blog-webhook.{domain}.workers.dev/trigger?page_id={{page.id}}"
```

---

## 5. Build Architecture

### 5.1 Build Trigger Flow

```
Notion Database
  ↓
사용자: "🚀 배포하기" 버튼 클릭
  ↓
GET https://blog-webhook.coco.workers.dev/trigger?page_id={id}
  ↓
Cloudflare Workers
  ├─ Notion API로 Status 확인
  ├─ "출판됨" 아니면 거부 (400 응답)
  └─ GitHub repository_dispatch 트리거
  ↓
POST https://api.github.com/repos/{owner}/{repo}/dispatches
  ↓
GitHub Actions (notion-deploy)
  ├─ npm ci
  ├─ npm run build
  └─ wrangler pages deploy dist
  ↓
Cloudflare Pages (배포)
  ↓
1-2분 후 배포 완료
```

**소요시간:** 약 1-2분  
**비용:** $0 (모두 무료 티어)

### 5.2 Build Strategy: 증분 빌드

#### 개요
- **활성화:** 항상 (CI & 로컬)
- **기준:** `last_edited_time` > 마지막 빌드 시간
- **상태 저장:** `data/last-build.json`

#### 빌드 프로세스

```javascript
async function build() {
  // 1. 마지막 빌드 시간 로드
  const lastBuild = loadLastBuildTime() || '1970-01-01T00:00:00.000Z';
  
  // 2. Notion에서 "출판됨" 글 전체 조회
  const allPosts = await fetchPublishedPosts();
  
  // 3. 변경된 글 필터링
  const changedPosts = allPosts.filter(post => 
    new Date(post.last_edited_time) > new Date(lastBuild)
  );
  
  // 4. 변경된 글만 빌드
  for (const post of changedPosts) {
    await buildPost(post);
  }
  
  // 5. 삭제된 글 처리 (전체 동기화)
  await syncDeletedPosts(allPosts);
  
  // 6. 메타 파일 생성 (항상)
  await generateIndexPage(allPosts);
  await generateRSS(allPosts);
  await generateSitemap(allPosts);
  
  // 7. Pagefind 인덱싱
  await runPagefind();
  
  // 8. 빌드 시간 저장
  saveLastBuildTime(new Date().toISOString());
}
```

#### 성능 개선

```yaml
초기 빌드 (50개 글):
  - Notion API: 50 페이지 + 블록들
  - 이미지 다운로드: ~200개
  - 소요 시간: ~2분

증분 빌드 (1개 수정):
  - Notion API: 1 페이지 + 블록들
  - 이미지 다운로드: ~3개
  - 소요 시간: ~5초

절감: 95% 시간 단축
```

### 5.3 Notion Block 조회

#### Depth Strategy
- **무제한 재귀**
- 전제: 실제로는 2-3 depth만 사용

```javascript
async function getBlocksRecursive(blockId) {
  const { results } = await notion.blocks.children.list({
    block_id: blockId,
    page_size: 100
  });
  
  for (const block of results) {
    if (block.has_children && 
        !['child_page', 'child_database'].includes(block.type)) {
      block.children = await getBlocksRecursive(block.id);
    }
  }
  
  return results;
}
```

#### API Rate Limit 처리
- **Notion API:** 3 requests/second
- **전략:** 350ms delay between requests
- **Retry:** Rate limit 발생 시 1초 대기 후 재시도

### 5.4 Image Handling

#### 이미지 타입
모든 이미지 타입을 로컬 저장:
- **File** (Notion 업로드) - 1시간 만료 → 필수 다운로드
- **External** (URL 입력) - 신뢰성 위해 로컬 저장
- **Unsplash** - 성능 향상 위해 로컬 저장

#### 저장 구조

```
/public/images/
  ├─ post-slug-1/
  │  ├─ {blockId}.png
  │  └─ {blockId}.jpg
  └─ post-slug-2/
     └─ {blockId}.webp
```

**파일명:** `{blockId}.{ext}`
- 충돌 없음 (Block ID는 unique)
- 디버깅 용이
- 원본 파일명 무관

#### 증분 처리
- **전략:** 변경된 글의 이미지 폴더 전체 재다운로드
- **이유:** 단순함 유지, 이미지 개수 적으면 문제 없음

```javascript
async function buildPost(post) {
  const slug = post.properties.Slug.rich_text[0].plain_text;
  const imageDir = `public/images/${slug}`;
  
  // 이미지 폴더 전체 삭제 후 재생성
  await fs.rm(imageDir, { recursive: true, force: true });
  await fs.mkdir(imageDir, { recursive: true });
  
  // 이미지 다운로드
  const blocks = await getBlocksRecursive(post.id);
  const images = extractImages(blocks);
  
  for (const image of images) {
    await downloadImage(image, imageDir);
  }
  
  // HTML 생성
  const html = await generateHTML(post, blocks);
  await fs.writeFile(`dist/posts/${slug}.html`, html);
}
```

### 5.5 Deleted Posts Sync

#### 문제
증분 빌드는 변경된 글만 확인하므로, Status가 "아카이브됨"으로 변경된 글의 HTML이 남아있을 수 있음.

#### 해결: 전체 동기화

```javascript
async function syncDeletedPosts(currentPosts) {
  // 1. 현재 "출판됨" 상태인 글들의 slug 세트
  const currentSlugs = new Set(
    currentPosts.map(p => p.properties.Slug.rich_text[0].plain_text)
  );
  
  // 2. dist/posts/의 모든 HTML 파일 확인
  const existingFiles = await fs.readdir('dist/posts');
  
  // 3. Notion에 없는 slug는 삭제
  for (const file of existingFiles) {
    const slug = file.replace('.html', '');
    
    if (!currentSlugs.has(slug)) {
      console.log(`🗑️  Deleting: ${slug}`);
      
      // HTML 삭제
      await fs.unlink(`dist/posts/${file}`);
      
      // 이미지 폴더 삭제
      await fs.rm(`public/images/${slug}`, { recursive: true, force: true });
    }
  }
}
```

### 5.6 Block Type Support

#### Supported Blocks (Medium 수준)

```yaml
Text Blocks:
  - paragraph → <p>
  - heading_1 → <h2>
  - heading_2 → <h3>
  - heading_3 → <h4>

Lists:
  - bulleted_list_item → <ul><li>
  - numbered_list_item → <ol><li>
  (중첩 지원)

Media:
  - image → <figure><img><figcaption>

Others:
  - quote → <blockquote>
  - code → <pre><code>
  - divider → <hr>

Rich Text Annotations:
  - bold → <strong>
  - italic → <em>
  - code → <code>
  - strikethrough → <s>
  - link → <a>
  - color/background → 무시
```

#### Unsupported Blocks (v1)

```yaml
Ignored:
  - toggle
  - callout
  - column
  - table
  - database
  - embed (YouTube, Tweet, etc.)
  - to_do
  - bookmark
  - file
  - pdf

Fallback:
  - 로그만 남기고 빌드 계속
  - 미지원 블록은 렌더링 안 함
```

---

## 6. Content Scope

### Format Support

**포함:**
- 제목 (H1-H3)
- 단락, 인용구, 구분선
- Bold, Italic, Inline code, 링크
- Bulleted/Numbered lists (중첩 지원)
- 이미지 + 캡션
- 코드 블록 (syntax highlighting 없음)

**제외 (v1):**
- Toggle, Callout, Column layout
- Database/Table
- Embed (YouTube, Tweet)
- To-do checkbox
- 색상/배경색

---

## 7. Features

### 7.1 RSS Feed

```yaml
파일: /feed.xml
업데이트: 빌드할 때마다
포함: 최근 20개 (Published Date 기준)
내용: Summary (Description 또는 첫 200자)
형식: RSS 2.0

용도:
  - Feedly, Inoreader 등 RSS 리더 구독
  - 검색엔진 크롤링 지원
  - 이메일 구독 대체
```

### 7.2 OG Image (Dynamic Generation)

```yaml
방식: Cloudflare Pages Functions
경로: /api/og-image?title={title}
형식: SVG (v1), PNG (v2)
캐싱: immutable, max-age=1년

사용:
  <meta property="og:image" 
        content="https://blog.com/api/og-image?title=...">

비용: $0 (무료 티어)
레이트 리미트: 100,000 req/일
```

**구현:**
```javascript
// functions/api/og-image.js
export async function onRequest({ request }) {
  const url = new URL(request.url);
  const title = url.searchParams.get('title') || 'Coco의 블로그';
  
  const svg = `
    <svg width="1200" height="630">
      <rect fill="#fff" width="1200" height="630"/>
      <text x="100" y="315" font-size="64" fill="#000">
        ${escapeHtml(title)}
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
```

### 7.3 Sitemap

```yaml
파일: /sitemap.xml
포함: 모든 "출판됨" 글
정보:
  - <loc>: URL
  - <lastmod>: Last Updated 또는 Published Date
  - <changefreq>: 생략 (Google이 판단)
  - <priority>: 생략
```

### 7.4 Search (Pagefind)

```yaml
도구: Pagefind
크기: ~20KB gzipped
방식: 빌드 타임 인덱싱
검색: 클라이언트 사이드

특징:
  - 제로 백엔드
  - 한국어 지원
  - 검색 UI 제공
  - data-pagefind-body 속성으로 범위 지정
```

### 7.5 SEO

```html
<!-- Per Post -->
<title>글 제목 | 블로그명</title>
<meta name="description" content="...">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="/api/og-image?title=...">
<link rel="canonical" href="https://blog.com/posts/{slug}">

<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "...",
  "datePublished": "2025-01-15",
  "dateModified": "2025-01-20",
  "author": { "@type": "Person", "name": "Coco" }
}
</script>
```

### 7.6 404 Page

```yaml
파일: /404.html
내용:
  - "404 Not Found"
  - "이 글은 아카이브되었거나 존재하지 않습니다."
  - 홈으로 돌아가기 링크

스타일: 브라우저 기본 + 최소 CSS
```

---

## 8. HTML Structure

### Layout Philosophy

```css
/* layout.css - 전체 CSS */
body {
  max-width: 42rem;
  margin: 0 auto;
  padding: 2rem 1rem;
  font-family: system-ui, sans-serif;
  line-height: 1.6;
}

img {
  max-width: 100%;
  height: auto;
}

pre {
  overflow-x: auto;
}
```

### Semantic HTML

```html
<article>
  <header>
    <h1>글 제목</h1>
    <time datetime="2025-01-22">Published: January 22, 2025</time>
    <time datetime="2025-01-23">Updated: January 23, 2025</time>
  </header>
  
  <div class="content" data-pagefind-body>
    <!-- Notion blocks → HTML -->
  </div>
</article>
```

**사용 태그:**
- `<article>`, `<header>`, `<footer>`, `<nav>`
- `<time>`, `<figure>`, `<figcaption>`
- `<blockquote>`, `<code>`, `<pre>`
- `<strong>`, `<em>`, `<s>`

---

## 9. Deployment

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  repository_dispatch:
    types: [notion-deploy]
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      
      - name: Build
        env:
          NOTION_API_KEY: ${{ secrets.NOTION_API_KEY }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
        run: pnpm build
      
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=blog
```

### Required Secrets

```yaml
GitHub Secrets:
  - NOTION_API_KEY
  - NOTION_DATABASE_ID
  - CLOUDFLARE_API_TOKEN
  - CLOUDFLARE_ACCOUNT_ID

Cloudflare Workers Secrets:
  - NOTION_API_KEY
  - GITHUB_TOKEN
```

### Cost Analysis

```yaml
Cloudflare Workers:
  - 무료: 100,000 req/일
  - 예상: ~30 req/월
  - 비용: $0/월

GitHub Actions:
  - 무료: 2,000분/월
  - 예상: ~60분/월
  - 비용: $0/월

Cloudflare Pages:
  - 무료: 무제한 빌드, 무제한 대역폭
  - 비용: $0/월

총 비용: $0/월
```

---

## 10. Decision Log

### Major Decisions

| 항목 | 결정 | 이유 |
|------|------|------|
| **SSG** | Astro | Zero-JS, 시맨틱 HTML 최적화 |
| **호스팅** | Cloudflare Pages | 무료, 무제한 대역폭 |
| **트리거** | Notion Button (수동) | 완전한 제어, 불필요한 빌드 방지 |
| **빌드 전략** | 증분 빌드 (항상) | 95% 시간 절감 |
| **Block Depth** | 무제한 재귀 | 실제로는 2-3 depth만 사용 |
| **이미지** | 모든 타입 로컬 저장 | File URL 만료, 신뢰성 |
| **이미지 증분** | 전체 재다운로드 | 단순함 유지 |
| **삭제 처리** | 전체 동기화 | 아카이브 글 HTML 자동 삭제 |
| **RSS** | 최근 20개, Summary | 표준적, 블로그 방문 유도 |
| **OG Image** | Pages Functions (동적) | 도메인 통합, v1 SVG |
| **Search** | Pagefind | 20KB, 빌드타임, 제로 백엔드 |
| **Syntax Highlighting** | 없음 (v1) | 브라우저 기본 `<pre><code>` |
| **CSS** | 최소 (~20줄) | 레이아웃만, 브라우저 기본 존중 |

### Technical Constraints

```yaml
지원:
  ✅ Medium 수준 포맷
  ✅ 중첩 리스트 (무제한)
  ✅ 모든 이미지 타입
  ✅ 증분 빌드
  ✅ 동적 OG Image

제외 (v1):
  ❌ Toggle, Callout, Column
  ❌ Database, Table, Embed
  ❌ Syntax highlighting
  ❌ 댓글, 조회수
  ❌ 다크모드
```

---

## 11. Local Development

### Workflow

```bash
# 1. Notion 데이터 가져오기
pnpm fetch:notion
# → data/posts.json 생성

# 2. 로컬 개발 서버
pnpm dev
# → http://localhost:4321

# 3. 빌드 (증분)
pnpm build
# → dist/ 생성

# 4. 배포
git push
# → GitHub Actions 자동 트리거
```

### Scripts

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "node scripts/build.js",
    "fetch:notion": "node scripts/fetch-notion.js",
    "preview": "astro preview"
  }
}
```

---

## 12. Future Roadmap (v2+)

### Potential Features

```yaml
v2:
  - Syntax highlighting (Shiki)
  - 댓글 (utterances/giscus)
  - 태그 페이지
  - OG Image PNG 생성
  - Related posts
  - 301 리디렉션 (Slug 변경 시)

v3:
  - 다크모드
  - Reading time
  - 조회수 (Cloudflare Analytics)
  - Table of Contents
  - Series/시리즈

고려 중:
  - i18n (영어/한국어)
  - Newsletter 연동
  - Analytics 대시보드
```

---

## 13. References

### Documentation
- Notion API: https://developers.notion.com
- Astro: https://docs.astro.build
- Cloudflare Pages: https://developers.cloudflare.com/pages
- Pagefind: https://pagefind.app

### Inspiration
- Dan Abramov's Blog: https://overreacted.io
- CSS Zen Garden (시맨틱 HTML)
- Motherfucking Website (미니멀리즘)

---

## Appendix A: Example Notion Block → HTML

### Input (Notion Blocks)

```json
{
  "type": "paragraph",
  "paragraph": {
    "rich_text": [
      { "text": { "content": "This is " }, "annotations": { "bold": false } },
      { "text": { "content": "bold" }, "annotations": { "bold": true } },
      { "text": { "content": " text." }, "annotations": { "bold": false } }
    ]
  }
}
```

### Output (HTML)

```html
<p>This is <strong>bold</strong> text.</p>
```

---

## Appendix B: File Structure

```
blog/
├── src/
│   ├── pages/
│   │   └── index.astro
│   └── layouts/
│       └── Layout.astro
├── public/
│   ├── images/
│   │   ├── post-slug-1/
│   │   └── post-slug-2/
│   └── styles/
│       └── layout.css
├── functions/
│   └── api/
│       └── og-image.js
├── scripts/
│   ├── build.js
│   └── fetch-notion.js
├── data/
│   ├── last-build.json
│   └── posts.json
├── dist/
│   ├── index.html
│   ├── posts/
│   │   ├── post-1.html
│   │   └── post-2.html
│   ├── feed.xml
│   ├── sitemap.xml
│   └── pagefind/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── package.json
└── astro.config.mjs
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 Draft | 2025-01-22 | Initial PRD creation |
| 1.1 Draft | 2025-01-24 | Node 24 + pnpm으로 변경 |

---

**END OF DOCUMENT**
