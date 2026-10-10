# PHASE 3.6 적용 후 검증 결과

대상: `icwptulzrxvasfwzuasl`. 검증일: 2026-10-04 KST.
사용자가 001/002는 history repair만, 003/PHASE 3은 db push로 적용했음을 확인한 뒤 검증했다.
**migration 재적용·수정, 라이브 schema/권한 수정, 실제 데이터 작성·삭제는 하지 않았다.**

판정: 로컬 정의와 실제 schema는 비교 범위에서 일치하며 개인정보 직접 접근 차단을 확인했다.
다만 기존 두 테이블의 불필요한 `MAINTAIN` 권한이 남아 있어 수정안을 제시한다.
이 권한을 회수하지 않았으며 전체 보안 검증 완료로 판정하지 않는다.

## A. migration history 최종 상태

MCP에서 다음 네 원격 이력을 확인했다.

| version | name |
|---|---|
| 001 | init |
| 002 | rls |
| 003 | like_notifications |
| 20261003140239 | phase3_ownership_security |

## B. 003 적용 결과

원격 이력과 연락처·Like·알림 테이블을 확인했다. claim/finish RPC는 anon/authenticated에서
실행 불가, service_role에서 실행 가능하다. 실제 worker 호출·알림 발송은 하지 않았다.

## C. PHASE 3 migration 적용 결과

4개 로컬 migration을 외부 연결 없는 일회성 PGlite 메모리 DB에서 실행해 기대 카탈로그를 만들고,
실제 DB의 카탈로그 SELECT 결과와 비교했다. 로컬 기준 생성에는 실제 사용자/프로필을 넣지 않았다.

| 비교 영역 | 실제 항목 수 | 결과 |
|---|---:|---|
| 테이블 및 RLS 플래그 | 14 | 일치, 전부 RLS ON |
| 컬럼·타입·NULL·기본값 | 115 | 일치 |
| PK/FK/UNIQUE/CHECK 제약 | 85 | 일치 |
| 인덱스 정의 | 44 | 일치 |
| RLS 정책 | 2 | 일치 |
| 함수 | 18 | 시그니처·반환형·본문 hash·definer・volatility・search_path·anon/auth 실행 권한 일치 |
| 사용자 트리거 | 4 | 이름·대상·종류·활성 상태·호출 함수 일치 |
| 테이블별 anon/auth 권한 조합 | 28 | SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 및 컬럼 권한 일치 |
| private schema의 anon/auth 권한 | 2 | USAGE/CREATE 모두 없음 |

