# PHASE 3.5 — Supabase 통합 준비 및 A~J 보고

작성일: 2026-10-04 (KST). **읽기 전용 조사·적용 계획 완료. 실제 적용 및 통합 테스트 실행은 하지 않았다.**

2026-10-03 23:20~23:21 KST의 중단된 세션에서 프로젝트 대조, migration 목록,
카탈로그 점검 결과를 복원했다. 해당 조사를 반복하지 않고 누락된 메타데이터만 추가 점검했다.
기존 DB 11개·E2E 17개·build·lint 검증도 다시 실행하지 않았다.
그 결과는 PHASE 3의 로컬 검증이며 실제 Supabase 통합 통과를 뜻하지 않는다.

근거: [복원한 카탈로그 스냅샷](phase3-5-schema-snapshot.json),
[기존 preflight](../supabase/inspection/phase3_preflight.sql),
[이번 보충 점검 SQL](../supabase/inspection/phase3_5_supplemental.sql).
스냅샷에는 객체 정의·권한만 있고 프로필·연락처·Auth 사용자 행이나 그 집계는 없다.
적용 직전에는 운영 중 변경 가능성을 고려해 대상과 preflight를 다시 확인한다.

## A. 프론트엔드가 연결된 Supabase 프로젝트

- 로컬 Vite development / production의 유효 환경변수에서 확인한 URL:
  `https://icwptulzrxvasfwzuasl.supabase.co`
- 프로젝트 ref: `icwptulzrxvasfwzuasl`.
- `loadEnv`와 실행 환경의 URL 우선순위를 고려한 기존 점검 결과다. API key 값은 출력하지 않았다.
- `src/lib/supabase.ts`는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 사용한다.
- 별도 호스팅에 이미 올라간 번들의 환경변수까지 확인한 것은 아니다.

## B. MCP가 연결된 Supabase 프로젝트

- 기존 Codex MCP 설정의 `project_ref`: `icwptulzrxvasfwzuasl`.
- `read_only=true`; SQL 연결 역할은 `supabase_read_only_user`.
- DB는 PostgreSQL `17.11`, database 이름은 `postgres`.
- SQL의 `supabase.project_ref`와 `app.settings.api_external_url`은 NULL이었다.
  따라서 DB 이름이나 이 설정값으로 프로젝트를 식별하지 않았다.

## C. 두 프로젝트가 같은지 여부

**로컬 Vite 설정과 프로젝트 범위가 지정된 MCP 설정의 ref는 같다.**
DB 내부 ref 조회로 별도 교차 증명한 것은 아니며, 원격 배포 환경도 별도 확인 대상이다.
테스트 프로젝트를 새로 선정하면 Vite 환경과 테스트 실행 대상 모두 그 ref로 일치시켜야 한다.

## D. 현재 실제 DB 상태

아래 기본 구조는 복원한 10월 3일 점검 시점 기준이다.

| 구분 | 확인 결과 |
|---|---|
| 애플리케이션 테이블 | `public.coordinators`, `public.dating_profiles`만 존재 |
| 컬럼 | 각각 6개, 30개. 타입·NULL·기본값이 001과 일치 |
| 제약조건 | PK, email UNIQUE, Auth/주선자 FK와 삭제 동작, 성별·양수·상태 CHECK가 001과 일치. 모두 validated |
| 인덱스 | 두 PK와 `coordinators_email_key`만 존재 |
| RLS | 두 테이블 모두 ON; 002의 정책 4개와 일치 |
| 함수/트리거 | 앱 함수는 `handle_updated_at()`만 존재. 본문과 `set_updated_at` BEFORE UPDATE 트리거가 001과 일치 |
| private schema | 없음 |
| 003 / PHASE 3 RPC | 없음 |
| migration 이력 | MCP 목록 `[]`; `supabase_migrations.schema_migrations` 자체가 없음 |
| Auth 의존 컬럼 | `id`, `email`, `is_anonymous`, `deleted_at`, `banned_until` 존재, 기대 타입과 일치 |
| 확장 | pgcrypto 1.3, uuid-ossp 1.1, plpgsql, pg_stat_statements, supabase_vault |

10월 4일 보충 점검 결과:

