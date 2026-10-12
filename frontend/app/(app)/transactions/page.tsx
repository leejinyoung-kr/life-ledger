'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import {
  IconWon, IconBank, IconTrendUp,
} from '@/components/icons';
import { useApiQuery } from '@/lib/query';
import type { Category } from '@/lib/finance';
import LedgerTab from './_tabs/LedgerTab';
import SavingsTab from './_tabs/SavingsTab';
import InvestTab from './_tabs/InvestTab';

type TabId = 'ledger' | 'savings' | 'invest';

const ADD_LABELS: Record<TabId, string> = {
  ledger: '항목 추가',
  savings: '예적금 추가',
  invest: '투자 항목 추가',
};

function TransactionsPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) ?? 'ledger';
  const [tab, setTab] = useState<TabId>(initialTab);
  const [addTrigger, setAddTrigger] = useState<Record<TabId, number>>({
    ledger: 0, savings: 0, invest: 0,
  });
  // 탭별 카테고리 (React Query 캐시 — 활성만 사용)
  const txCatQuery = useApiQuery<Category[]>(['categories', 'transaction'], '/categories?domain=transaction');
  const savingCatQuery = useApiQuery<Category[]>(['categories', 'saving'], '/categories?domain=saving');
  const investCatQuery = useApiQuery<Category[]>(['categories', 'investment'], '/categories?domain=investment');
  const bankCatQuery = useApiQuery<Category[]>(['categories', 'bank'], '/categories?domain=bank');
  const payMethodCatQuery = useApiQuery<Category[]>(['categories', 'pay_method'], '/categories?domain=pay_method');
  const txCats = useMemo(() => (txCatQuery.data ?? []).filter((c) => c.isActive), [txCatQuery.data]);
  const savingCats = useMemo(() => (savingCatQuery.data ?? []).filter((c) => c.isActive), [savingCatQuery.data]);
  const investCats = useMemo(() => (investCatQuery.data ?? []).filter((c) => c.isActive), [investCatQuery.data]);
  const bankCats = useMemo(() => (bankCatQuery.data ?? []).filter((c) => c.isActive), [bankCatQuery.data]);
  const payMethodCats = useMemo(() => (payMethodCatQuery.data ?? []).filter((c) => c.isActive), [payMethodCatQuery.data]);

  function handleOpenAddModal() {
    setAddTrigger((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
  }

  return (
    <AppShell activePath="/transactions" topbarLabel="자산 관리">
      <PageHeader
        title="자산 관리"
        description="수입/지출, 예적금, 투자를 한 곳에서 관리하세요."
        actions={
          <Button className="shrink-0" onClick={handleOpenAddModal}>
            <span className="hidden md:inline">{ADD_LABELS[tab]}</span>
            <span className="md:hidden">추가</span>
          </Button>
        }
      />

      <div className="border-b border-border mb-6">
        <Tabs
          label="자산 관리"
          size="md"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'ledger', label: '수입 / 지출', icon: <IconWon /> },
            { value: 'savings', label: '예적금', icon: <IconBank /> },
            { value: 'invest', label: '투자', icon: <IconTrendUp /> },
          ]}
        />
      </div>

      {tab === 'ledger' && <LedgerTab categories={txCats} bankCats={bankCats} payMethodCats={payMethodCats} addTrigger={addTrigger.ledger} />}
      {tab === 'savings' && <SavingsTab savingCats={savingCats} bankCats={bankCats} addTrigger={addTrigger.savings} />}
      {tab === 'invest' && <InvestTab investCats={investCats} addTrigger={addTrigger.invest} />}
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
