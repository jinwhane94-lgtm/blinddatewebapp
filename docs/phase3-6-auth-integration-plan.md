# 실제 Auth 통합 테스트 실행 절차

2026-10-04 KST. 준비 완료, 실제 사용자 생성/테스트 실행 전.
운영 대상 `icwptulzrxvasfwzuasl`은 테스트 fixture 생성 대상으로 사용하지 않는다.
별도 테스트 프로젝트 ref는 아직 제공되지 않았다.

## 실행 전 조건

1. 기존 사용자/프로필이 없는 전용 Supabase 테스트 프로젝트를 명시적으로 선정한다.
   실행자는 해당 ref를 allowlist로 고정한다. 운영 ref와 같으면 시작하지 않는다.
   운영 `.env` fallback, 운영 프로필 복제, 기존 주선자 계정 재사용을 금지한다.
2. 운영과 동일한 001/002/003/PHASE 3/security migration 상태를 테스트 환경에 준비한다.
   실제 운영 migration을 재실행하는 단계가 아니다. 테스트 환경 적용도 명시된 범위에서 한다.
3. 테스트 환경의 Auth가 Email ON, signup ON, Confirm OFF, Anonymous OFF인지
   공개 settings의 boolean으로 확인한다. 정책 불일치면 계정 생성 전에 중단한다.
4. 외부 알림 function/webhook/cron 및 provider 연결이 없는 환경을 사용한다.
   알림 동의는 false이며 결제·SOLAPI 호출은 전부 금지한다. 공급자 Secret을 복사하지 않는다.
5. cleanup은 아래의 일회용 환경 폐기 방식으로 확정한다. 환경을 보존해야 한다면
   fixture 정리 설계가 검토될 때까지 Like/wallet seed를 시작하지 않는다.

## 테스트 데이터와 인증 클라이언트

- 실행마다 UUID `run_id` 생성. A/B/C의 이메일은 사용자가 소유한 테스트 도메인/메일함에서
  `phase36+<run_id>-a/b/c@<owned-test-domain>`처럼 명시적으로 구분한다.
- A=남, B=여, C=남. profile nickname/company에도 `TEST_<run_id>` 표식 사용.
- 실제 개인 이름·회사·전화번호·사진·kakao_id는 쓰지 않는다. 연락처는 테스트용 합성 값이고
  알림 동의 false. 합성 번호가 현실의 번호와 겹칠 수 있으므로 외부 발송 경로 자체가 없어야 한다.
- 새로운 fixture 전용 주선자 M과 필요 시 비담당 주선자 M2를 준비한다. 기존 주선자를 쓰지 않는다.
- 사용자별로 별도 Supabase client/브라우저 context를 만든다. 저장소 키도 분리한다.
  테스트 대상 요청은 public key + 해당 사용자의 실제 Auth session으로 보낸다.
- 비밀번호는 매번 무작위 생성해 메모리에만 보관한다. 인증 토큰·비밀번호·프로필 본문을
  stdout, JSON 결과, Playwright trace/video/HAR에 기록하지 않는다.
- 관리자 클라이언트는 fixture 준비/서버 검증 전용이다. 공격 테스트 요청에 관리자 key를 쓰지 않는다.
- 무시되는 로컬 `.env.integration.local`에는 변수 이름을 기준으로 설정하고 실제 값을 커밋하지 않는다:
  `INTEGRATION_PROJECT_REF`, `INTEGRATION_SUPABASE_URL`, `INTEGRATION_PUBLIC_KEY`,
  테스트 전용 관리자 연결, `INTEGRATION_TEST_EMAIL_DOMAIN`.
- fixture manifest에는 run_id, ref, 생성한 테스트 사용자/프로필/주선자 UUID와 생성 성공 단계만 기록한다.
  생성 요청이 실패하면 존재한다고 가정하지 않는다. 재실행 시 신규 fixture 또는 명시적 resume만 사용한다.

## 사용자 요청 17개 테스트와 합격 조건