- 두 테이블 COMMENT도 001과 일치한다.
- public/private의 독립 타입 이름 충돌과 별도 컬럼 ACL은 없다.
- `auth.uid()`는 인자 없이 UUID를 반환한다.
- `postgres`의 public CREATE, database CREATE, auth.users SELECT 권한을 확인했다.
  실제 migration 실행 역할의 모든 권한을 검증한 것은 아니다. read-only MCP는 적용 수단이 아니다.
- DDL event trigger에는 PostgREST 캐시 감시와 확장 권한 관련 항목들이 존재한다.
  새 테이블 자동 공개 여부를 가정하지 말고 적용 후 실제 API 권한을 검사해야 한다.

기존 권한상 활성 주선자 SELECT는 이름·ID 외 컬럼도 허용하고, 담당 프로필 UPDATE도
심사 컬럼만으로 제한하지 않는다. PHASE 3의 전용 RPC·권한 회수가 이를 변경한다.
기존 프로필의 실제 값, 사용자 수, 이메일, 전화번호는 조사하지 않았다.

## E. migration 001/002/003 상태

| 파일 | 객체 상태 | 이력 상태 | 처리안 |
|---|---|---|---|
| `001_init.sql` | 정의와 같은 테이블·컬럼·제약·트리거·주석 존재 | 미기록 | 기존 객체를 baseline으로 인정한 뒤 이력만 복구 |
| `002_rls.sql` | RLS ON 및 정책 4개 정의 일치 | 미기록 | 이력만 복구 |
| `003_like_notifications.sql` | schema·테이블·RPC 없음 | 미기록 | 승인 후 실제 적용 |
| `20261003140239_phase3_ownership_security.sql` | 신규 객체·RPC 없음 | 미기록 | 003 정상 적용 후 승인 범위에서 실제 적용 |

001/002와 구조가 같다는 것은 과거에 그 파일로 실행했다는 증명은 아니다.
이번 결론은 **동등한 기존 구조를 보존하며 baseline으로 채택할 수 있다**는 의미다.
001의 pgcrypto는 이미 extensions schema에 있으며, UUID 기본값에는 충돌이 발견되지 않았다.

## F. PHASE 3 migration 적용 가능 여부

**현재 상태에 바로 적용할 수 없다.** 시작부에서 003의 세 테이블 존재를 검사해
`PHASE3_PREREQUISITE` 오류로 transaction을 중단한다.

001/002 이력을 정리하고 003을 정확히 적용하면, 확인한 객체 정의에서 추가 DDL 충돌은
발견하지 못했다. 기존 로컬 테스트도 이 순서로 통과했다. 다만 실제 hosted 환경의
Auth·PostgREST·동시성은 아직 검증 전이므로 운영 적용 성공을 보장하는 판정은 아니다.

## G. 예상 충돌 및 적용 전 조건

