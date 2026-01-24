# Notion Blog - Phase 2 PRD: Static Pages & Content Sections

**Version:** 2.1 Draft
**Date:** 2025-01-25  
**Author:** songforthemute  
**Blog:** whitespace  
**Dependency:** Phase 1 완료 필요

---

## 1. Overview

Phase 1의 블로그 시스템을 확장하여 다양한 콘텐츠 섹션과 정적 페이지를 추가한다.

### Phase 1 Recap (완료)

```yaml
✅ Notion Database → Blog Posts
✅ Incremental builds
✅ RSS, Sitemap, Search
✅ OG Image generation
✅ Cloudflare Pages 배포
```

### Phase 2 Goals (신규)

```yaml
콘텐츠 섹션:
  - Publications (긴 기술 글)
  - Thoughts (짧은 에세이)
  - Notebooks (학습 메모, 스니펫)

정적 페이지 (TODO):
  - Landing (/) - 동적 섹션 구현 방식 미정
  - Whois (소개) - 스타일 미정
  - Resume (이력서) - outlink 가능성

기타:
  - 전역 Navigation
  - 통합 RSS
  - 통합 Sitemap
```

---

## 2. Site Structure (확정)

### URL Structure

```
/                       # Landing (Hero, Featured content)
/publications           # Publications 목록
/publications/{slug}    # 개별 Publication
/thoughts               # Thoughts 목록
/thoughts/{slug}        # 개별 Thought
/notebooks              # Notebooks 목록
/notebooks/{slug}       # 개별 Notebook
/whois                  # 소개 페이지
/resume                 # 이력서
/feed.xml               # RSS (모든 콘텐츠)
/sitemap.xml            # Sitemap (모든 페이지)
```

### Navigation

```html
<nav>
  <a href="/">Home</a>
  <a href="/publications">Publications</a>
  <a href="/notebooks">Notebooks</a>
  <a href="/thoughts">Thoughts</a>
  <a href="/whois">Whois</a>
  <a href="/resume">Resume</a>
</nav>
```

---

## 3. Content Types

### Publications (/publications)

```yaml
성격: 긴 기술 글, 아티클, 튜토리얼
분량: 2000+ 단어
주제: 심층 기술 분석, 아키텍처, 시스템 설계
빈도: 월 1-2회
예시:
  - "Notion 블로그 시스템 구축 PRD"
  - "Module Federation 완벽 가이드"
  - "Web3 DApp 아키텍처 설계"
  - "React 성능 최적화 패턴"

관리: Notion Database
URL: /publications/{slug}
```

### Thoughts (/thoughts)

```yaml
성격: 짧은 에세이, 생각, 관점
분량: 500-1000 단어
주제: 철학, 트렌드, 의견, 인사이트
빈도: 주 1-2회
예시:
  - "AI 시대의 개발자 가치란"
  - "미니멀리즘과 코드"
  - "블록체인이 바꿀 미래"
  - "소프트 스킬의 중요성"

관리: Notion Database
URL: /thoughts/{slug}
```

### Notebooks (/notebooks)

```yaml
성격: 학습 메모, 코드 스니펫, 실험, 트러블슈팅
분량: 100-500 단어
주제:
  - 오늘 배운 것 (TIL)
  - 유용한 코드 패턴
  - 버그 해결 과정
  - 빠른 참조 (치트시트)
  - 프로토타입 실험
빈도: 주 3-5회
예시:
  - "CSS Grid gap 속성 활용법"
  - "React useCallback 언제 쓸까"
  - "Git rebase vs merge 차이점"
  - "TypeScript utility types 모음"
  - "CORS 에러 디버깅"

관리: Notion Database
URL: /notebooks/{slug}
```

### Whois (/whois)

```yaml
성격: 자기소개 페이지
내용:
  - 이름, 역할
  - 경력 요약
  - 관심사
  - 연락처, SNS 링크
업데이트: 가끔 (분기 1회)

관리: Notion Static Pages Database
URL: /whois
```

### Resume (/resume)

