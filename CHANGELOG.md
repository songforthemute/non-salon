# Changelog

[Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식.

## [Unreleased]

### Changed
- 본문 서체 Palatino로 변경 (크로스 플랫폼)
- 태그 스타일 간소화 (comma-separated)
- 링크 줄바꿈 개선 (`word-break: break-all`)

### Fixed
- Notion mention 타입 rich text 파싱 지원
- 빈 paragraph 렌더링 제거

### Added
- `fetch:notion` 스크립트 (Notion API v5)
- Block → HTML 변환 모듈 (TDD)
- Astro 페이지 생성 (홈, 개별 포스트)
- 빌드 스크립트 (`published-dates.json` 자동 관리)
- 이미지 로컬 다운로드 (Notion URL 만료 대응)
- RSS Feed (`/feed.xml`)
- 404 페이지
- 사이트 설정 상수화 (`src/config.ts`)
- Pagefind 검색 통합
- OG Image 동적 생성 (Cloudflare Pages Functions)
- SEO 메타 태그 (canonical, OG, Twitter Card)
- GitHub Actions 배포 워크플로우

## [0.1.0] - 2025-01-24

### Added
- Astro 5.16 + TypeScript 프로젝트 초기 세팅
- Biome 린터/포매터 설정
- Vitest 테스트 환경 구성
- 기본 레이아웃 및 홈페이지
- PRD 문서 (Node 24 + pnpm)
