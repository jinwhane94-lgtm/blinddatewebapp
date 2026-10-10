# MAINTAIN 회수 및 Auth 통합 준비 결과

2026-10-04 KST. 대상 프로젝트 `icwptulzrxvasfwzuasl`.

## A. 새 security migration

`20261004061844_revoke_client_maintain.sql`을 CLI migration new로 생성했다.
변경 내용은 transaction 안의 다음 두 문장뿐이다.

```sql
REVOKE MAINTAIN ON TABLE public.coordinators FROM authenticated;
REVOKE MAINTAIN ON TABLE public.dating_profiles FROM anon, authenticated;
```

기존 001/002/003/20261003140239의 SHA256은 이전 검증 값과 동일하다.
검토 결과 데이터 변경 없이 해당 역할의 유지보수 권한만 제거한다.
dry-run에서 새 파일 하나만 확인하고 `db push --linked --project-ref icwptulzrxvasfwzuasl --skip-vault --yes`로 적용했다.
seed/roles 적용은 빈 목록이며 Vault Secret 갱신은 명시적으로 제외했다.

## B. MAINTAIN 회수 결과

원격 이력에 `20261004061844 / revoke_client_maintain`이 추가됐다.

| 테이블 | 역할 | 이전 | 이후 |
|---|---|---|---|
| coordinators | authenticated | true | false |
| dating_profiles | anon | true | false |
| dating_profiles | authenticated | true | false |

coordinators의 anon MAINTAIN=false는 그대로다. postgres/service_role의 두 테이블 MAINTAIN=true도 유지됐다.
모든 앱 테이블 ACL을 펼쳐 전후 비교한 결과 **위 세 항목만 삭제되고 추가 grant는 없다**.
schema·컬럼·제약·인덱스·정책·트리거·함수·핵심 권한·private schema 권한의 9개 비교 영역도 모두 동일하다.
[검증 결과 JSON](phase3-6-maintain-revoke-results.json).

## C. Auth 설정 확인 결과

실제 공개 `/auth/v1/settings` GET 결과:

| 설정 | 확인 값 | 목표 |
|---|---|---|
| Email provider | OFF (`emailEnabled=false`) | ON |
| 신규 가입 | ON (`signupDisabled=false`) | ON |
| Confirm email | ON (`emailAutoconfirm=false`) | OFF |
| Anonymous login | OFF | OFF |

사용자가 제시한 정책과 실제 응답이 다르다. Dashboard/Secret 설정은 수정하지 않았다.
[대상 Auth 설정](https://supabase.com/dashboard/project/icwptulzrxvasfwzuasl/auth/providers)의
Authentication → Sign In / Providers에서 Email ON, Confirm email OFF로 설정하고 저장해야 한다.
신규 가입 ON, Anonymous OFF는 유지한다. 최소 비밀번호 길이 8 이상을 확인한다.
테스트 프로젝트가 별도라면 그 프로젝트에도 같은 정책이 필요하다.

## D. 실제 사용자 통합 테스트 결과

아직 미실행. 사용자 요청의 준비 단계로 A/B/C 독립 session·UID·소유권 등
[17개 테스트 절차](phase3-6-auth-integration-plan.md)를 작성했다.
별도 테스트 프로젝트 ref가 아직 제공되지 않았고 현재 실제 Email Auth도 비활성화 상태다.
현재 운영 프로젝트에 테스트 계정을 임의 생성하지 않았다.

## E. RLS/소유권 공격 테스트 결과

이번 권한 회수 전후 RLS/함수/SELECT·쓰기 권한 불변을 확인했다.
이전 실제 API 읽기 전용 23개 검사는 별도 보고서에 보존했다.
실제 authenticated A/B/C로 실행하는 타인 ID 위조·연락처·wallet·Match 접근 공격은 절차 준비 완료, 미실행이다.

## F. Like/wallet 테스트 결과

RPC만 정상 생성, 정확히 -1, 중복 추가 차감 없음, 잔액 0 생성 차단 등의 절차를 준비했다.
test-only admin_adjustment 원장과 wallet 증액을 한 transaction으로 처리하는 idempotent seed 방법을 정했다.
운영 seed·우회 RPC·실제 결제·Like 생성은 하지 않았다.

## G. Mutual Like 동시성 테스트 결과

독립 session/연결의 양방향 동시 Like를 새 fixture pair로 20회 이상 반복하고
Match 1·Like 2·decision 2를 확인하는 절차를 준비했다. 실제 실행 전이다.

## H. 테스트 데이터 정리 결과

생성한 테스트 사용자·프로필·wallet seed·Like는 0개이며 이번에 정리할 데이터가 없다.
append-only 원장/FK RESTRICT를 우회하는 삭제 대신, 사전에 승인된 일회용 테스트 환경 폐기/복원 방식을 계획했다.
운영 사용자/프로필 삭제나 reset은 수행하지 않았다.

## I. 발견된 문제

- MAINTAIN 잔여 권한: 승인된 범위로 해결, 재검증 통과.
- 실제 Auth 정책 불일치: Email OFF / Confirm ON. 담당자 설정 후 재확인 필요.
- 통합 테스트 환경 미선정: 별도 테스트 ref와 정리 방식 확정 후 상태 생성 테스트 가능.
- 기존 migration 변경, 예상 밖 schema 변경, 추가 권한 변경은 발견되지 않았다.

## J. PHASE 4 진행 가능 여부

PHASE 4는 시작하지 않았다. 실제 Auth/소유권/Like/동시성 검증이 남아 있으므로
전체 통합 테스트 통과로 보고하지 않는다. 이번에 완료한 범위는 security migration 적용·검증과 테스트 준비다.
