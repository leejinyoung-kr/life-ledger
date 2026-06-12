"use client";

import { useEffect } from "react";

// PWA 서비스워커 등록 — dev에서도 등록해야 푸시 토글/테스트(serviceWorker.ready 대기)가 동작한다
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
