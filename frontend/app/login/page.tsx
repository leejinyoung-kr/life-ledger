/**
 * 로그인 페이지 (독립 풀스크린, AppShell 미사용).
 * Google OAuth + 이메일 코드 로그인 진입점. 스타일: Tailwind (토큰 var() 활용).
 */
import EmailLoginForm from './EmailLoginForm';
import LoginGate from './LoginGate';

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
    <div className="flex items-center justify-center min-h-screen bg-surface px-3 py-6 sm:p-6 relative">
      {/* grid pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-35 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:40px_40px]" aria-hidden />
      {/* radial glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,90vw)] h-[min(560px,90vw)] pointer-events-none [background:radial-gradient(circle,var(--accent-glow)_0%,transparent_65%)]" aria-hidden />

      <div className="relative z-[1] w-full max-w-[460px] bg-background border border-border rounded-panel shadow-overlay px-[clamp(20px,5vw,36px)] py-[clamp(28px,5vw,40px)] [animation:slideUp_0.4s_ease_both]">
        {/* Logo */}
        <div className="flex items-center gap-[9px] text-[1.1rem] font-extrabold tracking-[-0.04em] text-primary mb-7">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
            <rect x="2" y="2" width="8" height="8" rx="2" fill="var(--accent)" />
            <rect x="12" y="2" width="8" height="8" rx="2" fill="var(--accent)" opacity=".3" />
            <rect x="2" y="12" width="8" height="8" rx="2" fill="var(--accent)" opacity=".3" />
            <rect x="12" y="12" width="8" height="8" rx="2" fill="var(--accent)" opacity=".12" />
          </svg>
          Doc<span className="text-accent">Nexus</span>
        </div>

        <h1 className="text-[clamp(1rem,3vw,1.15rem)] font-bold tracking-[-0.03em] text-primary mb-1.5 break-keep">DocNexus가 지켜드리는 것</h1>
        <p className="text-[0.8rem] text-secondary leading-relaxed mb-6 break-keep">로그인하고 나만의 보안 관리 허브를 시작하세요.</p>

        {/* 접근 거부 안내 — 허용되지 않은 구글 계정 */}
        {isNotAllowed && (
          <div className="flex items-start gap-2.5 px-3.5 py-3 mb-6 rounded-ui border border-danger/30 bg-danger-dim" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-px text-danger" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1">
              <strong className="block text-[0.82rem] font-semibold text-danger mb-0.5">허용되지 않은 계정</strong>
              <span className="text-[0.76rem] text-secondary leading-normal">이 계정은 접근 권한이 없습니다. 등록된 계정으로 로그인하세요.</span>
            </div>
          </div>
        )}

        {/* Feature list */}
        <ul className="list-none border border-border rounded-ui overflow-hidden mb-6">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3.5 px-[18px] py-[15px] border-b border-border-subtle last:border-b-0 bg-background transition-colors hover:bg-surface">
              <CheckMark />
              <div className="flex-1 min-w-0">
                <strong className="block text-[0.845rem] font-semibold text-primary mb-0.5 break-keep">{f.title}</strong>
                <span className="text-[0.775rem] text-muted leading-normal break-keep">{f.desc}</span>
              </div>
            </li>
          ))}
        </ul>

        {/* Google login button */}
        <a
          href={`${backendUrl}/api/v1/auth/google`}
          className="w-full flex items-center justify-center gap-2.5 p-3 bg-background border border-border rounded-ui text-primary text-[0.875rem] font-medium cursor-pointer transition-all no-underline mb-3.5 hover:border-accent hover:bg-surface hover:shadow-[0_0_0_3px_var(--accent-dim)]"
        >
          <GoogleIcon />
          Google 계정으로 계속하기
        </a>

        {/* 로컬 개발 전용 원클릭 로그인 — production 빌드에서는 렌더하지 않음(백엔드도 별도로 차단) */}
        {process.env.NODE_ENV !== 'production' && (
          <a
            href={`${backendUrl}/api/v1/auth/dev-login`}
            className="w-full flex items-center justify-center gap-2.5 p-3 bg-background border border-dashed border-border rounded-ui text-secondary text-[0.8rem] font-medium cursor-pointer transition-all no-underline mb-3.5 hover:border-accent hover:text-primary"
          >
            🛠️ 로컬 개발 로그인 (dev-login)
          </a>
        )}

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-3.5 text-[0.7rem] text-muted">
          <span className="flex-1 h-px bg-border" />
          또는
          <span className="flex-1 h-px bg-border" />
        </div>

        {/* 이메일 코드 로그인 (구글 불가 환경 대체 수단) */}
        <EmailLoginForm apiBase={`${backendUrl}/api/v1`} />

        <p className="text-center text-[0.69rem] text-muted leading-[1.7] mt-3.5 break-keep [&_a]:text-accent [&_a:hover]:opacity-70">
          로그인 시{' '}
          <a href="#">이용약관</a> 및{' '}
          <a href="#">개인정보 처리방침</a>에 동의합니다.
        </p>
      </div>
    </div>
    </LoginGate>
  );
}

const FEATURES = [
  { title: 'AES-256 완전 암호화', desc: '계정 정보, 내 서버에서만 복호화' },
  { title: '비밀번호 없는 로그인', desc: 'Google OAuth 2.0으로 안전하게, 별도 비밀번호 불필요' },
  { title: '제3자 공유 없음', desc: '내 데이터는 오직 나만 접근. 마케팅·광고 활용 없음' },
];

function CheckMark() {
  return (
    <span className="w-[22px] h-[22px] rounded-full bg-accent-dim border-[1.5px] border-accent/30 flex items-center justify-center shrink-0 mt-px">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

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
