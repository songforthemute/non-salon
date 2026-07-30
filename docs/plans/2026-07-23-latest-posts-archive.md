# 최신 글 홈 노출 및 통합 아카이브 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 루트 페이지에 모든 카테고리의 최신 글 5개를 노출하고, 전체 혼합 목록을 `/archive`에서 제공한다.

**Architecture:** 게시물 데이터는 기존 `loadPosts()`로 한 번에 읽고, `posts.ts`에 추가하는 작은 `getLatestPosts()` 유틸로 공통 최신순 정렬과 선택 개수를 관리한다. 홈과 아카이브의 표시 마크업과 스타일은 각 Astro 페이지에 둔다. 이번 범위에서는 페이지네이션과 전역 내비게이션 변경을 하지 않는다.

**Tech Stack:** Astro 5, TypeScript, Vitest, Biome

---

### Task 1: 최신 게시물 선택 로직 테스트 작성

**Files:**
- Create: `src/lib/posts.test.ts`
- Modify: none

**Step 1: Write the failing test**

혼합된 `publication`, `thought`, `notebook` 게시물을 준비하고 `getLatestPosts()`가 카테고리를 필터링하지 않은 채 최신순으로 정렬하며 limit을 적용하는지 검증한다.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/posts.test.ts`

Expected: FAIL because `getLatestPosts` is not exported yet.

### Task 2: 공통 최신 게시물 유틸 구현

**Files:**
- Modify: `src/lib/posts.ts`
- Test: `src/lib/posts.test.ts`

**Step 1: Write minimal implementation**

`sortByDate()`를 재사용하는 `getLatestPosts(posts, publishedDates, limit?)`를 추가한다. limit이 없으면 전체 정렬 목록을 반환하고, limit이 있으면 정렬 결과의 앞부분만 반환한다. 입력 배열은 변경하지 않는다.

**Step 2: Run test to verify it passes**

Run: `pnpm vitest run src/lib/posts.test.ts`

Expected: PASS.

### Task 3: 홈 및 아카이브 페이지 구현

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/pages/archive/index.astro`

**Step 1: Implement home page**

기존 제목과 설명 아래에 최신 게시물 5개를 표시한다. 각 항목에 타입 라벨, 날짜, 제목을 표시하고 `/${post.type}/${post.slug}`로 연결한다. 목록 아래에 `/archive` 링크를 추가한다. 게시물이 없으면 기존 목록 페이지와 동일하게 `No posts yet.`를 표시한다.

**Step 2: Implement archive page**

모든 타입의 게시물을 `getLatestPosts()`로 정렬해 표시한다. 홈과 같은 날짜/타입/상세 URL 규칙을 사용한다. 빈 목록 상태를 처리한다.

**Step 3: Match existing visual conventions**

기존 카테고리 목록 페이지의 타이포그래피, 간격, border, muted date 색상을 재사용하고, 전역 스타일을 불필요하게 변경하지 않는다.

### Task 4: 전체 검증

**Files:**
- Verify: `src/pages/index.astro`
- Verify: `src/pages/archive/index.astro`
- Verify: `src/lib/posts.ts`
- Verify: `src/lib/posts.test.ts`

**Step 1: Run focused tests**

Run: `pnpm vitest run src/lib/posts.test.ts`

Expected: PASS.

**Step 2: Run full test suite**

Run: `pnpm test:run`

Expected: all tests PASS.

**Step 3: Run lint**

Run: `pnpm lint`

Expected: Biome reports no errors.

**Step 4: Run Astro build**

Run: `pnpm build:astro`

Expected: Astro generates `/` and `/archive/` successfully. If `data/posts.json` is absent, record the repository's existing empty-data build behavior rather than changing the data pipeline.

**Step 5: Inspect the final diff**

Run: `git diff --check` and `git status --short`

Expected: no whitespace errors; only intended feature files are modified in addition to the already committed plan files.