```yaml
성격: 이력서
내용:
  - Experience (Timeline)
  - Skills
  - Projects
  - Education
업데이트: 가끔 (분기 1회)
특수기능: PDF 다운로드 (선택)

관리: Notion Static Pages Database
URL: /resume
```

### Landing (/)

```yaml
성격: 홈페이지, 첫 페이지
섹션:
  - Hero (이름, 타이틀, CTA)
  - Recent Publications (최근 3개)
  - Recent Notebooks (최근 5개)
  - Links (GitHub, LinkedIn, Email)
업데이트: 거의 없음 (년 1-2회)

관리: Notion Static Pages Database
URL: /
```

---

## 4. Architecture: Notion-First

### 모든 콘텐츠를 Notion으로 관리

```yaml
Notion CMS (모든 콘텐츠): ✅ Publications
  ✅ Thoughts
  ✅ Notebooks
  ✅ Whois
  ✅ Resume
  ✅ Landing

Code (렌더링 로직만): ✅ Astro 페이지 (Notion 데이터 → HTML)
  ✅ 빌드 스크립트
  ✅ 레이아웃 컴포넌트
```

### 이유

```yaml
장점: ✅ 단일 관리 포인트 (Notion)
  ✅ 비개발자도 수정 가능
  ✅ 버전 히스토리 자동
  ✅ 이미지 자동 처리
  ✅ 퍼블릭 리포지터리 (콘텐츠 분리)
  ✅ 일관된 워크플로우

제약: ❌ Notion block 제약 (Medium 수준)
  ❌ 복잡한 레이아웃 어려움
  → Phase 1 철학과 일치 (미니멀리즘)
```

---

## 5. Notion Database Schema

### Database 1: "Content"

```yaml
Database: "Content"

Properties:
  Title:
    type: title (built-in)
    required: true
    example: "React Performance Optimization"

  Slug:
    type: text
    required: true
    validation: ^[a-z0-9-]+$
    unique: true
    example: "react-performance-optimization"

  Type:
    type: select
    required: true
    options:
      - "publication"
      - "thought"
      - "notebook"
    default: "publication"

  Status:
    type: select
    required: true
    options:
      - "Draft"
      - "Published"
      - "Archived"
    default: "Draft"

  Published Date:
    type: date
    required: when Status = "Published"
    display: 항상 표시

  Last Updated:
    type: date
    optional: true
    manual: 의미있는 업데이트만

  Tags:
    type: multi-select
    optional: true
    examples: ["React", "TypeScript", "CSS", "Blockchain"]

  Description:
    type: text
    optional: true
    max: 160 characters
    usage: meta description

  빌드 트리거:
    type: button
    label: "🚀 배포하기"
    url: "https://blog-webhook.{domain}.workers.dev/trigger?page_id={{page.id}}"

Views:
  📰 Publications:
    Filter: Type = "publication"
    Sort: Published Date (desc)

  💭 Thoughts:
    Filter: Type = "thought"
    Sort: Published Date (desc)

  📓 Notebooks:
    Filter: Type = "notebook"
    Sort: Published Date (desc)

  🚀 Published:
    Filter: Status = "Published"
    Sort: Published Date (desc)

  ✍️ Drafts:
    Filter: Status = "Draft"
    Sort: Last Edited Time (desc)
```

### Database 2: "Static Pages"

```yaml
Database: "Static Pages"

용도:
  - Landing (/)
  - Whois (/whois)
  - Resume (/resume)

Properties:
  Title:
    type: title
    example: "Landing", "Whois", "Resume"

  Slug:
    type: text
    required: true
    validation: ^[a-z0-9-]+$
    unique: true
    values: "home", "whois", "resume"

  Type:
    type: select
    options: ["landing", "whois", "resume"]

  Status:
    type: select
    options: ["Draft", "Published"]

  Last Updated:
    type: date

  Content:
    Notion blocks (paragraph, heading, image, etc.)

Pages:
  1. Title: "Landing", Slug: "home", Type: "landing"
  2. Title: "Whois", Slug: "whois", Type: "whois"
  3. Title: "Resume", Slug: "resume", Type: "resume"

Build Rules:
  - Slug = "home" → /index.html
  - Slug = "whois" → /whois.html
  - Slug = "resume" → /resume.html
```

