# 💕 소개팅 매칭 서비스 (blinddate_formyhomies)

지인들을 위해 주선자가 직접 관리하는 신뢰할 수 있는 소개팅 매칭 웹 서비스입니다.

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v3 |
| Backend/DB/Auth | Supabase |
| Form | React Hook Form + Zod |
| Routing | React Router (HashRouter) |
| Hosting | GitHub Pages |

## 서비스 구조

```
일반 사용자 ─→ /apply ────→ 프로필 등록 (pending)
                                    ↓
주선자 ──→ /manager/login ─→ /manager/dashboard
                                    ↓
                              승인 / 반려 처리
```

## 개발 환경 설정

### 1. 저장소 클론 & 의존성 설치

```bash
git clone <repo-url>
cd <repo-dir>
npm install
```

### 2. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 접속 → 새 프로젝트 생성
2. Project Settings → API 에서 다음 값 확인:
   - `Project URL`
   - `anon public` key

### 3. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일 편집:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
```

> ⚠️ `.env` 파일은 절대 커밋하지 마세요. `.gitignore`에 포함되어 있습니다.

### 4. DB 마이그레이션 실행

Supabase Dashboard → SQL Editor 에서 다음 파일을 순서대로 실행:

```
1. supabase/migrations/001_init.sql   ← 테이블 생성
2. supabase/migrations/002_rls.sql    ← RLS 정책 설정
```

### 5. RLS 설정 확인

Supabase Dashboard → Table Editor → 각 테이블에서 Row Level Security가 `Enabled` 상태인지 확인.

### 6. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

## 주선자 등록 방법

### 방법 1: 개발 환경 `/dev` 페이지 사용

`npm run dev` 실행 후 `http://localhost:5173/#/dev` 접속

> ⚠️ 개발 환경(`import.meta.env.DEV`)에서만 동작. Production 빌드에서는 비활성화됩니다.

### 방법 2: Node.js 스크립트 사용 (Production 권장)

**scripts/.env 파일 생성** (절대 커밋 금지):

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
```

Service Role Key는 Supabase Dashboard → Settings → API → `service_role` key

**스크립트 의존성 설치:**

```bash
npm install dotenv @supabase/supabase-js --prefix scripts
```

**주선자 생성 실행:**

```bash
node scripts/create-coordinator.js \
  --name "홍길동" \
  --email "hong@example.com" \
  --password "securepassword123"
```

## GitHub Pages 배포

### 1. GitHub Repository 설정

1. GitHub Repository → Settings → Pages
2. Source: **GitHub Actions** 선택

### 2. GitHub Secrets 설정

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret 이름 | 값 |
|-------------|-----|
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |

### 3. 배포

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드 & 배포합니다.

```bash
git add .
git commit -m "feat: initial deployment"
git push origin main
```

배포 URL: `https://<username>.github.io/<repo-name>/`

## 로컬 빌드 확인

```bash
npm run build   # dist/ 폴더 생성 확인
npm run preview # 로컬에서 빌드 결과 미리보기
```

## URL 구조

| URL | 설명 |
|-----|------|
| `/#/` | 서비스 소개 랜딩 페이지 |
| `/#/apply` | 소개팅 매물 등록 (공개, 로그인 불필요) |
| `/#/manager/login` | 주선자 로그인 |
| `/#/manager/dashboard` | 주선자 대시보드 (로그인 필요) |
| `/#/dev` | 개발용 관리자 기능 (dev 빌드만) |

> HashRouter를 사용하므로 URL 앞에 `#`이 붙습니다.

## DB 구조

### coordinators

| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| auth_user_id | uuid | Supabase Auth 사용자 ID |
| name | text | 주선자 이름 |
| email | text | 이메일 (unique) |
| active | boolean | 활성 여부 |
| created_at | timestamptz | 생성일 |

### dating_profiles

| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| coordinator_id | uuid | FK → coordinators |
| nickname / gender / age / company / height_cm / mbti | 기본 정보 | |
| preferred_* | text[], integer, boolean | 선호 이성 조건 |
| self_* | text[] | 본인 정보 |
| status | text | pending / approved / rejected |
| rejection_reason | text | 반려 사유 |

## 보안 원칙

- ✅ Supabase Anon Key만 프론트엔드에 노출 (`.env`)
- ✅ Service Role Key는 로컬 스크립트에서만 사용
- ✅ RLS로 주선자별 데이터 격리
- ✅ Production에서 주선자 자가 회원가입 불가
- ✅ 비밀번호는 Supabase Auth가 관리 (직접 저장 없음)
