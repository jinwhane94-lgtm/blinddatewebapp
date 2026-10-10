import { supabase } from '../lib/supabase'

// Credentials go only to Supabase Auth. Never persist passwords in application
// tables, localStorage, logs, or user_metadata. Supabase owns session persistence.
export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
  if (error) throw error
  return data.session
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
  return data.session
}

export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
  // Older Auth responses may omit the structured code. Match known messages;
  // do not echo arbitrary server errors or credentials into the UI.
  const message = error instanceof Error ? error.message : ''
  if (message === 'Invalid login credentials') return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (message === 'Email not confirmed') return '현재 서비스 설정에서는 이메일 확인 후 로그인할 수 있습니다.'
  switch (code) {
    case 'invalid_credentials': return '이메일 또는 비밀번호가 올바르지 않습니다.'
    case 'email_not_confirmed': return '현재 서비스 설정에서는 이메일 확인 후 로그인할 수 있습니다.'
    case 'email_provider_disabled':
    case 'signup_disabled': return '현재 회원가입을 이용할 수 없습니다. 담당자에게 문의해주세요.'
    case 'user_already_exists': return '가입할 수 없는 이메일입니다. 로그인 정보를 확인해주세요.'
    case 'weak_password': return '더 안전한 비밀번호를 입력해주세요.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit': return '잠시 후 다시 시도해주세요.'
    default: return '인증을 완료하지 못했습니다. 입력 내용과 연결 상태를 확인해주세요.'
  }
}