로컬 엔진은 PostgreSQL 18.3, 실제 DB는 17.11이다. PG18은 NOT NULL을 pg_constraint에도
기록하므로 로컬 89개 NOT NULL 항목은 제약 목록에서 중복 제외했다. NULL 허용 여부는
115개 컬럼 비교에 포함했다. 다른 제약은 제외하지 않았다.
근거: [PG17](https://www.postgresql.org/docs/17/catalog-pg-constraint.html),
[PG18](https://www.postgresql.org/docs/18/catalog-pg-constraint.html).

MAINTAIN은 위 공통 권한 비교와 별도로 실제 PG17에서 검사했고 E의 잔여 권한을 발견했다.
테이블/함수 소유자 등 모든 PostgreSQL 속성을 완전 diff한 것은 아니며,
metadata 비교는 실제 인증·동시 요청의 실행 결과를 대신하지 않는다.

## D. 주요 table / RPC

- public: coordinators, dating_profiles, likes, matches.
- private: profile_contacts, notification_logs, profile_owners, like_wallets, like_transactions,
  match_decisions, profile_photos, payments, admin_members, admin_audit_logs.
- 공개 목록 RPC: list_active_coordinators (id/name 반환).
- authenticated 진입점: submit_dating_profile, review_dating_profile, get_my_profile_id,
  get_my_like_balance, is_current_account_active, send_like, link_reviewed_legacy_profile.
- worker: claim_like_notification, finish_like_notification.
- private 내부 함수 7개는 anon/authenticated 모두 실행 권한 없음.

운영자 연결 RPC는 authenticated EXECUTE 권한이 있어도 본문에서 admin_members를 검사한다.
일반 사용자의 운영자 역할을 가정하지 않는다. 기존 handle_updated_at은 anon/auth EXECUTE가
남아 있는 trigger 반환 함수이며 일반 데이터 반환 RPC가 아니다.

## E. RLS·권한·개인정보 접근 차단

anon/authenticated는 SUPERUSER·BYPASSRLS·CREATEROLE·CREATEDB가 아니며 상위 role membership도 없다.
public/private 범위에서 예상 밖 뷰나 공개 개인정보 alias는 발견하지 않았다.

| 보호 정보 | 저장 위치 | 실제 유효 DB 권한 | 비로그인 HTTP 검사 |
|---|---|---|---|
| 전화번호·kakao_id | private.profile_contacts | anon/auth SELECT 및 컬럼 SELECT 없음 | private 406 / public alias 404 |
| 사진 storage path | private.profile_photos | 동일 | 동일 |
| notification 내부 정보 | private.notification_logs | 동일 | 동일 |
| payment 내부 정보 | private.payments | 동일 | 동일 |
| 타인 wallet | private.like_wallets | 직접 조회/수정 권한 없음 | 동일 |
| 타인 ownership | private.profile_owners | 직접 조회/수정 권한 없음 | 동일 |
| 거래 원장 | private.like_transactions | 직접 조회/수정 권한 없음 | 동일 |

406은 PGRST106(private schema 비노출), 404는 PGRST205(public alias 없음)이다.
정상 authenticated JWT로 직접 호출한 결과가 아니라, authenticated의 실제 유효 권한은
has_table_privilege/has_any_column_privilege/has_schema_privilege/has_function_privilege로 확인했다.
실제 사용자별 RLS/소유권 동작은 Auth 설정 후 테스트해야 한다.

### 발견 사항: 불필요한 MAINTAIN 권한

| 테이블 | 역할 | 현재 |
|---|---|---|
| public.coordinators | authenticated | MAINTAIN 허용 |
| public.dating_profiles | anon | MAINTAIN 허용 |
| public.dating_profiles | authenticated | MAINTAIN 허용 |

기존 public 테이블의 ALL grant에 포함된 권한이 PHASE 3의 개별 REVOKE 목록에 포함되지 않아
남아 있다. 다른 앱 테이블의 anon/auth MAINTAIN은 모두 false다.
MAINTAIN은 VACUUM/ANALYZE/CLUSTER/REINDEX/LOCK TABLE 등의 권한이며 SELECT와 다르다.
일반 REST key만으로 이 명령을 바로 실행할 수 있음을 입증한 것은 아니다. SQL 실행 경로가
있을 때 불필요한 유지보수/잠금 권한이 되므로 최소 권한 원칙상 회수를 권고한다.
유지보수 명령이나 잠금을 실제 실행하는 재현은 하지 않았다.
[공식 권한 정의](https://www.postgresql.org/docs/17/ddl-priv.html#DDL-PRIV-MAINTAIN).

수정안은 다음 권한 회수만 별도 검토·승인하는 것이다. **아래 SQL은 실행하지 않았고 migration 파일도 만들거나 수정하지 않았다.**

```sql
REVOKE MAINTAIN ON TABLE public.coordinators, public.dating_profiles
FROM PUBLIC, anon, authenticated;
```

승인 후 적용한다면 여섯 table/role 조합의 MAINTAIN=false와 기존 SELECT/RPC 권한 불변을 재확인한다.
service_role/postgres의 운영 권한과 데이터는 변경 대상이 아니다.

## F. 기존 데이터 보존 여부

- 기존 coordinators/dating_profiles의 36개 컬럼과 14개 제약은 적용 전 snapshot과 동일하다.
- 로컬 003/PHASE 3에는 기존 프로필을 삭제·초기화·자동 귀속하는 최상위 데이터 조작이 없다.
  함수 본문 안의 INSERT/UPDATE는 함수 정의 시 실제 사용자 데이터에 실행되지 않는다.
- 이번 검증은 카탈로그 SELECT, GET 요청만 사용했다. 라이브 가입·프로필 등록·심사·Like·결제·알림 없음.
- 사용자의 확인에 따르면 001/002 SQL은 재실행되지 않았다.

**기존 행 전체가 동일하다는 증명은 불가능하다.** 적용 전 행별 checksum/백업 비교 자료가 없고,
개인정보 행과 건수는 조회하지 않았다. 전체 데이터 보존을 증명하려면 적용 전 백업과 현재 DB를
별도 승인된 비공개 환경에서 비교해야 한다. 이번에는 그 비교나 복원을 수행하지 않았다.

## G. Auth 설정 전 실행한 통합 검사

실제 Supabase HTTP GET 검사 **23개 통과**. 모든 테이블 요청은 `limit=0`, count 옵션 없음.
실제 프로필 행·연락처·토큰·응답 본문은 로그에 남기지 않았다.

| 검사 | 개수 | 결과 |
|---|---:|---|
| private 보호 테이블 요청 | 7 | 406 PGRST106 |
| 같은 테이블의 public alias 요청 | 7 | 404 PGRST205 |
| anon coordinators/likes/matches 직접 조회 | 3 | 401 42501 |
| dating_profiles 및 공개 주선자 RPC의 0행 요청 | 2 | 200, 빈 배열 |
| anon 소유권/잔액/계정 상태 RPC | 3 | 401 42501 |
| 유효하지 않은 JWT로 보호 RPC | 1 | 401 PGRST301 |

0행 요청은 endpoint 접근·권한·노출 여부 검사다. 특히 dating_profiles의 빈 응답은
limit=0에 의한 것이므로 실제 행 수준 RLS 통과 근거로 사용하지 않는다. RLS는 별도 catalog로 확인했다.

공개 Auth settings GET도 성공했고 다음 상태를 확인했다:
emailEnabled=false, signupDisabled=false, emailAutoconfirm=false, anonymousEnabled=false.

첫 네트워크 실행은 사용량 제한으로 자동 승인 검토가 완료되지 않아 미실행이었다.
사용자 충전 통보 후 동일한 승인 경로로 재요청했고 정상 실행됐다. 승인 검토를 우회하지 않았다.

## H. 아직 실행하지 못한 테스트

- 실제 이메일·비밀번호 가입/로그인 및 refresh/session 유지.
- 서로 다른 실제 계정의 auth.uid 소유권, 프로필 하나 제한, 타인 ID 위조·주선자 범위.
- 잔액 직접 변경 공격의 실제 authenticated HTTP 거부와 정상 본인 잔액 조회.
- 중복 Like, 여러 대상 동시 잔액 차감, 양방향 동시 Match 단일 생성 및 rollback.

이들은 Auth 설정 후 사용자 소유 테스트 계정과 명시적으로 선정된 테스트 환경/fixture가 필요하다.
운영에 임의 프로필을 만들거나 실제 결제·알림으로 fixture를 마련하지 않았다.
현재 API 검사는 유효한 사용자 JWT를 사용하지 않았다.

## I. 사용자가 Dashboard에서 할 작업

[대상 프로젝트](https://supabase.com/dashboard/project/icwptulzrxvasfwzuasl/auth/providers)의
Authentication → Sign In / Providers에서:

1. Email → Enable Email provider ON (현재 OFF).
2. User Signups → Allow new users to sign up ON 유지 (현재 허용).
3. Confirm email OFF (현재 autoconfirm=false, 즉 확인 필요).
   UI에 따라 User Signups 또는 Email provider 패널에 표시될 수 있다.
4. Allow anonymous sign-ins OFF 유지.
5. Email Password settings에서 최소 길이 8 이상 확인.

Email OTP는 앱에서 사용하지 않는다. Email provider를 끄면 비밀번호 인증도 막히므로 끄지 않는다.
자체 비밀번호 저장이나 Secret 변경은 없다. 이번 검증에서 Dashboard 설정은 변경하지 않았다.
근거: [Auth 설정](https://supabase.com/docs/guides/auth/general-configuration),
[비밀번호 인증](https://supabase.com/docs/guides/auth/passwords).

## J. PHASE 4 진행 가능 여부

**PHASE 4는 시작하지 않았다.** schema 및 비로그인 접근 검증은 완료했지만,
MAINTAIN 권한 검토와 실제 인증·사용자 간 권한·동시성 검증이 남아 있다.
따라서 PHASE 3.6 전체 통합/보안 검증이 모두 끝났다고 보고하지 않는다.

## 검증 산출물

- [실제 최종 카탈로그](phase3-6-final-catalog.json)
- [로컬 기대값 비교·migration SHA256](phase3-6-schema-comparison.json)
- [역할·MAINTAIN·worker RPC 검사](phase3-6-security-checks.json)
- [실제 HTTP 결과·Auth boolean](phase3-6-api-results.json)
- [카탈로그 SELECT](../supabase/inspection/phase3_6_catalog.sql)
- [오프라인 기대 schema 비교 도구](../scripts/compare-phase3-catalog.mjs)
- [GET 전용 검증 도구](../scripts/verify-phase3-readonly-api.mjs)

기존 중단 기록은 [상태 이력](phase3-6-integration-status.md)에 보존했다. 최종 검증 판정은 이 문서를 따른다.
