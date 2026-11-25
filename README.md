# non-salon

`non.salon`의 웹/네이티브 애플리케이션을 하나의 저장소에서 독립적으로 관리하기 위한 pnpm workspace 기반 모노레포.

## 모노레포 전환 목적

기존 `non.salon` 정적 블로그(`apps/blog`)의 동작과 배포 구조를 보존하면서, 향후 독립적인 애플리케이션을 일관된 규칙 아래 추가·관리할 수 있는 기반을 마련하기 위해 pnpm workspace 모노레포로 구성했다.

- 별도의 모노레포 오케스트레이션 도구(Turborepo, Nx, Lerna 등)를 도입하지 않고 pnpm workspace만 사용한다.
- 루트에서 단일 `pnpm-lock.yaml`과 공통 포맷/린트 설정(`biome.json`)을 관리한다.
- 실제 공통 코드가 생기기 전까지 `packages/` 디렉터리를 선제적으로 추출하지 않는다.

## 디렉터리 구조

```text
non-salon/
├── .github/
│   └── workflows/
│       └── blog-ci.yml         # @non-salon/blog 전용 CI (향후 viewer-ci.yml, native-ci.yml 추가 예정)
├── apps/
│   └── blog/                   # @non-salon/blog — Astro + Notion CMS 정적 블로그 (https://non.salon)
│       ├── data/               # published-dates.json 및 빌드 시 생성되는 posts.json
│       ├── fixtures/           # CI용 결정적 빌드 fixture
│       ├── functions/          # Cloudflare Pages Functions (api/og-image.ts)
│       ├── public/             # 정적 에셋 및 빌드 시 생성되는 images/, media/, og/
│       ├── scripts/            # Notion fetch, 빌드, OG 생성, Lighthouse 요약 스크립트
│       ├── src/                # Astro 페이지, 컴포넌트, 라이브러리, 테스트
│       ├── .env.example
│       ├── .lighthouserc.cjs
│       ├── astro.config.mjs
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── package.json
├── docs/                       # PRD 및 설계/계획 문서
├── biome.json                  # 워크스페이스 공통 Biome 설정
├── pnpm-workspace.yaml         # pnpm workspace 정의 (apps/*)
├── pnpm-lock.yaml              # 단일 워크스페이스 lockfile
├── package.json                # 루트 private 패키지
├── README.md
└── CLAUDE.md
```

## 애플리케이션별 책임

| 패키지 | 경로 | 상태 | 책임 및 배포 대상 |
|--------|------|------|-------------------|
| `@non-salon/blog` | `apps/blog` | 운영 중 | Notion을 CMS로 사용하는 Astro 기반 정적 블로그 (`https://non.salon`, Cloudflare Pages) |
| `@non-salon/viewer` | `apps/viewer` | 예정 | CS 지식·기술 면접·이력서·학습 자료 탐색용 React 앱 (`study.non.salon`, 별도 Cloudflare Pages 프로젝트) |
| `@non-salon/native` | `apps/native` | 예정 | Viewer를 WebView로 제공하는 React Native 기반 iOS/macOS 앱 |

### `@non-salon/blog` 기술 스택

| 항목 | 선택 |
|------|------|
| SSG | Astro |
| CMS | Notion API |
| 호스팅 | Cloudflare Pages |
| 검색 | Pagefind |
| 이미지 최적화 | Sharp (WebP), Resvg (정적 OG PNG) |
| 린트/포맷 | Biome |
| 테스트 | Vitest |

## 시작하기

### 요구 사항

- Node.js 24+
- pnpm 10.13.1 (`packageManager` 필드 기준)

### 설치

```bash
# 저장소 클론
git clone https://github.com/songforthemute/non-salon.git
cd non-salon

# 루트에서 워크스페이스 의존성 설치
pnpm install --frozen-lockfile

# 블로그 환경 변수 설정
cp apps/blog/.env.example apps/blog/.env
# apps/blog/.env 파일에 NOTION_API_KEY, NOTION_DATABASE_ID 입력
```

### 로컬 개발 (`@non-salon/blog`)

```bash
# Notion에서 데이터 가져오기
pnpm --filter @non-salon/blog fetch:notion

# 개발 서버 실행 (http://localhost:4321)
pnpm --filter @non-salon/blog dev
```

### 빌드 및 테스트 (`@non-salon/blog`)

```bash
# 전체 프로덕션 빌드 (Notion fetch → 이미지/미디어 로컬화·WebP → OG 이미지 → Astro 빌드 → Pagefind 인덱싱)
pnpm --filter @non-salon/blog build

# Fixture 기반 결정적 CI 빌드 (Notion API 없이 검증 가능)
pnpm --filter @non-salon/blog build:ci

# 빌드 결과 미리보기
pnpm --filter @non-salon/blog preview

# 타입 검사 / 테스트 / 린트
pnpm --filter @non-salon/blog typecheck
pnpm --filter @non-salon/blog test:run
pnpm --filter @non-salon/blog lint
```

