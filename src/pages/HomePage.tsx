import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-16 text-center">
        <div className="animate-slide-up max-w-sm mx-auto">
          <div className="text-6xl mb-6">💕</div>
          <h1 className="text-4xl font-extrabold text-gray-800 mb-3 leading-tight">
            당신의 인연을<br />찾아드립니다
          </h1>
          <p className="text-gray-500 text-base leading-relaxed mb-10">
            주선자가 직접 관리하는 신뢰할 수 있는<br />소개팅 매칭 서비스입니다.
          </p>

          {/* CTA */}
          <Link to="/apply" className="btn-primary w-full text-base py-4 block text-center">
            소개팅 매물 등록하기 →
          </Link>

          <p className="text-sm text-gray-400 mt-5">
            주선자라면?{' '}
            <Link to="/manager/login" className="text-brand-500 font-semibold hover:underline">
              주선자 로그인
            </Link>
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white border-t border-gray-100 px-5 py-10">
        <div className="max-w-sm mx-auto">
          <h2 className="text-base font-bold text-gray-700 mb-6 text-center">서비스 특징</h2>
          <div className="space-y-4">
            {[
              { icon: '🔒', title: '안전한 정보 관리', desc: '개인정보는 담당 주선자만 열람할 수 있습니다.' },
              { icon: '✅', title: '주선자 심사', desc: '등록된 프로필은 주선자가 직접 검토 후 승인합니다.' },
              { icon: '💌', title: '맞춤 매칭', desc: '취향과 조건을 상세히 입력해 정확한 매칭을 받으세요.' },
            ].map((f) => (
              <div key={f.title} className="flex gap-4 items-start">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">{f.title}</h3>
                  <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-gray-300">
        © 2024 소개팅 매칭 서비스
      </div>
    </div>
  )
}
