'use client';

/**
 * 계정 보관함 페이지.
 * 저장된 계정(아이디/비밀번호)을 표로 보고, 행 클릭 시 상세 모달에서 마스킹·복사한다.
 * 비밀번호/TOTP 원문은 reveal API 로만 받아오며, 데이터는 백엔드(/credentials)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Modal/Button/Badge/Field). 표+모바일카드 패턴.
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import { notify } from '@/lib/toast';
import AppShell from '@/components/AppShell';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import {
  IconSearch, IconEdit, IconTrash, IconClose, IconCopy, IconEye,
} from '@/components/icons';
import { api } from '@/lib/api';
import {
  CRED_CATEGORIES, fmtCredDate, pwStrength,
  type Credential, type CredentialSecret,
} from '@/lib/credential';

const ICON_BTN = 'w-7 h-7 rounded-[5px] flex items-center justify-center text-muted transition-all shrink-0 hover:bg-elevated hover:text-accent';
const FILTER_CATEGORIES = ['전체 카테고리', ...CRED_CATEGORIES];

export default function CredentialsPage() {
  const [list, setList] = useState<Credential[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체 카테고리');
  const [detail, setDetail] = useState<Credential | null>(null);
  const [edit, setEdit] = useState<{ open: boolean; editing: Credential | null }>({ open: false, editing: null });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmElement } = useConfirm();

  // 계정 목록 조회
  const load = useCallback(async () => {
    try {
      setList(await api.get<Credential[]>('/credentials'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 검색어 + 카테고리 필터
  const rows = list.filter((c) => {
    const matchCat = category === '전체 카테고리' || c.category === category;
    const q = query.trim().toLowerCase();
    const matchQuery = !q || c.name.toLowerCase().includes(q) || (c.url ?? '').toLowerCase().includes(q) || c.username.toLowerCase().includes(q);
    return matchCat && matchQuery;
  });

  const totalPages = Math.ceil(rows.length / limit);
  const paged = rows.slice((page - 1) * limit, page * limit);
  const no2fa = list.filter((c) => !c.has2fa).length;

  // 계정 삭제
  async function remove(c: Credential) {
    if (!await confirm(`'${c.name}' 계정을 삭제할까요?`, 'danger')) return;
    try {
      await api.del(`/credentials/${c.id}`);
      notify.deleted('계정');
      setDetail(null);
      load();
    } catch {
      notify.deleteFailed();
    }
  }

  return (
    <AppShell activePath="/credentials" topbarLabel="계정 보관함">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">계정 보관함</h1>
          <p className="text-sm text-secondary mt-1.5">행을 클릭하면 상세 정보를 확인할 수 있습니다. (AES-256-GCM 암호화)</p>
        </div>
        <Button onClick={() => setEdit({ open: true, editing: null })}>계정 추가</Button>
      </div>

      {error && <p className="mb-4 text-[0.78rem] text-danger">⚠️ {error}</p>}

      {/* 보안 경고 배너 — 2FA 미설정 계정 수 */}
      {no2fa > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-warning-dim border border-[rgba(247,144,9,0.2)] rounded-[var(--radius)] mb-5 text-[0.82rem]">
          <span>🔐</span>
          <span className="flex-1 text-secondary">2FA 미설정 계정이 <strong>{no2fa}건</strong> 있습니다. 2단계 인증 설정을 권장합니다.</span>
        </div>
      )}

      {/* 검색 툴바 */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted w-[15px] h-[15px] pointer-events-none" />
          <input className="input pl-icon" type="text" placeholder="서비스명, URL, 아이디 검색..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="계정 검색" />
        </div>
        <select className="input w-auto min-w-[130px] shrink-0" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="카테고리 필터">
          {FILTER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted text-[0.82rem]">총 {rows.length}개</span>
          <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
        </div>
      </div>

      {/* 테이블 + 모바일 카드 */}
      <div className="bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="table-wrap max-md:hidden">
          <table>
            <thead>
              <tr>
                <th>서비스</th><th>카테고리</th><th>아이디</th><th>수정일</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <tr><td colSpan={5} className="td-center td-muted">저장된 계정이 없습니다.</td></tr>}
              {paged.map((c) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-[30px] h-[30px] rounded-md bg-elevated border border-border flex items-center justify-center text-[0.9rem] shrink-0">{c.emoji ?? '🔑'}</div>
                      <div>
                        <div className="font-medium text-[0.875rem] text-primary">{c.name}</div>
                        <div className="text-[0.72rem] text-muted">{c.url ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td-center"><Badge tone="neutral">{c.category}</Badge></td>
                  <td className="td-mono">{c.username}</td>
                  <td className="td-muted">{fmtCredDate(c.updatedAt)}</td>
                  <td className="td-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center gap-1">
                      <button type="button" className={`${ICON_BTN} border border-border hover:text-primary`} onClick={() => setEdit({ open: true, editing: c })} aria-label="수정"><IconEdit width={14} height={14} /></button>
                      <button type="button" className="w-7 h-7 rounded-[5px] inline-flex items-center justify-center bg-danger-dim text-danger transition-all hover:bg-[rgba(240,68,56,0.15)]" onClick={() => remove(c)} aria-label="삭제"><IconTrash width={14} height={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 모바일 카드 */}
        <div className="hidden max-md:flex flex-col gap-2.5 p-3">
          {paged.length === 0 && <div className="text-center text-muted py-7">저장된 계정이 없습니다.</div>}
          {paged.map((c) => (
            <div className="border border-border rounded-[var(--radius-lg)] p-3.5 bg-background" key={c.id} onClick={() => setDetail(c)}>
              <div className="flex items-center gap-2.5">
                <div className="w-[30px] h-[30px] rounded-md bg-elevated border border-border flex items-center justify-center text-[0.9rem] shrink-0">{c.emoji ?? '🔑'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[0.95rem] text-primary truncate">{c.name}</div>
                  <div className="text-[0.72rem] text-muted truncate">{c.url ?? '—'}</div>
                </div>
                <Badge tone="neutral">{c.category}</Badge>
              </div>
              <div className="mt-2 text-[0.78rem] text-secondary [font-family:var(--font-mono)] truncate">{c.username}</div>
              <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" className="flex-1" onClick={() => setEdit({ open: true, editing: c })}>수정</Button>
                <Button variant="danger" className="flex-1" onClick={() => remove(c)}>삭제</Button>
              </div>
            </div>
          ))}
        </div>

        <Pagination page={page} totalPages={totalPages} totalItems={rows.length} onPageChange={setPage} />
      </div>

      {/* 상세 모달 */}
      <DetailModal
        cred={detail}
        onClose={() => setDetail(null)}
        onEdit={() => { const c = detail; setDetail(null); setEdit({ open: true, editing: c }); }}
        onDelete={() => detail && remove(detail)}
      />

      {/* 추가/수정 모달 */}
      <EditModal state={edit} onClose={() => setEdit((s) => ({ ...s, open: false }))} onSaved={() => { setEdit({ open: false, editing: null }); load(); }} />
      {confirmElement}
    </AppShell>
  );
}

// 계정 상세 모달 — 열릴 때 reveal 로 원문을 받아 비밀번호 마스킹/표시/복사 (표시 시 10초 후 자동 숨김)
function DetailModal({ cred, onClose, onEdit, onDelete }: { cred: Credential | null; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const [secret, setSecret] = useState<CredentialSecret | null>(null);
  const [pwVisible, setPwVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 모달이 바뀌면 원문을 새로 받아오고 비밀번호는 다시 가린다
  useEffect(() => {
    setPwVisible(false);
    setSecret(null);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!cred) return;
    api.get<CredentialSecret>(`/credentials/${cred.id}/reveal`).then(setSecret).catch(() => {});
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [cred]);

  if (!cred) return null;

  // 비밀번호 표시/숨김 토글 — 표시 시 10초 뒤 자동 숨김 예약
  function togglePw() {
    setPwVisible((v) => {
      const next = !v;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (next) hideTimer.current = setTimeout(() => setPwVisible(false), 10000);
      return next;
    });
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => notify.copied()).catch(() => {});
  }

  const pw = secret?.password ?? '';
  const maskedPw = '•'.repeat(Math.min(pw.length || 8, 16));

  const header = (
    <div className="flex items-center gap-3.5 px-6 pt-5 pb-4 border-b border-border">
      <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-surface border border-border flex items-center justify-center text-[1.5rem] shrink-0">{cred.emoji ?? '🔑'}</div>
      <div className="flex-1">
        <div className="[font-family:var(--font-display)] text-base font-bold text-primary">{cred.name}</div>
        <div className="text-[0.78rem] text-muted mt-0.5">{cred.url ?? '—'}</div>
      </div>
      <Badge tone="neutral">{cred.category}</Badge>
      <button type="button" className="w-[34px] h-[34px] inline-flex items-center justify-center rounded-[var(--radius)] text-secondary border border-border transition-all hover:bg-surface hover:text-primary" onClick={onClose} aria-label="닫기">
        <IconClose width={16} height={16} />
      </button>
    </div>
  );

  return (
    <Modal
      open={!!cred}
      onClose={onClose}
      title={cred.name}
      className="max-w-[440px]"
      header={header}
      footer={
        <>
          <Button variant="danger" className="mr-auto" onClick={onDelete}>삭제</Button>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button onClick={onEdit}>수정</Button>
        </>
      }
    >
      {/* 아이디 */}
      <DetailField label="아이디">
        <span className="flex-1 [font-family:var(--font-mono)] text-[0.875rem] text-primary truncate">{cred.username}</span>
        <button type="button" className={ICON_BTN} onClick={() => copy(cred.username)} aria-label="아이디 복사"><IconCopy width={14} height={14} /></button>
      </DetailField>

      {/* 비밀번호 */}
      <DetailField label="비밀번호">
        <span className={`flex-1 [font-family:var(--font-mono)] text-[0.875rem] truncate ${pwVisible ? 'text-primary' : 'tracking-[0.25em] text-muted'}`}>{pwVisible ? pw : maskedPw}</span>
        <button type="button" className={ICON_BTN} onClick={togglePw} aria-label="비밀번호 표시/숨김" disabled={!secret}><IconEye width={14} height={14} /></button>
        <button type="button" className={ICON_BTN} onClick={() => copy(pw)} aria-label="비밀번호 복사" disabled={!secret}><IconCopy width={14} height={14} /></button>
      </DetailField>

      {/* 2FA */}
      {secret?.totp && (
        <DetailField label="2FA (TOTP)">
          <span className="flex-1 [font-family:var(--font-mono)] text-[0.78rem] text-secondary truncate">{secret.totp}</span>
          <button type="button" className={ICON_BTN} onClick={() => copy(secret.totp ?? '')} aria-label="TOTP 복사"><IconCopy width={14} height={14} /></button>
        </DetailField>
      )}

      {/* 메모 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted">메모</span>
        <div className="text-[0.855rem] text-secondary px-3 py-2.5 bg-surface border border-border rounded-[var(--radius)] min-h-[38px] leading-normal">{cred.memo || '—'}</div>
      </div>

      <div className="text-[0.72rem] text-muted pt-1">수정일: {fmtCredDate(cred.updatedAt)}</div>
    </Modal>
  );
}

// 상세 필드 (라벨 + 값 행)
function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted">{label}</span>
      <div className="flex items-center gap-2 bg-surface border border-border rounded-[var(--radius)] px-3 py-2.5">{children}</div>
    </div>
  );
}

// 계정 추가·수정 모달 (수정 시 비밀번호는 입력해야만 변경)
function EditModal({ state, onClose, onSaved }: { state: { open: boolean; editing: Credential | null }; onClose: () => void; onSaved: () => void }) {
  const editing = state.editing;
  const [emoji, setEmoji] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState(CRED_CATEGORIES[0]);
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [totp, setTotp] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    setErrors({});
    setEmoji(editing?.emoji ?? '');
    setServiceName(editing?.name ?? '');
    setUrl(editing?.url ?? '');
    setCategory(editing?.category ?? CRED_CATEGORIES[0]);
    setUsername(editing?.username ?? '');
    setPw('');
    setTotp('');
    setMemo(editing?.memo ?? '');
  }, [state.open, editing]);

  function clearErr(field: string) { setErrors((p) => { const n = { ...p }; delete n[field]; return n; }); }

  function validate() {
    const err: Record<string, string> = {};
    if (!serviceName.trim()) err.serviceName = '서비스명을 입력하세요.';
    if (!username.trim()) err.username = '아이디를 입력하세요.';
    if (!editing && !pw) err.pw = '비밀번호를 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!validate()) return;
    const body = {
      name: serviceName.trim(),
      emoji: emoji || undefined,
      url: url || undefined,
      category,
      username: username.trim(),
      ...(pw ? { password: pw } : {}),
      totp: totp || undefined,
      memo: memo || undefined,
    };
    setSaving(true);
    try {
      if (editing) await api.put(`/credentials/${editing.id}`, body);
      else await api.post('/credentials', body);
      notify.upserted(editing ? 'edit' : 'add', '계정');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  const strength = pwStrength(pw);
  const STRENGTH_FILL = { danger: 'danger', warning: 'warning', green: '' } as const;
  const STRENGTH_TEXT = { danger: 'text-danger', warning: 'text-warning', green: 'text-accent' } as const;

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={editing ? '계정 수정' : '계정 추가'}
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} saveLabel="저장 (암호화)" />}
    >
      <div className="grid grid-cols-[80px_1fr] gap-4 max-md:grid-cols-1">
        <Field label="이모지"><input type="text" className="input" placeholder="🐙" value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="이모지" /></Field>
        <Field label="서비스명" required error={errors.serviceName}>
          <input type="text" className={`input${errors.serviceName ? ' is-invalid' : ''}`} placeholder="예: GitHub" value={serviceName} onChange={(e) => { setServiceName(e.target.value); clearErr('serviceName'); }} />
        </Field>
      </div>
      <Field label="URL"><input type="url" className="input" placeholder="https://github.com" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
      <Field label="카테고리" required>
        <select className="input" aria-label="카테고리" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CRED_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="아이디" required error={errors.username}>
        <input type="text" className={`input${errors.username ? ' is-invalid' : ''}`} placeholder="아이디 또는 이메일" value={username} onChange={(e) => { setUsername(e.target.value); clearErr('username'); }} />
      </Field>
      <Field label={editing ? '비밀번호 (변경 시에만 입력)' : '비밀번호'} required={!editing} error={errors.pw}>
        <input type="password" className={`input${errors.pw ? ' is-invalid' : ''}`} placeholder={editing ? '비워두면 기존 비밀번호 유지' : '비밀번호'} value={pw} onChange={(e) => { setPw(e.target.value); clearErr('pw'); }} />
        {pw && (
          <>
            <div className="track"><div className={`fill ${STRENGTH_FILL[strength.tone]}`} style={{ width: `${strength.pct}%` }} /></div>
            <span className={`text-[0.72rem] ${STRENGTH_TEXT[strength.tone]}`}>강도: {strength.label}</span>
          </>
        )}
      </Field>
      <Field label="2단계 인증 (TOTP, 선택)">
        <input type="text" className="input input-mono" placeholder="otpauth:// 또는 시크릿 키" value={totp} onChange={(e) => setTotp(e.target.value)} />
      </Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 정보" value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
    </Modal>
  );
}
