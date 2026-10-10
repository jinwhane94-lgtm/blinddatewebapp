# PHASE 3.6 실제 통합 작업 상태

> 이후 사용자가 직접 적용 사실을 확인했고 검증을 재개했다.
> 최신 결과는 [PHASE 3.6 적용 후 검증 보고서](phase3-6-verification.md)를 따른다.
> 아래는 중단·재개 과정의 이력이다.

> 이후 재연결 확인에서 원격 migration 네 개가 이미 기록된 상태를 발견했다.
> 최신 결과는 [PHASE 3.6 현재 상태](phase3-6-current-state.md)를 참조한다.
> 아래 내용은 이전 중단 시점의 기록이다.

점검일: 2026-10-04 KST. 대상: `icwptulzrxvasfwzuasl`.

## 실행 권한 반영 후 확인 — 최신 결과 (이전 기록보다 우선)

샌드박스 밖 실행으로 Supabase CLI 2.117.0의 버전·도움말 확인이 성공했다.
`migration list --linked --project-ref icwptulzrxvasfwzuasl`도 성공했다.
설치된 CLI는 기존 짧은 migration 버전명을 인식한다.

그러나 이전의 빈 migration 이력과 달리 다음 네 버전이 이미 원격에 기록돼 있었다.
MCP list_migrations와 별도 catalog SELECT에서도 이를 확인했다.

| 버전 | 원격 이름 |
|---|---|
| 001 | init |
| 002 | rls |
| 003 | like_notifications |
| 20261003140239 | phase3_ownership_security |

이력 테이블과 profile_contacts, likes, notification_logs, profile_owners, like_wallets,
matches 테이블 및 send_like(uuid), get_my_profile_id() 함수가 존재한다.
이번 실행에서는 migration repair나 db push를 호출하지 않았다.
따라서 이 변경의 실행 주체·시각·사용된 SQL 원문은 확인되지 않았다.

예상하지 못한 schema 차이가 있으면 중단하라는 사용자 지시에 따라 중복 적용 및
추가 통합 작업을 중단했다. 전체 schema와 로컬 migration의 동등성, 최종 RLS/ACL,
기존 데이터 보존까지 검증 완료된 상태는 아니다.

### 최신 A~J

- A: 001, 002, 003, 20261003140239 모두 원격 이력에 존재.
- B: 003 적용 기록과 주요 객체 존재. 이번 에이전트 실행으로 적용한 것은 아님.
- C: PHASE 3 적용 기록과 주요 객체 존재. 전체 정의 비교는 중단 상태.
- D: 위 주요 테이블 6개와 RPC 2개 존재 확인. 전체 목록/정의 검증 미완료.
- E: 최종 RLS/GRANT/REVOKE 및 개인정보 접근 차단 미검증.
- F: 이번 에이전트 작업은 앱 데이터 변경·삭제/초기화/migration 재실행 없음.
  다른 경로로 적용된 작업의 데이터 보존 여부는 미검증.
- G: CLI 연결 및 migration 목록, MCP 이력과 주요 객체 교차 확인 성공.
- H: 전체 schema 비교, 권한/개인정보 접근 차단, Auth/소유권/Like/동시성 검사 미실행.
- I: Auth 설정 변경 없음. 기존 I의 Dashboard 안내 유지. 현재 Auth 상태 재조회는 하지 않음.
- J: PHASE 4 미진행. 예상 밖 적용 상태 확인 후 검증 재개 필요.

권한·schema·비로그인 API 검사는 Email Auth 설정 전에도 가능하다.
실제 가입/session 및 계정별 소유권·Like 검사는 Auth 설정과 테스트 fixture 준비 후 수행한다.
다음 단계는 이미 적용된 작업이 의도된 것인지 확인하고, 재적용 없이 검증만 재개하는 것이다.

## 연결 완료 통보 후 재확인 — 최신 상태

사용자의 연결 완료 통보 후 `supabase/.temp/project-ref`가 대상
`icwptulzrxvasfwzuasl`인 것을 확인했다. npm cache의 Supabase CLI 실행 파일도 발견했다.
아래 최초 점검의 CLI/linked project 부재 기록은 이제 과거 상태다.

MCP는 여전히 `supabase_read_only_user`, transaction/default read-only ON이다.
이력 테이블과 003/PHASE 3 주요 테이블도 아직 없다.

CLI 버전 및 migration repair/db push 도움말 확인 과정에서
`C:\Users\user\.supabase\telemetry.json.tmp...` 쓰기가 샌드박스에 의해 거부되어
`EPERM`으로 종료됐다. 별도로 대기 중이던 npx 도움말 조회도 취소했다.
오류 시 중단하라는 사용자 지시에 따라 실행 환경 변경·권한 확대·우회는 시도하지 않았다.
실제 CLI DB 인증/쓰기 권한은 아직 검증하지 못했다.

