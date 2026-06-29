import type { MetadataRoute } from "next";

// PWA 매니페스트 — Next 메타데이터 시스템이 /manifest.webmanifest 로 자동 서빙
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DocNexus",
    short_name: "DocNexus",
    description: "보안 문서 관리 허브",
    start_url: "/",
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
