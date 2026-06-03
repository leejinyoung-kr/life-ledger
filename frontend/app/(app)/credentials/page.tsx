'use client';

/**
 * 계정 보관함 페이지.
 * 저장된 계정(아이디/비밀번호)을 표로 보고, 행 클릭 시 상세 모달에서 마스킹·복사한다.
 * 공통 레이아웃(AppShell)·모달(Modal)을 재사용하고 데이터는 더미로 채운다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Modal from '@/components/Modal';
import {
  IconDownload, IconFileBlank, IconUpload, IconSearch, IconEdit, IconTrash,
  IconClose, IconCopy, IconEye, IconPlus,
} from '@/components/icons';

interface Credential {
  name: string; emoji: string; url: string; id: string; pw: string;
  cat: string; memo: string; date: string;
}

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
      <div className="page-header">
        <div>
          <h1 className="page-title">계정 보관함</h1>
          <p className="page-subtitle">행을 클릭하면 상세 정보를 확인할 수 있습니다. (AES-256-GCM 암호화)</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEdit({ open: true, mode: 'add' })}>
          <IconPlus width={13} height={13} />계정 추가
        </button>
      </div>

      {/* 보안 경고 배너 */}
      <div className="cred-banner">
        <span>🔁</span>
        <span className="msg">재사용·취약 비밀번호 <strong>5건</strong>, 2FA 미설정 <strong>5건</strong>이 감지됐습니다.</span>
        <a href="#" className="btn btn-ghost btn-sm">보안 센터</a>
      </div>

      {/* 엑셀 툴바 — TODO: 다운로드/업로드 API 연동 */}
      <div className="excel-toolbar">
        <span className="excel-toolbar-label">엑셀</span>
        <button type="button" className="excel-btn"><IconDownload />데이터 다운로드</button>
        <div className="divider-v" />
        <button type="button" className="excel-btn"><IconFileBlank />양식 다운로드</button>
        <label className="excel-btn upload">
          <IconUpload />엑셀 업로드
          <input type="file" accept=".xlsx,.xls,.csv" hidden />
        </label>
      </div>

      {/* 검색 툴바 */}
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch className="search-icon" />
          <input
            className="input"
            type="text"
            placeholder="서비스명, URL, 아이디 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="계정 검색"
          />
        </div>
        <select
          className="input filter-select"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          aria-label="카테고리 필터"
        >
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex-center gap-2">
          <span className="text-muted toolbar-count">총 {rows.length}개</span>
          <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
        </div>
      </div>

      {/* 테이블 */}
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>서비스</th><th>카테고리</th><th>아이디</th><th>수정일</th><th className="td-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => (
                <tr key={c.name} className="cred-row" onClick={() => setDetail(c)}>
                  <td>
                    <div className="service-cell">
                      <div className="favicon">{c.emoji}</div>
                      <div>
                        <div className="service-name">{c.name}</div>
                        <div className="service-url">{c.url}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-neutral">{c.cat}</span></td>
                  <td className="td-mono">{c.id}</td>
                  <td className="td-muted">{c.date}</td>
                  {/* 액션 셀 클릭은 행 상세 열기로 전파되지 않도록 차단 */}
                  <td className="td-center" onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => setEdit({ open: true, mode: 'edit' })} aria-label="수정">
                        <IconEdit width={14} height={14} />
                      </button>
                      <button type="button" className="btn btn-danger btn-icon" aria-label="삭제">
                        <IconTrash width={14} height={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    <div className="detail-header-info">
      <div className="detail-favicon">{cred.emoji}</div>
      <div className="detail-head">
        <div className="detail-site-name">{cred.name}</div>
        <div className="detail-site-url">{cred.url}</div>
      </div>
      <span className="badge badge-neutral">{cred.cat}</span>
      <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="닫기">
        <IconClose width={16} height={16} />
      </button>
    </div>
  );

  return (
    <Modal
      open={!!cred}
      onClose={onClose}
      title={cred.name}
      className="detail-modal"
      header={header}
      footer={
        <>
          {/* TODO: API 연동 — 계정 삭제 처리 */}
          <button type="button" className="btn btn-danger ml-auto">삭제</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>닫기</button>
          <button type="button" className="btn btn-primary" onClick={onEdit}>수정</button>
        </>
      }
    >
      {/* 아이디 */}
      <div className="detail-field">
        <span className="detail-field-label">아이디</span>
        <div className="detail-field-row">
          <span className="detail-field-value">{cred.id}</span>
          <button type="button" className="icon-btn" onClick={() => copy(cred.id)} aria-label="아이디 복사">
            <IconCopy width={14} height={14} />
          </button>
        </div>
      </div>

      {/* 비밀번호 */}
      <div className="detail-field">
        <span className="detail-field-label">비밀번호</span>
        <div className="detail-field-row">
          <span className={`detail-field-value${pwVisible ? '' : ' masked'}`}>{pwVisible ? cred.pw : maskedPw}</span>
          <button type="button" className="icon-btn" onClick={togglePw} aria-label="비밀번호 표시/숨김">
            <IconEye width={14} height={14} />
          </button>
          <button type="button" className="icon-btn" onClick={() => copy(cred.pw)} aria-label="비밀번호 복사">
            <IconCopy width={14} height={14} />
          </button>
        </div>
      </div>

      {/* 메모 */}
      <div className="detail-field">
        <span className="detail-field-label">메모</span>
        <div className="detail-memo">{cred.memo || '—'}</div>
      </div>

      <div className="detail-footer-info">수정일: {cred.date}</div>
    </Modal>
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
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>취소</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>저장 (암호화)</button>
        </>
      }
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
        <div className="pw-row">
          <input type="password" className={`input${errors.pw ? ' is-invalid' : ''}`} placeholder="비밀번호" value={pw} onChange={(e) => { setPw(e.target.value); clearErr('pw'); }} />
          <button type="button" className="btn btn-ghost pw-gen">🎲 생성</button>
        </div>
        <div className="track"><div className="fill warning pw-strength-fill" /></div>
        <span className="pw-strength-text">강도: 보통 — 12자 이상 + 특수문자 권장</span>
      </Field>
      <Field label="2단계 인증 (TOTP)">
        <input type="text" className="input input-mono" placeholder="otpauth:// 또는 시크릿 키 (선택)" />
      </Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 정보 (OTP 등)" /></Field>
    </Modal>
  );
}

// 입력 그룹 (라벨 + 입력요소). label 로 감싸 입력요소에 접근성 이름을 연결한다.
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <label className="input-group">
      <span className="input-label">{label}{required && <span className="required-mark">*</span>}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
