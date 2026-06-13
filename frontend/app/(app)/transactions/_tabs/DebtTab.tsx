'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import StatCard from '@/components/StatCard';
import Pagination, { LimitSelect } from '@/components/Pagination';
import { useConfirm } from '@/components/ConfirmModal';
import { IconCreditCard } from '@/components/icons';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { won } from '@/lib/finance';
import { type Asset } from '@/lib/networth';
import {
  TABLE_CARD, TXCARDS, TXCARD, TXCARD_TOP, TXCARD_TITLE, TXCARD_AMT, TXCARD_SUB, TXCARD_EMPTY,
  RowActions, CardActions,
} from '../_shared';
import { AssetModal, type AssetModalState } from './AssetModal';

export default function DebtTab({ addTrigger }: { addTrigger: number }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { confirm, confirmElement } = useConfirm();
  const [modal, setModal] = useState<AssetModalState>({ open: false, mode: 'add' });
  const invalidate = useInvalidate();

  const mountTrigger = useRef(addTrigger);
  useEffect(() => {
    if (addTrigger !== mountTrigger.current) {
      mountTrigger.current = addTrigger;
      setModal({ open: true, mode: 'add' });
    }
  }, [addTrigger]);

  // 부채 목록 (React Query 캐시) — 서버 페이징. sum=전체 잔액 합계, count=전체 건수
  const rowsQuery = useApiQuery<Paginated<Asset> & { sum: number }>(
    qk.assets.list({ type: 'debt', page, limit }),
    `/assets?type=debt&page=${page}&limit=${limit}`,
  );
  const rows = useMemo(() => rowsQuery.data?.items ?? [], [rowsQuery.data]);
  const count = rowsQuery.data?.total ?? 0;
  const sum = rowsQuery.data?.sum ?? 0;
  const reload = () => invalidate(qk.assets.all);

  async function remove(id: number) {
    if (!await confirm('이 부채 항목을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/assets/${id}`);
      notify.deleted('부채 항목');
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 부채 항목 복사 — 해당 데이터로 채운 추가 모달을 열어 확인 후 저장
  function duplicate(row: Asset) {
    setModal({ open: true, mode: 'add', prefill: row });
  }

  const totalPages = Math.ceil(count / limit);
  const paged = rows; // 서버가 이미 페이지 단위로 잘라서 보냄

  return (
    <>
      <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<IconCreditCard />} tone="red" value={won(sum)} label="총 부채" change={`${count}건`} changeDir="down" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.78rem] text-secondary">총 {count}건</span>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      <div className={`${TABLE_CARD} mb-4`}>
        <div className="table-wrap max-md:hidden">
          <table>
            <colgroup>
              <col style={{ width: '64px' }} /><col /><col style={{ width: '160px' }} />
              <col style={{ width: '80px' }} /><col style={{ width: '180px' }} /><col style={{ width: '72px' }} />
            </colgroup>
            <thead>
              <tr><th>번호</th><th>항목명</th><th>잔액</th><th>금리</th><th>메모</th><th>관리</th></tr>
            </thead>
            <tbody>
              {paged.length === 0 && <tr><td colSpan={6} className="td-center td-muted">부채 항목이 없습니다.</td></tr>}
              {paged.map((row, i) => (
                <tr key={row.id}>
                  <td className="td-center td-muted">{count - (page - 1) * limit - i}</td>
                  <td className="td-strong">{row.name}</td>
                  <td className="td-mono td-right">{won(row.amount)}</td>
                  <td className="td-right">{row.interestRate !== null ? `${row.interestRate}%` : '-'}</td>
                  <td className="td-center td-muted">{row.memo ?? '-'}</td>
                  <td className="td-center"><RowActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => remove(row.id)} onCopy={() => duplicate(row)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={TXCARDS}>
          {paged.length === 0 && <div className={TXCARD_EMPTY}>부채 항목이 없습니다.</div>}
          {paged.map((row) => (
            <div className={TXCARD} key={row.id}>
              <div className={TXCARD_TOP}>
                <span className={TXCARD_TITLE}>{row.name}</span>
                <span className={`${TXCARD_AMT} text-danger`}>{won(row.amount)}</span>
              </div>
              <div className={TXCARD_SUB}>
                {row.interestRate !== null && <span>금리 {row.interestRate}%</span>}
                {row.memo && <span>{row.memo}</span>}
              </div>
              <CardActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => remove(row.id)} onCopy={() => duplicate(row)} />
            </div>
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={count} onPageChange={setPage} />
      </div>

      <AssetModal
        assetType="debt"
        state={modal}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); reload(); }}
      />
      {confirmElement}
    </>
  );
}
