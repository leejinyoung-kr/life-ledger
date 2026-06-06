'use client';

import { useEffect, useRef, useState } from 'react';
import StatCard from '@/components/StatCard';
import Pagination, { LimitSelect } from '@/components/Pagination';
import { useConfirm } from '@/components/ConfirmModal';
import { IconHome } from '@/components/icons';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import { won } from '@/lib/finance';
import { type Asset } from '@/lib/networth';
import {
  TABLE_CARD, TXCARDS, TXCARD, TXCARD_TOP, TXCARD_TITLE, TXCARD_AMT, TXCARD_SUB, TXCARD_EMPTY,
  RowActions, CardActions,
} from '../_shared';
import { AssetModal, type AssetModalState } from './AssetModal';

export default function RealEstateTab({ addTrigger }: { addTrigger: number }) {
  const [rows, setRows] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);
  const { confirm, confirmElement } = useConfirm();
  const [modal, setModal] = useState<AssetModalState>({ open: false, mode: 'add' });

  const mountTrigger = useRef(addTrigger);
  useEffect(() => {
    if (addTrigger !== mountTrigger.current) {
      mountTrigger.current = addTrigger;
      setModal({ open: true, mode: 'add' });
    }
  }, [addTrigger]);

  useEffect(() => {
    api.get<Asset[]>('/assets?type=realestate').then((list) => {
      setRows(list);
      setTotal(list.reduce((s, r) => s + r.amount, 0));
    });
  }, [reloadKey]);

  async function remove(id: number) {
    if (!await confirm('이 부동산 항목을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/assets/${id}`);
      notify.deleted('부동산 항목');
      setReloadKey((k) => k + 1);
    } catch {
      notify.deleteFailed();
    }
  }

  const totalPages = Math.ceil(rows.length / limit);
  const paged = rows.slice((page - 1) * limit, page * limit);

  return (
    <>
      <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<IconHome />} tone="blue" value={won(total)} label="총 부동산" change={`${rows.length}건`} changeDir="neutral" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.78rem] text-secondary">총 {rows.length}건</span>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      <div className={`${TABLE_CARD} mb-4`}>
        <div className="table-wrap max-md:hidden">
          <table>
            <colgroup>
              <col style={{ width: '64px' }} /><col /><col style={{ width: '160px' }} />
              <col style={{ width: '220px' }} /><col style={{ width: '72px' }} />
            </colgroup>
            <thead>
              <tr><th>번호</th><th>자산명</th><th>현재가</th><th>메모</th><th>관리</th></tr>
            </thead>
            <tbody>
              {paged.length === 0 && <tr><td colSpan={5} className="td-center td-muted">부동산 항목이 없습니다.</td></tr>}
              {paged.map((row, i) => (
                <tr key={row.id}>
                  <td className="td-center td-muted">{rows.length - (page - 1) * limit - i}</td>
                  <td className="td-strong">{row.name}</td>
                  <td className="td-mono td-right">{won(row.amount)}</td>
                  <td className="td-center td-muted">{row.memo ?? '-'}</td>
                  <td className="td-center"><RowActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => remove(row.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={TXCARDS}>
          {paged.length === 0 && <div className={TXCARD_EMPTY}>부동산 항목이 없습니다.</div>}
          {paged.map((row) => (
            <div className={TXCARD} key={row.id}>
              <div className={TXCARD_TOP}>
                <span className={TXCARD_TITLE}>{row.name}</span>
                <span className={TXCARD_AMT}>{won(row.amount)}</span>
              </div>
              {row.memo && <div className={TXCARD_SUB}>{row.memo}</div>}
              <CardActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => remove(row.id)} />
            </div>
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={rows.length} onPageChange={setPage} />
      </div>

      <AssetModal
        assetType="realestate"
        state={modal}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); setReloadKey((k) => k + 1); }}
      />
      {confirmElement}
    </>
  );
}
