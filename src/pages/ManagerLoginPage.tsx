import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '../lib/schemas'
import { supabase } from '../lib/supabase'
import { Toast, useToast } from '../components/Toast'

export default function ManagerLoginPage() {
  const navigate = useNavigate()
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
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) throw error
      navigate('/manager/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로그인에 실패했습니다.'
      showToast(msg, 'error')
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
          <h1 className="text-2xl font-extrabold text-gray-800">주선자 로그인</h1>
          <p className="text-sm text-gray-500 mt-2">주선자 계정으로 로그인하세요</p>
        </div>

        {/* Form */}
        <div className="section-card">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label className="form-label">이메일</label>
              <input
                type="email"
                {...register('email')}
                className="form-input"
                placeholder="example@email.com"
                autoComplete="email"
              />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <div>
              <label className="form-label">비밀번호</label>
              <input
                type="password"
                {...register('password')}
                className="form-input"
                placeholder="••••••••"
                autoComplete="current-password"
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
