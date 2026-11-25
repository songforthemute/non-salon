# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`non-salon`은 pnpm workspace 기반 모노레포다. 기존 `non.salon` 정적 블로그(`apps/blog`)의 동작을 보존하면서 향후 독립적인 애플리케이션(`apps/viewer`, `apps/native`)을 추가할 수 있는 구조적 기반을 제공한다.

- **현재 활성 앱:** `apps/blog` (`@non-salon/blog`) — Notion을 CMS로 사용하는 Astro 기반 정적 블로그, Cloudflare Pages(`https://non.salon`) 배포.
- **향후 추가 예정:** `apps/viewer` (React 기반 학습/이력서 탐색 앱, `study.non.salon`), `apps/native` (Viewer를 WebView로 제공하는 React Native iOS/macOS 앱).
- **설계 원칙:** Turborepo/Nx/Lerna 등 별도 모노레포 도구 미도입, 실제 공통 코드가 생기기 전까지 `packages/` 미구성, 루트 단일 `pnpm-lock.yaml` 유지.

## Repository Layout

```text
.github/workflows/blog-ci.yml   # @non-salon/blog 전용 CI (경로 필터 적용)
apps/blog/                      # @non-salon/blog (Astro 블로그)
├── data/                       # published-dates.json (추적), posts.json (생성/gitignore)
├── fixtures/posts.json         # CI용 결정적 빌드 fixture
├── functions/api/og-image.ts   # Cloudflare Pages Function (deprecated SVG OG 호환 유지)
├── public/                     # favicon, robots, layout.css + 생성 산출물(images/, media/, og/)
├── scripts/                    # build.ts, build-ci.ts, fetch-notion.ts, generate-og-images.ts, lighthouse-summary.mjs
├── src/                        # Astro 페이지, 컴포넌트, 라이브러리, 테스트
├── .env.example                # 블로그 환경 변수 템플릿
├── .lighthouserc.cjs           # Lighthouse CI 설정
├── astro.config.mjs
├── tsconfig.json
├── vitest.config.ts
└── package.json
docs/                           # PRD 및 설계/계획 문서
biome.json                      # 워크스페이스 공통 Biome 설정
pnpm-workspace.yaml             # packages: ["apps/*"]
pnpm-lock.yaml                  # 단일 lockfile
package.json                    # private 루트 패키지 (@biomejs/biome 및 루트 스크립트)
```

## Commands

Node.js 24+ 필수. 패키지 매니저는 `pnpm@10.13.1`.

### 루트 (워크스페이스 공통 및 하위 호환)

```bash
pnpm install --frozen-lockfile  # 워크스페이스 전체 의존성 설치
pnpm lint                       # 전체 Biome check (읽기 전용)
pnpm lint:fix                   # 전체 Biome check --write (자동 수정)
pnpm format                     # 전체 Biome format --write
pnpm typecheck                  # 워크스페이스 전체 typecheck
pnpm test:run                   # 워크스페이스 전체 테스트 단일 실행
pnpm dev                        # @non-salon/blog 개발 서버 (하위 호환)
pnpm build                      # @non-salon/blog 전체 빌드 (하위 호환)
pnpm build:ci                   # @non-salon/blog Fixture 기반 CI 빌드
pnpm preview                    # @non-salon/blog 빌드 결과 미리보기
```

### `@non-salon/blog` 개별 명령 (권장)

```bash
pnpm --filter @non-salon/blog dev                 # Astro dev server (localhost:4321)
pnpm --filter @non-salon/blog build               # 전체 빌드: fetch-notion → 이미지·미디어·WebP → OG → astro build → pagefind
pnpm --filter @non-salon/blog build:ci            # Fixture 기반 결정적 빌드 (Notion API 불필요)
pnpm --filter @non-salon/blog build:astro         # Astro 빌드만 (Notion fetch/이미지 생략)
pnpm --filter @non-salon/blog preview             # 빌드 결과 미리보기
pnpm --filter @non-salon/blog fetch:notion        # Notion 데이터만 가져오기 (apps/blog/data/posts.json 생성)
pnpm --filter @non-salon/blog test                # Vitest watch 모드
pnpm --filter @non-salon/blog test:run            # Vitest 단일 실행
pnpm --filter @non-salon/blog typecheck           # TypeScript 타입 검사 (tsc --noEmit)
pnpm --filter @non-salon/blog lint                # 블로그 범위 Biome check
pnpm --filter @non-salon/blog lighthouse:summary  # apps/blog/.lighthouseci 리포트 요약 출력
```

