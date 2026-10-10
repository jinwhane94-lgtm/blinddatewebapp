#!/usr/bin/env node
/**
 * create-coordinator.js
 *
 * 주선자 계정을 Supabase에 생성하는 로컬 전용 스크립트.
 * Service Role / Secret Key를 사용하므로 절대 공개 레포나 프론트엔드에 넣지 마세요.
 *
 * 사용 방법:
 *   1. 프로젝트 루트의 .env 파일에 아래 내용 입력
 *      (VITE_ 주석 없이 순수 서버 사이드용 변수로 추가)
 *      SUPABASE_URL=<your-supabase-url>
 *      SUPABASE_SECRET_KEY=<your-secret-key>
 *
 *   2. 터미널에서 스크립트 실행:
 *      node scripts/create-coordinator.js --name "홍길동" --email "hong@example.com" --password "securepassword"
 */

const path = require('path')

// Load env from project root .env
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
} catch {
  // dotenv may not be installed; fall back to process.env
}

const { createClient } = require('@supabase/supabase-js')

const args = process.argv.slice(2)
const getArg = (flag) => {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : null
}

const name = getArg('--name')
const email = getArg('--email')
const password = getArg('--password')

if (!name || !email || !password) {
  console.error('Usage: node scripts/create-coordinator.js --name "이름" --email "email@example.com" --password "password"')
  process.exit(1)
}

// Support alternative env names
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !secretKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set in project root .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`주선자 생성 중: ${name} (${email})`)

  // Create auth user
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (userError) {
    console.error('Auth 사용자 생성 실패:', userError.message)
    process.exit(1)
  }

  const userId = userData.user.id
  console.log('Auth 사용자 생성 완료. ID:', userId)

  // Insert coordinator record
  const { data: coordData, error: coordError } = await supabase
    .from('coordinators')
    .insert({ auth_user_id: userId, name, email, active: true })
    .select()
    .single()

  if (coordError) {
    console.error('coordinators 테이블 삽입 실패:', coordError.message)
    process.exit(1)
  }

  console.log('주선자 등록 완료!')
  console.log('  ID        :', coordData.id)
  console.log('  이름      :', coordData.name)
  console.log('  이메일    :', coordData.email)
  console.log('  Auth UID  :', userId)
}

main()