| 번호 | 실행 | 합격 조건 |
|---|---|---|
| 1 | A signUp(email,password), signOut, signInWithPassword, 새로고침·refreshSession | 즉시 session, getUser의 UID 일관, refresh 후 같은 UID. 비밀번호가 앱 저장소/로그에 없음 |
| 2 | B에 같은 절차를 독립 context에서 실행 | B session 유지, A 세션에 영향 없음 |
| 3 | A/B의 getUser 및 실제 등록 결과를 서버에서 교차 검사 | UID가 다르고 private.profile_owners.user_id가 각 Auth UID와 일치. client가 지정한 소유자 ID 사용 안 함 |
| 4 | A 등록 후 A의 get_my_profile_id 호출 | A profile ID 반환. 서버 fixture 검사에서 A→A profile 소유권 한 개 |
| 5 | B 등록 후 B의 get_my_profile_id 호출 | B profile ID 반환. B→B profile 소유권 한 개 |
| 6 | A 토큰에 B의 owner/sender/profile ID를 추가하거나 B 대상 direct INSERT/UPDATE, legacy 연결 호출 | 인자 오류 또는 권한 거부. B ownership/profile/wallet 불변. 정상 target_profile_id=B 전달 자체는 공격으로 보지 않음 |
| 7 | 동일 계정 순차 재등록 및 독립 새 fixture 계정으로 두 동시 등록 | 첫 등록 하나만 성공, 나머지 PROFILE_ALREADY_EXISTS/23505. profile/contact/owner/wallet 고아·중복 없음 |
| 8 | A/C가 B private contact와 public alias를 GET | private schema 비노출/권한 거부, 전화번호·kakao_id 응답 없음 |
| 9 | A/C가 B wallet 직접 SELECT/UPDATE/upsert 요청 | 실패, B 잔액·원장 불변. get_my_like_balance는 호출자 본인만 반환 |
| 10 | A가 자기 wallet 직접 UPDATE/upsert/INSERT 또는 임의 RPC 인자로 증가 시도 | 실패, A 잔액·원장 불변. 변경 0행도 성공으로 간주하지 않고 서버 상태로 확인 |
| 11 | 양쪽 승인·활성 fixture에서 direct likes INSERT와 send_like 비교 | direct INSERT 실패. 충분한 잔액의 send_like만 성공, 발신자는 호출 UID의 프로필 |
| 12 | seed 잔액 1인 A→B 정상 Like | 잔액 0, 방향 Like 1, sent_like 원장 1(delta=-1), 알림 작업 1. 외부 전송 0 |
| 13 | 위 요청을 잔액 0에서 순차/병렬 반복 | 동일 Like ID, 잔액 0, 추가 원장/Like/알림 작업 없음 |
| 14 | 새 독립 fixture에서 seed 없는 잔액 0 사용자가 새 상대에게 Like | INSUFFICIENT_LIKES, Like/원장/알림 작업 모두 미생성 |
| 15 | 독립 A/B fixture에 각 잔액 1, A→B 뒤 B→A | 방향 Like 2, 두 계정 각각 -1, 정렬된 pair의 Match 정확히 1, pending decision 2 |
| 16 | 새로운 A/B fixture에 각 잔액 1, barrier로 양방향 동시 요청 | Match 1, Like 2, decision 2, Like 알림 2/Mutual 알림 2, 재요청해도 중복 없음 |
| 17 | 관계 없는 C가 A/B matches, decisions, owners, contacts, wallet, photos, payments, notification 직접 접근 | table/schema 권한 거부. C에게 A/B private 정보 없음. Match 조회 API 미구현을 임의 구현하지 않음 |

각 테스트는 예상 HTTP/SQLSTATE, 데이터 불변식, fixture ID 범위 검사 모두 통과해야 한다.
오류 응답만 보고 통과 처리하지 않는다. row count 검증은 전용 테스트 fixture에만 제한하며
운영 프로필 통계/건수는 조회하지 않는다. schema 불일치나 권한 노출이 발견되면 중단하고 보고한다.

## 동시성 재현

- 16번은 한 번의 Promise.all 성공만으로 종료하지 않는다. 독립 클라이언트 및 DB 연결에서
  새 fixture pair로 최소 20회 반복하고 시작 순서를 교대한다.