> **작업 디렉터리 주의:** `apps/blog`의 스크립트와 라이브러리는 `process.cwd()` 기준으로 `data/`, `fixtures/`, `public/`, `.lighthouseci/`, `.env`를 해석한다. 반드시 `pnpm --filter @non-salon/blog <script>` 또는 `apps/blog` 디렉터리 내부에서 실행한다.

## Blog Architecture (`apps/blog`)

**데이터 흐름:** Notion DB → `apps/blog/scripts/fetch-notion.ts` → `apps/blog/data/posts.json` → Astro 빌드 시 `fs.readFileSync`로 읽기 → `apps/blog/dist/` 정적 HTML 생성

Astro Content Collections를 사용하지 않음. `apps/blog/data/posts.json`은 gitignore 대상이며 빌드 시 생성됨.

**콘텐츠 타입 4종:** Notion `Type`의 `Publication`, `Thought`, `Notebook`, `TIL`을 각각 `publication`, `thought`, `notebook`, `til`로 정규화한다. `Type`은 select/status 모두 지원하며 대소문자와 앞뒤 공백을 무시한다. 유효하지 않거나 비어 있는 Type은 글 제목과 값을 포함한 오류로 빌드를 중단한다. Publication으로 임의 대체하지 않는다. Type이 바뀌면 캐시된 블록도 다시 가져와 이미지·미디어 경로를 새 타입으로 생성한다.

**TIL:** Notion `Type = TIL`인 글을 Today I Learned로 분류한다. `Tags`는 주제 필터에만 쓰며 콘텐츠 분류를 바꾸지 않는다. 날짜는 `Published Date` → 영속화된 최초 발견 날짜 → 수정일 순으로 결정한다. TIL은 `/til` 및 `/til/{slug}`에만 노출되고 홈의 `Latest I Learned`에 따로 표시된다. 일반 타입 목록·아카이브·RSS·`llms.txt`와 일반 상세 경로에서는 제외한다. TIL 페이지는 `noindex`이며 사이트맵과 글별 OG 이미지 생성 대상에서도 제외한다. `/til`의 주제·날짜 필터는 클라이언트에서 처리하고 URL 쿼리(`topic`, `from`, `to`)에 보존한다. 표시 컴포넌트도 글의 Type에서 TIL 여부를 판단한다.

**URL 규칙 (RESTful):**
- 목록: 복수형 (`/publications`, `/thoughts`, `/notebooks`)
- 상세: 단수형 (`/publication/{slug}`, `/thought/{slug}`, `/notebook/{slug}`)
- 아카이브: `/archive`
- TIL: `/til`, `/til/{slug}`
- `apps/blog/src/pages/[type]/[slug].astro` 하나로 일반 3개 타입 상세 페이지 모두 처리 (`ROUTE_TYPE_MAP` 활용)

**이미지·미디어 로컬화 및 WebP 최적화:** Notion 이미지/미디어 URL은 만료되므로, 빌드 시 `apps/blog/public/images/{type}/{slug}/`, `apps/blog/public/media/{type}/{slug}/`에 다운로드 후 URL 치환 및 WebP 파생 이미지 생성. `apps/blog/public/images/`와 `apps/blog/public/media/`는 gitignore 대상.

**게시일 영속화:** `apps/blog/data/published-dates.json`에 slug별 최초 발견 날짜 기록. 삭제된 slug는 정리됨.

**Block → HTML 변환:** `apps/blog/src/lib/block-to-html.ts`에서 Notion 블록을 직접 HTML로 변환 (서드파티 없음). Heading 레벨 시프트: `heading_1` → `<h2>`, `heading_2` → `<h3>`, `heading_3` → `<h4>`, `heading_4` → `<h5>`. Callout → `<aside>`. 테이블은 헤더 설정을 반영한 시맨틱 표와 모바일 가로 스크롤로, 토글과 접히는 제목은 `<details>`로, to-do는 읽기 전용 체크박스로, bookmark/link_preview는 링크로 렌더링한다. children은 깊이 제한 없이 재귀한다. 리스트는 중첩 리스트로, quote/callout과 toggle은 컨테이너 안에, 나머지는 `<div class="indent">`로 렌더링한다. 지원하지 않는 부모 블록도 렌더링 가능한 children은 유지한다.

