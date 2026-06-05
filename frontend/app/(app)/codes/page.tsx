'use client';

/**
 * 코드 관리 페이지.
 * 가계부 카테고리·결제수단·신원지갑 종류 등 앱 전역 선택박스 항목을 도메인별로 관리한다.
 * @dnd-kit 으로 드래그 순서 변경 → 순서가 바뀐 항목만 PATCH 호출(최소 요청).
 * 스타일: Tailwind + 공통 컴포넌트(Button/Card). 드래그 transform 은 dnd-kit inline style.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
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
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
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
      toast.success(isActive ? '비활성화했습니다.' : '활성화했습니다.');
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
      <div className="mb-7">
        <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">코드 관리</h1>
        <p className="text-sm text-secondary mt-1.5">선택박스 항목을 도메인별로 관리합니다. 드래그로 순서를 변경할 수 있습니다.</p>
      </div>

      {/* 도메인 탭 */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {DOMAINS.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`px-3.5 py-1.5 rounded-[var(--radius)] border text-[0.82rem] cursor-pointer transition-all ${domain === d.key ? 'bg-accent border-accent text-white font-semibold' : 'bg-background border-border text-secondary hover:bg-surface hover:text-primary'}`}
            onClick={() => setDomain(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <Card>
        {/* 카드 헤더 */}
        <CardHeader>
          <div>
            <CardTitle>{currentDomain.label}</CardTitle>
            <span className="text-[0.78rem] text-muted ml-2.5">{currentDomain.desc}</span>
          </div>
          <div className="flex items-center gap-2">
            <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
            <Button variant="ghost" size="sm" onClick={seed}>기본값 복원</Button>
          </div>
        </CardHeader>

        {/* 항목 목록 (드래그 가능) */}
        <div className="border-t border-border-subtle">
          {loading && <p className="px-5 py-4 text-[0.875rem] text-muted">불러오는 중...</p>}

          {!loading && items.length === 0 && (
            <p className="px-5 py-4 text-[0.875rem] text-muted">항목이 없습니다. 추가하거나 기본값을 복원하세요.</p>
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
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border-subtle bg-surface">
          <IconPlus width={14} height={14} className="text-muted shrink-0" />
          <input
            type="text"
            className="input flex-1"
            placeholder="코드 (영문, 예: food)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            aria-label="코드"
          />
          <input
            type="text"
            className="input flex-[1.5]"
            placeholder="표시명 (예: 식비)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            aria-label="표시명"
          />
          <Button onClick={add} disabled={saving}>추가</Button>
        </div>
        <p className="px-5 pt-3 pb-3 text-[0.82rem] text-muted">코드는 영문 소문자·숫자·언더바만 사용 (예: public_transport)</p>
      </Card>
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

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2.5 px-5 py-2.5 border-b border-border-subtle last:border-b-0 bg-background transition-colors hover:bg-surface ${item.isActive ? '' : 'opacity-55'}`}>
      {/* 순서 번호 */}
      <span className="min-w-6 text-[0.72rem] font-bold text-muted text-right [font-family:var(--font-mono)]">{idx + 1}</span>

      {/* 드래그 핸들 */}
      <button
        type="button"
        className="flex items-center justify-center w-7 h-7 rounded-[var(--radius)] text-muted cursor-grab transition-colors hover:bg-elevated hover:text-secondary shrink-0 touch-none active:cursor-grabbing"
        aria-label="순서 변경"
        {...attributes}
        {...listeners}
      >
        <IconDrag width={14} height={14} />
      </button>

      {/* 인라인 편집 / 표시 */}
      {editingId === item.id ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            className="input flex-1 min-w-0"
            value={editLabel}
            onChange={(e) => onEditLabelChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditSave();
              if (e.key === 'Escape') onEditCancel();
            }}
            autoFocus
          />
          <Button size="sm" onClick={onEditSave}>저장</Button>
          <Button variant="ghost" size="sm" onClick={onEditCancel}>취소</Button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-[0.875rem] text-primary font-medium min-w-0">{item.label}</span>
          <span className="text-[0.72rem] text-muted [font-family:var(--font-mono)] bg-elevated px-[7px] py-0.5 rounded-[4px] whitespace-nowrap shrink-0">{item.code}</span>
          <div className="flex gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>수정</Button>
            <Button variant={item.isActive ? 'ghost' : 'primary'} size="sm" onClick={() => onToggle(item.id, item.isActive)}>
              {item.isActive ? '비활성' : '활성'}
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(item.id)}>삭제</Button>
          </div>
        </>
      )}
    </div>
  );
}
