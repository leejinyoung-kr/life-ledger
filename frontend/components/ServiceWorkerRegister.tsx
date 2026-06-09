"use client";

import { useEffect } from "react";

// PWA 서비스워커 등록 — 프로덕션에서만 등록해 dev HMR과 캐시 충돌을 피한다
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