---

## 6. Build Process Updates

### Build Flow

```javascript
async function build() {
  const lastBuild = loadLastBuildTime() || "1970-01-01";

  // 1. Fetch all published content
  const allContent = await fetchContent({
    database: "Content",
    filter: { Status: "Published" },
  });

  // 2. Filter by type
  const publications = allContent.filter((c) => c.type === "publication");
  const thoughts = allContent.filter((c) => c.type === "thought");
  const notebooks = allContent.filter((c) => c.type === "notebook");

  // 3. Incremental build (changed content only)
  const changedPublications = filterChanged(publications, lastBuild);
  const changedThoughts = filterChanged(thoughts, lastBuild);
  const changedNotebooks = filterChanged(notebooks, lastBuild);

  // 4. Build changed content
  for (const item of changedPublications) {
    await buildContent(item, `publications/${item.slug}.html`);
  }
  for (const item of changedThoughts) {
    await buildContent(item, `thoughts/${item.slug}.html`);
  }
  for (const item of changedNotebooks) {
    await buildContent(item, `notebooks/${item.slug}.html`);
  }

  // 5. Build index pages (always)
  await buildIndexPage(publications, "publications/index.html");
  await buildIndexPage(thoughts, "thoughts/index.html");
  await buildIndexPage(notebooks, "notebooks/index.html");

  // 6. Sync deleted content
  await syncDeleted(publications, "publications");
  await syncDeleted(thoughts, "thoughts");
  await syncDeleted(notebooks, "notebooks");

  // 7. Build static pages
  const staticPages = await fetchContent({
    database: "Static Pages",
    filter: { Status: "Published" },
  });

  for (const page of staticPages) {
    const outputPath =
      page.slug === "home" ? "index.html" : `${page.slug}.html`;
    await buildStaticPage(page, outputPath);
  }

  // 8. Meta files (always)
  await generateRSS([...publications, ...thoughts, ...notebooks]);
  await generateSitemap([
    ...publications,
    ...thoughts,
    ...notebooks,
    ...staticPages,
  ]);

  // 9. Pagefind indexing
  await runPagefind();

  // 10. Save build time
  saveLastBuildTime(new Date().toISOString());
}
```

### URL Mapping

```javascript
// Content Database
const contentUrlMap = {
  publication: (slug) => `/publications/${slug}`,
  thought: (slug) => `/thoughts/${slug}`,
  notebook: (slug) => `/notebooks/${slug}`,
};

// Static Pages Database
const staticUrlMap = {
  home: () => `/`,
  whois: () => `/whois`,
  resume: () => `/resume`,
};
```

---

## 7. Landing Page (Notion 관리)

### Notion 페이지 구조

```
Static Pages Database
Page: Landing

Content:
  # whitespace

  Frontend Developer & Blockchain Enthusiast

  [Read Publications →] [View Resume →]

  ## Recent Publications
  (빌드 시 동적 삽입)

  ## Recent Notebooks
  (빌드 시 동적 삽입)

  ## Links
  - [GitHub](https://github.com/songforthemute)
  - [LinkedIn](...)
  - [Email](mailto:...)
```

### 빌드 시 처리

```javascript
async function buildLandingPage(page) {
  const blocks = await getBlocks(page.id);

  // Recent content 섹션 찾기
  const recentPubsSection = findSection(blocks, "Recent Publications");
  const recentNotesSection = findSection(blocks, "Recent Notebooks");

  // 동적 콘텐츠 삽입
  const recentPubs = await getRecentContent("publication", 3);
  const recentNotes = await getRecentContent("notebook", 5);

  // HTML 생성
  const html = generateHTML({
    blocks,
    dynamicSections: {
      "Recent Publications": recentPubs,
      "Recent Notebooks": recentNotes,
    },
  });

  await writeFile("dist/index.html", html);
}
```

