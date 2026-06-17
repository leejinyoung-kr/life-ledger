'use client';

/**
 * 코드 관리 페이지.
 * 가계부 카테고리·결제수단·신원지갑 종류 등 앱 전역 선택박스 항목을 도메인별로 관리한다.
 * @dnd-kit 으로 드래그 순서 변경 → 순서가 바뀐 항목만 PATCH 호출(최소 요청).
 * 스타일: Tailwind + 공통 컴포넌트(Button/Card). 드래그 transform 은 dnd-kit inline style.
 */
import { Fragment, useCallback, useEffect, useState, type CSSProperties } from 'react';
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
import { notify } from '@/lib/toast';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/EmptyState';
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
  | 'bank'
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
  { key: 'bank',           label: '은행/기관',        desc: '예적금·계좌의 은행/금융기관' },
  { key: 'credential_cat', label: '계정 카테고리',    desc: '개발·금융·소셜 등' },
  { key: 'id_type',        label: '신원지갑 종류',    desc: '여권·주민등록증·자격증 등' },
  { key: 'env_group',      label: 'ENV 그룹',         desc: 'Database·Auth·Storage 등' },
];

interface CodeItem {
  id: number;
  domain: string;
  code: string;
  label: string;
  parentCode: string | null; // 소분류면 대분류 code (가계부 도메인 2계층)
  sortOrder: number;
  isActive: boolean;
}

const NEW_PARENT = '__new__'; // 추가 폼에서 "새 대분류" 선택값

