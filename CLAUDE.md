# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

non.salon — Notion을 CMS로 사용하는 Astro 기반 정적 블로그. Cloudflare Pages에 배포.

## Commands

```bash
pnpm dev           # Astro dev server (localhost:4321)
pnpm build         # 전체 빌드: fetch-notion → 이미지 다운로드 → astro build → pagefind 인덱싱
pnpm build:astro   # Astro 빌드만 (Notion fetch/이미지 생략)
pnpm fetch:notion  # Notion 데이터만 가져오기 (data/posts.json 생성)
pnpm test          # Vitest watch 모드
pnpm test:run      # Vitest 단일 실행
pnpm lint          # Biome check (읽기 전용)
pnpm lint:fix      # Biome check --write (자동 수정)
pnpm format        # Biome format --write
```

Node.js 24+ 필수. 패키지 매니저는 pnpm.

## Architecture

**데이터 흐름:** Notion DB → `scripts/fetch-notion.ts` → `data/posts.json` → Astro 빌드 시 `fs.readFileSync`로 읽기 → 정적 HTML 생성

Astro Content Collections를 사용하지 않음. `data/posts.json`은 gitignore 대상이며 빌드 시 생성됨.

**콘텐츠 타입 3종:** `publication` (장문 기술 글), `thought` (짧은 에세이), `notebook` (학습 노트)

**URL 규칙 (RESTful):**
- 목록: 복수형 (`/publications`, `/thoughts`, `/notebooks`)
- 상세: 단수형 (`/publication/{slug}`, `/thought/{slug}`, `/notebook/{slug}`)
- `src/pages/[type]/[slug].astro` 하나로 3개 타입 상세 페이지 모두 처리 (`ROUTE_TYPE_MAP` 활용)

**이미지 로컬화:** Notion 이미지 URL은 만료되므로, 빌드 시 `public/images/{type}/{slug}/`에 다운로드 후 URL 치환. `public/images/`는 gitignore 대상.

**게시일 영속화:** `data/published-dates.json`에 slug별 최초 발견 날짜 기록. 삭제된 slug는 정리됨.

**Block → HTML 변환:** `src/lib/block-to-html.ts`에서 Notion 블록을 직접 HTML로 변환 (서드파티 없음). Heading 레벨 시프트: `heading_1` → `<h2>`, `heading_2` → `<h3>`, `heading_3` → `<h4>`, `heading_4` → `<h5>`. Callout → `<aside>`. 비-리스트 블록의 children은 `<div class="indent">`로 렌더링 (재귀, 최대 4단계).

**OG 이미지:** `functions/api/og-image.ts` — Cloudflare Pages Function으로 SVG 동적 생성.

**검색:** Pagefind 기반. 게시물 콘텐츠에 `data-pagefind-body` 속성 부여.

## Key Files

| 파일 | 역할 |
|---|---|
| `src/config.ts` | SITE, PATHS, NAV_LINKS, ROUTE_TYPE_MAP 상수 |
| `src/types.ts` | Post, Block, RichTextItem, ContentType 타입 |
| `src/lib/block-to-html.ts` | Notion 블록 → HTML 렌더러 (TDD) |
| `src/lib/posts.ts` | 게시물 로딩/필터링/정렬 유틸 |
| `src/lib/image-handler.ts` | 이미지 다운로드 + URL 치환 |
| `src/layouts/Layout.astro` | 기본 HTML 레이아웃 (SEO, OG, Pagefind, RSS) |
| `scripts/build.ts` | 빌드 오케스트레이터 |
| `scripts/fetch-notion.ts` | Notion API 페처 (350ms 딜레이로 rate limit 준수) |

## Code Style (Biome)

- 탭 들여쓰기, 줄 너비 100자
- 쌍따옴표, 세미콜론 항상 사용
- 경로 별칭: `@/*` → `src/*`
- 날짜 포맷: `yyyy.MM.dd` (`src/lib/format.ts`)

## Deployment

- Cloudflare Pages, GitHub Actions로 `main` 브랜치 push 시 자동 배포
- 환경 변수: `NOTION_API_KEY`, `NOTION_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