---

## 8. Whois Page (Notion 관리)

### Option A: 일반 스타일

```
Static Pages Database
Page: Whois

Content:
  # Who is songforthemute?

  Hi, I'm a frontend developer based in Seoul.

  ## What I Do
  I build web applications with React and TypeScript...

  ## Interests
  - Blockchain & Web3
  - Minimalist design
  - Open source

  ## Let's Connect
  - Email: ...
  - GitHub: github.com/songforthemute
```

### Option B: 터미널 스타일 (콘텐츠만 Notion)

```
Static Pages Database
Page: Whois

Content:
  $ whois songforthemute

  Name:        songforthemute
  Role:        Frontend Developer
  Location:    Seoul, Korea
  Stack:       React, TypeScript, Web3
  Interests:   Blockchain, Minimalism, Open Source
  Contact:     ...

  Links:
    GitHub:    github.com/songforthemute

  ---
  Last updated: 2025-01-22
```

**빌드 시:**

- Notion 콘텐츠 가져오기
- `<pre><code>` 태그로 감싸기
- 터미널 스타일 CSS 적용

---

## 9. Resume Page (Notion 관리)

### Notion 페이지 구조

```
Static Pages Database
Page: Resume

Content:
  # songforthemute

  Frontend Developer

  [Download PDF →]

  ## Experience

  ### Senior Developer - Company A
  2020 - Present

  - Led frontend architecture migration to React
  - Mentored 5 junior developers
  - Reduced build time by 60%

  ### Developer - Company B
  2018 - 2020

  - Built e-commerce platform with Next.js
  - Implemented CI/CD pipeline

  ## Skills

  ### Frontend
  - React, TypeScript
  - Next.js, Astro

  ### Blockchain
  - Web3.js, Ethers.js
  - Smart contracts

  ## Projects

  ### DeFi Dashboard
  Real-time crypto portfolio tracker
```

### 특수 처리

```javascript
async function buildResumePage(page) {
  const blocks = await getBlocks(page.id);

  // Experience 섹션 → Timeline 스타일
  const html = generateHTML(blocks, {
    customRenderers: {
      heading_3: renderAsTimelineItem, // Company names
      bulleted_list: renderAsTimelineDetails,
    },
  });

  await writeFile("dist/resume.html", html);
}
```

---

## 10. RSS Feed Updates

### 통합 RSS

```xml
<!-- /feed.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>whitespace</title>
    <link>https://whitespace.dev</link>
    <description>Publications, Thoughts, and Notebooks by songforthemute</description>

    <!-- Publication -->
    <item>
      <title>React Performance Optimization</title>
      <link>https://whitespace.dev/publications/react-perf</link>
      <category>Publication</category>
      <pubDate>Thu, 22 Jan 2025 00:00:00 GMT</pubDate>
      <description>...</description>
    </item>

    <!-- Thought -->
    <item>
      <title>AI Era Developer</title>
      <link>https://whitespace.dev/thoughts/ai-era-dev</link>
      <category>Thought</category>
      <pubDate>Wed, 21 Jan 2025 00:00:00 GMT</pubDate>
      <description>...</description>
    </item>

    <!-- Notebook -->
    <item>
      <title>CSS Grid Tips</title>
      <link>https://whitespace.dev/notebooks/css-grid</link>
      <category>Notebook</category>
      <pubDate>Tue, 20 Jan 2025 00:00:00 GMT</pubDate>
      <description>...</description>
    </item>
  </channel>
</rss>
```

**포함 범위:**

- 최근 20개 (모든 타입 통합)
- Category로 타입 구분
- Published Date 기준 정렬

---

