# 승인된 매물 목록

화면: `/#/profiles`. 홈의 `소개팅 매물 둘러보기` 버튼으로 이동한다.
로그인하지 않은 방문자는 로그인 안내를 보고, 로그인 후 목록으로 돌아온다.
기존 회원가입·프로필 등록의 기본 이동 경로는 유지한다.

- 로그인한 일반 사용자와 주선자는 승인된 매물을 볼 수 있다.
- 나이는 최소·최대 나이를 숫자로 직접 입력한다.
- MBTI·성격·얼굴형·동물상·피부·체형 제목을 누르면 선택 토글이 펼쳐지며, 각 항목에서 여러 값을 동시에 선택할 수 있다.
- 같은 항목에서 선택한 값은 OR, 서로 다른 항목은 AND로 결합한다.
- 로그인 사용자의 등록 프로필 성별은 서버에서 확인하며 남성에게는 여성 매물만, 여성에게는 남성 매물만 반환한다.
- 프로필이 아직 등록되지 않은 회원은 성별을 확인할 수 없으므로 등록 안내를 표시한다.
- 최신 등록 순으로 한 페이지에 최대 24개를 표시한다.
- 연락처, 인증 계정 ID, 주선자 계정 정보, 심사 사유는 목록 응답에 포함하지 않는다.
- 목록 조회는 읽기 전용이며 호감 전송이나 프로필 승인 기능은 포함하지 않는다.

## DB 적용 상태

다중 필터와 반대 성별 제한을 지원하는 `browse_approved_profiles` RPC는
2026-10-10에 운영 DB에 적용됐다.

적용한 migration: `supabase/migrations/20261010140855_approved_profile_browse.sql`.
`supabase/proposals/approved_profile_browse.sql`은 검토 당시 변경안의 보관본이다.
새 다중 필터와 반대 성별 제한은 정식 migration
`supabase/migrations/20261010142958_approved_profile_multi_filters.sql`에 있다.
함수 변동성 선언 보정은
`supabase/migrations/20261010144123_fix_profile_browse_volatility.sql`에 있다.
검토용 초안은 `supabase/proposals/approved_profile_multi_filters.sql`에 보관한다.

변경 범위는 비노출 `listing_api` 스키마, 회원 검사와 승인된 매물의 제한된
소개 정보만 반환하는 내부 함수, `public`의 권한 상승 없는 RPC wrapper 및
authenticated 역할의 실행 권한이다. `listing_api`를 Data API의 exposed
schemas에 추가하지 않는다. 기존 테이블의 RLS와 권한 및 행은 변경하지 않는다.

Supabase CLI의 `migration new`로 각 파일을 생성했다. 매번
`db push --dry-run --skip-vault`로 적용 대상이 해당 migration 한 건뿐인지 확인한
후 운영 DB에 적용했다. 원격 migration history에서 두 버전을 모두 확인했다.

기존 RPC는 공개 키와 실제 회원 세션으로 승인된 상태만 반환, 연락처·계정·심사
정보 제외, 비로그인 접근 거부 및 내부 스키마의 비노출을 확인했다.

## 검증

`npm.cmd run test:db`의 로컬 메모리 DB 검사는 권한 검사, 프로필 미등록 차단,
남녀 계정의 반대 성별 매물 제한, 미승인·비활성 주선자 매물 제외, 응답 필드
제한, 다중 필터 조합, 페이지 분리와 잘못된 입력 거부를 검증한다.
브라우저 검사는 가상 응답으로 필터 그룹 접기·펼치기, 복수 토글, 나이 범위,
모바일 폭과 새 RPC 요청 형식을 확인한다.
브라우저 검사는 실제 Supabase 요청을 차단하며 실제 계정·매물을 생성하지 않는다.

## 자기소개 및 추가 필터 변경

`supabase/migrations/20261010173018_add_profile_intro_and_filters.sql`은 기존 매물에는
영향을 주지 않는 nullable 자기소개 컬럼, 신규 등록의 1~500자 자기소개 검사,
목록의 피부·체형 다중 필터를 추가한다. 운영 DB 적용 전 상태다.
