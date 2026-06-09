'use client';

import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Button from '@/components/ui/Button';
import {
  IconWon, IconBank, IconTrendUp, IconHome, IconCreditCard,
} from '@/components/icons';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import type { Category } from '@/lib/finance';
import LedgerTab from './_tabs/LedgerTab';
import SavingsTab from './_tabs/SavingsTab';
import InvestTab from './_tabs/InvestTab';
import RealEstateTab from './_tabs/RealEstateTab';
import DebtTab from './_tabs/DebtTab';

type TabId = 'ledger' | 'savings' | 'invest' | 'realestate' | 'debt';

const ADD_LABELS: Record<TabId, string> = {
  ledger: '항목 추가',
  savings: '예적금 추가',
  invest: '투자 항목 추가',
  realestate: '부동산 추가',
  debt: '부채 추가',
};

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`px-5 py-2.5 text-[0.875rem] cursor-pointer border-b-2 -mb-px transition-all flex items-center gap-1.75 whitespace-nowrap shrink-0 [&_svg]:w-3.75 [&_svg]:h-3.75 max-md:px-3 max-md:text-[0.82rem] ${active ? 'text-accent border-accent font-semibold' : 'text-muted border-transparent font-medium hover:text-primary'}`}
      onClick={onClick}
    >
      {icon}{children}
    </button>
  );
}

function TransactionsPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) ?? 'ledger';
  const [tab, setTab] = useState<TabId>(initialTab);
  const [addTrigger, setAddTrigger] = useState<Record<TabId, number>>({
    ledger: 0, savings: 0, invest: 0, realestate: 0, debt: 0,
  });
  // 탭별 카테고리 (React Query 캐시 — 활성만 사용)
  const txCatQuery = useApiQuery<Category[]>(['categories', 'transaction'], '/categories?domain=transaction');
  const savingCatQuery = useApiQuery<Category[]>(['categories', 'saving'], '/categories?domain=saving');
  const investCatQuery = useApiQuery<Category[]>(['categories', 'investment'], '/categories?domain=investment');
  const txCats = useMemo(() => (txCatQuery.data ?? []).filter((c) => c.isActive), [txCatQuery.data]);
  const savingCats = useMemo(() => (savingCatQuery.data ?? []).filter((c) => c.isActive), [savingCatQuery.data]);
  const investCats = useMemo(() => (investCatQuery.data ?? []).filter((c) => c.isActive), [investCatQuery.data]);

  function openAddModal() {
    setAddTrigger((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
  }

  return (
    <AppShell activePath="/transactions" topbarLabel="자산 관리">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">자산 관리</h1>
          <p className="text-sm text-secondary mt-1.5">수입/지출, 예적금, 투자, 부동산, 부채를 한 곳에서 관리하세요.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border mb-6">
        <div className="flex gap-0 overflow-x-auto flex-1 min-w-0 scrollbar-none">
          <Tab active={tab === 'ledger'} onClick={() => setTab('ledger')} icon={<IconWon />}>수입 / 지출</Tab>
          <Tab active={tab === 'savings'} onClick={() => setTab('savings')} icon={<IconBank />}>예적금</Tab>
          <Tab active={tab === 'invest'} onClick={() => setTab('invest')} icon={<IconTrendUp />}>투자</Tab>
          <Tab active={tab === 'realestate'} onClick={() => setTab('realestate')} icon={<IconHome />}>부동산</Tab>
          <Tab active={tab === 'debt'} onClick={() => setTab('debt')} icon={<IconCreditCard />}>부채</Tab>
        </div>
        <Button className="shrink-0 mb-2.5" onClick={openAddModal}>
          <span className="hidden md:inline">{ADD_LABELS[tab]}</span>
          <span className="md:hidden">추가</span>
        </Button>
      </div>

      {tab === 'ledger' && <LedgerTab categories={txCats} addTrigger={addTrigger.ledger} />}
      {tab === 'savings' && <SavingsTab savingCats={savingCats} addTrigger={addTrigger.savings} />}
      {tab === 'invest' && <InvestTab investCats={investCats} addTrigger={addTrigger.invest} />}
      {tab === 'realestate' && <RealEstateTab addTrigger={addTrigger.realestate} />}
      {tab === 'debt' && <DebtTab addTrigger={addTrigger.debt} />}
    </AppShell>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsPageInner />
    </Suspense>
  );
}