## 11. Sitemap Updates

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Landing -->
  <url>
    <loc>https://whitespace.dev/</loc>
    <lastmod>2025-01-22</lastmod>
    <priority>1.0</priority>
  </url>

  <!-- Static Pages -->
  <url>
    <loc>https://whitespace.dev/whois</loc>
    <lastmod>2025-01-20</lastmod>
    <priority>0.8</priority>
  </url>

  <url>
    <loc>https://whitespace.dev/resume</loc>
    <lastmod>2025-01-15</lastmod>
    <priority>0.8</priority>
  </url>

  <!-- Index Pages -->
  <url>
    <loc>https://whitespace.dev/publications</loc>
    <priority>0.9</priority>
  </url>

  <url>
    <loc>https://whitespace.dev/thoughts</loc>
    <priority>0.7</priority>
  </url>

  <url>
    <loc>https://whitespace.dev/notebooks</loc>
    <priority>0.7</priority>
  </url>

  <!-- Content -->
  <url>
    <loc>https://whitespace.dev/publications/react-perf</loc>
    <lastmod>2025-01-22</lastmod>
    <priority>0.6</priority>
  </url>

  <url>
    <loc>https://whitespace.dev/thoughts/ai-era</loc>
    <lastmod>2025-01-21</lastmod>
    <priority>0.5</priority>
  </url>

  <url>
    <loc>https://whitespace.dev/notebooks/css-grid</loc>
    <lastmod>2025-01-20</lastmod>
    <priority>0.4</priority>
  </url>
</urlset>
```

---

## 12. Index Pages Design

### Publications Index

```astro
---
// src/pages/publications/index.astro
import Layout from '../../layouts/Layout.astro';
import { getAllContent } from '../../lib/notion';

const publications = await getAllContent('publication');
---

<Layout title="Publications - whitespace">
  <header>
    <h1>📰 Publications</h1>
    <p>긴 기술 글, 튜토리얼, 심층 분석</p>
  </header>

  <div class="posts">
    {publications.map(pub => (
      <article>
        <h2><a href={`/publications/${pub.slug}`}>{pub.title}</a></h2>
        <time>{pub.date}</time>
        <p>{pub.description}</p>
        <div class="tags">
          {pub.tags.map(tag => <span>{tag}</span>)}
        </div>
      </article>
    ))}
  </div>
</Layout>
```

### Thoughts Index

```astro
---
// src/pages/thoughts/index.astro
const thoughts = await getAllContent('thought');
---

<Layout title="Thoughts - whitespace">
  <header>
    <h1>💭 Thoughts</h1>
    <p>짧은 에세이, 생각, 관점</p>
  </header>

  <!-- Timeline Style -->
  <div class="timeline">
    {thoughts.map(thought => (
      <article class="thought-item">
        <time>{thought.date}</time>
        <h3><a href={`/thoughts/${thought.slug}`}>{thought.title}</a></h3>
      </article>
    ))}
  </div>
</Layout>
```

### Notebooks Index

```astro
---
// src/pages/notebooks/index.astro
const notebooks = await getAllContent('notebook');
---

<Layout title="Notebooks - whitespace">
  <header>
    <h1>📓 Notebooks</h1>
    <p>학습 메모, 코드 스니펫, 실험</p>
  </header>

  <!-- List Style -->
  <ul class="notebook-list">
    {notebooks.map(note => (
      <li>
        <time>{note.date}</time>
        <a href={`/notebooks/${note.slug}`}>{note.title}</a>
      </li>
    ))}
  </ul>
</Layout>
```

---

## 13. File Structure (Phase 2 완료 후)

```
blog/
├── src/
│   ├── pages/
│   │   ├── index.astro                  # Landing (Notion)
│   │   ├── whois.astro                  # Whois (Notion)
│   │   ├── resume.astro                 # Resume (Notion)
│   │   ├── publications/
│   │   │   ├── index.astro              # Publications 목록
│   │   │   └── [slug].astro             # Publication (Notion)
│   │   ├── thoughts/
│   │   │   ├── index.astro              # Thoughts 목록
│   │   │   └── [slug].astro             # Thought (Notion)
│   │   └── notebooks/
│   │       ├── index.astro              # Notebooks 목록
│   │       └── [slug].astro             # Notebook (Notion)
│   ├── components/
│   │   └── Nav.astro                    # 전역 Navigation
│   ├── layouts/
│   │   └── Layout.astro                 # 공통 레이아웃
│   └── lib/
│       └── notion.ts                    # Notion API 헬퍼
├── public/
│   ├── images/                          # Notion 이미지
│   │   ├── publications/
│   │   ├── thoughts/
│   │   └── notebooks/
│   ├── resume.pdf                       # Resume PDF (선택)
│   └── styles/
│       └── layout.css
├── scripts/
│   └── build.js                         # 빌드 스크립트
├── data/
│   └── last-build.json                  # 빌드 메타데이터
└── dist/
    ├── index.html
    ├── whois.html
    ├── resume.html
    ├── publications/
    ├── thoughts/
    ├── notebooks/
    ├── feed.xml
    └── sitemap.xml
