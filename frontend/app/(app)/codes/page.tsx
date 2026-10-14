'use client';

/**
 * 코드 관리 페이지.
 * 가계부 카테고리·결제수단 등 앱 전역 선택박스 항목을 도메인별로 관리한다.
 * @dnd-kit 으로 드래그 순서 변경 → 순서가 바뀐 항목만 PATCH 호출(최소 요청).
 * 드래그 transform 은 dnd-kit inline style.
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
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import MoreMenu from '@/components/ui/MoreMenu';
import Badge from '@/components/ui/Badge';
import Segmented from '@/components/ui/Segmented';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { IconBan, IconDrag, IconEdit, IconPlay, IconPlus, IconRefresh, IconTrash } from '@/components/icons';
import { api } from '@/lib/api';
import { PageLoading } from '@/components/QueryState';

type Domain =
  | 'transaction'
  | 'pay_method'
  | 'subscription'
  | 'asset'
  | 'investment'
  | 'saving'
  | 'bank'
  | 'credential_cat';

const DOMAINS: { key: Domain; label: string; desc: string }[] = [
  { key: 'transaction',    label: '가계부 카테고리', desc: '수입/지출 내역의 카테고리' },
  { key: 'pay_method',     label: '결제수단',        desc: '카드·계좌·간편결제 등' },
  { key: 'subscription',   label: '구독 카테고리',   desc: 'OTT·음악·클라우드 등' },
  { key: 'asset',          label: '자산 유형',        desc: '현금성·예적금·투자 등' },
  { key: 'investment',     label: '투자 유형',        desc: '국내외 주식·ETF·코인 등' },
  { key: 'saving',         label: '예적금 유형',      desc: '적금·예금·청약 등' },
  { key: 'bank',           label: '은행/기관',        desc: '예적금·계좌의 은행/금융기관' },
  { key: 'credential_cat', label: '계정 카테고리',    desc: '개발·금융·소셜 등' },
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
  async function handleAdd() {
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
  async function handleSeed() {
    if (!await confirm('기본 항목으로 복원할까요? 기존 항목은 유지됩니다.', 'primary', '복원')) return;
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
    <AppShell activePath="/codes">
      <PageHeader title="코드 관리" description="선택박스 항목을 종류별로 관리합니다. 끌어서 순서를 바꿉니다." />

      {/* 종류 알약 — 모바일은 가로 스크롤, 데스크탑은 줄바꿈 */}
      <Segmented
        label="종류"
        className="mb-4 max-md:overflow-x-auto max-md:scrollbar-none max-md:flex-nowrap md:flex-wrap"
        value={domain}
        onChange={setDomain}
        items={DOMAINS.map((d) => ({ value: d.key, label: d.label }))}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col min-w-0">
            <CardTitle>{currentDomain.label}</CardTitle>
            <span className="text-xs text-muted">{currentDomain.desc}{hierDomain ? ' · 대분류 › 소분류' : ''}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSeed}><IconRefresh />기본값 복원</Button>
        </CardHeader>

        {/* 항목 목록 (드래그 가능) */}
        <div>
          {loading && <PageLoading size="sm" />}

          {!loading && items.length === 0 && (
            <EmptyState message="항목이 없습니다. 추가하거나 기본값을 복원하세요." />
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
                        <SortableRow
                          item={p} level="parent"
                          editingId={editingId} editLabel={editLabel} onEditLabelChange={setEditLabel}
                          onEdit={(it) => { setEditingId(it.id); setEditLabel(it.label); }}
                          onEditSave={() => saveEdit(p.id)} onEditCancel={() => setEditingId(null)}
                          onToggle={toggleActive} onDelete={remove}
                        />
                        {/* 같은 대분류 안 소분류끼리 정렬 */}
                        <SortableContext items={childrenOf(p.code).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                          {childrenOf(p.code).map((c) => (
                            <SortableRow
                              key={c.id} item={c} level="child"
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
                  {items.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      level="flat"
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
        <div className="flex flex-col gap-2 px-4.5 py-3 border-t border-border md:flex-row md:items-center">
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
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            aria-label="표시명"
          />
          <Button className="max-md:w-full" onClick={handleAdd} disabled={saving}><IconPlus />추가</Button>
        </div>
        <p className="px-4.5 pb-3 text-xs text-muted">코드는 영문 소문자·숫자·언더바만 사용 (예: public_transport)</p>
      </Card>
      {confirmElement}
    </AppShell>
  );
}

// ── 드래그 가능한 항목 행 ─────────────────────────────────────────────────
// level: flat=평면 목록, parent=가계부 대분류(굵게), child=가계부 소분류(들여쓰기)
interface SortableRowProps {
  item: CodeItem;
  level: 'flat' | 'parent' | 'child';
  editingId: number | null;
  editLabel: string;
  onEditLabelChange: (v: string) => void;
  onEdit: (item: CodeItem) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onToggle: (id: number, isActive: boolean) => void;
  onDelete: (id: number) => void;
}

// 정렬 가능한 코드 한 줄 — 표시명이 주인공, 코드는 흐리게, 관리는 더보기 메뉴
function SortableRow({
  item, level,
  editingId, editLabel, onEditLabelChange,
  onEdit, onEditSave, onEditCancel,
  onToggle, onDelete,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : item.isActive ? 1 : 0.55,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2.5 min-h-11 pr-2 border-b border-border-subtle last:border-b-0 bg-background transition-colors hover:bg-hover ${level === 'child' ? 'pl-8' : 'pl-2'}`}>
      <IconButton label="순서 변경" variant="handle" {...attributes} {...listeners}>
        <IconDrag width={14} height={14} />
      </IconButton>

      {editingId === item.id ? (
        <div className="flex items-center gap-2 flex-1 min-w-0 py-1.5">
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
          <Button variant="ghost" size="sm" onClick={onEditSave}>저장</Button>
          <Button variant="ghost" size="sm" onClick={onEditCancel}>취소</Button>
        </div>
      ) : (
        <>
          <span className={`min-w-0 truncate ${level === 'parent' ? 'font-semibold' : ''} ${item.isActive ? 'text-primary' : 'text-muted line-through'}`}>{item.label}</span>
          <span className="text-[0.72rem] text-muted truncate shrink-0 max-w-[40%]">{item.code}</span>
          {!item.isActive && <Badge tone="warning" size="sm">비활성</Badge>}
          <span className="flex-1" />
          <MoreMenu
            size="lg"
            items={[
              { label: '수정', icon: <IconEdit />, onSelect: () => onEdit(item) },
              item.isActive
                ? { label: '비활성', icon: <IconBan />, onSelect: () => onToggle(item.id, item.isActive) }
                : { label: '활성', icon: <IconPlay />, onSelect: () => onToggle(item.id, item.isActive) },
              { label: '삭제', icon: <IconTrash />, danger: true, onSelect: () => onDelete(item.id) },
            ]}
          />
        </>
      )}
    </div>
  );
}
