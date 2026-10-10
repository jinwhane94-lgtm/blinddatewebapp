import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '../lib/schemas'
import { supabase } from '../lib/supabase'
import { Toast, useToast } from '../components/Toast'
import { getCoordinatorByAuthUser } from '../services/coordinatorService'

const accessMessages: Record<string, string> = {
  'session-required': '주선자 페이지를 이용하려면 로그인해주세요.',
  'lookup-failed': '로그인은 되었지만 주선자 권한을 조회하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.',
  'not-coordinator': '이 계정에서 활성 주선자 등록을 확인할 수 없습니다. 관리자에게 계정 연결과 활성 상태를 확인해주세요.',
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (/invalid login credentials/i.test(error.message)) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    }
    if (/email not confirmed/i.test(error.message)) {
      return '이메일 인증이 완료되지 않은 계정입니다.'
    }
  }

  return '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
}

export default function ManagerLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [accessError, setAccessError] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true)
    setAccessError('')
    // Clear a previous route-guard message before attempting a fresh login.
    navigate('/manager/login', { replace: true, state: null })
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      })
      if (error) throw error
      if (!authData.session || !authData.user) {
        setAccessError(accessMessages['session-required'])
        return
      }
      try {
        const coordinator = await getCoordinatorByAuthUser(authData.user.id)
        if (!coordinator) {
          setAccessError(accessMessages['not-coordinator'])
          return
        }
      } catch {
        setAccessError(accessMessages['lookup-failed'])
        return
      }

      // Confirm the session is available from the same client storage that
      // useSession reads after the route changes. This avoids the dashboard
      // guard seeing a transient null session and redirecting back to login.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        setAccessError(accessMessages['session-required'])
        return
      }
      navigate('/manager/dashboard', { replace: true })
    } catch (err: unknown) {
      showToast(getLoginErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">💼</div>
          <h1 className="text-2xl font-extrabold text-gray-800">주선자<span aria-hidden="true" className="ml-1 text-sm">👑</span> 로그인</h1>
          <p className="text-sm text-gray-500 mt-2">주선자 계정으로 로그인하세요</p>
        </div>

        {/* Form */}
        <div className="section-card">
          {(accessError || accessMessages[location.state?.managerAccess]) && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {accessError || accessMessages[location.state?.managerAccess]}
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-busy={loading}>
            <div>
              <label htmlFor="manager-email" className="form-label">이메일</label>
              <input
                id="manager-email"
                type="email"
                {...register('email')}
                className="form-input"
                placeholder="example@email.com"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="manager-password" className="form-label">비밀번호</label>
              <input
                id="manager-password"
                type="password"
                {...register('password')}
                className="form-input"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
              />
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  로그인 중...
                </>
              ) : '로그인'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          주선자 계정이 없다면 관리자에게 문의하세요
        </p>
        <div className="text-center mt-3">
          <Link to="/" className="text-xs text-brand-500 hover:underline">← 홈으로</Link>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