```

---

## 14. Testing Checklist

```yaml
Navigation: ✓ 모든 페이지에 nav 표시
  ✓ 현재 페이지 하이라이트
  ✓ 모바일에서 동작
  ✓ 모든 링크 동작

Content: ✓ Publications 정상 표시
  ✓ Thoughts 정상 표시
  ✓ Notebooks 정상 표시
  ✓ Type별 URL 올바름
  ✓ 이미지 로드

Static Pages: ✓ Landing Hero 표시
  ✓ Recent content 표시
  ✓ Whois 정보 정확
  ✓ Resume 레이아웃
  ✓ Notion 업데이트 반영

SEO: ✓ 모든 페이지 title
  ✓ 모든 페이지 description
  ✓ OG Image 생성
  ✓ RSS 유효성
  ✓ Sitemap 유효성

Build: ✓ 증분 빌드 동작
  ✓ Type별 빌드 분리
  ✓ Static Pages 빌드
  ✓ 삭제된 콘텐츠 처리
  ✓ 빌드 시간 < 2분
  ✓ 에러 없음
```

---

## 15. Migration from Phase 1

### Backwards Compatibility

```yaml
Phase 1 기능 (모두 유지): ✓ Notion → HTML 변환
  ✓ 이미지 로컬 저장
  ✓ 증분 빌드
  ✓ RSS, Sitemap
  ✓ OG Image
  ✓ Pagefind Search

Phase 1 URL (변경 옵션):
  Option A: /posts → /publications (리디렉션)
  Option B: Phase 1부터 /publications 사용

추천: Option B (처음부터 /publications)
```

### 점진적 배포

```yaml
Step 1: Database 확장
  - Type property 추가
  - Status 값 영어로 (Draft/Published/Archived)
  - Views 생성

Step 2: Publications 구현
  - /publications 구조
  - 기존 블로그 글 이전

Step 3: Static Pages Database
  - Landing, Whois, Resume 페이지 생성
  - 빌드 스크립트 업데이트

Step 4: Thoughts & Notebooks
  - Type 추가
  - 샘플 데이터 생성

각 단계마다 배포 → 테스트 → 다음 단계
```

---

## 16. Cost Impact

```yaml
Phase 1:
  - Cloudflare Pages: $0
  - Workers: $0
  - 총: $0/월

Phase 2 추가 비용:
  - 추가 페이지: $0 (무제한)
  - 추가 빌드: $0 (무제한)
  - 추가 대역폭: $0 (무제한)
  - Functions: $0 (동일 quota)

총: $0/월 (변화 없음)
```

---

## 17. Success Metrics

```yaml
Launch Criteria: ✓ 모든 콘텐츠 타입 동작
  ✓ Navigation 완성
  ✓ Landing page live
  ✓ Whois updatable from Notion
  ✓ Resume updatable from Notion
  ✓ RSS includes all types
  ✓ Sitemap complete
  ✓ No broken links
  ✓ Build < 2 minutes
  ✓ All tests passing

User Experience:
  - 명확한 콘텐츠 구분
  - 빠른 페이지 로드 (<1s)
  - 일관된 디자인
  - 모바일 반응형
  - 직관적 네비게이션
```

---

## 18. Future Enhancements (Phase 3?)

```yaml
Content:
  - Series/시리즈 (연관 글 묶기)
  - Related content
  - 태그 페이지 (/tags/{tag})
  - Archive 페이지