현재 재개 조건은 재연결이 아니라 CLI의 로컬 설정 파일 쓰기가 허용되는 실행 환경이다.
승인된 DB 작업 자체의 재승인은 필요하지 않다. 이력 복구·migration·데이터 변경은 전혀
실행하지 않았으므로 아래 A~J 적용 결과는 그대로다. PHASE 4도 진행하지 않았다.

**상태: 단계 1 사전 확인 완료, 단계 2 이력 복구 직전에 쓰기 연결 부재로 중단.**
사용자의 migration 적용 승인은 유효하다. 재승인이 필요한 문제가 아니라 실행 가능한
쓰기 연결이 없는 문제다. 라이브 쓰기 SQL을 시도하거나 읽기 전용 설정을 해제하지 않았다.

## 중단 근거

- Vite development/production과 MCP 설정의 ref 모두 지정 대상과 일치.
- MCP 설정 `read_only=true`.
- DB `current_user = supabase_read_only_user`.
- `transaction_read_only=on`, `default_transaction_read_only=on`.
- 현재 제공된 Supabase 도구에 `apply_migration`이 없음.
- PATH에서 Supabase CLI/psql 실행 파일을 찾지 못함.
- 확인한 실행 환경과 프로젝트 `.env`에 `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
  `SUPABASE_DB_URL`, `DATABASE_URL` 설정 없음. 값은 출력하지 않음.
- 로컬 Supabase CLI의 linked project 파일도 없음.

현재 사용 가능한 연결에서 migration 이력 생성/복구와 DDL을 실행할 수 없다.
CLI 설치만으로 DB 인증·쓰기 권한이 생기지 않으므로 설치나 자격증명 탐색을 확대하지 않았다.

## A. migration history 최종 상태

MCP `list_migrations` 결과는 빈 목록이다.
`supabase_migrations.schema_migrations`는 존재하지 않는다. 001/002 이력 복구 미실행.

## B. 003 적용 결과

미실행. `private.profile_contacts`, `public.likes`, `private.notification_logs`가 없다.
001/002 SQL도 재실행하지 않았다.

## C. PHASE 3 migration 적용 결과

`20261003140239_phase3_ownership_security.sql` 미실행.
003 적용 전에는 선행조건을 충족하지 못한다. 실패를 유도하는 적용 시도도 하지 않았다.

## D. 생성된 주요 table / RPC

이번에 생성한 DB 객체는 없다. 현재 앱 테이블은 `public.coordinators`,
`public.dating_profiles`, 앱 함수는 `public.handle_updated_at()`이다.

적용 후 확인할 대상은 연락처·Like·알림, profile_owners·like_wallets·like_transactions,
matches·match_decisions·profile_photos·payments·admin_members·admin_audit_logs와
등록·심사·소유권·잔액·Like RPC다. 이들은 현재 생성 완료 상태가 아니다.

## E. RLS 및 권한 검증 결과

- 두 기존 테이블 RLS가 활성화되어 있다.
- 정책 4개, 함수 ACL과 정의는 PHASE 3.5 snapshot과 일치한다.
- 테이블 ACL은 기존의 넓은 anon/authenticated grants를 유지한다.
  기존 RLS의 활성 주선자 SELECT는 컬럼을 id/name으로 한정하지 않는다.
- 신규 REVOKE/GRANT와 RPC 권한은 적용되지 않아 검증 완료로 판정할 수 없다.
- 전화번호, kakao_id, 사진 storage path, 알림·결제 내부 데이터, wallet, 소유권을 저장할
  신규 테이블 자체가 없다. 이를 적용 후 개인정보 접근 차단 테스트 통과로 간주하지 않는다.
- 실제 일반 클라이언트로 개인정보 행을 요청하지 않았다.

## F. 기존 데이터 보존 여부

라이브 DB에는 카탈로그 SELECT와 migration 목록 조회만 수행했다.
데이터 INSERT/UPDATE/DELETE, 테이블 DROP/초기화, db reset, migration 적용 모두 미실행.
따라서 이번 작업으로 기존 데이터에 변경을 가하지 않았다. 사용자·프로필 행과 그 집계는
조회하지 않았으며, 다른 주체의 동시 변경까지 전후 비교한 것은 아니다.

## G. 실행한 통합 테스트와 결과

실제 연결에서 수행한 것은 **읽기 전용 사전 점검**이다. 쓰기/RLS 동작 통합 테스트와 구분한다.

| 점검 | 결과 |
|---|---|
| 프로젝트 설정 대조 | 프론트와 MCP 모두 지정 ref 일치 |
| DB 연결 역할·transaction 상태 | read-only 확인, 쓰기 진행 불가 |
| migration 목록·이력 테이블 | 빈 목록, 이력 테이블 없음 |
| 기존 테이블·RLS | 기본 2개 테이블, RLS ON |
| 이전 snapshot과 컬럼 비교 | 일치 |
| 제약조건 비교 | 일치 |
| 정책 비교 | 일치 |
| 인덱스 비교 | 일치 |
| 함수 정의·시그니처·ACL 비교 | 일치 |
| 트리거 비교 | 일치 |

근거는 [적용 직전 snapshot](phase3-6-preflight-snapshot.json)에 저장했다.
6개 메타데이터 영역을 PHASE 3.5 snapshot과 구조적으로 비교했다.
PHASE 3에서 통과한 로컬 DB/E2E 테스트를 이번 실제 통합 결과로 재사용하지 않았다.

## H. 아직 실행하지 못한 테스트

**Email Auth 설정 전에도 가능하지만, 먼저 migration 적용이 필요한 검사:**

- 생성 schema·제약·인덱스·함수·migration history 정합성.
- anon/authenticated/PUBLIC의 schema/table/function 유효 권한과 RLS 정책 검사.
- 공개 key를 사용하는 비로그인 클라이언트의 제한된 RPC 허용 및 보호 API 접근 거부.
- private 비노출, 사진 경로·연락처·원장·결제·소유권 직접 접근 차단.

**Email Auth 설정 및 승인된 테스트 계정/fixture 준비 후 수행할 검사:**

- 실제 가입·로그인·session 지속/갱신.
- auth.uid 기반 소유권, 계정당 프로필 하나, 다른 사용자 ID 위조 거부.
- 사용자/주선자별 RLS와 타 사용자 wallet·소유권 접근 차단.
- Like 중복 차감, 여러 대상에 대한 잔액 경합, 양방향 동시 Match 정확히 하나.
- 실패 시 transaction 원자성 및 기존 주선자 흐름 회귀.

별도 테스트 프로젝트는 이번 요청에서 지정되지 않았다. 운영에 합성 프로필을 만드는 테스트는
자동으로 수행하지 않는다. 기존 테스트 계정만 사용할 수 있는지도 현재 확인하지 않았다.
상세 테스트 조건과 합격 기준은 [PHASE 3.5 J](phase3-5-integration-readiness.md#j-적용-후-실행할-통합-테스트)를 따른다.

## I. 사용자가 해야 할 작업

재개하려면 지정 프로젝트에 대한 **쓰기 가능한 Supabase 연결**을 준비해야 한다.
프로젝트 범위를 그대로 유지한 쓰기 지원 MCP 또는 로컬에서 인증된 Supabase CLI/DB 연결을
사용할 수 있다. 토큰·DB 비밀번호·Secret을 채팅이나 커밋 파일로 전달하지 않는다.
연결 준비 후 기존 승인 범위에서 단계 1을 재확인하고 단계 2부터 재개한다.

Auth는 별도로 [대상 프로젝트 Auth 설정](https://supabase.com/dashboard/project/icwptulzrxvasfwzuasl/auth/providers)에서 변경한다:

1. Authentication → Sign In / Providers → Email → Enable Email provider ON.
2. Sign In / Providers → User Signups → Allow new users to sign up ON.
3. 같은 페이지의 Confirm email OFF. UI에 따라 Email provider 패널 안에 표시될 수 있다.
4. Allow anonymous sign-ins OFF 유지. Email 비밀번호 최소 길이는 8 이상 확인.
5. Integrations → Data API → Settings에서 Exposed schemas에 private가 없는지 확인.

Email OTP 미사용을 위해 Email provider를 끄지 않는다. 앱은 email/password와 Supabase session을 사용한다.
이번에는 Auth 설정을 수정하지 않았고 공개 Auth 설정도 재조회하지 않았다.
PHASE 3.5에 기록된 Email OFF/autoconfirm OFF는 이전 점검값이다.

설정 근거: [Supabase Auth 일반 설정](https://supabase.com/docs/guides/auth/general-configuration),
[비밀번호 인증](https://supabase.com/docs/guides/auth/passwords).

## J. PHASE 4 진행 가능 여부

**진행 보류.** PHASE 3.6 migration과 실제 통합 검증이 미완료이고, 사용자도 PHASE 4를 금지했다.
라이브 결제·SOLAPI 발송·Secret 변경·PHASE 4 작업은 수행하지 않았다.
