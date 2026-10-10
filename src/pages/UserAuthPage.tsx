import { useState } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSession } from '../hooks/useSession'
import { authErrorMessage, signInWithPassword, signUpWithPassword } from '../services/authService'

const credentialsSchema = z.object({
  email: z.string().trim().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
  passwordConfirmation: z.string().optional(),
})
const signupSchema = credentialsSchema.superRefine((data, ctx) => {
  if (data.password.length < 8) ctx.addIssue({ code: 'custom', path: ['password'], message: '비밀번호는 8자 이상 입력해주세요.' })
  if (data.password !== data.passwordConfirmation) ctx.addIssue({ code: 'custom', path: ['passwordConfirmation'], message: '비밀번호가 일치하지 않습니다.' })
})
type Credentials = z.infer<typeof credentialsSchema>

export default function UserAuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup'
  const { session, loading } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = location.state?.returnTo === '/profiles' ? '/profiles' : '/apply'
  const [message, setMessage] = useState('')
  const { register, handleSubmit, resetField, formState: { errors, isSubmitting } } = useForm<Credentials>({
    resolver: zodResolver(signup ? signupSchema : credentialsSchema),
  })
  if (!loading && session && !session.user.is_anonymous) return <Navigate to={returnTo} replace />

  const submit = async ({ email, password }: Credentials) => {
    setMessage('')
    try {
      const result = signup ? await signUpWithPassword(email, password) : await signInWithPassword(email, password)
      if (result) navigate(returnTo, { replace: true })
      else setMessage('가입 요청을 접수했습니다. 이메일 확인이 필요한 경우 받은 메일을 확인한 뒤 로그인해주세요.')
    } catch (error: unknown) {
      setMessage(authErrorMessage(error))
    } finally {
      resetField('password')
      resetField('passwordConfirmation')
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <main className="section-card w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">{signup ? '회원가입' : '회원 로그인'}</h1>
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4" aria-busy={isSubmitting}>
          <div>
            <label htmlFor="member-email" className="form-label">이메일</label>
            <input id="member-email" type="email" autoComplete="email" {...register('email')} className="form-input" aria-invalid={Boolean(errors.email)} />
            {errors.email && <p className="form-error">{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="member-password" className="form-label">비밀번호</label>
            <input id="member-password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} {...register('password')} className="form-input" aria-invalid={Boolean(errors.password)} />
            {errors.password && <p className="form-error">{errors.password.message}</p>}
          </div>
          {signup && <div>
            <label htmlFor="member-password-confirmation" className="form-label">비밀번호 확인</label>
            <input id="member-password-confirmation" type="password" autoComplete="new-password" {...register('passwordConfirmation')} className="form-input" aria-invalid={Boolean(errors.passwordConfirmation)} />
            {errors.passwordConfirmation && <p className="form-error">{errors.passwordConfirmation.message}</p>}
          </div>}
          {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
          <button type="submit" className="btn-primary w-full" disabled={isSubmitting || loading}>
            {isSubmitting ? '처리 중...' : signup ? '회원가입' : '로그인'}
          </button>
        </form>
        <Link className="mt-5 block text-sm text-brand-500" to={signup ? '/login' : '/signup'} state={{ returnTo }}>
          {signup ? '이미 계정이 있으신가요? 로그인' : '처음이신가요? 회원가입'}
        </Link>
        <Link to="/" className="mt-3 block text-sm text-gray-500">홈으로</Link>
      </main>
    </div>
  )
}
