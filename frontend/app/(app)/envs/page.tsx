'use client';

/**
 * ENV 보관함 페이지.
 * 프로젝트별 환경변수를 dev/staging/prod 환경 탭으로 나눠 암호화 관리한다.
 * 값 마스킹·복사·.env 일괄 복사/다운로드·붙여넣기 파싱을 지원하며, 데이터는 더미로 채운다.
 * 스타일: Tailwind + 공통 컴포넌트. env-table(그룹행 구조)은 공통 globals 유지.
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Field, ModalFooter } from '@/components/ui/Field';
import {
  IconCode, IconFileBlank, IconEdit, IconPlus, IconCopy, IconEye,
  IconTrash, IconDownload, IconCheck,
} from '@/components/icons';

type EnvKey = 'dev' | 'staging' | 'prod';

interface EnvVar { group: string; key: string; value: string; masked: boolean; }
interface Project { emoji: string; name: string; envs: Partial<Record<EnvKey, EnvVar[]>>; }

// 환경 탭 점 색
const ENV_DOT: Record<EnvKey, string> = { dev: 'bg-accent', staging: 'bg-warning', prod: 'bg-danger' };

// ── 더미 데이터 (TODO: GET /api/v1/env-projects) ────────────────
const PROJECTS: Project[] = [
  {
    emoji: '🚀', name: 'doc-nexus',
    envs: {
      dev: [
        { group: 'Database', key: 'DATABASE_URL', value: 'mysql://root:root@localhost:3306/doc_nexus', masked: true },
        { group: 'Database', key: 'DATABASE_HOST', value: 'localhost', masked: false },
        { group: 'Auth', key: 'JWT_SECRET', value: 'dev_jwt_secret_key_very_long', masked: true },
        { group: 'Auth', key: 'CREDENTIAL_SECRET', value: 'dev_aes_secret_32bytes_key!!', masked: true },
        { group: 'Auth', key: 'GOOGLE_CLIENT_ID', value: '1234567890-abcdef.apps.googleusercontent.com', masked: false },
        { group: 'Auth', key: 'GOOGLE_CLIENT_SECRET', value: 'GOCSPX-xxxxxxxxxxxxxxxx', masked: true },
        { group: 'Storage', key: 'R2_BUCKET', value: 'doc-nexus-dev', masked: false },
        { group: 'Storage', key: 'R2_ENDPOINT', value: 'https://xxxx.r2.cloudflarestorage.com', masked: false },
        { group: 'Storage', key: 'R2_ACCESS_KEY', value: 'dev_r2_access_key', masked: true },
        { group: 'Storage', key: 'R2_SECRET_KEY', value: 'dev_r2_secret_key', masked: true },
        { group: 'API Keys', key: 'CLAUDE_API_KEY', value: 'sk-ant-api03-xxxxxxxxxx', masked: true },
        { group: 'App', key: 'PORT', value: '3001', masked: false },
        { group: 'App', key: 'NODE_ENV', value: 'development', masked: false },
        { group: 'App', key: 'FRONTEND_URL', value: 'http://localhost:3000', masked: false },
      ],
      prod: [
        { group: 'Database', key: 'DATABASE_URL', value: 'mysql://prod_user:****@railway.internal/doc_nexus', masked: true },
        { group: 'Auth', key: 'JWT_SECRET', value: 'prod_jwt_secret_very_secure_key', masked: true },
        { group: 'Auth', key: 'CREDENTIAL_SECRET', value: 'prod_aes_secret_32bytes_key!!', masked: true },
        { group: 'Auth', key: 'GOOGLE_CLIENT_ID', value: '1234567890-abcdef.apps.googleusercontent.com', masked: false },
        { group: 'Auth', key: 'GOOGLE_CLIENT_SECRET', value: 'GOCSPX-xxxxxxxxxxxxxxxx', masked: true },
        { group: 'Storage', key: 'R2_BUCKET', value: 'doc-nexus-prod', masked: false },
        { group: 'Storage', key: 'R2_ACCESS_KEY', value: 'prod_r2_access_key', masked: true },
        { group: 'Storage', key: 'R2_SECRET_KEY', value: 'prod_r2_secret_key', masked: true },
        { group: 'API Keys', key: 'CLAUDE_API_KEY', value: 'sk-ant-api03-xxxxxxxxxx', masked: true },
        { group: 'App', key: 'PORT', value: '3001', masked: false },
        { group: 'App', key: 'NODE_ENV', value: 'production', masked: false },
        { group: 'App', key: 'FRONTEND_URL', value: 'https://doc-nexus.vercel.app', masked: false },
      ],
    },
  },
  {
    emoji: '🛒', name: 'shop-admin',
    envs: {
      dev: [
        { group: 'Database', key: 'DATABASE_URL', value: 'mysql://root:root@localhost:3306/shop', masked: true },
        { group: 'Auth', key: 'JWT_SECRET', value: 'shop_dev_jwt_secret', masked: true },
        { group: 'App', key: 'PORT', value: '4000', masked: false },
      ],
      prod: [
        { group: 'Database', key: 'DATABASE_URL', value: 'mysql://prod:****@railway.internal/shop', masked: true },
        { group: 'Auth', key: 'JWT_SECRET', value: 'shop_prod_jwt_secret', masked: true },
        { group: 'App', key: 'PORT', value: '4000', masked: false },
      ],
    },
  },
  {
    emoji: '🤖', name: 'ai-chatbot',
    envs: {
      dev: [
        { group: 'API Keys', key: 'CLAUDE_API_KEY', value: 'sk-ant-api03-yyyyyy', masked: true },
        { group: 'App', key: 'PORT', value: '5000', masked: false },
        { group: 'App', key: 'NODE_ENV', value: 'development', masked: false },
      ],
    },
  },
];

const ENV_TABS: { key: EnvKey; label: string }[] = [
  { key: 'dev', label: 'development' },
  { key: 'staging', label: 'staging' },
  { key: 'prod', label: 'production' },
];

// 프로젝트의 전체 변수 개수 (모든 환경 합산)
function totalVarCount(p: Project) {
  return Object.values(p.envs).reduce((sum, list) => sum + (list?.length ?? 0), 0);
}

// 변수 목록을 .env 텍스트로 직렬화 (그룹별 주석 포함)
function toEnvText(name: string, env: EnvKey, vars: EnvVar[]) {
  let text = `# ${name} - ${env}\n\n`;
  let lastGroup = '';
  for (const v of vars) {
    if (v.group && v.group !== lastGroup) {
      text += `\n# ${v.group}\n`;
      lastGroup = v.group;
    }
    text += `${v.key}=${v.value}\n`;
  }
  return text;
}

export default function EnvsPage() {
  const [projectIdx, setProjectIdx] = useState(0);
  const [env, setEnv] = useState<EnvKey>('dev');
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [paste, setPaste] = useState('');
  const [projectModal, setProjectModal] = useState<{ open: boolean; mode: 'add' | 'edit' }>({ open: false, mode: 'add' });
  const [envModal, setEnvModal] = useState<{ open: boolean; mode: 'add' | 'edit' }>({ open: false, mode: 'add' });
  const hideTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = hideTimers.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  // 프로젝트 전환 — 환경/표시상태 초기화
  function selectProject(idx: number) {
    setProjectIdx(idx);
    setEnv('dev');
    setVisible({});
  }

  // 마스킹 값 표시/숨김 토글 — 표시 시 10초 뒤 자동 숨김
  function toggleValue(uid: string) {
    setVisible((prev) => {
      const next = !prev[uid];
      if (hideTimers.current[uid]) clearTimeout(hideTimers.current[uid]);
      if (next) {
        hideTimers.current[uid] = setTimeout(() => {
          setVisible((p) => ({ ...p, [uid]: false }));
        }, 10000);
      }
      return { ...prev, [uid]: next };
    });
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // 현재 환경 변수를 .env 파일로 다운로드
  function downloadEnv() {
    const text = toEnvText(project.name, env, vars);
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `.${env}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // 붙여넣은 .env 텍스트를 KEY=VALUE 로 파싱. TODO: 파싱 결과 암호화 저장 API 연동
  function parsePaste() {
    const parsed = paste
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const eq = l.indexOf('=');
        return { key: l.slice(0, eq).trim(), value: l.slice(eq + 1).trim() };
      })
      .filter((p) => p.key);
    if (!parsed.length) return;
    setPaste('');
  }

  const project = PROJECTS[projectIdx];
  const vars = project.envs[env] ?? [];

  // 변수 목록을 그룹 순서를 유지하며 그룹별로 묶기
  const grouped = vars.reduce<{ group: string; items: EnvVar[] }[]>((acc, v) => {
    const g = v.group || '기타';
    const found = acc.find((x) => x.group === g);
    if (found) found.items.push(v);
    else acc.push({ group: g, items: [v] });
    return acc;
  }, []);

  return (
    <AppShell activePath="/envs" topbarLabel="ENV 보관함">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">ENV 보관함</h1>
          <p className="text-sm text-secondary mt-1.5">프로젝트별 환경변수를 암호화하여 관리합니다. (AES-256-GCM)</p>
        </div>
        <Button onClick={() => setProjectModal({ open: true, mode: 'add' })}>프로젝트 추가</Button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-5 items-start max-md:grid-cols-1">
        {/* 프로젝트 목록 */}
        <div className="bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden sticky top-[calc(var(--header-h)+24px)] max-md:static">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-surface">
            <span className="[font-family:var(--font-display)] text-[0.875rem] font-bold text-primary">프로젝트</span>
            <Badge tone="neutral">{PROJECTS.length}개</Badge>
          </div>
          <div className="p-2">
            {PROJECTS.map((p, idx) => {
              const active = idx === projectIdx;
              return (
                <button type="button" key={p.name} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius)] cursor-pointer transition-colors border border-transparent w-full text-left hover:bg-surface ${active ? 'bg-accent-dim border-[rgba(0,192,127,0.2)]' : ''}`} onClick={() => selectProject(idx)}>
                  <div className={`w-8 h-8 rounded-[var(--radius)] border flex items-center justify-center text-[0.9rem] shrink-0 ${active ? 'bg-accent-dim border-[rgba(0,192,127,0.3)]' : 'bg-elevated border-border'}`}>{p.emoji}</div>
                  <div>
                    <div className={`text-[0.855rem] font-semibold ${active ? 'text-accent' : 'text-primary'}`}>{p.name}</div>
                    <div className="text-[0.72rem] text-muted mt-px">변수 {totalVarCount(p)}개 · {Object.keys(p.envs).join('/')}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <button type="button" className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius)] cursor-pointer text-muted text-[0.82rem] transition-all border border-dashed border-border mx-2 mb-2 w-[calc(100%-16px)] hover:border-accent hover:text-accent hover:bg-accent-dim" onClick={() => setProjectModal({ open: true, mode: 'add' })}>
            <IconPlus width={14} height={14} />새 프로젝트
          </button>
        </div>

        {/* 환경변수 편집 패널 */}
        <div className="flex flex-col gap-4">
          {/* 프로젝트 헤더 + 액션 */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="text-[1.4rem]">{project.emoji}</span>
              <div>
                <div className="[font-family:var(--font-display)] text-base font-bold text-primary">{project.name}</div>
                <div className="text-[0.75rem] text-muted">AES-256-GCM 암호화 · {totalVarCount(project)}개 변수</div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm"><IconCode width={13} height={13} />환경 비교</Button>
              <Button variant="ghost" size="sm"><IconFileBlank width={13} height={13} />.env.example</Button>
              <Button variant="ghost" size="sm" onClick={() => setProjectModal({ open: true, mode: 'edit' })}><IconEdit width={13} height={13} />수정</Button>
              <Button variant="danger" size="sm" onClick={() => setEnvModal({ open: true, mode: 'add' })}><IconPlus width={13} height={13} />변수 추가</Button>
            </div>
          </div>

          {/* 환경 탭 + 변수 테이블 + 전체 복사 바 */}
          <div className="bg-background border border-border rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="flex border-b border-border px-4 bg-surface">
              {ENV_TABS.map((t) => (
                <button type="button" key={t.key} className={`px-4 py-2 text-[0.82rem] font-medium cursor-pointer border-b-2 -mb-px transition-all flex items-center gap-1.5 ${env === t.key ? 'text-accent border-accent font-semibold' : 'text-muted border-transparent hover:text-secondary'}`} onClick={() => { setEnv(t.key); setVisible({}); }}>
                  <span className={`w-[7px] h-[7px] rounded-full ${ENV_DOT[t.key]}`} />{t.label}
                </button>
              ))}
            </div>

            {/* env-table: 그룹행 구조라 공통 globals 유지 */}
            <table className="env-table">
              <thead>
                <tr>
                  <th className="env-th-key">KEY</th>
                  <th>VALUE</th>
                  <th className="env-th-action">액션</th>
                </tr>
              </thead>
              <tbody>
                {vars.length === 0 ? (
                  <tr><td colSpan={3} className="env-empty">이 환경에 변수가 없습니다.</td></tr>
                ) : (
                  grouped.map((g) => (
                    <EnvGroupRows
                      key={g.group}
                      group={g.group}
                      items={g.items}
                      env={env}
                      visible={visible}
                      onToggle={toggleValue}
                      onCopy={copy}
                      onEdit={() => setEnvModal({ open: true, mode: 'edit' })}
                    />
                  ))
                )}
              </tbody>
            </table>

            <div className="flex items-center gap-2.5 px-[18px] py-3 bg-surface border-t border-border">
              <span className="text-[0.78rem] text-muted flex-1">.env 파일 형식으로 전체 복사</span>
              <Button variant="ghost" size="sm" onClick={() => copy(toEnvText(project.name, env, vars))}><IconCopy width={13} height={13} />전체 복사</Button>
              <Button variant="ghost" size="sm" onClick={downloadEnv}><IconDownload width={13} height={13} />.env 다운로드</Button>
            </div>
          </div>

          {/* 일괄 붙여넣기 */}
          <div className="border-2 border-dashed border-border rounded-[var(--radius-lg)] p-5 flex flex-col gap-3">
            <div className="text-[0.82rem] font-semibold text-secondary flex items-center gap-1.5">
              <IconCode width={14} height={14} />.env 파일 내용 붙여넣기 (일괄 저장)
            </div>
            <textarea
              className="w-full min-h-[120px] bg-surface border border-border rounded-[var(--radius)] px-3.5 py-3 [font-family:var(--font-mono)] text-[0.82rem] text-primary resize-y outline-none leading-[1.7] transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)] placeholder:text-muted"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={'# .env 내용을 그대로 붙여넣으세요\nDATABASE_URL=mysql://root:root@localhost:3306/doc_nexus\nJWT_SECRET=your_jwt_secret\nCLAUDE_API_KEY=sk-ant-...'}
              aria-label=".env 붙여넣기"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setPaste('')}>초기화</Button>
              <Button onClick={parsePaste}><IconCheck width={13} height={13} />파싱 후 저장</Button>
            </div>
          </div>
        </div>
      </div>

      {/* 모달 */}
      <ProjectModal state={projectModal} onClose={() => setProjectModal((s) => ({ ...s, open: false }))} />
      <EnvModal state={envModal} onClose={() => setEnvModal((s) => ({ ...s, open: false }))} />
    </AppShell>
  );
}

// 변수 그룹 헤더 + 변수 행들 (env-table 내부 — globals 스타일 유지)
function EnvGroupRows({
  group, items, env, visible, onToggle, onCopy, onEdit,
}: {
  group: string; items: EnvVar[]; env: EnvKey;
  visible: Record<string, boolean>;
  onToggle: (uid: string) => void; onCopy: (text: string) => void; onEdit: () => void;
}) {
  return (
    <>
      <tr><td colSpan={3} className="env-group-label">{group}</td></tr>
      {items.map((item) => {
        const uid = `${env}_${item.key}`;
        const shown = visible[uid] || false;
        const display = item.masked && !shown ? '•'.repeat(Math.min(item.value.length, 20)) : item.value;
        return (
          <tr key={item.key}>
            <td><span className="env-key">{item.key}</span></td>
            <td>
              <div className="env-value-wrap">
                <span className={`env-value${item.masked && !shown ? ' masked' : ''}`}>{display}</span>
                {item.masked && (
                  <button type="button" className="icon-btn" onClick={() => onToggle(uid)} aria-label="값 표시/숨김">
                    <IconEye width={13} height={13} />
                  </button>
                )}
                <button type="button" className="icon-btn" onClick={() => onCopy(item.value)} aria-label="값 복사">
                  <IconCopy width={13} height={13} />
                </button>
              </div>
            </td>
            <td className="td-center">
              <div className="flex justify-center gap-1">
                <button type="button" className="w-7 h-7 rounded-[5px] inline-flex items-center justify-center text-secondary border border-border transition-all hover:bg-surface hover:text-primary" onClick={onEdit} aria-label="수정">
                  <IconEdit width={14} height={14} />
                </button>
                <button type="button" className="w-7 h-7 rounded-[5px] inline-flex items-center justify-center bg-danger-dim text-danger transition-all hover:bg-[rgba(240,68,56,0.15)]" aria-label="삭제">
                  <IconTrash width={14} height={14} />
                </button>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

// 환경 적용 체크박스 그룹 (dev/staging/prod)
function EnvFlags({ labels }: { labels?: [string, string, string] }) {
  const [dev, st, prod] = labels ?? ['dev', 'staging', 'prod'];
  return (
    <div className="flex gap-2 flex-wrap mt-0.5 [&_label]:flex [&_label]:items-center [&_label]:gap-1.5 [&_label]:text-[0.855rem] [&_label]:cursor-pointer [&_input]:accent-accent">
      <label><input type="checkbox" defaultChecked /> {dev}</label>
      <label><input type="checkbox" /> {st}</label>
      <label><input type="checkbox" defaultChecked /> {prod}</label>
    </div>
  );
}

// 환경 라벨 블록 (라벨 + flags)
function FlagsField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.8rem] font-medium text-secondary flex items-center gap-0.5">{label}{required && <span className="text-danger font-bold text-[0.85rem] leading-none">*</span>}</span>
      {children}
    </div>
  );
}

// 프로젝트 추가·수정 모달
function ProjectModal({ state, onClose }: { state: { open: boolean; mode: 'add' | 'edit' }; onClose: () => void }) {
  const [projectName, setProjectName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    setErrors({}); setProjectName('');
  }, [state.open]);

  function handleSave() {
    const err: Record<string, string> = {};
    if (!projectName.trim()) err.projectName = '프로젝트명을 입력하세요.';
    setErrors(err);
    if (Object.keys(err).length) return;
    toast.success(state.mode === 'edit' ? '프로젝트가 수정됐습니다.' : '프로젝트가 추가됐습니다.');
    onClose();
  }

  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '프로젝트 수정' : '프로젝트 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={false} />}>
      <Field label="이모지"><input type="text" className="input w-[80px]" placeholder="🚀" /></Field>
      <Field label="프로젝트명" required error={errors.projectName}>
        <input type="text" className={`input${errors.projectName ? ' is-invalid' : ''}`} placeholder="예: my-project" value={projectName} onChange={(e) => { setProjectName(e.target.value); setErrors((p) => { const n = { ...p }; delete n.projectName; return n; }); }} />
      </Field>
      <Field label="설명 (선택)"><input type="text" className="input" placeholder="프로젝트 간단 설명" /></Field>
      <FlagsField label="환경" required>
        <EnvFlags labels={['development', 'staging', 'production']} />
      </FlagsField>
    </Modal>
  );
}

// 변수 추가·수정 모달
function EnvModal({ state, onClose }: { state: { open: boolean; mode: 'add' | 'edit' }; onClose: () => void }) {
  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    setErrors({}); setEnvKey(''); setEnvValue('');
  }, [state.open]);

  function handleSave() {
    const err: Record<string, string> = {};
    if (!envKey.trim()) err.envKey = 'KEY를 입력하세요.';
    if (!envValue.trim()) err.envValue = 'VALUE를 입력하세요.';
    setErrors(err);
    if (Object.keys(err).length) return;
    toast.success(state.mode === 'edit' ? '변수가 수정됐습니다.' : '변수가 추가됐습니다.');
    onClose();
  }

  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '변수 수정' : '변수 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={false} saveLabel="저장 (암호화)" />}>
      <Field label="그룹 (선택)">
        <select className="input" aria-label="그룹">
          <option value="">없음</option>
          <option>Database</option><option>Auth</option><option>Storage</option>
          <option>API Keys</option><option>App</option>
        </select>
      </Field>
      <Field label="KEY" required error={errors.envKey}>
        <input type="text" className={`input input-mono${errors.envKey ? ' is-invalid' : ''}`} placeholder="예: DATABASE_URL" value={envKey} onChange={(e) => { setEnvKey(e.target.value); setErrors((p) => { const n = { ...p }; delete n.envKey; return n; }); }} />
      </Field>
      <Field label="VALUE" required error={errors.envValue}>
        <input type="text" className={`input input-mono${errors.envValue ? ' is-invalid' : ''}`} placeholder="값 입력" value={envValue} onChange={(e) => { setEnvValue(e.target.value); setErrors((p) => { const n = { ...p }; delete n.envValue; return n; }); }} />
      </Field>
      <FlagsField label="적용 환경">
        <EnvFlags />
      </FlagsField>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="변수 설명" /></Field>
    </Modal>
  );
}
