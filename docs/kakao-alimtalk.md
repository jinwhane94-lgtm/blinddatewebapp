# 호감 수신 카카오 알림톡 운영 가이드

## 현재 구조와 적용 범위

현재 앱에는 공개 프로필 등록과 주선자 로그인/승인 기능만 있고, 일반 사용자 인증이나 기존 호감 전송 UI는 없습니다. 따라서 `public.likes`는 서버 전용 이벤트 테이블로 추가했으며 브라우저 역할에는 INSERT/SELECT 권한을 주지 않았습니다. 향후 호감 UI를 연결할 때는 먼저 로그인 사용자와 `dating_profiles.id`의 소유 관계를 DB에서 검증할 수 있어야 합니다.

연락처는 공개 프로필과 분리된 `private.profile_contacts`에 저장됩니다. `anon`과 `authenticated`에는 private 스키마 사용 권한과 테이블 권한이 없고, 등록 폼은 제한된 `submit_dating_profile` RPC만 호출합니다. 주선자 대시보드의 `dating_profiles.select('*')`에도 휴대폰 번호가 포함되지 않습니다.

## 발송 흐름

1. 신뢰할 수 있는 서버가 `public.likes`에 한 행을 INSERT합니다.
2. Supabase Database Webhook이 `process-like-notification` Edge Function을 호출합니다.
3. 함수가 service-role 전용 `claim_like_notification` RPC로 알림 로그를 생성하고 원자적으로 선점합니다.
4. RPC가 수신 동의와 휴대폰 번호를 private 스키마에서 확인합니다.
5. 동의한 수신자만 SOLAPI 알림톡 API로 전달합니다.
6. 성공, 실패, 수신 여부 불명 상태를 `private.notification_logs`에 기록합니다.

`likes` INSERT와 외부 API 호출은 같은 트랜잭션에 있지 않습니다. 따라서 공급자 장애가 발생해도 호감 행은 그대로 남습니다. `(like_id, notification_type)` 유니크 제약과 `processing` 상태 선점으로 동일 이벤트의 중복 발송을 막습니다. 네트워크 단절처럼 공급자가 접수했는지 모르는 오류는 `delivery_unknown`으로 끝내고 자동 재시도하지 않습니다.

## Supabase 설정

라이브 프로젝트에는 자동 적용하지 않습니다. 배포 전 백업과 테스트 프로젝트 검증 후 다음 순서로 적용합니다.

1. `supabase/migrations/003_like_notifications.sql`을 적용합니다.
2. Edge Function을 배포합니다.

   ```powershell
   npx.cmd supabase functions deploy process-like-notification
   ```

3. Supabase **Settings > API Keys**에서 서버 자동화 전용 secret key를 `automations`라는 이름으로 만듭니다.
4. **Database > Webhooks**에서 다음 webhook을 만듭니다.
   - Table: `public.likes`
   - Event: `INSERT`
   - Method: `POST`
   - Target: Supabase Edge Function `process-like-notification`
   - Header: `apikey: <automations secret key>`
5. `private` 스키마를 Data API의 Exposed schemas 목록에 추가하지 않습니다.

`supabase/config.toml`에서 이 함수의 플랫폼 JWT 검사는 꺼져 있지만, 함수 자체는 `@supabase/server`의 `auth: 'secret:automations'`로 명명된 secret key만 허용합니다. publishable/anon 키나 일반 사용자 JWT로는 호출할 수 없습니다.

## SOLAPI 및 카카오 설정

1. SOLAPI 계정과 카카오 비즈니스 채널을 연결합니다.
2. 정보성 알림톡 템플릿을 등록하고 검수 승인을 받습니다.
3. 템플릿 본문은 아래 변수 이름과 일치시킵니다.
   - `#{서비스명}`
   - `#{호감확인URL}` (본문에서 사용할 때만 필요)
4. 웹 링크 버튼 이름과 URL 형식이 배포 환경의 설정과 정확히 일치하도록 승인받습니다.
5. SOLAPI API Key/API Secret을 발급합니다.

예시 템플릿 문구:

```text
[#{서비스명}]
새로운 호감이 도착했어요 💌

누군가 회원님의 프로필에 호감을 표시했습니다.
서비스에서 확인해 주세요.
```

버튼은 `호감 확인하기` 웹 링크로 등록하고, 실제 배포 URL의 `/#/likes`로 연결합니다. 현재 구현은 SMS fallback을 명시적으로 끕니다. 향후 fallback을 추가할 때는 `_shared/notifications` 아래 공급자 어댑터를 확장하고 별도 수신 정책·로그 상태를 정의합니다.

## Edge Function Secrets

실제 값은 저장소나 `VITE_*` 환경변수에 넣지 않습니다. 로컬 템플릿은 `supabase/functions/.env.example`에 있습니다.

- `SOLAPI_API_KEY`
- `SOLAPI_API_SECRET`
- `SOLAPI_KAKAO_PF_ID`
- `SOLAPI_KAKAO_TEMPLATE_ID`
- `KAKAO_ALIMTALK_SERVICE_NAME`
- `KAKAO_ALIMTALK_BUTTON_NAME`
- `KAKAO_ALIMTALK_BUTTON_URL`

프로덕션에서는 Supabase Dashboard의 **Edge Functions > Secrets**에 저장하거나 다음 명령을 사용합니다.

```powershell
npx.cmd supabase secrets set --env-file supabase/functions/.env
```

## 테스트

프론트엔드 회귀 테스트:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e
```

DB 테스트는 로컬 또는 명시적으로 선택한 테스트 Supabase 프로젝트에서만 migration 적용 후 실행합니다.

```powershell
npx.cmd supabase test db supabase/tests/like_notifications_smoke.sql
```

CLI 버전에 따라 단일 SQL 파일 실행 명령이 다르면 SQL Editor에서 파일 전체를 실행해도 됩니다. 테스트는 트랜잭션 끝에서 ROLLBACK하며 외부 SOLAPI를 호출하지 않습니다. 다음을 검사합니다.

- 연락처/로그를 브라우저 역할이 SELECT할 수 없음
- 미동의 및 연락처 없음 상태가 `skipped` 처리됨
- 동의한 수신자만 발송 대상으로 선점됨
- 같은 like의 중복 선점과 같은 쌍의 중복 like가 차단됨
- 알림 실패 후에도 like 행이 유지됨

실제 발송 테스트는 카카오/SOLAPI의 테스트 정책과 비용을 확인한 뒤, 별도 테스트 프로젝트와 테스트 수신번호에서 한 건만 수행합니다.

## 배포 전 체크리스트

- migration을 먼저 적용한 뒤 프론트엔드를 배포합니다. 적용 전 프론트엔드는 새 RPC를 찾지 못합니다.
- `private`가 Data API에 노출되지 않았는지 확인합니다.
- `anon`/`authenticated`가 `profile_contacts`, `notification_logs`, `likes`에 직접 권한이 없는지 확인합니다.
- `automations` secret key가 브라우저, GitHub Pages 변수, 로그에 포함되지 않았는지 확인합니다.
- 템플릿 ID, 채널 ID, 변수명, 버튼명, 운영 URL이 승인된 템플릿과 일치하는지 확인합니다.
- Database Webhook의 INSERT 이벤트와 `apikey` 헤더를 확인합니다.
- Edge Function 로그와 `private.notification_logs`의 `failed`/`delivery_unknown` 행에 대한 운영 대응 절차를 정합니다.
- 일반 사용자 호감 UI를 추가하기 전, 인증 사용자와 프로필 소유권을 DB에서 검증하는 모델을 먼저 추가합니다.
