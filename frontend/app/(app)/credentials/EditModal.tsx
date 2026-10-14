'use client';

import { useEffect, useState } from 'react';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import { CRED_CATEGORIES, pwStrength, generatePassword, type Credential } from '@/lib/credential';
import { useFormErrors } from '@/lib/useFormErrors';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { Field, FormGroup, ModalFooter } from '@/components/ui/Field';
import { IconEye } from '@/components/icons';

export type EditState = { open: boolean; mode: 'add' | 'edit'; editing: Credential | null };

const STRENGTH_FILL = { danger: 'danger', warning: 'warning', green: 'green' } as const;
const STRENGTH_TEXT = { danger: 'text-danger', warning: 'text-warning', green: 'text-success' } as const;

// 계정 추가·수정 모달 (수정 시 비밀번호는 입력해야만 변경)
export default function EditModal({ state, onClose, onSaved }: { state: EditState; onClose: () => void; onSaved: () => void }) {
  const isEdit = state.mode === 'edit';
  const editing = state.editing;
  const [serviceName, setServiceName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState(CRED_CATEGORIES[0]);
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  // 입력 중 비밀번호는 기본으로 가린다 — 화면 공유 · 어깨너머 노출 방지
  const [showPw, setShowPw] = useState(false);
  const [totp, setTotp] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setServiceName(editing?.name ?? '');
    setUrl(editing?.url ?? '');
    setCategory(editing?.category ?? CRED_CATEGORIES[0]);
    setUsername(editing?.username ?? '');
    setPw('');
    setShowPw(false);
    setTotp('');
    setMemo(editing?.memo ?? '');
  }, [state.open, editing, reset]);

  // 필수 입력 검사
  function validate() {
    const err: Record<string, string> = {};
    if (!serviceName.trim()) err.serviceName = '서비스명을 입력하세요.';
    if (!username.trim()) err.username = '아이디를 입력하세요.';
    if (!isEdit && !pw) err.pw = '비밀번호를 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!validate()) return;
    const body = {
      name: serviceName.trim(),
      url: url || undefined,
      category,
      username: username.trim(),
      ...(pw ? { password: pw } : {}),
      totp: totp || undefined,
      memo: memo || undefined,
    };
    setSaving(true);
    try {
      if (isEdit && editing) await api.put(`/credentials/${editing.id}`, body);
      else await api.post('/credentials', body);
      notify.upserted(isEdit ? 'edit' : 'add', '계정');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  const strength = pwStrength(pw);

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={isEdit ? '계정 수정' : '계정 추가'}
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} saveLabel="저장 (암호화)" />}
    >
      <FormGroup title="서비스" first>
        <Field label="서비스명" required error={errors.serviceName}>
          <input type="text" className="input" placeholder="예: GitHub" value={serviceName} onChange={(e) => { setServiceName(e.target.value); clearError('serviceName'); }} />
        </Field>
        <Field label="URL"><input type="url" className="input" placeholder="https://github.com" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
        <Field label="카테고리" required>
          <select className="input" aria-label="카테고리" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CRED_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </FormGroup>

      <FormGroup title="로그인 정보">
        <Field label="아이디" required error={errors.username}>
          <input type="text" className="input" placeholder="아이디 또는 이메일" value={username} onChange={(e) => { setUsername(e.target.value); clearError('username'); }} />
        </Field>
        <Field label={isEdit ? '비밀번호 (변경 시에만 입력)' : '비밀번호'} required={!isEdit} error={errors.pw}>
          <div className="flex gap-2">
            <input type={showPw ? 'text' : 'password'} autoComplete="new-password" className="input" placeholder={isEdit ? '비워두면 기존 비밀번호 유지' : '비밀번호'} value={pw} onChange={(e) => { setPw(e.target.value); clearError('pw'); }} />
            <IconButton label={showPw ? '비밀번호 숨김' : '비밀번호 표시'} variant="bordered" size="lg" onClick={() => setShowPw((v) => !v)}><IconEye /></IconButton>
            {/* 생성한 비밀번호는 사용자가 확인해야 하므로 바로 보여 준다 */}
            <Button variant="ghost" className="whitespace-nowrap" onClick={() => { setPw(generatePassword()); setShowPw(true); clearError('pw'); }}>생성</Button>
          </div>
          {pw && (
            <>
              <div className="track"><div className={`fill ${STRENGTH_FILL[strength.tone]}`} style={{ width: `${strength.pct}%` }} /></div>
              <span className={`text-[0.72rem] ${STRENGTH_TEXT[strength.tone]}`}>강도: {strength.label}</span>
            </>
          )}
        </Field>
      </FormGroup>

      <FormGroup title="추가 정보 (선택)">
        <Field label="2단계 인증 (TOTP)">
          <input type="text" className="input input-mono" placeholder={isEdit && editing?.has2fa ? '비워두면 기존 2FA 유지 · 바꿀 때만 입력' : 'otpauth:// 또는 시크릿 키'} value={totp} onChange={(e) => setTotp(e.target.value)} />
        </Field>
        <Field label="메모"><input type="text" className="input" placeholder="추가 정보" value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
      </FormGroup>
    </Modal>
  );
}

