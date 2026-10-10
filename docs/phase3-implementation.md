# PHASE 3: 인증·소유권·DB 기반

## 범위

이메일/비밀번호 Supabase Auth, 소유권과 wallet 기반, 보호된 등록/심사/Like RPC를 구현했다.
Match·사진·결제 테이블은 후속 기능을 위한 비공개 기반이다. 탐색 UI, 사진 업로드/다운로드,
Match/Sorry API, 카카오 ID 공개 API, 결제 승인/지급 API와 worker는 후속 Phase에서 구현한다.
이번 변경으로 라이브 migration, Auth 설정, Secret, 외부 결제·메시지를 실행하지 않았다.

## 읽기 전용 점검 결과 (2026-10-03)

- MCP 연결 DB: `public.coordinators`, `public.dating_profiles`만 존재. RLS 활성화.
- migration 목록: 비어 있음. 003의 private 연락처·Like·알림 테이블과 RPC 없음.
- 기본 RLS: 활성 주선자 전체 컬럼 공개, 담당 프로필 SELECT/UPDATE, anon pending INSERT.
- 프론트엔드 환경의 공개 `/auth/v1/settings` 응답:
  - `external.email=false`
  - `disable_signup=false`
  - `mailer_autoconfirm=false`
  - `external.anonymous_users=false`
- MCP 대상과 프론트엔드 환경의 프로젝트 일치는 배포 전 Dashboard에서 확인해야 한다.
- 프로필·연락처·Auth 사용자 행을 조회하지 않았다.

재점검: `supabase/inspection/phase3_preflight.sql`은 카탈로그 SELECT만 포함한다.
`node scripts/inspect-auth-settings.mjs`는 공개 Auth 설정의 boolean만 출력한다.

## 인증

- `/#/signup`: 이메일, 비밀번호(8자 이상), 비밀번호 확인.
- `/#/login`: 이메일, 비밀번호.
- Supabase `auth.signUp`, `auth.signInWithPassword`, 기본 session만 사용한다.
- OTP 로그인, 자체 비밀번호 테이블/해싱, 비밀번호 로그/브라우저 저장은 없다.
- 비밀번호 확인 값은 서버에 보내지 않는다. 제출 완료 시 비밀번호 입력을 지운다.
- 가입 후 session이 있으면 `/apply`로 이동한다. session이 없으면 이메일 확인이
  필요한 설정일 수 있음을 안내하고 로그인 권한을 만들어 주지 않는다.
- `useSession`은 화면 상태만 제공한다. DB의 `require_member`가 실제 계정 존재,
  익명 여부, 삭제/정지 상태를 검증하고 `profile_owners`로 소유권을 판정한다.
- MVP는 `email_confirmed_at`을 별도 권한 조건으로 쓰지 않는다. Confirm email을
  끄면 해당 값이 있어도 실제 이메일 소유 증거로 취급할 수 없다.
- 미확인 이메일로 기존 프로필이나 주선자 계정을 연결하지 않는다. 이메일 주소를
  선점하거나 다른 사람의 이메일로 가입할 수 있다는 위험은 MVP 정책에 남는다.
- 향후 Confirm email 활성화와 기존 계정 재확인 정책은 별도 작업이다.
  Auth 설정을 다시 켠다고 기존 자동 확인 계정의 이메일 소유가 검증되지는 않는다.
- 비밀번호 재설정은 추후 Supabase `resetPasswordForEmail`/`updateUser`로 추가한다.
  SMTP, callback 경로와 HashRouter 처리가 필요하며 이번에는 발송·구현하지 않았다.

## DB와 API

새 migration: `20261003140239_phase3_ownership_security.sql`. 기존 001~003은 수정하지 않았다.
003 기반 테이블이 없으면 선행 조건 오류를 내고 전체 transaction을 중단한다.

| 구조 | 역할 |
|---|---|
| private.profile_owners | profile PK, user UNIQUE, 계정당 하나, 이전 금지, 활성 상태 |
| private.like_wallets | 계정별 0부터 시작, 음수 금지 |
| private.like_transactions | append-only 원장, Like -1 / 구매 +10 참조 UNIQUE |
| private.payments | likes_10/1500원/10개 고정, 소유권 FK, 요청/TID 중복 방지 |
| public.matches | 정렬된 두 프로필 UNIQUE, mutual/final/closed |
| private.match_decisions | 참여자만 등록, pending 이후 수정 금지 |
| private.profile_photos | 경로 비공개, 프로필별 최대 5개 자리, 상태 |
| private.admin_members / admin_audit_logs | 일반 주선자와 별도 운영 권한·연결 감사 기록 |
| private.profile_contacts.kakao_id | nullable 비공개 컬럼, 후속 단계에서 입력/공개 연결 |
| private.notification_logs | 기존 Like 이벤트 유지, Mutual/Final 이벤트 기반 확장 |

