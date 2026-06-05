'use client';

/**
 * 계정 보관함 페이지.
 * 저장된 계정(아이디/비밀번호)을 표로 보고, 행 클릭 시 상세 모달에서 마스킹·복사한다.
 * 공통 레이아웃(AppShell)·모달(Modal)을 재사용하고 데이터는 더미로 채운다.
 * 스타일: Tailwind + 공통 컴포넌트(Modal/Button/Badge/Field). 표+모바일카드 패턴.
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Field, ModalFooter } from '@/components/ui/Field';
import {
  IconDownload, IconFileBlank, IconUpload, IconSearch, IconEdit, IconTrash,
  IconClose, IconCopy, IconEye,
} from '@/components/icons';

interface Credential {
  name: string; emoji: string; url: string; id: string; pw: string;
  cat: string; memo: string; date: string;
}

// 상세 모달 아이콘 버튼
const ICON_BTN = 'w-7 h-7 rounded-[5px] flex items-center justify-center text-muted transition-all shrink-0 hover:bg-elevated hover:text-accent';

// ── 더미 데이터 (TODO: GET /api/v1/credentials) ─────────────────
const CREDENTIALS: Credential[] = [
  { name: 'GitHub',     emoji: '🐙', url: 'github.com',     id: 'myusername',     pw: 'p@ssw0rd123!',  cat: '개발', memo: '2FA 활성화됨', date: '2025.05.29' },
  { name: '카카오뱅크', emoji: '🏦', url: 'kakaobank.com', id: '010-1234-5678',  pw: 'bank1234!',     cat: '금융', memo: '',            date: '2025.04.20' },
  { name: '쿠팡',       emoji: '📦', url: 'coupang.com',   id: 'user@email.com', pw: 'shopping99!',   cat: '쇼핑', memo: '',            date: '2025.03.15' },
  { name: '넷플릭스',   emoji: '🎬', url: 'netflix.com',   id: 'user@email.com', pw: 'netflix2025!',  cat: '구독', memo: '가족 플랜',   date: '2025.02.01' },
];

const CATEGORIES = ['전체 카테고리', '개발', '금융', '소셜', '쇼핑', '구독', '기타'];

export default function CredentialsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체 카테고리');
  const [detail, setDetail] = useState<Credential | null>(null);
  const [edit, setEdit] = useState<{ open: boolean; mode: 'add' | 'edit' }>({ open: false, mode: 'add' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // 검색어 + 카테고리로 더미 데이터 필터
  const rows = CREDENTIALS.filter((c) => {
    const matchCat = category === '전체 카테고리' || c.cat === category;
    const q = query.trim().toLowerCase();
    const matchQuery = !q || c.name.toLowerCase().includes(q) || c.url.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    return matchCat && matchQuery;
  });

  const totalPages = Math.ceil(rows.length / limit);
  const paged = rows.slice((page - 1) * limit, page * limit);

  return (
    <AppShell activePath="/credentials" topbarLabel="계정 보관함">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">계정 보관함</h1>
          <p className="text-sm text-secondary mt-1.5">행을 클릭하면 상세 정보를 확인할 수 있습니다. (AES-256-GCM 암호화)</p>
        </div>
        <Button onClick={() => setEdit({ open: true, mode: 'add' })}>계정 추가</Button>
      </div>

      {/* 보안 경고 배너 */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-warning-dim border border-[rgba(247,144,9,0.2)] rounded-[var(--radius)] mb-5 text-[0.82rem]">
        <span>🔁</span>
        <span className="flex-1 text-secondary">재사용·취약 비밀번호 <strong>5건</strong>, 2FA 미설정 <strong>5건</strong>이 감지됐습니다.</span>
        <Button href="#" variant="ghost" size="sm">보안 센터</Button>
      </div>

      {/* 엑셀 툴바 — TODO: 다운로드/업로드 API 연동 */}
      <div className="flex gap-2 flex-wrap items-center mb-5 px-4 py-3 bg-surface border border-border rounded-[var(--radius)]">
        <span className="text-[0.75rem] font-semibold text-muted whitespace-nowrap mr-1">엑셀</span>
        <button type="button" className="excel-btn"><IconDownload />데이터 다운로드</button>
        <div className="w-px bg-border self-stretch mx-1 shrink-0" />
        <button type="button" className="excel-btn"><IconFileBlank />양식 다운로드</button>
        <label className="excel-btn upload">
          <IconUpload />엑셀 업로드
          <input type="file" accept=".xlsx,.xls,.csv" hidden />
        </label>
      </div>

      {/* 검색 툴바 */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted w-[15px] h-[15px] pointer-events-none" />
          <input className="input pl-[34px]" type="text" placeholder="서비스명, URL, 아이디 검색..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="계정 검색" />
        </div>
        <select className="input w-auto min-w-[130px] shrink-0" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="카테고리 필터">
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
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
                <tr key={c.name} className="cursor-pointer" onClick={() => setDetail(c)}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-[30px] h-[30px] rounded-md bg-elevated border border-border flex items-center justify-center text-[0.9rem] shrink-0">{c.emoji}</div>
                      <div>
                        <div className="font-medium text-[0.875rem] text-primary">{c.name}</div>
                        <div className="text-[0.72rem] text-muted">{c.url}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td-center"><Badge tone="neutral">{c.cat}</Badge></td>
                  <td className="td-mono">{c.id}</td>
                  <td className="td-muted">{c.date}</td>
                  <td className="td-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center gap-1">
                      <button type="button" className={`${ICON_BTN} border border-border hover:text-primary`} onClick={() => setEdit({ open: true, mode: 'edit' })} aria-label="수정"><IconEdit width={14} height={14} /></button>
                      <button type="button" className="w-7 h-7 rounded-[5px] inline-flex items-center justify-center bg-danger-dim text-danger transition-all hover:bg-[rgba(240,68,56,0.15)]" aria-label="삭제"><IconTrash width={14} height={14} /></button>
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
            <div className="border border-border rounded-[var(--radius-lg)] p-3.5 bg-background" key={c.name} onClick={() => setDetail(c)}>
              <div className="flex items-center gap-2.5">
                <div className="w-[30px] h-[30px] rounded-md bg-elevated border border-border flex items-center justify-center text-[0.9rem] shrink-0">{c.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[0.95rem] text-primary truncate">{c.name}</div>
                  <div className="text-[0.72rem] text-muted truncate">{c.url}</div>
                </div>
                <Badge tone="neutral">{c.cat}</Badge>
              </div>
              <div className="mt-2 text-[0.78rem] text-secondary [font-family:var(--font-mono)] truncate">{c.id}</div>
              <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" className="flex-1" onClick={() => setEdit({ open: true, mode: 'edit' })}>수정</Button>
                <Button variant="danger" className="flex-1">삭제</Button>
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
        onEdit={() => { setDetail(null); setEdit({ open: true, mode: 'edit' }); }}
      />

      {/* 추가/수정 모달 */}
      <EditModal state={edit} onClose={() => setEdit((s) => ({ ...s, open: false }))} />
    </AppShell>
  );
}

