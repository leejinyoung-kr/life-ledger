'use client';

/**
 * 신원 지갑 페이지.
 * 여권·신분증·운전면허·자격증을 색상 카드로 보관하고 만료일(D-day)을 추적한다.
 * 번호는 기본 마스킹하고 토글로 표시하며, 데이터는 더미로 채운다. (AES-256-GCM)
 */
import { useState, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import { IconAlertCircle, IconEye, IconDoc, IconPlus } from '@/components/icons';

type IdVariant = 'passport' | 'idcard' | 'license' | 'cert';

interface IdCard {
  variant: IdVariant; typeLabel: string; name: string;
  numMasked: string; numFull: string;
  issue: string; expire: string; dday: string; ddayWarn?: boolean;
}

// ── 더미 데이터 (TODO: GET /api/v1/identities) ──────────────────
const ID_CARDS: IdCard[] = [
  { variant: 'passport', typeLabel: 'PASSPORT · 여권',          name: '대한민국 여권', numMasked: 'M••••••88',     numFull: 'M1234567 88',     issue: '2015.07.30', expire: '2025.07.29', dday: 'D-58', ddayWarn: true },
  { variant: 'idcard',   typeLabel: 'ID CARD · 주민등록증',     name: '김관리자',     numMasked: '••••••-1••••••', numFull: '900101-1234567', issue: '2010.03.15', expire: '—', dday: 'D-—' },
  { variant: 'license',  typeLabel: 'DRIVER LICENSE · 운전면허', name: '1종 보통',     numMasked: '••-••-••••••-••', numFull: '11-22-334455-66', issue: '2021.05.01', expire: '2031.05.01', dday: 'D-2160' },
  { variant: 'cert',     typeLabel: 'CERTIFICATE · 자격증',     name: '정보처리기사', numMasked: '••••-••••',      numFull: '2019-1234',      issue: '2019.11.20', expire: '—', dday: 'D-—' },
];

export default function IdWalletPage() {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({}); // 번호 표시 여부
  const [addModal, setAddModal] = useState(false);

  // 카드 번호 표시/숨김 토글
  function toggleNum(idx: number) {
    setRevealed((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <AppShell activePath="/id-wallet" topbarLabel="신원 지갑">
      <div className="page-header">
        <div>
          <h1 className="page-title">신원 지갑</h1>
          <p className="page-subtitle">신분증·여권·자격증을 안전하게 보관하고 만료일을 추적합니다. (AES-256-GCM · 사본은 파일 보관함 연동)</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAddModal(true)}>
          <IconPlus width={13} height={13} />신분증 추가
        </button>
      </div>

      {/* 여권 만료 임박 경고 */}
      <div className="alert-banner">
        <IconAlertCircle width={20} height={20} />
        <div className="alert-body">
          <div className="alert-title">여권 만료 임박 — D-58</div>
          <div className="alert-desc">여권 유효기간이 6개월 미만이면 일부 국가 입국이 제한됩니다. 갱신을 준비하세요.</div>
        </div>
      </div>

      {/* 신분증 카드 그리드 */}
      <div className="id-grid">
        {ID_CARDS.map((card, idx) => (
          <div className={`id-card ${card.variant}`} key={card.typeLabel}>
            <div>
              <div className="id-card-type">{card.typeLabel}</div>
              <div className="id-card-name">{card.name}</div>
              <div className="id-card-num">{revealed[idx] ? card.numFull : card.numMasked}</div>
            </div>
            <div className="id-card-foot">
              <div>
                <div>발급 {card.issue}</div>
                <div>만료 {card.expire}</div>
              </div>
              <div className="id-card-foot-right">
                <span className={`dday-pill${card.ddayWarn ? ' warn' : ''}`}>{card.dday}</span>
                <div className="id-card-actions">
                  <button type="button" className="id-icon-btn" onClick={() => toggleNum(idx)} aria-label="번호 표시/숨김">
                    <IconEye width={14} height={14} />
                  </button>
                  <button type="button" className="id-icon-btn" aria-label="사본 보기">
                    <IconDoc width={14} height={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AddIdModal open={addModal} onClose={() => setAddModal(false)} />
    </AppShell>
  );
}

function AddIdModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [idName, setIdName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({}); setIdName(''); setIdNumber(''); setIssueDate('');
  }, [open]);

  function clearErr(field: string) { setErrors((p) => { const n = { ...p }; delete n[field]; return n; }); }

  function handleSave() {
    const err: Record<string, string> = {};
    if (!idName.trim()) err.idName = '명칭을 입력하세요.';
    if (!idNumber.trim()) err.idNumber = '번호를 입력하세요.';
    if (!issueDate) err.issueDate = '발급일을 선택하세요.';
    setErrors(err);
    if (Object.keys(err).length) return;
    toast.success('신분증이 추가됐습니다.');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="신분증 추가"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>취소</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>저장 (암호화)</button>
        </>
      }
    >
      <Field label="종류" required>
        <select className="input" aria-label="종류">
          <option>여권</option><option>주민등록증</option><option>운전면허</option><option>자격증</option><option>기타</option>
        </select>
      </Field>
      <Field label="명칭" required error={errors.idName}>
        <input type="text" className={`input${errors.idName ? ' is-invalid' : ''}`} placeholder="예: 대한민국 여권" value={idName} onChange={(e) => { setIdName(e.target.value); clearErr('idName'); }} />
      </Field>
      <Field label="번호" required error={errors.idNumber}>
        <input type="text" className={`input input-mono${errors.idNumber ? ' is-invalid' : ''}`} placeholder="문서 번호" value={idNumber} onChange={(e) => { setIdNumber(e.target.value); clearErr('idNumber'); }} />
      </Field>
      <div className="form-grid-2">
        <Field label="발급일" required error={errors.issueDate}>
          <input type="date" className={`input${errors.issueDate ? ' is-invalid' : ''}`} value={issueDate} onChange={(e) => { setIssueDate(e.target.value); clearErr('issueDate'); }} />
        </Field>
        <Field label="만료일 (선택)"><input type="date" className="input" /></Field>
      </div>
      <Field label="사본 (선택)"><input type="file" className="input" accept="image/*,.pdf" /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" /></Field>
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