### RPC

| RPC | 호출 권한 / 동작 |
|---|---|
| list_active_coordinators | anon/authenticated, id/name만 |
| is_current_account_active | authenticated, 현재 계정 존재/정지/익명 확인, RLS에서도 사용 |
| get_my_profile_id | authenticated, 본인의 활성 소유권만, 미등록 null |
| submit_dating_profile | authenticated, 본인 UID에서 생성, 프로필/연락처/소유권/wallet 원자적 등록 |
| review_dating_profile | 담당 주선자만, 승인/반려만, 심사자와 시각은 서버 결정 |
| get_my_like_balance | 소유권 있는 사용자만, 본인 wallet |
| send_like | 본인 소유권, 승인/다른 성별/대상 활성 확인 후 차감/Like/원장/알림/Mutual |
| link_reviewed_legacy_profile | 운영 관리자만, 별도 본인 확인 완료한 기존 프로필을 UID에 연결 |

등록 RPC는 기존 인자와 연락처 저장 구현을 재사용하되 내부 함수로 옮겼다.
이전 public anon 진입점은 남지 않는다. 공개 함수는 의도적으로 좁은 SECURITY DEFINER
API이며 빈 search_path, 완전한 스키마 명칭, 본문 권한 검사, 명시적인 EXECUTE grant를 갖는다.
private 구현은 브라우저 역할에 schema/table/function 권한을 주지 않는다.

### RLS와 동시성

- 신규 private 테이블과 public.matches에 RLS, 브라우저 테이블 접근 거부.
- public.likes 직접 INSERT/SELECT 금지. 일반 사용자 프로필 원본 SELECT도 계속 금지.
- 주선자는 자신의 계정과 담당 프로필만 조회. direct profile UPDATE는 금지.
- 등록은 auth.users의 본인 행 잠금 + user UNIQUE로 중복 등록 방지.
- Like는 정규화한 쌍 advisory transaction lock → 프로필/소유권 ID 순 잠금 →
  wallet 조건부 UPDATE 순서. 역방향 Like는 쌍 잠금 후 별도 쿼리에서 확인한다.
- 같은 방향 재요청은 기존 Like ID를 반환하므로 잔액 0에서도 재차감하지 않는다.
- Like·차감·원장·알림 작업·Mutual은 단일 transaction. 외부 네트워크 호출 없음.
- 기존 Like ID/type UNIQUE를 유지하므로 003의 claim/finish RPC와 호환된다.
- Mutual/Final 알림은 아직 worker가 처리하지 않는다. PHASE 7에서 이벤트 worker와 복구를 추가한다.
- 현재 지급 API는 없다. PHASE 9의 공급자 검증 서버를 구현하기 전에는 충전 경로를 열지 않는다.
- 사진 경로/상대 카카오 ID/타인 결제/상대 결정의 조회 API도 아직 없다. 접근은 기본 거부다.
- private bucket 생성과 사진 API는 PHASE 5 작업이다. 이번에는 public bucket도 만들지 않았다.

## 기존 DB 이력 불일치 처리 — 자동 실행 금지

현재 DB에 `db push --include-all` 또는 001~003 일괄 실행을 하지 않는다.

1. 배포 대상 프로젝트와 백업을 확인한다.
2. preflight로 001/002와 실제 컬럼·제약·인덱스·정책·함수·트리거 정의를 대조한다.
3. 실제로 같은 항목만 migration baseline으로 인정한다. 차이가 있으면 먼저 별도 보정안을 검토한다.
4. 001/002의 이력 보정은 스키마 적용과 다르다. 실제 일치 확인과 별도 승인 후에만 수행한다.
5. 003이 없는 프로젝트에는 검토된 003을 한 번 적용한 다음 새 migration을 적용한다.
   이미 003이 있는 프로젝트에서는 003을 다시 실행하지 않는다.
6. Edge Function과 새 프론트 배포 순서를 조정한다. 기존 공개 등록 동작이 바뀌므로
   maintenance 창에서 DB와 프론트를 함께 전환하는 방식을 권장한다.
7. 확인되지 않은 기존 프로필은 소유권 없이 유지한다. 데이터 삭제나 자동 이메일 매칭은 하지 않는다.

CLI의 이력 보정·push 명령은 해당 버전의 `--help` 확인 후 운영자가 별도 승인 범위에서 실행한다.
이 문서는 원격 실행 승인이 아니다.

## 운영자가 다음에 할 일

### TODO_EXTERNAL_SETUP: Auth

Supabase Dashboard의 Authentication 설정에서 의도한 프로젝트를 확인한다.

