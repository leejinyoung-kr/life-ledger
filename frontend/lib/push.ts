/**
 * 웹 푸시 구독 헬퍼.
 * 백엔드 VAPID 공개키를 받아 브라우저 PushManager 로 구독하고, 구독 정보를 서버에 저장한다.
 * VAPID 키가 서버에 없으면(enabled=false) 모든 함수가 조용히 실패(no-op)한다.
 */

import { api } from './api';

interface PublicKeyRes {
  enabled: boolean;
  publicKey: string | null;
}

// Base64URL VAPID 키 → Uint8Array (PushManager.subscribe applicationServerKey 형식)
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  // ArrayBuffer 를 명시 할당해 applicationServerKey(BufferSource) 타입과 호환되게 한다
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// 브라우저가 푸시를 지원하는지 (SW + PushManager + Notification)
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// 서버에서 VAPID 공개키/활성여부 조회
export async function fetchPushStatus(): Promise<PublicKeyRes> {
  try {
    return await api.get<PublicKeyRes>('/push/public-key');
  } catch {
    return { enabled: false, publicKey: null };
  }
}

// 현재 브라우저가 이미 구독 중인지
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// 푸시 구독 — 권한 요청 → PushManager 구독 → 서버 저장. 성공 시 true
export async function enablePush(): Promise<boolean> {
  if (!isPushSupported()) throw new Error('이 브라우저는 푸시를 지원하지 않습니다.');

  const status = await fetchPushStatus();
  if (!status.enabled || !status.publicKey) {
    throw new Error('서버에 푸시 키(VAPID)가 설정되지 않았습니다.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('알림 권한이 거부되었습니다.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(status.publicKey),
    });
  }

  await api.post('/push/subscribe', sub.toJSON());
  return true;
}

// 페이지를 새로 불러온 뒤 한 번만 — 화면을 옮길 때마다 AppShell 이 다시 마운트돼도 다시 보내지 않는다
let synced = false;

// 이 브라우저가 이미 구독 중이면 서버에 다시 등록 — 구독을 지금 로그인 세션에 묶는다
// (로그아웃하면 서버가 그 세션의 구독을 지우므로, 다시 로그인했을 때 이걸로 되살아난다). 실패는 조용히 넘긴다
export async function syncPushSubscription(): Promise<void> {
  if (synced || !isPushSupported() || Notification.permission !== 'granted') return;
  synced = true;
  try {
    const sub = await getCurrentSubscription();
    if (sub) await api.post('/push/subscribe', sub.toJSON());
  } catch {
    synced = false;
  }
}

// 로그아웃 뒤 같은 페이지에서 다시 로그인하면(이메일 로그인은 새로고침이 없다) 다시 등록하게 표시를 지운다
export function resetPushSync(): void {
  synced = false;
}

// 테스트 푸시 발송 — 본인 모든 기기로 더미 알림. 서버활성/구독수 반환(진단용)
export async function sendTestPush(): Promise<{ enabled: boolean; subscriptions: number }> {
  return api.post<{ enabled: boolean; subscriptions: number }>('/push/test', {});
}

// 푸시 구독 해제 — 브라우저 구독 취소 + 서버 삭제
export async function disablePush(): Promise<void> {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await api.post('/push/unsubscribe', { endpoint }).catch(() => {});
}
