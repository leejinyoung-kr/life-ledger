/**
 * 로그인 페이지 (독립 풀스크린, AppShell 미사용).
 * Google OAuth + 이메일 코드 로그인 진입점.
 */
import EmailLoginForm from './EmailLoginForm';
import LoginGate from './LoginGate';
import Wordmark from '@/components/Wordmark';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ErrorBanner';
import { IconShieldCheck, IconKey, IconBan } from '@/components/icons';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';
  // 허용되지 않은 계정 로그인 시 백엔드가 ?error=not_allowed 로 리다이렉트
  const isNotAllowed = (await searchParams).error === 'not_allowed';

  return (
    <LoginGate>
      <div className="flex justify-center items-start min-h-screen bg-page px-4 py-10 sm:py-16">
        <div className="w-full max-w-105 flex flex-col gap-5 sm:px-6 sm:py-8 sm:border sm:border-border sm:rounded-panel">
          <div className="flex items-baseline gap-2">
            <Wordmark size="lg" />
            <span className="text-[0.75rem] text-muted">생활 장부</span>
          </div>

          <div className="flex flex-col gap-1">
            <h1 className="[font-family:var(--font-display)] [font-variant-numeric:lining-nums] font-semibold text-[1.5rem] text-primary break-keep">LifeLedger가 지켜드리는 것</h1>
            <p className="text-[0.84rem] text-muted break-keep">로그인하고 나만의 생활 장부를 시작하세요.</p>
          </div>

          {/* 접근 거부 안내 — 허용되지 않은 구글 계정 */}
          <ErrorBanner
            className=""
            message={isNotAllowed ? '허용되지 않은 계정입니다. 이 계정은 접근 권한이 없으니 등록된 계정으로 로그인하세요.' : null}
          />

          <ul className="flex flex-col border-y border-border">
            {FEATURES.map(({ Icon, title, desc }) => (
              <li key={title} className="flex gap-3 py-3 border-b border-border-subtle last:border-b-0">
                <Icon width={18} height={18} className="shrink-0 mt-0.5 text-accent" />
                <div className="flex flex-col min-w-0">
                  <strong className="font-semibold text-primary break-keep">{title}</strong>
                  <span className="text-[0.78rem] text-muted break-keep">{desc}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2.5">
            <Button href={`${backendUrl}/api/v1/auth/google`} size="lg" className="w-full">
              <GoogleIcon />
              Google 계정으로 계속하기
            </Button>
            <EmailLoginForm apiBase={`${backendUrl}/api/v1`} />
          </div>

          {/* 로컬 개발 전용 원클릭 로그인 — production 빌드에서는 렌더하지 않음(백엔드도 별도로 차단) */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="flex items-center gap-3 pt-3.5 border-t border-dashed border-border">
              <span className="flex-1 text-[0.78rem] text-muted">로컬 개발 환경에서만 보입니다.</span>
              <Button href={`${backendUrl}/api/v1/auth/dev-login`} variant="ghost">
                로컬 개발 로그인 (dev-login)
              </Button>
            </div>
          )}
        </div>
      </div>
    </LoginGate>
  );
}

const FEATURES = [
  { Icon: IconShieldCheck, title: 'AES-256 완전 암호화', desc: '계정 정보, 내 서버에서만 복호화' },
  { Icon: IconKey, title: '비밀번호 없는 로그인', desc: 'Google OAuth 2.0으로 안전하게, 별도 비밀번호 불필요' },
  { Icon: IconBan, title: '제3자 공유 없음', desc: '내 데이터는 오직 나만 접근. 마케팅·광고 활용 없음' },
];

// 구글 로고 (브랜드 색 고정)
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