| 항목 | 판정 및 대응 |
|---|---|
| 001 재실행 | 테이블은 IF NOT EXISTS지만 `set_updated_at` 트리거는 중복 오류. 재실행하지 않는다 |
| 002 재실행 | 같은 이름의 정책 4개에서 중복 오류. 재실행하지 않는다 |
| 003 객체 이름 | 현재 private schema, likes, 연락처·알림 테이블, RPC가 없어 충돌 없음. 부분 적용 뒤 재실행하면 CREATE TABLE 등에서 충돌 |
| PHASE 3 객체 이름 | 신규 테이블·인덱스·함수·트리거 이름 충돌 미발견. 대부분 CREATE/ADD가 비멱등이므로 재적용 금지 |
| 정확한 함수 시그니처 | PHASE 3은 003의 25인자 `submit_dating_profile`을 private로 이동·이름 변경한다. 임의 변형된 003이나 다른 overload는 재대조 필요 |
| 정책·제약 이름 | PHASE 3의 DROP POLICY 대상 3개는 현재 존재. `notification_logs_type_check`는 003이 생성해야 함 |
| notification 확장 | 003의 기존 Like 이벤트는 새 source CHECK와 호환. match_id는 NULL로 추가하고 like_id NOT NULL은 해제. 현재 해당 테이블이 없어 기존 데이터 충돌은 없음 |
| 기존 프로필 | 프로필 행 삭제·재작성·자동 소유권 연결 없음. 기존 프로필에는 소유권·연락처·wallet이 자동 생성되지 않아 Like 참여 불가 |
| 기존 주선자 | auth_user_id 연결과 활성 Auth 계정이 실제로 유효한지는 행 조회 없이 확인 불가. 기존 로그인·담당 심사 회귀 테스트 필요 |
| Auth 설정 | 이전 공개 설정 점검에서 Email OFF, signup 허용, autoconfirm OFF, anonymous OFF. MVP 설정과 불일치 |
| 프론트/API 전환 | 새 프론트는 현재 없는 공개 주선자 목록·소유권·등록·심사 RPC에 의존. 기존 프론트는 PHASE 3 이후 직접 SELECT/UPDATE 또는 익명 등록이 실패할 수 있음 |
| 003만 적용된 공백 | 003은 익명 등록 RPC를 허용. 서비스 유지 상태로 장기간 두지 말고 점검 창에서 PHASE 3까지 이어서 적용 |
| 권한 기본값 | 현재 public의 기본 table/function grants가 넓음. migration의 REVOKE/GRANT 결과를 역할별 API로 검증; 새 likes/matches에 공개 권한을 추가하지 않음 |
| private 함수 일괄 REVOKE | 현재 private가 없어 타 기능 영향 없음. 적용 전 다른 기능이 추가됐다면 전체 함수 권한 회수 영향 재검토 |
| DDL 잠금 | CREATE INDEX, ALTER TABLE 등은 운영 트래픽과 경합 가능. 행 수·활성 세션을 조사하지 않아 소요 시간 미산정. 점검 창과 중단 기준 필요 |
| 외부 발송 | 앱 테이블의 기존 트리거는 updated_at 하나. 외부 worker/스케줄/Edge 배포 상태는 미확인. 테스트 전 발송 경로가 없는 격리 환경 확인 |
| CLI 이력 | `001/002/003`은 짧은 기존 버전명. 사용할 CLI가 이를 정확히 인식하는지 먼저 확인. 임의 파일명 변경이나 일괄 include-all 금지 |

공식 변경 공지도 확인했다. 새 테이블의 자동 Data API 공개 정책에 의존하지 않고 명시적
권한을 검사해야 한다. PostgreSQL 17.11의 공지 대상인 ltree/GiST/구형 PGP 암호 사용은
이 migration들에 없다. 전체 프로젝트의 확장·데이터 복구 검증을 대신한 결론은 아니다.

행 데이터·외부 설정·실제 동시 실행을 확인하지 않았으므로 모든 운영 충돌이 없다고
단정하지 않는다. 위 미검증 항목은 아래 적용 전제와 통합 테스트로 해소한다.

## H. 안전한 적용 순서

1. 별도 테스트 Supabase 프로젝트를 지정하고, 그 환경의 계정 생성·fixture·migration 적용 승인을 받는다.
   실서비스 데이터 복제 없이 합성 fixture로 검증한다. 알림·결제 worker와 provider 연결은 사용하지 않는다.
2. 운영 대상 ref, 백업과 복원 가능 여부, 점검 창, migration 실행 역할을 확정한다.
   기존 환경과 이번 보고서의 차이가 있으면 preflight 결과부터 다시 대조한다.
3. CLI 설치 버전과 `--help`에서 migration list/repair 및 db push 옵션을 확인한다.
   현재 PATH에는 supabase 실행 파일이 발견되지 않아 설치·로그인·link를 이번에 수행하지 않았다.
4. 실제 schema가 001/002와 같고 CLI가 버전명을 인식하는 것을 확인한 후, **별도 승인으로
   001·002만 applied 상태로 이력을 복구**한다. migration repair는 객체를 생성하는 명령이 아니라
   이력 행을 기록하는 작업이다. 003과 PHASE 3은 미리 applied 처리하지 않는다.
5. 차이가 발견되면 baseline 인정부터 보류한다. 데이터·기존 객체를 보존하는 별도 보정안을 검토한 후
   승인받아 처리한다. reset, DROP CASCADE, 기존 migration 삭제·변조로 맞추지 않는다.
6. CLI 목록과 dry-run으로 미적용 대상이 **003 → 20261003140239** 두 개뿐인지 확인한다.
   짧은 버전명을 CLI가 거부하면 적용을 멈추고, 별도 검토된 버전 매핑과 테스트를 준비한다.
