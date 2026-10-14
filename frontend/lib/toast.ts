/**
 * 공통 토스트 알림 모듈.
 * CRUD·엑셀 등 표준 문구를 한곳에서 관리한다. 각 페이지는 notify.* 로 호출한다.
 * 한글 받침 유무로 조사(이/가·을/를)를 자동 선택한다.
 */
import { toast } from 'sonner';
import { iga, eulreul } from './korean';

export const notify = {
  // ── 성공 ──────────────────────────────────────────
  added: (label = '항목') => toast.success(`${label}${iga(label)} 추가됐습니다.`),
  updated: (label = '항목') => toast.success(`${label}${iga(label)} 수정됐습니다.`),
  deleted: (label = '항목') => toast.success(`${label}${iga(label)} 삭제됐습니다.`),
  saved: (label?: string) => toast.success(label ? `${label}${iga(label)} 저장됐습니다.` : '저장됐습니다.'),
  // 추가/수정 모드 분기
  upserted: (mode: 'add' | 'edit', label = '항목') =>
    mode === 'edit' ? notify.updated(label) : notify.added(label),
  restored: (label = '항목') => toast.success(`${label}${eulreul(label)} 복구했습니다.`),
  restoredAll: () => toast.success('전체 복구됐습니다.'),
  purged: () => toast.success('영구 삭제됐습니다.'),
  emptied: () => toast.success('휴지통을 비웠습니다.'),
  copied: () => toast.success('클립보드에 복사됐습니다.'),
  downloaded: (what = '파일') => toast.success(`${what}${eulreul(what)} 다운로드했습니다.`),
  excelDownloaded: () => toast.success('엑셀 파일을 다운로드했습니다.'),
  // 0건이면 빈 양식을 올린 경우라 '0건 추가' 대신 채워 달라고 안내한다
  excelUploaded: (count: number) => (count > 0
    ? toast.success(`${count}건이 추가됐습니다.`)
    : toast.warning('추가할 줄이 없습니다. 양식에 내역을 채워서 올려 주세요.')),
  excelPartial: (imported: number, failed: number, detail = '') =>
    toast.warning(`${imported}건 추가 · ${failed}건 실패${detail}`),

  // ── 실패 ──────────────────────────────────────────
  saveFailed: () => toast.error('저장에 실패했습니다.'),
  deleteFailed: () => toast.error('삭제에 실패했습니다.'),
  updateFailed: () => toast.error('수정에 실패했습니다.'),
  loadFailed: () => toast.error('불러오지 못했습니다.'),

  // ── 안내 ──────────────────────────────────────────
  comingSoon: () => toast('준비 중인 기능입니다.'),

  // ── passthrough (특수 문구) ───────────────────────
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg),
};

// 텍스트를 클립보드에 복사하고 성공 토스트를 띄운다 (실패는 조용히 무시).
export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => notify.copied()).catch(() => {});
}
