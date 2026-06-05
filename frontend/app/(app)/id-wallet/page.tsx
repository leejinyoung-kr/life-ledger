'use client';

/**
 * 신원 지갑 페이지.
 * 여권·신분증·운전면허·자격증을 색상 카드로 보관하고 만료일(D-day)을 추적한다.
 * 번호는 기본 마스킹하고 토글로 표시하며, 데이터는 더미로 채운다. (AES-256-GCM)
 * 스타일: Tailwind + 공통 컴포넌트(Modal/Button/Field).
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import { Field, ModalFooter } from '@/components/ui/Field';
import { IconAlertCircle, IconEye, IconDoc } from '@/components/icons';

type IdVariant = 'passport' | 'idcard' | 'license' | 'cert';

interface IdCard {
  variant: IdVariant; typeLabel: string; name: string;
  numMasked: string; numFull: string;
  issue: string; expire: string; dday: string; ddayWarn?: boolean;
}

// 카드 유형별 그라데이션 배경
const VARIANT_BG: Record<IdVariant, string> = {
  passport: '[background:linear-gradient(135deg,#1e3a5f,#2d5986)]',
  idcard: '[background:linear-gradient(135deg,#0f7a5a,#00a86d)]',
  license: '[background:linear-gradient(135deg,#7a3a1e,#b8682d)]',
  cert: '[background:linear-gradient(135deg,#3a2d6b,#5b4b9e)]',
};

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
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">신원 지갑</h1>
          <p className="text-sm text-secondary mt-1.5">신분증·여권·자격증을 안전하게 보관하고 만료일을 추적합니다. (AES-256-GCM · 사본은 파일 보관함 연동)</p>
        </div>
        <Button onClick={() => setAddModal(true)}>신분증 추가</Button>
      </div>

      {/* 여권 만료 임박 경고 */}
      <div className="flex items-center gap-3 px-[18px] py-3.5 rounded-[var(--radius-lg)] bg-warning-dim border border-[rgba(247,144,9,0.2)] mb-6">
        <IconAlertCircle width={20} height={20} className="text-warning shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-[0.875rem] text-primary">여권 만료 임박 — D-58</div>
          <div className="text-[0.8rem] text-secondary">여권 유효기간이 6개월 미만이면 일부 국가 입국이 제한됩니다. 갱신을 준비하세요.</div>
        </div>
      </div>

      {/* 신분증 카드 그리드 */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {ID_CARDS.map((card, idx) => (
          <div className={`rounded-[var(--radius-lg)] p-5 text-white shadow-[var(--shadow-md)] relative overflow-hidden min-h-[180px] flex flex-col justify-between ${VARIANT_BG[card.variant]}`} key={card.typeLabel}>
            <div>
              <div className="text-[0.72rem] opacity-85 uppercase tracking-[0.08em] font-semibold">{card.typeLabel}</div>
              <div className="[font-family:var(--font-display)] text-[1.2rem] font-bold mt-1">{card.name}</div>
              <div className="[font-family:var(--font-mono)] text-base tracking-[0.1em] my-3.5">{revealed[idx] ? card.numFull : card.numMasked}</div>
            </div>
            <div className="flex justify-between items-end text-[0.75rem] opacity-90">
              <div>
                <div>발급 {card.issue}</div>
                <div>만료 {card.expire}</div>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-bold ${card.ddayWarn ? 'bg-warning text-white' : 'bg-white/20'}`}>{card.dday}</span>
                <div className="flex gap-1.5">
                  <button type="button" className="w-[30px] h-[30px] rounded-md bg-white/[0.18] flex items-center justify-center text-white transition-colors hover:bg-white/[0.32]" onClick={() => toggleNum(idx)} aria-label="번호 표시/숨김">
                    <IconEye width={14} height={14} />
                  </button>
                  <button type="button" className="w-[30px] h-[30px] rounded-md bg-white/[0.18] flex items-center justify-center text-white transition-colors hover:bg-white/[0.32]" onClick={() => toast('준비 중인 기능입니다.')} aria-label="사본 보기">
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
    <Modal open={open} onClose={onClose} title="신분증 추가" footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={false} saveLabel="저장 (암호화)" />}>
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
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
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