**OG 이미지:** 빌드 타임에 `apps/blog/scripts/generate-og-images.ts`가 `apps/blog/public/og/`에 정적 PNG 생성(gitignore 대상). `apps/blog/functions/api/og-image.ts`는 기존 캐시 링크 호환을 위해 유지 중인 Cloudflare Pages Function(deprecated SVG 동적 생성).

**검색:** Pagefind 기반. 게시물 콘텐츠에 `data-pagefind-body` 속성 부여. 빌드 마지막 단계에서 `apps/blog/dist`를 인덱싱.

## Key Files (`apps/blog`)

| 파일 | 역할 |
|---|---|
| `apps/blog/src/config.ts` | SITE, PATHS, NAV_LINKS, ROUTE_TYPE_MAP, FONT_FAMILY 상수 |
| `apps/blog/src/types.ts` | Post, Block, RichTextItem, ContentType, WebpVariant 타입 |
| `apps/blog/src/lib/block-to-html.ts` | Notion 블록 → HTML 렌더러 (TDD) |
| `apps/blog/src/lib/posts.ts` | 게시물 로딩/필터링/정렬 유틸 |
| `apps/blog/src/lib/image-handler.ts` | 이미지 다운로드, 크기 파싱, WebP 최적화 + URL 치환 |
| `apps/blog/src/lib/media-handler.ts` | Notion 호스팅 파일/미디어 로컬화 + 정리 |
| `apps/blog/src/layouts/Layout.astro` | 기본 HTML 레이아웃 (SEO, OG, Pagefind, RSS) |
| `apps/blog/scripts/build.ts` | 프로덕션 빌드 오케스트레이터 |
| `apps/blog/scripts/build-ci.ts` | Fixture 기반 결정적 CI 빌드 |
| `apps/blog/scripts/fetch-notion.ts` | Notion API 페처 (350ms 딜레이로 rate limit 준수) |
| `apps/blog/scripts/generate-og-images.ts` | 정적 PNG OG 이미지 생성기 (`@resvg/resvg-js`) |

## Code Style (Biome)

루트 `biome.json`이 워크스페이스 전체(`apps/*/src/**`, `apps/*/scripts/**`, `apps/*/*.config.*`, `*.config.*`)에 공통 적용된다.

- 탭 들여쓰기, 줄 너비 100자
- 쌍따옴표, 세미콜론 항상 사용
- 경로 별칭(`apps/blog`): `@/*` → `src/*`
- 날짜 포맷: `yyyy.MM.dd` (`apps/blog/src/lib/format.ts`)

## Environment Variables

- 로컬 환경 변수는 각 앱 디렉터리에 둔다 (`apps/blog/.env`, 템플릿: `apps/blog/.env.example`).
- 필수 블로그 변수: `NOTION_API_KEY`, `NOTION_DATABASE_ID`.
- `.env`, `.env.local`, `.env.*.local`은 루트 `.gitignore`로 전체 depth에서 추적 제외된다.

## CI/CD & Deployment

- **CI:** `.github/workflows/blog-ci.yml` — `main` 대상 PR에서 `apps/blog/**` 또는 루트 워크스페이스/공통 설정이 변경될 때 실행 (`Typecheck`, `Lighthouse`, `Lighthouse PR summary`).
- **CD:** 저장소 내 별도 GitHub Actions 배포 워크플로는 없으며 Cloudflare Pages 프로젝트 설정으로 배포한다.
  - `@non-salon/blog` (`non.salon`): Root directory `apps/blog`, Build command `pnpm build`, Build output directory `dist` (Pages Functions `apps/blog/functions/` 자동 인식).
  - 향후 `@non-salon/viewer` (`study.non.salon`): 별도의 Cloudflare Pages 프로젝트로 분리 구성.

## Adding New Applications

- 새 앱은 `apps/<name>` 아래에 생성하고 패키지명은 `@non-salon/<name>`을 사용한다.
- 의존성은 해당 앱의 `package.json`에 선언하고 루트 `pnpm-lock.yaml`을 단일 진실 원천으로 유지한다.
- CI는 `.github/workflows/<name>-ci.yml`로 분리하여 변경된 앱만 검증한다.
- 공통 유틸/UI가 실제로 둘 이상의 앱에서 중복되기 전까지 `packages/`를 만들지 않는다.
