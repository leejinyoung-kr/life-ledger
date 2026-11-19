// 생활모아 Service Worker
// 보안 주의: 민감 자격증명 앱이므로 API/인증 응답은 절대 캐싱하지 않는다.
// 정적 앱 셸(GET, 네비게이션·정적 에셋)만 캐싱하고, /api 등은 allowlist 밖이라 항상 네트워크로 보낸다.
const CACHE = "life-moa-v1";
// 빌드 파일(/_next/static/) 전용 캐시 — 파일 이름에 내용 해시가 붙어 같은 이름이면 내용도 같다
const STATIC_CACHE = "life-moa-static-v1";
// 배포마다 새 이름의 파일이 쌓이므로 이 개수를 넘으면 먼저 넣은 것부터 지운다 (한 번 화면을 다 열면 100개 안팎)
const STATIC_MAX = 400;
// dev 서버는 /_next/static/ 도 같은 이름으로 새 코드를 내보내므로 캐시하지 않는다
const IS_DEV = ["localhost", "127.0.0.1"].includes(self.location.hostname);

// 런타임 캐싱 제외 경로 — 평문 민감데이터가 디스크에 남지 않도록 차단
const NO_CACHE_PREFIXES = ["/api", "/auth"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// 웹 푸시 수신 — 서버가 보낸 {title, body, url} 표시. 민감정보는 페이로드에 없음(제목/요약만)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "생활모아", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "생활모아";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icons/icon.svg",
        badge: "/icons/icon.svg",
        data: { url: data.url || "/notifications" },
      }),
      // 열린 탭에 알림 도착 신호 → TopBar 종 배지 즉시 갱신
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((list) => list.forEach((c) => c.postMessage({ type: "noti" }))),
    ])
  );
});

// 알림 클릭 — 이미 열린 탭이 있으면 포커스, 없으면 새로 연다
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 페이지 네비게이션/RSC 요청은 캐싱 대상에서 제외 — 같은 URL이라도
  // RSC 요청은 일반 HTML과 다른 페이로드를 기대하므로, URL 기준 캐시를
  // 그대로 반환하면 클라이언트 라우터가 응답을 파싱하지 못해 멈춘다.
  if (
    request.mode === "navigate" ||
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree")
  ) {
    return;
  }

  // 빌드 파일 — 캐시에 있으면 네트워크 없이 바로 쓴다. Cache-Control: immutable 이 붙어 있어도
  // iOS 홈 화면 앱은 실행할 때마다 전부 다시 받아서(2026-11-19 Nginx 로그), 느린 회선에선 첫 화면이 10초 넘게 걸렸다
  if (!IS_DEV && url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticCacheFirst(request));
    return;
  }

  // 동일 출처 + 민감경로·Next.js 번들 아님 + http(s) 만 캐싱 대상
  // 그 밖의 /_next/ (이미지 최적화 등)는 이름에 해시가 없으므로 캐시하지 않는다
  const cacheable =
    url.origin === self.location.origin &&
    !NO_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p)) &&
    !url.pathname.startsWith("/_next/");

  if (!cacheable) return; // 기본 네트워크 동작에 위임 (캐시 안 함)

  // cache-first, 응답 성공 시에만 캐시 갱신
  // 네비게이션 중 취소된 프리페치 요청은 fetch가 거부되므로, 캐시로 폴백하거나 조용히 무시한다
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }).catch(() => Response.error())
    )
  );
});

// 빌드 파일을 캐시 우선으로 — 없으면 받아서 넣고, 개수가 넘치면 오래된 것부터 지운다
async function staticCacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  let res;
  try {
    res = await fetch(request);
  } catch {
    return Response.error();
  }
  if (res.ok && res.type === "basic") {
    await cache.put(request, res.clone());
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_MAX)).map((k) => cache.delete(k)));
  }
  return res;
}
