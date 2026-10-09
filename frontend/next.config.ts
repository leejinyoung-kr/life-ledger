import type { NextConfig } from "next";

// 모든 경로에 붙는 보안 헤더 — 프레임 삽입(클릭재킹) · MIME 추측 · 리퍼러 · 기기 권한 차단.
// 전체 CSP 는 Next 인라인 스크립트 때문에 아직 넣지 않는다
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
