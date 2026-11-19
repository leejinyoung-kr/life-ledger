import type { MetadataRoute } from "next";

// PWA 매니페스트 — Next 메타데이터 시스템이 /manifest.webmanifest 로 자동 서빙
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "생활모아",
    short_name: "생활모아",
    description: "자산 · 구독 · 계정을 한곳에서 관리하는 개인 생활 장부",
    // "/" 는 /dashboard 로 넘기는 왕복이 한 번 더 든다 — 느린 회선에선 그 한 번이 2 ~ 6초였다 (2026-11-19 Nginx 로그)
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#00C07F",
    icons: [
      // SVG 단일 아이콘으로 모든 해상도 커버 (any) + 마스커블 안전영역 포함
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
