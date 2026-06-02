'use client';

/**
 * 가계부 페이지.
 * 수입/지출 · 예적금 · 투자 3개 탭을 한 화면에서 관리한다.
 * 공통 레이아웃(AppShell)·모달(Modal)을 재사용하고, 데이터는 더미로 채운다.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import {
  IconWon, IconBank, IconTrendUp, IconDownload, IconFileBlank, IconUpload,
  IconSearch, IconEdit, IconTrash, IconPlus,
} from '@/components/icons';

type TabId = 'ledger' | 'savings' | 'invest';

// 탭별 추가 버튼 라벨
const ADD_LABELS: Record<TabId, string> = {
  ledger: '항목 추가',
  savings: '예적금 추가',
  invest: '투자 항목 추가',
};

// ── 더미 데이터 (TODO: API 연동 시 교체) ─────────────────────────

// 월별 지출 추이 막대 (높이 %) — TODO: GET /api/v1/transactions/monthly-trend
const MONTHLY_BARS = [
  { month: '1월', height: 62 },
  { month: '2월', height: 78 },
  { month: '3월', height: 55 },
  { month: '4월', height: 90 },
  { month: '5월', height: 70, current: true },
];

// 반복 거래 — TODO: GET /api/v1/transactions/recurring
const RECURRING = [
  { title: '넷플릭스 — ₩17,000', sub: '매월 29일 · 구독' },
  { title: '청약저축 — ₩200,000', sub: '매월 30일 · 저축이동' },
  { title: '월급 — ₩3,200,000', sub: '매월 25일 · 급여' },
];

// 수입/지출 요약 strip — TODO: GET /api/v1/transactions/summary?month=
const LEDGER_SUMMARY = [
  { label: '수입', value: '+₩3,200,000', tone: 'income' },
  { label: '지출', value: '-₩842,300', tone: 'expense' },
  { label: '저축이동', value: '-₩500,000', tone: 'transfer' },
  { label: '실소비', value: '₩342,300', tone: '' },
  { label: '잔액', value: '₩1,857,700', tone: '' },
];

type LedgerKind = 'income' | 'expense' | 'transfer';
// 수입/지출 내역 — TODO: GET /api/v1/transactions?month=
const LEDGER_ROWS: {
  date: string; name: string; cat: string; chipTransfer?: boolean;
  method: string; amount: string; kind: LedgerKind; memo: string;
}[] = [
  { date: '2025.05.31', name: '스타벅스', cat: '☕ 식비', method: '카카오페이', amount: '-₩6,500', kind: 'expense', memo: '아메리카노' },
  { date: '2025.05.30', name: '청약저축 납입', cat: '💳 저축이동', chipTransfer: true, method: '계좌이체', amount: '-₩200,000', kind: 'transfer', memo: '잔액에서 제외' },
  { date: '2025.05.29', name: '넷플릭스', cat: '📺 구독', method: '신한카드', amount: '-₩17,000', kind: 'expense', memo: '월정액' },
  { date: '2025.05.25', name: '월급', cat: '💰 급여', method: '계좌이체', amount: '+₩3,200,000', kind: 'income', memo: '5월 급여' },
];

// 예적금 요약 — TODO: GET /api/v1/savings/summary
const SAVINGS_SUMMARY = [
  { label: '총 예적금', value: '₩18,200,000', tone: 'transfer' },
  { label: '이번 달 납입', value: '₩500,000', tone: '' },
  { label: '평균 금리', value: '3.8%', tone: 'accent' },
  { label: '만기 임박', value: '1건', tone: 'warning' },
];

// 예적금 카드 — TODO: GET /api/v1/savings
const SAVINGS_CARDS = [
  {
    bank: '우리은행', name: '청약저축', badge: '적금', badgeClass: 'badge-savings', amount: '₩8,400,000',
    meta: [
      { label: '월 납입액', value: '₩200,000' },
      { label: '금리', value: '2.5%', accent: true },
      { label: '가입일', value: '2018.03.01' },
      { label: '만기일', value: '청약 시' },
    ],
    progressLabel: ['납입 현황', '84개월 / 진행중'] as [string, string], percent: 70, fill: 'green',
  },
  {
    bank: '카카오뱅크', name: '26주 적금', badge: '적금', badgeClass: 'badge-savings', amount: '₩1,600,000',
    meta: [
      { label: '월 납입액', value: '₩100,000 → ₩300,000' },
      { label: '금리', value: '5.0%', accent: true },
      { label: '가입일', value: '2025.01.06' },
      { label: '만기일', value: '2025.07.07 ⚠️', warning: true },
    ],
    progressLabel: ['진행률', '21주 / 26주'] as [string, string], percent: 81, fill: 'warning',
  },
  {
    bank: '신한은행', name: '정기예금', badge: '예금', badgeClass: 'badge-deposit', amount: '₩8,200,000',
    meta: [
      { label: '예치금', value: '₩8,000,000' },
      { label: '금리', value: '3.8%', accent: true },
      { label: '가입일', value: '2024.12.01' },
      { label: '만기일', value: '2025.12.01' },
    ],
    progressLabel: ['기간 경과', '6개월 / 12개월'] as [string, string], percent: 50, fill: 'green',
  },
];

// 투자 요약 — TODO: GET /api/v1/investments/summary
const INVEST_SUMMARY = [
  { label: '총 평가금액', value: '₩12,847,000', valueClass: '', change: '▲ ₩1,347,000 (11.7%)', changeClass: 'up' },
  { label: '총 투자원금', value: '₩11,500,000', valueClass: '', change: '', changeClass: '' },
  { label: '총 수익', value: '+₩1,347,000', valueClass: 'up', change: '수익률 +11.7%', changeClass: 'up' },
];

// 투자 종목 — TODO: GET /api/v1/investments
const INVEST_ROWS = [
  { name: '삼성전자', type: '📈 국내주식', principal: '₩3,000,000', value: '₩3,420,000', profit: '+₩420,000', profitKind: 'income', rate: '+14.0%', rateUp: true, memo: '분할매수' },
  { name: 'S&P500 ETF', type: '🌍 해외ETF', principal: '₩5,000,000', value: '₩5,830,000', profit: '+₩830,000', profitKind: 'income', rate: '+16.6%', rateUp: true, memo: '매월 적립식' },
  { name: '카카오', type: '📈 국내주식', principal: '₩2,000,000', value: '₩1,820,000', profit: '-₩180,000', profitKind: 'expense', rate: '-9.0%', rateUp: false, memo: '장기보유' },
  { name: '비트코인', type: '₿ 가상자산', principal: '₩1,500,000', value: '₩1,777,000', profit: '+₩277,000', profitKind: 'income', rate: '+18.5%', rateUp: true, memo: '소액 투자' },
];

export default function TransactionsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('ledger');
  // 각 모달 상태 (open + mode). mode 는 제목을 '추가'/'수정'으로 분기
  const [ledgerModal, setLedgerModal] = useState<{ open: boolean; mode: 'add' | 'edit' }>({ open: false, mode: 'add' });
  const [savingsModal, setSavingsModal] = useState<{ open: boolean; mode: 'add' | 'edit' }>({ open: false, mode: 'add' });
  const [investModal, setInvestModal] = useState<{ open: boolean; mode: 'add' | 'edit' }>({ open: false, mode: 'add' });

  // 인증 가드 — 토큰 없으면 로그인 페이지로. TODO: 토큰 유효성 검증 API 연동
  useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      router.replace('/login');
    }
  }, [router]);

  // 로그아웃 — 토큰 제거 후 로그인 페이지로 이동
  function logout() {
    localStorage.removeItem('auth_token');
    router.push('/login');
  }

  // 상단바 추가 버튼 — 현재 탭에 맞는 추가 모달 열기
  function openAddModal() {
    if (tab === 'ledger') setLedgerModal({ open: true, mode: 'add' });
    if (tab === 'savings') setSavingsModal({ open: true, mode: 'add' });
    if (tab === 'invest') setInvestModal({ open: true, mode: 'add' });
  }

  return (
    <AppShell
      activePath="/transactions"
      topbarLabel="가계부"
      actionLabel={ADD_LABELS[tab]}
      onAction={openAddModal}
      onLogout={logout}
    >
      <div className="page-header">
        <h1 className="page-title">가계부</h1>
        <p className="page-subtitle">수입/지출, 예적금, 투자를 한 곳에서 관리하세요.</p>
      </div>

      {/* 탭 */}
      <div className="page-tabs">
        <Tab active={tab === 'ledger'} onClick={() => setTab('ledger')} icon={<IconWon />}>수입 / 지출</Tab>
        <Tab active={tab === 'savings'} onClick={() => setTab('savings')} icon={<IconBank />}>예적금</Tab>
        <Tab active={tab === 'invest'} onClick={() => setTab('invest')} icon={<IconTrendUp />}>투자</Tab>
      </div>

      {tab === 'ledger' && <LedgerTab onEdit={() => setLedgerModal({ open: true, mode: 'edit' })} />}
      {tab === 'savings' && (
        <SavingsTab
          onAdd={() => setSavingsModal({ open: true, mode: 'add' })}
          onEdit={() => setSavingsModal({ open: true, mode: 'edit' })}
        />
      )}
      {tab === 'invest' && (
        <InvestTab
          onAdd={() => setInvestModal({ open: true, mode: 'add' })}
          onEdit={() => setInvestModal({ open: true, mode: 'edit' })}
        />
      )}

      {/* 모달 3종 */}
      <LedgerModal state={ledgerModal} onClose={() => setLedgerModal((s) => ({ ...s, open: false }))} />
      <SavingsModal state={savingsModal} onClose={() => setSavingsModal((s) => ({ ...s, open: false }))} />
      <InvestModal state={investModal} onClose={() => setInvestModal((s) => ({ ...s, open: false }))} />
    </AppShell>
  );
}