export default function CodesPage() {
  const [domain, setDomain] = useState<Domain>('transaction');
  const [items, setItems] = useState<CodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newParent, setNewParent] = useState(NEW_PARENT); // 가계부: 추가할 항목의 대분류 (NEW_PARENT=새 대분류)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const { confirm, confirmElement } = useConfirm();

  // 도메인별 항목 조회
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CodeItem[]>(`/categories?domain=${domain}`);
      setItems(data);
    } catch {
      notify.loadFailed();
    } finally {
      setLoading(false);
    }
  }, [domain]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- domain 변경 시 목록 재조회
  useEffect(() => { load(); }, [load]);

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
      notify.success('순서가 변경됐습니다.');
      load();
    } catch {
      notify.error('순서 저장에 실패했습니다.');
      load();
    }
  }

  // 가계부 2계층 드래그 — 대분류끼리 / 소분류는 같은 대분류 안에서만 정렬(부모 넘나들기 차단)
  async function handleHierDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const a = items.find((i) => i.id === active.id);
    const o = items.find((i) => i.id === over.id);
    if (!a || !o) return;

    const ps = items.filter((i) => !i.parentCode);
    let newItems: CodeItem[] | null = null;

    if (!a.parentCode && !o.parentCode) {
      // 대분류끼리 재정렬
      const from = ps.findIndex((p) => p.id === a.id);
      const to = ps.findIndex((p) => p.id === o.id);
      const np = arrayMove(ps, from, to);
      newItems = np.flatMap((p) => [p, ...items.filter((i) => i.parentCode === p.code)]);
    } else if (a.parentCode && a.parentCode === o.parentCode) {
      // 같은 대분류의 소분류끼리 재정렬
      const sibs = items.filter((i) => i.parentCode === a.parentCode);
      const from = sibs.findIndex((s) => s.id === a.id);
      const to = sibs.findIndex((s) => s.id === o.id);
      const ns = arrayMove(sibs, from, to);
      newItems = ps.flatMap((p) => [p, ...(p.code === a.parentCode ? ns : items.filter((i) => i.parentCode === p.code))]);
    } else {
      return; // 부모 넘나들기·타입 불일치 차단
    }

    // 트리 순서대로 sort_order 재계산 + 바뀐 행만 PATCH
    const withOrder = newItems.map((it, idx) => ({ ...it, sortOrder: idx + 1 }));
    setItems(withOrder); // 낙관적 갱신
    const updates = withOrder.filter((it) => items.find((p) => p.id === it.id)?.sortOrder !== it.sortOrder);
    try {
      await Promise.all(updates.map((it) => api.patch(`/categories/${it.id}`, { sortOrder: it.sortOrder })));
      notify.success('순서가 변경됐습니다.');
      load();
    } catch {
      notify.error('순서 저장에 실패했습니다.');
      load();
    }
  }

  // 항목 추가
  async function add() {
    if (!newCode.trim() || !newLabel.trim()) {
      notify.error('코드와 표시명을 모두 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      // 가계부 도메인에서 대분류 선택 시 소분류로 등록(parentCode), "새 대분류"면 대분류로 등록
      const parentCode = hierDomain && newParent !== NEW_PARENT ? newParent : undefined;
      await api.post('/categories', {
        domain,
        code: newCode.trim().toLowerCase().replace(/\s+/g, '_'),
        label: newLabel.trim(),
        parentCode,
      });
      notify.added('항목');
      setNewCode(''); setNewLabel('');
      load();
    } catch (e) {
      notify.error((e as Error).message.includes('이미') ? '이미 존재하는 코드입니다.' : '추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // 라벨 수정 저장
  async function saveEdit(id: number) {
    if (!editLabel.trim()) return;
    try {
      await api.patch(`/categories/${id}`, { label: editLabel.trim() });
      notify.success('수정됐습니다.');
      setEditingId(null);
      load();
    } catch {
      notify.updateFailed();
    }
  }

  // 활성/비활성 토글
  async function toggleActive(id: number, isActive: boolean) {
    try {
      await api.patch(`/categories/${id}`, { isActive: !isActive });
      notify.success(isActive ? '비활성화했습니다.' : '활성화했습니다.');
      load();
    } catch {
      notify.updateFailed();
    }
  }

  // 삭제
  async function remove(id: number) {
    if (!await confirm('이 항목을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/categories/${id}`);
      notify.success('삭제됐습니다.');
      load();
    } catch {
      notify.deleteFailed();
    }
  }

  // 기본값 복원
  async function seed() {
    if (!await confirm('기본 항목으로 복원할까요? 기존 항목은 유지됩니다.', 'primary')) return;
    try {
      await api.post(`/categories/seed?domain=${domain}`, {});
      notify.success('기본값이 복원됐습니다.');
      load();
    } catch {
      notify.error('복원에 실패했습니다.');
    }
  }

  const currentDomain = DOMAINS.find((d) => d.key === domain)!;
  // 가계부 도메인만 2계층(대분류→소분류) — 그룹 렌더 + 추가 시 대분류 선택
  const hierDomain = domain === 'transaction';
  const parentItems = items.filter((i) => !i.parentCode);
  const childrenOf = (code: string) => items.filter((i) => i.parentCode === code);

  return (
    <AppShell activePath="/codes" topbarLabel="코드 관리">
      <div className="mb-7">
        <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">코드 관리</h1>
        <p className="text-sm text-secondary mt-1.5">선택박스 항목을 도메인별로 관리합니다. 드래그로 순서를 변경할 수 있습니다.</p>
      </div>

      {/* 도메인 탭 — 모바일은 가로 스크롤, 데스크탑은 줄바꿈 */}
      <div className="flex gap-1.5 mb-4 max-md:overflow-x-auto max-md:flex-nowrap max-md:pb-1.5 md:flex-wrap">
        {DOMAINS.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`px-3.5 py-1.5 rounded-[var(--radius)] border text-[0.82rem] cursor-pointer transition-all whitespace-nowrap shrink-0 ${domain === d.key ? 'bg-accent border-accent text-white font-semibold' : 'bg-background border-border text-secondary hover:bg-surface hover:text-primary'}`}
            onClick={() => setDomain(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <Card>
        {/* 카드 헤더 — 모바일은 세로로 쌓고 버튼은 우측 정렬 */}
        <CardHeader className="max-md:flex-col max-md:items-start max-md:gap-2">
          <div>
            <CardTitle>{currentDomain.label}</CardTitle>
            <span className="text-[0.78rem] text-muted ml-2.5">{currentDomain.desc}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={seed} className="max-md:self-end">기본값 복원</Button>
        </CardHeader>

        {/* 항목 목록 (드래그 가능) */}
        <div className="border-t border-border-subtle">
          {loading && <p className="px-5 py-4 text-[0.875rem] text-muted">불러오는 중...</p>}

          {!loading && items.length === 0 && (
            <EmptyState message="항목이 없습니다. 추가하거나 기본값을 복원하세요." className="px-5 py-4 text-[0.875rem] text-muted" />
          )}

          <div className="max-h-64.5 md:max-h-118.25 overflow-y-auto">
            {/* 가계부: 대분류 → 소분류 그룹(드래그 없음). 그 외 도메인: 드래그 정렬 평면 목록 */}
            {hierDomain ? (
              !loading && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHierDragEnd}>
                  {/* 대분류끼리 정렬 */}
                  <SortableContext items={parentItems.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    {parentItems.map((p) => (
                      <Fragment key={p.id}>
                        <SortableGroupRow
                          item={p} isParent
                          editingId={editingId} editLabel={editLabel} onEditLabelChange={setEditLabel}
                          onEdit={(it) => { setEditingId(it.id); setEditLabel(it.label); }}
                          onEditSave={() => saveEdit(p.id)} onEditCancel={() => setEditingId(null)}
                          onToggle={toggleActive} onDelete={remove}
                        />
                        {/* 같은 대분류 안 소분류끼리 정렬 */}
                        <SortableContext items={childrenOf(p.code).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                          {childrenOf(p.code).map((c) => (
                            <SortableGroupRow
                              key={c.id} item={c}
                              editingId={editingId} editLabel={editLabel} onEditLabelChange={setEditLabel}
                              onEdit={(it) => { setEditingId(it.id); setEditLabel(it.label); }}
                              onEditSave={() => saveEdit(c.id)} onEditCancel={() => setEditingId(null)}
                              onToggle={toggleActive} onDelete={remove}
                            />
                          ))}
                        </SortableContext>
                      </Fragment>
                    ))}
                  </SortableContext>
                </DndContext>
              )
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((item, idx) => (
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
            )}
          </div>
        </div>

        {/* 추가 폼 — 모바일은 세로 스택(입력란들 → 추가 버튼), 데스크탑은 한 줄 */}
        <div className="flex flex-col gap-2 px-5 py-3 border-t border-border-subtle bg-surface md:flex-row md:items-center">
          <IconPlus width={14} height={14} className="text-muted shrink-0 max-md:hidden" />
          {hierDomain && (
            <select
              className="input max-md:w-full md:w-auto! md:min-w-[120px] shrink-0"
              value={newParent}
              onChange={(e) => setNewParent(e.target.value)}
              aria-label="대분류"
            >
              <option value={NEW_PARENT}>+ 새 대분류</option>
              {parentItems.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
          )}
          <input
            type="text"
            className="input max-md:w-full md:flex-1"
            placeholder="코드 (영문, 예: food)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            aria-label="코드"
          />
          <input
            type="text"
            className="input max-md:w-full md:flex-[1.5]"
            placeholder="표시명 (예: 식비)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            aria-label="표시명"
          />
          <Button className="max-md:w-full" onClick={add} disabled={saving}>추가</Button>
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
    <div ref={setNodeRef} style={style} className={`flex flex-wrap items-center gap-2.5 px-5 py-2.5 border-b border-border-subtle last:border-b-0 bg-background transition-colors hover:bg-surface ${item.isActive ? '' : 'opacity-55'}`}>
      {/* 순서 번호 */}
      <span className="min-w-6 text-[0.72rem] font-bold text-muted text-right [font-family:var(--font-mono)] shrink-0">{idx + 1}</span>

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
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
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
          <div className="flex-1 flex items-center gap-2 min-w-[120px]">
            <span className="text-[0.72rem] text-muted [font-family:var(--font-mono)] bg-elevated px-[7px] py-0.5 rounded-[4px] whitespace-nowrap shrink-0">{item.code}</span>
            <span className={`text-[0.875rem] font-medium truncate ${item.isActive ? 'text-primary' : 'text-muted line-through'}`}>{item.label}</span>
            {!item.isActive && <span className="text-[0.68rem] font-semibold px-1.5 py-0.5 rounded bg-warning-dim text-warning shrink-0">비활성</span>}
          </div>
          <div className="flex gap-1.5 shrink-0 ml-auto">
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

// ── 2계층(가계부) 그룹 행 — 드래그 정렬. isParent=대분류 헤더(대분류끼리), 아니면 들여쓴 소분류(같은 부모 안) ──
interface SortableGroupRowProps {
  item: CodeItem;
  isParent?: boolean;
  editingId: number | null;
  editLabel: string;
  onEditLabelChange: (v: string) => void;
  onEdit: (item: CodeItem) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onToggle: (id: number, isActive: boolean) => void;
  onDelete: (id: number) => void;
}

function SortableGroupRow({
  item, isParent,
  editingId, editLabel, onEditLabelChange,
  onEdit, onEditSave, onEditCancel,
  onToggle, onDelete,
}: SortableGroupRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : item.isActive ? 1 : 0.55,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex flex-wrap items-center gap-2.5 px-5 py-2.5 border-b border-border-subtle last:border-b-0 transition-colors hover:bg-surface ${isParent ? 'bg-surface' : 'bg-background pl-8'}`}>
      <button
        type="button"
        className="flex items-center justify-center w-7 h-7 rounded-[var(--radius)] text-muted cursor-grab transition-colors hover:bg-elevated hover:text-secondary shrink-0 touch-none active:cursor-grabbing"
        aria-label="순서 변경"
        {...attributes}
        {...listeners}
      >
        <IconDrag width={14} height={14} />
      </button>
      {editingId === item.id ? (
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
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
          <div className="flex-1 flex items-center gap-2 min-w-[120px]">
            <span className="text-[0.72rem] text-muted [font-family:var(--font-mono)] bg-elevated px-[7px] py-0.5 rounded-[4px] whitespace-nowrap shrink-0">{item.code}</span>
            <span className={`truncate ${isParent ? 'text-[0.9rem] font-bold' : 'text-[0.875rem] font-medium'} ${item.isActive ? 'text-primary' : 'text-muted line-through'}`}>{item.label}</span>
            {!item.isActive && <span className="text-[0.68rem] font-semibold px-1.5 py-0.5 rounded bg-warning-dim text-warning shrink-0">비활성</span>}
          </div>
          <div className="flex gap-1.5 shrink-0 ml-auto">
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
