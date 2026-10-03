import { Link } from 'react-router-dom'

export default function DevPage() {
  // Only available in dev mode
  if (!import.meta.env.DEV) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-700">접근 불가</h1>
          <p className="text-gray-500 text-sm mt-2">이 페이지는 개발 환경에서만 사용 가능합니다.</p>
          <Link to="/" className="text-brand-500 text-sm mt-4 inline-block hover:underline">← 홈으로</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-5 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🛠️</div>
          <h1 className="text-2xl font-bold text-gray-800">개발자 도구</h1>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mt-2 inline-block">
            ⚠️ 개발 환경 전용 안내 페이지
          </p>
        </div>

        <div className="section-card text-sm text-gray-600">
          <h2 className="font-bold text-lg text-gray-800 mb-4">💡 주선자 계정 생성 안내</h2>
          <p className="mb-4">
            보안을 위해 <strong>브라우저에서 직접 주선자 계정을 생성하는 기능은 제공하지 않습니다.</strong>
            프론트엔드에는 <code>Anon Key</code>만 노출하고 있으며, 계정 권한 관리를 위해 가입은 관리자에 의해서만 수행되어야 합니다.
          </p>

          <h3 className="font-bold text-gray-700 mb-2 mt-6">계정 생성 방법</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-3">
            개발자 로컬 환경에서 <code>scripts/create-coordinator.js</code> 노드 스크립트를 실행하여 안전하게 주선자를 등록하세요. (Service Role Key 필요)
          </p>

          <ol className="list-decimal list-inside space-y-3 p-4 bg-gray-50 rounded-xl">
            <li>
              프로젝트 루트의 <code>.env</code> 파일에 환경변수를 추가합니다. (VITE_ 접두어 없이 추가)
              <pre className="bg-gray-100 p-2 mt-1 rounded text-xs select-all">
{`SUPABASE_URL=여기에_Project_URL
SUPABASE_SECRET_KEY=여기에_Secret_Key`}
              </pre>
            </li>
            <li>
              터미널에서 아래 명령어로 스크립트를 실행합니다.
              <pre className="bg-gray-100 p-2 mt-1 rounded text-xs overflow-x-auto whitespace-pre select-all">
{`node scripts/create-coordinator.js \\
  --name "홍길동" \\
  --email "hong@example.com" \\
  --password "securepassword123"`}
              </pre>
            </li>
          </ol>
        </div>

        <div className="text-center mt-8">
          <Link to="/" className="inline-flex items-center text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
