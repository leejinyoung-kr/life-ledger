'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { Field, ModalFooter } from '@/components/ui/Field';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import { ASSET_TYPE_LABEL, type Asset } from '@/lib/networth';

export type AssetModalState = { open: boolean; mode: 'add' | 'edit'; editing?: Asset };

export function AssetModal({ assetType, state, onClose, onSaved }: {
  assetType: 'realestate' | 'debt';
  state: AssetModalState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const e = state.editing;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const typeLabel = ASSET_TYPE_LABEL[assetType];

  useEffect(() => {
    if (!state.open) return;
    setErrors({});
    setName(e?.name ?? '');
    setAmount(e ? String(e.amount) : '');
    setInterestRate(e?.interestRate != null ? String(e.interestRate) : '');
    setMemo(e?.memo ?? '');
  }, [state.open, e]);

  function validate() {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = '항목명을 입력하세요.';
    if (!amount || Number(amount) < 0) err.amount = '금액을 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  function clearErr(field: string) { setErrors((p) => { const n = { ...p }; delete n[field]; return n; }); }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        type: assetType,
        name,
        amount: Number(amount),
        interestRate: interestRate !== '' ? Number(interestRate) : undefined,
        memo: memo || undefined,
      };
      if (state.mode === 'edit' && e) await api.put(`/assets/${e.id}`, payload);
      else await api.post('/assets', payload);
      notify.upserted(state.mode, typeLabel);
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.mode === 'edit' ? `${typeLabel} 수정` : `${typeLabel} 추가`}
      footer={<ModalFooter onClose={onClose} onSave={save} saving={saving} />}
    >
      <Field label="항목명" required error={errors.name}>
        <input
          type="text"
          className={`input${errors.name ? ' is-invalid' : ''}`}
          placeholder={assetType === 'realestate' ? '예: 전세보증금' : '예: 전세자금대출'}
          value={name}
          onChange={(ev) => { setName(ev.target.value); clearErr('name'); }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label={assetType === 'realestate' ? '현재가 (원)' : '잔액 (원)'} required error={errors.amount}>
          <input
            type="number"
            className={`input${errors.amount ? ' is-invalid' : ''}`}
            placeholder="0"
            value={amount}
            onChange={(ev) => { setAmount(ev.target.value); clearErr('amount'); }}
          />
        </Field>
        <Field label="금리 (%, 선택)">
          <input type="number" className="input" placeholder="3.2" step="0.1" value={interestRate} onChange={(ev) => setInterestRate(ev.target.value)} />
        </Field>
      </div>
      <Field label="메모 (선택)">
        <input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} />
      </Field>
    </Modal>
  );
}