1. Email provider 활성화.
2. 신규 가입 허용 확인.
3. MVP 정책대로 Confirm email OFF.
4. 비밀번호 최소 길이 8 이상, 요청 제한 확인. 익명 로그인은 OFF 유지.
5. 주선자 기존 로그인 회귀 확인.

`supabase/config.toml`의 Auth 값은 로컬 설정이며 hosted 설정을 변경하지 않는다.
운영 설정은 이 작업에서 변경하지 않았다. 비밀번호 정책은 서버 Auth에서도 설정해야 한다.

### TODO_EXTERNAL_SETUP: DB / 운영 권한

- 별도 테스트 Supabase 프로젝트 선정과 적용 승인.
- migration 이력 정리와 migration 적용 승인.
- 운영 관리자는 신뢰할 수 있는 UID로 서버에서 지정. 일반 주선자를 자동 승격하지 않는다.
- 기존 프로필 연결은 담당 주선자의 본인 확인 후 운영 관리자가 실행하고 감사 기록을 남긴다.
- 미확인 전화번호로 실제 알림을 시작하지 않는다. 전화번호 확인·동의와 worker 설정은 PHASE 7에서 다룬다.
- 실제 충전·결제·알림·Secret 설정은 이번에 필요하지 않으며 후속 별도 승인 대상이다.

## 검증

실행 결과: DB 11개 통과, Chromium E2E 17개 통과, build 통과, lint 오류 0개.
기존 lint 경고 3개(Toast/ApplyPage/ManagerDashboardPage)와 번들 크기 경고는 남아 있다.
`git diff --check`도 통과했다.

`npm audit`는 Tailwind 3의 braces/chokidar/micromatch/fast-glob 의존성 경로에서
high 5개를 보고했다. 신규 PGlite 항목은 없었다. 자동 수정 제안에는 Tailwind major 변경이
포함되므로 이번 DB/인증 작업에서 자동 업그레이드하지 않았다. 배포 전 별도 검토 대상이다.

```
npm.cmd run test:db
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e
```

DB 테스트는 PGlite 메모리 PostgreSQL에 001→002→003→신규 migration을 실행한다.
003 누락 시 안전 중단, 소유권, private 권한, 주선자 범위, 잔액 차감·중복 요청,
Mutual 단일 생성, 알림 실패 시 rollback, 관리자 연결, 제약조건을 검사한다.
Auth 스키마/claim 함수는 테스트용 최소 모형이다. 실제 GoTrue·PostgREST·Storage 검증은 아니다.
PGlite는 단일 연결이므로 동시 여러 DB 세션 경쟁은 검증하지 못한다.

Playwright는 공통 fixture에서 미모킹 Supabase Auth/REST/Storage/Functions 요청을 차단한다.
가입·로그인은 mock 응답이며 실제 계정·프로필·메시지·결제를 만들지 않는다.

### 배포 전 남은 검증

- 승인된 테스트 Supabase에서 실제 email/password session 및 RLS/API 통합 확인.
- 서로 다른 DB 연결의 A→B/B→A 동시 Like, 잔액 1에서 A→B/A→C, 중복 가입 요청.
- 운영 기본 권한·Data API exposed schemas·security advisor 확인.
- 사진/Final/결제 공개 API는 후속 Phase 구현 후 추가 검증.

## 근거 문서

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://pglite.dev/docs/

## 이번 작업의 변경 파일

기존 작업에서 이미 수정되어 있던 다른 파일은 유지했다.

신규:
- `supabase/migrations/20261003140239_phase3_ownership_security.sql`
- `supabase/inspection/phase3_preflight.sql`
- `src/hooks/useSession.ts`
- `src/pages/UserAuthPage.tsx`
- `src/services/authService.ts`
- `scripts/inspect-auth-settings.mjs`
- `tests/db/phase3.test.mjs`
- `tests/e2e/fixtures.ts`
- `tests/e2e/member-auth.spec.ts`
- `docs/phase3-implementation.md`

수정:
- `.gitignore` — Supabase CLI 로컬 cache 제외
- `package.json`, `package-lock.json` — PGlite 개발 의존성 고정, test:db 명령
- `supabase/config.toml` — 로컬 email/password Auth 설정
- `src/App.tsx` — 회원가입/로그인 경로
- `src/hooks/useAuth.ts` — session과 주선자 조회 분리, Auth 콜백 안 비동기 조회 제거
- `src/pages/ApplyPage.tsx` — 로그인 안내·등록 전 session 확인·로그아웃
- `src/pages/ManagerDashboardPage.tsx` — 심사 RPC 연결
- `src/services/coordinatorService.ts` — 공개 주선자 목록 RPC
- `src/services/profileService.ts` — 심사 RPC·등록 오류 안내
- `tests/e2e/routes.spec.ts`, `tests/e2e/user-flows.spec.ts` — 공통 네트워크 차단 fixture·RPC mock