7. 테스트 환경에서 먼저 검증한 후, 승인된 운영 점검 창에서 003을 원자적으로 적용한다.
   003 파일에는 BEGIN/COMMIT이 없으므로 transaction을 보장하는 migration 실행기를 사용해야 한다.
   SQL Editor로 조각 실행해 부분 상태를 만들지 않는다.
8. 003 성공·이력 확인 후 PHASE 3을 적용한다. 이 파일에는 BEGIN/COMMIT이 있다.
   실패하면 transaction 종료/rollback 여부와 catalog·history를 확인하고 서비스를 점검 상태로 유지한다.
   실패한 migration은 applied 처리하지 않는다. 안전한 후속 보정안을 마련하고 재검증한다.
9. 새 RPC/GRANT/RLS와 PostgREST 인식을 확인하고 사용자 담당자가 아래 Auth 설정을 반영한다.
   private는 Data API에 노출하지 않는다. DB와 맞는 프론트를 배포한 뒤 J의 검증을 수행한다.
10. 오류 시 예전 익명 등록·직접 UPDATE 권한을 되살리는 방식으로 되돌리지 않는다.
    쓰기를 차단한 상태로 원인을 수정하고 재검증한다. 데이터가 생긴 뒤 새 테이블을 삭제하는
    역 migration은 사용하지 않는다. 실제 복원이 필요하면 검증된 백업 절차와 별도 승인을 따른다.