// 탭 버튼
function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" className={`page-tab${active ? ' active' : ''}`} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

// ── 탭 1: 수입 / 지출 ───────────────────────────────────────────
function LedgerTab({ onEdit }: { onEdit: () => void }) {
  return (
    <>
      {/* 월별 추이 + 반복거래 */}
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><span className="card-title">월별 지출 추이</span></div>
          <div className="card-body">
            <div className="bar-chart">
              {MONTHLY_BARS.map((b) => (
                <div key={b.month} className={`bar${b.current ? ' current' : ''}`} style={{ height: `${b.height}%` }} />
              ))}
            </div>
            <div className="bar-axis">
              {MONTHLY_BARS.map((b) => <span key={b.month}>{b.month}</span>)}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔁 반복 거래</span>
            <span className="badge badge-neutral">자동 등록</span>
          </div>
          <div className="card-body compact">
            {RECURRING.map((r) => (
              <div className="recur-item" key={r.title}>
                <div className="recur-title">{r.title}</div>
                <div className="recur-sub">{r.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 요약 strip */}
      <div className="summary-strip">
        {LEDGER_SUMMARY.map((s, i) => (
          <StripItem key={s.label} item={s} last={i === LEDGER_SUMMARY.length - 1} />
        ))}
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

      {/* 필터 */}
      <div className="filter-row">
        <input type="month" className="input" defaultValue="2025-05" aria-label="조회 월" />
        <select className="input" defaultValue="" aria-label="유형 필터">
          <option value="">전체 유형</option>
          <option>수입</option><option>지출</option><option>저축이동</option>
        </select>
        <select className="input" defaultValue="" aria-label="카테고리 필터">
          <option value="">전체 카테고리</option>
          <option>식비</option><option>교통</option><option>구독</option>
          <option>쇼핑</option><option>급여</option><option>저축이동</option><option>기타</option>
        </select>
        <div className="search-wrap filter-search">
          <IconSearch className="search-icon" />
          <input className="input" type="text" placeholder="내역 검색..." aria-label="내역 검색" />
        </div>
      </div>

      {/* 내역 테이블 */}
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>날짜</th><th>내역</th><th>카테고리</th><th>결제수단</th>
                <th className="td-right">금액</th><th className="td-center">메모</th><th className="td-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {LEDGER_ROWS.map((row, i) => (
                <tr key={i}>
                  <td className="td-muted">{row.date}</td>
                  <td className="td-name">{row.name}</td>
                  <td><span className={`cat-chip${row.chipTransfer ? ' transfer' : ''}`}>{row.cat}</span></td>
                  <td className="td-muted">{row.method}</td>
                  <td className={`td-right amount-${row.kind}`}>{row.amount}</td>
                  <td className="td-center td-muted">{row.memo}</td>
                  <td className="td-center"><RowActions onEdit={onEdit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="ledger-note">
        💡 <strong>저축이동</strong>은 실소비가 아닌 자산 이동으로 잔액 계산에서 제외됩니다.
      </p>
    </>
  );
}

// ── 탭 2: 예적금 ───────────────────────────────────────────────
function SavingsTab({ onAdd, onEdit }: { onAdd: () => void; onEdit: () => void }) {
  return (
    <>
      <div className="summary-strip">
        {SAVINGS_SUMMARY.map((s, i) => (
          <StripItem key={s.label} item={s} last={i === SAVINGS_SUMMARY.length - 1} />
        ))}
      </div>

      <div className="savings-grid">
        {SAVINGS_CARDS.map((c) => (
          <div className="savings-card" key={c.name}>
            <div className="savings-card-header">
              <div>
                <div className="savings-bank">{c.bank}</div>
                <div className="savings-name">{c.name}</div>
              </div>
              <span className={`savings-type-badge ${c.badgeClass}`}>{c.badge}</span>
            </div>
            <div className="savings-amount">{c.amount}</div>
            <div className="savings-meta">
              {c.meta.map((m) => (
                <div className="savings-meta-row" key={m.label}>
                  <span className="savings-meta-label">{m.label}</span>
                  <span className={`savings-meta-value${m.accent ? ' accent' : ''}${m.warning ? ' warning' : ''}`}>{m.value}</span>
                </div>
              ))}
            </div>
            <div className="progress-wrap">
              <div className="progress-label"><span>{c.progressLabel[0]}</span><span>{c.progressLabel[1]}</span></div>
              <div className="track"><div className={`fill ${c.fill}`} style={{ width: `${c.percent}%` }} /></div>
            </div>
            <div className="savings-actions">
              <button type="button" className="btn btn-ghost grow" onClick={onEdit}>수정</button>
              <button type="button" className="btn btn-danger">삭제</button>
            </div>
          </div>
        ))}

        {/* 추가 카드 */}
        <div className="savings-card add" onClick={onAdd}>
          <IconPlus width={28} height={28} />
          <span>예적금 추가</span>
        </div>
      </div>
    </>
  );
}

// ── 탭 3: 투자 ─────────────────────────────────────────────────
function InvestTab({ onAdd, onEdit }: { onAdd: () => void; onEdit: () => void }) {
  return (
    <>
      <div className="invest-summary">
        {INVEST_SUMMARY.map((s) => (
          <div className="invest-stat" key={s.label}>
            <div className="invest-stat-label">{s.label}</div>
            <div className={`invest-stat-value ${s.valueClass}`}>{s.value}</div>
            {s.change && <div className={`invest-stat-change ${s.changeClass}`}>{s.change}</div>}
          </div>
        ))}
      </div>

      <div className="card flush mb-6">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>종목</th><th>유형</th>
                <th className="td-right">투자원금</th><th className="td-right">평가금액</th>
                <th className="td-right">수익</th><th className="td-center">수익률</th>
                <th>메모</th><th className="td-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {INVEST_ROWS.map((row) => (
                <tr key={row.name}>
                  <td className="td-strong">{row.name}</td>
                  <td><span className="cat-chip">{row.type}</span></td>
                  <td className="td-mono td-right">{row.principal}</td>
                  <td className="td-mono td-right">{row.value}</td>
                  <td className={`td-right amount-${row.profitKind}`}>{row.profit}</td>
                  <td className="td-center">
                    <span className={`return-pill ${row.rateUp ? 'up' : 'down'}`}>{row.rate}</span>
                  </td>
                  <td className="td-muted">{row.memo}</td>
                  <td className="td-center"><RowActions onEdit={onEdit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex-end">
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          <IconPlus width={13} height={13} />투자 항목 추가
        </button>
      </div>
    </>
  );
}

// 요약 strip 한 항목 + 구분선
function StripItem({ item, last }: { item: { label: string; value: string; tone: string }; last: boolean }) {
  return (
    <>
      <div className="strip-item">
        <span className="strip-label">{item.label}</span>
        <span className={`strip-value ${item.tone}`}>{item.value}</span>
      </div>
      {!last && <div className="strip-divider" />}
    </>
  );
}

// 행 액션(수정/삭제) 버튼 묶음
function RowActions({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="row-actions">
      <button type="button" className="btn btn-ghost btn-icon" onClick={onEdit} aria-label="수정">
        <IconEdit width={14} height={14} />
      </button>
      <button type="button" className="btn btn-danger btn-icon" aria-label="삭제">
        <IconTrash width={14} height={14} />
      </button>
    </div>
  );
}

// 모달 공통 푸터 (취소/저장)
function ModalFooter({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={onClose}>취소</button>
      {/* TODO: API 연동 — 저장(POST/PUT) 처리 */}
      <button type="button" className="btn btn-primary">저장</button>
    </>
  );
}

// 수입/지출 추가·수정 모달
function LedgerModal({ state, onClose }: { state: { open: boolean; mode: 'add' | 'edit' }; onClose: () => void }) {
  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '항목 수정' : '항목 추가'} footer={<ModalFooter onClose={onClose} />}>
      <Field label="유형">
        <select className="input"><option>지출</option><option>수입</option><option>저축이동</option></select>
      </Field>
      <Field label="날짜"><input type="date" className="input" defaultValue="2025-05-31" /></Field>
      <Field label="내역"><input type="text" className="input" placeholder="예: 스타벅스" /></Field>
      <div className="form-grid-2">
        <Field label="카테고리">
          <select className="input">
            <option>식비</option><option>교통</option><option>구독</option><option>쇼핑</option>
            <option>급여</option><option>저축이동</option><option>기타</option>
          </select>
        </Field>
        <Field label="금액 (원)"><input type="number" className="input" placeholder="0" /></Field>
      </div>
      <Field label="결제수단">
        <select className="input"><option>신한카드</option><option>카카오페이</option><option>현금</option><option>계좌이체</option></select>
      </Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" /></Field>
    </Modal>
  );
}

// 예적금 추가·수정 모달
function SavingsModal({ state, onClose }: { state: { open: boolean; mode: 'add' | 'edit' }; onClose: () => void }) {
  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '예적금 수정' : '예적금 추가'} footer={<ModalFooter onClose={onClose} />}>
      <Field label="은행/기관"><input type="text" className="input" placeholder="예: 카카오뱅크" /></Field>
      <Field label="상품명"><input type="text" className="input" placeholder="예: 26주 적금" /></Field>
      <Field label="유형">
        <select className="input"><option>적금</option><option>예금</option><option>청약</option><option>기타</option></select>
      </Field>
      <div className="form-grid-2">
        <Field label="금리 (%)"><input type="number" className="input" placeholder="3.5" step="0.1" /></Field>
        <Field label="월 납입액 (원)"><input type="number" className="input" placeholder="200000" /></Field>
      </div>
      <div className="form-grid-2">
        <Field label="가입일"><input type="date" className="input" /></Field>
        <Field label="만기일"><input type="date" className="input" /></Field>
      </div>
      <Field label="현재 잔액 (원)"><input type="number" className="input" placeholder="0" /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" /></Field>
    </Modal>
  );
}

// 투자 추가·수정 모달
function InvestModal({ state, onClose }: { state: { open: boolean; mode: 'add' | 'edit' }; onClose: () => void }) {
  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '투자 항목 수정' : '투자 항목 추가'} footer={<ModalFooter onClose={onClose} />}>
      <Field label="종목명"><input type="text" className="input" placeholder="예: 삼성전자" /></Field>
      <Field label="유형">
        <select className="input">
          <option>국내주식</option><option>해외주식</option><option>해외ETF</option>
          <option>국내ETF</option><option>가상자산</option><option>기타</option>
        </select>
      </Field>
      <div className="form-grid-2">
        <Field label="투자원금 (원)"><input type="number" className="input" placeholder="0" /></Field>
        <Field label="현재 평가금액 (원)"><input type="number" className="input" placeholder="0" /></Field>
      </div>
      <Field label="최초 매수일"><input type="date" className="input" /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="투자 전략, 목표가 등" /></Field>
    </Modal>
  );
}

// 입력 그룹 (라벨 + 입력요소). label 로 감싸 입력요소에 접근성 이름을 연결한다.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="input-group">
      <span className="input-label">{label}</span>
      {children}
    </label>
  );
}
