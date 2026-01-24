# whitespace

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

```bash
# 의존성 설치
pnpm install

# 개발 서버
pnpm dev

# 빌드
pnpm build

# 테스트
pnpm test
```

## 환경 변수

`.env.example`을 `.env`로 복사 후 값 설정:

```bash
NOTION_API_KEY=secret_xxxxx
NOTION_DATABASE_ID=xxxxx
```

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
