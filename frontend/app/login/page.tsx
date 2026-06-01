export default function LoginPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

  return (
    <div className="login-bg">
      {/* grid pattern */}
      <div className="login-grid" aria-hidden />
      {/* radial glow */}
      <div className="login-glow" aria-hidden />

      <div className="login-card">
        {/* Logo */}
        <div className="logo">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
            <rect x="2" y="2" width="8" height="8" rx="2" fill="var(--accent)" />
            <rect x="12" y="2" width="8" height="8" rx="2" fill="var(--accent)" opacity=".3" />
            <rect x="2" y="12" width="8" height="8" rx="2" fill="var(--accent)" opacity=".3" />
            <rect x="12" y="12" width="8" height="8" rx="2" fill="var(--accent)" opacity=".12" />
          </svg>
          Doc<span style={{ color: 'var(--accent)' }}>Nexus</span>
        </div>

        <h1 className="login-title">DocNexus가 지켜드리는 것</h1>
        <p className="login-sub">로그인하고 나만의 보안 관리 허브를 시작하세요.</p>

        {/* Feature list */}
        <ul className="feature-list">
          <li className="feature-item">
            <CheckMark />
            <div>
              <strong>AES-256 완전 암호화</strong>
              <span>계정·ENV·신원 문서, 내 서버에서만 복호화</span>
            </div>
          </li>
          <li className="feature-item">
            <CheckMark />
            <div>
              <strong>비밀번호 없는 로그인</strong>
              <span>Google OAuth 2.0으로 안전하게, 별도 비밀번호 불필요</span>
            </div>
          </li>
          <li className="feature-item">
            <CheckMark />
            <div>
              <strong>제3자 공유 없음</strong>
              <span>내 데이터는 오직 나만 접근. 마케팅·광고 활용 없음</span>
            </div>
          </li>
        </ul>

        {/* Google login button */}
        <a
          href={`${backendUrl}/api/v1/auth/google`}
          className="btn-google"
        >
          <GoogleIcon />
          Google 계정으로 계속하기
        </a>

        <p className="login-notice">
          로그인 시{' '}
          <a href="#">이용약관</a> 및{' '}
          <a href="#">개인정보 처리방침</a>에 동의합니다.
        </p>
      </div>

      <style>{`
        .login-bg {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: var(--bg-surface);
          padding: 24px;
          position: relative;
        }
        .login-grid {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: .35;
          pointer-events: none;
        }
        .login-glow {
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: min(560px, 90vw);
          height: min(560px, 90vw);
          background: radial-gradient(circle, var(--accent-glow) 0%, transparent 65%);
          pointer-events: none;
        }
        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 460px;
          background: var(--bg-base);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          padding: clamp(28px, 5vw, 40px) clamp(20px, 5vw, 36px);
          animation: fadeUp .4s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: var(--text-primary);
          margin-bottom: 28px;
        }
        .login-title {
          font-size: clamp(1rem, 3vw, 1.15rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          color: var(--text-primary);
          margin-bottom: 6px;
        }
        .login-sub {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .feature-list {
          list-style: none;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          margin-bottom: 24px;
        }
        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 15px 18px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-base);
          transition: background var(--ease);
        }
        .feature-item:last-child { border-bottom: none; }
        .feature-item:hover { background: var(--bg-hover); }
        .feature-item > div { flex: 1; }
        .feature-item strong {
          display: block;
          font-size: 0.845rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 2px;
        }
        .feature-item span {
          font-size: 0.775rem;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .btn-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          background: var(--bg-base);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text-primary);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--ease);
          text-decoration: none;
          margin-bottom: 14px;
        }
        .btn-google:hover {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-dim);
          background: var(--bg-hover);
        }
        .login-notice {
          text-align: center;
          font-size: 0.69rem;
          color: var(--text-muted);
          line-height: 1.7;
        }
        .login-notice a {
          color: var(--accent);
          text-decoration: none;
        }
        .login-notice a:hover { opacity: .7; }
      `}</style>
    </div>
  );
}

function CheckMark() {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: 'var(--accent-dim)',
        border: '1.5px solid rgba(0,192,127,.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
      }}
    >
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