Features:
  - 댓글 (utterances/giscus)
  - 조회수
  - Reading time
  - Table of Contents
  - Syntax highlighting (Shiki)

Design:
  - Dark mode
  - Interactive components

Analytics:
  - Cloudflare Web Analytics
  - Popular posts
  - Traffic insights
```

---

## 19. Decision Summary

```yaml
확정사항:
  ✅ Blog: whitespace
  ✅ Author: songforthemute
  ✅ Status: Draft / Published / Archived

  ✅ URL 구조
     - /publications
     - /thoughts
     - /notebooks
     - /whois
     - /resume

  ✅ Notion-First Architecture
     - 모든 콘텐츠 Notion 관리
     - 코드는 렌더링만
     - 퍼블릭 리포지터리

  ✅ Content Database
     - Type: publication, thought, notebook

  ✅ 통합 RSS (모든 타입)

  ✅ 전역 Navigation

  ✅ 증분 빌드 유지

미결정 (TODO):
  🤔 Static Pages (Landing, Whois, Resume)
     - DB 구조 미정 (별도 DB vs Content DB 통합)
     - Resume는 outlink 가능성 있음
  🤔 Landing 동적 섹션 구현 방법 (일단 빈 페이지로)
  🤔 Whois 스타일 (일반 vs 터미널)
  🤔 Resume PDF 생성 방식
```

---

## Appendix A: Notion Setup Guide

### 1. Content Database 생성

```
1. Notion에서 새 Database 생성
   - Name: "Content"
   - Type: Database - Full page

2. Properties 추가:
   - Title (built-in)
   - Slug (text)
   - Type (select: publication, thought, notebook)
   - Status (select: Draft, Published, Archived)
   - Published Date (date)
   - Last Updated (date)
   - Tags (multi-select)
   - Description (text)
   - 빌드 트리거 (button)

3. Views 생성:
   - Publications (filter: Type = publication)
   - Thoughts (filter: Type = thought)
   - Notebooks (filter: Type = notebook)
   - Published (filter: Status = Published)
   - Drafts (filter: Status = Draft)

4. 샘플 데이터:
   - Publication 1개
   - Thought 1개
   - Notebook 1개
```

### 2. Static Pages Database 생성

```
1. Notion에서 새 Database 생성
   - Name: "Static Pages"

2. Properties 추가:
   - Title (built-in)
   - Slug (text)
   - Type (select: landing, whois, resume)
   - Status (select: Draft, Published)
   - Last Updated (date)

3. Pages 생성:
   - Landing (slug: "home")
   - Whois (slug: "whois")
   - Resume (slug: "resume")
```

---

## Appendix B: Blog Name "whitespace"

### 왜 좋은가?

```yaml
철학적 부합: ✅ "단순함의 미학" - 여백의 미학
  ✅ "경계와 구조의 미니멀리즘" - 코드의 whitespace
  ✅ HTML/CSS에서 whitespace는 가독성의 핵심

기술적 의미:
  ✅ 프로그래밍: 들여쓰기, 가독성
  ✅ 디자인: 여백, 레이아웃
  ✅ 미니멀리즘: 비어있음의 아름다움

실용성: ✅ 기억하기 쉬움
  ✅ 타이핑 간단
  ✅ 도메인 가능성 높음
  ✅ 독특하면서도 의미있음

도메인 추천:
  - whitespace.dev ⭐
  - whitespace.io
  - whitespace.blog
  - songforthemute.dev
```

---

## Document History

| Version   | Date       | Changes                                               |
| --------- | ---------- | ----------------------------------------------------- |
| 2.0 Draft | 2025-01-22 | Initial draft                                         |
| 2.0 Final | 2025-01-22 | Updated with whitespace, songforthemute, Notion-first |

---

**Dependencies:**

- Phase 1 PRD: notion-blog-prd.md

**Next Steps:**

1. Notion Database 설정
2. 샘플 데이터 생성
3. 구현 시작

---

**END OF DOCUMENT**