이 순서는 실행 승인이 아니다. 이번에는 이력 복구·schema 적용·배포를 하지 않았다.
CLI repair의 동작 근거: [공식 migration repair 문서](https://supabase.com/docs/reference/cli/supabase-migration-repair).

## I. 사용자가 Supabase Dashboard에서 직접 해야 할 작업

대상 ref를 먼저 확인한 뒤 [Authentication 설정](https://supabase.com/dashboard/project/icwptulzrxvasfwzuasl/auth/providers)을 연다.
이전 Auth 공개 설정 점검 결과를 재사용했으며, 이번에 Auth 설정을 변경하지 않았다.

| 메뉴 경로 | 목표 설정 |
|---|---|
| 프로젝트 → Authentication → Sign In / Providers → Email | Enable Email provider ON |
| Authentication → Sign In / Providers → User Signups | Allow new users to sign up ON |
| 같은 페이지의 User Signups → Confirm email | OFF. UI 버전에 따라 Email provider 패널 안에 표시될 수 있음 |
| 같은 페이지 → Allow anonymous sign-ins | OFF 유지 |
| Sign In / Providers → Email → Password settings | 최소 비밀번호 길이 8 이상으로 프론트 정책과 정합성 확인 |
| Authentication → Rate Limits | 테스트에 필요한 범위에서 기존 제한 확인. 제한 해제는 하지 않음 |
| Integrations → Data API → Settings | public RPC가 노출되는지, Exposed schemas에 private가 없는지 확인 |
| Authentication → URL Configuration | 실제 앱 Site URL 확인. 비밀번호 가입·로그인만을 위해 미구현 메일 callback을 임의 추가하지 않음 |

Email OTP는 앱에서 `signInWithOtp`/`verifyOtp`를 호출하지 않는 정책이다.
Email provider를 끄면 비밀번호 인증도 사용할 수 없으므로 OTP 미사용을 위해 provider를 끄지 않는다.
Confirm email OFF는 OTP 전용 차단 스위치가 아니다. 프로젝트 API 수준에서 passwordless 자체를
차단해야 한다면 별도 요구사항과 지원 설정을 확인해야 한다.

현재 코드는 `signUp({email,password})`, `signInWithPassword`, 기본 Supabase session을 사용한다.
자체 비밀번호 테이블·로그·저장 기능은 없다. 실제 네트워크 검증은 J에서 수행한다.
Confirm email OFF 가입은 이메일 소유 증명이 아니며 기존 프로필·주선자를 이메일만으로 연결하지 않는다.
운영 관리자 지정, 기존 프로필 연결, SMTP·Secret·알림·결제 설정은 이번 작업에서 변경하지 않는다.

설정 근거: [비밀번호 인증](https://supabase.com/docs/guides/auth/passwords),
[Auth 일반 설정](https://supabase.com/docs/guides/auth/general-configuration),
[Dashboard providers 구현](https://github.com/supabase/supabase/blob/master/apps/studio/pages/project/%5Bref%5D/auth/providers.tsx).

## J. 적용 후 실행할 통합 테스트

**아래는 실행 계획이며 미실행이다.** 지정·승인된 테스트 프로젝트에서만 실행한다.
기존 PGlite·mock E2E 결과로 대체하지 않는다. 실제 GoTrue 가입/로그인과 PostgREST/RLS를 함께 사용한다.

준비 조건:

- 테스트 ref를 명시적으로 고정하고 운영 ref와 다름을 실행 전 검사한다. 자동 `.env` fallback 금지.
- 사용자 A(남), B/C(여), 미등록 U, 주선자 M1/M2를 사용자 소유 테스트 이메일로 준비한다.
  매 테스트는 독립적인 사용자·프로필 쌍을 사용해 이미 보낸 Like와 섞이지 않게 한다.
- 일반 호출은 public key + 각 사용자의 실제 access token으로 실행한다. service role로 권한 테스트를 하지 않는다.
- fixture 생성·주선자 연결·승인·잔액 준비도 테스트 데이터 변경 승인을 받은 뒤 서버에서만 한다.
  잔액 1/2 준비 시 wallet과 대응하는 admin_adjustment 원장을 함께 기록해 정합성을 유지한다.
  공개 충전 API나 실제 결제를 만들어 테스트하지 않는다.
- 모든 연락처는 합성 값, 알림 동의 false. worker/webhook/cron 및 외부 발송 경로가 없는 테스트 환경을 사용한다.
- 서버 검증자는 테스트 fixture ID로만 범위를 제한해 boolean/합격 여부를 출력한다.
  비밀번호·JWT·refresh token·연락처·프로필 본문을 테스트 로그/Playwright trace에 남기지 않는다.

| ID | 실행 | 합격 기준 |
|---|---|---|
| J01 가입 | 실제 `/#/signup`에서 이메일·비밀번호 가입 | Confirm OFF에서 session 생성, `/apply` 이동. 이메일 확인/OTP 요구 없음. 약한 비밀번호·중복 가입은 안전하게 실패 |
| J02 로그인/session | 로그인 → 새로고침 → 새 탭 → SDK refresh → 로그아웃 | 동일 UID/session 유지·갱신, 로그아웃 후 브라우저에서 보호 RPC 불가. 이미 발급된 access token의 즉시 폐기를 합격 조건으로 오인하지 않음 |
| J03 ownership | A가 정상 등록, A/B가 각자 `get_my_profile_id` 호출 | A UID와 등록 profile 연결, 초기 wallet 0. B에게 A ID가 반환되지 않음. 미등록 U는 null |
| J04 계정당 하나 | A의 순차 재등록 및 새 계정으로 동시 등록 2회 | 한 번만 성공. 다른 요청은 PROFILE_ALREADY_EXISTS/23505. fixture owner·profile·contact·wallet에 고아/중복 없음 |
| J05 ID 위조 | A 토큰으로 sender/owner 추가 파라미터를 넣고, B 프로필 심사·legacy 연결·직접 INSERT 시도 | 알 수 없는 RPC 인자 또는 권한 오류. B 명의 생성·차감·소유권 이전 없음. 정상 target ID 전달은 위조로 취급하지 않음 |
| J06 anon/RLS | public key만으로 목록 RPC, 테이블 읽기·쓰기·등록/Like/잔액 RPC 호출 | 주선자 목록은 id/name만. 프로필 행·주선자 이메일·Auth UID는 노출되지 않음. 상태 코드뿐 아니라 응답 필드와 후속 데이터 불변도 검사 |
| J07 일반/주선자 RLS | A/M1/M2로 각 테이블·심사 RPC 호출 | 일반 사용자 원본 프로필 SELECT 불가, M1은 담당 fixture만 조회·심사. M2 심사 및 direct UPDATE는 차단. reviewed_by/at 서버 결정 |
| J08 private/wallet | A/B로 private schema 접근, wallet UPDATE/upsert/DELETE, 원장·연락처 조회 시도 | schema 비노출 또는 권한 거부. 잔액·원장 불변. public으로 잘못 노출된 우회 객체도 없어야 함 |
| J09 정상/실패 Like | 잔액 1로 A→B; 별도 fixture에서 잔액 0, 자기 자신, 동성, 미승인·비활성 대상 | 정상은 Like 1, -1 원장 1, 잔액 0, Like 알림 작업 1. 거부 시 모든 관련 변경 0, 외부 발송 0 |
| J10 중복 차감 | A→B 성공 뒤 잔액 0에서 순차·병렬 동일 요청 반복 | 동일 Like ID, 누적 차감 1, Like·원장·Like 알림 작업 각각 1 |
| J11 잔액 경합 | 잔액 1인 A가 B/C에게 동시에 Like. 별도 fixture에서 다수 대상 병렬 | 정확히 한 요청만 성공, 나머지 INSUFFICIENT_LIKES. 잔액 0, 음수 없음. 성공 Like/원장 수가 일치 |
| J12 양방향 동시 | A/B 잔액 각 1, A→B와 B→A 동시 실행 및 재요청 | 두 Like, 각각 -1, 정렬된 쌍 Match 정확히 1, pending decision 2, Like 알림 2+Mutual 알림 2. 중복/누락 없음 |
| J13 원자성 | 테스트 전용 환경에서 알림 INSERT 실패를 유도한 뒤 Like 요청 | 실패한 요청의 wallet·Like·원장·Match·알림 변경 전부 rollback. 장애 주입 설치·복구도 승인 범위에서만 수행 |
| J14 기존 흐름 | 소유권 없는 합성 legacy 프로필과 기존 주선자 fixture를 사용 | 주선자 조회·심사 유지, 일반 사용자 임의 legacy 연결 거부, 소유권 없는 프로필 Like 제외 |
| J15 캐시/ACL | 적용 직후 RPC를 anon/A/M1로 호출하고 catalog 검사 | 새 시그니처 인식, 허용 RPC만 EXECUTE 가능. claim/finish는 일반 사용자 거부, private 미노출 |

동시성 재현 방법:

1. 독립 클라이언트·동일 시작 barrier로 HTTP 요청을 병렬 전송한다. 순차 await나 단일 PGlite 연결은 사용하지 않는다.
2. DB 동시 연결 실험도 별도로 수행한다. 직접 연결 또는 session pooler에서 READ COMMITTED와
   실제 인증에 대응하는 `authenticated` 역할/서버 확인 UID로 독립 transaction을 연다.
   이 SQL claim 실험은 실제 JWT 검증을 대체하지 않으며 HTTP 시험과 둘 다 통과해야 한다.
3. 첫 transaction의 Like 호출 후 commit을 잠시 보류한 상태에서 경쟁 호출을 시작해 잠금 대기를
   확인하고 첫 transaction을 commit한다. 양방향은 정규화된 쌍 잠금, 다른 대상은 wallet 경합을 확인한다.
4. 시작 순서를 바꾸고 새로운 fixture로 최소 20회 반복한다. hang·deadlock·5xx·Match 누락을 실패로 기록한다.
   timeout/재시도 후에도 중복 차감이 없어야 한다. 테스트 harness는 finally에서 transaction을 정리한다.
5. privileged 검증자는 해당 fixture에만 한정해 잔액/원장/Like/Match 관계를 확인한다.
   일반 사용자에게 허용되지 않은 matches SELECT를 열어 검증하지 않는다.

정리 시 실행 manifest의 테스트 ID만 사용한다. 원장은 append-only이고 FK는 RESTRICT이므로
포괄 DELETE나 CASCADE 정리를 하지 않는다. 승인된 전용 테스트 프로젝트의 폐기 또는 검토된
fixture 정리 절차를 사용한다. 운영 데이터·운영 Auth 사용자에는 접근하지 않는다.

통과 증빙에는 테스트 ref, migration 버전/파일 해시, Auth 설정 boolean, 테스트별 성공/실패,
동시성 반복 횟수와 불변식 검증 결과만 남긴다.

## 이번 작업의 변경 및 미실행 범위

- 추가: 이 보고서, 복원한 schema snapshot, 보충 읽기 전용 SQL.
- 기존 README에 현재 DB용 절차 링크 추가.
- 앱 소스·기존 migration 수정 없음. 라이브 schema/RLS/데이터/이력/Auth/Secret 변경 없음.
- 실제 회원가입·프로필 작성·Like·알림·결제·통합 테스트·PHASE 4 실행 없음.
- 검증: 메타데이터 보충 SELECT 성공. 문서·SQL 범위·snapshot 형식과 diff 공백 점검.

관련 공식 변경 공지:
[Data API 공개 정책](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically),
[PostgreSQL 17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
