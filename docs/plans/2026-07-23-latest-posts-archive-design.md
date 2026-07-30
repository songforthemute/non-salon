# 최신 글 홈 노출 및 통합 아카이브 설계

## 목표

루트 페이지(`/`)에서 카테고리와 관계없이 최신 글 5개를 보여주고, 전체 혼합 목록은 `/archive`에서 제공한다.

## 현재 구조

- `data/posts.json`을 `src/lib/posts.ts`의 `loadPosts()`로 읽는다.
- `getPostsByType()`는 카테고리별 목록 페이지에서 사용한다.
- `sortByDate()`는 `publishedDate` → `published-dates.json` → `lastEditedTime` 순서로 날짜를 결정하고 최신순 정렬한다.
- 현재 루트 페이지(`src/pages/index.astro`)는 사이트 제목과 설명만 렌더링한다.
- 현재 카테고리 목록 페이지는 각 타입별 전체 목록을 이미 제공한다.

## 결정 사항

### 홈

`loadPosts()`로 모든 글을 불러오고 기존 `sortByDate()`로 통합 정렬한 뒤 상위 5개만 노출한다. 각 항목에는 카테고리, 날짜, 제목을 표시하고 기존 단수형 상세 경로(`/{type}/{slug}`)로 연결한다.

홈에는 전체 목록으로 이동하는 `/archive` 링크를 둔다. 상단 전역 내비게이션에는 당장 추가하지 않는다.

### 아카이브

`src/pages/archive/index.astro`를 추가해 모든 카테고리의 글을 최신순으로 보여준다. 홈과 동일한 날짜 계산 및 상세 경로 규칙을 사용한다.

이번 변경에서는 페이지네이션을 추가하지 않는다. 글 수가 실제로 많아지면 `/archive/[page]` 또는 `/archive/[...page]` 기반의 정적 페이지네이션을 별도 변경으로 도입한다.

## 데이터 흐름

```text
Notion DB
  -> data/posts.json
  -> loadPosts()
  -> sortByDate(allPosts, publishedDates)
  -> slice(0, 5)       -> /
  -> full list          -> /archive
```

## 구현 범위

- 수정: `src/pages/index.astro`
- 추가: `src/pages/archive/index.astro`
- 필요 시 공통 스타일은 각 페이지의 기존 스타일 패턴을 따른다.
- 게시물 타입, 데이터 스키마, Notion fetcher, 기존 카테고리 페이지는 변경하지 않는다.

## 검증

- `pnpm test:run`
- `pnpm lint`
- `pnpm build:astro` (생성된 `data/posts.json`이 없는 환경에서는 기존 프로젝트 동작에 따라 별도 확인)

