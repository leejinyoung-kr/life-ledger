'use client';

/**
 * 휴대폰 목록 카드 — 표(md 이상) 대신 쓴다. 머리(선택 · 아이콘 · 이름 · 오른쪽 값) / 이름표 · 값 줄 / 같은 폭 버튼 줄.
 * 목록은 MobileCardList 로 감싸 카드끼리 띄워 쌓는다.
 */
import type { ReactNode } from 'react';
import Button from './ui/Button';
import EmptyState from './EmptyState';

export interface MobileField {
  label: string;
  value: ReactNode;
  /** 이름표 · 값을 강조색으로 (만기 임박 같은 경고) */
  tone?: 'warning';
}

export interface MobileAction {
  label: string;
  onClick: () => void;
  /** 삭제 · 해지 같은 위험 동작은 지출 색 테두리 */
  danger?: boolean;
}

// 휴대폰 목록 카드 한 장
export default function MobileCard({ checked, onCheck, icon, title, sub, aside, fields, actions, children }: {
  /** 선택 체크박스 — onCheck 를 주면 보인다 */
  checked?: boolean;
  onCheck?: () => void;
  icon?: ReactNode;
  title: ReactNode;
  /** 이름 아래 작은 글자 (주소 · 분류) */
  sub?: ReactNode;
  /** 머리 오른쪽 (금액 · 배지) */
  aside?: ReactNode;
  /** 머리 아래 이름표 · 값 줄 — 값이 null · undefined · '' 인 줄은 뺀다 */
  fields?: MobileField[];
  /** 같은 폭 버튼 줄 — 배열의 배열이면 여러 줄 (투자: 매수 · 매도 / 복사 · 수정 · 삭제) */
  actions?: MobileAction[] | MobileAction[][];
  /** 이름표 줄 대신(또는 아래에) 넣는 자유 내용 */
  children?: ReactNode;
}) {
  const shown = (fields ?? []).filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
  const actionRows = !actions || actions.length === 0 ? [] : Array.isArray(actions[0]) ? (actions as MobileAction[][]) : [actions as MobileAction[]];
  return (
    <div className="bg-background border border-border rounded-panel shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {onCheck && (
          <label className="-m-2.5 p-2.5 shrink-0 flex">
            <input type="checkbox" className="checkbox" checked={!!checked} onChange={onCheck} aria-label="선택" />
          </label>
        )}
        {icon && <span className="shrink-0">{icon}</span>}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
          <span className="text-[0.95rem] font-semibold text-primary break-all">{title}</span>
          {sub && <span className="text-[0.75rem] text-muted truncate">{sub}</span>}
        </div>
        {aside && <div className="shrink-0 flex flex-col items-end gap-0.5 text-right leading-snug">{aside}</div>}
      </div>
      {shown.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 pt-3 border-t border-border-subtle text-[0.8125rem]">
          {shown.map((f) => (
            <div key={f.label} className="contents">
              <dt className={f.tone === 'warning' ? 'text-warning' : 'text-muted'}>{f.label}</dt>
              <dd className={`min-w-0 break-all ${f.tone === 'warning' ? 'text-warning font-medium' : 'text-primary'}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      {actionRows.length > 0 && (
        <div className="flex flex-col gap-2">
          {actionRows.map((row, i) => (
            <div key={i} className="flex gap-2">
              {row.map((a) => (
                <Button key={a.label} variant={a.danger ? 'danger' : 'ghost'} size="lg" className="flex-1 px-2" onClick={a.onClick}>{a.label}</Button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 휴대폰 목록 — 카드를 띄워 쌓는다. md 이상에서는 숨긴다(표가 대신). 비었으면 안내 글
export function MobileCardList({ empty, className = '', children }: { empty?: string | false; className?: string; children: ReactNode }) {
  return (
    <div className={`md:hidden flex flex-col gap-3 py-3 ${className}`.trim()}>
      {empty && <EmptyState message={empty} />}
      {children}
    </div>
  );
}