// 계정 상세 모달 — 비밀번호 마스킹/표시/복사 (표시 시 10초 후 자동 숨김)
function DetailModal({ cred, onClose, onEdit }: { cred: Credential | null; onClose: () => void; onEdit: () => void }) {
  const [pwVisible, setPwVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 모달이 바뀌거나 닫히면 비밀번호 다시 가리고 타이머 정리
  useEffect(() => {
    setPwVisible(false);
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

  // 클립보드 복사. TODO: 복사 완료 토스트 등 피드백 추가
  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const maskedPw = '•'.repeat(Math.min(cred.pw.length, 16));

  const header = (
    <div className="flex items-center gap-3.5 px-6 pt-5 pb-4 border-b border-border">
      <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-surface border border-border flex items-center justify-center text-[1.5rem] shrink-0">{cred.emoji}</div>
      <div className="flex-1">
        <div className="[font-family:var(--font-display)] text-base font-bold text-primary">{cred.name}</div>
        <div className="text-[0.78rem] text-muted mt-0.5">{cred.url}</div>
      </div>
      <Badge tone="neutral">{cred.cat}</Badge>
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
          {/* TODO: API 연동 — 계정 삭제 처리 */}
          <Button variant="danger" className="mr-auto">삭제</Button>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button onClick={onEdit}>수정</Button>
        </>
      }
    >
      {/* 아이디 */}
      <DetailField label="아이디">
        <span className="flex-1 [font-family:var(--font-mono)] text-[0.875rem] text-primary truncate">{cred.id}</span>
        <button type="button" className={ICON_BTN} onClick={() => copy(cred.id)} aria-label="아이디 복사"><IconCopy width={14} height={14} /></button>
      </DetailField>

      {/* 비밀번호 */}
      <DetailField label="비밀번호">
        <span className={`flex-1 [font-family:var(--font-mono)] text-[0.875rem] truncate ${pwVisible ? 'text-primary' : 'tracking-[0.25em] text-muted'}`}>{pwVisible ? cred.pw : maskedPw}</span>
        <button type="button" className={ICON_BTN} onClick={togglePw} aria-label="비밀번호 표시/숨김"><IconEye width={14} height={14} /></button>
        <button type="button" className={ICON_BTN} onClick={() => copy(cred.pw)} aria-label="비밀번호 복사"><IconCopy width={14} height={14} /></button>
      </DetailField>

      {/* 메모 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted">메모</span>
        <div className="text-[0.855rem] text-secondary px-3 py-2.5 bg-surface border border-border rounded-[var(--radius)] min-h-[38px] leading-normal">{cred.memo || '—'}</div>
      </div>

      <div className="text-[0.72rem] text-muted pt-1">수정일: {cred.date}</div>
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

// 계정 추가·수정 모달
function EditModal({ state, onClose }: { state: { open: boolean; mode: 'add' | 'edit' }; onClose: () => void }) {
  const [serviceName, setServiceName] = useState('');
  const [url, setUrl] = useState('');
  const [userId, setUserId] = useState('');
  const [pw, setPw] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    setErrors({}); setServiceName(''); setUrl(''); setUserId(''); setPw('');
  }, [state.open]);

  function validate() {
    const err: Record<string, string> = {};
    if (!serviceName.trim()) err.serviceName = '서비스명을 입력하세요.';
    if (!userId.trim()) err.userId = '아이디를 입력하세요.';
    if (!pw) err.pw = '비밀번호를 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  function clearErr(field: string) { setErrors((p) => { const n = { ...p }; delete n[field]; return n; }); }

  function handleSave() {
    if (!validate()) return;
    toast.success(state.mode === 'edit' ? '계정이 수정됐습니다.' : '계정이 추가됐습니다.');
    onClose();
  }

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.mode === 'edit' ? '계정 수정' : '계정 추가'}
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={false} saveLabel="저장 (암호화)" />}
    >
      <Field label="서비스명" required error={errors.serviceName}>
        <input type="text" className={`input${errors.serviceName ? ' is-invalid' : ''}`} placeholder="예: GitHub" value={serviceName} onChange={(e) => { setServiceName(e.target.value); clearErr('serviceName'); }} />
      </Field>
      <Field label="URL"><input type="url" className="input" placeholder="https://github.com" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
      <Field label="카테고리" required>
        <select className="input" aria-label="카테고리">
          <option>개발</option><option>금융</option><option>소셜</option>
          <option>쇼핑</option><option>구독</option><option>기타</option>
        </select>
      </Field>
      <Field label="아이디" required error={errors.userId}>
        <input type="text" className={`input${errors.userId ? ' is-invalid' : ''}`} placeholder="아이디 또는 이메일" value={userId} onChange={(e) => { setUserId(e.target.value); clearErr('userId'); }} />
      </Field>
      <Field label="비밀번호" required error={errors.pw}>
        <div className="flex gap-2">
          <input type="password" className={`input${errors.pw ? ' is-invalid' : ''}`} placeholder="비밀번호" value={pw} onChange={(e) => { setPw(e.target.value); clearErr('pw'); }} />
          <Button variant="ghost" className="whitespace-nowrap">🎲 생성</Button>
        </div>
        <div className="track"><div className="fill warning" style={{ width: '55%' }} /></div>
        <span className="text-[0.72rem] text-warning">강도: 보통 — 12자 이상 + 특수문자 권장</span>
      </Field>
      <Field label="2단계 인증 (TOTP)">
        <input type="text" className="input input-mono" placeholder="otpauth:// 또는 시크릿 키 (선택)" />
      </Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 정보 (OTP 등)" /></Field>
    </Modal>
  );
}
