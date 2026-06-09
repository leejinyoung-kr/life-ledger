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

// 푸시 구독 해제 — 브라우저 구독 취소 + 서버 삭제
export async function disablePush(): Promise<void> {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await api.post('/push/unsubscribe', { endpoint }).catch(() => {});
}
