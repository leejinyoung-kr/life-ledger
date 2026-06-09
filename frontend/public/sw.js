// DocNexus Service Worker
// 보안 주의: 민감 자격증명 앱이므로 API/인증 응답은 절대 캐싱하지 않는다.
// 정적 앱 셸(GET, 네비게이션·정적 에셋)만 캐싱하고, /api 등은 allowlist 밖이라 항상 네트워크로 보낸다.
const CACHE = "docnexus-v1";

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
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
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
    data = { title: "DocNexus", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "DocNexus";
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
  // 동일 출처 + 민감경로 아님 + http(s) 만 캐싱 대상
  const cacheable =
    url.origin === self.location.origin &&
    !NO_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p));

  if (!cacheable) return; // 기본 네트워크 동작에 위임 (캐시 안 함)

  // cache-first, 응답 성공 시에만 캐시 갱신
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
        })
    )
  );
});
