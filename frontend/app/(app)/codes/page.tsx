'use client';

/**
 * 코드 관리 페이지.
 * 가계부 카테고리·결제수단·신원지갑 종류 등 앱 전역 선택박스 항목을 도메인별로 관리한다.
 * @dnd-kit 으로 드래그 순서 변경 → 순서가 바뀐 항목만 PATCH 호출(최소 요청).
 */
import { useCallback, useEffect, useState } from 'react';
import Pagination, { LimitSelect } from '@/components/Pagination';
import { useConfirm } from '@/components/ConfirmModal';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { IconDrag, IconPlus } from '@/components/icons';
import { api } from '@/lib/api';

type Domain =
  | 'transaction'
  | 'pay_method'
  | 'subscription'
  | 'asset'
  | 'investment'
  | 'saving'
  | 'credential_cat'
  | 'id_type'
  | 'env_group';

const DOMAINS: { key: Domain; label: string; desc: string }[] = [
  { key: 'transaction',    label: '가계부 카테고리', desc: '수입/지출 내역의 카테고리' },
  { key: 'pay_method',     label: '결제수단',        desc: '카드·계좌·간편결제 등' },
  { key: 'subscription',   label: '구독 카테고리',   desc: 'OTT·음악·클라우드 등' },
  { key: 'asset',          label: '자산 유형',        desc: '현금성·예적금·투자 등' },
  { key: 'investment',     label: '투자 유형',        desc: '국내외 주식·ETF·코인 등' },
  { key: 'saving',         label: '예적금 유형',      desc: '적금·예금·청약 등' },
  { key: 'credential_cat', label: '계정 카테고리',    desc: '개발·금융·소셜 등' },
  { key: 'id_type',        label: '신원지갑 종류',    desc: '여권·주민등록증·자격증 등' },
  { key: 'env_group',      label: 'ENV 그룹',         desc: 'Database·Auth·Storage 등' },
];

interface CodeItem {
  id: number;
  domain: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export default function CodesPage() {
  const [domain, setDomain] = useState<Domain>('transaction');
  const [items, setItems] = useState<CodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const { confirm, confirmElement } = useConfirm();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // 도메인별 항목 조회
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CodeItem[]>(`/categories?domain=${domain}`);
      setItems(data);
    } catch {
      toast.error('항목을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => { load(); setPage(1); }, [load]);

  // 드래그 종료 — 순서 바뀐 항목만 PATCH(최소 요청)
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered); // 낙관적 갱신

    const updates = reordered
      .map((item, idx) => ({ item, newOrder: idx + 1 }))
      .filter(({ item, newOrder }) => item.sortOrder !== newOrder);

    try {
      await Promise.all(
        updates.map(({ item, newOrder }) =>
          api.patch(`/categories/${item.id}`, { sortOrder: newOrder }),
        ),
      );
      toast.success('순서가 변경됐습니다.');
      load();
    } catch {
      toast.error('순서 저장에 실패했습니다.');
      load();
    }
  }