- HTTP 경합과 별도로 전용 테스트 DB의 두 READ COMMITTED transaction에서 동일 pair 잠금을
  경합시킨다. 첫 요청을 commit 전 잠시 유지하고 두 번째가 기다리는지 확인한 뒤 commit한다.
- DB 역할/claim 실험은 실제 Auth JWT 시험을 대신하지 않는다. 두 경로를 구분해 기록한다.
- 보조 검사: 잔액 1인 A가 B와 추가 이성 fixture D에 동시에 Like하면 정확히 하나만 성공해야 한다.
- timeout/연결 종료 후 재요청도 중복 차감이 없어야 한다. finally에서 transaction·연결을 정리한다.

## 테스트 전용 wallet seed

운영용 충전 RPC/관리자 UI/우회 함수를 추가하지 않는다. 실제 payment 행이나 결제를 만들지 않는다.
운영 프로젝트에는 이 seed를 절대 실행하지 않는다.

테스트 전용 DB 관리자 연결에서만 하나의 transaction으로:

1. allowlist ref와 실제 연결 대상이 같고 운영 ref와 다름을 확인한다.
2. manifest에 생성 완료된 테스트 UID/profile만 받는다. 함수 인자로 전달된 임의 운영 UID를 허용하지 않는다.
3. 해당 profile_owners 연결과 초기 wallet 존재를 확인하고 wallet 행을 잠근다.
4. `operation_id`를 run_id/fixture에 대해 고정한 UUID로 만든다. 이전 원장이 있으면 같은 UID/delta인지
   확인하고 이미 처리된 seed로 종료한다. 서로 다르면 중단한다.
5. like_transactions에 `kind='admin_adjustment'`, `delta=1` 또는 해당 시나리오 수량,
   `operation_id=<fixture seed UUID>`, payment_id/like_id=NULL을 기록한다.
6. 새 원장 삽입이 성공한 경우에만 같은 transaction에서 그 테스트 wallet을 동일 수량 증가시킨다.
7. fixture에 한정해 wallet 잔액과 원장 합계를 검증하고 commit한다. 어떤 실패도 rollback한다.

반복 seed를 중복 지급하지 않으며, 기존 migration의 제약/append-only trigger를 비활성화하지 않는다.
이 문서는 절차이고 실제 seed 스크립트나 공개 함수는 배포하지 않았다.

## 정리 방법

Like 원장에는 append-only trigger, 여러 테이블에는 FK RESTRICT가 있다. 따라서 개별 DELETE
명령을 임의 나열하거나 trigger/RLS를 끄는 정리를 사용하지 않는다. HTTP 요청들은 독립 transaction이라
마지막 ROLLBACK 하나로 전체 테스트를 지울 수 없다.

권장 실행 단위는 전용 일회용 테스트 프로젝트/격리된 로컬 Supabase 환경이다.
시험 전 schema-only 기준점을 준비하고, 시험 후 다음을 수행한다:

1. A/B/C/M client signOut 및 session 정리, 모든 테스트 연결 종료.
2. 결과에는 ref·run_id·case 결과와 불변식만 남기고 인증정보는 저장하지 않는다.
3. manifest의 전용 테스트 환경 ref를 운영 ref와 대조한다.
4. 사전에 승인된 일회용 환경 폐기/초기 기준점 복원 절차로 환경 전체를 정리한다.
   운영 `db reset`, 기존 사용자 삭제, 운영 프로젝트 폐기는 절대 사용하지 않는다.
5. 폐기/복원 확인 결과를 기록한다. 실패 시 데이터가 정리됐다고 보고하지 않는다.

재사용 테스트 프로젝트에서 개별 fixture 삭제만 해야 한다면 원장 보존 정책 때문에 별도 정리 설계가 필요하다.
그 정책을 확정하기 전에는 해당 프로젝트에서 상태를 만드는 테스트를 실행하지 않는다.

## 이번 실행 상태

17개 절차·seed·정리 계획은 준비 완료. 아직 테스트 프로젝트가 지정되지 않았고 실제 Auth 응답도
목표 정책과 달라 사용자/프로필/Like/seed를 생성하지 않았다. 따라서 정리할 테스트 데이터는 없다.
PHASE 4는 시작하지 않는다.
