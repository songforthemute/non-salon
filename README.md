# non.salon

Notion 기반 미니멀 정적 블로그.

## 기술 스택

| 항목 | 선택 |
|------|------|
| SSG | Astro |
| CMS | Notion API |
| 호스팅 | Cloudflare Pages |
| 검색 | Pagefind |
| 린트/포맷 | Biome |
| 테스트 | Vitest |

## 시작하기

### 요구 사항

- Node.js 24+
- pnpm

### 설치

```bash
# 저장소 클론
git clone https://github.com/songforthemute/whitespace.git
cd whitespace

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env
# .env 파일에 NOTION_API_KEY, NOTION_DATABASE_ID 입력
```

### 로컬 개발

```bash
# Notion에서 데이터 가져오기
pnpm fetch:notion

# 개발 서버 실행
pnpm dev
# → http://localhost:4321
```

### 프로덕션 빌드

```bash
# 전체 빌드 (Notion fetch → 이미지 다운로드 → Astro 빌드 → Pagefind 인덱싱)
pnpm build

# 빌드 결과 미리보기
pnpm preview
```

## 환경 변수

| 변수 | 설명 |
|------|------|
| `NOTION_API_KEY` | Notion Integration 토큰 (`secret_xxx` 형식) |
| `NOTION_DATABASE_ID` | Notion DB ID (32자리 hex) |

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 (localhost:4321) |
| `pnpm build` | 전체 빌드 (Notion fetch → 이미지 → Astro → Pagefind) |
| `pnpm build:astro` | Astro 빌드만 |
| `pnpm preview` | 빌드 결과 미리보기 |
| `pnpm fetch:notion` | Notion 데이터 가져오기 |
| `pnpm test` | 테스트 실행 (watch) |
| `pnpm test:run` | 테스트 실행 (once) |
| `pnpm lint` | 린트 검사 |
| `pnpm lint:fix` | 린트 자동 수정 |

## 배포

GitHub Actions로 자동 배포. 다음 secrets 필요:

- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 라이선스

MIT
