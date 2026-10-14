/**
 * 로그인 페이지 (독립 풀스크린, AppShell 미사용).
 * Google OAuth + 이메일 코드 로그인 진입점. 데모 빌드(NEXT_PUBLIC_DEMO_MODE)는 '데모로 둘러보기' 만 둔다.
 */
import EmailLoginForm from './EmailLoginForm';
import DemoLoginButton from './DemoLoginButton';
import { IS_DEMO } from '@/lib/demo';
import LoginGate from './LoginGate';
import Wordmark from '@/components/Wordmark';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ErrorBanner';
import { IconShieldCheck, IconLock, IconBan } from '@/components/icons';

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
      {/* 넓은 화면은 가운데 흰 카드, 휴대폰은 카드 없이 바탕 위에 */}
      <div className="flex justify-center items-start sm:items-center min-h-screen bg-page px-4 py-10">
        <div className="w-full max-w-110 flex flex-col gap-6 sm:px-8 sm:py-9 sm:bg-background sm:border sm:border-border sm:rounded-panel sm:shadow-raised">
          <div className="flex flex-col gap-2">
            <h1><Wordmark size="lg" /></h1>
            <p className="text-[0.875rem] text-secondary break-keep">가계부 · 구독 · 계정 · 파일을 한곳에 모아 두는 개인 장부입니다.</p>
          </div>

          {/* 접근 거부 안내 — 허용되지 않은 구글 계정 */}
          <ErrorBanner
            className=""
            message={isNotAllowed ? '허용되지 않은 계정입니다. 이 계정은 접근 권한이 없으니 등록된 계정으로 로그인하세요.' : null}
          />

          <ul className="flex flex-col gap-2.5 px-4 py-3.5 rounded-ui bg-surface">
            {FEATURES.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-[0.8125rem] text-secondary break-keep">
                <Icon width={16} height={16} className="shrink-0 mt-0.5 text-accent-dark" />
                {text}
              </li>
            ))}
          </ul>

          {/* 데모 빌드는 데모 입장만, 운영 빌드는 Google · 이메일 로그인 */}
          {IS_DEMO ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col">
                <span className="text-[0.875rem] text-primary">포트폴리오를 보러 오셨나요?</span>
                <span className="text-[0.78rem] text-muted">샘플 데이터가 담긴 데모 계정입니다. 로그인 없이 바로 둘러볼 수 있습니다.</span>
              </div>
              <DemoLoginButton apiBase={`${backendUrl}/api/v1`} />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <Button href={`${backendUrl}/api/v1/auth/google`} variant="ghost" size="lg" className="w-full">
                <GoogleIcon />
                Google 계정으로 계속하기
              </Button>
              <EmailLoginForm apiBase={`${backendUrl}/api/v1`} />
            </div>
          )}

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

// 로그인 전 짧은 소개 — 실제 동작만 적는다
const FEATURES = [
  { Icon: IconLock, text: '계정 비밀번호 · 2FA 는 AES-256-GCM 으로 암호화' },
  { Icon: IconShieldCheck, text: '허용된 계정만 로그인 (Google · 이메일 인증코드)' },
  { Icon: IconBan, text: '광고 · 외부 공유 없음' },
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