  // 항목 추가
  async function add() {
    if (!newCode.trim() || !newLabel.trim()) {
      toast.error('코드와 표시명을 모두 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/categories', {
        domain,
        code: newCode.trim().toLowerCase().replace(/\s+/g, '_'),
        label: newLabel.trim(),
      });
      toast.success('항목이 추가됐습니다.');
      setNewCode(''); setNewLabel('');
      load();
    } catch (e) {
      toast.error((e as Error).message.includes('이미') ? '이미 존재하는 코드입니다.' : '추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // 라벨 수정 저장
  async function saveEdit(id: number) {
    if (!editLabel.trim()) return;
    try {
      await api.patch(`/categories/${id}`, { label: editLabel.trim() });
      toast.success('수정됐습니다.');
      setEditingId(null);
      load();
    } catch {
      toast.error('수정에 실패했습니다.');
    }
  }

  // 활성/비활성 토글
  async function toggleActive(id: number, isActive: boolean) {
    try {
      await api.patch(`/categories/${id}`, { isActive: !isActive });
      load();
    } catch {
      toast.error('수정에 실패했습니다.');
    }
  }

  // 삭제
  async function remove(id: number) {
    if (!await confirm('이 항목을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/categories/${id}`);
      toast.success('삭제됐습니다.');
      load();
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  }

  // 기본값 복원
  async function seed() {
    if (!await confirm('기본 항목으로 복원할까요? 기존 항목은 유지됩니다.', 'primary')) return;
    try {
      await api.post(`/categories/seed?domain=${domain}`, {});
      toast.success('기본값이 복원됐습니다.');
      load();
    } catch {
      toast.error('복원에 실패했습니다.');
    }
  }

  const totalPages = Math.ceil(items.length / limit);
  const pagedItems = items.slice((page - 1) * limit, page * limit);
  const currentDomain = DOMAINS.find((d) => d.key === domain)!;

  return (
    <AppShell activePath="/codes" topbarLabel="코드 관리">
      <div className="page-header">
        <div>
          <h1 className="page-title">코드 관리</h1>
          <p className="page-subtitle">선택박스 항목을 도메인별로 관리합니다. 드래그로 순서를 변경할 수 있습니다.</p>
        </div>
      </div>

      {/* 도메인 탭 */}
      <div className="cat-domain-tabs">
        {DOMAINS.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`cat-domain-tab${domain === d.key ? ' active' : ''}`}
            onClick={() => setDomain(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="card">
        {/* 카드 헤더 */}
        <div className="card-header">
          <div>
            <span className="card-title">{currentDomain.label}</span>
            <span className="codes-domain-desc">{currentDomain.desc}</span>
          </div>
          <div className="flex-center gap-2">
            <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={seed}>
              기본값 복원
            </button>
          </div>
        </div>

        {/* 항목 목록 (드래그 가능) */}
        <div className="codes-list">
          {loading && <p className="codes-empty">불러오는 중...</p>}

          {!loading && items.length === 0 && (
            <p className="codes-empty">항목이 없습니다. 추가하거나 기본값을 복원하세요.</p>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {pagedItems.map((item, idx) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  idx={idx}
                  editingId={editingId}
                  editLabel={editLabel}
                  onEditLabelChange={setEditLabel}
                  onEdit={(it) => { setEditingId(it.id); setEditLabel(it.label); }}
                  onEditSave={() => saveEdit(item.id)}
                  onEditCancel={() => setEditingId(null)}
                  onToggle={toggleActive}
                  onDelete={remove}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Pagination page={page} totalPages={totalPages} totalItems={items.length} onPageChange={setPage} />
        </div>

        {/* 추가 폼 */}
        <div className="codes-add-row">
          <IconPlus width={14} height={14} className="codes-add-icon" />
          <input
            type="text"
            className="input"
            placeholder="코드 (영문, 예: food)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            aria-label="코드"
          />
          <input
            type="text"
            className="input codes-add-label"
            placeholder="표시명 (예: 식비)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            aria-label="표시명"
          />
          <button type="button" className="btn btn-primary" onClick={add} disabled={saving}>
            추가
          </button>
        </div>
        <p className="settings-note">코드는 영문 소문자·숫자·언더바만 사용 (예: public_transport)</p>
      </div>
      {confirmElement}
    </AppShell>
  );
}

// ── 드래그 가능한 항목 행 ─────────────────────────────────────────────────
interface SortableRowProps {
  item: CodeItem;
  idx: number;
  editingId: number | null;
  editLabel: string;
  onEditLabelChange: (v: string) => void;
  onEdit: (item: CodeItem) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onToggle: (id: number, isActive: boolean) => void;
  onDelete: (id: number) => void;
}

function SortableRow({
  item, idx,
  editingId, editLabel, onEditLabelChange,
  onEdit, onEditSave, onEditCancel,
  onToggle, onDelete,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`code-item${!item.isActive ? ' code-item--off' : ''}`}>
      {/* 순서 번호 */}
      <span className="code-order">{idx + 1}</span>

      {/* 드래그 핸들 */}
      <button
        type="button"
        className="code-drag-handle"
        aria-label="순서 변경"
        {...attributes}
        {...listeners}
      >
        <IconDrag width={14} height={14} />
      </button>

      {/* 인라인 편집 / 표시 */}
      {editingId === item.id ? (
        <div className="code-edit-inline">
          <input
            type="text"
            className="input"
            value={editLabel}
            onChange={(e) => onEditLabelChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditSave();
              if (e.key === 'Escape') onEditCancel();
            }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={onEditSave}>저장</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onEditCancel}>취소</button>
        </div>
      ) : (
        <>
          <span className="code-label">{item.label}</span>
          <span className="code-badge">{item.code}</span>
          <div className="code-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(item)}>수정</button>
            <button
              type="button"
              className={`btn btn-sm ${item.isActive ? 'btn-ghost' : 'btn-primary'}`}
              onClick={() => onToggle(item.id, item.isActive)}
            >
              {item.isActive ? '비활성' : '활성'}
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(item.id)}>삭제</button>
          </div>
        </>
      )}
    </div>
  );
}
