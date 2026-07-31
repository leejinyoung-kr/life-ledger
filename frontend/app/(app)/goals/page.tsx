'use client';

/**
 * 목표 페이지.
 * 저축·자산 목표(진행바)를 추적한다.
 * 데이터는 백엔드 API(/goals)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Card/Button/Badge/Field). 진행바(track/fill)는 공통 globals.
 */
import { useEffect, useMemo, useState } from 'react';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import { IconEdit, IconTrash } from '@/components/icons';
import { api } from '@/lib/api';
import { useFormErrors } from '@/lib/useFormErrors';
import { formatGoalValue, type Goal, type GoalTone } from '@/lib/goal';

export default function GoalsPage() {
  const [goalModal, setGoalModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Goal }>({ open: false, mode: 'add' });
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  const goalsQuery = useApiQuery<Goal[]>(qk.goals.list(), '/goals');
  const goals = useMemo(() => goalsQuery.data ?? [], [goalsQuery.data]);
  const error = goalsQuery.error?.message ?? null;
  const reload = () => invalidate(qk.goals.all);

  // 목표 삭제
  async function handleRemoveGoal(id: number) {
    if (!await confirm('이 목표를 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/goals/${id}`);
      notify.deleted('목표');
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  return (
    <AppShell activePath="/goals" topbarLabel="목표">
      <div className="mb-7">
        <div className="flex items-center justify-between gap-4">
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">목표</h1>
          <Button onClick={() => setGoalModal({ open: true, mode: 'add' })}>목표 추가</Button>
        </div>
        <p className="text-sm text-secondary mt-1.5 break-keep">저축·자산 목표를 추적합니다.</p>
      </div>

      <ErrorBanner message={error} />

      <Card>
        <CardHeader>
          <CardTitle>목표</CardTitle>
          <Badge tone="success">{goals.length}건 진행중</Badge>
        </CardHeader>
        <div>
          {goals.length === 0 && <EmptyState message="목표가 없습니다." className="px-5 py-4 text-[0.875rem] text-muted" />}
          {goals.map((goal) => (
            <div className="px-5 py-4 border-b border-border-subtle last:border-b-0" key={goal.id}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-[0.9rem] text-primary">{goal.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="[font-family:var(--font-display)] font-bold text-accent mr-1">{goal.pct}%</span>
                  <button type="button" className="icon-btn-bordered" onClick={() => setGoalModal({ open: true, mode: 'edit', editing: goal })} aria-label="수정"><IconEdit width={13} height={13} /></button>
                  <button type="button" className="icon-btn-danger" onClick={() => handleRemoveGoal(goal.id)} aria-label="삭제"><IconTrash width={13} height={13} /></button>
                </div>
              </div>
              <div className="track"><div className={`fill ${goal.tone}`} style={{ width: `${goal.pct}%` }} /></div>
              <div className="flex justify-between text-[0.78rem] text-muted mt-1.5">
                <span>{formatGoalValue(goal.unit, goal.currentVal)}</span>
                <span>목표 {formatGoalValue(goal.unit, goal.targetVal)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 목표 추가/수정 모달 */}
      <GoalModal
        open={goalModal.open}
        mode={goalModal.mode}
        editing={goalModal.editing}
        onClose={() => setGoalModal({ open: false, mode: 'add' })}
        onSaved={() => { setGoalModal({ open: false, mode: 'add' }); reload(); }}
      />

      {confirmElement}
    </AppShell>
  );
}

// 목표 추가/수정 모달
function GoalModal({ open, mode, editing, onClose, onSaved }: { open: boolean; mode: 'add' | 'edit'; editing?: Goal; onClose: () => void; onSaved: () => void }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<'won' | 'percent'>('won');
  const [currentVal, setCurrentVal] = useState('');
  const [targetVal, setTargetVal] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setName(editing?.name ?? '');
    setUnit(editing?.unit ?? 'won');
    setCurrentVal(editing ? String(editing.currentVal) : '');
    setTargetVal(editing ? String(editing.targetVal) : '');
  }, [open, editing, reset]);

  function calcTone(pct: number): GoalTone {
    if (pct >= 75) return 'green';
    if (pct >= 40) return 'warning';
    return 'danger';
  }

  function validate() {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = '목표명을 입력하세요.';
    if (!currentVal || isNaN(Number(currentVal))) err.currentVal = '현재값을 입력하세요.';
    if (!targetVal || isNaN(Number(targetVal)) || Number(targetVal) <= 0) err.targetVal = '목표값을 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const cur = Number(currentVal);
    const tgt = Number(targetVal);
    const pct = Math.min(100, Math.round((cur / tgt) * 100));
    const tone = calcTone(pct);
    const body = { name: name.trim(), unit, currentVal: cur, targetVal: tgt, pct, tone };
    try {
      if (isEdit && editing) {
        await api.put(`/goals/${editing.id}`, body);
        notify.success('목표를 수정했습니다.');
      } else {
        await api.post('/goals', body);
        notify.added('목표');
      }
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? '목표 수정' : '목표 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label="목표명" required error={errors.name}>
        <input type="text" className={`input${errors.name ? ' is-invalid' : ''}`} placeholder="예: 비상금 적립" value={name} onChange={(e) => { setName(e.target.value); clearError('name'); }} />
      </Field>
      <Field label="단위" required>
        <select className="input" aria-label="단위" value={unit} onChange={(e) => setUnit(e.target.value as 'won' | 'percent')}>
          <option value="won">금액 (원)</option>
          <option value="percent">비율 (%)</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="현재값" required error={errors.currentVal}>
          <input type="number" className={`input${errors.currentVal ? ' is-invalid' : ''}`} placeholder="0" value={currentVal} onChange={(e) => { setCurrentVal(e.target.value); clearError('currentVal'); }} />
        </Field>
        <Field label="목표값" required error={errors.targetVal}>
          <input type="number" className={`input${errors.targetVal ? ' is-invalid' : ''}`} placeholder="0" value={targetVal} onChange={(e) => { setTargetVal(e.target.value); clearError('targetVal'); }} />
        </Field>
      </div>
    </Modal>
  );
}