## 스크립트

### 루트 스크립트 (`package.json`)

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | `@non-salon/blog` 개발 서버 (하위 호환) |
| `pnpm build` | `@non-salon/blog` 전체 빌드 (하위 호환) |
| `pnpm build:ci` | `@non-salon/blog` Fixture 기반 CI 빌드 |
| `pnpm preview` | `@non-salon/blog` 빌드 결과 미리보기 |
| `pnpm test:run` | 워크스페이스 전체 테스트 실행 (`pnpm -r --if-present test:run`) |
| `pnpm typecheck` | 워크스페이스 전체 타입 검사 (`pnpm -r --if-present typecheck`) |
| `pnpm lint` | 워크스페이스 전체 Biome 검사 |
| `pnpm lint:fix` | 워크스페이스 전체 Biome 자동 수정 |
| `pnpm format` | 워크스페이스 전체 Biome 포맷팅 |

### 블로그 스크립트 (`pnpm --filter @non-salon/blog <script>`)

| 명령어 | 설명 |
|--------|------|
| `dev` | Astro 개발 서버 (`localhost:4321`) |
| `build` | 전체 빌드 (`fetch:notion` → 이미지·미디어·WebP → OG → Astro → Pagefind) |
| `build:ci` | Fixture 기반 결정적 빌드 (OG → Astro → Pagefind) |
| `build:astro` | Astro 정적 빌드만 실행 |
| `preview` | 빌드 결과 미리보기 |
| `fetch:notion` | Notion 데이터만 가져오기 (`apps/blog/data/posts.json` 생성) |
| `lighthouse:summary` | `.lighthouseci` 리포트를 Markdown 요약으로 출력 |
| `test` / `test:run` | Vitest 실행 (watch / 단일 실행) |
| `typecheck` | TypeScript 타입 검사 (`tsc --noEmit`) |
| `lint` / `lint:fix` / `format` | 블로그 패키지 범위 Biome 검사·수정·포맷 |

## 환경 변수 관리

환경 변수는 루트에 통합하지 않고 각 애플리케이션 디렉터리에서 독립적으로 관리한다.

- 블로그 템플릿: `apps/blog/.env.example`
- 로컬 환경 변수 파일: `apps/blog/.env` (`.gitignore`로 추적 제외)
- 패키지 스크립트(`pnpm --filter @non-salon/blog ...`)는 `apps/blog`를 작업 디렉터리로 실행되므로 `dotenv/config`가 `apps/blog/.env`를 자동으로 읽는다.

| 변수 | 적용 앱 | 설명 |
|------|---------|------|
| `NOTION_API_KEY` | `@non-salon/blog` | Notion Integration 토큰 (`secret_xxx` 형식) |
| `NOTION_DATABASE_ID` | `@non-salon/blog` | Notion DB ID (32자리 hex) |

## CI/CD

### CI (`.github/workflows/blog-ci.yml`)

`main` 대상 PR에서 `apps/blog/**` 또는 루트 워크스페이스/도구 설정(`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `biome.json`, `.github/workflows/blog-ci.yml`)이 변경될 때 실행된다.

- **Typecheck**: `pnpm --filter @non-salon/blog typecheck`
- **Lighthouse**: `test:run` → Fixture 기반 `build:ci` → `apps/blog`에서 `lhci autorun` → 리포트 Artifact 업로드 (`apps/blog/.lighthouseci`)
- **Lighthouse PR summary**: PR 코멘트에 측정 요약 작성/갱신

### CD (Cloudflare Pages)

저장소에는 별도의 GitHub Actions 배포 워크플로가 없으며, Cloudflare Pages 프로젝트 설정으로 배포를 관리한다.

- **Blog (`non.salon`)**: Root directory `apps/blog`, Build command `pnpm build`, Build output directory `dist` (Pages Functions는 `apps/blog/functions/`에서 자동 인식)
- **Viewer (`study.non.salon`, 예정)**: 별도의 Cloudflare Pages 프로젝트로 분리하여 독립 배포

## 향후 애플리케이션 추가 원칙

1. `apps/<app-name>` 디렉터리 아래에 독립 패키지로 구성하고 패키지명은 `@non-salon/<app-name>` 규칙을 따른다.
2. 의존성은 루트 단일 `pnpm-lock.yaml`로 관리하며, 앱 전용 의존성은 해당 앱의 `package.json`에 선언한다.
3. CI 워크플로는 `.github/workflows/<app-name>-ci.yml`로 분리하고 변경 감지 경로(`paths`)를 앱 범위와 공통 루트 설정으로 한정한다.
4. 배포 대상(예: Cloudflare Pages 프로젝트)과 환경 변수는 앱별로 완전히 분리한다.
5. 둘 이상의 앱에서 실제로 재사용해야 하는 코드가 검증되기 전까지 `packages/` 디렉터리를 만들지 않는다.

## 라이선스

MIT
