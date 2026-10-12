'use client';

/**
 * 신원 지갑 페이지.
 * 여권·신분증·운전면허·자격증을 색상 카드로 보관하고 만료일(D-day)을 추적한다.
 * 번호는 기본 마스킹하고 토글 시 reveal API 로 원문을 받아 표시한다. (AES-256-GCM)
 * 데이터는 백엔드 API(/identities)와 연동한다. 스타일: Tailwind + 공통 컴포넌트.
 */
import { useEffect, useMemo, useState } from 'react';
import { notify } from '@/lib/toast';
import { eulreul } from '@/lib/korean';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import ErrorBanner from '@/components/ErrorBanner';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import { IconAlertCircle, IconEye, IconEdit, IconTrash } from '@/components/icons';
import { api } from '@/lib/api';
import { useFormErrors } from '@/lib/useFormErrors';
import {
  ID_TYPE_LABEL, ID_TYPE_OPTIONS, ID_VARIANT_BG, fmtDate, ddayOf,
  type IdCard, type IdType,
} from '@/lib/identity';

export default function IdWalletPage() {
  const [numbers, setNumbers] = useState<Record<number, string>>({}); // 복호화 캐시
  const [shown, setShown] = useState<Set<number>>(new Set());          // 표시 중인 카드
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing: IdCard | null }>({ open: false, mode: 'add', editing: null });
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  // 신원 문서 목록 (React Query 캐시)
  const cardsQuery = useApiQuery<IdCard[]>(qk.identity.list(), '/identities');
  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);
  const error = cardsQuery.error?.message ?? null;
  const reload = () => invalidate(qk.identity.all);

  // 번호 표시/숨김 토글 — 처음 표시할 때만 reveal API 로 원문을 받아 캐시
  async function handleToggleNum(card: IdCard) {
    const next = new Set(shown);
    if (next.has(card.id)) {
      next.delete(card.id);
      setShown(next);
      return;
    }
    if (!numbers[card.id]) {
      try {
        const { number } = await api.get<{ number: string }>(`/identities/${card.id}/reveal`);
        setNumbers((p) => ({ ...p, [card.id]: number }));
      } catch {
        notify.error('번호를 불러오지 못했습니다.');
        return;
      }
    }
    next.add(card.id);
    setShown(next);
  }

  // 신원 문서 삭제
  async function handleRemove(card: IdCard) {
    if (!await confirm(`'${card.name}'${eulreul(card.name)} 삭제할까요?`, 'danger')) return;
    try {
      await api.del(`/identities/${card.id}`);
      notify.deleted('신분증');
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 사본 이미지 미리보기 — presigned inline URL 발급 후 새 탭으로 열기
  async function handleViewFile(card: IdCard) {
    if (!card.fileId) return;
    try {
      const { url } = await api.get<{ url: string }>(`/files/${card.fileId}/url?disposition=inline`);
      window.open(url, '_blank', 'noopener');
    } catch {
      notify.error('사본을 불러오지 못했습니다.');
    }
  }

  // 만료 임박(60일 이내) 카드 중 가장 급한 것 — 경고 배너용
  const soonest = cards
    .map((c) => ({ card: c, dd: ddayOf(c.expireDate) }))
    .filter((x) => x.dd.warn)
    .sort((a, b) => (a.card.expireDate ?? '').localeCompare(b.card.expireDate ?? ''))[0];

  return (
    <AppShell activePath="/id-wallet" topbarLabel="신원 지갑">
      <PageHeader

        title="신원 지갑"

        description="신분증·여권·자격증을 안전하게 보관하고 만료일을 추적합니다. (AES-256-GCM)"

        actions={<Button onClick={() => setModal({ open: true, mode: 'add', editing: null })}>신분증 추가</Button>}

      />

      <ErrorBanner message={error} className="mb-4" />

      {/* 만료 임박 경고 */}
      {soonest && (
        <div className="flex items-center gap-3 px-[18px] py-3.5 rounded-[var(--radius-lg)] bg-warning-dim border border-[rgba(247,144,9,0.2)] mb-6">
          <IconAlertCircle width={20} height={20} className="text-warning shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-[0.875rem] text-primary">{soonest.card.name} 만료 임박 — {soonest.dd.text}</div>
            <div className="text-[0.8rem] text-secondary">유효기간이 얼마 남지 않았습니다. 갱신을 준비하세요.</div>
          </div>
        </div>
      )}

      {cards.length === 0 && !error && (
        <div className="text-center text-muted py-16">저장된 신원 문서가 없습니다.</div>
      )}

      {/* 신분증 카드 그리드 */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {cards.map((card) => {
          const dd = ddayOf(card.expireDate);
          const isShown = shown.has(card.id);
          return (
            <div className={`rounded-[var(--radius-lg)] p-5 text-white shadow-[var(--shadow-md)] relative overflow-hidden min-h-[180px] flex flex-col justify-between ${ID_VARIANT_BG[card.type]}`} key={card.id}>
              <div>
                <div className="text-[0.72rem] opacity-85 uppercase tracking-[0.08em] font-semibold">{ID_TYPE_LABEL[card.type]}</div>
                <div className="[font-family:var(--font-display)] text-[1.2rem] font-bold mt-1">{card.name}</div>
                <div className="[font-family:var(--font-mono)] text-base tracking-[0.1em] my-3.5">{isShown ? numbers[card.id] : card.numberMasked}</div>
              </div>
              <div className="flex justify-between items-end text-[0.75rem] opacity-90">
                <div>
                  <div>발급 {fmtDate(card.issueDate)}</div>
                  <div>만료 {fmtDate(card.expireDate)}</div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-bold ${dd.warn ? 'bg-warning text-white' : 'bg-white/20'}`}>{dd.text}</span>
                  <div className="flex gap-1.5">
                    <IconButton label="번호 표시/숨김" variant="overlay" size="card" onClick={() => handleToggleNum(card)}>
                      <IconEye width={14} height={14} />
                    </IconButton>
                    {card.fileId && (
                      <IconButton label="사본 보기" variant="overlay" size="card" onClick={() => handleViewFile(card)} title="사본 이미지 보기">
                        🖼️
                      </IconButton>
                    )}
                    <IconButton label="수정" variant="overlay" size="card" onClick={() => setModal({ open: true, mode: 'edit', editing: card })}>
                      <IconEdit width={14} height={14} />
                    </IconButton>
                    <IconButton label="삭제" variant="overlay" size="card" onClick={() => handleRemove(card)}>
                      <IconTrash width={14} height={14} />
                    </IconButton>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <IdModal
        state={modal}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal({ open: false, mode: 'add', editing: null }); setShown(new Set()); setNumbers({}); reload(); }}
      />
      {confirmElement}
    </AppShell>
  );
}

// 신분증 추가·수정 모달 (수정 시 번호는 입력해야만 변경)
function IdModal({ state, onClose, onSaved }: { state: { open: boolean; mode: 'add' | 'edit'; editing: IdCard | null }; onClose: () => void; onSaved: () => void }) {
  const isEdit = state.mode === 'edit';
  const editing = state.editing;
  const [type, setType] = useState<IdType>('passport');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [memo, setMemo] = useState('');
  const [fileId, setFileId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setType(editing?.type ?? 'passport');
    setName(editing?.name ?? '');
    setNumber('');
    setIssueDate(editing?.issueDate ?? '');
    setExpireDate(editing?.expireDate ?? '');
    setMemo(editing?.memo ?? '');
    setFileId(editing?.fileId ?? null);
  }, [state.open, editing, reset]);

  // 사본 이미지 업로드 — 파일 보관함에 저장 후 file.id 를 연결값으로 보관
  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const r = await api.upload<{ id: number }>('/files/upload', file);
      setFileId(r.id);
      notify.success('사본 이미지를 첨부했습니다.');
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = '명칭을 입력하세요.';
    if (!isEdit && !number.trim()) err.number = '번호를 입력하세요.';
    setErrors(err);
    if (Object.keys(err).length) return;

    const body = {
      type,
      name: name.trim(),
      ...(number.trim() ? { number: number.trim() } : {}),
      issueDate: issueDate || undefined,
      expireDate: expireDate || undefined,
      memo: memo || undefined,
      fileId, // null 이면 사본 해제, 숫자면 연결
    };
    setSaving(true);
    try {
      if (isEdit && editing) await api.put(`/identities/${editing.id}`, body);
      else await api.post('/identities', body);
      notify.upserted(isEdit ? 'edit' : 'add', '신분증');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={isEdit ? '신분증 수정' : '신분증 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} saveLabel="저장 (암호화)" />}>
      <Field label="종류" required>
        <select className="input" aria-label="종류" value={type} onChange={(e) => setType(e.target.value as IdType)}>
          {ID_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="명칭" required error={errors.name}>
        <input type="text" className="input" placeholder="예: 대한민국 여권" value={name} onChange={(e) => { setName(e.target.value); clearError('name'); }} />
      </Field>
      <Field label={isEdit ? '번호 (변경 시에만 입력)' : '번호'} required={!isEdit} error={errors.number}>
        <input type="text" className="input input-mono" placeholder={isEdit ? '비워두면 기존 번호 유지' : '문서 번호'} value={number} onChange={(e) => { setNumber(e.target.value); clearError('number'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="발급일 (선택)"><input type="date" className="input" aria-label="발급일" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
        <Field label="만료일 (선택)"><input type="date" className="input" aria-label="만료일" value={expireDate} onChange={(e) => setExpireDate(e.target.value)} /></Field>
      </div>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
      <Field label="사본 이미지 (선택)">
        <div className="flex items-center gap-2">
          <label className="excel-btn upload">
            {uploading ? '업로드 중...' : fileId ? '사본 변경' : '사본 업로드'}
            <input type="file" accept="image/*,.pdf" hidden onChange={handleUploadFile} disabled={uploading} />
          </label>
          {fileId && (
            <>
              <span className="text-[0.78rem] text-accent">첨부됨</span>
              <button type="button" className="text-[0.78rem] text-danger hover:underline" onClick={() => setFileId(null)}>제거</button>
            </>
          )}
        </div>
      </Field>
    </Modal>
  );
}
