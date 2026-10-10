# 주선자 로그인 연결 복구

Supabase Authentication의 이메일·비밀번호 인증과 앱의 주선자 권한은 별개다.
기존 `coordinators` 행이 활성 상태여도 `auth_user_id`가 해당 Auth 사용자 ID와
연결되어 있지 않으면 주선자 대시보드에 접근할 수 없다.

## 기존 계정 연결

프로젝트 루트의 무시되는 로컬 `.env`에 `VITE_SUPABASE_URL`과 서버 전용
`SUPABASE_SECRET_KEY`를 설정한다. 서버 키에 `VITE_` 접두사를 붙이지 않는다.
Supabase Authentication에서 대상 계정의 User UID를 확인한다.

먼저 읽기 전용으로 대상 계정과 변경 범위를 검사한다.

```powershell
node scripts/link-coordinator.mjs --email "manager@example.com" --auth-user-id "<Auth User UID>"
```

`ready`이면 이메일이 일치하는 인증 계정과 연결이 비어 있는 활성 주선자 행이
확인된 상태다. **AGENTS.md에 따른 실제 데이터 변경 승인을 받은 뒤에만** 실행한다.

```powershell
node scripts/link-coordinator.mjs --email "manager@example.com" --auth-user-id "<Auth User UID>" --apply
```

이 작업은 기존 행의 `auth_user_id`만 수정한다. 다른 계정에 연결되어 있거나,
비활성 상태이거나, 확인 중 행이 변경되면 적용을 중단한다. 이미 올바르게
연결되어 있으면 `already-linked`를 반환한다. 인증 계정이나 프로필은 생성하지 않는다.

적용 후 `http://localhost:5173/#/manager/login`에서 로그인하고 대시보드 진입과
새로고침 후 세션 유지를 확인한다. `0.0.0.0`은 개발 서버의 수신 주소이며,
브라우저에서는 `localhost` 또는 실제 PC IP를 사용한다.

안전장치 테스트(실제 Supabase 접근 없음):

```powershell
node --test tests/scripts/link-coordinator.test.mjs
```
