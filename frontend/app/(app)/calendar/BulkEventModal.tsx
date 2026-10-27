'use client';

/**
 * 일정 일괄 추가 창.
 * 유형 · 알림은 위에서 한 번 고르고, 행마다 제목 · 날짜만 넣는다. 반복 · 음력 · 메모는 한 건 추가 창에서 한다.
 * 제목이 빈 행은 건너뛰고, 서버는 한 트랜잭션으로 저장해 일부만 들어가는 일이 없다.
 */
import { useEffect, useState } from 'react';
import { IconClose, IconPlus } from '@/components/icons';
import { notify } from '@/lib/toast';
import { localDate } from '@/lib/finance';
import { api } from '@/lib/api';
import { EV_TYPE_OPTIONS, type EvType } from '@/lib/calendar';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Segmented from '@/components/ui/Segmented';
import { FieldGroup, ModalFooter } from '@/components/ui/Field';
import { NotifyCheckbox, TypeMark } from './parts';

// 서버 한도와 같다 (BulkCreateEventDto ArrayMaxSize)
const MAX_ROWS = 50;

interface Row { key: number; title: string; date: string }

let rowSeq = 0;
// 새 행 — 날짜는 바로 윗행 날짜를 이어받는다
const newRow = (date: string): Row => ({ key: ++rowSeq, title: '', date });

// 일괄 추가 창 — defaultDate 는 캘린더에서 고른 날 (없으면 오늘)
export default function BulkEventModal({ open, defaultDate, onClose, onSaved }: { open: boolean; defaultDate?: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<EvType>('task');
  const [notifyOn, setNotifyOn] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  // 엔터로 새 행을 만들면 그 행 제목에 바로 커서를 둔다
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [invalid, setInvalid] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const date = defaultDate ?? localDate();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 창이 열릴 때 폼 초기화
    setType('task'); setNotifyOn(false); setRows([newRow(date), newRow(date), newRow(date)]);
    setFocusKey(null); setInvalid(new Set()); setError('');
  }, [open, defaultDate]);

  const filled = rows.filter((r) => r.title.trim());

  // 행 한 칸 고치기 — 고친 행의 오류 표시는 지운다
  function updateRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    if (invalid.has(key)) setInvalid((s) => { const n = new Set(s); n.delete(key); return n; });
  }

  // 맨 아래에 행 추가 (최대 MAX_ROWS)
  function addRow(focus = false) {
    if (rows.length >= MAX_ROWS) return;
    const row = newRow(rows[rows.length - 1]?.date ?? defaultDate ?? localDate());
    setRows((rs) => [...rs, row]);
    if (focus) setFocusKey(row.key);
  }

  // 행 삭제 — 마지막 한 행은 남긴다
  function removeRow(key: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }

  // 제목에서 엔터 — 마지막 행이면 새 행을 만든다
  function handleTitleKey(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (idx === rows.length - 1) addRow(true);
  }

  async function handleSave() {
    if (!filled.length) { setError('제목을 하나 이상 입력하세요.'); return; }
    const noDate = filled.filter((r) => !r.date);
    if (noDate.length) {
      setInvalid(new Set(noDate.map((r) => r.key)));
      setError('날짜를 선택하세요.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.post('/calendar/bulk', {
        events: filled.map((r) => ({ title: r.title.trim(), date: r.date, type, notify: notifyOn })),
      });
      notify.success(`일정 ${filled.length}건이 추가됐습니다.`);
      onSaved();
    } catch (err) {
      notify.error((err as Error).message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="일정 일괄 추가"
      subtitle="제목이 빈 행은 건너뜁니다. 반복 · 음력 · 메모는 한 건씩 추가에서 넣습니다."
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} saveLabel={filled.length ? `${filled.length}건 저장` : '저장'} />}
    >
      <FieldGroup label="유형">
        <Segmented
          variant="soft"
          label="유형"
          className="flex-wrap"
          value={type}
          onChange={setType}
          items={EV_TYPE_OPTIONS.map((o) => ({ value: o.value, label: <span className="inline-flex items-center gap-2"><TypeMark type={o.value} />{o.label}</span> }))}
        />
      </FieldGroup>
      <NotifyCheckbox checked={notifyOn} onChange={setNotifyOn} />

      <div className="flex flex-col gap-2">
        <div className="flex gap-2 text-[0.78rem] text-muted max-sm:hidden">
          <span className="flex-1">제목</span>
          <span className="w-38">날짜</span>
          <span className="w-8" />
        </div>
        {rows.map((r, idx) => (
          <div key={r.key} className="flex flex-wrap sm:flex-nowrap items-center gap-2 max-sm:pb-2 max-sm:border-b max-sm:border-border-subtle">
            <input
              type="text"
              className="input flex-1 min-w-0 max-sm:basis-full"
              placeholder={idx === 0 ? '예: 연말정산 서류 챙기기' : ''}
              aria-label={`${idx + 1}번째 제목`}
              maxLength={200}
              autoFocus={r.key === focusKey}
              value={r.title}
              onChange={(e) => { updateRow(r.key, { title: e.target.value }); setError(''); }}
              onKeyDown={(e) => handleTitleKey(e, idx)}
            />
            <input
              type="date"
              className="input w-38 max-sm:flex-1"
              aria-label={`${idx + 1}번째 날짜`}
              aria-invalid={invalid.has(r.key) || undefined}
              value={r.date}
              onChange={(e) => updateRow(r.key, { date: e.target.value })}
            />
            <IconButton label={`${idx + 1}번째 행 삭제`} onClick={() => removeRow(r.key)} disabled={rows.length === 1}><IconClose /></IconButton>
          </div>
        ))}
        {error && <p role="alert" className="text-[0.75rem] text-danger">{error}</p>}
        {rows.length < MAX_ROWS && (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => addRow(true)}><IconPlus />행 추가</Button>
        )}
      </div>
    </Modal>
  );
}
