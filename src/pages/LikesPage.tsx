import { Link } from 'react-router-dom'

export default function LikesPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <main className="section-card max-w-sm w-full text-center animate-slide-up">
        <div className="text-5xl mb-4" aria-hidden="true">💌</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-3">새로운 호감이 도착했어요</h1>
        <p className="text-sm leading-relaxed text-gray-600">
          매칭 정보는 개인정보 보호를 위해 담당 주선자를 통해 안전하게 안내됩니다.
        </p>
        <Link to="/" className="btn-primary mt-6 w-full">
          서비스 홈으로 이동
        </Link>
      </main>
    </div>
  )
}
