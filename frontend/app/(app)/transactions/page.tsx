'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import {
  IconWon, IconBank, IconTrendUp, IconPlus,
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

// 목록이 오기 전 빈 배열 — 렌더마다 새 배열이 되어 useMemo 가 매번 다시 돌지 않게
const NO_CATS: Category[] = [];

function TransactionsPageInner() {
  const searchParams = useSearchParams();
  // ?tab= 은 자산 종합의 자산 구성 줄 · 탭 전환(changeTab)이 넣는다. 모르는 값이면 첫 탭
  const tabParam = searchParams.get('tab');
  const urlTab: TabId = tabParam === 'savings' || tabParam === 'invest' ? tabParam : 'ledger';
  const [tab, setTab] = useState<TabId>(urlTab);
  // 같은 화면에서 주소만 바뀌면(예: 예적금 탭에서 메뉴의 가계부를 누름) 탭도 따라간다
  const [prevUrlTab, setPrevUrlTab] = useState<TabId>(urlTab);
  if (urlTab !== prevUrlTab) {
    setPrevUrlTab(urlTab);
    setTab(urlTab);
  }
  const [addTrigger, setAddTrigger] = useState<Record<TabId, number>>({
    ledger: 0, savings: 0, invest: 0,
  });
  // 탭별 카테고리 (React Query 캐시). 가계부는 비활성 포함 전체를 넘긴다 — 기존 기록의 표시 · 수정에 필요하고 선택지는 안에서 거른다
  const txCatQuery = useApiQuery<Category[]>(['categories', 'transaction'], '/categories?domain=transaction');
  const savingCatQuery = useApiQuery<Category[]>(['categories', 'saving'], '/categories?domain=saving');
  const investCatQuery = useApiQuery<Category[]>(['categories', 'investment'], '/categories?domain=investment');
  const bankCatQuery = useApiQuery<Category[]>(['categories', 'bank'], '/categories?domain=bank');
  const payMethodCatQuery = useApiQuery<Category[]>(['categories', 'pay_method'], '/categories?domain=pay_method');
  const allTxCats = txCatQuery.data ?? NO_CATS;
  const allBankCats = bankCatQuery.data ?? NO_CATS;
  const allPayMethodCats = payMethodCatQuery.data ?? NO_CATS;
  // 예적금 · 투자 유형은 값이 고정(enum)이라 라벨 · 순서만 코드 관리에서 — 비활성 포함 전체를 넘기고 선택지는 안에서 거른다
  const allSavingCats = savingCatQuery.data ?? NO_CATS;
  const allInvestCats = investCatQuery.data ?? NO_CATS;
  // 예적금 은행은 라벨로 저장된다 — 선택지용 사용 중인 것만
  const bankCats = useMemo(() => (bankCatQuery.data ?? []).filter((c) => c.isActive), [bankCatQuery.data]);

  // 대시보드 '지출 기록'(?add=1)으로 들어오면 추가 창을 바로 연다. 새로고침에 다시 열리지 않게 주소에서 지운다
  useEffect(() => {
    if (searchParams.get('add') !== '1') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 들어올 때 한 번만 여는 동작
    setAddTrigger((prev) => ({ ...prev, [urlTab]: prev[urlTab] + 1 }));
    window.history.replaceState(null, '', urlTab === 'ledger' ? '/transactions' : `/transactions?tab=${urlTab}`);
  }, [searchParams, urlTab]);

  // 탭을 바꾸면 주소의 ?tab= 도 맞춘다 — 새로고침 · 주소 공유 때 같은 탭이 열리게. 뒤로 가기가 탭마다 쌓이지 않게 replace
  function changeTab(next: TabId) {
    setTab(next);
    window.history.replaceState(null, '', next === 'ledger' ? '/transactions' : `/transactions?tab=${next}`);
  }

  function handleOpenAddModal() {
    setAddTrigger((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
  }

  return (
    <AppShell activePath="/transactions">
      <PageHeader
        title="가계부"
        description="수입/지출, 예적금, 투자를 한 곳에서 관리하세요."
        actions={
          <Button className="shrink-0" onClick={handleOpenAddModal}>
            <IconPlus />
            <span className="hidden md:inline">{ADD_LABELS[tab]}</span>
            <span className="md:hidden">추가</span>
          </Button>
        }
      />

      <div className="mb-6">
        <Tabs
          label="가계부"
          size="md"
          value={tab}
          onChange={changeTab}
          items={[
            { value: 'ledger', label: '수입 / 지출', icon: <IconWon /> },
            { value: 'savings', label: '예적금', icon: <IconBank /> },
            { value: 'invest', label: '투자', icon: <IconTrendUp /> },
          ]}
        />
      </div>

      {tab === 'ledger' && <LedgerTab categories={allTxCats} bankCats={allBankCats} payMethodCats={allPayMethodCats} addTrigger={addTrigger.ledger} />}
      {tab === 'savings' && <SavingsTab savingCats={allSavingCats} bankCats={bankCats} addTrigger={addTrigger.savings} />}
      {tab === 'invest' && <InvestTab investCats={allInvestCats} addTrigger={addTrigger.invest} />}
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
